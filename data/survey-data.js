/**
 * 饮食习惯调查 - 数据定义
 * 基于夏萌《低碳水：适合国人体质的慢病营养策略》附录4 调查问卷表
 * 必须与图片完全一致
 */

// 食物摄入频率表 - 必须与图片完全一致
// nutrition: 每100g可食部的营养成分（蛋白质g, 脂肪g, 碳水g, 热量kcal）
const FOOD_FREQ_ITEMS = [
    // 主食类
    { id: 'porridge', name: '粥（白米粥、小米粥、杂豆粥、麦片粥）', icon: '🥣', category: '主食类', nutrition: { protein: 1.5, fat: 0.3, carb: 12, kcal: 58 } },
    { id: 'dry_noodles', name: '干的面食（馒头、花卷、烙饼）', icon: '🍞', category: '主食类', nutrition: { protein: 8, fat: 1.1, carb: 48, kcal: 230 } },
    { id: 'noodles', name: '面条、米线', icon: '🍜', category: '主食类', nutrition: { protein: 8, fat: 0.5, carb: 50, kcal: 235 } },
    { id: 'coarse_grain', name: '粗粮（全谷物、根茎类粗粮）', icon: '🌾', category: '主食类', nutrition: { protein: 6, fat: 1, carb: 45, kcal: 215 } },
    // 肉蛋类
    { id: 'lean_meat', name: '瘦肉（猪、牛、羊、鸡、鸭）', icon: '🥩', category: '肉蛋类', nutrition: { protein: 20, fat: 8, carb: 0, kcal: 155 } },
    { id: 'fat_meat', name: '肥肉', icon: '🥓', category: '肉蛋类', nutrition: { protein: 9, fat: 60, carb: 0, kcal: 580 } },
    { id: 'organ', name: '动物内脏', icon: '❤️', category: '肉蛋类', nutrition: { protein: 16, fat: 5, carb: 2, kcal: 115 } },
    { id: 'seafood', name: '河鲜类（鱼、虾、蟹等）', icon: '🐟', category: '肉蛋类', nutrition: { protein: 18, fat: 4, carb: 0, kcal: 110 } },
    { id: 'eggs', name: '蛋类', icon: '🥚', category: '肉蛋类', nutrition: { protein: 13, fat: 11, carb: 1, kcal: 150 } },
    { id: 'milk', name: '牛奶、酸奶', icon: '🥛', category: '肉蛋类', nutrition: { protein: 3, fat: 3, carb: 5, kcal: 60 } },
    { id: 'tofu', name: '豆制品（豆浆、豆腐、豆腐脑、豆腐干、豆腐丝等）', icon: '🧈', category: '肉蛋类', nutrition: { protein: 8, fat: 4, carb: 3, kcal: 80 } },
    // 蔬果类
    { id: 'green_veg', name: '绿叶蔬菜', icon: '🥬', category: '蔬果类', nutrition: { protein: 2, fat: 0.3, carb: 3, kcal: 22 } },
    { id: 'fruit', name: '新鲜水果', icon: '🍎', category: '蔬果类', nutrition: { protein: 0.5, fat: 0.2, carb: 12, kcal: 50 } },
    { id: 'nuts', name: '坚果', icon: '🥜', category: '蔬果类', nutrition: { protein: 15, fat: 50, carb: 20, kcal: 580 } },
    // 其他
    { id: 'alcohol', name: '酒类（白酒、红酒、啤酒）', icon: '🍺', category: '其他', nutrition: { protein: 0.5, fat: 0, carb: 3, kcal: 30 } },
];

// 其他饮食习惯 - 同样有进食频率（与图片一致）
const OTHER_HABITS_ITEMS = [
    { id: 'eat_out', name: '在外就餐', icon: '🏪' },
    { id: 'pickled', name: '吃咸菜', icon: '🥒' },
    { id: 'sweets', name: '吃甜食（蛋糕、冰激凌、雪糕、糖果、话梅、果脯、蜜饯、各种无糖食品等）', icon: '🍰' },
    { id: 'processed_food', name: '吃加工食品（方便面、火腿肠、香肠、罐头、肉松、肉干等）', icon: '🥫' },
    { id: 'drinks', name: '喝饮料（含糖饮料、果汁饮料、咖啡等）', icon: '🥤' },
    { id: 'fried_food', name: '吃油炸食品', icon: '🍟' },
    { id: 'spicy', name: '吃辛辣食品', icon: '🌶️' },
    { id: 'gai_fan', name: '吃盖浇饭', icon: '🍛' },
    { id: 'soup', name: '喝汤（肉汤、面汤）', icon: '🥣' },
    { id: 'sea_product', name: '吃海产品（紫菜、海带、深海鱼等）', icon: '🦐' },
    { id: 'fast_food', name: '吃洋快餐（麦当劳、肯德基、星巴克等）', icon: '🍔' },
];

// 口味程度选项（图片中的"口味是否偏重？"）
const TASTE_LEVELS = [
    { value: 'none', label: '不' },
    { value: 'mild', label: '适中' },
    { value: 'heavy', label: '较重' },
    { value: 'very_heavy', label: '非常重' },
];
