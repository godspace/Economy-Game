// users.js - ПОЛНЫЙ ОБНОВЛЕННЫЙ ФАЙЛ
import { state, dom, cache, shouldUpdate, markUpdated } from './config.js';

export async function loadUserProfile(userId) {
    try {
        if (!state.supabase) {
            console.error('Supabase not initialized');
            return null;
        }
        
        const { data: profile, error } = await state.supabase
            .from('profiles')
            .select('id, username, coins, reputation')
            .eq('id', userId)
            .single();
        
        if (error) {
            console.error('Ошибка загрузки профиля:', error);
            return null;
        }
        
        // ИСПРАВЛЕНИЕ: Обновляем состояние только если это текущий пользователь
        if (state.currentUserProfile && state.currentUserProfile.id === userId) {
            state.currentUserProfile = { ...state.currentUserProfile, ...profile };
            updateUserProfileDisplay();
        }
        
        return profile;
        
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        return null;
    }
}

// Функция для обновления отображения профиля пользователя
function updateUserProfileDisplay() {
    if (!state.currentUserProfile) return;
    
    if (dom.userGreeting) {
        dom.userGreeting.textContent = `Привет, ${state.currentUserProfile.username}!`;
    }
    if (dom.userAvatar) {
        dom.userAvatar.textContent = state.currentUserProfile.username.charAt(0).toUpperCase();
    }
    if (dom.coinsValue) {
        dom.coinsValue.textContent = state.currentUserProfile.coins;
    }
    if (dom.reputationValue) {
        dom.reputationValue.textContent = state.currentUserProfile.reputation;
    }
}

export async function loadUsers(forceRefresh = false) {
    try {
        if (!state.supabase || !state.isAuthenticated || !state.currentUserProfile) {
            console.error('Supabase or authentication not initialized');
            return;
        }
        
        // Показываем индикатор загрузки
        if (dom.usersList) {
            dom.usersList.classList.add('loading');
        }
        
        // ПРИНУДИТЕЛЬНО ОБНОВЛЯЕМ СТАТУС БУСТА ПРИ ОТКРЫТИИ ВКЛАДКИ
        try {
            const { updateBoostStatus } = await import('./shop.js');
            await updateBoostStatus();
        } catch (error) {
            console.error('Error updating boost status in users tab:', error);
        }
        
        // Проверка кэша
        const now = Date.now();
        if (!forceRefresh && cache.users.data && 
            (now - cache.users.timestamp < cache.users.ttl) &&
            shouldUpdate('users')) {
            renderUsers(cache.users.data);
            if (dom.usersList) {
                dom.usersList.classList.remove('loading');
            }
            return;
        }
        
        const searchTerm = dom.searchInput ? dom.searchInput.value.trim() : '';
        const selectedClass = dom.classFilter ? dom.classFilter.value : '';
        
        let query = state.supabase
            .from('profiles')
            .select('id, username, class, coins, reputation')
            .neq('id', state.currentUserProfile.id)
            .limit(50);
        
        if (searchTerm) {
            query = query.ilike('username', `%${searchTerm}%`);
        }
        
        if (selectedClass && selectedClass !== 'all') {
            query = query.eq('class', selectedClass);
        }
        
        const { data: users, error } = await query;
        
        if (error) {
            console.error('Ошибка загрузки пользователей:', error);
            renderUsersError('Не удалось загрузить пользователей');
            return;
        }
        
        // Сохраняем в кэш
        cache.users.data = users;
        cache.users.timestamp = now;
        markUpdated('users');
        
        renderUsers(users);
        
        // После загрузки пользователей показываем информацию о лимитах
        await renderLimitInfo();
        
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        renderUsersError('Ошибка при загрузке пользователей');
    } finally {
        // Скрываем индикатор загрузки
        if (dom.usersList) {
            dom.usersList.classList.remove('loading');
        }
    }
}

