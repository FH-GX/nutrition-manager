/**
 * 日历视图 — 我的记录
 * 依赖：app.js 中的 getMealHistory() / getDayHistory() / isCheckedIn()
 */

let calState = {
    year: 0,
    month: 0,   // 0-11
    selectedDate: '', // 'YYYY-MM-DD'
};

/**
 * 渲染日历页（入口）
 */
function renderCalendarPage() {
    const now = new Date();
    if (!calState.year) {
        calState.year = now.getFullYear();
        calState.month = now.getMonth();
    }

    const container = document.getElementById('calendarContainer');
    if (!container) return;

    // 默认选中今天（如果有记录）或最近有数据的日期
    if (!calState.selectedDate) {
        const todayStr = now.toISOString().slice(0, 10);
        const history = getMealHistory();
        if (history.find(h => h.date === todayStr)) {
            calState.selectedDate = todayStr;
        } else if (history.length > 0) {
            calState.selectedDate = history[history.length - 1].date;
        } else {
            calState.selectedDate = todayStr;
        }
    }

    const html = `
        <div class="calendar-scroll-area">
            <div class="calendar-header">
                <span class="calendar-title">📅 我的记录</span>
                <div class="calendar-nav">
                    <button class="calendar-nav-btn" onclick="changeMonth(-1)">◀</button>
                    <span class="calendar-month-label" onclick="showMonthPicker()" title="点击选择月份">${calState.year}年${calState.month + 1}月</span>
                    <button class="calendar-nav-btn" onclick="changeMonth(1)">▶</button>
                </div>
            </div>
            ${renderCalendarGrid()}
            <div class="calendar-legend">
                <span><span class="legend-dot legend-dot-ok"></span> 完成</span>
                <span><span class="legend-dot legend-dot-over"></span> 超额</span>
                <span><span class="legend-dot legend-dot-under"></span> 未达标</span>
                <span><span class="legend-dot legend-dot-none"></span> 未打卡</span>
                <span><span class="today-indicator"></span> 今天</span>
            </div>
            <hr class="calendar-divider">
            <div id="calendarDayDetail">
                ${renderDayDetail(calState.selectedDate)}
            </div>
        </div>
    `;

    container.innerHTML = html;
}

/**
 * 渲染日历网格
 */
function renderCalendarGrid() {
    const { year, month } = calState;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // 周一=0, 周二=1, ..., 周日=6
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const todayStr = new Date().toISOString().slice(0, 10);
    const history = getMealHistory();
    const checkin = getCheckinData();

    // 星期行：直接作为 grid 子元素，日/六标红
    const weekdays = [
        { label: '一', weekend: false },
        { label: '二', weekend: false },
        { label: '三', weekend: false },
        { label: '四', weekend: false },
        { label: '五', weekend: false },
        { label: '六', weekend: true },
        { label: '日', weekend: true },
    ];

    let html = '<div class="calendar-grid">';

    // 星期标题行（7个 grid 子元素）
    weekdays.forEach(w => {
        html += `<div class="calendar-weekday-item${w.weekend ? ' weekend' : ''}">${w.label}</div>`;
    });

    // 空白占位
    for (let i = 0; i < startOffset; i++) {
        html += '<div class="calendar-cell empty"></div>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const isFuture = dateStr > todayStr;
        const isSelected = dateStr === calState.selectedDate;

        // 计算该日是周几，周六=6，周日=0
        const dayOfWeek = new Date(dateStr + 'T12:00:00').getDay();
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

        const record = history.find(h => h.date === dateStr);
        const hasCheckin = !!checkin[dateStr];

        let cellClass = 'calendar-cell';

        // 填充颜色状态（实际摄入 vs 方案 比例）
        if (!isFuture && hasCheckin && record && record.plan && record.actual) {
            const planEnergy = record.plan.targetEnergy || 2100;
            const actualEnergy = record.actual.energy || 0;
            const ratio = planEnergy > 0 ? actualEnergy / planEnergy : 0;
            if (ratio >= 0.9 && ratio <= 1.1) {
                cellClass += ' status-complete';
            } else if (ratio > 1.1) {
                cellClass += ' status-excess';
            } else {
                cellClass += ' status-below';
            }
        }

        let numStyle = '';
        if (isFuture) {
            cellClass += ' future';
        } else if (isToday) {
            cellClass += ' today';
        }

        if (isWeekend && !isFuture) {
            numStyle = 'color:#e57373;';
        }

        if (isSelected) {
            cellClass += ' selected';
        }

        const onclick = isFuture ? '' : ` onclick="selectDate('${dateStr}')"`;

        html += `<div class="${cellClass}"${onclick}>
            <span class="day-num" style="${numStyle}">${d}</span>
        </div>`;
    }

    html += '</div>';
    return html;
}

