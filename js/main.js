// main.js - ИСПРАВЛЕННЫЙ ФАЙЛ
import { state } from './config.js';
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

async function initializeApplication() {
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
        
        // Если пользователь авторизован - загружаем статус буста
        if (state.isAuthenticated) {
            try {
                const { updateBoostStatus } = await import('./shop.js');
                await updateBoostStatus();
                console.log('Boost status loaded successfully');
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
    }
}

// Ленивая загрузка модулей для табов (экспортируем для использования в других модулях)
export async function loadTabModule(tabName) {
    try {
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
                const { loadRanking } = await import('./deals.js');
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
    }
}

// Запуск приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    // Даем время для загрузки всех скриптов
    setTimeout(initializeApplication, 100);
});