// deals.js - ОБНОВЛЕННЫЙ ФАЙЛ С ПРОВЕРКОЙ КЛАССОВ
import { state, dom, cache, shouldUpdate, markUpdated, DEAL_STATUS, DEAL_CHOICES } from './config.js';

// Глобальная переменная для защиты от повторных операций
let pendingOperations = new Set();

// Функция для проверки лимита уникальных игроков
export async function checkUniquePlayersLimit(targetUserId = null) {
    try {
        if (!state.supabase || !state.currentUserProfile) {
            return getDefaultLimits();
        }

        console.log('🔍 Checking unique players limit for user:', state.currentUserProfile.id);

        // Пробуем исправленную функцию
        const { data: result, error } = await state.supabase.rpc(
            'check_daily_unique_players_limit', 
            { p_user_id: state.currentUserProfile.id }
        );

        if (error) {
            console.log('⚠️ RPC error, using simple calculation:', error);
            // Fallback на простые значения
            return getSimpleLimits();
        }

        console.log('📊 Лимиты уникальных игроков:', result);

        return {
            canMakeDeal: result.available_slots > 0,
            baseLimit: result.base_limit || 5,
            boostLimit: result.boost_limit || 0,
            usedSlots: result.used_slots || 0,
            availableSlots: result.available_slots || 5,
            hasActiveBoost: result.has_active_boost || false
        };

    } catch (error) {
        console.error('❌ Ошибка при проверке лимита:', error);
        return getDefaultLimits();
    }
}

function getDefaultLimits() {
    return { 
        canMakeDeal: true,
        error: null,
        baseLimit: 5,
        boostLimit: 0,
        usedSlots: 0,
        availableSlots: 5,
        hasActiveBoost: false
    };
}

function getSimpleLimits() {
    return {
        canMakeDeal: true,
        baseLimit: 5,
        boostLimit: 0,
        usedSlots: 0,
        availableSlots: 5,
        hasActiveBoost: false
    };
}

// Функция для записи уникального игрока
async function recordUniquePlayer(targetUserId) {
    try {
        if (!state.supabase || !state.currentUserProfile) {
            return false;
        }

        const { data: result, error } = await state.supabase.rpc('record_unique_player', {
            p_user_id: state.currentUserProfile.id,
            p_target_user_id: targetUserId
        });

        if (error) {
            console.error('Ошибка записи уникального игрока:', error);
            return false;
        }

        console.log('Уникальный игрок записан:', result);
        return true;

    } catch (error) {
        console.error('Ошибка при записи уникального игрока:', error);
        return false;
    }
}

