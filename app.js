// Импортируем все модули
import { supabase, getPlayerCode, clearPlayerCode } from './supabase.js';

// Функции авторизации
async function loginPlayer(code) {
    try {
        console.log('Попытка входа с кодом:', code);
        
        // Сначала проверяем, существует ли игрок
        const { data: playerData, error: playerError } = await supabase
            .from('players')
            .select('*')
            .eq('code', code)
            .single();
        
        if (playerError || !playerData) {
            console.error('Игрок не найден:', playerError);
            return { success: false, error: 'Неверный код игрока' };
        }
        
        console.log('Игрок найден:', playerData);
        
        // Активируем игрока и назначаем цвет
        const colorPalette = [
            '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
            '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50',
            '#FF9800', '#FF5722', '#795548', '#607D8B'
        ];
        
        const colorIndex = parseInt(code) % colorPalette.length;
        const playerColor = colorPalette[colorIndex];
        
        const { data: updatedPlayer, error: updateError } = await supabase
            .from('players')
            .update({ 
                is_active: true, 
                last_login: new Date().toISOString(),
                color: playerColor
            })
            .eq('code', code)
            .select()
            .single();
        
        if (updateError) {
            console.error('Ошибка обновления игрока:', updateError);
            return { success: false, error: 'Ошибка активации игрока' };
        }
        
        console.log('Игрок активирован:', updatedPlayer);
        
        // Сохраняем код игрока
        setPlayerCode(code);
        
        return { 
            success: true, 
            player: updatedPlayer,
            message: 'Успешный вход!'
        };
    } catch (error) {
        console.error('Ошибка входа:', error);
        return { success: false, error: 'Ошибка при входе в систему' };
    }
}

function logoutPlayer() {
    clearPlayerCode();
}

async function getCurrentPlayer(code) {
    const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('code', code)
        .single();
    
    if (error) {
        console.error('Ошибка получения данных игрока:', error);
        return { data: null, error };
    }
    
    return { data, error: null };
}

// Функции для работы с игроками
async function loadPlayersList() {
    const playerCode = getPlayerCode();
    if (!playerCode) {
        console.log('Нет кода игрока');
        return;
    }

    try {
        console.log('Загрузка списка игроков...');
        
        // Получаем текущего игрока
        const { data: currentPlayer, error: playerError } = await supabase
            .from('players')
            .select('id, code')
            .eq('code', playerCode)
            .single();
        
        if (playerError) {
            console.error('Ошибка получения текущего игрока:', playerError);
            throw playerError;
        }

        // Получаем всех активных игроков кроме текущего
        const { data: players, error: playersError } = await supabase
            .from('players')
            .select('id, color, coins, code')
            .eq('is_active', true)
            .neq('code', playerCode);
        
        if (playersError) {
            console.error('Ошибка получения списка игроков:', playersError);
            throw playersError;
        }

        const playersList = document.getElementById('players-list');
        playersList.innerHTML = '';

        console.log('Найдено игроков:', players?.length || 0);

        if (!players || players.length === 0) {
            playersList.innerHTML = '<div class="player-card"><div style="text-align: center; padding: 20px;">Нет активных игроков</div></div>';
            return;
        }

        // Для каждого игрока создаем карточку
        for (const player of players) {
            // Считаем количество сделок с этим игроком
            const { count: incomingCount } = await supabase
                .from('deals')
                .select('*', { count: 'exact', head: true })
                .eq('from_player_id', player.id)
                .eq('to_player_id', currentPlayer.id)
                .in('status', ['pending', 'completed']);

            const { count: outgoingCount } = await supabase
                .from('deals')
                .select('*', { count: 'exact', head: true })
                .eq('from_player_id', currentPlayer.id)
                .eq('to_player_id', player.id)
                .in('status', ['pending', 'completed']);

            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            playerCard.innerHTML = `
                <div class="player-header">
                    <div class="player-color" style="background-color: ${player.color || '#666'};"></div>
                    <div class="player-name">Игрок</div>
                </div>
                <div class="deal-indicators">
                    <div class="indicator">
                        <div class="label">Входящие сделки</div>
                        <div class="count">${incomingCount || 0}/5</div>
                    </div>
                    <div class="indicator">
                        <div class="label">Исходящие сделки</div>
                        <div class="count">${outgoingCount || 0}/5</div>
                    </div>
                </div>
                <button class="deal-btn" data-player-code="${player.code}">
                    Предложить сделку
                </button>
            `;
            playersList.appendChild(playerCard);
        }

        // Добавляем обработчики кнопок сделок
        document.querySelectorAll('.deal-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const playerCode = e.target.dataset.playerCode;
                console.log('Предложение сделки игроку с кодом:', playerCode);
                await openDealModal(playerCode);
            });
        });

    } catch (error) {
        console.error('Ошибка загрузки списка игроков:', error);
        const playersList = document.getElementById('players-list');
        playersList.innerHTML = '<div class="player-card"><div style="text-align: center; padding: 20px; color: #ff4757;">Ошибка загрузки игроков</div></div>';
    }
}

