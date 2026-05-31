/**
 * storage.js — localStorage 存储管理
 *
 * 统一管理所有 localStorage key 和读写操作。
 * key 命名规范：nutri_${模块名}_${用户索引}
 *
 * 使用规则：
 * - 所有 localStorage 操作必须经过此模块
 * - 禁止在其它文件中直接调用 localStorage.getItem/setItem
 * - 新增 localStorage key 时，先在此文件注册
 */

// ============================================
// 用户索引（由 app.js 中的全局 currentUser 提供）
// ============================================

// currentUser 在 app.js 中已定义为全局变量（let currentUser = 0）
// storage.js 直接引用该全局变量，不再重复声明

// ============================================
// Key 生成器
// ============================================

/**
 * 生成带用户索引的存储 key
 * @param {string} base - key 基础名
 * @param {number} [userIdx] - 用户索引，默认取全局 currentUser
 * @returns {string}
 */
function getStorageKey(base, userIdx) {
    const idx = userIdx !== undefined ? userIdx : (typeof currentUser !== 'undefined' ? currentUser : 0);
    return `nutri_${base}_${idx}`;
}

// ============================================
// 基础 API（对 localStorage 的封装）
// ============================================

/**
 * 存储任意 JSON 数据
 * @param {string} base - key 基础名
 * @param {*} data - 任意可 JSON 序列化的数据
 * @param {number} [userIdx]
 */
function storeData(base, data, userIdx) {
    localStorage.setItem(getStorageKey(base, userIdx), JSON.stringify(data));
}

/**
 * 读取存储的 JSON 数据
 * @param {string} base - key 基础名
 * @param {*} [defaultVal] - 无数据时的默认值
 * @param {number} [userIdx]
 * @returns {*}
 */
function loadData(base, defaultVal = null, userIdx) {
    const raw = localStorage.getItem(getStorageKey(base, userIdx));
    if (raw === null) return defaultVal;
    try { return JSON.parse(raw); } catch { return raw; }
}

/**
 * 删除存储的 key
 * @param {string} base
 * @param {number} [userIdx]
 */
function removeData(base, userIdx) {
    localStorage.removeItem(getStorageKey(base, userIdx));
}

// ============================================
// 用户基本信息
// ============================================

const BASIC_INFO = 'basic_info';

/**
 * 保存用户基本信息
 * @param {object} data - {name, gender, age, height, weight, activity}
 */
function saveBasicInfo(data) {
    storeData(BASIC_INFO, data);
}

/**
 * 读取用户基本信息
 * @returns {object|null}
 */
function loadBasicInfo() {
    return loadData(BASIC_INFO, null);
}

// ============================================
// 用户等级
// ============================================

const USER_LEVELS = {
    free: { label: '普通', days: 90, icon: '⭐' },
    vip: { label: 'VIP', days: 180, icon: '🌙' },
    plus: { label: 'Plus', days: 365, icon: '☀️' },
    permanent: { label: '永久', days: -1, icon: '👑' }
};

const LEVEL_KEY = 'user_level';

/**
 * 获取某用户的等级 key
 * @param {number} [userIdx]
 * @returns {string} 'free' | 'vip' | 'plus' | 'permanent'
 */
function getUserLevel(userIdx) {
    return loadData(LEVEL_KEY, 'free', userIdx);
}

/**
 * 保存某用户的等级
 * @param {string} level
 * @param {number} [userIdx]
 */
function saveUserLevel(level, userIdx) {
    storeData(LEVEL_KEY, level, userIdx);
}

/**
 * 获取某用户的等级详情对象
 * @param {number} [userIdx]
 * @returns {object}
 */
function getUserLevelInfo(userIdx) {
    const level = getUserLevel(userIdx);
    return USER_LEVELS[level] || USER_LEVELS.free;
}

/**
 * 获取某用户的保留天数
 * @param {number} [userIdx]
 * @returns {number} -1 表示永久
 */
function getRetentionDays(userIdx) {
    return getUserLevelInfo(userIdx).days;
}

// ============================================
// 营养方案历史
// ============================================

const MEAL_HISTORY = 'meal_history';

/**
 * 获取某用户的方案历史
 * @param {number} [userIdx]
 * @returns {Array<{date: string, plan: object}>}
 */
function getMealHistory(userIdx) {
    return loadData(MEAL_HISTORY, [], userIdx);
}

/**
 * 保存方案历史
 * @param {Array} history
 * @param {number} [userIdx]
 */
function saveMealHistory(history, userIdx) {
    storeData(MEAL_HISTORY, history, userIdx);
}

/**
 * 追加一条方案记录
 * @param {string} dateStr - YYYY-MM-DD
 * @param {object} plan - 方案数据
 */
function addMealHistory(dateStr, plan) {
    const history = getMealHistory();
    const existing = history.find(h => h.date === dateStr);
    if (existing) {
        existing.plan = plan;
    } else {
        history.push({ date: dateStr, plan });
    }
    saveMealHistory(history);
}

