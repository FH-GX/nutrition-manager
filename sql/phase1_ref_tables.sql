-- ============================================
-- 方案C — 第一阶段：建参考数据表 + 导入数据
-- 使用方式：Supabase Dashboard → SQL Editor → 粘贴执行
-- 安全设计：所有表启用RLS，不给anon任何SELECT权限
-- 只有 service_role（Edge Function）可读写
-- ============================================

-- ============================================
-- 1. 能量系数表
-- ============================================
CREATE TABLE IF NOT EXISTS ref_energy_coeff (
  id INT PRIMARY KEY,
  activity_label TEXT NOT NULL,
  activity_min DECIMAL(6,3) NOT NULL,
  activity_max DECIMAL(6,3) NOT NULL,
  coeff INT NOT NULL
);

ALTER TABLE ref_energy_coeff ENABLE ROW LEVEL SECURITY;

INSERT INTO ref_energy_coeff (id, activity_label, activity_min, activity_max, coeff) VALUES
(1, '卧床',   0,      1.2,    25),
(2, '轻体力', 1.201,  1.375,  30),
(3, '中体力', 1.376,  1.55,   35),
(4, '重体力', 1.551,  999,    40);

-- ============================================
-- 2. 年龄系数表
-- ============================================
CREATE TABLE IF NOT EXISTS ref_age_factor (
  id INT PRIMARY KEY,
  age_min INT NOT NULL,
  age_max INT NOT NULL,
  factor DECIMAL(3,1) NOT NULL
);

ALTER TABLE ref_age_factor ENABLE ROW LEVEL SECURITY;

INSERT INTO ref_age_factor (id, age_min, age_max, factor) VALUES
(1, 0,   49,  1.0),
(2, 50,  59,  0.9),
(3, 60,  69,  0.8),
(4, 70,  79,  0.7),
(5, 80,  89,  0.6),
(6, 90,  199, 0.4);

-- ============================================
-- 3. BMI阈值表
-- ============================================
CREATE TABLE IF NOT EXISTS ref_bmi_threshold (
  id INT PRIMARY KEY,
  bmi_min DECIMAL(5,1) NOT NULL,
  bmi_max DECIMAL(5,1) NOT NULL,
  label TEXT NOT NULL,
  use_adjusted_weight BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE ref_bmi_threshold ENABLE ROW LEVEL SECURITY;

INSERT INTO ref_bmi_threshold (id, bmi_min, bmi_max, label, use_adjusted_weight) VALUES
(1, 0,    18.4, '偏瘦', FALSE),
(2, 18.5, 23.9, '正常', FALSE),
(3, 24.0, 27.9, '超重', FALSE),
(4, 28.0, 999,  '肥胖', TRUE);

-- ============================================
-- 4. 标准体重公式表
-- ============================================
CREATE TABLE IF NOT EXISTS ref_std_weight_formula (
  id INT PRIMARY KEY,
  formula TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}',
  description TEXT
);

ALTER TABLE ref_std_weight_formula ENABLE ROW LEVEL SECURITY;

INSERT INTO ref_std_weight_formula (id, formula, params, description) VALUES
(1, 'height - 105', '{}', 'GX方法：身高cm减去105');

-- ============================================
-- 5. 营养吸收率表
-- ============================================
CREATE TABLE IF NOT EXISTS ref_absorption_rate (
  id INT PRIMARY KEY,
  nutrient TEXT NOT NULL,
  rate DECIMAL(4,2) NOT NULL
);

ALTER TABLE ref_absorption_rate ENABLE ROW LEVEL SECURITY;

INSERT INTO ref_absorption_rate (id, nutrient, rate) VALUES
(1, 'protein', 0.70),
(2, 'carb',    0.95),
(3, 'fat',     0.95);

-- ============================================
-- 6. Ω比值判据表
-- ============================================
CREATE TABLE IF NOT EXISTS ref_omega_ratio (
  id INT PRIMARY KEY,
  ratio_min DECIMAL(5,1) NOT NULL,
  ratio_max DECIMAL(5,1) NOT NULL,
  label TEXT NOT NULL
);

