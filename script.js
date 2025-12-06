// Конфигурация Supabase
const SUPABASE_URL = 'https://dprlvkpzdhasgkgereqr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwcmx2a3B6ZGhhc2drZ2VyZXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMzcwNjgsImV4cCI6MjA4MDYxMzA2OH0.rJ2FuvObQ557_LevHPT7vaAIrPga6m_laAFkZLwWBSQ';

// URL Edge Functions
const EDGE_FUNCTIONS = {
    login: `${SUPABASE_URL}/functions/v1/login`,
    deals: `${SUPABASE_URL}/functions/v1/deals`,
    players: `${SUPABASE_URL}/functions/v1/players`,
    rating: `${SUPABASE_URL}/functions/v1/rating`,
    shop: `${SUPABASE_URL}/functions/v1/shop`,
    orders: `${SUPABASE_URL}/functions/v1/orders`
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
    },

    // Функция для выполнения запросов
    async makeRequest(url, options = {}) {
        const defaultHeaders = {
            'Content-Type': 'application/json',
        };
        
        if (APP_STATE.token) {
            defaultHeaders['Authorization'] = `Bearer ${APP_STATE.token}`;
        }
        
        const response = await fetch(url, {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers,
            },
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
    }
};

// Глобальное состояние приложения
const APP_STATE = {
    user: null,
    token: null,
    players: [],
    deals: [],
    rating: [],
    lastActionTime: 0,
    actionTimeout: 2000, // 2 секунды между действиями
    lastBalanceUpdate: 0
};

// Обработчики событий DOM
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    checkSavedAuth();
    
    // Периодическое обновление данных
    setInterval(() => {
        if (APP_STATE.user) {
            updateOnlineStatus();
            
            // Обновляем баланс каждую минуту
            const now = Date.now();
            if (now - APP_STATE.lastBalanceUpdate > 60000) {
                updateBalance();
                APP_STATE.lastBalanceUpdate = now;
            }
        }
    }, 30000);
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

    // Покупка в магазине
    document.addEventListener('click', (e) => {
        if (e.target.closest('.btn-buy')) {
            const btn = e.target.closest('.btn-buy');
            const itemName = btn.dataset.item;
            const price = parseInt(btn.dataset.price);
            
            if (APP_STATE.user.coins < price) {
                Utils.showNotification('Недостаточно монет', 'error');
                return;
            }
            
            if (confirm(`Купить ${itemName} за ${price} монет?`)) {
                Utils.showLoading();
                purchaseItem(itemName, price)
                    .then(data => {
                        Utils.showNotification(data.message, 'success');
                    })
                    .catch(error => {
                        Utils.showNotification(error.message, 'error');
                    })
                    .finally(() => {
                        Utils.hideLoading();
                    });
            }
        }
    });

    // Фильтры игроков
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach(c => {
                c.classList.remove('active');
            });
            chip.classList.add('active');
            loadPlayers(); // Перезагружаем с фильтром
        });
    });

    // Поиск игроков
    document.getElementById('player-search').addEventListener('input', debounce(() => {
        loadPlayers();
    }, 300));
}

// Debounce функция для поиска
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
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
        const data = await Utils.makeRequest(EDGE_FUNCTIONS.players, {
            method: 'POST',
            body: JSON.stringify({ action: 'get_players' })
        });
        
        if (data.success) {
            APP_STATE.players = data.players;
            renderPlayersList(data.players);
        }
    } catch (error) {
        console.error('Ошибка загрузки игроков:', error);
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
            <div class="deal-count">Сделок: ${player.deals}/10</div>
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
    
    Utils.showLoading();
    
    try {
        await createDeal(selectedPlayerForDeal.id, choice);
        Utils.showNotification('Сделка предложена игроку', 'success');
        hideDealModal();
        loadDeals(); // Обновляем список сделок
        loadPlayers(); // Обновляем список игроков (счетчик сделок)
    } catch (error) {
        Utils.showNotification(error.message, 'error');
    } finally {
        Utils.hideLoading();
    }
}

