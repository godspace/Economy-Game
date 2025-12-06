// app.js - основной модуль приложения и управление вкладками
class AppManager {
    constructor() {
        this.currentTab = 'players';
        this.allPlayers = [];
        this.playersCache = new Map();
        this.cacheDuration = 30000; // 30 секунд кеширования
        this.initEventListeners();
        this.initTabContent();
    }

    // Инициализация обработчиков событий
    initEventListeners() {
        // Обработчики вкладок
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Обработчик модального окна сделки
        document.getElementById('cancel-deal').addEventListener('click', () => {
            this.hideModal();
        });

        // Обработчики выбора в сделке (будут в deals.js)
    }

    // Инициализация содержимого вкладок
    initTabContent() {
        // Игроки
        this.initPlayersTab();
        
        // Сделки
        this.initDealsTab();
        
        // Рейтинг
        this.initRatingTab();
        
        // Магазин
        this.initShopTab();
        
        // Заказы (админ)
        this.initOrdersTab();
    }

    // Инициализация вкладки "Игроки"
    initPlayersTab() {
        const playersTab = document.getElementById('players-tab');
        playersTab.innerHTML = `
            <div class="players-header">
                <h2>Доступные игроки</h2>
                <div class="players-stats">
                    <span class="material-icons">group</span>
                    <span id="online-count">0 онлайн</span>
                </div>
            </div>
            <div class="players-filters">
                <select id="class-filter">
                    <option value="all">Все классы</option>
                    <!-- Динамически заполнится -->
                </select>
                <input type="text" id="search-input" placeholder="Поиск по имени...">
            </div>
            <div id="players-list" class="players-list"></div>
        `;
    }

    // Инициализация вкладки "Сделки"
    initDealsTab() {
        const dealsTab = document.getElementById('deals-tab');
        dealsTab.innerHTML = `
            <div class="deals-header">
                <h2>История сделок</h2>
                <div class="deals-stats">
                    <span class="material-icons">swap_horiz</span>
                    <span id="deals-count">0 сделок</span>
                </div>
            </div>
            <div class="deals-tabs">
                <button class="deals-tab-btn active" data-deals-type="all">Все</button>
                <button class="deals-tab-btn" data-deals-type="incoming">Входящие</button>
                <button class="deals-tab-btn" data-deals-type="outgoing">Исходящие</button>
            </div>
            <div id="deals-history" class="deals-history"></div>
        `;
    }

    // Инициализация вкладки "Рейтинг"
    initRatingTab() {
        const ratingTab = document.getElementById('rating-tab');
        ratingTab.innerHTML = `
            <div class="rating-header">
                <div>
                    <h2>Топ-50 игроков</h2>
                    <div class="rating-update">
                        <span class="material-icons">update</span>
                        <span id="last-update">только что</span>
                    </div>
                </div>
                <button id="refresh-rating" class="icon-btn" title="Обновить">
                    <span class="material-icons">refresh</span>
                </button>
            </div>
            <div class="rating-filters">
                <select id="rating-class-filter">
                    <option value="all">Все классы</option>
                    <option value="my">Мой класс</option>
                </select>
            </div>
            <div id="rating-list" class="rating-list"></div>
            <div class="current-user-stats" style="margin-top: 1rem; padding: 1rem; background: #E3F2FD; border-radius: 10px; display: none;" id="current-user-stats">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>Ваше место:</strong> <span id="user-rank">?</span>
                        <div style="font-size: 0.9rem; color: #666;">Всего игроков: <span id="total-players">0</span></div>
                    </div>
                    <button id="share-rating" class="secondary-btn" style="background: #4CAF50;">
                        <span class="material-icons">share</span>
                    </button>
                </div>
            </div>
        `;
    }

    // Инициализация вкладки "Магазин"
    initShopTab() {
        const shopTab = document.getElementById('shop-tab');
        shopTab.innerHTML = `
            <div class="shop-header">
                <h2>Магазин призов</h2>
                <div class="shop-balance">
                    <span class="material-icons">account_balance_wallet</span>
                    <span>Ваш баланс: <strong id="shop-balance">100</strong> монет</span>
                </div>
            </div>
            <div class="shop-items">
                <div class="shop-item">
                    <div class="item-image">
                        <span class="material-icons">redeem</span>
                    </div>
                    <div class="item-info">
                        <h3>Baunty</h3>
                        <p class="item-description">Сладкий приз за успехи в игре</p>
                        <div class="item-price">
                            <span class="material-icons">monetization_on</span>
                            <span>99 монет</span>
                        </div>
                    </div>
                    <button class="buy-btn" data-item="baunty">
                        Купить
                    </button>
                </div>
            </div>
            <div class="purchases-history">
                <h3>История покупок</h3>
                <div id="purchases-list" class="purchases-list"></div>
            </div>
        `;
    }

