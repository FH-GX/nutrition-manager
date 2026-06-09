/**
 * Supabase Edge Function API 调用模块
 * 封装对 calculate-adult / calculate-child / calculate-meal-plan 的 HTTP 调用
 * 所有核心公式在云端执行，前端只传参数
 */
const FUNCTIONS_BASE = 'https://thgcjxnvsantzrdyqcug.supabase.co/functions/v1';

/**
 * 获取当前登录用户的 JWT token
 * @returns {Promise<string|null>}
 */
async function getAuthToken() {
    try {
        const sb = getSupabase();
        if (!sb) return null;
        const { data: { session } } = await sb.auth.getSession();
        return session?.access_token || null;
    } catch {
        return null;
    }
}

/**
 * 通用 API 调用
 * @param {string} functionName - Edge Function 名称
 * @param {object} payload - POST 请求体
 * @param {number} [retries=1] - 重试次数
 * @returns {Promise<object>} { success, data, error }
 */
async function callFunction(functionName, payload, retries = 1) {
    const token = await getAuthToken();
    if (!token) {
        return { success: false, error: '未登录或会话已过期' };
    }

    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetch(`${FUNCTIONS_BASE}/${functionName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok) {
                lastError = data.error || data.message || `请求失败 (${res.status})`;
                continue;
            }

            return { success: true, data };
        } catch (err) {
            lastError = err.message || '网络错误';
            if (attempt < retries) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }

    return { success: false, error: lastError };
}

/**
 * 成人营养计算
 * @param {object} params
 * @param {number} params.height - 身高(cm)
 * @param {number} params.weight - 体重(kg)
 * @param {number} params.age - 年龄
 * @param {number} params.activity - 活动系数（如 1.55）
 * @param {object} params.tier - 营养配比 { carbPct, proteinPct, fatPct }
 * @returns {Promise<object>} { tdee, bmi, stdWeight, targetWeight, macros, calcDetail }
 */
async function apiCalculateAdult(params) {
    return callFunction('calculate-adult', params);
}

/**
 * 儿童营养计算
 * @param {object} params
 * @param {number} params.age - 年龄
 * @param {'male'|'female'} params.gender - 性别
 * @param {number} params.weight - 体重(kg)（2-5岁必需）
 * @param {boolean} [params.advancedMode=false] - 进阶模式
 * @param {number} [params.carbPct] - 进阶模式自定义碳水%
 * @returns {Promise<object>}
 */
async function apiCalculateChild(params) {
    return callFunction('calculate-child', params);
}

/**
 * 分餐方案计算
 * @param {object} params
 * @param {object} params.macros - { protein: { grams }, fat: { grams }, carb: { grams } }
 * @param {string} params.date - 日期 "YYYY-MM-DD"
 * @returns {Promise<object>} { meals, oilSelection, nutSelection, fatSources, omegaRatio }
 */
async function apiCalculateMealPlan(params) {
    return callFunction('calculate-meal-plan', params);
}
