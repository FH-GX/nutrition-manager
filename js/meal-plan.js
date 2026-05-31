/**
 * 分餐方案模块 - meal-plan.js
 * 根据每日营养素目标生成四餐具体食物建议
 * 
 * 分餐比例：早餐 25% / 午餐 35% / 加餐 10% / 晚餐 30%
 * 食物轮换：7天一周期，基于日期种子
 * 计算方法：先固定配菜（蛋奶肉菜果坚果油），再用主食补齐剩余碳水缺口
 * 
 * 核心逻辑：
 * 1. 从 FOOD_DATABASE 获取食物营养数据（每100g碳水含量）
 * 2. 配菜固定份量，算出贡献的碳水
 * 3. 剩余碳水 = 目标碳水 - 配菜碳水
 * 4. 按餐次比例分配到早午晚三餐（零食已用水果坚果满足，不另配主食）
 * 5. 反推每餐主食克数 = 剩余碳水 ÷ 主食碳水含量(/100g) × 100
 */

// ============================================
// 分餐比例
// ============================================
const MEAL_RATIOS = {
    breakfast: 0.25,
    lunch: 0.35,
    snack: 0.10,
    dinner: 0.30
};

// ============================================
// 从FOOD_DATABASE查找食物营养数据
// ============================================
function findFoodNutrition(name) {
    if (typeof FOOD_DATABASE === 'undefined') return null;
    
    // 精确匹配名称
    let food = FOOD_DATABASE.find(f => f.name === name);
    if (food) return food;
    
    // 模糊匹配别名
    food = FOOD_DATABASE.find(f => f.aliases && f.aliases.some(a => a === name));
    if (food) return food;
    
    // 包含匹配
    food = FOOD_DATABASE.find(f => f.name.includes(name) || (f.aliases && f.aliases.some(a => a.includes(name))));
    if (food) return food;
    
    return null;
}

// ============================================
// 7天食物轮换池（只存食物名，运行时查FOOD_DATABASE获取营养数据）
// ============================================
const FOOD_ROTATION = {
    // 早餐主食（低碳水友好，碳水密度适中）
    breakfastGrain: [
        '全麦面包',      // GI:50, 碳水46.1g/100g
        '燕麦粥（熟）',   // GI:50, 碳水19.2g/100g
        '甘薯（红薯）',   // GI:54, 碳水23.1g/100g
        '全麦面包',
        '玉米（鲜）',     // GI:55, 碳水22.8g/100g
        '荞麦面条（熟）',  // GI:59, 碳水23.5g/100g
        '燕麦粥（熟）'    // 重复但不同天
    ],
    // 早餐蛋白质（固定）
    breakfastProtein: [
        { name: '鸡蛋（整）', grams: 100, detail: '2个' },
        { name: '牛奶', grams: 200, detail: '1杯' }
    ],
    // 午餐主食（杂粮/低GI）
    lunchGrain: [
        '糙米饭（熟）',    // GI:55, 碳水26.1g/100g
        '黑米饭（熟）',    // GI:55, 碳水25.8g/100g
        '荞麦面条（熟）',  // GI:59, 碳水23.5g/100g
        '藜麦饭（熟）',    // GI:35, 碳水21.3g/100g
        '糙米饭（熟）',
        '荞麦面条（熟）',
        '黑米饭（熟）'
    ],
    // 午餐蛋白质
    lunchProtein: [
        '鸡胸肉',
        '牛肉（瘦肉）',
        '豆腐（北豆腐）',
        '虾（河虾）',
        '猪肉（瘦肉）',
        '鸡腿肉',
        '三文鱼'
    ],
    // 午餐蔬菜
    lunchVeggie: [
        '菠菜',
        '西蓝花',
        '空心菜',
        '菜心',
        '芦笋',
        '娃娃菜',
        '油麦菜'
    ],
    // 加餐水果
    snackFruit: [
        '苹果',
        '橙子',
        '猕猴桃',
        '梨',
        '蓝莓',
        '草莓',
        '火龙果'
    ],
    // 加餐坚果（日期哈希按比例轮换，在generateMealPlan中用pickByRatio选择）
    // 晚餐主食（根茎类/杂粮，碳水密度适中）
    dinnerGrain: [
        '山药',         // 碳水12.4g/100g
        '紫薯（生）',    // 碳水20.1g/100g
        '黑米饭（熟）',  // 碳水25.8g/100g
        '芋头',         // 碳水18.1g/100g
        '马铃薯（土豆）', // 碳水16.5g/100g
        '玉米（鲜）',    // 碳水22.8g/100g
        '甘薯（红薯）'   // 碳水23.1g/100g
    ],
    // 晚餐蛋白质
    dinnerProtein: [
        '清蒸鱼',
        '豆腐（北豆腐）',
        '三文鱼',
        '鸡胸肉',
        '虾（河虾）',
        '豆腐（北豆腐）',
        '草鱼'
    ],
    // 晚餐蔬菜
    dinnerVeggie: [
        '西蓝花',
        '油菜（小青菜）',
        '秋葵',
        '冬瓜',
        '豆角',
        '芹菜',
        '娃娃菜'
    ]
};

