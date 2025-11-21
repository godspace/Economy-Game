import { supabaseClient, currentUser, depositTimers, activeDepositsList, depositHistoryList, depositModal, depositModalContent, depositResultModal, depositResultContent, coinsValue } from './config.js';

export async function loadInvestments() {
    try {
        if (!supabaseClient || !currentUser) {
            console.error('Supabase or current user not initialized');
            return;
        }
        
        const { data: activeDeposits, error: activeError } = await supabaseClient
            .from('deposits')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('status', 'active');
        
        if (activeError) {
            console.error('Ошибка загрузки активных вкладов:', activeError);
        } else {
            Object.values(depositTimers).forEach(timer => clearInterval(timer));
            depositTimers = {};
            
            if (activeDepositsList) {
                activeDepositsList.innerHTML = '';
                
                if (activeDeposits.length === 0) {
                    activeDepositsList.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-clock"></i>
                            <p>Нет активных вкладов</p>
                        </div>
                    `;
                } else {
                    activeDeposits.forEach(deposit => {
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
                        
                        activeDepositsList.appendChild(depositItem);
                        
                        startDepositTimer(deposit.id, deposit.end_time);
                    });
                }
            }
        }
        
        const { data: depositHistory, error: historyError } = await supabaseClient
            .from('deposits')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('status', 'completed')
            .order('updated_at', { ascending: false });
        
        if (historyError) {
            console.error('Ошибка загрузки истории вкладов:', historyError);
        } else if (depositHistoryList) {
            depositHistoryList.innerHTML = '';
            
            if (depositHistory.length === 0) {
                depositHistoryList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-history"></i>
                        <p>Нет завершенных вкладов</p>
                    </div>
                `;
            } else {
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
                                ${new Date(deposit.updated_at).toLocaleDateString()}
                            </div>
                        </div>
                    `;
                    
                    depositHistoryList.appendChild(depositItem);
                });
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки вкладов:', error);
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
            clearInterval(depositTimers[depositId]);
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
    depositTimers[depositId] = setInterval(updateTimer, 1000);
}

export function openDepositModal(type, duration, profit, isRisky) {
    if (!currentUser) {
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
    
    depositModalContent.innerHTML = `
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
        createDeposit(type, amount, duration, profit, isRisky);
    });
    
    depositModal.classList.add('active');
}

async function createDeposit(type, amount, duration, profit, isRisky) {
    try {
        if (!supabaseClient || !currentUser) {
            console.error('Supabase or current user not initialized');
            return;
        }
        
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('coins')
            .eq('id', currentUser.id)
            .single();
        
        if (profileError) {
            console.error('Ошибка получения профиля:', profileError);
            return;
        }
        
        if (profile.coins < amount) {
            alert('Недостаточно монет для открытия вклада');
            return;
        }
        
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + parseInt(duration) * 60000);
        
        let expectedProfit = profit;
        if (isRisky) {
            expectedProfit = 2;
        }
        
        const { data: deposit, error } = await supabaseClient
            .from('deposits')
            .insert([
                {
                    user_id: currentUser.id,
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
            throw error;
        }
        
        const newCoins = profile.coins - amount;
        const { error: updateError } = await supabaseClient
            .from('profiles')
            .update({ coins: newCoins })
            .eq('id', currentUser.id);
        
        if (updateError) {
            console.error('Ошибка обновления баланса:', updateError);
            return;
        }
        
        coinsValue.textContent = newCoins;
        
        alert('Вклад успешно открыт!');
        depositModal.classList.remove('active');
        
        loadInvestments();
        
    } catch (error) {
        console.error('Ошибка создания вклада:', error);
        alert('Ошибка: ' + error.message);
    }
}

async function completeDeposit(depositId) {
    try {
        if (!supabaseClient || !currentUser) {
            console.error('Supabase or current user not initialized');
            return;
        }
        
        const { data: deposit, error: depositError } = await supabaseClient
            .from('deposits')
            .select('*')
            .eq('id', depositId)
            .single();
        
        if (depositError) {
            console.error('Ошибка получения вклада:', depositError);
            return;
        }
        
        let profit = 0;
        if (deposit.is_risky) {
            const random = Math.random();
            if (random <= 0.4) {
                profit = Math.floor(deposit.amount * 0.2);
            } else {
                profit = -Math.floor(deposit.amount * 0.1);
            }
        } else {
            profit = Math.floor(deposit.amount * (deposit.expected_profit / 100));
        }
        
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('coins')
            .eq('id', currentUser.id)
            .single();
        
        if (profileError) {
            console.error('Ошибка получения профиля:', profileError);
            return;
        }
        
        const newCoins = profile.coins + deposit.amount + profit;
        const { error: updateError } = await supabaseClient
            .from('profiles')
            .update({ coins: newCoins })
            .eq('id', currentUser.id);
        
        if (updateError) {
            console.error('Ошибка обновления баланса:', updateError);
            return;
        }
        
        const { error: updateDepositError } = await supabaseClient
            .from('deposits')
            .update({ 
                status: 'completed',
                actual_profit: profit
            })
            .eq('id', depositId);
        
        if (updateDepositError) {
            console.error('Ошибка обновления вклада:', updateDepositError);
            return;
        }
        
        coinsValue.textContent = newCoins;
        
        showDepositResult(deposit, profit);
        
        loadInvestments();
        
    } catch (error) {
        console.error('Ошибка завершения вклада:', error);
    }
}

function showDepositResult(deposit, profit) {
    try {
        if (!depositResultModal || !depositResultContent) {
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
                    <p>Общая сумма: ${deposit.amount + profit} монет</p>
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
                    <p>Общая сумма: ${deposit.amount + profit} монет</p>
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
                    <p>Общая сумма: ${deposit.amount} монет</p>
                </div>
                <p>Вы сохранили свои средства без изменений.</p>
            `;
        }
        
        depositResultContent.innerHTML = resultHtml;
        depositResultModal.classList.add('active');
        
    } catch (error) {
        console.error('Ошибка показа результата вклада:', error);
    }
}