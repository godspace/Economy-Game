// auth.js - УПРОЩЕННАЯ И ИСПРАВЛЕННАЯ ВЕРСИЯ
import { state, dom, SUPABASE_CONFIG } from './config.js';
import { showAuthSection, showProfileSection, showAuthError, hideAuthError, updateUserBalanceDisplay } from './ui.js';

let supabaseInitialized = false;

export async function initSupabase() {
    return new Promise((resolve, reject) => {
        try {
            console.log('Initializing Supabase...');
            
            if (typeof window.supabase === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
                script.onload = () => {
                    initializeClient();
                    resolve();
                };
                script.onerror = () => reject(new Error('Failed to load Supabase library'));
                document.head.appendChild(script);
            } else {
                initializeClient();
                resolve();
            }
            
            function initializeClient() {
                try {
                    state.supabase = window.supabase.createClient(
                        SUPABASE_CONFIG.url, 
                        SUPABASE_CONFIG.key,
                        SUPABASE_CONFIG.options
                    );
                    supabaseInitialized = true;
                    console.log('Supabase initialized successfully');
                } catch (error) {
                    reject(error);
                }
            }
        } catch (error) {
            console.error('Error initializing Supabase:', error);
            reject(error);
        }
    });
}

export async function checkAuth() {
    try {
        if (!state.supabase || !supabaseInitialized) {
            showAuthSection();
            return;
        }

        const { data: { session }, error } = await state.supabase.auth.getSession();
        
        if (error) {
            console.error('Error getting session:', error);
            showAuthSection();
            return;
        }

        if (session) {
            await loadUserProfile(session.user.id);
        } else {
            showAuthSection();
        }
    } catch (error) {
        console.error('Error checking auth:', error);
        showAuthSection();
    }
}

async function loadUserProfile(authUserId) {
    try {
        const { data: profile, error } = await state.supabase
            .from('profiles')
            .select('*, students(first_name, last_name, class, code)')
            .eq('auth_user_id', authUserId)
            .single();

        if (error) {
            console.error('Error loading profile:', error);
            showAuthError('Профиль не найден. Пожалуйста, войдите снова.');
            await handleLogout();
            return;
        }

        state.currentUserProfile = profile;
        state.currentUser = { id: profile.id };
        state.isAuthenticated = true;

        await checkAdminStatus();
        await loadBoostStatus();
        updateUI();
        showProfileSection();

    } catch (error) {
        console.error('Error in loadUserProfile:', error);
        showAuthSection();
    }
}

export async function checkAdminStatus() {
    try {
        if (!state.supabase || !state.currentUserProfile) {
            state.isAdmin = false;
            return false;
        }

        console.log('🔧 Checking admin status for profile ID:', state.currentUserProfile.id);
        
        const { data: admin, error } = await state.supabase
            .from('admins')
            .select('user_id')
            .eq('user_id', state.currentUserProfile.id)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error checking admin status:', error);
        }

        state.isAdmin = !error && admin;
        console.log('🔧 User is admin:', state.isAdmin);

        return state.isAdmin;
    } catch (error) {
        console.error('Error checking admin status:', error);
        state.isAdmin = false;
        return false;
    }
}

async function loadBoostStatus() {
    try {
        const { updateBoostStatus, startBoostStatusPolling } = await import('./shop.js');
        await updateBoostStatus();
        startBoostStatusPolling();
    } catch (error) {
        console.error('Error loading boost status:', error);
    }
}

function updateUI() {
    if (!state.currentUserProfile) return;
    
    const displayName = state.currentUserProfile.username || 
                       (state.currentUserProfile.students ? 
                           `${state.currentUserProfile.students.first_name} ${state.currentUserProfile.students.last_name}` : 
                           state.currentUserProfile.username);
    
    if (dom.userGreeting) dom.userGreeting.textContent = `Привет, ${displayName}!`;
    if (dom.userAvatar) dom.userAvatar.textContent = displayName.charAt(0).toUpperCase();
    updateUserBalanceDisplay();
}