// ============================================
// 固定份量配置
// ============================================
const FIXED_PORTIONS = {
    egg: { grams: 100, fallbackCarb: 1.2, fallbackFat: 8.8, fallbackProtein: 13.3 },
    milk: { grams: 200, fallbackCarb: 6.8, fallbackFat: 3.2, fallbackProtein: 3.0 },
    lunchProtein: { grams: 150, fallbackCarb: 0, fallbackFat: 5.0, fallbackProtein: 20.0 },
    lunchVeggie: { grams: 200, fallbackCarb: 5.0, fallbackFat: 0.2, fallbackProtein: 1.5 },
    snackFruit: { grams: 150, fallbackCarb: 15.0, fallbackFat: 0.3, fallbackProtein: 0.5 },
    snackNuts: { grams: 20, fallbackCarb: 1.3, fallbackFat: 11.0, fallbackProtein: 2.5 },
    dinnerProtein: { grams: 120, fallbackCarb: 0, fallbackFat: 4.0, fallbackProtein: 18.0 },
    dinnerVeggie: { grams: 200, fallbackCarb: 5.0, fallbackFat: 0.2, fallbackProtein: 1.5 },
    breakfastOil: { grams: 5, fallbackFat: 5.0 },   // 早餐用油（煎蛋/拌燕麦）
    lunchOil: { grams: 10, fallbackFat: 10.0 },     // 午餐烹调油
    dinnerOil: { grams: 10, fallbackFat: 10.0 }     // 晚餐烹调油
};

// ============================================
// 坚果轮换池（按比例，日期哈希选择）
// ============================================
const NUT_ITEMS = [
    { value: '核桃', ratio: 45 },
    { value: '杏仁', ratio: 15 },
    { value: '花生', ratio: 20 },
    { value: '瓜子（葵花子）', ratio: 20 }
];

// ============================================
// 油品轮换池（按比例，日期哈希选择）
// ============================================
const OIL_ITEMS = [
    { value: '菜籽油', ratio: 60 },
    { value: '橄榄油', ratio: 20 },
    { value: '猪油', ratio: 20 }
];

// ============================================
// 日期哈希（确定性，无固定周期，同一天结果一致）
// ============================================
function hashDate() {
    const now = new Date();
    const d = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    const s = String(d);
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h) + s.charCodeAt(i);
        h = h & h;
    }
    return Math.abs(h);
}

// 按比例选择（传入 items = [{value, ratio}], 按比例区间确定性选择）
function pickByRatio(items, seed) {
    const total = items.reduce((s, item) => s + item.ratio, 0);
    const r = (seed % 100) + 1; // 1-100
    let cumulative = 0;
    for (const item of items) {
        cumulative += (item.ratio / total) * 100;
        if (r <= cumulative) return item.value;
    }
    return items[items.length - 1].value;
}

// 获取今日轮换索引（0-6，兼容旧食物轮换池）
function getDaySeed() {
    return hashDate() % 7;
}

// ============================================
// 从食物对象获取营养素（带fallback）
// ============================================
function getNutrient(food, grams, nutrient, fallback) {
    if (!food || !food.per100g || food.per100g[nutrient] === undefined) {
        return fallback || 0;
    }
    return food.per100g[nutrient] / 100 * grams;
}

// ============================================
// 按餐次拆分每日营养素目标
// ============================================
function splitMacrosByMeal(macros) {
    const result = {};
    for (const [meal, ratio] of Object.entries(MEAL_RATIOS)) {
        result[meal] = {
            protein: Math.round(macros.protein.grams_actual * ratio),
            carb: Math.round(macros.carb.grams_actual * ratio),
            fat: Math.round(macros.fat.grams_actual * ratio),
            kcal: Math.round(
                macros.protein.grams_actual * 4 * ratio +
                macros.carb.grams_actual * 4 * ratio +
                macros.fat.grams_actual * 9 * ratio
            ),
            percent: Math.round(ratio * 100)
        };
    }
    return result;
}

