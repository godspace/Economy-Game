import { supabase, getPlayerCode, clearPlayerCode } from './supabase.js'
import { loginPlayer, logoutPlayer, getCurrentPlayer } from './auth.js'
import { loadPlayersList, openDealModal } from './players.js'
import { loadPendingDeals, loadCompletedDeals } from './deals.js'

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async () => {
    // Проверяем, авторизован ли пользователь
    const playerCode = getPlayerCode()
    if (playerCode) {
        const { data: player } = await getCurrentPlayer(playerCode)
        if (player) {
            showGameScreen(player)
        } else {
            clearPlayerCode()
        }
    }

    // Обработчики событий
    setupEventListeners()
})

function setupEventListeners() {
    // Вход в игру
    document.getElementById('login-btn').addEventListener('click', handleLogin)
    document.getElementById('player-code').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin()
    })
    
    // Выход из игры
    document.getElementById('logout-btn').addEventListener('click', handleLogout)
    
    // Переключение вкладок
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab
            switchTab(tab)
        })
    })
    
    // Закрытие модального окна
    document.querySelector('.close-modal').addEventListener('click', () => {
        document.getElementById('deal-modal').classList.remove('active')
    })
    
    // Закрытие модального окна при клике на фон
    document.getElementById('deal-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('deal-modal')) {
            document.getElementById('deal-modal').classList.remove('active')
        }
    })
}

async function handleLogin() {
    const code = document.getElementById('player-code').value.trim()
    const errorEl = document.getElementById('login-error')
    
    // Валидация кода
    if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
        errorEl.textContent = 'Введите 6-значный числовой код'
        errorEl.style.display = 'block'
        return
    }
    
    const { success, player, error } = await loginPlayer(code)
    
    if (success) {
        errorEl.style.display = 'none'
        showGameScreen(player)
    } else {
        errorEl.textContent = error || 'Ошибка входа'
        errorEl.style.display = 'block'
    }
}

function showGameScreen(player) {
    // Переключаем экраны
    document.getElementById('login-screen').classList.remove('active')
    document.getElementById('game-screen').classList.add('active')
    
    // Обновляем информацию игрока
    document.getElementById('player-color-indicator').style.backgroundColor = player.color
    document.getElementById('coins-count').textContent = player.coins
    
    // Загружаем начальные данные
    loadPlayersList()
    loadPendingDeals()
    loadCompletedDeals()
    
    // Запускаем периодическое обновление данных
    startDataPolling()
}

function handleLogout() {
    logoutPlayer()
    document.getElementById('game-screen').classList.remove('active')
    document.getElementById('login-screen').classList.add('active')
    document.getElementById('player-code').value = ''
    document.getElementById('login-error').style.display = 'none'
    stopDataPolling()
}

function switchTab(tabName) {
    // Обновляем активные кнопки
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName)
    })
    
    // Показываем активную вкладку
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`)
    })
    
    // Загружаем данные для вкладки
    if (tabName === 'players') {
        loadPlayersList()
    } else if (tabName === 'deals') {
        loadPendingDeals()
        loadCompletedDeals()
    }
}

// Фоновая проверка обновлений
let pollingInterval
function startDataPolling() {
    pollingInterval = setInterval(async () => {
        const playerCode = getPlayerCode()
        if (playerCode) {
            // Обновляем счет монет
            const { data: player } = await getCurrentPlayer(playerCode)
            if (player) {
                document.getElementById('coins-count').textContent = player.coins
            }
            
            // Обновляем данные на активной вкладке
            const activeTab = document.querySelector('.tab-btn.active').dataset.tab
            if (activeTab === 'players') {
                loadPlayersList()
            } else if (activeTab === 'deals') {
                loadPendingDeals()
                loadCompletedDeals()
            }
        }
    }, 3000) // Обновление каждые 3 секунды
}

function stopDataPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval)
    }
}

// Экспортируем функции, которые могут понадобиться
export { switchTab }