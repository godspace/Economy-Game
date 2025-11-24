import { state, dom, cache, shouldUpdate, markUpdated } from './config.js';

export async function showDealModal(userId) {
    try {
        if (!state.supabase || !state.currentUserProfile) {
            console.error('Supabase or current user not initialized');
            return;
        }
        
        if (state.currentUserProfile.coins <= 0) {
            alert('У вас недостаточно монет для совершения сделки');
            return;
        }
        
        const { data: user, error } = await state.supabase
            .from('profiles')
            .select('id, username, class, coins, reputation') // Только нужные поля
            .eq('id', userId)
            .single();
        
        if (error) {
            console.error('Ошибка загрузки профиля пользователя:', error);
            return;
        }
        
        state.selectedUser = user;
        
        if (dom.dealPlayerName) dom.dealPlayerName.textContent = user.username;
        if (dom.dealAvatar) dom.dealAvatar.textContent = user.username.charAt(0).toUpperCase();
        if (dom.dealPlayerClass) dom.dealPlayerClass.textContent = `Класс: ${user.class}`;
        if (dom.dealPlayerCoins) dom.dealPlayerCoins.textContent = user.coins;
        if (dom.dealPlayerReputation) dom.dealPlayerReputation.textContent = user.reputation;
        
        const todayDealsCount = await getTodayDealsCount(userId);
        if (dom.dealLimitInfo && dom.dealLimitText) {
            if (todayDealsCount >= 5) {
                dom.dealLimitText.textContent = `Вы уже совершили максимальное количество сделок (5) с игроком ${user.username} сегодня. Попробуйте завтра или выберите другого игрока.`;
                dom.dealLimitInfo.style.display = 'block';
                
                if (dom.cooperateBtn) {
                    dom.cooperateBtn.disabled = true;
                    dom.cooperateBtn.classList.add('btn-disabled');
                }
                if (dom.cheatBtn) {
                    dom.cheatBtn.disabled = true;
                    dom.cheatBtn.classList.add('btn-disabled');
                }
            } else {
                dom.dealLimitText.textContent = `Вы уже совершили ${todayDealsCount} из 5 возможных сделок с этим игроком сегодня.`;
                dom.dealLimitInfo.style.display = 'block';
                
                if (dom.cooperateBtn) {
                    dom.cooperateBtn.disabled = false;
                    dom.cooperateBtn.classList.remove('btn-disabled');
                }
                if (dom.cheatBtn) {
                    dom.cheatBtn.disabled = false;
                    dom.cheatBtn.classList.remove('btn-disabled');
                }
            }
        }
        
        if (dom.dealModal) {
            dom.dealModal.classList.add('active');
        }
    } catch (error) {
        console.error('Ошибка показа модального окна:', error);
    }
}

async function getTodayDealsCount(targetUserId) {
    try {
        if (!state.supabase || !state.currentUser) {
            return 0;
        }
        
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        const { data: todayDeals, error } = await state.supabase
            .from('deals')
            .select('id') // Только ID для подсчета
            .eq('from_user', state.currentUser.id)
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
        if (!state.supabase || !state.currentUser || !state.selectedUser || !state.currentUserProfile) {
            console.error('Required data not initialized');
            return;
        }
        
        if (state.currentUserProfile.coins <= 0) {
            alert('У вас недостаточно монет для совершения сделки');
            if (dom.dealModal) {
                dom.dealModal.classList.remove('active');
            }
            return;
        }
        
        const todayDealsCount = await getTodayDealsCount(state.selectedUser.id);
        
        if (todayDealsCount >= 5) {
            alert(`Вы уже совершили максимальное количество сделок (5) с игроком ${state.selectedUser.username} сегодня. Попробуйте завтра или выберите другого игрока.`);
            return;
        }
        
        const { data, error } = await state.supabase
            .from('deals')
            .insert([
                {
                    from_user: state.currentUser.id,
                    to_user: state.selectedUser.id,
                    from_choice: choice,
                    status: 'pending'
                }
            ]);
        
        if (error) {
            throw error;
        }
        
        alert('Сделка предложена успешно!');
        if (dom.dealModal) {
            dom.dealModal.classList.remove('active');
        }
        
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
            `) // Только нужные поля
            .eq('id', dealId)
            .single();
        
        if (error) {
            console.error('Ошибка загрузки сделки:', error);
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
                    <p><i class="fas fa-check-circle" style="color: var(--success);"></i> <strong>Сотрудничать:</strong> Оба игрока получают по 2 монеты</p>
                    <p><i class="fas fa-times-circle" style="color: var(--danger);"></i> <strong>Жульничать:</strong> Вы получаете 3 монеты, другой игрок теряет 1 монету</p>
                    <p style="margin-top: 10px; font-style: italic;">Но будьте осторожны - если оба выберут "Жульничать", оба теряют по 1 монете!</p>
                </div>
            `;
        }
        
        if (dom.responseModal) {
            dom.responseModal.classList.add('active');
        }
    } catch (error) {
        console.error('Ошибка показа модального окна ответа:', error);
    }
}

