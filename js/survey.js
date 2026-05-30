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
    if (!localStorage.getItem('nutri_register_code')) {
        localStorage.setItem('nutri_register_code', '0000');
    }

    // 更新账号下拉列表
    updateAccountDatalist();

    const autoLogin = localStorage.getItem('today_eaten_auto_login') === 'true';
    const current = localStorage.getItem('today_eaten_current');

    const authSection = document.getElementById('authSection');
    const surveySection = document.getElementById('surveySection');
    const calculatorSection = document.getElementById('calculatorSection');

    // 自动登录：检查 Supabase 会话
    if (autoLogin && current) {
        (async () => {
            const session = await checkUserSession();
            if (session.loggedIn) {
                doLogin(current);
            } else {
                // 会话过期，显示登录页
                authSection.style.display = 'block';
                surveySection.style.display = 'none';
                calculatorSection.style.display = 'none';
            }
        })();
        return;
    }

    authSection.style.display = 'block';
    surveySection.style.display = 'none';
    calculatorSection.style.display = 'none';
}

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.remove('active'));
    if (tab === 'register') {
        document.getElementById('authTabRegister').classList.add('active');
        document.getElementById('authFormRegister').style.display = 'block';
        document.getElementById('authFormLogin').style.display = 'none';
    } else {
        document.getElementById('authTabLogin').classList.add('active');
        document.getElementById('authFormRegister').style.display = 'none';
        document.getElementById('authFormLogin').style.display = 'block';
    }
    document.getElementById('authError').style.display = 'none';
}

function updateUserList() {
    // 已有账号列表已移除，此函数保留但不再显示列表
    // 如需查看所有用户，请使用管理员后台
}

/**
 * 更新登录页账号下拉列表（datalist）
 */
function updateAccountDatalist() {
    const datalist = document.getElementById('userAccountList');
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
    const name = document.getElementById('regName').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const confirm = document.getElementById('regConfirm').value.trim();
    const errorEl = document.getElementById('authError');

    // 校验邮箱格式
    if (!name || !password) {
        errorEl.textContent = '请输入邮箱和密码';
        errorEl.style.display = 'block';
        return;
    }

    if (!name.includes('@') || name.split('@').length !== 2 || name.split('@')[1].indexOf('.') === -1) {
        errorEl.textContent = '请输入正确的邮箱格式（如 test@163.com）';
        errorEl.style.display = 'block';
        return;
    }

    // 校验密码：至少6位
    if (password.length < 6) {
        errorEl.textContent = '密码至少6位';
        errorEl.style.display = 'block';
        return;
    }

    if (password !== confirm) {
        errorEl.textContent = '两次密码不一致';
        errorEl.style.display = 'block';
        return;
    }

    // 验证注册码
    const code = document.getElementById('regCode').value.trim();
    const validCode = localStorage.getItem('nutri_register_code') || '0000';
    if (!code) {
        errorEl.textContent = '请输入注册验证码';
        errorEl.style.display = 'block';
        return;
    }
    if (code !== validCode) {
        errorEl.textContent = '注册验证码错误，请联系管理员';
        errorEl.style.display = 'block';
        return;
    }

    errorEl.textContent = '⏳ 注册中...';
    errorEl.style.display = 'block';

    // Supabase 注册
    const result = await userSignUp(name, password);

    if (!result.success) {
        errorEl.textContent = result.error || '注册失败';
        errorEl.style.display = 'block';
        return;
    }

    // 暂存当前用户到 localStorage（兼容现有数据层）
    localStorage.setItem('today_eaten_current', name);

    // 也写入 today_eaten_users 方便管理员后台查看（不存密码）
    const saved = localStorage.getItem('today_eaten_users');
    const users = saved ? JSON.parse(saved) : {};
    if (!users[name]) {
        users[name] = { password: '🔒 Supabase', registered: true };
        localStorage.setItem('today_eaten_users', JSON.stringify(users));
    }

    doLogin(name);
}

async function loginUser() {
    const name = document.getElementById('loginName').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const autoLogin = document.getElementById('autoLoginCheck')?.checked;
    const errorEl = document.getElementById('authError');

    if (!name || !password) {
        errorEl.textContent = '请输入邮箱和密码';
        errorEl.style.display = 'block';
        return;
    }

    errorEl.textContent = '⏳ 登录中...';
    errorEl.style.display = 'block';

    // Supabase 登录
    const result = await userSignIn(name, password);

    if (!result.success) {
        errorEl.textContent = result.error || '登录失败';
        errorEl.style.display = 'block';
        return;
    }

    // 保存登录状态
    localStorage.setItem('today_eaten_auto_login', autoLogin ? 'true' : 'false');
    localStorage.setItem('today_eaten_current', name);

    doLogin(name);
}

