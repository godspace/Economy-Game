document.addEventListener('DOMContentLoaded', function() {
    // Даем время на загрузку Supabase
    setTimeout(initAuth, 500);
});

function initAuth() {
    console.log('Инициализация аутентификации...');
    
    if (!window.gameSupabase) {
        console.error('Supabase не загружен');
        showError('Ошибка загрузки системы. Обновите страницу.');
        return;
    }

    const supabase = window.gameSupabase;
    const loginBtn = document.getElementById('loginBtn');
    const playerCodeInput = document.getElementById('playerCode');
    const statusMessage = document.getElementById('statusMessage');

    // Ограничиваем ввод только цифрами
    playerCodeInput.addEventListener('input', function(e) {
        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
        e.target.value = value;
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
            console.log('Попытка входа с кодом:', code);
            
            // Вариант 1: Используем RPC функцию secure_player_login
            const { data: playerData, error: rpcError } = await supabase.rpc(
                'secure_player_login',
                { p_code: code }
            );
            
            console.log('Результат RPC запроса:', { playerData, rpcError });
            
            if (rpcError) {
                console.error('RPC ошибка:', rpcError);
                // Если RPC функция не работает, пробуем старый метод
                await fallbackLogin(code);
                return;
            }
            
            if (!playerData) {
                showError('Неверный код. Проверьте правильность ввода.');
                return;
            }
            
            // Сохраняем данные игрока
            sessionStorage.setItem('player', JSON.stringify(playerData));
            
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
    
    // Фолбэк метод на случай если RPC функция не работает
    async function fallbackLogin(code) {
        try {
            console.log('Используем фолбэк метод для кода:', code);
            
            // Ищем игрока по коду
            const { data: player, error: findError } = await supabase
                .from('players')
                .select('*')
                .eq('code', code)
                .maybeSingle();
            
            if (findError) {
                console.error('Ошибка поиска:', findError);
                throw findError;
            }
            
            if (!player) {
                showError('Неверный код. Проверьте правильность ввода.');
                return;
            }
            
            console.log('Найден игрок:', player);
            
            // Обновляем статус игрока
            const { error: updateError } = await supabase
                .from('players')
                .update({
                    is_visible: true,
                    last_login: new Date().toISOString()
                })
                .eq('id', player.id);
            
            if (updateError) {
                console.error('Ошибка обновления:', updateError);
                throw updateError;
            }
            
            // Сохраняем данные игрока
            const playerData = {
                id: player.id,
                code: player.code,
                first_name: player.first_name,
                last_name: player.last_name,
                class: player.class,
                balance: player.balance || 0,
                is_visible: true
            };
            
            console.log('Сохранение данных игрока:', playerData);
            sessionStorage.setItem('player', JSON.stringify(playerData));
            
            // Показываем успех и перенаправляем
            showSuccess('Успешный вход! Перенаправление...');
            
            setTimeout(() => {
                window.location.href = 'profile.html';
            }, 1000);
            
        } catch (error) {
            console.error('Fallback login error:', error);
            showError('Ошибка входа через резервный метод.');
        }
    }

    function setLoading(isLoading) {
        loginBtn.disabled = isLoading;
        loginBtn.textContent = isLoading ? 'Вход...' : 'Войти в игру';
    }

    function showError(message) {
        if (statusMessage) {
            statusMessage.textContent = message;
            statusMessage.className = 'status-message error';
        }
    }

    function showSuccess(message) {
        if (statusMessage) {
            statusMessage.textContent = message;
            statusMessage.className = 'status-message success';
        }
    }

    function clearMessage() {
        if (statusMessage) {
            statusMessage.textContent = '';
            statusMessage.className = 'status-message';
        }
    }
}