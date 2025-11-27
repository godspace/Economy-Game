// users.js - ПОЛНЫЙ ОБНОВЛЕННЫЙ ФАЙЛ
import { state, dom, cache, shouldUpdate, markUpdated } from './config.js';

export async function loadUserProfile(userId) {
    try {
        if (!state.supabase) {
            console.error('Supabase not initialized');
            return;
        }
        
        const { data: profile, error } = await state.supabase
            .from('profiles')
            .select('id, username, coins, reputation')
            .eq('id', userId)
            .single();
        
        if (error) {
            console.error('Ошибка загрузки профиля:', error);
            return;
        }
        
        // ИСПРАВЛЕНИЕ: Обновляем состояние только если это текущий пользователь
        if (state.currentUser && state.currentUser.id === userId) {
            state.currentUserProfile = profile;
            
            if (dom.userGreeting) dom.userGreeting.textContent = `Привет, ${profile.username}!`;
            if (dom.userAvatar) dom.userAvatar.textContent = profile.username.charAt(0).toUpperCase();
            if (dom.coinsValue) dom.coinsValue.textContent = profile.coins;
            if (dom.reputationValue) dom.reputationValue.textContent = profile.reputation;
        }
        
        return profile;
        
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        return null;
    }
}

export async function loadUsers(forceRefresh = false) {
    try {
        if (!state.supabase || !state.isAuthenticated || !state.currentUserProfile) {
            console.error('Supabase or authentication not initialized');
            return;
        }
        
        // Проверка кэша
        const now = Date.now();
        if (!forceRefresh && cache.users.data && 
            (now - cache.users.timestamp < cache.users.ttl) &&
            shouldUpdate('users')) {
            renderUsers(cache.users.data);
            return;
        }
        
        const searchTerm = dom.searchInput ? dom.searchInput.value : '';
        const selectedClass = dom.classFilter ? dom.classFilter.value : '';
        
        let query = state.supabase
            .from('profiles')
            .select('id, username, class, coins, reputation')
            .neq('id', state.currentUserProfile.id)
            .limit(50);
        
        if (searchTerm) {
            query = query.ilike('username', `%${searchTerm}%`);
        }
        
        if (selectedClass) {
            query = query.eq('class', selectedClass);
        }
        
        const { data: users, error } = await query;
        
        if (error) {
            console.error('Ошибка загрузки пользователей:', error);
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
    }
}

function renderUsers(users) {
    if (!dom.usersList) return;
    
    dom.usersList.innerHTML = '';
    
    if (users.length === 0) {
        dom.usersList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <p>Пользователи не найдены</p>
            </div>
        `;
        return;
    }
    
    // Используем DocumentFragment для оптимизации рендеринга
    const fragment = document.createDocumentFragment();
    
    users.forEach(user => {
        const userCard = document.createElement('div');
        userCard.className = 'user-card';
        
        const currentUserHasCoins = state.currentUserProfile.coins > 0;
        const targetUserHasCoins = user.coins > 0;
        const canMakeDeal = currentUserHasCoins && targetUserHasCoins;
        
        let buttonClass = 'btn-secondary';
        let buttonText = 'Сделка';
        let disabled = false;
        
        if (!currentUserHasCoins) {
            buttonClass = 'btn-secondary btn-disabled';
            buttonText = 'У вас нет монет';
            disabled = true;
        } else if (!targetUserHasCoins) {
            buttonClass = 'btn-secondary btn-disabled';
            buttonText = 'У игрока нет монет';
            disabled = true;
        }
        
        userCard.innerHTML = `
            <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
            <div class="user-name">${user.username}</div>
            <div class="user-details">
                <div class="user-detail">
                    <i class="fas fa-users"></i>
                    <span>${user.class}</span>
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
            <button class="${buttonClass} propose-deal-btn" data-user-id="${user.id}" ${disabled ? 'disabled' : ''}>
                <i class="fas fa-handshake"></i> ${buttonText}
            </button>
        `;
        
        fragment.appendChild(userCard);
    });
    
    dom.usersList.appendChild(fragment);
    
    // Добавляем обработчики событий после рендеринга
    document.querySelectorAll('.propose-deal-btn').forEach(btn => {
        if (!btn.disabled) {
            btn.addEventListener('click', async function() {
                const userId = this.dataset.userId;
                // Динамический импорт для разрыва циклической зависимости
                const { showDealModal } = await import('./deals.js');
                showDealModal(userId);
            });
        }
    });
}

// Функция для отображения информации о лимитах уникальных игроков
async function renderLimitInfo() {
    try {
        if (!state.supabase || !state.currentUserProfile) return;

        // Проверяем текущие лимиты
        const limitCheck = await checkUniquePlayersLimit(null); // null - общая проверка
        
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
        const usedPercentage = totalLimit > 0 ? (limitCheck.usedSlots / totalLimit) * 100 : 0;
        const progressColor = usedPercentage >= 100 ? 'var(--danger)' : 
                            usedPercentage >= 80 ? 'var(--warning)' : 'var(--success)';
        
        limitIndicator.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <i class="fas fa-users" style="color: var(--primary);"></i>
                <strong>Лимит уникальных игроков сегодня:</strong>
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
                    <button class="btn-outline btn-small" onclick="openShopTab()">
                        <i class="fas fa-store"></i> Купить буст
                    </button>
                    ` : ''}
                </div>
                ` : ''}
            </div>
        `;

    } catch (error) {
        console.error('Ошибка отображения информации о лимитах:', error);
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
            return { canMakeDeal: false, error: 'Ошибка проверки лимита' };
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
        return { canMakeDeal: false, error: 'Ошибка системы' };
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

// Добавляем функцию в глобальную область видимости
window.openShopTab = openShopTab;

// Debounce поиска
let searchTimeout = null;

export function setupSearchDebounce() {
    if (dom.searchInput) {
        dom.searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadUsers(true); // force refresh
            }, 500);
        });
    }
    
    if (dom.classFilter) {
        dom.classFilter.addEventListener('change', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadUsers(true); // force refresh
            }, 300);
        });
    }
}