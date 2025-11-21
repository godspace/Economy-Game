// Сначала объявляем все переменные
let supabase = null;
let currentUser = null;
let selectedUser = null;
let selectedDeal = null;
let depositTimers = {};

// DOM элементы
let authSection, profileSection, authForm, authBtn, userInfo, userGreeting, logoutBtn;
let coinsValue, reputationValue, classValue, usersList, searchInput, classFilter, searchBtn;
let incomingDeals, pendingDeals, allDeals, rankingTable, dealModal, responseModal, resultModal, closeModal;
let dealAvatar, dealPlayerName, dealPlayerClass, dealPlayerCoins, dealPlayerReputation;
let cooperateBtn, cheatBtn, respondCooperateBtn, respondCheatBtn, responseDealInfo;
let resultContent, closeResultBtn, userAvatar;
let loadingMessage, errorMessage, authError;
let dealLimitInfo, dealLimitText;
let depositModal, depositModalContent, depositResultModal, depositResultContent, closeDepositResultBtn;
let activeDepositsList, depositHistoryList;
let topRankingTable; // Новый элемент для топа рейтинга на странице авторизации

// Конфигурация Supabase
const SUPABASE_CONFIG = {
    url: 'https://isugrtihjmbrzwflybrr.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzdWdydGloam1icnp3Zmx5YnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzODQ0OTQsImV4cCI6MjA3ODk2MDQ5NH0.ek79k1g5svlLdhbYS664Lkc-6_tKc06qUgR-MhZtGNI'
};

// Основная функция инициализации
async function initApp() {
    try {
        console.log('Starting app initialization...');
        
        // Сначала инициализируем DOM элементы
        initDOMElements();
        
        // Показываем сообщение о загрузке
        showLoading();
        
        // Затем инициализируем Supabase
        await initSupabase();
        
        // Настройка обработчиков событий
        setupEventListeners();
        
        // Загружаем топ рейтинга для страницы авторизации
        await loadTopRanking();
        
        // Проверка авторизации
        await checkAuth();
        
        // Скрываем сообщение о загрузке
        hideLoading();
        
        console.log('App initialized successfully');
        
    } catch (error) {
        console.error('Error initializing app:', error);
        showError('Не удалось загрузить приложение: ' + error.message);
    }
}

// Инициализация Supabase
async function initSupabase() {
    return new Promise((resolve, reject) => {
        try {
            console.log('Initializing Supabase...');
            
            // Проверяем, доступен ли Supabase
            if (typeof window.supabase === 'undefined') {
                throw new Error('Supabase library not loaded');
            }
            
            supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
            
            console.log('Supabase initialized successfully');
            resolve();
        } catch (error) {
            console.error('Error initializing Supabase:', error);
            reject(error);
        }
    });
}

// Инициализация DOM элементов
function initDOMElements() {
    authSection = document.getElementById('authSection');
    profileSection = document.getElementById('profileSection');
    authForm = document.getElementById('authForm');
    authBtn = document.getElementById('authBtn');
    userInfo = document.getElementById('userInfo');
    userGreeting = document.getElementById('userGreeting');
    userAvatar = document.getElementById('userAvatar');
    logoutBtn = document.getElementById('logoutBtn');
    coinsValue = document.getElementById('coinsValue');
    reputationValue = document.getElementById('reputationValue');
    usersList = document.getElementById('usersList');
    searchInput = document.getElementById('searchInput');
    classFilter = document.getElementById('classFilter');
    searchBtn = document.getElementById('searchBtn');
    incomingDeals = document.getElementById('incomingDeals');
    pendingDeals = document.getElementById('pendingDeals');
    allDeals = document.getElementById('allDeals');
    rankingTable = document.getElementById('rankingTable');
    dealModal = document.getElementById('dealModal');
    responseModal = document.getElementById('responseModal');
    resultModal = document.getElementById('resultModal');
    closeModal = document.querySelectorAll('.close-modal');
    dealAvatar = document.getElementById('dealAvatar');
    dealPlayerName = document.getElementById('dealPlayerName');
    dealPlayerClass = document.getElementById('dealPlayerClass');
    dealPlayerCoins = document.getElementById('dealPlayerCoins');
    dealPlayerReputation = document.getElementById('dealPlayerReputation');
    cooperateBtn = document.getElementById('cooperateBtn');
    cheatBtn = document.getElementById('cheatBtn');
    respondCooperateBtn = document.getElementById('respondCooperateBtn');
    respondCheatBtn = document.getElementById('respondCheatBtn');
    responseDealInfo = document.getElementById('responseDealInfo');
    resultContent = document.getElementById('resultContent');
    closeResultBtn = document.getElementById('closeResultBtn');
    loadingMessage = document.getElementById('loadingMessage');
    errorMessage = document.getElementById('errorMessage');
    authError = document.getElementById('authError');
    dealLimitInfo = document.getElementById('dealLimitInfo');
    dealLimitText = document.getElementById('dealLimitText');
    depositModal = document.getElementById('depositModal');
    depositModalContent = document.getElementById('depositModalContent');
    depositResultModal = document.getElementById('depositResultModal');
    depositResultContent = document.getElementById('depositResultContent');
    closeDepositResultBtn = document.getElementById('closeDepositResultBtn');
    activeDepositsList = document.getElementById('activeDepositsList');
    depositHistoryList = document.getElementById('depositHistoryList');
    topRankingTable = document.getElementById('topRankingTable'); // Новый элемент
}

