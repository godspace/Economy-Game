// Конфигурация Supabase
export const SUPABASE_CONFIG = {
    url: 'https://isugrtihjmbrzwflybrr.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzdWdydGloam1icnp3Zmx5YnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzODQ0OTQsImV4cCI6MjA3ODk2MDQ5NH0.ek79k1g5svlLdhbYS664Lkc-6_tKc06qUgR-MhZtGNI'
};

// Глобальные переменные
export let supabase = null;
export let currentUser = null;
export let currentUserProfile = null;
export let selectedUser = null;
export let selectedDeal = null;
export let depositTimers = {};

// DOM элементы
export let authSection, profileSection, authForm, authBtn, userInfo, userGreeting, logoutBtn;
export let coinsValue, reputationValue, usersList, searchInput, classFilter, searchBtn;
export let incomingDeals, pendingDeals, allDeals, rankingTable, dealModal, responseModal, resultModal;
export let dealAvatar, dealPlayerName, dealPlayerClass, dealPlayerCoins, dealPlayerReputation;
export let cooperateBtn, cheatBtn, respondCooperateBtn, respondCheatBtn, responseDealInfo;
export let resultContent, closeResultBtn, userAvatar;
export let loadingMessage, errorMessage, authError;
export let dealLimitInfo, dealLimitText;
export let depositModal, depositModalContent, depositResultModal, depositResultContent, closeDepositResultBtn;
export let activeDepositsList, depositHistoryList, topRankingTable;