export async function handleAuth(e) {
    e.preventDefault();
    
    if (!state.supabase || !supabaseInitialized) {
        showAuthError('Система не инициализирована');
        return;
    }
    
    const code = document.getElementById('code')?.value.trim();
    
    if (!code) {
        showAuthError('Пожалуйста, введите ваш код');
        return;
    }
    
    hideAuthError();
    
    if (dom.authBtn) {
        dom.authBtn.disabled = true;
        dom.authBtn.textContent = 'Вход...';
    }
    
    try {
        const email = `${code}@student.game`;
        const password = code;

        console.log('Attempting auth with:', { email, password: '***' });

        // ПРОБУЕМ ПРОСТО ВОЙТИ - большинство пользователей уже созданы
        const { data, error } = await state.supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            // Если пользователь не найден, пробуем упрощенную регистрацию
            if (error.message.includes('Invalid login credentials')) {
                console.log('User not found, attempting simplified registration...');
                await handleSimplifiedSignUp(email, password, code);
            } else {
                throw error;
            }
        } else {
            // Успешный вход
            console.log('Login successful, loading profile...');
            await loadUserProfile(data.user.id);
        }
        
    } catch (error) {
        console.error('Auth error:', error);
        showAuthError('Ошибка входа. Проверьте код или попробуйте позже.');
    } finally {
        if (dom.authBtn) {
            dom.authBtn.disabled = false;
            dom.authBtn.textContent = 'Войти';
        }
    }
}

async function handleSimplifiedSignUp(email, password, code) {
    try {
        console.log('Checking student with code:', code);
        
        // Проверяем, что студент существует
        const { data: student, error: studentError } = await state.supabase
            .from('students')
            .select('*')
            .eq('code', code)
            .single();

        if (studentError || !student) {
            throw new Error('Неверный код студента');
        }

        console.log('Student found, attempting registration...');

        // Пробуем зарегистрироваться с минимальными данными
        const { data, error } = await state.supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    first_name: student.first_name,
                    last_name: student.last_name
                }
            }
        });

        if (error) {
            // Если регистрация не удалась, пробуем альтернативный email
            console.log('Registration failed, trying alternative email...');
            await handleAlternativeRegistration(student, code);
            return;
        }

        console.log('Registration successful, checking for auto-confirmation...');
        
        // Если email подтверждение отключено, сразу входим
        if (data.user && data.user.email_confirmed_at) {
            await loadUserProfile(data.user.id);
        } else {
            showAuthError('Регистрация успешна! Проверьте email для подтверждения.');
        }

    } catch (error) {
        console.error('Simplified sign up error:', error);
        throw new Error('Не удалось создать аккаунт. Обратитесь к администратору.');
    }
}

async function handleAlternativeRegistration(student, code) {
    try {
        // Пробуем альтернативный email формат
        const alternativeEmail = `student${code}@game.local`;
        const password = code;

        console.log('Trying alternative email:', alternativeEmail);

        const { data, error } = await state.supabase.auth.signUp({
            email: alternativeEmail,
            password: password,
            options: {
                data: {
                    first_name: student.first_name,
                    last_name: student.last_name
                }
            }
        });

        if (error) throw error;

        console.log('Alternative registration successful');
        
        if (data.user && data.user.email_confirmed_at) {
            await loadUserProfile(data.user.id);
        } else {
            showAuthError('Регистрация успешна! Ожидайте подтверждения.');
        }

    } catch (altError) {
        console.error('Alternative registration failed:', altError);
        throw new Error('Все попытки регистрации не удались. Обратитесь к администратору.');
    }
}

export async function handleLogout() {
    try {
        Object.values(state.depositTimers).forEach(timer => {
            if (timer) clearInterval(timer);
        });
        state.depositTimers = {};

        try {
            const { stopBoostStatusPolling } = await import('./shop.js');
            stopBoostStatusPolling();
        } catch (error) {
            console.error('Error stopping boost polling:', error);
        }

        if (state.supabase) {
            await state.supabase.auth.signOut();
        }

        state.currentUser = null;
        state.currentUserProfile = null;
        state.isAuthenticated = false;
        state.isAdmin = false;

        const { clearCache } = await import('./config.js');
        clearCache();

        showAuthSection();
    } catch (error) {
        console.error('Logout error:', error);
        showAuthSection();
    }
}

export function isSupabaseInitialized() {
    return supabaseInitialized && state.supabase !== null;
}