async function openDealModal(partnerCode) {
    const playerCode = getPlayerCode();
    if (!playerCode) return;

    try {
        console.log('Открытие модального окна для сделки с кодом:', partnerCode);
        
        // Получаем данные партнера
        const { data: partner, error: partnerError } = await supabase
            .from('players')
            .select('id, color')
            .eq('code', partnerCode)
            .single();

        if (partnerError || !partner) {
            console.error('Партнер не найден:', partnerError);
            alert('Игрок не найден');
            return;
        }

        // Получаем данные текущего игрока
        const { data: currentPlayer } = await supabase
            .from('players')
            .select('id')
            .eq('code', playerCode)
            .single();

        if (!currentPlayer) {
            console.error('Текущий игрок не найден');
            return;
        }

        // Загружаем историю сделок
        const { data: history } = await supabase
            .from('deals')
            .select('*')
            .or(`and(from_player_id.eq.${currentPlayer.id},to_player_id.eq.${partner.id}),and(from_player_id.eq.${partner.id},to_player_id.eq.${currentPlayer.id})`)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })
            .limit(10);

        // Обновляем модальное окно
        document.getElementById('deal-partner').textContent = 'Игрок';
        document.getElementById('deal-partner').style.color = partner.color || '#666';

        const historyList = document.getElementById('deal-history-list');
        historyList.innerHTML = '';

        if (history && history.length > 0) {
            history.forEach(deal => {
                const isIncoming = deal.from_player_id === partner.id;
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                
                let resultText = '';
                let resultClass = '';
                
                if (deal.from_choice === 'cooperate' && deal.to_choice === 'cooperate') {
                    resultText = 'Оба сотрудничали: +2/+2';
                    resultClass = 'good';
                } else if (deal.from_choice === 'cooperate' && deal.to_choice === 'cheat') {
                    resultText = isIncoming ? 
                        'Вы доверяли: -1, партнёр жульничал: +3' : 
                        'Вы жульничали: +3, партнёр доверял: -1';
                    resultClass = isIncoming ? 'bad' : 'good';
                } else if (deal.from_choice === 'cheat' && deal.to_choice === 'cooperate') {
                    resultText = isIncoming ? 
                        'Вы жульничали: +3, партнёр доверял: -1' : 
                        'Вы доверяли: -1, партнёр жульничал: +3';
                    resultClass = isIncoming ? 'good' : 'bad';
                } else {
                    resultText = 'Оба жульничали: -1/-1';
                    resultClass = 'bad';
                }

                historyItem.innerHTML = `
                    <div>${isIncoming ? 'Входящая' : 'Исходящая'}</div>
                    <div class="${resultClass}">${resultText}</div>
                `;
                historyList.appendChild(historyItem);
            });
        } else {
            historyList.innerHTML = '<div class="history-item">Нет завершённых сделок с этим игроком</div>';
        }

        // Показываем модальное окно
        const modal = document.getElementById('deal-modal');
        modal.classList.add('active');

        // Обработчики выбора
        const choiceButtons = modal.querySelectorAll('.choice-btn');
        choiceButtons.forEach(btn => {
            const originalOnClick = btn.onclick;
            btn.onclick = async () => {
                const choice = btn.dataset.choice;
                console.log('Выбор сделки:', choice, 'с партнером:', partnerCode);
                await createDeal(partnerCode, choice);
                modal.classList.remove('active');
            };
        });

    } catch (error) {
        console.error('Ошибка открытия модального окна:', error);
        alert('Ошибка при открытии модального окна');
    }
}

