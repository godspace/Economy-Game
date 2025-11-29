// main.js - ИСПРАВЛЕННЫЙ ФАЙЛ
import { state, addRealtimeSubscription, cleanupRealtimeSubscriptions } from './config.js';
import { initDOMElements, setupEventListeners, showLoading, hideLoading, showError } from './ui.js';
import { initSupabase, checkAuth, isSupabaseInitialized } from './auth.js';
import { loadTopRanking } from './data.js';

// Мониторинг производительности
function initPerformanceMonitoring() {
    if ('PerformanceObserver' in window) {
        try {
            const observer = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    if (entry.duration > 100) {
                        console.warn('Long task detected:', entry);
                    }
                });
            });
            observer.observe({ entryTypes: ['longtask'] });
        } catch (error) {
            console.warn('PerformanceObserver not supported:', error);
        }
    }
    
    // Мониторинг загрузки ресурсов
    window.addEventListener('load', () => {
        if (performance.timing) {
            const perfData = performance.timing;
            const loadTime = perfData.loadEventEnd - perfData.navigationStart;
            console.log(`Page load time: ${loadTime}ms`);
            
            if (loadTime > 3000) {
                console.warn('Page load time is slow, consider optimization');
            }
        }
    });
}

// Обработка ошибок приложения
function initErrorHandling() {
    // Обработка необработанных ошибок Promise
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled Promise rejection:', event.reason);
        event.preventDefault(); // Предотвращаем вывод в консоль браузера
    });

    // Обработка глобальных ошибок
    window.addEventListener('error', (event) => {
        console.error('Global error:', event.error);
        // Можно отправить ошибку на сервер для мониторинга
    });
}

// Функция для скрытия предупреждения и сохранения состояния
function closeMaintenanceWarning() {
    const maintenanceModal = document.getElementById('maintenanceModal');
    const maintenanceBanner = document.getElementById('maintenanceBanner');
    
    // Для модального окна
    if (maintenanceModal) {
        maintenanceModal.classList.remove('active');
    }
    // Для баннера
    if (maintenanceBanner) {
        maintenanceBanner.style.display = 'none';
    }
    // Сохраняем в localStorage, что пользователь закрыл предупреждение
    localStorage.setItem('maintenanceWarningClosed', 'true');
}

// Инициализация realtime подписок
function initRealtimeSubscriptions() {
    if (!isSupabaseInitialized() || !state.isAuthenticated) return;

    try {
        // Подписка на изменения профиля пользователя
        const profileSubscription = state.supabase
            .channel('profile-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${state.currentUserProfile?.id}`
                },
                async (payload) => {
                    console.log('Profile updated:', payload);
                    // Обновляем данные в реальном времени
                    if (payload.new && state.currentUserProfile) {
                        Object.assign(state.currentUserProfile, payload.new);
                        await updateUI();
                    }
                }
            )
            .subscribe();

        addRealtimeSubscription(profileSubscription);

    } catch (error) {
        console.error('Error initializing realtime subscriptions:', error);
    }
}

// Обновление UI при изменениях - ИСПРАВЛЕНО: добавлен async
async function updateUI() {
    if (!state.currentUserProfile) return;

    // Ищем элементы DOM если они еще не инициализированы
    if (!dom || !dom.coinsValue || !dom.reputationValue) {
        const { dom: uiDom } = await import('./ui.js');
        Object.assign(dom, uiDom);
    }

    if (dom.coinsValue) dom.coinsValue.textContent = state.currentUserProfile.coins || 0;
    if (dom.reputationValue) dom.reputationValue.textContent = state.currentUserProfile.reputation || 0;
}

