// Конфигурация Supabase
export const SUPABASE_CONFIG = {
    url: 'https://isugrtihjmbrzwflybrr.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzdWdydGloam1icnp3Zmx5YnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzODQ0OTQsImV4cCI6MjA3ODk2MDQ5NH0.ek79k1g5svlLdhbYS664Lkc-6_tKc06qUgR-MhZtGNI'
};

// Объект для хранения глобальных переменных
export const state = {
    supabase: null,
    currentUser: null,
    currentUserProfile: null,
    selectedUser: null,
    selectedDeal: null,
    depositTimers: {}
};

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
    allDeals: null,
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