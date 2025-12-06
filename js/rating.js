// rating.js - модуль для отображения рейтинга игроков
class RatingManager {
    constructor() {
        this.ratingData = [];
        this.currentFilter = 'all';
        this.cache = {
            data: null,
            timestamp: null,
            ttl: 60000 // 1 минута кеширования
        };
        this.initEventListeners();
    }

    // Инициализация обработчиков событий
    initEventListeners() {
        // Фильтр по классам
        const classFilter = document.getElementById('rating-class-filter');
        if (classFilter) {
            classFilter.addEventListener('change', (e) => {
                this.currentFilter = e.target.value;
                this.renderRating();
            });
        }

        // Кнопка обновления (будет добавлена в app.js)
        document.addEventListener('click', (e) => {
            if (e.target.closest('#refresh-rating')) {
                this.loadRating(true);
            }
        });
    }

    // Загрузка рейтинга
    async loadRating(forceRefresh = false) {
        const ratingList = document.getElementById('rating-list');
        if (!ratingList) return;

        // Показать индикатор загрузки
        ratingList.innerHTML = '<div class="loading-indicator"><span class="material-icons">refresh</span><p>Загрузка рейтинга...</p></div>';

        // Проверяем кеш
        if (!forceRefresh && this.cache.data && Date.now() - this.cache.timestamp < this.cache.ttl) {
            this.ratingData = this.cache.data;
            this.renderRating();
            return;
        }

        try {
            // Используем функцию get_leaderboard из базы данных
            const { data, error } = await supabase.rpc('get_leaderboard', { 
                limit_count: 50 
            });

            if (error) {
                // Если функция не работает, делаем запрос вручную
                console.log('Используем альтернативный запрос рейтинга');
                await this.loadRatingAlternative();
                return;
            }

            // Преобразуем данные
            this.ratingData = data.map(item => ({
                rank: item.rank,
                id: item.student_id,
                class: item.class,
                lastName: item.last_name,
                firstName: item.first_name,
                fullName: `${item.last_name} ${item.first_name}`,
                coins: item.coins,
                colorIndex: item.color_index
            }));

            // Сохраняем в кеш
            this.cache.data = this.ratingData;
            this.cache.timestamp = Date.now();

            // Рендерим
            this.renderRating();

            // Обновляем время последнего обновления
            this.updateLastUpdateTime();

        } catch (error) {
            console.error('Ошибка загрузки рейтинга:', error);
            ratingList.innerHTML = '<div class="empty-state"><span class="material-icons">error</span><p>Ошибка загрузки рейтинга</p></div>';
        }
    }

    // Альтернативный метод загрузки рейтинга (если функция не работает)
    async loadRatingAlternative() {
        try {
            const { data, error } = await supabase
                .from('students')
                .select(`
                    id,
                    class,
                    last_name,
                    first_name,
                    profiles!inner (
                        coins,
                        color_index
                    )
                `)
                .order('coins', { foreignTable: 'profiles', ascending: false })
                .limit(50);

            if (error) throw error;

            // Преобразуем данные
            this.ratingData = data.map((item, index) => ({
                rank: index + 1,
                id: item.id,
                class: item.class,
                lastName: item.last_name,
                firstName: item.first_name,
                fullName: `${item.last_name} ${item.first_name}`,
                coins: item.profiles[0]?.coins || 100,
                colorIndex: item.profiles[0]?.color_index || 0
            }));

            // Сохраняем в кеш
            this.cache.data = this.ratingData;
            this.cache.timestamp = Date.now();

            // Рендерим
            this.renderRating();

            // Обновляем время последнего обновления
            this.updateLastUpdateTime();

        } catch (error) {
            console.error('Ошибка альтернативной загрузки рейтинга:', error);
            throw error;
        }
    }

