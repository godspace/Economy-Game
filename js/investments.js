import { state, dom } from './config.js';

export async function loadInvestments() {
    try {
        if (!state.supabase || !state.currentUser) {
            console.error('Supabase or current user not initialized');
            return;
        }
        
        const { data: activeDeposits, error: activeError } = await state.supabase
            .from('deposits')
            .select('*')
            .eq('user_id', state.currentUser.id)
            .eq('status', 'active');
        
        if (activeError) {
            console.error('Ошибка загрузки активных вкладов:', activeError);
        } else {
            Object.values(state.depositTimers).forEach(timer => clearInterval(timer));
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
                        
                        startDepositTimer(deposit.id, deposit.end_time);
                    });
                }
            }
        }
        
        const { data: depositHistory, error: historyError } = await state.supabase
            .from('deposits')
            .select('*')
            .eq('user_id', state.currentUser.id)
            .eq('status', 'completed')
            .order('updated_at', { ascending: false });
        
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
                                <div>Итоговая сумма: ${deposit.final_amount || (deposit.amount + deposit.actual_profit)} монет</div>
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
                    
                    dom.depositHistoryList.appendChild(depositItem);
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
            clearInterval(state.depositTimers[depositId]);
            delete state.depositTimers[depositId];
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
        createDeposit(type, amount, duration, profit, isRisky);
    });
    
    dom.depositModal.classList.add('active');
}

async function createDeposit(type, amount, duration, profit, isRisky) {
    try {
        if (!state.supabase || !state.currentUser) {
            throw new Error('Система не инициализирована');
        }
        
        // Проверяем минимальную сумму
        if (amount < 1) {
            throw new Error('Минимальная сумма вклада - 1 монета');
        }
        
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + parseInt(duration) * 60000);
        
        let expectedProfit = profit;
        if (isRisky) {
            expectedProfit = 2; // Для рисковых вкладов
        }
        
        // Создаем вклад (триггер автоматически проверит баланс и вычтет сумму)
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
            // Обрабатываем ошибку от триггера
            if (error.message.includes('Недостаточно средств')) {
                throw new Error('Недостаточно монет для открытия вклада');
            }
            throw error;
        }
        
        // Обновляем баланс на клиенте (после успешного вычитания)
        const { data: updatedProfile } = await state.supabase
            .from('profiles')
            .select('coins')
            .eq('id', state.currentUser.id)
            .single();
        
        if (updatedProfile) {
            state.currentUserProfile.coins = updatedProfile.coins;
            dom.coinsValue.textContent = updatedProfile.coins;
        }
        
        alert('Вклад успешно открыт!');
        dom.depositModal.classList.remove('active');
        
        loadInvestments();
        
    } catch (error) {
        console.error('Ошибка создания вклада:', error);
        alert('Ошибка: ' + error.message);
    }
}

async function completeDeposit(depositId) {
    try {
        if (!state.supabase || !state.currentUser) {
            console.error('Supabase or current user not initialized');
            return;
        }
        
        // Получаем данные о вкладе с блокировкой для предотвращения двойного выполнения
        const { data: deposit, error: depositError } = await state.supabase
            .from('deposits')
            .select('*')
            .eq('id', depositId)
            .eq('status', 'active') // Только активные вклады
            .single();
        
        if (depositError) {
            console.error('Ошибка получения вклада или вклад уже завершен:', depositError);
            return;
        }
        
        // Проверяем, не завершен ли уже вклад
        if (deposit.status !== 'active') {
            console.log('Вклад уже завершен:', depositId);
            return;
        }
        
        let profit = 0;
        let finalAmount = deposit.amount;
        
        if (deposit.is_risky) {
            // Для рисковых вкладов: 40% шанс получить +20%, 60% шанс потерять 10%
            const random = Math.random();
            if (random <= 0.4) {
                profit = Math.floor(deposit.amount * 0.2); // +20%
                finalAmount = deposit.amount + profit;
            } else {
                profit = -Math.floor(deposit.amount * 0.1); // -10%
                finalAmount = deposit.amount + profit;
            }
        } else {
            // Для безрисковых вкладов: фиксированный процент
            profit = Math.floor(deposit.amount * (deposit.expected_profit / 100));
            finalAmount = deposit.amount + profit;
        }
        
        console.log(`Завершение вклада ${depositId}: сумма=${deposit.amount}, прибыль=${profit}, итого=${finalAmount}`);
        
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
        
        // Рассчитываем новый баланс: ТОЛЬКО ПРИБЫЛЬ, так как основная сумма уже была списана при создании вклада
        const newCoins = profile.coins + profit;
        
        console.log(`Текущий баланс: ${profile.coins}, новая прибыль: ${profit}, новый баланс: ${newCoins}`);
        
        // Обновляем баланс пользователя - зачисляем только прибыль
        const { error: updateError } = await state.supabase
            .from('profiles')
            .update({ coins: newCoins })
            .eq('id', state.currentUser.id);
        
        if (updateError) {
            console.error('Ошибка обновления баланса:', updateError);
            return;
        }
        
        // Обновляем вклад - помечаем как завершенный и сохраняем прибыль и итоговую сумму
        const { error: updateDepositError } = await state.supabase
            .from('deposits')
            .update({ 
                status: 'completed',
                actual_profit: profit,
                final_amount: finalAmount,
                updated_at: new Date().toISOString()
            })
            .eq('id', depositId);
        
        if (updateDepositError) {
            console.error('Ошибка обновления вклада:', updateDepositError);
            // Откатываем изменение баланса при ошибке
            await state.supabase
                .from('profiles')
                .update({ coins: profile.coins })
                .eq('id', state.currentUser.id);
            return;
        }
        
        // Обновляем баланс на клиенте
        state.currentUserProfile.coins = newCoins;
        dom.coinsValue.textContent = newCoins;
        
        showDepositResult(deposit, profit, finalAmount);
        
        // Перезагружаем список вкладов
        loadInvestments();
        
    } catch (error) {
        console.error('Ошибка завершения вклада:', error);
    }
}

function showDepositResult(deposit, profit, finalAmount) {
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
                    <p>Итоговая сумма: ${finalAmount} монет</p>
                    <p>Изначальная сумма: ${deposit.amount} монет</p>
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
                    <p>Итоговая сумма: ${finalAmount} монет</p>
                    <p>Изначальная сумма: ${deposit.amount} монет</p>
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
                    <p>Итоговая сумма: ${finalAmount} монет</p>
                    <p>Изначальная сумма: ${deposit.amount} монет</p>
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