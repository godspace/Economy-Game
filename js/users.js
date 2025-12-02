// users.js - ОБНОВЛЕННЫЙ ФАЙЛ С ФУНКЦИОНАЛОМ ПЕРЕВОДА ДЛЯ АДМИНОВ
import { state, dom, cache, shouldUpdate, markUpdated } from './config.js';

// Импортируем функцию из deals.js
import { getTodayDealsCount } from './deals.js';

export async function loadUserProfile(userId) {
    try {
        if (!state.supabase) {
            console.error('Supabase not initialized');
            return null;
        }
        
        const { data: profile, error } = await state.supabase
            .from('profiles')
            .select('id, username, coins, reputation')
            .eq('id', userId)
            .single();
        
        if (error) {
            console.error('Ошибка загрузки профиля:', error);
            return null;
        }
        
        // ИСПРАВЛЕНИЕ: Обновляем состояние только если это текущий пользователь
        if (state.currentUserProfile && state.currentUserProfile.id === userId) {
            state.currentUserProfile = { ...state.currentUserProfile, ...profile };
            updateUserProfileDisplay();
        }
        
        return profile;
        
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        return null;
    }
}

// Функция для обновления отображения профиля пользователя
function updateUserProfileDisplay() {
    if (!state.currentUserProfile) return;
    
    if (dom.userGreeting) {
        dom.userGreeting.textContent = `Привет, ${state.currentUserProfile.username}!`;
    }
    if (dom.userAvatar) {
        dom.userAvatar.textContent = state.currentUserProfile.username.charAt(0).toUpperCase();
    }
    if (dom.coinsValue) {
        dom.coinsValue.textContent = state.currentUserProfile.coins;
    }
    if (dom.reputationValue) {
        dom.reputationValue.textContent = state.currentUserProfile.reputation;
    }
}

export async function loadUsers(forceRefresh = false) {
    try {
        if (!state.supabase || !state.isAuthenticated || !state.currentUserProfile) {
            console.error('Supabase or authentication not initialized');
            return;
        }
        
        // Показываем индикатор загрузки
        if (dom.usersList) {
            dom.usersList.classList.add('loading');
        }
        
        // ОПТИМИЗАЦИЯ: Проверяем статус буста только при принудительном обновлении или если прошло больше 5 минут
        if (forceRefresh || !state.lastBoostCheck || (Date.now() - state.lastBoostCheck > 5 * 60 * 1000)) {
            try {
                const { updateBoostStatus, deactivateExhaustedBoosts } = await import('./shop.js');
                await updateBoostStatus();
                // Дополнительная проверка исчерпанных бустов
                await deactivateExhaustedBoosts(state.currentUserProfile.id);
                state.lastBoostCheck = Date.now();
            } catch (error) {
                console.error('Error updating boost status in users tab:', error);
            }
        }
        
        // Проверка кэша
        const now = Date.now();
        if (!forceRefresh && cache.users.data && 
            (now - cache.users.timestamp < cache.users.ttl) &&
            shouldUpdate('users')) {
            renderUsers(cache.users.data);
            if (dom.usersList) {
                dom.usersList.classList.remove('loading');
            }
            return;
        }
        
        const searchTerm = dom.searchInput ? dom.searchInput.value.trim() : '';
        const selectedClass = dom.classFilter ? dom.classFilter.value : '';
        
        let query = state.supabase
            .from('profiles')
            .select('id, username, class, coins, reputation')
            .neq('id', state.currentUserProfile.id)
            .limit(50);
        
        if (searchTerm) {
            query = query.ilike('username', `%${searchTerm}%`);
        }
        
        if (selectedClass && selectedClass !== 'all') {
            query = query.eq('class', selectedClass);
        }
        
        const { data: users, error } = await query;
        
        if (error) {
            console.error('Ошибка загрузки пользователей:', error);
            renderUsersError('Не удалось загрузить пользователей');
            return;
        }
        
        // Сохраняем в кэш
        cache.users.data = users;
        cache.users.timestamp = now;
        markUpdated('users');
        
        renderUsers(users);
        
        // После загрузки пользователей показываем информацию о лимитах
        await renderLimitInfo();
        
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        renderUsersError('Ошибка при загрузке пользователей');
    } finally {
        // Скрываем индикатор загрузки
        if (dom.usersList) {
            dom.usersList.classList.remove('loading');
        }
    }
}

