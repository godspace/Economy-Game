// Конфигурация Supabase
export const SUPABASE_CONFIG = {
    url: 'https://isugrtihjmbrzwflybrr.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzdWdydGloam1icnp3Zmx5YnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzODQ0OTQsImV4cCI6MjA3ODk2MDQ5NH0.ek79k1g5svlLdhbYS664Lkc-6_tKc06qUgR-MhZtGNI',
    options: {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            flowType: 'pkce' // Добавляем PKCE для улучшенной безопасности
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
    currentUser: null,        // { id: userProfile.id } - для совместимости с другими модулями
    currentUserProfile: null, // Полный профиль пользователя
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
    },
    isAuthenticated: false,
    isAdmin: false,
    // ДОБАВЛЯЕМ НОВЫЕ СВОЙСТВА ДЛЯ УПРАВЛЕНИЯ СОСТОЯНИЕМ
    isLoading: false,
    error: null,
    realtimeSubscriptions: [] // Для управления подписками реального времени
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

// Функция для очистки кэша
export function clearCache(resource = null) {
    if (resource) {
        cache[resource] = { data: null, timestamp: 0, ttl: cache[resource].ttl };
    } else {
        Object.keys(cache).forEach(key => {
            cache[key] = { data: null, timestamp: 0, ttl: cache[key].ttl };
        });
    }
}

// Функция для управления подписками реального времени
export function addRealtimeSubscription(subscription) {
    state.realtimeSubscriptions.push(subscription);
}

export function removeRealtimeSubscription(channel) {
    state.realtimeSubscriptions = state.realtimeSubscriptions.filter(sub => sub !== channel);
}

export function cleanupRealtimeSubscriptions() {
    state.realtimeSubscriptions.forEach(sub => {
        if (sub && sub.unsubscribe) {
            sub.unsubscribe();
        }
    });
    state.realtimeSubscriptions = [];
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
    topRankingTable: null,
    shopProductsList: null,
    shopOrderHistory: null,
    adminOrdersList: null,
    adminOrdersTab: null,
    adminOrdersTabContent: null,
    maintenanceModal: null,
    closeMaintenanceModal: null,
    maintenanceBanner: null,
    closeMaintenanceBanner: null
};

// Конфигурация магазина (без хардкода админа)
export const SHOP_CONFIG = {
    productPrice: 299
    // adminId больше не используется - проверка через таблицу admins
};

// Константы для типов депозитов и статусов
export const DEPOSIT_TYPES = {
    CALL: 'call',
    NIGHT: 'night',
    CHAMPION: 'champion',
    CRYPTO: 'crypto'
};

export const DEPOSIT_STATUS = {
    ACTIVE: 'active',
    COMPLETED: 'completed'
};

export const DEAL_STATUS = {
    PENDING: 'pending',
    COMPLETED: 'completed',
    REJECTED: 'rejected'
};

export const DEAL_CHOICES = {
    COOPERATE: 'cooperate',
    CHEAT: 'cheat'
};