// Показать сообщение о загрузке
function showLoading() {
    if (loadingMessage) {
        loadingMessage.style.display = 'block';
    }
    if (authSection) {
        authSection.style.display = 'none';
    }
    if (profileSection) {
        profileSection.style.display = 'none';
    }
}

// Скрыть сообщение о загрузке
function hideLoading() {
    if (loadingMessage) {
        loadingMessage.style.display = 'none';
    }
}

// Показать сообщение об ошибке
function showError(message) {
    hideLoading();
    if (errorMessage) {
        errorMessage.innerHTML = `<p>${message}</p>`;
        errorMessage.style.display = 'block';
    }
}

// Показать сообщение об ошибке аутентификации
function showAuthError(message) {
    if (authError) {
        authError.innerHTML = `<p>${message}</p>`;
        authError.style.display = 'block';
    }
}

// Скрыть сообщение об ошибке аутентификации
function hideAuthError() {
    if (authError) {
        authError.style.display = 'none';
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    if (authForm) {
        authForm.addEventListener('submit', handleAuth);
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    if (searchBtn) {
        searchBtn.addEventListener('click', loadUsers);
    }
    
    // Табы
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            this.classList.add('active');
            const tabId = this.dataset.tab + 'Tab';
            const tabContent = document.getElementById(tabId);
            if (tabContent) {
                tabContent.classList.add('active');
            }
            
            if (this.dataset.tab === 'ranking') {
                loadRanking();
            } else if (this.dataset.tab === 'deals') {
                loadDeals();
            } else if (this.dataset.tab === 'users') {
                loadUsers();
            } else if (this.dataset.tab === 'investments') {
                loadInvestments();
            }
        });
    });
    
    // Модальные окна
    if (closeModal) {
        closeModal.forEach(closeBtn => {
            closeBtn.addEventListener('click', function() {
                dealModal.classList.remove('active');
                responseModal.classList.remove('active');
                resultModal.classList.remove('active');
                depositModal.classList.remove('active');
                depositResultModal.classList.remove('active');
            });
        });
    }
    
    if (closeResultBtn) {
        closeResultBtn.addEventListener('click', function() {
            resultModal.classList.remove('active');
        });
    }
    
    if (closeDepositResultBtn) {
        closeDepositResultBtn.addEventListener('click', function() {
            depositResultModal.classList.remove('active');
        });
    }
    
    window.addEventListener('click', function(event) {
        if (event.target === dealModal) {
            dealModal.classList.remove('active');
        }
        if (event.target === responseModal) {
            responseModal.classList.remove('active');
        }
        if (event.target === resultModal) {
            resultModal.classList.remove('active');
        }
        if (event.target === depositModal) {
            depositModal.classList.remove('active');
        }
        if (event.target === depositResultModal) {
            depositResultModal.classList.remove('active');
        }
    });
    
    // Кнопки выбора стратегии
    if (cooperateBtn) {
        cooperateBtn.addEventListener('click', function() {
            proposeDeal('cooperate');
        });
    }
    
    if (cheatBtn) {
        cheatBtn.addEventListener('click', function() {
            proposeDeal('cheat');
        });
    }
    
    if (respondCooperateBtn) {
        respondCooperateBtn.addEventListener('click', function() {
            respondToDeal('cooperate');
        });
    }
    
    if (respondCheatBtn) {
        respondCheatBtn.addEventListener('click', function() {
            respondToDeal('cheat');
        });
    }
    
    // Кнопки открытия вкладов
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('open-deposit') || 
            event.target.parentElement.classList.contains('open-deposit')) {
            const button = event.target.classList.contains('open-deposit') ? 
                event.target : event.target.parentElement;
            openDepositModal(
                button.dataset.type,
                button.dataset.duration,
                button.dataset.profit,
                button.dataset.risk === 'true'
            );
        }
    });
}