async function createDeal(partnerCode, choice) {
    const playerCode = getPlayerCode();
    if (!playerCode) return;

    try {
        console.log('Создание сделки с партнером:', partnerCode, 'выбор:', choice);
        
        // Получаем ID игроков
        const { data: currentPlayer } = await supabase
            .from('players')
            .select('id')
            .eq('code', playerCode)
            .single();

        const { data: partner } = await supabase
            .from('players')
            .select('id')
            .eq('code', partnerCode)
            .single();

        if (!currentPlayer || !partner) {
            alert('Ошибка: игрок не найден');
            return;
        }

        // Проверяем лимит сделок (5 с одним игроком)
        const { count: existingDeals } = await supabase
            .from('deals')
            .select('*', { count: 'exact', head: true })
            .or(`and(from_player_id.eq.${currentPlayer.id},to_player_id.eq.${partner.id}),and(from_player_id.eq.${partner.id},to_player_id.eq.${currentPlayer.id})`)
            .in('status', ['pending', 'completed']);

        if (existingDeals >= 10) { // 5 входящих + 5 исходящих
            alert('Лимит сделок с этим игроком исчерпан (максимум 5 входящих и 5 исходящих)');
            return;
        }

        // Создаем сделку
        const { data, error } = await supabase
            .from('deals')
            .insert({
                from_player_id: currentPlayer.id,
                to_player_id: partner.id,
                from_choice: choice,
                status: 'pending',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('Ошибка создания сделки:', error);
            alert('Ошибка при создании сделки: ' + error.message);
            return;
        }

        console.log('Сделка создана:', data);
        alert('Сделка предложена! Ждите ответа от игрока.');
        
        // Обновляем списки
        await loadPlayersList();
        await loadPendingDeals();

    } catch (error) {
        console.error('Ошибка создания сделки:', error);
        alert('Ошибка при создании сделки');
    }
}

// Функции для работы со сделками
async function loadPendingDeals() {
    const playerCode = getPlayerCode();
    if (!playerCode) return;

    try {
        // Получаем текущего игрока
        const { data: currentPlayer } = await supabase
            .from('players')
            .select('id')
            .eq('code', playerCode)
            .single();

        if (!currentPlayer) return;

        // Получаем ожидающие сделки
        const { data: deals, error } = await supabase
            .from('deals')
            .select(`
                *,
                from_player:players!deals_from_player_id_fkey (
                    id,
                    color
                )
            `)
            .eq('to_player_id', currentPlayer.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const pendingList = document.getElementById('pending-deals');
        pendingList.innerHTML = '';

        if (deals && deals.length > 0) {
            deals.forEach(deal => {
                const dealItem = document.createElement('div');
                dealItem.className = 'deal-item';
                dealItem.innerHTML = `
                    <div class="deal-partner">
                        <div class="player-color" style="background-color: ${deal.from_player?.color || '#666'};"></div>
                        <span>Игрок предлагает сделку</span>
                    </div>
                    <button class="accept-btn" data-deal-id="${deal.id}">
                        Принять
                    </button>
                `;
                pendingList.appendChild(dealItem);
            });

            // Добавляем обработчики кнопок
            document.querySelectorAll('.accept-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const dealId = e.target.dataset.dealId;
                    console.log('Принятие сделки ID:', dealId);
                    await openDealAcceptModal(dealId);
                });
            });
        } else {
            pendingList.innerHTML = '<div class="deal-item">Нет ожидающих сделок</div>';
        }
    } catch (error) {
        console.error('Ошибка загрузки ожидающих сделок:', error);
        const pendingList = document.getElementById('pending-deals');
        pendingList.innerHTML = '<div class="deal-item" style="color: #ff4757;">Ошибка загрузки сделок</div>';
    }
}

