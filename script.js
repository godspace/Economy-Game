// Обновленная конфигурация
const SUPABASE_URL = 'https://dprlvkpzdhasgkgereqr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwcmx2a3B6ZGhhc2drZ2VyZXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMzcwNjgsImV4cCI6MjA4MDYxMzA2OH0.rJ2FuvObQ557_LevHPT7vaAIrPga6m_laAFkZLwWBSQ';

const EDGE_FUNCTIONS = {
    login: `${SUPABASE_URL}/functions/v1/login`,
    deals: `${SUPABASE_URL}/functions/v1/deals`,
    players: `${SUPABASE_URL}/functions/v1/players`,
    rating: `${SUPABASE_URL}/functions/v1/rating`,
    shop: `${SUPABASE_URL}/functions/v1/shop`,
    orders: `${SUPABASE_URL}/functions/v1/orders`
};

// Обновленный APP_STATE
const APP_STATE = {
    user: null,
    token: null,
    players: [],
    deals: [],
    rating: [],
    lastActionTime: 0,
    actionTimeout: 2000
};

// Добавьте эти функции в Utils
Utils.makeRequest = async function(url, options = {}) {
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
};

// Обновленная функция loadPlayers
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

// Обновленная функция loadRating
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
                item => item.profile_id === APP_STATE.user?.id
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

// Функция для создания сделки
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

// Функция для покупки
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

// Обновленная функция confirmDeal
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
    } catch (error) {
        Utils.showNotification(error.message, 'error');
    } finally {
        Utils.hideLoading();
    }
}

// Добавьте обработчик покупки
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

// Обновленная функция updateUserInfo
function updateUserInfo() {
    if (!APP_STATE.user) return;
    
    document.getElementById('user-name').textContent = 
        `${APP_STATE.user.first_name} ${APP_STATE.user.last_name}`;
    document.getElementById('user-coins').textContent = APP_STATE.user.coins;
    document.getElementById('user-color').style.backgroundColor = APP_STATE.user.color_tag;
    document.getElementById('shop-balance').textContent = APP_STATE.user.coins;
}

// Периодическое обновление данных
setInterval(() => {
    if (APP_STATE.user) {
        // Обновляем онлайн статус каждые 30 секунд
        updateOnlineStatus();
        
        // Обновляем баланс каждую минуту
        const now = Date.now();
        if (now - APP_STATE.lastBalanceUpdate > 60000) {
            updateBalance();
            APP_STATE.lastBalanceUpdate = now;
        }
    }
}, 30000);

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