// Проверка авторизации
async function checkAuth() {
    try {
        if (!supabase) {
            throw new Error('Supabase not initialized');
        }
        
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
            console.warn('Auth check error:', error);
            // Это нормально, если пользователь не авторизован
            showAuthSection();
            return;
        }
        
        if (user) {
            // Пользователь авторизован
            await loadUserProfile(user.id);
            currentUser = user;
            showProfileSection();
        } else {
            // Пользователь не авторизован
            showAuthSection();
        }
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        showAuthSection();
    }
}

// Обработка авторизации/регистрации
async function handleAuth(e) {
    e.preventDefault();
    
    if (!supabase) {
        alert('Система не инициализирована. Пожалуйста, обновите страницу.');
        return;
    }
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const userClass = document.getElementById('class').value;
    
    if (!username || !password || !userClass) {
        showAuthError('Пожалуйста, заполните все поля');
        return;
    }
    
    // Скрываем предыдущие ошибки
    hideAuthError();
    
    authBtn.disabled = true;
    authBtn.textContent = 'Загрузка...';
    
    try {
        // Сначала пробуем зарегистрироваться
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: `${username}@school.game`,
            password: password,
            options: {
                data: {
                    username: username,
                    class: userClass
                }
            }
        });
        
        if (signUpError) {
            // Если регистрация не удалась, пробуем войти
            if (signUpError.message.includes('already registered')) {
                console.log('User exists, trying to sign in...');
                
                const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                    email: `${username}@school.game`,
                    password: password
                });
                
                if (signInError) {
                    throw signInError;
                }
                
                currentUser = signInData.user;
                await loadUserProfile(currentUser.id);
                showProfileSection();
            } else {
                throw signUpError;
            }
        } else {
            // Регистрация успешна
            currentUser = signUpData.user;
            
            // Создаем профиль пользователя
            try {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert([
                        { 
                            id: currentUser.id, 
                            username: username, 
                            class: userClass 
                        }
                    ]);
                
                if (profileError) {
                    console.warn('Profile creation error (might already exist):', profileError);
                    // Продолжаем, даже если профиль уже существует
                }
            } catch (profileError) {
                console.warn('Profile creation error:', profileError);
                // Продолжаем, даже если есть ошибка создания профиля
            }
            
            await loadUserProfile(currentUser.id);
            showProfileSection();
        }
    } catch (error) {
        console.error('Ошибка аутентификации:', error);
        showAuthError('Ошибка: ' + (error.message || 'Неизвестная ошибка'));
    } finally {
        authBtn.disabled = false;
        authBtn.textContent = 'Войти / Зарегистрироваться';
    }
}

// Выход из системы
async function handleLogout() {
    try {
        if (!supabase) {
            console.error('Supabase not initialized');
            return;
        }
        
        // Останавливаем все таймеры вкладов
        Object.values(depositTimers).forEach(timer => clearInterval(timer));
        depositTimers = {};
        
        await supabase.auth.signOut();
        currentUser = null;
        showAuthSection();
    } catch (error) {
        console.error('Ошибка выхода:', error);
    }
}

