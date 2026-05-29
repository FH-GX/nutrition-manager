-- ============================================
-- 低碳水营养计算器 - Supabase 数据库初始化
-- 使用方式：Supabase Dashboard → SQL Editor → 粘贴执行
-- ============================================

-- 1. 创建知识库表
CREATE TABLE IF NOT EXISTS knowledge_base (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('名词解释', '计算公式')),
  is_displayed BOOLEAN DEFAULT FALSE,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 启用行级安全
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

-- 3. 创建RLS策略
-- 已登录管理员：完全控制（增删改查）
CREATE POLICY "admin_all_knowledge"
  ON knowledge_base
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 匿名用户：只能查看已勾选展示的内容
CREATE POLICY "anon_view_displayed"
  ON knowledge_base
  FOR SELECT
  TO anon
  USING (is_displayed = true);

-- 4. 触发自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_base_updated_at
  BEFORE UPDATE ON knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 5. 插入示例数据（方便测试）
INSERT INTO knowledge_base (title, content, category, is_displayed, display_order) VALUES
('BMI（体质指数）', 'BMI = 体重(kg) ÷ 身高(m)²。用于评估体重是否在健康范围。\n\n中国标准：\n- < 18.5：偏瘦\n- 18.5 ~ 23.9：正常\n- 24 ~ 27.9：超重\n- ≥ 28：肥胖', '名词解释', true, 1),
('BMR（基础代谢率）', '基础代谢率是指人体在清醒且极端安静状态下，维持生命所需的最低能量。\n\n计算公式（Mifflin-St Jeor）：\n男：BMR = 10×体重(kg) + 6.25×身高(cm) - 5×年龄 + 5\n女：BMR = 10×体重(kg) + 6.25×身高(cm) - 5×年龄 - 161', '计算公式', true, 2),
('TDEE（每日总消耗）', 'TDEE = BMR × 活动系数。是人体一天总消耗的能量。\n\n活动系数表：\n- 久坐（几乎不运动）：×1.2\n- 轻度（每周1-3天运动）：×1.375\n- 中度（每周3-5天运动）：×1.55\n- 重度（每周6-7天运动）：×1.725\n- 极重（体力劳动者）：×1.9', '计算公式', true, 3),
('什么是低碳水饮食', '低碳水饮食（Low-Carb Diet）是一种减少碳水化合物摄入、增加脂肪和适量蛋白质的饮食方式。\n\n核心原理：减少碳水摄入 → 降低胰岛素水平 → 促进脂肪分解供能。\n\n注意：不是零碳水，而是控制质量和数量。优先选择粗粮、蔬菜中的优质碳水。', '名词解释', true, 4),
('三大营养素能量换算', '1克蛋白质 = 4 kcal\n1克碳水化合物 = 4 kcal\n1克脂肪 = 9 kcal\n\n每天的总热量摄入由这三类营养素提供，比例不同决定了饮食的性质。', '计算公式', true, 5),
('蛋白质的作用', '蛋白质是人体的"建材"——构成肌肉、皮肤、毛发、酶和激素。\n\n低碳水饮食期间，蛋白质摄入要充足，防止肌肉流失。\n\n推荐来源：鸡胸肉、鱼虾、鸡蛋、豆腐、瘦肉。', '名词解释', false, 6),
('脂肪的作用与误区', '脂肪不是坏东西！它是人体的重要能量储备，也是细胞膜的重要组成部分。\n\n低碳水饮食中脂肪是主要能量来源。\n\n推荐来源：橄榄油、牛油果、坚果、深海鱼。\n\n⚠️ 注意：要避免反式脂肪酸（氢化植物油）。', '名词解释', false, 7),
('生酮饮食的注意事项', '生酮饮食（Ketogenic Diet）是极低碳水（5%）、高脂肪（70%）、适量蛋白质（25%）的饮食方式。\n\n⚠️ 需在专业指导下进行，不适合：\n- 糖尿病患者\n- 肝胆疾病患者\n- 孕妇和哺乳期\n- 60岁以上老年人\n\n初期可能出现"生酮流感"（头晕、乏力），通常1-2周消失。', '名词解释', false, 8);
