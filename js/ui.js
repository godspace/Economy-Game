import { dom, state } from './config.js';
import { setupSearchDebounce } from './users.js';

export function initDOMElements() {
    // Инициализируем свойства объекта dom, а не переопределяем переменные
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
    dom.maintenanceBanner = document.getElementById('maintenanceBanner');
    dom.closeMaintenanceBanner = document.getElementById('closeMaintenanceBanner');
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
    if (dom.errorMessage) {
        dom.errorMessage.style.display = 'none';
    }
    if (dom.authError) {
        dom.authError.style.display = 'none';
    }
    
    // Показываем вкладку админа если пользователь админ
    if (state.currentUser && state.currentUser.id === 'e22b418b-4abb-44fa-a9e0-2f92b1386a8b' && dom.adminOrdersTab) {
        dom.adminOrdersTab.style.display = 'flex';
    }
}

// Импортируем функции из других модулей
import { handleAuth, handleLogout } from './auth.js';

// Ленивая загрузка модулей
async function loadTabModule(tabName) {
    console.log('Loading tab module:', tabName);
    
    switch(tabName) {
        case 'users':
            const { loadUsers } = await import('./users.js');
            loadUsers();
            break;
        case 'deals':
            const { loadDeals } = await import('./deals.js');
            loadDeals();
            break;
        case 'ranking':
            const { loadRanking } = await import('./deals.js');
            loadRanking();
            break;
        case 'investments':
            const { loadInvestments } = await import('./investments.js');
            loadInvestments();
            break;
        case 'shop':
            const { loadShop } = await import('./shop.js');
            loadShop();
            break;
        case 'adminOrders':
            console.log('Loading admin orders...');
            const { loadAdminOrders } = await import('./shop.js');
            loadAdminOrders();
            break;
        default:
            console.warn('Unknown tab:', tabName);
    }
}

export function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    if (dom.authForm) {
        dom.authForm.addEventListener('submit', handleAuth);
    }
    
    if (dom.logoutBtn) {
        dom.logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Настройка debounce для поиска
    setupSearchDebounce();
    
    if (dom.searchBtn) {
        dom.searchBtn.addEventListener('click', async () => {
            const { loadUsers } = await import('./users.js');
            loadUsers(true);
        });
    }
    if (dom.closeMaintenanceBanner) {
        dom.closeMaintenanceBanner.addEventListener('click', function() {
            if (dom.maintenanceBanner) {
                dom.maintenanceBanner.style.display = 'none';
                localStorage.setItem('maintenanceWarningClosed', 'true');
            }
        });
    }
    
    // Табы с ленивой загрузкой
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            console.log('Tab clicked:', tabName);
            
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            this.classList.add('active');
            
            // Определяем ID контента для таба
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
            } else {
                console.error('Tab content not found:', tabContentId);
            }
            
            // Ленивая загрузка контента таба
            loadTabModule(tabName);
        });
    });
    
    // Модальные окна
    const closeModalButtons = document.querySelectorAll('.close-modal');
    if (closeModalButtons) {
        closeModalButtons.forEach(closeBtn => {
            closeBtn.addEventListener('click', function() {
                if (dom.dealModal) dom.dealModal.classList.remove('active');
                if (dom.responseModal) dom.responseModal.classList.remove('active');
                if (dom.resultModal) dom.resultModal.classList.remove('active');
                if (dom.depositModal) dom.depositModal.classList.remove('active');
                if (dom.depositResultModal) dom.depositResultModal.classList.remove('active');
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
                module.openDepositModal(
                    button.dataset.type,
                    button.dataset.duration,
                    button.dataset.profit,
                    button.dataset.risk === 'true'
                );
            });
        }
        
        // Закрытие модальных окон при клике вне области
        if (event.target.classList.contains('modal')) {
            event.target.classList.remove('active');
        }
    });
    
    // Кнопки выбора стратегии
    if (dom.cooperateBtn) {
        dom.cooperateBtn.addEventListener('click', async function() {
            const { proposeDeal } = await import('./deals.js');
            proposeDeal('cooperate');
        });
    }
    
    if (dom.cheatBtn) {
        dom.cheatBtn.addEventListener('click', async function() {
            const { proposeDeal } = await import('./deals.js');
            proposeDeal('cheat');
        });
    }
    
    if (dom.respondCooperateBtn) {
        dom.respondCooperateBtn.addEventListener('click', async function() {
            const { respondToDeal } = await import('./deals.js');
            respondToDeal('cooperate');
        });
    }
    
    if (dom.respondCheatBtn) {
        dom.respondCheatBtn.addEventListener('click', async function() {
            const { respondToDeal } = await import('./deals.js');
            respondToDeal('cheat');
        });
    }
    
    // Предотвращение закрытия при клике внутри модального окна
    document.querySelectorAll('.modal-content').forEach(content => {
        content.addEventListener('click', function(event) {
            event.stopPropagation();
        });
    });
    
    console.log('Event listeners setup completed');
}
