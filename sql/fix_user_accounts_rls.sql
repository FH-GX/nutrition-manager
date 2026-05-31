-- 补充 RLS 策略：允许所有已登录用户查看 user_accounts
-- （用于管理员后台查看所有用户列表）
CREATE POLICY "anyone_read_accounts"
  ON user_accounts
  FOR SELECT
  TO authenticated
  USING (true);
