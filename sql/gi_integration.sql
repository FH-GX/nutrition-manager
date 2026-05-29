# GI（升糖指数）数据整合方案

## 一、给 foods 表加 GI 字段 + 更新数据

### 先加字段
```sql
ALTER TABLE foods ADD COLUMN IF NOT EXISTS gi DECIMAL(5,1) DEFAULT NULL;
COMMENT ON COLUMN foods.gi IS '升糖指数（GI值），NULL=几乎不含碳水';
```

### 再更新数据（按分类）

#### 谷类及制品（高GI为主）
```sql
UPDATE foods SET gi = 90 WHERE name = '稻米（米饭）';
UPDATE foods SET gi = 85 WHERE name = '小麦粉（面粉）';
UPDATE foods SET gi = 60 WHERE name = '面条（煮）';
UPDATE foods SET gi = 85 WHERE name = '馒头（标准粉）';
UPDATE foods SET gi = 50 WHERE name = '包子（猪肉馅）';
UPDATE foods SET gi = 40 WHERE name = '饺子（猪肉白菜馅）';
UPDATE foods SET gi = 75 WHERE name = '面包（白面包）';
UPDATE foods SET gi = 69 WHERE name = '粥（大米粥）';
UPDATE foods SET gi = 87 WHERE name = '糯米饭';
UPDATE foods SET gi = 55 WHERE name = '玉米（鲜）';
```

#### 薯类（中低GI为主）
```sql
UPDATE foods SET gi = 62 WHERE name = '马铃薯（土豆）' OR name = '土豆';
UPDATE foods SET gi = 54 WHERE name = '甘薯（红薯）';
UPDATE foods SET gi = 53 WHERE name = '芋头';
UPDATE foods SET gi = 51 WHERE name = '山药';
```

#### 豆类及制品（低GI）
```sql
UPDATE foods SET gi = 15 WHERE name LIKE '豆腐%';
UPDATE foods SET gi = 34 WHERE name = '豆浆';
UPDATE foods SET gi = 20 WHERE name IN ('豆腐干', '腐竹');
UPDATE foods SET gi = 18 WHERE name = '黄豆';
UPDATE foods SET gi = 30 WHERE name = '红豆';
UPDATE foods SET gi = 27 WHERE name = '绿豆';
```

#### 蔬菜类（大多低GI，南瓜/胡萝卜除外）
```sql
UPDATE foods SET gi = 15 WHERE name IN ('大白菜', '油菜（小青菜）', '菠菜', '番茄（西红柿）', '黄瓜', '冬瓜');
UPDATE foods SET gi = 20 WHERE name IN ('茄子', '花菜（菜花）', '苦瓜');
UPDATE foods SET gi = 15 WHERE name IN ('芹菜', '生菜', '卷心菜');
UPDATE foods SET gi = 25 WHERE name IN ('西蓝花', '木耳（干）', '香菇');
UPDATE foods SET gi = 45 WHERE name = '莲藕';
UPDATE foods SET gi = 30 WHERE name = '白萝卜';
UPDATE foods SET gi = 71 WHERE name = '胡萝卜';
UPDATE foods SET gi = 75 WHERE name = '南瓜';
```

#### 水果类
```sql
UPDATE foods SET gi = 36 WHERE name = '苹果';
UPDATE foods SET gi = 52 WHERE name = '香蕉';
UPDATE foods SET gi = 43 WHERE name IN ('橙子', '葡萄');
UPDATE foods SET gi = 72 WHERE name = '西瓜';
UPDATE foods SET gi = 36 WHERE name = '梨';
UPDATE foods SET gi = 40 WHERE name IN ('桃', '草莓', '火龙果');
UPDATE foods SET gi = 52 WHERE name = '猕猴桃';
```

#### 肉类/蛋类/水产/油脂（几乎不含碳水，GI ≈ 0）
```sql
UPDATE foods SET gi = 0 WHERE category IN ('肉类', '蛋类', '水产', '油脂类');
```

#### 乳类
```sql
UPDATE foods SET gi = 27 WHERE name = '牛奶';
UPDATE foods SET gi = 35 WHERE name = '酸奶';
UPDATE foods SET gi = 40 WHERE name IN ('奶粉（全脂）', '奶酪（干酪）');
```

#### 坚果
```sql
UPDATE foods SET gi = 14 WHERE name = '花生';
UPDATE foods SET gi = 20 WHERE name IN ('核桃', '杏仁', '瓜子（葵花子）', '芝麻');
```

#### 菜品（混合食物，取中低值）
```sql
UPDATE foods SET gi = 30 WHERE name IN ('番茄炒蛋', '宫保鸡丁', '鱼香肉丝');
UPDATE foods SET gi = 0  WHERE name IN ('红烧肉', '清蒸鱼');
UPDATE foods SET gi = 40 WHERE name = '糖醋排骨';
UPDATE foods SET gi = 25 WHERE name = '麻婆豆腐';
```

---

## 二、扫盲台知识条目

```sql
INSERT INTO knowledge_base (title, content, category, is_displayed, display_order)
VALUES (
  'GI（升糖指数）是什么？',
  E'## 什么是GI？

**GI（Glycemic Index，血糖生成指数）** 是指吃下含50g碳水化合物的食物后，血糖上升的速度和幅度，与吃等量葡萄糖相比的比值。

GI值越高 → 血糖升得越快越猛 → 胰岛素分泌越多 → 脂肪更容易堆积

---

## 分类标准

| 等级 | GI值 | 说明 |
|------|------|------|
| **高GI** | > 70 | 升糖快，血糖波动大 |
| **中GI** | 55 ~ 70 | 升糖适中 |
| **低GI** | < 55 | 升糖慢，血糖平稳 |

---

## 高GI vs 低GI 对比

**高GI食物**：曲线峰值高，上升快，下降也快 → 吃完不久就饿了
**低GI食物**：曲线峰值低，上升平缓，维持时间长 → 饱腹感持久

---

## 常见误区

1. **果糖虽然很甜，但GI值只有23**（葡萄糖是100）—— 因为血液检查化验的是葡萄糖，果糖进入肝脏后只有一部分转化为葡萄糖
2. **低GI ≠ 可以多吃** — 吃的总量多了，血糖一样会升
3. **低GI ≠ 健康** — 肥肉GI也低，但不宜多吃

---

## 碳水选择技巧

### ✅ 优先选低GI碳水
**谷物**：燕麦、荞麦、糙米、全麦、红薯、芋头、山药
**豆类**：黄豆、绿豆、红豆、豆腐
**水果**：苹果、梨、橙子、葡萄、猕猴桃、柚子

### ⚠️ 适量选中GI碳水
小米粥、荞麦面条、玉米、菠萝、芒果

### ❌ 尽量少选高GI碳水
白米饭、白馒头、白面包、面条、糯米饭、南瓜、西瓜',
  '名词解释',
  true,
  14
);
```

---

## 三、代码中 GI 的使用逻辑

在生成分餐建议时，按 **每周28餐次（每天4餐×7天）** 分配：

1. **低GI（GI < 55）**：22~24次/周，日常主力
2. **中GI（55~70）**：3~4次/周，偶尔换口味
3. **高GI（>70）**：1~2次/周，尽量安排在午餐
4. **档位越严格（生酮型），低GI优先度越高**
5. 如果用户指定了某食物（比如"今天想吃米饭"），就尊重用户选择，但标注这是高GI食物
