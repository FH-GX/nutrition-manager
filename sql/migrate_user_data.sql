-- ============================================
-- 用户数据迁移 - 建表脚本
-- 用于将 localStorage 数据迁移到 Supabase
-- 使用方式：Supabase Dashboard → SQL Editor → 粘贴执行
-- ============================================

-- 0. 先得启用 uuid-ossp 扩展（用来生成 UUID）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. 用户账号表（关联 Supabase Auth）
-- ============================================
CREATE TABLE IF NOT EXISTS user_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID UNIQUE,                -- Supabase Auth 用户 ID
  username TEXT UNIQUE NOT NULL,       -- 用户名（登录用）
  display_name TEXT,                   -- 显示名（可选）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;

-- 已登录用户可读自己的数据
CREATE POLICY "users_read_own_account"
  ON user_accounts
  FOR SELECT
  TO authenticated
  USING (auth_id = auth.uid());

-- 注册时插入
CREATE POLICY "users_insert_own_account"
  ON user_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_id = auth.uid());

-- ============================================
-- 2. 问卷结果表
-- ============================================
CREATE TABLE IF NOT EXISTS survey_results (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  height_cm NUMERIC(5,1),
  weight_kg NUMERIC(5,1),
  age INT,
  activity_level NUMERIC(3,1),
  goal TEXT DEFAULT 'maintain',
  diet_profile TEXT,                   -- 选择的低碳水档位
  full_survey JSONB,                   -- 完整问卷数据（原始）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE survey_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_survey"
  ON survey_results
  FOR ALL
  TO authenticated
  USING (user_id IN (SELECT id FROM user_accounts WHERE auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM user_accounts WHERE auth_id = auth.uid()));

-- ============================================
-- 3. 每日方案记录表
-- ============================================
CREATE TABLE IF NOT EXISTS meal_plans (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,             -- 方案日期
  plan_data JSONB NOT NULL,            -- 完整方案数据（食物清单+营养明细）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, plan_date)
);

ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_meal_plans"
  ON meal_plans
  FOR ALL
  TO authenticated
  USING (user_id IN (SELECT id FROM user_accounts WHERE auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM user_accounts WHERE auth_id = auth.uid()));

-- ============================================
-- 4. 打卡记录表
-- ============================================
CREATE TABLE IF NOT EXISTS checkin_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,              -- 打卡日期
  actual_data JSONB,                   -- 实际摄入数据 {energy, protein, carb, fat}
  status TEXT DEFAULT 'checked',       -- checked / skipped
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, log_date)
);

ALTER TABLE checkin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_checkin_logs"
  ON checkin_logs
  FOR ALL
  TO authenticated
  USING (user_id IN (SELECT id FROM user_accounts WHERE auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM user_accounts WHERE auth_id = auth.uid()));

-- ============================================
-- 5. 能量补偿日志表
-- ============================================
CREATE TABLE IF NOT EXISTS energy_compensations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,              -- 补偿相关日期
  deviation_kcal NUMERIC(8,1),         -- 当日偏差
  compensated_kcal NUMERIC(8,1),       -- 已补偿量
  remaining_kcal NUMERIC(8,1),         -- 剩余待补偿
  queue_data JSONB,                    -- 完整负债队列
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, log_date)
);

ALTER TABLE energy_compensations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_energy_logs"
  ON energy_compensations
  FOR ALL
  TO authenticated
  USING (user_id IN (SELECT id FROM user_accounts WHERE auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM user_accounts WHERE auth_id = auth.uid()));

-- ============================================
-- 6. 用户设置表
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  user_level TEXT DEFAULT 'free',      -- free / vip / plus / permanent
  preferences JSONB DEFAULT '{}',      -- 其他偏好设置
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_settings"
  ON user_settings
  FOR ALL
  TO authenticated
  USING (user_id IN (SELECT id FROM user_accounts WHERE auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM user_accounts WHERE auth_id = auth.uid()));

-- ============================================
-- 7. 触发更新 updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 给需要 updated_at 的表加触发器
CREATE TRIGGER survey_results_updated_at
  BEFORE UPDATE ON survey_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 8. 索引（加速查询）
-- ============================================
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_date ON meal_plans(user_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_checkin_logs_user_date ON checkin_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_energy_logs_user_date ON energy_compensations(user_id, log_date);
