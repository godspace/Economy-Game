// auth.js - ПОЛНЫЙ ОБНОВЛЕННЫЙ ФАЙЛ
import { state, dom, SUPABASE_CONFIG } from './config.js';
import { showAuthSection, showProfileSection, showAuthError, hideAuthError } from './ui.js';

// Инициализация Supabase с обработкой ошибок
let supabaseInitialized = false;

export async function initSupabase() {
    return new Promise((resolve, reject) => {
        try {
            console.log('Initializing Supabase...');
            
            if (typeof window.supabase === 'undefined') {
                // Попытка загрузить Supabase динамически
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
        // Проверяем существующую сессию
        if (state.supabase && supabaseInitialized) {
            const { data: { session }, error } = await state.supabase.auth.getSession();
            
            if (!error && session) {
                // Есть активная сессия - загружаем профиль
                await loadUserProfile(session.user.id);
                return;
            }
        }
        
        // Нет активной сессии - показываем экран аутентификации
        showAuthSection();
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        showAuthSection();
    }
}

async function loadUserProfile(userId) {
    try {
        const { data: profile, error } = await state.supabase
            .from('profiles')
            .select(`
                *,
                students (first_name, last_name, class, code)
            `)
            .eq('id', userId)
            .single();
        
        if (error) {
            console.error('Error loading user profile:', error);
            showAuthSection();
            return;
        }
        
        state.currentUserProfile = profile;
        state.currentUser = { id: profile.id };
        state.isAuthenticated = true;
        
        // Проверяем статус администратора
        await checkAdminStatus();
        
        // Загружаем статус буста
        await loadBoostStatus();
        
        // Обновляем UI
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
        
        console.log('🔧 Checking admin status for user:', state.currentUserProfile.id);
        
        const { data: admin, error } = await state.supabase
            .from('admins')
            .select('user_id')
            .eq('user_id', state.currentUserProfile.id)
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
        console.log('Boost status loaded and polling started');
    } catch (error) {
        console.error('Error loading boost status:', error);
    }
}

function updateUI() {
    if (!state.currentUserProfile) return;
    
    const displayName = state.currentUserProfile.username || 
                       (state.currentUserProfile.students ? 
                           `${state.currentUserProfile.students.first_name} ${state.currentUserProfile.students.last_name}` : 
                           'Пользователь');
    
    if (dom.userGreeting) dom.userGreeting.textContent = `Привет, ${displayName}!`;
    if (dom.userAvatar) dom.userAvatar.textContent = displayName.charAt(0).toUpperCase();
    if (dom.coinsValue) dom.coinsValue.textContent = state.currentUserProfile.coins || 0;
    if (dom.reputationValue) dom.reputationValue.textContent = state.currentUserProfile.reputation || 0;
}

export async function handleAuth(e) {
    e.preventDefault();
    
    if (!state.supabase || !supabaseInitialized) {
        showAuthError('Система не инициализирована. Пожалуйста, обновите страницу.');
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
        dom.authBtn.textContent = 'Загрузка...';
    }
    
    try {
        console.log('Поиск студента с кодом:', code);
        
        // Ищем ученика по коду
        const { data: student, error: studentError } = await state.supabase
            .from('students')
            .select('*')
            .eq('code', code)
            .single();
        
        if (studentError) {
            console.error('Ошибка поиска студента:', studentError);
            if (studentError.code === 'PGRST116') {
                throw new Error('Неверный код');
            }
            throw new Error('Ошибка базы данных');
        }
        
        if (!student) {
            throw new Error('Неверный код');
        }
        
        console.log('Студент найден:', student);
        
        // Ищем существующий профиль
        const { data: profile, error: profileError } = await state.supabase
            .from('profiles')
            .select(`
                *,
                students (first_name, last_name, class, code)
            `)
            .eq('student_id', student.id)
            .single();
        
        if (profileError && profileError.code !== 'PGRST116') {
            console.error('Ошибка поиска профиля:', profileError);
            throw new Error('Ошибка базы данных');
        }
        
        let userProfile;
        
        if (profile) {
            // Профиль существует
            console.log('Профиль найден:', profile);
            userProfile = profile;
        } else {
            // Создаем новый профиль
            console.log('Создание нового профиля для студента:', student.id);
            const username = `${student.first_name} ${student.last_name}`;
            
            const { data: newProfile, error: createError } = await state.supabase
                .from('profiles')
                .insert({
                    student_id: student.id,
                    username: username,
                    class: student.class,
                    coins: 100,
                    reputation: 50
                })
                .select(`
                    *,
                    students (first_name, last_name, class, code)
                `)
                .single();
            
            if (createError) {
                console.error('Ошибка создания профиля:', createError);
                throw new Error('Не удалось создать профиль');
            }
            
            console.log('Новый профиль создан:', newProfile);
            userProfile = newProfile;
        }
        
        // Создаем сессию аутентификации
        const { data: authData, error: authError } = await state.supabase.auth.signInWithPassword({
            email: `${student.code}@student.local`, // Временный email для совместимости
            password: student.code // Используем код как пароль
        });
        
        if (authError) {
            console.error('Ошибка создания сессии:', authError);
            // Продолжаем без сессии, используя нашу систему
        }
        
        // Устанавливаем состояние аутентификации
        state.currentUserProfile = userProfile;
        state.currentUser = { id: userProfile.id };
        state.isAuthenticated = true;
        
        // Проверяем статус администратора
        await checkAdminStatus();
        
        // Загружаем статус буста
        await loadBoostStatus();
        
        // Обновляем UI
        updateUI();
        showProfileSection();
        
    } catch (error) {
        console.error('Ошибка аутентификации:', error);
        if (error.message === 'Неверный код') {
            showAuthError('Неверный код. Пожалуйста, проверьте правильность ввода.');
        } else {
            showAuthError('Ошибка системы. Пожалуйста, попробуйте позже.');
        }
    } finally {
        if (dom.authBtn) {
            dom.authBtn.disabled = false;
            dom.authBtn.textContent = 'Войти';
        }
    }
}

export async function handleLogout() {
    try {
        // Очищаем таймеры вкладов
        Object.values(state.depositTimers).forEach(timer => {
            if (timer) clearInterval(timer);
        });
        state.depositTimers = {};
        
        // Останавливаем polling статуса буста
        try {
            const { stopBoostStatusPolling } = await import('./shop.js');
            stopBoostStatusPolling();
        } catch (error) {
            console.error('Error stopping boost polling:', error);
        }
        
        // Выход из сессии Supabase
        if (state.supabase) {
            await state.supabase.auth.signOut();
        }
        
        // Очищаем состояние пользователя
        state.currentUser = null;
        state.currentUserProfile = null;
        state.isAuthenticated = false;
        state.isAdmin = false;
        
        // Очищаем кэш
        const { clearCache } = await import('./config.js');
        clearCache();
        
        // Показываем экран аутентификации
        showAuthSection();
    } catch (error) {
        console.error('Ошибка выхода:', error);
        // Все равно показываем экран аутентификации
        showAuthSection();
    }
}

// Геттер для проверки инициализации
export function isSupabaseInitialized() {
    return supabaseInitialized && state.supabase !== null;
}