async function loadCompletedDeals() {
    const playerCode = getPlayerCode();
    if (!playerCode) return;

    try {
        const { data: currentPlayer } = await supabase
            .from('players')
            .select('id')
            .eq('code', playerCode)
            .single();

        if (!currentPlayer) return;

        // Получаем завершенные сделки
        const { data: deals, error } = await supabase
            .from('deals')
            .select(`
                *,
                from_player:players!deals_from_player_id_fkey (
                    id,
                    color
                ),
                to_player:players!deals_to_player_id_fkey (
                    id,
                    color
                )
            `)
            .eq('status', 'completed')
            .or(`from_player_id.eq.${currentPlayer.id},to_player_id.eq.${currentPlayer.id}`)
            .order('completed_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        const completedList = document.getElementById('completed-deals');
        completedList.innerHTML = '';

        if (deals && deals.length > 0) {
            deals.forEach(deal => {
                const isIncoming = deal.to_player_id === currentPlayer.id;
                const partnerColor = isIncoming ? 
                    (deal.from_player?.color || '#666') : 
                    (deal.to_player?.color || '#666');
                
                let resultText = '';
                let resultClass = '';
                
                if (deal.from_choice === 'cooperate' && deal.to_choice === 'cooperate') {
                    resultText = 'Оба сотрудничали';
                    resultClass = 'good';
                } else if (deal.from_choice === 'cooperate' && deal.to_choice === 'cheat') {
                    resultText = isIncoming ? 'Вас обманули' : 'Вы обманули';
                    resultClass = isIncoming ? 'bad' : 'good';
                } else if (deal.from_choice === 'cheat' && deal.to_choice === 'cooperate') {
                    resultText = isIncoming ? 'Вы обманули' : 'Вас обманули';
                    resultClass = isIncoming ? 'good' : 'bad';
                } else {
                    resultText = 'Оба обманули';
                    resultClass = 'bad';
                }

                const coinsChange = isIncoming ? (deal.coins_to || 0) : (deal.coins_from || 0);
                const coinsText = coinsChange > 0 ? `+${coinsChange}` : coinsChange;

                const dealItem = document.createElement('div');
                dealItem.className = 'deal-item';
                dealItem.innerHTML = `
                    <div class="deal-partner">
                        <div class="player-color" style="background-color: ${partnerColor};"></div>
                        <div>
                            <div>${isIncoming ? 'Входящая' : 'Исходящая'} сделка</div>
                            <small class="${resultClass}">${resultText}</small>
                        </div>
                    </div>
                    <div style="font-weight: 600; color: ${coinsChange > 0 ? '#4cd964' : '#ff4757'}">
                        ${coinsText} монет
                    </div>
                `;
                completedList.appendChild(dealItem);
            });
        } else {
            completedList.innerHTML = '<div class="deal-item">Нет завершённых сделок</div>';
        }
    } catch (error) {
        console.error('Ошибка загрузки истории сделок:', error);
    }
}

async function openDealAcceptModal(dealId) {
    const playerCode = getPlayerCode();
    if (!playerCode) return;

    try {
        console.log('Открытие модального окна для принятия сделки ID:', dealId);
        
        // Получаем данные сделки
        const { data: deal, error } = await supabase
            .from('deals')
            .select(`
                *,
                from_player:players!deals_from_player_id_fkey (
                    id,
                    color
                )
            `)
            .eq('id', dealId)
            .single();

        if (error || !deal) {
            console.error('Сделка не найдена:', error);
            alert('Сделка не найдена');
            return;
        }

        // Получаем текущего игрока
        const { data: currentPlayer } = await supabase
            .from('players')
            .select('id')
            .eq('code', playerCode)
            .single();

        if (!currentPlayer) {
            console.error('Текущий игрок не найден');
            return;
        }

        // Проверяем, что сделка предназначена текущему игроку
        if (deal.to_player_id !== currentPlayer.id) {
            alert('Эта сделка предназначена не вам');
            return;
        }

        // Загружаем историю сделок с этим игроком
        const { data: history } = await supabase
            .from('deals')
            .select('*')
            .or(`and(from_player_id.eq.${deal.from_player_id},to_player_id.eq.${currentPlayer.id}),and(from_player_id.eq.${currentPlayer.id},to_player_id.eq.${deal.from_player_id})`)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false });

        // Обновляем модальное окно
        document.getElementById('deal-partner').textContent = 'Игрок';
        document.getElementById('deal-partner').style.color = deal.from_player?.color || '#666';

        const historyList = document.getElementById('deal-history-list');
        historyList.innerHTML = '';

        if (history && history.length > 0) {
            history.forEach(h => {
                const isIncoming = h.from_player_id === deal.from_player_id;
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                
                let resultText = '';
                let resultClass = '';
                
                if (h.from_choice === 'cooperate' && h.to_choice === 'cooperate') {
                    resultText = 'Оба сотрудничали: +2/+2';
                    resultClass = 'good';
                } else if (h.from_choice === 'cooperate' && h.to_choice === 'cheat') {
                    resultText = isIncoming ? 
                        'Вы доверяли: -1, партнёр жульничал: +3' : 
                        'Вы жульничали: +3, партнёр доверял: -1';
                    resultClass = isIncoming ? 'bad' : 'good';
                } else if (h.from_choice === 'cheat' && h.to_choice === 'cooperate') {
                    resultText = isIncoming ? 
                        'Вы жульничали: +3, партнёр доверял: -1' : 
                        'Вы доверяли: -1, партнёр жульничал: +3';
                    resultClass = isIncoming ? 'good' : 'bad';
                } else {
                    resultText = 'Оба жульничали: -1/-1';
                    resultClass = 'bad';
                }

                historyItem.innerHTML = `
                    <div>${isIncoming ? 'Входящая' : 'Исходящая'}</div>
                    <div class="${resultClass}">${resultText}</div>
                `;
                historyList.appendChild(historyItem);
            });
        } else {
            historyList.innerHTML = '<div class="history-item">Нет завершённых сделок с этим игроком</div>';
        }

        // Показываем модальное окно
        const modal = document.getElementById('deal-modal');
        modal.classList.add('active');

        // Обработчики выбора
        const choiceButtons = modal.querySelectorAll('.choice-btn');
        choiceButtons.forEach(btn => {
            const originalOnClick = btn.onclick;
            btn.onclick = async () => {
                const choice = btn.dataset.choice;
                console.log('Завершение сделки ID:', dealId, 'выбор:', choice);
                await completeDeal(dealId, choice);
                modal.classList.remove('active');
            };
        });

    } catch (error) {
        console.error('Ошибка открытия модального окна:', error);
        alert('Ошибка при загрузке данных сделки');
    }
}

