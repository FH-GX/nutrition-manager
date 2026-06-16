// auth-wechat-login Edge Function
// 微信小程序 wx.login() → 换取 Supabase JWT
// ============================================

/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from "@supabase/supabase-js";

// ── 环境变量 ──
const WECHAT_APP_ID = Deno.env.get("WECHAT_APP_ID") || "";
const WECHAT_APP_SECRET = Deno.env.get("WECHAT_APP_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// ── CORS headers ──
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apiKey",
};

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

/**
 * 生成确定性密码：SHA-256(openid + service_role_key) → hex 前 32 位
 * 同一个 openid 永远得到同一个密码，无需存储
 */
async function deterministicPassword(openid: string): Promise<string> {
  const data = new TextEncoder().encode(openid + SUPABASE_SERVICE_ROLE_KEY);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.substring(0, 32);
}

Deno.serve(async (req) => {
  // CORS 预检
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    // ── 1. 解析请求 ──
    const body = await req.json();
    const { code } = body;

    if (!code) {
      return new Response(
        JSON.stringify({ error: "缺少 code 参数" }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    // ── 2. 调微信 jscode2session → 获取 openid ──
    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${WECHAT_APP_ID}&secret=${WECHAT_APP_SECRET}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;

    const wxRes = await fetch(wxUrl);
    const wxData = await wxRes.json();

    if (wxData.errcode || !wxData.openid) {
      console.error("微信 jscode2session 失败:", wxData);
      return new Response(
        JSON.stringify({
          error: "微信认证失败",
          detail: wxData.errmsg || "未知错误",
          errcode: wxData.errcode,
        }),
        { status: 401, headers: JSON_HEADERS }
      );
    }

    const openid: string = wxData.openid;
    const unionid: string = wxData.unionid || "";

    // ── 3. Supabase Auth：创建/登录用户 ──
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const email = `${openid}@wx.miniapp.local`;
    const password = await deterministicPassword(openid);

    // 尝试创建用户（已存在则忽略）
    let authUser: any = null;
    try {
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // 跳过邮箱验证
        user_metadata: { openid, provider: "wechat" },
      });
      if (createErr) {
        // 用户已存在 → 查出来
        if (createErr.message?.includes("already") || createErr.message?.includes("registered")) {
          const { data: existing } = await supabase.auth.admin.listUsers();
          authUser = existing?.users?.find((u: any) => u.email === email) || null;
        }
        if (!authUser) {
          console.error("创建用户失败:", createErr);
          return new Response(
            JSON.stringify({ error: "创建用户失败", detail: createErr.message }),
            { status: 500, headers: JSON_HEADERS }
          );
        }
      } else {
        authUser = newUser?.user || null;
      }
    } catch (e) {
      console.error("Supabase Auth 异常:", e);
      return new Response(
        JSON.stringify({ error: "服务器错误", detail: String(e) }),
        { status: 500, headers: JSON_HEADERS }
      );
    }

    // ── 4. 用 email/password 登录 → 拿到 access_token + refresh_token ──
    //    注意：admin.createUser 不会返回 session，必须再 signInWithPassword
    const { data: session, error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInErr || !session?.session) {
      console.error("signInWithPassword 失败:", signInErr);
      return new Response(
        JSON.stringify({ error: "登录失败", detail: signInErr?.message }),
        { status: 500, headers: JSON_HEADERS }
      );
    }

    const access_token = session.session.access_token;
    const refresh_token = session.session.refresh_token;
    const userId = session.user?.id;

    // ── 5. 创建/更新 user_accounts 行 ──
    if (userId) {
      // 检查是否已有 user_accounts 记录
      const { data: existingAccount } = await supabase
        .from("user_accounts")
        .select("id")
        .eq("openid", openid)
        .maybeSingle();

      if (!existingAccount) {
        // 新建
        await supabase.from("user_accounts").insert({
          auth_id: userId,
          openid,
          username: openid.substring(0, 8), // 临时用户名
          display_name: "",
          last_login: new Date().toISOString(),
        });
      } else {
        // 更新 last_login
        await supabase
          .from("user_accounts")
          .update({ last_login: new Date().toISOString() })
          .eq("openid", openid);
      }
    }

    // ── 6. 返回结果 ──
    return new Response(
      JSON.stringify({
        success: true,
        access_token,
        refresh_token,
        openid,
        unionid,
        user: {
          id: userId,
          email: session.user?.email,
        },
      }),
      { headers: JSON_HEADERS }
    );
  } catch (err) {
    console.error("auth-wechat-login 异常:", err);
    return new Response(
      JSON.stringify({ error: "服务器内部错误", detail: String(err) }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
});