    // Отрисовка рейтинга
    renderRating() {
        const ratingList = document.getElementById('rating-list');
        if (!ratingList) return;

        // Фильтрация
        let filteredData = [...this.ratingData];
        if (this.currentFilter === 'my' && authManager.currentUser) {
            const userClass = authManager.currentUser.class;
            filteredData = filteredData.filter(item => item.class === userClass);
        }

        if (filteredData.length === 0) {
            ratingList.innerHTML = '<div class="empty-state"><span class="material-icons">leaderboard</span><p>Нет данных для отображения</p></div>';
            return;
        }

        // Генерируем HTML
        ratingList.innerHTML = filteredData.map(player => {
            const isCurrentUser = authManager.currentUser && player.id === authManager.currentUser.id;
            const rowClass = isCurrentUser ? 'current-user' : '';
            const rankClass = player.rank <= 3 ? `top-${player.rank}` : '';

            return `
                <div class="rating-row ${rowClass} ${rankClass}" data-player-id="${player.id}">
                    <div class="rank">${player.rank}</div>
                    <div class="player-avatar-small" style="background-color: ${MATERIAL_COLORS[player.colorIndex]}; color: white">
                        ${player.firstName.charAt(0)}
                    </div>
                    <div class="player-info">
                        <div class="player-name">
                            ${player.fullName}
                            ${isCurrentUser ? '<span class="you-badge">(Вы)</span>' : ''}
                        </div>
                        <div class="player-class">${player.class} класс</div>
                    </div>
                    <div class="player-coins">
                        <span class="coins-amount">${player.coins}</span>
                        <span class="material-icons coin-icon">monetization_on</span>
                    </div>
                </div>
            `;
        }).join('');

        // Добавляем обработчики кликов для просмотра деталей
        ratingList.querySelectorAll('.rating-row').forEach(row => {
            row.addEventListener('click', (e) => {
                const playerId = row.dataset.playerId;
                this.showPlayerDetails(playerId);
            });
        });
    }

    // Показ деталей игрока
    async showPlayerDetails(playerId) {
        try {
            // Получаем информацию об игроке
            const { data: player, error } = await supabase
                .from('students')
                .select(`
                    id,
                    class,
                    last_name,
                    first_name,
                    profiles!inner (
                        coins,
                        color_index,
                        last_action
                    )
                `)
                .eq('id', playerId)
                .single();

            if (error) throw error;

            // Получаем статистику сделок
            const { data: deals, error: dealsError } = await supabase
                .from('deals')
                .select('*')
                .or(`from_player.eq.${playerId},to_player.eq.${playerId}`)
                .eq('status', 'completed');

            if (dealsError) throw dealsError;

            // Рассчитываем статистику
            let totalDeals = deals.length;
            let successfulDeals = 0;
            let totalCoinsEarned = 0;
            let cooperationCount = 0;

            deals.forEach(deal => {
                const isIncoming = deal.to_player === playerId;
                const result = isIncoming ? deal.result.to_change : deal.result.from_change;
                const choice = isIncoming ? deal.choices.to : deal.choices.from;
                
                if (result > 0) successfulDeals++;
                if (choice === 'cooperate') cooperationCount++;
                totalCoinsEarned += result;
            });

            // Формируем сообщение
            const fullName = `${player.last_name} ${player.first_name}`;
            const lastSeen = new Date(player.profiles[0]?.last_action).toLocaleString('ru-RU');
            const isOnline = player.profiles[0]?.last_action && 
                (Date.now() - new Date(player.profiles[0].last_action).getTime()) < 300000; // 5 минут

            let message = `
🎮 Игрок: ${fullName}
🏫 Класс: ${player.class}
💰 Монеты: ${player.profiles[0]?.coins || 0}
📊 Место в рейтинге: ${this.ratingData.find(p => p.id == playerId)?.rank || '?'}
🕐 Статус: ${isOnline ? '🟢 Онлайн' : `⚫ Был(а) в ${lastSeen}`}

📈 Статистика сделок:
• Всего сделок: ${totalDeals}
• Успешных сделок: ${successfulDeals}
• Процент успеха: ${totalDeals > 0 ? Math.round((successfulDeals / totalDeals) * 100) : 0}%
• Сотрудничал(а): ${cooperationCount} раз
• Всего заработано: ${totalCoinsEarned > 0 ? '+' : ''}${totalCoinsEarned} монет
            `;

            // Показываем модальное окно или alert
            this.showPlayerModal(fullName, message, player.profiles[0]?.color_index || 0);

        } catch (error) {
            console.error('Ошибка получения деталей игрока:', error);
            authManager.showToast('Не удалось загрузить информацию об игроке', 'error');
        }
    }

