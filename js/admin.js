/**
 * 管理员后台模块
 * 管理知识库 + 扫盲学习台
 * 触发方式：Ctrl+Shift+D 打开登录弹窗
 */

// ============================================
// 状态管理
// ============================================

let adminState = {
    loggedIn: false,
    user: null,
    knowledgeItems: [],
    editingId: null, // 正在编辑的知识条目ID
};

// ============================================
// 管理员登录/登出
// ============================================

/**
 * 显示管理员登录弹窗
 */
function showAdminLoginModal() {
    // 如果已有弹窗，不重复创建
    if (document.querySelector('.admin-login-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'admin-login-overlay';
    overlay.innerHTML = `
        <div class="admin-modal">
            <button class="admin-modal-close">&times;</button>
            <h3>🔐 管理员登录</h3>
            <p class="admin-modal-desc">使用管理员账号登录后管理知识库</p>
            <div class="admin-form-group">
                <label>邮箱</label>
                <input type="email" id="adminEmail" placeholder="请输入管理员邮箱" autocomplete="email">
            </div>
            <div class="admin-form-group">
                <label>密码</label>
                <input type="password" id="adminPassword" placeholder="请输入密码" autocomplete="current-password">
            </div>
            <div class="admin-form-error" id="adminLoginError" style="display:none;"></div>
            <button class="admin-btn admin-btn-primary" id="adminLoginBtn">登录</button>
            <p class="admin-modal-footer">首次使用？请在Supabase Dashboard的Authentication中创建管理员账号</p>
        </div>
    `;
    document.body.appendChild(overlay);

    // 关闭按钮
    overlay.querySelector('.admin-modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    // 登录按钮
    const loginBtn = overlay.querySelector('#adminLoginBtn');
    const emailInput = overlay.querySelector('#adminEmail');
    const pwdInput = overlay.querySelector('#adminPassword');
    const errorEl = overlay.querySelector('#adminLoginError');

    const doLogin = async () => {
        const email = emailInput.value.trim();
        const password = pwdInput.value.trim();
        if (!email || !password) {
            errorEl.textContent = '请输入邮箱和密码';
            errorEl.style.display = 'block';
            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = '登录中...';
        errorEl.style.display = 'none';

        const result = await adminLogin(email, password);
        if (result.success) {
            adminState.loggedIn = true;
            adminState.user = result.user;
            overlay.remove();
            showAdminPanel();
        } else {
            errorEl.textContent = result.error || '登录失败，请检查账号密码';
            errorEl.style.display = 'block';
            loginBtn.disabled = false;
            loginBtn.textContent = '登录';
        }
    };

    loginBtn.addEventListener('click', doLogin);

    // 回车提交
    [emailInput, pwdInput].forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doLogin();
        });
    });

    // 自动聚焦
    setTimeout(() => emailInput.focus(), 100);
}

/**
 * 显示管理员面板
 */
async function showAdminPanel() {
    // 隐藏所有主界面，显示管理面板
    const authSection = document.getElementById('authSection');
    const surveySection = document.getElementById('surveySection');
    const calculatorSection = document.getElementById('calculatorSection');
    const adminSection = document.getElementById('adminSection');

    if (!adminSection) {
        console.error('adminSection not found');
        return;
    }

    if (authSection) authSection.style.display = 'none';
    if (surveySection) surveySection.style.display = 'none';
    if (calculatorSection) calculatorSection.style.display = 'none';
    adminSection.style.display = 'block';

    // 加载知识库数据
    await loadKnowledgeItems();
}

/**
 * 隐藏管理员面板，返回主界面
 */
function hideAdminPanel() {
    const authSection = document.getElementById('authSection');
    const surveySection = document.getElementById('surveySection');
    const calculatorSection = document.getElementById('calculatorSection');
    const adminSection = document.getElementById('adminSection');

    adminSection.style.display = 'none';

    // 判断用户之前在哪
    const currentUser = localStorage.getItem('today_eaten_current');
    
    if (currentUser) {
        // 已登录 → 显示问卷
        if (authSection) authSection.style.display = 'none';
        if (surveySection) surveySection.style.display = 'block';
        if (calculatorSection) calculatorSection.style.display = 'none';
    } else {
        // 未登录 → 显示登录
        if (authSection) authSection.style.display = 'block';
        if (surveySection) surveySection.style.display = 'none';
        if (calculatorSection) calculatorSection.style.display = 'none';
    }
}

