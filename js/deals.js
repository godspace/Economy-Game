// deals.js - ПОЛНЫЙ ОБНОВЛЕННЫЙ ФАЙЛ
import { state, dom, cache, shouldUpdate, markUpdated, DEAL_STATUS, DEAL_CHOICES } from './config.js';

// Функция для проверки лимита уникальных игроков
async function checkUniquePlayersLimit(targetUserId) {
    try {
        if (!state.supabase || !state.currentUserProfile) {
            return { canMakeDeal: false, error: 'Не инициализирован' };
        }

        const { data: result, error } = await state.supabase.rpc('check_daily_unique_players_limit', {
            p_user_id: state.currentUserProfile.id
        });

        if (error) {
            console.error('Ошибка проверки лимита:', error);
            return { canMakeDeal: false, error: 'Ошибка проверки лимита' };
        }

        console.log('Результат проверки лимита:', result);

        // Проверяем, не превышен ли лимит уникальных игроков
        if (result.available_slots <= 0) {
            return {
                canMakeDeal: false,
                baseLimit: result.base_limit,
                boostLimit: result.boost_limit,
                usedSlots: result.used_slots,
                availableSlots: result.available_slots,
                hasActiveBoost: result.has_active_boost,
                error: `Достигнут дневной лимит уникальных игроков!`
            };
        }

        // Проверяем, был ли сегодня уже сделка с этим игроком
        const today = new Date().toISOString().split('T')[0];
        const { data: existingDeal, error: dealError } = await state.supabase
            .from('daily_unique_players')
            .select('id')
            .eq('user_id', state.currentUserProfile.id)
            .eq('target_user_id', targetUserId)
            .eq('deal_date', today)
            .single();

        if (dealError && dealError.code !== 'PGRST116') { // PGRST116 = not found
            console.error('Ошибка проверки существующей сделки:', dealError);
        }

        if (existingDeal) {
            // Если сделка с этим игроком уже была, проверяем количество сделок с ним сегодня
            const todayDealsCount = await getTodayDealsCount(targetUserId);
            
            if (todayDealsCount >= 5) {
                return {
                    canMakeDeal: false,
                    baseLimit: result.base_limit,
                    boostLimit: result.boost_limit,
                    usedSlots: result.used_slots,
                    availableSlots: result.available_slots,
                    hasActiveBoost: result.has_active_boost,
                    error: `Вы уже совершили максимальное количество сделок (5) с этим игроком сегодня!`
                };
            } else {
                return {
                    canMakeDeal: true,
                    baseLimit: result.base_limit,
                    boostLimit: result.boost_limit,
                    usedSlots: result.used_slots,
                    availableSlots: result.available_slots,
                    hasActiveBoost: result.has_active_boost,
                    todayDealsWithTarget: todayDealsCount
                };
            }
        }

        // Если это первый раз с этим игроком сегодня
        return {
            canMakeDeal: true,
            baseLimit: result.base_limit,
            boostLimit: result.boost_limit,
            usedSlots: result.used_slots,
            availableSlots: result.available_slots,
            hasActiveBoost: result.has_active_boost,
            todayDealsWithTarget: 0
        };

    } catch (error) {
        console.error('Ошибка при проверке лимита:', error);
        return { canMakeDeal: false, error: 'Ошибка системы' };
    }
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
        
        state.selectedUser = user;
        
        // Проверяем лимит уникальных игроков и сделок с этим игроком
        const limitCheck = await checkUniquePlayersLimit(userId);
        
        if (dom.dealPlayerName) dom.dealPlayerName.textContent = user.username;
        if (dom.dealAvatar) dom.dealAvatar.textContent = user.username.charAt(0).toUpperCase();
        if (dom.dealPlayerClass) dom.dealPlayerClass.textContent = `Класс: ${user.class}`;
        if (dom.dealPlayerCoins) dom.dealPlayerCoins.textContent = user.coins;
        if (dom.dealPlayerReputation) dom.dealPlayerReputation.textContent = user.reputation;
        
        // Обновляем информацию о лимите с учетом буста и сделок с игроком
        if (dom.dealLimitInfo && dom.dealLimitText) {
            if (!limitCheck.canMakeDeal) {
                dom.dealLimitText.innerHTML = `
                    ${limitCheck.error}<br>
                    <strong>Лимит уникальных игроков:</strong> ${limitCheck.usedSlots}/${limitCheck.baseLimit + limitCheck.boostLimit}<br>
                    ${limitCheck.todayDealsWithTarget !== undefined ? 
                        `<strong>Сделок с ${user.username}:</strong> ${limitCheck.todayDealsWithTarget}/5<br>` : 
                        ''}
                    ${limitCheck.hasActiveBoost ? 
                        '🎯 Активен буст +5 игроков!' : 
                        '💡 <button class="btn-outline btn-small" onclick="openShopFromDealModal()" style="margin-top: 5px; padding: 5px 10px; font-size: 0.8rem;">Купить буст +5 игроков</button>'
                    }
                `;
                dom.dealLimitInfo.style.display = 'block';
                
                // Блокируем кнопки
                if (dom.cooperateBtn) {
                    dom.cooperateBtn.disabled = true;
                    dom.cooperateBtn.classList.add('btn-disabled');
                }
                if (dom.cheatBtn) {
                    dom.cheatBtn.disabled = true;
                    dom.cheatBtn.classList.add('btn-disabled');
                }
            } else {
                const todayDealsCount = limitCheck.todayDealsWithTarget || 0;
                let dealLimitText = '';
                
                if (todayDealsCount >= 5) {
                    dealLimitText = `Вы уже совершили максимальное количество сделок (5) с игроком ${user.username} сегодня. Попробуйте завтра или выберите другого игрока.`;
                    
                    // Блокируем кнопки
                    if (dom.cooperateBtn) {
                        dom.cooperateBtn.disabled = true;
                        dom.cooperateBtn.classList.add('btn-disabled');
                    }
                    if (dom.cheatBtn) {
                        dom.cheatBtn.disabled = true;
                        dom.cheatBtn.classList.add('btn-disabled');
                    }
                } else {
                    dealLimitText = `
                        <strong>Лимит уникальных игроков:</strong> ${limitCheck.usedSlots}/${limitCheck.baseLimit + limitCheck.boostLimit}<br>
                        <strong>Сделок с ${user.username}:</strong> ${todayDealsCount}/5<br>
                        ${limitCheck.hasActiveBoost ? 
                            '🎯 Активен буст +5 игроков!' : 
                            '💡 Можете купить буст в магазине!'
                        }
                    `;
                    
                    // Разблокируем кнопки
                    if (dom.cooperateBtn) {
                        dom.cooperateBtn.disabled = false;
                        dom.cooperateBtn.classList.remove('btn-disabled');
                    }
                    if (dom.cheatBtn) {
                        dom.cheatBtn.disabled = false;
                        dom.cheatBtn.classList.remove('btn-disabled');
                    }
                }
                
                dom.dealLimitText.innerHTML = dealLimitText;
                dom.dealLimitInfo.style.display = 'block';
            }
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

async function getTodayDealsCount(targetUserId) {
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
        
        // Проверяем лимит уникальных игроков и сделок с этим игроком
        const limitCheck = await checkUniquePlayersLimit(state.selectedUser.id);
        if (!limitCheck.canMakeDeal) {
            alert(limitCheck.error + '\n\nЛимит уникальных игроков: ' + 
                  limitCheck.usedSlots + '/' + (limitCheck.baseLimit + limitCheck.boostLimit) +
                  (limitCheck.todayDealsWithTarget !== undefined ? 
                   '\nСделок с игроком: ' + limitCheck.todayDealsWithTarget + '/5' : '') +
                  '\n' + (limitCheck.hasActiveBoost ? '🎯 Активен буст!' : '💡 Можете купить буст в магазине!'));
            return;
        }
        
        // Дополнительная проверка на случай, если что-то изменилось
        const todayDealsCount = await getTodayDealsCount(state.selectedUser.id);
        if (todayDealsCount >= 5) {
            alert(`Вы уже совершили максимальное количество сделок (5) с игроком ${state.selectedUser.username} сегодня. Попробуйте завтра или выберите другого игрока.`);
            return;
        }
        
        // Используем RPC функцию для атомарного создания сделки с резервированием 1 монеты
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
            throw new Error(result?.error || 'Неизвестная ошибка при создании сделки');
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
            await recordUniquePlayer(state.selectedUser.id);
        }
        
        alert('Сделка предложена успешно! 1 монета зарезервирована и будет возвращена после завершения сделки.');
        if (dom.dealModal) {
            dom.dealModal.classList.remove('active');
        }
        
        // Обновляем баланс пользователя (так как 1 монета была зарезервирована)
        await updateUserProfile();
        
        // Инвалидируем кэш сделок
        cache.deals.data = null;
        cache.deals.timestamp = 0;
        loadDeals(true); // force refresh
        
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
            
            // Добавляем обработчик для кнопки отклонения
            const rejectBtn = document.querySelector('.reject-deal-btn');
            if (rejectBtn) {
                rejectBtn.addEventListener('click', function() {
                    const dealId = this.dataset.dealId;
                    rejectDeal(dealId);
                });
            }
        }
        
        if (dom.responseModal) {
            dom.responseModal.classList.add('active');
        }
    } catch (error) {
        console.error('Ошибка показа модального окна ответа:', error);
        alert('Ошибка при открытии модального окна ответа');
    }
}

