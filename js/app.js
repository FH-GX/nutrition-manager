/**
 * 低碳水营养计算器 - 主逻辑
 * 基于GX低碳水营养策略
 *
 * 公式说明（GX方法）：
 * - 标准体重(kg) = 身高(cm) - 105
 * - 摄入总能量 = 目标体重 × 能量系数 × 年龄系数
 * - 目标体重：BMI<28用标准体重，BMI≥28用调节体重=（真实体重+标准体重）/2
 * - 能量系数：卧床25 / 轻体力30 / 中体力35 / 重体力40 (kcal/kg)
 * - 年龄系数：50岁起每10年降0.1，最低0.4
 */

// ============================================
// 全局状态管理（支持多用户数据隔离）
// ============================================

const MAX_USERS = 4;
let users = [{}, {}, {}, {}]; // 4个独立用户数据
let currentUser = 0;

// ============================================
// API 辅助工具（方案C：核心公式迁移至 Supabase Edge Function）
// ============================================

/**
 * 给 API 返回的 macros 加上 grams_actual / kcal_actual
 */
function enrichMacros(macros) {
    const rates = { protein: 0.7, carb: 0.95, fat: 0.95 };
    ['protein', 'fat', 'carb'].forEach(k => {
        if (macros[k]) {
            macros[k].kcal_actual = Math.round(macros[k].kcal * (rates[k] || 0.95));
            macros[k].grams_actual = Math.round(macros[k].kcal * (rates[k] || 0.95) / (k === 'fat' ? 9 : 4));
        }
    });
    return macros;
}

/**
 * 从 API 响应提取 xiaResult 格式（和原来 calculateTDEE_XiaMeng 返回结构一致）
 */
function extractXiaResult(apiData) {
    return {
        tdee: apiData.tdee,
        stdWeight: apiData.stdWeight,
        targetWeight: apiData.targetWeight,
        bmi: apiData.bmi,
        ageFactor: apiData.ageFactor,
        energyCoeff: apiData.energyCoeff,
    };
}

/**
 * 从儿童 API 响应提取 xiaResult 格式
 */
function extractChildResult(apiData) {
    return {
        tdee: apiData.energy,
        stdWeight: null,
        targetWeight: null,
        bmi: null,
        ageFactor: null,
        energyCoeff: null,
        calcDetail: apiData.energyMethod,
    };
}

/**
 * 调用云端计算（替换 calculateTDEE_XiaMeng + calculateDailyMacros 组合）
 * @param {number} height - 身高(cm)
 * @param {number} weight - 体重(kg)
 * @param {number} age - 年龄
 * @param {number} activity - 活动系数
 * @param {object} ratio - 营养比例 { carb, protein, fat }
 * @param {string} [gender] - 性别（儿童必需）
 * @returns {Promise<{xiaResult: object, macros: object}|null>} 失败返回 null
 */
async function fetchRemoteCalculation(height, weight, age, activity, ratio, gender) {
    // 儿童（<18岁）：走儿童公式，默认碳水57%，蛋白查RNI表
    if (age < 18 && gender) {
        const resp = await apiCalculateChild({
            age, gender, weight,
            advancedMode: false
        });
        if (!resp.success) {
            showToast('计算服务异常：' + (resp.error || '请稍后重试'), 'error');
            return null;
        }
        const macros = enrichMacros(resp.data.macros);
        return { xiaResult: extractChildResult(resp.data), macros };
    }

    // 成人（≥18岁）：走成人公式
    const resp = await apiCalculateAdult({
        height, weight, age, activity,
        tier: { carbPct: ratio.carb, proteinPct: ratio.protein, fatPct: ratio.fat }
    });
    if (!resp.success) {
        showToast('计算服务异常：' + (resp.error || '请稍后重试'), 'error');
        return null;
    }
    const macros = enrichMacros(resp.data.macros);
    return { xiaResult: extractXiaResult(resp.data), macros };
}

// 用户等级系统、localStorage 存储工具等已迁移至 js/storage.js
// 用户等级函数 (getUserLevel/saveUserLevel/getUserLevelInfo/getRetentionDays)
// 存储函数 (getStorageKey/saveBasicInfo/loadBasicInfo)
// 均来自 storage.js（在 index.html 中先于 app.js 加载）

// ============================================
// Supabase 同步辅助（写时自动 sync）
// ============================================

/**
 * 同步方案记录到 Supabase（只存 plan_data）
 */
async function syncMealPlanToSupabase(dateStr, plan) {
    try {
        const userId = await getCurrentAccountId();
        if (!userId) return;
        const sb = getSupabase();
        if (!sb) return;
        await sb.from('meal_plans').upsert({
            user_id: userId,
            plan_date: dateStr,
            plan_data: plan || {}
        }, { onConflict: 'user_id, plan_date' });
    } catch (e) { console.warn('syncMealPlanToSupabase失败:', e.message); }
}

/**
 * 同步打卡数据到 Supabase（存到 checkin_logs 表）
 * @param {string} dateStr
 * @param {string} status - 'checked' | 'skipped'
 * @param {object|null} actual - {energy, protein, carb, fat}
 */
async function syncCheckinToSupabase(dateStr, status, actual) {
    try {
        const userId = await getCurrentAccountId();
        if (!userId) return;
        const sb = getSupabase();
        if (!sb) return;
        await sb.from('checkin_logs').upsert({
            user_id: userId,
            log_date: dateStr,
            status: status,
            actual_data: actual || null
        }, { onConflict: 'user_id, log_date' });
    } catch (e) { console.warn('syncCheckinToSupabase失败:', e.message); }
}

/**
 * 同步负债队列到 Supabase（存为一条 singleton 记录）
 */
async function syncDebtQueueToSupabase(queue) {
    try {
        const userId = await getCurrentAccountId();
        if (!userId) return;
        const sb = getSupabase();
        if (!sb) return;
        await sb.from('energy_compensations').upsert({
            user_id: userId,
            log_date: '2000-01-01',
            queue_data: queue || []
        }, { onConflict: 'user_id, log_date' });
    } catch (e) { console.warn('syncDebtQueueToSupabase失败:', e.message); }
}

/**
 * 同步基本信息到 Supabase（user_settings 表的 basic_info 字段）
 */
/**
 * 保存基本信息 → Auth 元数据（已验证通过，与 session_token 同路）
 * user_accounts 表缺少 INSERT RLS 策略，getCurrentAccountId 会失败
 */
async function syncBasicInfoToSupabase(data) {
    try {
        const sb = getSupabase();
        if (!sb) return;
        // 主通路：Auth 元数据（不依赖自定义表 RLS）
        const token = getSessionToken(); // 保留现有 session_id
        await sb.auth.updateUser({
            data: { basic_info: data || null, session_id: token }
        });
        // 辅通路：user_settings 表（如果 user_accounts 有记录）
        const userId = await getCurrentAccountId();
        if (userId) {
            await sb.from('user_settings').upsert({
                user_id: userId,
                preferences: { basic_info: data || null }
            }, { onConflict: 'user_id' });
        }
    } catch (e) { console.warn('syncBasicInfoToSupabase失败:', e.message); }
}

/**
 * 将基本信息同步到家庭成员
 */
function syncBasicInfoToFamily(info) {
    if (!info) return;
    const members = getFamilyMembers();
    let self = members.find(m => m.relation === '本人');
    if (self) {
        updateFamilyMember(self.id, {
            name: info.name || self.name,
            gender: info.gender || self.gender,
            age: info.age || self.age,
            height: info.height || self.height,
            weight: info.weight || self.weight,
            activity: String(info.activity || '1.55'),
        });
    } else {
        addFamilyMember({
            name: info.name || getCurrentSessionUser()?.split('@')[0] || '我',
            relation: '本人',
            gender: info.gender || 'male',
            age: info.age || 30,
            height: info.height || 170,
            weight: info.weight || 65,
            activity: String(info.activity || '1.55'),
        });
    }
}

// ============================================
// 单设备登录管理（v2.2.5 改用 Auth 元数据）
// ============================================

/**
 * 将 session token 写入 Supabase Auth 用户元数据
 * 不依赖自定义表 RLS，更可靠
 */
async function updateSessionToken(token) {
    try {
        const sb = getSupabase();
        if (!sb) return;
        await sb.auth.updateUser({ data: { session_id: token } });
    } catch (e) { console.warn('updateSessionToken失败:', e.message); }
}

/**
 * 校验当前 session token 是否与 Auth 元数据一致
 * 不一致 → 弹提示并登出
 */
async function checkSessionValid() {
    const localToken = getSessionToken();
    if (!localToken) return;
    try {
        const sb = getSupabase();
        if (!sb) return;
        // refreshSession 返回最新 user，避免 getUser 缓存问题
        const { data } = await sb.auth.refreshSession();
        const metaToken = data?.user?.user_metadata?.session_id;
        if (metaToken && metaToken !== localToken) {
            showToast('⚠️ 你的账号已在其他设备登录', 'error');
            setTimeout(() => logoutUser(), 1500);
        }
    } catch (e) { /* 网络错误不处理 */ }
}

/**
 * 启动 session 监控（页面切回 + 定时校验）
 */
function initSessionMonitor() {
    // 每次登入都重新启动监控（防止 setInterval 丢失）
    if (window.__sessionInterval) clearInterval(window.__sessionInterval);
    
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            checkSessionValid();
        }
    });
    // 定时校验（每5秒，快速检测）
    window.__sessionInterval = setInterval(checkSessionValid, 5000);
}

/**
 * 从 Supabase 拉取数据覆盖本地 localStorage
 * 登录/刷新时调用，实现跨设备同步
 */
async function syncAllFromSupabase() {
    try {
        const sb = getSupabase();
        if (!sb) return;

        // 0. 优先同步基本信息（Auth 元数据，不依赖 user_accounts）
        try {
            await sb.auth.refreshSession();
            const { data: { user } } = await sb.auth.getUser();
            if (user?.user_metadata?.basic_info) {
                saveBasicInfo(user.user_metadata.basic_info);
                // 同步到家庭成员
                syncBasicInfoToFamily(user.user_metadata.basic_info);
            }
        } catch (eAuth) {
            console.warn('Auth元数据读取失败（基本信息）:', eAuth.message);
        }

        try {
            const userId = await getCurrentAccountId();
            if (!userId) return;

            // 1. 同步方案历史（合并模式：本地优先，Supabase补缺）
        const { data: plans } = await sb.from('meal_plans')
            .select('plan_date, plan_data')
            .eq('user_id', userId)
            .order('plan_date', { ascending: false });
        if (plans && plans.length > 0) {
            const localHistory = getMealHistory();
            // 本地已有方案的日期集合
            const localDates = new Set(localHistory.filter(h => h.plan).map(h => h.date));
            // Supabase数据转为history格式
            const supHistory = plans.map(p => ({
                date: p.plan_date,
                plan: p.plan_data,
                actual: null,
                status: null
            }));
            // 只补充本地没有的日期（本地已存在的记录不覆盖）
            const newFromSup = supHistory.filter(h => !localDates.has(h.date));
            const merged = [...localHistory, ...newFromSup];
            saveMealHistory(merged);
        }

        // 2. 同步打卡记录（含实际摄入数据）
        const { data: checkins } = await sb.from('checkin_logs')
            .select('log_date, status, actual_data')
            .eq('user_id', userId);
        if (checkins && checkins.length > 0) {
            const checkinData = {};
            checkins.forEach(c => { checkinData[c.log_date] = c.status === 'checked'; });
            localStorage.setItem(getStorageKey('checkin'), JSON.stringify(checkinData));

            // 同时更新 meal_history 中的 actual 和 status
            const history = getMealHistory();
            if (history.length > 0) {
                let changed = false;
                checkins.forEach(c => {
                    const record = history.find(h => h.date === c.log_date);
                    if (record && !record.actual) {
                        record.actual = c.actual_data;
                        record.status = c.status;
                        changed = true;
                    }
                });
                if (changed) saveMealHistory(history);
            }
        }

        // 3. 同步负债队列
        const { data: debts } = await sb.from('energy_compensations')
            .select('queue_data')
            .eq('user_id', userId)
            .eq('log_date', '2000-01-01');
        if (debts && debts.length > 0 && debts[0].queue_data) {
            localStorage.setItem(getStorageKey('debt'), JSON.stringify(debts[0].queue_data));
        }

        } catch (e) {
            console.warn('syncAllFromSupabase失败:', e.message);
        }
    } finally {
        // 同步完成后刷新页面显示（个人信息 + 今日方案 + 导航栏）
        // finally 确保即使提前 return 或异常也刷新
        try {
            // 刷新导航（数据已同步 → hasData 变化 → 导航按钮更新）
            if (typeof renderNav === 'function') {
                // 定位当前可见的 section
                const sections = ['nav-calculatorSection', 'nav-foodDbSection'];
                for (const id of sections) {
                    const el = document.getElementById(id);
                    if (el && el.offsetParent !== null) {
                        renderNav(id, id.replace('nav-', '').replace('Section', ''));
                        break;
                    }
                }
            }
        } catch {}
        try {
            if (typeof renderBasicInfoSummary === 'function') {
                renderBasicInfoSummary();
            }
        } catch {}
        try {
            if (typeof autoGenerateDailyPlan === 'function') {
                autoGenerateDailyPlan();
            }
        } catch {}
    }
}

// ---- 历史方案记录 ----

/**
 * 获取当前用户的历史记录数组
 * @returns {Array} [{date, plan, status, actual}]
 */
function getMealHistory() {
    try {
        const key = getStorageKey('meal_history');
        return JSON.parse(localStorage.getItem(key) || '[]');
    } catch { return []; }
}

/**
 * 保存历史记录
 */
function saveMealHistory(history) {
    localStorage.setItem(getStorageKey('meal_history'), JSON.stringify(history));
}

/**
 * 保存方案后写入历史（保留所有记录，不过期）
 */
function savePlanToHistory(mealPlan) {
    const today = todayLocal();
    const history = getMealHistory();
    const existing = history.find(h => h.date === today);
    if (existing) {
        existing.plan = mealPlan;
    } else {
        history.push({ date: today, plan: mealPlan, status: null, actual: null });
    }
    saveMealHistory(history);
    cleanOldHistory();
    // 同步到 Supabase
    syncMealPlanToSupabase(today, mealPlan);
}

/**
 * 清理超出保留期限的历史数据
 */
function cleanOldHistory() {
    const history = getMealHistory();
    if (!history.length) return;
    const days = getRetentionDays(currentUser);
    if (days < 0) return; // 永久保留，不清除
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.getFullYear() + '-' + String(cutoff.getMonth()+1).padStart(2,'0') + '-' + String(cutoff.getDate()).padStart(2,'0');
    const filtered = history.filter(h => h.date >= cutoffStr);
    if (filtered.length < history.length) {
        saveMealHistory(filtered);
    }
}

/**
 * 获取某日期的历史记录
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {object|null}
 */
function getDayHistory(dateStr) {
    const history = getMealHistory();
    return history.find(h => h.date === dateStr) || null;
}

/**
 * 更新某日期的打卡数据
 * @param {string} dateStr
 * @param {object} actual - {energy, protein, carb, fat}
 */
function updateCheckInData(dateStr, actual) {
    const history = getMealHistory();
    const record = history.find(h => h.date === dateStr);
    if (record) {
        record.actual = actual;
        record.status = 'checked';
        saveMealHistory(history);
        // 同步到 Supabase
        syncMealPlanToSupabase(dateStr, record.plan);
        syncCheckinToSupabase(dateStr, 'checked', actual);
    }
}

// ---- 打卡状态 ----

/**
 * 获取打卡状态对象
 * @returns {object} {'YYYY-MM-DD': true/false}
 */
function getCheckinData() {
    try {
        const key = getStorageKey('checkin');
        return JSON.parse(localStorage.getItem(key) || '{}');
    } catch { return {}; }
}

function saveCheckinData(data, syncDate) {
    localStorage.setItem(getStorageKey('checkin'), JSON.stringify(data));
    // 如果传入了 syncDate，同步该日打卡状态到 Supabase
    if (syncDate) {
        const status = data[syncDate] === true ? 'checked' : 'skipped';
        syncCheckinToSupabase(syncDate, status);
    }
}

/**
 * 标记某天已打卡
 * @param {string} dateStr
 */
function markCheckin(dateStr) {
    const data = getCheckinData();
    data[dateStr] = true;
    saveCheckinData(data, dateStr);
}

/**
 * 检查某天是否已打卡
 * @param {string} dateStr
 * @returns {boolean}
 */
function isCheckedIn(dateStr) {
    const data = getCheckinData();
    return !!data[dateStr];
}

/**
 * 获取昨天日期字符串
 * @returns {string}
 */
function getYesterdayStr() {
    return dayOffsetLocal(-1);
}

// ---- 负债队列（能量补偿） ----

/**
 * 获取当前用户的负债队列
 * @returns {Array} [{day: 'YYYY-MM-DD', kcal: number}]
 */
function getDebtQueue() {
    try {
        const key = getStorageKey('debt');
        return JSON.parse(localStorage.getItem(key) || '[]');
    } catch { return []; }
}

function saveDebtQueue(queue) {
    localStorage.setItem(getStorageKey('debt'), JSON.stringify(queue));
    syncDebtQueueToSupabase(queue);
}

/**
 * 挂一笔负债到指定日期
 */
function addDebt(targetDay, kcal) {
    const queue = getDebtQueue();
    queue.push({ day: targetDay, kcal: kcal });
    saveDebtQueue(queue);
}

/**
 * 计算今天的总补偿值（封顶±15%）
 */
function getTodayCompensation(baseline) {
    const limit = Math.round(baseline * 0.15);
    const today = todayLocal();
    let queue = getDebtQueue();
    let total = 0;
    const remaining = [];
    for (const item of queue) {
        if (item.day === today) {
            total += item.kcal;
        } else if (item.day > today) {
            remaining.push(item);
        }
    }
    const compensation = Math.max(-limit, Math.min(limit, total));
    const overflow = total - compensation;
    if (overflow !== 0) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        remaining.push({ day: dayOffsetLocal(1), kcal: overflow });
    }
    saveDebtQueue(remaining);
    return compensation;
}

/**
 * 周一清零处理
 */
function weeklyReset(baseline) {
    const now = new Date();
    if (now.getDay() !== 1) return null;

    const key = getStorageKey('last_reset');
    const lastReset = localStorage.getItem(key);
    const todayStr = todayLocal();
    if (lastReset === todayStr) return null;

    const queue = getDebtQueue();
    const totalKcal = queue.reduce((sum, item) => sum + item.kcal, 0);

    saveDebtQueue([]);
    localStorage.setItem(key, todayStr);

    if (Math.abs(totalKcal) < 10) return null;

    if (totalKcal < 0) {
        return `上周能量缺口约 ${Math.round(-totalKcal)} kcal，记得关注饮食摄入。`;
    } else {
        return `上周能量超出约 ${Math.round(totalKcal)} kcal，建议适当控制。`;
    }
}

// ---- 把偏差拆2份挂债 ----

/**
 * 提交昨日打卡数据 → 算偏差 → 拆2份挂债
 * @param {number} actualEnergy - 实际摄入能量
 * @param {number} baseline - 基准TDEE
 * @param {string} checkinDate - 被打卡的日期 'YYYY-MM-DD'
 */
function submitDeviation(actualEnergy, baseline, checkinDate) {
    const deviation = actualEnergy - baseline; // 正=吃多；负=吃少
    if (Math.abs(deviation) < 10) return; // 忽略微小偏差

    const half = Math.round(deviation / 2);
    const refDate = new Date(checkinDate + 'T12:00:00'); // 以打卡日期为基准
    const d1 = new Date(refDate); d1.setDate(d1.getDate() + 1);
    const d2 = new Date(refDate); d2.setDate(d2.getDate() + 2);
    const d1Str = d1.getFullYear() + '-' + String(d1.getMonth()+1).padStart(2,'0') + '-' + String(d1.getDate()).padStart(2,'0');
    const d2Str = d2.getFullYear() + '-' + String(d2.getMonth()+1).padStart(2,'0') + '-' + String(d2.getDate()).padStart(2,'0');

    addDebt(d1Str, half); // D+1补一半（= 今天）
    addDebt(d2Str, half); // D+2补一半（= 明天）
}

// ============================================
// 低碳水饮食配比设置
// ============================================

// 档位配置（从Supabase加载）
let lowCarbProfiles = [];

// 当前选择的模式：'newbie' | 'advanced' | 'master'
let currentMode = 'newbie';

// 打卡相关：等待打卡后重新调用的档位索引
let pendingProfileIndex = null;

// 当前选择的档位索引（新手模式用）
let currentProfileIndex = 1; // 默认温和型

// 当前自定义比例（进阶/大师模式用）
let customRatios = {
    carb: 20,
    protein: 15,
    fat: 65
};

// 档位选择流程步骤：'select-mode' | 'mode-detail'
let profileStep = 'select-mode';

// 风险提示阈值
const RISK_LIMITS = {
    carb: { min: 5, max: 50 },
    protein: { min: 10, max: 30 },
    fat: { min: 20, max: 80 }
};

/**
 * 从Supabase加载低碳水饮食档位配置
 */
async function loadLowCarbProfiles() {
    const result = await getLowCarbProfiles();
    if (result.success && result.data.length > 0) {
        lowCarbProfiles = result.data;
        console.debug('✅ 低碳水饮食配置已加载:', lowCarbProfiles);
        return true;
    } else {
        console.warn('⚠️ 无法加载低碳水饮食配置，使用默认配置');
        // 使用默认配置
        lowCarbProfiles = [
            { '方案名称': '控制型低碳水饮食', '碳水下限': 25, '碳水上限': 44, '碳水默认': 35, '蛋白质比例': 15, '脂肪比例': 50 },
            { '方案名称': '温和型低碳水饮食', '碳水下限': 10, '碳水上限': 25, '碳水默认': 20, '蛋白质比例': 15, '脂肪比例': 65 },
            { '方案名称': '极低碳水饮食/生酮饮食', '碳水下限': 5, '碳水上限': 10, '碳水默认': 10, '蛋白质比例': 20, '脂肪比例': 70 }
        ];
        return false;
    }
}

/**
 * 获取当前有效的营养比例
 */
function getCurrentRatios() {
    if (currentMode === 'newbie') {
        const profile = lowCarbProfiles[currentProfileIndex];
        return {
            carb: profile['碳水默认'],
            protein: profile['蛋白质比例'],
            fat: profile['脂肪比例'],
            profileName: profile['方案名称']
        };
    } else if (currentMode === 'advanced') {
        const profile = lowCarbProfiles[currentProfileIndex];
        return {
            carb: customRatios.carb,
            protein: profile['蛋白质比例'],
            fat: 100 - customRatios.carb - profile['蛋白质比例'],
            profileName: profile['方案名称']
        };
    } else {
        // master mode
        return {
            carb: customRatios.carb,
            protein: customRatios.protein,
            fat: customRatios.fat,
            profileName: '自定义'
        };
    }
}