function doLogin(name) {
    surveyState.currentUser = name;
    const displayName = getDisplayName(name);

    document.getElementById('authSection').style.display = 'none';
    document.getElementById('surveySection').style.display = 'none';
    document.getElementById('foodDbSection').style.display = 'none';
    document.getElementById('calculatorSection').style.display = 'block';
    document.getElementById('surveyUserName').textContent = displayName;
    // 更新右上角用户信息
    const hdrUser = document.getElementById('headerUserName');
    if (hdrUser) {
        const levelInfo = (typeof getUserLevelInfo === 'function') ? getUserLevelInfo(currentUser) : null;
        hdrUser.textContent = (levelInfo ? levelInfo.icon : '👤') + ' ' + displayName;
    }
    document.getElementById('authError').style.display = 'none';

    // 显示右上角用户信息
    const headerRight = document.getElementById('headerRight');
    if (headerRight) headerRight.style.display = 'flex';

    updateNavActive('calculator');

    initSurvey();
}

function updateNavActive(tab) {
    const btns = document.querySelectorAll('.nav-btn');
    btns.forEach(b => b.classList.remove('active'));
    // 0: calculator, 1: survey, 2: history, 3: foodDb
    if (tab === 'calculator' && btns.length > 0) btns[0].classList.add('active');
    if (tab === 'survey' && btns.length > 1) btns[1].classList.add('active');
    if (tab === 'history' && btns.length > 2) btns[2].classList.add('active');
    if (tab === 'foodDb' && btns.length > 3) btns[3].classList.add('active');
}

function switchUser(name) {
    // 快速切换账号功能已移除，请使用登录页重新登录
    // 如需管理所有用户，请使用管理员后台
    showToast('请使用登录功能', 'info');
}

function logoutUser() {
    // Supabase 登出
    userSignOut();
    
    localStorage.removeItem('today_eaten_current');
    // 保留自动登录设置，只清除当前会话
    surveyState.currentUser = null;
    resetSurveyData();

    // 隐藏右上角用户信息
    const headerRight = document.getElementById('headerRight');
    if (headerRight) headerRight.style.display = 'none';

    document.getElementById('surveySection').style.display = 'none';
    document.getElementById('resultPageSection').style.display = 'none';
    document.getElementById('authSection').style.display = 'block';

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
    const tbody = document.getElementById('foodFreqBody');
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
    const container = document.getElementById('otherHabits');
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
    console.log('📊 问卷统计结果:', intake);

    const surveyResult = {
        name,
        foodFreq: JSON.parse(JSON.stringify(surveyState.foodFreq)),
        otherHabits: JSON.parse(JSON.stringify(surveyState.otherHabits)),
        tasteLevel: surveyState.tasteLevel,
        intake,
        timestamp: new Date().toISOString(),
    };

    localStorage.setItem('survey_' + name, JSON.stringify(surveyResult));

    document.getElementById('name').value = name;

    // 显示方案生成页面
    showResultPage(intake);
    showToast('✅ 问卷已提交！请选择低碳水饮食档位', 'success');
}

/**
 * 显示方案生成页面
 */
function showResultPage(intake) {
    // 隐藏其他区域
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('calculatorSection').style.display = 'none';
    document.getElementById('surveySection').style.display = 'none';
    document.getElementById('foodDbSection').style.display = 'none';
    document.getElementById('resultSection').style.display = 'none';

    // 显示方案生成页面
    const resultPage = document.getElementById('resultPageSection');
    resultPage.style.display = 'block';

    // 更新用户名显示（header和页面内）
    const userName = surveyState.currentUser || '用户';
    const userNameEl = document.getElementById('resultPageUserName');
    const headerUserName = document.getElementById('headerUserName');
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
    const container = document.getElementById('intakeAnalysisContent');
    if (!container) return;

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
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('surveySection').style.display = 'block';
    document.getElementById('calculatorSection').style.display = 'none';
    document.getElementById('foodDbSection').style.display = 'none';
    document.getElementById('resultPageSection').style.display = 'none';
    updateNavActive('survey');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showCalculator() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('surveySection').style.display = 'none';
    document.getElementById('foodDbSection').style.display = 'none';
    document.getElementById('resultPageSection').style.display = 'none';
    document.getElementById('calculatorSection').style.display = 'block';
    updateNavActive('calculator');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showHistory() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('surveySection').style.display = 'none';
    document.getElementById('calculatorSection').style.display = 'none';
    document.getElementById('foodDbSection').style.display = 'none';
    document.getElementById('resultPageSection').style.display = 'none';
    document.getElementById('historySection').style.display = 'block';
    updateNavActive('history');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (typeof renderCalendarPage === 'function') {
        renderCalendarPage();
    }
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
    document.getElementById('surveySubmitBtn')?.addEventListener('click', submitSurvey);
    document.getElementById('registerBtn')?.addEventListener('click', registerUser);
    document.getElementById('loginBtn')?.addEventListener('click', loginUser);
    document.getElementById('logoutBtn')?.addEventListener('click', logoutUser);
});