function renderUsers(users) {
    if (!dom.usersList) return;
    
    try {
        dom.usersList.innerHTML = '';
        
        if (!users || users.length === 0) {
            renderEmptyUsersState();
            return;
        }
        
        const fragment = document.createDocumentFragment();
        
        users.forEach(user => {
            const userCard = createUserCard(user);
            fragment.appendChild(userCard);
        });
        
        dom.usersList.appendChild(fragment);
        
        // Добавляем обработчики событий после рендеринга
        setTimeout(() => {
            attachUserCardEventListeners();
        }, 0);
        
    } catch (error) {
        console.error('Ошибка рендеринга пользователей:', error);
        renderUsersError('Ошибка отображения пользователей');
    }
}

function createUserCard(user) {
    const userCard = document.createElement('div');
    userCard.className = 'user-card';
    
    // РАЗДЕЛЕНИЕ ЛОГИКИ ДЛЯ АДМИНОВ И ОБЫЧНЫХ ПОЛЬЗОВАТЕЛЕЙ
    if (state.isAdmin) {
        // ЛОГИКА ДЛЯ АДМИНА - кнопка "Перевод"
        userCard.innerHTML = `
            <div class="user-avatar">${escapeHtml(user.username.charAt(0).toUpperCase())}</div>
            <div class="user-name">${escapeHtml(user.username)}</div>
            <div class="user-details">
                <div class="user-detail">
                    <i class="fas fa-users"></i>
                    <span>${escapeHtml(user.class || 'Не указан')}</span>
                </div>
                <div class="user-detail">
                    <i class="fas fa-coins"></i>
                    <span>${user.coins}</span>
                </div>
                <div class="user-detail">
                    <i class="fas fa-star"></i>
                    <span>${user.reputation}</span>
                </div>
            </div>
            <button class="btn-primary admin-transfer-btn" 
                    data-user-id="${user.id}" 
                    data-user-name="${escapeHtml(user.username)}">
                <i class="fas fa-money-bill-wave"></i> Перевод 5 монет
            </button>
        `;
    } else {
        // ЛОГИКА ДЛЯ ОБЫЧНОГО ПОЛЬЗОВАТЕЛЯ - кнопка "Сделка"
        const currentUserHasCoins = state.currentUserProfile.coins > 0;
        const targetUserHasCoins = user.coins > 0;
        
        // НОВАЯ ПРОВЕРКА: Запрет сделок внутри класса (только если оба указали класс и он одинаковый)
        const currentUserClass = state.currentUserProfile.class;
        const targetUserClass = user.class;
        const sameClass = currentUserClass && 
                          targetUserClass && 
                          currentUserClass === targetUserClass;
        
        let buttonClass = 'btn-secondary';
        let buttonText = 'Сделка';
        let disabled = false;
        let tooltip = '';
        
        if (!currentUserHasCoins) {
            buttonClass = 'btn-secondary btn-disabled';
            buttonText = 'У вас нет монет';
            disabled = true;
            tooltip = 'title="Для совершения сделки нужна хотя бы 1 монета"';
        } else if (!targetUserHasCoins) {
            buttonClass = 'btn-secondary btn-disabled';
            buttonText = 'У игрока нет монет';
            disabled = true;
            tooltip = 'title="Игрок должен иметь монеты для сделки"';
        } else if (sameClass) {
            // ЕСЛИ ОДИН КЛАСС И ОБА УКАЗАНЫ - ЗАПРЕЩАЕМ
            buttonClass = 'btn-secondary btn-disabled';
            buttonText = 'Один класс';
            disabled = true;
            tooltip = 'title="Сделки внутри одного класса запрещены"';
        }
        
        userCard.innerHTML = `
            <div class="user-avatar">${escapeHtml(user.username.charAt(0).toUpperCase())}</div>
            <div class="user-name">${escapeHtml(user.username)}</div>
            <div class="user-details">
                <div class="user-detail">
                    <i class="fas fa-users"></i>
                    <span>${escapeHtml(user.class || 'Не указан')}</span>
                </div>
                <div class="user-detail">
                    <i class="fas fa-coins"></i>
                    <span>${user.coins}</span>
                </div>
                <div class="user-detail">
                    <i class="fas fa-star"></i>
                    <span>${user.reputation}</span>
                </div>
            </div>
            <button class="${buttonClass} propose-deal-btn" 
                    data-user-id="${user.id}" 
                    data-user-name="${escapeHtml(user.username)}"
                    ${disabled ? 'disabled' : ''}
                    ${tooltip}>
                <i class="fas fa-handshake"></i> ${buttonText}
            </button>
        `;
    }
    
    return userCard;
}

