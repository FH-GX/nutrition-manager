/**
 * 饮食调查问卷模块
 * 主界面：用户注册/登录 → 调查问卷 → 营养计算器
 */

// ============================================
// 状态
// ============================================

let surveyState = {
    currentUser: null,
    foodFreq: {},
    otherHabits: {},
    tasteLevel: 'none',
};

// ============================================
// 用户注册/登录
// ============================================

function initAuth() {
    // 初始化默认注册验证码
    initRegisterCode();

    // 更新账号下拉列表
    updateAccountDatalist();

    // 检查 Supabase 会话（是否已登录）
    (async () => {
        const session = await checkUserSession();
        if (session.loggedIn) {
            const current = getCurrentSessionUser();
            if (current) {
                doLogin(current);
                // 同步云端数据（跨设备），doLogin 已调用 renderBasicInfoSummary()
                // syncAllFromSupabase 完成后 finally 会再次刷新（用云端最新数据）
                if (typeof syncAllFromSupabase === 'function') {
                    syncAllFromSupabase();
                }
                return;
            }
        }

        // 未登录，显示登录页
        hideAllSections();
        $show('authSection');

        // 如果有保存的密码，自动填充到表单
        const saved = getSavedCredentials();
        if (saved && saved.email) {
            $val('loginName', saved.email);
            $val('loginPassword', saved.password || '');
            const cb = $('autoLoginCheck');
            if (cb) cb.checked = true;
        }
    })();
}

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.remove('active'));
    const title = document.querySelector('#authSection h2');
    if (tab === 'register') {
        $addClass('authTabRegister', 'active');
        $show('authFormRegister');
        $hide('authFormLogin');
        if (title) title.textContent = '🔐 创建账号';
    } else {
        $addClass('authTabLogin', 'active');
        $hide('authFormRegister');
        $show('authFormLogin');
        if (title) title.textContent = '🔐 账号登录';
    }
    $hide('authError');
}

function updateUserList() {
    // 已有账号列表已移除，此函数保留但不再显示列表
    // 如需查看所有用户，请使用管理员后台
}

/**
 * 更新登录页账号下拉列表（datalist）
 */
function updateAccountDatalist() {
    const datalist = $('userAccountList');
    if (!datalist) return;
    // 账号列表已切换至 Supabase Auth，不再从 localStorage 读取
    datalist.innerHTML = '';
}

/**
 * 从邮箱提取显示名（@前面的部分）
 * test@163.com → test
 */
function getDisplayName(email) {
    if (!email || !email.includes('@')) return email || '';
    return email.split('@')[0];
}

async function registerUser() {
    const name = $val('regName');
    const password = $val('regPassword');
    const confirm = $val('regConfirm');

    // 校验邮箱格式
    if (!name || !password) {
        $html('authError', '请输入邮箱和密码');
        $show('authError');
        return;
    }

    if (!name.includes('@') || name.split('@').length !== 2 || name.split('@')[1].indexOf('.') === -1) {
        $html('authError', '请输入正确的邮箱格式（如 test@163.com）');
        $show('authError');
        return;
    }

    // 校验密码：至少6位
    if (password.length < 6) {
        $html('authError', '密码至少6位');
        $show('authError');
        return;
    }

    if (password !== confirm) {
        $html('authError', '两次密码不一致');
        $show('authError');
        return;
    }

    // 验证注册码
    const code = $val('regCode');
    const validCode = getRegisterCode();
    if (!code) {
        $html('authError', '请输入注册验证码');
        $show('authError');
        return;
    }
    if (code !== validCode) {
        $html('authError', '注册验证码错误，请联系管理员');
        $show('authError');
        return;
    }

    $html('authError', '⏳ 注册中...');
    $show('authError');

    // Supabase 注册
    const result = await userSignUp(name, password);

    if (!result.success) {
        $html('authError', result.error || '注册失败');
        $show('authError');
        return;
    }

    // 暂存当前用户到 localStorage（兼容现有数据层）
    setCurrentSessionUser(name);

    // 也写入 today_eaten_users 方便管理员后台查看（不存密码）
    const saved = getRegisteredUsers();
    const users = saved; // already an array or object
    if (!users[name]) {
        users[name] = { password: '🔒 Supabase', registered: true };
        saveRegisteredUsers(users);
    }

    // 新用户注册，清理 localStorage 中旧用户的数据缓存
    // 避免上一个用户的基本信息和档位数据污染新用户
    if (typeof removeData === 'function') {
        removeData('basic_info');   // BASIC_INFO 常量值，与 storage.js 保持一致
        removeData(TIER_KEY);
    }

    doLogin(name);

    // 新用户无需同步云端数据（Supabase里没有）
    // doLogin 已调用 renderBasicInfoSummary()（新用户显示"暂未设置"）
}