// ============================================
// 生成当日分餐方案（核心：动态计算克数）
// ============================================
function generateMealPlan(macros) {
    const daySeed = getDaySeed();
    const mealMacros = splitMacrosByMeal(macros);
    const totalCarbTarget = macros.carb.grams_actual;
    const totalFatTarget = macros.fat.grams_actual;
    const totalProteinTarget = macros.protein.grams_actual;
    
    // ===== 步骤1b：选择今日坚果 & 烹调油（日期哈希）=====
    const todayNutName = pickByRatio(NUT_ITEMS, hashDate());
    const todayOilName = pickByRatio(OIL_ITEMS, hashDate() + 7); // +7偏移，避免与坚果相同

    const todayFoods = {
        egg: findFoodNutrition('鸡蛋（整）'),
        milk: findFoodNutrition('牛奶'),
        lunchProtein: findFoodNutrition(FOOD_ROTATION.lunchProtein[daySeed]),
        lunchVeggie: findFoodNutrition(FOOD_ROTATION.lunchVeggie[daySeed]),
        snackFruit: findFoodNutrition(FOOD_ROTATION.snackFruit[daySeed]),
        snackNuts: findFoodNutrition(todayNutName),
        dinnerProtein: findFoodNutrition(FOOD_ROTATION.dinnerProtein[daySeed]),
        dinnerVeggie: findFoodNutrition(FOOD_ROTATION.dinnerVeggie[daySeed]),
        breakfastGrain: findFoodNutrition(FOOD_ROTATION.breakfastGrain[daySeed]),
        lunchGrain: findFoodNutrition(FOOD_ROTATION.lunchGrain[daySeed]),
        dinnerGrain: findFoodNutrition(FOOD_ROTATION.dinnerGrain[daySeed])
    };
    
    // ===== 步骤2：计算固定配菜贡献的碳水 =====
    const sideCarbs = {
        egg: getNutrient(todayFoods.egg, FIXED_PORTIONS.egg.grams, 'carbs', FIXED_PORTIONS.egg.fallbackCarb),
        milk: getNutrient(todayFoods.milk, FIXED_PORTIONS.milk.grams, 'carbs', FIXED_PORTIONS.milk.fallbackCarb),
        lunchProtein: getNutrient(todayFoods.lunchProtein, FIXED_PORTIONS.lunchProtein.grams, 'carbs', FIXED_PORTIONS.lunchProtein.fallbackCarb),
        lunchVeggie: getNutrient(todayFoods.lunchVeggie, FIXED_PORTIONS.lunchVeggie.grams, 'carbs', FIXED_PORTIONS.lunchVeggie.fallbackCarb),
        snackFruit: getNutrient(todayFoods.snackFruit, FIXED_PORTIONS.snackFruit.grams, 'carbs', FIXED_PORTIONS.snackFruit.fallbackCarb),
        snackNuts: getNutrient(todayFoods.snackNuts, FIXED_PORTIONS.snackNuts.grams, 'carbs', FIXED_PORTIONS.snackNuts.fallbackCarb),
        dinnerProtein: getNutrient(todayFoods.dinnerProtein, FIXED_PORTIONS.dinnerProtein.grams, 'carbs', FIXED_PORTIONS.dinnerProtein.fallbackCarb),
        dinnerVeggie: getNutrient(todayFoods.dinnerVeggie, FIXED_PORTIONS.dinnerVeggie.grams, 'carbs', FIXED_PORTIONS.dinnerVeggie.fallbackCarb)
    };
    
    const sideCarbTotal = Object.values(sideCarbs).reduce((a, b) => a + b, 0);
    const remainingCarb = Math.max(0, totalCarbTarget - sideCarbTotal);
    
    // ===== 步骤3：分配剩余碳水到三餐（零食已由水果坚果满足，不配主食） =====
    // 早午晚三餐占全天90%，所以各自比例要除以0.9
    const grainMealRatio = {
        breakfast: MEAL_RATIOS.breakfast / (MEAL_RATIOS.breakfast + MEAL_RATIOS.lunch + MEAL_RATIOS.dinner),
        lunch: MEAL_RATIOS.lunch / (MEAL_RATIOS.breakfast + MEAL_RATIOS.lunch + MEAL_RATIOS.dinner),
        dinner: MEAL_RATIOS.dinner / (MEAL_RATIOS.breakfast + MEAL_RATIOS.lunch + MEAL_RATIOS.dinner)
    };
    
    const breakfastCarbNeed = remainingCarb * grainMealRatio.breakfast;
    const lunchCarbNeed = remainingCarb * grainMealRatio.lunch;
    const dinnerCarbNeed = remainingCarb * grainMealRatio.dinner;
    
    // ===== 步骤4：反推每餐主食克数 =====
    function calcGrainGrams(food, carbTarget) {
        if (!food || !food.per100g || food.per100g.carbs <= 0) {
            return Math.round(carbTarget / 25 * 100);
        }
        return Math.round(carbTarget / (food.per100g.carbs / 100));
    }
    
    const breakfastGrainGrams = calcGrainGrams(todayFoods.breakfastGrain, breakfastCarbNeed);
    const lunchGrainGrams = calcGrainGrams(todayFoods.lunchGrain, lunchCarbNeed);
    const dinnerGrainGrams = calcGrainGrams(todayFoods.dinnerGrain, dinnerCarbNeed);
    
    // ===== 步骤5：计算脂肪来源分布 & 动态调整烹调油 =====
    function classifyFoodFat(food, grams) {
        if (!food || !food.per100g || grams <= 0) return { animal: 0, plant: 0 };
        const fatGrams = (food.per100g.fat || 0) / 100 * grams;
        // 胆固醇 > 0 → 动物脂肪；胆固醇 = 0 → 植物脂肪
        const isAnimal = food.per100g.cholesterol > 0;
        return {
            animal: isAnimal ? fatGrams : 0,
            plant: isAnimal ? 0 : fatGrams
        };
    }

    // 5a：计算所有非油食物的脂肪（动/植物分类）
    const nonOilFats = [
        classifyFoodFat(todayFoods.egg, FIXED_PORTIONS.egg.grams),
        classifyFoodFat(todayFoods.milk, FIXED_PORTIONS.milk.grams),
        classifyFoodFat(todayFoods.lunchProtein, FIXED_PORTIONS.lunchProtein.grams),
        classifyFoodFat(todayFoods.lunchVeggie, FIXED_PORTIONS.lunchVeggie.grams),
        classifyFoodFat(todayFoods.snackFruit, FIXED_PORTIONS.snackFruit.grams),
        classifyFoodFat(todayFoods.snackNuts, FIXED_PORTIONS.snackNuts.grams),
        classifyFoodFat(todayFoods.dinnerProtein, FIXED_PORTIONS.dinnerProtein.grams),
        classifyFoodFat(todayFoods.dinnerVeggie, FIXED_PORTIONS.dinnerVeggie.grams),
        classifyFoodFat(todayFoods.breakfastGrain, breakfastGrainGrams),
        classifyFoodFat(todayFoods.lunchGrain, lunchGrainGrams),
        classifyFoodFat(todayFoods.dinnerGrain, dinnerGrainGrams)
    ];
    const nonOilAnimalFat = nonOilFats.reduce((s, f) => s + f.animal, 0);
    const nonOilPlantFat = nonOilFats.reduce((s, f) => s + f.plant, 0);
    const nonOilTotalFat = nonOilAnimalFat + nonOilPlantFat;

    // 5b：剩余脂肪由烹调油补齐
    const remainingFatForOil = Math.max(0, Math.round(totalFatTarget - nonOilTotalFat));

    // 5c：早餐油由日期哈希决定（~60%给5g煎蛋，~40%给0g水煮蛋），剩余午晚1:1
    const hasBreakfastOil = hashDate() % 10 < 6; // 60%概率给油
    const breakfastOilGrams = hasBreakfastOil ? Math.min(5, remainingFatForOil) : 0;
    const remainingAfterBreakfast = remainingFatForOil - breakfastOilGrams;
    const lunchOilGrams = Math.round(remainingAfterBreakfast / 2);
    const dinnerOilGrams = remainingAfterBreakfast - lunchOilGrams;
    const totalOilGrams = breakfastOilGrams + lunchOilGrams + dinnerOilGrams;

    // 5d：烹调油脂肪归植物
    const oilFood = findFoodNutrition(todayOilName);
    const oilFat = classifyFoodFat(oilFood, totalOilGrams);

    const fatSources = {
        animal: Math.round(nonOilAnimalFat + oilFat.animal),
        plant: Math.round(nonOilPlantFat + oilFat.plant),
        total: Math.round(nonOilTotalFat + oilFat.animal + oilFat.plant),
        target: Math.round(totalFatTarget)
    };
    
    // ===== 步骤6：组装结果 =====
    const breakfast = {
        macros: mealMacros.breakfast,
        foods: {
            grain: { name: FOOD_ROTATION.breakfastGrain[daySeed], grams: breakfastGrainGrams, detail: '' },
            egg: { name: '鸡蛋（整）', grams: FIXED_PORTIONS.egg.grams },
            dairy: { name: '牛奶', grams: FIXED_PORTIONS.milk.grams, detail: '1杯' },
            oil: { name: todayOilName, grams: breakfastOilGrams, detail: '' }
        }
    };
    
    const lunch = {
        macros: mealMacros.lunch,
        foods: {
            grain: { name: FOOD_ROTATION.lunchGrain[daySeed], grams: lunchGrainGrams, detail: '' },
            protein: { name: FOOD_ROTATION.lunchProtein[daySeed], grams: FIXED_PORTIONS.lunchProtein.grams, detail: '' },
            veggie: { name: FOOD_ROTATION.lunchVeggie[daySeed], grams: FIXED_PORTIONS.lunchVeggie.grams, detail: '' },
            oil: { name: todayOilName, grams: lunchOilGrams, detail: '' }
        }
    };
    
    const snack = {
        macros: mealMacros.snack,
        foods: {
            fruit: { name: FOOD_ROTATION.snackFruit[daySeed], grams: FIXED_PORTIONS.snackFruit.grams, detail: '' },
            nuts: { name: todayNutName, grams: FIXED_PORTIONS.snackNuts.grams, detail: '' }
        }
    };
    
    const dinner = {
        macros: mealMacros.dinner,
        foods: {
            grain: { name: FOOD_ROTATION.dinnerGrain[daySeed], grams: dinnerGrainGrams, detail: '' },
            protein: { name: FOOD_ROTATION.dinnerProtein[daySeed], grams: FIXED_PORTIONS.dinnerProtein.grams, detail: '' },
            veggie: { name: FOOD_ROTATION.dinnerVeggie[daySeed], grams: FIXED_PORTIONS.dinnerVeggie.grams, detail: '' },
            oil: { name: todayOilName, grams: dinnerOilGrams, detail: '' }
        }
    };
    
    // 计算总计
    const totals = calculateTotals(breakfast, lunch, snack, dinner);
    
    return { breakfast, lunch, snack, dinner, totals, macros, mealMacros, fatSources, sideCarbTotal, remainingCarb };
}