/**
 * 处理管理员退出（从HTML按钮调用）
 */
async function handleAdminLogout() {
    await adminLogout();
    adminState.loggedIn = false;
    adminState.user = null;
    adminState.knowledgeItems = [];
    hideAdminPanel();
    showAdminToast('已退出管理', 'success');
}

// ============================================
// 知识库管理
// ============================================

/**
 * 加载知识库条目
 */
async function loadKnowledgeItems() {
    const result = await getAllKnowledgeItems();
    if (result.success) {
        adminState.knowledgeItems = result.data;
        renderKnowledgeList();
        renderDisplaySettings();
    } else {
        showAdminToast('加载知识库失败: ' + result.error, 'error');
    }
}

/**
 * 渲染知识库列表
 */
function renderKnowledgeList() {
    const container = document.getElementById('knowledgeList');
    if (!container) return;

    const items = adminState.knowledgeItems;
    if (items.length === 0) {
        container.innerHTML = '<div class="admin-empty">暂无知识条目，点击上方"添加"按钮创建</div>';
        return;
    }

    let html = '';
    items.forEach(item => {
        const catLabel = item.category === '名词解释' ? '📖' : '🧮';
        const catClass = item.category === '名词解释' ? 'cat-concept' : 'cat-formula';
        html += `
        <div class="admin-knowledge-item" data-id="${item.id}">
            <div class="admin-item-header">
                <span class="admin-item-cat ${catClass}">${catLabel} ${item.category}</span>
                <span class="admin-item-order">#${item.display_order}</span>
            </div>
            <div class="admin-item-title">${escapeHtml(item.title)}</div>
            <div class="admin-item-preview">${escapeHtml(item.content.substring(0, 80))}${item.content.length > 80 ? '...' : ''}</div>
            <div class="admin-item-actions">
                <button class="admin-btn-sm admin-btn-edit" onclick="editKnowledgeItem(${item.id})">✏️ 编辑</button>
                <button class="admin-btn-sm admin-btn-del" onclick="confirmDeleteItem(${item.id})">🗑️ 删除</button>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

/**
 * 显示添加/编辑表单
 */
function showKnowledgeForm(itemId) {
    adminState.editingId = itemId || null;
    const form = document.getElementById('knowledgeForm');
    const titleEl = document.getElementById('knowledgeFormTitle');
    const nameEl = document.getElementById('knowledgeName');
    const contentEl = document.getElementById('knowledgeContent');
    const catEl = document.getElementById('knowledgeCategory');

    if (itemId) {
        // 编辑模式：加载现有数据
        const item = adminState.knowledgeItems.find(i => i.id === itemId);
        if (!item) return;
        titleEl.textContent = '✏️ 编辑知识条目';
        nameEl.value = item.title;
        contentEl.value = item.content;
        catEl.value = item.category;
    } else {
        // 新增模式
        titleEl.textContent = '➕ 添加知识条目';
        nameEl.value = '';
        contentEl.value = '';
        catEl.value = '名词解释';
    }

    form.style.display = 'block';
    nameEl.focus();
}

/**
 * 隐藏知识表单
 */
function hideKnowledgeForm() {
    document.getElementById('knowledgeForm').style.display = 'none';
    adminState.editingId = null;
}

/**
 * 保存知识条目（新增/更新）
 */
async function saveKnowledgeItem() {
    const name = document.getElementById('knowledgeName').value.trim();
    const content = document.getElementById('knowledgeContent').value.trim();
    const category = document.getElementById('knowledgeCategory').value;

    if (!name) { showAdminToast('请输入标题', 'error'); return; }
    if (!content) { showAdminToast('请输入内容', 'error'); return; }

    let result;
    if (adminState.editingId) {
        // 更新
        result = await updateKnowledgeItem(adminState.editingId, {
            title: name,
            content: content,
            category: category,
        });
    } else {
        // 新增
        result = await addKnowledgeItem(name, content, category);
    }

    if (result.success) {
        showAdminToast(adminState.editingId ? '✅ 更新成功' : '✅ 添加成功', 'success');
        hideKnowledgeForm();
        await loadKnowledgeItems();
    } else {
        showAdminToast('保存失败: ' + result.error, 'error');
    }
}

/**
 * 编辑知识条目
 */
function editKnowledgeItem(id) {
    // 切换到知识库标签
    switchAdminTab('knowledge');
    showKnowledgeForm(id);
}

/**
 * 确认删除
 */
function confirmDeleteItem(id) {
    const item = adminState.knowledgeItems.find(i => i.id === id);
    if (!item) return;

    showConfirmDialog({
        title: '删除确认',
        message: `确定要删除"${item.title}"吗？\n此操作不可撤销！`,
        confirmText: '确认删除',
        danger: true,
        onConfirm: () => deleteItem(id)
    });
}

async function deleteItem(id) {
    const result = await deleteKnowledgeItem(id);
    if (result.success) {
        showAdminToast('🗑️ 删除成功', 'success');
        await loadKnowledgeItems();
    } else {
        showAdminToast('删除失败: ' + result.error, 'error');
    }
}

// ============================================
// 扫盲学习台（勾选管理）
// ============================================

/**
 * 渲染勾选设置
 */
function renderDisplaySettings() {
    const container = document.getElementById('displaySettingsList');
    if (!container) return;

    const items = adminState.knowledgeItems;
    if (items.length === 0) {
        container.innerHTML = '<div class="admin-empty">暂无知识条目</div>';
        return;
    }

    let html = '';
    items.forEach(item => {
        const catLabel = item.category === '名词解释' ? '📖' : '🧮';
        html += `
        <div class="admin-check-item ${item.is_displayed ? 'checked' : ''}" data-id="${item.id}">
            <label class="admin-checkbox-label">
                <input type="checkbox" class="admin-checkbox"
                    ${item.is_displayed ? 'checked' : ''}
                    onchange="toggleItemDisplay(${item.id}, this.checked)">
                <div class="admin-check-content">
                    <span class="admin-check-cat">${catLabel}</span>
                    <span class="admin-check-title">${escapeHtml(item.title)}</span>
                </div>
            </label>
            <div class="admin-check-status ${item.is_displayed ? 'on' : 'off'}">
                ${item.is_displayed ? '✅ 已展示' : '⏸️ 未展示'}
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

/**
 * 切换单个条目的展示状态
 */
async function toggleItemDisplay(id, checked) {
    const result = await toggleDisplayStatus(id, checked);
    if (result.success) {
        // 更新本地状态
        const item = adminState.knowledgeItems.find(i => i.id === id);
        if (item) item.is_displayed = checked;
        renderDisplaySettings();
        updateDisplayCount();
    } else {
        showAdminToast('操作失败: ' + result.error, 'error');
        // 回滚勾选状态
        renderDisplaySettings();
    }
}

/**
 * 全选/取消全选
 */
async function selectAllDisplay(checked) {
    // 获取当前所有条目
    const items = adminState.knowledgeItems;
    let successCount = 0;
    let failCount = 0;

    for (const item of items) {
        if (item.is_displayed !== checked) {
            const result = await toggleDisplayStatus(item.id, checked);
            if (result.success) {
                item.is_displayed = checked;
                successCount++;
            } else {
                failCount++;
            }
        }
    }

    renderDisplaySettings();
    updateDisplayCount();

    if (failCount === 0) {
        showAdminToast(checked ? `✅ 已全部勾选（${successCount}项）` : `✅ 已全部取消（${successCount}项）`, 'success');
    } else {
        showAdminToast(`完成${successCount}项，${failCount}项失败`, 'error');
    }
}

/**
 * 更新展示计数
 */
function updateDisplayCount() {
    const count = adminState.knowledgeItems.filter(i => i.is_displayed).length;
    const el = document.getElementById('displayCount');
    if (el) el.textContent = `${count}/${adminState.knowledgeItems.length} 项已勾选`;
}

/**
 * 预览学习台（新窗口查看家人看到的内容）
 */
function previewLearningPage() {
    // 收集所有已勾选的条目ID
    const displayedIds = adminState.knowledgeItems
        .filter(i => i.is_displayed)
        .map(i => i.id);

    if (displayedIds.length === 0) {
        showAdminToast('请先勾选要展示的内容', 'error');
        return;
    }

    // 生成预览URL（使用特殊参数表示学习模式）
    const url = `${window.location.origin}${window.location.pathname}?mode=learn`;
    window.open(url, '_blank');
}

/**
 * 保存知识库到本地JSON（离线备份用）
 */
function exportKnowledgeBase() {
    const data = JSON.stringify(adminState.knowledgeItems, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `知识库备份_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showAdminToast('📦 知识库已导出', 'success');
}

// ============================================
// 标签切换
// ============================================

function switchAdminTab(tab) {
    // 隐藏所有tab内容
    document.querySelectorAll('.admin-tab-content').forEach(el => {
        el.classList.remove('active');
    });
    // 取消所有tab按钮高亮
    document.querySelectorAll('.admin-tab-btn').forEach(el => {
        el.classList.remove('active');
    });

    // 显示选中的tab
    const contentEl = document.getElementById(`tab-${tab}`);
    const btnEl = document.querySelector(`.admin-tab-btn[data-tab="${tab}"]`);
    if (contentEl) contentEl.classList.add('active');
    if (btnEl) btnEl.classList.add('active');

    if (tab === 'display') {
        updateDisplayCount();
    }
    if (tab === 'userlevel') {
        renderUserLevelList();
    }
    if (tab === 'users') {
        renderUserManagement();
        loadRegCodeSetting();
    }
}

// ============================================
// 用户等级管理
// ============================================

const LEVEL_CONFIG = [
    { key: 'free', label: '普通', icon: '⭐', days: 90 },
    { key: 'vip', label: 'VIP', icon: '🌙', days: 180 },
    { key: 'plus', label: 'Plus', icon: '☀️', days: 365 },
    { key: 'permanent', label: '永久', icon: '👑', days: -1 }
];

/**
 * 渲染用户等级管理列表
 */
function renderUserLevelList() {
    const container = document.getElementById('userLevelList');
    if (!container) return;

    const userNames = getAccountList();
    const defaultNames = ['用户1', '用户2', '用户3', '用户4'];

    let html = '<div class="user-level-grid">';
    for (let i = 0; i < 4; i++) {
        const name = (userNames && userNames.length > i && userNames[i]) ? userNames[i] : defaultNames[i];
        const level = (typeof getUserLevel === 'function') ? getUserLevel(i) : 'free';
        const levelInfo = LEVEL_CONFIG.find(l => l.key === level) || LEVEL_CONFIG[0];
        const daysText = levelInfo.days < 0 ? '永久保留' : `保留 ${levelInfo.days} 天`;

        html += `
            <div class="user-level-card">
                <div class="user-level-avatar">${levelInfo.icon}</div>
                <div class="user-level-name">${name}</div>
                <div class="user-level-select">
                    <select onchange="changeUserLevel(${i}, this.value)">
                        ${LEVEL_CONFIG.map(l => `
                            <option value="${l.key}" ${l.key === level ? 'selected' : ''}>
                                ${l.icon} ${l.label}（${l.days < 0 ? '永久' : l.days + '天'}）
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="user-level-days">📅 ${daysText}</div>
            </div>
        `;
    }
    html += '</div>';

    container.innerHTML = html;
}

/**
 * 切换用户等级
 */
function changeUserLevel(userIdx, level) {
    if (typeof saveUserLevel === 'function') {
        saveUserLevel(userIdx, level);
    }
    showAdminToast(`✅ 已为用户设置等级`, 'success');
    renderUserLevelList();
}

/**
 * 获取账号列表（4个账号名称）
 */
function getAccountList() {
    try {
        const saved = localStorage.getItem('today_eaten_users');
        if (saved) {
            const users = JSON.parse(saved);
            return Object.keys(users).slice(0, 4);
        }
    } catch {}
    return [];
}

// ============================================
// 用户管理
// ============================================

/**
 * 渲染用户管理列表
 */
function renderUserManagement() {
    const container = document.getElementById('userListContainer');
    if (!container) return;

    const saved = localStorage.getItem('today_eaten_users');
    const users = saved ? JSON.parse(saved) : {};
    const names = Object.keys(users);

    const countEl = document.getElementById('userCount');
    if (countEl) countEl.textContent = `共 ${names.length} 个用户`;

    if (names.length === 0) {
        container.innerHTML = '<div class="admin-empty">暂无注册用户</div>';
        return;
    }

    let html = '<div class="admin-users-grid">';
    names.forEach((name, idx) => {
        const user = users[name];
        const pwd = user && user.password ? user.password : '—';
        html += `
            <div class="admin-user-card">
                <div class="admin-user-avatar">👤</div>
                <div class="admin-user-info">
                    <div class="admin-user-name">${escapeHtml(name)}</div>
                    <div class="admin-user-pwd">🔑 ${escapeHtml(pwd)}</div>`;

        // 前4个用户显示等级选择器（与用户等级系统保持一致）
        if (idx < 4) {
            const level = (typeof getUserLevel === 'function') ? getUserLevel(idx) : 'free';
            const levelInfo = LEVEL_CONFIG.find(l => l.key === level) || LEVEL_CONFIG[0];
            html += `
                    <div class="admin-user-level-select">
                        <span class="admin-user-level-icon">${levelInfo.icon}</span>
                        <select onchange="changeUserLevelFromMgt(${idx}, this.value)">
                            ${LEVEL_CONFIG.map(l => `
                                <option value="${l.key}" ${l.key === level ? 'selected' : ''}>
                                    ${l.icon} ${l.label}（${l.days < 0 ? '永久' : l.days + '天'}）
                                </option>
                            `).join('')}
                        </select>
                    </div>`;
        }

        html += `
                </div>
                <button class="admin-btn-sm admin-btn-danger" onclick="deleteUser('${escapeHtml(name)}')">🗑️ 删除</button>
            </div>
        `;
    });
    html += '</div>';

    container.innerHTML = html;
}

/**
 * 从用户管理页面修改用户等级
 */
function changeUserLevelFromMgt(userIdx, level) {
    if (typeof saveUserLevel === 'function') {
        saveUserLevel(userIdx, level);
    }
    showAdminToast(`✅ 已为用户设置等级`, 'success');
    // 刷新两个相关页面
    renderUserManagement();
    renderUserLevelList();
}

/**
 * 删除用户
 */
async function deleteUser(name) {
    if (!confirm(`⚠️ 确定要删除用户「${name}」吗？\n\n此操作不可恢复！`)) return;

    // 1. 删 Supabase user_accounts（级联删除所有关联数据）
    try {
        const sb = getSupabase();
        if (sb) {
            const { error } = await sb
                .from('user_accounts')
                .delete()
                .eq('username', name);
            if (error) console.warn('Supabase删除失败:', error.message);
        }
    } catch (e) {
        console.warn('Supabase删除异常:', e.message);
    }

    // 2. 删 localStorage
    const saved = localStorage.getItem('today_eaten_users');
    const users = saved ? JSON.parse(saved) : {};

    if (!users[name]) {
        showAdminToast('用户不存在', 'error');
        return;
    }

    delete users[name];
    localStorage.setItem('today_eaten_users', JSON.stringify(users));

    showAdminToast(`✅ 已删除用户「${name}」`, 'success');
    renderUserManagement();
}

/**
 * 加载注册验证码设置
 */
function loadRegCodeSetting() {
    const codeInput = document.getElementById('adminRegCode');
    if (!codeInput) return;
    const currentCode = localStorage.getItem('nutri_register_code') || '0000';
    codeInput.value = currentCode;
}

/**
 * 保存注册验证码
 */
function saveRegCode() {
    const codeInput = document.getElementById('adminRegCode');
    if (!codeInput) return;
    const code = codeInput.value.trim();
    if (!code) {
        showAdminToast('请输入验证码', 'error');
        return;
    }
    localStorage.setItem('nutri_register_code', code);
    showAdminToast(`✅ 注册验证码已更新为「${code}」`, 'success');
}

// ============================================
// 学习模式（家人查看页面）
// ============================================

/**
 * 初始化学习模式
 */
async function initLearningMode() {
    // 隐藏计算器界面
    document.getElementById('inputSection').style.display = 'none';
    document.getElementById('resultSection').style.display = 'none';

    // 检查或创建学习容器
    let learnSection = document.getElementById('learnSection');
    if (!learnSection) {
        learnSection = document.createElement('div');
        learnSection.id = 'learnSection';
        learnSection.className = 'container learn-section';
        document.querySelector('.container').after(learnSection);
    }
    learnSection.style.display = 'block';
    learnSection.innerHTML = '<div class="learn-loading">📚 加载学习内容...</div>';

    // 获取已勾选的内容
    const result = await getDisplayedKnowledgeItems();
    if (!result.success || result.data.length === 0) {
        learnSection.innerHTML = `
            <header>
                <h1>📚 营养扫盲学习台</h1>
                <p class="subtitle">管理员尚未设置学习内容，请稍后再来查看</p>
            </header>
            <div class="card" style="text-align:center;padding:40px;">
                <p style="font-size:2rem;margin-bottom:12px;">📭</p>
                <p>还没有可学习的内容</p>
                <p style="color:var(--text-light);font-size:0.85rem;margin-top:8px;">请管理员登录后，在"扫盲学习台"中勾选要展示的内容</p>
                <button class="btn-calculate" style="max-width:300px;margin:20px auto;" onclick="window.location.href=window.location.pathname">返回计算器</button>
            </div>
        `;
        return;
    }

    // 渲染学习内容
    let html = `
        <header>
            <h1>📚 营养扫盲学习台</h1>
            <p class="subtitle">共 ${result.data.length} 个知识点</p>
        </header>
    `;

    result.data.forEach((item, index) => {
        const catIcon = item.category === '名词解释' ? '📖' : '🧮';
        html += `
        <div class="card learn-card">
            <div class="learn-card-header">
                <span class="learn-card-number">#${index + 1}</span>
                <span class="learn-card-cat">${catIcon} ${item.category}</span>
            </div>
            <h2 class="learn-card-title">${escapeHtml(item.title)}</h2>
            <div class="learn-card-content">${renderMarkdown(escapeHtml(item.content))}</div>
        </div>`;
    });

    html += `
        <footer style="text-align:center;margin-top:20px;">
            <p style="font-size:0.85rem;color:var(--text-light);">📱 翻看学习，每天进步一点点</p>
            <button class="btn-secondary" style="max-width:200px;margin:12px auto;" onclick="window.location.href=window.location.pathname">← 返回计算器</button>
        </footer>
    `;

    learnSection.innerHTML = html;
}

// ============================================
// 工具函数
// ============================================

/**
 * HTML转义
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 简单的Markdown渲染（换行转<br>，加粗等）
 */
function renderMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/- (.*?)(<br>|$)/g, '• $1$2');
}

/**
 * 显示Toast通知
 */
function showAdminToast(message, type) {
    // 移除已有的toast
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

/**
 * 绑定快捷键（Ctrl+Shift+D 打开管理员登录）
 */
function bindAdminShortcut() {
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            if (adminState.loggedIn) {
                showAdminPanel();
            } else {
                showAdminLoginModal();
            }
        }
    });
}

/**
 * 初始化管理模块
 */
function initAdmin() {
    bindAdminShortcut();

    // 检查是否有学习模式参数
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'learn') {
        // 延迟DOM加载完成后再执行
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initLearningMode);
        } else {
            initLearningMode();
        }
        return;
    }

    // 检查是否有保存的会话
    setTimeout(async () => {
        const sessionResult = await checkAdminSession();
        if (sessionResult.loggedIn) {
            adminState.loggedIn = true;
            adminState.user = sessionResult.user;
        }
    }, 500);
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdmin);
} else {
    initAdmin();
}