export async function showDealModal(userId) {
    try {
        if (!state.supabase || !state.currentUserProfile) {
            console.error('Supabase or current user not initialized');
            return;
        }
        
        if (state.currentUserProfile.coins < 1) {
            alert('У вас недостаточно монет для совершения сделки. Требуется минимум 1 монета для резервирования.');
            return;
        }
        
        const { data: user, error } = await state.supabase
            .from('profiles')
            .select('id, username, class, coins, reputation')
            .eq('id', userId)
            .single();
        
        if (error) {
            console.error('Ошибка загрузки профиля пользователя:', error);
            alert('Не удалось загрузить профиль пользователя');
            return;
        }
        
        // НОВАЯ ПРОВЕРКА: Запрет сделок внутри класса
        if (state.currentUserProfile.class && 
            user.class && 
            state.currentUserProfile.class === user.class) {
            alert(`❌ Сделки внутри класса "${user.class}" запрещены.\n\nВыберите игрока из другого класса.`);
            return;
        }
        
        state.selectedUser = user;
        
        // Проверяем количество сделок с этим игроком сегодня
        const todayDealsCount = await getTodayDealsCount(state.selectedUser.id);
        
        // Проверяем, является ли игрок уже знакомым (уже были сделки сегодня)
        const isFamiliarPlayer = todayDealsCount > 0;
        
        console.log('🔍 Проверка сделки в модальном окне:', {
            player: state.selectedUser.username,
            isFamiliarPlayer: isFamiliarPlayer,
            todayDealsCount: todayDealsCount,
            currentUserClass: state.currentUserProfile.class,
            targetUserClass: user.class
        });
        
        // Получаем информацию о лимите только для отображения
        const limitCheck = await checkUniquePlayersLimit(null);
        
        if (dom.dealPlayerName) dom.dealPlayerName.textContent = user.username;
        if (dom.dealAvatar) dom.dealAvatar.textContent = user.username.charAt(0).toUpperCase();
        if (dom.dealPlayerClass) dom.dealPlayerClass.textContent = `Класс: ${user.class}`;
        if (dom.dealPlayerCoins) dom.dealPlayerCoins.textContent = user.coins;
        if (dom.dealPlayerReputation) dom.dealPlayerReputation.textContent = user.reputation;
        
        // Обновляем информацию о лимите
        if (dom.dealLimitInfo && dom.dealLimitText) {
            let dealLimitText = '';
            let shouldBlockDeal = false;
            
            // ПРОВЕРКА 1: Лимит сделок с конкретным игроком (5 сделок)
            if (todayDealsCount >= 5) {
                dealLimitText = `
                    <strong>Сделок с ${user.username}:</strong> ${todayDealsCount}/5<br>
                    <strong>Лимит уникальных игроков:</strong> ${limitCheck.usedSlots}/${limitCheck.baseLimit + limitCheck.boostLimit}<br>
                    ❌ Вы уже совершили максимальное количество сделок с этим игроком сегодня.
                `;
                shouldBlockDeal = true;
            }
            // ПРОВЕРКА 2: Лимит уникальных игроков (только для НОВЫХ игроков)
            else if (!isFamiliarPlayer && limitCheck.availableSlots <= 0) {
                dealLimitText = `
                    <strong>Сделок с ${user.username}:</strong> ${todayDealsCount}/5<br>
                    <strong>Лимит уникальных игроков:</strong> ${limitCheck.usedSlots}/${limitCheck.baseLimit + limitCheck.boostLimit}<br>
                    ❌ Лимит уникальных игроков исчерпан!<br>
                    💡 Вы не можете начать сделку с новым игроком, но можете продолжить сделки с уже знакомыми.
                `;
                shouldBlockDeal = true;
            }
            // ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ - можно совершать сделку
            else {
                if (isFamiliarPlayer) {
                    dealLimitText = `
                        <strong>Сделок с ${user.username}:</strong> ${todayDealsCount}/5<br>
                        <strong>Лимит уникальных игроков:</strong> ${limitCheck.usedSlots}/${limitCheck.baseLimit + limitCheck.boostLimit}<br>
                        ✅ Это знакомый игрок - сделка разрешена<br>
                        ${limitCheck.hasActiveBoost ? '🎯 Активен буст!' : '💡 Можете купить буст для увеличения лимита!'}
                    `;
                } else {
                    dealLimitText = `
                        <strong>Сделок с ${user.username}:</strong> ${todayDealsCount}/5<br>
                        <strong>Лимит уникальных игроков:</strong> ${limitCheck.usedSlots}/${limitCheck.baseLimit + limitCheck.boostLimit}<br>
                        ✅ Можно начать сделку с новым игроком<br>
                        ${limitCheck.hasActiveBoost ? '🎯 Активен буст!' : '💡 Можете купить буст для увеличения лимита!'}
                    `;
                }
            }
            
            // ДОБАВЛЯЕМ ИНФОРМАЦИЮ О КЛАССЕ
            if (state.currentUserProfile.class && user.class) {
                if (state.currentUserProfile.class === user.class) {
                    dealLimitText += `<br><br><strong>❌ Один класс:</strong> ${user.class}<br>Сделки внутри одного класса запрещены.`;
                    shouldBlockDeal = true;
                } else {
                    dealLimitText += `<br><br><strong>✅ Разные классы:</strong> ${state.currentUserProfile.class} ↔ ${user.class}`;
                }
            } else if (!state.currentUserProfile.class || !user.class) {
                dealLimitText += `<br><br><strong>ℹ️ Класс:</strong> ${
                    !state.currentUserProfile.class && !user.class ? 'Оба без класса' :
                    !state.currentUserProfile.class ? `У вас не указан класс, у игрока: ${user.class}` :
                    `Ваш класс: ${state.currentUserProfile.class}, у игрока не указан`
                }<br>Сделки разрешены.`;
            }
            
            dom.dealLimitText.innerHTML = dealLimitText;
            dom.dealLimitInfo.style.display = 'block';
            
            // Блокируем или разблокируем кнопки в зависимости от проверок
            if (dom.cooperateBtn) {
                dom.cooperateBtn.disabled = shouldBlockDeal;
                if (shouldBlockDeal) {
                    dom.cooperateBtn.classList.add('btn-disabled');
                } else {
                    dom.cooperateBtn.classList.remove('btn-disabled');
                }
            }
            if (dom.cheatBtn) {
                dom.cheatBtn.disabled = shouldBlockDeal;
                if (shouldBlockDeal) {
                    dom.cheatBtn.classList.add('btn-disabled');
                } else {
                    dom.cheatBtn.classList.remove('btn-disabled');
                }
            }

            console.log('🔒 Статус блокировки кнопок:', {
                shouldBlockDeal: shouldBlockDeal,
                isFamiliarPlayer: isFamiliarPlayer,
                todayDealsCount: todayDealsCount,
                availableSlots: limitCheck.availableSlots,
                sameClass: state.currentUserProfile.class && user.class && state.currentUserProfile.class === user.class
            });
        }
        
        if (dom.dealModal) {
            dom.dealModal.classList.add('active');
        }
    } catch (error) {
        console.error('Ошибка показа модального окна:', error);
        alert('Ошибка при открытии модального окна сделки');
    }
}

// Функция для открытия магазина из модального окна сделки
function openShopFromDealModal() {
    if (dom.dealModal) {
        dom.dealModal.classList.remove('active');
    }
    
    // Даем время на закрытие модального окна
    setTimeout(() => {
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
    }, 300);
}

// Добавляем функцию в глобальную область видимости
window.openShopFromDealModal = openShopFromDealModal;

