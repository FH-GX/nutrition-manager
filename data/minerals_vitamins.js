/**
 * 食物矿物质与维生素补充数据
 *
 * 数据来源：
 * 1. GitHub Sanotsu/china-food-composition-data (《中国食物成分表第六版》)
 * 2. USDA FoodData Central SR Legacy
 * 3. BOSS从nlc.chinanutri.cn手动查阅
 * 4. 详情见 data_sources.txt
 *
 * 数据格式：每100g可食部的矿物质和维生素含量
 * null = 未检测/无数据，0 = 确认不含
 *
 * 核心10字段（用于达标率计算）：
 *   ca(钙mg), fe(铁mg), zn(锌mg), se(硒μg),
 *   va(维生素A μg RAE), vb1(维生素B1 mg), vb2(维生素B2 mg),
 *   vc(维生素C mg), vd(维生素D μg), ve(维生素E mg α-TE)
 * 
 * 进阶段14字段（食物库可见，不参与达标计算）：
 *   k(钾mg), na(钠mg), p(磷mg), mag(镁mg),
 *   cu(铜mg), mn(锰mg), iodine(碘μg),
 *   vb6(维生素B6 mg), vb12(维生素B12 μg),
 *   niacin(烟酸 mg NE), folate(叶酸 μg DFE),
 *   vk(维生素K μg), pantothenic(泛酸 mg), biotin(生物素 μg)
 */

