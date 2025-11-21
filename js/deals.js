export async function loadDeals() {
    try {
        if (!state.supabase || !state.currentUser) {
            console.error('Supabase or current user not initialized');
            return;
        }
        
        // Входящие сделки
        const { data: incoming, error: incomingError } = await state.supabase
            .from('deals')
            .select(`
                *,
                from_user:profiles!deals_from_user_fkey(username, class, coins, reputation)
            `)
            .eq('to_user', state.currentUser.id)
            .eq('status', 'pending');
        
        if (incomingError) {
            console.error('Ошибка загрузки входящих сделок:', incomingError);
        } else if (dom.incomingDeals) {
            dom.incomingDeals.innerHTML = '';
            
            if (incoming.length === 0) {
                dom.incomingDeals.innerHTML = `
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
                    
                    dom.incomingDeals.appendChild(dealItem);
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
        const { data: pending, error: pendingError } = await state.supabase
            .from('deals')
            .select(`
                *,
                to_user:profiles!deals_to_user_fkey(username, class)
            `)
            .eq('from_user', state.currentUser.id)
            .eq('status', 'pending');
        
        if (pendingError) {
            console.error('Ошибка загрузки ожидающих сделок:', pendingError);
        } else if (dom.pendingDeals) {
            dom.pendingDeals.innerHTML = '';
            
            if (pending.length === 0) {
                dom.pendingDeals.innerHTML = `
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
                    
                    dom.pendingDeals.appendChild(dealItem);
                });
            }
        }
        
        // Все завершённые сделки (история) - только завершённые
        const { data: all, error: allError } = await state.supabase
            .from('deals')
            .select(`
                *,
                from_user:profiles!deals_from_user_fkey(username, class),
                to_user:profiles!deals_to_user_fkey(username, class)
            `)
            .or(`from_user.eq.${state.currentUser.id},to_user.eq.${state.currentUser.id}`)
            .eq('status', 'completed') // Только завершённые сделки
            .order('created_at', { ascending: false });
        
        if (allError) {
            console.error('Ошибка загрузки всех сделок:', allError);
        } else if (dom.allDeals) {
            dom.allDeals.innerHTML = '';
            
            if (all.length === 0) {
                dom.allDeals.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-history"></i>
                        <p>Нет завершенных сделок</p>
                    </div>
                `;
            } else {
                // Разделяем сделки на входящие и исходящие
                const incomingDeals = all.filter(deal => deal.to_user.id === state.currentUser.id);
                const outgoingDeals = all.filter(deal => deal.from_user.id === state.currentUser.id);
                
                // Создаем контейнер с двумя колонками
                const dealsContainer = document.createElement('div');
                dealsContainer.className = 'deals-columns';
                
                // Колонка входящих сделок
                const incomingColumn = document.createElement('div');
                incomingColumn.className = 'deals-column';
                incomingColumn.innerHTML = `
                    <h3 style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                        <i class="fas fa-download"></i> Входящие сделки
                    </h3>
                `;
                
                const incomingList = document.createElement('div');
                incomingList.className = 'deals-list';
                
                if (incomingDeals.length === 0) {
                    incomingList.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-inbox"></i>
                            <p>Нет завершенных входящих сделок</p>
                        </div>
                    `;
                } else {
                    incomingDeals.forEach(deal => {
                        const dealItem = createDealItem(deal, false); // false = входящая сделка
                        incomingList.appendChild(dealItem);
                    });
                }
                
                incomingColumn.appendChild(incomingList);
                
                // Колонка исходящих сделок
                const outgoingColumn = document.createElement('div');
                outgoingColumn.className = 'deals-column';
                outgoingColumn.innerHTML = `
                    <h3 style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                        <i class="fas fa-upload"></i> Исходящие сделки
                    </h3>
                `;
                
                const outgoingList = document.createElement('div');
                outgoingList.className = 'deals-list';
                
                if (outgoingDeals.length === 0) {
                    outgoingList.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-paper-plane"></i>
                            <p>Нет завершенных исходящих сделок</p>
                        </div>
                    `;
                } else {
                    outgoingDeals.forEach(deal => {
                        const dealItem = createDealItem(deal, true); // true = исходящая сделка
                        outgoingList.appendChild(dealItem);
                    });
                }
                
                outgoingColumn.appendChild(outgoingList);
                
                // Добавляем колонки в контейнер
                dealsContainer.appendChild(incomingColumn);
                dealsContainer.appendChild(outgoingColumn);
                
                // Добавляем контейнер в allDeals
                dom.allDeals.appendChild(dealsContainer);
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки сделок:', error);
    }
}

// Вспомогательная функция для создания элемента сделки
function createDealItem(deal, isOutgoing) {
    const otherUser = isOutgoing ? deal.to_user : deal.from_user;
    const directionText = isOutgoing ? "Кому:" : "От кого:";
    
    // Вычисляем результат сделки для текущего пользователя
    let coinsChange = 0;
    let resultClass = '';
    let resultText = '';
    
    if (isOutgoing) {
        // Для исходящих сделок
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
        // Для входящих сделок
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
    
    const dealItem = document.createElement('div');
    dealItem.className = 'deal-item';
    
    let dealInfo = `
        <div>
            <p><strong>${directionText}</strong> ${otherUser.username} (${otherUser.class})</p>
            <p><strong>Ваш выбор:</strong> ${isOutgoing ? (deal.from_choice === 'cooperate' ? 'Сотрудничать' : 'Жульничать') : (deal.to_choice === 'cooperate' ? 'Сотрудничать' : 'Жульничать')}</p>
            <p><strong>Ответ:</strong> ${isOutgoing ? (deal.to_choice === 'cooperate' ? 'Сотрудничать' : 'Жульничать') : (deal.from_choice === 'cooperate' ? 'Сотрудничать' : 'Жульничать')}</p>
    `;
    
    dealInfo += `<p><strong>Статус:</strong> <span class="badge badge-success">Завершена</span></p>`;
    dealInfo += `<div class="deal-result ${resultClass}">Результат: ${resultText}</div>`;
    dealInfo += `</div>`;
    
    dealItem.innerHTML = dealInfo;
    return dealItem;
}