async function loginUser() {
    const name = $val('loginName');
    const password = $val('loginPassword');
    const savePwd = $('autoLoginCheck')?.checked;

    if (!name || !password) {
        $html('authError', '请输入邮箱和密码');
        $show('authError');
        return;
    }

    $html('authError', '⏳ 登录中...');
    $show('authError');

    // Supabase 登录
    const result = await userSignIn(name, password);

    if (!result.success) {
        $html('authError', result.error || '登录失败');
        $show('authError');
        return;
    }

    // 保存或清除密码
    if (savePwd) {
        saveCredentials(name, password);
    } else {
        clearCredentials();
    }

    setCurrentSessionUser(name);

    doLogin(name);

    // 从 Supabase 拉取云端数据到本地（跨设备同步）
    // doLogin 已调用 renderBasicInfoSummary()，sync 完成后 finally 会再次刷新
    if (typeof syncAllFromSupabase === 'function') {
        syncAllFromSupabase();
    }
}

function doLogin(name) {
    surveyState.currentUser = name;
    const displayName = getDisplayName(name);

    hideAllSections();
    $show('calculatorSection');
    $text('surveyUserName', displayName);

    // 更新右上角用户信息
    const hdrUser = $('headerUserName');
    if (hdrUser) {
        const levelInfo = (typeof getUserLevelInfo === 'function') ? getUserLevelInfo(currentUser) : null;
        hdrUser.textContent = (levelInfo ? levelInfo.icon : '👤') + ' ' + displayName;
    }
    $hide('authError');

    // 显示右上角用户信息
    $showFlex('headerRight');

    updateNavActive('calculator');

    initSurvey();

    // 立即用 localStorage 缓存渲染个人信息（localStorage 关浏览器不丢）
    // syncAllFromSupabase() 完成后会再次刷新（用云端最新数据覆盖）
    if (typeof renderBasicInfoSummary === 'function') {
        renderBasicInfoSummary();
    }

    // 自动生成今日营养方案（如果有缓存的个人信息+档位偏好）
    if (typeof autoGenerateDailyPlan === 'function') {
        autoGenerateDailyPlan();
    }

    // 渲染导航栏（doLogin 之前未调用 renderNav，导致导航栏为空）
    renderNav('nav-calculatorSection', 'calculator');
}

function switchUser(name) {
    // 快速切换账号功能已移除，请使用登录页重新登录
    // 如需管理所有用户，请使用管理员后台
    showToast('请使用登录功能', 'info');
}

/**
 * 显示设置页面
 */
