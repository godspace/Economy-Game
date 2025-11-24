// Конфигурация Supabase
export const SUPABASE_CONFIG = {
    url: 'https://isugrtihjmbrzwflybrr.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzdWdydGloam1icnp3Zmx5YnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzODQ0OTQsImV4cCI6MjA3ODk2MDQ5NH0.ek79k1g5svlLdhbYS664Lkc-6_tKc06qUgR-MhZtGNI',
    options: {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        }
    }
};

// Кэширование данных
export const cache = {
    users: { data: null, timestamp: 0, ttl: 60000 }, // 1 минута
    ranking: { data: null, timestamp: 0, ttl: 30000 }, // 30 секунд
    topRanking: { data: null, timestamp: 0, ttl: 45000 }, // 45 секунд
    deals: { data: null, timestamp: 0, ttl: 20000 } // 20 секунд
};

// Объект для хранения глобальных переменных
export const state = {
    supabase: null,
    currentUser: null,
    currentUserProfile: null,
    selectedUser: null,
    selectedDeal: null,
    depositTimers: {},
    lastUpdates: {
        users: 0,
        deals: 0,
        ranking: 0,
        topRanking: 0
    },
    updateIntervals: {
        users: 60000,    // 1 минута
        deals: 30000,    // 30 секунд
        ranking: 45000,  // 45 секунд
        topRanking: 60000 // 1 минута
    }
};

// Функция проверки необходимости обновления
export function shouldUpdate(resource) {
    const now = Date.now();
    return !state.lastUpdates[resource] || 
           (now - state.lastUpdates[resource] > state.updateIntervals[resource]);
}

// Функция обновления времени последнего обновления
export function markUpdated(resource) {
    state.lastUpdates[resource] = Date.now();
}

// Объект для хранения DOM элементов
export const dom = {
    authSection: null,
    profileSection: null,
    authForm: null,
    authBtn: null,
    userInfo: null,
    userGreeting: null,
    logoutBtn: null,
    coinsValue: null,
    reputationValue: null,
    usersList: null,
    searchInput: null,
    classFilter: null,
    searchBtn: null,
    incomingDeals: null,
    pendingDeals: null,
    completedIncomingDeals: null,
    completedOutgoingDeals: null,
    rankingTable: null,
    dealModal: null,
    responseModal: null,
    resultModal: null,
    dealAvatar: null,
    dealPlayerName: null,
    dealPlayerClass: null,
    dealPlayerCoins: null,
    dealPlayerReputation: null,
    cooperateBtn: null,
    cheatBtn: null,
    respondCooperateBtn: null,
    respondCheatBtn: null,
    responseDealInfo: null,
    resultContent: null,
    closeResultBtn: null,
    userAvatar: null,
    loadingMessage: null,
    errorMessage: null,
    authError: null,
    dealLimitInfo: null,
    dealLimitText: null,
    depositModal: null,
    depositModalContent: null,
    depositResultModal: null,
    depositResultContent: null,
    closeDepositResultBtn: null,
    activeDepositsList: null,
    depositHistoryList: null,
    topRankingTable: null
};
// config.js - добавить в конец файла
export const SHOP_CONFIG = {
    adminId: 'e22b418b-4abb-44fa-a9e0-2f92b1386a8b',
    productPrice: 299
};
