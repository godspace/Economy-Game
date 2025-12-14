document.addEventListener('DOMContentLoaded', function() {
    const codeInput = document.getElementById('code');
    const loginBtn = document.getElementById('loginBtn');
    const toggleBtn = document.getElementById('toggleCode');
    const loadingOverlay = document.getElementById('loading');
    
    // Переключение видимости кода
    toggleBtn.addEventListener('click', function() {
        const type = codeInput.type === 'password' ? 'text' : 'password';
        codeInput.type = type;
        this.innerHTML = type === 'password' ? 
            '<i class="fas fa-eye"></i>' : 
            '<i class="fas fa-eye-slash"></i>';
    });
    
    // Вход по Enter
    codeInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            login();
        }
    });
    
    // Кнопка входа
    loginBtn.addEventListener('click', login);
    
    // Проверка существующей сессии
    checkSession().then(player => {
        if (player) {
            window.location.href = 'game.html';
        }
    });
    
    async function login() {
        const code = codeInput.value.trim();
        
        if (!validateCode(code)) {
            showError('Введите ровно 6 цифр');
            return;
        }
        
        if (isRateLimited()) {
            showError('Подождите немного перед следующим действием');
            return;
        }
        
        loadingOverlay.style.display = 'flex';
        
        try {
            const codeHash = await hashCode(code);
            
            // Проверяем код в базе данных
            const { data: player, error } = await supabase
                .from('players')
                .select('*')
                .eq('code_hash', codeHash)
                .single();
            
            if (error || !player) {
                showError('Неверный код доступа');
                loadingOverlay.style.display = 'none';
                return;
            }
            
            // Создаем новую сессию
            const sessionToken = generateSessionToken();
            const sessionExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 часа
            
            const { error: updateError } = await supabase
                .from('players')
                .update({
                    session_token: sessionToken,
                    session_expiry: sessionExpiry.toISOString(),
                    visible: true,
                    last_active: new Date().toISOString()
                })
                .eq('id', player.id);
            
            if (updateError) {
                throw updateError;
            }
            
            // Сохраняем токен и переходим в игру
            localStorage.setItem('session_token', sessionToken);
            
            // Логируем вход
            await logAuditAction(player.id, 'login', player.coins, player.coins);
            
            window.location.href = 'game.html';
            
        } catch (error) {
            console.error('Login error:', error);
            showError('Ошибка входа. Попробуйте позже.');
            loadingOverlay.style.display = 'none';
        }
    }
    
    function showError(message) {
        // Создаем или находим элемент для ошибки
        let errorEl = document.querySelector('.error-message');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.className = 'error-message';
            document.querySelector('.form-group').appendChild(errorEl);
        }
        
        errorEl.textContent = message;
        errorEl.style.color = '#ff6b6b';
        errorEl.style.marginTop = '10px';
        errorEl.style.fontSize = '14px';
        errorEl.style.textAlign = 'center';
        
        // Анимация ошибки
        errorEl.style.opacity = '0';
        errorEl.style.transform = 'translateY(-10px)';
        
        setTimeout(() => {
            errorEl.style.transition = 'all 0.3s ease';
            errorEl.style.opacity = '1';
            errorEl.style.transform = 'translateY(0)';
        }, 10);
        
        // Удаляем ошибку через 5 секунд
        setTimeout(() => {
            if (errorEl.parentNode) {
                errorEl.style.opacity = '0';
                errorEl.style.transform = 'translateY(-10px)';
                setTimeout(() => {
                    if (errorEl.parentNode) {
                        errorEl.parentNode.removeChild(errorEl);
                    }
                }, 300);
            }
        }, 5000);
        
        // Анимация встряхивания инпута
        codeInput.style.animation = 'none';
        setTimeout(() => {
            codeInput.style.animation = 'shake 0.5s ease';
        }, 10);
    }
    
    // Анимация встряхивания
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
    `;
    document.head.appendChild(style);
});