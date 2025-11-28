// shop.js - ПОЛНЫЙ ОБНОВЛЕННЫЙ ФАЙЛ
import { state, dom } from './config.js';

// Глобальная переменная для таймера обновления статуса буста
let boostStatusTimer = null;

export async function loadShop() {
    try {
        console.log('Loading shop...');
        
        if (!state.supabase) {
            console.error('Supabase not initialized');
            return;
        }
        
        if (!state.isAuthenticated) {
            console.error('User not authenticated');
            return;
        }
        
        if (!state.currentUserProfile) {
            console.error('User profile not loaded');
            return;
        }
        
        console.log('User authenticated:', state.currentUserProfile.id, 'Coins:', state.currentUserProfile.coins);
        
        // Загружаем товары
        const { data: products, error: productsError } = await state.supabase
            .from('products')
            .select('*')
            .eq('is_active', true);

        console.log('Products loaded:', products);

        if (productsError) {
            console.error('Ошибка загрузки товаров:', productsError);
            return;
        }

        renderProducts(products);
        await loadOrderHistory();

    } catch (error) {
        console.error('Ошибка загрузки магазина:', error);
    }
}

// Функция для периодической проверки статуса буста
export function startBoostStatusPolling() {
    if (boostStatusTimer) {
        clearInterval(boostStatusTimer);
    }
    
    // Проверяем статус буста каждые 30 секунд
    boostStatusTimer = setInterval(async () => {
        if (state.isAuthenticated && state.currentUserProfile) {
            await updateBoostStatus();
        }
    }, 30000);
}

// Останавливаем polling при выходе
export function stopBoostStatusPolling() {
    if (boostStatusTimer) {
        clearInterval(boostStatusTimer);
        boostStatusTimer = null;
    }
}

// Функция для принудительной проверки статуса буста
async function forceCheckBoostStatus() {
    try {
        console.log('🔍 Принудительная проверка статуса буста...');
        
        // Сначала проверяем заказы на бусты
        const { data: boostOrders, error: ordersError } = await state.supabase
            .from('orders')
            .select('*')
            .eq('user_id', state.currentUserProfile.id)
            .eq('product_id', 'aa370d4c-9779-4056-a7a5-9808c4096f8f') // ID буста
            .in('status', ['confirmed', 'completed'])
            .order('created_at', { ascending: false })
            .limit(1);

        if (ordersError) {
            console.error('Ошибка проверки заказов буста:', ordersError);
        } else {
            console.log('📦 Заказы на бусты:', boostOrders);
        }

        // Затем проверяем активные бусты
        const { data: activeBoosts, error: boostsError } = await state.supabase
            .from('user_boosts')
            .select('*')
            .eq('user_id', state.currentUserProfile.id)
            .eq('boost_type', 'unique_players')
            .eq('is_active', true)
            .gt('expires_at', new Date().toISOString())
            .order('expires_at', { ascending: true })
            .limit(1);

        if (boostsError) {
            console.error('Ошибка проверки активных бустов:', boostsError);
        } else {
            console.log('🚀 Активные бусты:', activeBoosts);
        }

        // Обновляем статус в state
        const hasActiveBoost = activeBoosts && activeBoosts.length > 0;
        state.hasActiveUniquePlayersBoost = hasActiveBoost;
        
        console.log('🔧 Итоговый статус буста:', {
            hasActiveBoost: hasActiveBoost,
            boostOrdersCount: boostOrders?.length || 0,
            activeBoostsCount: activeBoosts?.length || 0
        });

        // Если появился новый активный буст - сбрасываем состояние закрытия
        if (hasActiveBoost) {
            localStorage.removeItem('boostIndicatorClosed');
        }

        // Обновляем UI
        updateBoostUI(hasActiveBoost, activeBoosts?.[0]);
        
        // Принудительно обновляем лимиты
        if (document.getElementById('usersTab')?.classList.contains('active')) {
            const { loadUsers } = await import('./users.js');
            loadUsers(true);
        }

    } catch (error) {
        console.error('Ошибка принудительной проверки статуса буста:', error);
    }
}