/**
 * 切换月份
 */
function changeMonth(delta) {
    calState.month += delta;
    if (calState.month < 0) { calState.month = 11; calState.year--; }
    if (calState.month > 11) { calState.month = 0; calState.year++; }
    calState.selectedDate = '';
    renderCalendarPage();
}

/**
 * 月份选择器弹窗
 */
function showMonthPicker() {
    const existing = document.getElementById('monthPickerOverlay');
    if (existing) existing.remove();

    // 弹窗内部维护一个临时年份状态
    let pickerYear = calState.year;

    function buildPickerHTML() {
        const monthNames = ['1月','2月','3月','4月','5月','6月',
                            '7月','8月','9月','10月','11月','12月'];
        let items = monthNames.map((name, idx) => {
            const isActive = (pickerYear === calState.year && idx === calState.month);
            return `<div class="month-picker-item${isActive ? ' active' : ''}"
                        onclick="selectPickerMonth(${idx})">${name}</div>`;
        }).join('');

        return `
            <div class="month-picker-popup" id="monthPickerPopup">
                <div class="month-picker-header">
                    <div class="month-picker-year-nav">
                        <button class="month-picker-year-btn" onclick="pickerChangeYear(-1)">◀</button>
                        <span class="month-picker-year month-year-click" id="pickerYearLabel" onclick="showYearPicker()">${pickerYear}年</span>
                        <button class="month-picker-year-btn" onclick="pickerChangeYear(1)">▶</button>
                    </div>
                </div>
                <div class="month-picker-grid" id="monthPickerGrid">
                    ${items}
                </div>
                <button class="month-picker-close" onclick="closeMonthPicker()">取消</button>
            </div>`;
    }

    const overlay = document.createElement('div');
    overlay.className = 'month-picker-overlay';
    overlay.id = 'monthPickerOverlay';
    overlay.innerHTML = buildPickerHTML();

    // 点遮罩关闭
    overlay.addEventListener('click', e => {
        if (e.target === overlay) closeMonthPicker();
    });

    document.body.appendChild(overlay);

    // 把 pickerYear 状态挂到 overlay 上，方便内部函数读写
    overlay._pickerYear = pickerYear;

    // 把操作函数挂到 window（临时），关闭时清理
    window._pickerChangeYear = function(delta) {
        overlay._pickerYear += delta;
        const lbl = document.getElementById('pickerYearLabel');
        if (lbl) lbl.textContent = overlay._pickerYear + '年';
        // 重绘月份格子
        const grid = document.getElementById('monthPickerGrid');
        if (grid) {
            const monthNames = ['1月','2月','3月','4月','5月','6月',
                                '7月','8月','9月','10月','11月','12月'];
            grid.innerHTML = monthNames.map((name, idx) => {
                const isActive = (overlay._pickerYear === calState.year && idx === calState.month);
                return `<div class="month-picker-item${isActive ? ' active' : ''}"
                            onclick="selectPickerMonth(${idx})">${name}</div>`;
            }).join('');
        }
    };
}

function pickerChangeYear(delta) {
    if (window._pickerChangeYear) window._pickerChangeYear(delta);
}