function attachUserCardEventListeners() {
    // Обработчики для обычных пользователей (сделки)
    document.querySelectorAll('.propose-deal-btn:not(:disabled)').forEach(btn => {
        btn.addEventListener('click', async function() {
            const userId = this.dataset.userId;
            const userName = this.dataset.userName;
            
            // Показываем индикатор загрузки на кнопке
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка...';
            this.disabled = true;
            
            try {
                console.log('🔄 Начало обработки клика на сделку с игроком:', userName);
                
                // Дополнительная проверка на одинаковый класс (на всякий случай)
                if (state.currentUserProfile.class && 
                    state.currentUserProfile.class === this.dataset.userClass) {
                    console.log('❌ Попытка сделки внутри класса');
                    alert(`❌ Сделки внутри класса "${state.currentUserProfile.class}" запрещены.`);
                    return;
                }
                
                // Проверяем лимит уникальных игроков перед открытием сделки
                const limitCheck = await checkUniquePlayersLimit(userId);
                console.log('📊 Результат проверки лимита:', limitCheck);
                
                // Проверяем количество сделок с этим игроком
                const todayDealsCount = await getTodayDealsCount(userId);
                const isFamiliarPlayer = todayDealsCount > 0;
                
                console.log('👥 Информация об игроке:', {
                    isFamiliarPlayer: isFamiliarPlayer,
                    todayDealsCount: todayDealsCount,
                    availableSlots: limitCheck.availableSlots
                });
                
                // ПРОВЕРКА 1: Лимит сделок с конкретным игроком (5 сделок)
                if (todayDealsCount >= 5) {
                    console.log('❌ Превышен лимит сделок с игроком');
                    alert(`Вы уже совершили максимальное количество сделок (5) с игроком ${userName} сегодня. Попробуйте завтра или выберите другого игрока.`);
                    return;
                }
                
                // ПРОВЕРКА 2: Лимит уникальных игроков (только для НОВЫХ игроков)
                if (!isFamiliarPlayer && limitCheck.availableSlots <= 0) {
                    console.log('❌ Исчерпан лимит уникальных игроков для нового игрока');
                    alert(`Лимит уникальных игроков исчерпан! Вы не можете начать сделку с новым игроком ${userName}.\n\nЛимит уникальных игроков: ${limitCheck.usedSlots}/${limitCheck.baseLimit + limitCheck.boostLimit}\n\n💡 Вы можете продолжить сделки с уже знакомыми игроками.`);
                    return;
                }
                
                console.log('✅ Все проверки пройдены, открываем модальное окно');
                
                // Динамический импорт для разрыва циклической зависимости
                const { showDealModal } = await import('./deals.js');
                await showDealModal(userId);
                
            } catch (error) {
                console.error('❌ Ошибка открытия модального окна сделки:', error);
                alert(`Не удалось открыть сделку с пользователем ${userName}`);
            } finally {
                // Восстанавливаем кнопку
                this.innerHTML = originalText;
                this.disabled = false;
            }
        });
    });
    
    // Обработчики для админов (переводы)
    document.querySelectorAll('.admin-transfer-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const userId = this.dataset.userId;
            const userName = this.dataset.userName;
            
            // Показываем индикатор загрузки на кнопке
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Перевод...';
            this.disabled = true;
            
            try {
                await makeAdminTransfer(userId, userName);
            } catch (error) {
                console.error('❌ Ошибка перевода:', error);
                alert(`Не удалось выполнить перевод пользователю ${userName}`);
            } finally {
                // Восстанавливаем кнопку
                this.innerHTML = originalText;
                this.disabled = false;
            }
        });
    });
}