async function completeDeal(dealId, choice) {
    try {
        console.log('Завершение сделки ID:', dealId, 'выбор второго игрока:', choice);
        
        const { data: deal, error: dealError } = await supabase
            .from('deals')
            .select('*')
            .eq('id', dealId)
            .single();

        if (dealError || !deal) {
            console.error('Сделка не найдена:', dealError);
            alert('Сделка не найдена');
            return;
        }

        // Обновляем выбор второго игрока
        const { error: updateError } = await supabase
            .from('deals')
            .update({
                to_choice: choice,
                status: 'completed',
                completed_at: new Date().toISOString()
            })
            .eq('id', dealId);

        if (updateError) {
            console.error('Ошибка обновления сделки:', updateError);
            alert('Ошибка при завершении сделки');
            return;
        }

        // Вычисляем результат
        let resultFrom = 0;
        let resultTo = 0;
        
        if (deal.from_choice === 'cooperate' && choice === 'cooperate') {
            resultFrom = 2;
            resultTo = 2;
        } else if (deal.from_choice === 'cooperate' && choice === 'cheat') {
            resultFrom = -1;
            resultTo = 3;
        } else if (deal.from_choice === 'cheat' && choice === 'cooperate') {
            resultFrom = 3;
            resultTo = -1;
        } else { // оба жульничают
            resultFrom = -1;
            resultTo = -1;
        }

        // Обновляем монеты игроков
        const { error: fromError } = await supabase.rpc('increment_coins', {
            player_id: deal.from_player_id,
            amount: resultFrom
        });

        const { error: toError } = await supabase.rpc('increment_coins', {
            player_id: deal.to_player_id,
            amount: resultTo
        });

        if (fromError || toError) {
            console.error('Ошибка обновления монет:', fromError || toError);
            // Если функция RPC не существует, обновим напрямую
            const { data: fromPlayer } = await supabase
                .from('players')
                .select('coins')
                .eq('id', deal.from_player_id)
                .single();

            const { data: toPlayer } = await supabase
                .from('players')
                .select('coins')
                .eq('id', deal.to_player_id)
                .single();

            if (fromPlayer) {
                await supabase
                    .from('players')
                    .update({ coins: fromPlayer.coins + resultFrom })
                    .eq('id', deal.from_player_id);
            }

            if (toPlayer) {
                await supabase
                    .from('players')
                    .update({ coins: toPlayer.coins + resultTo })
                    .eq('id', deal.to_player_id);
            }
        }

        // Обновляем сделку с результатами
        await supabase
            .from('deals')
            .update({
                coins_from: resultFrom,
                coins_to: resultTo
            })
            .eq('id', dealId);

        console.log('Сделка завершена успешно');
        alert('Сделка завершена!');
        
        // Обновляем все списки и счет монет
        await loadPlayersList();
        await loadPendingDeals();
        await loadCompletedDeals();
        
        // Обновляем счет монет текущего игрока
        const playerCode = getPlayerCode();
        if (playerCode) {
            const { data: player } = await supabase
                .from('players')
                .select('coins')
                .eq('code', playerCode)
                .single();
            
            if (player) {
                document.getElementById('coins-count').textContent = player.coins;
            }
        }

    } catch (error) {
        console.error('Ошибка завершения сделки:', error);
        alert('Ошибка при завершении сделки');
    }
}