async function initializeApplication() {
    try {
        console.log('Starting app initialization...');
        
        // Инициализация обработки ошибок
        initErrorHandling();
        
        // Инициализация мониторинга производительности
        initPerformanceMonitoring();
        
        // Сначала инициализируем DOM элементы
        initDOMElements();
        
        // Показываем сообщение о загрузке
        showLoading();
        
        // Показываем предупреждение о технических работах сразу после инициализации DOM
        const warningClosed = localStorage.getItem('maintenanceWarningClosed');
        if (!warningClosed) {
            const maintenanceBanner = document.getElementById('maintenanceBanner');
            if (maintenanceBanner) {
                maintenanceBanner.style.display = 'block';
            }
        }
        
        // Затем инициализируем Supabase
        await initSupabase();
        
        // Проверяем успешность инициализации
        if (!isSupabaseInitialized()) {
            throw new Error('Failed to initialize Supabase client');
        }
        
        // Настройка обработчиков событий
        setupEventListeners();
        
        // Загружаем топ рейтинга для страницы авторизации
        await loadTopRanking();
        
        // Проверка авторизации
        await checkAuth();
        
        // Если пользователь авторизован - инициализируем realtime подписки и бусты
        if (state.isAuthenticated) {
            try {
                // Инициализация realtime подписки
                initRealtimeSubscriptions();
                
                // Загружаем статус буста
                const { updateBoostStatus, startBoostStatusPolling } = await import('./shop.js');
                await updateBoostStatus();
                startBoostStatusPolling();
                console.log('Boost status loaded and polling started successfully');
            } catch (error) {
                console.error('Error loading boost status:', error);
            }
        }
        
        // Скрываем сообщение о загрузке
        hideLoading();
        
        console.log('App initialized successfully');
        
    } catch (error) {
        console.error('Error initializing app:', error);
        showError('Не удалось загрузить приложение: ' + error.message);
        
        // Все равно скрываем loading сообщение
        hideLoading();
    }
}

// Ленивая загрузка модулей для табов (экспортируем для использования в других модулях)
export async function loadTabModule(tabName) {
    try {
        // Показываем индикатор загрузки для таба
        const tabContent = document.getElementById(`${tabName}Tab`);
        if (tabContent) {
            tabContent.classList.add('loading');
        }

        switch(tabName) {
            case 'users':
                const { loadUsers } = await import('./users.js');
                await loadUsers();
                break;
            case 'deals':
                const { loadDeals } = await import('./deals.js');
                await loadDeals();
                break;
            case 'ranking':
                const { loadRanking } = await import('./data.js'); // Исправлен импорт
                await loadRanking();
                break;
            case 'investments':
                const { loadInvestments } = await import('./investments.js');
                await loadInvestments();
                break;
            case 'shop':
                const { loadShop, updateBoostStatus } = await import('./shop.js');
                await loadShop();
                // Обновляем статус буста при открытии магазина
                await updateBoostStatus();
                break;
            case 'adminOrders':
                console.log('Loading admin orders...');
                const { loadAdminOrders } = await import('./shop.js');
                await loadAdminOrders();
                break;
            default:
                console.warn('Unknown tab:', tabName);
        }
    } catch (error) {
        console.error('Error loading tab module:', tabName, error);
        showError(`Не удалось загрузить вкладку ${tabName}: ${error.message}`);
    } finally {
        // Скрываем индикатор загрузки
        const tabContent = document.getElementById(`${tabName}Tab`);
        if (tabContent) {
            tabContent.classList.remove('loading');
        }
    }
}

// Очистка ресурсов при закрытии страницы
function initCleanup() {
    window.addEventListener('beforeunload', () => {
        // Останавливаем все подписки и таймеры
        cleanupRealtimeSubscriptions();
        
        // Останавливаем polling бустов
        if (state.isAuthenticated) {
            try {
                const { stopBoostStatusPolling } = require('./shop.js');
                stopBoostStatusPolling();
            } catch (error) {
                console.error('Error stopping boost polling:', error);
            }
        }
    });
}

// Запуск приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация очистки
    initCleanup();
    
    // Даем время для загрузки всех скриптов
    setTimeout(initializeApplication, 100);
});

// Экспортируем для тестирования
export { 
    initializeApplication, 
    loadTabModule, 
    initPerformanceMonitoring, 
    initErrorHandling,
    initRealtimeSubscriptions
};