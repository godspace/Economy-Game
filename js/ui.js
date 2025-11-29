import { handleAuth, handleLogout } from './auth.js';
import { dom, state } from './config.js';
import { setupSearchDebounce } from './users.js';

// Глобальная переменная для отслеживания активного таба
let currentActiveTab = null;

export function initDOMElements() {
    console.log('Initializing DOM elements...');
    
    try {
        // Инициализируем свойства объекта dom
        dom.authSection = document.getElementById('authSection');
        dom.profileSection = document.getElementById('profileSection');
        dom.authForm = document.getElementById('authForm');
        dom.authBtn = document.getElementById('authBtn');
        dom.userInfo = document.getElementById('userInfo');
        dom.userGreeting = document.getElementById('userGreeting');
        dom.userAvatar = document.getElementById('userAvatar');
        dom.logoutBtn = document.getElementById('logoutBtn');
        dom.coinsValue = document.getElementById('coinsValue');
        dom.reputationValue = document.getElementById('reputationValue');
        dom.usersList = document.getElementById('usersList');
        dom.searchInput = document.getElementById('searchInput');
        dom.classFilter = document.getElementById('classFilter');
        dom.searchBtn = document.getElementById('searchBtn');
        dom.incomingDeals = document.getElementById('incomingDeals');
        dom.pendingDeals = document.getElementById('pendingDeals');
        dom.completedIncomingDeals = document.getElementById('completedIncomingDeals');
        dom.completedOutgoingDeals = document.getElementById('completedOutgoingDeals');
        dom.rankingTable = document.getElementById('rankingTable');
        dom.dealModal = document.getElementById('dealModal');
        dom.responseModal = document.getElementById('responseModal');
        dom.resultModal = document.getElementById('resultModal');
        dom.dealAvatar = document.getElementById('dealAvatar');
        dom.dealPlayerName = document.getElementById('dealPlayerName');
        dom.dealPlayerClass = document.getElementById('dealPlayerClass');
        dom.dealPlayerCoins = document.getElementById('dealPlayerCoins');
        dom.dealPlayerReputation = document.getElementById('dealPlayerReputation');
        dom.cooperateBtn = document.getElementById('cooperateBtn');
        dom.cheatBtn = document.getElementById('cheatBtn');
        dom.respondCooperateBtn = document.getElementById('respondCooperateBtn');
        dom.respondCheatBtn = document.getElementById('respondCheatBtn');
        dom.responseDealInfo = document.getElementById('responseDealInfo');
        dom.resultContent = document.getElementById('resultContent');
        dom.closeResultBtn = document.getElementById('closeResultBtn');
        dom.loadingMessage = document.getElementById('loadingMessage');
        dom.errorMessage = document.getElementById('errorMessage');
        dom.authError = document.getElementById('authError');
        dom.dealLimitInfo = document.getElementById('dealLimitInfo');
        dom.dealLimitText = document.getElementById('dealLimitText');
        dom.depositModal = document.getElementById('depositModal');
        dom.depositModalContent = document.getElementById('depositModalContent');
        dom.depositResultModal = document.getElementById('depositResultModal');
        dom.depositResultContent = document.getElementById('depositResultContent');
        dom.closeDepositResultBtn = document.getElementById('closeDepositResultBtn');
        dom.activeDepositsList = document.getElementById('activeDepositsList');
        dom.depositHistoryList = document.getElementById('depositHistoryList');
        dom.topRankingTable = document.getElementById('topRankingTable');
        
        // Новые DOM элементы для магазина
        dom.shopProductsList = document.getElementById('shopProductsList');
        dom.shopOrderHistory = document.getElementById('shopOrderHistory');
        dom.adminOrdersList = document.getElementById('adminOrdersList');
        dom.adminOrdersTab = document.getElementById('adminOrdersTab');
        dom.adminOrdersTabContent = document.getElementById('adminOrdersTabContent');
        
        // Модальное окно техработ
        dom.maintenanceModal = document.getElementById('maintenanceModal');
        dom.closeMaintenanceModal = document.getElementById('closeMaintenanceModal');
        dom.maintenanceBanner = document.getElementById('maintenanceBanner');
        dom.closeMaintenanceBanner = document.getElementById('closeMaintenanceBanner');

        console.log('DOM elements initialized successfully');
    } catch (error) {
        console.error('Error initializing DOM elements:', error);
    }
}

