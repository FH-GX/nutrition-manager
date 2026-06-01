/**
 * utils.js — DOM快捷操作 + 通用工具函数
 *
 * 使用规范：
 * - $()       -> document.getElementById()
 * - $show()   -> .style.display = 'block'
 * - $hide()   -> .style.display = 'none'
 * - $toggle() -> 切换 block/none
 * - $val()    -> .value 取值（返回 string）
 * - $num()    -> parseFloat(.value) 取数字
 * - $int()    -> parseInt(.value) 取整数
 * - $html()   -> .innerHTML 写内容
 * - $text()   -> .textContent 写文本
 * - showToast() -> 轻提示弹窗
 * - showConfirmDialog() -> 确认弹窗
 */

// ============================================
// DOM 选择器
// ============================================

/** @param {string} id */
const $ = id => document.getElementById(id);

// ============================================
// 显示/隐藏
// ============================================

/** 显示元素（block） */
const $show = id => { const el = $(id); if (el) el.style.display = 'block'; };

/** 显示元素（flex） */
const $showFlex = id => { const el = $(id); if (el) el.style.display = 'flex'; };

/** 隐藏元素（none） */
const $hide = id => { const el = $(id); if (el) el.style.display = 'none'; };

/** 切换显示/隐藏 */
const $toggle = id => {
    const el = $(id);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

// ============================================
// 取值器
// ============================================

/** 获取 input/textarea 的 trim value，无值返回 fallback */
const $val = (id, fallback = '') => ($(id)?.value || '').trim() || fallback;

/** 获取 float 数字，无法解析返回 fallback */
const $num = (id, fallback = 0) => {
    const v = parseFloat($(id)?.value);
    return isNaN(v) ? fallback : v;
};

/** 获取整数，无法解析返回 fallback */
const $int = (id, fallback = 0) => {
    const v = parseInt($(id)?.value);
    return isNaN(v) ? fallback : v;
};

/** 获取 select 的选中值 */
const $sel = (id, fallback = '') => $(id)?.value || fallback;

// ============================================
// 写入器
// ============================================

/** 设置 innerHTML */
const $html = (id, content) => { const el = $(id); if (el) el.innerHTML = content; };

/** 设置 textContent */
const $text = (id, content) => { const el = $(id); if (el) el.textContent = content; };

/** 设置 value */
const $setVal = (id, value) => { const el = $(id); if (el) el.value = value; };

// ============================================
// CSS 类操作
// ============================================

const $addClass = (id, cls) => { const el = $(id); if (el) el.classList.add(cls); };
const $removeClass = (id, cls) => { const el = $(id); if (el) el.classList.remove(cls); };
const $toggleClass = (id, cls) => { const el = $(id); if (el) el.classList.toggle(cls); };

// ============================================
// 消息提示
// ============================================

/** CSS class 名称（在 survey.css 中定义） */
const MSG_CLASSES = {
    success: 'msg-success',
    error: 'msg-error',
    info: 'msg-info',
    warning: 'msg-warning',
};

/**
 * 向指定元素写入消息（带样式）
 * @param {string} id - 元素 ID
 * @param {string} text - 消息文本
 * @param {'success'|'error'|'info'|'warning'} type - 消息类型
 * @param {number|null} autoClearMs - 自动清除时间（ms），null 则不清除
 */
function $msg(id, text, type = 'info', autoClearMs = null) {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.className = MSG_CLASSES[type] || MSG_CLASSES.info;
    if (autoClearMs) {
        setTimeout(() => { el.textContent = ''; el.className = ''; }, autoClearMs);
    }
}

// ============================================
// Toast 轻提示弹窗
// ============================================

/**
 * 显示 Toast 轻提示（右上角弹入，自动消失）
 * @param {string} msg - 提示内容
 * @param {'success'|'error'|'info'|'warning'} type - 类型
 * @param {number} duration - 显示时间（ms）
 */
function showToast(msg, type = 'info', duration = 3000) {
    // 复用或创建 toast 容器
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const iconMap = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const colorMap = {
        success: '#2e7d32', error: '#c62828', info: '#1565c0', warning: '#e65100'
    };
    toast.style.cssText = `
        padding: 12px 20px; border-radius: 8px; background: #fff;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-size: 14px;
        border-left: 4px solid ${colorMap[type] || '#888'};
        animation: toastIn 0.3s ease-out; max-width: 360px;
        word-break: break-word; line-height: 1.5;
    `;
    toast.textContent = `${iconMap[type] || ''} ${msg}`;
    container.appendChild(toast);

    // 滑入动画
    if (!document.getElementById('toastStyle')) {
        const style = document.createElement('style');
        style.id = 'toastStyle';
        style.textContent = `
            @keyframes toastIn { from { transform:translateX(100px); opacity:0; } to { transform:translateX(0); opacity:1; } }
            @keyframes toastOut { from { transform:translateX(0); opacity:1; } to { transform:translateX(100px); opacity:0; } }
        `;
        document.head.appendChild(style);
    }

    // 自动移除
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ============================================
// 确认弹窗（替代原生 confirm）
// ============================================

/**
 * 显示自定义确认弹窗
 * @param {string} title - 标题
 * @param {string} message - 消息内容
 * @param {function} onConfirm - 确认回调
 * @param {function} [onCancel] - 取消回调
 */
function showConfirmDialog(title, message, onConfirm, onCancel) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);
        z-index:99998;display:flex;align-items:center;justify-content:center;
        animation:fadeIn 0.2s ease-out;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background:#fff;border-radius:12px;padding:24px;max-width:400px;
        width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);
    `;
    dialog.innerHTML = `
        <h3 class="dialog-title">${title}</h3>
        <p class="dialog-message">${message}</p>
        <div class="dialog-actions">
            <button id="confirmDialogCancel" class="dialog-btn dialog-btn-cancel">取消</button>
            <button id="confirmDialogOk" class="dialog-btn dialog-btn-confirm">确定</button>
        </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    overlay.querySelector('#confirmDialogOk').onclick = () => {
        overlay.remove();
        if (typeof onConfirm === 'function') onConfirm();
    };
    overlay.querySelector('#confirmDialogCancel').onclick = () => {
        overlay.remove();
        if (typeof onCancel === 'function') onCancel();
    };
    overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); if (typeof onCancel === 'function') onCancel(); } };
}