/**
 * 生成营养配比设置HTML
 */
function renderMacroRatioSettings() {
    const profile = lowCarbProfiles[currentProfileIndex] || lowCarbProfiles[1];
    const ratios = getCurrentRatios();

    let modeDescription = '';
    switch(currentMode) {
        case 'newbie': modeDescription = '系统推荐，一键设置'; break;
        case 'advanced': modeDescription = '可调整碳水，蛋白质固定'; break;
        case 'master': modeDescription = '三大营养全自定义，系统辅助把关'; break;
    }

    return `
        <div class="macro-ratio-settings" id="macroRatioSettings">
            <h3>⚙️ 营养配比设置</h3>

            <!-- 模式选择 -->
            <div class="ratio-mode-selector">
                <label>选择模式：</label>
                <div class="mode-buttons">
                    <button class="mode-btn ${currentMode === 'newbie' ? 'active' : ''}"
                            onclick="setMacroMode('newbie')">
                        🌱 新手模式
                    </button>
                    <button class="mode-btn ${currentMode === 'advanced' ? 'active' : ''}"
                            onclick="setMacroMode('advanced')">
                        ⚡ 进阶模式
                    </button>
                    <button class="mode-btn ${currentMode === 'master' ? 'active' : ''}"
                            onclick="setMacroMode('master')">
                        🎓 大师模式
                    </button>
                </div>
                <p class="mode-desc">${modeDescription}</p>
            </div>

            ${currentMode === 'newbie' ? renderNewbieMode(profile, ratios) : ''}
            ${currentMode === 'advanced' ? renderAdvancedMode(profile, ratios) : ''}
            ${currentMode === 'master' ? renderMasterMode(ratios) : ''}

            <!-- 风险提示区域 -->
            <div class="risk-warnings" id="riskWarnings">
                ${generateRiskWarnings(ratios)}
            </div>

            <!-- 营养比例汇总 -->
            <div class="ratio-summary" id="ratioSummary">
                ${renderRatioSummary(ratios)}
            </div>

            <button class="btn-calculate" onclick="applyMacroRatios()">✓ 应用此配比</button>
        </div>
    `;
}

/**
 * 新手模式：只显示档位选择
 */
function renderNewbieMode(profile, ratios) {
    return `
        <div class="profile-selector">
            ${lowCarbProfiles.map((p, idx) => `
                <label class="profile-option ${currentProfileIndex === idx ? 'selected' : ''}">
                    <input type="radio" name="profile" value="${idx}"
                           ${currentProfileIndex === idx ? 'checked' : ''}
                           onchange="selectProfile(${idx})">
                    <div class="profile-content">
                        <strong>${p['方案名称']}</strong>
                        <div class="profile-ratios">
                            碳水 ${p['碳水默认']}% | 蛋白质 ${p['蛋白质比例']}% | 脂肪 ${p['脂肪比例']}%
                        </div>
                        <small class="profile-desc">${p['说明']}</small>
                    </div>
                </label>
            `).join('')}
        </div>
    `;
}

/**
 * 进阶模式：可调碳水
 */
function renderAdvancedMode(profile, ratios) {
    const carbMin = profile['碳水下限'];
    const carbMax = profile['碳水上限'];

    return `
        <div class="advanced-controls">
            <div class="slider-control">
                <label>碳水化合物（可调）：</label>
                <div class="slider-container">
                    <input type="range" id="carbSlider"
                           min="${carbMin}" max="${carbMax}" step="1"
                           value="${customRatios.carb}"
                           oninput="updateAdvancedSlider('carb', this.value)">
                    <span class="slider-value" id="carbSliderValue">${customRatios.carb}%</span>
                </div>
                <div class="slider-range">${carbMin}% ~ ${carbMax}%</div>
            </div>

            <div class="fixed-ratios">
                <div class="ratio-item">
                    <span>蛋白质（固定）</span>
                    <strong>${profile['蛋白质比例']}%</strong>
                </div>
                <div class="ratio-item">
                    <span>脂肪（自动计算）</span>
                    <strong id="advancedFatValue">${100 - customRatios.carb - profile['蛋白质比例']}%</strong>
                </div>
            </div>
        </div>
    `;
}

/**
 * 大师模式：三大营养全自定义
 */