ALTER TABLE ref_omega_ratio ENABLE ROW LEVEL SECURITY;

INSERT INTO ref_omega_ratio (id, ratio_min, ratio_max, label) VALUES
(1, 0,   3.9, 'ω-3充足'),
(2, 4.0, 6.0, '理想'),
(3, 6.1, 999, '偏高');

-- ============================================
-- 7. 分餐比例表
-- ============================================
CREATE TABLE IF NOT EXISTS ref_meal_ratio (
  id INT PRIMARY KEY,
  meal TEXT NOT NULL,
  pct DECIMAL(4,2) NOT NULL
);

ALTER TABLE ref_meal_ratio ENABLE ROW LEVEL SECURITY;

INSERT INTO ref_meal_ratio (id, meal, pct) VALUES
(1, 'breakfast', 0.25),
(2, 'lunch',     0.35),
(3, 'snack',     0.10),
(4, 'dinner',    0.30);

-- ============================================
-- 8. 固定份量表
-- ============================================
CREATE TABLE IF NOT EXISTS ref_fixed_portions (
  id INT PRIMARY KEY,
  food_key TEXT NOT NULL,
  food_label TEXT NOT NULL,
  grams DECIMAL(6,1) NOT NULL,
  fallback_carb DECIMAL(5,1) DEFAULT 0,
  fallback_fat DECIMAL(5,1) DEFAULT 0,
  fallback_protein DECIMAL(5,1) DEFAULT 0
);

ALTER TABLE ref_fixed_portions ENABLE ROW LEVEL SECURITY;

INSERT INTO ref_fixed_portions (id, food_key, food_label, grams, fallback_carb, fallback_fat, fallback_protein) VALUES
(1,  'egg',           '鸡蛋',         100, 1.2,  8.8, 13.3),
(2,  'milk',          '牛奶',         200, 6.8,  3.2,  3.0),
(3,  'lunchProtein',  '午餐蛋白质',   150, 0,    5.0, 20.0),
(4,  'lunchVeggie',   '午餐蔬菜',     200, 5.0,  0.2,  1.5),
(5,  'snackFruit',    '加餐水果',     150, 15.0, 0.3,  0.5),
(6,  'snackNuts',     '加餐坚果',      20, 1.3, 11.0,  2.5),
(7,  'dinnerProtein', '晚餐蛋白质',   120, 0,    4.0, 18.0),
(8,  'dinnerVeggie',  '晚餐蔬菜',     200, 5.0,  0.2,  1.5),
(9,  'breakfastOil',  '早餐油',         5, 0,    5.0,    0),
(10, 'lunchOil',      '午餐油',        10, 0,   10.0,    0),
(11, 'dinnerOil',     '晚餐油',        10, 0,   10.0,    0);

-- ============================================
-- 9. 活动系数标签表
-- ============================================
CREATE TABLE IF NOT EXISTS ref_activity_labels (
  id INT PRIMARY KEY,
  level DECIMAL(5,3) NOT NULL,
  label TEXT NOT NULL
);

ALTER TABLE ref_activity_labels ENABLE ROW LEVEL SECURITY;

INSERT INTO ref_activity_labels (id, level, label) VALUES
(1, 1.2,    '卧床'),
(2, 1.375,  '轻体力'),
(3, 1.55,   '中体力'),
(4, 1.725,  '重体力');

-- ============================================
-- 10. 油品轮换表
-- ============================================
CREATE TABLE IF NOT EXISTS ref_oil_rotation (
  id INT PRIMARY KEY,
  oil_name TEXT NOT NULL,
  ratio INT NOT NULL
);

ALTER TABLE ref_oil_rotation ENABLE ROW LEVEL SECURITY;

INSERT INTO ref_oil_rotation (id, oil_name, ratio) VALUES
(1, '橄榄油', 40),
(2, '猪油',   30),
(3, '菜籽油', 30);