// Загрузка сделок
async function loadDeals() {
    try {
        const data = await Utils.makeRequest(EDGE_FUNCTIONS.deals, {
            method: 'POST',
            body: JSON.stringify({ action: 'get_deals' })
        });
        
        if (data.success) {
            APP_STATE.deals = data.deals;
            renderDealsList(data.deals);
        }
    } catch (error) {
        console.error('Ошибка загрузки сделок:', error);
        Utils.showNotification('Ошибка загрузки сделок', 'error');
    }
}

function renderDealsList(deals) {
    const container = document.getElementById('deals-list');
    const historyContainer = document.getElementById('history-list');
    
    container.innerHTML = '';
    historyContainer.innerHTML = '';
    
    const activeDeals = deals.filter(deal => deal.result === 'pending');
    const completedDeals = deals.filter(deal => deal.result !== 'pending');
    
    // Активные сделки
    activeDeals.forEach(deal => {
        const dealElement = document.createElement('div');
        dealElement.className = `deal-item ${deal.status}`;
        
        const isIncoming = deal.to_player === APP_STATE.user.id;
        
        dealElement.innerHTML = `
            <div class="deal-header">
                <span class="deal-player">Сделка #${deal.id.substring(0, 8)}</span>
                <span class="deal-time">${new Date(deal.created_at).toLocaleTimeString()}</span>
            </div>
            <div class="deal-status">
                ${isIncoming ? 'Входящая - ожидает вашего ответа' : 'Исходящая - ожидает ответа'}
            </div>
            ${isIncoming ? 
                `<div class="deal-actions">
                    <button class="btn-small respond-btn" data-deal-id="${deal.id}" data-choice="cooperate">
                        Сотрудничать
                    </button>
                    <button class="btn-small respond-btn" data-deal-id="${deal.id}" data-choice="cheat">
                        Жульничать
                    </button>
                </div>` : 
                ''
            }
        `;
        container.appendChild(dealElement);
    });
    
    // История сделок
    completedDeals.forEach(deal => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        const resultText = getDealResultText(deal);
        const date = new Date(deal.created_at).toLocaleDateString();
        
        historyItem.innerHTML = `
            <div class="history-date">${date}</div>
            <div class="history-result">${resultText}</div>
            <div class="history-coins">${deal.result_coins || 0} монет</div>
        `;
        historyContainer.appendChild(historyItem);
    });
}

function getDealResultText(deal) {
    const resultMap = {
        'both_cooperate': 'Оба сотрудничали',
        'both_cheated': 'Оба жульничали',
        'from_cooperated_to_cheated': 'Вы сотрудничали, партнер жульничал',
        'from_cheated_to_cooperated': 'Вы жульничали, партнер сотрудничал'
    };
    return resultMap[deal.result] || deal.result;
}