export function showLoading() {
    if (dom.loadingMessage) {
        dom.loadingMessage.style.display = 'block';
    }
    if (dom.authSection) {
        dom.authSection.style.display = 'none';
    }
    if (dom.profileSection) {
        dom.profileSection.style.display = 'none';
    }
}

export function hideLoading() {
    if (dom.loadingMessage) {
        dom.loadingMessage.style.display = 'none';
    }
}

export function showError(message) {
    hideLoading();
    if (dom.errorMessage) {
        dom.errorMessage.innerHTML = `<p>${message}</p>`;
        dom.errorMessage.style.display = 'block';
    }
}

export function hideError() {
    if (dom.errorMessage) {
        dom.errorMessage.style.display = 'none';
    }
}

export function showAuthError(message) {
    if (dom.authError) {
        dom.authError.innerHTML = `<p>${message}</p>`;
        dom.authError.style.display = 'block';
    }
}

export function hideAuthError() {
    if (dom.authError) {
        dom.authError.style.display = 'none';
    }
}

export function showAuthSection() {
    if (dom.authSection) {
        dom.authSection.style.display = 'block';
    }
    if (dom.profileSection) {
        dom.profileSection.style.display = 'none';
    }
    if (dom.userInfo) {
        dom.userInfo.style.display = 'none';
    }
    if (dom.errorMessage) {
        dom.errorMessage.style.display = 'none';
    }
    if (dom.authError) {
        dom.authError.style.display = 'none';
    }
}

export function showProfileSection() {
    if (dom.authSection) {
        dom.authSection.style.display = 'none';
    }
    if (dom.profileSection) {
        dom.profileSection.style.display = 'block';
    }
    if (dom.userInfo) {
        dom.userInfo.style.display = 'block';
    }
    
    // УПРАВЛЯЕМ ВИДИМОСТЬЮ ВКЛАДКИ АДМИНИСТРАТОРА
    if (dom.adminOrdersTab) {
        if (state.isAdmin) {
            dom.adminOrdersTab.style.display = 'flex';
            console.log('✅ Admin tab shown');
        } else {
            dom.adminOrdersTab.style.display = 'none';
            console.log('❌ Admin tab hidden - user is not admin');
        }
    }
    
    if (dom.errorMessage) {
        dom.errorMessage.style.display = 'none';
    }
    if (dom.authError) {
        dom.authError.style.display = 'none';
    }
}

// Функция для закрытия предупреждения о техработах
function closeMaintenanceWarning() {
    if (dom.maintenanceModal) {
        dom.maintenanceModal.classList.remove('active');
    }
    if (dom.maintenanceBanner) {
        dom.maintenanceBanner.style.display = 'none';
    }
    localStorage.setItem('maintenanceWarningClosed', 'true');
}

