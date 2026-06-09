# 方案C — 核心公式与参考数据迁移设计

> 2026-06-09 初稿
> 目的：将营养计算核心逻辑藏到后端，前端 F12 无法窃取公式

---

## 一、架构总览

```
┌─────────────────────────┐      ┌──────────────────────────────┐
│       浏览器/前端        │      │       Supabase (云端)         │
│                         │      │                              │
│  index.html             │      │  ┌──────────────────────┐    │
│  style.css (UI样式)     │      │  │  PostgreSQL 数据库    │    │
│  app.js (UI逻辑)        │      │  │                      │    │
│  meal-plan.js (展示)    │      │  │  ref_* 参考数据表     │    │
│  calculator.js (移除)   │      │  │  child_* 儿童数据表   │    │
│  foods.js (食物库)      │  HTTP │  │  user_* 用户数据表   │    │
│                         │ ←──→ │  │  food_* 食物数据表   │    │
│  前端只传参数，不暴露公式 │  POST │  └────────┬─────────────┘    │
│                         │       │           │                   │
│                         │       │  ┌────────▼─────────────┐    │
│                         │       │  │  Edge Function       │    │
│                         │       │  │  (Deno/TypeScript)   │    │
│                         │       │  │                      │    │
│                         │       │  │  calculateAdult()    │    │
│                         │       │  │  calculateChild()    │    │
│                         │       │  │  calculateMealPlan() │    │
│                         │       │  └──────────────────────┘    │
└─────────────────────────┘      └──────────────────────────────┘
```

## 二、安全防线（三层）

### 第一层：Edge Function 鉴权（防直接调用）

```
Edge Function 内部校验请求头 Authorization
  ↓
取 JWT token → 验证用户身份
  ↓
非登录用户 → 拒绝（401）
```

### 第二层：数据库 RLS（防直接查表）

```
所有 ref_* 表只允许 service_role（即 Edge Function）读取
  ↓
anon key 直连 → SELECT 被拒绝
  ↓
只能通过 Edge Function 间接读取
```

### 第三层：公式藏于代码（F12看不到）

```
Edge Function 部署在 Supabase 云端
  ↓
前端只看到 function URL + 传参
  ↓
公式逻辑 / 系数表 / 算法全部在服务器
```

### 防线汇总

| 攻击手段 | 被什么拦住 | 等级 |
|---------|-----------|:---:|
| F12 翻 JS 找公式 | 代码已移到后端，前端只有 API 调用 | 🟢 |
| 直接 curl 调 Edge Function | Edge Function 鉴权，未登录返回 401 | 🟢 |
| 用 anon key 直接查数据库表 | RLS 策略拒绝 SELECT | 🟢 |
| 重放攻击/刷 API | 加频率限制（Edge Function 层面） | 🟢 |

---

## 三、参考数据表设计（共14张）

### 3.1 成人计算参数表

#### `ref_energy_coeff` — 能量系数

| age_min | age_max | activity_level | coeff |
|:-------:|:-------:|:--------------:|:-----:|

| 活动等级 | 系数(kcal/kg) |
|---------|:------------:|
| 卧床 | 25 |
| 轻体力 | 30 |
| 中体力 | 35 |
| 重体力 | 40 |

#### `ref_age_factor` — 年龄系数

| age_min | age_max | factor |
|:-------:|:-------:|:------:|
| 0 | 49 | 1.0 |
| 50 | 59 | 0.9 |
| 60 | 69 | 0.8 |
| 70 | 79 | 0.7 |
| 80 | 89 | 0.6 |
| 90 | 199 | 0.4 |

#### `ref_bmi_threshold` — BMI阈值

| bmi_min | bmi_max | label | action |
|:-------:|:-------:|:-----:|:------:|
| 0 | 18.4 | 偏瘦 | use_std_weight |
| 18.5 | 23.9 | 正常 | use_std_weight |
| 24.0 | 27.9 | 超重 | use_std_weight |
| 28.0 | 999 | 肥胖 | use_adjusted_weight |

#### `ref_std_weight_formula` — 标准体重公式

| formula | params |
|---------|--------|
| `height - 105` | {} |

#### `ref_absorption_rate` — 吸收率

| nutrient | rate |
|----------|:----:|
| protein | 0.70 |
| carb | 0.95 |
| fat | 0.95 |

#### `ref_omega_ratio` — Ω比值判据

| ratio_min | ratio_max | label |
|:---------:|:---------:|:-----:|
| 0 | 3.9 | ω-3充足 |
| 4.0 | 6.0 | 理想 |
| 6.1 | 999 | 偏高 |

#### `ref_meal_ratio` — 分餐比例

| meal | pct |
|------|:---:|
| breakfast | 0.25 |
| lunch | 0.35 |
| snack | 0.10 |
| dinner | 0.30 |

#### `ref_fixed_portions` — 固定份量

| food | grams | fallback_carb |
|------|:-----:|:-------------:|
| 蛋 | 100 | 0.6 |
| 牛奶 | 200 | 5.0 |
| 午肉 | 150 | 0.5 |
| 午菜 | 200 | 3.0 |
| 水果 | 150 | 10.0 |
| 坚果 | 20 | 2.0 |
| 晚肉 | 120 | 0.5 |
| 晚菜 | 200 | 3.0 |
| 早油 | 5 | 0 |
| 午油 | 10 | 0 |
| 晚油 | 10 | 0 |