// Основная логика приложения
async function handleLogin() {
    const code = document.getElementById('player-code').value.trim();
    const errorEl = document.getElementById('login-error');
    
    // Валидация кода
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
        errorEl.textContent = 'Введите 6-значный числовой код';
        errorEl.style.display = 'block';
        return;
    }
    
    errorEl.style.display = 'none';
    
    const { success, player, error } = await loginPlayer(code);
    
    if (success) {
        console.log('Вход успешен:', player);
        showGameScreen(player);
    } else {
        errorEl.textContent = error || 'Ошибка входа';
        errorEl.style.display = 'block';
    }
}

function showGameScreen(player) {
    console.log('Показ игрового экрана для игрока:', player);
    
    // Переключаем экраны
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    
    // Обновляем информацию игрока
    document.getElementById('player-color-indicator').style.backgroundColor = player.color || '#666';
    document.getElementById('coins-count').textContent = player.coins || 0;
    
    // Загружаем начальные данные
    loadPlayersList();
    loadPendingDeals();
    loadCompletedDeals();
    
    // Запускаем периодическое обновление данных
    startDataPolling();
}

function handleLogout() {
    console.log('Выход из игры');
    logoutPlayer();
    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('player-code').value = '';
    document.getElementById('login-error').style.display = 'none';
    stopDataPolling();
}

function switchTab(tabName) {
    console.log('Переключение на вкладку:', tabName);
    
    // Обновляем активные кнопки
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Показываем активную вкладку
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
    
    // Загружаем данные для вкладки
    if (tabName === 'players') {
        loadPlayersList();
    } else if (tabName === 'deals') {
        loadPendingDeals();
        loadCompletedDeals();
    }
}

// Фоновая проверка обновлений
let pollingInterval;
function startDataPolling() {
    console.log('Запуск периодического обновления данных');
    pollingInterval = setInterval(async () => {
        const playerCode = getPlayerCode();
        if (playerCode) {
            // Обновляем счет монет
            const { data: player } = await getCurrentPlayer(playerCode);
            if (player) {
                document.getElementById('coins-count').textContent = player.coins;
            }
            
            // Обновляем данные на активной вкладке
            const activeTab = document.querySelector('.tab-btn.active');
            if (activeTab) {
                const tabName = activeTab.dataset.tab;
                if (tabName === 'players') {
                    loadPlayersList();
                } else if (tabName === 'deals') {
                    loadPendingDeals();
                    loadCompletedDeals();
                }
            }
        }
    }, 5000); // Обновление каждые 5 секунд
}

function stopDataPolling() {
    console.log('Остановка периодического обновления данных');
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Документ загружен, инициализация приложения...');
    
    // Проверяем, авторизован ли пользователь
    const playerCode = getPlayerCode();
    if (playerCode) {
        console.log('Найден сохраненный код игрока:', playerCode);
        const { data: player } = await getCurrentPlayer(playerCode);
        if (player && player.is_active) {
            showGameScreen(player);
        } else {
            console.log('Игрок не активен или не найден, очищаем код');
            clearPlayerCode();
        }
    }

    // Обработчики событий
    setupEventListeners();
});

function setupEventListeners() {
    console.log('Настройка обработчиков событий...');
    
    // Вход в игру
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }
    
    const playerCodeInput = document.getElementById('player-code');
    if (playerCodeInput) {
        playerCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }
    
    // Выход из игры
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Переключение вкладок
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });
    
    // Закрытие модального окна
    const closeModalBtn = document.querySelector('.close-modal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            document.getElementById('deal-modal').classList.remove('active');
        });
    }
    
    // Закрытие модального окна при клике на фон
    const modal = document.getElementById('deal-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    }
    
    // Закрытие модального окна при нажатии Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.getElementById('deal-modal').classList.remove('active');
        }
    });
}

// Экспортируем функции для отладки
window.app = {
    loginPlayer,
    logoutPlayer,
    loadPlayersList,
    loadPendingDeals,
    loadCompletedDeals,
    openDealModal,
    createDeal,
    completeDeal,
    getCurrentPlayer,
    switchTab
};