function renderMasterMode(ratios) {
    return `
        <div class="master-controls">
            <div class="slider-control">
                <label>碳水化合物：</label>
                <div class="slider-container">
                    <input type="range" id="masterCarbSlider"
                           min="5" max="50" step="1"
                           value="${customRatios.carb}"
                           oninput="updateMasterSlider('carb', this.value)">
                    <span class="slider-value" id="masterCarbSliderValue">${customRatios.carb}%</span>
                </div>
            </div>

            <div class="slider-control">
                <label>蛋白质：</label>
                <div class="slider-container">
                    <input type="range" id="masterProteinSlider"
                           min="10" max="30" step="1"
                           value="${customRatios.protein}"
                           oninput="updateMasterSlider('protein', this.value)">
                    <span class="slider-value" id="masterProteinSliderValue">${customRatios.protein}%</span>
                </div>
            </div>

            <div class="slider-control">
                <label>脂肪：</label>
                <div class="slider-container">
                    <input type="range" id="masterFatSlider"
                           min="20" max="80" step="1"
                           value="${customRatios.fat}"
                           oninput="updateMasterSlider('fat', this.value)">
                    <span class="slider-value" id="masterFatSliderValue">${customRatios.fat}%</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * 更新进阶模式的滑动条
 */
function updateAdvancedSlider(type, value) {
    const profile = lowCarbProfiles[currentProfileIndex];
    customRatios[type] = parseInt(value);

    document.getElementById('carbSliderValue').textContent = value + '%';
    const fat = 100 - parseInt(value) - profile['蛋白质比例'];
    document.getElementById('advancedFatValue').textContent = fat + '%';

    // 更新风险提示和汇总
    updateRatioPreview();
}

/**
 * 更新大师模式的滑动条
 */
function updateMasterSlider(type, value) {
    customRatios[type] = parseInt(value);
    document.getElementById(`master${type.charAt(0).toUpperCase() + type.slice(1)}SliderValue`).textContent = value + '%';

    // 更新风险提示和汇总
    updateRatioPreview();
}

/**
 * 更新比例预览（风险提示和汇总）
 */
function updateRatioPreview() {
    const ratios = getCurrentRatios();

    // 更新风险提示
    const riskWarningsEl = document.getElementById('riskWarnings');
    if (riskWarningsEl) {
        riskWarningsEl.innerHTML = generateRiskWarnings(ratios);
    }

    // 更新汇总
    const ratioSummaryEl = document.getElementById('ratioSummary');
    if (ratioSummaryEl) {
        ratioSummaryEl.innerHTML = renderRatioSummary(ratios);
    }
}

/**
 * 生成风险提示
 */
function generateRiskWarnings(ratios) {
    const warnings = [];

    // 碳水风险
    if (ratios.carb < RISK_LIMITS.carb.min) {
        warnings.push({ type: 'danger', text: `碳水 ${ratios.carb}%：极低，可能进入深度生酮，注意监测` });
    } else if (ratios.carb > RISK_LIMITS.carb.max) {
        warnings.push({ type: 'warning', text: `碳水 ${ratios.carb}%：偏高，已不属于低碳水饮食范围` });
    }

    // 蛋白质风险
    if (ratios.protein < RISK_LIMITS.protein.min) {
        warnings.push({ type: 'danger', text: `蛋白质 ${ratios.protein}%：过低，可能影响肌肉保留` });
    } else if (ratios.protein > RISK_LIMITS.protein.max) {
        warnings.push({ type: 'warning', text: `蛋白质 ${ratios.protein}%：偏高，增加肾脏负担` });
    }

    // 脂肪风险
    if (ratios.fat < RISK_LIMITS.fat.min) {
        warnings.push({ type: 'danger', text: `脂肪 ${ratios.fat}%：过低，可能影响脂溶性维生素吸收` });
    } else if (ratios.fat > RISK_LIMITS.fat.max) {
        warnings.push({ type: 'warning', text: `脂肪 ${ratios.fat}%：偏高，注意总热量控制` });
    }

    if (warnings.length === 0) {
        return '<div class="risk-ok">✓ 当前配比在安全范围内</div>';
    }

    return warnings.map(w => `
        <div class="risk-item ${w.type}">
            <span class="risk-icon">⚠️</span>
            <span>${w.text}</span>
        </div>
    `).join('');
}

/**
 * 渲染营养比例汇总
 */
function renderRatioSummary(ratios) {
    const total = ratios.carb + ratios.protein + ratios.fat;
    const isValid = Math.abs(total - 100) < 0.1;

    return `
        <div class="ratio-summary-content">
            <div class="ratio-bar">
                <div class="ratio-bar-carb" style="width: ${ratios.carb}%"></div>
                <div class="ratio-bar-protein" style="width: ${ratios.protein}%"></div>
                <div class="ratio-bar-fat" style="width: ${ratios.fat}%"></div>
            </div>
            <div class="ratio-labels">
                <span>🥩 蛋白质 ${ratios.protein}%</span>
                <span>🥑 脂肪 ${ratios.fat}%</span>
                <span>🍚 碳水 ${ratios.carb}%</span>
            </div>
            <div class="ratio-total ${isValid ? 'ok' : 'error'}">
                ${isValid ? '✓' : '⚠️'} 总计：${total.toFixed(1)}%
            </div>
        </div>
    `;
}

/**
 * 切换模式
 */
function setMacroMode(mode) {
    currentMode = mode;

    // 重置到当前档位的默认值
    if (mode === 'advanced' || mode === 'master') {
        const profile = lowCarbProfiles[currentProfileIndex];
        customRatios.carb = profile['碳水默认'];
        customRatios.protein = profile['蛋白质比例'];
        customRatios.fat = profile['脂肪比例'];
    }

    // 重新渲染设置区域
    const container = document.getElementById('macroRatioSettings');
    if (container) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = renderMacroRatioSettings();
        container.replaceWith(tempDiv.firstElementChild);
    }
}

/**
 * 选择档位（新手模式）
 */
function selectProfile(index) {
    currentProfileIndex = index;
    const profile = lowCarbProfiles[index];

    // 重置自定义值到新档位的默认值
    customRatios.carb = profile['碳水默认'];
    customRatios.protein = profile['蛋白质比例'];
    customRatios.fat = profile['脂肪比例'];

    updateRatioPreview();
}

/**
 * 应用营养配比
 */
function applyMacroRatios() {
    const ratios = getCurrentRatios();

    // 检查风险
    const hasRisk = ratios.carb < RISK_LIMITS.carb.min ||
                    ratios.carb > RISK_LIMITS.carb.max ||
                    ratios.protein < RISK_LIMITS.protein.min ||
                    ratios.protein > RISK_LIMITS.protein.max ||
                    ratios.fat < RISK_LIMITS.fat.min ||
                    ratios.fat > RISK_LIMITS.fat.max;

    if (hasRisk) {
        showConfirmDialog({
            title: '配比风险提示',
            message: '当前配比超出推荐范围，确定要应用吗？',
            onConfirm: () => {
                updateMacroDisplay(ratios);
                const settingsEl = document.getElementById('macroRatioSettings');
                if (settingsEl) settingsEl.style.display = 'none';
                showToast(`✅ 已应用新配比：${ratios.profileName}  碳水 ${ratios.carb}% | 蛋白质 ${ratios.protein}% | 脂肪 ${ratios.fat}%`, 'success');
            }
        });
        return;
    }

    // 更新三大营养素显示
    updateMacroDisplay(ratios);

    // 关闭设置区域（可选）
    const settingsEl = document.getElementById('macroRatioSettings');
    if (settingsEl) {
        settingsEl.style.display = 'none';
    }

    showToast(`✅ 已应用新配比：${ratios.profileName}  碳水 ${ratios.carb}% | 蛋白质 ${ratios.protein}% | 脂肪 ${ratios.fat}%`, 'success');
}

/**
 * 更新营养素显示（应用新配比后）
 */
function updateMacroDisplay(ratios) {
    const tdee = users[currentUser]?.results?.tdee || 2000;

    // 计算克数
    const proteinKcal = tdee * ratios.protein / 100;
    const fatKcal = tdee * ratios.fat / 100;
    const carbKcal = tdee * ratios.carb / 100;

    const macros = {
        protein: {
            percent: ratios.protein,
            kcal: Math.round(proteinKcal),
            grams: Math.round(proteinKcal / 4),
        },
        fat: {
            percent: ratios.fat,
            kcal: Math.round(fatKcal),
            grams: Math.round(fatKcal / 9),
        },
        carb: {
            percent: ratios.carb,
            kcal: Math.round(carbKcal),
            grams: Math.round(carbKcal / 4),
        }
    };

    // 更新显示
    document.getElementById('proteinPercent').textContent = `${macros.protein.percent}%`;
    document.getElementById('proteinGrams').textContent = `${macros.protein.grams}g`;
    document.getElementById('proteinKcal').textContent = `${macros.protein.kcal} kcal`;

    document.getElementById('fatPercent').textContent = `${macros.fat.percent}%`;
    document.getElementById('fatGrams').textContent = `${macros.fat.grams}g`;
    document.getElementById('fatKcal').textContent = `${macros.fat.kcal} kcal`;

    document.getElementById('carbPercent').textContent = `${macros.carb.percent}%`;
    document.getElementById('carbGrams').textContent = `${macros.carb.grams}g`;
    document.getElementById('carbKcal').textContent = `${macros.carb.kcal} kcal`;

    // 更新圆形进度
    updateMacroCircle('protein', macros.protein.percent);
    updateMacroCircle('fat', macros.fat.percent);
    updateMacroCircle('carb', macros.carb.percent);

    // 更新食物换算
    renderFoodExchange(macros);

    // 保存到用户数据
    if (users[currentUser]) {
        users[currentUser].macroRatios = ratios;
    }
}

// ============================================
// UI渲染
// ============================================

/**
 * 获取表单数据
 */
function getFormData() {
    return {
        name: document.getElementById('name').value.trim() || `用户${currentUser + 1}`,
        gender: document.getElementById('gender').value,
        age: parseInt(document.getElementById('age').value) || 40,
        height: parseFloat(document.getElementById('height').value) || 170,
        weight: parseFloat(document.getElementById('weight').value) || 70,
        activity: parseFloat(document.getElementById('activity').value),
    };
}

/**
 * 填充表单数据
 */
function populateForm(data) {
    document.getElementById('name').value = data.name || '';
    document.getElementById('gender').value = data.gender || 'male';
    document.getElementById('age').value = data.age || '';
    document.getElementById('height').value = data.height || '';
    document.getElementById('weight').value = data.weight || '';
    document.getElementById('activity').value = data.activity || '1.55';
}

/**
 * 切换营养配比设置区域的显示/隐藏
 */
async function toggleMacroRatioSettings() {
    const container = document.getElementById('macroRatioContainer');

    if (container.style.display === 'none') {
        // 确保配置已加载
        if (lowCarbProfiles.length === 0) {
            await loadLowCarbProfiles();
        }

        // 渲染设置区域
        container.innerHTML = renderMacroRatioSettings();
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }
}

/**
 * 渲染计算结果（GX标准体重法增强版）
 * 在原有结果基础上，增加标准体重、调节体重、年龄系数等说明
 */
function renderResults_XiaMeng(formData, xiaResult, bmr, macros) {
    const resultSection = document.getElementById('resultSection');
    const inputSection = document.getElementById('inputSection');

    resultSection.style.display = 'block';
    inputSection.style.display = 'none';

    // 基本信息
    document.getElementById('resultName').textContent = formData.name;

    // BMI
    const bmiValue = xiaResult.bmi;
    const bmiInfo = getBMIStatus(bmiValue);
    document.getElementById('bmiValue').textContent = bmiValue.toFixed(1);
    const bmiStatus = document.getElementById('bmiStatus');
    bmiStatus.textContent = bmiInfo.status;
    bmiStatus.className = `summary-status ${bmiInfo.className}`;

    // BMR & TDEE
    document.getElementById('bmrValue').textContent = Math.round(bmr);
    document.getElementById('tdeeValue').textContent = xiaResult.tdee;

    // 在TDEE下方插入GX方法的计算说明
    renderXiaMengDetail(xiaResult);

    // 三大营养素（标签值 + 实际吸收值）
    document.getElementById('proteinPercent').textContent = `${macros.protein.percent}%`;
    document.getElementById('proteinGrams').textContent = `${macros.protein.grams}g`;
    document.getElementById('proteinKcal').textContent = `${macros.protein.kcal} kcal`;
    document.getElementById('proteinGramsActual').textContent = `实际吸收 ${macros.protein.grams_actual}g`;
    document.getElementById('proteinKcalActual').textContent = `(${macros.protein.kcal_actual} kcal)`;

    document.getElementById('fatPercent').textContent = `${macros.fat.percent}%`;
    document.getElementById('fatGrams').textContent = `${macros.fat.grams}g`;
    document.getElementById('fatKcal').textContent = `${macros.fat.kcal} kcal`;
    document.getElementById('fatGramsActual').textContent = `实际吸收 ${macros.fat.grams_actual}g`;
    document.getElementById('fatKcalActual').textContent = `(${macros.fat.kcal_actual} kcal)`;

    document.getElementById('carbPercent').textContent = `${macros.carb.percent}%`;
    document.getElementById('carbGrams').textContent = `${macros.carb.grams}g`;
    document.getElementById('carbKcal').textContent = `${macros.carb.kcal} kcal`;
    document.getElementById('carbGramsActual').textContent = `实际吸收 ${macros.carb.grams_actual}g`;
    document.getElementById('carbKcalActual').textContent = `(${macros.carb.kcal_actual} kcal)`;

    // 更新圆形进度
    updateMacroCircle('protein', macros.protein.percent);
    updateMacroCircle('fat', macros.fat.percent);
    updateMacroCircle('carb', macros.carb.percent);

    // 食物换算
    renderFoodExchange(macros);

    // 注意事项
    renderWarnings(formData, { bmr, tdee: xiaResult.tdee, macros });

    // 保存当前用户数据（保留已有属性如 xiaResult）
    users[currentUser] = {
        ...users[currentUser],
        formData: { ...formData },
        results: { bmr, tdee: xiaResult.tdee, macros },
    };

    // 更新URL参数（用于分享）
    updateURLParams(formData);

    // 隐藏营养配比设置区域（初始状态）
    document.getElementById('macroRatioContainer').style.display = 'none';

    // 后台预加载低碳水饮食配置
    loadLowCarbProfiles();

    // 滚动到结果
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================
// 档位选择流程（问卷提交后显示）
// ============================================

/**
 * 显示低碳水饮食档位选择界面（在resultPageSection里）
 * @param {object} intake - 问卷统计的实际每日摄入
 */
/**
 * 显示低碳水饮食档位选择界面（在resultPageSection里，支持三种模式）
 * @param {object} intake - 问卷统计的实际每日摄入
 */
function showProfileSelectorInPage(intake) {
    const card = document.getElementById('profileSelectorCard');
    const content = document.getElementById('profileSelectorContent');

    // 确保配置已加载
    if (lowCarbProfiles.length === 0) {
        lowCarbProfiles = [
            { '方案名称': '控制型低碳水饮食', '碳水下限': 25, '碳水上限': 44, '碳水默认': 35, '蛋白质比例': 15, '脂肪比例': 50, '说明': '不分解脂肪，适合初学者入门' },
            { '方案名称': '温和型低碳水饮食', '碳水下限': 10, '碳水上限': 25, '碳水默认': 20, '蛋白质比例': 15, '脂肪比例': 65, '说明': '间断分解脂肪，产生酮体，适合有减脂需求者' },
            { '方案名称': '极低碳水饮食/生酮饮食', '碳水下限': 5, '碳水上限': 10, '碳水默认': 10, '蛋白质比例': 20, '脂肪比例': 70, '说明': '产生酮体，适合在医生指导下进行' }
        ];
    }

    // 方案效果说明配置
    const profileEffects = [
        { icon: '🎯', title: '稳定维持型', effect: '不用饿肚子，维持当前身材，降低慢病风险', suitable: '适合：不想改变体型，想打基础的人' },
        { icon: '🔥', title: '轻松减脂型', effect: '悄悄燃脂，不剧烈，轻松坚持', suitable: '适合：想慢慢瘦、不痛苦的人' },
        { icon: '⚡', title: '强力燃脂型', effect: '快速燃脂，加速掉秤，需严格执行', suitable: '适合：BMI偏高、决心大的人' }
    ];

    let html = '';

    // 儿童（<18岁）：跳过三档和模式选择，直接显示儿童方案提示
    const info = loadBasicInfo();
    if (info && info.age < 18) {
        html = `
        <div class="card" style="text-align:center;padding:40px 20px;">
            <p style="font-size:2.5rem;margin-bottom:8px;">👶</p>
            <p style="font-size:1.1rem;color:var(--text);margin-bottom:6px;">儿童营养方案</p>
            <p style="color:var(--text-light);font-size:0.85rem;margin-bottom:16px;">
                基于《中国居民膳食指南》EER/RNI标准 · 碳水57%
            </p>
            <button class="btn-primary" onclick="generateChildPlanInline(loadBasicInfo())">生成方案 →</button>
        </div>`;
        if (content) content.innerHTML = html;
        return;
    }

    if (profileStep === 'select-mode') {
        // ==========================================
        // 第一步：模式选择页
        // ==========================================
        html = `
        <h3 class="mode-header">请选择您的操作模式</h3>
        <div class="mode-select-grid">
            <div class="mode-card ${currentMode === 'newbie' ? 'mode-card-active' : ''}"
                 onclick="enterModeDetail('newbie')">
                <div class="mode-icon">🌱</div>
                <h4 class="mode-card-title">新手模式</h4>
                <p class="mode-card-desc">系统预设，一键搞定<br>从三个推荐方案中选择</p>
            </div>
            <div class="mode-card ${currentMode === 'advanced' ? 'mode-card-active' : ''}"
                 onclick="enterModeDetail('advanced')">
                <div class="mode-icon">⚡</div>
                <h4 class="mode-card-title">进阶模式</h4>
                <p class="mode-card-desc">在档位基础上微调碳水<br>适合有明确目标的用户</p>
            </div>
            <div class="mode-card ${currentMode === 'master' ? 'mode-card-active' : ''}"
                 onclick="enterModeDetail('master')">
                <div class="mode-icon">🎓</div>
                <h4 class="mode-card-title">大师模式</h4>
                <p class="mode-card-desc">三大营养全自定义<br>适合专业用户</p>
            </div>
        </div>
        `;
    } else {
        // ==========================================
        // 第二步：模式详情页
        // ==========================================
        const modeTitles = { newbie: '🌱 新手模式', advanced: '⚡ 进阶模式', master: '🎓 大师模式' };
        const modeDescs = {
            newbie: '系统预设，一键搞定',
            advanced: '在档位基础上微调碳水',
            master: '三大营养全自定义'
        };

        html = `
        <div style="margin-bottom:16px;">
            <button class="back-btn" onclick="backToModeSelect()">← 返回模式选择</button>
        </div>
        <div class="ratio-mode-selector">
            <h3 class="mode-header" style="margin-bottom:4px;">${modeTitles[currentMode]}</h3>
            <p class="mode-desc" style="text-align:center;">${modeDescs[currentMode]}</p>
        </div>
        `;

        // 新手模式：三张档位卡片
        if (currentMode === 'newbie') {
            html += '<div class="profile-cards">';
            lowCarbProfiles.forEach((p, idx) => {
                const effect = profileEffects[idx] || profileEffects[0];
                html += `
                <div class="profile-card ${currentProfileIndex === idx ? 'selected' : ''}"
                     onclick="selectLowCarbProfileForPage(${idx})"
                     data-profile-idx="${idx}">
                    <div class="profile-card-header">
                        <div class="profile-card-title">
                            <span class="profile-icon">${effect.icon}</span>
                            <span class="profile-name">${p['方案名称']}</span>
                        </div>
                        <span class="profile-badge">碳水 ${p['碳水默认']}%</span>
                    </div>
                    <div class="profile-card-effect">
                        <strong class="effect-title">${effect.title}</strong>
                        <p class="effect-desc">${effect.effect}</p>
                    </div>
                    <div class="profile-card-macros">
                        <div class="profile-macro-bar">
                            <span class="macro-bar-protein" style="width:${p['蛋白质比例']}%">蛋白 ${p['蛋白质比例']}%</span>
                            <span class="macro-bar-fat" style="width:${p['脂肪比例']}%">脂肪 ${p['脂肪比例']}%</span>
                            <span class="macro-bar-carb" style="width:${p['碳水默认']}%">碳水 ${p['碳水默认']}%</span>
                        </div>
                    </div>
                    <div class="profile-card-suitable">
                        <span class="suitable-icon">👤</span>
                        <span>${effect.suitable}</span>
                    </div>
                </div>
                `;
            });
            html += '</div>';
        }

        // 进阶模式：碳水滑动条
        if (currentMode === 'advanced') {
            const profile = lowCarbProfiles[currentProfileIndex];
            const carbMin = profile['碳水下限'];
            const carbMax = profile['碳水上限'];
            const fatValue = 100 - customRatios.carb - profile['蛋白质比例'];
            html += `
            <div class="slider-control" style="margin-bottom:16px;">
                <label>碳水化合物（可调）：</label>
                <div class="slider-container">
                    <input type="range" id="pageCarbSlider"
                           min="${carbMin}" max="${carbMax}" step="1"
                           value="${customRatios.carb}"
                           oninput="updatePageAdvancedSlider(this.value, ${profile['蛋白质比例']})">
                    <span class="slider-value" id="pageCarbSliderValue">${customRatios.carb}%</span>
                </div>
                <div class="slider-range">范围：${carbMin}% ~ ${carbMax}%</div>
            </div>
            <div class="fixed-ratios">
                <div>🥩 蛋白质（固定）<strong class="fixed-ratio-value">${profile['蛋白质比例']}%</strong></div>
                <div>🥑 脂肪（自动）<strong class="fixed-ratio-value" id="pageAdvancedFatValue">${fatValue}%</strong></div>
            </div>
            <button class="btn-calculate" onclick="confirmCustomProfile()">✅ 确认方案</button>
            `;
        }

        // 大师模式：三个滑动条
        if (currentMode === 'master') {
            html += `
            <div class="master-controls control-group">
                <div class="slider-control">
                    <label>🍚 碳水化合物：</label>
                    <div class="slider-container">
                        <input type="range" id="pageMasterCarbSlider" min="5" max="50" step="1"
                               value="${customRatios.carb}" oninput="updatePageMasterSlider()">
                        <span class="slider-value" id="pageMasterCarbSliderValue">${customRatios.carb}%</span>
                    </div>
                </div>
                <div class="slider-control">
                    <label>🥩 蛋白质：</label>
                    <div class="slider-container">
                        <input type="range" id="pageMasterProteinSlider" min="10" max="30" step="1"
                               value="${customRatios.protein}" oninput="updatePageMasterSlider()">
                        <span class="slider-value" id="pageMasterProteinSliderValue">${customRatios.protein}%</span>
                    </div>
                </div>
                <div class="slider-control">
                    <label>🥑 脂肪：</label>
                    <div class="slider-container">
                        <input type="range" id="pageMasterFatSlider" min="20" max="80" step="1"
                               value="${customRatios.fat}" oninput="updatePageMasterSlider()">
                        <span class="slider-value" id="pageMasterFatSliderValue">${customRatios.fat}%</span>
                    </div>
                </div>
            </div>
            <div id="pageMasterRatioSummary" style="margin-bottom:12px;">${renderPageMasterRatioSummary()}</div>
            <button class="btn-calculate" onclick="confirmCustomProfile()">✅ 确认方案</button>
            <div id="pageMasterRiskWarnings" style="margin-top:12px;">${generateRiskWarnings(getCurrentRatios())}</div>
            `;
        }
    }

    // 保存摄入数据供后续使用
    window.currentIntake = intake;

    content.innerHTML = html;
    card.style.display = 'block';
    document.getElementById('resultSectionInPage').style.display = 'none';
}

/**
 * 进入模式详情页
 * @param {string} mode - 'newbie' | 'advanced' | 'master'
 */
function enterModeDetail(mode) {
    currentMode = mode;
    profileStep = 'mode-detail';

    // 切换到进阶/大师时，初始化为当前档位的默认值
    if (mode === 'advanced' || mode === 'master') {
        const profile = lowCarbProfiles[currentProfileIndex];
        customRatios.carb = profile['碳水默认'];
        customRatios.protein = profile['蛋白质比例'];
        customRatios.fat = profile['脂肪比例'];
    }

    showProfileSelectorInPage(window.currentIntake);
}

/**
 * 返回模式选择页
 */
function backToModeSelect() {
    profileStep = 'select-mode';
    showProfileSelectorInPage(window.currentIntake);
}

/**
 * 进阶/大师模式确认方案
 */
function confirmCustomProfile() {
    selectLowCarbProfileForPage(currentProfileIndex);
}

/**
 * 返回档位选择界面（从结果页返回）
 */
function backToProfileSelector() {
    document.getElementById('resultSectionInPage').style.display = 'none';
    document.getElementById('profileSelectorCard').style.display = 'block';
}

/**
 * 切换方案选择模式（保留兼容）
 * @param {string} mode - 'newbie' | 'advanced' | 'master'
 */
function switchProfileMode(mode) {
    currentMode = mode;

    // 切换到进阶/大师时，初始化为当前档位的默认值
    if (mode === 'advanced' || mode === 'master') {
        const profile = lowCarbProfiles[currentProfileIndex];
        customRatios.carb = profile['碳水默认'];
        customRatios.protein = profile['蛋白质比例'];
        customRatios.fat = profile['脂肪比例'];
    }

    showProfileSelectorInPage(window.currentIntake);
}

/**
 * 更新进阶模式碳水滑动条（页面版）
 */
function updatePageAdvancedSlider(carbValue, proteinPercent) {
    const fat = 100 - parseInt(carbValue) - proteinPercent;
    document.getElementById('pageCarbSliderValue').textContent = carbValue + '%';
    document.getElementById('pageAdvancedFatValue').textContent = fat + '%';
    customRatios.carb = parseInt(carbValue);
    customRatios.fat = fat;
    customRatios.protein = proteinPercent;
}

/**
 * 更新大师模式三个滑动条（页面版）
 */
function updatePageMasterSlider() {
    const carb = parseInt(document.getElementById('pageMasterCarbSlider').value);
    const protein = parseInt(document.getElementById('pageMasterProteinSlider').value);
    let fat = parseInt(document.getElementById('pageMasterFatSlider').value);

    // 修正fat使三者和为100
    fat = 100 - carb - protein;
    if (fat < 20) fat = 20;
    if (fat > 80) fat = 80;

    document.getElementById('pageMasterCarbSliderValue').textContent = carb + '%';
    document.getElementById('pageMasterProteinSliderValue').textContent = protein + '%';
    document.getElementById('pageMasterFatSliderValue').textContent = fat + '%';

    customRatios.carb = carb;
    customRatios.protein = protein;
    customRatios.fat = fat;

    // 更新汇总和风险警告
    const ratioSummaryEl = document.getElementById('pageMasterRatioSummary');
    if (ratioSummaryEl) {
        ratioSummaryEl.innerHTML = renderPageMasterRatioSummary();
    }
    const riskEl = document.getElementById('pageMasterRiskWarnings');
    if (riskEl) {
        riskEl.innerHTML = generateRiskWarnings(getCurrentRatios());
    }
}

/**
 * 渲染大师模式的比例汇总（页面版）
 */
function renderPageMasterRatioSummary() {
    const ratios = getCurrentRatios();
    const total = ratios.carb + ratios.protein + ratios.fat;
    const isValid = Math.abs(total - 100) < 0.1;

    return `
        <div class="ratio-bar-base">
            <div class="ratio-bar-protein" style="width:${ratios.protein}%;" title="蛋白质"></div>
            <div class="ratio-bar-fat" style="width:${ratios.fat}%;" title="脂肪"></div>
            <div class="ratio-bar-carb" style="width:${ratios.carb}%;" title="碳水"></div>
        </div>
        <div class="ratio-bar-label">
            <span>🥩 蛋白 ${ratios.protein}%</span>
            <span>🥑 脂肪 ${ratios.fat}%</span>
            <span>🍚 碳水 ${ratios.carb}%</span>
            <span style="color:${isValid ? 'var(--success)' : 'var(--danger)'}">
                ${isValid ? '✓' : '⚠️'} 总计 ${total.toFixed(1)}%
            </span>
        </div>
    `;
}

async function selectLowCarbProfileForPage(profileIndex) {
    let userData = users[currentUser];

    // 新用户流程：autoGenerateDailyPlan 可能还没把 xiaResult 存到全局 users
    // 如果 users[currentUser] 有数据但缺失 xiaResult，从云端API重新计算
    if (!userData || !userData.xiaResult) {
        const info = loadBasicInfo();
        if (!info || !info.height || !info.weight) {
            showToast('请先填写基本信息', 'error');
            return;
        }
        // 从云端API计算 TDEE（先用默认比例，后续会在 generateProfilePlan 中重新计算宏量营养素）
        const tempResp = await apiCalculateAdult({
            height: info.height,
            weight: info.weight,
            age: info.age,
            activity: info.activity,
            tier: { carbPct: 20, proteinPct: 15, fatPct: 65 }
        });
        if (!tempResp.success) {
            showToast('计算服务异常，请稍后重试', 'error');
            return;
        }
        const xiaResult = extractXiaResult(tempResp.data);
        const bmr = calculateBMR(info.gender, info.age, info.height, info.weight);
        userData = {
            ...users[currentUser],
            ...info,
            xiaResult,
            bmr
        };
        users[currentUser] = userData;
    }

    // ⏳ 检查昨日是否需要打卡
    const yesterday = getYesterdayStr();
    const yesterdayHistory = getDayHistory(yesterday);
    if (!isCheckedIn(yesterday) && yesterdayHistory) {
        pendingProfileIndex = profileIndex;
        showCheckInPopup(yesterday, yesterdayHistory);
        return; // 等打卡提交后再回来生成方案
    }

    // 更新当前档位索引（进阶/大师模式的slider依赖这个）
    currentProfileIndex = profileIndex;

    // 获取当前有效比例（根据currentMode和新手/进阶/大师的slider值）
    const ratio = getCurrentRatios();

    // 大师模式风险确认
    if (currentMode === 'master') {
        const hasRisk = ratio.carb < RISK_LIMITS.carb.min ||
                        ratio.carb > RISK_LIMITS.carb.max ||
                        ratio.protein < RISK_LIMITS.protein.min ||
                        ratio.protein > RISK_LIMITS.protein.max ||
                        ratio.fat < RISK_LIMITS.fat.min ||
                        ratio.fat > RISK_LIMITS.fat.max;
        if (hasRisk) {
            showConfirmDialog({
                title: '配比风险提示',
                message: `当前配比超出推荐范围：\n🥩 蛋白质 ${ratio.protein}%（推荐 10-30%）\n🥑 脂肪 ${ratio.fat}%（推荐 20-80%）\n🍚 碳水 ${ratio.carb}%（推荐 5-50%）`,
                confirmText: '确定应用',
                onConfirm: () => generateProfilePlan(userData, ratio)
            });
            return;
        }
    }

    generateProfilePlan(userData, ratio);
}

/**
 * 生成方案（从云端API获取宏量营养素/能量补偿）
 */
async function generateProfilePlan(userData, ratio) {
    const bmr = calculateBMR(userData.gender, userData.age, userData.height, userData.weight);
    const remote = await fetchRemoteCalculation(
        userData.height, userData.weight, userData.age, userData.activity, ratio, userData.gender
    );
    if (!remote) return;
    const macros = remote.macros;

    // ⏳ 周能量补偿：周一清零 + 读负债算今日调整
    const weekMsg = weeklyReset(userData.xiaResult.tdee);
    const compensation = getTodayCompensation(userData.xiaResult.tdee);

    if (compensation !== 0) {
        // 有补偿 → 弹窗确认后再继续
        showCompensationPopup(compensation, userData.xiaResult.tdee, ratio, bmr, userData, weekMsg, macros);
        return;
    }

    // 无补偿 → 直接生成
    finishApplyMacroRatios(userData, ratio, bmr, macros, 0, '', weekMsg);
}

/**
 * 补偿弹窗确认/跳过后的后续流程
 * 注：补偿调整的宏量营养素用本地计算（TDEE已知，仅做比例拆分，无敏感公式）
 */
async function finishApplyMacroRatios(userData, ratio, bmr, macros, compensation, compensationMsg, weekMsg) {
    let displayMacros = macros;
    if (compensation !== 0) {
        const adjustedTDEE = userData.xiaResult.tdee + compensation;
        displayMacros = calculateDailyMacros(adjustedTDEE, ratio);
        const sign = compensation > 0 ? '➕' : '➖';
        compensationMsg = `${sign} 昨日偏差补偿：${Math.abs(compensation)} kcal`;
    }

    // 持久化档位偏好（后续登录自动生成方案用）
    if (typeof saveTierPreference === 'function') {
        const pName = ratio.profileName || '';
        saveTierPreference({
            ratio: { carb: ratio.carb, protein: ratio.protein, fat: ratio.fat, profileName: pName },
            profileName: pName,
            timestamp: Date.now()
        });
    }

    // 隐藏档位选择，显示结果
    document.getElementById('profileSelectorCard').style.display = 'none';
    const resultSection = document.getElementById('resultSectionInPage');
    resultSection.style.display = 'block';

    // 渲染结果到resultContentInPage
    renderResultsInPage(userData, userData.xiaResult, bmr, displayMacros, compensationMsg);

    if (weekMsg) showToast(weekMsg, 'info');
    showToast(`✅ 营养方案已生成（${ratio.profileName}）${compensationMsg ? ' · ' + compensationMsg : ''}`, 'success');
}

// ============================================
// 方案页内联档位选择器
// ============================================

/** 当前选中的档位索引 */
let planSelectorIndex = 0;
/** 当前滑动条值 */
let planSelectorCarb = 20;
/** 方案重新生成计数器（每次重新生成+1，确保食物种类变化） */
let planRegenCounter = 0;

// 从 localStorage 恢复计数器（按用户隔离）
(function initPlanRegenCounter() {
    try {
        const key = 'plan_regen_counter';
        const saved = localStorage.getItem(key);
        if (saved !== null) planRegenCounter = parseInt(saved, 10) || 0;
    } catch(e) { /* ignore */ }
})();

/** 保存重新生成计数器到 localStorage */
function savePlanRegenCounter() {
    try {
        localStorage.setItem('plan_regen_counter', String(planRegenCounter));
    } catch(e) { /* ignore */ }
}

/**
 * 计算用户种子（用户名哈希 + 重新生成计数器 × 大质数）
 * 大质数乘数确保每次重新生成时所有选择函数大幅偏移，食物种类明显变化
 * 用于 generateMealPlan 的 userSeed 参数，实现不同用户不同方案、重新生成随机化
 */
function getUserSeed() {
    const name = (typeof surveyState !== 'undefined' && surveyState.currentUser) || '';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = ((hash << 5) - hash) + name.charCodeAt(i);
        hash = hash & hash;
    }
    return Math.abs(hash) + planRegenCounter * 9973;
}
/** 档位数据（复用lowCarbProfiles） */
const planProfileEffects = [
    { icon: '🎯', title: '稳定维持型', range: '碳水 25%-44%', default: 35 },
    { icon: '🔥', title: '轻松减脂型', range: '碳水 10%-25%', default: 20 },
    { icon: '⚡', title: '强力燃脂型', range: '碳水 <10%', default: 10 }
];

/**
 * 在方案页弹出档位选择器
 */
function showProfileSelectorInPlan() {
    planRegenCounter++;  // 每次重新生成递增，确保食物种类变化
    savePlanRegenCounter();  // 持久化到 localStorage
    const planSection = document.getElementById('planSection');
    if (!planSection) return;

    // 确保 lowCarbProfiles 已加载
    if (lowCarbProfiles.length === 0) {
        lowCarbProfiles = [
            { '方案名称': '控制型低碳水饮食', '碳水下限': 25, '碳水上限': 44, '碳水默认': 35, '蛋白质比例': 15, '脂肪比例': 50 },
            { '方案名称': '温和型低碳水饮食', '碳水下限': 10, '碳水上限': 25, '碳水默认': 20, '蛋白质比例': 15, '脂肪比例': 65 },
            { '方案名称': '极低碳水饮食/生酮饮食', '碳水下限': 5, '碳水上限': 10, '碳水默认': 10, '蛋白质比例': 20, '脂肪比例': 70 }
        ];
    }

    // 移除已有选择器
    const old = document.querySelector('.plan-selector-overlay');
    if (old) old.remove();

    // 当前选中的档位（从 localStorage 加载）
    const tier = loadTierPreference();
    planSelectorIndex = 0;
    planSelectorCarb = planProfileEffects[0].default;
    if (tier && tier.ratio) {
        const carb = tier.ratio.carb;
        // 匹配最近的档位
        for (let i = 0; i < planProfileEffects.length; i++) {
            const p = lowCarbProfiles[i];
            if (p && carb >= p['碳水下限'] && carb <= p['碳水上限']) {
                planSelectorIndex = i;
                planSelectorCarb = carb;
                break;
            }
        }
    }

    const overlay = document.createElement('div');
    overlay.className = 'plan-selector-overlay';
    overlay.id = 'planSelectorOverlay';

    overlay.innerHTML = buildPlanSelectorHTML();
    planSection.appendChild(overlay);
}

/**
 * 构建档位选择器 HTML
 */
function buildPlanSelectorHTML() {
    const profile = lowCarbProfiles[planSelectorIndex] || lowCarbProfiles[0];
    if (!profile) return '<div class="plan-selector-popup"><p style="padding:24px;text-align:center;">加载中...</p></div>';
    const effect = planProfileEffects[planSelectorIndex] || planProfileEffects[0];
    const carbMin = profile['碳水下限'];
    const carbMax = profile['碳水上限'];
    const protein = profile['蛋白质比例'];
    const fat = 100 - planSelectorCarb - protein;

    let cardsHtml = '';
    lowCarbProfiles.forEach((p, idx) => {
        const eff = planProfileEffects[idx] || planProfileEffects[0];
        const selected = idx === planSelectorIndex ? ' selected' : '';
        cardsHtml += `
        <div class="plan-card-item${selected}" onclick="selectPlanCard(${idx})">
            <div class="plan-card-icon">${eff.icon}</div>
            <div class="plan-card-name">${eff.title}</div>
            <div class="plan-card-range">${eff.range}</div>
            <span class="plan-card-badge${idx === planSelectorIndex ? ' blue' : ''}">默认 ${eff.default}%</span>
        </div>`;
    });

    return `
    <div class="plan-selector-popup">
        <div class="plan-selector-header">
            <h3>🔄 重新选择档位</h3>
            <p>选择方案后，今日计划将立即更新</p>
        </div>
        <div class="plan-selector-cards">
            ${cardsHtml}
        </div>
        <div class="plan-selector-slider">
            <div class="plan-slider-label">🥩 微调配比 <span>范围：${carbMin}% ~ ${carbMax}%</span></div>
            <div class="plan-slider-row">
                <label>碳水</label>
                <input type="range" min="${carbMin}" max="${carbMax}" step="1"
                       value="${planSelectorCarb}"
                       oninput="updatePlanSelectorSlider(this.value)">
                <span class="slider-val" id="planSliderCarbVal">${planSelectorCarb}%</span>
            </div>
            <div class="plan-slider-fixed">🥩 蛋白质 ${protein}%（固定）</div>
            <div class="plan-slider-row">
                <label>脂肪</label>
                <div style="flex:1;height:4px;background:var(--border);border-radius:2px;position:relative;">
                    <div style="height:100%;width:${fat}%;background:#d85a30;border-radius:2px;"></div>
                </div>
                <span class="slider-val">${fat}%</span>
            </div>
        </div>
        <div class="plan-selector-actions">
            <button class="btn-secondary" onclick="closePlanSelector()">取消</button>
            <button class="btn-primary" onclick="confirmPlanSelector()">✅ 确认应用</button>
        </div>
    </div>`;
}

/**
 * 点击档位卡片
 */
function selectPlanCard(index) {
    planSelectorIndex = index;
    const profile = lowCarbProfiles[index];
    planSelectorCarb = profile['碳水默认'];
    // 刷新选择器
    const overlay = document.getElementById('planSelectorOverlay');
    if (overlay) {
        overlay.innerHTML = buildPlanSelectorHTML();
    }
}

/**
 * 更新滑动条
 */
function updatePlanSelectorSlider(value) {
    planSelectorCarb = parseInt(value);
    const valEl = document.getElementById('planSliderCarbVal');
    if (valEl) valEl.textContent = value + '%';
}

/**
 * 关闭选择器
 */
function closePlanSelector() {
    const overlay = document.getElementById('planSelectorOverlay');
    if (overlay) overlay.remove();
}

/**
 * 确认方案选择，应用新档位
 */
function confirmPlanSelector() {
    const profile = lowCarbProfiles[planSelectorIndex];
    const effect = planProfileEffects[planSelectorIndex];

    const ratio = {
        carb: planSelectorCarb,
        protein: profile['蛋白质比例'],
        fat: 100 - planSelectorCarb - profile['蛋白质比例'],
        profileName: profile['方案名称']
    };

    closePlanSelector();

    // 应用新方案
    applyNewPlanInline(ratio);
}

/**
 * 内联应用新方案（不跳页面，直接在方案页刷新）
 */
async function applyNewPlanInline(ratio) {
    const info = loadBasicInfo();
    if (!info || !info.height || !info.weight) {
        showToast('请先填写基本信息', 'error');
        if (typeof showCalculator === 'function') showCalculator();
        return;
    }

    // 从云端获取 TDEE
    const resp = await apiCalculateAdult({
        height: info.height,
        weight: info.weight,
        age: info.age,
        activity: info.activity,
        tier: { carbPct: ratio.carb, proteinPct: ratio.protein, fatPct: ratio.fat }
    });
    if (!resp.success) {
        showToast('计算服务异常，请稍后重试', 'error');
        return;
    }
    const xiaResult = extractXiaResult(resp.data);
    const bmr = calculateBMR(info.gender, info.age, info.height, info.weight);

    // 持久化档位
    const pName = ratio.profileName || '';
    saveTierPreference({
        ratio: { carb: ratio.carb, protein: ratio.protein, fat: ratio.fat, profileName: pName },
        profileName: pName,
        timestamp: Date.now()
    });

    // 能量补偿（静默应用）— 补偿调整的宏量营养素用本地计算（TDEE已知，仅做比例拆分）
    const compensation = getTodayCompensation(xiaResult.tdee);
    const adjustedTDEE = xiaResult.tdee + compensation;
    const macros = calculateDailyMacros(adjustedTDEE, ratio);

    // 更新用户数据
    users[currentUser] = {
        ...users[currentUser],
        ...info,
        xiaResult,
        macroRatios: ratio
    };

    // 生成分餐方案
    const mealPlan = generateMealPlan(macros, getUserSeed());
    savePlanToHistory(mealPlan);

    // 更新缓存
    const tier = { ratio, profileName: pName };
    planCache = { info, xiaResult, bmr, macros, mealPlan, compensation, tier };

    // 直接渲染到方案页
    renderDailyPlan(info, xiaResult, bmr, macros, mealPlan, compensation, tier);

    // 矿物质维生素
    if (typeof renderMVDashboard === 'function' && mealPlan) {
        renderMVDashboard(mealPlan, users[currentUser]);
    }

    // 检查昨日打卡
    tryCheckYesterdayCheckin();

    // 方案更新通知
    if (typeof addNotification === 'function') {
        addNotification('success', '🔄', '方案已更新', pName ? `${pName} · 配比已重新计算` : '');
    }

    showToast(`✅ 方案已更新（${pName}）`, 'success');
}

/**
 * 能量补偿自定义弹窗
 */
function showCompensationPopup(compensation, tdee, ratio, bmr, userData, weekMsg, macros) {
    const absKcal = Math.abs(compensation);
    const todayTarget = tdee + compensation;
    const isUp = compensation > 0;

    const overlay = document.createElement('div');
    overlay.className = 'compensation-overlay';
    overlay.id = 'compensationOverlay';

    const icon = isUp ? '🔋' : '⚖️';
    const title = isUp ? '能量补偿' : '能量平衡';
    const desc = isUp
        ? '昨天吃得不够，今天帮你把缺口补上'
        : '昨天吃得偏多，今天适当平衡一下';
    const highlightClass = isUp ? 'up' : 'down';
    const highlightText = isUp
        ? `今日目标：${todayTarget} kcal（上调 +${absKcal} kcal）`
        : `今日目标：${todayTarget} kcal（下调 -${absKcal} kcal）`;

    overlay.innerHTML = `
        <div class="compensation-popup">
            <div class="compensation-icon">${icon}</div>
            <div class="compensation-body">
                <div class="compensation-title">${title}</div>
                <div class="compensation-desc">${desc}</div>
                <div class="compensation-highlight ${highlightClass}">${highlightText}</div>
            </div>
            <div class="compensation-actions">
                <button class="btn-secondary" id="compSkipBtn">跳过，不调整</button>
                <button class="btn-primary" id="compConfirmBtn">确认调整</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // 点击遮罩不关闭（强制用户做出选择）
    // overlay.addEventListener('click', (e) => { if (e.target === overlay) closeCompensationPopup(false); });

    document.getElementById('compConfirmBtn').addEventListener('click', () => {
        document.body.removeChild(overlay);
        finishApplyMacroRatios(userData, ratio, bmr, macros, compensation, '', weekMsg);
    });

    document.getElementById('compSkipBtn').addEventListener('click', () => {
        document.body.removeChild(overlay);
        finishApplyMacroRatios(userData, ratio, bmr, macros, 0, '', weekMsg);
    });
}

