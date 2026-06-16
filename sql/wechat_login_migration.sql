-- ============================================
-- 微信原生登录迁移脚本
-- 为 user_accounts 添加 openid 列，允许 Edge Function (service_role) 管理账户
-- 执行位置：Supabase Dashboard → SQL Editor
-- 日期：2026-06-16
-- ============================================

-- 1. 添加 openid 列（微信唯一标识）
ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS openid TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_user_accounts_openid ON user_accounts(openid);

-- 2. 允许 service_role（Edge Function）创建和更新 user_accounts
--    Edge Function 用 service_role key 操作，需要对应权限
CREATE POLICY "service_role_manage_accounts" ON user_accounts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