export async function respondToDeal(choice) {
    try {
        if (!state.supabase || !state.selectedDeal) {
            console.error('Required data not initialized');
            return;
        }
        
        const { data: result, error } = await state.supabase.rpc('process_deal', {
            deal_id: state.selectedDeal.id,
            response_choice: choice
        });
        
        if (error) {
            throw error;
        }
        
        await showDealResult(state.selectedDeal, choice, result);
        
        if (dom.responseModal) {
            dom.responseModal.classList.remove('active');
        }
        
        // Инвалидируем кэш сделок и обновляем
        cache.deals.data = null;
        cache.deals.timestamp = 0;
        loadDeals(true); // force refresh
        
        if (state.currentUser) {
            const { loadUserProfile } = await import('./users.js');
            loadUserProfile(state.currentUser.id);
        }
    } catch (error) {
        console.error('Ошибка ответа на сделку:', error);
        alert('Ошибка: ' + error.message);
    }
}

async function showDealResult(deal, userChoice, result) {
    try {
        if (!dom.resultModal || !dom.resultContent) {
            return;
        }
        
        let resultHtml = '';
        const fromCoinsChange = result.from_coins_change;
        const toCoinsChange = result.to_coins_change;
        
        if (deal.from_choice === 'cooperate' && userChoice === 'cooperate') {
            resultHtml = `
                <div class="result-message result-success">
                    <div class="result-icon">
                        <i class="fas fa-handshake"></i>
                    </div>
                    <p>Оба игрока выбрали "Сотрудничать"!</p>
                    <p>Вы получили: +${toCoinsChange} монет</p>
                    <p>Другой игрок получил: +${fromCoinsChange} монет</p>
                </div>
                <p>Отличный результат взаимовыгодного сотрудничества!</p>
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
                </div>
                <p>Вы получили преимущество, но ваша репутация может пострадать.</p>
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
                </div>
                <p>К сожалению, другой игрок воспользовался вашим доверием.</p>
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
                </div>
                <p>Никто не выиграл - взаимное недоверие привело к потерям для обоих.</p>
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
        if (!state.supabase || !state.currentUser) {
            console.error('Supabase or current user not initialized');
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
        
        // Параллельная загрузка данных
        const [incomingResult, pendingResult, completedIncomingResult, completedOutgoingResult] = await Promise.all([
            // Входящие сделки
            state.supabase
                .from('deals')
                .select(`
                    id, from_choice, status, created_at,
                    from_user:profiles!deals_from_user_fkey(username, class, coins, reputation)
                `)
                .eq('to_user', state.currentUser.id)
                .eq('status', 'pending'),
            
            // Ожидающие ответа сделки
            state.supabase
                .from('deals')
                .select(`
                    id, from_choice, status, created_at,
                    to_user:profiles!deals_to_user_fkey(username, class)
                `)
                .eq('from_user', state.currentUser.id)
                .eq('status', 'pending'),
            
            // Завершённые входящие сделки
            state.supabase
                .from('deals')
                .select(`
                    id, from_choice, to_choice, status, created_at,
                    from_user:profiles!deals_from_user_fkey(username, class),
                    to_user:profiles!deals_to_user_fkey(username, class)
                `)
                .eq('to_user', state.currentUser.id)
                .eq('status', 'completed')
                .order('created_at', { ascending: false })
                .limit(20), // Ограничение истории
            
            // Завершённые исходящие сделки
            state.supabase
                .from('deals')
                .select(`
                    id, from_choice, to_choice, status, created_at,
                    from_user:profiles!deals_from_user_fkey(username, class),
                    to_user:profiles!deals_to_user_fkey(username, class)
                `)
                .eq('from_user', state.currentUser.id)
                .eq('status', 'completed')
                .order('created_at', { ascending: false })
                .limit(20) // Ограничение истории
        ]);
        
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
                        <p><strong>Репутация:</strong> ${deal.from_user.reputation}</p>
                    </div>
                    <div class="deal-actions">
                        <button class="btn-success respond-deal" data-deal-id="${deal.id}">
                            <i class="fas fa-reply"></i> Ответить
                        </button>
                    </div>
                `;
            } else {
                dealItem.innerHTML = `
                    <div>
                        <p><strong>Кому:</strong> ${deal.to_user.username} (${deal.to_user.class})</p>
                        <p><strong>Ваш выбор:</strong> ${deal.from_choice === 'cooperate' ? 'Сотрудничать' : 'Жульничать'}</p>
                        <p><strong>Статус:</strong> <span class="badge badge-warning">Ожидание</span></p>
                    </div>
                `;
            }
            
            fragment.appendChild(dealItem);
        });
        
        container.appendChild(fragment);
        
        // Добавляем обработчики для кнопок ответа
        if (type === 'incoming') {
            setTimeout(() => {
                document.querySelectorAll('.respond-deal').forEach(btn => {
                    btn.addEventListener('click', async function() {
                        const dealId = this.dataset.dealId;
                        const { showResponseModal } = await import('./deals.js');
                        showResponseModal(dealId);
                    });
                });
            }, 0);
        }
    }
}