// Функция отклонения сделки
export async function rejectDeal(dealId) {
    try {
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
    }
}

export async function respondToDeal(choice) {
    try {
        if (!state.supabase || !state.selectedDeal || !state.currentUserProfile) {
            console.error('Required data not initialized');
            alert('Системная ошибка: данные не инициализированы');
            return;
        }
        
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
        
        await showDealResult(state.selectedDeal, choice, result);
        
        if (dom.responseModal) {
            dom.responseModal.classList.remove('active');
        }
        
        // Инвалидируем кэш сделок и обновляем
        cache.deals.data = null;
        cache.deals.timestamp = 0;
        loadDeals(true); // force refresh
        
        // ОБНОВЛЯЕМ ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ (ВАЖНО!)
        await updateUserProfile();
        
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
        
        // Добавляем обработчики событий после рендеринга
        setTimeout(() => {
            document.querySelectorAll('.respond-deal').forEach(btn => {
                btn.addEventListener('click', function() {
                    const dealId = this.dataset.dealId;
                    showResponseModal(dealId);
                });
            });
            
            // Добавляем обработчики для кнопок отклонения в списке
            document.querySelectorAll('.reject-deal-list').forEach(btn => {
                btn.addEventListener('click', function() {
                    const dealId = this.dataset.dealId;
                    rejectDeal(dealId);
                });
            });
        }, 0);
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
            
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${user.username} ${state.currentUserProfile && user.id === state.currentUserProfile.id ? '(Вы)' : ''}</td>
                <td>${user.class}</td>
                <td>${user.coins}</td>
                <td>${user.reputation} ⭐</td>
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
            return;
        }
        
        const { data: profile, error } = await state.supabase
            .from('profiles')
            .select('coins, reputation')
            .eq('id', state.currentUserProfile.id)
            .single();
        
        if (error) {
            console.error('Ошибка обновления профиля:', error);
            return;
        }
        
        if (profile) {
            // Обновляем состояние
            state.currentUserProfile.coins = profile.coins;
            state.currentUserProfile.reputation = profile.reputation;
            
            // Обновляем DOM
            if (dom.coinsValue) {
                dom.coinsValue.textContent = profile.coins;
            }
            if (dom.reputationValue) {
                dom.reputationValue.textContent = profile.reputation;
            }
        }
    } catch (error) {
        console.error('Ошибка при обновлении профиля:', error);
    }
}

// Экспортируем для тестирования
export { checkUniquePlayersLimit, getTodayDealsCount, updateUserProfile };