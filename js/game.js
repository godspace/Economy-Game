class GameManager {
    constructor() {
        this.player = null;
        this.supabase = window.gameSupabase;
        this.colors = [
            'color-red', 'color-pink', 'color-purple', 'color-deep-purple',
            'color-indigo', 'color-blue', 'color-light-blue', 'color-cyan',
            'color-teal', 'color-green', 'color-light-green', 'color-lime',
            'color-yellow', 'color-amber', 'color-orange', 'color-deep-orange',
            'color-brown', 'color-grey', 'color-blue-grey'
        ];
        this.playerColors = new Map();
        
        this.init();
    }
    
    async init() {
        this.loadPlayerFromStorage();
        
        if (!this.player) {
            window.location.href = 'index.html';
            return;
        }
        
        this.setupEventListeners();
        await this.loadAllData();
        this.startAutoRefresh();
    }
    
    loadPlayerFromStorage() {
        const playerData = sessionStorage.getItem('player');
        if (playerData) {
            this.player = JSON.parse(playerData);
        }
    }
    
    setupEventListeners() {
        // Переключение вкладок
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e));
        });
        
        // Переключение вкладок сделок
        document.querySelectorAll('.deals-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchDealsTab(e));
        });
        
        // Поиск игроков
        document.getElementById('searchPlayers').addEventListener('input', (e) => {
            this.filterPlayers(e.target.value);
        });
        
        // Модальное окно
        document.querySelector('.modal-close').addEventListener('click', () => {
            this.hideModal();
        });
        
        document.getElementById('cancelDealBtn').addEventListener('click', () => {
            this.hideModal();
        });
        
        // Кнопки выбора
        document.querySelectorAll('.choice-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const choice = e.target.closest('.choice-btn').dataset.choice;
                this.makeDealChoice(choice);
            });
        });
        
        // Кнопка выхода
        document.getElementById('logoutBtn').addEventListener('click', () => {
            sessionStorage.removeItem('player');
            window.location.href = 'index.html';
        });
    }
    
    async loadAllData() {
        await Promise.all([
            this.loadPlayersList(),
            this.loadPendingDeals(),
            this.loadDealsHistory(),
            this.updatePlayerStats()
        ]);
    }
    
    async loadPlayersList() {
        try {
            const { data: players, error } = await this.supabase
                .from('players')
                .select('id, code, balance, is_visible, last_login')
                .eq('is_visible', true)
                .neq('code', this.player.code)
                .order('last_login', { ascending: false });
            
            if (error) throw error;
            
            this.displayPlayersList(players || []);
            document.getElementById('playersCount').textContent = players?.length || 0;
            
        } catch (error) {
            console.error('Error loading players:', error);
        }
    }
    
    async loadPendingDeals() {
        try {
            // Входящие сделки
            const { data: incomingDeals, error: incomingError } = await this.supabase
                .from('deals')
                .select(`
                    id,
                    initiator:players!deals_initiator_id_fkey(code, balance),
                    target:players!deals_target_id_fkey(code, balance),
                    created_at
                `)
                .eq('target_id', this.player.id)
                .eq('status', 'pending');
            
            // Исходящие сделки
            const { data: outgoingDeals, error: outgoingError } = await this.supabase
                .from('deals')
                .select(`
                    id,
                    initiator:players!deals_initiator_id_fkey(code, balance),
                    target:players!deals_target_id_fkey(code, balance),
                    created_at
                `)
                .eq('initiator_id', this.player.id)
                .eq('status', 'pending');
            
            if (incomingError || outgoingError) throw incomingError || outgoingError;
            
            this.displayIncomingDeals(incomingDeals || []);
            this.displayOutgoingDeals(outgoingDeals || []);
            
            document.getElementById('pendingDealsCount').textContent = 
                (incomingDeals?.length || 0) + (outgoingDeals?.length || 0);
            document.getElementById('incomingDealsCount').textContent = incomingDeals?.length || 0;
            document.getElementById('outgoingDealsCount').textContent = outgoingDeals?.length || 0;
            
        } catch (error) {
            console.error('Error loading deals:', error);
        }
    }
    
    async loadDealsHistory() {
        try {
            const { data: history, error } = await this.supabase
                .from('deal_history')
                .select(`
                    *,
                    player1:players!deal_history_player1_id_fkey(code),
                    player2:players!deal_history_player2_id_fkey(code)
                `)
                .or(`player1_id.eq.${this.player.id},player2_id.eq.${this.player.id}`)
                .order('completed_at', { ascending: false })
                .limit(20);
            
            if (error) throw error;
            
            this.displayDealsHistory(history || []);
            
        } catch (error) {
            console.error('Error loading deals history:', error);
        }
    }
    
    async updatePlayerStats() {
        try {
            // Подсчитываем общую статистику
            const { data: history, error } = await this.supabase
                .from('deal_history')
                .select('player1_result, player2_result')
                .or(`player1_id.eq.${this.player.id},player2_id.eq.${this.player.id}`);
            
            if (error) throw error;
            
            let totalProfit = 0;
            let totalDeals = history?.length || 0;
            
            history?.forEach(deal => {
                if (deal.player1_id === this.player.id) {
                    totalProfit += deal.player1_result || 0;
                } else {
                    totalProfit += deal.player2_result || 0;
                }
            });
            
            document.getElementById('totalDeals').textContent = totalDeals;
            document.getElementById('totalProfit').textContent = totalProfit;
            
        } catch (error) {
            console.error('Error updating player stats:', error);
        }
    }
    
    displayPlayersList(players) {
        const container = document.getElementById('playersList');
        
        if (!players.length) {
            container.innerHTML = '<div class="empty-state">Нет других игроков</div>';
            return;
        }
        
        container.innerHTML = players.map(player => {
            const colorClass = this.getPlayerColor(player.code);
            const colorIndex = this.colors.indexOf(colorClass);
            const playerNumber = colorIndex + 1;
            
            return `
                <div class="player-item" data-player-code="${player.code}">
                    <div class="player-color-badge ${colorClass}">
                        ${playerNumber}
                    </div>
                    <div class="player-info">
                        <h4>Игрок ${playerNumber}</h4>
                        <div class="player-deal-stats">
                            <div class="deal-stat">
                                Входящих: <span class="count" id="incoming-${player.code}">0/5</span>
                            </div>
                            <div class="deal-stat">
                                Исходящих: <span class="count" id="outgoing-${player.code}">0/5</span>
                            </div>
                        </div>
                        <div class="player-balance">Баланс: ${player.balance || 0} 🪙</div>
                    </div>
                    <button class="deal-btn" data-target="${player.code}">
                        Сделка
                    </button>
                </div>
            `;
        }).join('');
        
        // Добавляем обработчики для кнопок сделок
        container.querySelectorAll('.deal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetCode = e.target.dataset.target;
                this.showDealModal(targetCode, 'create');
            });
        });
        
        // Добавляем обработчики для клика по игроку
        container.querySelectorAll('.player-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.deal-btn')) {
                    const playerCode = e.currentTarget.dataset.playerCode;
                    this.showDealModal(playerCode, 'view');
                }
            });
        });
        
        // Загружаем статистику для каждого игрока
        players.forEach(player => {
            this.loadDealStats(player.code);
        });
    }
    
    displayIncomingDeals(deals) {
        const container = document.getElementById('incoming-deals');
        
        if (!deals.length) {
            container.innerHTML = '<div class="empty-state">Нет входящих сделок</div>';
            return;
        }
        
        container.innerHTML = deals.map(deal => {
            const initiatorCode = deal.initiator.code;
            const colorClass = this.getPlayerColor(initiatorCode);
            const playerNumber = this.colors.indexOf(colorClass) + 1;
            
            return `
                <div class="deal-item pending" data-deal-id="${deal.id}">
                    <div class="deal-header">
                        <div class="deal-player">
                            <div class="color-badge ${colorClass}">${playerNumber}</div>
                            <div>
                                <h4>Игрок ${playerNumber}</h4>
                                <div class="deal-time">${new Date(deal.created_at).toLocaleString()}</div>
                            </div>
                        </div>
                        <div class="deal-actions">
                            <button class="btn-accept" data-deal-id="${deal.id}">
                                Принять
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Добавляем обработчики для кнопок
        container.querySelectorAll('.btn-accept').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dealId = e.target.dataset.dealId;
                this.showDealModal(null, 'respond', dealId);
            });
        });
    }
    
    displayOutgoingDeals(deals) {
        const container = document.getElementById('outgoing-deals');
        
        if (!deals.length) {
            container.innerHTML = '<div class="empty-state">Нет исходящих сделок</div>';
            return;
        }
        
        container.innerHTML = deals.map(deal => {
            const targetCode = deal.target.code;
            const colorClass = this.getPlayerColor(targetCode);
            const playerNumber = this.colors.indexOf(colorClass) + 1;
            
            return `
                <div class="deal-item pending" data-deal-id="${deal.id}">
                    <div class="deal-header">
                        <div class="deal-player">
                            <div class="color-badge ${colorClass}">${playerNumber}</div>
                            <div>
                                <h4>Игрок ${playerNumber}</h4>
                                <div class="deal-time">${new Date(deal.created_at).toLocaleString()}</div>
                            </div>
                        </div>
                        <div class="deal-status">
                            Ожидание ответа...
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    displayDealsHistory(history) {
        const container = document.getElementById('deals-history');
        
        if (!history.length) {
            container.innerHTML = '<div class="empty-state">История сделок пуста</div>';
            return;
        }
        
        container.innerHTML = history.map(deal => {
            const isPlayer1 = deal.player1_id === this.player.id;
            const opponentCode = isPlayer1 ? deal.player2.code : deal.player1.code;
            const playerChoice = isPlayer1 ? deal.player1_choice : deal.player2_choice;
            const opponentChoice = isPlayer1 ? deal.player2_choice : deal.player1_choice;
            const playerResult = isPlayer1 ? deal.player1_result : deal.player2_result;
            const opponentResult = isPlayer1 ? deal.player2_result : deal.player1_result;
            
            const colorClass = this.getPlayerColor(opponentCode);
            const playerNumber = this.colors.indexOf(colorClass) + 1;
            
            return `
                <div class="deal-item completed">
                    <div class="deal-header">
                        <div class="deal-player">
                            <div class="color-badge ${colorClass}">${playerNumber}</div>
                            <div>
                                <h4>Игрок ${playerNumber}</h4>
                                <div class="deal-time">${new Date(deal.completed_at).toLocaleString()}</div>
                            </div>
                        </div>
                        <div class="deal-result">
                            <div class="history-choices">
                                <span class="history-choice ${playerChoice}">
                                    Вы: ${playerChoice === 'cooperate' ? '🤝' : '🎭'}
                                </span>
                                <span class="history-choice ${opponentChoice}">
                                    Он: ${opponentChoice === 'cooperate' ? '🤝' : '🎭'}
                                </span>
                            </div>
                            <div class="history-result ${playerResult > 0 ? 'positive' : 'negative'}">
                                Ваш результат: ${playerResult > 0 ? '+' : ''}${playerResult}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    async loadDealStats(targetCode) {
        try {
            const { data: stats, error } = await this.supabase.rpc('get_deal_stats', {
                player1_code_param: this.player.code,
                player2_code_param: targetCode
            });
            
            if (error) throw error;
            
            document.getElementById(`incoming-${targetCode}`).textContent = 
                `${stats.incoming_count}/5`;
            document.getElementById(`outgoing-${targetCode}`).textContent = 
                `${stats.outgoing_count}/5`;
                
        } catch (error) {
            console.error('Error loading deal stats:', error);
        }
    }
    
    getPlayerColor(playerCode) {
        if (!this.playerColors.has(playerCode)) {
            // Генерируем детерминированный цвет на основе кода игрока
            const hash = playerCode.split('').reduce((acc, char) => {
                return acc + char.charCodeAt(0);
            }, 0);
            
            const colorIndex = hash % this.colors.length;
            this.playerColors.set(playerCode, this.colors[colorIndex]);
        }
        
        return this.playerColors.get(playerCode);
    }
    
    async showDealModal(targetCode, mode, dealId = null) {
        this.currentDeal = {
            targetCode,
            mode,
            dealId
        };
        
        const modal = document.getElementById('dealModal');
        const modalTitle = document.getElementById('modalTitle');
        const playerColorBadge = document.getElementById('playerColorBadge');
        
        if (mode === 'create') {
            modalTitle.textContent = 'Предложить сделку';
            
            // Проверяем лимит сделок
            const { data: stats, error } = await this.supabase.rpc('get_deal_stats', {
                player1_code_param: this.player.code,
                player2_code_param: targetCode
            });
            
            if (stats.incoming_count + stats.outgoing_count >= 10) {
                alert('Лимит сделок с этим игроком исчерпан (максимум 10 сделок)');
                return;
            }
        } else if (mode === 'respond') {
            modalTitle.textContent = 'Ответить на сделку';
        } else {
            modalTitle.textContent = 'История сделок';
        }
        
        // Устанавливаем цвет игрока
        const colorClass = this.getPlayerColor(targetCode);
        const playerNumber = this.colors.indexOf(colorClass) + 1;
        playerColorBadge.className = `color-badge ${colorClass}`;
        playerColorBadge.textContent = playerNumber;
        
        // Загружаем статистику
        await this.loadModalStats(targetCode);
        
        // Загружаем историю сделок
        await this.loadDealHistory(targetCode);
        
        modal.classList.add('active');
    }
    
    hideModal() {
        document.getElementById('dealModal').classList.remove('active');
        this.currentDeal = null;
    }
    
    async loadModalStats(targetCode) {
        try {
            const { data: stats, error } = await this.supabase.rpc('get_deal_stats', {
                player1_code_param: this.player.code,
                player2_code_param: targetCode
            });
            
            if (error) throw error;
            
            document.getElementById('incomingDealsStat').textContent = 
                `${stats.incoming_count}/5`;
            document.getElementById('outgoingDealsStat').textContent = 
                `${stats.outgoing_count}/5`;
                
        } catch (error) {
            console.error('Error loading modal stats:', error);
        }
    }
    
    async loadDealHistory(targetCode) {
        try {
            const { data: stats, error } = await this.supabase.rpc('get_deal_stats', {
                player1_code_param: this.player.code,
                player2_code_param: targetCode
            });
            
            if (error) throw error;
            
            const historyList = document.getElementById('dealHistoryList');
            
            if (!stats.history || stats.history.length === 0) {
                historyList.innerHTML = '<div class="empty-state">Нет истории сделок</div>';
                return;
            }
            
            historyList.innerHTML = stats.history.map(deal => `
                <div class="history-item">
                    <div class="history-choices">
                        <span class="history-choice ${deal.player1_choice}">
                            ${deal.player1_choice === 'cooperate' ? '🤝' : '🎭'}
                        </span>
                        <span class="history-choice ${deal.player2_choice}">
                            ${deal.player2_choice === 'cooperate' ? '🤝' : '🎭'}
                        </span>
                    </div>
                    <div class="history-result ${deal.player1_result > 0 ? 'positive' : 'negative'}">
                        ${deal.player1_result > 0 ? '+' : ''}${deal.player1_result}
                    </div>
                </div>
            `).join('');
            
        } catch (error) {
            console.error('Error loading deal history:', error);
        }
    }
    
    async makeDealChoice(choice) {
        if (!this.currentDeal) return;
        
        try {
            let result;
            
            if (this.currentDeal.mode === 'create') {
                // Создаем новую сделку
                const { data: createResult, error: createError } = await this.supabase.rpc(
                    'create_deal',
                    {
                        initiator_code_param: this.player.code,
                        target_code_param: this.currentDeal.targetCode
                    }
                );
                
                if (createError) throw createError;
                
                if (!createResult.success) {
                    alert(createResult.error);
                    this.hideModal();
                    return;
                }
                
                // Делаем выбор как инициатор
                const { data: choiceResult, error: choiceError } = await this.supabase.rpc(
                    'make_choice',
                    {
                        deal_id_param: createResult.deal_id,
                        player_code_param: this.player.code,
                        choice_param: choice
                    }
                );
                
                if (choiceError) throw choiceError;
                result = choiceResult;
                
            } else if (this.currentDeal.mode === 'respond') {
                // Отвечаем на сделку
                const { data: choiceResult, error: choiceError } = await this.supabase.rpc(
                    'make_choice',
                    {
                        deal_id_param: this.currentDeal.dealId,
                        player_code_param: this.player.code,
                        choice_param: choice
                    }
                );
                
                if (choiceError) throw choiceError;
                result = choiceResult;
            }
            
            if (result.completed) {
                alert(`Сделка завершена! Ваш результат: ${result.result_initiator > 0 ? '+' : ''}${result.result_initiator}`);
                this.updatePlayerBalance();
            } else {
                alert('Ждем выбора второго игрока...');
            }
            
            this.hideModal();
            await this.loadAllData();
            
        } catch (error) {
            console.error('Error making deal choice:', error);
            alert('Ошибка при обработке сделки: ' + error.message);
        }
    }
    
    async updatePlayerBalance() {
        try {
            // Обновляем баланс в sessionStorage
            const { data: playerData, error } = await this.supabase
                .from('players')
                .select('balance')
                .eq('code', this.player.code)
                .single();
            
            if (!error && playerData) {
                this.player.balance = playerData.balance;
                sessionStorage.setItem('player', JSON.stringify(this.player));
                document.getElementById('balanceValue').textContent = this.player.balance;
            }
        } catch (error) {
            console.error('Error updating balance:', error);
        }
    }
    
    switchTab(e) {
        const tabName = e.currentTarget.dataset.tab;
        
        // Обновляем активные кнопки
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        e.currentTarget.classList.add('active');
        
        // Обновляем активные вкладки
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }
    
    switchDealsTab(e) {
        const dealType = e.currentTarget.dataset.dealType;
        
        // Обновляем активные кнопки
        document.querySelectorAll('.deals-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        e.currentTarget.classList.add('active');
        
        // Обновляем активные списки
        document.querySelectorAll('.deals-list').forEach(list => {
            list.classList.remove('active');
        });
        document.getElementById(`${dealType}-deals`).classList.add('active');
    }
    
    filterPlayers(searchTerm) {
        const players = document.querySelectorAll('.player-item');
        const term = searchTerm.toLowerCase();
        
        players.forEach(player => {
            const playerNumber = player.querySelector('h4').textContent.toLowerCase();
            const playerCode = player.dataset.playerCode;
            
            if (playerNumber.includes(term) || playerCode.includes(term)) {
                player.style.display = 'flex';
            } else {
                player.style.display = 'none';
            }
        });
    }
    
    startAutoRefresh() {
        // Обновляем данные каждые 30 секунд
        setInterval(async () => {
            await this.loadAllData();
        }, 30000);
    }
}

// Инициализируем игру
document.addEventListener('DOMContentLoaded', () => {
    window.gameManager = new GameManager();
});