function selectPickerMonth(monthIdx) {
    const overlay = document.getElementById('monthPickerOverlay');
    const year = overlay ? overlay._pickerYear : calState.year;
    calState.year = year;
    calState.month = monthIdx;
    calState.selectedDate = '';
    closeMonthPicker();
    renderCalendarPage();
}

function closeMonthPicker() {
    const overlay = document.getElementById('monthPickerOverlay');
    if (overlay) overlay.remove();
    window._pickerChangeYear = null;
}

let _yearPickerOverlay = null;

/** 显示年份选择器 */
function showYearPicker() {
    closeMonthPicker();
    closeYearPicker();

    const currentYear = calState.year;
    // 显示当前年份前后各5年
    const startYear = currentYear - 5;

    function buildYearHTML() {
        let items = [];
        for (let y = startYear; y <= startYear + 10; y++) {
            const isActive = (y === calState.year);
            items.push(`<div class="year-picker-item${isActive ? ' active' : ''}"
                            onclick="selectPickerYear(${y})">${y}年</div>`);
        }
        return `
            <div class="month-picker-popup" id="yearPickerPopup">
                <div class="month-picker-header">
                    <div class="month-picker-year-nav">
                        <button class="month-picker-year-btn" onclick="pickerChangeYearRange(-10)">◀</button>
                        <span class="month-picker-year">选择年份</span>
                        <button class="month-picker-year-btn" onclick="pickerChangeYearRange(10)">▶</button>
                    </div>
                </div>
                <div class="year-picker-grid" id="yearPickerGrid">
                    ${items.join('')}
                </div>
                <button class="month-picker-close" onclick="closeYearPicker()">取消</button>
            </div>`;
    }

    const overlay = document.createElement('div');
    overlay.className = 'month-picker-overlay';
    overlay.id = 'yearPickerOverlay';
    overlay.innerHTML = buildYearHTML();

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeYearPicker();
    });

    document.body.appendChild(overlay);
    _yearPickerOverlay = overlay;

    // 年份范围翻页
    window._pickerChangeYearRange = function(delta) {
        const grid = document.getElementById('yearPickerGrid');
        if (!grid) return;
        const firstYear = parseInt(grid.firstElementChild.textContent) + delta;
        let items = [];
        for (let y = firstYear; y <= firstYear + 10; y++) {
            const isActive = (y === calState.year);
            items.push(`<div class="year-picker-item${isActive ? ' active' : ''}"
                            onclick="selectPickerYear(${y})">${y}年</div>`);
        }
        grid.innerHTML = items.join('');
    };
}

function pickerChangeYearRange(delta) {
    if (window._pickerChangeYearRange) window._pickerChangeYearRange(delta);
}

function selectPickerYear(year) {
    calState.year = year;
    calState.selectedDate = '';
    closeYearPicker();
    renderCalendarPage();
}

function closeYearPicker() {
    const overlay = document.getElementById('yearPickerOverlay');
    if (overlay) overlay.remove();
    _yearPickerOverlay = null;
    window._pickerChangeYearRange = null;
}

/**
 * 选中某天
 */
function selectDate(dateStr) {
    calState.selectedDate = dateStr;
    renderCalendarPage();
}

/**
 * 渲染当天详情
 */
