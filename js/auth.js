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
// В конце auth.js должны быть эти экспорты
export {
    initSupabase,
    checkAuth,
    handleAuth,
    handleLogout  // <-- эта строка должна быть
};