// Функция для выполнения перевода администратором
// Замените функцию makeAdminTransfer на эту:
async function makeAdminTransfer(targetUserId, targetUserName) {
    try {
        if (!state.supabase || !state.isAdmin) {
            throw new Error('Недостаточно прав для выполнения перевода');
        }
        
        console.log(`🔄 Админ выполняет перевод пользователю: ${targetUserName}`);
        
        // Проверяем существование RPC функции
        let transferResult;
        try {
            const { data, error } = await state.supabase.rpc('admin_transfer_coins', {
                admin_user_id: state.currentUserProfile.id,
                target_user_id: targetUserId,
                amount: 5
            });
            
            if (error) {
                console.log('RPC function error, trying direct method');
                // Fallback: прямой метод с проверками
                await makeAdminTransferDirect(targetUserId, targetUserName);
                return;
            }
            
            transferResult = data;
        } catch (rpcError) {
            console.log('RPC function not available, using direct method');
            await makeAdminTransferDirect(targetUserId, targetUserName);
            return;
        }
        
        if (!transferResult || !transferResult.success) {
            throw new Error(transferResult?.error || 'Неизвестная ошибка при переводе');
        }
        
        // Показываем успешное сообщение
        let successMessage = `✅ ${transferResult.message}`;
        if (transferResult.transfers_today) {
            successMessage += `\n\n📊 Переводов сегодня: ${transferResult.transfers_today}/5`;
        }
        alert(successMessage);
        
        // Обновляем список пользователей
        await loadUsers(true);
        
        console.log('✅ Перевод выполнен успешно');
        
    } catch (error) {
        console.error('❌ Ошибка при выполнении перевода:', error);
        
        if (error.message.includes('Превышен лимит переводов')) {
            alert(`❌ ${error.message}`);
        } else {
            alert(`❌ Не удалось выполнить перевод пользователю ${targetUserName}: ${error.message}`);
        }
        
        throw error;
    }
}

// Добавьте эту вспомогательную функцию:
async function makeAdminTransferDirect(targetUserId, targetUserName) {
    // Прямой метод с проверками безопасности
    if (!state.isAdmin) {
        throw new Error('Только администраторы могут выполнять переводы');
    }
    
    // Проверяем лимит переводов (макс 5 в день)
    const today = new Date().toISOString().split('T')[0];
    const { count: transfersToday } = await state.supabase
        .from('admin_transfers')
        .select('id', { count: 'exact', head: true })
        .eq('from_user', state.currentUserProfile.id)
        .gte('created_at', today);
    
    if (transfersToday >= 5) {
        throw new Error('Превышен лимит переводов на сегодня (максимум 5)');
    }
    
    // Создаем запись о переводе
    const { data: transfer, error: transferError } = await state.supabase
        .from('admin_transfers')
        .insert({
            from_user: state.currentUserProfile.id,
            to_user: targetUserId,
            amount: 5
        })
        .select()
        .single();
    
    if (transferError) {
        throw new Error(`Ошибка создания перевода: ${transferError.message}`);
    }
    
    // Обновляем баланс получателя через безопасный метод
    const { error: updateError } = await state.supabase
        .from('profiles')
        .update({ 
            coins: state.supabase.raw('coins + 5'),
            updated_at: new Date().toISOString()
        })
        .eq('id', targetUserId);
    
    if (updateError) {
        throw new Error(`Ошибка обновления баланса: ${updateError.message}`);
    }
    
    // Логируем действие
    await state.supabase
        .from('security_logs')
        .insert({
            action: 'admin_transfer',
            details: {
                admin_id: state.currentUserProfile.id,
                target_user_id: targetUserId,
                amount: 5,
                transfer_id: transfer.id
            },
            severity: 2
        });
    
    return {
        success: true,
        message: `Перевод 5 монет пользователю ${targetUserName} выполнен успешно`,
        transfers_today: transfersToday + 1
    };
}