// Обновляем функцию updateBoostStatus для более детальной проверки
export async function updateBoostStatus() {
    try {
        if (!state.supabase || !state.currentUserProfile) return;

        console.log('🔄 Checking boost status for user:', state.currentUserProfile.id);

        // Проверяем активные бусты
        const { data: activeBoosts, error } = await state.supabase
            .from('user_boosts')
            .select('*')
            .eq('user_id', state.currentUserProfile.id)
            .eq('boost_type', 'unique_players')
            .eq('is_active', true)
            .gt('expires_at', new Date().toISOString())
            .order('expires_at', { ascending: true })
            .limit(1);

        if (error) {
            console.error('Ошибка проверки бустов:', error);
            return;
        }

        const hasActiveBoost = activeBoosts && activeBoosts.length > 0;
        const previousBoostStatus = state.hasActiveUniquePlayersBoost;
        
        // Сохраняем статус в state для использования в других модулях
        state.hasActiveUniquePlayersBoost = hasActiveBoost;
        
        console.log('🔧 Boost status updated:', {
            previous: previousBoostStatus,
            current: hasActiveBoost,
            activeBoosts: activeBoosts
        });

        // Обновляем UI только если статус изменился
        if (previousBoostStatus !== hasActiveBoost) {
            console.log('🎯 Boost status changed, updating UI');
            updateBoostUI(hasActiveBoost, activeBoosts?.[0]);
            
            // Принудительно обновляем лимиты на вкладке пользователей
            if (document.getElementById('usersTab')?.classList.contains('active')) {
                const { loadUsers } = await import('./users.js');
                loadUsers(true);
            }
        } else {
            // Обновляем таймер даже если статус не изменился
            updateBoostUI(hasActiveBoost, activeBoosts?.[0]);
        }

    } catch (error) {
        console.error('Ошибка обновления статуса буста:', error);
    }
}