export async function getTodayDealsCount(targetUserId) {
    try {
        if (!state.supabase || !state.currentUserProfile) {
            return 0;
        }
        
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        const { data: todayDeals, error } = await state.supabase
            .from('deals')
            .select('id')
            .eq('from_user', state.currentUserProfile.id)
            .eq('to_user', targetUserId)
            .gte('created_at', today)
            .lt('created_at', tomorrowStr);
        
        if (error) {
            console.error('Ошибка проверки лимита сделок:', error);
            return 0;
        }
        
        return todayDeals ? todayDeals.length : 0;
    } catch (error) {
        console.error('Ошибка проверки лимита сделок:', error);
        return 0;
    }
}

export async function proposeDeal(choice) {
    try {
        if (!state.supabase || !state.currentUserProfile || !state.selectedUser) {
            console.error('Required data not initialized');
            alert('Системная ошибка: данные не инициализированы');
            return;
        }
        
        if (state.currentUserProfile.coins < 1) {
            alert('У вас недостаточно монет для совершения сделки. Требуется минимум 1 монета для резервирования.');
            if (dom.dealModal) {
                dom.dealModal.classList.remove('active');
            }
            return;
        }
        
        // Проверяем количество сделок с этим игроком сегодня
        const todayDealsCount = await getTodayDealsCount(state.selectedUser.id);
        
        // ПРОВЕРКА 1: Лимит сделок с конкретным игроком (5 сделок)
        if (todayDealsCount >= 5) {
            alert(`Вы уже совершили максимальное количество сделок (5) с игроком ${state.selectedUser.username} сегодня. Попробуйте завтра или выберите другого игрока.`);
            return;
        }
        
        // Проверяем, является ли игрок уже знакомым (уже были сделки сегодня)
        const isFamiliarPlayer = todayDealsCount > 0;
        
        console.log('🔍 Проверка сделки:', {
            player: state.selectedUser.username,
            isFamiliarPlayer: isFamiliarPlayer,
            todayDealsCount: todayDealsCount
        });
        
        // ПРОВЕРКА 2: Лимит уникальных игроков (только для НОВЫХ игроков)
        // Если игрок знакомый - пропускаем проверку лимита уникальных игроков
        if (!isFamiliarPlayer) {
            const limitCheck = await checkUniquePlayersLimit(state.selectedUser.id);
            console.log('📊 Лимит для нового игрока:', limitCheck);
            
            if (!limitCheck.canMakeDeal) {
                alert(`Лимит уникальных игроков исчерпан! Вы не можете начать сделку с новым игроком ${state.selectedUser.username}.\n\nЛимит уникальных игроков: ${limitCheck.usedSlots}/${limitCheck.baseLimit + limitCheck.boostLimit}\n\n💡 Вы можете продолжить сделки с уже знакомыми игроками.`);
                return;
            }
        } else {
            console.log('✅ Игрок знакомый - пропускаем проверку лимита уникальных игроков');
        }
        
        // Используем RPC функцию для атомарного создания сделки
        const { data: result, error } = await state.supabase.rpc('create_deal_with_reservation', {
            p_from_user: state.currentUserProfile.id,
            p_to_user: state.selectedUser.id,
            p_from_choice: choice
        });
        
        if (error) {
            console.error('RPC Error:', error);
            throw new Error('Ошибка создания сделки: ' + error.message);
        }
        
        if (!result || !result.success) {
            // Проверяем, является ли ошибка о запрете сделок внутри класса
            if (result.error && result.error.includes('Сделки внутри одного класса')) {
                alert(result.error);
            } else {
                throw new Error(result?.error || 'Неизвестная ошибка при создании сделки');
            }
            return;
        }
        
        // Записываем уникального игрока (только если это первая сделка с ним сегодня)
        const today = new Date().toISOString().split('T')[0];
        const { data: existingRecord, error: recordError } = await state.supabase
            .from('daily_unique_players')
            .select('id')
            .eq('user_id', state.currentUserProfile.id)
            .eq('target_user_id', state.selectedUser.id)
            .eq('deal_date', today)
            .single();
        
        if (recordError && recordError.code === 'PGRST116') { // Not found
            // Это первая сделка с этим игроком сегодня - записываем
            console.log('📝 Записываем нового уникального игрока:', state.selectedUser.username);
            await recordUniquePlayer(state.selectedUser.id);
        } else {
            console.log('✅ Игрок уже записан как уникальный');
        }
        
        alert('Сделка предложена успешно! 1 монета зарезервирована и будет возвращена после завершения сделки.');
        if (dom.dealModal) {
            dom.dealModal.classList.remove('active');
        }
        
        // Обновляем баланс пользователя
        await updateUserProfile();
        
        // Обновляем лимит индикатор
        try {
            const { updateLimitIndicator } = await import('./users.js');
            await updateLimitIndicator();
        } catch (error) {
            console.error('Error updating limit indicator after deal proposal:', error);
        }
        
        // Инвалидируем кэш сделок
        cache.deals.data = null;
        cache.deals.timestamp = 0;
        loadDeals(true);
        
    } catch (error) {
        console.error('Ошибка предложения сделки:', error);
        alert('Ошибка: ' + error.message);
    }
}

