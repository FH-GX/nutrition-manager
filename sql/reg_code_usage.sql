-- ============================================
-- 验证码使用计数表（集中存储，跨浏览器共享）
-- 使用方式：Supabase Dashboard → SQL Editor → 粘贴执行
-- ============================================

-- 1. 创建验证码使用计数表
CREATE TABLE IF NOT EXISTS reg_code_usage (
  code TEXT PRIMARY KEY,
  used_count INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 启用行级安全
ALTER TABLE reg_code_usage ENABLE ROW LEVEL SECURITY;

-- 3. 任何人可读取（注册前检查剩余次数）
CREATE POLICY "allow_read_reg_code_usage"
  ON reg_code_usage
  FOR SELECT
  USING (true);

-- 4. 任何人可插入（首次使用该验证码时）
CREATE POLICY "allow_insert_reg_code_usage"
  ON reg_code_usage
  FOR INSERT
  WITH CHECK (true);

-- 5. 任何人可更新（递增已用次数）
CREATE POLICY "allow_update_reg_code_usage"
  ON reg_code_usage
  FOR UPDATE
  USING (true);