// Функция для обновления UI буста
function updateBoostUI(hasActiveBoost, boostData) {
    // Создаем или обновляем индикатор буста в хедере
    let boostIndicator = document.getElementById('boostIndicator');
    
    if (!boostIndicator) {
        boostIndicator = document.createElement('div');
        boostIndicator.id = 'boostIndicator';
        boostIndicator.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: linear-gradient(135deg, #ffd700, #ff6b00);
            color: white;
            padding: 10px 15px;
            border-radius: 20px;
            box-shadow: 0 4px 12px rgba(255, 107, 0, 0.3);
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: bold;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.3s ease;
            border: 2px solid #ffa500;
        `;
        
        // Добавляем обработчик клика для закрытия
        boostIndicator.addEventListener('click', function() {
            this.style.display = 'none';
            // Сохраняем состояние закрытия в localStorage
            localStorage.setItem('boostIndicatorClosed', 'true');
        });
        
        // Добавляем hover эффект
        boostIndicator.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05)';
            this.style.boxShadow = '0 6px 15px rgba(255, 107, 0, 0.4)';
        });
        
        boostIndicator.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
            this.style.boxShadow = '0 4px 12px rgba(255, 107, 0, 0.3)';
        });
        
        document.body.appendChild(boostIndicator);
    }

    // Проверяем, не закрыл ли пользователь индикатор вручную
    const isManuallyClosed = localStorage.getItem('boostIndicatorClosed') === 'true';
    
    if (hasActiveBoost && boostData && !isManuallyClosed) {
        const expiresAt = new Date(boostData.expires_at);
        const timeLeft = expiresAt - new Date();
        const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));
        const minutesLeft = Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60)));
        
        boostIndicator.innerHTML = `
            <i class="fas fa-rocket"></i>
            <span>Буст +5 игроков</span>
            <small>(${hoursLeft}ч ${minutesLeft}м)</small>
            <i class="fas fa-times" style="margin-left: 5px; font-size: 0.8rem; opacity: 0.8;"></i>
        `;
        boostIndicator.style.display = 'flex';
        
        // Обновляем таймер каждую минуту
        setTimeout(() => updateBoostStatus(), 60000);
    } else {
        boostIndicator.style.display = 'none';
    }
}

function renderProducts(products) {
    if (!dom.shopProductsList) {
        console.error('shopProductsList not found');
        return;
    }

    if (products.length === 0) {
        dom.shopProductsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-store"></i>
                <p>Товаров пока нет</p>
            </div>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();

    products.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        if (product.product_type === 'unique_players_boost') {
            productCard.classList.add('boost-product');
        }
        productCard.dataset.productType = product.product_type;
        
        // Проверяем, доступен ли товар для покупки
        const isAvailable = product.is_active;
        const canAfford = state.currentUserProfile.coins >= product.price;
        
        // Особые условия для бустов
        let buttonClass, buttonText, disabled, specialInfo = '';
        
        if (product.product_type === 'unique_players_boost') {
            const hasActiveBoost = state.hasActiveUniquePlayersBoost;
            
            if (hasActiveBoost) {
                buttonClass = 'btn-disabled';
                buttonText = 'Буст активен';
                disabled = true;
                specialInfo = '<div style="color: var(--success); margin: 10px 0; padding: 10px; background: #e8f5e8; border-radius: 8px; border-left: 4px solid #4caf50;"><i class="fas fa-check-circle"></i> У вас уже активен буст уникальных игроков</div>';
            } else {
                buttonClass = canAfford ? 'btn-warning' : 'btn-disabled';
                buttonText = canAfford ? 'Купить и активировать' : 'Недостаточно монет';
                disabled = !canAfford;
                specialInfo = '<div style="color: var(--warning); margin: 10px 0; padding: 10px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;"><i class="fas fa-rocket"></i> +5 слотов для уникальных игроков на 24 часа</div>';
            }
        } else {
            buttonClass = isAvailable && canAfford ? 'btn-success' : 'btn-disabled';
            buttonText = isAvailable ? (canAfford ? 'Купить' : 'Недостаточно монет') : 'Недоступно';
            disabled = !(isAvailable && canAfford);
        }
        
        productCard.innerHTML = `
            <div class="product-image">
                <img src="${product.image_url}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/200x200?text=Товар'">
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-description">${product.description}</p>
                ${specialInfo}
                <div class="product-price">${product.price} монет</div>
                <div class="user-balance" style="margin-bottom: 10px; font-size: 0.9rem; color: var(--gray);">
                    Ваш баланс: ${state.currentUserProfile.coins} монет
                </div>
                <button class="${buttonClass} buy-product-btn" 
                        data-product-id="${product.id}" 
                        data-product-name="${product.name}" 
                        data-product-price="${product.price}"
                        data-product-type="${product.product_type}"
                        ${disabled ? 'disabled' : ''}>
                    <i class="fas ${product.product_type === 'unique_players_boost' ? 'fa-rocket' : 'fa-shopping-cart'}"></i> ${buttonText}
                </button>
            </div>
        `;
        fragment.appendChild(productCard);
    });

    dom.shopProductsList.innerHTML = '';
    dom.shopProductsList.appendChild(fragment);

    // Добавляем обработчики событий
    document.querySelectorAll('.buy-product-btn:not(:disabled)').forEach(btn => {
        btn.addEventListener('click', function() {
            const productId = this.dataset.productId;
            const productName = this.dataset.productName;
            const productPrice = parseInt(this.dataset.productPrice);
            const productType = this.dataset.productType;
            
            if (productType === 'unique_players_boost') {
                const confirmed = confirm(`Активировать буст "${productName}" за ${productPrice} монет? Вы получите +5 слотов для уникальных игроков на 24 часа.`);
                if (confirmed) {
                    purchaseAndActivateBoost(productId, productPrice);
                }
            } else {
                showBuyConfirmation(productId, productName, productPrice);
            }
        });
    });
}

// Функция для покупки и активации буста
async function purchaseAndActivateBoost(productId, price) {
    try {
        if (!state.supabase || !state.currentUserProfile) {
            throw new Error('Система не инициализирована');
        }

        console.log('🛒 Покупка буста уникальных игроков:', {
            productId,
            price,
            userId: state.currentUserProfile.id
        });

        // Используем RPC функцию для покупки и активации буста
        const { data: result, error } = await state.supabase.rpc('purchase_and_activate_boost', {
            p_user_id: state.currentUserProfile.id,
            p_product_id: productId
        });

        if (error) {
            console.error('RPC Error:', error);
            throw new Error('Ошибка покупки буста: ' + error.message);
        }

        if (result && result.success) {
            console.log('✅ RPC функция успешно выполнена:', result);
            alert('🎯 Буст уникальных игроков активирован! +5 слотов на 24 часа!');
            
            // Обновляем баланс пользователя
            await updateUserBalance();
            
            // Перезагружаем магазин для обновления кнопок
            await loadShop();
            
            // Ждем немного и принудительно проверяем статус буста
            console.log('🔄 Принудительная проверка статуса буста через 2 секунды...');
            setTimeout(async () => {
                await forceCheckBoostStatus();
            }, 2000);
            
        } else {
            throw new Error(result?.error || 'Неизвестная ошибка при покупке буста');
        }

    } catch (error) {
        console.error('Ошибка покупки буста:', error);
        alert('Ошибка: ' + error.message);
    }
}

// Функция для ручной активации буста (для админов)
async function manuallyActivateBoost(userId) {
    try {
        if (!state.supabase || !state.isAdmin) {
            throw new Error('Недостаточно прав');
        }

        const { data: result, error } = await state.supabase.rpc('manually_activate_boost', {
            p_user_id: userId,
            p_boost_type: 'unique_players',
            p_duration_hours: 24
        });

        if (error) {
            console.error('Ошибка ручной активации буста:', error);
            throw new Error('Ошибка активации: ' + error.message);
        }

        if (result && result.success) {
            console.log('✅ Буст успешно активирован вручную');
            return true;
        } else {
            throw new Error(result?.error || 'Неизвестная ошибка');
        }

    } catch (error) {
        console.error('Ошибка ручной активации буста:', error);
        throw error;
    }
}

function showBuyConfirmation(productId, productName, productPrice) {
    if (!state.currentUserProfile) {
        alert('Необходимо авторизоваться');
        return;
    }

    if (state.currentUserProfile.coins < productPrice) {
        alert(`Недостаточно монет! У вас ${state.currentUserProfile.coins} монет, требуется ${productPrice} монет.`);
        return;
    }

    const confirmed = confirm(`Вы уверены, что хотите купить "${productName}" за ${productPrice} монет?`);
    
    if (confirmed) {
        purchaseProduct(productId, productPrice);
    }
}

async function purchaseProduct(productId, price) {
    try {
        if (!state.supabase || !state.currentUserProfile) {
            throw new Error('Система не инициализирована');
        }

        console.log('Покупка товара:', {
            productId,
            price,
            userId: state.currentUserProfile.id,
            userCoins: state.currentUserProfile.coins
        });

        // Используем новую RPC функцию с передачей user_id
        const { data: result, error } = await state.supabase.rpc('purchase_product_with_user', {
            p_user_id: state.currentUserProfile.id,
            p_product_id: productId,
            p_quantity: 1
        });

        if (error) {
            console.error('RPC Error:', error);
            throw new Error('Ошибка покупки товара: ' + error.message);
        }

        if (result && result.success) {
            alert('Заказ успешно создан! Ожидайте подтверждения администратора.');
            
            // Обновляем баланс пользователя
            await updateUserBalance();
            
            // Перезагружаем историю заказов
            await loadOrderHistory();
            
            // Перезагружаем магазин для обновления кнопок (баланс изменился)
            await loadShop();
            
        } else {
            throw new Error(result?.error || 'Неизвестная ошибка при покупке');
        }

    } catch (error) {
        console.error('Ошибка покупки товара:', error);
        alert('Ошибка: ' + error.message);
    }
}

async function updateUserBalance() {
    try {
        const { data: profile, error } = await state.supabase
            .from('profiles')
            .select('coins')
            .eq('id', state.currentUserProfile.id)
            .single();

        if (error) {
            console.error('Ошибка обновления баланса:', error);
            return;
        }

        if (profile && dom.coinsValue) {
            dom.coinsValue.textContent = profile.coins;
            if (state.currentUserProfile) {
                state.currentUserProfile.coins = profile.coins;
            }
        }
    } catch (error) {
        console.error('Ошибка при обновления баланса:', error);
    }
}

export async function loadOrderHistory() {
    try {
        if (!state.supabase || !state.currentUserProfile) {
            return;
        }

        const { data: orders, error } = await state.supabase
            .from('orders')
            .select(`
                *,
                products:product_id (name, image_url, price)
            `)
            .eq('user_id', state.currentUserProfile.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Ошибка загрузки истории заказов:', error);
            return;
        }

        renderOrderHistory(orders);

    } catch (error) {
        console.error('Ошибка загрузки истории заказов:', error);
    }
}

function renderOrderHistory(orders) {
    if (!dom.shopOrderHistory) {
        console.error('shopOrderHistory not found');
        return;
    }

    if (orders.length === 0) {
        dom.shopOrderHistory.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-history"></i>
                <p>Нет заказов</p>
            </div>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();

    orders.forEach(order => {
        const orderItem = document.createElement('div');
        orderItem.className = 'order-item';
        
        const statusInfo = getStatusInfo(order.status);
        const totalAmount = order.total_amount || order.products.price * order.quantity;

        orderItem.innerHTML = `
            <div class="order-header">
                <div class="order-product-info">
                    <img src="${order.products.image_url}" alt="${order.products.name}" class="order-product-image">
                    <div>
                        <div class="order-product-name">${order.products.name}</div>
                        <div class="order-quantity">Количество: ${order.quantity}</div>
                    </div>
                </div>
                <div class="order-status ${statusInfo.class}">
                    ${statusInfo.text}
                </div>
            </div>
            <div class="order-details">
                <div class="order-amount">Сумма: ${totalAmount} монет</div>
                <div class="order-date">${new Date(order.created_at).toLocaleDateString('ru-RU')}</div>
                ${order.admin_notes ? `<div class="order-notes">Примечание: ${order.admin_notes}</div>` : ''}
            </div>
        `;
        
        fragment.appendChild(orderItem);
    });

    dom.shopOrderHistory.innerHTML = '';
    dom.shopOrderHistory.appendChild(fragment);
}

function getStatusInfo(status) {
    switch (status) {
        case 'pending':
            return { text: '⏳ Ожидает подтверждения', class: 'status-pending' };
        case 'confirmed':
            return { text: '✅ Подтвержден', class: 'status-confirmed' };
        case 'completed':
            return { text: '🎉 Выполнен', class: 'status-completed' };
        case 'cancelled':
            return { text: '❌ Отменен', class: 'status-cancelled' };
        default:
            return { text: status, class: '' };
    }
}

// Функции для админа
export async function loadAdminOrders() {
    try {
        console.log('🛠️ Loading admin orders...');
        
        if (!state.supabase || !state.currentUserProfile) {
            console.error('❌ Supabase or current user not initialized');
            return;
        }

        console.log('🛠️ Using global admin status:', state.isAdmin);
        
        if (!state.isAdmin) {
            console.log('👤 User is not admin, skipping admin orders');
            return;
        }

        console.log('🔧 User is admin, loading orders...');

        // Загружаем заказы с информацией о товарах (ИСПРАВЛЕННЫЙ ЗАПРОС)
        const { data: orders, error: ordersError } = await state.supabase
            .from('orders')
            .select(`
                *,
                products:product_id (name, image_url)
            `)
            .order('created_at', { ascending: false });

        if (ordersError) {
            console.error('❌ Ошибка загрузки заказов:', ordersError);
            return;
        }

        // Получаем все user_id из заказов
        const userIds = [...new Set(orders.map(order => order.user_id))];
        
        // Загружаем профили пользователей отдельным запросом
        const { data: profiles, error: profilesError } = await state.supabase
            .from('profiles')
            .select('id, username, class')
            .in('id', userIds);

        if (profilesError) {
            console.error('❌ Ошибка загрузки профилей:', profilesError);
            return;
        }

        // Создаем карту профилей для быстрого доступа
        const profilesMap = {};
        profiles.forEach(profile => {
            profilesMap[profile.id] = profile;
        });

        // Объединяем заказы с профилями
        const ordersWithProfiles = orders.map(order => ({
            ...order,
            user_profile: profilesMap[order.user_id] || { username: 'Неизвестный пользователь', class: 'Неизвестно' }
        }));

        console.log('🛠️ Admin orders loaded:', ordersWithProfiles);
        renderAdminOrders(ordersWithProfiles);

    } catch (error) {
        console.error('❌ Ошибка загрузки заказов для админа:', error);
    }
}

function renderAdminOrders(orders) {
    if (!dom.adminOrdersList) {
        console.error('adminOrdersList not found');
        return;
    }

    if (orders.length === 0) {
        dom.adminOrdersList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-list"></i>
                <p>Нет заказов</p>
            </div>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();

    orders.forEach(order => {
        const orderItem = document.createElement('div');
        orderItem.className = 'order-item admin-order-item';
        orderItem.dataset.orderId = order.id;
        
        const statusInfo = getStatusInfo(order.status);
        const totalAmount = order.total_amount;
        const userData = order.user_profile;
        const productData = order.products;

        // Определяем тип товара по названию (fallback метод)
        const isBoostProduct = productData.name && productData.name.toLowerCase().includes('буст');
        
        orderItem.innerHTML = `
            <div class="order-header">
                <div class="order-product-info">
                    <img src="${productData.image_url}" alt="${productData.name}" class="order-product-image" onerror="this.src='https://via.placeholder.com/50x50?text=Товар'">
                    <div>
                        <div class="order-product-name">${productData.name}</div>
                        <div class="order-user-info">От: ${userData.username} (${userData.class})</div>
                        <div class="order-quantity">Количество: ${order.quantity}</div>
                        ${isBoostProduct ? 
                            '<div style="color: #ff6b00; font-weight: bold;"><i class="fas fa-rocket"></i> Буст уникальных игроков</div>' : 
                            ''}
                    </div>
                </div>
                <div class="order-status ${statusInfo.class}">
                    ${statusInfo.text}
                </div>
            </div>
            <div class="order-details">
                <div class="order-amount">Сумма: ${totalAmount} монет</div>
                <div class="order-date">${new Date(order.created_at).toLocaleDateString('ru-RU')}</div>
                ${order.admin_notes ? `<div class="order-notes">Примечание: ${order.admin_notes}</div>` : ''}
            </div>
            ${order.status === 'pending' ? `
            <div class="admin-order-actions">
                <button class="btn-success confirm-order-btn" data-order-id="${order.id}">
                    <i class="fas fa-check"></i> Подтвердить
                </button>
                <button class="btn-danger cancel-order-btn" data-order-id="${order.id}">
                    <i class="fas fa-times"></i> Отменить
                </button>
                <button class="btn-outline complete-order-btn" data-order-id="${order.id}">
                    <i class="fas fa-box"></i> Выполнен
                </button>
            </div>
            ` : ''}
            ${order.status === 'confirmed' ? `
            <div class="admin-order-actions">
                <button class="btn-success complete-order-btn" data-order-id="${order.id}">
                    <i class="fas fa-box"></i> Отметить выполненным
                </button>
                <button class="btn-danger cancel-order-btn" data-order-id="${order.id}">
                    <i class="fas fa-times"></i> Отменить
                </button>
            </div>
            ` : ''}
        `;
        
        fragment.appendChild(orderItem);
    });

    dom.adminOrdersList.innerHTML = '';
    dom.adminOrdersList.appendChild(fragment);

    // Добавляем обработчики событий для кнопок админа
    document.querySelectorAll('.confirm-order-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const orderId = this.dataset.orderId;
            updateOrderStatus(orderId, 'confirmed');
        });
    });

    document.querySelectorAll('.cancel-order-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const orderId = this.dataset.orderId;
            updateOrderStatus(orderId, 'cancelled');
        });
    });

    document.querySelectorAll('.complete-order-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const orderId = this.dataset.orderId;
            updateOrderStatus(orderId, 'completed');
        });
    });
}

async function updateOrderStatus(orderId, status) {
    try {
        if (!state.supabase) {
            throw new Error('Supabase not initialized');
        }

        let adminNotes = '';
        if (status === 'cancelled') {
            adminNotes = prompt('Укажите причину отмены заказа:');
            if (adminNotes === null) return; // пользователь отменил
        }

        // Получаем данные заказа перед обновлением (ИСПРАВЛЕННЫЙ ЗАПРОС)
        const { data: order, error: orderError } = await state.supabase
            .from('orders')
            .select(`
                user_id, 
                total_amount, 
                status,
                product_id,
                products:product_id (name)
            `)
            .eq('id', orderId)
            .single();

        if (orderError) {
            throw orderError;
        }

        console.log(`🛠️ Updating order ${orderId} from ${order.status} to ${status}`);

        // Определяем тип товара по названию
        const isBoostProduct = order.products.name && order.products.name.toLowerCase().includes('буст');
        
        // Если это заказ на буст и статус меняется на confirmed/completed - активируем буст
        if ((status === 'confirmed' || status === 'completed') && isBoostProduct) {
            console.log('🚀 Активируем буст для пользователя:', order.user_id);
            
            try {
                await manuallyActivateBoost(order.user_id);
                adminNotes = (adminNotes || '') + ' Буст активирован автоматически.';
            } catch (boostError) {
                console.error('Ошибка активации буста:', boostError);
                adminNotes = (adminNotes || '') + ' Ошибка активации буста: ' + boostError.message;
            }
        }

        // Если отменяем заказ - возвращаем деньги
        if (status === 'cancelled' && order.status !== 'cancelled') {
            console.log(`💰 Returning ${order.total_amount} coins to user ${order.user_id}`);
            
            const { error: refundError } = await state.supabase
                .from('profiles')
                .update({ coins: state.supabase.raw('coins + ?', order.total_amount) })
                .eq('id', order.user_id);

            if (refundError) {
                console.error('❌ Refund error:', refundError);
                throw refundError;
            }
        }

        // Обновляем статус заказа
        const { error } = await state.supabase
            .from('orders')
            .update({ 
                status: status,
                admin_notes: adminNotes || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        if (error) {
            throw error;
        }

        alert(`✅ Статус заказа обновлен на: ${getStatusInfo(status).text}`);
        
        // Перезагружаем списки заказов
        await loadAdminOrders();
        
        // Обновляем историю заказов пользователя если она открыта
        if (dom.shopOrderHistory && dom.shopOrderHistory.innerHTML !== '') {
            await loadOrderHistory();
        }

        // Обновляем баланс если нужно
        if (status === 'cancelled') {
            await updateUserBalance();
        }

    } catch (error) {
        console.error('❌ Ошибка обновления статуса заказа:', error);
        alert('❌ Ошибка: ' + error.message);
    }
}
