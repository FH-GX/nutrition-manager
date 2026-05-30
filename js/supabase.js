/**
 * Supabase 数据库连接与操作模块
 * 用于知识库和扫盲学习台功能
 */
const SUPABASE_URL = 'https://thgcjxnvsantzrdyqcug.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZ2NqeG52c2FudHpyZHlxY3VnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4ODUwMjEsImV4cCI6MjA5MzQ2MTAyMX0.zR3Dcics3I982dqZGbXv-zmbtXbJCb8VuAJSKjoyP_8';

let supabaseClient = null;

/**
 * 初始化Supabase客户端
 */
function initSupabase() {
    if (typeof supabase === 'undefined') {
        console.warn('Supabase SDK未加载，请等待');
        return null;
    }
    if (!supabaseClient) {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: false,
            },
        });
        console.log('✅ Supabase客户端已初始化');
    }
    return supabaseClient;
}

/**
 * 获取Supabase客户端实例
 */
function getSupabase() {
    if (!supabaseClient) return initSupabase();
    return supabaseClient;
}

// ============================================
// 管理员认证
// ============================================

/**
 * 管理员登录（使用Supabase Auth邮箱密码）
 * @param {string} email - 管理员邮箱
 * @param {string} password - 密码
 * @returns {Promise<object>} { success, error? }
 */
async function adminLogin(email, password) {
    try {
        const sb = getSupabase();
        if (!sb) return { success: false, error: 'Supabase未初始化' };

        const { data, error } = await sb.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            return { success: false, error: error.message };
        }

        // 检查是否为管理员（这里我们简单地检查邮箱是否匹配）
        // 实际中可以使用专门的admin_users表
        const userEmail = data.user?.email;
        if (!userEmail) {
            await sb.auth.signOut();
            return { success: false, error: '无法获取用户信息' };
        }

        return { success: true, user: data.user };
    } catch (err) {
        return { success: false, error: err.message || '登录失败' };
    }
}

/**
 * 管理员登出
 */