// Загрузка профиля пользователя
async function loadUserProfile(userId) {
    try {
        if (!supabase) {
            console.error('Supabase not initialized');
            return;
        }
        
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) {
            console.error('Ошибка загрузки профиля:', error);
            // Создаем профиль, если он не существует
            await createUserProfile(userId);
            return;
        }
        
        // Обновление интерфейса
        if (userGreeting) userGreeting.textContent = `Привет, ${profile.username}!`;
        if (userAvatar) userAvatar.textContent = profile.username.charAt(0).toUpperCase();
        if (coinsValue) coinsValue.textContent = profile.coins;
        if (reputationValue) reputationValue.textContent = profile.reputation;
        
        // Загрузка данных для вкладок
        loadUsers();
        loadDeals();
        loadRanking();
        loadInvestments();
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
    }
}

// Создание профиля пользователя
async function createUserProfile(userId) {
    try {
        if (!supabase || !currentUser) {
            return;
        }
        
        const username = document.getElementById('username').value;
        const userClass = document.getElementById('class').value;
        
        if (!username || !userClass) {
            return;
        }
        
        const { error } = await supabase
            .from('profiles')
            .insert([
                { 
                    id: userId, 
                    username: username, 
                    class: userClass 
                }
            ]);
        
        if (error) {
            console.error('Ошибка создания профиля:', error);
            return;
        }
        
        // Перезагружаем профиль
        await loadUserProfile(userId);
    } catch (error) {
        console.error('Ошибка создания профиля:', error);
    }
}

// Показать секцию аутентификации
function showAuthSection() {
    if (authSection) {
        authSection.style.display = 'block';
    }
    if (profileSection) {
        profileSection.style.display = 'none';
    }
    if (userInfo) {
        userInfo.style.display = 'none';
    }
    if (errorMessage) {
        errorMessage.style.display = 'none';
    }
}

// Показать секцию профиля
function showProfileSection() {
    if (authSection) {
        authSection.style.display = 'none';
    }
    if (profileSection) {
        profileSection.style.display = 'block';
    }
    if (userInfo) {
        userInfo.style.display = 'block';
    }
    if (errorMessage) {
        errorMessage.style.display = 'none';
    }
    if (authError) {
        authError.style.display = 'none';
    }
}