function renderDayDetail(dateStr) {
    const record = getDayHistory(dateStr);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (dateStr > todayStr) {
        return '<div class="calendar-detail-empty">🔒 未来的日期，暂无数据</div>';
    }

    const d = new Date(dateStr + 'T12:00:00');
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const label = `${dateStr.replace(/-/g, '/')}（${weekDays[d.getDay()]}）`;

    let html = `<div class="calendar-detail">
        <div class="calendar-detail-title">${label}</div>`;

    if (!record || !record.plan) {
        html += '<div class="calendar-detail-empty">当天未生成方案</div></div>';
        return html;
    }

    const plan = record.plan;
    const actual = record.actual;

    // 从 plan.macros 获取营养素数据
    const pMacros = plan.macros || {};
    const planEnergy = (pMacros.protein ? pMacros.protein.kcal : 0)
                     + (pMacros.fat ? pMacros.fat.kcal : 0)
                     + (pMacros.carb ? pMacros.carb.kcal : 0);
    const planProtein = pMacros.protein ? pMacros.protein.grams : 0;
    const planCarb = pMacros.carb ? pMacros.carb.grams : 0;
    const planFat = pMacros.fat ? pMacros.fat.grams : 0;

    // 方案卡片
    html += `<div class="history-card">
        <div class="history-card-header">
            <span class="history-card-title">📊 方案</span>
            <span class="history-card-kcal">${Math.round(planEnergy)} kcal</span>
        </div>
        <div class="history-card-body">`;

    // 从 plan.breakfast/lunch/snack/dinner 渲染分餐
    const mealConfigs = [
        { key: 'breakfast', label: '早餐', foods: ['grain','egg','dairy','oil'] },
        { key: 'lunch',     label: '午餐', foods: ['grain','protein','veggie','oil'] },
        { key: 'snack',     label: '加餐', foods: ['fruit','nuts'] },
        { key: 'dinner',    label: '晚餐', foods: ['grain','protein','veggie','oil'] }
    ];

    let hasMealData = false;
    for (const cfg of mealConfigs) {
        const meal = plan[cfg.key];
        if (!meal || !meal.foods) continue;
        const items = [];
        for (const fk of cfg.foods) {
            const fd = meal.foods[fk];
            if (fd && fd.name && fd.grams > 0) {
                items.push(`${fd.name}${fd.grams}g`);
            }
        }
        if (items.length > 0) {
            html += `<div>${cfg.label}: ${items.join(' ')}</div>`;
            hasMealData = true;
        }
    }
    if (!hasMealData) html += '<div>无详细分餐数据</div>';

    html += `</div>
        <div class="history-card-footer">
            <span>蛋白 ${Math.round(planProtein)}g</span>
            <span>碳水 ${Math.round(planCarb)}g</span>
            <span>脂肪 ${Math.round(planFat)}g</span>
        </div>
    </div>`;

    // 实际卡片
    if (actual) {
        const actualEnergy = actual.energy || 0;
        const actualProtein = actual.protein || 0;
        const actualCarb = actual.carb || 0;
        const actualFat = actual.fat || 0;
        const deviation = actualEnergy - planEnergy;
        const devPct = planEnergy > 0 ? (deviation / planEnergy * 100).toFixed(1) : 0;

        html += `<div class="history-card">
            <div class="history-card-header">
                <span class="history-card-title">✅ 实际</span>
                <span class="history-card-kcal">${Math.round(actualEnergy)} kcal</span>
            </div>`;

        // 勾选的每餐食物（checkin格式：meals.breakfast.items）
        if (actual.meals) {
            html += '<div class="history-card-body">';
            const mealKeys = { breakfast: '早餐', lunch: '午餐', snack: '加餐', dinner: '晚餐' };
            for (const [mk, ml] of Object.entries(mealKeys)) {
                const md = actual.meals[mk];
                if (md && md.items && md.items.length > 0) {
                    const parts = md.items.map(item =>
                        `${item.checked !== false ? '✓' : '✗'} ${item.name}${item.grams ? item.grams + 'g' : ''}`
                    ).join(' ');
                    html += `<div>${parts}</div>`;
                }
            }
            // 额外食物
            if (actual.customFoods && actual.customFoods.length > 0) {
                actual.customFoods.forEach(f => {
                    if (f.name && f.grams) {
                        html += `<div class="extra-food">+ ${f.name}${f.grams}g（额外）</div>`;
                    }
                });
            }
            html += '</div>';
        } else {
            html += `<div class="history-card-body">
                <span class="extra-food">总计 ${Math.round(actualEnergy)} kcal</span>
            </div>`;
        }

        html += `<div class="history-card-footer">
            <span>蛋白 ${Math.round(actualProtein)}g</span>
            <span>碳水 ${Math.round(actualCarb)}g</span>
            <span>脂肪 ${Math.round(actualFat)}g</span>
        </div>`;

        if (Math.abs(deviation) > 5) {
            const signText = deviation > 0 ? '多了' : '少了';
            html += `<div class="history-deviation">偏差: ${deviation > 0 ? '+' : ''}${Math.round(deviation)} kcal（比方案${signText} ${devPct}%）</div>`;
        }

        html += '</div>';

        if (record.status === 'checked') {
            html += `<button class="history-modify-btn" onclick="modifyCheckin('${dateStr}')">✏️ 修改打卡</button>`;
        }
    } else {
        html += '<div class="calendar-detail-empty">当天未打卡，无实际摄入数据</div>';
        html += `<button class="history-modify-btn" onclick="makeupCheckin('${dateStr}')">📝 补录</button>`;
    }

    html += '</div>';
    return html;
}