function renderUsers(users) {
    if (!dom.usersList) return;
    
    try {
        dom.usersList.innerHTML = '';
        
        if (!users || users.length === 0) {
            renderEmptyUsersState();
            return;
        }
        
        const fragment = document.createDocumentFragment();
        
        users.forEach(user => {
            const userCard = createUserCard(user);
            fragment.appendChild(userCard);
        });
        
        dom.usersList.appendChild(fragment);
        
        // Добавляем обработчики событий после рендеринга
        setTimeout(() => {
            attachUserCardEventListeners();
        }, 0);
        
    } catch (error) {
        console.error('Ошибка рендеринга пользователей:', error);
        renderUsersError('Ошибка отображения пользователей');
    }
}

function createUserCard(user) {
    const userCard = document.createElement('div');
    userCard.className = 'user-card';
    
    const currentUserHasCoins = state.currentUserProfile.coins > 0;
    const targetUserHasCoins = user.coins > 0;
    const canMakeDeal = currentUserHasCoins && targetUserHasCoins;
    
    let buttonClass = 'btn-secondary';
    let buttonText = 'Сделка';
    let disabled = false;
    let tooltip = '';
    
    if (!currentUserHasCoins) {
        buttonClass = 'btn-secondary btn-disabled';
        buttonText = 'У вас нет монет';
        disabled = true;
        tooltip = 'title="Для совершения сделки нужна хотя бы 1 монета"';
    } else if (!targetUserHasCoins) {
        buttonClass = 'btn-secondary btn-disabled';
        buttonText = 'У игрока нет монет';
        disabled = true;
        tooltip = 'title="Игрок должен иметь монеты для сделки"';
    }
    
    userCard.innerHTML = `
        <div class="user-avatar">${escapeHtml(user.username.charAt(0).toUpperCase())}</div>
        <div class="user-name">${escapeHtml(user.username)}</div>
        <div class="user-details">
            <div class="user-detail">
                <i class="fas fa-users"></i>
                <span>${escapeHtml(user.class || 'Не указан')}</span>
            </div>
            <div class="user-detail">
                <i class="fas fa-coins"></i>
                <span>${user.coins}</span>
            </div>
            <div class="user-detail">
                <i class="fas fa-star"></i>
                <span>${user.reputation}</span>
            </div>
        </div>
        <button class="${buttonClass} propose-deal-btn" 
                data-user-id="${user.id}" 
                data-user-name="${escapeHtml(user.username)}"
                ${disabled ? 'disabled' : ''}
                ${tooltip}>
            <i class="fas fa-handshake"></i> ${buttonText}
        </button>
    `;
    
    return userCard;
}

function attachUserCardEventListeners() {
    document.querySelectorAll('.propose-deal-btn:not(:disabled)').forEach(btn => {
        btn.addEventListener('click', async function() {
            const userId = this.dataset.userId;
            const userName = this.dataset.userName;
            
            // Показываем индикатор загрузки на кнопке
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка...';
            this.disabled = true;
            
            try {
                // Динамический импорт для разрыва циклической зависимости
                const { showDealModal } = await import('./deals.js');
                await showDealModal(userId);
            } catch (error) {
                console.error('Ошибка открытия модального окна сделки:', error);
                alert(`Не удалось открыть сделку с пользователем ${userName}`);
            } finally {
                // Восстанавливаем кнопку
                this.innerHTML = originalText;
                this.disabled = false;
            }
        });
    });
}

function renderEmptyUsersState() {
    if (!dom.usersList) return;
    
    const searchTerm = dom.searchInput ? dom.searchInput.value.trim() : '';
    const selectedClass = dom.classFilter ? dom.classFilter.value : '';
    
    let message = 'Пользователи не найдены';
    let icon = 'fa-users';
    
    if (searchTerm && selectedClass && selectedClass !== 'all') {
        message = `Не найдено пользователей с именем "${searchTerm}" в классе ${selectedClass}`;
    } else if (searchTerm) {
        message = `Не найдено пользователей с именем "${searchTerm}"`;
    } else if (selectedClass && selectedClass !== 'all') {
        message = `Не найдено пользователей в классе ${selectedClass}`;
    }
    
    dom.usersList.innerHTML = `
        <div class="empty-state">
            <i class="fas ${icon}"></i>
            <p>${message}</p>
            ${searchTerm || (selectedClass && selectedClass !== 'all') ? `
                <button class="btn-outline" onclick="clearSearchFilters()" style="margin-top: 10px;">
                    <i class="fas fa-times"></i> Очистить фильтры
                </button>
            ` : ''}
        </div>
    `;
}

