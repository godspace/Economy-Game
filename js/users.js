import { supabaseClient, currentUser, currentUserProfile, selectedUser, usersList, userGreeting, userAvatar, coinsValue, reputationValue } from './config.js';
import { showDealModal } from './deals.js';

export async function loadUserProfile(userId) {
    try {
        if (!supabaseClient) {
            console.error('Supabase not initialized');
            return;
        }
        
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) {
            console.error('Ошибка загрузки профиля:', error);
            await createUserProfile(userId);
            return;
        }
        
        currentUserProfile = profile;
        
        if (userGreeting) userGreeting.textContent = `Привет, ${profile.username}!`;
        if (userAvatar) userAvatar.textContent = profile.username.charAt(0).toUpperCase();
        if (coinsValue) coinsValue.textContent = profile.coins;
        if (reputationValue) reputationValue.textContent = profile.reputation;
        
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
    }
}

export async function createUserProfile(userId) {
    try {
        if (!supabaseClient || !currentUser) {
            return;
        }
        
        const username = document.getElementById('username').value;
        const userClass = document.getElementById('class').value;
        
        if (!username || !userClass) {
            return;
        }
        
        const { error } = await supabaseClient
            .from('profiles')
            .insert([
                { 
                    id: userId, 
                    username: username, 
                    class: userClass 
                }
            ]);
        
        if (error) {
            console.error('Ошибка создания профиля:', error);
            return;
        }
        
        await loadUserProfile(userId);
    } catch (error) {
        console.error('Ошибка создания профиля:', error);
    }
}

export async function loadUsers() {
    try {
        if (!supabaseClient || !currentUser || !currentUserProfile) {
            console.error('Supabase or current user not initialized');
            return;
        }
        
        const searchTerm = document.getElementById('searchInput') ? document.getElementById('searchInput').value : '';
        const selectedClass = document.getElementById('classFilter') ? document.getElementById('classFilter').value : '';
        
        let query = supabaseClient
            .from('profiles')
            .select('*')
            .neq('id', currentUser.id);
        
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
        
        if (usersList) {
            usersList.innerHTML = '';
            
            if (users.length === 0) {
                usersList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <p>Пользователи не найдены</p>
                    </div>
                `;
                return;
            }
            
            users.forEach(user => {
                const userCard = document.createElement('div');
                userCard.className = 'user-card';
                
                const currentUserHasCoins = currentUserProfile.coins > 0;
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
                
                usersList.appendChild(userCard);
            });
            
            document.querySelectorAll('.propose-deal-btn').forEach(btn => {
                if (!btn.disabled) {
                    btn.addEventListener('click', function() {
                        const userId = this.dataset.userId;
                        showDealModal(userId);
                    });
                }
            });
        }
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
    }
}