function renderCompletedDeals(deals, container, type) {
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
            let resultClass = '';
            let resultText = '';
            
            if (type === 'incoming') {
                // Для входящих: to_choice - наш выбор
                if (deal.from_choice === 'cooperate' && deal.to_choice === 'cooperate') {
                    coinsChange = 2;
                    resultClass = 'profit-positive';
                    resultText = `+${coinsChange} монет`;
                } else if (deal.from_choice === 'cooperate' && deal.to_choice === 'cheat') {
                    coinsChange = 3;
                    resultClass = 'profit-positive';
                    resultText = `+${coinsChange} монет`;
                } else if (deal.from_choice === 'cheat' && deal.to_choice === 'cooperate') {
                    coinsChange = -1;
                    resultClass = 'profit-negative';
                    resultText = `${coinsChange} монет`;
                } else if (deal.from_choice === 'cheat' && deal.to_choice === 'cheat') {
                    coinsChange = -1;
                    resultClass = 'profit-negative';
                    resultText = `${coinsChange} монет`;
                }
                
                const resultHtml = `<div class="deal-result ${resultClass}">Результат: ${resultText}</div>`;
                
                dealItem.innerHTML = `
                    <div>
                        <p><strong>От кого:</strong> ${deal.from_user.username} (${deal.from_user.class})</p>
                        <p><strong>Ваш выбор:</strong> ${deal.to_choice === 'cooperate' ? 'Сотрудничать' : 'Жульничать'}</p>
                        <p><strong>Ответ:</strong> ${deal.from_choice === 'cooperate' ? 'Сотрудничать' : 'Жульничать'}</p>
                        ${resultHtml}
                    </div>
                `;
            } else {
                // Для исходящих: from_choice - наш выбор
                if (deal.from_choice === 'cooperate' && deal.to_choice === 'cooperate') {
                    coinsChange = 2;
                    resultClass = 'profit-positive';
                    resultText = `+${coinsChange} монет`;
                } else if (deal.from_choice === 'cooperate' && deal.to_choice === 'cheat') {
                    coinsChange = -1;
                    resultClass = 'profit-negative';
                    resultText = `${coinsChange} монет`;
                } else if (deal.from_choice === 'cheat' && deal.to_choice === 'cooperate') {
                    coinsChange = 3;
                    resultClass = 'profit-positive';
                    resultText = `+${coinsChange} монет`;
                } else if (deal.from_choice === 'cheat' && deal.to_choice === 'cheat') {
                    coinsChange = -1;
                    resultClass = 'profit-negative';
                    resultText = `${coinsChange} монет`;
                }
                
                const resultHtml = `<div class="deal-result ${resultClass}">Результат: ${resultText}</div>`;
                
                dealItem.innerHTML = `
                    <div>
                        <p><strong>Кому:</strong> ${deal.to_user.username} (${deal.to_user.class})</p>
                        <p><strong>Ваш выбор:</strong> ${deal.from_choice === 'cooperate' ? 'Сотрудничать' : 'Жульничать'}</p>
                        <p><strong>Ответ:</strong> ${deal.to_choice === 'cooperate' ? 'Сотрудничать' : 'Жульничать'}</p>
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
            .select('id, username, class, coins, reputation') // Только нужные поля
            .order('coins', { ascending: false })
            .limit(100); // Ограничение рейтинга
        
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
            
            if (state.currentUser && user.id === state.currentUser.id) {
                row.classList.add('current-user');
            }
            
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${user.username} ${state.currentUser && user.id === state.currentUser.id ? '(Вы)' : ''}</td>
                <td>${user.class}</td>
                <td>${user.coins}</td>
                <td>${user.reputation}</td>
            `;
            
            fragment.appendChild(row);
        });
        
        dom.rankingTable.appendChild(fragment);
    }
}

// УДАЛЕН БЛОК ДУБЛИРУЮЩЕГО ЭКСПОРТА - экспорты уже указаны при объявлении функций