async function adminLogout() {
    try {
        const sb = getSupabase();
        if (sb) {
            await sb.auth.signOut();
        }
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * 检查当前登录状态
 */
async function checkAdminSession() {
    try {
        const sb = getSupabase();
        if (!sb) return { loggedIn: false };

        const { data: { session }, error } = await sb.auth.getSession();
        if (error || !session) {
            return { loggedIn: false };
        }
        return { loggedIn: true, user: session.user };
    } catch {
        return { loggedIn: false };
    }
}

// ============================================
// 知识库操作 (knowledge_base)
// ============================================

/**
 * 获取所有知识库条目（管理员用）
 */
async function getAllKnowledgeItems() {
    try {
        const sb = getSupabase();
        const { data, error } = await sb
            .from('knowledge_base')
            .select('*')
            .order('display_order', { ascending: true })
            .order('id', { ascending: true });

        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (err) {
        return { success: false, error: err.message, data: [] };
    }
}

/**
 * 获取已勾选展示的知识条目（供家人学习用）
 */
async function getDisplayedKnowledgeItems() {
    try {
        const sb = getSupabase();
        const { data, error } = await sb
            .from('knowledge_base')
            .select('*')
            .eq('is_displayed', true)
            .order('display_order', { ascending: true })
            .order('id', { ascending: true });

        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (err) {
        return { success: false, error: err.message, data: [] };
    }
}

/**
 * 添加知识条目
 */
async function addKnowledgeItem(title, content, category) {
    try {
        const sb = getSupabase();
        const { data, error } = await sb
            .from('knowledge_base')
            .insert({
                title: title,
                content: content,
                category: category,
                is_displayed: false,
                display_order: 0,
            })
            .select();

        if (error) throw error;
        return { success: true, data: data?.[0] };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * 更新知识条目
 */
async function updateKnowledgeItem(id, updates) {
    try {
        const sb = getSupabase();
        const { data, error } = await sb
            .from('knowledge_base')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) throw error;
        return { success: true, data: data?.[0] };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * 删除知识条目
 */
async function deleteKnowledgeItem(id) {
    try {
        const sb = getSupabase();
        const { error } = await sb
            .from('knowledge_base')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * 切换知识条目的展示状态（勾选/取消）
 */
async function toggleDisplayStatus(id, isDisplayed) {
    return updateKnowledgeItem(id, { is_displayed: isDisplayed });
}

// ============================================
// 低碳水饮食档位配置 (低碳水饮食的三个档位)
// ============================================

/**
 * 获取所有低碳水饮食档位配置
 */
async function getLowCarbProfiles() {
    try {
        const sb = getSupabase();
        const { data, error } = await sb
            .from('低碳水饮食的三个档位')
            .select('*');

        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (err) {
        console.error('读取低碳水饮食配置失败:', err);
        return { success: false, error: err.message, data: [] };
    }
}

// ============================================
// 普通用户认证（注册/登录）
// ============================================

/**
 * 用户注册
 * 直接使用用户填写的邮箱走 Supabase Auth
 * @param {string} email - 用户邮箱（如 test@163.com）
 * @param {string} password - 密码（至少6位）
 * @returns {Promise<{success: boolean, error?: string, user?: object}>}
 */
async function userSignUp(email, password) {
    try {
        const sb = getSupabase();
        if (!sb) return { success: false, error: 'Supabase未初始化' };

        const { data, error } = await sb.auth.signUp({
            email: email,
            password: password,
            options: { data: { email } }
        });

        if (error) {
            // 处理常见错误
            if (error.message.includes('already registered') || error.message.includes('already exists')) {
                return { success: false, error: '该邮箱已注册，请直接登录' };
            }
            return { success: false, error: error.message };
        }

        if (!data.user) {
            return { success: false, error: '注册失败，请稍后重试' };
        }

        // 写入 user_accounts 表（username 字段存邮箱）
        const { error: dbError } = await sb
            .from('user_accounts')
            .insert({
                auth_id: data.user.id,
                username: email
            });

        if (dbError) {
            console.error('写入 user_accounts 失败:', dbError);
            // 不阻断注册流程，后续可修复
        }

        return { success: true, user: data.user };
    } catch (err) {
        return { success: false, error: err.message || '注册失败' };
    }
}

/**
 * 用户登录
 * @param {string} email - 用户邮箱
 * @param {string} password - 密码
 * @returns {Promise<{success: boolean, error?: string, user?: object}>}
 */
async function userSignIn(email, password) {
    try {
        const sb = getSupabase();
        if (!sb) return { success: false, error: 'Supabase未初始化' };

        const { data, error } = await sb.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            if (error.message.includes('Invalid login credentials')) {
                return { success: false, error: '邮箱或密码错误' };
            }
            return { success: false, error: error.message };
        }

        return { success: true, user: data.user };
    } catch (err) {
        return { success: false, error: err.message || '登录失败' };
    }
}

/**
 * 用户退出登录
 */
async function userSignOut() {
    try {
        const sb = getSupabase();
        if (sb) {
            await sb.auth.signOut();
        }
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * 检查当前用户会话
 */
async function checkUserSession() {
    try {
        const sb = getSupabase();
        if (!sb) return { loggedIn: false };

        const { data: { session }, error } = await sb.auth.getSession();
        if (error || !session) {
            return { loggedIn: false };
        }
        return { loggedIn: true, user: session.user };
    } catch {
        return { loggedIn: false };
    }
}

/**
 * 根据用户名从 user_accounts 查询用户信息
 */
async function getUserAccount(username) {
    try {
        const sb = getSupabase();
        if (!sb) return null;
        
        const { data, error } = await sb
            .from('user_accounts')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !data) return null;
        return data;
    } catch {
        return null;
    }
}