// Загрузка списка пользователей
async function loadUsers() {
    try {
        if (!supabase || !currentUser) {
            console.error('Supabase or current user not initialized');
            return;
        }
        
        const searchTerm = searchInput ? searchInput.value : '';
        const selectedClass = classFilter ? classFilter.value : '';
        
        let query = supabase
            .from('profiles')
            .select('*')
            .neq('id', currentUser.id);
        
        if (searchTerm) {
            query = query.ilike('username', `%${searchTerm}%`);
        }
        
        if (selectedClass) {
            query = query.eq('class', selectedClass);
        }
        
        const { data: users, error } = await query;
        
        if (error) {
            console.error('Ошибка загрузки пользователей:', error);
            return;
        }
        
        if (usersList) {
            usersList.innerHTML = '';
            
            if (users.length === 0) {
                usersList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <p>Пользователи не найдены</p>
                    </div>
                `;
                return;
            }
            
            users.forEach(user => {
                const userCard = document.createElement('div');
                userCard.className = 'user-card';
                
                // Проверяем баланс пользователя для активации кнопки
                const canMakeDeal = user.coins > 0;
                const buttonClass = canMakeDeal ? 'btn-secondary' : 'btn-secondary btn-disabled';
                const buttonText = canMakeDeal ? 'Сделка' : 'Нет монет';
                
                userCard.innerHTML = `
                    <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
                    <div class="user-name">${user.username}</div>
                    <div class="user-details">
                        <div class="user-detail">
                            <i class="fas fa-users"></i>
                            <span>${user.class}</span>
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
                    <button class="${buttonClass} propose-deal-btn" data-user-id="${user.id}" ${!canMakeDeal ? 'disabled' : ''}>
                        <i class="fas fa-handshake"></i> ${buttonText}
                    </button>
                `;
                
                usersList.appendChild(userCard);
            });
            
            // Добавляем обработчики для кнопок предложения сделки
            document.querySelectorAll('.propose-deal-btn').forEach(btn => {
                if (!btn.disabled) {
                    btn.addEventListener('click', function() {
                        const userId = this.dataset.userId;
                        showDealModal(userId);
                    });
                }
            });
        }
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
    }
}

// Показать модальное окно сделки
async function showDealModal(userId) {
    try {
        if (!supabase) {
            console.error('Supabase not initialized');
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
        
        // Проверяем лимит сделок с этим пользователем за сегодня
        const todayDealsCount = await getTodayDealsCount(userId);
        if (dealLimitInfo && dealLimitText) {
            if (todayDealsCount >= 5) {
                dealLimitText.textContent = `Вы уже совершили максимальное количество сделок (5) с игроком ${user.username} сегодня. Попробуйте завтра или выберите другого игрока.`;
                dealLimitInfo.style.display = 'block';
                
                // Блокируем кнопки
                if (cooperateBtn) {
                    cooperateBtn.disabled = true;
                    cooperateBtn.classList.add('btn-disabled');
                }
                if (cheatBtn) {
                    cheatBtn.disabled = true;
                    cheatBtn.classList.add('btn-disabled');
                }
            } else {
                dealLimitText.textContent = `Вы уже совершили ${todayDealsCount} из 5 возможных сделок с этим игроком сегодня.`;
                dealLimitInfo.style.display = 'block';
                
                // Разблокируем кнопки
                if (cooperateBtn) {
                    cooperateBtn.disabled = false;
                    cooperateBtn.classList.remove('btn-disabled');
                }
                if (cheatBtn) {
                    cheatBtn.disabled = false;
                    cheatBtn.classList.remove('btn-disabled');
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

// Получить количество сделок с пользователем за сегодня
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

// Предложить сделку
async function proposeDeal(choice) {
    try {
        if (!supabase || !currentUser || !selectedUser) {
            console.error('Required data not initialized');
            return;
        }
        
        // Проверяем лимит сделок с этим пользователем за сегодня
        const todayDealsCount = await getTodayDealsCount(selectedUser.id);
        
        // Если уже есть 5 или более сделок сегодня
        if (todayDealsCount >= 5) {
            alert(`Вы уже совершили максимальное количество сделок (5) с игроком ${selectedUser.username} сегодня. Попробуйте завтра или выберите другого игрока.`);
            return;
        }
        
        // Если сделок меньше 5, создаем новую
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

// Показать модальное окно ответа на сделку
async function showResponseModal(dealId) {
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

// Ответить на сделку
async function respondToDeal(choice) {
    try {
        if (!supabase || !selectedDeal) {
            console.error('Required data not initialized');
            return;
        }
        
        // Используем функцию process_deal для обработки сделки
        const { data: result, error } = await supabase.rpc('process_deal', {
            deal_id: selectedDeal.id,
            response_choice: choice
        });
        
        if (error) {
            throw error;
        }
        
        // Показываем результат сделки
        await showDealResult(selectedDeal, choice, result);
        
        if (responseModal) {
            responseModal.classList.remove('active');
        }
        
        loadDeals();
        loadUserProfile(currentUser.id);
    } catch (error) {
        console.error('Ошибка ответа на сделку:', error);
        alert('Ошибка: ' + error.message);
    }
}

// Показать результат сделки
async function showDealResult(deal, userChoice, result) {
    try {
        if (!resultModal || !resultContent) {
            return;
        }
        
        let resultHtml = '';
        const fromCoinsChange = result.from_coins_change;
        const toCoinsChange = result.to_coins_change;
        
        // Определяем результат в зависимости от выбора стратегий
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

// Загрузка сделок
async function loadDeals() {
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
                
                // Добавляем обработчики для кнопок ответа на сделки
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
        
        // Все сделки (история) - теперь показываем как входящие, так и исходящие
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
                    
                    // Вычисляем результат сделки для текущего пользователя
                    let resultHtml = '';
                    if (deal.status === 'completed') {
                        let coinsChange = 0;
                        let resultClass = '';
                        
                        // Определяем изменение монет для текущего пользователя
                        if (isOutgoing) {
                            // Для исходящих сделок
                            if (deal.from_choice === 'cooperate' && deal.to_choice === 'cooperate') {
                                coinsChange = 2;
                                resultClass = 'profit-positive';
                            } else if (deal.from_choice === 'cooperate' && deal.to_choice === 'cheat') {
                                coinsChange = -1;
                                resultClass = 'profit-negative';
                            } else if (deal.from_choice === 'cheat' && deal.to_choice === 'cooperate') {
                                coinsChange = 3;
                                resultClass = 'profit-positive';
                            } else if (deal.from_choice === 'cheat' && deal.to_choice === 'cheat') {
                                coinsChange = -1;
                                resultClass = 'profit-negative';
                            }
                        } else {
                            // Для входящих сделок
                            if (deal.from_choice === 'cooperate' && deal.to_choice === 'cooperate') {
                                coinsChange = 2;
                                resultClass = 'profit-positive';
                            } else if (deal.from_choice === 'cooperate' && deal.to_choice === 'cheat') {
                                coinsChange = 3;
                                resultClass = 'profit-positive';
                            } else if (deal.from_choice === 'cheat' && deal.to_choice === 'cooperate') {
                                coinsChange = -1;
                                resultClass = 'profit-negative';
                            } else if (deal.from_choice === 'cheat' && deal.to_choice === 'cheat') {
                                coinsChange = -1;
                                resultClass = 'profit-negative';
                            }
                        }
                        
                        const sign = coinsChange > 0 ? '+' : '';
                        resultHtml = `<div class="deal-result ${resultClass}">Результат: ${sign}${coinsChange} монет</div>`;
                    }
                    
                    const dealItem = document.createElement('div');
                    dealItem.className = 'deal-item';
                    
                    let dealInfo = `
                        <div>
                            <p><strong>${directionText}</strong> ${otherUser.username} (${otherUser.class})</p>
                            <p><strong>Ваш выбор:</strong> ${isOutgoing ? deal.from_choice : deal.to_choice === 'cooperate' ? 'Сотрудничать' : 'Жульничать'}</p>
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

// Загрузка рейтинга
async function loadRanking() {
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
                    
                    // Используем класс вместо inline стиля для лучшего управления в темной теме
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

// Загрузка топа рейтинга для страницы авторизации
async function loadTopRanking() {
    try {
        if (!supabase) {
            console.error('Supabase not initialized');
            return;
        }
        
        const { data: users, error } = await supabase
            .from('profiles')
            .select('*')
            .order('coins', { ascending: false })
            .limit(10);
        
        if (error) {
            console.error('Ошибка загрузки топа рейтинга:', error);
            return;
        }
        
        if (topRankingTable) {
            topRankingTable.innerHTML = '';
            
            if (users.length === 0) {
                topRankingTable.innerHTML = `
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
                    row.innerHTML = `
                        <td>${index + 1}</td>
                        <td>${user.username}</td>
                        <td>${user.class}</td>
                        <td>${user.coins}</td>
                        <td>${user.reputation}</td>
                    `;
                    topRankingTable.appendChild(row);
                });
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки топа рейтинга:', error);
    }
}

// Загрузка вкладов
async function loadInvestments() {
    try {
        if (!supabase || !currentUser) {
            console.error('Supabase or current user not initialized');
            return;
        }
        
        // Загружаем активные вклады пользователя
        const { data: activeDeposits, error: activeError } = await supabase
            .from('deposits')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('status', 'active');
        
        if (activeError) {
            console.error('Ошибка загрузки активных вкладов:', activeError);
        } else {
            // Останавливаем все предыдущие таймеры
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
                        
                        // Запускаем таймер для этого вклада
                        startDepositTimer(deposit.id, deposit.end_time);
                    });
                }
            }
        }
        
        // Загружаем историю завершенных вкладов
        const { data: depositHistory, error: historyError } = await supabase
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

// Запуск таймера для вклада
function startDepositTimer(depositId, endTime) {
    const timerElement = document.getElementById(`timer-${depositId}`);
    if (!timerElement) return;
    
    const updateTimer = () => {
        const now = new Date().getTime();
        const end = new Date(endTime).getTime();
        const timeLeft = end - now;
        
        if (timeLeft <= 0) {
            // Вклад завершен
            timerElement.textContent = '00:00:00';
            clearInterval(depositTimers[depositId]);
            completeDeposit(depositId);
            return;
        }
        
        // Преобразуем время в формат ЧЧ:ММ:СС
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        
        timerElement.textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };
    
    // Обновляем сразу и затем каждую секунду
    updateTimer();
    depositTimers[depositId] = setInterval(updateTimer, 1000);
}

// Открытие модального окна для создания вклада
function openDepositModal(type, duration, profit, isRisky) {
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

// Создание вклада
async function createDeposit(type, amount, duration, profit, isRisky) {
    try {
        if (!supabase || !currentUser) {
            console.error('Supabase or current user not initialized');
            return;
        }
        
        // Проверяем баланс пользователя
        const { data: profile, error: profileError } = await supabase
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
        
        // Вычисляем время завершения вклада
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + parseInt(duration) * 60000); // duration в минутах
        
        // Для рискового вклада вычисляем ожидаемую прибыль
        let expectedProfit = profit;
        if (isRisky) {
            // Для крипты ожидаемая прибыль = (0.4 * 20) + (0.6 * (-10)) = 8 - 6 = 2%
            expectedProfit = 2;
        }
        
        // Создаем запись о вкладе
        const { data: deposit, error } = await supabase
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
        
        // Вычитаем сумму вклада из баланса пользователя
        const newCoins = profile.coins - amount;
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ coins: newCoins })
            .eq('id', currentUser.id);
        
        if (updateError) {
            console.error('Ошибка обновления баланса:', updateError);
            return;
        }
        
        // Обновляем интерфейс
        coinsValue.textContent = newCoins;
        
        alert('Вклад успешно открыт!');
        depositModal.classList.remove('active');
        
        // Перезагружаем список вкладов
        loadInvestments();
        
    } catch (error) {
        console.error('Ошибка создания вклада:', error);
        alert('Ошибка: ' + error.message);
    }
}

// Завершение вклада
async function completeDeposit(depositId) {
    try {
        if (!supabase || !currentUser) {
            console.error('Supabase or current user not initialized');
            return;
        }
        
        // Получаем информацию о вкладе
        const { data: deposit, error: depositError } = await supabase
            .from('deposits')
            .select('*')
            .eq('id', depositId)
            .single();
        
        if (depositError) {
            console.error('Ошибка получения вклада:', depositError);
            return;
        }
        
        // Вычисляем прибыль
        let profit = 0;
        if (deposit.is_risky) {
            // Для рискового вклада определяем результат случайным образом
            const random = Math.random();
            if (random <= 0.4) {
                // Успех: +20%
                profit = Math.floor(deposit.amount * 0.2);
            } else {
                // Неудача: -10%
                profit = -Math.floor(deposit.amount * 0.1);
            }
        } else {
            // Для безрискового вклада вычисляем прибыль по ожидаемой доходности
            profit = Math.floor(deposit.amount * (deposit.expected_profit / 100));
        }
        
        // Обновляем баланс пользователя
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('coins')
            .eq('id', currentUser.id)
            .single();
        
        if (profileError) {
            console.error('Ошибка получения профиля:', profileError);
            return;
        }
        
        const newCoins = profile.coins + deposit.amount + profit;
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ coins: newCoins })
            .eq('id', currentUser.id);
        
        if (updateError) {
            console.error('Ошибка обновления баланса:', updateError);
            return;
        }
        
        // Обновляем статус вклада
        const { error: updateDepositError } = await supabase
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
        
        // Обновляем интерфейс
        coinsValue.textContent = newCoins;
        
        // Показываем результат вклада
        showDepositResult(deposit, profit);
        
        // Перезагружаем список вкладов
        loadInvestments();
        
    } catch (error) {
        console.error('Ошибка завершения вклада:', error);
    }
}

// Показать результат вклада
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

// Запуск приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    // Даем время для загрузки всех скриптов
    setTimeout(initApp, 100);
    
    // Закрытие модальных окон при клике вне области
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.classList.remove('active');
        }
    });
    
    // Предотвращение закрытия при клике внутри модального окна
    document.querySelectorAll('.modal-content').forEach(content => {
        content.addEventListener('click', function(event) {
            event.stopPropagation();
        });
    });
});