    // Показ модального окна с деталями игрока
    showPlayerModal(playerName, details, colorIndex) {
        // Создаем модальное окно
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header" style="background: ${MATERIAL_COLORS[colorIndex]}; color: white; padding: 1rem; border-radius: 10px 10px 0 0; display: flex; align-items: center; gap: 10px;">
                    <div class="avatar-big" style="width: 50px; height: 50px; border-radius: 50%; background: white; color: ${MATERIAL_COLORS[colorIndex]}; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.5rem;">
                        ${playerName.charAt(0)}
                    </div>
                    <h3 style="margin: 0; flex: 1;">${playerName}</h3>
                    <button id="close-player-modal" class="icon-btn" style="color: white;">
                        <span class="material-icons">close</span>
                    </button>
                </div>
                <div class="modal-body" style="padding: 1rem; white-space: pre-line; font-size: 0.95rem; line-height: 1.5;">
                    ${details}
                </div>
                <div class="modal-footer" style="padding: 1rem; border-top: 1px solid #eee; text-align: right;">
                    <button id="make-deal-from-rating" class="secondary-btn" style="background: ${MATERIAL_COLORS[colorIndex]};">
                        <span class="material-icons">handshake</span>
                        Предложить сделку
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Обработчики
        document.getElementById('close-player-modal').addEventListener('click', () => {
            modal.remove();
        });

        const makeDealBtn = document.getElementById('make-deal-from-rating');
        if (makeDealBtn) {
            makeDealBtn.addEventListener('click', async () => {
                const playerId = this.ratingData.find(p => p.fullName === playerName)?.id;
                if (playerId && window.dealsManager) {
                    modal.remove();
                    await dealsManager.initiateDeal(playerId);
                }
            });
        }

        // Закрытие по клику вне модального окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // Обновление времени последнего обновления
    updateLastUpdateTime() {
        const lastUpdateEl = document.getElementById('last-update');
        if (lastUpdateEl) {
            const now = new Date();
            lastUpdateEl.textContent = now.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            // Анимация обновления
            lastUpdateEl.classList.add('updated');
            setTimeout(() => {
                lastUpdateEl.classList.remove('updated');
            }, 1000);
        }
    }

    // Обновление позиции текущего пользователя в рейтинге
    updateUserPosition() {
        if (!authManager.currentUser) return;

        const userIndex = this.ratingData.findIndex(p => p.id === authManager.currentUser.id);
        if (userIndex !== -1) {
            const userRank = this.ratingData[userIndex].rank;
            
            // Можно показывать уведомление при улучшении позиции
            const lastRank = localStorage.getItem('last_known_rank');
            if (lastRank && parseInt(lastRank) > userRank) {
                authManager.showToast(`Вы поднялись на ${parseInt(lastRank) - userRank} позицию(й) в рейтинге!`, 'success');
            }
            
            localStorage.setItem('last_known_rank', userRank);
        }
    }

    // Автоматическое обновление рейтинга
    startAutoRefresh() {
        // Обновляем каждые 60 секунд
        setInterval(() => {
            if (document.getElementById('rating-tab').classList.contains('active')) {
                this.loadRating();
            }
        }, 60000);
    }

    // Получение текущей позиции пользователя
    getCurrentUserRank() {
        if (!authManager.currentUser) return null;
        
        const userData = this.ratingData.find(p => p.id === authManager.currentUser.id);
        return userData ? userData.rank : null;
    }

    // Получение топ-3 игроков
    getTopThree() {
        return this.ratingData.slice(0, 3);
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    window.ratingManager = new RatingManager();
    
    // Загружаем рейтинг, если пользователь авторизован
    if (authManager && authManager.currentUser) {
        ratingManager.loadRating();
        ratingManager.startAutoRefresh();
    }
});