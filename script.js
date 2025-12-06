// Конфигурация Supabase
const SUPABASE_URL = 'https://dprlvkpzdhasgkgereqr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwcmx2a3B6ZGhhc2drZ2VyZXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMzcwNjgsImV4cCI6MjA4MDYxMzA2OH0.rJ2FuvObQ557_LevHPT7vaAIrPga6m_laAFkZLwWBSQ';

// URL Edge Functions
const EDGE_FUNCTIONS = {
    login: `${SUPABASE_URL}/functions/v1/login`,
    deals: `${SUPABASE_URL}/functions/v1/deals`,
    rating: `${SUPABASE_URL}/functions/v1/rating`,
    shop: `${SUPABASE_URL}/functions/v1/shop`,
    orders: `${SUPABASE_URL}/functions/v1/orders`
};

// Глобальное состояние приложения
const APP_STATE = {
    user: null,
    token: null,
    players: [],
    deals: [],
    rating: [],
    lastActionTime: 0,
    actionTimeout: 2000 // 2 секунды между действиями
};

// Утилиты
const Utils = {
    // Rate limiting на клиенте
    canPerformAction() {
        const now = Date.now();
        if (now - APP_STATE.lastActionTime < APP_STATE.actionTimeout) {
            return false;
        }
        APP_STATE.lastActionTime = now;
        return true;
    },

    // Показать/скрыть загрузку
    showLoading() {
        document.getElementById('loading-overlay').style.display = 'flex';
    },

    hideLoading() {
        document.getElementById('loading-overlay').style.display = 'none';
    },

    // Уведомления
    showNotification(message, type = 'info') {
        const notificationCenter = document.getElementById('notification-center');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <span class="material-icons">${type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info'}</span>
            <span>${message}</span>
        `;
        notificationCenter.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    },

    // Форматирование чисел
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    },

    // Декодирование JWT (упрощенное)
    parseJWT(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            return JSON.parse(atob(base64));
        } catch {
            return null;
        }
    }
};

// Обработчики событий DOM
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    checkSavedAuth();
});

function initEventListeners() {
    // Авторизация
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('login-code').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    // Выход
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // Вкладки
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Модальное окно сделки
    document.getElementById('new-deal-btn').addEventListener('click', () => {
        if (!Utils.canPerformAction()) {
            Utils.showNotification('Подождите 2 секунды между действиями', 'warning');
            return;
        }
        showDealModal();
    });

    document.getElementById('close-deal-modal').addEventListener('click', hideDealModal);
    document.getElementById('confirm-deal-btn').addEventListener('click', confirmDeal);

    // Выбор игрока в модалке
    document.addEventListener('click', (e) => {
        if (e.target.closest('.choice-btn')) {
            const choiceBtn = e.target.closest('.choice-btn');
            document.querySelectorAll('.choice-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
            choiceBtn.classList.add('selected');
            document.getElementById('confirm-deal-btn').disabled = false;
        }
    });
}

// Авторизация
async function handleLogin() {
    const code = document.getElementById('login-code').value.trim();
    const errorElement = document.getElementById('login-error');

    if (!code || code.length !== 6) {
        errorElement.textContent = 'Введите 6-значный код';
        return;
    }

    errorElement.textContent = '';
    Utils.showLoading();

    try {
        const response = await fetch(EDGE_FUNCTIONS.login, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code })
        });

        const data = await response.json();

        if (data.success) {
            APP_STATE.user = data.profile;
            APP_STATE.token = data.token;
            
            // Сохраняем токен в localStorage
            localStorage.setItem('trust_token', data.token);
            localStorage.setItem('trust_profile', JSON.stringify(data.profile));
            
            // Показываем игру
            showGameScreen();
            
            // Загружаем начальные данные
            loadInitialData();
            
            Utils.showNotification(`Добро пожаловать, ${data.profile.first_name}!`, 'success');
        } else {
            throw new Error(data.error || 'Ошибка авторизации');
        }
    } catch (error) {
        errorElement.textContent = error.message;
        Utils.showNotification(error.message, 'error');
    } finally {
        Utils.hideLoading();
    }
}

// Проверка сохраненной авторизации
function checkSavedAuth() {
    const savedToken = localStorage.getItem('trust_token');
    const savedProfile = localStorage.getItem('trust_profile');
    
    if (savedToken && savedProfile) {
        try {
            APP_STATE.token = savedToken;
            APP_STATE.user = JSON.parse(savedProfile);
            
            // Проверяем, не истек ли токен
            const payload = Utils.parseJWT(savedToken);
            if (payload && payload.exp > Date.now() / 1000) {
                showGameScreen();
                loadInitialData();
            } else {
                // Токен истек
                localStorage.removeItem('trust_token');
                localStorage.removeItem('trust_profile');
            }
        } catch {
            localStorage.removeItem('trust_token');
            localStorage.removeItem('trust_profile');
        }
    }
}

// Переключение экранов
function showGameScreen() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    
    // Обновляем информацию пользователя
    updateUserInfo();
}

function updateUserInfo() {
    if (!APP_STATE.user) return;
    
    document.getElementById('user-name').textContent = 
        `${APP_STATE.user.first_name} ${APP_STATE.user.last_name}`;
    document.getElementById('user-coins').textContent = APP_STATE.user.coins;
    document.getElementById('user-color').style.backgroundColor = APP_STATE.user.color_tag;
    document.getElementById('shop-balance').textContent = APP_STATE.user.coins;
}

// Переключение вкладок
function switchTab(tabName) {
    // Обновляем активную кнопку
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
    
    // Обновляем активную вкладку
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Загружаем данные для вкладки
    switch (tabName) {
        case 'players':
            loadPlayers();
            break;
        case 'deals':
            loadDeals();
            break;
        case 'rating':
            loadRating();
            break;
        case 'shop':
            loadShop();
            break;
    }
}

// Загрузка начальных данных
async function loadInitialData() {
    await Promise.all([
        loadPlayers(),
        loadDeals(),
        loadRating()
    ]);
}

// Загрузка списка игроков
async function loadPlayers() {
    try {
        // Здесь будет запрос к Supabase для получения списка игроков
        // Пока используем заглушку
        const mockPlayers = [
            { id: 2, name: 'Игрок 2', coins: 150, online: true, color: '#E91E63', deals: 3 },
            { id: 3, name: 'Игрок 3', coins: 200, online: false, color: '#9C27B0', deals: 1 },
            { id: 4, name: 'Игрок 4', coins: 75, online: true, color: '#673AB7', deals: 0 },
            { id: 5, name: 'Игрок 5', coins: 300, online: true, color: '#3F51B5', deals: 5 },
        ];
        
        renderPlayersList(mockPlayers);
    } catch (error) {
        Utils.showNotification('Ошибка загрузки игроков', 'error');
    }
}

function renderPlayersList(players) {
    const container = document.getElementById('players-list');
    container.innerHTML = '';
    
    players.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.className = `player-card ${player.online ? 'online' : ''}`;
        playerCard.dataset.playerId = player.id;
        playerCard.innerHTML = `
            <div class="player-color" style="background-color: ${player.color};"></div>
            <div class="player-name">${player.name}</div>
            <div class="player-coins">${Utils.formatNumber(player.coins)} монет</div>
            <div class="deal-count">Сделок: ${player.deals}/5</div>
        `;
        
        playerCard.addEventListener('click', () => selectPlayerForDeal(player));
        container.appendChild(playerCard);
    });
}

// Модальное окно сделки
let selectedPlayerForDeal = null;

function showDealModal() {
    // Здесь будет реальная загрузка доступных игроков
    // Пока просто показываем модалку
    document.getElementById('deal-modal').classList.add('active');
    
    // Сбрасываем состояние
    selectedPlayerForDeal = null;
    document.querySelectorAll('.choice-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    document.getElementById('confirm-deal-btn').disabled = true;
}

function hideDealModal() {
    document.getElementById('deal-modal').classList.remove('active');
}

function selectPlayerForDeal(player) {
    selectedPlayerForDeal = player;
    
    // Обновляем UI
    document.querySelectorAll('.player-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelector(`.player-card[data-player-id="${player.id}"]`).classList.add('selected');
    
    // Можно добавить подтверждение выбора в модалке
}

async function confirmDeal() {
    if (!selectedPlayerForDeal || !Utils.canPerformAction()) return;
    
    const selectedChoice = document.querySelector('.choice-btn.selected');
    if (!selectedChoice) {
        Utils.showNotification('Выберите действие', 'warning');
        return;
    }
    
    const choice = selectedChoice.dataset.choice;
    
    try {
        // Здесь будет вызов Edge Function для создания сделки
        Utils.showNotification('Сделка предложена игроку', 'success');
        hideDealModal();
        
        // Обновляем список сделок
        loadDeals();
    } catch (error) {
        Utils.showNotification(error.message, 'error');
    }
}

// Загрузка сделок
async function loadDeals() {
    // Заглушка
    const mockDeals = [
        { id: 1, player: 'Игрок 2', status: 'pending', type: 'outgoing', created: '10:30' },
        { id: 2, player: 'Игрок 5', status: 'completed', result: 'both_cooperate', type: 'incoming', created: '09:15' },
    ];
    
    renderDealsList(mockDeals);
}

function renderDealsList(deals) {
    const container = document.getElementById('deals-list');
    container.innerHTML = '';
    
    deals.forEach(deal => {
        const dealElement = document.createElement('div');
        dealElement.className = `deal-item ${deal.status}`;
        dealElement.innerHTML = `
            <div class="deal-header">
                <span class="deal-player">${deal.player}</span>
                <span class="deal-time">${deal.created}</span>
            </div>
            <div class="deal-status">${getDealStatusText(deal)}</div>
            ${deal.type === 'incoming' && deal.status === 'pending' ? 
                '<button class="btn-small" data-deal-id="' + deal.id + '">Ответить</button>' : ''}
        `;
        container.appendChild(dealElement);
    });
}

function getDealStatusText(deal) {
    const statusMap = {
        'pending': 'Ожидает ответа',
        'completed': 'Завершена',
        'both_cooperate': 'Оба сотрудничали (+2)',
        'both_cheated': 'Оба жульничали (-1)'
    };
    return statusMap[deal.result] || statusMap[deal.status] || deal.status;
}

// Загрузка рейтинга
async function loadRating() {
    // Заглушка
    const mockRating = [
        { position: 1, name: 'Игрок 5', class: '10A', coins: 300 },
        { position: 2, name: 'Игрок 3', class: '9B', coins: 200 },
        { position: 3, name: 'Игрок 2', class: '11A', coins: 150 },
        { position: 4, name: 'Игрок 1', class: '10B', coins: 100 },
        { position: 5, name: 'Игрок 4', class: '9A', coins: 75 },
    ];
    
    renderRatingList(mockRating);
}

function renderRatingList(rating) {
    const container = document.getElementById('rating-list');
    container.innerHTML = '';
    
    rating.forEach(item => {
        const ratingItem = document.createElement('div');
        ratingItem.className = 'rating-item';
        ratingItem.innerHTML = `
            <div class="rating-position">${item.position}</div>
            <div class="rating-info">
                <div class="rating-name">${item.name}</div>
                <div class="rating-class">${item.class}</div>
            </div>
            <div class="rating-coins">${Utils.formatNumber(item.coins)} монет</div>
        `;
        container.appendChild(ratingItem);
    });
}

// Магазин
async function loadShop() {
    // Пока ничего не делаем, так как у нас один товар
    updateUserInfo();
}

// Выход
function handleLogout() {
    if (!Utils.canPerformAction()) return;
    
    if (confirm('Вы уверены, что хотите выйти?')) {
        APP_STATE.user = null;
        APP_STATE.token = null;
        
        localStorage.removeItem('trust_token');
        localStorage.removeItem('trust_profile');
        
        document.getElementById('game-screen').classList.remove('active');
        document.getElementById('auth-screen').classList.add('active');
        
        document.getElementById('login-code').value = '';
        document.getElementById('login-code').focus();
        
        Utils.showNotification('Вы вышли из системы', 'info');
    }
}