-- ============================================
-- 11. 坚果轮换表
-- ============================================
CREATE TABLE IF NOT EXISTS ref_nut_rotation (
  id INT PRIMARY KEY,
  nut_name TEXT NOT NULL,
  ratio INT NOT NULL
);

ALTER TABLE ref_nut_rotation ENABLE ROW LEVEL SECURITY;

INSERT INTO ref_nut_rotation (id, nut_name, ratio) VALUES
(1, '核桃',          50),
(2, '杏仁',          25),
(3, '花生',          15),
(4, '瓜子（葵花子）', 10);

-- ============================================
-- 12. 食物轮换池表（7天）
-- ============================================
CREATE TABLE IF NOT EXISTS ref_food_rotation (
  id INT PRIMARY KEY,
  rotation_type TEXT NOT NULL,
  day_index INT NOT NULL,
  food_name TEXT NOT NULL
);

ALTER TABLE ref_food_rotation ENABLE ROW LEVEL SECURITY;

-- 早餐主食（7天）
INSERT INTO ref_food_rotation (id, rotation_type, day_index, food_name) VALUES
(1,   'breakfastGrain', 0, '全麦面包'),
(2,   'breakfastGrain', 1, '燕麦粥（熟）'),
(3,   'breakfastGrain', 2, '甘薯（红薯）'),
(4,   'breakfastGrain', 3, '全麦面包'),
(5,   'breakfastGrain', 4, '玉米（鲜）'),
(6,   'breakfastGrain', 5, '荞麦面条（熟）'),
(7,   'breakfastGrain', 6, '燕麦粥（熟）');

-- 午餐主食（7天）
INSERT INTO ref_food_rotation (id, rotation_type, day_index, food_name) VALUES
(8,   'lunchGrain', 0, '糙米饭（熟）'),
(9,   'lunchGrain', 1, '黑米饭（熟）'),
(10,  'lunchGrain', 2, '荞麦面条（熟）'),
(11,  'lunchGrain', 3, '藜麦饭（熟）'),
(12,  'lunchGrain', 4, '糙米饭（熟）'),
(13,  'lunchGrain', 5, '荞麦面条（熟）'),
(14,  'lunchGrain', 6, '黑米饭（熟）');

-- 午餐蛋白质（7天，V1.3附录3优化版）
INSERT INTO ref_food_rotation (id, rotation_type, day_index, food_name) VALUES
(15,  'lunchProtein', 0, '鸡胸肉'),
(16,  'lunchProtein', 1, '牛肉（瘦肉）'),
(17,  'lunchProtein', 2, '羊肉（肥瘦）'),
(18,  'lunchProtein', 3, '三文鱼'),
(19,  'lunchProtein', 4, '三文鱼'),
(20,  'lunchProtein', 5, '猪肉（瘦肉）'),
(21,  'lunchProtein', 6, '鸡腿肉');

-- 午餐蔬菜（7天）
INSERT INTO ref_food_rotation (id, rotation_type, day_index, food_name) VALUES
(22,  'lunchVeggie', 0, '菠菜'),
(23,  'lunchVeggie', 1, '西兰花'),
(24,  'lunchVeggie', 2, '生菜'),
(25,  'lunchVeggie', 3, '番茄（西红柿）'),
(26,  'lunchVeggie', 4, '黄瓜'),
(27,  'lunchVeggie', 5, '大白菜'),
(28,  'lunchVeggie', 6, '芹菜');

-- 加餐水果（7天）
INSERT INTO ref_food_rotation (id, rotation_type, day_index, food_name) VALUES
(29,  'snackFruit', 0, '苹果'),
(30,  'snackFruit', 1, '蓝莓'),
(31,  'snackFruit', 2, '草莓'),
(32,  'snackFruit', 3, '柚子'),
(33,  'snackFruit', 4, '苹果'),
(34,  'snackFruit', 5, '樱桃'),
(35,  'snackFruit', 6, '猕猴桃');

