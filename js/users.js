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

// Удаляем неиспользуемую функцию createUserProfile, так как она теперь в auth.js