// ============================================
// 打卡数据
// ============================================

const CHECKIN = 'checkin';

/**
 * 获取打卡数据（按日期索引的对象）
 * @param {number} [userIdx]
 * @returns {object} { 'YYYY-MM-DD': {status, actual}, ... }
 */
function getCheckinData(userIdx) {
    return loadData(CHECKIN, {}, userIdx);
}

/**
 * 保存打卡数据
 * @param {object} data
 * @param {number} [userIdx]
 */
function saveCheckinData(data, userIdx) {
    storeData(CHECKIN, data, userIdx);
}

/**
 * 获取某日打卡状态
 * @param {string} dateStr
 * @returns {object|null} {status, actual} or null
 */
function getDayCheckin(dateStr) {
    const data = getCheckinData();
    return data[dateStr] || null;
}

/**
 * 设置某日打卡
 * @param {string} dateStr
 * @param {string} status - 'checked' | 'skipped'
 * @param {object|null} actual - {energy, protein, carb, fat}
 */
function setDayCheckin(dateStr, status, actual) {
    const data = getCheckinData();
    data[dateStr] = { status, actual: actual || null };
    saveCheckinData(data);
}

// ============================================
// 能量补偿队列
// ============================================

const DEBT = 'debt';

/**
 * 获取能量补偿队列
 * @param {number} [userIdx]
 * @returns {Array}
 */
function getDebtQueue(userIdx) {
    return loadData(DEBT, [], userIdx);
}

/**
 * 保存能量补偿队列
 * @param {Array} queue
 * @param {number} [userIdx]
 */
function saveDebtQueue(queue, userIdx) {
    storeData(DEBT, queue, userIdx);
}

// ============================================
// 本周最后重置日期
// ============================================

const LAST_WEEK_RESET = 'week_reset';

function getLastWeekReset(userIdx) {
    return localStorage.getItem(getStorageKey(LAST_WEEK_RESET, userIdx));
}

function setLastWeekReset(dateStr, userIdx) {
    localStorage.setItem(getStorageKey(LAST_WEEK_RESET, userIdx), dateStr);
}

// ============================================
// 会话/用户管理（全局，不按用户索引）
// ============================================

const KEY_CURRENT = 'today_eaten_current';
const KEY_SAVED_CREDENTIALS = 'today_eaten_saved_creds';
const KEY_USERS = 'today_eaten_users';
const KEY_REGISTER_CODE = 'nutri_register_code';

/** 获取当前登录用户标识 */
function getCurrentSessionUser() {
    return localStorage.getItem(KEY_CURRENT);
}

/** 设置当前登录用户 */
function setCurrentSessionUser(name) {
    localStorage.setItem(KEY_CURRENT, name);
}

/** 清除当前登录用户 */
function clearCurrentSessionUser() {
    localStorage.removeItem(KEY_CURRENT);
}

/** 保存登录凭据（邮箱+密码） */
function saveCredentials(email, password) {
    localStorage.setItem(KEY_SAVED_CREDENTIALS, JSON.stringify({ email, password }));
}

/** 获取保存的登录凭据，返回 {email, password} 或 null */
function getSavedCredentials() {
    try {
        const raw = localStorage.getItem(KEY_SAVED_CREDENTIALS);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

/** 清除保存的登录凭据 */
function clearCredentials() {
    localStorage.removeItem(KEY_SAVED_CREDENTIALS);
}

/** 获取已注册用户列表 */
function getRegisteredUsers() {
    try {
        return JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
    } catch { return []; }
}

/** 保存用户列表
 * @param {Array} userList - [{name, ...}]
 */
function saveRegisteredUsers(userList) {
    localStorage.setItem(KEY_USERS, JSON.stringify(userList));
}

/** 获取注册验证码 */
function getRegisterCode() {
    return localStorage.getItem(KEY_REGISTER_CODE) || '0000';
}

/** 设置注册验证码 */
function setRegisterCode(code) {
    localStorage.setItem(KEY_REGISTER_CODE, code);
}

/** 初始化默认注册验证码 */
function initRegisterCode() {
    if (!localStorage.getItem(KEY_REGISTER_CODE)) {
        localStorage.setItem(KEY_REGISTER_CODE, '0000');
    }
}

// ============================================
// 饮食问卷数据
// ============================================

function getSurveyKey(name) {
    return 'survey_' + name;
}

/** 获取某用户的问卷数据 */
function loadSurveyData(username) {
    const raw = localStorage.getItem(getSurveyKey(username));
    return raw ? JSON.parse(raw) : null;
}

/** 保存某用户的问卷数据 */
function saveSurveyData(username, data) {
    localStorage.setItem(getSurveyKey(username), JSON.stringify(data));
}

// ============================================
// Eat Better 当前记录
// ============================================

function clearTodayEatenCurrent() {
    localStorage.removeItem('today_eaten_current');
}