    // Инициализация вкладки "Заказы" (админ)
    initOrdersTab() {
        const ordersTab = document.getElementById('orders-tab');
        ordersTab.innerHTML = `
            <div class="orders-header">
                <h2>Заказы Baunty</h2>
                <div class="orders-stats">
                    <span class="material-icons">pending_actions</span>
                    <span id="pending-orders">0 ожидают</span>
                </div>
            </div>
            <div class="orders-filters">
                <select id="order-status-filter">
                    <option value="pending">Ожидают подтверждения</option>
                    <option value="all">Все заказы</option>
                    <option value="confirmed">Подтвержденные</option>
                    <option value="cancelled">Отмененные</option>
                </select>
            </div>
            <div id="orders-list" class="orders-list"></div>
        `;
    }

    // Переключение вкладок
    switchTab(tabName) {
        // Обновляем активную кнопку вкладки
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Обновляем активную панель
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `${tabName}-tab`);
        });

        this.currentTab = tabName;

        // Загружаем данные для активной вкладки
        this.loadTabData(tabName);
    }

    // Загрузка данных для вкладки
    async loadTabData(tabName) {
        if (!authManager.currentUser) return;

        // Обновляем баланс при переключении на любую вкладку
        await this.refreshUserBalance();

        switch(tabName) {
            case 'players':
                await this.loadPlayers();
                break;
            case 'deals':
                if (window.dealsManager) {
                    await dealsManager.loadDealsHistory();
                }
                break;
            case 'rating':
                if (window.ratingManager) {
                    await ratingManager.loadRating();
                }
                break;
            case 'shop':
                if (window.shopManager) {
                    shopManager.updateShopBalance();
                    await shopManager.loadPurchaseHistory();
                }
                break;
            case 'orders':
                if (window.adminManager) {
                    await adminManager.loadOrders();
                }
                break;
        }
    }

    // Загрузка списка игроков
    async loadPlayers() {
        const playersList = document.getElementById('players-list');
        if (!playersList) return;

        playersList.innerHTML = '<div class="empty-state"><span class="material-icons">refresh</span><p>Загрузка игроков...</p></div>';

        try {
            // Проверяем кеш
            const cacheKey = 'players_list';
            const cached = this.playersCache.get(cacheKey);
            
            if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
                this.renderPlayers(cached.data);
                return;
            }

            // Загружаем из базы
            const { data: players, error } = await supabase
                .from('students')
                .select(`
                    id,
                    class,
                    last_name,
                    first_name,
                    profiles!inner (
                        coins,
                        online,
                        color_index,
                        last_action
                    )
                `)
                .order('class')
                .order('last_name');

            if (error) throw error;

            // Преобразуем данные
            const formattedPlayers = players.map(player => ({
                id: player.id,
                class: player.class,
                lastName: player.last_name,
                firstName: player.first_name,
                fullName: `${player.last_name} ${player.first_name}`,
                coins: player.profiles[0]?.coins || 100,
                online: player.profiles[0]?.online || false,
                colorIndex: player.profiles[0]?.color_index || 0,
                lastAction: player.profiles[0]?.last_action
            }));

            // Фильтруем текущего пользователя
            const otherPlayers = formattedPlayers.filter(
                p => p.id !== authManager.currentUser.id
            );

            // Сохраняем в кеш
            this.playersCache.set(cacheKey, {
                timestamp: Date.now(),
                data: otherPlayers
            });

            this.allPlayers = otherPlayers;
            this.renderPlayers(otherPlayers);
            this.updateOnlineCount(otherPlayers);
            this.populateClassFilter(otherPlayers);

        } catch (error) {
            console.error('Ошибка загрузки игроков:', error);
            playersList.innerHTML = '<div class="empty-state"><span class="material-icons">error</span><p>Ошибка загрузки</p></div>';
        }
    }

    // Отрисовка списка игроков
    renderPlayers(players) {
        const playersList = document.getElementById('players-list');
        const searchInput = document.getElementById('search-input');
        const classFilter = document.getElementById('class-filter');
        
        if (!playersList) return;

        // Фильтрация
        let filteredPlayers = [...players];
        
        if (classFilter && classFilter.value !== 'all') {
            filteredPlayers = filteredPlayers.filter(p => p.class === classFilter.value);
        }
        
        if (searchInput && searchInput.value) {
            const searchTerm = searchInput.value.toLowerCase();
            filteredPlayers = filteredPlayers.filter(p => 
                p.fullName.toLowerCase().includes(searchTerm) ||
                p.class.toLowerCase().includes(searchTerm)
            );
        }

        if (filteredPlayers.length === 0) {
            playersList.innerHTML = '<div class="empty-state"><span class="material-icons">search_off</span><p>Игроки не найдены</p></div>';
            return;
        }

        // Сортируем: онлайн игроки сначала
        filteredPlayers.sort((a, b) => {
            if (a.online && !b.online) return -1;
            if (!a.online && b.online) return 1;
            return a.fullName.localeCompare(b.fullName);
        });

        // Генерируем HTML
        playersList.innerHTML = filteredPlayers.map(player => `
            <div class="player-card" data-player-id="${player.id}">
                <div class="player-card-avatar" style="background: linear-gradient(45deg, ${MATERIAL_COLORS[player.colorIndex]}, ${this.adjustColor(MATERIAL_COLORS[player.colorIndex], -20)})">
                    ${player.firstName.charAt(0)}
                </div>
                <div class="player-card-info">
                    <div class="player-card-name">${player.fullName}</div>
                    <div class="player-card-class">${player.class} класс</div>
                    <div class="player-card-status ${player.online ? 'online' : 'offline'}">
                        <span class="material-icons" style="font-size: 12px;">${player.online ? 'circle' : 'radio_button_unchecked'}</span>
                        ${player.online ? 'Онлайн' : 'Был(а) недавно'}
                    </div>
                </div>
                <button class="deal-btn" data-target="${player.id}">
                    Сделка
                </button>
            </div>
        `).join('');

        // Добавляем обработчики кнопок "Сделка"
        playersList.querySelectorAll('.deal-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const targetPlayerId = btn.dataset.target;
                
                if (!authManager.canPerformAction()) return;
                
                // Проверяем лимит сделок
                const canMakeDeal = await this.checkDealLimit(targetPlayerId);
                
                if (canMakeDeal) {
                    if (window.dealsManager) {
                        dealsManager.initiateDeal(targetPlayerId);
                    }
                } else {
                    authManager.showToast('Лимит сделок с этим игроком исчерпан', 'warning');
                }
            });
        });

        // Добавляем обработчик клика по карточке
        playersList.querySelectorAll('.player-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('deal-btn')) {
                    // В будущем можно добавить просмотр профиля
                }
            });
        });
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

    // Обновление счетчика онлайн игроков
    updateOnlineCount(players) {
        const onlineCountEl = document.getElementById('online-count');
        if (onlineCountEl) {
            const onlineCount = players.filter(p => p.online).length;
            onlineCountEl.textContent = `${onlineCount} онлайн`;
        }
    }

    // Заполнение фильтра по классам
    populateClassFilter(players) {
        const classFilter = document.getElementById('class-filter');
        if (!classFilter) return;

        // Получаем уникальные классы
        const classes = [...new Set(players.map(p => p.class))].sort();
        
        // Сохраняем текущее значение
        const currentValue = classFilter.value;
        
        // Очищаем и заполняем
        classFilter.innerHTML = '<option value="all">Все классы</option>' +
            classes.map(cls => `<option value="${cls}">${cls} класс</option>`).join('');
        
        // Восстанавливаем значение
        classFilter.value = currentValue;
        
        // Добавляем обработчик
        classFilter.addEventListener('change', () => {
            this.renderPlayers(this.allPlayers);
        });
    }

    // Инициализация поиска
    initSearch() {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.renderPlayers(this.allPlayers);
                }, 300);
            });
        }
    }

    // Показ модального окна
    showModal(content) {
        const modal = document.getElementById('deal-modal');
        modal.classList.add('active');
    }

    // Скрытие модального окна
    hideModal() {
        const modal = document.getElementById('deal-modal');
        modal.classList.remove('active');
    }

    // Обновление баланса в UI
    updateCoinsDisplay(newCoins) {
        const coinsEl = document.getElementById('coins-count');
        const shopBalanceEl = document.getElementById('shop-balance');
        
        if (coinsEl) {
            coinsEl.textContent = newCoins;
        }
        
        if (shopBalanceEl) {
            shopBalanceEl.textContent = newCoins;
        }
        
        // Анимация изменения
        coinsEl.classList.add('pulse');
        setTimeout(() => {
            coinsEl.classList.remove('pulse');
        }, 1000);
    }

    // Вспомогательный метод для коррекции цвета
    adjustColor(color, amount) {
        let usePound = false;
        if (color[0] === "#") {
            color = color.slice(1);
            usePound = true;
        }
        
        const num = parseInt(color, 16);
        let r = (num >> 16) + amount;
        let g = ((num >> 8) & 0x00FF) + amount;
        let b = (num & 0x0000FF) + amount;
        
        r = Math.min(Math.max(0, r), 255);
        g = Math.min(Math.max(0, g), 255);
        b = Math.min(Math.max(0, b), 255);
        
        return (usePound ? "#" : "") + (b | (g << 8) | (r << 16)).toString(16).padStart(6, '0');
    }

    // Обновление кеша при действиях
    invalidateCache() {
        this.playersCache.clear();
        if (this.currentTab === 'players') {
            this.loadPlayers();
        }
    }
    
    // Обновление баланса пользователя
    async refreshUserBalance() {
        if (!authManager.currentUser) return;
        
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('coins')
                .eq('id', authManager.currentUser.id)
                .single();
                
            if (!error && profile) {
                authManager.currentUser.coins = profile.coins;
                this.updateCoinsDisplay(profile.coins);
                
                if (window.shopManager) {
                    shopManager.updateShopBalance();
                }
            }
        } catch (error) {
            console.error('Ошибка обновления баланса:', error);
        }
    }

}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    window.appManager = new AppManager();
});