function renderEmptyUsersState() {
    if (!dom.usersList) return;
    
    const searchTerm = dom.searchInput ? dom.searchInput.value.trim() : '';
    const selectedClass = dom.classFilter ? dom.classFilter.value : '';
    
    let message = 'Пользователи не найдены';
    let icon = 'fa-users';
    
    if (searchTerm && selectedClass && selectedClass !== 'all') {
        message = `Не найдено пользователей с именем "${searchTerm}" в классе ${selectedClass}`;
    } else if (searchTerm) {
        message = `Не найдено пользователей с именем "${searchTerm}"`;
    } else if (selectedClass && selectedClass !== 'all') {
        message = `Не найдено пользователей в классе ${selectedClass}`;
    }
    
    dom.usersList.innerHTML = `
        <div class="empty-state">
            <i class="fas ${icon}"></i>
            <p>${message}</p>
            ${searchTerm || (selectedClass && selectedClass !== 'all') ? `
                <button class="btn-outline" onclick="clearSearchFilters()" style="margin-top: 10px;">
                    <i class="fas fa-times"></i> Очистить фильтры
                </button>
            ` : ''}
        </div>
    `;
}

function renderUsersError(message) {
    if (!dom.usersList) return;
    
    dom.usersList.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <p>${message}</p>
            <button class="btn-outline" onclick="loadUsers(true)" style="margin-top: 10px;">
                <i class="fas fa-redo"></i> Попробовать снова
            </button>
        </div>
    `;
}

// Функция для отображения информации о лимитах уникальных игроков
async function renderLimitInfo() {
    try {
        if (!state.supabase || !state.currentUserProfile) return;

        // Проверяем текущие лимиты
        const limitCheck = await checkUniquePlayersLimit(null);
        
        console.log('🔍 LimitCheck data in renderLimitInfo:', limitCheck);

        // Создаем или обновляем индикатор лимитов
        let limitIndicator = document.getElementById('limitIndicator');
        
        if (!limitIndicator) {
            limitIndicator = document.createElement('div');
            limitIndicator.id = 'limitIndicator';
            limitIndicator.className = 'limit-info';
            
            // Вставляем перед списком пользователей
            const usersList = document.getElementById('usersList');
            if (usersList && usersList.parentNode) {
                usersList.parentNode.insertBefore(limitIndicator, usersList);
            }
        }

        // Безопасное извлечение значений с значениями по умолчанию
        const baseLimit = Number(limitCheck.baseLimit) || 5;
        const boostLimit = Number(limitCheck.boostLimit) || 0;
        const usedSlots = Number(limitCheck.usedSlots) || 0;
        const totalLimit = baseLimit + boostLimit;
        const availableSlots = Math.max(0, totalLimit - usedSlots);
        const usedPercentage = totalLimit > 0 ? Math.min(100, (usedSlots / totalLimit) * 100) : 0;
        const progressColor = usedPercentage >= 100 ? 'var(--danger)' : 
                            usedPercentage >= 80 ? 'var(--warning)' : 'var(--success)';
        
        // ОБНОВЛЕННЫЙ ШАБЛОН - правильное отображение лимита
        limitIndicator.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <i class="fas fa-users" style="color: var(--primary);"></i>
                <strong>Лимит уникальных игроков сегодня:</strong>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px;">
                <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <span style="font-weight: bold;">${usedSlots}/${totalLimit} игроков</span>
                    <div class="limit-progress">
                        <div class="limit-progress-bar" style="width: ${usedPercentage}%; background: ${progressColor};"></div>
                    </div>
                    ${limitCheck.hasActiveBoost ? 
                        '<span style="color: var(--success); display: flex; align-items: center; gap: 5px;"><i class="fas fa-rocket"></i> Буст активен!</span>' : 
                        ''
                    }
                </div>
                ${availableSlots <= 2 ? `
                <div style="text-align: right;">
                    <small style="color: ${availableSlots === 0 ? 'var(--danger)' : 'var(--warning)'}; display: block; margin-bottom: 5px;">
                        ${availableSlots === 0 ? '❌ Лимит новых игроков исчерпан' : `⚠️ Осталось ${availableSlots} новый слот`}
                    </small>
                    <button class="btn-outline btn-small" id="openShopBtn">
                        <i class="fas fa-store"></i> Купить буст
                    </button>
                </div>
                ` : ''}
            </div>
            <div style="margin-top: 8px; font-size: 0.8rem; color: #666;">
                <i class="fas fa-info-circle"></i> 
                С знакомыми игроками можно совершать до 5 сделок в день
            </div>
            ${limitCheck.hasActiveBoost ? `
            <div style="margin-top: 10px; padding: 8px; background: #e8f5e8; border-radius: 5px; border-left: 3px solid #4caf50;">
                <small style="color: #2e7d32;">
                    <i class="fas fa-info-circle"></i> 
                    Активен буст +${boostLimit} игроков. Общий лимит: ${totalLimit} игроков
                </small>
            </div>
            ` : ''}
            <div style="margin-top: 10px; padding: 8px; background: #fff3cd; border-radius: 5px; border-left: 3px solid #ffc107;">
                <small style="color: #856404;">
                    <i class="fas fa-exclamation-triangle"></i> 
                    Сделки внутри одного класса запрещены. Вы можете совершать сделки только с игроками из других классов.
                </small>
            </div>
        `;

        // Обработчик для кнопки магазина
        const openShopBtn = document.getElementById('openShopBtn');
        if (openShopBtn) {
            openShopBtn.addEventListener('click', openShopTab);
        }

    } catch (error) {
        console.error('Ошибка отображения информации о лимитах:', error);
        
        // Fallback: показываем базовую информацию даже при ошибке
        const limitIndicator = document.getElementById('limitIndicator');
        if (limitIndicator) {
            limitIndicator.innerHTML = `
                <div style="color: var(--warning);">
                    <i class="fas fa-exclamation-triangle"></i>
                    Временные проблемы с отображением лимитов. Базовый лимит: 5 игроков.
                </div>
            `;
        }
    }
}

