import { state, dom, SUPABASE_CONFIG } from './config.js';
import { showAuthSection, showProfileSection, showAuthError, hideAuthError } from './ui.js';

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
        // В новой системе мы всегда показываем экран аутентификации
        // Аутентификация происходит через код, а не через сессию Supabase
        showAuthSection();
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
    
    const code = document.getElementById('code').value.trim();
    
    if (!code) {
        showAuthError('Пожалуйста, введите ваш код');
        return;
    }
    
    hideAuthError();
    
    dom.authBtn.disabled = true;
    dom.authBtn.textContent = 'Загрузка...';
    
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
            .select('*')
            .eq('student_id', student.id)
            .single();
        
        if (profileError && profileError.code !== 'PGRST116') {
            // PGRST116 - "Not found" error, это нормально
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
                .select()
                .single();
            
            if (createError) {
                console.error('Ошибка создания профиля:', createError);
                throw new Error('Не удалось создать профиль');
            }
            
            console.log('Новый профиль создан:', newProfile);
            userProfile = newProfile;
        }
        
        // ИСПРАВЛЕНИЕ: Правильно устанавливаем состояние пользователя
        state.currentUser = { id: userProfile.id };
        state.currentUserProfile = userProfile;
        state.isAuthenticated = true;
        
        // Обновляем UI
        if (dom.userGreeting) dom.userGreeting.textContent = `Привет, ${state.currentUserProfile.username}!`;
        if (dom.userAvatar) dom.userAvatar.textContent = state.currentUserProfile.username.charAt(0).toUpperCase();
        if (dom.coinsValue) dom.coinsValue.textContent = state.currentUserProfile.coins;
        if (dom.reputationValue) dom.reputationValue.textContent = state.currentUserProfile.reputation;
        
        showProfileSection();
        
    } catch (error) {
        console.error('Ошибка аутентификации:', error);
        if (error.message === 'Неверный код') {
            showAuthError('Неверный код. Пожалуйста, проверьте правильность ввода.');
        } else {
            showAuthError('Ошибка системы. Пожалуйста, попробуйте позже.');
        }
    } finally {
        dom.authBtn.disabled = false;
        dom.authBtn.textContent = 'Войти';
    }
}

export async function handleLogout() {
    try {
        // Очищаем таймеры вкладов
        Object.values(state.depositTimers).forEach(timer => clearInterval(timer));
        state.depositTimers = {};
        
        // Очищаем состояние пользователя
        state.currentUser = null;
        state.currentUserProfile = null;
        state.isAuthenticated = false;
        
        // Очищаем форму
        if (dom.authForm) {
            dom.authForm.reset();
        }
        
        // Показываем экран аутентификации
        showAuthSection();
    } catch (error) {
        console.error('Ошибка выхода:', error);
    }
}

// Вспомогательная функция для получения текущего пользователя (для использования в других модулях)
export function getCurrentUser() {
    return {
        user: state.currentUser,
        profile: state.currentUserProfile,
        isAuthenticated: state.isAuthenticated
    };
}