function renderUsersError(message) {
    if (!dom.usersList) return;
    
    dom.usersList.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <p>${message}</p>
            <button class="btn-outline" onclick="loadUsers(true)" style="margin-top: 10px;">
                <i class="fas fa-redo"></i> Попробовать снова
            </button>
        </div>
    `;
}

// Функция для отображения информации о лимитах уникальных игроков
async function renderLimitInfo() {
    try {
        if (!state.supabase || !state.currentUserProfile) return;

        // Проверяем текущие лимиты
        const limitCheck = await checkUniquePlayersLimit(null);
        
        // Создаем или обновляем индикатор лимитов
        let limitIndicator = document.getElementById('limitIndicator');
        
        if (!limitIndicator) {
            limitIndicator = document.createElement('div');
            limitIndicator.id = 'limitIndicator';
            limitIndicator.className = 'limit-info';
            
            // Вставляем перед списком пользователей
            const usersList = document.getElementById('usersList');
            if (usersList && usersList.parentNode) {
                usersList.parentNode.insertBefore(limitIndicator, usersList);
            }
        }

        const totalLimit = limitCheck.baseLimit + limitCheck.boostLimit;
        const usedPercentage = totalLimit > 0 ? Math.min(100, (limitCheck.usedSlots / totalLimit) * 100) : 0;
        const progressColor = usedPercentage >= 100 ? 'var(--danger)' : 
                            usedPercentage >= 80 ? 'var(--warning)' : 'var(--success)';
        
        limitIndicator.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <i class="fas fa-users" style="color: var(--primary);"></i>
                <strong>Лимит уникальных игроков сегодня:</strong>
                <button class="btn-outline btn-small" id="refreshBoostBtn" style="margin-left: auto; padding: 2px 8px; font-size: 0.7rem;">
                    <i class="fas fa-sync-alt"></i> Обновить
                </button>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px;">
                <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <span style="font-weight: bold;">${limitCheck.usedSlots}/${totalLimit} игроков</span>
                    <div class="limit-progress">
                        <div class="limit-progress-bar" style="width: ${usedPercentage}%; background: ${progressColor};"></div>
                    </div>
                    ${limitCheck.hasActiveBoost ? 
                        '<span style="color: var(--success); display: flex; align-items: center; gap: 5px;"><i class="fas fa-rocket"></i> Буст активен!</span>' : 
                        ''
                    }
                </div>
                ${limitCheck.availableSlots <= 2 ? `
                <div style="text-align: right;">
                    <small style="color: ${limitCheck.availableSlots === 0 ? 'var(--danger)' : 'var(--warning)'}; display: block; margin-bottom: 5px;">
                        ${limitCheck.availableSlots === 0 ? '❌ Лимит исчерпан' : `⚠️ Осталось ${limitCheck.availableSlots} слот${limitCheck.availableSlots === 1 ? '' : 'а'}`}
                    </small>
                    ${!limitCheck.hasActiveBoost ? `
                    <button class="btn-outline btn-small" id="openShopBtn">
                        <i class="fas fa-store"></i> Купить буст
                    </button>
                    ` : ''}
                </div>
                ` : ''}
            </div>
            ${limitCheck.hasActiveBoost ? `
            <div style="margin-top: 10px; padding: 8px; background: #e8f5e8; border-radius: 5px; border-left: 3px solid #4caf50;">
                <small style="color: #2e7d32;">
                    <i class="fas fa-info-circle"></i> 
                    Активен буст +${limitCheck.boostLimit} игроков. Общий лимит: ${totalLimit} игроков
                </small>
            </div>
            ` : ''}
        `;

        // Добавляем обработчики для новых кнопок
        const refreshBtn = document.getElementById('refreshBoostBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', refreshBoostStatus);
        }
        
        const openShopBtn = document.getElementById('openShopBtn');
        if (openShopBtn) {
            openShopBtn.addEventListener('click', openShopTab);
        }

    } catch (error) {
        console.error('Ошибка отображения информации о лимитах:', error);
    }
}