export async function showResponseModal(dealId) {
    try {
        if (!state.supabase) {
            console.error('Supabase not initialized');
            return;
        }
        
        const { data: deal, error } = await state.supabase
            .from('deals')
            .select(`
                id, from_choice, status, created_at,
                from_user:profiles!deals_from_user_fkey(username, class, coins, reputation)
            `)
            .eq('id', dealId)
            .single();
        
        if (error) {
            console.error('Ошибка загрузки сделки:', error);
            alert('Не удалось загрузить данные сделки');
            return;
        }
        
        state.selectedDeal = deal;
        
        if (dom.responseDealInfo) {
            dom.responseDealInfo.innerHTML = `
                <div class="user-info">
                    <div class="user-avatar">${deal.from_user.username.charAt(0).toUpperCase()}</div>
                    <div>
                        <h3>${deal.from_user.username}</h3>
                        <p>Класс: ${deal.from_user.class}</p>
                    </div>
                </div>
                <div class="user-details" style="justify-content: space-around; margin: 15px 0;">
                    <div class="user-detail">
                        <i class="fas fa-coins"></i>
                        <span>${deal.from_user.coins}</span>
                    </div>
                    <div class="user-detail">
                        <i class="fas fa-star"></i>
                        <span>${deal.from_user.reputation}</span>
                    </div>
                </div>
                <div class="deal-info">
                    <h3 style="margin-bottom: 10px;">Выберите вашу стратегию:</h3>
                    <p><i class="fas fa-check-circle" style="color: var(--success);"></i> <strong>Сотрудничать:</strong> Оба игрока получают по 2 монеты и +1 к репутации</p>
                    <p><i class="fas fa-times-circle" style="color: var(--danger);"></i> <strong>Жульничать:</strong> Вы получаете 3 монеты, другой игрок теряет 1 монету, но вы теряете 1 очко репутации</p>
                    <p style="margin-top: 10px; font-style: italic;">Репутация влияет на доверие других игроков к вам!</p>
                </div>
                <div class="reject-section" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;">
                    <button class="btn-warning reject-deal-btn" data-deal-id="${deal.id}" style="width: 100%;">
                        <i class="fas fa-times"></i> Отклонить сделку
                    </button>
                    <p style="font-size: 0.9rem; color: var(--gray); margin-top: 8px; text-align: center;">
                        При отклонении инициатор получит свою резервную монету обратно
                    </p>
                </div>
            `;
        }
        
        if (dom.responseModal) {
            dom.responseModal.classList.add('active');
        }
    } catch (error) {
        console.error('Ошибка показа модального окна ответа:', error);
        alert('Ошибка при открытии модального окна ответа');
    }
}

// Функция отклонения сделки с защитой от повторных вызовов
export async function rejectDeal(dealId) {
    // Защита от повторных вызовов
    if (pendingOperations.has(dealId)) {
        console.log('Operation already in progress for deal:', dealId);
        return false;
    }
    
    try {
        pendingOperations.add(dealId);
        
        if (!state.supabase || !state.currentUserProfile) {
            console.error('Supabase or current user not initialized');
            return false;
        }

        const confirmed = confirm('Вы уверены, что хотите отклонить сделку? Инициатор получит свою резервную монету обратно.');
        if (!confirmed) return false;

        const { data: result, error } = await state.supabase.rpc('reject_deal', {
            p_deal_id: dealId
        });

        if (error) {
            console.error('RPC Error:', error);
            throw new Error('Ошибка отклонения сделки: ' + error.message);
        }

        if (!result || !result.success) {
            throw new Error(result?.error || 'Неизвестная ошибка при отклонении сделки');
        }

        alert('Сделка отклонена! Резервная монета возвращена инициатору.');
        
        // ОБНОВЛЯЕМ ЛИМИТ ИНДИКАТОР ПРИ ОТКЛОНЕНИИ СДЕЛКИ
        try {
            const { updateLimitIndicator } = await import('./users.js');
            await updateLimitIndicator();
        } catch (error) {
            console.error('Error updating limit indicator after deal rejection:', error);
        }
        
        // Закрываем модальное окно если оно открыто
        if (dom.responseModal) {
            dom.responseModal.classList.remove('active');
        }
        
        // Обновляем список сделок
        cache.deals.data = null;
        cache.deals.timestamp = 0;
        loadDeals(true);
        
        return true;

    } catch (error) {
        console.error('Ошибка отклонения сделки:', error);
        alert('Ошибка: ' + error.message);
        return false;
    } finally {
        pendingOperations.delete(dealId);
    }
}

