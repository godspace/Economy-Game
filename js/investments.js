import { state, dom } from './config.js';

export async function loadInvestments() {
    try {
        if (!state.supabase || !state.isAuthenticated || !state.currentUserProfile) {
            console.error('Supabase or authentication not initialized');
            return;
        }
        
        // Сначала проверяем и завершаем просроченные вклады
        await checkAndCompleteExpiredDeposits();
        
        const { data: activeDeposits, error: activeError } = await state.supabase
            .from('deposits')
            .select('*')
            .eq('user_id', state.currentUserProfile.id)
            .eq('status', 'active');
        
        if (activeError) {
            console.error('Ошибка загрузки активных вкладов:', activeError);
        } else {
            // Очищаем старые таймеры
            Object.values(state.depositTimers).forEach(timer => {
                if (timer) clearInterval(timer);
            });
            state.depositTimers = {};
            
            if (dom.activeDepositsList) {
                dom.activeDepositsList.innerHTML = '';
                
                if (activeDeposits.length === 0) {
                    dom.activeDepositsList.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-clock"></i>
                            <p>Нет активных вкладов</p>
                        </div>
                    `;
                } else {
                    activeDeposits.forEach(deposit => {
                        // Проверяем, не истек ли уже вклад
                        const now = new Date().getTime();
                        const endTime = new Date(deposit.end_time).getTime();
                        
                        if (endTime <= now) {
                            // Немедленно завершаем просроченный вклад
                            completeDeposit(deposit.id);
                        } else {
                            // Создаем таймер для активного вклада
                            createDepositItem(deposit);
                            startDepositTimer(deposit.id, deposit.end_time);
                        }
                    });
                }
            }
        }
        
        // Загружаем историю вкладов
        await loadDepositHistory();
        
    } catch (error) {
        console.error('Ошибка загрузки вкладов:', error);
    }
}

// Новая функция: проверка и завершение просроченных вкладов
async function checkAndCompleteExpiredDeposits() {
    try {
        if (!state.supabase || !state.currentUser) return;

        const { data: expiredDeposits, error } = await state.supabase
            .from('deposits')
            .select('*')
            .eq('user_id', state.currentUser.id)
            .eq('status', 'active')
            .lt('end_time', new Date().toISOString());

        if (error) {
            console.error('Ошибка проверки просроченных вкладов:', error);
            return;
        }

        // Завершаем все просроченные вклады
        for (const deposit of expiredDeposits) {
            await completeDeposit(deposit.id);
        }
    } catch (error) {
        console.error('Ошибка при завершении просроченных вкладов:', error);
    }
}

// Новая функция: создание элемента вклада
function createDepositItem(deposit) {
    if (!dom.activeDepositsList) return;

    const depositItem = document.createElement('div');
    depositItem.className = 'deposit-item';
    depositItem.id = `deposit-${deposit.id}`;
    
    const depositTypeNames = {
        'call': '«По звонку»',
        'night': '«Спокойная ночь»',
        'champion': '«Чемпион»',
        'crypto': '«Крипта»'
    };
    
    depositItem.innerHTML = `
        <div class="deposit-info">
            <div class="deposit-type">${depositTypeNames[deposit.type] || deposit.type}</div>
            <div class="deposit-details">
                <div class="deposit-amount">${deposit.amount} монет</div>
                <div>Доходность: ${deposit.expected_profit}%</div>
            </div>
        </div>
        <div class="deposit-timer">
            <div class="timer-value" id="timer-${deposit.id}">--:--:--</div>
            <div class="timer-label">До завершения</div>
        </div>
    `;
    
    dom.activeDepositsList.appendChild(depositItem);
}

// Новая функция: загрузка истории вкладов
async function loadDepositHistory() {
    try {
        const { data: depositHistory, error: historyError } = await state.supabase
            .from('deposits')
            .select('*')
            .eq('user_id', state.currentUserProfile.id)
            .eq('status', 'completed')
            .order('updated_at', { ascending: false })
            .limit(50);
        
        if (historyError) {
            console.error('Ошибка загрузки истории вкладов:', historyError);
        } else if (dom.depositHistoryList) {
            dom.depositHistoryList.innerHTML = '';
            
            if (depositHistory.length === 0) {
                dom.depositHistoryList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-history"></i>
                        <p>Нет завершенных вкладов</p>
                    </div>
                `;
            } else {
                const fragment = document.createDocumentFragment();
                
                depositHistory.forEach(deposit => {
                    const depositItem = document.createElement('div');
                    depositItem.className = 'deposit-item';
                    
                    const depositTypeNames = {
                        'call': '«По звонку»',
                        'night': '«Спокойная ночь»',
                        'champion': '«Чемпион»',
                        'crypto': '«Крипта»'
                    };
                    
                    const profitClass = deposit.actual_profit > 0 ? 'profit-positive' : 
                                      deposit.actual_profit < 0 ? 'profit-negative' : '';
                    const profitSign = deposit.actual_profit > 0 ? '+' : '';
                    
                    depositItem.innerHTML = `
                        <div class="deposit-info">
                            <div class="deposit-type">${depositTypeNames[deposit.type] || deposit.type}</div>
                            <div class="deposit-details">
                                <div class="deposit-amount">${deposit.amount} монет</div>
                                <div>Сумма возврата: ${deposit.amount + deposit.actual_profit} монет</div>
                                <div class="${profitClass}">Прибыль: ${profitSign}${deposit.actual_profit} монет</div>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div>Завершен</div>
                            <div style="font-size: 0.8rem; color: var(--gray);">
                                ${new Date(deposit.updated_at).toLocaleDateString('ru-RU')}
                            </div>
                        </div>
                    `;
                    
                    fragment.appendChild(depositItem);
                });
                
                dom.depositHistoryList.appendChild(fragment);
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки истории вкладов:', error);
    }
}

export function startDepositTimer(depositId, endTime) {
    const timerElement = document.getElementById(`timer-${depositId}`);
    if (!timerElement) return;
    
    const updateTimer = () => {
        const now = new Date().getTime();
        const end = new Date(endTime).getTime();
        const timeLeft = end - now;
        
        if (timeLeft <= 0) {
            timerElement.textContent = '00:00:00';
            if (state.depositTimers[depositId]) {
                clearInterval(state.depositTimers[depositId]);
                delete state.depositTimers[depositId];
            }
            completeDeposit(depositId);
            return;
        }
        
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        
        timerElement.textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };
    
    updateTimer();
    state.depositTimers[depositId] = setInterval(updateTimer, 1000);
}

// ИСПРАВЛЕННАЯ ФУНКЦИЯ: Завершение вклада
export async function completeDeposit(depositId) {
    try {
        if (!state.supabase || !state.currentUser) {
            console.error('Supabase or current user not initialized');
            return;
        }
        
        // Получаем данные вклада
        const { data: deposit, error: depositError } = await state.supabase
            .from('deposits')
            .select('*')
            .eq('id', depositId)
            .single();
        
        if (depositError) {
            console.error('Ошибка получения вклада:', depositError);
            return;
        }
        
        // Проверяем, что вклад еще активен
        if (deposit.status !== 'active') {
            console.log('Вклад уже завершен');
            return;
        }
        
        // Вычисляем прибыль
        let profit = 0;
        if (deposit.is_risky) {
            const random = Math.random();
            if (random <= 0.4) {
                profit = Math.floor(deposit.amount * 0.2); // +20%
            } else {
                profit = -Math.floor(deposit.amount * 0.1); // -10%
            }
        } else {
            profit = Math.floor(deposit.amount * (deposit.expected_profit / 100));
        }
        
        // ВЫЧИСЛЯЕМ ОБЩУЮ СУММУ К ВОЗВРАТУ
        const totalReturn = deposit.amount + profit;
        
        console.log(`Завершение вклада: ${deposit.amount} + ${profit} = ${totalReturn} монет`);
        
        // Используем RPC функцию для атомарного завершения вклада и начисления средств
        const { data: result, error: rpcError } = await state.supabase.rpc('complete_deposit', {
            p_deposit_id: depositId,
            p_actual_profit: profit
        });
        
        if (rpcError) {
            console.error('Ошибка RPC завершения вклада:', rpcError);
            
            // Fallback: ручное завершение если RPC недоступно
            await manualCompleteDeposit(depositId, profit);
            return;
        }
        
        if (result && result.success) {
            console.log('Вклад успешно завершен через RPC');
            
            // Обновляем баланс пользователя
            await updateUserBalance();
            
            // Показываем результат
            showDepositResult(deposit, profit);
            
            // Перезагружаем список вкладов
            setTimeout(() => loadInvestments(), 1000);
            
        } else {
            console.error('RPC завершилось с ошибкой:', result);
            await manualCompleteDeposit(depositId, profit);
        }
        
    } catch (error) {
        console.error('Критическая ошибка завершения вклада:', error);
    }
}

// Ручное завершение вклада (fallback)
async function manualCompleteDeposit(depositId, profit) {
    try {
        // Получаем текущий баланс пользователя
        const { data: profile, error: profileError } = await state.supabase
            .from('profiles')
            .select('coins')
            .eq('id', state.currentUser.id)
            .single();
        
        if (profileError) {
            console.error('Ошибка получения профиля:', profileError);
            return;
        }
        
        // Получаем данные вклада для вычисления суммы возврата
        const { data: deposit, error: depositError } = await state.supabase
            .from('deposits')
            .select('amount')
            .eq('id', depositId)
            .single();
        
        if (depositError) {
            console.error('Ошибка получения суммы вклада:', depositError);
            return;
        }
        
        const totalReturn = deposit.amount + profit;
        const newCoins = profile.coins + totalReturn;
        
        // Обновляем баланс пользователя
        const { error: updateError } = await state.supabase
            .from('profiles')
            .update({ coins: newCoins })
            .eq('id', state.currentUser.id);
        
        if (updateError) {
            console.error('Ошибка обновления баланса:', updateError);
            return;
        }
        
        // Помечаем вклад как завершенный
        const { error: updateDepositError } = await state.supabase
            .from('deposits')
            .update({ 
                status: 'completed',
                actual_profit: profit,
                updated_at: new Date().toISOString()
            })
            .eq('id', depositId);
        
        if (updateDepositError) {
            console.error('Ошибка обновления вклада:', updateDepositError);
            return;
        }
        
        console.log('Вклад завершен вручную');
        
        // Обновляем интерфейс
        dom.coinsValue.textContent = newCoins;
        
        // Получаем полные данные вклада для показа результата
        const { data: completedDeposit } = await state.supabase
            .from('deposits')
            .select('*')
            .eq('id', depositId)
            .single();
            
        if (completedDeposit) {
            showDepositResult(completedDeposit, profit);
        }
        
        // Перезагружаем список вкладов
        setTimeout(() => loadInvestments(), 1000);
        
    } catch (error) {
        console.error('Ошибка ручного завершения вклада:', error);
    }
}

// Обновление баланса пользователя
async function updateUserBalance() {
    try {
        const { data: profile, error } = await state.supabase
            .from('profiles')
            .select('coins')
            .eq('id', state.currentUser.id)
            .single();
        
        if (error) {
            console.error('Ошибка обновления баланса:', error);
            return;
        }
        
        if (profile && dom.coinsValue) {
            dom.coinsValue.textContent = profile.coins;
        }
    } catch (error) {
        console.error('Ошибка при обновлении баланса:', error);
    }
}

export function openDepositModal(type, duration, profit, isRisky) {
    if (!state.currentUser) {
        alert('Необходимо авторизоваться');
        return;
    }
    
    const depositTypeNames = {
        'call': '«По звонку»',
        'night': '«Спокойная ночь»',
        'champion': '«Чемпион»',
        'crypto': '«Крипта»'
    };
    
    const durationTexts = {
        '45': '45 минут',
        '720': '12 часов',
        '1440': '24 часа'
    };
    
    let riskHtml = '';
    if (isRisky) {
        riskHtml = `
            <div style="margin: 10px 0;">
                <div><span class="profit-positive">Доходность: +${profit}% с вероятностью 40%</span></div>
                <div><span class="profit-negative">Убыточность: -10% с вероятностью 60%</span></div>
            </div>
        `;
    }
    
    dom.depositModalContent.innerHTML = `
        <div class="deposit-info">
            <h3>${depositTypeNames[type]}</h3>
            <p><strong>Длительность:</strong> ${durationTexts[duration]}</p>
            <p><strong>Доходность:</strong> ${isRisky ? 'рисковая' : `+${profit}%`}</p>
            ${riskHtml}
        </div>
        <div class="form-group">
            <label for="depositAmount">Сумма вклада</label>
            <input type="number" id="depositAmount" placeholder="Введите сумму" min="1" required>
        </div>
        <button id="confirmDepositBtn" class="${isRisky ? 'btn-warning' : 'btn-success'}">
            <i class="fas fa-lock-open"></i> ${isRisky ? 'Испытать удачу' : 'Открыть вклад'}
        </button>
    `;
    
    document.getElementById('confirmDepositBtn').addEventListener('click', function() {
        const amount = parseInt(document.getElementById('depositAmount').value);
        if (isNaN(amount) || amount <= 0) {
            alert('Введите корректную сумму');
            return;
        }
        if (amount > (state.currentUserProfile?.coins || 0)) {
            alert('Недостаточно монет для открытия вклада');
            return;
        }
        createDeposit(type, amount, duration, profit, isRisky);
    });
    
    dom.depositModal.classList.add('active');
}

async function createDeposit(type, amount, duration, profit, isRisky) {
    try {
        if (!state.supabase || !state.currentUser) {
            throw new Error('Система не инициализирована');
        }
        
        if (amount < 1) {
            throw new Error('Минимальная сумма вклада - 1 монета');
        }
        
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + parseInt(duration) * 60000);
        
        let expectedProfit = profit;
        if (isRisky) {
            expectedProfit = 20; // Для отображения в интерфейсе
        }
        
        const { data: deposit, error } = await state.supabase
            .from('deposits')
            .insert([
                {
                    user_id: state.currentUser.id,
                    type: type,
                    amount: amount,
                    expected_profit: expectedProfit,
                    start_time: startTime.toISOString(),
                    end_time: endTime.toISOString(),
                    status: 'active',
                    is_risky: isRisky
                }
            ])
            .select()
            .single();
        
        if (error) {
            if (error.message.includes('Недостаточно средств')) {
                throw new Error('Недостаточно монет для открытия вклада');
            }
            throw error;
        }
        
        // Обновляем баланс на клиенте
        await updateUserBalance();
        
        alert('Вклад успешно открыт!');
        dom.depositModal.classList.remove('active');
        
        // Перезагружаем список вкладов
        loadInvestments();
        
    } catch (error) {
        console.error('Ошибка создания вклада:', error);
        alert('Ошибка: ' + error.message);
    }
}

function showDepositResult(deposit, profit) {
    try {
        if (!dom.depositResultModal || !dom.depositResultContent) {
            return;
        }
        
        const depositTypeNames = {
            'call': '«По звонку»',
            'night': '«Спокойная ночь»',
            'champion': '«Чемпион»',
            'crypto': '«Крипта»'
        };
        
        let resultHtml = '';
        if (profit > 0) {
            resultHtml = `
                <div class="result-message result-success">
                    <div class="result-icon">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <p>Вклад "${depositTypeNames[deposit.type]}" завершен!</p>
                    <p>Вы получили прибыль: <span class="profit-positive">+${profit} монет</span></p>
                    <p>Общая сумма возврата: ${deposit.amount + profit} монет</p>
                </div>
                <p>Поздравляем с успешным вложением!</p>
            `;
        } else if (profit < 0) {
            resultHtml = `
                <div class="result-message result-danger">
                    <div class="result-icon">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <p>Вклад "${depositTypeNames[deposit.type]}" завершен!</p>
                    <p>Вы понесли убыток: <span class="profit-negative">${profit} монет</span></p>
                    <p>Общая сумма возврата: ${deposit.amount + profit} монет</p>
                </div>
                <p>К сожалению, этот раз не удачный. Попробуйте еще!</p>
            `;
        } else {
            resultHtml = `
                <div class="result-message result-warning">
                    <div class="result-icon">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <p>Вклад "${depositTypeNames[deposit.type]}" завершен!</p>
                    <p>Прибыль: 0 монет</p>
                    <p>Общая сумма возврата: ${deposit.amount} монет</p>
                </div>
                <p>Вы сохранили свои средства без изменений.</p>
            `;
        }
        
        dom.depositResultContent.innerHTML = resultHtml;
        dom.depositResultModal.classList.add('active');
        
    } catch (error) {
        console.error('Ошибка показа результата вклада:', error);
    }
}
