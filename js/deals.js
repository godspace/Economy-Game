// deals.js - модуль управления сделками между игроками
class DealsManager {
    constructor() {
        this.currentDeal = null;
        this.dealsHistory = [];
        this.dealTypes = {
            ALL: 'all',
            INCOMING: 'incoming',
            OUTGOING: 'outgoing'
        };
        this.currentDealType = this.dealTypes.ALL;
        this.initEventListeners();
    }

    // Инициализация обработчиков событий
    initEventListeners() {
        // Обработчики выбора в сделке
        document.querySelectorAll('.choice-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const choice = e.currentTarget.dataset.choice;
                this.processDealChoice(choice);
            });
        });

        // Обработчики вкладок сделок
        document.querySelectorAll('.deals-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.dealsType;
                this.switchDealsTab(type);
            });
        });

        // Обработчики кликов по истории сделок (делегирование)
        document.addEventListener('click', (e) => {
            const dealCard = e.target.closest('.deal-card');
            if (dealCard) {
                const dealId = dealCard.dataset.dealId;
                const deal = this.dealsHistory.find(d => d.id == dealId);
                if (deal) {
                    this.showDealDetails(deal);
                }
            }
        });
    }

    // Инициирование сделки с игроком
    async initiateDeal(targetPlayerId) {
        if (!authManager.currentUser || !authManager.canPerformAction()) {
            return;
        }

        // Проверяем лимит сделок
        const canMakeDeal = await this.checkDealLimit(targetPlayerId);
        if (!canMakeDeal) {
            authManager.showToast('Лимит сделок с этим игроком исчерпан', 'warning');
            return;
        }

        // Получаем информацию о целевом игроке
        const targetPlayer = await this.getPlayerInfo(targetPlayerId);
        if (!targetPlayer) {
            authManager.showToast('Игрок не найден', 'error');
            return;
        }

        // Устанавливаем текущую сделку
        this.currentDeal = {
            targetPlayerId: targetPlayerId,
            targetPlayerName: targetPlayer.fullName,
            targetPlayerColor: MATERIAL_COLORS[targetPlayer.colorIndex],
            remainingDeals: await this.getRemainingDeals(targetPlayerId)
        };

        // Показываем модальное окно
        this.showDealModal();
    }

    // Показ модального окна сделки
    showDealModal() {
        const modal = document.getElementById('deal-modal');
        const playerNameEl = document.querySelector('.deal-player-name');
        const dealsLeftEl = document.getElementById('deals-left');

        if (this.currentDeal) {
            playerNameEl.textContent = this.currentDeal.targetPlayerName;
            playerNameEl.style.color = this.currentDeal.targetPlayerColor;
            dealsLeftEl.textContent = this.currentDeal.remainingDeals;

            modal.classList.add('active');
        }
    }

    // Скрытие модального окна
    hideDealModal() {
        const modal = document.getElementById('deal-modal');
        modal.classList.remove('active');
        this.currentDeal = null;
    }

    // Обработка выбора в сделке
    async processDealChoice(choice) {
        if (!authManager.currentUser || !this.currentDeal) {
            return;
        }

        // Rate limiting
        if (!authManager.canPerformAction()) {
            return;
        }

        authManager.showLoader(true);

        try {
            // Генерируем хеш для проверки целостности
            const hash = this.generateDealHash(
                authManager.currentUser.id,
                this.currentDeal.targetPlayerId,
                choice
            );

            // Создаем запись о сделке
            const { data: deal, error: dealError } = await supabase
                .from('deals')
                .insert({
                    from_player: authManager.currentUser.id,
                    to_player: this.currentDeal.targetPlayerId,
                    choices: { from: choice, to: null }, // Второй игрок пока не сделал выбор
                    result: { from_change: 0, to_change: 0 },
                    status: 'pending'
                })
                .select()
                .single();

            if (dealError) throw dealError;

            // Логируем активность
            await authManager.logActivity('initiate_deal', {
                deal_id: deal.id,
                target_player: this.currentDeal.targetPlayerId,
                choice: choice
            });

            // Показываем подтверждение
            authManager.showToast('Сделка предложена! Ждем ответа игрока.', 'success');

            // Обновляем кеш игроков
            if (window.appManager) {
                appManager.invalidateCache();
            }

            // Обновляем историю сделок
            await this.loadDealsHistory();

        } catch (error) {
            console.error('Ошибка создания сделки:', error);
            authManager.showToast('Ошибка создания сделки', 'error');
        } finally {
            authManager.showLoader(false);
            this.hideDealModal();
        }
    }

    // Проверка лимита сделок с игроком
    async checkDealLimit(targetPlayerId) {
        try {
            const { data: deals, error } = await supabase
                .from('deals')
                .select('id')
                .or(`and(from_player.eq.${authManager.currentUser.id},to_player.eq.${targetPlayerId}),and(from_player.eq.${targetPlayerId},to_player.eq.${authManager.currentUser.id})`);

            if (error) throw error;

            return deals.length < GAME_CONFIG.MAX_DEALS_PER_PLAYER;
        } catch (error) {
            console.error('Ошибка проверки лимита сделок:', error);
            return false;
        }
    }

    // Получение информации об игроке
    async getPlayerInfo(playerId) {
        try {
            const { data, error } = await supabase
                .from('students')
                .select(`
                    id,
                    last_name,
                    first_name,
                    class,
                    profiles!inner (
                        color_index
                    )
                `)
                .eq('id', playerId)
                .single();

            if (error) throw error;

            return {
                id: data.id,
                fullName: `${data.last_name} ${data.first_name}`,
                class: data.class,
                colorIndex: data.profiles[0]?.color_index || 0
            };
        } catch (error) {
            console.error('Ошибка получения информации об игроке:', error);
            return null;
        }
    }

    // Получение оставшегося количества сделок
    async getRemainingDeals(targetPlayerId) {
        try {
            const { data: deals, error } = await supabase
                .from('deals')
                .select('id')
                .or(`and(from_player.eq.${authManager.currentUser.id},to_player.eq.${targetPlayerId}),and(from_player.eq.${targetPlayerId},to_player.eq.${authManager.currentUser.id})`);

            if (error) throw error;

            return GAME_CONFIG.MAX_DEALS_PER_PLAYER - deals.length;
        } catch (error) {
            console.error('Ошибка получения количества сделок:', error);
            return 0;
        }
    }

    // Загрузка истории сделок
    async loadDealsHistory() {
        const dealsHistoryEl = document.getElementById('deals-history');
        if (!dealsHistoryEl) return;

        dealsHistoryEl.innerHTML = '<div class="loading-indicator"><span class="material-icons">refresh</span><p>Загрузка истории...</p></div>';

        try {
            // Загружаем сделки, где текущий пользователь участвует
            const { data: deals, error } = await supabase
                .from('deals')
                .select(`
                    id,
                    from_player,
                    to_player,
                    choices,
                    result,
                    status,
                    created_at,
                    from_player_data:students!deals_from_player_fkey (
                        last_name,
                        first_name,
                        class
                    ),
                    to_player_data:students!deals_to_player_fkey (
                        last_name,
                        first_name,
                        class
                    )
                `)
                .or(`from_player.eq.${authManager.currentUser.id},to_player.eq.${authManager.currentUser.id}`)
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.dealsHistory = deals || [];
            this.renderDealsHistory();

            // Обновляем счетчик
            this.updateDealsCount();

        } catch (error) {
            console.error('Ошибка загрузки истории сделок:', error);
            dealsHistoryEl.innerHTML = '<div class="empty-state"><span class="material-icons">error</span><p>Ошибка загрузки истории</p></div>';
        }
    }

    // Отрисовка истории сделок
    renderDealsHistory() {
        const dealsHistoryEl = document.getElementById('deals-history');
        if (!dealsHistoryEl) return;

        // Фильтруем сделки по типу
        let filteredDeals = [...this.dealsHistory];

        switch (this.currentDealType) {
            case this.dealTypes.INCOMING:
                filteredDeals = filteredDeals.filter(deal => 
                    deal.to_player === authManager.currentUser.id
                );
                break;
            case this.dealTypes.OUTGOING:
                filteredDeals = filteredDeals.filter(deal => 
                    deal.from_player === authManager.currentUser.id
                );
                break;
        }

        if (filteredDeals.length === 0) {
            let message = 'Нет сделок';
            switch (this.currentDealType) {
                case this.dealTypes.INCOMING:
                    message = 'Нет входящих сделок';
                    break;
                case this.dealTypes.OUTGOING:
                    message = 'Нет исходящих сделок';
                    break;
            }
            dealsHistoryEl.innerHTML = `<div class="empty-state"><span class="material-icons">inbox</span><p>${message}</p></div>`;
            return;
        }

        // Генерируем HTML
        dealsHistoryEl.innerHTML = filteredDeals.map(deal => {
            const isIncoming = deal.to_player === authManager.currentUser.id;
            const otherPlayer = isIncoming ? deal.from_player_data : deal.to_player_data;
            const otherPlayerName = otherPlayer ? 
                `${otherPlayer.last_name} ${otherPlayer.first_name}` : 'Игрок';
            
            const isPending = deal.status === 'pending';
            const isCompleted = deal.status === 'completed';
            
            let statusText = '';
            let statusClass = '';
            
            if (isPending) {
                statusText = isIncoming ? 'Ожидает вашего ответа' : 'Ожидает ответа';
                statusClass = 'pending';
            } else if (isCompleted) {
                const myChoice = isIncoming ? deal.choices.to : deal.choices.from;
                const theirChoice = isIncoming ? deal.choices.from : deal.choices.to;
                const myResult = isIncoming ? deal.result.to_change : deal.result.from_change;
                
                statusText = `Вы ${myChoice === 'cooperate' ? 'сотрудничали' : 'жульничали'}, `;
                statusText += `они ${theirChoice === 'cooperate' ? 'сотрудничали' : 'жульничали'}`;
                statusClass = myResult > 0 ? 'profit' : myResult < 0 ? 'loss' : 'neutral';
            }

            const date = new Date(deal.created_at).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <div class="deal-card ${statusClass}" data-deal-id="${deal.id}">
                    <div class="deal-card-header">
                        <div class="deal-player">
                            <div class="deal-avatar" style="background-color: ${MATERIAL_COLORS[deal.from_player % MATERIAL_COLORS.length]}">
                                ${isIncoming ? '←' : '→'}
                            </div>
                            <div class="deal-info">
                                <div class="deal-player-name">${otherPlayerName}</div>
                                <div class="deal-date">${date}</div>
                            </div>
                        </div>
                        <div class="deal-result ${statusClass}">
                            ${isCompleted ? 
                                (isIncoming ? deal.result.to_change : deal.result.from_change) > 0 ? '+' : ''
                                + (isIncoming ? deal.result.to_change : deal.result.from_change) : 
                                '...'
                            }
                        </div>
                    </div>
                    <div class="deal-status ${statusClass}">
                        ${statusText}
                    </div>
                    ${isPending && isIncoming ? 
                        `<button class="respond-btn" data-deal-id="${deal.id}">Ответить</button>` : 
                        ''
                    }
                </div>
            `;
        }).join('');

        // Добавляем обработчики кнопок "Ответить"
        dealsHistoryEl.querySelectorAll('.respond-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const dealId = e.currentTarget.dataset.dealId;
                await this.respondToDeal(dealId);
            });
        });
    }

    // Ответ на входящую сделку
    async respondToDeal(dealId) {
        if (!authManager.canPerformAction()) {
            return;
        }

        const deal = this.dealsHistory.find(d => d.id == dealId);
        if (!deal || deal.status !== 'pending') {
            authManager.showToast('Сделка не найдена или уже завершена', 'warning');
            return;
        }

        // Показываем модальное окно для ответа
        this.currentDeal = {
            dealId: deal.id,
            targetPlayerId: deal.from_player,
            targetPlayerName: `${deal.from_player_data.last_name} ${deal.from_player_data.first_name}`,
            targetPlayerColor: MATERIAL_COLORS[deal.from_player % MATERIAL_COLORS.length]
        };

        this.showDealModal();
    }

    // Переключение вкладок истории сделок
    switchDealsTab(type) {
        this.currentDealType = type;
        
        // Обновляем активные кнопки
        document.querySelectorAll('.deals-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.dealsType === type);
        });
        
        // Перерисовываем историю
        this.renderDealsHistory();
    }

    // Показ деталей сделки
    async showDealDetails(deal) {
        const isIncoming = deal.to_player === authManager.currentUser.id;
        const otherPlayer = isIncoming ? deal.from_player_data : deal.to_player_data;
        
        let message = `Сделка с ${otherPlayer ? `${otherPlayer.last_name} ${otherPlayer.first_name}` : 'игроком'}\n`;
        message += `Дата: ${new Date(deal.created_at).toLocaleString('ru-RU')}\n`;
        message += `Статус: ${deal.status === 'pending' ? 'Ожидание' : 'Завершена'}\n`;
        
        if (deal.status === 'completed') {
            const myChoice = isIncoming ? deal.choices.to : deal.choices.from;
            const theirChoice = isIncoming ? deal.choices.from : deal.choices.to;
            const myResult = isIncoming ? deal.result.to_change : deal.result.from_change;
            
            message += `\nВаш выбор: ${myChoice === 'cooperate' ? 'Сотрудничество' : 'Жульничество'}\n`;
            message += `Их выбор: ${theirChoice === 'cooperate' ? 'Сотрудничество' : 'Жульничество'}\n`;
            message += `Результат: ${myResult > 0 ? '+' : ''}${myResult} монет`;
        }
        
        alert(message);
    }

    // Обновление счетчика сделок
    updateDealsCount() {
        const dealsCountEl = document.getElementById('deals-count');
        if (dealsCountEl) {
            const totalDeals = this.dealsHistory.length;
            dealsCountEl.textContent = `${totalDeals} сделок`;
        }
    }

    // Генерация хеша для сделки
    generateDealHash(fromPlayerId, toPlayerId, choice) {
        const timestamp = Date.now();
        const data = `${fromPlayerId}-${toPlayerId}-${choice}-${timestamp}-${Math.random()}`;
        return this.sha256(data);
    }

    // Простая имитация SHA-256
    sha256(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(64, '0');
    }

    // Обновление статуса сделки (вызывается периодически)
    async updatePendingDeals() {
        if (!authManager.currentUser) return;

        try {
            // Проверяем, есть ли ответы на наши предложения
            const { data: updatedDeals, error } = await supabase
                .from('deals')
                .select('*')
                .eq('from_player', authManager.currentUser.id)
                .eq('status', 'pending')
                .not('choices->to', 'is', null);

            if (error) throw error;

            // Обрабатываем завершенные сделки
            for (const deal of updatedDeals) {
                await this.finalizeDeal(deal);
            }

        } catch (error) {
            console.error('Ошибка обновления сделок:', error);
        }
    }

    // Завершение сделки (обработка ответа)
    async finalizeDeal(deal) {
        try {
            // Вычисляем результат
            const fromChoice = deal.choices.from;
            const toChoice = deal.choices.to;
            
            let fromChange = 0;
            let toChange = 0;
            
            if (fromChoice === 'cooperate' && toChoice === 'cooperate') {
                fromChange = GAME_CONFIG.COINS.BOTH_COOPERATE;
                toChange = GAME_CONFIG.COINS.BOTH_COOPERATE;
            } else if (fromChoice === 'cheat' && toChoice === 'cooperate') {
                fromChange = GAME_CONFIG.COINS.ONE_CHEAT.CHEATER;
                toChange = GAME_CONFIG.COINS.ONE_CHEAT.VICTIM;
            } else if (fromChoice === 'cooperate' && toChoice === 'cheat') {
                fromChange = GAME_CONFIG.COINS.ONE_CHEAT.VICTIM;
                toChange = GAME_CONFIG.COINS.ONE_CHEAT.CHEATER;
            } else if (fromChoice === 'cheat' && toChoice === 'cheat') {
                fromChange = GAME_CONFIG.COINS.BOTH_CHEAT;
                toChange = GAME_CONFIG.COINS.BOTH_CHEAT;
            }

            // Обновляем сделку
            const { error: updateError } = await supabase
                .from('deals')
                .update({
                    result: { from_change: fromChange, to_change: toChange },
                    status: 'completed'
                })
                .eq('id', deal.id);

            if (updateError) throw updateError;

            // Создаем транзакции для обоих игроков
            const hash1 = this.generateDealHash(deal.from_player, deal.to_player, `result-${fromChange}`);
            const hash2 = this.generateDealHash(deal.to_player, deal.from_player, `result-${toChange}`);

            await supabase.from('transactions').insert([
                {
                    profile_id: deal.from_player,
                    amount: fromChange,
                    type: 'deal_result',
                    hash: hash1,
                    deal_id: deal.id
                },
                {
                    profile_id: deal.to_player,
                    amount: toChange,
                    type: 'deal_result',
                    hash: hash2,
                    deal_id: deal.id
                }
            ]);

            // Обновляем балансы профилей
            await this.updateProfileCoins(deal.from_player, fromChange);
            await this.updateProfileCoins(deal.to_player, toChange);

            // Логируем
            await authManager.logActivity('deal_completed', { deal_id: deal.id });

        } catch (error) {
            console.error('Ошибка завершения сделки:', error);
        }
    }

    // Обновление монет в профиле
    async updateProfileCoins(playerId, change) {
        try {
            // Получаем текущий баланс
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('coins')
                .eq('id', playerId)
                .single();

            if (error) throw error;

            // Обновляем баланс
            const newCoins = Math.max(0, profile.coins + change);
            
            await supabase
                .from('profiles')
                .update({ coins: newCoins })
                .eq('id', playerId);

            // Обновляем UI если это текущий пользователь
            if (playerId === authManager.currentUser.id) {
                authManager.currentUser.coins = newCoins;
                if (window.appManager) {
                    appManager.updateCoinsDisplay(newCoins);
                }
            }

        } catch (error) {
            console.error('Ошибка обновления монет:', error);
        }
    }

    // Запуск периодического обновления сделок
    startDealUpdates() {
        setInterval(async () => {
            await this.updatePendingDeals();
            await this.loadDealsHistory();
        }, 10000); // Каждые 10 секунд
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    window.dealsManager = new DealsManager();
    
    // Запускаем обновление, если пользователь авторизован
    if (authManager && authManager.currentUser) {
        dealsManager.loadDealsHistory();
        dealsManager.startDealUpdates();
    }
});