// ============================================
// 计算各类别总克数
// ============================================
function calculateTotals(breakfast, lunch, snack, dinner) {
    let grainTotal = 0;
    let fruitTotal = 0;
    let veggieTotal = 0;
    let eggGrams = 0;
    let dairyGrams = 0;
    let meatTotal = 0;
    let nutTotal = 0;
    let oilTotal = 0;
    
    // 早餐
    if (breakfast.foods.grain) grainTotal += breakfast.foods.grain.grams || 0;
    if (breakfast.foods.egg) eggGrams += breakfast.foods.egg.grams || 0;
    if (breakfast.foods.dairy) dairyGrams += breakfast.foods.dairy.grams || 0;
    if (breakfast.foods.oil) oilTotal += breakfast.foods.oil.grams || 0;
    
    // 午餐
    if (lunch.foods.grain) grainTotal += lunch.foods.grain.grams || 0;
    if (lunch.foods.protein) meatTotal += lunch.foods.protein.grams || 0;
    if (lunch.foods.veggie) veggieTotal += lunch.foods.veggie.grams || 0;
    if (lunch.foods.oil) oilTotal += lunch.foods.oil.grams || 0;
    
    // 加餐
    if (snack.foods.fruit) fruitTotal += snack.foods.fruit.grams || 0;
    if (snack.foods.nuts) nutTotal += snack.foods.nuts.grams || 0;
    
    // 晚餐
    if (dinner.foods.grain) grainTotal += dinner.foods.grain.grams || 0;
    if (dinner.foods.protein) meatTotal += dinner.foods.protein.grams || 0;
    if (dinner.foods.veggie) veggieTotal += dinner.foods.veggie.grams || 0;
    if (dinner.foods.oil) oilTotal += dinner.foods.oil.grams || 0;
    
    return { grainTotal, fruitTotal, veggieTotal, eggGrams, dairyGrams, meatTotal, nutTotal, oilTotal };
}

