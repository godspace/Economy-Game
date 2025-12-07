import { supabase } from './supabase.js'

class AuthManager {
    constructor() {
        this.loginBtn = document.getElementById('loginBtn')
        this.playerCodeInput = document.getElementById('playerCode')
        this.statusMessage = document.getElementById('statusMessage')
        
        this.initEventListeners()
    }
    
    initEventListeners() {
        this.loginBtn.addEventListener('click', () => this.handleLogin())
        
        this.playerCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleLogin()
            }
        })
        
        // Ограничиваем ввод только цифрами
        this.playerCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6)
        })
    }
    
    async handleLogin() {
        const code = this.playerCodeInput.value.trim()
        
        // Валидация
        if (!code || code.length !== 6) {
            this.showError('Введите 6-значный код')
            return
        }
        
        // Показываем загрузку
        this.setLoading(true)
        this.clearMessage()
        
        try {
            // Сначала проверяем существование игрока
            const { data: existingPlayer, error: findError } = await supabase
                .from('players')
                .select('*')
                .eq('code', code)
                .single()
            
            if (findError) {
                if (findError.code === 'PGRST116') {
                    this.showError('Неверный код. Проверьте правильность ввода.')
                } else {
                    throw findError
                }
                return
            }
            
            // Обновляем статус игрока
            const { error: updateError } = await supabase
                .from('players')
                .update({
                    is_visible: true,
                    last_login: new Date().toISOString()
                })
                .eq('code', code)
            
            if (updateError) throw updateError
            
            // Сохраняем данные игрока
            sessionStorage.setItem('player', JSON.stringify({
                id: existingPlayer.id,
                code: existingPlayer.code,
                first_name: existingPlayer.first_name,
                last_name: existingPlayer.last_name,
                class: existingPlayer.class,
                balance: existingPlayer.balance || 0
            }))
            
            // Показываем успех и перенаправляем
            this.showSuccess('Успешный вход! Перенаправление...')
            
            setTimeout(() => {
                window.location.href = 'profile.html'
            }, 1000)
            
        } catch (error) {
            console.error('Login error:', error)
            this.showError('Ошибка входа. Попробуйте позже.')
        } finally {
            this.setLoading(false)
        }
    }
    
    setLoading(isLoading) {
        this.loginBtn.disabled = isLoading
        this.loginBtn.textContent = isLoading ? 'Вход...' : 'Войти в игру'
    }
    
    showError(message) {
        this.statusMessage.textContent = message
        this.statusMessage.className = 'status-message error'
    }
    
    showSuccess(message) {
        this.statusMessage.textContent = message
        this.statusMessage.className = 'status-message success'
    }
    
    clearMessage() {
        this.statusMessage.textContent = ''
        this.statusMessage.className = 'status-message'
    }
}

// Инициализируем при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager()
})