-- 晚餐蛋白质（7天，V1.3附录3优化版）
INSERT INTO ref_food_rotation (id, rotation_type, day_index, food_name) VALUES
(36,  'dinnerProtein', 0, '鸭肉'),
(37,  'dinnerProtein', 1, '豆腐（北豆腐）'),
(38,  'dinnerProtein', 2, '三文鱼'),
(39,  'dinnerProtein', 3, '鸡胸肉'),
(40,  'dinnerProtein', 4, '虾（河虾）'),
(41,  'dinnerProtein', 5, '豆腐（北豆腐）'),
(42,  'dinnerProtein', 6, '草鱼');

-- 晚餐蔬菜（7天）
INSERT INTO ref_food_rotation (id, rotation_type, day_index, food_name) VALUES
(43,  'dinnerVeggie', 0, '油菜（小青菜）'),
(44,  'dinnerVeggie', 1, '西葫芦'),
(45,  'dinnerVeggie', 2, '菠菜'),
(46,  'dinnerVeggie', 3, '冬瓜'),
(47,  'dinnerVeggie', 4, '茄子'),
(48,  'dinnerVeggie', 5, '上海青'),
(49,  'dinnerVeggie', 6, '黄瓜');

-- ============================================
-- 13. 儿童EER表
-- ============================================
CREATE TABLE IF NOT EXISTS child_energy (
  id INT PRIMARY KEY,
  age INT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  eer_kcal INT NOT NULL
);

ALTER TABLE child_energy ENABLE ROW LEVEL SECURITY;

INSERT INTO child_energy (id, age, gender, eer_kcal) VALUES
(1,  4,  'male',   1300),
(2,  4,  'female', 1250),
(3,  5,  'male',   1400),
(4,  5,  'female', 1300),
(5,  6,  'male',   1400),
(6,  6,  'female', 1250),
(7,  7,  'male',   1500),
(8,  7,  'female', 1350),
(9,  8,  'male',   1650),
(10, 8,  'female', 1450),
(11, 9,  'male',   1750),
(12, 9,  'female', 1550),
(13, 10, 'male',   1800),
(14, 10, 'female', 1650),
(15, 11, 'male',   2050),
(16, 11, 'female', 1800),
(17, 14, 'male',   2500),
(18, 14, 'female', 2000),
(19, 15, 'male',   2500),
(20, 15, 'female', 2000),
(21, 16, 'male',   2500),
(22, 16, 'female', 2000),
(23, 17, 'male',   2500),
(24, 17, 'female', 2000);

-- ============================================
-- 14. 儿童蛋白RNI表
-- ============================================
CREATE TABLE IF NOT EXISTS child_protein (
  id INT PRIMARY KEY,
  age_start INT NOT NULL,
  age_end INT NOT NULL,
  rni_g INT NOT NULL
);

ALTER TABLE child_protein ENABLE ROW LEVEL SECURITY;

INSERT INTO child_protein (id, age_start, age_end, rni_g) VALUES
(1, 1,  2,   25),
(2, 3,  5,   30),
(3, 6,  6,   35),
(4, 7,  8,   40),
(5, 9,  9,   45),
(6, 10, 10,  50),
(7, 11, 11,  60),
(8, 14, 17,  75);

-- ============================================
-- 15. 儿童碳水范围表
-- ============================================
CREATE TABLE IF NOT EXISTS child_carb_range (
  id INT PRIMARY KEY,
  min_pct INT NOT NULL,
  max_pct INT NOT NULL,
  default_pct INT NOT NULL
);

ALTER TABLE child_carb_range ENABLE ROW LEVEL SECURITY;

INSERT INTO child_carb_range (id, min_pct, max_pct, default_pct) VALUES
(1, 50, 65, 57);

-- ============================================
-- 验证：所有表已启用RLS且无anon策略
-- 查询：SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'ref_%' OR tablename LIKE 'child_%';
-- ============================================
