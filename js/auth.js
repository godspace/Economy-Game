// auth.js - ОБНОВЛЕННЫЙ С УЧЕТОМ РЕКОМЕНДАЦИЙ
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
            // Если профиль не найден, создадим его
            await createProfileForUser(authUserId);
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

async function createProfileForUser(authUserId) {
    try {
        // Получаем email пользователя из auth
        const { data: { user }, error } = await state.supabase.auth.getUser();
        if (error) throw error;

        // Извлекаем код из email (формат: code@student.game)
        const code = user.email.split('@')[0];
        
        // Ищем студента по коду
        const { data: student, error: studentError } = await state.supabase
            .from('students')
            .select('*')
            .eq('code', code)
            .single();

        let username = code; // временное имя
        
        if (!studentError && student) {
            username = `${student.first_name} ${student.last_name}`;
        }

        const { data: profile, error: createError } = await state.supabase
            .from('profiles')
            .insert({
                auth_user_id: authUserId,
                username: username,
                coins: 100,
                reputation: 50,
                student_id: student ? student.id : null
            })
            .select('*, students(first_name, last_name, class, code)')
            .single();

        if (createError) throw createError;

        state.currentUserProfile = profile;
        state.currentUser = { id: profile.id };
        state.isAuthenticated = true;

        await checkAdminStatus();
        updateUI();
        showProfileSection();

    } catch (error) {
        console.error('Error creating profile:', error);
        showAuthError('Ошибка создания профиля');
    }
}

export async function checkAdminStatus() {
    try {
        if (!state.supabase || !state.currentUserProfile) {
            state.isAdmin = false;
            return false;
        }

        console.log('🔧 Checking admin status for profile ID:', state.currentUserProfile.id);
        
        // ИСПРАВЛЕНИЕ: используем profile.id вместо auth_user_id
        const { data: admin, error } = await state.supabase
            .from('admins')
            .select('user_id')
            .eq('user_id', state.currentUserProfile.id) // ← ВАЖНО: используем profile.id
            .single();

        // Если ошибка "не найдено" - это нормально, пользователь не админ
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

        const { data, error } = await state.supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            // Если пользователь не найден, пробуем зарегистрировать
            if (error.message.includes('Invalid login credentials')) {
                console.log('User not found, attempting registration...');
                await handleSignUp(email, password, code);
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
        showAuthError('Ошибка входа. Проверьте код.');
    } finally {
        if (dom.authBtn) {
            dom.authBtn.disabled = false;
            dom.authBtn.textContent = 'Войти';
        }
    }
}

async function handleSignUp(email, password, code) {
    try {
        console.log('Checking student with code:', code);
        
        // Сначала проверяем, что код существует в students
        const { data: student, error: studentError } = await state.supabase
            .from('students')
            .select('*')
            .eq('code', code)
            .single();

        if (studentError || !student) {
            throw new Error('Неверный код');
        }

        console.log('Student found, registering...');

        // Регистрируем пользователя
        const { data, error } = await state.supabase.auth.signUp({
            email: email,
            password: password,
        });

        if (error) throw error;

        console.log('Registration successful, signing in...');

        // После регистрации автоматически входим
        const { data: signInData, error: signInError } = await state.supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (signInError) throw signInError;

        // Загружаем профиль (он должен быть создан триггером)
        await loadUserProfile(signInData.user.id);

    } catch (error) {
        console.error('Sign up error:', error);
        throw new Error('Ошибка регистрации: ' + error.message);
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