function showSettings() {
    renderNav('nav-settingsSection', 'settings');
    hideAllSections();
    $show('settingsSection');

    // 渲染设置内容
    if (typeof renderSettingsPage === 'function') {
        renderSettingsPage();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function logoutUser() {
    // Supabase 登出
    userSignOut();
    
    clearCurrentSessionUser();
    // 退出时不删除保存的密码，只清除当前会话
    surveyState.currentUser = null;
    resetSurveyData();

    // 隐藏右上角用户信息
    $hide('headerRight');

    hideAllSections();
    $show('authSection');

    // 更新账号下拉列表
    updateAccountDatalist();
}

function resetSurveyData() {
    surveyState.foodFreq = {};
    surveyState.otherHabits = {};
    surveyState.tasteLevel = 'none';
}

// ============================================
// 调查问卷渲染
// ============================================

function initSurvey() {
    renderFoodFreqTable();
    renderOtherHabits();
}

/**
 * 渲染食物摄入频率表
 */
function renderFoodFreqTable() {
    const tbody = $('foodFreqBody');
    if (!tbody) return;

    let html = '';
    let lastCategory = '';

    FOOD_FREQ_ITEMS.forEach(item => {
        if (item.category !== lastCategory) {
            html += `<tr class="group-header"><td colspan="4">${item.category}</td></tr>`;
            lastCategory = item.category;
        }

        const id = item.id;
        if (!surveyState.foodFreq[id]) {
            surveyState.foodFreq[id] = { eat: 'yes', freqNum: '', freqUnit: 'day', amount: '' };
        }

        const data = surveyState.foodFreq[id];
        html += `
        <tr>
            <td class="food-name-cell"><span class="food-icon">${item.icon}</span> ${item.name}</td>
            <td>
                <div class="eat-toggle">
                    <button class="eat-btn ${data.eat === 'yes' ? 'active-yes' : ''}" onclick="toggleFreqEat('${id}', 'yes')">吃</button>
                    <button class="eat-btn ${data.eat === 'no' ? 'active-no' : ''}" onclick="toggleFreqEat('${id}', 'no')">不吃</button>
                </div>
            </td>
            <td>
                <div class="freq-input-group">
                    <input type="number" min="0" max="99" class="freq-value" 
                        value="${data.freqNum}" placeholder="次数"
                        onchange="updateFreq('${id}', 'freqNum', this.value)"
                        ${data.eat === 'no' ? 'disabled' : ''}>
                    <span class="freq-label">次/</span>
                    <select class="freq-unit" onchange="updateFreq('${id}', 'freqUnit', this.value)"
                        ${data.eat === 'no' ? 'disabled' : ''}>
                        <option value="day" ${data.freqUnit === 'day' ? 'selected' : ''}>日</option>
                        <option value="week" ${data.freqUnit === 'week' ? 'selected' : ''}>周</option>
                        <option value="month" ${data.freqUnit === 'month' ? 'selected' : ''}>月</option>
                    </select>
                </div>
            </td>
            <td>
                <input type="number" min="0" max="9999" class="amount-input" 
                    value="${data.amount}" placeholder="g"
                    onchange="updateFreq('${id}', 'amount', this.value)"
                    ${data.eat === 'no' ? 'disabled' : ''}>
            </td>
        </tr>`;
    });

    tbody.innerHTML = html;
}

/**
 * 渲染其他饮食习惯（带进食频率输入框+选择器，同行）
 */
function renderOtherHabits() {
    const container = $('otherHabits');
    if (!container) return;

    let html = '<div class="habit-grid">';

    OTHER_HABITS_ITEMS.forEach(item => {
        const id = item.id;
        if (!surveyState.otherHabits[id]) {
            surveyState.otherHabits[id] = { freqNum: '', freqUnit: 'none' };
        }

        const data = surveyState.otherHabits[id];
        const showInput = data.freqUnit !== 'none';
        html += `
        <div class="habit-item">
            <div class="habit-info">
                <span class="habit-icon">${item.icon}</span>
                <span class="habit-name-multi">${item.name}</span>
            </div>
            <div class="habit-freq-row">
                <input type="number" min="0" max="99" class="habit-freq-num"
                    value="${data.freqNum}" placeholder="次数"
                    onchange="updateHabitNum('${id}', this.value)"
                    ${!showInput ? 'disabled' : ''}>
                <select class="habit-freq-unit" onchange="updateHabitUnit('${id}', this.value)">
                    <option value="none" ${data.freqUnit === 'none' ? 'selected' : ''}>基本没有</option>
                    <option value="day" ${data.freqUnit === 'day' ? 'selected' : ''}>次/日</option>
                    <option value="week" ${data.freqUnit === 'week' ? 'selected' : ''}>次/周</option>
                    <option value="month" ${data.freqUnit === 'month' ? 'selected' : ''}>次/月</option>
                </select>
            </div>
        </div>`;
    });

    html += '</div>';

    // 口味程度
    html += `
    <div class="taste-level-section">
        <label>口味是否偏重？</label>
        <div class="taste-options">`;

    TASTE_LEVELS.forEach(level => {
        html += `
        <button class="taste-option ${surveyState.tasteLevel === level.value ? 'active' : ''}" 
            onclick="setTasteLevel('${level.value}')">${level.label}</button>`;
    });

    html += `
        </div>
    </div>`;

    container.innerHTML = html;
}

// ============================================
// 交互事件
// ============================================

function toggleFreqEat(id, value) {
    surveyState.foodFreq[id].eat = value;
    if (value === 'no') {
        surveyState.foodFreq[id].freqNum = '';
        surveyState.foodFreq[id].amount = '';
    }
    renderFoodFreqTable();
}

function updateFreq(id, field, value) {
    surveyState.foodFreq[id][field] = value;
}

function updateHabitNum(id, value) {
    surveyState.otherHabits[id].freqNum = value;
}

function updateHabitUnit(id, value) {
    surveyState.otherHabits[id].freqUnit = value;
    renderOtherHabits();
}

function setTasteLevel(value) {
    surveyState.tasteLevel = value;
    renderOtherHabits();
}

// ============================================
// 提交问卷
// ============================================

function submitSurvey() {
    const name = surveyState.currentUser;
    if (!name) { showToast('请先登录', 'error'); return; }

    // 计算问卷统计（每日实际摄入）
    const intake = calculateIntakeFromSurvey();
    console.debug('📊 问卷统计结果:', intake);

    const surveyResult = {
        name,
        foodFreq: JSON.parse(JSON.stringify(surveyState.foodFreq)),
        otherHabits: JSON.parse(JSON.stringify(surveyState.otherHabits)),
        tasteLevel: surveyState.tasteLevel,
        intake,
        timestamp: new Date().toISOString(),
    };

    saveSurveyData(name, surveyResult);

    $setVal('name', name);

    // 显示方案生成页面
    showResultPage(intake);
    showToast('✅ 问卷已提交！请选择低碳水饮食档位', 'success');
}

/**
 * 跳过问卷，直接进入方案生成
 */
function skipSurvey() {
    const name = surveyState.currentUser;
    if (!name) { showToast('请先登录', 'error'); return; }

    // 计算基本信息（如果已有）
    const formData = loadBasicInfo();
    if (!formData) {
        showToast('请先在设置页填写基本信息', 'info');
        showSettings();
        return;
    }

    // 保存到用户数据
    users[currentUser] = {
        ...users[currentUser],
        ...formData,
        xiaResult: calculateTDEE_XiaMeng(
            formData.height,
            formData.weight,
            formData.age,
            formData.activity
        )
    };

    // 跳转到方案生成页（无问卷数据）
    if (typeof showResultPage === 'function') {
        showResultPage(null);
    }
}

/**
 * 生成方案生成页专用导航（复用NAV_ITEMS定义 +
 * 方案生成active tab）
 */
function renderResultNav() {
    // 固定按钮：方案生成（active，无onclick）
    let html = '<button class="nav-btn active">📊 方案生成</button>';

    // 共享按钮：结果页不需要打卡（已在方案页），去掉避免两行
    const keys = ['checkin', 'history', 'foodDb', 'settings'];
    for (const key of keys) {
        const item = NAV_ITEMS[key];
        if (item) {
            html += `<button class="nav-btn" onclick="${item.show}()">${item.icon} ${item.label}</button>`;
        }
    }

    const navEl = document.getElementById('nav-resultPageSection');
    if (navEl) navEl.innerHTML = html;
}

/**
 * 显示方案生成页面
 */
function showResultPage(intake) {
    hideAllSections();
    $show('resultPageSection');

    // 动态生成导航栏（方案生成页特殊：含active标题）
    renderResultNav();

    // 更新用户名显示（header和页面内）
    const userName = surveyState.currentUser || '用户';
    const userNameEl = $('resultPageUserName');
    const headerUserName = $('headerUserName');
    if (userNameEl) userNameEl.textContent = userName;
    if (headerUserName) {
        const levelInfo = (typeof getUserLevelInfo === 'function') ? getUserLevelInfo(currentUser) : null;
        headerUserName.textContent = (levelInfo ? levelInfo.icon : '👤') + ' ' + userName;
    }

    // 渲染摄入分析
    renderIntakeAnalysisInPage(intake);

    // 显示档位选择（重置为模式选择页）
    profileStep = 'select-mode';
    showProfileSelectorInPage(intake);

    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * 在方案页面渲染摄入分析
 */
function renderIntakeAnalysisInPage(intake) {
    const container = $('intakeAnalysisContent');
    if (!container) return;

    // 没有问卷数据 → 直接跳过分析，显示提示
    if (!intake) {
        container.innerHTML = `<div class="card survey-empty-card">
            <p class="survey-empty-msg">💡 暂未填写饮食问卷，将基于基本信息计算营养方案</p>
            <p class="survey-empty-hint">
                <a href="#" onclick="showSurvey();return false;" class="survey-empty-link">填写问卷</a> 可获得更精准的摄入分析
            </p>
        </div>`;
        return;
    }

    const userData = users[currentUser];
    if (!userData || !userData.xiaResult) {
        container.innerHTML = '<p class="analysis-note">请先填写基本信息</p>';
        return;
    }

    const tdee = userData.xiaResult.tdee;
    const ratio = { protein: 15, fat: 35, carb: 50 };
    const target = {
        protein: Math.round(tdee * ratio.protein / 100 / 4),
        fat: Math.round(tdee * ratio.fat / 100 / 9),
        carb: Math.round(tdee * ratio.carb / 100 / 4),
        kcal: tdee
    };

    const diff = {
        protein: intake.protein - target.protein,
        fat: intake.fat - target.fat,
        carb: intake.carb - target.carb,
        kcal: intake.kcal - target.kcal
    };

    const fmt = (val, unit) => {
        if (!val) return '<span class="diff-zero">未统计</span>';
        if (val === 0) return '<span class="diff-zero">刚好</span>';
        if (val > 0) return `<span class="diff-over">多${val}${unit}</span>`;
        return `<span class="diff-under">少${Math.abs(val)}${unit}</span>`;
    };

    container.innerHTML = `
        <table class="analysis-table">
            <tr><th>营养素</th><th>实际摄入</th><th>目标值</th><th>差异</th></tr>
            <tr><td>热量</td><td>${intake.kcal || 0} kcal</td><td>${target.kcal} kcal</td><td>${fmt(diff.kcal, 'kcal')}</td></tr>
            <tr><td>蛋白质</td><td>${intake.protein || 0}g</td><td>${target.protein}g</td><td>${fmt(diff.protein, 'g')}</td></tr>
            <tr><td>脂肪</td><td>${intake.fat || 0}g</td><td>${target.fat}g</td><td>${fmt(diff.fat, 'g')}</td></tr>
            <tr><td>碳水</td><td>${intake.carb || 0}g</td><td>${target.carb}g</td><td>${fmt(diff.carb, 'g')}</td></tr>
        </table>
    `;
}

/**
 * 根据问卷数据计算每日实际摄入
 */
function calculateIntakeFromSurvey() {
    const result = {
        protein: 0,   // g/天
        fat: 0,       // g/天
        carb: 0,      // g/天
        kcal: 0,      // kcal/天
    };

    // 计算食物摄入
    FOOD_FREQ_ITEMS.forEach(item => {
        const data = surveyState.foodFreq[item.id];
        if (!data || data.eat === 'no' || !data.freqNum || !data.amount) return;

        // 转换为每日次数
        let timesPerDay = parseFloat(data.freqNum);
        if (data.freqUnit === 'week') timesPerDay /= 7;
        if (data.freqUnit === 'month') timesPerDay /= 30;

        // 计算每日摄入量(g) = 次数 × 每份克数
        const gramsPerDay = timesPerDay * parseFloat(data.amount);

        // 转换为每100g的营养
        const n = item.nutrition;
        result.protein += gramsPerDay * n.protein / 100;
        result.fat += gramsPerDay * n.fat / 100;
        result.carb += gramsPerDay * n.carb / 100;
        result.kcal += gramsPerDay * n.kcal / 100;
    });

    // 四舍五入
    result.protein = Math.round(result.protein);
    result.fat = Math.round(result.fat);
    result.carb = Math.round(result.carb);
    result.kcal = Math.round(result.kcal);

    return result;
}

/**
 * 显示问卷统计结果（摄入分析）
 */
function showIntakeAnalysis(intake) {
    const userData = users[currentUser];
    if (!userData || !userData.xiaResult) return '';

    const tdee = userData.xiaResult.tdee;
    const ratio = {
        protein: 15,
        fat: 35,
        carb: 50
    };
    const target = {
        protein: Math.round(tdee * ratio.protein / 100 / 4),  // g
        fat: Math.round(tdee * ratio.fat / 100 / 9),          // g
        carb: Math.round(tdee * ratio.carb / 100 / 4),        // g
        kcal: tdee
    };

    const diff = {
        protein: intake.protein - target.protein,
        fat: intake.fat - target.fat,
        carb: intake.carb - target.carb,
        kcal: intake.kcal - target.kcal
    };

    const fmt = (val, unit) => {
        if (val === 0) return '<span class="diff-zero">刚好</span>';
        if (val > 0) return `<span class="diff-over">多${val}${unit}</span>`;
        return `<span class="diff-under">少${Math.abs(val)}${unit}</span>`;
    };

    return `
        <div class="card" id="intakeAnalysisSection">
            <h3>📊 您的实际饮食分析（近3个月）</h3>
            <p class="analysis-note">基于问卷统计的每日平均摄入量</p>
            <table class="analysis-table">
                <tr><th>营养素</th><th>实际摄入</th><th>目标值</th><th>差异</th></tr>
                <tr><td>热量</td><td>${intake.kcal} kcal</td><td>${target.kcal} kcal</td><td>${fmt(diff.kcal, 'kcal')}</td></tr>
                <tr><td>蛋白质</td><td>${intake.protein}g</td><td>${target.protein}g</td><td>${fmt(diff.protein, 'g')}</td></tr>
                <tr><td>脂肪</td><td>${intake.fat}g</td><td>${target.fat}g</td><td>${fmt(diff.fat, 'g')}</td></tr>
                <tr><td>碳水</td><td>${intake.carb}g</td><td>${target.carb}g</td><td>${fmt(diff.carb, 'g')}</td></tr>
            </table>
        </div>
    `;
}

// ============================================
// 页面切换
// ============================================

function showSurvey() {
    renderNav('nav-surveySection', 'survey', ['calculator', 'survey', 'checkin', 'history', 'learn', 'foodDb', 'settings']);
    hideAllSections();
    $show('surveySection');
    // 每次显示都重新渲染问卷内容，确保表格有数据
    initSurvey();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showCalculator() {
    renderNav('nav-calculatorSection', 'calculator');
    hideAllSections();
    $show('calculatorSection');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 移除打卡状态卡片（如果存在）
    const oldCard = document.getElementById('checkinStatusCard');
    if (oldCard) oldCard.remove();

    // 显示已保存的基本信息摘要
    renderBasicInfoSummary();

    // 自动检测状态（无信息→编辑表单，无档位→引导选档位，有方案→静默生成）
    autoGenerateDailyPlan(true);
}

/**
 * 每日营养方案页面（独立于计算器）
 */
function showPlanPage() {
    renderNav('nav-planSection', 'plan');
    hideAllSections();
    $show('planSection');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const content = document.getElementById('planContent');
    if (!content) return;

    // 从缓存读取方案数据
    if (typeof planCache !== 'undefined' && planCache && typeof renderDailyPlan === 'function') {
        renderDailyPlan(
            planCache.info,
            planCache.xiaResult,
            planCache.bmr,
            planCache.macros,
            planCache.mealPlan,
            planCache.compensation,
            planCache.tier
        );
        return;
    }

    // 无缓存 → 从 localStorage 现场生成
    try {
        const info = loadBasicInfo();
        const tier = loadTierPreference();
        if (info && info.height && info.weight && tier && tier.ratio) {
            const xiaResult = calculateTDEE_XiaMeng(info.height, info.weight, info.age, info.activity);
            const bmr = calculateBMR(info.gender, info.age, info.height, info.weight);
            const compensation = typeof getTodayCompensation === 'function' ? getTodayCompensation(xiaResult.tdee) : 0;
            const adjustedTDEE = xiaResult.tdee + compensation;
            const macros = calculateDailyMacros(adjustedTDEE, tier.ratio);

            users[currentUser] = { ...users[currentUser], ...info, xiaResult, macroRatios: tier.ratio };
            const mealPlan = generateMealPlan(macros);
            savePlanToHistory(mealPlan);

            planCache = { info, xiaResult, bmr, macros, mealPlan, compensation, tier };
            renderDailyPlan(info, xiaResult, bmr, macros, mealPlan, compensation, tier);

            if (typeof renderMVDashboard === 'function' && mealPlan) {
                renderMVDashboard(mealPlan, users[currentUser]);
            }
            return;
        }
    } catch (e) {
        console.warn('showPlanPage 现场生成失败:', e);
    }

    // 实在生成不了 → 显示引导
    content.innerHTML = `<div class="card" style="text-align:center;padding:60px 20px;">
        <p style="font-size:2.5rem;margin-bottom:12px;">🍽️</p>
        <p style="font-size:1.1rem;color:var(--text);margin-bottom:8px;">暂无今日方案</p>
        <p style="color:var(--text-light);margin-bottom:20px;">请先在「营养计算器」中填写个人信息并选择档位</p>
        <button class="btn-primary" onclick="showCalculator()">去计算器 →</button>
    </div>`;
}

function showHistory() {
    renderNav('nav-historySection', 'history');
    hideAllSections();
    $show('historySection');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (typeof renderCalendarPage === 'function') {
        renderCalendarPage();
    }
}

/**
 * 每日打卡入口（导航栏调用）
 * 显示独立的打卡页面（隐藏计算器内容，只保留打卡状态）
 */
function showCheckInPage() {
    // 切换到计算器 section，但隐藏里面的档案和方案内容
    renderNav('nav-calculatorSection', 'checkin');
    hideAllSections();
    $show('calculatorSection');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 隐藏"我的档案"和"今日方案"，打卡页不需要这些
    const inputSection = document.getElementById('inputSection');
    if (inputSection) inputSection.style.display = 'none';
    const resultSection = document.getElementById('resultSection');
    if (resultSection) resultSection.style.display = 'none';
    const dailyPlanContainer = document.getElementById('dailyPlanContainer');
    if (dailyPlanContainer) dailyPlanContainer.style.display = 'none';

    const yesterday = getYesterdayStr();
    const today = new Date();
    const todayStr = todayLocal();
    const yesterdayHistory = getDayHistory(yesterday);
    const todayHistory = getDayHistory(todayStr);

    // 先检查昨日是否需要打卡（优先级高：自动弹窗不容错过）
    if (!isCheckedIn(yesterday) && yesterdayHistory && yesterdayHistory.plan) {
        setTimeout(() => {
            showCheckInPopup(yesterday, yesterdayHistory);
        }, 300);
        return;
    }

    // 显示打卡状态面板（含今日打卡 + 昨日状态）
    showCheckinStatusCard(yesterday, yesterdayHistory, todayHistory, todayStr);
}

/**
 * 在打卡页面显示打卡状态（插入到 calculatorSection）
 */
function showCheckinStatusCard(yesterday, yesterdayHistory, todayHistory, todayStr) {
    const calcSection = document.getElementById('calculatorSection');
    if (!calcSection) return;

    // 检查有没有现有的状态卡片，移除旧的
    const oldCard = document.getElementById('checkinStatusCard');
    if (oldCard) oldCard.remove();

    const statusCard = document.createElement('div');
    statusCard.id = 'checkinStatusCard';
    statusCard.className = 'card';
    statusCard.style.marginBottom = '12px';

    const isYesterdayChecked = isCheckedIn(yesterday);
    const todayHasPlan = !!(todayHistory && todayHistory.plan);

    // 昨日打卡数据
    let yesterdayHtml = '';
    if (isYesterdayChecked) {
        const checkinData = getDayCheckin(yesterday);
        const actual = checkinData?.actual;
        if (actual) {
            yesterdayHtml = `
                <div class="checkin-status-row" style="display:flex;gap:12px;flex-wrap:wrap;font-size:0.9rem;margin-top:4px;color:#2e7d32;">
                    <span>🔥 ${actual.energy || 0} kcal</span>
                    <span>🥩 ${actual.protein || 0}g</span>
                    <span>🥑 ${actual.fat || 0}g</span>
                    <span>🍚 ${actual.carb || 0}g</span>
                </div>`;
        }
    }

    const dateOpts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const yesterdayLabel = new Date(Date.now() - 86400000).toLocaleDateString('zh-CN', dateOpts);

    statusCard.innerHTML = `
        <h4 style="margin:0 0 8px 0;">📅 打卡状态</h4>
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
            <div style="flex:1;min-width:160px;padding:10px;border-radius:8px;background:${isYesterdayChecked ? '#e8f5e9' : '#fff3e0'};">
                <div style="font-size:0.85rem;color:var(--text-light);">昨日 · ${yesterdayLabel}</div>
                <div style="font-size:1.1rem;font-weight:600;margin-top:4px;">
                    ${isYesterdayChecked ? '✅ 已打卡' : '⬜ 未打卡'}
                </div>
                ${yesterdayHtml}
                ${!isYesterdayChecked && yesterdayHistory && yesterdayHistory.plan
                    ? `<button class="btn-primary btn-sm" onclick="showCheckInPopup('${yesterday}', getDayHistory('${yesterday}'))" style="margin-top:6px;font-size:0.8rem;">✏️ 去打卡</button>`
                    : ''}
                ${!yesterdayHistory
                    ? `<div style="font-size:0.8rem;color:var(--text-light);margin-top:4px;">昨日无方案数据</div>`
                    : ''}
            </div>
            <div style="flex:1;min-width:160px;padding:10px;border-radius:8px;background:${todayHasPlan ? '#e3f2fd' : '#f5f5f5'};">
                <div style="font-size:0.85rem;color:var(--text-light);">今日 · ${new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}</div>
                <div style="font-size:1.1rem;font-weight:600;margin-top:4px;">
                    ${todayHasPlan ? '🍽️ 方案已生成' : '📋 暂无方案'}
                </div>
                <div style="font-size:0.8rem;color:var(--text-light);margin-top:4px;">
                    ${todayHasPlan && !isCheckedIn(todayStr)
                        ? `<span style="color:#1976d2;">点击下方按钮记录今日实际饮食</span>`
                        : todayHasPlan && isCheckedIn(todayStr)
                            ? `<span style="color:#2e7d32;">✅ 今日已打卡</span>`
                            : '请在设置页填写个人信息'}
                </div>
                ${todayHasPlan && !isCheckedIn(todayStr) && todayHistory
                    ? `<button class="btn-primary btn-sm" onclick="showCheckInPopup('${todayStr}', getDayHistory('${todayStr}'), 'checkin')" style="margin-top:6px;font-size:0.8rem;">📝 今日打卡</button>`
                    : ''}
            </div>
        </div>
    `;

    // 插入到 calculatorSection 末尾（打卡页独立显示）
    calcSection.appendChild(statusCard);
    statusCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * 扫盲学习台入口
 * 跳转到学习模式（全屏显示知识卡片）
 */
function showLearnPage() {
    // 跳转到学习模式（?mode=learn 会触发 initLearningMode）
    window.location.href = window.location.pathname + '?mode=learn';
}

// ============================================
// Toast
// ============================================

function showToast(message, type) {
    const existing = document.querySelector('.admin-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `admin-toast admin-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ============================================
// 初始化
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    // 事件绑定
    $('surveySubmitBtn')?.addEventListener('click', submitSurvey);
    $('registerBtn')?.addEventListener('click', registerUser);
    $('loginBtn')?.addEventListener('click', loginUser);

});
