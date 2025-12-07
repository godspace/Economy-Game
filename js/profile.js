import { supabase } from './supabase.js'

class ProfileManager {
    constructor() {
        this.player = null
        this.logoutBtn = document.getElementById('logoutBtn')
        this.playersList = document.getElementById('playersList')
        
        this.init()
    }
    
    async init() {
        // Проверяем, авторизован ли игрок
        this.loadPlayerFromStorage()
        
        if (!this.player) {
            // Если нет, перенаправляем на страницу входа
            window.location.href = 'index.html'
            return
        }
        
        // Обновляем интерфейс
        this.updateUI()
        
        // Загружаем список игроков
        await this.loadPlayersList()
        
        // Настраиваем кнопку выхода
        this.logoutBtn.addEventListener('click', () => this.handleLogout())
        
        // Защита от изменений через консоль
        this.setupConsoleProtection()
    }
    
    loadPlayerFromStorage() {
        const playerData = sessionStorage.getItem('player')
        if (playerData) {
            this.player = JSON.parse(playerData)
        }
    }
    
    updateUI() {
        // Устанавливаем имя
        document.getElementById('playerName').textContent = 
            `${this.player.first_name} ${this.player.last_name}`
        
        // Класс
        document.getElementById('playerClass').textContent = this.player.class
        
        // Код
        document.getElementById('playerCode').textContent = this.player.code
        
        // Баланс
        document.getElementById('balanceValue').textContent = this.player.balance
        
        // Инициалы для аватара (первые буквы имени и фамилии)
        const initials = (this.player.first_name[0] + this.player.last_name[0]).toUpperCase()
        document.getElementById('avatarInitials').textContent = initials
    }
    
    async loadPlayersList() {
        this.playersList.innerHTML = '<div class="loading">Загрузка списка игроков...</div>'
        
        try {
            // Загружаем только видимых игроков, исключая текущего
            const { data: players, error } = await supabase
                .from('players')
                .select('id, first_name, last_name, class, balance')
                .eq('is_visible', true)
                .neq('id', this.player.id)
                .order('last_login', { ascending: false })
            
            if (error) throw error
            
            if (players.length === 0) {
                this.playersList.innerHTML = '<div class="loading">Пока нет других игроков...</div>'
                return
            }
            
            // Генерируем HTML для списка игроков
            this.playersList.innerHTML = players.map(player => `
                <div class="player-item">
                    <div class="player-item-avatar">
                        ${player.first_name[0]}${player.last_name[0]}
                    </div>
                    <div class="player-item-info">
                        <h4>${player.first_name} ${player.last_name}</h4>
                        <div class="player-item-class">${player.class} • ${player.balance} монет</div>
                    </div>
                </div>
            `).join('')
            
        } catch (error) {
            console.error('Error loading players:', error)
            this.playersList.innerHTML = 
                '<div class="error-message">Не удалось загрузить список игроков</div>'
        }
    }
    
    handleLogout() {
        // Очищаем sessionStorage и перенаправляем на страницу входа
        sessionStorage.removeItem('player')
        window.location.href = 'index.html'
    }
    
    setupConsoleProtection() {
        // Защита от изменения баланса через консоль
        Object.defineProperty(window, 'player', {
            get: () => this.player,
            set: () => {
                console.warn('Изменение игрока через консоль запрещено')
                return false
            }
        })
        
        // Защита от изменения sessionStorage
        const originalSetItem = sessionStorage.setItem
        sessionStorage.setItem = function(key, value) {
            if (key === 'player') {
                console.warn('Попытка изменения данных игрока через консоль!')
                return false
            }
            return originalSetItem.apply(this, arguments)
        }
        
        // Защита от открытия DevTools (опционально)
        document.addEventListener('keydown', function(e) {
            // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
            if (e.keyCode === 123 || 
                (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74)) ||
                (e.ctrlKey && e.keyCode === 85)) {
                e.preventDefault()
                console.log('Действие заблокировано системой безопасности')
                return false
            }
        })
    }
}

// Инициализируем при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new ProfileManager()
})