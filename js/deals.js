import { supabase, currentUser, currentUserProfile, selectedUser, selectedDeal, dealModal, dealAvatar, dealPlayerName, dealPlayerClass, dealPlayerCoins, dealPlayerReputation, dealLimitInfo, dealLimitText, responseModal, responseDealInfo, resultModal, resultContent, incomingDeals, pendingDeals, allDeals } from './config.js';

export async function showDealModal(userId) {
    try {
        if (!supabase || !currentUserProfile) {
            console.error('Supabase or current user not initialized');
            return;
        }
        
        if (currentUserProfile.coins <= 0) {
            alert('У вас недостаточно монет для совершения сделки');
            return;
        }
        
        const { data: user, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) {
            console.error('Ошибка загрузки профиля пользователя:', error);
            return;
        }
        
        selectedUser = user;
        
        if (dealPlayerName) dealPlayerName.textContent = user.username;
        if (dealAvatar) dealAvatar.textContent = user.username.charAt(0).toUpperCase();
        if (dealPlayerClass) dealPlayerClass.textContent = `Класс: ${user.class}`;
        if (dealPlayerCoins) dealPlayerCoins.textContent = user.coins;
        if (dealPlayerReputation) dealPlayerReputation.textContent = user.reputation;
        
        const todayDealsCount = await getTodayDealsCount(userId);
        if (dealLimitInfo && dealLimitText) {
            if (todayDealsCount >= 5) {
                dealLimitText.textContent = `Вы уже совершили максимальное количество сделок (5) с игроком ${user.username} сегодня. Попробуйте завтра или выберите другого игрока.`;
                dealLimitInfo.style.display = 'block';
                
                if (document.getElementById('cooperateBtn')) {
                    document.getElementById('cooperateBtn').disabled = true;
                    document.getElementById('cooperateBtn').classList.add('btn-disabled');
                }
                if (document.getElementById('cheatBtn')) {
                    document.getElementById('cheatBtn').disabled = true;
                    document.getElementById('cheatBtn').classList.add('btn-disabled');
                }
            } else {
                dealLimitText.textContent = `Вы уже совершили ${todayDealsCount} из 5 возможных сделок с этим игроком сегодня.`;
                dealLimitInfo.style.display = 'block';
                
                if (document.getElementById('cooperateBtn')) {
                    document.getElementById('cooperateBtn').disabled = false;
                    document.getElementById('cooperateBtn').classList.remove('btn-disabled');
                }
                if (document.getElementById('cheatBtn')) {
                    document.getElementById('cheatBtn').disabled = false;
                    document.getElementById('cheatBtn').classList.remove('btn-disabled');
                }
            }
        }
        
        if (dealModal) {
            dealModal.classList.add('active');
        }
    } catch (error) {
        console.error('Ошибка показа модального окна:', error);
    }
}

async function getTodayDealsCount(targetUserId) {
    try {
        if (!supabase || !currentUser) {
            return 0;
        }
        
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        const { data: todayDeals, error } = await supabase
            .from('deals')
            .select('id, created_at')
            .eq('from_user', currentUser.id)
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
        if (!supabase || !currentUser || !selectedUser || !currentUserProfile) {
            console.error('Required data not initialized');
            return;
        }
        
        if (currentUserProfile.coins <= 0) {
            alert('У вас недостаточно монет для совершения сделки');
            if (dealModal) {
                dealModal.classList.remove('active');
            }
            return;
        }
        
        const todayDealsCount = await getTodayDealsCount(selectedUser.id);
        
        if (todayDealsCount >= 5) {
            alert(`Вы уже совершили максимальное количество сделок (5) с игроком ${selectedUser.username} сегодня. Попробуйте завтра или выберите другого игрока.`);
            return;
        }
        
        const { data, error } = await supabase
            .from('deals')
            .insert([
                {
                    from_user: currentUser.id,
                    to_user: selectedUser.id,
                    from_choice: choice,
                    status: 'pending'
                }
            ]);
        
        if (error) {
            throw error;
        }
        
        alert('Сделка предложена успешно!');
        if (dealModal) {
            dealModal.classList.remove('active');
        }
        loadDeals();
    } catch (error) {
        console.error('Ошибка предложения сделки:', error);
        alert('Ошибка: ' + error.message);
    }
}