/**
 * 通用确认对话框
 * @param {Object} options - { title, message, confirmText, cancelText, danger, onConfirm, onCancel }
 */
function showConfirmDialog(options) {
    const {
        title = '确认操作',
        message = '',
        confirmText = '确定',
        cancelText = '取消',
        danger = false,
        onConfirm = null,
        onCancel = null
    } = options;

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.id = 'confirmDialogOverlay';

    overlay.innerHTML = `
        <div class="dialog-popup${danger ? ' danger' : ''}">
            <div class="dialog-body">
                <div class="dialog-title">${title}</div>
                <div class="dialog-message">${message.replace(/\n/g, '<br>')}</div>
            </div>
            <div class="dialog-actions">
                <button class="btn-secondary" id="confirmDialogCancel">${cancelText}</button>
                <button class="btn-primary" id="confirmDialogOk">${confirmText}</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const close = () => {
        if (document.body.contains(overlay)) document.body.removeChild(overlay);
    };

    document.getElementById('confirmDialogOk').addEventListener('click', () => {
        close();
        if (onConfirm) onConfirm();
    });

    document.getElementById('confirmDialogCancel').addEventListener('click', () => {
        close();
        if (onCancel) onCancel();
    });
}

/**
 * 渲染结果到resultPageSection里
 */
function renderResultsInPage(userData, xiaResult, bmr, macros, compensationMsg) {
    const container = document.getElementById('resultContentInPage');
    if (!container) return;

    // 计算BMI
    const bmiValue = calculateBMI(userData.height, userData.weight);
    const bmiInfo = getBMIStatus(bmiValue);

    // 补偿信息显示（如果有）
    const compHtml = compensationMsg ? `
        <div class="msg-warning">
            ${compensationMsg}
        </div>
    ` : '';

    container.innerHTML = `
        <div style="margin-bottom:16px;">
            <button class="btn-secondary back-btn" onclick="backToProfileSelector()">
                ← 返回修改方案
            </button>
        </div>
        ${compHtml}
        <div class="result-summary">
            <div class="summary-item">
                <span class="summary-label">BMI</span>
                <span class="summary-value">${bmiValue.toFixed(1)}</span>
                <span class="summary-status ${bmiInfo.className}">${bmiInfo.status}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">基础代谢BMR</span>
                <span class="summary-value">${Math.round(bmr)}</span>
                <span class="summary-unit">kcal/天</span>
            </div>
            <div class="summary-item highlight">
                <span class="summary-label">每日总消耗TDEE</span>
                <span class="summary-value">${xiaResult.tdee}</span>
                <span class="summary-unit">kcal/天</span>
            </div>
        </div>
        <h3>🍽️ 每日营养目标</h3>
        <div class="macro-display">
            <div class="macro-item protein">
                <div class="macro-circle"><span class="macro-percent">${macros.protein.percent}%</span></div>
                <div class="macro-info">
                    <strong>蛋白质</strong>
                    <span>${macros.protein.grams}g</span>
                    <small>${macros.protein.kcal} kcal</small>
                </div>
            </div>
            <div class="macro-item fat">
                <div class="macro-circle"><span class="macro-percent">${macros.fat.percent}%</span></div>
                <div class="macro-info">
                    <strong>脂肪</strong>
                    <span>${macros.fat.grams}g</span>
                    <small>${macros.fat.kcal} kcal</small>
                </div>
            </div>
            <div class="macro-item carb">
                <div class="macro-circle"><span class="macro-percent">${macros.carb.percent}%</span></div>
                <div class="macro-info">
                    <strong>碳水</strong>
                    <span>${macros.carb.grams}g</span>
                    <small>${macros.carb.kcal} kcal</small>
                </div>
            </div>
            <div class="macro-item water">
                <div class="macro-circle" style="font-size:1.8rem;">💧</div>
                <div class="macro-info">
                    <strong>水</strong>
                    <span>1200~1500ml</span>
                    <small>白开水、茶水最佳</small>
                </div>
            </div>
        </div>
        <div id="mealPlanInPage"></div>
        <h3>⚠️ 注意事项</h3>
        <div class="warnings" id="warningsInPage"></div>
    `;

    // 渲染分餐方案
    let mealPlan = null;
    try {
        mealPlan = generateMealPlan(macros, getUserSeed());
        const mealPlanEl = document.getElementById('mealPlanInPage');
        if (mealPlanEl) mealPlanEl.innerHTML = renderMealPlanTable(mealPlan);
        // 生成成功后存入历史（供打卡和日历视图使用）
        savePlanToHistory(mealPlan);
    } catch(e) {
        console.warn('分餐方案渲染失败:', e);
    }
    // 渲染矿物质维生素达标率
    if (mealPlan && userData) {
        renderMVDashboard(mealPlan, userData);
    }
    // 渲染注意事项
    renderWarnings(userData, { bmr, tdee: xiaResult.tdee, macros }, 'warningsInPage');
}

// ============================================
// 每日打卡弹窗
// ============================================

/**
 * 显示昨日打卡弹窗
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {object} historyRecord - getDayHistory() 的返回
 * @param {string} [mode='checkin'] - 'checkin' | 'modify'
 */
function showCheckInPopup(dateStr, historyRecord, mode) {
    if (!historyRecord || !historyRecord.plan) return;
    mode = mode || 'checkin';

    // 重置自定义食物（修改模式也会重置，让用户重新调整）
    checkinCustomFoods = { '早餐': [], '午餐': [], '加餐': [], '晚餐': [] };

    const overlay = document.createElement('div');
    overlay.className = 'checkin-overlay';
    overlay.id = 'checkinOverlay';
    overlay.dataset.mode = mode;  // 存模式，提交时读取

    const popup = document.createElement('div');
    popup.className = 'checkin-popup';
    popup.innerHTML = buildCheckInHTML(dateStr, historyRecord.plan, mode);

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // 点击遮罩关闭
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeCheckInPopup();
    });

    // 初始化计算已勾选食物的营养值
    setTimeout(() => updateCheckinSummary(), 50);
}

/**
 * 生成打卡弹窗HTML
 * @param {string} dateStr
 * @param {object} plan
 * @param {string} mode - 'checkin' | 'modify'
 */
function buildCheckInHTML(dateStr, plan, mode) {
    mode = mode || 'checkin';
    const dateLabel = dateStr.replace(/-/g, '/');
    const weekDays = ['周日','周一','周二','周三','周四','周五','周六'];
    const d = new Date(dateStr);
    const weekDay = weekDays[d.getDay()];
    const isModify = (mode === 'modify');

    // 判断是今天还是昨天
    const today = new Date();
    const todayStr = todayLocal();
    const isToday = dateStr === todayStr;

    const headerText = isModify
        ? `修改打卡（${dateLabel} ${weekDay}）`
        : isToday
            ? `📋 今日饮食记录（${dateLabel} ${weekDay}）`
            : `昨天（${dateLabel} ${weekDay}）吃了吗？`;
    const headerIcon = isModify ? '✏️' : isToday ? '📋' : '📋';

    // 四餐勾选区块
    const meals = [
        { key: '早餐', data: plan.breakfast },
        { key: '午餐', data: plan.lunch },
        { key: '加餐', data: plan.snack },
        { key: '晚餐', data: plan.dinner }
    ];

    // 按时间窗预勾选：昨天/修改模式→全勾；今天→只看已过时间段的餐
    const currentHour = new Date().getHours();
    const MEAL_START_HOUR = { '早餐': 0, '午餐': 10, '加餐': 14, '晚餐': 17 };

    let mealsHtml = '';
    for (const meal of meals) {
        if (!meal.data || !meal.data.foods) continue;
        const shouldCheck = isModify ? true : isToday ? currentHour >= (MEAL_START_HOUR[meal.key] ?? 0) : true;
        const foodKeys = Object.keys(meal.data.foods);
        let foodHtml = '';
        for (const fk of foodKeys) {
            const food = meal.data.foods[fk];
            if (!food || !food.name) continue;
            foodHtml += `
                <label class="checkin-food-item">
                    <input type="checkbox" class="checkin-food-cb" ${shouldCheck ? 'checked' : ''}
                        data-meal="${meal.key}" data-food="${food.name}"
                        data-grams="${food.grams || 0}">
                    <span class="checkin-food-name">${food.name}</span>
                    <span class="checkin-food-grams">${food.grams || 0}g</span>
                </label>
            `;
        }
        if (foodHtml) {
            mealsHtml += `
                <div class="checkin-meal-section">
                    <div class="checkin-meal-title">${meal.key}</div>
                    ${foodHtml}
                    <div class="checkin-add-food" data-meal="${meal.key}">
                        + 添加食物
                    </div>
                    <div class="checkin-search-area" id="checkinSearch_${meal.key}" style="display:none">
                        <input type="text" class="checkin-search-input" placeholder="搜索食物名..."
                            data-meal="${meal.key}">
                        <div class="checkin-search-results" id="checkinResults_${meal.key}"></div>
                    </div>
                    <div class="checkin-custom-foods" id="checkinCustom_${meal.key}"></div>
                </div>
            `;
        }
    }

    // 底部实时统计
    return `
        <div class="checkin-header">
            <h3>${headerIcon} ${headerText}</h3>
            <button class="checkin-close-btn" onclick="closeCheckInPopup()">✕</button>
        </div>
        <div class="checkin-body">
            ${mealsHtml}
        </div>
        <div class="checkin-summary" id="checkinSummary">
            <div class="checkin-summary-hint">📊 实际摄入（自动计算，勾选/取消食物可调整）</div>
            <div class="checkin-summary-row">
                <span>能量</span>
                <span id="checkinEnergy" class="checkin-summary-val">-- kcal</span>
            </div>
            <div class="checkin-summary-row">
                <span>蛋白质</span>
                <span id="checkinProtein" class="checkin-summary-val">-- g</span>
            </div>
            <div class="checkin-summary-row">
                <span>碳水</span>
                <span id="checkinCarb" class="checkin-summary-val">-- g</span>
            </div>
            <div class="checkin-summary-row">
                <span>脂肪</span>
                <span id="checkinFat" class="checkin-summary-val">-- g</span>
            </div>
        </div>
        <div class="checkin-actions">
            <button class="btn-secondary" onclick="closeCheckInPopup()">${isModify ? '取消' : '跳过'}</button>
            <button class="btn-primary" onclick="submitCheckIn('${dateStr}')">✔ ${isModify ? '更新提交' : '确定提交'}</button>
        </div>
    `;
}

// ============================================
// 打卡弹窗 - 食物搜索
// ============================================

// 存储自定义添加的食物
let checkinCustomFoods = { '早餐': [], '午餐': [], '加餐': [], '晚餐': [] };

// 事件代理：点击「添加食物」展开搜索
document.addEventListener('click', function(e) {
    const addBtn = e.target.closest('.checkin-add-food');
    if (addBtn) {
        const meal = addBtn.dataset.meal;
        const searchArea = document.getElementById('checkinSearch_' + meal);
        if (searchArea) {
            const isVisible = searchArea.style.display !== 'none';
            searchArea.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) {
                const input = searchArea.querySelector('.checkin-search-input');
                if (input) { input.value = ''; input.focus(); }
                document.getElementById('checkinResults_' + meal).innerHTML = '';
            }
        }
    }
});

// 事件代理：搜索输入框实时过滤
document.addEventListener('input', function(e) {
    const input = e.target.closest('.checkin-search-input');
    if (input) {
        const meal = input.dataset.meal;
        const query = input.value.trim().toLowerCase();
        const resultsEl = document.getElementById('checkinResults_' + meal);
        if (!resultsEl) return;
        if (query.length < 1) { resultsEl.innerHTML = ''; return; }
        // 从FOOD_DATABASE搜索
        const matches = FOOD_DATABASE.filter(f =>
            f.name.toLowerCase().includes(query) ||
            (f.aliases && f.aliases.some(a => a.toLowerCase().includes(query)))
        ).slice(0, 10);
        resultsEl.innerHTML = matches.map(f => {
            const alreadyAdded = (checkinCustomFoods[meal] || []).some(c => c.name === f.name);
            return `<div class="checkin-search-item ${alreadyAdded ? 'disabled' : ''}"
                        onclick="${alreadyAdded ? '' : "selectSearchFood('" + meal + "','" + f.name.replace(/'/g, "\\'") + "')"}">
                        ${f.name}
                        <span class="checkin-search-cat">${f.category || ''}</span>
                        ${alreadyAdded ? '<span style="color:#999;font-size:0.75rem;">（已添加）</span>' : ''}
                    </div>`;
        }).join('');
    }
});

/**
 * 选中搜索结果 → 添加为自定义食物
 */
function selectSearchFood(meal, foodName) {
    if (!checkinCustomFoods[meal]) checkinCustomFoods[meal] = [];
    if (checkinCustomFoods[meal].some(c => c.name === foodName)) return; // 已存在
    
    // 查默认克数
    const foodData = findFoodNutrition(foodName);
    const defaultGrams = 100;
    checkinCustomFoods[meal].push({ name: foodName, grams: defaultGrams });
    
    // 重新渲染自定义食物区
    renderCustomFoods(meal);
    // 清空搜索结果
    const resultsEl = document.getElementById('checkinResults_' + meal);
    if (resultsEl) resultsEl.innerHTML = '';
    // 更新统计
    updateCheckinSummary();
}

/**
 * 渲染某餐的自定义食物列表
 */
function renderCustomFoods(meal) {
    const container = document.getElementById('checkinCustom_' + meal);
    if (!container) return;
    const foods = checkinCustomFoods[meal] || [];
    container.innerHTML = foods.map((f, i) => `
        <label class="checkin-food-item">
            <input type="checkbox" class="checkin-food-cb" checked
                data-meal="${meal}" data-food="${f.name}"
                data-grams="${f.grams}">
            <span class="checkin-food-name">${f.name}</span>
            <input type="number" class="checkin-custom-grams" value="${f.grams}"
                data-meal="${meal}" data-index="${i}"
                onchange="onCustomGramsChange(this)" min="1" max="999">
            <span class="checkin-food-grams">g</span>
            <span class="checkin-remove-food" onclick="removeCustomFood('${meal}',${i})">✕</span>
        </label>
    `).join('');
}

/**
 * 修改自定义食物克数
 */
function onCustomGramsChange(input) {
    const meal = input.dataset.meal;
    const idx = parseInt(input.dataset.index);
    const val = parseInt(input.value) || 0;
    if (checkinCustomFoods[meal] && checkinCustomFoods[meal][idx]) {
        checkinCustomFoods[meal][idx].grams = val;
        // 更新对应 checkbox 的 data-grams
        const checkbox = input.closest('.checkin-food-item').querySelector('.checkin-food-cb');
        if (checkbox) checkbox.dataset.grams = val;
        updateCheckinSummary();
    }
}

/**
 * 删除自定义食物
 */
function removeCustomFood(meal, index) {
    if (checkinCustomFoods[meal]) {
        checkinCustomFoods[meal].splice(index, 1);
        renderCustomFoods(meal);
        updateCheckinSummary();
    }
}

/**
 * 计算勾选食物的合计营养
 */
function calcCheckedNutrition() {
    const cbs = document.querySelectorAll('.checkin-food-cb:checked');
    let totalEnergy = 0;
    let totalProtein = 0;
    let totalCarb = 0;
    let totalFat = 0;
    for (const cb of cbs) {
        const name = cb.dataset.food;
        const grams = parseFloat(cb.dataset.grams) || 0;
        const foodData = findFoodNutrition(name);
        if (foodData && foodData.per100g) {
            const ratio = grams / 100;
            totalEnergy += (foodData.per100g.calories || 0) * ratio;
            totalProtein += (foodData.per100g.protein || 0) * ratio;
            totalCarb += (foodData.per100g.carbs || 0) * ratio;
            totalFat += (foodData.per100g.fat || 0) * ratio;
        }
    }
    return {
        energy: Math.round(totalEnergy),
        protein: Math.round(totalProtein),
        carb: Math.round(totalCarb),
        fat: Math.round(totalFat)
    };
}

/**
 * 更新弹窗底部统计
 */
function updateCheckinSummary() {
    const n = calcCheckedNutrition();
    const enEl = document.getElementById('checkinEnergy');
    const prEl = document.getElementById('checkinProtein');
    const caEl = document.getElementById('checkinCarb');
    const faEl = document.getElementById('checkinFat');
    if (enEl) enEl.textContent = `${n.energy} kcal`;
    if (prEl) prEl.textContent = `${n.protein} g`;
    if (caEl) caEl.textContent = `${n.carb} g`;
    if (faEl) faEl.textContent = `${n.fat} g`;
}

/**
 * 提交打卡
 * @param {string} dateStr
 */
function submitCheckIn(dateStr) {
    const actual = calcCheckedNutrition();
    // 保存实际数据
    updateCheckInData(dateStr, actual);
    // 标记已打卡
    const data = getCheckinData();
    data[dateStr] = true;
    saveCheckinData(data, dateStr);

    // 算偏差
    const userData = users[currentUser];
    if (userData && userData.xiaResult) {
        submitDeviation(actual.energy, userData.xiaResult.tdee, dateStr);
    }

    // 判断是否为修改模式
    const overlay = document.getElementById('checkinOverlay');
    const isModify = overlay && overlay.dataset.mode === 'modify';

    // 关闭打卡弹窗
    if (overlay) overlay.remove();

    // 获取方案数据（用于对比）
    const historyRecord = getDayHistory(dateStr);

    if (isModify) {
        // 修改模式：刷新日历详情，不重生成方案
        const { renderCalendarPage } = window;
        if (typeof renderCalendarPage === 'function') renderCalendarPage();
        showToast('✅ 打卡数据已更新', 'success');
        if (typeof addNotification === 'function') {
            addNotification('info', '📅', '打卡已更新', `实际摄入 ${actual.energy || 0} kcal`);
        }
    } else {
        // 正常打卡模式
        const idx = pendingProfileIndex;
        pendingProfileIndex = null;
        if (idx !== null) {
            // 打卡后继续生成方案
            selectLowCarbProfileForPage(idx);
        } else {
            // 直接打卡（无待办方案生成），显示对比结果
            showCheckinComparison(dateStr, actual, historyRecord);
            if (typeof addNotification === 'function') {
                addNotification('success', '📅', '打卡已提交', `实际摄入 ${actual.energy || 0} kcal · 蛋白${actual.protein || 0}g 脂肪${actual.fat || 0}g 碳水${actual.carb || 0}g`);
            }
        }
    }
}

/**
 * 显示打卡对比结果弹窗
 */
function showCheckinComparison(dateStr, actual, historyRecord) {
    if (!historyRecord || !historyRecord.plan) return;

    const plan = historyRecord.plan;
    const planMacros = plan.macros;
    if (!planMacros) return;

    const planEnergy = (planMacros.protein.kcal || 0) + (planMacros.fat.kcal || 0) + (planMacros.carb.kcal || 0);
    const actualEnergy = actual.energy || 0;

    // 计算偏差
    function diffStr(planVal, actualVal) {
        const d = actualVal - (planVal || 0);
        if (Math.abs(d) < 0.5) return '<span style="color:#4caf50;">✓ 符合</span>';
        const sign = d > 0 ? '+' : '';
        const cls = Math.abs(d) > 20 ? '#f44336' : Math.abs(d) > 10 ? '#ff9800' : '#4caf50';
        return `<span style="color:${cls};">${sign}${Math.round(d)}</span>`;
    }

    const overlay = document.createElement('div');
    overlay.className = 'checkin-overlay';
    overlay.innerHTML = `
        <div class="checkin-popup" style="max-width:500px;">
            <div style="text-align:center;margin-bottom:16px;">
                <div style="font-size:2.5rem;">📊</div>
                <h3 style="margin:8px 0 4px 0;">打卡完成！</h3>
                <p style="color:var(--text-light);font-size:0.9rem;margin:0;">
                    ${dateStr.replace(/-/g, '/')} 实际饮食 vs 方案对比
                </p>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:0.9rem;margin-bottom:16px;">
                <thead>
                    <tr style="border-bottom:2px solid #eee;">
                        <th style="padding:8px;text-align:left;"></th>
                        <th style="padding:8px;text-align:center;">方案</th>
                        <th style="padding:8px;text-align:center;">实际</th>
                        <th style="padding:8px;text-align:center;">偏差</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom:1px solid #f0f0f0;">
                        <td style="padding:8px;font-weight:600;">🔥 能量</td>
                        <td style="padding:8px;text-align:center;">${planEnergy} kcal</td>
                        <td style="padding:8px;text-align:center;">${actualEnergy} kcal</td>
                        <td style="padding:8px;text-align:center;">${diffStr(planEnergy, actualEnergy)}</td>
                    </tr>
                    <tr style="border-bottom:1px solid #f0f0f0;">
                        <td style="padding:8px;font-weight:600;">🥩 蛋白质</td>
                        <td style="padding:8px;text-align:center;">${planMacros.protein.grams || 0}g</td>
                        <td style="padding:8px;text-align:center;">${actual.protein || 0}g</td>
                        <td style="padding:8px;text-align:center;">${diffStr(planMacros.protein.grams, actual.protein)}</td>
                    </tr>
                    <tr style="border-bottom:1px solid #f0f0f0;">
                        <td style="padding:8px;font-weight:600;">🥑 脂肪</td>
                        <td style="padding:8px;text-align:center;">${planMacros.fat.grams || 0}g</td>
                        <td style="padding:8px;text-align:center;">${actual.fat || 0}g</td>
                        <td style="padding:8px;text-align:center;">${diffStr(planMacros.fat.grams, actual.fat)}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px;font-weight:600;">🍚 碳水</td>
                        <td style="padding:8px;text-align:center;">${planMacros.carb.grams || 0}g</td>
                        <td style="padding:8px;text-align:center;">${actual.carb || 0}g</td>
                        <td style="padding:8px;text-align:center;">${diffStr(planMacros.carb.grams, actual.carb)}</td>
                    </tr>
                </tbody>
            </table>
            <div style="text-align:center;">
                <button class="btn-primary" onclick="this.closest('.checkin-overlay').remove(); autoGenerateDailyPlan();">
                    ✅ 知道了，刷新方案
                </button>
            </div>
        </div>
    `;

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
            autoGenerateDailyPlan();
        }
    });

    document.body.appendChild(overlay);
}

/**
 * 跳过打卡
 */
function closeCheckInPopup() {
    const overlay = document.getElementById('checkinOverlay');
    if (!overlay) return;

    const isModify = overlay.dataset.mode === 'modify';
    overlay.remove();

    if (isModify) {
        // 修改模式取消：关闭弹窗，不标记跳过，不重生成
        return;
    }

    // 正常模式：标记昨天为「跳过」，下次不再弹
    const yesterday = getYesterdayStr();
    const data = getCheckinData();
    data[yesterday] = 'skipped';
    saveCheckinData(data, yesterday);

    // 重新触发方案生成
    const idx = pendingProfileIndex;
    pendingProfileIndex = null;
    if (idx !== null) {
        selectLowCarbProfileForPage(idx);
    }
}

// 给 checkin-food-cb 绑定变更事件（代理监听）
document.addEventListener('change', function(e) {
    if (e.target && e.target.classList.contains('checkin-food-cb')) {
        updateCheckinSummary();
    }
});
async function selectLowCarbProfile(profileIndex) {
    const userData = users[currentUser];
    if (!userData || !userData.xiaResult) {
        showToast('请先填写基本信息', 'error');
        return;
    }

    const profile = lowCarbProfiles[profileIndex];
    const ratio = {
        protein: profile['蛋白质比例'],
        fat: profile['脂肪比例'],
        carb: profile['碳水默认']
    };

    const bmr = calculateBMR(userData.gender, userData.age, userData.height, userData.weight);
    const remote = await fetchRemoteCalculation(
        userData.height, userData.weight, userData.age, userData.activity, ratio, userData.gender
    );
    if (!remote) return;
    const macros = remote.macros;

    // 隐藏档位选择，显示结果
    document.getElementById('profileSelectorSection').style.display = 'none';
    document.getElementById('resultSection').style.display = 'block';

    renderResults_XiaMeng(userData, userData.xiaResult, bmr, macros);

    showToast(`✅ 已选择「${profile['方案名称']}」，营养方案已生成`, 'success');
}

/**
 * 在结果页渲染GX方法的计算明细
 */
function renderXiaMengDetail(r) {
    // 在 tdeeValue 后面插入一行说明（如果已存在则更新）
    const tdeeValueEl = document.getElementById('tdeeValue');
    if (!tdeeValueEl) return;

    let detailEl = document.getElementById('xiaMengDetail');
    if (!detailEl) {
        detailEl = document.createElement('div');
        detailEl.id = 'xiaMengDetail';
        detailEl.className = 'xia-meng-detail';
        tdeeValueEl.closest('.summary-item').appendChild(detailEl);
    }

    detailEl.innerHTML = `
        <div class="xia-detail-row"><span>标准体重</span><strong>${r.stdWeight} kg</strong></div>
        <div class="xia-detail-row"><span>使用体重</span><strong>${r.weightType} ${r.targetWeight} kg</strong></div>
        <div class="xia-detail-row"><span>能量系数</span><strong>${r.energyCoeff} kcal/kg</strong></div>
        <div class="xia-detail-row"><span>年龄系数</span><strong>${r.ageFactor}</strong></div>
        <div class="xia-detail-formula">${r.targetWeight} × ${r.energyCoeff} × ${r.ageFactor} = <b>${r.tdee} kcal/d</b></div>
    `;
}

//////////////////////////////////////////////////
// 以下是原有 renderResults 函数（保留作对比，暂未删除）
//////////////////////////////////////////////////

/**
 * 渲染计算结果（原Mifflin-St Jeor方法，保留）
 */
function renderResults(formData, results) {
    const resultSection = document.getElementById('resultSection');
    const inputSection = document.getElementById('inputSection');

    // 显示结果区，隐藏输入区
    resultSection.style.display = 'block';
    inputSection.style.display = 'none';

    // 基本信息
    document.getElementById('resultName').textContent = formData.name;

    // BMI
    const bmiValue = calculateBMI(formData.height, formData.weight);
    const bmiInfo = getBMIStatus(bmiValue);
    document.getElementById('bmiValue').textContent = bmiValue.toFixed(1);
    const bmiStatus = document.getElementById('bmiStatus');
    bmiStatus.textContent = bmiInfo.status;
    bmiStatus.className = `summary-status ${bmiInfo.className}`;

    // BMR & TDEE
    document.getElementById('bmrValue').textContent = Math.round(results.bmr);
    document.getElementById('tdeeValue').textContent = Math.round(results.tdee);

    // 三大营养素
    const macros = results.macros;

    // 更新圆形进度
    updateMacroCircle('protein', macros.protein.percent);
    updateMacroCircle('fat', macros.fat.percent);
    updateMacroCircle('carb', macros.carb.percent);

    document.getElementById('proteinPercent').textContent = `${macros.protein.percent}%`;
    document.getElementById('proteinGrams').textContent = `${macros.protein.grams}g`;
    document.getElementById('proteinKcal').textContent = `${macros.protein.kcal} kcal`;

    document.getElementById('fatPercent').textContent = `${macros.fat.percent}%`;
    document.getElementById('fatGrams').textContent = `${macros.fat.grams}g`;
    document.getElementById('fatKcal').textContent = `${macros.fat.kcal} kcal`;

    document.getElementById('carbPercent').textContent = `${macros.carb.percent}%`;
    document.getElementById('carbGrams').textContent = `${macros.carb.grams}g`;
    document.getElementById('carbKcal').textContent = `${macros.carb.kcal} kcal`;

    // 食物换算
    renderFoodExchange(macros);

    // 注意事项
    renderWarnings(formData, results);

    // 保存当前用户数据（保留已有属性如 xiaResult）
    users[currentUser] = {
        ...users[currentUser],
        formData: { ...formData },
        results: { ...results },
    };

    // 更新URL参数（用于分享）
    updateURLParams(formData);

    // 滚动到结果
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * 更新营养素圆形显示
 */
function updateMacroCircle(type, percent) {
    const circle = document.getElementById(`${type}Circle`);
    const colors = {
        protein: 'var(--protein)',
        fat: 'var(--fat)',
        carb: 'var(--carb)',
    };
    circle.style.background = `conic-gradient(${colors[type]} ${percent}%, #e0e0e0 0%)`;
}