// Функция для принудительного обновления статуса буста (оставляем для совместимости)
async function refreshBoostStatus() {
    try {
        const { updateBoostStatus, deactivateExhaustedBoosts } = await import('./shop.js');
        await updateBoostStatus();
        await deactivateExhaustedBoosts(state.currentUserProfile.id);
        
        // Перезагружаем пользователей для обновления лимитов
        await loadUsers(true);
        
        // Показываем уведомление
        showNotification('Статус обновлен', 'success');
        
    } catch (error) {
        console.error('Ошибка обновления статуса буста:', error);
        showNotification('Ошибка обновления статуса', 'error');
    }
}

// Функция для проверки лимитов уникальных игроков
// Функция для проверки лимитов уникальных игроков
export async function checkUniquePlayersLimit(targetUserId) {
    try {
        if (!state.supabase || !state.currentUserProfile) {
            return { 
                canMakeDeal: false, 
                error: 'Не инициализирован',
                baseLimit: 5,
                boostLimit: 0,
                usedSlots: 0,
                availableSlots: 5,
                hasActiveBoost: false
            };
        }

        console.log('🔍 Checking unique players limit for user:', state.currentUserProfile.id);

        const { data: result, error } = await state.supabase.rpc('check_daily_unique_players_limit', {
            p_user_id: state.currentUserProfile.id
        });

        if (error) {
            console.error('❌ Ошибка проверки лимита:', error);
            return { 
                canMakeDeal: false, 
                error: 'Ошибка проверки лимита',
                baseLimit: 5,
                boostLimit: 0,
                usedSlots: 0,
                availableSlots: 5,
                hasActiveBoost: false
            };
        }

        console.log('📊 Лимиты уникальных игроков (RPC результат):', result);

        // ИСПРАВЛЕНИЕ: RPC функция возвращает массив, берем первый элемент
        const limitData = Array.isArray(result) ? result[0] : result;
        
        if (!limitData) {
            console.error('❌ Данные лимита не получены');
            return { 
                canMakeDeal: false, 
                error: 'Данные не получены',
                baseLimit: 5,
                boostLimit: 0,
                usedSlots: 0,
                availableSlots: 5,
                hasActiveBoost: false
            };
        }

        // Гарантируем, что все значения являются числами
        const baseLimit = Number(limitData.base_limit) || 5;
        const boostLimit = Number(limitData.boost_limit) || 0;
        const usedSlots = Number(limitData.used_slots) || 0;
        const availableSlots = Number(limitData.available_slots) || Math.max(0, (baseLimit + boostLimit) - usedSlots);
        const hasActiveBoost = Boolean(limitData.has_active_boost);

        const finalResult = {
            canMakeDeal: availableSlots > 0,
            baseLimit: baseLimit,
            boostLimit: boostLimit,
            usedSlots: usedSlots,
            availableSlots: availableSlots,
            hasActiveBoost: hasActiveBoost
        };

        console.log('📊 Финальные данные лимита:', finalResult);
        return finalResult;

    } catch (error) {
        console.error('❌ Ошибка при проверке лимита:', error);
        return { 
            canMakeDeal: false, 
            error: 'Ошибка системы',
            baseLimit: 5,
            boostLimit: 0,
            usedSlots: 0,
            availableSlots: 5,
            hasActiveBoost: false
        };
    }
}

