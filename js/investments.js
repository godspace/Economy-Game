import { state, dom, DEPOSIT_TYPES, DEPOSIT_STATUS } from './config.js';

// Константы для типов вкладов и их настроек
const DEPOSIT_CONFIG = {
    call: { name: '«По звонку»', duration: 45, profit: 5, risky: false },
    night: { name: '«Спокойная ночь»', duration: 720, profit: 15, risky: false },
    champion: { name: '«Чемпион»', duration: 1440, profit: 25, risky: false },
    crypto: { name: '«Крипта»', duration: 45, profit: 20, risky: true }
};

const DURATION_TEXTS = {
    45: '45 минут',
    720: '12 часов', 
    1440: '24 часа'
};

// Глобальная переменная для отслеживания состояния создания вклада
let isCreatingDeposit = false;

export async function loadInvestments() {
    try {
        if (!state.supabase || !state.isAuthenticated || !state.currentUserProfile) {
            console.error('Supabase or authentication not initialized');
            return;
        }
        
        console.log('Загрузка вкладов для пользователя:', state.currentUserProfile.id);
        
        // Показываем индикатор загрузки
        setInvestmentsLoading(true);
        
        // Сначала проверяем и завершаем просроченные вклады
        await checkAndCompleteExpiredDeposits();
        
        const [activeResult, historyResult] = await Promise.all([
            // Активные вклады
            state.supabase
                .from('deposits')
                .select('*')
                .eq('user_id', state.currentUserProfile.id)
                .eq('status', DEPOSIT_STATUS.ACTIVE),
            
            // История вкладов
            state.supabase
                .from('deposits')
                .select('*')
                .eq('user_id', state.currentUserProfile.id)
                .eq('status', DEPOSIT_STATUS.COMPLETED)
                .order('updated_at', { ascending: false })
                .limit(50)
        ]);
        
        console.log('Активные вклады:', activeResult.data);
        
        if (activeResult.error) {
            console.error('Ошибка загрузки активных вкладов:', activeResult.error);
            renderActiveDepositsError('Не удалось загрузить активные вклады');
        } else {
            await renderActiveDeposits(activeResult.data);
        }
        
        if (historyResult.error) {
            console.error('Ошибка загрузки истории вкладов:', historyResult.error);
            renderDepositHistoryError('Не удалось загрузить историю вкладов');
        } else {
            renderDepositHistory(historyResult.data);
        }
        
    } catch (error) {
        console.error('Ошибка загрузки вкладов:', error);
        showNotification('Ошибка загрузки вкладов', 'error');
    } finally {
        setInvestmentsLoading(false);
    }
}

// Функция для установки состояния загрузки
function setInvestmentsLoading(isLoading) {
    if (dom.activeDepositsList) {
        dom.activeDepositsList.classList.toggle('loading', isLoading);
    }
    if (dom.depositHistoryList) {
        dom.depositHistoryList.classList.toggle('loading', isLoading);
    }
}

// Новая функция: проверка и завершение просроченных вкладов
async function checkAndCompleteExpiredDeposits() {
    try {
        if (!state.supabase || !state.currentUserProfile) return;

        const { data: expiredDeposits, error } = await state.supabase
            .from('deposits')
            .select('*')
            .eq('user_id', state.currentUserProfile.id)
            .eq('status', DEPOSIT_STATUS.ACTIVE)
            .lt('end_time', new Date().toISOString());

        if (error) {
            console.error('Ошибка проверки просроченных вкладов:', error);
            return;
        }

        // Завершаем все просроченные вклады
        const completionPromises = expiredDeposits.map(deposit => completeDeposit(deposit.id));
        await Promise.allSettled(completionPromises);
        
    } catch (error) {
        console.error('Ошибка при завершении просроченных вкладов:', error);
    }
}

// Функция для рендеринга активных вкладов
async function renderActiveDeposits(activeDeposits) {
    if (!dom.activeDepositsList) return;
    
    try {
        // Очищаем старые таймеры
        Object.values(state.depositTimers).forEach(timer => {
            if (timer) clearInterval(timer);
        });
        state.depositTimers = {};
        
        dom.activeDepositsList.innerHTML = '';
        
        if (!activeDeposits || activeDeposits.length === 0) {
            renderEmptyActiveDeposits();
            return;
        }
        
        const now = new Date().getTime();
        const validDeposits = [];
        
        // Фильтруем и создаем элементы для валидных вкладов
        for (const deposit of activeDeposits) {
            const endTime = new Date(deposit.end_time).getTime();
            
            if (endTime <= now) {
                // Немедленно завершаем просроченный вклад
                console.log('Вклад просрочен, завершаем:', deposit.id);
                await completeDeposit(deposit.id);
            } else {
                validDeposits.push(deposit);
                createDepositItem(deposit);
                startDepositTimer(deposit.id, deposit.end_time);
            }
        }
        
        // Если после фильтрации не осталось валидных вкладов
        if (validDeposits.length === 0 && dom.activeDepositsList.children.length === 0) {
            renderEmptyActiveDeposits();
        }
        
    } catch (error) {
        console.error('Ошибка рендеринга активных вкладов:', error);
        renderActiveDepositsError('Ошибка отображения активных вкладов');
    }
}