// ============================================
// 通用工具
// ============================================

/**
 * 安全执行异步操作并返回 {success, data, error}
 * @param {function} asyncFn - 异步函数
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
async function safeAsync(asyncFn) {
    try {
        const result = await asyncFn();
        return { success: true, data: result };
    } catch (err) {
        console.error('[safeAsync]', err);
        return { success: false, error: err.message || '操作失败' };
    }
}

/**
 * 格式化日期为 YYYY-MM-DD
 * @param {Date|string} date
 * @returns {string}
 */
function fmtDate(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().slice(0, 10);
}

/**
 * 获取本地时区今天的日期字符串 YYYY-MM-DD（解决 toISOString 返回 UTC 日期的问题）
 * @returns {string}
 */
function todayLocal() {
    const d = new Date();
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

/**
 * 获取本地时区某天的日期字符串（偏移量 days 天）
 * @param {number} offset - 正数未来，负数过去
 * @returns {string}
 */
function dayOffsetLocal(offset) {
    const d = new Date();
    d.setDate(d.getDate() + (offset || 0));
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

/**
 * 深拷贝对象
 */
function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// ============================================
// 页面 Section 控制
// ============================================

/** 所有需要 show/hide 控制的主 section ID 列表 */
const ALL_SECTIONS = [
    'authSection', 'calculatorSection', 'surveySection',
    'resultPageSection', 'historySection', 'settingsSection', 'foodDbSection'
];

/**
 * 隐藏所有主 section
 * （用于 showXxx 函数开头的批量隐藏）
 */
function hideAllSections() {
    ALL_SECTIONS.forEach(id => $hide(id));
}
