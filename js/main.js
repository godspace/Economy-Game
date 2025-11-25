import { initDOMElements, setupEventListeners, showLoading, hideLoading, showError } from './ui.js';
import { initSupabase, checkAuth } from './auth.js';
import { loadTopRanking } from './data.js';

// Мониторинг производительности
function initPerformanceMonitoring() {
    if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
                if (entry.duration > 100) {
                    console.warn('Long task detected:', entry);
                }
            });
        });
        observer.observe({ entryTypes: ['longtask'] });
    }
    
    // Мониторинг загрузки ресурсов
    window.addEventListener('load', () => {
        const perfData = performance.timing;
        const loadTime = perfData.loadEventEnd - perfData.navigationStart;
        console.log(`Page load time: ${loadTime}ms`);
        
        if (loadTime > 3000) {
            console.warn('Page load time is slow, consider optimization');
        }
    });
}

// Функция для скрытия предупреждения и сохранения состояния
export function closeMaintenanceWarning() {
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

async function initApp() {
    try {
        console.log('Starting app initialization...');
        
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

// Ленивая загрузка модулей для табов
async function loadTabModule(tabName) {
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

// Запуск приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    // Даем время для загрузки всех скриптов
    setTimeout(initApp, 100);
});

// Экспортируем функцию для использования в других модулях
export { loadTabModule, closeMaintenanceWarning };