function renderEmptyActiveDeposits() {
    if (!dom.activeDepositsList) return;
    
    dom.activeDepositsList.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-clock"></i>
            <p>Нет активных вкладов</p>
            <button class="btn-outline" onclick="showAvailableDeposits()" style="margin-top: 10px;">
                <i class="fas fa-plus"></i> Открыть вклад
            </button>
        </div>
    `;
}

function renderActiveDepositsError(message) {
    if (!dom.activeDepositsList) return;
    
    dom.activeDepositsList.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <p>${message}</p>
            <button class="btn-outline" onclick="loadInvestments()" style="margin-top: 10px;">
                <i class="fas fa-redo"></i> Попробовать снова
            </button>
        </div>
    `;
}

// Новая функция: создание элемента вклада
function createDepositItem(deposit) {
    if (!dom.activeDepositsList) return;

    const depositItem = document.createElement('div');
    depositItem.className = 'deposit-item';
    depositItem.id = `deposit-${deposit.id}`;
    
    const config = DEPOSIT_CONFIG[deposit.type];
    const depositName = config ? config.name : deposit.type;
    
    depositItem.innerHTML = `
        <div class="deposit-info">
            <div class="deposit-type">${depositName}</div>
            <div class="deposit-details">
                <div class="deposit-amount">${deposit.amount} монет</div>
                <div>Доходность: ${deposit.expected_profit}%</div>
                ${deposit.is_risky ? '<div class="risk-badge">Рискованный</div>' : ''}
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
function renderDepositHistory(depositHistory) {
    if (!dom.depositHistoryList) return;
    
    try {
        dom.depositHistoryList.innerHTML = '';
        
        if (!depositHistory || depositHistory.length === 0) {
            renderEmptyDepositHistory();
            return;
        }
        
        const fragment = document.createDocumentFragment();
        
        depositHistory.forEach(deposit => {
            const depositItem = createHistoryDepositItem(deposit);
            fragment.appendChild(depositItem);
        });
        
        dom.depositHistoryList.appendChild(fragment);
        
    } catch (error) {
        console.error('Ошибка рендеринга истории вкладов:', error);
        renderDepositHistoryError('Ошибка отображения истории вкладов');
    }
}

function createHistoryDepositItem(deposit) {
    const depositItem = document.createElement('div');
    depositItem.className = 'deposit-item';
    
    const config = DEPOSIT_CONFIG[deposit.type];
    const depositName = config ? config.name : deposit.type;
    
    const profitClass = deposit.actual_profit > 0 ? 'profit-positive' : 
                      deposit.actual_profit < 0 ? 'profit-negative' : '';
    const profitSign = deposit.actual_profit > 0 ? '+' : '';
    
    depositItem.innerHTML = `
        <div class="deposit-info">
            <div class="deposit-type">${depositName}</div>
            <div class="deposit-details">
                <div class="deposit-amount">${deposit.amount} монет</div>
                <div>Сумма возврата: ${deposit.amount + deposit.actual_profit} монет</div>
                <div class="${profitClass}">Прибыль: ${profitSign}${deposit.actual_profit} монет</div>
                ${deposit.is_risky ? '<div class="risk-badge">Рискованный</div>' : ''}
            </div>
        </div>
        <div style="text-align: right;">
            <div>Завершен</div>
            <div style="font-size: 0.8rem; color: var(--gray);">
                ${new Date(deposit.updated_at).toLocaleDateString('ru-RU')}
            </div>
        </div>
    `;
    
    return depositItem;
}

function renderEmptyDepositHistory() {
    if (!dom.depositHistoryList) return;
    
    dom.depositHistoryList.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-history"></i>
            <p>Нет завершенных вкладов</p>
        </div>
    `;
}