export async function respondToDeal(choice) {
    try {
        if (!state.supabase || !state.selectedDeal || !state.currentUserProfile) {
            console.error('Required data not initialized');
            alert('Системная ошибка: данные не инициализированы');
            return;
        }
        
        console.log('🔄 Responding to deal:', state.selectedDeal.id, 'with choice:', choice);
        
        // Используем RPC функцию для атомарной обработки сделки с возвратом резервной монеты
        const { data: result, error } = await state.supabase.rpc('process_deal_with_reservation', {
            p_deal_id: state.selectedDeal.id,
            p_response_choice: choice
        });
        
        if (error) {
            console.error('RPC Error:', error);
            throw new Error('Ошибка обработки сделки: ' + error.message);
        }
        
        if (!result || !result.success) {
            throw new Error(result?.error || 'Неизвестная ошибка при обработке сделки');
        }
        
        console.log('✅ Сделка обработана, результат:', result);
        
        // СРАЗУ ОБНОВЛЯЕМ БАЛАНС ПОЛЬЗОВАТЕЛЯ
        await updateUserProfile();
        
        // ОБНОВЛЯЕМ ЛИМИТ ИНДИКАТОР ПОСЛЕ ОТВЕТА НА СДЕЛКУ
        try {
            const { updateLimitIndicator } = await import('./users.js');
            await updateLimitIndicator();
        } catch (error) {
            console.error('Error updating limit indicator after deal response:', error);
        }
        
        // Проверяем статус буста
        try {
            const { updateBoostStatus, deactivateExhaustedBoosts } = await import('./shop.js');
            await updateBoostStatus();
            await deactivateExhaustedBoosts(state.currentUserProfile.id);
        } catch (error) {
            console.error('Error updating boost status after deal response:', error);
        }
        
        await showDealResult(state.selectedDeal, choice, result);
        
        if (dom.responseModal) {
            dom.responseModal.classList.remove('active');
        }
        
        // Инвалидируем кэш сделок и обновляем
        cache.deals.data = null;
        cache.deals.timestamp = 0;
        loadDeals(true); // force refresh
        
    } catch (error) {
        console.error('Ошибка ответа на сделку:', error);
        alert('Ошибка: ' + error.message);
    }
}

async function showDealResult(deal, userChoice, result) {
    try {
        if (!dom.resultModal || !dom.resultContent) {
            console.error('Result modal elements not found');
            return;
        }
        
        let resultHtml = '';
        const fromCoinsChange = result.from_coins_change || 0;
        const toCoinsChange = result.to_coins_change || 0;
        const reservationReturned = result.reservation_returned || false;
        
        // Используем изменения репутации из RPC результата
        const fromRepChange = result.from_reputation_change || 0;
        const toRepChange = result.to_reputation_change || 0;
        
        // Добавляем информацию о возврате резервной монеты и изменении репутации
        const reservationHtml = reservationReturned ? 
            `<p><i class="fas fa-shield-alt" style="color: var(--primary);"></i> <strong>Резервная монета возвращена инициатору сделки</strong></p>` : '';
        
        const reputationHtml = `
            <div style="margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                <strong>Изменение репутации:</strong><br>
                ${deal.from_user.username}: ${fromRepChange > 0 ? '+' : ''}${fromRepChange} ⭐<br>
                ${state.currentUserProfile.username}: ${toRepChange > 0 ? '+' : ''}${toRepChange} ⭐
            </div>
        `;
        
        if (deal.from_choice === 'cooperate' && userChoice === 'cooperate') {
            resultHtml = `
                <div class="result-message result-success">
                    <div class="result-icon">
                        <i class="fas fa-handshake"></i>
                    </div>
                    <p>Оба игрока выбрали "Сотрудничать"!</p>
                    <p>Вы получили: +${toCoinsChange} монет</p>
                    <p>Другой игрок получил: +${fromCoinsChange} монет</p>
                    ${reputationHtml}
                    ${reservationHtml}
                </div>
                <p>Отличный результат взаимовыгодного сотрудничества! Оба получают +1 к репутации.</p>
            `;
        } else if (deal.from_choice === 'cooperate' && userChoice === 'cheat') {
            resultHtml = `
                <div class="result-message ${toCoinsChange > 0 ? 'result-success' : 'result-danger'}">
                    <div class="result-icon">
                        <i class="fas fa-user-secret"></i>
                    </div>
                    <p>Вы выбрали "Жульничать", другой игрок выбрал "Сотрудничать"</p>
                    <p>Вы получили: +${toCoinsChange} монет</p>
                    <p>Другой игрок потерял: ${fromCoinsChange} монет</p>
                    ${reputationHtml}
                    ${reservationHtml}
                </div>
                <p>Вы получили преимущество в монетах, но потеряли 1 очко репутации. Другой игрок сохранил свою репутацию.</p>
            `;
        } else if (deal.from_choice === 'cheat' && userChoice === 'cooperate') {
            resultHtml = `
                <div class="result-message result-danger">
                    <div class="result-icon">
                        <i class="fas fa-sad-tear"></i>
                    </div>
                    <p>Вы выбрали "Сотрудничать", другой игрок выбрал "Жульничать"</p>
                    <p>Вы потеряли: ${toCoinsChange} монет</p>
                    <p>Другой игрок получил: +${fromCoinsChange} монет</p>
                    ${reputationHtml}
                    ${reservationHtml}
                </div>
                <p>К сожалению, другой игрок воспользовался вашим доверием. Вы сохранили свою репутацию (+1), а обманщик потерял 1 очко репутации.</p>
            `;
        } else if (deal.from_choice === 'cheat' && userChoice === 'cheat') {
            resultHtml = `
                <div class="result-message result-warning">
                    <div class="result-icon">
                        <i class="fas fa-angry"></i>
                    </div>
                    <p>Оба игрока выбрали "Жульничать"!</p>
                    <p>Вы потеряли: ${Math.abs(toCoinsChange)} монет</p>
                    <p>Другой игрок потерял: ${Math.abs(fromCoinsChange)} монет</p>
                    ${reputationHtml}
                    ${reservationHtml}
                </div>
                <p>Никто не выиграл - взаимное недоверие привело к потерям для обоих. Оба теряют по 1 очку репутации.</p>
            `;
        }
        
        dom.resultContent.innerHTML = resultHtml;
        dom.resultModal.classList.add('active');
        
    } catch (error) {
        console.error('Ошибка показа результата сделки:', error);
    }
}

