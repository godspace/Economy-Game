class PrisonersDilemmaGame {
    constructor() {
        this.player = null;
        this.availablePlayers = [];
        this.currentDeal = null;
        this.refreshInterval = null;
        this.connectionCheckInterval = null;
        
        this.init();
    }
    
    async init() {
        // Проверяем сессию
        this.player = await checkSession();
        if (!this.player) {
            window.location.href = 'index.html';
            return;
        }
        
        this.setupUI();
        this.loadPlayerData();
        this.startAutoRefresh();
        this.setupEventListeners();
        this.startConnectionCheck();
    }
    
    setupUI() {
        // Обновляем имя игрока
        document.getElementById('playerName').textContent = 'Тайный Санта';
        
        // Устанавливаем новогоднюю тему
        document.body.classList.add('game-page');
        
        // Добавляем снежинки
        this.createSnowflakes();
    }
    
    async loadPlayerData() {
        try {
            // Загружаем баланс и историю
            const { data: playerData } = await supabase
                .from('players')
                .select('coins, total_deals')
                .eq('id', this.player.id)
                .single();
            
            if (playerData) {
                this.updateCoinDisplay(playerData.coins);
                document.getElementById('totalDeals').textContent = playerData.total_deals;
            }
            
            // Загружаем доступных игроков
            await this.loadAvailablePlayers();
            
        } catch (error) {
            console.error('Error loading player data:', error);
        }
    }
    
    async loadAvailablePlayers() {
        // Загружаем видимых игроков, кроме себя
        const { data: players } = await supabase
            .from('players')
            .select('id, coins, total_deals, last_active')
            .eq('visible', true)
            .neq('id', this.player.id)
            .gt('last_active', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Активны последние 5 минут
            .limit(20);
        
        this.availablePlayers = players || [];
        this.updatePlayersList();
    }
    
    updatePlayersList() {
        const container = document.getElementById('playersList');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.availablePlayers.forEach(player => {
            const playerEl = document.createElement('div');
            playerEl.className = 'player-item';
            playerEl.innerHTML = `
                <div class="player-info">
                    <span class="player-name">Тайный Санта</span>
                    <span class="player-coins">${player.coins} монет</span>
                </div>
                <button class="btn-deal" data-id="${player.id}" 
                        ${this.canDealWith(player.id) ? '' : 'disabled'}>
                    ${this.canDealWith(player.id) ? 'Предложить сделку' : 'Лимит сделок'}
                </button>
            `;
            container.appendChild(playerEl);
        });
        
        // Добавляем обработчики для кнопок сделок
        container.querySelectorAll('.btn-deal').forEach(btn => {
            btn.addEventListener('click', (e) => this.startDeal(e.target.dataset.id));
        });
    }
    
    async canDealWith(partnerId) {
        // Проверяем ограничение в 5 сделок
        const { data: outgoingCount } = await supabase
            .from('deal_limits')
            .select('deal_count')
            .eq('player_id', this.player.id)
            .eq('partner_id', partnerId)
            .eq('direction', 'outgoing')
            .single();
        
        const { data: incomingCount } = await supabase
            .from('deal_limits')
            .select('deal_count')
            .eq('player_id', this.player.id)
            .eq('partner_id', partnerId)
            .eq('direction', 'incoming')
            .single();
        
        const totalWithPlayer = (outgoingCount?.deal_count || 0) + (incomingCount?.deal_count || 0);
        return totalWithPlayer < 5;
    }
    
    async startDeal(partnerId) {
        if (isRateLimited()) {
            this.showNotification('Подождите немного перед следующей сделкой');
            return;
        }
        
        if (this.currentDeal) {
            this.showNotification('У вас уже есть активная сделка');
            return;
        }
        
        // Проверяем, может ли партнер заключить сделку
        const canPartnerDeal = await this.checkPartnerAvailability(partnerId);
        if (!canPartnerDeal) {
            this.showNotification('Этот игрок не может заключить сделку сейчас');
            return;
        }
        
        this.currentDeal = {
            partnerId,
            partnerChoice: null,
            myChoice: null,
            result: null
        };
        
        this.showDealInterface();
    }
    
    async checkPartnerAvailability(partnerId) {
        // Проверяем активность партнера
        const { data: partner } = await supabase
            .from('players')
            .select('last_active')
            .eq('id', partnerId)
            .single();
        
        if (!partner || new Date(partner.last_active) < new Date(Date.now() - 2 * 60 * 1000)) {
            return false;
        }
        
        // Проверяем лимиты партнера
        const { data: partnerOutgoingCount } = await supabase
            .from('deal_limits')
            .select('deal_count')
            .eq('player_id', partnerId)
            .eq('partner_id', this.player.id)
            .eq('direction', 'outgoing')
            .single();
        
        const partnerTotal = (partnerOutgoingCount?.deal_count || 0);
        return partnerTotal < 5;
    }
    
    showDealInterface() {
        const dealInterface = document.getElementById('dealInterface');
        if (dealInterface) {
            dealInterface.style.display = 'block';
            dealInterface.innerHTML = `
                <h3>Примите решение</h3>
                <p>Вы заключаете сделку с Тайным Сантой</p>
                <p>Ваш выбор останется анонимным</p>
                
                <div class="choice-buttons">
                    <button class="btn-cooperate" onclick="game.makeChoice('cooperate')">
                        <i class="fas fa-handshake"></i> Сотрудничать
                    </button>
                    <button class="btn-cheat" onclick="game.makeChoice('cheat')">
                        <i class="fas fa-user-secret"></i> Жульничать
                    </button>
                </div>
                
                <div class="deal-timer">
                    <div class="timer-bar"></div>
                    <p>Осталось времени: <span class="timer-count">30</span> сек.</p>
                </div>
            `;
            
            this.startDealTimer();
        }
    }
    
    startDealTimer() {
        let timeLeft = 30;
        const timerCount = document.querySelector('.timer-count');
        const timerBar = document.querySelector('.timer-bar');
        
        const timer = setInterval(() => {
            timeLeft--;
            if (timerCount) timerCount.textContent = timeLeft;
            if (timerBar) {
                timerBar.style.width = `${(timeLeft / 30) * 100}%`;
                timerBar.style.background = timeLeft > 10 ? 
                    'linear-gradient(90deg, #4CAF50, #2E7D32)' :
                    'linear-gradient(90deg, #f44336, #c62828)';
            }
            
            if (timeLeft <= 0) {
                clearInterval(timer);
                this.makeChoice('cheat'); // Автоматический выбор при истечении времени
            }
        }, 1000);
        
        this.dealTimer = timer;
    }
    
    async makeChoice(choice) {
        if (!this.currentDeal || this.currentDeal.myChoice) {
            return;
        }
        
        if (isRateLimited()) {
            return;
        }
        
        // Записываем наш выбор
        this.currentDeal.myChoice = choice;
        
        // Создаем запись о сделке в базе данных
        const { data: deal, error } = await supabase
            .from('deals')
            .insert({
                player1_id: this.player.id,
                player2_id: this.currentDeal.partnerId,
                player1_choice: choice,
                is_anonymous: true
            })
            .select()
            .single();
        
        if (error) {
            console.error('Error creating deal:', error);
            this.showNotification('Ошибка при создании сделки');
            this.resetDeal();
            return;
        }
        
        this.currentDeal.dealId = deal.id;
        
        // Показываем ожидание выбора партнера
        this.showWaitingForPartner();
        
        // Запускаем проверку результата
        this.checkDealResult(deal.id);
    }
    
    async checkDealResult(dealId) {
        const checkInterval = setInterval(async () => {
            const { data: deal } = await supabase
                .from('deals')
                .select('*')
                .eq('id', dealId)
                .single();
            
            if (deal && deal.player2_choice) {
                clearInterval(checkInterval);
                await this.processDealResult(deal);
            }
        }, 2000); // Проверяем каждые 2 секунды
        
        // Таймаут 60 секунд
        setTimeout(() => {
            clearInterval(checkInterval);
            if (this.currentDeal?.dealId === dealId) {
                this.resolveTimeoutDeal(dealId);
            }
        }, 60000);
    }
    
    async processDealResult(deal) {
        // Вычисляем результат
        let player1Change = 0;
        let player2Change = 0;
        
        if (deal.player1_choice === 'cooperate' && deal.player2_choice === 'cooperate') {
            player1Change = 2;
            player2Change = 2;
        } else if (deal.player1_choice === 'cheat' && deal.player2_choice === 'cheat') {
            player1Change = -1;
            player2Change = -1;
        } else if (deal.player1_choice === 'cooperate' && deal.player2_choice === 'cheat') {
            player1Change = -1;
            player2Change = 3;
        } else if (deal.player1_choice === 'cheat' && deal.player2_choice === 'cooperate') {
            player1Change = 3;
            player2Change = -1;
        }
        
        // Обновляем балансы
        await this.updateBalances(deal, player1Change, player2Change);
        
        // Обновляем лимиты сделок
        await this.updateDealLimits(deal);
        
        // Показываем результат
        this.showDealResult(player1Change, player2Change, deal.player2_choice);
        
        // Обновляем данные игрока
        this.loadPlayerData();
    }
    
    async updateBalances(deal, player1Change, player2Change) {
        const oldCoins = this.player.coins;
        
        // Атомарное обновление балансов через транзакцию
        const { data: updatedPlayer } = await supabase
            .from('players')
            .update({ 
                coins: this.player.coins + player1Change,
                total_deals: this.player.total_deals + 1
            })
            .eq('id', this.player.id)
            .select()
            .single();
        
        await supabase
            .from('players')
            .update({ 
                coins: this.player.coins + player2Change,
                total_deals: this.player.total_deals + 1
            })
            .eq('id', deal.player2_id);
        
        // Обновляем данные о сделке
        await supabase
            .from('deals')
            .update({
                player1_coins_change: player1Change,
                player2_coins_change: player2Change
            })
            .eq('id', deal.id);
        
        // Логируем изменение баланса
        await logAuditAction(
            this.player.id,
            'deal_completed',
            oldCoins,
            oldCoins + player1Change
        );
        
        if (updatedPlayer) {
            this.player = updatedPlayer;
        }
    }
    
    async updateDealLimits(deal) {
        // Обновляем счетчик исходящих сделок
        await supabase
            .from('deal_limits')
            .upsert({
                player_id: deal.player1_id,
                partner_id: deal.player2_id,
                direction: 'outgoing',
                deal_count: 1,
                last_deal: new Date().toISOString()
            }, {
                onConflict: 'player_id,partner_id,direction',
                ignoreDuplicates: false
            })
            .select();
        
        // Увеличиваем счетчик
        await supabase.rpc('increment_deal_count', {
            p_player_id: deal.player1_id,
            p_partner_id: deal.player2_id,
            p_direction: 'outgoing'
        });
        
        // Аналогично для входящих сделок партнера
        await supabase.rpc('increment_deal_count', {
            p_player_id: deal.player2_id,
            p_partner_id: deal.player1_id,
            p_direction: 'incoming'
        });
    }
    
    showDealResult(myChange, partnerChange, partnerChoice) {
        const resultHtml = `
            <div class="result-display">
                <h4>Результат сделки:</h4>
                <p>Вы ${myChange >= 0 ? 'получили' : 'потеряли'} <strong>${Math.abs(myChange)}</strong> монет</p>
                <p>Тайный Санта ${partnerChange >= 0 ? 'получил' : 'потерял'} <strong>${Math.abs(partnerChange)}</strong> монет</p>
                <p>Выбор партнера: <strong>${partnerChoice === 'cooperate' ? 'Сотрудничал' : 'Жульничал'}</strong></p>
                <button onclick="game.resetDeal()" class="btn-continue">
                    Продолжить игру
                </button>
            </div>
        `;
        
        const dealInterface = document.getElementById('dealInterface');
        if (dealInterface) {
            dealInterface.innerHTML = resultHtml;
        }
    }
    
    showWaitingForPartner() {
        const dealInterface = document.getElementById('dealInterface');
        if (dealInterface) {
            dealInterface.innerHTML = `
                <div class="waiting-message">
                    <div class="spinner-small">
                        <div class="snowflake-spin">❄</div>
                    </div>
                    <h3>Ожидаем решение партнера...</h3>
                    <p>Тайный Санта принимает решение</p>
                    <p>Это может занять некоторое время</p>
                </div>
            `;
        }
    }
    
    async resolveTimeoutDeal(dealId) {
        // Если партнер не ответил, считаем что он жульничал
        const { data: deal } = await supabase
            .from('deals')
            .select('*')
            .eq('id', dealId)
            .single();
        
        if (deal && !deal.player2_choice) {
            // Партнер не ответил - автоматически жульничает
            await supabase
                .from('deals')
                .update({ player2_choice: 'cheat' })
                .eq('id', dealId);
            
            // Обрабатываем результат
            await this.processDealResult({
                ...deal,
                player2_choice: 'cheat'
            });
        }
    }
    
    resetDeal() {
        this.currentDeal = null;
        const dealInterface = document.getElementById('dealInterface');
        if (dealInterface) {
            dealInterface.style.display = 'none';
            dealInterface.innerHTML = '';
        }
        
        if (this.dealTimer) {
            clearInterval(this.dealTimer);
        }
    }
    
    updateCoinDisplay(coins) {
        const coinDisplay = document.getElementById('coinDisplay');
        if (coinDisplay) {
            coinDisplay.textContent = coins;
            
            // Анимация изменения баланса
            coinDisplay.classList.remove('coin-change');
            setTimeout(() => {
                coinDisplay.classList.add('coin-change');
            }, 10);
        }
    }
    
    showNotification(message, type = 'info') {
        // Создаем уведомление
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        // Анимация появления
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Удаляем через 5 секунд
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }
    
    startAutoRefresh() {
        // Обновляем список игроков каждые 30 секунд
        this.refreshInterval = setInterval(() => {
            this.loadAvailablePlayers();
        }, 30000);
    }
    
    startConnectionCheck() {
        // Проверяем соединение каждую минуту
        this.connectionCheckInterval = setInterval(async () => {
            try {
                await supabase.from('players').select('id').limit(1);
                // Обновляем активность игрока
                await supabase
                    .from('players')
                    .update({ last_active: new Date().toISOString() })
                    .eq('id', this.player.id);
            } catch (error) {
                this.showNotification('Потеряно соединение с сервером', 'error');
            }
        }, 60000);
    }
    
    createSnowflakes() {
        const snowflakes = document.createElement('div');
        snowflakes.className = 'snowflakes';
        snowflakes.setAttribute('aria-hidden', 'true');
        
        for (let i = 0; i < 15; i++) {
            const snowflake = document.createElement('div');
            snowflake.className = 'snowflake';
            snowflake.textContent = '❄';
            snowflake.style.left = `${Math.random() * 100}%`;
            snowflake.style.animationDelay = `${Math.random() * 5}s`;
            snowflake.style.animationDuration = `${5 + Math.random() * 10}s`;
            snowflake.style.opacity = `${0.3 + Math.random() * 0.7}`;
            snowflake.style.fontSize = `${10 + Math.random() * 20}px`;
            snowflakes.appendChild(snowflake);
        }
        
        document.body.appendChild(snowflakes);
    }
    
    setupEventListeners() {
        // Кнопка выхода
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('session_token');
                window.location.href = 'index.html';
            });
        }
        
        // Обработка закрытия страницы
        window.addEventListener('beforeunload', () => {
            // Помечаем игрока как невидимого при выходе
            supabase
                .from('players')
                .update({ visible: false })
                .eq('id', this.player.id)
                .then();
        });
    }
}

// Инициализация игры при загрузке страницы
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new PrisonersDilemmaGame();
});

// Экспортируем для глобального доступа
window.game = game;