function renderDepositHistoryError(message) {
    if (!dom.depositHistoryList) return;
    
    dom.depositHistoryList.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <p>${message}</p>
            <button class="btn-outline" onclick="loadInvestments()" style="margin-top: 10px;">
                <i class="fas fa-redo"></i> Попробовать снова
            </button>
        </div>
    `;
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
        if (!state.supabase || !state.currentUserProfile) {
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
        if (deposit.status !== DEPOSIT_STATUS.ACTIVE) {
            console.log('Вклад уже завершен');
            return;
        }
        
        // Вычисляем прибыль
        let profit = calculateDepositProfit(deposit);
        
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
        showNotification('Ошибка завершения вклада', 'error');
    }
}

// Функция для расчета прибыли вклада
function calculateDepositProfit(deposit) {
    if (deposit.is_risky) {
        const random = Math.random();
        if (random <= 0.4) {
            return Math.floor(deposit.amount * 0.2); // +20%
        } else {
            return -Math.floor(deposit.amount * 0.1); // -10%
        }
    } else {
        return Math.floor(deposit.amount * (deposit.expected_profit / 100));
    }
}

// Ручное завершение вклада (fallback)
async function manualCompleteDeposit(depositId, profit) {
    try {
        // Получаем текущий баланс пользователя
        const { data: profile, error: profileError } = await state.supabase
            .from('profiles')
            .select('coins')
            .eq('id', state.currentUserProfile.id)
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
            .eq('id', state.currentUserProfile.id);
        
        if (updateError) {
            console.error('Ошибка обновления баланса:', updateError);
            return;
        }
        
        // Помечаем вклад как завершенный
        const { error: updateDepositError } = await state.supabase
            .from('deposits')
            .update({ 
                status: DEPOSIT_STATUS.COMPLETED,
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
        if (dom.coinsValue) dom.coinsValue.textContent = newCoins;
        
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
        showNotification('Ошибка завершения вклада', 'error');
    }
}

// Обновление баланса пользователя
async function updateUserBalance() {
    try {
        const { data: profile, error } = await state.supabase
            .from('profiles')
            .select('coins')
            .eq('id', state.currentUserProfile.id)
            .single();
        
        if (error) {
            console.error('Ошибка обновления баланса:', error);
            return;
        }
        
        if (profile) {
            state.currentUserProfile.coins = profile.coins;
            if (dom.coinsValue) {
                dom.coinsValue.textContent = profile.coins;
            }
        }
    } catch (error) {
        console.error('Ошибка при обновлении баланса:', error);
    }
}

export function openDepositModal(type, duration, profit, isRisky) {
    if (!state.currentUserProfile) {
        alert('Необходимо авторизоваться');
        return;
    }
    
    // Сбрасываем флаг создания вклада
    isCreatingDeposit = false;
    
    const config = DEPOSIT_CONFIG[type];
    const depositName = config ? config.name : type;
    const durationText = DURATION_TEXTS[duration] || `${duration} минут`;
    
    let riskHtml = '';
    if (isRisky) {
        riskHtml = `
            <div class="risk-warning" style="margin: 10px 0; padding: 10px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px;">
                <div><strong>Внимание: Рискованный вклад!</strong></div>
                <div><span class="profit-positive">Доходность: +${profit}% с вероятностью 40%</span></div>
                <div><span class="profit-negative">Убыточность: -10% с вероятностью 60%</span></div>
            </div>
        `;
    }
    
    const maxAmount = state.currentUserProfile?.coins || 0;
    
    dom.depositModalContent.innerHTML = `
        <div class="deposit-info">
            <h3>${depositName}</h3>
            <p><strong>Длительность:</strong> ${durationText}</p>
            <p><strong>Доходность:</strong> ${isRisky ? 'рисковая' : `+${profit}%`}</p>
            ${riskHtml}
        </div>
        <div class="form-group">
            <label for="depositAmount">Сумма вклада (доступно: ${maxAmount} монет)</label>
            <input type="number" id="depositAmount" placeholder="Введите сумму" min="1" max="${maxAmount}" required>
            <div class="form-hint">Минимальная сумма: 1 монета</div>
        </div>
        <button id="confirmDepositBtn" class="${isRisky ? 'btn-warning' : 'btn-success'}">
            <i class="fas fa-lock-open"></i> ${isRisky ? 'Испытать удачу' : 'Открыть вклад'}
        </button>
    `;
    
    // Удаляем старые обработчики перед добавлением новых
    const oldConfirmBtn = document.getElementById('confirmDepositBtn');
    if (oldConfirmBtn) {
        oldConfirmBtn.replaceWith(oldConfirmBtn.cloneNode(true));
    }
    
    // Добавляем валидацию input
    const amountInput = document.getElementById('depositAmount');
    if (amountInput) {
        amountInput.addEventListener('input', function() {
            const value = parseInt(this.value);
            if (value > maxAmount) {
                this.value = maxAmount;
            }
        });
    }
    
    // Добавляем новый обработчик
    document.getElementById('confirmDepositBtn').addEventListener('click', function depositHandler() {
        if (isCreatingDeposit) {
            console.log('Создание вклада уже в процессе, игнорируем повторный клик');
            return;
        }
        
        isCreatingDeposit = true;
        
        const amount = parseInt(document.getElementById('depositAmount').value);
        if (isNaN(amount) || amount <= 0) {
            alert('Введите корректную сумму');
            isCreatingDeposit = false;
            return;
        }
        if (amount > maxAmount) {
            alert('Недостаточно монет для открытия вклада');
            isCreatingDeposit = false;
            return;
        }
        
        // Блокируем кнопку
        const confirmBtn = document.getElementById('confirmDepositBtn');
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Обработка...';
        
        createDeposit(type, amount, duration, profit, isRisky);
    });
    
    if (dom.depositModal) {
        dom.depositModal.classList.add('active');
    }
}

// ИСПРАВЛЕННАЯ ФУНКЦИЯ: Создание вклада с использованием RPC для атомарного списания средств
async function createDeposit(type, amount, duration, profit, isRisky) {
    try {
        console.log('Создание вклада:', { type, amount, duration, profit, isRisky });

        // Используем RPC функцию для атомарного создания вклада и списания средств
        const { data: result, error } = await state.supabase.rpc('create_deposit_with_charge', {
            p_user_id: state.currentUserProfile.id,
            p_type: type,
            p_amount: amount,
            p_duration: parseInt(duration),
            p_profit: parseInt(profit),
            p_is_risky: isRisky
        });

        if (error) {
            console.error('RPC Error:', error);
            throw new Error('Ошибка создания вклада: ' + error.message);
        }

        if (!result || !result.success) {
            throw new Error(result?.error || 'Неизвестная ошибка при создании вклада');
        }
        
        console.log('Вклад создан успешно:', result);
        
        // Обновляем баланс на клиенте
        await updateUserBalance();
        
        showNotification('Вклад успешно открыт!', 'success');
        if (dom.depositModal) {
            dom.depositModal.classList.remove('active');
        }
        
        // Перезагружаем список вкладов
        loadInvestments();
        
    } catch (error) {
        console.error('Ошибка создания вклада:', error);
        showNotification('Ошибка: ' + error.message, 'error');
    } finally {
        // Разблокируем кнопку и сбрасываем флаг
        isCreatingDeposit = false;
        const confirmBtn = document.getElementById('confirmDepositBtn');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = `<i class="fas fa-lock-open"></i> ${isRisky ? 'Испытать удачу' : 'Открыть вклад'}`;
        }
    }
}

function showDepositResult(deposit, profit) {
    try {
        if (!dom.depositResultModal || !dom.depositResultContent) {
            return;
        }
        
        const config = DEPOSIT_CONFIG[deposit.type];
        const depositName = config ? config.name : deposit.type;
        
        let resultHtml = '';
        if (profit > 0) {
            resultHtml = `
                <div class="result-message result-success">
                    <div class="result-icon">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <p>Вклад "${depositName}" завершен!</p>
                    <p>Вы получили прибыль: <span class="profit-positive">+${profit} монет</span></p>
                    <p>Общая сумма возврата: ${deposit.amount + profit} монет</p>
                    ${deposit.is_risky ? '<p><small>Вам повезло с рискованным вкладом!</small></p>' : ''}
                </div>
                <p>Поздравляем с успешным вложением!</p>
            `;
        } else if (profit < 0) {
            resultHtml = `
                <div class="result-message result-danger">
                    <div class="result-icon">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <p>Вклад "${depositName}" завершен!</p>
                    <p>Вы понесли убыток: <span class="profit-negative">${profit} монет</span></p>
                    <p>Общая сумма возврата: ${deposit.amount + profit} монет</p>
                    ${deposit.is_risky ? '<p><small>Рискованный вклад не оправдал ожиданий</small></p>' : ''}
                </div>
                <p>К сожалению, этот раз не удачный. Попробуйте еще!</p>
            `;
        } else {
            resultHtml = `
                <div class="result-message result-warning">
                    <div class="result-icon">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <p>Вклад "${depositName}" завершен!</p>
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

// Функция для показа доступных вкладов
function showAvailableDeposits() {
    // Здесь можно реализовать показ доступных для открытия вкладов
    console.log('Показ доступных вкладов');
}

// Добавляем функции в глобальную область видимости
window.loadInvestments = loadInvestments;
window.showAvailableDeposits = showAvailableDeposits;

// Экспортируем для использования в других модулях
export { calculateDepositProfit, updateUserBalance };