const MINERALS_VITAMINS = {

  // ==================== 谷类及制品 ====================
  1: { // 稻米（米饭）  → 米饭（蒸，代表值）
    ca: 7, fe: 1.3, zn: 0.92, se: 0.4, va: null, vb1: 0.02, vb2: 0.03, vc: null, vd: null, ve: null,
    k: 30, na: 2.5, p: 62, mag: 15, cu: 0.06, mn: 0.58, iodine: null, vb6: null, vb12: null, niacin: 1.9, folate: null, vk: null, pantothenic: null, biotin: null
  },
  2: { // 小麦粉（面粉）  → 小麦粉（标准粉）
    ca: 31, fe: 0.6, zn: 0.2, se: 7.42, va: null, vb1: 0.46, vb2: 0.05, vc: null, vd: null, ve: 0.32,
    k: 190, na: 3.1, p: 167, mag: 50, cu: 0.06, mn: 0.1, iodine: null, vb6: null, vb12: null, niacin: 1.91, folate: null, vk: null, pantothenic: null, biotin: null
  },
  3: { // 面条（煮）  → 挂面（代表值）
    ca: 20, fe: 2.3, zn: 0.72, se: 9.21, va: null, vb1: 0.17, vb2: 0.04, vc: null, vd: null, ve: 1.11,
    k: 129, na: 184.5, p: 134, mag: 49, cu: 0.27, mn: 0.71, iodine: null, vb6: null, vb12: null, niacin: 2.09, folate: null, vk: null, pantothenic: null, biotin: null
  },
  4: { // 馒头（标准粉）  → 小麦粉（标准粉）
    ca: 31, fe: 0.6, zn: 0.2, se: 7.42, va: null, vb1: 0.46, vb2: 0.05, vc: null, vd: null, ve: 0.32,
    k: 190, na: 3.1, p: 167, mag: 50, cu: 0.06, mn: 0.1, iodine: null, vb6: null, vb12: null, niacin: 1.91, folate: null, vk: null, pantothenic: null, biotin: null
  },
  5: { // 包子（猪肉馅）  → 小麦粉（标准粉）
    ca: 31, fe: 0.6, zn: 0.2, se: 7.42, va: null, vb1: 0.46, vb2: 0.05, vc: null, vd: null, ve: 0.32,
    k: 190, na: 3.1, p: 167, mag: 50, cu: 0.06, mn: 0.1, iodine: null, vb6: null, vb12: null, niacin: 1.91, folate: null, vk: null, pantothenic: null, biotin: null
  },
  6: { // 饺子（猪肉白菜馅）  → 小麦粉（标准粉）
    ca: 31, fe: 0.6, zn: 0.2, se: 7.42, va: null, vb1: 0.46, vb2: 0.05, vc: null, vd: null, ve: 0.32,
    k: 190, na: 3.1, p: 167, mag: 50, cu: 0.06, mn: 0.1, iodine: null, vb6: null, vb12: null, niacin: 1.91, folate: null, vk: null, pantothenic: null, biotin: null
  },
  7: { // 面包（白面包）  → 小麦粉（标准粉）
    ca: 31, fe: 0.6, zn: 0.2, se: 7.42, va: null, vb1: 0.46, vb2: 0.05, vc: null, vd: null, ve: 0.32,
    k: 190, na: 3.1, p: 167, mag: 50, cu: 0.06, mn: 0.1, iodine: null, vb6: null, vb12: null, niacin: 1.91, folate: null, vk: null, pantothenic: null, biotin: null
  },
  8: { // 粥（大米粥）  → 粳米粥
    ca: 7, fe: 0.1, zn: 0.2, se: 0.2, va: null, vb1: null, vb2: 0.03, vc: null, vd: null, ve: null,
    k: 13, na: 2.8, p: 20, mag: 7, cu: 0.03, mn: 0.2, iodine: null, vb6: null, vb12: null, niacin: 0.2, folate: null, vk: null, pantothenic: null, biotin: null
  },
  9: { // 糯米饭  → 糯米 [江米]
    ca: 26, fe: 1.4, zn: 1.54, se: 2.71, va: null, vb1: 0.04, vb2: null, vc: null, vd: null, ve: 1.29,
    k: 137, na: 1.5, p: 113, mag: 49, cu: 0.25, mn: 1.54, iodine: null, vb6: null, vb12: null, niacin: 2.3, folate: null, vk: null, pantothenic: null, biotin: null
  },
  10: { // 玉米（鲜）  → 玉米（鲜）
    ca: null, fe: 1.1, zn: 0.9, se: 1.63, va: null, vb1: null, vb2: 0.16, vc: 16, vd: null, ve: 0.46,
    k: 238, na: 1.1, p: 117, mag: 32, cu: 0.09, mn: 0.22, iodine: null, vb6: null, vb12: null, niacin: 1.8, folate: null, vk: null, pantothenic: null, biotin: null
  },
  // ==================== 薯类 ====================
  11: { // 马铃薯（土豆）  → 马铃薯[土豆、洋芋]
    ca: 7, fe: 0.4, zn: 0.3, se: 0.47, va: 1, vb1: 0.1, vb2: 0.02, vc: 14, vd: null, ve: 0.34,
    k: 347, na: 5.9, p: 46, mag: 24, cu: 0.09, mn: 0.1, iodine: null, vb6: null, vb12: null, niacin: 1.1, folate: null, vk: null, pantothenic: null, biotin: null
  },
  12: { // 甘薯（红薯）  → 甘薯(红心)[山芋、红薯]
    ca: 18, fe: 0.2, zn: 0.16, se: 0.22, va: 63, vb1: 0.05, vb2: 0.01, vc: 4, vd: null, ve: 0.28,
    k: 88, na: 70.9, p: 26, mag: 17, cu: 0.05, mn: 0.08, iodine: null, vb6: null, vb12: null, niacin: 0.2, folate: null, vk: null, pantothenic: null, biotin: null
  },
  13: { // 芋头  → 芋头 [芋艿、毛芋]
    ca: 11, fe: 0.3, zn: 0.19, se: 0.91, va: 1, vb1: 0.05, vb2: 0.02, vc: 1.5, vd: null, ve: null,
    k: 25, na: 5.5, p: 50, mag: 19, cu: 0.06, mn: 0.3, iodine: null, vb6: null, vb12: null, niacin: 0.28, folate: null, vk: null, pantothenic: null, biotin: null
  },
  14: { // 山药  → 山药（鲜）[薯蓣，大薯]
    ca: 16, fe: 0.3, zn: 0.27, se: 0.55, va: 3, vb1: 0.05, vb2: 0.02, vc: 5, vd: null, ve: 0.24,
    k: 213, na: 18.6, p: 34, mag: 20, cu: 0.24, mn: 0.12, iodine: null, vb6: null, vb12: null, niacin: 0.3, folate: null, vk: null, pantothenic: null, biotin: null
  },
  // ==================== 豆类及制品 ====================
  15: { // 豆腐（北豆腐）  → 豆腐（代表值）
    ca: 78, fe: 1.2, zn: 0.57, se: 1.5, va: null, vb1: 0.06, vb2: 0.02, vc: null, vd: null, ve: 5.79,
    k: 118, na: 5.6, p: 82, mag: 41, cu: 0.08, mn: 0.12, iodine: null, vb6: null, vb12: null, niacin: 0.21, folate: null, vk: null, pantothenic: null, biotin: null
  },
  16: { // 豆腐（南豆腐）  → 豆腐（南豆腐）
    ca: 113, fe: 1.2, zn: 0.43, se: 1.23, va: null, vb1: 0.06, vb2: 0.02, vc: null, vd: null, ve: 5.72,
    k: 154, na: 3.1, p: 76, mag: 36, cu: 0.04, mn: 0.03, iodine: null, vb6: null, vb12: null, niacin: null, folate: null, vk: null, pantothenic: null, biotin: null
  },
  17: { // 豆浆  → 豆浆
    ca: 5, fe: 0.4, zn: 0.28, se: null, va: null, vb1: 0.02, vb2: 0.02, vc: null, vd: null, ve: 1.06,
    k: 117, na: 3.7, p: 42, mag: 15, cu: 0.16, mn: 0.16, iodine: null, vb6: null, vb12: null, niacin: 0.14, folate: null, vk: null, pantothenic: null, biotin: null
  },
  18: { // 豆腐干  → 豆腐干（代表值）
    ca: 447, fe: 7.1, zn: 1.84, se: 7.12, va: 2, vb1: 0.02, vb2: 0.05, vc: null, vd: null, ve: 13,
    k: 137, na: 329, p: 174, mag: 69, cu: 0.41, mn: 1.07, iodine: null, vb6: null, vb12: null, niacin: 0.4, folate: null, vk: null, pantothenic: null, biotin: null
  },
  19: { // 腐竹  → 腐竹
    ca: 50, fe: 3.8, zn: 4.71, se: 1.51, va: null, vb1: 0.02, vb2: 0.17, vc: null, vd: null, ve: 28.43,
    k: 670, na: 27.1, p: 655, mag: 140, cu: 0.86, mn: 2.38, iodine: null, vb6: null, vb12: null, niacin: 0.8, folate: null, vk: null, pantothenic: null, biotin: null
  },
  20: { // 黄豆  → 黄豆 [大豆]
    ca: 191, fe: 8.2, zn: 3.34, se: 6.16, va: 18, vb1: 0.41, vb2: 0.2, vc: null, vd: null, ve: 18.9,
    k: 1503, na: 2.2, p: 465, mag: 199, cu: 1.35, mn: 2.26, iodine: null, vb6: null, vb12: null, niacin: 2.1, folate: null, vk: null, pantothenic: null, biotin: null
  },
  21: { // 红豆  → 赤小豆（干）[小豆,红小豆]
    ca: 74, fe: 7.4, zn: 2.2, se: 3.8, va: 7, vb1: 0.16, vb2: 0.11, vc: null, vd: null, ve: 14.36,
    k: 860, na: 2.2, p: 305, mag: 138, cu: 0.64, mn: 1.33, iodine: null, vb6: null, vb12: null, niacin: 2, folate: null, vk: null, pantothenic: null, biotin: null
  },
  22: { // 绿豆  → 绿豆（干）
    ca: 81, fe: 6.5, zn: 2.18, se: 4.28, va: 11, vb1: 0.25, vb2: 0.11, vc: null, vd: null, ve: 10.95,
    k: 787, na: 3.2, p: 337, mag: 125, cu: 1.08, mn: 1.11, iodine: null, vb6: null, vb12: null, niacin: 2, folate: null, vk: null, pantothenic: null, biotin: null
  },
  // ==================== 蔬菜类 ====================
  23: { // 大白菜  → 大白菜（代表值）
    ca: 57, fe: 0.8, zn: 0.46, se: 0.57, va: 7, vb1: 0.05, vb2: 0.04, vc: 37.5, vd: null, ve: 0.36,
    k: 134, na: 68.9, p: 33, mag: 12, cu: 0.06, mn: 0.19, iodine: null, vb6: null, vb12: null, niacin: 0.65, folate: null, vk: null, pantothenic: null, biotin: null
  },
  24: { // 油菜（小青菜）  → 油菜
    ca: 148, fe: 0.9, zn: 0.31, se: 0.73, va: 90, vb1: 0.02, vb2: 0.05, vc: null, vd: null, ve: null,
    k: 175, na: 73.7, p: 23, mag: 25, cu: 0.03, mn: 0.23, iodine: null, vb6: null, vb12: null, niacin: 0.55, folate: null, vk: null, pantothenic: null, biotin: null
  },
  25: { // 菠菜  → 菠菜（鲜）[赤根菜]
    ca: 66, fe: 2.9, zn: 0.85, se: 0.97, va: 243, vb1: 0.04, vb2: 0.11, vc: 32, vd: null, ve: 1.74,
    k: 311, na: 85.2, p: 47, mag: 58, cu: 0.1, mn: 0.66, iodine: null, vb6: null, vb12: null, niacin: 0.6, folate: null, vk: null, pantothenic: null, biotin: null
  },
  26: { // 番茄（西红柿）  → 番茄 [西红柿]
    ca: 4, fe: 0.2, zn: 0.12, se: 0.12, va: 31, vb1: 0.02, vb2: 0.01, vc: 14, vd: null, ve: 0.42,
    k: 179, na: 9.7, p: 24, mag: 12, cu: null, mn: 0.04, iodine: null, vb6: null, vb12: null, niacin: 0.49, folate: null, vk: null, pantothenic: null, biotin: null
  },
  27: { // 黄瓜  → 黄瓜（鲜）[胡瓜]
    ca: 24, fe: 0.5, zn: 0.18, se: 0.38, va: 8, vb1: 0.02, vb2: 0.03, vc: 9, vd: null, ve: 0.49,
    k: 102, na: 4.9, p: 24, mag: 15, cu: 0.05, mn: 0.06, iodine: null, vb6: null, vb12: null, niacin: 0.2, folate: null, vk: null, pantothenic: null, biotin: null
  },
  28: { // 茄子  → 茄子（代表值）
    ca: 24, fe: 0.5, zn: 0.23, se: 0.48, va: 4, vb1: 0.02, vb2: 0.04, vc: 5, vd: null, ve: 1.13,
    k: 142, na: 5.4, p: 23, mag: 13, cu: 0.1, mn: 0.13, iodine: null, vb6: null, vb12: null, niacin: 0.6, folate: null, vk: null, pantothenic: null, biotin: null
  },
  29: { // 土豆（蔬菜类）  → 马铃薯[土豆、洋芋]
    ca: 7, fe: 0.4, zn: 0.3, se: 0.47, va: 1, vb1: 0.1, vb2: 0.02, vc: 14, vd: null, ve: 0.34,
    k: 347, na: 5.9, p: 46, mag: 24, cu: 0.09, mn: 0.1, iodine: null, vb6: null, vb12: null, niacin: 1.1, folate: null, vk: null, pantothenic: null, biotin: null
  },
  30: { // 胡萝卜  → 胡萝卜（黄）
    ca: 32, fe: 0.5, zn: 0.14, se: 2.8, va: 344, vb1: 0.04, vb2: 0.04, vc: 16, vd: null, ve: null,
    k: 193, na: 25.1, p: 16, mag: 7, cu: 0.03, mn: 0.07, iodine: null, vb6: null, vb12: null, niacin: 0.2, folate: null, vk: null, pantothenic: null, biotin: null
  },
  31: { // 白萝卜  → 白萝卜（鲜）[莱菔]
    ca: 47, fe: 0.2, zn: 0.14, se: 0.12, va: null, vb1: 0.01, vb2: null, vc: 19, vd: null, ve: null,
    k: 167, na: 54.3, p: 16, mag: 12, cu: 0.01, mn: 0.05, iodine: null, vb6: null, vb12: null, niacin: 0.14, folate: null, vk: null, pantothenic: null, biotin: null
  },
  32: { // 莲藕  → 藕[莲藕]
    ca: 18, fe: 0.3, zn: 0.24, se: 0.17, va: null, vb1: 0.04, vb2: 0.01, vc: 19, vd: null, ve: 0.32,
    k: 293, na: 34.3, p: 45, mag: 14, cu: 0.09, mn: 0.89, iodine: null, vb6: null, vb12: null, niacin: 0.12, folate: null, vk: null, pantothenic: null, biotin: null
  },
  33: { // 西蓝花  → 西兰花 [绿菜花]
    ca: 50, fe: 0.9, zn: 0.46, se: 0.43, va: 13, vb1: 0.06, vb2: 0.08, vc: 56, vd: null, ve: 0.76,
    k: 179, na: 46.7, p: 61, mag: 22, cu: 0.03, mn: 0.16, iodine: null, vb6: null, vb12: null, niacin: 0.73, folate: null, vk: null, pantothenic: null, biotin: null
  },
  34: { // 花菜（菜花）  → 菜花（白色）[花椰菜]
    ca: 31, fe: 0.4, zn: 0.17, se: 2.86, va: 1, vb1: 0.04, vb2: 0.04, vc: 32, vd: null, ve: null,
    k: 206, na: 39.2, p: 32, mag: 18, cu: 0.02, mn: 0.09, iodine: null, vb6: null, vb12: null, niacin: 0.32, folate: null, vk: null, pantothenic: null, biotin: null
  },
  35: { // 南瓜  → 南瓜（鲜）[倭瓜，番瓜]
    ca: 16, fe: 0.4, zn: 0.14, se: 0.46, va: 74, vb1: 0.03, vb2: 0.04, vc: 8, vd: null, ve: 0.36,
    k: 145, na: 0.8, p: 24, mag: 8, cu: 0.03, mn: 0.08, iodine: null, vb6: null, vb12: null, niacin: 0.4, folate: null, vk: null, pantothenic: null, biotin: null
  },
  36: { // 冬瓜  → 冬瓜
    ca: 12, fe: 0.1, zn: 0.1, se: 0.02, va: null, vb1: null, vb2: null, vc: 16, vd: null, ve: 0.04,
    k: 57, na: 2.8, p: 11, mag: 10, cu: 0.01, mn: 0.02, iodine: null, vb6: null, vb12: null, niacin: 0.22, folate: null, vk: null, pantothenic: null, biotin: null
  },
  37: { // 苦瓜  → 苦瓜（鲜）[凉瓜，癞瓜]
    ca: 14, fe: 0.7, zn: 0.36, se: 0.36, va: 8, vb1: 0.03, vb2: 0.03, vc: 56, vd: null, ve: 0.85,
    k: 256, na: 2.5, p: 35, mag: 18, cu: 0.06, mn: 0.16, iodine: null, vb6: null, vb12: null, niacin: 0.4, folate: null, vk: null, pantothenic: null, biotin: null
  },
  38: { // 芹菜  → 芹菜茎
    ca: 80, fe: 1.2, zn: 0.24, se: 0.57, va: 28, vb1: 0.02, vb2: 0.06, vc: 8, vd: null, ve: 1.32,
    k: 206, na: 159, p: 38, mag: 18, cu: 0.09, mn: 0.16, iodine: null, vb6: null, vb12: null, niacin: 0.4, folate: null, vk: null, pantothenic: null, biotin: null
  },
  39: { // 生菜  → 生菜 [叶用莴苣]
    ca: 12, fe: 0.12, zn: 0.04, se: 0.01, va: 2, vb1: 0.02, vb2: 0.01, vc: null, vd: null, ve: null,
    k: 16.1, na: 7, p: 91, mag: 0.2, cu: 0.06, mn: null, iodine: null, vb6: null, vb12: null, niacin: null, folate: null, vk: null, pantothenic: null, biotin: null
  },
  40: { // 卷心菜  → 圆白菜，卷心菜
    ca: 49, fe: 0.6, zn: 0.25, se: 0.96, va: 6, vb1: 0.03, vb2: 0.03, vc: 40, vd: null, ve: 0.5,
    k: 124, na: 27.2, p: 26, mag: 12, cu: 0.04, mn: 0.18, iodine: null, vb6: null, vb12: null, niacin: 0.4, folate: null, vk: null, pantothenic: null, biotin: null
  },
  41: { // 木耳（干）  → 木耳（干）[黑木耳，云耳]
    ca: 247, fe: 97.4, zn: 3.18, se: 3.72, va: 8, vb1: 0.17, vb2: 0.44, vc: null, vd: null, ve: 11.34,
    k: 757, na: 48.5, p: 292, mag: 152, cu: 0.32, mn: 8.86, iodine: null, vb6: null, vb12: null, niacin: 2.5, folate: null, vk: null, pantothenic: null, biotin: null
  },
  42: { // 香菇  → 香菇（鲜）[香蕈，冬菇]
    ca: 2, fe: 0.3, zn: 0.66, se: 2.58, va: null, vb1: 0.08, vb2: null, vc: 1, vd: null, ve: null,
    k: 20, na: 1.4, p: 53, mag: 11, cu: 0.12, mn: 0.25, iodine: null, vb6: null, vb12: null, niacin: 2, folate: null, vk: null, pantothenic: null, biotin: null
  },
  // ==================== 水果类 ====================
  43: { // 苹果  → 苹果（代表值）
    ca: 4, fe: 0.3, zn: 0.04, se: 0.1, va: 4, vb1: 0.02, vb2: 0.02, vc: 3, vd: null, ve: 0.43,
    k: 83, na: 1.3, p: 7, mag: 4, cu: 0.07, mn: 0.03, iodine: null, vb6: null, vb12: null, niacin: 0.2, folate: null, vk: null, pantothenic: null, biotin: null
  },
  44: { // 香蕉  → 香蕉 [甘蕉]
    ca: 7, fe: 0.4, zn: 0.18, se: 0.87, va: 5, vb1: 0.02, vb2: 0.04, vc: 8, vd: null, ve: 0.24,
    k: 256, na: 0.8, p: 28, mag: 43, cu: 0.14, mn: 0.65, iodine: null, vb6: null, vb12: null, niacin: 0.7, folate: null, vk: null, pantothenic: null, biotin: null
  },
  45: { // 橙子  → 橙
    ca: 20, fe: 0.4, zn: 0.14, se: 0.31, va: 13, vb1: 0.05, vb2: 0.04, vc: 33, vd: null, ve: 0.56,
    k: 159, na: 1.2, p: 22, mag: 14, cu: 0.03, mn: 0.05, iodine: null, vb6: null, vb12: null, niacin: 0.3, folate: null, vk: null, pantothenic: null, biotin: null
  },
  46: { // 葡萄  → 葡萄（代表值）
    ca: 9, fe: 0.4, zn: 0.16, se: 0.11, va: 3, vb1: 0.03, vb2: 0.02, vc: 4, vd: null, ve: 0.86,
    k: 127, na: 1.9, p: 13, mag: 7, cu: 0.18, mn: 0.04, iodine: null, vb6: null, vb12: null, niacin: 0.25, folate: null, vk: null, pantothenic: null, biotin: null
  },
  47: { // 西瓜  → 西瓜（代表值）
    ca: 7, fe: 0.4, zn: 0.09, se: 0.09, va: 14, vb1: 0.02, vb2: 0.04, vc: 5.7, vd: null, ve: 0.11,
    k: 97, na: 3.3, p: 12, mag: 14, cu: 0.03, mn: 0.03, iodine: null, vb6: null, vb12: null, niacin: 0.3, folate: null, vk: null, pantothenic: null, biotin: null
  },
  48: { // 梨  → 梨（代表值）
    ca: 7, fe: 0.4, zn: 0.1, se: 0.29, va: 2, vb1: 0.03, vb2: 0.03, vc: 5, vd: null, ve: 0.46,
    k: 85, na: 1.7, p: 14, mag: 8, cu: 0.1, mn: 0.06, iodine: null, vb6: null, vb12: null, niacin: 0.2, folate: null, vk: null, pantothenic: null, biotin: null
  },
  49: { // 桃  → 桃（代表值）
    ca: 6, fe: 0.3, zn: 0.14, se: 0.47, va: 2, vb1: 0.01, vb2: 0.02, vc: 10, vd: null, ve: 0.71,
    k: 127, na: 1.7, p: 11, mag: 8, cu: 0.06, mn: 0.07, iodine: null, vb6: null, vb12: null, niacin: 0.3, folate: null, vk: null, pantothenic: null, biotin: null
  },
  50: { // 草莓  → 草莓 [洋莓, 凤阳草莓]
    ca: 18, fe: 1.8, zn: 0.14, se: 0.7, va: 3, vb1: 0.02, vb2: 0.03, vc: 47, vd: null, ve: 0.71,
    k: 131, na: 4.2, p: 27, mag: 12, cu: 0.04, mn: 0.49, iodine: null, vb6: null, vb12: null, niacin: 0.3, folate: null, vk: null, pantothenic: null, biotin: null
  },
  51: { // 猕猴桃  → 中华猕猴桃 [毛叶猕猴桃]
    ca: 27, fe: 1.2, zn: 0.57, se: 0.28, va: 11, vb1: 0.05, vb2: 0.02, vc: 62, vd: null, ve: 2.43,
    k: 144, na: 10, p: 26, mag: 12, cu: 1.87, mn: 0.73, iodine: null, vb6: null, vb12: null, niacin: 0.3, folate: null, vk: null, pantothenic: null, biotin: null
  },
  52: { // 火龙果  → 火龙果 [仙蜜果、红龙果]
    ca: 7, fe: 0.3, zn: 0.29, se: 0.03, va: null, vb1: 0.03, vb2: 0.02, vc: 3, vd: null, ve: 0.14,
    k: 20, na: 2.7, p: 35, mag: 30, cu: 0.04, mn: 0.19, iodine: null, vb6: null, vb12: null, niacin: 0.22, folate: null, vk: null, pantothenic: null, biotin: null
  },
  // ==================== 肉类 ====================
  53: { // 猪肉（肥瘦）  → 猪肉（代表值，fat 30g）
    ca: 6, fe: 1.3, zn: 1.78, se: 7.9, va: 15, vb1: 0.3, vb2: 0.13, vc: null, vd: null, ve: 0.67,
    k: 218, na: 56.8, p: 121, mag: 16, cu: 0.12, mn: 0.03, iodine: null, vb6: null, vb12: null, niacin: 4.1, folate: null, vk: null, pantothenic: null, biotin: null
  },
  54: { // 猪肉（瘦肉）  → 猪肉（瘦）
    ca: 6, fe: 3, zn: 2.99, se: 9.5, va: 44, vb1: 0.54, vb2: 0.1, vc: null, vd: null, ve: 0.34,
    k: 305, na: 57.5, p: 189, mag: 25, cu: 0.11, mn: 0.03, iodine: null, vb6: null, vb12: null, niacin: 5.3, folate: null, vk: null, pantothenic: null, biotin: null
  },
  55: { // 猪蹄  → 猪蹄
    ca: 33, fe: 1.1, zn: 1.14, se: 5.85, va: 3, vb1: 0.05, vb2: 0.1, vc: null, vd: null, ve: 0.01,
    k: 54, na: 101, p: 33, mag: 5, cu: 0.09, mn: 0.01, iodine: null, vb6: null, vb12: null, niacin: 1.5, folate: null, vk: null, pantothenic: null, biotin: null
  },
  56: { // 牛肉（肥瘦）  → 牛肉（代表值，fat 9g）
    ca: 5, fe: 1.8, zn: 4.7, se: 3.15, va: 3, vb1: 0.04, vb2: 0.11, vc: null, vd: null, ve: 0.68,
    k: 212, na: 64.1, p: 182, mag: 22, cu: 0.05, mn: 0.03, iodine: null, vb6: null, vb12: null, niacin: 4.15, folate: null, vk: null, pantothenic: null, biotin: null
  },
  57: { // 牛肉（瘦肉）  → 牛肉（代表值，瘦，fat 3g）
    ca: 5, fe: 2.3, zn: 5.09, se: 3.47, va: 4, vb1: 0.04, vb2: 0.13, vc: null, vd: null, ve: 0.83,
    k: 212, na: 64.1, p: 182, mag: 22, cu: 0.06, mn: 0.03, iodine: null, vb6: null, vb12: null, niacin: 4.92, folate: null, vk: null, pantothenic: null, biotin: null
  },
  58: { // 牛腩  → 牛肉（腹部肉）[牛腩]
    ca: null, fe: 0.6, zn: 2.69, se: 3.2, va: null, vb1: 0.02, vb2: 0.06, vc: null, vd: null, ve: null,
    k: null, na: null, p: null, mag: null, cu: 0.01, mn: null, iodine: null, vb6: null, vb12: null, niacin: 2.2, folate: null, vk: null, pantothenic: null, biotin: null
  },
  59: { // 羊肉（肥瘦）  → 羊肉（代表值，fat 7g）
    ca: 16, fe: 3.9, zn: 3.52, se: 5.95, va: 8, vb1: 0.07, vb2: 0.16, vc: null, vd: null, ve: 0.48,
    k: 300, na: 89.9, p: 161, mag: 23, cu: 0.13, mn: 0.06, iodine: null, vb6: null, vb12: null, niacin: 4.41, folate: null, vk: null, pantothenic: null, biotin: null
  },
  60: { // 鸡胸肉  → 鸡（代表值）
    ca: 13, fe: 1.8, zn: 1.46, se: 11.92, va: 92, vb1: 0.06, vb2: 0.07, vc: null, vd: null, ve: 1.34,
    k: 249, na: 62.8, p: 166, mag: 22, cu: 0.09, mn: 0.05, iodine: null, vb6: null, vb12: null, niacin: 7.54, folate: null, vk: null, pantothenic: null, biotin: null
  },
  61: { // 鸡腿肉  → 鸡腿
    ca: null, fe: 1.8, zn: 1.11, se: 9.7, va: 22, vb1: 0.06, vb2: 0.1, vc: null, vd: null, ve: null,
    k: 221, na: 73.6, p: 271, mag: 21, cu: 0.01, mn: 0.01, iodine: null, vb6: null, vb12: null, niacin: 3.25, folate: null, vk: null, pantothenic: null, biotin: null
  },
  62: { // 鸡翅  → 鸡翅
    ca: 8, fe: 0.9, zn: 0.42, se: 8.72, va: 28, vb1: null, vb2: 0.05, vc: null, vd: null, ve: 0.44,
    k: 205, na: 50.8, p: 94, mag: 17, cu: null, mn: 0.01, iodine: null, vb6: null, vb12: null, niacin: 4.36, folate: null, vk: null, pantothenic: null, biotin: null
  },
  63: { // 鸭肉  → 鸭（代表值）
    ca: 6, fe: 2.2, zn: 1.33, se: 12.25, va: 52, vb1: 0.08, vb2: 0.22, vc: null, vd: null, ve: 0.27,
    k: 191, na: 69, p: 122, mag: 14, cu: 0.21, mn: 0.06, iodine: null, vb6: null, vb12: null, niacin: 4.2, folate: null, vk: null, pantothenic: null, biotin: null
  },
  64: { // 鹅肉  → 鹅
    ca: 4, fe: 3.8, zn: 1.36, se: 17.68, va: 42, vb1: 0.07, vb2: 0.23, vc: null, vd: null, ve: 0.22,
    k: 232, na: 58.8, p: 144, mag: 18, cu: 0.43, mn: 0.04, iodine: null, vb6: null, vb12: null, niacin: 4.9, folate: null, vk: null, pantothenic: null, biotin: null
  },
  // ==================== 蛋类 ====================
  65: { // 鸡蛋（整）  → 鸡蛋（代表值）
    ca: 56, fe: 1.6, zn: 0.89, se: 13.96, va: 255, vb1: 0.09, vb2: 0.2, vc: null, vd: null, ve: 1.14,
    k: 154, na: 131.5, p: 130, mag: 10, cu: 0.19, mn: 0.03, iodine: null, vb6: null, vb12: null, niacin: 0.2, folate: null, vk: null, pantothenic: null, biotin: null
  },
  66: { // 鸡蛋白  → 鸡蛋白
    ca: 9, fe: 1.6, zn: 0.02, se: 6.97, va: null, vb1: 0.04, vb2: 0.31, vc: null, vd: null, ve: 0.01,
    k: 132, na: 79.4, p: 18, mag: 15, cu: 0.05, mn: 0.02, iodine: null, vb6: null, vb12: null, niacin: 0.2, folate: null, vk: null, pantothenic: null, biotin: null
  },
  67: { // 鸡蛋黄  → 鸡蛋黄
    ca: 112, fe: 6.5, zn: 3.79, se: 27.01, va: 438, vb1: 0.33, vb2: 0.29, vc: null, vd: null, ve: 5.06,
    k: 95, na: 54.9, p: 240, mag: 41, cu: 0.28, mn: 0.06, iodine: null, vb6: null, vb12: null, niacin: 0.1, folate: null, vk: null, pantothenic: null, biotin: null
  },
  68: { // 鸭蛋  → 鸭蛋
    ca: 62, fe: 2.9, zn: 1.67, se: 15.68, va: 261, vb1: 0.17, vb2: 0.35, vc: null, vd: null, ve: 4.98,
    k: 135, na: 106, p: 226, mag: 13, cu: 0.11, mn: 0.04, iodine: null, vb6: null, vb12: null, niacin: 0.2, folate: null, vk: null, pantothenic: null, biotin: null
  },
  69: { // 咸鸭蛋  → 鸭蛋（咸鸭蛋，生）
    ca: 118, fe: 3.6, zn: 1.74, se: 24.04, va: 134, vb1: 0.16, vb2: 0.33, vc: null, vd: null, ve: 6.25,
    k: 184, na: 2706.1, p: 231, mag: 30, cu: 0.14, mn: 0.1, iodine: null, vb6: null, vb12: null, niacin: 0.1, folate: null, vk: null, pantothenic: null, biotin: null
  },
  // ==================== 鱼虾类 ====================
  70: { // 草鱼  → 草鱼
    ca: 38, fe: 0.8, zn: 0.87, se: 6.66, va: 11, vb1: 0.04, vb2: 0.11, vc: null, vd: null, ve: 2.03,
    k: 312, na: 46, p: 203, mag: 31, cu: 0.05, mn: 0.05, iodine: null, vb6: null, vb12: null, niacin: 2.8, folate: null, vk: null, pantothenic: null, biotin: null
  },
  71: { // 鲤鱼  → 鲤鱼[鲤拐子]
    ca: 50, fe: 1, zn: 2.08, se: 15.38, va: 25, vb1: 0.03, vb2: 0.09, vc: null, vd: null, ve: 1.27,
    k: 334, na: 53.7, p: 204, mag: 33, cu: 0.06, mn: 0.05, iodine: null, vb6: null, vb12: null, niacin: 2.7, folate: null, vk: null, pantothenic: null, biotin: null
  },
  72: { // 鲫鱼  → 鲫鱼 [喜头鱼、海附鱼]
    ca: 79, fe: 1.3, zn: 0.53, se: 22.96, va: 17, vb1: 0.08, vb2: 0.06, vc: null, vd: null, ve: 0.34,
    k: 290, na: 41.2, p: 157, mag: 41, cu: 0.01, mn: 0.06, iodine: null, vb6: null, vb12: null, niacin: 2.38, folate: null, vk: null, pantothenic: null, biotin: null
  },
  73: { // 黄鱼（大黄鱼）  → 黄鱼（大黄花鱼）
    ca: 53, fe: 0.7, zn: 0.58, se: 42.57, va: 10, vb1: 0.03, vb2: 0.1, vc: null, vd: null, ve: 1.13,
    k: 260, na: 120.3, p: 174, mag: 39, cu: 0.04, mn: 0.02, iodine: null, vb6: null, vb12: null, niacin: 1.9, folate: null, vk: null, pantothenic: null, biotin: null
  },
  74: { // 带鱼  → 带鱼(切段)
    ca: 431, fe: 1.1, zn: 2.23, se: 26.63, va: 19, vb1: 0.02, vb2: 0.08, vc: null, vd: null, ve: 0.42,
    k: 361, na: 246.4, p: 282, mag: 30, cu: 0.07, mn: 0.09, iodine: null, vb6: null, vb12: null, niacin: 1.45, folate: null, vk: null, pantothenic: null, biotin: null
  },
  75: { // 三文鱼  → 鲑鱼 [大马哈鱼、三文鱼]
    ca: 13, fe: 0.3, zn: 1.11, se: 29.47, va: 45, vb1: 0.07, vb2: 0.18, vc: null, vd: null, ve: 0.78,
    k: 361, na: 63.3, p: 154, mag: 36, cu: 0.03, mn: 0.02, iodine: null, vb6: null, vb12: null, niacin: 4.4, folate: null, vk: null, pantothenic: null, biotin: null
  },
  76: { // 鳕鱼  → 鳕鱼 [鳕狭、明太鱼]
    ca: 42, fe: 0.5, zn: 0.86, se: 24.8, va: 14, vb1: 0.04, vb2: 0.13, vc: null, vd: null, ve: null,
    k: 321, na: 130.3, p: 232, mag: 84, cu: 0.01, mn: 0.01, iodine: null, vb6: null, vb12: null, niacin: 2.7, folate: null, vk: null, pantothenic: null, biotin: null
  },
  77: { // 虾（河虾）  → 河虾
    ca: 325, fe: 4, zn: 2.24, se: 29.65, va: 48, vb1: 0.04, vb2: 0.03, vc: null, vd: null, ve: 5.33,
    k: 329, na: 133.8, p: 186, mag: 60, cu: 0.64, mn: 0.27, iodine: null, vb6: null, vb12: null, niacin: null, folate: null, vk: null, pantothenic: null, biotin: null
  },
  78: { // 虾（对虾）  → 对虾
    ca: 62, fe: 1.5, zn: 2.38, se: 33.72, va: 15, vb1: 0.01, vb2: 0.07, vc: null, vd: null, ve: 0.62,
    k: 215, na: 165.2, p: 228, mag: 43, cu: 0.34, mn: 0.12, iodine: null, vb6: null, vb12: null, niacin: 1.7, folate: null, vk: null, pantothenic: null, biotin: null
  },
  79: { // 螃蟹（河蟹）  → 河蟹
    ca: 126, fe: 2.9, zn: 3.68, se: 56.72, va: 389, vb1: 0.06, vb2: 0.28, vc: null, vd: null, ve: 6.09,
    k: 181, na: 193.5, p: 182, mag: 23, cu: 2.97, mn: 0.42, iodine: null, vb6: null, vb12: null, niacin: 1.7, folate: null, vk: null, pantothenic: null, biotin: null
  },
  80: { // 海参  → 海参
    ca: 285, fe: 13.2, zn: 0.63, se: 63.93, va: null, vb1: 0.03, vb2: 0.04, vc: null, vd: null, ve: 3.14,
    k: 43, na: 502.9, p: 28, mag: 149, cu: 0.05, mn: 0.76, iodine: null, vb6: null, vb12: null, niacin: 0.1, folate: null, vk: null, pantothenic: null, biotin: null
  },
  81: { // 牡蛎（蚝）  → 生蚝
    ca: 35, fe: 5, zn: 71.2, se: 41.4, va: null, vb1: 0.04, vb2: 0.13, vc: null, vd: null, ve: 0.13,
    k: 375, na: 270, p: 100, mag: 10, cu: 11.5, mn: 0.3, iodine: null, vb6: null, vb12: null, niacin: 1.5, folate: null, vk: null, pantothenic: null, biotin: null
  },
  // ==================== 乳类 ====================
  82: { // 牛奶  → 纯牛奶（代表值，全脂）
    ca: 107, fe: 0.3, zn: 0.28, se: 1.34, va: 54, vb1: 0.03, vb2: 0.12, vc: null, vd: null, ve: 0.13,
    k: 180, na: 63.7, p: 90, mag: 11, cu: 0.01, mn: 0.01, iodine: null, vb6: null, vb12: null, niacin: 0.11, folate: null, vk: null, pantothenic: null, biotin: null
  },
  83: { // 酸奶  → 酸奶（代表值，全脂）
    ca: 128, fe: 0.3, zn: 0.43, se: 1.3, va: 23, vb1: 0.03, vb2: 0.12, vc: 1.3, vd: null, ve: 0.12,
    k: 150, na: 37.7, p: 76, mag: 11, cu: 0.04, mn: 0.01, iodine: null, vb6: null, vb12: null, niacin: 0.09, folate: null, vk: null, pantothenic: null, biotin: null
  },
  84: { // 奶粉（全脂）  → 全脂奶粉（代表值）
    ca: 928, fe: 4.6, zn: 3.93, se: 12.09, va: 380, vb1: 0.13, vb2: 1.9, vc: 23.6, vd: null, ve: 0.48,
    k: 777, na: 352, p: 513, mag: 65, cu: 0.13, mn: 0.04, iodine: null, vb6: null, vb12: null, niacin: 0.5, folate: null, vk: null, pantothenic: null, biotin: null
  },
  85: { // 奶酪（干酪）  → 奶酪 [干酪]
    ca: 799, fe: 2.4, zn: 6.97, se: 1.5, va: 152, vb1: 0.06, vb2: 0.91, vc: null, vd: null, ve: 0.6,
    k: 75, na: 584.6, p: 326, mag: 57, cu: 0.13, mn: 0.16, iodine: null, vb6: null, vb12: null, niacin: 0.6, folate: null, vk: null, pantothenic: null, biotin: null
  },
  // ==================== 坚果种子 ====================
  86: { // 花生  → 花生（炒）
    ca: 47, fe: 1.5, zn: 2.03, se: 3.9, va: 5, vb1: 0.13, vb2: 0.12, vc: null, vd: null, ve: 12.94,
    k: 563, na: 34.8, p: 326, mag: 171, cu: 0.68, mn: 1.44, iodine: null, vb6: null, vb12: null, niacin: 18.9, folate: null, vk: null, pantothenic: null, biotin: null
  },
  87: { // 核桃  → 核桃（干）[胡桃]
    ca: 56, fe: 2.7, zn: 2.17, se: 4.62, va: 3, vb1: 0.1, vb2: 0.14, vc: 1, vd: null, ve: 43.21,
    k: 385, na: 6.4, p: 294, mag: 131, cu: 1.17, mn: 3.44, iodine: null, vb6: null, vb12: null, niacin: 0.9, folate: null, vk: null, pantothenic: null, biotin: null
  },
  88: { // 杏仁  → 杏仁
    ca: 97, fe: 2.2, zn: 4.3, se: 15.65, va: null, vb1: 0.08, vb2: 0.56, vc: 26, vd: null, ve: 18.53,
    k: 106, na: 8.3, p: 27, mag: 178, cu: 0.8, mn: 0.77, iodine: null, vb6: null, vb12: null, niacin: null, folate: null, vk: null, pantothenic: null, biotin: null
  },
  89: { // 瓜子（葵花子）  → 葵花子（生）
    ca: 72, fe: 5.7, zn: 6.03, se: 1.21, va: 3, vb1: 0.36, vb2: 0.2, vc: null, vd: null, ve: 34.53,
    k: 562, na: 5.5, p: 238, mag: 264, cu: 2.51, mn: 1.95, iodine: null, vb6: null, vb12: null, niacin: 4.8, folate: null, vk: null, pantothenic: null, biotin: null
  },
  90: { // 芝麻  → 芝麻子（白）
    ca: 620, fe: 14.1, zn: 4.21, se: 4.06, va: null, vb1: 0.36, vb2: 0.26, vc: null, vd: null, ve: 38.28,
    k: 266, na: 32.2, p: 513, mag: 202, cu: 1.41, mn: 1.17, iodine: null, vb6: null, vb12: null, niacin: 3.8, folate: null, vk: null, pantothenic: null, biotin: null
  },
  // ==================== 油脂类 ====================
  91: { // 菜籽油  → 菜籽油 [青油]
    ca: 9, fe: 3.7, zn: 0.54, se: null, va: null, vb1: null, vb2: null, vc: null, vd: null, ve: 60.89,
    k: 2, na: 7, p: 9, mag: 3, cu: 0.18, mn: 0.11, iodine: null, vb6: null, vb12: null, niacin: null, folate: null, vk: null, pantothenic: null, biotin: null
  },
  92: { // 橄榄油  → 橄榄油
    ca: null, fe: 0.4, zn: null, se: null, va: null, vb1: null, vb2: null, vc: null, vd: null, ve: null,
    k: null, na: null, p: null, mag: null, cu: null, mn: null, iodine: null, vb6: null, vb12: null, niacin: null, folate: null, vk: null, pantothenic: null, biotin: null
  },
  93: { // 椰子油  → 椰子油
    ca: null, fe: null, zn: null, se: null, va: null, vb1: null, vb2: null, vc: null, vd: null, ve: null,
    k: null, na: null, p: null, mag: null, cu: null, mn: null, iodine: null, vb6: null, vb12: null, niacin: null, folate: null, vk: null, pantothenic: null, biotin: null
  },
  94: { // 亚麻籽油
    ca: null, fe: null, zn: null, se: null, va: null, vb1: null, vb2: null, vc: null, vd: null, ve: null,
    k: null, na: null, p: null, mag: null, cu: null, mn: null, iodine: null, vb6: null, vb12: null, niacin: null, folate: null, vk: null, pantothenic: null, biotin: null
  },
  95: { // 猪油  → 猪油（板油）
    ca: null, fe: 2.1, zn: 0.8, se: 0.05, va: 89, vb1: null, vb2: null, vc: null, vd: null, ve: 21.83,
    k: 14, na: 138.5, p: 10, mag: 1, cu: 0.63, mn: null, iodine: null, vb6: null, vb12: null, niacin: null, folate: null, vk: null, pantothenic: null, biotin: null
  },
  96: { // 芝麻油  → 芝麻油 [香油]
    ca: 9, fe: 2.2, zn: 0.17, se: null, va: null, vb1: null, vb2: null, vc: null, vd: null, ve: 68.53,
    k: null, na: 1.1, p: 4, mag: 3, cu: 0.05, mn: 0.76, iodine: null, vb6: null, vb12: null, niacin: null, folate: null, vk: null, pantothenic: null, biotin: null
  },
  97: { // 大豆油  → 豆油
    ca: 13, fe: 2, zn: 1.09, se: null, va: null, vb1: null, vb2: null, vc: null, vd: null, ve: 93.08,
    k: 3, na: 4.9, p: 7, mag: 3, cu: 0.16, mn: 0.43, iodine: null, vb6: null, vb12: null, niacin: null, folate: null, vk: null, pantothenic: null, biotin: null
  },
  98: { // 花生油  → 花生油
    ca: 12, fe: 2.9, zn: 0.48, se: null, va: null, vb1: null, vb2: null, vc: null, vd: null, ve: 42.06,
    k: 1, na: 3.5, p: 15, mag: 2, cu: 0.15, mn: 0.33, iodine: null, vb6: null, vb12: null, niacin: null, folate: null, vk: null, pantothenic: null, biotin: null
  },
  // ==================== 菜品 ====================
  99: { // 番茄炒蛋
    ca: null, fe: null, zn: null, se: null, va: null, vb1: null, vb2: null, vc: null, vd: null, ve: null,
    k: null, na: null, p: null, mag: null, cu: null, mn: null, iodine: null, vb6: null, vb12: null, niacin: null, folate: null, vk: null, pantothenic: null, biotin: null
  },
  100: { // 红烧肉
    ca: null, fe: null, zn: null, se: null, va: null, vb1: null, vb2: null, vc: null, vd: null, ve: null,
    k: null, na: null, p: null, mag: null, cu: null, mn: null, iodine: null, vb6: null, vb12: null, niacin: null, folate: null, vk: null, pantothenic: null, biotin: null
  },
  101: { // 清蒸鱼
    ca: null, fe: null, zn: null, se: null, va: null, vb1: null, vb2: null, vc: null, vd: null, ve: null,
    k: null, na: null, p: null, mag: null, cu: null, mn: null, iodine: null, vb6: null, vb12: null, niacin: null, folate: null, vk: null, pantothenic: null, biotin: null
  },
  102: { // 宫保鸡丁
    ca: null, fe: null, zn: null, se: null, va: null, vb1: null, vb2: null, vc: null, vd: null, ve: null,
    k: null, na: null, p: null, mag: null, cu: null, mn: null, iodine: null, vb6: null, vb12: null, niacin: null, folate: null, vk: null, pantothenic: null, biotin: null
  },
  103: { // 糖醋排骨
    ca: null, fe: null, zn: null, se: null, va: null, vb1: null, vb2: null, vc: null, vd: null, ve: null,
    k: null, na: null, p: null, mag: null, cu: null, mn: null, iodine: null, vb6: null, vb12: null, niacin: null, folate: null, vk: null, pantothenic: null, biotin: null
  },
  104: { // 鱼香肉丝
    ca: null, fe: null, zn: null, se: null, va: null, vb1: null, vb2: null, vc: null, vd: null, ve: null,
    k: null, na: null, p: null, mag: null, cu: null, mn: null, iodine: null, vb6: null, vb12: null, niacin: null, folate: null, vk: null, pantothenic: null, biotin: null
  },
  105: { // 麻婆豆腐
    ca: null, fe: null, zn: null, se: null, va: null, vb1: null, vb2: null, vc: null, vd: null, ve: null,
    k: null, na: null, p: null, mag: null, cu: null, mn: null, iodine: null, vb6: null, vb12: null, niacin: null, folate: null, vk: null, pantothenic: null, biotin: null
  },
  // ==================== 补充主食 ====================
  106: { // 小米（生）  → 小米
    ca: 41, fe: 5.1, zn: 1.87, se: 4.74, va: 8, vb1: 0.33, vb2: 0.1, vc: null, vd: null, ve: 3.63,
    k: 284, na: 4.3, p: 229, mag: 107, cu: 0.54, mn: 0.89, iodine: null, vb6: null, vb12: null, niacin: 1.5, folate: null, vk: null, pantothenic: null, biotin: null
  },
  107: { // 小米粥（熟）  → 小米粥
    ca: 10, fe: 1, zn: 0.41, se: 0.3, va: null, vb1: 0.02, vb2: 0.07, vc: null, vd: null, ve: 0.26,
    k: 19, na: 4.1, p: 32, mag: 22, cu: 0.07, mn: 0.16, iodine: null, vb6: null, vb12: null, niacin: 0.9, folate: null, vk: null, pantothenic: null, biotin: null
  },
  108: { // 燕麦片（生）  → 燕麦片（BOSS手动查阅）
    ca: 186, fe: 7, zn: 2.59, se: 4.3, va: null, vb1: 0.3, vb2: 0.13, vc: null, vd: null, ve: null,
    k: 214, na: 3.7, p: 291, mag: 177, cu: 0.45, mn: 3.36, iodine: null, vb6: null, vb12: null, niacin: 1.2, folate: null, vk: null, pantothenic: null, biotin: null
  },
  109: { // 燕麦粥（熟）  → 燕麦粥（USDA Cooked Oatmeal）
    ca: 10, fe: 0.9, zn: 0.62, se: 5.4, va: 0, vb1: 0.07, vb2: 0.025, vc: 0, vd: null, ve: 0.07,
    k: 72, na: 4, p: 78, mag: 27, cu: 0.063, mn: 0.49, iodine: null, vb6: 0.006, vb12: 0, niacin: 0.108, folate: 6, vk: null, pantothenic: null, biotin: null
  },
  110: { // 荞麦面（干）  → 荞麦
    ca: 47, fe: 6.2, zn: 3.62, se: 2.45, va: 2, vb1: 0.28, vb2: 0.16, vc: null, vd: null, ve: 4.4,
    k: 401, na: 4.7, p: 297, mag: 258, cu: 0.56, mn: 2.04, iodine: null, vb6: null, vb12: null, niacin: 2.2, folate: null, vk: null, pantothenic: null, biotin: null
  },
  111: { // 荞麦面条（熟）  → 荞麦面
    ca: 71, fe: 7, zn: 1.94, se: 2.16, va: 2, vb1: 0.26, vb2: 0.1, vc: null, vd: null, ve: 5.31,
    k: 304, na: 0.9, p: 243, mag: 151, cu: 0.39, mn: 0.59, iodine: null, vb6: null, vb12: null, niacin: 3.47, folate: null, vk: null, pantothenic: null, biotin: null
  },
  112: { // 全麦面包  → 面包（均值）（BOSS手动查阅）
    ca: 49, fe: 2, zn: 0.75, se: 3.2, va: null, vb1: 0.03, vb2: 0.06, vc: null, vd: null, ve: null,
    k: 88, na: 230.4, p: 107, mag: 31, cu: 0.27, mn: 0.37, iodine: null, vb6: null, vb12: null, niacin: 1.7, folate: null, vk: null, pantothenic: null, biotin: null
  },
  113: { // 黑米（生）  → 黑米
    ca: 12, fe: 1.6, zn: 3.8, se: 3.2, va: null, vb1: 0.13, vb2: null, vc: null, vd: null, ve: 0.22,
    k: 256, na: 7.1, p: 356, mag: 147, cu: 0.15, mn: 1.72, iodine: null, vb6: null, vb12: null, niacin: 7.9, folate: null, vk: null, pantothenic: null, biotin: null
  },
  114: { // 黑米饭（熟）  → 米饭（蒸，代表值）
    ca: 7, fe: 1.3, zn: 0.92, se: 0.4, va: null, vb1: 0.02, vb2: 0.03, vc: null, vd: null, ve: null,
    k: 30, na: 2.5, p: 62, mag: 15, cu: 0.06, mn: 0.58, iodine: null, vb6: null, vb12: null, niacin: 1.9, folate: null, vk: null, pantothenic: null, biotin: null
  },
  115: { // 藜麦（生）  → Quinoa, uncooked (USDA SR Legacy)
    ca: 47, fe: 4.57, zn: 3.1, se: 8.5, va: 1, vb1: 0.36, vb2: 0.318, vc: 0, vd: null, ve: 2.44,
    k: 563, na: 5, p: 457, mag: 197, cu: 0.59, mn: 2.03, iodine: null, vb6: 0.487, vb12: 0, niacin: 1.52, folate: 184, vk: null, pantothenic: 0.772, biotin: null
  },
  116: { // 藜麦饭（熟）  → Quinoa, cooked (USDA SR Legacy)
    ca: 17, fe: 1.49, zn: 1.09, se: 2.8, va: 0, vb1: 0.107, vb2: 0.11, vc: 0, vd: null, ve: 0.63,
    k: 172, na: 7, p: 152, mag: 64, cu: 0.192, mn: 0.631, iodine: null, vb6: 0.123, vb12: 0, niacin: 0.412, folate: 42, vk: null, pantothenic: 0.3, biotin: null
  },
  117: { // 糙米（生）  → 糙米
    ca: 10, fe: 1.8, zn: 1.79, se: null, va: null, vb1: 0.04, vb2: null, vc: null, vd: null, ve: 1.32,
    k: 230, na: 5.4, p: 304, mag: 123, cu: 0.24, mn: 3.04, iodine: null, vb6: null, vb12: null, niacin: null, folate: null, vk: null, pantothenic: null, biotin: null
  },
  118: { // 糙米饭（熟）  → 米饭（蒸，代表值）
    ca: 7, fe: 1.3, zn: 0.92, se: 0.4, va: null, vb1: 0.02, vb2: 0.03, vc: null, vd: null, ve: null,
    k: 30, na: 2.5, p: 62, mag: 15, cu: 0.06, mn: 0.58, iodine: null, vb6: null, vb12: null, niacin: 1.9, folate: null, vk: null, pantothenic: null, biotin: null
  },
  119: { // 紫薯（生）  → Sweet potato, raw (USDA SR Legacy) ≈ 紫薯
    ca: 30, fe: 0.61, zn: 0.3, se: 0.6, va: 709, vb1: 0.078, vb2: 0.061, vc: 2.4, vd: null, ve: 0.26,
    k: 337, na: 55, p: 47, mag: 25, cu: 0.151, mn: 0.258, iodine: null, vb6: 0.209, vb12: 0, niacin: 0.557, folate: 11, vk: 1.8, pantothenic: 0.8, biotin: null
  },
  // ==================== 补充蔬菜 ====================
  120: { // 油麦菜  → 油麦菜
    ca: 60, fe: 0.5, zn: 0.24, se: 0.16, va: 63, vb1: 0.03, vb2: 0.07, vc: 2, vd: null, ve: 0.45,
    k: 164, na: 32, p: 26, mag: 23, cu: 0.02, mn: 0.06, iodine: null, vb6: null, vb12: null, niacin: 0.56, folate: null, vk: null, pantothenic: null, biotin: null
  },
  121: { // 空心菜  → 萹菜 [空心菜、藤藤菜]
    ca: 115, fe: 1, zn: 0.27, se: null, va: 143, vb1: 0.03, vb2: 0.05, vc: 5, vd: null, ve: 0.1,
    k: 304, na: 107.6, p: 37, mag: 46, cu: 0.05, mn: 0.52, iodine: null, vb6: null, vb12: null, niacin: 0.22, folate: null, vk: null, pantothenic: null, biotin: null
  },
  122: { // 芦笋  → 芦笋 (绿) [石刁柏、龙须菜]
    ca: 9, fe: 1.4, zn: 0.55, se: 0.62, va: 2, vb1: 0.07, vb2: 0.08, vc: 7, vd: null, ve: 0.19,
    k: 304, na: 12.4, p: 51, mag: 18, cu: 0.1, mn: 0.12, iodine: null, vb6: null, vb12: null, niacin: 1.12, folate: null, vk: null, pantothenic: null, biotin: null
  },
  123: { // 秋葵  → 秋葵 [黄秋葵、羊角豆]
    ca: 101, fe: 0.2, zn: 0.24, se: 0.54, va: 20, vb1: 0.06, vb2: 0.05, vc: 7.2, vd: null, ve: null,
    k: 19, na: 8.7, p: 41, mag: 38, cu: 0.03, mn: 0.13, iodine: null, vb6: null, vb12: null, niacin: 0.42, folate: null, vk: null, pantothenic: null, biotin: null
  },
  124: { // 娃娃菜  → 娃娃菜
    ca: 78, fe: 0.4, zn: 0.35, se: 0.16, va: 4, vb1: 0.04, vb2: 0.03, vc: 12, vd: null, ve: null,
    k: 278, na: 19.3, p: 58, mag: 17, cu: 0.03, mn: 0.13, iodine: null, vb6: null, vb12: null, niacin: 0.61, folate: null, vk: null, pantothenic: null, biotin: null
  },
  125: { // 菜心  → 白菜薹[菜薹，菜心]
    ca: 96, fe: 2.8, zn: 0.87, se: 6.68, va: 80, vb1: 0.05, vb2: 0.08, vc: 44, vd: null, ve: 0.52,
    k: 236, na: 26, p: 54, mag: 19, cu: 0.18, mn: 0.41, iodine: null, vb6: null, vb12: null, niacin: 1.2, folate: null, vk: null, pantothenic: null, biotin: null
  },
  // ==================== 补充其他 ====================
  126: { // 燕麦片（果仁、甜）  → 燕麦片（果仁、甜）（BOSS手动查阅）
    ca: 38, fe: 2.6, zn: 1.1, se: 3.9, va: null, vb1: 0.29, vb2: 0.07, vc: null, vd: null, ve: null,
    k: 410, na: 26.5, p: 172, mag: 58, cu: 0.4, mn: 1.53, iodine: 2.2, vb6: null, vb12: null, niacin: 0.81, folate: null, vk: null, pantothenic: null, biotin: null
  },

};

