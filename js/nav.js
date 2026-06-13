/**
 * 导航栏组件
 * 统一管理所有页面的导航标签，由 JS 动态生成
 */

const NAV_ITEMS = {
    calculator: { icon: '🧮', label: '营养计算器', show: 'showCalculator' },
    plan:       { icon: '🍽️', label: '每日方案',   show: 'showPlanPage' },
    survey:     { icon: '📋', label: '填写问卷',   show: 'showSurvey' },
    checkin:    { icon: '📅', label: '每日打卡',   show: 'showCheckInPage' },
    history:    { icon: '📊', label: '我的记录',   show: 'showHistory' },
    learn:      { icon: '📚', label: '扫盲学习',   show: 'showLearnPage' },
    foodDb:     { icon: '🍎', label: '食物库',     show: 'showFoodDatabase' },
    settings:   { icon: '⚙️', label: '设置',       show: 'showSettings' },
};

/**
 * 渲染导航栏到指定容器
 * @param {string} containerId 目标容器 ID
 * @param {string} activeKey 当前活跃的 tab key
 * @param {string[]} [customKeys] 可选，自定义按钮顺序。不传则根据数据状态自动选择
 */
function renderNav(containerId, activeKey, customKeys) {
    const keys = customKeys || getDefaultNavKeys();
    // 用户芯片（桌面端隐藏，手机端显示）
    const userName = getNavDisplayName();
    const userChip = `<div class="nav-user-chip" onclick="toggleFamilyDropdown()">👤 ${userName} <span class="nav-user-arrow">▼</span></div>`;
    const html = userChip + keys.map(key => {
        const item = NAV_ITEMS[key];
        if (!item) return '';
        const activeClass = key === activeKey ? ' active' : '';
        return `<button class="nav-btn${activeClass}" onclick="${item.show}()">${item.icon} ${item.label}</button>`;
    }).join('');
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = html;
}

/**
 * 根据数据状态返回默认导航按钮顺序
 * 已有数据 → 隐藏营养计算器（以每日方案为主入口）
 * 新用户 → 显示营养计算器
 */
function getDefaultNavKeys() {
    let info = null;
    let tier = null;
    try {
        if (typeof loadBasicInfo === 'function') info = loadBasicInfo();
        if (typeof loadTierPreference === 'function') tier = loadTierPreference();
    } catch(e) {}
    const hasData = info && info.height && info.weight && tier && tier.ratio;
    if (hasData) {
        return ['plan', 'checkin', 'history', 'foodDb'];
    }
    return ['calculator', 'checkin', 'history', 'foodDb'];
}

/**
 * 获取当前用户显示名（邮箱@前的部分）
 */
function getNavDisplayName() {
    const raw = (typeof surveyState !== 'undefined' && surveyState.currentUser) || getCurrentSessionUser() || '用户';
    return raw.split('@')[0];
}
