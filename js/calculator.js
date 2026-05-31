/**
 * 核心营养计算公式
 * 纯数学函数，无 UI 依赖
 */

// ============================================
// BMI / 体重计算
// ============================================

/**
 * 计算BMI
 * @param {number} heightCm - 身高（厘米）
 * @param {number} weightKg - 体重（公斤）
 * @returns {number} BMI值
 */
function calculateBMI(heightCm, weightKg) {
    const heightM = heightCm / 100;
    return weightKg / (heightM * heightM);
}

/**
 * 获取BMI状态
 * @param {number} bmi
 * @returns {object} {status, label, className}
 */
function getBMIStatus(bmi) {
    if (bmi < 18.5) return { status: '偏瘦', label: 'BMI', className: 'underweight' };
    if (bmi < 24) return { status: '正常', label: 'BMI', className: 'normal' };
    if (bmi < 28) return { status: '超重', label: 'BMI', className: 'overweight' };
    return { status: '肥胖', label: 'BMI', className: 'obese' };
}

/**
 * 计算标准体重（GX方法）
 * 无论男女均用此公式
 * @param {number} heightCm - 身高（厘米）
 * @returns {number} 标准体重(kg)
 */
function calculateStdWeight(heightCm) {
    return heightCm - 105;
}

/**
 * 计算调节体重（BMI≥28时使用）
 * @param {number} realWeightKg - 真实体重
 * @param {number} stdWeight - 标准体重
 * @returns {number} 调节体重(kg)
 */
function calculateAdjustedWeight(realWeightKg, stdWeight) {
    return (realWeightKg + stdWeight) / 2;
}

// ============================================
// 年龄 / 能量系数
// ============================================

/**
 * 计算年龄系数（50岁起每10年降0.1，最低0.4）
 * 50岁=0.9, 60岁=0.8, 70岁=0.7, 80岁=0.6, 90岁=0.5, 100岁=0.4
 * @param {number} age - 年龄（岁）
 * @returns {number} 年龄系数
 */
function calculateAgeFactor(age) {
    if (age < 50) return 1.0;
    const decades = Math.ceil((age - 49) / 10);
    return Math.max(0.4, 1.0 - decades * 0.1);
}

/**
 * 获取能量系数（按体力活动量）
 * 对应GX方法标准：卧床25 / 轻体力30 / 中体力35 / 重体力40 (kcal/kg)
 * @param {number} activityMultiplier - 活动系数（对应select值）
 * @returns {number} 能量系数(kcal/kg)
 */
function getEnergyCoefficient(activityMultiplier) {
    if (activityMultiplier <= 1.2) return 25;
    if (activityMultiplier <= 1.375) return 30;
    if (activityMultiplier <= 1.55) return 35;
    return 40;
}

// ============================================
// TDEE 计算（GX方法）
// ============================================

/**
 * 计算每日总能量（GX方法）
 * @param {number} heightCm - 身高（厘米）
 * @param {number} weightKg - 体重（公斤）
 * @param {number} age - 年龄（岁）
 * @param {number} activityMultiplier - 活动系数
 * @returns {object} { tdee, stdWeight, targetWeight, bmi, ageFactor, energyCoeff, calcDetail }
 */
function calculateTDEE_XiaMeng(heightCm, weightKg, age, activityMultiplier) {
    const stdWeight = calculateStdWeight(heightCm);
    const bmi = calculateBMI(heightCm, weightKg);
    const ageFactor = calculateAgeFactor(age);
    const energyCoeff = getEnergyCoefficient(activityMultiplier);

    let targetWeight;
    let weightType;
    if (bmi >= 28) {
        targetWeight = calculateAdjustedWeight(weightKg, stdWeight);
        weightType = '调节体重';
    } else {
        targetWeight = stdWeight;
        weightType = '标准体重';
    }

    const tdee = targetWeight * energyCoeff * ageFactor;

    return {
        tdee: Math.round(tdee),
        stdWeight,
        targetWeight: Math.round(targetWeight * 10) / 10,
        weightType,
        bmi: Math.round(bmi * 10) / 10,
        ageFactor,
        energyCoeff,
    };
}

// ============================================
// BMR / TDEE（Mifflin-St Jeor，保留作对比）
// ============================================

/**
 * 计算基础代谢率（BMR）
 * @param {string} gender - 'male' 或 'female'
 * @param {number} age - 年龄（岁）
 * @param {number} heightCm - 身高（厘米）
 * @param {number} weightKg - 体重（公斤）
 * @returns {number} BMR (kcal/天)
 */
function calculateBMR(gender, age, heightCm, weightKg) {
    if (gender === 'male') {
        return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
    } else {
        return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
    }
}

/**
 * 计算每日总消耗（TDEE）
 * @param {number} bmr - 基础代谢率
 * @param {number} activityMultiplier - 活动系数
 * @returns {number} TDEE (kcal/天)
 */
function calculateTDEE(bmr, activityMultiplier) {
    return Math.round(bmr * activityMultiplier);
}

// ============================================
// 每日营养目标
// ============================================

/**
 * 计算每日营养目标（克数和卡路里）
 * 已考虑食物动力效应：蛋白质吸收率70%，碳水/脂肪吸收率95%
 * @param {number} tdee - 每日总消耗
 * @param {object} [customRatio] - 自定义比例，默认 { protein:15, fat:30, carb:55 }
 * @returns {object} {protein, fat, carb} 各含{g, kcal, g_actual, kcal_actual}
 */