export async function showResponseModal(dealId) {
    try {
        if (!supabase) {
            console.error('Supabase not initialized');
            return;
        }
        
        const { data: deal, error } = await supabase
            .from('deals')
            .select(`
                *,
                from_user:profiles!deals_from_user_fkey(username, class, coins, reputation)
            `)
            .eq('id', dealId)
            .single();
        
        if (error) {
            console.error('Ошибка загрузки сделки:', error);
            return;
        }
        
        selectedDeal = deal;
        
        if (responseDealInfo) {
            responseDealInfo.innerHTML = `
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
        
        if (responseModal) {
            responseModal.classList.add('active');
        }
    } catch (error) {
        console.error('Ошибка показа модального окна ответа:', error);
    }
}

export async function respondToDeal(choice) {
    try {
        if (!supabase || !selectedDeal) {
            console.error('Required data not initialized');
            return;
        }
        
        const { data: result, error } = await supabase.rpc('process_deal', {
            deal_id: selectedDeal.id,
            response_choice: choice
        });
        
        if (error) {
            throw error;
        }
        
        await showDealResult(selectedDeal, choice, result);
        
        if (responseModal) {
            responseModal.classList.remove('active');
        }
        
        loadDeals();
        if (currentUser) {
            const { loadUserProfile } = await import('./users.js');
            loadUserProfile(currentUser.id);
        }
    } catch (error) {
        console.error('Ошибка ответа на сделку:', error);
        alert('Ошибка: ' + error.message);
    }
}

async function showDealResult(deal, userChoice, result) {
    try {
        if (!resultModal || !resultContent) {
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
        
        resultContent.innerHTML = resultHtml;
        resultModal.classList.add('active');
        
    } catch (error) {
        console.error('Ошибка показа результата сделки:', error);
    }
}

export async function loadDeals() {
    try {
        if (!supabase || !currentUser) {
            console.error('Supabase or current user not initialized');
            return;
        }
        
        // Входящие сделки
        const { data: incoming, error: incomingError } = await supabase
            .from('deals')
            .select(`
                *,
                from_user:profiles!deals_from_user_fkey(username, class, coins, reputation)
            `)
            .eq('to_user', currentUser.id)
            .eq('status', 'pending');
        
        if (incomingError) {
            console.error('Ошибка загрузки входящих сделок:', incomingError);
        } else if (incomingDeals) {
            incomingDeals.innerHTML = '';
            
            if (incoming.length === 0) {
                incomingDeals.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>Нет входящих сделок</p>
                    </div>
                `;
            } else {
                incoming.forEach(deal => {
                    const dealItem = document.createElement('div');
                    dealItem.className = 'deal-item';
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
                    
                    incomingDeals.appendChild(dealItem);
                });
                
                document.querySelectorAll('.respond-deal').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const dealId = this.dataset.dealId;
                        showResponseModal(dealId);
                    });
                });
            }
        }
        
        // Ожидающие ответа сделки
        const { data: pending, error: pendingError } = await supabase
            .from('deals')
            .select(`
                *,
                to_user:profiles!deals_to_user_fkey(username, class)
            `)
            .eq('from_user', currentUser.id)
            .eq('status', 'pending');
        
        if (pendingError) {
            console.error('Ошибка загрузки ожидающих сделок:', pendingError);
        } else if (pendingDeals) {
            pendingDeals.innerHTML = '';
            
            if (pending.length === 0) {
                pendingDeals.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-clock"></i>
                        <p>Нет ожидающих ответа сделок</p>
                    </div>
                `;
            } else {
                pending.forEach(deal => {
                    const dealItem = document.createElement('div');
                    dealItem.className = 'deal-item';
                    dealItem.innerHTML = `
                        <div>
                            <p><strong>Кому:</strong> ${deal.to_user.username} (${deal.to_user.class})</p>
                            <p><strong>Ваш выбор:</strong> ${deal.from_choice === 'cooperate' ? 'Сотрудничать' : 'Жульничать'}</p>
                            <p><strong>Статус:</strong> <span class="badge badge-warning">Ожидание</span></p>
                        </div>
                    `;
                    
                    pendingDeals.appendChild(dealItem);
                });
            }
        }
        
        // Все сделки (история)
        const { data: all, error: allError } = await supabase
            .from('deals')
            .select(`
                *,
                from_user:profiles!deals_from_user_fkey(username, class),
                to_user:profiles!deals_to_user_fkey(username, class)
            `)
            .or(`from_user.eq.${currentUser.id},to_user.eq.${currentUser.id}`)
            .order('created_at', { ascending: false });
        
        if (allError) {
            console.error('Ошибка загрузки всех сделок:', allError);
        } else if (allDeals) {
            allDeals.innerHTML = '';
            
            if (all.length === 0) {
                allDeals.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-history"></i>
                        <p>Нет завершенных сделок</p>
                    </div>
                `;
            } else {
                all.forEach(deal => {
                    const isOutgoing = deal.from_user.id === currentUser.id;
                    const otherUser = isOutgoing ? deal.to_user : deal.from_user;
                    const directionText = isOutgoing ? "Кому:" : "От кого:";
                    
                    const statusBadge = deal.status === 'pending' ? 
                        '<span class="badge badge-warning">Ожидание</span>' : 
                        deal.status === 'completed' ? 
                        '<span class="badge badge-success">Завершена</span>' :
                        '<span class="badge badge-danger">Отклонена</span>';
                    
                    let resultHtml = '';
                    if (deal.status === 'completed') {
                        let coinsChange = 0;
                        let resultClass = '';
                        let resultText = '';
                        
                        if (isOutgoing) {
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
                        } else {
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
                        }
                        
                        resultHtml = `<div class="deal-result ${resultClass}">Результат: ${resultText}</div>`;
                    }
                    
                    const dealItem = document.createElement('div');
                    dealItem.className = 'deal-item';
                    
                    let dealInfo = `
                        <div>
                            <p><strong>${directionText}</strong> ${otherUser.username} (${otherUser.class})</p>
                            <p><strong>Ваш выбор:</strong> ${isOutgoing ? (deal.from_choice === 'cooperate' ? 'Сотрудничать' : 'Жульничать') : (deal.to_choice === 'cooperate' ? 'Сотрудничать' : 'Жульничать')}</p>
                    `;
                    
                    if (deal.status === 'completed') {
                        dealInfo += `<p><strong>Ответ:</strong> ${isOutgoing ? (deal.to_choice === 'cooperate' ? 'Сотрудничать' : 'Жульничать') : (deal.from_choice === 'cooperate' ? 'Сотрудничать' : 'Жульничать')}</p>`;
                    }
                    
                    dealInfo += `<p><strong>Статус:</strong> ${statusBadge}</p>`;
                    dealInfo += resultHtml;
                    dealInfo += `</div>`;
                    
                    dealItem.innerHTML = dealInfo;
                    allDeals.appendChild(dealItem);
                });
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки сделок:', error);
    }
}

export async function loadRanking() {
    try {
        if (!supabase) {
            console.error('Supabase not initialized');
            return;
        }
        
        const { data: users, error } = await supabase
            .from('profiles')
            .select('*')
            .order('coins', { ascending: false });
        
        if (error) {
            console.error('Ошибка загрузки рейтинга:', error);
            return;
        }
        
        if (rankingTable) {
            rankingTable.innerHTML = '';
            
            if (users.length === 0) {
                rankingTable.innerHTML = `
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
                users.forEach((user, index) => {
                    const row = document.createElement('tr');
                    
                    if (currentUser && user.id === currentUser.id) {
                        row.classList.add('current-user');
                    }
                    
                    row.innerHTML = `
                        <td>${index + 1}</td>
                        <td>${user.username} ${currentUser && user.id === currentUser.id ? '(Вы)' : ''}</td>
                        <td>${user.class}</td>
                        <td>${user.coins}</td>
                        <td>${user.reputation}</td>
                    `;
                    
                    rankingTable.appendChild(row);
                });
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки рейтинга:', error);
    }
}