export async function loadDeals(forceRefresh = false) {
    try {
        if (!state.supabase || !state.isAuthenticated || !state.currentUserProfile) {
            console.error('Supabase or authentication not initialized');
            return;
        }
        
        // Проверка кэша
        const now = Date.now();
        if (!forceRefresh && cache.deals.data && 
            (now - cache.deals.timestamp < cache.deals.ttl) &&
            shouldUpdate('deals')) {
            renderDeals(cache.deals.data);
            return;
        }
        
        // Параллельная загрузка данных с исправленными именами связей
        const [incomingResult, pendingResult, completedIncomingResult, completedOutgoingResult] = await Promise.all([
            // Входящие сделки
            state.supabase
                .from('deals')
                .select(`
                    id, from_choice, status, created_at,
                    from_user:profiles!deals_from_user_fkey(username, class, coins, reputation)
                `)
                .eq('to_user', state.currentUserProfile.id)
                .eq('status', DEAL_STATUS.PENDING),
            
            // Ожидающие ответа сделки
            state.supabase
                .from('deals')
                .select(`
                    id, from_choice, status, created_at,
                    to_user:profiles!deals_to_user_fkey(username, class)
                `)
                .eq('from_user', state.currentUserProfile.id)
                .eq('status', DEAL_STATUS.PENDING),
            
            // Завершённые входящие сделки
            state.supabase
                .from('deals')
                .select(`
                    id, from_choice, to_choice, status, created_at,
                    from_user:profiles!deals_from_user_fkey(username, class),
                    to_user:profiles!deals_to_user_fkey(username, class)
                `)
                .eq('to_user', state.currentUserProfile.id)
                .eq('status', DEAL_STATUS.COMPLETED)
                .order('created_at', { ascending: false })
                .limit(20),
            
            // Завершённые исходящие сделки
            state.supabase
                .from('deals')
                .select(`
                    id, from_choice, to_choice, status, created_at,
                    from_user:profiles!deals_from_user_fkey(username, class),
                    to_user:profiles!deals_to_user_fkey(username, class)
                `)
                .eq('from_user', state.currentUserProfile.id)
                .eq('status', DEAL_STATUS.COMPLETED)
                .order('created_at', { ascending: false })
                .limit(20)
        ]);
        
        // Обработка ошибок для каждого запроса
        if (incomingResult.error) console.error('Error loading incoming deals:', incomingResult.error);
        if (pendingResult.error) console.error('Error loading pending deals:', pendingResult.error);
        if (completedIncomingResult.error) console.error('Error loading completed incoming deals:', completedIncomingResult.error);
        if (completedOutgoingResult.error) console.error('Error loading completed outgoing deals:', completedOutgoingResult.error);
        
        const dealsData = {
            incoming: incomingResult.data || [],
            pending: pendingResult.data || [],
            completedIncoming: completedIncomingResult.data || [],
            completedOutgoing: completedOutgoingResult.data || []
        };
        
        // Сохраняем в кэш
        cache.deals.data = dealsData;
        cache.deals.timestamp = now;
        markUpdated('deals');
        
        renderDeals(dealsData);
    } catch (error) {
        console.error('Ошибка загрузки сделок:', error);
    }
}

function renderDeals(dealsData) {
    const { incoming, pending, completedIncoming, completedOutgoing } = dealsData;
    
    // Рендерим входящие сделки
    if (dom.incomingDeals) {
        renderDealsList(incoming, dom.incomingDeals, 'incoming');
    }
    
    // Рендерим ожидающие сделки
    if (dom.pendingDeals) {
        renderDealsList(pending, dom.pendingDeals, 'pending');
    }
    
    // Рендерим завершённые входящие сделки
    if (dom.completedIncomingDeals) {
        renderCompletedDeals(completedIncoming, dom.completedIncomingDeals, 'incoming');
    }
    
    // Рендерим завершённые исходящие сделки
    if (dom.completedOutgoingDeals) {
        renderCompletedDeals(completedOutgoing, dom.completedOutgoingDeals, 'outgoing');
    }
}

