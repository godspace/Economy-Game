// docs/js/game.js
class TrustEvolutionGame {
    constructor() {
        this.supabaseUrl = 'https://uceeqmeiaqzmvdghsgyi.supabase.co';
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjZWVxbWVpYXF6bXZkZ2hzZ3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMjgxMDgsImV4cCI6MjA4MDYwNDEwOH0.vAwilbfGtEQLdEgk115JgNfSSXup-Zqjk0rwOrZgZWE';
        
        this.currentUser = null;
        this.currentToken = null;
        this.lastActionTime = 0;
        this.currentModalTarget = null;
        
        this.colorMap = {
            'blue': '#2196F3',
            'green': '#4CAF50',
            'red': '#F44336',
            'purple': '#9C27B0',
            'orange': '#FF9800',
            'teal': '#009688',
            'pink': '#E91E63',
            'amber': '#FFC107'
        };
    }
    
    init() {
        this.loadSavedSession();
        this.setupEventListeners();
    }
    
    loadSavedSession() {
        const savedUser = localStorage.getItem('user_data');
        const savedToken = localStorage.getItem('game_token');
        
        if (savedUser && savedToken) {
            this.currentUser = JSON.parse(savedUser);
            this.currentToken = savedToken;
            this.showGameScreen();
            this.loadPlayers();
            this.loadDeals();
            this.loadRating();
        }
    }
    