#### `ref_activity_labels` — 活动系数标签

| level | label |
|:-----:|:-----:|
| 1.2 | 卧床 |
| 1.375 | 轻体力 |
| 1.55 | 中体力 |
| 1.725 | 重体力 |

### 3.2 轮换配置表

#### `ref_oil_rotation` — 油品轮换

| oil_name | ratio |
|----------|:-----:|
| 橄榄油 | 40 |
| 猪油 | 30 |
| 菜籽油 | 30 |

#### `ref_nut_rotation` — 坚果轮换

| nut_name | ratio |
|----------|:-----:|
| 核桃 | 50 |
| 杏仁 | 25 |
| 花生 | 15 |
| 瓜子（葵花子） | 10 |

#### `ref_food_rotation` — 7天食物轮换池

| rotation_type | day_index | food_name |
|:-------------:|:---------:|-----------|
| breakfastGrain | 0 | 全麦面包 |
| breakfastGrain | 1 | 燕麦粥 |
| ... | ... | ... |
| lunchProtein | 0 | 鸡胸肉 |
| ... | ... | ... |
（共 7×7 = 49 条数据）

### 3.3 儿童数据表

#### `child_energy` — 儿童EER

| age | gender | eer_kcal |
|:---:|:------:|:--------:|
| 4 | male | 1300 |
| 4 | female | 1250 |
| 5 | male | 1400 |
| ... | ... | ... |

#### `child_protein` — 儿童蛋白RNI

| age_start | age_end | rni_g |
|:---------:|:-------:|:-----:|
| 1 | 2 | 25 |
| 3 | 5 | 30 |
| 6 | 6 | 35 |
| 7 | 8 | 40 |
| 9 | 9 | 45 |
| 10 | 10 | 50 |
| 11 | 11 | 60 |
| 14 | 17 | 75 |

#### `child_carb_range` — 儿童碳水范围

| min_pct | max_pct | default_pct |
|:-------:|:-------:|:-----------:|
| 50 | 65 | 57 |

---

## 四、Edge Function API 设计

### 4.1 `calculate-adult`

**请求**：
```json
{
  "height": 170,
  "weight": 65,
  "age": 30,
  "gender": "female",
  "activity": 1.55,
  "tier": {
    "carbPct": 20,
    "proteinPct": 15,
    "fatPct": 65
  }
}
```

**响应**：
```json
{
  "tdee": 1890,
  "bmr": 1350,
  "bmi": 22.5,
  "stdWeight": 65.0,
  "targetWeight": 65.0,
  "weightType": "标准体重",
  "macros": {
    "protein": 71,
    "carbs": 95,
    "fat": 136
  },
  "calcDetail": "65 × 30 × 1.0 = 1950 kcal"
}
```

### 4.2 `calculate-child`

**请求**：
```json
{
  "age": 7,
  "gender": "male",
  "height": 125,
  "weight": 23,
  "advancedMode": false,
  "carbPct": 57
}
```

**响应**：
```json
{
  "energy": 1500,
  "protein": 40,
  "carbs": 214,
  "fat": 45,
  "calcDetail": "查表EER=1500 | 蛋白RNI=40 | 碳水57%=214g"
}
```

### 4.3 `calculate-meal-plan`

**请求**：
```json
{
  "macros": { "protein": 71, "carbs": 95, "fat": 136 },
  "date": "2026-06-09",
  "fixedPortions": true
}
```

**响应**：
```json
{
  "breakfast": { "foods": [...], "macros": {...} },
  "lunch": { "foods": [...], "macros": {...} },
  "snack": { "foods": [...], "macros": {...} },
  "dinner": { "foods": [...], "macros": {...} },
  "totals": { "calories": 1890, "protein": 71, ... },
  "fatSources": { "animal": 68, "plant": 68, "total": 136, "target": 136 },
  "omegaRatio": 7.5
}
```

---

## 五、迁移步骤（分阶段执行）

### 第一阶段：建表 + 导入参考数据（不做代码改动）

```
1. 在 Supabase SQL Editor 执行建表SQL
2. 插入所有参考数据
3. 配置 RLS 策略（全部禁止 anon 直读）
```

### 第二阶段：创建 Edge Functions（公式逻辑）

```
1. 本地装 supabase CLI
2. supabase functions new calculate-adult
3. supabase functions new calculate-child
4. supabase functions new calculate-meal-plan
5. 部署到云端
```

### 第三阶段：前端改调用

```
1. 移除 calculator.js（或大幅度简化）
2. app.js 里计算改为调 Edge Function API
3. 测试：所有功能回归
```

### 第四阶段：删掉前端遗留逻辑（可选）

```
1. 确认所有计算已走后端
2. 删除 calculator.js 中的敏感公式
3. 二次渗透测试
```

---

## 六、风险与应对

| 风险 | 应对 |
|------|------|
| Edge Function 调用延迟 | 首次调用有冷启动(~500ms)，后续复用连接(~50ms) |
| 离线不可用 | 本软件原本就依赖云端（用户数据存 Supabase），影响不大 |
| Supabase 绑定 | Deno/TypeScript 逻辑可迁移到任何云函数平台 |
| 每月免费额度超限 | 50万次调用/月，家庭场景绰绰有余 |
| 部署复杂度增加 | 需要本地装 supabase CLI，比纯前端多一个步骤 |