/**
 * 修改打卡
 */
function modifyCheckin(dateStr) {
    const record = getDayHistory(dateStr);
    if (!record || !record.plan) {
        showToast('当天无方案数据，无法打卡', 'error');
        return;
    }
    showCheckInPopup(dateStr, record, 'modify');
}

/**
 * 补签打卡（未打卡日期）
 */
function makeupCheckin(dateStr) {
    const record = getDayHistory(dateStr);
    if (!record || !record.plan) {
        showToast('当天无方案数据，无法补签', 'error');
        return;
    }
    showCheckInPopup(dateStr, record, 'modify');
}

/**
 * 辅助：生成日历容器内容（完整刷新用）
 */
function renderCalendarPageContent() {
    const calHtml = `
        <div class="calendar-header">
            <span class="calendar-title">📅 我的记录</span>
            <div class="calendar-nav">
                <button class="calendar-nav-btn" onclick="changeMonth(-1)">◀</button>
                <span class="calendar-month-label">${calState.year}年${calState.month + 1}月</span>
                <button class="calendar-nav-btn" onclick="changeMonth(1)">▶</button>
            </div>
        </div>
        ${renderCalendarGrid()}
        <div class="calendar-legend">
            <span><span class="legend-dot" style="background:#e8f5e9;"></span> 完成</span>
            <span><span class="legend-dot" style="background:#fff3e0;"></span> 超额</span>
            <span><span class="legend-dot" style="background:#ffebee;"></span> 未达标</span>
            <span><span class="legend-dot" style="background:#fff;border:1px solid #e0e0e0;"></span> 未打卡</span>
            <span><span style="display:inline-block;width:6px;height:6px;background:#4a90d9;border-radius:50%;"></span> 今天</span>
        </div>
        <hr class="calendar-divider">
        <div id="calendarDayDetail">
            ${renderDayDetail(calState.selectedDate)}
        </div>
    `;
    return calHtml;
}

// ============================================
// 滚轮翻月（绑在日历容器上）
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('wheel', function(e) {
        const container = document.getElementById('calendarContainer');
        if (!container) return;
        if (!container.contains(e.target)) return;

        const delta = e.deltaY;

        // 如果目标在详情区域内部，不翻月
        const detail = container.querySelector('.calendar-detail');
        if (detail && detail.contains(e.target)) return;
        // 如果目标在滚动区域内，不翻月
        const scrollArea = container.querySelector('.calendar-scroll-area');
        if (scrollArea && scrollArea.contains(e.target) && scrollArea.scrollHeight > scrollArea.clientHeight) {
            // 如果已经滚到顶部或底部，才允许翻月
            if (delta > 0 && scrollArea.scrollTop < scrollArea.scrollHeight - scrollArea.clientHeight - 2) return;
            if (delta < 0 && scrollArea.scrollTop > 2) return;
        }

        if (delta > 20) {
            changeMonth(1);
        } else if (delta < -20) {
            changeMonth(-1);
        }
        e.preventDefault();
    }, { passive: false });
});
