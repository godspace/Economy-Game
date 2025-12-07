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
        this.currentDeal = null;
        
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
        const searchInput = document.getElementById('searchPlayers');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterPlayers(e.target.value);
            });
        }
        
        // Модальное окно
        const modalClose = document.querySelector('.modal-close');
        if (modalClose) {
            modalClose.addEventListener('click', () => {
                this.hideModal();
            });
        }
        
        const cancelDealBtn = document.getElementById('cancelDealBtn');
        if (cancelDealBtn) {
            cancelDealBtn.addEventListener('click', () => {
                this.hideModal();
            });
        }
        
        // Кнопки выбора
        document.querySelectorAll('.choice-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const choice = e.target.closest('.choice-btn').dataset.choice;
                this.makeDealChoice(choice);
            });
        });
        
        // Кнопка выхода
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                sessionStorage.removeItem('player');
                window.location.href = 'index.html';
            });
        }
        
        // Клик по фону модального окна
        const modal = document.getElementById('dealModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal();
                }
            });
        }
    }
    
    async loadAllData() {
        try {
            await Promise.all([
                this.loadPlayersList(),
                this.loadPendingDeals(),
                this.loadDealsHistory(),
                this.updatePlayerStats()
            ]);
        } catch (error) {
            console.error('Error loading all data:', error);
        }
    }
    
    async loadPlayersList() {
        const container = document.getElementById('playersList');
        if (!container) return;
        
        container.innerHTML = '<div class="loading">Загрузка списка игроков...</div>';
        
        try {
            const { data: players, error } = await this.supabase
                .from('players')
                .select('id, code, balance, is_visible, last_login')
                .eq('is_visible', true)
                .neq('code', this.player.code)
                .order('last_login', { ascending: false });
            
            if (error) throw error;
            
            this.displayPlayersList(players || []);
            
            const playersCount = document.getElementById('playersCount');
            if (playersCount) {
                playersCount.textContent = players?.length || 0;
            }
            
        } catch (error) {
            console.error('Error loading players:', error);
            container.innerHTML = '<div class="error-message">Не удалось загрузить список игроков</div>';
        }
    }
    
    async loadPendingDeals() {
        try {
            // Входящие сделки
            const { data: incomingDeals, error: incomingError } = await this.supabase
                .from('deals')
                .select(`
                    id,
                    initiator:players!deals_initiator_id_fkey(id, code),
                    target:players!deals_target_id_fkey(id, code),
                    created_at
                `)
                .eq('target_id', this.player.id)
                .eq('status', 'pending');
            
            // Исходящие сделки
            const { data: outgoingDeals, error: outgoingError } = await this.supabase
                .from('deals')
                .select(`
                    id,
                    initiator:players!deals_initiator_id_fkey(id, code),
                    target:players!deals_target_id_fkey(id, code),
                    created_at
                `)
                .eq('initiator_id', this.player.id)
                .eq('status', 'pending');
            
            if (incomingError || outgoingError) throw incomingError || outgoingError;
            
            this.displayIncomingDeals(incomingDeals || []);
            this.displayOutgoingDeals(outgoingDeals || []);
            
            // Обновляем счетчики
            const incomingCount = incomingDeals?.length || 0;
            const outgoingCount = outgoingDeals?.length || 0;
            const totalCount = incomingCount + outgoingCount;
            
            const pendingDealsCount = document.getElementById('pendingDealsCount');
            const incomingDealsCount = document.getElementById('incomingDealsCount');
            const outgoingDealsCount = document.getElementById('outgoingDealsCount');
            
            if (pendingDealsCount) pendingDealsCount.textContent = totalCount;
            if (incomingDealsCount) incomingDealsCount.textContent = incomingCount;
            if (outgoingDealsCount) outgoingDealsCount.textContent = outgoingCount;
            
        } catch (error) {
            console.error('Error loading deals:', error);
        }
    }
    
    async loadDealsHistory() {
        const container = document.getElementById('deals-history');
        if (!container) return;
        
        try {
            const { data: history, error } = await this.supabase
                .from('deal_history')
                .select(`
                    *,
                    player1:players!deal_history_player1_id_fkey(id, code),
                    player2:players!deal_history_player2_id_fkey(id, code)
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
                .select('*')
                .or(`player1_id.eq.${this.player.id},player2_id.eq.${this.player.id}`);
            
            if (error) throw error;
            
            let totalProfit = 0;
            const totalDeals = history?.length || 0;
            
            history?.forEach(deal => {
                if (deal.player1_id === this.player.id) {
                    totalProfit += deal.player1_result || 0;
                } else {
                    totalProfit += deal.player2_result || 0;
                }
            });
            
            const totalDealsElement = document.getElementById('totalDeals');
            const totalProfitElement = document.getElementById('totalProfit');
            
            if (totalDealsElement) totalDealsElement.textContent = totalDeals;
            if (totalProfitElement) totalProfitElement.textContent = totalProfit;
            
        } catch (error) {
            console.error('Error updating player stats:', error);
        }
    }
    
    displayPlayersList(players) {
        const container = document.getElementById('playersList');
        if (!container) return;
        
        if (!players || players.length === 0) {
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
        if (!container) return;
        
        if (!deals || deals.length === 0) {
            container.innerHTML = '<div class="empty-state">Нет входящих сделок</div>';
            return;
        }
        
        container.innerHTML = deals.map(deal => {
            const initiatorCode = deal.initiator?.code || '';
            const colorClass = this.getPlayerColor(initiatorCode);
            const playerNumber = initiatorCode ? (this.colors.indexOf(colorClass) + 1) : '?';
            
            return `
                <div class="deal-item pending" data-deal-id="${deal.id}" data-initiator-code="${initiatorCode}">
                    <div class="deal-header">
                        <div class="deal-player">
                            <div class="color-badge ${colorClass}">${playerNumber}</div>
                            <div>
                                <h4>Игрок ${playerNumber}</h4>
                                <div class="deal-time">${new Date(deal.created_at).toLocaleString()}</div>
                            </div>
                        </div>
                        <div class="deal-actions">
                            <button class="btn-accept" data-deal-id="${deal.id}" data-initiator-code="${initiatorCode}">
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
                const initiatorCode = e.target.dataset.initiatorCode;
                this.showDealModal(initiatorCode, 'respond', dealId);
            });
        });
    }
    
    displayOutgoingDeals(deals) {
        const container = document.getElementById('outgoing-deals');
        if (!container) return;
        
        if (!deals || deals.length === 0) {
            container.innerHTML = '<div class="empty-state">Нет исходящих сделок</div>';
            return;
        }
        
        container.innerHTML = deals.map(deal => {
            const targetCode = deal.target?.code || '';
            const colorClass = this.getPlayerColor(targetCode);
            const playerNumber = targetCode ? (this.colors.indexOf(colorClass) + 1) : '?';
            
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
        if (!container) return;
        
        if (!history || history.length === 0) {
            container.innerHTML = '<div class="empty-state">История сделок пуста</div>';
            return;
        }
        
        container.innerHTML = history.map(deal => {
            const isPlayer1 = deal.player1_id === this.player.id;
            const opponentCode = isPlayer1 ? deal.player2?.code : deal.player1?.code;
            const playerChoice = isPlayer1 ? deal.player1_choice : deal.player2_choice;
            const opponentChoice = isPlayer1 ? deal.player2_choice : deal.player1_choice;
            const playerResult = isPlayer1 ? deal.player1_result : deal.player2_result;
            const opponentResult = isPlayer1 ? deal.player2_result : deal.player1_result;
            
            const colorClass = this.getPlayerColor(opponentCode);
            const playerNumber = opponentCode ? (this.colors.indexOf(colorClass) + 1) : '?';
            
            const choiceIcon = (choice) => choice === 'cooperate' ? '🤝' : '🎭';
            const resultClass = playerResult > 0 ? 'positive' : 'negative';
            const resultSign = playerResult > 0 ? '+' : '';
            
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
                                    Вы: ${choiceIcon(playerChoice)}
                                </span>
                                <span class="history-choice ${opponentChoice}">
                                    Он: ${choiceIcon(opponentChoice)}
                                </span>
                            </div>
                            <div class="history-result ${resultClass}">
                                Ваш результат: ${resultSign}${playerResult}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    getPlayerColor(playerCode) {
        if (!playerCode) {
            return 'color-grey';
        }
        
        if (!this.playerColors.has(playerCode)) {
            const hash = playerCode.split('').reduce((acc, char) => {
                return acc + char.charCodeAt(0);
            }, 0);
            
            const colorIndex = hash % this.colors.length;
            this.playerColors.set(playerCode, this.colors[colorIndex]);
        }
        
        return this.playerColors.get(playerCode);
    }
    
    async showDealModal(targetCode, mode, dealId = null) {
        console.log('showDealModal called:', { targetCode, mode, dealId });
        
        this.currentDeal = {
            targetCode,
            mode,
            dealId
        };
        
        const modal = document.getElementById('dealModal');
        const modalTitle = document.getElementById('modalTitle');
        const playerColorBadge = document.getElementById('playerColorBadge');
        
        if (!modal || !modalTitle || !playerColorBadge) {
            console.error('Modal elements not found');
            return;
        }
        
        let opponentCode = targetCode;
        
        // Если это ответ на сделку, получаем информацию о сделке
        if (mode === 'respond' && dealId && !targetCode) {
            try {
                const { data: dealInfo, error } = await this.supabase
                    .from('deals')
                    .select(`
                        id,
                        initiator:players!deals_initiator_id_fkey(code)
                    `)
                    .eq('id', dealId)
                    .single();
                
                if (error) throw error;
                
                if (dealInfo?.initiator?.code) {
                    opponentCode = dealInfo.initiator.code;
                    this.currentDeal.targetCode = opponentCode;
                }
            } catch (error) {
                console.error('Error getting deal info:', error);
                opponentCode = null;
            }
        }
        
        // Устанавливаем заголовок
        if (mode === 'create') {
            modalTitle.textContent = 'Предложить сделку';
        } else if (mode === 'respond') {
            modalTitle.textContent = 'Ответить на сделку';
        } else {
            modalTitle.textContent = 'История сделок';
        }
        
        // Устанавливаем цвет и номер игрока
        const colorClass = this.getPlayerColor(opponentCode);
        const playerNumber = opponentCode ? (this.colors.indexOf(colorClass) + 1) : '?';
        playerColorBadge.className = `color-badge ${colorClass}`;
        playerColorBadge.textContent = playerNumber;
        
        // Показываем/скрываем элементы в зависимости от режима
        const choiceButtons = document.querySelector('.choice-buttons');
        const cancelButton = document.getElementById('cancelDealBtn');
        
        if (choiceButtons) {
            choiceButtons.style.display = mode === 'view' ? 'none' : 'grid';
        }
        if (cancelButton) {
            cancelButton.style.display = mode === 'view' ? 'none' : 'block';
        }
        
        // Загружаем статистику и историю, если есть код оппонента
        if (opponentCode) {
            await this.loadModalStats(opponentCode);
            await this.loadDealHistory(opponentCode);
        } else {
            // Устанавливаем значения по умолчанию
            document.getElementById('incomingDealsStat').textContent = '0/5';
            document.getElementById('outgoingDealsStat').textContent = '0/5';
            document.getElementById('dealHistoryList').innerHTML = '<div class="empty-state">Нет истории сделок</div>';
        }
        
        modal.classList.add('active');
    }
    
    hideModal() {
        const modal = document.getElementById('dealModal');
        if (modal) {
            modal.classList.remove('active');
        }
        this.currentDeal = null;
    }
    
    async loadModalStats(opponentCode) {
        try {
            const { data: stats, error } = await this.supabase.rpc('get_deal_stats', {
                player1_code_param: this.player.code,
                player2_code_param: opponentCode
            });
            
            if (error) {
                console.error('RPC Error:', error);
                // Используем запасной вариант
                document.getElementById('incomingDealsStat').textContent = '0/5';
                document.getElementById('outgoingDealsStat').textContent = '0/5';
                return;
            }
            
            const incomingCount = stats?.incoming_count || 0;
            const outgoingCount = stats?.outgoing_count || 0;
            
            const incomingDealsStat = document.getElementById('incomingDealsStat');
            const outgoingDealsStat = document.getElementById('outgoingDealsStat');
            
            if (incomingDealsStat) incomingDealsStat.textContent = `${incomingCount}/5`;
            if (outgoingDealsStat) outgoingDealsStat.textContent = `${outgoingCount}/5`;
            
        } catch (error) {
            console.error('Error loading modal stats:', error);
            document.getElementById('incomingDealsStat').textContent = '0/5';
            document.getElementById('outgoingDealsStat').textContent = '0/5';
        }
    }
    
    async loadDealHistory(opponentCode) {
        try {
            const { data: stats, error } = await this.supabase.rpc('get_deal_stats', {
                player1_code_param: this.player.code,
                player2_code_param: opponentCode
            });
            
            if (error) {
                console.error('RPC Error:', error);
                const historyList = document.getElementById('dealHistoryList');
                if (historyList) {
                    historyList.innerHTML = '<div class="empty-state">Нет истории сделок</div>';
                }
                return;
            }
            
            const historyList = document.getElementById('dealHistoryList');
            if (!historyList) return;
            
            if (!stats?.history || stats.history.length === 0) {
                historyList.innerHTML = '<div class="empty-state">Нет истории сделок</div>';
                return;
            }
            
            historyList.innerHTML = stats.history.map(deal => {
                const player1Choice = deal.player1_choice || 'unknown';
                const player2Choice = deal.player2_choice || 'unknown';
                const player1Result = deal.player1_result || 0;
                
                return `
                    <div class="history-item">
                        <div class="history-choices">
                            <span class="history-choice ${player1Choice}">
                                ${player1Choice === 'cooperate' ? '🤝' : '🎭'}
                            </span>
                            <span class="history-choice ${player2Choice}">
                                ${player2Choice === 'cooperate' ? '🤝' : '🎭'}
                            </span>
                        </div>
                        <div class="history-result ${player1Result > 0 ? 'positive' : 'negative'}">
                            ${player1Result > 0 ? '+' : ''}${player1Result}
                        </div>
                    </div>
                `;
            }).join('');
            
        } catch (error) {
            console.error('Error loading deal history:', error);
            const historyList = document.getElementById('dealHistoryList');
            if (historyList) {
                historyList.innerHTML = '<div class="empty-state">Нет истории сделок</div>';
            }
        }
    }
    
    async loadDealStats(targetCode) {
        try {
            const { data: stats, error } = await this.supabase.rpc('get_deal_stats', {
                player1_code_param: this.player.code,
                player2_code_param: targetCode
            });
            
            if (error) {
                console.error('RPC Error:', error);
                // Используем запасной вариант
                document.getElementById(`incoming-${targetCode}`).textContent = '0/5';
                document.getElementById(`outgoing-${targetCode}`).textContent = '0/5';
                return;
            }
            
            const incomingCount = stats?.incoming_count || 0;
            const outgoingCount = stats?.outgoing_count || 0;
            
            const incomingElement = document.getElementById(`incoming-${targetCode}`);
            const outgoingElement = document.getElementById(`outgoing-${targetCode}`);
            
            if (incomingElement) incomingElement.textContent = `${incomingCount}/5`;
            if (outgoingElement) outgoingElement.textContent = `${outgoingCount}/5`;
            
        } catch (error) {
            console.error('Error loading deal stats:', error);
            // Устанавливаем значения по умолчанию
            document.getElementById(`incoming-${targetCode}`).textContent = '0/5';
            document.getElementById(`outgoing-${targetCode}`).textContent = '0/5';
        }
    }
    
    async makeDealChoice(choice) {
        if (!this.currentDeal) {
            console.error('No current deal');
            return;
        }
        
        const { targetCode, mode, dealId } = this.currentDeal;
        
        try {
            let result;
            
            if (mode === 'create') {
                // Создаем новую сделку
                const { data: createResult, error: createError } = await this.supabase.rpc(
                    'create_deal',
                    {
                        initiator_code_param: this.player.code,
                        target_code_param: targetCode
                    }
                );
                
                if (createError) {
                    console.error('Create deal error:', createError);
                    throw createError;
                }
                
                if (!createResult?.success) {
                    alert(createResult?.error || 'Ошибка создания сделки');
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
                
            } else if (mode === 'respond') {
                // Отвечаем на сделку
                const { data: choiceResult, error: choiceError } = await this.supabase.rpc(
                    'make_choice',
                    {
                        deal_id_param: dealId,
                        player_code_param: this.player.code,
                        choice_param: choice
                    }
                );
                
                if (choiceError) throw choiceError;
                result = choiceResult;
            }
            
            if (result?.completed) {
                const resultMessage = result.result_initiator > 0 ? 
                    `Сделка завершена! Вы получили: +${result.result_initiator} монет` :
                    `Сделка завершена! Вы потеряли: ${result.result_initiator} монет`;
                alert(resultMessage);
                await this.updatePlayerBalance();
            } else if (result?.success) {
                alert('Ждем выбора второго игрока...');
            }
            
            this.hideModal();
            await this.loadAllData();
            
        } catch (error) {
            console.error('Error making deal choice:', error);
            alert('Ошибка при обработке сделки: ' + (error.message || 'Неизвестная ошибка'));
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
                this.player.balance = playerData.balance || 0;
                sessionStorage.setItem('player', JSON.stringify(this.player));
                
                const balanceValue = document.getElementById('balanceValue');
                if (balanceValue) {
                    balanceValue.textContent = this.player.balance;
                }
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
        
        const tabElement = document.getElementById(`${tabName}-tab`);
        if (tabElement) {
            tabElement.classList.add('active');
        }
        
        // Если переключились на вкладку сделок, обновляем данные
        if (tabName === 'deals') {
            this.loadPendingDeals();
        }
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
        
        const listElement = document.getElementById(`${dealType}-deals`);
        if (listElement) {
            listElement.classList.add('active');
        }
    }
    
    filterPlayers(searchTerm) {
        const players = document.querySelectorAll('.player-item');
        const term = searchTerm.toLowerCase();
        
        players.forEach(player => {
            const playerNumberElement = player.querySelector('h4');
            if (!playerNumberElement) return;
            
            const playerNumber = playerNumberElement.textContent.toLowerCase();
            const playerCode = player.dataset.playerCode || '';
            
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
    // Даем время на загрузку Supabase
    setTimeout(() => {
        if (window.gameSupabase) {
            window.gameManager = new GameManager();
        } else {
            console.error('Supabase не загружен');
            alert('Ошибка загрузки игры. Пожалуйста, обновите страницу.');
        }
    }, 1000);
});