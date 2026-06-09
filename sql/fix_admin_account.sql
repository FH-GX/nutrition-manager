-- ============================================
-- 修复 admin 账号在 user_accounts 缺少记录
-- 使用方式：Supabase Dashboard → SQL Editor → 粘贴执行
-- ============================================

-- 补录 admin 账号（从测试日志获取的 auth_id）
INSERT INTO user_accounts (auth_id, username, role, created_at)
VALUES (
  '58204dfd-054c-4cee-9c43-611152b66513',  -- fhgexin@gmail.com 的 auth_id
  'fhgexin@gmail.com',
  'admin',
  NOW()
)
ON CONFLICT (auth_id) DO NOTHING;

-- 验证是否插入成功
SELECT id, auth_id, username, role, created_at
FROM user_accounts
WHERE username = 'fhgexin@gmail.com';
