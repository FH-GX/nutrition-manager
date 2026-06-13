/**
 * Supabase 数据库连接与操作模块
 * 用于知识库和扫盲学习台功能
 */
const SUPABASE_URL = 'https://thgcjxnvsantzrdyqcug.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZ2NqeG52c2FudHpyZHlxY3VnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4ODUwMjEsImV4cCI6MjA5MzQ2MTAyMX0.zR3Dcics3I982dqZGbXv-zmbtXbJCb8VuAJSKjoyP_8';

let supabaseClient = null;

/**
 * 初始化Supabase客户端
 */
function initSupabase() {
    if (typeof supabase === 'undefined') {
        console.warn('Supabase SDK未加载，请等待');
        return null;
    }
    if (!supabaseClient) {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: false,
            },
        });
    }
    return supabaseClient;
}

/**
 * 获取Supabase客户端实例
 */
function getSupabase() {
    if (!supabaseClient) return initSupabase();
    return supabaseClient;
}

// ============================================
// 管理员认证
// ============================================

/**
 * 管理员登录（使用Supabase Auth邮箱密码）
 * @param {string} email - 管理员邮箱
 * @param {string} password - 密码
 * @returns {Promise<object>} { success, error? }
 */
async function adminLogin(email, password) {
    try {
        const sb = getSupabase();
        if (!sb) return { success: false, error: 'Supabase未初始化' };

        const { data, error } = await sb.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            return { success: false, error: error.message };
        }

        // 检查 user_accounts 角色是否为 admin
        const { data: acct, error: acctErr } = await sb
            .from('user_accounts')
            .select('role')
            .eq('auth_id', data.user.id)
            .maybeSingle();

        if (acctErr || !acct || acct.role !== 'admin') {
            // 不是管理员，登出
            await sb.auth.signOut();
            return { success: false, error: '无管理员权限' };
        }

        return { success: true, user: data.user };
    } catch (err) {
        return { success: false, error: err.message || '登录失败' };
    }
}

/**
 * 管理员登出
 */