// Функция для загрузки модулей табов
async function loadTabModule(tabName) {
    // Если таб уже активен, не загружаем повторно
    if (currentActiveTab === tabName) {
        return;
    }
    
    console.log('Loading tab module:', tabName);
    currentActiveTab = tabName;
    
    try {
        switch(tabName) {
            case 'users':
                const usersModule = await import('./users.js');
                await usersModule.loadUsers();
                break;
            case 'deals':
                const dealsModule = await import('./deals.js');
                await dealsModule.loadDeals();
                break;
            case 'ranking':
                const rankingModule = await import('./deals.js');
                await rankingModule.loadRanking();
                break;
            case 'investments':
                const investmentsModule = await import('./investments.js');
                await investmentsModule.loadInvestments();
                break;
            case 'shop':
                console.log('Loading shop module...');
                const shopModule = await import('./shop.js');
                console.log('Shop module loaded:', shopModule);
                if (typeof shopModule.loadShop === 'function') {
                    await shopModule.loadShop();
                } else {
                    console.error('loadShop is not a function in shop module');
                }
                break;
            case 'adminOrders':
                console.log('Loading admin orders...');
                const adminModule = await import('./shop.js');
                if (typeof adminModule.loadAdminOrders === 'function') {
                    await adminModule.loadAdminOrders();
                } else {
                    console.error('loadAdminOrders is not a function in shop module');
                }
                break;
            default:
                console.warn('Unknown tab:', tabName);
        }
    } catch (error) {
        console.error('Error loading tab module:', tabName, error);
        showError(`Ошибка загрузки вкладки ${tabName}: ${error.message}`);
    }
}