function calculateDailyMacros(tdee, customRatio) {
    const ratio = customRatio || { protein: 15, fat: 30, carb: 55 };

    const protein_kcal = Math.round(tdee * ratio.protein / 100);
    const fat_kcal     = Math.round(tdee * ratio.fat    / 100);
    const carb_kcal    = Math.round(tdee * ratio.carb   / 100);

    const PROTEIN_ABSORPTION = 0.70;
    const CARB_FAT_ABSORPTION = 0.95;

    return {
        protein: {
            percent:      ratio.protein,
            kcal:          protein_kcal,
            grams:         Math.round(protein_kcal / 4),
            kcal_actual:   Math.round(protein_kcal * PROTEIN_ABSORPTION),
            grams_actual:  Math.round(protein_kcal * PROTEIN_ABSORPTION / 4),
        },
        fat: {
            percent:      ratio.fat,
            kcal:          fat_kcal,
            grams:         Math.round(fat_kcal / 9),
            kcal_actual:   Math.round(fat_kcal * CARB_FAT_ABSORPTION),
            grams_actual:  Math.round(fat_kcal * CARB_FAT_ABSORPTION / 9),
        },
        carb: {
            percent:      ratio.carb,
            kcal:          carb_kcal,
            grams:         Math.round(carb_kcal / 4),
            kcal_actual:   Math.round(carb_kcal * CARB_FAT_ABSORPTION),
            grams_actual:  Math.round(carb_kcal * CARB_FAT_ABSORPTION / 4),
        },
        tef_note: {
            protein: '蛋白质动力效应=30%，实际吸收70%',
            carb:     '碳水动力效应=5%，实际吸收95%',
            fat:      '脂肪动力效应=5%，实际吸收95%',
        }
    };
}

// ============================================
// 食物换算
// ============================================

/**
 * 计算食物换算（根据营养素克数推荐食物）
 * @param {number} proteinGrams - 蛋白质克数
 * @param {number} fatGrams - 脂肪克数
 * @param {number} carbGrams - 碳水克数
 * @returns {object} {proteinSources, fatSources, carbSources}
 */
function calculateFoodExchange(proteinGrams, fatGrams, carbGrams) {
    return {
        proteinSources: [
            { icon: '🥩', name: '瘦肉（猪/牛/羊）', grams: Math.round(proteinGrams * 2) },
            { icon: '🐟', name: '鱼肉', grams: Math.round(proteinGrams * 1.5) },
            { icon: '🥚', name: '鸡蛋', grams: Math.round(proteinGrams * 1.2) },
            { icon: '🦐', name: '虾/贝类', grams: Math.round(proteinGrams * 1.8) },
        ],
        fatSources: [
            { icon: '🥑', name: '牛油果', grams: Math.round(fatGrams * 1.5) },
            { icon: '🫒', name: '橄榄油', grams: Math.round(fatGrams * 1.1) },
            { icon: '🥜', name: '坚果', grams: Math.round(fatGrams * 0.6) },
            { icon: '🐟', name: '深海鱼', grams: Math.round(fatGrams * 1.2) },
        ],
        carbSources: [
            { icon: '🥬', name: '绿叶蔬菜', grams: Math.round(carbGrams * 5) },
            { icon: '🥦', name: '西兰花', grams: Math.round(carbGrams * 3) },
            { icon: '🍄', name: '菌菇类', grams: Math.round(carbGrams * 2.5) },
            { icon: '🍚', name: '糙米/杂粮', grams: Math.round(carbGrams * 1.2) },
        ],
    };
}

// ============================================
// Omega 脂肪酸比例
// ============================================

/**
 * 获取Omega-6:Omega-3比例分析
 * @param {number} omega3 - omega-3含量(mg)
 * @param {number} omega6 - omega-6含量(mg)
 * @returns {object} {className, text, suggestion}
 */
function getOmegaRatioInfo(omega3, omega6) {
    if (!omega3 || !omega6 || omega3 === 0) {
        return {
            className: 'ratio-warning',
            text: '—',
            suggestion: '建议增加omega-3来源（深海鱼/亚麻籽油）'
        };
    }

    const ratio = omega6 / omega3;

    if (ratio >= 4 && ratio <= 6) {
        return {
            className: 'ratio-good',
            text: `1:${ratio.toFixed(1)}`,
            suggestion: '✓ 比例理想'
        };
    } else if (ratio > 6) {
        return {
            className: 'ratio-warning',
            text: `1:${ratio.toFixed(1)}`,
            suggestion: '⚠️ omega-6偏高，减少植物油，增加深海鱼'
        };
    } else {
        return {
            className: 'ratio-good',
            text: `1:${ratio.toFixed(1)}`,
            suggestion: '✓ omega-3充足，注意总脂肪摄入'
        };
    }
}

// ============================================
// 辅助工具
// ============================================

/**
 * 根据年龄获取年龄段分组
 */
function getAgeGroup(age) {
    if (age < 1) return '0岁~';
    if (age < 4) return '1岁~';
    if (age < 7) return '4岁~';
    if (age < 11) return '7岁~';
    if (age < 14) return '11岁~';
    if (age < 18) return '14岁~';
    if (age < 50) return '18岁~';
    if (age < 65) return '50岁~';
    if (age < 80) return '65岁~';
    return '80岁~';
}

/** 性别映射 */
function getGenderLabel(gender) {
    return gender === 'male' ? '男' : '女';
}