function renderDealsList(deals, container, type) {
    if (!container) {
        console.error('Container not found for deals list:', type);
        return;
    }
    
    container.innerHTML = '';
    
    if (deals.length === 0) {
        const icon = type === 'incoming' ? 'fa-inbox' : 'fa-clock';
        const text = type === 'incoming' ? 'Нет входящих сделок' : 'Нет ожидающих ответа сделок';
        
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas ${icon}"></i>
                <p>${text}</p>
            </div>
        `;
    } else {
        const fragment = document.createDocumentFragment();
        
        deals.forEach(deal => {
            const dealItem = document.createElement('div');
            dealItem.className = 'deal-item';
            
            if (type === 'incoming') {
                dealItem.innerHTML = `
                    <div>
                        <p><strong>От:</strong> ${deal.from_user.username} (${deal.from_user.class})</p>
                        <p><strong>Монеты:</strong> ${deal.from_user.coins}</p>
                        <p><strong>Репутация:</strong> ${deal.from_user.reputation} ⭐</p>
                    </div>
                    <div class="deal-actions">
                        <button class="btn-success respond-deal" data-deal-id="${deal.id}">
                            <i class="fas fa-reply"></i> Ответить
                        </button>
                        <button class="btn-warning reject-deal-list" data-deal-id="${deal.id}" style="margin-top: 5px;">
                            <i class="fas fa-times"></i> Отклонить
                        </button>
                    </div>
                `;
            } else {
                dealItem.innerHTML = `
                    <div>
                        <p><strong>Кому:</strong> ${deal.to_user.username} (${deal.to_user.class})</p>
                        <p><strong>Ваш выбор:</strong> ${deal.from_choice === DEAL_CHOICES.COOPERATE ? 'Сотрудничать' : 'Жульничать'}</p>
                        <p><strong>Статус:</strong> <span class="badge badge-warning">Ожидание</span></p>
                    </div>
                `;
            }
            
            fragment.appendChild(dealItem);
        });
        
        container.appendChild(fragment);
    }
}

function renderCompletedDeals(deals, container, type) {
    if (!container) {
        console.error('Container not found for completed deals:', type);
        return;
    }
    
    container.innerHTML = '';
    
    if (deals.length === 0) {
        const icon = type === 'incoming' ? 'fa-inbox' : 'fa-paper-plane';
        const text = type === 'incoming' ? 'Нет завершённых входящих сделок' : 'Нет завершённых исходящих сделок';
        
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas ${icon}"></i>
                <p>${text}</p>
            </div>
        `;
    } else {
        const fragment = document.createDocumentFragment();
        
        deals.forEach(deal => {
            const dealItem = document.createElement('div');
            dealItem.className = 'deal-item';
            
            let coinsChange = 0;
            let reputationChange = 0;
            let resultClass = '';
            let resultText = '';
            
            if (type === 'incoming') {
                // Для входящих: to_choice - наш выбор
                if (deal.from_choice === DEAL_CHOICES.COOPERATE && deal.to_choice === DEAL_CHOICES.COOPERATE) {
                    coinsChange = 2;
                    reputationChange = 1;
                    resultClass = 'profit-positive';
                    resultText = `+${coinsChange} монет, +${reputationChange} репутации`;
                } else if (deal.from_choice === DEAL_CHOICES.COOPERATE && deal.to_choice === DEAL_CHOICES.CHEAT) {
                    coinsChange = 3;
                    reputationChange = -1;
                    resultClass = 'profit-positive';
                    resultText = `+${coinsChange} монет, ${reputationChange} репутации`;
                } else if (deal.from_choice === DEAL_CHOICES.CHEAT && deal.to_choice === DEAL_CHOICES.COOPERATE) {
                    coinsChange = -1;
                    reputationChange = 1;
                    resultClass = 'profit-negative';
                    resultText = `${coinsChange} монет, +${reputationChange} репутации`;
                } else if (deal.from_choice === DEAL_CHOICES.CHEAT && deal.to_choice === DEAL_CHOICES.CHEAT) {
                    coinsChange = -1;
                    reputationChange = -1;
                    resultClass = 'profit-negative';
                    resultText = `${coinsChange} монет, ${reputationChange} репутации`;
                }
                
                const resultHtml = `<div class="deal-result ${resultClass}">Результат: ${resultText}</div>`;
                
                dealItem.innerHTML = `
                    <div>
                        <p><strong>От кого:</strong> ${deal.from_user.username} (${deal.from_user.class})</p>
                        <p><strong>Ваш выбор:</strong> ${deal.to_choice === DEAL_CHOICES.COOPERATE ? 'Сотрудничать' : 'Жульничать'}</p>
                        <p><strong>Ответ:</strong> ${deal.from_choice === DEAL_CHOICES.COOPERATE ? 'Сотрудничать' : 'Жульничать'}</p>
                        ${resultHtml}
                    </div>
                `;
            } else {
                // Для исходящих: from_choice - наш выбор
                if (deal.from_choice === DEAL_CHOICES.COOPERATE && deal.to_choice === DEAL_CHOICES.COOPERATE) {
                    coinsChange = 2;
                    reputationChange = 1;
                    resultClass = 'profit-positive';
                    resultText = `+${coinsChange} монет, +${reputationChange} репутации`;
                } else if (deal.from_choice === DEAL_CHOICES.COOPERATE && deal.to_choice === DEAL_CHOICES.CHEAT) {
                    coinsChange = -1;
                    reputationChange = 1;
                    resultClass = 'profit-negative';
                    resultText = `${coinsChange} монет, +${reputationChange} репутации`;
                } else if (deal.from_choice === DEAL_CHOICES.CHEAT && deal.to_choice === DEAL_CHOICES.COOPERATE) {
                    coinsChange = 3;
                    reputationChange = -1;
                    resultClass = 'profit-positive';
                    resultText = `+${coinsChange} монет, ${reputationChange} репутации`;
                } else if (deal.from_choice === DEAL_CHOICES.CHEAT && deal.to_choice === DEAL_CHOICES.CHEAT) {
                    coinsChange = -1;
                    reputationChange = -1;
                    resultClass = 'profit-negative';
                    resultText = `${coinsChange} монет, ${reputationChange} репутации`;
                }
                
                const resultHtml = `<div class="deal-result ${resultClass}">Результат: ${resultText}</div>`;
                
                dealItem.innerHTML = `
                    <div>
                        <p><strong>Кому:</strong> ${deal.to_user.username} (${deal.to_user.class})</p>
                        <p><strong>Ваш выбор:</strong> ${deal.from_choice === DEAL_CHOICES.COOPERATE ? 'Сотрудничать' : 'Жульничать'}</p>
                        <p><strong>Ответ:</strong> ${deal.to_choice === DEAL_CHOICES.COOPERATE ? 'Сотрудничать' : 'Жульничать'}</p>
                        ${resultHtml}
                    </div>
                `;
            }
            
            fragment.appendChild(dealItem);
        });
        
        container.appendChild(fragment);
    }
}