// Функция для переключения табов
export function switchTab(tabName) {
    console.log('Switching to tab:', tabName);
    
    // Снимаем активный класс со всех табов и контента
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    // Активируем выбранный таб
    const activeTab = document.querySelector(`.tab[data-tab="${tabName}"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    // Активируем соответствующий контент
    let tabContentId;
    if (tabName === 'adminOrders') {
        tabContentId = 'adminOrdersTabContent';
    } else {
        tabContentId = tabName + 'Tab';
    }
    
    const tabContent = document.getElementById(tabContentId);
    if (tabContent) {
        tabContent.classList.add('active');
        console.log('Activated tab content:', tabContentId);
        
        // Загружаем модуль таба
        loadTabModule(tabName);
    } else {
        console.error('Tab content not found:', tabContentId);
    }
}

export function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Обработчики аутентификации
    if (dom.authForm) {
        dom.authForm.addEventListener('submit', handleAuth);
    }
    
    if (dom.logoutBtn) {
        dom.logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Настройка debounce для поиска
    if (dom.searchInput || dom.classFilter) {
        setupSearchDebounce();
    }
    
    if (dom.searchBtn) {
        dom.searchBtn.addEventListener('click', async () => {
            try {
                const { loadUsers } = await import('./users.js');
                await loadUsers(true);
            } catch (error) {
                console.error('Error loading users:', error);
            }
        });
    }
    
    // Обработчики для закрытия предупреждения о техработах
    if (dom.closeMaintenanceModal) {
        dom.closeMaintenanceModal.addEventListener('click', closeMaintenanceWarning);
    }
    
    if (dom.closeMaintenanceBanner) {
        dom.closeMaintenanceBanner.addEventListener('click', closeMaintenanceWarning);
    }
    
    // Табы с ленивой загрузкой
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            switchTab(tabName);
        });
    });
    
    // Модальные окна - закрытие по кнопкам
    const closeModalButtons = document.querySelectorAll('.close-modal');
    if (closeModalButtons) {
        closeModalButtons.forEach(closeBtn => {
            closeBtn.addEventListener('click', function() {
                closeAllModals();
            });
        });
    }
    
    if (dom.closeResultBtn) {
        dom.closeResultBtn.addEventListener('click', function() {
            if (dom.resultModal) dom.resultModal.classList.remove('active');
        });
    }
    
    if (dom.closeDepositResultBtn) {
        dom.closeDepositResultBtn.addEventListener('click', function() {
            if (dom.depositResultModal) dom.depositResultModal.classList.remove('active');
        });
    }
    
    // Делегирование событий для динамических элементов
    document.addEventListener('click', function(event) {
        // Обработка открытия вкладов
        if (event.target.closest('.open-deposit')) {
            const button = event.target.closest('.open-deposit');
            import('./investments.js').then(module => {
                if (module.openDepositModal) {
                    module.openDepositModal(
                        button.dataset.type,
                        button.dataset.duration,
                        button.dataset.profit,
                        button.dataset.risk === 'true'
                    );
                }
            }).catch(error => {
                console.error('Error opening deposit modal:', error);
            });
        }
        
        // Закрытие модальных окон при клике вне области
        if (event.target.classList.contains('modal')) {
            event.target.classList.remove('active');
        }
    });
    
    // Кнопки выбора стратегии в сделках
    if (dom.cooperateBtn) {
        dom.cooperateBtn.addEventListener('click', async function() {
            try {
                const { proposeDeal } = await import('./deals.js');
                await proposeDeal('cooperate');
            } catch (error) {
                console.error('Error proposing cooperate deal:', error);
            }
        });
    }
    
    if (dom.cheatBtn) {
        dom.cheatBtn.addEventListener('click', async function() {
            try {
                const { proposeDeal } = await import('./deals.js');
                await proposeDeal('cheat');
            } catch (error) {
                console.error('Error proposing cheat deal:', error);
            }
        });
    }
    
    if (dom.respondCooperateBtn) {
        dom.respondCooperateBtn.addEventListener('click', async function() {
            try {
                const { respondToDeal } = await import('./deals.js');
                await respondToDeal('cooperate');
            } catch (error) {
                console.error('Error responding with cooperate:', error);
            }
        });
    }
    
    if (dom.respondCheatBtn) {
        dom.respondCheatBtn.addEventListener('click', async function() {
            try {
                const { respondToDeal } = await import('./deals.js');
                await respondToDeal('cheat');
            } catch (error) {
                console.error('Error responding with cheat:', error);
            }
        });
    }
    
    // Предотвращение закрытия при клике внутри модального окна
    document.querySelectorAll('.modal-content').forEach(content => {
        if (content) {
            content.addEventListener('click', function(event) {
                event.stopPropagation();
            });
        }
    });
    
    // Обработка клавиши Escape для закрытия модальных окон
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeAllModals();
        }
    });
    
    console.log('Event listeners setup completed');
}

// Функция для закрытия всех модальных окон
export function closeAllModals() {
    const modals = [
        dom.dealModal,
        dom.responseModal,
        dom.resultModal,
        dom.depositModal,
        dom.depositResultModal,
        dom.maintenanceModal
    ];
    
    modals.forEach(modal => {
        if (modal) {
            modal.classList.remove('active');
        }
    });
}

// Функция для показа модального окна
export function showModal(modalElement) {
    closeAllModals();
    if (modalElement) {
        modalElement.classList.add('active');
    }
}

// Функция для обновления отображения баланса пользователя
export function updateUserBalanceDisplay() {
    if (!state.currentUserProfile) return;
    
    if (dom.coinsValue) {
        dom.coinsValue.textContent = state.currentUserProfile.coins || 0;
    }
    if (dom.reputationValue) {
        dom.reputationValue.textContent = state.currentUserProfile.reputation || 0;
    }
    if (dom.userGreeting && state.currentUserProfile.username) {
        dom.userGreeting.textContent = `Привет, ${state.currentUserProfile.username}!`;
    }
    if (dom.userAvatar && state.currentUserProfile.username) {
        dom.userAvatar.textContent = state.currentUserProfile.username.charAt(0).toUpperCase();
    }
}

// Функция для показа/скрытия индикатора загрузки на конкретном элементе
export function setElementLoading(element, isLoading) {
    if (!element) return;
    
    if (isLoading) {
        element.classList.add('loading');
    } else {
        element.classList.remove('loading');
    }
}

// Экспортируем все необходимые функции для использования в других модулях
export { 
    closeMaintenanceWarning,
    showAuthSection,
    showProfileSection, 
    showAuthError,
    hideAuthError,
    showLoading,
    hideLoading,
    showError,
    hideError,
    updateUserBalanceDisplay
};