// Функция для принудительного обновления статуса буста
async function refreshBoostStatus() {
    try {
        const button = document.getElementById('refreshBoostBtn');
        const originalHtml = button?.innerHTML;
        
        if (button) {
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            button.disabled = true;
        }
        
        const { updateBoostStatus } = await import('./shop.js');
        await updateBoostStatus();
        
        // Перезагружаем пользователей для обновления лимитов
        await loadUsers(true);
        
        // Показываем уведомление
        showNotification('Статус обновлен', 'success');
        
    } catch (error) {
        console.error('Ошибка обновления статуса буста:', error);
        showNotification('Ошибка обновления статуса', 'error');
    } finally {
        const button = document.getElementById('refreshBoostBtn');
        if (button) {
            button.innerHTML = '<i class="fas fa-sync-alt"></i> Обновить';
            button.disabled = false;
        }
    }
}

// Функция для проверки лимитов уникальных игроков
async function checkUniquePlayersLimit(targetUserId) {
    try {
        if (!state.supabase || !state.currentUserProfile) {
            return { canMakeDeal: false, error: 'Не инициализирован' };
        }

        const { data: result, error } = await state.supabase.rpc('check_daily_unique_players_limit', {
            p_user_id: state.currentUserProfile.id
        });

        if (error) {
            console.error('Ошибка проверки лимита:', error);
            return { 
                canMakeDeal: false, 
                error: 'Ошибка проверки лимита',
                baseLimit: 5,
                boostLimit: 0,
                usedSlots: 0,
                availableSlots: 5,
                hasActiveBoost: false
            };
        }

        return {
            canMakeDeal: result.available_slots > 0,
            baseLimit: result.base_limit,
            boostLimit: result.boost_limit,
            usedSlots: result.used_slots,
            availableSlots: result.available_slots,
            hasActiveBoost: result.has_active_boost
        };

    } catch (error) {
        console.error('Ошибка при проверке лимита:', error);
        return { 
            canMakeDeal: false, 
            error: 'Ошибка системы',
            baseLimit: 5,
            boostLimit: 0,
            usedSlots: 0,
            availableSlots: 5,
            hasActiveBoost: false
        };
    }
}

// Функция для открытия вкладки магазина
function openShopTab() {
    const shopTab = document.querySelector('.tab[data-tab="shop"]');
    if (shopTab) {
        shopTab.click();
        
        // Прокручиваем к бусту в магазине
        setTimeout(() => {
            const boostProduct = document.querySelector('[data-product-type="unique_players_boost"]');
            if (boostProduct) {
                boostProduct.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Подсвечиваем буст
                boostProduct.style.animation = 'pulse 2s 3';
                setTimeout(() => {
                    boostProduct.style.animation = '';
                }, 6000);
            }
        }, 500);
    }
}

// Вспомогательная функция для показа уведомлений
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const bgColor = type === 'success' ? 'var(--success)' : 
                   type === 'error' ? 'var(--danger)' : 'var(--primary)';
    
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 12px 18px;
        border-radius: 5px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        max-width: 300px;
        word-wrap: break-word;
    `;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check' : type === 'error' ? 'fa-exclamation-triangle' : 'fa-info'}"></i>
        ${message}
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Функция для очистки фильтров поиска
function clearSearchFilters() {
    if (dom.searchInput) {
        dom.searchInput.value = '';
    }
    if (dom.classFilter) {
        dom.classFilter.value = 'all';
    }
    loadUsers(true);
}

// Функция для экранирования HTML
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Debounce поиска
let searchTimeout = null;

export function setupSearchDebounce() {
    if (dom.searchInput) {
        dom.searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadUsers(true);
            }, 500);
        });
    }
    
    if (dom.classFilter) {
        dom.classFilter.addEventListener('change', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadUsers(true);
            }, 300);
        });
    }
}

// Добавляем функции в глобальную область видимости
window.refreshBoostStatus = refreshBoostStatus;
window.openShopTab = openShopTab;
window.clearSearchFilters = clearSearchFilters;
window.loadUsers = loadUsers;

// Экспортируем для использования в других модулях
export { checkUniquePlayersLimit, refreshBoostStatus };