// Загрузка рейтинга
async function loadRating() {
    try {
        const period = document.getElementById('rating-period')?.value || 'all';
        const data = await Utils.makeRequest(EDGE_FUNCTIONS.rating, {
            method: 'POST',
            body: JSON.stringify({ period })
        });
        
        if (data.success) {
            APP_STATE.rating = data.rating;
            renderRatingList(data.rating);
            
            // Находим позицию текущего пользователя
            const userPosition = data.rating.findIndex(
                item => `${item.first_name} ${item.last_name}` === 
                       `${APP_STATE.user.first_name} ${APP_STATE.user.last_name}`
            );
            
            if (userPosition !== -1) {
                document.getElementById('my-position').textContent = 
                    `${userPosition + 1} место`;
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки рейтинга:', error);
        Utils.showNotification('Ошибка загрузки рейтинга', 'error');
    }
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
                <div class="rating-name">${item.first_name} ${item.last_name}</div>
                <div class="rating-class">${item.class}</div>
            </div>
            <div class="rating-coins">${Utils.formatNumber(item.coins)} монет</div>
        `;
        container.appendChild(ratingItem);
    });
}

// Магазин
async function loadShop() {
    try {
        const data = await Utils.makeRequest(EDGE_FUNCTIONS.shop, {
            method: 'POST',
            body: JSON.stringify({ action: 'get_purchases' })
        });
        
        if (data.success) {
            renderPurchasesList(data.orders);
        }
    } catch (error) {
        console.error('Ошибка загрузки покупок:', error);
    }
    
    updateUserInfo();
}

function renderPurchasesList(orders) {
    const container = document.getElementById('purchases-list');
    container.innerHTML = '';
    
    if (orders.length === 0) {
        container.innerHTML = '<div class="empty-state">Покупок пока нет</div>';
        return;
    }
    
    orders.forEach(order => {
        const orderItem = document.createElement('div');
        orderItem.className = 'order-item';
        orderItem.innerHTML = `
            <div class="order-name">${order.item_name}</div>
            <div class="order-date">${new Date(order.created_at).toLocaleDateString()}</div>
            <div class="order-status ${order.status}">${getStatusText(order.status)}</div>
        `;
        container.appendChild(orderItem);
    });
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'Ожидает подтверждения',
        'confirmed': 'Подтверждено',
        'cancelled': 'Отменено'
    };
    return statusMap[status] || status;
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

// API функции
async function createDeal(toPlayerId, choice) {
    if (!Utils.canPerformAction()) {
        throw new Error('Подождите 2 секунды между действиями');
    }
    
    try {
        const data = await Utils.makeRequest(EDGE_FUNCTIONS.deals, {
            method: 'POST',
            body: JSON.stringify({
                action: 'create_deal',
                data: {
                    to_player_id: toPlayerId,
                    choice: choice
                }
            })
        });
        
        if (data.success) {
            return data.deal;
        }
        throw new Error(data.error);
    } catch (error) {
        throw error;
    }
}

async function purchaseItem(itemName, price) {
    if (!Utils.canPerformAction()) {
        throw new Error('Подождите 2 секунды между действиями');
    }
    
    try {
        const data = await Utils.makeRequest(EDGE_FUNCTIONS.shop, {
            method: 'POST',
            body: JSON.stringify({
                action: 'purchase',
                item_name: itemName
            })
        });
        
        if (data.success) {
            // Обновляем баланс пользователя
            APP_STATE.user.coins = data.new_balance;
            updateUserInfo();
            return data;
        }
        throw new Error(data.error);
    } catch (error) {
        throw error;
    }
}

async function updateOnlineStatus() {
    try {
        await Utils.makeRequest(EDGE_FUNCTIONS.players, {
            method: 'POST',
            body: JSON.stringify({ action: 'update_online' })
        });
    } catch (error) {
        console.error('Ошибка обновления статуса:', error);
    }
}

async function updateBalance() {
    try {
        const data = await Utils.makeRequest(EDGE_FUNCTIONS.players, {
            method: 'POST',
            body: JSON.stringify({ action: 'get_profile' })
        });
        
        if (data.success && data.profile) {
            APP_STATE.user.coins = data.profile.coins;
            updateUserInfo();
        }
    } catch (error) {
        console.error('Ошибка обновления баланса:', error);
    }
}

// Обработка ответов на сделки
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('respond-btn')) {
        const dealId = e.target.dataset.dealId;
        const choice = e.target.dataset.choice;
        
        respondToDeal(dealId, choice);
    }
});

async function respondToDeal(dealId, choice) {
    if (!Utils.canPerformAction()) {
        Utils.showNotification('Подождите 2 секунды между действиями', 'warning');
        return;
    }
    
    Utils.showLoading();
    
    try {
        const data = await Utils.makeRequest(EDGE_FUNCTIONS.deals, {
            method: 'POST',
            body: JSON.stringify({
                action: 'accept_deal',
                data: {
                    deal_id: dealId,
                    choice: choice
                }
            })
        });
        
        if (data.success) {
            Utils.showNotification('Ответ отправлен!', 'success');
            loadDeals();
            loadPlayers();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        Utils.showNotification(error.message, 'error');
    } finally {
        Utils.hideLoading();
    }
}