    setupEventListeners() {
        // Вход
        document.getElementById('login-btn')?.addEventListener('click', () => this.login());
        document.getElementById('login-code')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });
        
        // Вкладки
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });
        
        // Обновление
        document.getElementById('refresh-players')?.addEventListener('click', () => this.loadPlayers());
        document.getElementById('refresh-deals')?.addEventListener('click', () => this.loadDeals());
        document.getElementById('refresh-rating')?.addEventListener('click', () => this.loadRating());
        
        // Модальное окно
        document.getElementById('close-modal')?.addEventListener('click', () => this.closeModal());
        document.getElementById('modal-overlay')?.addEventListener('click', () => this.closeModal());
        
        // Кнопки в модальном окне
        document.querySelector('.btn-cooperate')?.addEventListener('click', () => this.makeDealChoice('cooperate'));
        document.querySelector('.btn-cheat')?.addEventListener('click', () => this.makeDealChoice('cheat'));
        
        // Магазин
        document.getElementById('buy-bounty')?.addEventListener('click', () => this.buyBounty());
    }
    
    async login() {
        if (!this.canPerformAction()) return;
        
        const code = document.getElementById('login-code').value.trim();
        const errorDiv = document.getElementById('login-error');
        
        if (!/^\d{6}$/.test(code)) {
            errorDiv.textContent = 'Введите 6-значный код';
            return;
        }
        
        errorDiv.textContent = '';
        this.updateLastActionTime();
        
        try {
            const response = await fetch(`${this.supabaseUrl}/rest/v1/rpc/api_login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`
                },
                body: JSON.stringify({ code_param: code })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.currentUser = data.user;
                this.currentToken = data.token;
                
                localStorage.setItem('user_data', JSON.stringify(data.user));
                localStorage.setItem('game_token', data.token);
                
                this.showGameScreen();
                this.loadPlayers();
                this.loadDeals();
                this.loadRating();
            } else {
                errorDiv.textContent = data.error || 'Ошибка входа';
            }
        } catch (error) {
            errorDiv.textContent = 'Ошибка сети';
        }
    }
    
    showGameScreen() {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('game-screen').classList.add('active');
        
        document.getElementById('player-name').textContent = 
            `${this.currentUser.first_name} ${this.currentUser.last_name[0]}.`;
    }
    
    switchTab(tabName) {
        // Скрыть все вкладки
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        
        // Показать выбранную
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // Загрузить данные если нужно
        if (tabName === 'players') {
            this.loadPlayers();
        } else if (tabName === 'deals') {
            this.loadDeals();
        } else if (tabName === 'rating') {
            this.loadRating();
        }
    }
    
    async loadPlayers() {
        if (!this.currentUser || !this.canPerformAction()) return;
        
        const playersList = document.getElementById('players-list');
        playersList.innerHTML = '<p style="text-align: center; color: #666;">Загрузка...</p>';
        this.updateLastActionTime();
        
        try {
            const response = await fetch(`${this.supabaseUrl}/rest/v1/rpc/get_online_players`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`
                },
                body: JSON.stringify({ current_user_id: this.currentUser.id })
            });
            
            const data = await response.json();
            
            if (data.players && data.players.length > 0) {
                this.renderPlayersList(data.players);
            } else {
                playersList.innerHTML = '<p style="text-align: center; color: #666;">Нет игроков онлайн</p>';
            }
        } catch (error) {
            playersList.innerHTML = '<p style="text-align: center; color: #666;">Ошибка загрузки</p>';
        }
    }
    
    renderPlayersList(players) {
        const playersList = document.getElementById('players-list');
        playersList.innerHTML = '';
        
        players.forEach(player => {
            const playerEl = document.createElement('div');
            playerEl.className = 'player-card';
            playerEl.innerHTML = `
                <div class="color-indicator" style="background-color: ${this.colorMap[player.color.name] || '#cccccc'};"></div>
                <div class="player-info">
                    <div class="player-name">${player.display_name}</div>
                    <div class="deal-counters">
                        <span>Вх: ${player.deals.incoming}/5</span>
                        <span>Исх: ${player.deals.outgoing}/5</span>
                    </div>
                </div>
                <button class="deal-btn" ${player.deals.can_trade ? '' : 'disabled'} 
                        data-player-id="${player.id}" 
                        data-player-color="${player.color.name}">
                    ${player.deals.can_trade ? 'Сделка' : 'Лимит'}
                </button>
            `;
            
            playersList.appendChild(playerEl);
        });
        
        // Добавить обработчики для кнопок сделок
        document.querySelectorAll('.deal-btn:not(:disabled)').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (this.canPerformAction()) {
                    const playerId = e.target.dataset.playerId;
                    const playerColor = e.target.dataset.playerColor;
                    this.openDealModal(playerId, playerColor);
                    this.updateLastActionTime();
                }
            });
        });
    }
    
    async openDealModal(targetPlayerId, targetPlayerColor) {
        this.currentModalTarget = {
            id: targetPlayerId,
            color: targetPlayerColor
        };
        
        // Показать модальное окно
        document.getElementById('modal-overlay').style.display = 'block';
        document.getElementById('deal-modal').style.display = 'block';
        
        // Установить цвет
        const colorEl = document.getElementById('modal-player-color');
        colorEl.style.backgroundColor = this.colorMap[targetPlayerColor] || '#cccccc';
        
        // Загрузить историю сделок
        await this.loadDealHistory(targetPlayerId);
    }
    
    async loadDealHistory(targetPlayerId) {
        const historyList = document.getElementById('history-list');
        historyList.innerHTML = '<p style="color: #666;">Загрузка истории...</p>';
        
        try {
            const response = await fetch(`${this.supabaseUrl}/rest/v1/rpc/get_deal_history`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`
                },
                body: JSON.stringify({
                    user_id: this.currentUser.id,
                    partner_id: targetPlayerId
                })
            });
            
            const data = await response.json();
            
            if (data.history && data.history.length > 0) {
                let html = '';
                data.history.forEach(deal => {
                    const choiceIcon = deal.my_choice === 'cooperate' ? '👍' : '👎';
                    const partnerChoiceIcon = deal.partner_choice === 'cooperate' ? '👍' : '👎';
                    const coins = deal.my_coins > 0 ? `+${deal.my_coins}` : deal.my_coins;
                    
                    html += `
                    <div style="margin-bottom: 8px; padding: 8px; background: white; border-radius: 6px;">
                        ${deal.formatted_time} - Вы: ${choiceIcon} Игрок: ${partnerChoiceIcon} (${coins} монет)
                    </div>
                    `;
                });
                historyList.innerHTML = html;
            } else {
                historyList.innerHTML = '<p style="color: #666;">Нет истории сделок</p>';
            }
        } catch (error) {
            historyList.innerHTML = '<p style="color: #666;">Ошибка загрузки истории</p>';
        }
    }
    
    async makeDealChoice(choice) {
        if (!this.currentModalTarget || !this.canPerformAction()) return;
        
        try {
            // Сначала создаём сделку
            const createResponse = await fetch(`${this.supabaseUrl}/rest/v1/rpc/create_deal`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`
                },
                body: JSON.stringify({
                    current_user_id: this.currentUser.id,
                    target_user_id: this.currentModalTarget.id
                })
            });
            
            const createData = await createResponse.json();
            
            if (!createData.success) {
                alert(createData.error || 'Ошибка создания сделки');
                return;
            }
            
            // Теперь принимаем сделку с выбором
            const acceptResponse = await fetch(`${this.supabaseUrl}/rest/v1/rpc/accept_deal`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`
                },
                body: JSON.stringify({
                    deal_id: createData.deal_id,
                    user_id: this.currentUser.id,
                    choice: choice
                })
            });
            
            const acceptData = await acceptResponse.json();
            
            if (acceptData.success) {
                this.closeModal();
                this.loadPlayers();
                this.loadDeals();
                
                if (acceptData.result) {
                    const coins = choice === 'cooperate' ? 
                        (acceptData.result.from_coins || acceptData.result.to_coins) : 
                        (this.currentUser.id === this.currentModalTarget.id ? 
                         acceptData.result.from_coins : acceptData.result.to_coins);
                    
                    alert(`Сделка завершена! Вы получили ${coins} монет.`);
                } else {
                    alert('Ваш выбор сохранён. Ожидаем ответа от другого игрока.');
                }
            } else {
                alert(acceptData.error || 'Ошибка принятия сделки');
            }
            
        } catch (error) {
            alert('Ошибка сети');
        }
        
        this.updateLastActionTime();
    }
    
    async loadDeals() {
        if (!this.currentUser) return;
        
        const incomingDeals = document.getElementById('incoming-deals');
        const outgoingDeals = document.getElementById('outgoing-deals');
        
        incomingDeals.innerHTML = '<p style="color: #666;">Загрузка входящих сделок...</p>';
        outgoingDeals.innerHTML = '<p style="color: #666;">Загрузка исходящих сделок...</p>';
        
        try {
            const response = await fetch(`${this.supabaseUrl}/rest/v1/rpc/get_user_deals`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`
                },
                body: JSON.stringify({ user_id: this.currentUser.id })
            });
            
            const data = await response.json();
            
            // Входящие сделки
            if (data.incoming && data.incoming.length > 0) {
                let html = '';
                data.incoming.forEach(deal => {
                    const minutesAgo = Math.floor(deal.time_ago);
                    html += `
                    <div class="player-card">
                        <div class="color-indicator" style="background-color: ${this.colorMap[deal.display_color] || '#cccccc'};"></div>
                        <div class="player-info">
                            <div class="player-name">Игрок</div>
                            <div class="deal-counters">
                                <span>Предложил ${minutesAgo} мин назад</span>
                            </div>
                        </div>
                        <button class="deal-btn" data-deal-id="${deal.id}">
                            Принять
                        </button>
                    </div>
                    `;
                });
                incomingDeals.innerHTML = html;
                
                // Обработчики для принятия входящих сделок
                document.querySelectorAll('#incoming-deals .deal-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const dealId = e.target.dataset.dealId;
                        this.openIncomingDealModal(dealId);
                    });
                });
            } else {
                incomingDeals.innerHTML = '<p style="color: #666;">Нет входящих сделок</p>';
            }
            
            // Исходящие сделки
            if (data.outgoing && data.outgoing.length > 0) {
                let html = '';
                data.outgoing.forEach(deal => {
                    const minutesAgo = Math.floor(deal.time_ago);
                    html += `
                    <div class="player-card">
                        <div class="color-indicator" style="background-color: ${this.colorMap[deal.display_color] || '#cccccc'};"></div>
                        <div class="player-info">
                            <div class="player-name">Игрок</div>
                            <div class="deal-counters">
                                <span>Ожидает ${minutesAgo} мин</span>
                            </div>
                        </div>
                        <button class="deal-btn" disabled>
                            Ожидание
                        </button>
                    </div>
                    `;
                });
                outgoingDeals.innerHTML = html;
            } else {
                outgoingDeals.innerHTML = '<p style="color: #666;">Нет исходящих сделок</p>';
            }
        } catch (error) {
            incomingDeals.innerHTML = '<p style="color: #666;">Ошибка загрузки</p>';
            outgoingDeals.innerHTML = '<p style="color: #666;">Ошибка загрузки</p>';
        }
    }
    
    async openIncomingDealModal(dealId) {
        // TODO: Реализовать модальное окно для входящих сделок
        alert('Принятие входящих сделок будет реализовано в следующей версии');
    }
    
    async loadRating() {
        const ratingList = document.getElementById('rating-list');
        ratingList.innerHTML = '<p style="text-align: center; color: #666;">Загрузка рейтинга...</p>';
        
        try {
            const response = await fetch(`${this.supabaseUrl}/rest/v1/rpc/get_rating`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`
                },
                body: JSON.stringify({ limit_count: 50 })
            });
            
            const data = await response.json();
            
            if (data.rating && data.rating.length > 0) {
                let html = '<ol style="list-style-position: inside; padding-left: 0;">';
                data.rating.forEach((player, index) => {
                    html += `
                    <li style="margin-bottom: 12px; padding: 12px; background: #f9f9f9; border-radius: 8px;">
                        <strong>${player.first_name} ${player.last_name}</strong> (${player.class})<br>
                        Монеты: ${player.coins} | Сделок: ${player.deals}
                    </li>
                    `;
                });
                html += '</ol>';
                ratingList.innerHTML = html;
            } else {
                ratingList.innerHTML = '<p style="text-align: center; color: #666;">Рейтинг пуст</p>';
            }
        } catch (error) {
            ratingList.innerHTML = '<p style="text-align: center; color: #666;">Ошибка загрузки рейтинга</p>';
        }
    }
    
    async buyBounty() {
        if (!this.currentUser || !this.canPerformAction()) return;
        
        if (confirm('Купить шоколадку "Baunty" за 50 монет?')) {
            try {
                const response = await fetch(`${this.supabaseUrl}/rest/v1/rpc/purchase_item`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': this.supabaseKey,
                        'Authorization': `Bearer ${this.supabaseKey}`
                    },
                    body: JSON.stringify({
                        user_id: this.currentUser.id,
                        item_name: 'Baunty',
                        item_price: 50
                    })
                });
                
                const data = await response.json();
                if (data.success) {
                    alert('Покупка совершена! Админ выдаст шоколадку в ближайшее время.');
                } else {
                    alert('Ошибка при покупке: ' + (data.error || 'неизвестная ошибка'));
                }
            } catch (error) {
                alert('Ошибка сети');
            }
            
            this.updateLastActionTime();
        }
    }
    
    closeModal() {
        document.getElementById('modal-overlay').style.display = 'none';
        document.getElementById('deal-modal').style.display = 'none';
        this.currentModalTarget = null;
    }
    
    canPerformAction() {
        const now = Date.now();
        if (now - this.lastActionTime < 2000) {
            alert('Подождите 2 секунды перед следующим действием');
            return false;
        }
        return true;
    }
    
    updateLastActionTime() {
        this.lastActionTime = Date.now();
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.game = new TrustEvolutionGame();
    window.game.init();
});