async function adminLogout() {
    try {
        const sb = getSupabase();
        if (sb) {
            await sb.auth.signOut();
        }
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * 检查当前登录状态
 */
async function checkAdminSession() {
    try {
        const sb = getSupabase();
        if (!sb) return { loggedIn: false };

        const { data: { session }, error } = await sb.auth.getSession();
        if (error || !session) {
            return { loggedIn: false };
        }
        return { loggedIn: true, user: session.user };
    } catch {
        return { loggedIn: false };
    }
}

// ============================================
// 知识库操作 (knowledge_base)
// ============================================

/**
 * 获取所有知识库条目（管理员用）
 */
async function getAllKnowledgeItems() {
    try {
        const sb = getSupabase();
        const { data, error } = await sb
            .from('knowledge_base')
            .select('*')
            .order('display_order', { ascending: true })
            .order('id', { ascending: true });

        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (err) {
        return { success: false, error: err.message, data: [] };
    }
}

/**
 * 获取已勾选展示的知识条目（供家人学习用）
 */
async function getDisplayedKnowledgeItems() {
    try {
        const sb = getSupabase();
        const { data, error } = await sb
            .from('knowledge_base')
            .select('*')
            .eq('is_displayed', true)
            .order('display_order', { ascending: true })
            .order('id', { ascending: true });

        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (err) {
        return { success: false, error: err.message, data: [] };
    }
}

/**
 * 添加知识条目
 */
async function addKnowledgeItem(title, content, category) {
    try {
        const sb = getSupabase();
        const { data, error } = await sb
            .from('knowledge_base')
            .insert({
                title: title,
                content: content,
                category: category,
                is_displayed: false,
                display_order: 0,
            })
            .select();

        if (error) throw error;
        return { success: true, data: data?.[0] };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * 更新知识条目
 */
async function updateKnowledgeItem(id, updates) {
    try {
        const sb = getSupabase();
        const { data, error } = await sb
            .from('knowledge_base')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) throw error;
        return { success: true, data: data?.[0] };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * 删除知识条目
 */
async function deleteKnowledgeItem(id) {
    try {
        const sb = getSupabase();
        const { error } = await sb
            .from('knowledge_base')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * 切换知识条目的展示状态（勾选/取消）
 */
async function toggleDisplayStatus(id, isDisplayed) {
    return updateKnowledgeItem(id, { is_displayed: isDisplayed });
}

// ============================================
// 低碳水饮食档位配置 (低碳水饮食的三个档位)
// ============================================

/**
 * 获取所有低碳水饮食档位配置
 */
async function getLowCarbProfiles() {
    try {
        const sb = getSupabase();
        const { data, error } = await sb
            .from('低碳水饮食的三个档位')
            .select('*');

        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (err) {
        console.error('读取低碳水饮食配置失败:', err);
        return { success: false, error: err.message, data: [] };
    }
}

// ============================================
// 普通用户认证（注册/登录）
// ============================================

/**
 * 用户注册
 * 直接使用用户填写的邮箱走 Supabase Auth
 * @param {string} email - 用户邮箱（如 test@163.com）
 * @param {string} password - 密码（至少6位）
 * @returns {Promise<{success: boolean, error?: string, user?: object}>}
 */
async function userSignUp(email, password) {
    try {
        const sb = getSupabase();
        if (!sb) return { success: false, error: 'Supabase未初始化' };

        const { data, error } = await sb.auth.signUp({
            email: email,
            password: password,
            options: { data: { email } }
        });

        if (error) {
            // 处理常见错误
            if (error.message.includes('already registered') || error.message.includes('already exists')) {
                return { success: false, error: '该邮箱已注册，请直接登录' };
            }
            return { success: false, error: error.message };
        }

        if (!data.user) {
            return { success: false, error: '注册失败，请稍后重试' };
        }

        // 写入 user_accounts 表（username 字段存邮箱）
        const { error: dbError } = await sb
            .from('user_accounts')
            .insert({
                auth_id: data.user.id,
                username: email
            });

        if (dbError) {
            console.error('写入 user_accounts 失败:', dbError);
            // 不阻断注册流程，后续可修复
        }

        return { success: true, user: data.user };
    } catch (err) {
        return { success: false, error: err.message || '注册失败' };
    }
}

/**
 * 用户登录
 * @param {string} email - 用户邮箱
 * @param {string} password - 密码
 * @returns {Promise<{success: boolean, error?: string, user?: object}>}
 */
async function userSignIn(email, password) {
    try {
        const sb = getSupabase();
        if (!sb) return { success: false, error: 'Supabase未初始化' };

        const { data, error } = await sb.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            if (error.message.includes('Invalid login credentials')) {
                return { success: false, error: '邮箱或密码错误' };
            }
            return { success: false, error: error.message };
        }

        return { success: true, user: data.user };
    } catch (err) {
        return { success: false, error: err.message || '登录失败' };
    }
}

/**
 * 用户退出登录
 */
async function userSignOut() {
    try {
        const sb = getSupabase();
        if (sb) {
            await sb.auth.signOut();
        }
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * 检查当前用户会话
 */
async function checkUserSession() {
    try {
        const sb = getSupabase();
        if (!sb) return { loggedIn: false };

        const { data: { session }, error } = await sb.auth.getSession();
        if (error || !session) {
            return { loggedIn: false };
        }
        return { loggedIn: true, user: session.user };
    } catch {
        return { loggedIn: false };
    }
}

/**
 * 根据用户名从 user_accounts 查询用户信息
 */
async function getUserAccount(username) {
    try {
        const sb = getSupabase();
        if (!sb) return null;
        
        const { data, error } = await sb
            .from('user_accounts')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !data) return null;
        return data;
    } catch {
        return null;
    }
}

// ============================================
// 用户数据同步辅助函数（供 app.js 调用）
// ============================================

/**
 * 获取当前登录用户对应的 user_accounts.id
 * @returns {Promise<string|null>}
 */
async function getCurrentAccountId() {
    try {
        const sb = getSupabase();
        if (!sb) return null;

        const session = await checkUserSession();
        if (!session.loggedIn) return null;
        if (!session.user) return null;

        // 查 user_accounts 表
        const { data, error } = await sb
            .from('user_accounts')
            .select('id')
            .eq('auth_id', session.user.id)
            .maybeSingle();

        if (data && data.id) return data.id;

        // 没有记录 → 自动创建（兼容老用户/跨设备首次同步）
        if (error && error.code !== 'PGRST116') {
            console.warn('getCurrentAccountId查询异常:', error.message);
        }

        console.log('🆕 user_accounts 无记录，自动创建...');
        const { data: insertData, error: insertError } = await sb
            .from('user_accounts')
            .insert({
                auth_id: session.user.id,
                username: session.user.email || 'unknown',
                role: 'user',
            })
            .select('id')
            .single();

        if (insertError) {
            console.warn('创建 user_accounts 失败:', insertError.message);
            return null;
        }
        console.log('✅ user_accounts 已创建，id=' + insertData.id);
        return insertData.id;
    } catch (e) {
        console.warn('getCurrentAccountId异常:', e.message);
        return null;
    }
}

/**
 * 获取当前登录用户的邮箱
 * @returns {Promise<string|null>}
 */
async function getCurrentUserEmail() {
    try {
        const sb = getSupabase();
        if (!sb) return null;

        const session = await checkUserSession();
        if (!session.loggedIn) return null;
        return session.user.email || null;
    } catch {
        return null;
    }
}

/**
 * 修改当前登录用户的密码
 * @param {string} newPassword - 新密码（至少6位）
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function changePassword(newPassword) {
    try {
        const sb = getSupabase();
        if (!sb) return { success: false, error: 'Supabase未初始化' };

        const { error } = await sb.auth.updateUser({ password: newPassword });
        if (error) return { success: false, error: error.message };
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ============================================
// 验证码使用次数（服务器端，跨设备共享）
// ============================================

/**
 * 从服务器获取验证码已使用次数
 * @param {string} code - 验证码
 * @returns {Promise<number>}
 */
async function getRegCodeUsageFromServer(code) {
    try {
        const sb = getSupabase();
        if (!sb) {
            // 兜底：读 localStorage
            try { return parseInt(localStorage.getItem('nutri_regcode_usage_' + code)) || 0; }
            catch { return 0; }
        }
        const { data, error } = await sb
            .from('reg_code_usage')
            .select('used_count')
            .eq('code', code)
            .maybeSingle();
        if (error) throw error;
        return data ? data.used_count : 0;
    } catch (err) {
        console.warn('读取验证码使用次数失败，使用localStorage兜底:', err.message);
        try { return parseInt(localStorage.getItem('nutri_regcode_usage_' + code)) || 0; }
        catch { return 0; }
    }
}

/**
 * 从服务器获取验证码剩余可用次数
 * @param {string} code - 验证码
 * @returns {Promise<number>}
 */
async function getRegCodeRemainingFromServer(code) {
    const used = await getRegCodeUsageFromServer(code);
    return Math.max(0, 20 - used);
}

/**
 * 在服务器递增验证码使用次数
 * @param {string} code - 验证码
 * @returns {Promise<number>}
 */
async function incrementRegCodeUsageOnServer(code) {
    try {
        const sb = getSupabase();
        if (!sb) {
            // 兜底 localStorage
            try {
                const c = parseInt(localStorage.getItem('nutri_regcode_usage_' + code)) || 0;
                localStorage.setItem('nutri_regcode_usage_' + code, String(c + 1));
                return c + 1;
            } catch { return 0; }
        }
        // 查询当前次数
        const { data: existing } = await sb
            .from('reg_code_usage')
            .select('used_count')
            .eq('code', code)
            .maybeSingle();
        let newCount;
        if (!existing) {
            await sb.from('reg_code_usage').insert({ code, used_count: 1 });
            newCount = 1;
        } else {
            newCount = existing.used_count + 1;
            await sb.from('reg_code_usage').update({ used_count: newCount, updated_at: new Date().toISOString() }).eq('code', code);
        }
        // 同时写 localStorage 保持同步（给 admin 兜底）
        try { localStorage.setItem('nutri_regcode_usage_' + code, String(newCount)); } catch {}
        return newCount;
    } catch (err) {
        console.warn('递增验证码次数失败，使用localStorage兜底:', err.message);
        try {
            const c = parseInt(localStorage.getItem('nutri_regcode_usage_' + code)) || 0;
            localStorage.setItem('nutri_regcode_usage_' + code, String(c + 1));
            return c + 1;
        } catch { return 0; }
    }
}