export async function loadRanking(forceRefresh = false) {
    try {
        if (!state.supabase) {
            console.error('Supabase not initialized');
            return;
        }
        
        // Проверка кэша
        const now = Date.now();
        if (!forceRefresh && cache.ranking.data && 
            (now - cache.ranking.timestamp < cache.ranking.ttl) &&
            shouldUpdate('ranking')) {
            renderRanking(cache.ranking.data);
            return;
        }
        
        const { data: users, error } = await state.supabase
            .from('profiles')
            .select('id, username, class, coins, reputation')
            .order('coins', { ascending: false })
            .limit(100);
        
        if (error) {
            console.error('Ошибка загрузки рейтинга:', error);
            return;
        }
        
        // Сохраняем в кэш
        cache.ranking.data = users;
        cache.ranking.timestamp = now;
        markUpdated('ranking');
        
        renderRanking(users);
    } catch (error) {
        console.error('Ошибка загрузки рейтинга:', error);
    }
}

function renderRanking(users) {
    if (!dom.rankingTable) return;
    
    dom.rankingTable.innerHTML = '';
    
    if (users.length === 0) {
        dom.rankingTable.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 20px;">
                    <div class="empty-state">
                        <i class="fas fa-trophy"></i>
                        <p>Нет данных для рейтинга</p>
                    </div>
                </td>
            </tr>
        `;
    } else {
        const fragment = document.createDocumentFragment();
        
        users.forEach((user, index) => {
            const row = document.createElement('tr');
            
            if (state.currentUserProfile && user.id === state.currentUserProfile.id) {
                row.classList.add('current-user');
            }
            
            // ТОЧНО ТАК ЖЕ КАК В СТАРТОВОЙ ТАБЛИЦЕ
            row.innerHTML = `
                <td>
                    ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                </td>
                <td>
                    ${user.username}
                    ${state.currentUserProfile && user.id === state.currentUserProfile.id ? '<span class="you-badge">(Вы)</span>' : ''}
                </td>
                <td>${user.class || 'Не указан'}</td>
                <td class="coins-cell">${user.coins} <i class="fas fa-coins"></i></td>
                <td class="reputation-cell">${user.reputation} <i class="fas fa-star"></i></td>
            `;
            
            fragment.appendChild(row);
        });
        
        dom.rankingTable.appendChild(fragment);
    }
}
// Функция для обновления профиля пользователя (монеты и репутация)
async function updateUserProfile() {
    try {
        if (!state.supabase || !state.currentUserProfile) {
            console.error('Cannot update profile: supabase or currentUserProfile not initialized');
            return;
        }
        
        console.log('🔄 Updating user profile for:', state.currentUserProfile.id);
        
        const { data: profile, error } = await state.supabase
            .from('profiles')
            .select('coins, reputation, username')
            .eq('id', state.currentUserProfile.id)
            .single();
        
        if (error) {
            console.error('❌ Ошибка обновления профиля:', error);
            return;
        }
        
        if (profile) {
            console.log('✅ New profile data:', profile);
            
            // Обновляем состояние
            state.currentUserProfile.coins = profile.coins;
            state.currentUserProfile.reputation = profile.reputation;
            state.currentUserProfile.username = profile.username;
            
            // Обновляем DOM
            if (dom.coinsValue) {
                dom.coinsValue.textContent = profile.coins;
                console.log('💰 Coins updated in DOM:', profile.coins);
            }
            if (dom.reputationValue) {
                dom.reputationValue.textContent = profile.reputation;
                console.log('⭐ Reputation updated in DOM:', profile.reputation);
            }
            if (dom.userGreeting && profile.username) {
                dom.userGreeting.textContent = `Привет, ${profile.username}!`;
            }
        } else {
            console.error('❌ Profile data is null');
        }
    } catch (error) {
        console.error('❌ Ошибка при обновлении профиля:', error);
    }
}

// Функция для проверки, является ли игрок знакомым (уже были сделки сегодня)
async function isFamiliarPlayer(targetUserId) {
    try {
        if (!state.supabase || !state.currentUserProfile) {
            return false;
        }
        
        const todayDealsCount = await getTodayDealsCount(targetUserId);
        return todayDealsCount > 0;
    } catch (error) {
        console.error('Ошибка проверки знакомого игрока:', error);
        return false;
    }
}

// Экспортируем для тестирования
//export { checkUniquePlayersLimit, getTodayDealsCount, updateUserProfile };
