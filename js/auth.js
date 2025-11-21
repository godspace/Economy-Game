import { supabaseClient, currentUser, currentUserProfile, authBtn, SUPABASE_CONFIG } from './config.js';
import { showAuthSection, showProfileSection, showAuthError, hideAuthError } from './ui.js';
import { loadUserProfile } from './users.js';

export async function initSupabase() {
    return new Promise((resolve, reject) => {
        try {
            console.log('Initializing Supabase...');
            
            if (typeof window.supabase === 'undefined') {
                throw new Error('Supabase library not loaded');
            }
            
            // Используем другое имя переменной
            supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
            
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
        if (!supabaseClient) {
            throw new Error('Supabase not initialized');
        }
        
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        
        if (error) {
            console.warn('Auth check error:', error);
            showAuthSection();
            return;
        }
        
        if (user) {
            await loadUserProfile(user.id);
            currentUser = user;
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
    
    if (!supabaseClient) {
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
    
    authBtn.disabled = true;
    authBtn.textContent = 'Загрузка...';
    
    try {
        // Сначала пробуем зарегистрироваться
        const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
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
                
                const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
                    email: `${username}@school.game`,
                    password: password
                });
                
                if (signInError) {
                    throw signInError;
                }
                
                currentUser = signInData.user;
                await loadUserProfile(currentUser.id);
                showProfileSection();
            } else {
                throw signUpError;
            }
        } else {
            // Регистрация успешна
            currentUser = signUpData.user;
            
            // Создаем профиль пользователя
            try {
                const { error: profileError } = await supabaseClient
                    .from('profiles')
                    .insert([
                        { 
                            id: currentUser.id, 
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
            
            await loadUserProfile(currentUser.id);
            showProfileSection();
        }
    } catch (error) {
        console.error('Ошибка аутентификации:', error);
        showAuthError('Ошибка: ' + (error.message || 'Неизвестная ошибка'));
    } finally {
        authBtn.disabled = false;
        authBtn.textContent = 'Войти / Зарегистрироваться';
    }
}

export async function handleLogout() {
    try {
        if (!supabaseClient) {
            console.error('Supabase not initialized');
            return;
        }
        
        Object.values(depositTimers).forEach(timer => clearInterval(timer));
        depositTimers = {};
        
        await supabaseClient.auth.signOut();
        currentUser = null;
        currentUserProfile = null;
        showAuthSection();
    } catch (error) {
        console.error('Ошибка выхода:', error);
    }
}