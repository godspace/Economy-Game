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

// DOM элементы - объявляем как let чтобы можно было переопределять
export let authSection = null;
export let profileSection = null;
export let authForm = null;
export let authBtn = null;
export let userInfo = null;
export let userGreeting = null;
export let logoutBtn = null;
export let coinsValue = null;
export let reputationValue = null;
export let usersList = null;
export let searchInput = null;
export let classFilter = null;
export let searchBtn = null;
export let incomingDeals = null;
export let pendingDeals = null;
export let allDeals = null;
export let rankingTable = null;
export let dealModal = null;
export let responseModal = null;
export let resultModal = null;
export let dealAvatar = null;
export let dealPlayerName = null;
export let dealPlayerClass = null;
export let dealPlayerCoins = null;
export let dealPlayerReputation = null;
export let cooperateBtn = null;
export let cheatBtn = null;
export let respondCooperateBtn = null;
export let respondCheatBtn = null;
export let responseDealInfo = null;
export let resultContent = null;
export let closeResultBtn = null;
export let userAvatar = null;
export let loadingMessage = null;
export let errorMessage = null;
export let authError = null;
export let dealLimitInfo = null;
export let dealLimitText = null;
export let depositModal = null;
export let depositModalContent = null;
export let depositResultModal = null;
export let depositResultContent = null;
export let closeDepositResultBtn = null;
export let activeDepositsList = null;
export let depositHistoryList = null;
export let topRankingTable = null;