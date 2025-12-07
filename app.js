import { supabase, getPlayerCode, clearPlayerCode } from './supabase.js'
import { loginPlayer, logoutPlayer, getCurrentPlayer } from './auth.js'
import { loadPlayersList, setupDealModal } from './players.js'
import { loadPendingDeals, loadCompletedDeals } from './deals.js'

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async () => {
    // Проверка авторизации
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
    document.getElementById('login-btn').addEventListener('click', handleLogin)
    document.getElementById('player-code').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin()
    })
    
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
})

async function handleLogin() {
    const code = document.getElementById('player-code').value.trim()
    if (code.length !== 6 || !/^\d+$/.test(code)) {
        showError('Введите 6-значный числовой код')
        return
    }
    
    const { success, player, error } = await loginPlayer(code)
    if (success) {
        showGameScreen(player)
    } else {
        showError(error)
    }
}

function showError(message) {
    const errorEl = document.getElementById('login-error')
    errorEl.textContent = message
    errorEl.classList.add('visible')
    setTimeout(() => errorEl.classList.remove('visible'), 3000)
}

function showGameScreen(player) {
    document.getElementById('login-screen').classList.remove('active')
    document.getElementById('game-screen').classList.add('active')
    
    // Обновить информацию игрока
    document.getElementById('player-color-indicator').style.backgroundColor = player.color
    document.getElementById('coins-count').textContent = player.coins
    
    // Загрузить данные
    loadPlayersList()
    loadPendingDeals()
    loadCompletedDeals()
    
    // Начать обновление данных
    startDataPolling()
}

function handleLogout() {
    logoutPlayer()
    clearPlayerCode()
    document.getElementById('game-screen').classList.remove('active')
    document.getElementById('login-screen').classList.add('active')
    document.getElementById('player-code').value = ''
    stopDataPolling()
}

function switchTab(tabName) {
    // Обновить активные кнопки
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName)
    })
    
    // Показать активную вкладку
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`)
    })
    
    // Обновить данные на вкладке
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
            const { data: player } = await getCurrentPlayer(playerCode)
            if (player) {
                document.getElementById('coins-count').textContent = player.coins
                loadPlayersList()
                loadPendingDeals()
                loadCompletedDeals()
            }
        }
    }, 5000) // Обновлять каждые 5 секунд
}

function stopDataPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval)
    }
}