// 字段元信息：名称、单位、是否核心字段
const MV_FIELDS = {
  ca:          { name: '钙',       unit: 'mg',  core: true },
  fe:          { name: '铁',       unit: 'mg',  core: true },
  zn:          { name: '锌',       unit: 'mg',  core: true },
  se:          { name: '硒',       unit: 'μg',  core: true },
  va:          { name: '维生素A',  unit: 'μg RAE', core: true },
  vb1:         { name: '维生素B1', unit: 'mg',  core: true },
  vb2:         { name: '维生素B2', unit: 'mg',  core: true },
  vc:          { name: '维生素C',  unit: 'mg',  core: true },
  vd:          { name: '维生素D',  unit: 'μg',  core: true },
  ve:          { name: '维生素E',  unit: 'mg α-TE', core: true },
  k:           { name: '钾',       unit: 'mg',  core: false },
  na:          { name: '钠',       unit: 'mg',  core: false },
  p:           { name: '磷',       unit: 'mg',  core: false },
  mag:         { name: '镁',       unit: 'mg',  core: false },
  cu:          { name: '铜',       unit: 'mg',  core: false },
  mn:          { name: '锰',       unit: 'mg',  core: false },
  iodine:      { name: '碘',       unit: 'μg',  core: false },
  vb6:         { name: '维生素B6', unit: 'mg',  core: false },
  vb12:        { name: '维生素B12', unit: 'μg', core: false },
  niacin:      { name: '烟酸',     unit: 'mg NE', core: false },
  folate:      { name: '叶酸',     unit: 'μg DFE', core: false },
  vk:          { name: '维生素K',  unit: 'μg',  core: false },
  pantothenic: { name: '泛酸',     unit: 'mg',  core: false },
  biotin:      { name: '生物素',   unit: 'μg',  core: false },
};