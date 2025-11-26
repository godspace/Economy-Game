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
    
    const code = document.getElementById('code').value;
    
    if (!code) {
        showAuthError('Пожалуйста, введите ваш код');
        return;
    }
    
    hideAuthError();
    
    dom.authBtn.disabled = true;
    dom.authBtn.textContent = 'Загрузка...';
    
    try {
        // Ищем ученика по коду
        const { data: student, error: studentError } = await state.supabase
            .from('students')
            .select('*')
            .eq('code', code)
            .single();
        
        if (studentError || !student) {
            throw new Error('Неверный код');
        }
        
        // Ищем или создаем профиль
        const { data: profile, error: profileError } = await state.supabase
            .from('profiles')
            .select('*')
            .eq('student_id', student.id)
            .single();
        
        if (profileError) {
            // Создаем новый профиль
            const username = `${student.first_name} ${student.last_name}`;
            const { data: newProfile, error: createError } = await state.supabase
                .from('profiles')
                .insert([
                    {
                        student_id: student.id,
                        username: username,
                        class: student.class,
                        coins: 100,
                        reputation: 50
                    }
                ])
                .select()
                .single();
            
            if (createError) throw createError;
            state.currentUserProfile = newProfile;
        } else {
            state.currentUserProfile = profile;
        }
        
        // Обновляем UI
        if (dom.userGreeting) dom.userGreeting.textContent = `Привет, ${state.currentUserProfile.username}!`;
        if (dom.userAvatar) dom.userAvatar.textContent = state.currentUserProfile.username.charAt(0).toUpperCase();
        if (dom.coinsValue) dom.coinsValue.textContent = state.currentUserProfile.coins;
        if (dom.reputationValue) dom.reputationValue.textContent = state.currentUserProfile.reputation;
        
        showProfileSection();
        
    } catch (error) {
        console.error('Ошибка аутентификации:', error);
        showAuthError('Неверный код или ошибка системы');
    } finally {
        dom.authBtn.disabled = false;
        dom.authBtn.textContent = 'Войти';
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
        
        // В новой системе мы не используем auth.signOut, просто очищаем состояние
        state.currentUser = null;
        state.currentUserProfile = null;
        showAuthSection();
    } catch (error) {
        console.error('Ошибка выхода:', error);
    }
}

// Явный экспорт всех функций
export {
    initSupabase,
    checkAuth,
    handleAuth,
    handleLogout
};