/**
 * 渲染食物换算
 */
function renderFoodExchange(macros, containerId = 'foodExchange') {
    const container = document.getElementById(containerId);
    const exchange = calculateFoodExchange(macros.protein.grams, macros.fat.grams, macros.carb.grams);

    let html = '';

    // 蛋白质食物
    exchange.proteinSources.forEach(food => {
        html += `
        <div class="food-item">
            <span class="food-icon">${food.icon}</span>
            <div class="food-details">
                <strong>${food.name}</strong>
                <small>约${food.grams}g/天</small>
            </div>
        </div>`;
    });

    // 脂肪食物
    exchange.fatSources.forEach(food => {
        html += `
        <div class="food-item">
            <span class="food-icon">${food.icon}</span>
            <div class="food-details">
                <strong>${food.name}</strong>
                <small>约${food.grams}g/天</small>
            </div>
        </div>`;
    });

    // 碳水食物（需要控制）
    exchange.carbSources.forEach(food => {
        html += `
        <div class="food-item">
            <span class="food-icon">${food.icon}</span>
            <div class="food-details">
                <strong>${food.name} <small style="color:var(--warning)">⚠️控量</small></strong>
                <small>约${food.grams}g/天</small>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

/**
 * 渲染注意事项
 */
function renderWarnings(formData, results, containerId = 'warnings') {
    const container = document.getElementById(containerId);
    const warnings = [];

    // 基础建议
    warnings.push({ type: 'success', text: '普通人每天饮水1200～1500ml，通过观察口渴感、尿液颜色和排尿频率来判断是否合适，天热或运动多时要多喝水' });
    warnings.push({ type: 'success', text: '优先选择深色蔬菜，每天不少于500g' });
    warnings.push({ type: 'success', text: '蛋白质分3-4餐摄入，避免集中过多' });

    // 根据BMI给出建议
    const bmi = calculateBMI(formData.height, formData.weight);
    if (bmi >= 24) {
        warnings.push({ type: 'normal', text: '体重偏高，建议碳水摄入取下限，脂肪适度增加' });
    }
    if (bmi >= 28) {
        warnings.push({ type: 'normal', text: '体重偏高，建议控制碳水摄入，优先选择低GI食物' });
    }

    if (formData.activity === '1.9') {
        warnings.push({ type: 'danger', text: '⚠️ 重体力劳动者需注意能量充足摄入，避免过度节食' });
    }

    if (formData.age > 60) {
        warnings.push({ type: 'normal', text: '60岁以上人群需注意营养均衡，保证足量蛋白质摄入' });
    }

    let html = '<ul>';
    warnings.forEach(w => {
        html += `<li class="${w.type}">${w.text}</li>`;
    });
    html += '</ul>';
    container.innerHTML = html;
}

// ============================================
// URL参数分享功能
// ============================================

/**
 * 更新URL参数
 */
function updateURLParams(data) {
    const params = new URLSearchParams();
    params.set('u', currentUser);
    params.set('n', data.name);
    params.set('g', data.gender === 'male' ? '1' : '0');
    params.set('a', data.age);
    params.set('h', data.height);
    params.set('w', data.weight);
    params.set('v', data.activity);

    const newURL = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newURL);
}

/**
 * 从URL加载参数
 */
async function loadFromURL() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('u')) {
        const userIndex = parseInt(params.get('u')) || 0;
        switchUser(userIndex);
    }
    if (params.has('n')) {
        const data = {
            name: params.get('n'),
            gender: params.get('g') === '1' ? 'male' : 'female',
            age: parseInt(params.get('a')) || 40,
            height: parseFloat(params.get('h')) || 170,
            weight: parseFloat(params.get('w')) || 70,
            activity: parseFloat(params.get('v')) || 1.55,
        };
        populateForm(data);

        // 自动计算（从云端API获取）
        const resp = await apiCalculateAdult({
            height: data.height,
            weight: data.weight,
            age: data.age,
            activity: data.activity,
            tier: { carbPct: 55, proteinPct: 15, fatPct: 30 } // 默认比例
        });
        if (!resp.success) {
            showToast('计算服务异常', 'error');
            return;
        }
        const xiaResult = extractXiaResult(resp.data);
        const macros = enrichMacros(resp.data.macros);
        const bmr = calculateBMR(data.gender, data.age, data.height, data.weight);

        renderResults_XiaMeng(data, xiaResult, bmr, macros);
    }
}

/**
 * 分享功能
 */
function showShareModal() {
    const url = window.location.href;

    const overlay = document.createElement('div');
    overlay.className = 'share-overlay';
    overlay.innerHTML = `
        <div class="modal">
            <h3>🔗 分享你的营养方案</h3>
            <p>复制以下链接，分享给家人朋友<br>每个人的数据是独立的，互不影响</p>
            <input type="text" class="share-url" value="${url}" readonly onclick="this.select()">
            <button class="close-btn" onclick="this.closest('.share-overlay').remove()">关闭</button>
        </div>
    `;
    document.body.appendChild(overlay);

    // 点击遮罩关闭
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

// ============================================
// 用户切换
// ============================================

function switchUser(index) {
    if (index < 0 || index >= MAX_USERS) return;

    currentUser = index;

    // 更新标签样式
    document.querySelectorAll('.tab-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
    });

    // 加载该用户数据到表单
    const userData = users[index];
    if (userData && userData.formData) {
        populateForm(userData.formData);
        // 如果有计算结果也显示
        if (userData.results) {
            renderResults(userData.formData, userData.results);
        } else {
            hideResults();
        }
    } else {
        // 清空表单
        document.getElementById('name').value = `用户${index + 1}`;
        hideResults();
    }
}

function hideResults() {
    document.getElementById('resultSection').style.display = 'none';
    document.getElementById('inputSection').style.display = 'block';
}

// ============================================
// 矿物质&维生素达标率
// ============================================

/** 从Supabase查询推荐摄入量 */
async function getRDI(age, gender) {
    try {
        const sb = getSupabase();
        if (!sb) return null;
        const group = getAgeGroup(age);
        const gen = getGenderLabel(gender);
        const { data, error } = await sb
            .from('dietary_reference_intakes')
            .select('*')
            .eq('age_group', group)
            .eq('gender', gen)
            .limit(1);
        if (error || !data || data.length === 0) return null;
        return data[0];
    } catch(e) {
        console.warn('获取推荐摄入量失败:', e);
        return null;
    }
}

/** 从分餐方案计算矿物质维生素总摄入量 */
function calcMVIntake(mealPlan) {
    if (!mealPlan) return null;
    const totals = {};
    const meals = ['breakfast', 'lunch', 'snack', 'dinner'];
    
    for (const meal of meals) {
        const foods = mealPlan[meal]?.foods;
        if (!foods) continue;
        for (const key of Object.keys(foods)) {
            const item = foods[key];
            if (!item || !item.name || !item.grams || item.grams <= 0) continue;
            
            // 从FOOD_DATABASE找食物ID
            const foodData = findFoodNutrition(item.name);
            if (!foodData || !foodData.id) continue;
            
            // 从MINERALS_VITAMINS查找矿物质数据
            const mv = typeof MINERALS_VITAMINS !== 'undefined' ? MINERALS_VITAMINS[foodData.id] : null;
            if (!mv) continue;
            
            const factor = item.grams / 100;
            
            // 累加所有字段
            const fields = ['ca','fe','zn','se','va','vb1','vb2','vc','vd','ve',
                          'k','na','p','mag','cu','mn','iodine',
                          'vb6','vb12','niacin','folate','vk','pantothenic','biotin'];
            for (const f of fields) {
                const val = mv[f];
                if (val !== null && val !== undefined) {
                    totals[f] = (totals[f] || 0) + val * factor;
                }
            }
        }
    }
    return totals;
}

/** 渲染矿物质维生素达标率 */
function renderMVDashboard(mealPlan, userData) {
    const container = document.getElementById('mvDashboard');
    const card = document.getElementById('mvDashboardCard');
    if (!container || !card) return;
    
    const mvIntake = calcMVIntake(mealPlan);
    const showAdvanced = false; // 默认折叠
    
    // 异步获取RDI
    getRDI(userData.age, userData.gender).then(rdi => {
        if (!rdi) {
            card.style.display = 'none';
            return;
        }
        card.style.display = 'block';
        
        // 核心10字段定义（维D通过日晒合成，此处不显示）
        const coreFields = [
            { key: 'ca', icon: '🦴', name: '钙', rdiKey: 'ca_mg', unit: 'mg', decimal: 0 },
            { key: 'fe', icon: '🩸', name: '铁', rdiKey: 'fe_mg', unit: 'mg', decimal: 0 },
            { key: 'zn', icon: '🧬', name: '锌', rdiKey: 'zn_mg', unit: 'mg', decimal: 1 },
            { key: 'se', icon: '🛡️', name: '硒', rdiKey: 'se_μg', unit: 'μg', decimal: 0 },
            { key: 'va', icon: '👁️', name: '维A', rdiKey: 'va_μg', unit: 'μg', decimal: 0 },
            { key: 'vb1', icon: '⚡', name: '维B₁', rdiKey: 'vb1_mg', unit: 'mg', decimal: 1 },
            { key: 'vb2', icon: '💪', name: '维B₂', rdiKey: 'vb2_mg', unit: 'mg', decimal: 1 },
            { key: 'vc', icon: '🍊', name: '维C', rdiKey: 'vc_mg', unit: 'mg', decimal: 0 },
            { key: 've', icon: '💧', name: '维E', rdiKey: 've_mg', unit: 'mg', decimal: 1 },
        ];
        
        // 进阶14字段
        const advFields = [
            { key: 'k', icon: '🔋', name: '钾', rdiKey: 'k_mg', unit: 'mg', decimal: 0 },
            { key: 'na', icon: '🧂', name: '钠', rdiKey: 'na_mg', unit: 'mg', decimal: 0 },
            { key: 'p', icon: '🦴', name: '磷', rdiKey: 'p_mg', unit: 'mg', decimal: 0 },
            { key: 'mag', icon: '⚙️', name: '镁', rdiKey: 'mag_mg', unit: 'mg', decimal: 0 },
            { key: 'cu', icon: '🔩', name: '铜', rdiKey: 'cu_mg', unit: 'mg', decimal: 2 },
            { key: 'mn', icon: '📎', name: '锰', rdiKey: 'mn_mg', unit: 'mg', decimal: 1 },
            { key: 'iodine', icon: '🧪', name: '碘', rdiKey: 'iodine_μg', unit: 'μg', decimal: 0 },
            { key: 'vb6', icon: '⚡', name: '维B₆', rdiKey: 'vb6_mg', unit: 'mg', decimal: 2 },
            { key: 'vb12', icon: '🔵', name: '维B₁₂', rdiKey: 'vb12_μg', unit: 'μg', decimal: 1 },
            { key: 'niacin', icon: '🔥', name: '烟酸', rdiKey: 'niacin_mg', unit: 'mg', decimal: 1 },
            { key: 'folate', icon: '🍃', name: '叶酸', rdiKey: 'folate_μg', unit: 'μg', decimal: 0 },
            { key: 'vk', icon: '🩹', name: '维K', rdiKey: 'vk_μg', unit: 'μg', decimal: 0 },
            { key: 'pantothenic', icon: '💊', name: '泛酸', rdiKey: 'pantothenic_mg', unit: 'mg', decimal: 2 },
            { key: 'biotin', icon: '🧫', name: '生物素', rdiKey: 'biotin_μg', unit: 'μg', decimal: 0 },
        ];
        
        function renderField(field, isIntake, hasRdi) {
            const intake = mvIntake ? Math.round((mvIntake[field.key] || 0) * (field.decimal === 0 ? 1 : 10)) / (field.decimal === 0 ? 1 : 10) : 0;
            const target = rdi[field.rdiKey];
            const rdiVal = target ? Math.round(target) : null;
            
            if (!hasRdi || rdiVal === null || rdiVal <= 0) {
                return ''; // RDI为空时直接跳过，不显示
            }
            
            const actual = Math.round(intake);
            const pct = Math.min(Math.round(actual / rdiVal * 100), 999);
            let cls = 'green';
            if (pct < 50) cls = 'red';
            else if (pct < 80) cls = 'orange';
            else if (pct < 100) cls = 'blue';
            
            return `
                <div class="mv-item">
                    <span class="mv-icon">${field.icon}</span>
                    <span class="mv-label">${field.name}</span>
                    <div class="mv-bar-wrap">
                        <div class="mv-bar-bg">
                            <div class="mv-bar-fill ${cls}" style="width:${Math.min(pct, 100)}%"></div>
                        </div>
                    </div>
                    <span class="mv-values">${actual}${field.unit} / ${rdiVal}${field.unit}</span>
                    <span class="mv-pct ${cls}">${pct > 100 ? '>100' : pct}%</span>
                </div>`;
        }
        
        // 检查RDI是否有数据
        const hasRdi = coreFields.some(f => {
            const v = rdi[f.rdiKey];
            return v !== null && v !== undefined && v > 0;
        });
        
        let html = '<div class="mv-dashboard">';
        
        // 核心10字段
        html += '<div class="mv-core">';
        for (const field of coreFields) {
            html += renderField(field, mvIntake, hasRdi);
        }
        html += '</div>';
        
        // 进阶14字段（折叠）
        html += `<button class="mv-toggle" onclick="toggleMVAdvanced()">📋 展开全部14种进阶营养素 ▸</button>`;
        html += `<div class="mv-advanced" id="mvAdvanced">`;
        for (const field of advFields) {
            html += renderField(field, mvIntake, hasRdi);
        }
        html += '</div>';
        
        // 维生素D提示
        html += '<div class="mv-vd-tip">☀️ <strong>维生素D</strong> 主要通过皮肤经日晒合成，食物来源有限。建议每天户外活动15-30分钟。</div>';
        
        html += '</div>';
        container.innerHTML = html;
    }).catch(() => {
        card.style.display = 'none';
    });
}

/** 切换进阶营养素折叠状态 */
function toggleMVAdvanced() {
    const el = document.getElementById('mvAdvanced');
    const btn = el?.previousElementSibling;
    if (!el) return;
    const show = !el.classList.contains('show');
    el.classList.toggle('show', show);
    if (btn) btn.textContent = show ? '📋 收起进阶营养素 ▾' : '📋 展开全部14种进阶营养素 ▸';
}

function addUser() {
    // 简单实现：切换到下一个空槽
    for (let i = 0; i < MAX_USERS; i++) {
        if (Object.keys(users[i]).length === 0) {
            switchUser(i);
            break;
        }
    }
}

/**
 * 食物数据库相关函数
 */

// 当前选中的分类
let currentFoodCategory = null;

/**
 * 显示食物数据库页面
 */
function showFoodDatabase() {
    renderNav('nav-foodDbSection', 'foodDb');
    hideAllSections();
    $show('foodDbSection');

    // 初始化食物库
    initFoodDatabase();

    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * 初始化食物数据库
 */
function initFoodDatabase() {
    // 渲染分类筛选按钮
    const filterRow = document.getElementById('foodFilterRow');
    filterRow.innerHTML = '<button class="food-filter-btn active" onclick="setFoodCategory(null)">全部</button>';
    getCategories().forEach(cat => {
        filterRow.innerHTML += `<button class="food-filter-btn" onclick="setFoodCategory('${cat}')">${cat}</button>`;
    });

    // 渲染网格
    renderFoodDbGrid();
}

/**
 * 设置食物分类筛选
 */
function setFoodCategory(cat) {
    currentFoodCategory = cat;
    document.querySelectorAll('.food-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === (cat || '全部'));
    });
    renderFoodDbGrid();
}

/**
 * 渲染食物数据库网格
 */
function renderFoodDbGrid() {
    const query = document.getElementById('foodSearchInput').value;
    let foods = searchFood(query);

    if (currentFoodCategory) {
        foods = foods.filter(f => f.category === currentFoodCategory);
    }

    // 更新统计
    document.getElementById('foodTotalCount').textContent = FOOD_DATABASE.length;
    document.getElementById('foodCategoryCount').textContent = getCategories().length;

    const grid = document.getElementById('foodDbGrid');

    if (foods.length === 0) {
        grid.innerHTML = '<div class="food-empty">没有找到匹配的食物</div>';
        return;
    }

    grid.innerHTML = foods.map(food => {
        const omega3Val = food.per100g.omega3 || 0;
        const omega6Val = food.per100g.omega6 || 0;
        const ratioInfo = getOmegaRatioInfo(omega3Val, omega6Val);

        // 判断高亮类型
        const isEgg = food.category === '蛋类';
        const isOil = food.category === '油脂类';
        const isHighOmega3 = omega3Val > 500;

        let cardClass = 'food-card';
        if (isEgg) cardClass += ' egg-highlight';
        if (isOil) cardClass += ' oil-highlight';
        if (isHighOmega3 && !isOil) cardClass += ' high-omega3';

        return `
            <div class="${cardClass}" id="food-${food.id}">
                <div class="food-card-header">
                    <span class="food-card-name">${food.name}</span>
                    <span class="food-card-category">${food.category}</span>
                </div>
                <div class="food-card-aliases">别名：${food.aliases ? food.aliases.join(' / ') : '无'}</div>

                <div class="food-card-nutrition">
                    <div class="nutri-box">
                        <div class="nutri-box-value">${food.per100g.calories}</div>
                        <div class="nutri-box-label">热量(kcal)</div>
                    </div>
                    <div class="nutri-box">
                        <div class="nutri-box-value">${food.per100g.protein}</div>
                        <div class="nutri-box-label">蛋白质(g)</div>
                    </div>
                    <div class="nutri-box">
                        <div class="nutri-box-value">${food.per100g.fat}</div>
                        <div class="nutri-box-label">脂类(g)</div>
                    </div>
                    <div class="nutri-box">
                        <div class="nutri-box-value">${food.per100g.carbs}</div>
                        <div class="nutri-box-label">碳水(g)</div>
                    </div>
                    <div class="nutri-box">
                        <div class="nutri-box-value">${food.per100g.fiber}</div>
                        <div class="nutri-box-label">纤维(g)</div>
                    </div>
                    <div class="nutri-box">
                        <div class="nutri-box-value">${food.per100g.cholesterol}</div>
                        <div class="nutri-box-label">胆固醇(mg)</div>
                    </div>
                    <div class="nutri-box omega3">
                        <div class="nutri-box-value">${omega3Val}</div>
                        <div class="nutri-box-label">omega3(mg)</div>
                    </div>
                    <div class="nutri-box omega6">
                        <div class="nutri-box-value">${omega6Val}</div>
                        <div class="nutri-box-label">omega6(mg)</div>
                    </div>
                    ${renderMVBox(food, 'minerals')}
                    ${renderMVBox(food, 'vitamins')}
                </div>

                <div class="food-card-fat-ratio">
                    <div class="fat-ratio-title">🥦 脂肪酸比例（建议 1:4 ~ 1:6）</div>
                    <div class="fat-ratio-row">
                        <span class="fat-ratio-label">omega6 : omega3</span>
                        <span class="fat-ratio-value ${ratioInfo.className}">${ratioInfo.text}</span>
                    </div>
                    <div class="fat-ratio-suggestion">${ratioInfo.suggestion}</div>
                </div>

                <div class="food-card-calc">
                    <label>计算摄入：</label>
                    <input type="number" value="100" min="1" max="2000"
                           onchange="updateFoodCalc(this, ${food.id})">
                    <span>克</span>
                    <span class="calc-result" id="food-calc-${food.id}">—</span>
                </div>
            </div>
        `;
    }).join('');

    // 初始化计算结果
    document.querySelectorAll('.food-card-calc input').forEach(input => {
        const foodId = parseInt(input.closest('.food-card').id.replace('food-', ''));
        updateFoodCalc(input, foodId);
    });
}

/**
 * 更新食物计算结果
 */
function updateFoodCalc(input, foodId) {
    const food = getFoodById(foodId);
    if (!food) return;

    const grams = parseInt(input.value) || 100;
    const factor = grams / 100;

    const cal = Math.round(food.per100g.calories * factor);
    const pro = (food.per100g.protein * factor).toFixed(1);
    const fat = (food.per100g.fat * factor).toFixed(1);
    const carbs = (food.per100g.carbs * factor).toFixed(1);
    const o3 = Math.round((food.per100g.omega3 || 0) * factor);
    const o6 = Math.round((food.per100g.omega6 || 0) * factor);

    const resultEl = document.getElementById(`food-calc-${foodId}`);
    if (resultEl) {
        resultEl.textContent = `${cal}kcal | 蛋白${pro}g | 脂类${fat}g | o3:${o3}mg | o6:${o6}mg`;
    }
}

/**
 * 生成矿物质或维生素 nutri-box 方块（含hover弹出popup）
 * @param {Object} food - 食物对象
 * @param {string} type - 'minerals' | 'vitamins'
 */
function renderMVBox(food, type) {
    const mv = food.per100g;
    const isMinerals = type === 'minerals';

    const unitMap = {
        ca: 'mg', fe: 'mg', zn: 'mg', se: 'μg',
        k: 'mg', na: 'mg', p: 'mg', mag: 'mg', cu: 'mg', mn: 'mg', iodine: 'μg',
        va: 'μg', vb1: 'mg', vb2: 'mg', vc: 'mg', vd: 'μg', ve: 'mg',
        vb6: 'mg', vb12: 'μg', folate: 'μg', vk: 'μg', niacin: 'mg',
        pantothenic: 'mg', biotin: 'μg'
    };

    const mineralLabels = { ca: '钙', fe: '铁', zn: '锌', se: '硒', k: '钾', na: '钠', p: '磷', mag: '镁', cu: '铜', mn: '锰', iodine: '碘' };
    const vitaminLabels = { va: '维A', vb1: 'B1', vb2: 'B2', vc: '维C', vd: '维D', ve: '维E', vb6: 'B6', vb12: 'B12', folate: '叶酸', vk: '维K', niacin: '烟酸', pantothenic: '泛酸', biotin: '生物素' };

    const mineralFields = ['ca', 'fe', 'zn', 'se', 'k', 'na', 'p', 'mag', 'cu', 'mn', 'iodine'];
    const vitaminFields = ['va', 'vb1', 'vb2', 'vc', 'vd', 've', 'vb6', 'vb12', 'folate', 'vk', 'niacin', 'pantothenic', 'biotin'];

    const fields = isMinerals ? mineralFields : vitaminFields;
    const labels = isMinerals ? mineralLabels : vitaminLabels;
    const dataObj = mv[type];

    // 统计有数据的字段数
    const hasCount = dataObj ? fields.filter(k => dataObj[k] !== null && dataObj[k] !== undefined).length : 0;

    // 弹层内容
    const itemsHtml = fields.map(key => {
        const val = dataObj?.[key];
        const display = val !== null && val !== undefined
            ? `<span class="mv-value">${val}${unitMap[key] || ''}</span>`
            : `<span class="mv-null">—</span>`;
        return `<div class="food-card-mv-item"><span class="mv-label">${labels[key]}</span>${display}</div>`;
    }).join('');

    return `
        <div class="nutri-box nutri-box-mv ${type}" tabindex="0">
            <div class="nutri-box-value">${isMinerals ? '🧂' : '💊'}</div>
            <div class="nutri-box-label">${isMinerals ? '矿物质' : '维生素'}<span class="mv-count">${hasCount}</span></div>
            <div class="nutri-box-mv-popup">
                <div class="mv-popup-title">${isMinerals ? '矿物质（每100g）' : '维生素（每100g）'}</div>
                <div class="mv-popup-grid">
                    ${itemsHtml}
                </div>
            </div>
        </div>
    `;
}

// ============================================
// 主计算函数
// ============================================

/**
 * 在计算器页面显示已保存的基本信息摘要
 */
function renderBasicInfoSummary() {
    const el = document.getElementById('basicInfoSummary');
    if (!el) return;
    const info = loadBasicInfo();
    if (!info) {
        el.innerHTML = ''; // 无信息时不显示提示，由 autoGenerateDailyPlan 统一处理编辑表单
        return;
    }
    const genderMap = { male: '男', female: '女' };
    const activityMap = { '1.2': '卧床', '1.375': '轻体力', '1.55': '中体力', '1.725': '重体力' };
    el.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.9rem;">
            <span><strong>姓名：</strong>${info.name || '未填'}</span>
            <span><strong>性别：</strong>${genderMap[info.gender] || '未填'}</span>
            <span><strong>年龄：</strong>${info.age || '-'} 岁</span>
            <span><strong>身高：</strong>${info.height || '-'} cm</span>
            <span><strong>体重：</strong>${info.weight || '-'} kg</span>
            <span><strong>活动水平：</strong>${activityMap[String(info.activity)] || '未填'}</span>
        </div>
    `;

    // 回填内联编辑表单
    const editIdMap = {
        calcEditName: 'name', calcEditGender: 'gender', calcEditAge: 'age',
        calcEditHeight: 'height', calcEditWeight: 'weight', calcEditActivity: 'activity'
    };
    for (const [inputId, field] of Object.entries(editIdMap)) {
        const el2 = document.getElementById(inputId);
        if (el2 && info[field] !== undefined) el2.value = info[field];
    }
}

/**
 * 切换计算器页面的内联编辑模式
 */
function toggleCalcEdit() {
    const form = document.getElementById('calcEditForm');
    const summary = document.getElementById('basicInfoSummary');
    const btn = document.getElementById('calcEditBtn');
    if (!form) return;
    const isHidden = form.style.display === 'none' || !form.style.display;
    form.style.display = isHidden ? 'block' : 'none';
    if (summary) summary.style.display = isHidden ? 'none' : 'block';
    if (btn) btn.textContent = isHidden ? '🔽 收起' : '✏️ 修改信息';
}

/**
 * 取消计算器页面的内联编辑
 */
function cancelCalcEdit() {
    const form = document.getElementById('calcEditForm');
    const summary = document.getElementById('basicInfoSummary');
    const btn = document.getElementById('calcEditBtn');
    if (form) form.style.display = 'none';
    if (summary) summary.style.display = 'block';
    if (btn) btn.textContent = '✏️ 修改信息';
    const msg = document.getElementById('calcEditMsg');
    if (msg) msg.textContent = '';
}

/**
 * 保存计算器页面的内联编辑
 */
function saveCalcBasicInfo() {
    const data = {
        name: document.getElementById('calcEditName')?.value || '',
        gender: document.getElementById('calcEditGender')?.value || 'male',
        age: parseInt(document.getElementById('calcEditAge')?.value) || 30,
        height: parseFloat(document.getElementById('calcEditHeight')?.value) || 170,
        weight: parseFloat(document.getElementById('calcEditWeight')?.value) || 70,
        activity: parseFloat(document.getElementById('calcEditActivity')?.value) || 1.55
    };

    if (!data.height || !data.weight || !data.age) {
        const msg = document.getElementById('calcEditMsg');
        if (msg) msg.innerHTML = '<span class="msg-error">⚠️ 请填写完整身高、体重、年龄</span>';
        return;
    }

    saveBasicInfo(data);
    if (typeof syncBasicInfoToSupabase === 'function') {
        syncBasicInfoToSupabase(data);
    }

    const msg = document.getElementById('calcEditMsg');
    if (msg) msg.innerHTML = '<span class="msg-success">✅ 已保存</span>';
    if (typeof addNotification === 'function') {
        addNotification('success', '✅', '个人信息已保存', data.name ? `姓名：${data.name}` : '');
    }

    // 自动收起 + 自动进入下一步流程
    setTimeout(() => {
        cancelCalcEdit();
        // 刷新导航栏（基本信息已保存 → 导航从 calculator 切换到 plan 为首项）
        if (typeof renderNav === 'function') {
            renderNav('nav-calculatorSection', 'calculator');
        }
        renderBasicInfoSummary();
        // 自动继续流程：检测档位 → 选档位 → 生成方案
        if (typeof autoGenerateDailyPlan === 'function') {
            autoGenerateDailyPlan();
        }
    }, 800);
}

async function calculate() {
    // 优先从 localStorage 读取基本信息
    let formData = loadBasicInfo();

    // 没有基本信息 → 引导去设置页
    if (!formData || !formData.height || !formData.weight || !formData.age) {
        showToast('请先在设置页填写基本信息 🚀', 'info');
        // 跳转到设置页
        if (typeof showSettings === 'function') showSettings();
        return;
    }

    // 从云端API获取 TDEE
    const calcResp = await apiCalculateAdult({
        height: formData.height,
        weight: formData.weight,
        age: formData.age,
        activity: formData.activity,
        tier: { carbPct: 20, proteinPct: 15, fatPct: 65 }
    });
    let xiaResult = null;
    if (calcResp.success) {
        xiaResult = extractXiaResult(calcResp.data);
    } else {
        // API 失败时保留空 xiaResult，后续会显示错误
        showToast('计算服务异常，部分功能不可用', 'warning');
    }

    // 保存基本信息到当前用户数据
    users[currentUser] = {
        ...users[currentUser],
        ...formData,
        xiaResult
    };

    // 检查是否有问卷数据
    const email = (typeof surveyState !== 'undefined' && surveyState.currentUser) || '';
    const surveyKey = 'survey_' + email;
    let intake = null;
    try {
        const surveyRaw = localStorage.getItem(surveyKey);
        if (surveyRaw) {
            const surveyData = JSON.parse(surveyRaw);
            intake = surveyData.intake || null;
        }
    } catch {}

    // 跳转到方案生成页（带或不带问卷数据）
    if (typeof showResultPage === 'function') {
        showResultPage(intake);
    }
}
// ============================================
// 自动生成每日方案（登录后 / 点击计算器时自动触发）
// ============================================

/**
 * 每日方案缓存，供 showPlanPage() 读取
 * 格式：{ info, xiaResult, bmr, macros, mealPlan, compensation, tier }
 */
let planCache = null;

/**
 * 儿童方案一键生成（跳过档位选择，默认碳水57%）
 */
async function generateChildPlanInline(info) {
    const resp = await apiCalculateChild({
        age: info.age,
        gender: info.gender,
        weight: info.weight,
        advancedMode: false
    });
    if (!resp.success) {
        showToast('儿童计算服务异常', 'error');
        return;
    }
    const xiaResult = extractChildResult(resp.data);
    const macros = enrichMacros(resp.data.macros);
    const bmr = calculateBMR(info.gender, info.age, info.height, info.weight);

    users[currentUser] = {
        ...users[currentUser],
        ...info,
        xiaResult,
        macroRatios: { carb: 57, protein: resp.data.macros.protein.percent, fat: resp.data.macros.fat.percent }
    };

    const mealPlan = generateMealPlan(macros, getUserSeed());
    savePlanToHistory(mealPlan);

    if (typeof renderBasicInfoSummary === 'function') renderBasicInfoSummary();
    if (typeof showResultPage === 'function') {
        showResultPage(null);
        setTimeout(() => {
            if (typeof renderDailyPlan === 'function') {
                planCache = { info, xiaResult, bmr, macros, mealPlan, compensation: 0, tier: null };
                renderDailyPlan(info, xiaResult, bmr, macros, mealPlan, 0, null);
            }
            if (typeof renderMVDashboard === 'function' && mealPlan) {
                renderMVDashboard(mealPlan, users[currentUser]);
            }
        }, 200);
    }
}

/**
 * 自动生成今日营养方案
 * 读取 localStorage 缓存的个人信息 + 档位偏好
 * @param {boolean} [silent=false] 若为 true，不自动跳转到方案页（在计算器中静默生成）
 */
async function autoGenerateDailyPlan(silent) {
    const container = document.getElementById('dailyPlanContainer');
    if (!container) return;

    const info = loadBasicInfo();
    const tier = loadTierPreference();
    const calcBtn = document.getElementById('calculateBtn');
    if (calcBtn) calcBtn.style.display = '';

    // 无信息 → 显示引导卡片 + 自动展开内联编辑表单
    if (!info || !info.height || !info.weight) {
        // 显示引导卡片
        container.innerHTML = `
        <div class="card plan-hint-card" style="text-align:center;padding:30px 20px;margin-bottom:16px;">
            <p style="font-size:2rem;margin-bottom:8px;">📋</p>
            <p style="font-size:1.1rem;color:var(--text);margin-bottom:6px;">请先填写基本信息</p>
            <p style="color:var(--text-light);font-size:0.85rem;">身高、体重、年龄等信息是营养计算的基础，填完后即可生成您的专属方案</p>
        </div>`;
        // 确保"生成方案"按钮不可见
        if (calcBtn) calcBtn.style.display = 'none';
        // 自动展开编辑表单
        const form = document.getElementById('calcEditForm');
        if (form && (form.style.display === 'none' || !form.style.display)) {
            toggleCalcEdit();
        }
        return;
    }

    // 有信息但无档位 → 引导选档位（隐藏旧计算器按钮，新流程不需要）
    if (!tier || !tier.ratio) {
        // 儿童（<18岁）：跳过档位选择，直接生成儿童方案
        if (info.age < 18) {
            if (calcBtn) calcBtn.style.display = 'none';
            const editBtn = document.getElementById('calcEditBtn');
            if (editBtn) editBtn.style.display = 'none';
            // 直接生成儿童方案（默认碳水57%，蛋白查RNI表）
            await generateChildPlanInline(info);
            return;
        }
        if (calcBtn) calcBtn.style.display = 'none';
        const editBtn = document.getElementById('calcEditBtn');
        if (editBtn) editBtn.style.display = 'none';
        container.innerHTML = `
        <div class="card plan-hint-card" style="text-align:center;padding:40px 20px;">
            <p style="font-size:2rem;margin-bottom:12px;">🎯</p>
            <p style="font-size:1.1rem;color:var(--text);margin-bottom:8px;">请选择低碳水档位</p>
            <p style="color:var(--text-light);margin-bottom:16px;">三种方案可选：控制型 / 温和型 / 生酮型</p>
            <button class="btn-primary" onclick="showResultPage(null)">选择档位 →</button>
        </div>`;
        return;
    }

    try {
        // 从云端API获取 TDEE
        if (typeof apiCalculateAdult !== 'function') {
            showToast('计算模块未加载', 'error');
            return;
        }
        const autoResp = await apiCalculateAdult({
            height: info.height,
            weight: info.weight,
            age: info.age,
            activity: info.activity,
            tier: { carbPct: tier.ratio.carb, proteinPct: tier.ratio.protein, fatPct: tier.ratio.fat }
        });
        let xiaResult;
        if (autoResp.success) {
            xiaResult = extractXiaResult(autoResp.data);
        } else {
            showToast('计算服务异常', 'error');
            return;
        }
        const bmr = calculateBMR(info.gender, info.age, info.height, info.weight);

        // 能量补偿（本地计算，已知TDEE后仅做比例拆分）
        const compensation = getTodayCompensation(xiaResult.tdee);
        const adjustedTDEE = xiaResult.tdee + compensation;
        const macros = calculateDailyMacros(adjustedTDEE, tier.ratio);

        // 保存到全局 users（供打卡/历史等功能引用）
        users[currentUser] = {
            ...users[currentUser],
            ...info,
            xiaResult,
            macroRatios: tier.ratio
        };

        // 生成分餐方案
        const mealPlan = generateMealPlan(macros, getUserSeed());

        // 保存到历史
        savePlanToHistory(mealPlan);

        // 隐藏旧的"生成方案"按钮（自动生成不需要手动点击）
        if (calcBtn) calcBtn.style.display = 'none';
        const editBtn = document.getElementById('calcEditBtn');
        if (editBtn) editBtn.style.display = 'none';

        // 清空 dailyPlanContainer（提示已不需要）
        container.innerHTML = '';

        // 写入缓存供 showPlanPage 使用
        planCache = { info, xiaResult, bmr, macros, mealPlan, compensation, tier };

        // 渲染矿物质维生素达标率
        if (typeof renderMVDashboard === 'function' && mealPlan) {
            renderMVDashboard(mealPlan, users[currentUser]);
        }

        // 检查昨日是否需要打卡（自动弹窗提醒）
        tryCheckYesterdayCheckin();

        // 方案生成通知（只在非静默模式或首次生成时触发）
        if (!silent && typeof addNotification === 'function') {
            const pName = (tier && tier.profileName) || (tier && tier.ratio && tier.ratio.profileName) || '';
            addNotification('success', '🍽️', '今日方案已生成', pName ? `${pName} · 碳水配置已就绪` : '');
        }

        // 非静默模式 → 自动跳转到方案展示页
        if (!silent && typeof showPlanPage === 'function') {
            showPlanPage();
        }
    } catch (e) {
        console.warn('autoGenerateDailyPlan 失败:', e);
        const editBtn = document.getElementById('calcEditBtn');
        if (editBtn) editBtn.style.display = '';
        if (calcBtn) calcBtn.style.display = '';
        container.innerHTML = `<div class="card plan-hint-card" style="text-align:center;padding:24px;">
            <p>⚠️ 方案生成失败，请检查信息设置</p>
            <button class="btn-primary" onclick="showSettings()">检查设置</button>
        </div>`;
    }
}

/**
 * 检查昨日是否需要打卡，需要则自动弹窗
 * 在自动生成今日方案后调用
 */
function tryCheckYesterdayCheckin() {
    try {
        const yesterday = getYesterdayStr();
        const yesterdayHistory = getDayHistory(yesterday);
        if (!isCheckedIn(yesterday) && yesterdayHistory && yesterdayHistory.plan) {
            // 延迟弹窗，等今日方案渲染完再弹出
            setTimeout(() => {
                showCheckInPopup(yesterday, yesterdayHistory);
            }, 500);
        }
    } catch (e) {
        console.warn('tryCheckYesterdayCheckin 失败:', e);
    }
}

/**
 * 在每日方案容器中渲染完整的营养方案
 */
function renderDailyPlan(info, xiaResult, bmr, macros, mealPlan, compensation, tier) {
    const container = document.getElementById('planContent');
    if (!container) return;

    const weekDays = ['周日','周一','周二','周三','周四','周五','周六'];
    const now = new Date();
    const dateLabel = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 ${weekDays[now.getDay()]}`;
    const profileName = tier.profileName || '自定义';
    const bmiVal = calculateBMI(info.height, info.weight);
    const bmiInfo = getBMIStatus(bmiVal);

    // 能量补偿提示
    const compHtml = compensation !== 0
        ? `<div class="msg-warning" style="margin-bottom:12px;padding:8px 12px;font-size:0.9rem;border-radius:8px;background:#fff3cd;border:1px solid #ffc107;">
            ${compensation > 0 ? '🔋 能量补偿：' : '⚖️ 能量平衡：'}今日目标 ${xiaResult.tdee + compensation} kcal（${compensation > 0 ? '上调' : '下调'} ${Math.abs(compensation)} kcal）
           </div>`
        : '';

    container.innerHTML = `
    <div class="card daily-plan-card" style="margin-top:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
            <h3 style="margin:0;">🍽️ 今日方案 · ${dateLabel}</h3>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <span class="daily-plan-tier-badge" style="font-size:0.8rem;padding:3px 10px;border-radius:20px;background:var(--primary-light, #e8f5e9);color:var(--primary);">
                    ${profileName}
                </span>
                <button class="btn-secondary btn-sm" onclick="showProfileSelectorInPlan()" style="font-size:0.8rem;padding:4px 12px;">🔄 重新生成</button>
            </div>
        </div>

        ${compHtml}

        <!-- 概要行 -->
        <div class="result-summary" style="margin-bottom:12px;">
            <div class="summary-item">
                <span class="summary-label">BMI</span>
                <span class="summary-value">${bmiVal.toFixed(1)}</span>
                <span class="summary-status ${bmiInfo.className}">${bmiInfo.status}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">BMR</span>
                <span class="summary-value">${Math.round(bmr)}</span>
                <span class="summary-unit">kcal/天</span>
            </div>
            <div class="summary-item highlight">
                <span class="summary-label">TDEE</span>
                <span class="summary-value">${xiaResult.tdee}</span>
                <span class="summary-unit">kcal/天</span>
            </div>
        </div>

        <!-- 三大营养素 -->
        <h4 style="margin:0 0 8px 0;">🥩 每日营养目标</h4>
        <div class="macro-display" style="margin-bottom:12px;">
            <div class="macro-item protein">
                <div class="macro-circle"><span class="macro-percent">${macros.protein.percent}%</span></div>
                <div class="macro-info">
                    <strong>蛋白质</strong>
                    <span>${macros.protein.grams}g</span>
                    <small>${macros.protein.kcal} kcal</small>
                </div>
            </div>
            <div class="macro-item fat">
                <div class="macro-circle"><span class="macro-percent">${macros.fat.percent}%</span></div>
                <div class="macro-info">
                    <strong>脂肪</strong>
                    <span>${macros.fat.grams}g</span>
                    <small>${macros.fat.kcal} kcal</small>
                </div>
            </div>
            <div class="macro-item carb">
                <div class="macro-circle"><span class="macro-percent">${macros.carb.percent}%</span></div>
                <div class="macro-info">
                    <strong>碳水</strong>
                    <span>${macros.carb.grams}g</span>
                    <small>${macros.carb.kcal} kcal</small>
                </div>
            </div>
            <div class="macro-item water">
                <div class="macro-circle" style="font-size:1.8rem;">💧</div>
                <div class="macro-info">
                    <strong>水</strong>
                    <span>1200~1500ml</span>
                    <small>白开水、茶水最佳</small>
                </div>
            </div>
        </div>

        <!-- 分餐方案 -->
        <div id="mealPlanDaily"></div>

        <!-- 注意事项 -->
        <div id="warningsDaily"></div>
    </div>`;

    // 渲染分餐方案表格
    const mealPlanEl = document.getElementById('mealPlanDaily');
    if (mealPlanEl && typeof renderMealPlanTable === 'function') {
        mealPlanEl.innerHTML = renderMealPlanTable(mealPlan);
    }

    // 渲染注意事项
    if (typeof renderWarnings === 'function') {
        renderWarnings(users[currentUser], { bmr, tdee: xiaResult.tdee, macros }, 'warningsDaily');
    }
}

// ============================================
// 设置页面
// ============================================

/**
 * 渲染设置页面（账号信息 + 等级信息）
 */
function renderSettingsPage() {
    // 初始化家庭成员（首次）
    initFamilyMembers();
    // 渲染家庭成员列表
    renderFamilyMembers();
    // 更新导航栏显示
    updateFamilyNavDisplay();

    const info = loadBasicInfo();
    const settingsBasicMsg = document.getElementById('settingsBasicMsg');

    // 基本信息 — 回填表单字段（供编辑用）
    if (info) {
        const idMap = {
            settingsName: 'name',
            settingsGender: 'gender',
            settingsAge: 'age',
            settingsHeight: 'height',
            settingsWeight: 'weight',
            settingsActivity: 'activity'
        };
        for (const [inputId, field] of Object.entries(idMap)) {
            const el = document.getElementById(inputId);
            if (el && info[field] !== undefined) el.value = info[field];
        }
    }
    if (settingsBasicMsg) settingsBasicMsg.textContent = '';

    // === 基本信息摘要 ===
    const summaryEl = document.getElementById('settingsBasicSummary');
    if (summaryEl) {
        if (info) {
            const genderLabel = info.gender === 'female' ? '女' : '男';
            const activityLabels = {
                '1.2': '卧床', '1.375': '轻体力', '1.55': '中体力', '1.725': '重体力'
            };
            const actLabel = activityLabels[String(info.activity)] || `活动系数${info.activity}`;
            summaryEl.innerHTML = `
                <div class="settings-summary-row">
                    <span class="settings-summary-item"><span class="label">姓名</span> <span class="value">${info.name || '-'}</span></span>
                    <span class="settings-summary-item"><span class="label">性别</span> <span class="value">${genderLabel}</span></span>
                    <span class="settings-summary-item"><span class="label">年龄</span> <span class="value">${info.age || '-'} 岁</span></span>
                    <span class="settings-summary-item"><span class="label">身高</span> <span class="value">${info.height || '-'} cm</span></span>
                    <span class="settings-summary-item"><span class="label">体重</span> <span class="value">${info.weight || '-'} kg</span></span>
                    <span class="settings-summary-item"><span class="label">活动水平</span> <span class="value">${actLabel}</span></span>
                </div>
            `;
        } else {
            summaryEl.innerHTML = '<p style="color:var(--text-light);">暂无数据，请点击「编辑」填写。</p>';
        }
    }

    // 账号信息
    const email = (typeof surveyState !== 'undefined' && surveyState.currentUser) || '未知';
    const accountEl = document.getElementById('settingsAccountInfo');
    if (accountEl) {
        accountEl.innerHTML = `
            <div class="settings-account-card">
                <div class="settings-account-avatar">${email ? email[0].toUpperCase() : '?'}</div>
                <div class="settings-account-detail">
                    <div class="email">${email}</div>
                    <div class="hint">当前登录账号</div>
                </div>
            </div>
        `;
    }

    // 等级信息
    const levelInfo = getUserLevelInfo(currentUser);
    const levelEl = document.getElementById('settingsLevelInfo');
    if (levelEl) {
        const daysText = levelInfo.days < 0 ? '无限（永久不删）' : `${levelInfo.days} 天`;
        levelEl.innerHTML = `
            <div class="settings-level-info">
                <div class="settings-level-icon">${levelInfo.icon}</div>
                <div class="settings-level-text">
                    <div class="level-name">${levelInfo.icon} ${levelInfo.label} 用户</div>
                    <div class="level-detail">数据保留期限：${daysText}</div>
                    <div class="level-detail" style="margin-top:4px;font-size:0.73rem;">等级由管理员在后台设置</div>
                </div>
            </div>
        `;
    }

    // === 饮食问卷结果 ===
    renderSurveyResultsInSettings();

    // 清空密码输入框和提示
    ['settingsCurPwd', 'settingsNewPwd', 'settingsConfirmPwd'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const msgEl = document.getElementById('settingsPwdMsg');
    if (msgEl) msgEl.textContent = '';
}

/**
 * 在设置页渲染饮食问卷结果
 */
function renderSurveyResultsInSettings() {
    const container = document.getElementById('settingsSurveyResults');
    if (!container) return;

    const username = (typeof surveyState !== 'undefined' && surveyState.currentUser) || '';
    if (!username) {
        container.innerHTML = '<p style="color:var(--text-light);">请先登录。</p>';
        return;
    }

    const surveyData = loadSurveyData(username);
    if (!surveyData || !surveyData.foodFreq || Object.keys(surveyData.foodFreq).length === 0) {
        container.innerHTML = `
            <p style="color:var(--text-light);">暂无填写记录。</p>
            <div style="margin-top:10px;">
                <button class="btn-primary" onclick="showSurvey()">📋 填写饮食问卷</button>
            </div>
        `;
        return;
    }

    // 有时间戳则显示提交日期
    let headerHtml = '';
    if (surveyData.timestamp) {
        const d = new Date(surveyData.timestamp);
        const dateStr = d.getFullYear() + '年' + (d.getMonth()+1) + '月' + d.getDate() + '日';
        headerHtml = `<p style="font-size:0.85rem;color:var(--text-light);margin-bottom:8px;">📅 最近提交：${dateStr}</p>`;
    }

    // 每日摄入分析
    let intakeHtml = '';
    if (surveyData.intake) {
        const i = surveyData.intake;
        intakeHtml = `
            <div class="survey-result-section">
                <h4>📊 每日摄入分析</h4>
                <table class="survey-result-table">
                    <tr><th>营养素</th><th>实际摄入</th></tr>
                    <tr><td>热量</td><td>${i.kcal || 0} kcal</td></tr>
                    <tr><td>蛋白质</td><td>${i.protein || 0} g</td></tr>
                    <tr><td>脂肪</td><td>${i.fat || 0} g</td></tr>
                    <tr><td>碳水</td><td>${i.carb || 0} g</td></tr>
                </table>
            </div>
        `;
    }

    // 食物频率 — 只显示"吃"的项
    let freqHtml = '';
    const freqItems = surveyData.foodFreq;
    const freqNames = {};
    const freqCategories = {};
    if (typeof FOOD_FREQ_ITEMS !== 'undefined') {
        FOOD_FREQ_ITEMS.forEach(item => {
            freqNames[item.id] = item.icon + ' ' + item.name;
            freqCategories[item.id] = item.category;
        });
    }

    let freqLines = [];
    for (const [id, data] of Object.entries(freqItems)) {
        if (data.eat !== 'yes') continue;
        const name = freqNames[id] || id;
        const freqText = data.freqNum && data.freqUnit ? `${data.freqNum}次/${data.freqUnit === 'day' ? '日' : data.freqUnit === 'week' ? '周' : '月'}` : '';
        const amountText = data.amount ? `${data.amount}g/次` : '';
        const detail = [freqText, amountText].filter(Boolean).join('，');
        freqLines.push(`<span class="survey-result-item">${name}${detail ? ' — ' + detail : ''}</span>`);
    }

    if (freqLines.length > 0) {
        freqHtml = `
            <div class="survey-result-section">
                <h4>🍽️ 食物频率（吃）</h4>
                <div class="survey-result-grid">${freqLines.join('')}</div>
            </div>
        `;
    }

    // 其他习惯
    let habitHtml = '';
    const habitData = surveyData.otherHabits || {};
    const habitNames = {};
    if (typeof OTHER_HABITS_ITEMS !== 'undefined') {
        OTHER_HABITS_ITEMS.forEach(item => {
            habitNames[item.id] = item.icon + ' ' + item.name;
        });
    }

    let habitLines = [];
    for (const [id, data] of Object.entries(habitData)) {
        if (data.freqUnit === 'none' || !data.freqNum) continue;
        const name = habitNames[id] || id;
        const detail = `${data.freqNum}次/${data.freqUnit === 'day' ? '日' : data.freqUnit === 'week' ? '周' : '月'}`;
        habitLines.push(`<span class="survey-result-item">${name} — ${detail}</span>`);
    }

    if (habitLines.length > 0) {
        habitHtml = `
            <div class="survey-result-section">
                <h4>🏷️ 其他习惯</h4>
                <div class="survey-result-grid">${habitLines.join('')}</div>
            </div>
        `;
    }

    // 口味程度
    const tasteLabels = { none: '不', mild: '适中', heavy: '较重', very_heavy: '非常重' };
    const tasteText = tasteLabels[surveyData.tasteLevel] || surveyData.tasteLevel || '未选择';
    const tasteHtml = `
        <div class="survey-result-section">
            <h4>🌶️ 口味程度</h4>
            <p style="font-size:0.9rem;">${tasteText}</p>
        </div>
    `;

    container.innerHTML = `
        ${headerHtml}
        ${intakeHtml}
        ${freqHtml}
        ${habitHtml}
        ${tasteHtml}
        <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn-primary" onclick="showSurvey()">📋 重新填写问卷</button>
        </div>
    `;
}

/**
 * 切换设置页折叠卡片（基本信息 / 密码）
 */
function toggleSettingsEdit(type) {
    if (type === 'basicInfo') {
        const form = document.getElementById('settingsBasicForm');
        const summary = document.getElementById('settingsBasicSummary');
        const btn = document.getElementById('settingsBasicEditBtn');
        if (!form) return;
        const isHidden = form.style.display === 'none' || !form.style.display;
        if (isHidden) {
            form.style.display = 'block';
            form.style.opacity = '0';
            form.style.transform = 'translateY(-8px)';
            requestAnimationFrame(() => {
                form.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
                form.style.opacity = '1';
                form.style.transform = 'translateY(0)';
            });
            if (summary) summary.style.display = 'none';
            if (btn) btn.textContent = '✖ 收起';
        } else {
            form.style.opacity = '0';
            form.style.transform = 'translateY(-8px)';
            setTimeout(() => { form.style.display = 'none'; }, 150);
            if (summary) summary.style.display = 'block';
            if (btn) btn.textContent = '✏️ 编辑';
        }
    } else if (type === 'password') {
        const form = document.getElementById('settingsPwdForm');
        const btn = document.getElementById('settingsPwdEditBtn');
        if (!form) return;
        const isHidden = form.style.display === 'none' || !form.style.display;
        if (isHidden) {
            form.style.display = 'block';
            form.style.opacity = '0';
            form.style.transform = 'translateY(-8px)';
            requestAnimationFrame(() => {
                form.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
                form.style.opacity = '1';
                form.style.transform = 'translateY(0)';
            });
            if (btn) btn.textContent = '✖ 收起';
        } else {
            form.style.opacity = '0';
            form.style.transform = 'translateY(-8px)';
            setTimeout(() => { form.style.display = 'none'; }, 150);
            if (btn) btn.textContent = '🔑 修改';
        }
    }
}

/**
 * 取消编辑设置页折叠卡片
 */
function cancelSettingsEdit(type) {
    if (type === 'basicInfo') {
        const form = document.getElementById('settingsBasicForm');
        const summary = document.getElementById('settingsBasicSummary');
        const btn = document.getElementById('settingsBasicEditBtn');
        if (form) {
            form.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
            form.style.opacity = '0';
            form.style.transform = 'translateY(-8px)';
            setTimeout(() => { form.style.display = 'none'; }, 120);
        }
        if (summary) summary.style.display = 'block';
        if (btn) btn.textContent = '✏️ 编辑';
        const msg = document.getElementById('settingsBasicMsg');
        if (msg) msg.textContent = '';
    } else if (type === 'password') {
        const form = document.getElementById('settingsPwdForm');
        const btn = document.getElementById('settingsPwdEditBtn');
        if (form) {
            form.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
            form.style.opacity = '0';
            form.style.transform = 'translateY(-8px)';
            setTimeout(() => { form.style.display = 'none'; }, 120);
        }
        if (btn) btn.textContent = '🔑 修改';
        // 清空密码框
        ['settingsCurPwd', 'settingsNewPwd', 'settingsConfirmPwd'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const msg = document.getElementById('settingsPwdMsg');
        if (msg) msg.textContent = '';
    }
}

/**
 * 修改密码按钮处理
 */
async function changeUserPassword() {
    const curPwd = document.getElementById('settingsCurPwd')?.value || '';
    const newPwd = document.getElementById('settingsNewPwd')?.value || '';
    const confirmPwd = document.getElementById('settingsConfirmPwd')?.value || '';
    const msgEl = document.getElementById('settingsPwdMsg');

    if (!curPwd || !newPwd || !confirmPwd) {
        if (msgEl) { msgEl.innerHTML = '<span class="msg-error">⚠️ 请填写所有密码字段</span>'; }
        return;
    }
    if (newPwd.length < 6) {
        if (msgEl) { msgEl.innerHTML = '<span class="msg-error">⚠️ 新密码至少6位</span>'; }
        return;
    }
    if (newPwd !== confirmPwd) {
        if (msgEl) { msgEl.innerHTML = '<span class="msg-error">⚠️ 两次密码输入不一致</span>'; }
        return;
    }

    if (msgEl) { msgEl.innerHTML = '<span class="msg-loading">⏳ 修改中...</span>'; }

    const result = await changePassword(newPwd);
    if (result.success) {
        if (msgEl) { msgEl.innerHTML = '<span class="msg-success">✅ 密码修改成功</span>'; }
        if (typeof addNotification === 'function') {
            addNotification('info', '🔑', '密码已修改', '账号密码已成功更新');
        }
        // 清空密码框
        ['settingsCurPwd', 'settingsNewPwd', 'settingsConfirmPwd'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        // 自动收起密码表单
        setTimeout(() => {
            cancelSettingsEdit('password');
        }, 1000);
    } else {
        if (msgEl) { msgEl.innerHTML = `<span class="msg-error">❌ 修改失败：${result.error}</span>`; }
    }
}

// ============================================
// 家庭管理
// ============================================

/** 活跃成员ID（全局缓存，避免频繁读localStorage） */
let activeFamilyId = null;

/**
 * 获取当前活跃家庭成员ID（优先家族成员，兜底basic_info）
 */
function getActiveMemberId() {
    if (activeFamilyId) return activeFamilyId;
    const m = getActiveFamilyMember();
    if (m) {
        activeFamilyId = m.id;
        return m.id;
    }
    return null;
}

/**
 * 切换活跃家庭成员
 */
async function switchFamilyMember(id) {
    setActiveFamilyMember(id);
    activeFamilyId = id;
    // 同步该成员数据到 basic_info（兼容旧计算器）
    const m = getActiveFamilyMember();
    if (m) {
        saveBasicInfo({
            name: m.name,
            gender: m.gender,
            age: m.age,
            height: m.height,
            weight: m.weight,
            activity: parseFloat(m.activity) || 1.55,
        });
        // 同步到 Supabase（跨设备）
        if (typeof syncBasicInfoToSupabase === 'function') {
            syncBasicInfoToSupabase({
                name: m.name, gender: m.gender, age: m.age,
                height: m.height, weight: m.weight,
                activity: parseFloat(m.activity) || 1.55,
            });
        }
    }
    // 更新导航栏显示
    updateFamilyNavDisplay();
    // 重新生成方案并刷新显示
    const info = loadBasicInfo();
    if (info) {
        await autoGenerateDailyPlan(true);
        // 切换到新角色后刷新方案展示页
        if (typeof showPlanPage === 'function') {
            showPlanPage();
        }
    }
}

/**
 * 更新导航栏中的家庭切换器显示
 */
function updateFamilyNavDisplay() {
    const navEl = document.getElementById('familySwitcher');
    if (!navEl) return;
    const members = getFamilyMembers();
    // 只有1个成员时隐藏切换器
    if (members.length <= 1) {
        navEl.style.display = 'none';
        return;
    }
    navEl.style.display = 'inline-flex';
    const m = getActiveFamilyMember();
    if (m) {
        navEl.innerHTML = `${getRelationEmoji(m.relation)} ${m.name} <span style="font-size:0.7rem;opacity:0.6;">▼</span>`;
    } else {
        navEl.innerHTML = `👤 我 <span style="font-size:0.7rem;opacity:0.6;">▼</span>`;
    }
}

/**
 * 显示家庭成员切换下拉
 */
function toggleFamilyDropdown() {
    let dd = document.getElementById('familyDropdown');
    if (dd) { dd.remove(); return; }

    const members = getFamilyMembers();
    const active = getActiveFamilyMember();
    dd = document.createElement('div');
    dd.id = 'familyDropdown';
    dd.className = 'family-dropdown';
    dd.innerHTML = members.map(m => {
        const isActive = active && active.id === m.id;
        const emoji = getRelationEmoji(m.relation);
        return `<div class="family-dropdown-item ${isActive ? 'active' : ''}" onclick="switchFamilyMember('${m.id}');this.closest('.family-dropdown').remove();">
            ${emoji} ${m.name}
            <span class="family-dropdown-relation">${m.relation}</span>
            ${isActive ? ' ✅' : ''}
        </div>`;
    }).join('');

    // 点击其他区域关闭
    document.addEventListener('click', function closeDrop(e) {
        if (!e.target.closest('.family-dropdown') && !e.target.closest('#familySwitcher')) {
            if (dd.parentNode) dd.remove();
            document.removeEventListener('click', closeDrop);
        }
    });
    document.body.appendChild(dd);

    // 定位到切换器下方
    const sw = document.getElementById('familySwitcher');
    if (sw) {
        const rect = sw.getBoundingClientRect();
        dd.style.top = (rect.bottom + 4) + 'px';
        dd.style.left = Math.max(8, rect.left) + 'px';
    }
}

/**
 * 渲染家庭成员列表（设置页）
 */
function renderFamilyMembers() {
    const container = document.getElementById('familyMemberList');
    if (!container) return;

    const members = getFamilyMembers();
    const active = getActiveFamilyMember();

    if (members.length === 0) {
        container.innerHTML = '<p style="color:var(--text-light);font-size:0.85rem;padding:8px 0;">暂无家庭成员，点击右上角添加。</p>';
        return;
    }

    container.innerHTML = '<p style="color:var(--text-light);font-size:0.78rem;margin-bottom:8px;">本人的信息请在<b>设置页</b>修改，家庭管理仅管理其他成员</p>' + 
    members.filter(m => m.relation !== '本人').map(m => {
        const isActive = active && active.id === m.id;
        const emoji = getRelationEmoji(m.relation);
        const genderText = m.gender === 'female' ? '女' : '男';
        return `<div class="family-member-item ${isActive ? 'active' : ''}">
            <div class="family-member-avatar">${emoji}</div>
            <div class="family-member-info">
                <strong>${m.name}</strong>
                <span class="family-member-detail">${m.relation} · ${genderText} · ${m.age}岁</span>
                <span class="family-member-detail">${m.height}cm · ${m.weight}kg</span>
            </div>
            <div class="family-member-actions">
                ${isActive ? '<span class="family-member-badge">当前</span>' : `<button class="btn-sm btn-secondary" onclick="switchFamilyMember('${m.id}');renderFamilyMembers();updateFamilyNavDisplay();">切换</button>`}
                <button class="btn-sm btn-secondary" onclick="editFamilyMember('${m.id}')">✏️</button>
                <button class="btn-sm btn-secondary" onclick="deleteFamilyMemberConfirm('${m.id}')">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

/**
 * 显示添加家人表单
 */
function showAddFamilyMember() {
    const form = document.getElementById('familyMemberForm');
    if (!form) return;
    form.style.display = 'block';
    form.innerHTML = `
        <div class="family-form">
            <h4 style="margin:0 0 10px 0;">添加家庭成员</h4>
            <div class="form-grid" style="grid-template-columns:1fr 1fr;">
                <div class="form-group">
                    <label>称呼</label>
                    <input type="text" id="famName" placeholder="如：小明" class="auth-input" maxlength="10">
                </div>
                <div class="form-group">
                    <label>关系</label>
                    <select id="famRelation" class="auth-input">
                        <option value="儿子">儿子</option>
                        <option value="女儿">女儿</option>
                        <option value="爸爸">爸爸</option>
                        <option value="妈妈">妈妈</option>
                        <option value="爷爷">爷爷</option>
                        <option value="奶奶">奶奶</option>
                        <option value="其他">其他</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>性别</label>
                    <select id="famGender" class="auth-input">
                        <option value="male">男</option>
                        <option value="female">女</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>年龄（岁）</label>
                    <input type="number" id="famAge" placeholder="如：8" min="1" max="120" class="auth-input">
                </div>
                <div class="form-group">
                    <label>身高（cm）</label>
                    <input type="number" id="famHeight" placeholder="如：130" min="30" max="220" class="auth-input">
                </div>
                <div class="form-group">
                    <label>体重（kg）</label>
                    <input type="number" id="famWeight" placeholder="如：28" min="3" max="200" step="0.1" class="auth-input">
                </div>
                <div class="form-group" style="grid-column:1/-1;">
                    <label>活动水平</label>
                    <select id="famActivity" class="auth-input">
                        <option value="1.2">卧床（几乎不活动）</option>
                        <option value="1.375">轻体力（办公室/少量活动）</option>
                        <option value="1.55">中体力（每周运动3-5天）</option>
                        <option value="1.725">重体力（每周运动6-7天）</option>
                    </select>
                </div>
            </div>
            <div class="settings-actions">
                <button class="btn-primary" onclick="saveFamilyMemberForm()">💾 保存</button>
                <button class="btn-secondary" onclick="cancelFamilyMemberForm()">取消</button>
                <span class="msg" id="famMsg"></span>
            </div>
        </div>
    `;
}

/**
 * 保存添加/编辑家人表单
 */
function saveFamilyMemberForm() {
    const editId = document.getElementById('famFormEditId')?.value || null;
    const name = document.getElementById('famName')?.value?.trim();
    const msg = document.getElementById('famMsg');

    if (!name) {
        if (msg) msg.textContent = '请输入称呼';
        return;
    }

    const data = {
        name: name,
        relation: document.getElementById('famRelation')?.value || '家人',
        gender: document.getElementById('famGender')?.value || 'male',
        age: parseInt(document.getElementById('famAge')?.value) || 30,
        height: parseInt(document.getElementById('famHeight')?.value) || 170,
        weight: parseFloat(document.getElementById('famWeight')?.value) || 65,
        activity: document.getElementById('famActivity')?.value || '1.55',
    };

    if (editId) {
        updateFamilyMember(editId, data);
        if (msg) msg.textContent = '✅ 已更新';
    } else {
        const member = addFamilyMember(data);
        if (!getActiveFamilyMember()) {
            setActiveFamilyMember(member.id);
            activeFamilyId = member.id;
        }
        if (msg) msg.textContent = '✅ 已添加';
    }

    // 如果是"本人"，同步更新基本信息
    if (data.relation === '本人') {
        saveBasicInfo(data);
        if (typeof syncBasicInfoToSupabase === 'function') {
            syncBasicInfoToSupabase(data);
        }
        if (typeof renderBasicInfoSummary === 'function') {
            renderBasicInfoSummary();
        }
    }

    setTimeout(() => {
        cancelFamilyMemberForm();
        renderFamilyMembers();
        updateFamilyNavDisplay();
    }, 500);
}

/**
 * 编辑家庭成员
 */
function editFamilyMember(id) {
    const members = getFamilyMembers();
    const m = members.find(x => x.id === id);
    if (!m) return;

    showAddFamilyMember();
    // 标记编辑模式
    let editInput = document.getElementById('famFormEditId');
    if (!editInput) {
        editInput = document.createElement('input');
        editInput.type = 'hidden';
        editInput.id = 'famFormEditId';
        document.getElementById('familyMemberForm')?.appendChild(editInput);
    }
    editInput.value = id;

    const setVal = (inputId, val) => { const el = document.getElementById(inputId); if (el) el.value = val; };
    setVal('famName', m.name);
    setVal('famRelation', m.relation);
    setVal('famGender', m.gender);
    setVal('famAge', m.age);
    setVal('famHeight', m.height);
    setVal('famWeight', m.weight);
    setVal('famActivity', m.activity);
}

/**
 * 确认删除家庭成员
 */
function deleteFamilyMemberConfirm(id) {
    const members = getFamilyMembers();
    const m = members.find(x => x.id === id);
    if (!m) return;
    showConfirmDialog({
        title: '删除成员',
        message: `确定删除「${m.name}」吗？其营养数据不会被删除，只是不再显示。`,
        confirmText: '删除',
        danger: true,
        onConfirm: () => {
            removeFamilyMember(id);
            if (activeFamilyId === id) activeFamilyId = null;
            renderFamilyMembers();
            updateFamilyNavDisplay();
            autoGenerateDailyPlan(true);
        }
    });
}

/**
 * 取消家庭表单
 */
function cancelFamilyMemberForm() {
    const form = document.getElementById('familyMemberForm');
    if (form) {
        form.style.display = 'none';
        form.innerHTML = '';
    }
}

/**
 * 获取当前活跃成员的基本信息（供计算器使用）
 * 优先从 family_members 取，兜底 basic_info
 * @returns {object|null} {name, gender, age, height, weight, activity}
 */
function getMemberBasicInfo() {
    const m = getActiveFamilyMember();
    if (m) {
        return {
            name: m.name,
            gender: m.gender,
            age: m.age,
            height: m.height,
            weight: m.weight,
            activity: parseFloat(m.activity) || 1.55,
        };
    }
    return loadBasicInfo();
}

/**
 * 保存当前活跃成员的信息到 family_members（同时写回 basic_info 做兼容）
 */
function saveMemberBasicInfo(data) {
    // 写回 basic_info 兼容旧数据
    saveBasicInfo(data);
    // 同步到家庭成员的活跃成员
    const m = getActiveFamilyMember();
    if (m) {
        updateFamilyMember(m.id, {
            name: data.name,
            gender: data.gender,
            age: data.age,
            height: data.height,
            weight: data.weight,
            activity: String(data.activity || 1.55),
        });
    }
}

/** 保存设置页时同步到家庭成员 */
function saveSettingsWithFamily() {
    const data = {
        name: document.getElementById('settingsName')?.value || '',
        gender: document.getElementById('settingsGender')?.value || 'male',
        age: parseInt(document.getElementById('settingsAge')?.value) || 30,
        height: parseFloat(document.getElementById('settingsHeight')?.value) || 170,
        weight: parseFloat(document.getElementById('settingsWeight')?.value) || 70,
        activity: parseFloat(document.getElementById('settingsActivity')?.value) || 1.55
    };
    saveMemberBasicInfo(data);
    renderFamilyMembers();
    updateFamilyNavDisplay();
}

/** 保存设置页的基本信息 → localStorage + 家庭成员同步 */
function saveSettingsBasicInfo() {
    const data = {
        name: document.getElementById('settingsName')?.value || '',
        gender: document.getElementById('settingsGender')?.value || 'male',
        age: parseInt(document.getElementById('settingsAge')?.value) || 30,
        height: parseFloat(document.getElementById('settingsHeight')?.value) || 170,
        weight: parseFloat(document.getElementById('settingsWeight')?.value) || 70,
        activity: parseFloat(document.getElementById('settingsActivity')?.value) || 1.55
    };

    if (!data.height || !data.weight || !data.age) {
        const msg = document.getElementById('settingsBasicMsg');
        if (msg) msg.innerHTML = '<span class="msg-error">⚠️ 请填写完整身高、体重、年龄</span>';
        return;
    }

    saveMemberBasicInfo(data);
    // 同步到 Supabase（如果已登录）
    if (typeof syncBasicInfoToSupabase === 'function') {
        syncBasicInfoToSupabase(data);
    }

    const msg = document.getElementById('settingsBasicMsg');
    if (msg) msg.innerHTML = '<span class="msg-success">✅ 已保存</span>';
    if (typeof addNotification === 'function') {
        addNotification('success', '✅', '个人信息已保存', data.name ? `姓名：${data.name}` : '');
    }

    // 自动收起编辑表单，刷新摘要
    setTimeout(() => {
        cancelSettingsEdit('basicInfo');
        renderSettingsPage();
    }, 800);
}


// ============================================
// 版本更新通知
// ============================================
const APP_VERSION = 'V2.2.14';
const VERSION_LOG_KEY = 'nutri_seen_version';
const VERSION_PREV_KEY = 'nutri_prev_version';  // 记录上次版本号，检测版本变更

/**
 * 各版本更新日志
 * 每新增一个版本，加一条记录
 */
const VERSION_NOTES = {
    'V2.2.14': [
        '🔐 单设备登录修复——checkSessionValid 用 refreshSession 返回的 data，不另调 getUser',
        '🔄 initSessionMonitor 每次登入重新注册 interval，去掉只会执行一次的 guard',
    ],
    'V2.2.13': [
        '🧹 家庭管理不再包含"本人"——本人信息只在设置页修改，消除两条线同步问题',
        '📝 家庭列表显示提示「本人的信息请在设置页修改」',
        '❌ 添加家人表单移除"本人"选项',
    ],
    'V2.2.12': [
        '🔧 家庭管理修改 → 自动同步基本信息 → 同步到 Supabase',
        '🔄 switchFamilyMember 也同步到 Supabase（切换家庭成员时跨设备可见）',
        '📱 修改"本人"成员 → saveBasicInfo + syncBasicInfoToSupabase 双写',
    ],
    'V2.2.11': [
        '🔧 修复基本信息跨设备同步——syncAllFromSupabase 不再依赖 user_accounts',
        '📥 基本信息同步提到最前面，用 Auth 元数据直读，不受 userId 为空影响',
    ],
    'V2.2.10': [
        '📡 基本信息读写改用 Auth 元数据——session_token 同路，已验证通过的路径',
        '🔧 根因：user_accounts 表缺 INSERT RLS 策略，getCurrentAccountId 自动创建失败',
        '📤 写：sb.auth.updateUser({ data: { basic_info, session_id } })',
        '📥 读：sb.auth.getUser() → user_metadata → basic_info',
    ],
    'V2.2.9': [
        '🔙 回滚到 V2.2.6 稳定版（单设备登录已验证通过）+ V2.2.7 supabase.js 修复',
        '📡 数据同步链路：getCurrentAccountId 自动创建 user_accounts → syncBasicInfoToSupabase 有 ID 可写',
    ],
    'V2.2.8': [
        '⚠ 尝试 Auth 元数据双写——可能干扰 session_token，已回滚',
    ],
    'V2.2.7': [
        '🔧 getCurrentAccountId 找不到 user_accounts 时自动创建',
    ],
    'V2.2.6': [
        '🔐 单设备登录加强——updateSessionToken 改为 await（确保登录时写完再继续）',
        '⏰ 每30秒自动校验 session——即使 visibilitychange 不触发也能检测到',
        '🔄 getUser 前先 refreshSession——确保读到最新 Auth 元数据',
    ],
    'V2.2.5': [
        '🔐 单设备登录改用 Auth 元数据——不再依赖 user_settings 表 RLS，session_token 直接存到 Supabase Auth 用户资料',
        '🔄 修复数据不同步——重写 session 读写链路，登录/注册时写入，visibility 切回时校验',
    ],
    'V2.2.4': [
        '🔐 单设备登录——手机/网页只能一个在线，另一设备自动退出',
        '🧭 导航栏精简——去掉「设置」按钮（右上角已有⚙️），5项→4项更紧凑',
        '📱 手机端昵称挪到导航栏——header-right只留图标，昵称合并到导航首项',
        '🔄 保存/同步后导航自动刷新——不再点了保存导航没反应',
    ],
    'V2.2.3': [
        '🍳 打卡按时间窗预勾——今天只勾已过餐次（早餐6-10/午餐10-14/加餐14-17/晚餐17+）',
        '🔍 修复「添加食物」首次点击不展开搜索框（CSS display vs inline style冲突）',
    ],
    'V2.2.2': [
        '🔔 修复版本更新不提示——新增 prevVersion 检测机制，版本号变化时强制弹窗',
        '🔄 不再被localStorage缓存干扰，每次更新都能看到改动说明',
    ],
    'V2.2.1': [
        '🐛 修复水果重复bug——早餐和加餐总是同一种水果的不合理（hash偏移碰撞）',
        '🥚 修复早餐渲染——鸡蛋和牛奶/豆浆现在同时正确显示在表格中',
        '🛡️ fmtFood NaN防御——极端情况下不再显示"NaNg"',
    ],
    'V2.2': [
        '🥜 坚果池扩充——从4种扩至8种（开心果·腰果·松子仁·榛子加入轮换）',
        '🍎 水果池大升级——从固定7种扩至17种，按GI比例轮换（pickByRatio）',
        '📍 水果去向7天轮换——不再只有加餐吃水果，部分到早餐/午餐',
        '🥚 早餐重构——鸡蛋始终出现（煎蛋60%/水煮蛋40%），牛奶/豆浆必配一种',
        '🛢️ 早餐油绑定煎蛋——煎蛋日配油5g，水煮蛋日无油',
        '👤 用户个性化方案——不同用户同一天食物不同（userSeed参数）',
        '🔄 重新生成真正变化——每次点重新生成食物种类随机变化',
    ],
    'v2.1.3': [
        '🐛 修复晚餐蛋白质缺失——FOOD_ROTATION缺少dinnerProtein导致方案生成崩溃',
        '🔄 修复切换家庭成员时方案不更新——switchFamilyMember改为async+自动刷新',
    ],
    'v2.1.2': [
        '🍽️ 修复一日3餐方案不显示（FOOD_ROTATION.*Grain残留引用→TypeError）',
        '👤 修复基本信息与家庭成员不同步（云端同步时双向更新）',
    ],
    'v2.1.1': [
        '🔧 修复食物库bug——补回searchFood()、getFoodById()、getCategories()',
        '🍽️ 食物库页面恢复正常，210种食物可搜索可分类',
    ],
    'v2.1': [
        '🍎 食物数据大升级——从126种扩至210种日常食物',
        '🥬 全部营养数据来源官方——替换为《中国食物成分表》',
        '🔢 GI频率控制上线——主食按低/中/高GI自动排班',
        '🐟 ω-3/ω-6全面准确——基于官方脂肪酸数据',
    ],
    'v2': [
        '🔒 核心公式迁移到云端——F12不再暴露公式',
        '☁️ 新增 Supabase Edge Function 云端计算',
        '🛡️ 三层安全防线——云端公式+鉴权+RLS',
        '🐛 修复控制台报错——加载更干净了'
    ],
    'v1.3': [
        '🛢️ 油品轮换优化——橄榄油优先，减少高ω-6菜籽油',
        '🛢️ 三餐独立选油——不再全天一种油',
        '🥜 坚果比例调整——增加核桃、杏仁频次',
        '🥩 肉类轮换新增羊肉、鸭肉，三文鱼频次翻倍',
        '🐟 新增 ω-6:ω-3 比值展示——超标时自动提醒'
    ],
    'v1.2': [
        '👨‍👩‍👧‍👦 新增家庭管理功能——添加/切换家人',
        '🔒 安全升级——数据加密存储，登录更安全',
        '📱 手机端布局优化——更好用的触摸体验'
    ]
};

/**
 * 检查版本更新，有新版本时弹窗通知
 */
function checkVersionUpdate() {
    const seenVersion = localStorage.getItem(VERSION_LOG_KEY);
    const prevVersion = localStorage.getItem(VERSION_PREV_KEY);

    // ✅ 版本号变了 → 清除"已看过"标记，强制弹窗
    if (prevVersion && prevVersion !== APP_VERSION) {
        localStorage.removeItem(VERSION_LOG_KEY);
    }

    // 保存当前版本号为"上次版本"
    localStorage.setItem(VERSION_PREV_KEY, APP_VERSION);

    if (seenVersion === APP_VERSION) return; // 已看过

    const notes = VERSION_NOTES[APP_VERSION];
    if (!notes || notes.length === 0) return;

    // 组装弹窗内容
    let noteHtml = '';
    notes.forEach(n => {
        noteHtml += `<div class="version-note-item">${n}</div>`;
    });

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.id = 'versionUpdateOverlay';

    overlay.innerHTML = `
        <div class="dialog-popup version-popup">
            <div class="dialog-body">
                <div class="version-popup-header">🎉 「今天，吃了吗？」</div>
                <div class="version-popup-sub">已更新至 <strong>${APP_VERSION}</strong></div>
                <div class="version-popup-notes">${noteHtml}</div>
            </div>
            <div class="dialog-actions" style="justify-content:center;">
                <button class="btn-primary" id="versionOkBtn">知道了</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('versionOkBtn').addEventListener('click', () => {
        localStorage.setItem(VERSION_LOG_KEY, APP_VERSION);
        if (document.body.contains(overlay)) document.body.removeChild(overlay);
        // 推送到消息中心，保留版本更新信息
        if (typeof addNotification === 'function') {
            // 每条更新日志作为一条独立通知
            notes.forEach(n => {
                addNotification('info', '🎉', `${APP_VERSION} 更新`, n);
            });
        }
    });
}

// ============================================
// 事件绑定
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // 版本更新检查
    checkVersionUpdate();

    // 计算按钮
    // 计算按钮
    document.getElementById('calculateBtn').addEventListener('click', calculate);

    // 重置按钮
    document.getElementById('resetBtn').addEventListener('click', () => {
        hideResults();
        users[currentUser] = {};
        window.history.replaceState({}, '', window.location.pathname);
    });

    // 分享按钮
    document.getElementById('shareBtn')?.addEventListener('click', showShareModal);

    // 用户切换
    document.querySelectorAll('.tab-btn[data-user]').forEach(btn => {
        btn.addEventListener('click', () => {
            switchUser(parseInt(btn.dataset.user));
        });
    });

    // 添加用户
    document.getElementById('addUserBtn')?.addEventListener('click', addUser);

    // 从URL加载
    loadFromURL();
});
