/**
 * 导航栏组件
 * 统一管理所有页面的导航标签，由 JS 动态生成
 */

const NAV_ITEMS = {
    calculator: { icon: '🧮', label: '营养计算器', show: 'showCalculator' },
    survey:     { icon: '📋', label: '填写问卷',   show: 'showSurvey' },
    checkin:    { icon: '📅', label: '每日打卡',   show: 'showCheckInPage' },
    history:    { icon: '📊', label: '我的记录',   show: 'showHistory' },
    foodDb:     { icon: '🍎', label: '食物库',     show: 'showFoodDatabase' },
    settings:   { icon: '⚙️', label: '设置',       show: 'showSettings' },
};

/**
 * 渲染导航栏到指定容器
 * @param {string} containerId 目标容器 ID
 * @param {string} activeKey 当前活跃的 tab key
 * @param {string[]} [customKeys] 可选，自定义按钮顺序。不传则使用默认顺序
 */
function renderNav(containerId, activeKey, customKeys) {
    const keys = customKeys || ['calculator', 'checkin', 'history', 'foodDb', 'settings'];
    const html = keys.map(key => {
        const item = NAV_ITEMS[key];
        if (!item) return '';
        const activeClass = key === activeKey ? ' active' : '';
        return `<button class="nav-btn${activeClass}" onclick="${item.show}()">${item.icon} ${item.label}</button>`;
    }).join('');
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = html;
}