// Функция для открытия вкладки магазина
function openShopTab() {
    const shopTab = document.querySelector('.tab[data-tab="shop"]');
    if (shopTab) {
        shopTab.click();
        
        // Прокручиваем к бусту в магазине
        setTimeout(() => {
            const boostProduct = document.querySelector('[data-product-type="unique_players_boost"]');
            if (boostProduct) {
                boostProduct.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Подсвечиваем буст
                boostProduct.style.animation = 'pulse 2s 3';
                setTimeout(() => {
                    boostProduct.style.animation = '';
                }, 6000);
            }
        }, 500);
    }
}

// Вспомогательная функция для показа уведомлений
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const bgColor = type === 'success' ? 'var(--success)' : 
                   type === 'error' ? 'var(--danger)' : 'var(--primary)';
    
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 12px 18px;
        border-radius: 5px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        max-width: 300px;
        word-wrap: break-word;
    `;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check' : type === 'error' ? 'fa-exclamation-triangle' : 'fa-info'}"></i>
        ${message}
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Функция для очистки фильтров поиска
function clearSearchFilters() {
    if (dom.searchInput) {
        dom.searchInput.value = '';
    }
    if (dom.classFilter) {
        dom.classFilter.value = 'all';
    }
    loadUsers(true);
}

// Функция для экранирования HTML
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Debounce поиска
let searchTimeout = null;

export function setupSearchDebounce() {
    if (dom.searchInput) {
        dom.searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadUsers(true);
            }, 500);
        });
    }
    
    if (dom.classFilter) {
        dom.classFilter.addEventListener('change', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadUsers(true);
            }, 300);
        });
    }
}

// Функция для обновления индикатора лимита без полной перезагрузки пользователей
export async function updateLimitIndicator() {
    try {
        if (!state.supabase || !state.currentUserProfile) return;

        console.log('🔄 Обновление индикатор лимита...');

        // Проверяем текущие лимиты
        const limitCheck = await checkUniquePlayersLimit(null);
        
        const limitIndicator = document.getElementById('limitIndicator');
        if (!limitIndicator) {
            console.log('❌ Индикатор лимита не найден, создаем новый');
            await renderLimitInfo();
            return;
        }

        // Безопасное извлечение значений
        const baseLimit = Number(limitCheck.baseLimit) || 5;
        const boostLimit = Number(limitCheck.boostLimit) || 0;
        const usedSlots = Number(limitCheck.usedSlots) || 0;
        const totalLimit = baseLimit + boostLimit;
        const availableSlots = Math.max(0, totalLimit - usedSlots);
        const usedPercentage = totalLimit > 0 ? Math.min(100, (usedSlots / totalLimit) * 100) : 0;
        const progressColor = usedPercentage >= 100 ? 'var(--danger)' : 
                            usedPercentage >= 80 ? 'var(--warning)' : 'var(--success)';
        
        // Обновляем содержимое индикатора
        limitIndicator.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <i class="fas fa-users" style="color: var(--primary);"></i>
                <strong>Лимит уникальных игроков сегодня:</strong>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px;">
                <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <span style="font-weight: bold;">${usedSlots}/${totalLimit} игроков</span>
                    <div class="limit-progress">
                        <div class="limit-progress-bar" style="width: ${usedPercentage}%; background: ${progressColor};"></div>
                    </div>
                    ${limitCheck.hasActiveBoost ? 
                        '<span style="color: var(--success); display: flex; align-items: center; gap: 5px;"><i class="fas fa-rocket"></i> Буст активен!</span>' : 
                        ''
                    }
                </div>
                ${availableSlots <= 2 ? `
                <div style="text-align: right;">
                    <small style="color: ${availableSlots === 0 ? 'var(--danger)' : 'var(--warning)'}; display: block; margin-bottom: 5px;">
                        ${availableSlots === 0 ? '❌ Лимит исчерпан' : `⚠️ Осталось ${availableSlots} слот${availableSlots === 1 ? '' : 'а'}`}
                    </small>
                    ${!limitCheck.hasActiveBoost ? `
                    <button class="btn-outline btn-small" id="openShopBtn">
                        <i class="fas fa-store"></i> Купить буст
                    </button>
                    ` : ''}
                </div>
                ` : ''}
            </div>
            ${limitCheck.hasActiveBoost ? `
            <div style="margin-top: 10px; padding: 8px; background: #e8f5e8; border-radius: 5px; border-left: 3px solid #4caf50;">
                <small style="color: #2e7d32;">
                    <i class="fas fa-info-circle"></i> 
                    Активен буст +${boostLimit} игроков. Общий лимит: ${totalLimit} игроков
                </small>
            </div>
            ` : ''}
        `;

        // Обновляем обработчик для кнопки магазина
        const openShopBtn = document.getElementById('openShopBtn');
        if (openShopBtn) {
            openShopBtn.addEventListener('click', openShopTab);
        }

        console.log('✅ Индикатор лимита обновлен:', { usedSlots, totalLimit, availableSlots });

    } catch (error) {
        console.error('❌ Ошибка обновления индикатора лимита:', error);
    }
}

// Добавляем функции в глобальную область видимости
window.openShopTab = openShopTab;
window.clearSearchFilters = clearSearchFilters;
window.loadUsers = loadUsers;

// Экспортируем только refreshBoostStatus для совместимости
export { 
    refreshBoostStatus
};
