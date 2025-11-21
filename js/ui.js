import { 
    authSection, profileSection, userInfo, errorMessage, authError, 
    loadingMessage, coinsValue, reputationValue,
    authForm, authBtn, logoutBtn, searchBtn, cooperateBtn, cheatBtn,
    respondCooperateBtn, respondCheatBtn, closeResultBtn, closeDepositResultBtn,
    dealModal, responseModal, resultModal, depositModal, depositResultModal
} from './config.js';
import { handleAuth, handleLogout } from './auth.js';
import { loadUsers } from './users.js';
import { loadDeals, loadRanking } from './deals.js';
import { loadInvestments } from './investments.js';
import { proposeDeal, respondToDeal } from './deals.js';

export function initDOMElements() {
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
    topRankingTable = document.getElementById('topRankingTable');
}

export function showLoading() {
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

export function hideLoading() {
    if (loadingMessage) {
        loadingMessage.style.display = 'none';
    }
}

export function showError(message) {
    hideLoading();
    if (errorMessage) {
        errorMessage.innerHTML = `<p>${message}</p>`;
        errorMessage.style.display = 'block';
    }
}

export function showAuthError(message) {
    if (authError) {
        authError.innerHTML = `<p>${message}</p>`;
        authError.style.display = 'block';
    }
}

export function hideAuthError() {
    if (authError) {
        authError.style.display = 'none';
    }
}

export function showAuthSection() {
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

export function showProfileSection() {
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

export function setupEventListeners() {
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
    const closeModalButtons = document.querySelectorAll('.close-modal');
    if (closeModalButtons) {
        closeModalButtons.forEach(closeBtn => {
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
}