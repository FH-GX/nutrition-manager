-- ============================================
-- 安全修复 SQL（P0级漏洞，共3张表）
-- 使用方式：Supabase Dashboard → SQL Editor → 粘贴执行
-- 作者：Senior Developer · 2026-06-08
-- ============================================

-- ============================
-- 1. 先删除所有旧的 RLS 策略
-- ============================
DROP POLICY IF EXISTS "admin_all_knowledge" ON knowledge_base;
DROP POLICY IF EXISTS "anon_view_displayed" ON knowledge_base;
DROP POLICY IF EXISTS "anyone_read_accounts" ON user_accounts;
DROP POLICY IF EXISTS "allow_read_reg_code_usage" ON reg_code_usage;
DROP POLICY IF EXISTS "allow_insert_reg_code_usage" ON reg_code_usage;
DROP POLICY IF EXISTS "allow_update_reg_code_usage" ON reg_code_usage;

-- ============================
-- 2. knowledge_base 重建 RLS
-- ============================
-- ✅ 任何人可读（前台展示需要）
CREATE POLICY "任何人可读知识库" ON knowledge_base
  FOR SELECT USING (true);

-- ✅ 仅管理员（fhgexin@gmail.com）可新增
CREATE POLICY "仅管理员可新增知识库" ON knowledge_base
  FOR INSERT WITH CHECK (auth.email() = 'fhgexin@gmail.com');

-- ✅ 仅管理员（fhgexin@gmail.com）可修改
CREATE POLICY "仅管理员可修改知识库" ON knowledge_base
  FOR UPDATE USING (auth.email() = 'fhgexin@gmail.com');

-- ✅ 仅管理员（fhgexin@gmail.com）可删除
CREATE POLICY "仅管理员可删除知识库" ON knowledge_base
  FOR DELETE USING (auth.email() = 'fhgexin@gmail.com');

-- ============================
-- 3. user_accounts 重建 RLS
-- ============================
-- ✅ 普通用户只能读自己的记录，管理员（fhgexin@gmail.com）可读全部
CREATE POLICY "用户或管理员可读" ON user_accounts
  FOR SELECT USING (
    auth.uid() = auth_id
    OR
    auth.email() = 'fhgexin@gmail.com'
  );

-- ============================
-- 4. reg_code_usage 重建 RLS
-- ============================
-- ✅ 仅管理员可读取验证码数据
CREATE POLICY "仅管理员可读验证码" ON reg_code_usage
  FOR SELECT USING (auth.email() = 'fhgexin@gmail.com');

-- ✅ 已登录用户可以插入/更新（注册时需要递增次数，用 auth.role() 不查表）
CREATE POLICY "已登录用户可写验证码" ON reg_code_usage
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "已登录用户可更新验证码" ON reg_code_usage
  FOR UPDATE USING (auth.role() = 'authenticated');

-- ============================
-- 5. 验证修复结果
-- ============================
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('knowledge_base', 'user_accounts', 'reg_code_usage')
ORDER BY tablename, policyname;
