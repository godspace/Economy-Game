import { state, dom, SUPABASE_CONFIG } from './config.js';
import { showAuthSection, showProfileSection, showAuthError, hideAuthError } from './ui.js';
import { loadUserProfile } from './users.js';

export async function initSupabase() {
    return new Promise((resolve, reject) => {
        try {
            console.log('Initializing Supabase...');
            
            if (typeof window.supabase === 'undefined') {
                throw new Error('Supabase library not loaded');
            }
            
            state.supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
            
            console.log('Supabase initialized successfully');
            resolve();
        } catch (error) {
            console.error('Error initializing Supabase:', error);
            reject(error);
        }
    });
}

export async function checkAuth() {
    try {
        if (!state.supabase) {
            throw new Error('Supabase not initialized');
        }
        
        const { data: { user }, error } = await state.supabase.auth.getUser();
        
        if (error) {
            console.warn('Auth check error:', error);
            showAuthSection();
            return;
        }
        
        if (user) {
            await loadUserProfile(user.id);
            state.currentUser = user;
            showProfileSection();
        } else {
            showAuthSection();
        }
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        showAuthSection();
    }
}

export async function handleAuth(e) {
    e.preventDefault();
    
    if (!state.supabase) {
        alert('Система не инициализирована. Пожалуйста, обновите страницу.');
        return;
    }
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const userClass = document.getElementById('class').value;
    
    if (!username || !password || !userClass) {
        showAuthError('Пожалуйста, заполните все поля');
        return;
    }
    
    hideAuthError();
    
    dom.authBtn.disabled = true;
    dom.authBtn.textContent = 'Загрузка...';
    
    try {
        // Сначала пробуем зарегистрироваться
        const { data: signUpData, error: signUpError } = await state.supabase.auth.signUp({
            email: `${username}@school.game`,
            password: password,
            options: {
                data: {
                    username: username,
                    class: userClass
                }
            }
        });
        
        if (signUpError) {
            // Если регистрация не удалась, пробуем войти
            if (signUpError.message.includes('already registered')) {
                console.log('User exists, trying to sign in...');
                
                const { data: signInData, error: signInError } = await state.supabase.auth.signInWithPassword({
                    email: `${username}@school.game`,
                    password: password
                });
                
                if (signInError) {
                    throw signInError;
                }
                
                state.currentUser = signInData.user;
                await loadUserProfile(state.currentUser.id);
                showProfileSection();
            } else {
                throw signUpError;
            }
        } else {
            // Регистрация успешна
            state.currentUser = signUpData.user;
            
            // Создаем профиль пользователя
            try {
                const { error: profileError } = await state.supabase
                    .from('profiles')
                    .insert([
                        { 
                            id: state.currentUser.id, 
                            username: username, 
                            class: userClass 
                        }
                    ]);
                
                if (profileError) {
                    console.warn('Profile creation error (might already exist):', profileError);
                }
            } catch (profileError) {
                console.warn('Profile creation error:', profileError);
            }
            
            await loadUserProfile(state.currentUser.id);
            showProfileSection();
        }
    } catch (error) {
        console.error('Ошибка аутентификации:', error);
        showAuthError('Ошибка: ' + (error.message || 'Неизвестная ошибка'));
    } finally {
        dom.authBtn.disabled = false;
        dom.authBtn.textContent = 'Войти / Зарегистрироваться';
    }
}

export async function handleLogout() {
    try {
        if (!state.supabase) {
            console.error('Supabase not initialized');
            return;
        }
        
        Object.values(state.depositTimers).forEach(timer => clearInterval(timer));
        state.depositTimers = {};
        
        await state.supabase.auth.signOut();
        state.currentUser = null;
        state.currentUserProfile = null;
        showAuthSection();
    } catch (error) {
        console.error('Ошибка выхода:', error);
    }
}