// ============================================
// 渲染分餐表格
// ============================================
function renderMealPlanTable(plan) {
    if (!plan) return '<p class="mp-empty-msg">请先计算营养方案</p>';
    
    const { breakfast, lunch, snack, dinner, totals, macros, mealMacros, fatSources, sideCarbTotal, remainingCarb } = plan;
    
    // 获取周几标签
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayLabel = `${y}年${m}月${d}日 ${weekDays[now.getDay()]}`;
    
    const tdeeKcal = macros.protein.kcal + macros.fat.kcal + macros.carb.kcal;
    
    // 格式化食物显示：名称 (克数g)
    function fmtFood(name, grams, detail) {
        if (!name || grams <= 0) return '<span class="mp-dash">—</span>';
        let text = name;
        if (detail) text = name + ' ' + detail;
        text += ' (' + grams + 'g)';
        return text;
    }
    
    // ========== 构建表格数据 ==========
    const headers = ['粮谷类', '水果', '蔬菜', '鸡蛋', '牛奶/酸奶', '肉/海鲜/豆类', '坚果', '食用油'];
    
    // 早餐蛋用油判定（与generateMealPlan中逻辑一致）
    const hasBreakfastOil = hashDate() % 10 < 6;
    
    // 早餐行
    const breakfastItems = [
        fmtFood(breakfast.foods.grain?.name, breakfast.foods.grain?.grams, ''),
        '—',
        '—',
        hasBreakfastOil
            ? fmtFood('煎鸡蛋', 50, '1个') + '<br>' + fmtFood('水煮蛋', 50, '1个')
            : fmtFood('水煮蛋', breakfast.foods.egg?.grams, '2个'),
        fmtFood(breakfast.foods.dairy?.name, breakfast.foods.dairy?.grams, breakfast.foods.dairy?.detail),
        '—',
        '—',
        breakfast.foods.oil?.grams > 0 ? fmtFood(breakfast.foods.oil?.name, breakfast.foods.oil?.grams, '') : '—'
    ];
    
    // 午餐行
    const lunchItems = [
        fmtFood(lunch.foods.grain?.name, lunch.foods.grain?.grams, ''),
        '—',
        fmtFood(lunch.foods.veggie?.name, lunch.foods.veggie?.grams, ''),
        '—',
        '—',
        fmtFood(lunch.foods.protein?.name, lunch.foods.protein?.grams, ''),
        '—',
        fmtFood(lunch.foods.oil?.name, lunch.foods.oil?.grams, '')
    ];
    
    // 加餐行
    const snackItems = [
        '—',
        fmtFood(snack.foods.fruit?.name, snack.foods.fruit?.grams, ''),
        '—',
        '—',
        '—',
        '—',
        fmtFood(snack.foods.nuts?.name, snack.foods.nuts?.grams, ''),
        '—'
    ];
    
    // 晚餐行
    const dinnerItems = [
        fmtFood(dinner.foods.grain?.name, dinner.foods.grain?.grams, ''),
        '—',
        fmtFood(dinner.foods.veggie?.name, dinner.foods.veggie?.grams, ''),
        '—',
        '—',
        fmtFood(dinner.foods.protein?.name, dinner.foods.protein?.grams, ''),
        '—',
        fmtFood(dinner.foods.oil?.name, dinner.foods.oil?.grams, '')
    ];
    
    // 总计行
    const totalItems = [
        totals.grainTotal > 0 ? '<strong>' + totals.grainTotal + 'g</strong>' : '—',
        totals.fruitTotal > 0 ? '<strong>' + totals.fruitTotal + 'g</strong>' : '—',
        totals.veggieTotal > 0 ? '<strong>' + totals.veggieTotal + 'g</strong>' : '—',
        totals.eggGrams > 0 ? '<strong>' + totals.eggGrams + 'g</strong>' : '—',
        totals.dairyGrams > 0 ? '<strong>' + totals.dairyGrams + 'ml</strong>' : '—',
        totals.meatTotal > 0 ? '<strong>' + totals.meatTotal + 'g</strong>' : '—',
        totals.nutTotal > 0 ? '<strong>' + totals.nutTotal + 'g</strong>' : '—',
        totals.oilTotal > 0 ? '<strong>' + totals.oilTotal + 'g</strong>' : '—'
    ];
    
    // 行数据
    const rows = [
        { label: '早餐', percent: '25%', items: breakfastItems },
        { label: '午餐', percent: '35%', items: lunchItems },
        { label: '加餐', percent: '10%', items: snackItems },
        { label: '晚餐', percent: '30%', items: dinnerItems }
    ];
    
    // 构建HTML
    let html = `
    <h3 class="mp-section-title">🥗 今日分餐建议 <span class="mp-subtitle">${todayLabel}</span></h3>
    <table class="meal-plan-table">
        <thead>
            <tr>
                <th class="meal-time-col">进餐时间</th>`;
    
    for (const h of headers) {
        html += `<th>${h}</th>`;
    }
    html += `</tr></thead><tbody>`;
    
    for (const row of rows) {
        html += `<tr>
            <td class="meal-time-cell">${row.label}<br><span class="meal-percent">${row.percent}</span></td>`;
        for (const item of row.items) {
            const isDash = item === '—';
            html += `<td class="${isDash ? 'cell-empty' : ''}">${isDash ? '—' : item}</td>`;
        }
        html += `</tr>`;
    }
    
    // 总计行
    html += `<tr class="total-row">
        <td class="meal-time-cell">总计</td>`;
    for (const t of totalItems) {
        const isDash = t === '—';
        html += `<td class="${isDash ? 'cell-empty' : ''}">${t}</td>`;
    }
    html += `</tr></tbody></table>`;
    
    // 底部营养素卡片 + 能量分配
    const pMacros = macros.protein;
    const fMacros = macros.fat;
    const cMacros = macros.carb;
    
    html += `
    <div class="meal-plan-meta">
        <span class="meta-tag"><span class="meta-dot meta-dot-protein"></span>蛋白质 ${pMacros.grams_actual}g</span>
        <span class="meta-tag"><span class="meta-dot meta-dot-fat"></span>脂肪 ${fMacros.grams_actual}g</span>
        <span class="meta-tag"><span class="meta-dot meta-dot-carb"></span>碳水 ${cMacros.grams_actual}g</span>
        <span class="meta-tag"><span class="meta-dot meta-dot-energy"></span>热量 约${tdeeKcal}kcal</span>
        <span class="meta-tag meta-tag-light">早餐 25% (~${mealMacros.breakfast.kcal}kcal)</span>
        <span class="meta-tag meta-tag-light">午餐 35% (~${mealMacros.lunch.kcal}kcal)</span>
        <span class="meta-tag meta-tag-light">加餐 10% (~${mealMacros.snack.kcal}kcal)</span>
        <span class="meta-tag meta-tag-light">晚餐 30% (~${mealMacros.dinner.kcal}kcal)</span>
    </div>`;
    
    // 脂肪来源分布（不显示动物/植物百分比）
    const fatDiff = fatSources.target - fatSources.total;
    
    html += `
    <div class="fat-source-box">
        <div class="fat-source-title">🥑 脂肪来源分布</div>
        <div class="fat-source-grid">
            <span>🥩 动物脂肪：<strong>${fatSources.animal}g</strong>（蛋/奶/肉）</span>
            <span>🌿 植物脂肪：<strong>${fatSources.plant}g</strong>（油/坚果/蔬菜/豆制品）</span>
            <span>📊 实际总计：<strong>${fatSources.total}g</strong> / 目标 ${fatSources.target}g</span>
        </div>`;
    
    if (fatDiff > 20) {
        html += `<div class="fat-warning">⚠️ 当前分餐脂肪偏低（差${fatDiff}g），建议增加坚果或选择三文鱼、牛油果等富脂食物</div>`;
    } else if (fatDiff < -20) {
        html += `<div class="fat-warning">⚠️ 当前分餐脂肪偏高（多${Math.abs(fatDiff)}g），建议减少烹调油或选择瘦肉</div>`;
    }
    
    html += `</div>`;
    
    return html;
}

// ============================================
// 导出全局函数供 app.js 调用
// ============================================
window.renderMealPlanTable = renderMealPlanTable;
window.generateMealPlan = generateMealPlan;
