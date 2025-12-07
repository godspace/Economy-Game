// Проверяем загрузку Supabase
document.addEventListener('DOMContentLoaded', function() {
    // Ждем немного для загрузки Supabase
    setTimeout(initAuth, 100);
});

function initAuth() {
    if (!window.gameSupabase) {
        console.error('Supabase не загружен');
        document.getElementById('statusMessage').textContent = 'Ошибка загрузки системы. Обновите страницу.';
        return;
    }

    const supabase = window.gameSupabase;
    const loginBtn = document.getElementById('loginBtn');
    const playerCodeInput = document.getElementById('playerCode');
    const statusMessage = document.getElementById('statusMessage');

    // Ограничиваем ввод только цифрами
    playerCodeInput.addEventListener('input', function(e) {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    });

    // Обработка Enter
    playerCodeInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });

    // Обработка клика
    loginBtn.addEventListener('click', handleLogin);

    async function handleLogin() {
        const code = playerCodeInput.value.trim();
        
        // Валидация
        if (!code || code.length !== 6) {
            showError('Введите 6-значный код');
            return;
        }
        
        // Показываем загрузку
        setLoading(true);
        clearMessage();
        
        try {
            // Ищем игрока по коду
            const { data: player, error: findError } = await supabase
                .from('players')
                .select('*')
                .eq('code', code)
                .single();
            
            if (findError) {
                if (findError.code === 'PGRST116') {
                    showError('Неверный код. Проверьте правильность ввода.');
                } else {
                    throw findError;
                }
                return;
            }
            
            // Обновляем статус игрока
            const { error: updateError } = await supabase
                .from('players')
                .update({
                    is_visible: true,
                    last_login: new Date().toISOString()
                })
                .eq('id', player.id);
            
            if (updateError) throw updateError;
            
            // Сохраняем данные игрока
            sessionStorage.setItem('player', JSON.stringify({
                id: player.id,
                code: player.code,
                first_name: player.first_name,
                last_name: player.last_name,
                class: player.class,
                balance: player.balance || 0
            }));
            
            // Показываем успех и перенаправляем
            showSuccess('Успешный вход! Перенаправление...');
            
            setTimeout(() => {
                window.location.href = 'profile.html';
            }, 1000);
            
        } catch (error) {
            console.error('Login error:', error);
            showError('Ошибка входа. Попробуйте позже.');
        } finally {
            setLoading(false);
        }
    }

    function setLoading(isLoading) {
        loginBtn.disabled = isLoading;
        loginBtn.textContent = isLoading ? 'Вход...' : 'Войти в игру';
    }

    function showError(message) {
        statusMessage.textContent = message;
        statusMessage.className = 'status-message error';
    }

    function showSuccess(message) {
        statusMessage.textContent = message;
        statusMessage.className = 'status-message success';
    }

    function clearMessage() {
        statusMessage.textContent = '';
        statusMessage.className = 'status-message';
    }
}