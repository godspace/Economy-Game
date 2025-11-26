import { state, dom } from './config.js';

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
        
        // Проверяем, доступен ли товар для покупки
        const isAvailable = product.is_active;
        const canAfford = state.currentUserProfile.coins >= product.price;
        const buttonClass = isAvailable && canAfford ? 'btn-success' : 'btn-disabled';
        const buttonText = isAvailable ? (canAfford ? 'Купить' : 'Недостаточно монет') : 'Недоступно';
        
        productCard.innerHTML = `
            <div class="product-image">
                <img src="${product.image_url}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/200x200?text=Товар'">
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-description">${product.description}</p>
                <div class="product-price">${product.price} монет</div>
                <div class="user-balance" style="margin-bottom: 10px; font-size: 0.9rem; color: var(--gray);">
                    Ваш баланс: ${state.currentUserProfile.coins} монет
                </div>
                <button class="${buttonClass} buy-product-btn" 
                        data-product-id="${product.id}" 
                        data-product-name="${product.name}" 
                        data-product-price="${product.price}"
                        ${(isAvailable && canAfford) ? '' : 'disabled'}>
                    <i class="fas fa-shopping-cart"></i> ${buttonText}
                </button>
            </div>
        `;
        fragment.appendChild(productCard);
    });

    dom.shopProductsList.innerHTML = '';
    dom.shopProductsList.appendChild(fragment);

    // Добавляем обработчики событий только для доступных товаров
    document.querySelectorAll('.buy-product-btn:not(:disabled)').forEach(btn => {
        btn.addEventListener('click', function() {
            const productId = this.dataset.productId;
            const productName = this.dataset.productName;
            const productPrice = parseInt(this.dataset.productPrice);
            showBuyConfirmation(productId, productName, productPrice);
        });
    });
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
        console.error('Ошибка при обновлении баланса:', error);
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

        // Загружаем заказы с информацией о товарах
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

        orderItem.innerHTML = `
            <div class="order-header">
                <div class="order-product-info">
                    <img src="${productData.image_url}" alt="${productData.name}" class="order-product-image" onerror="this.src='https://via.placeholder.com/50x50?text=Товар'">
                    <div>
                        <div class="order-product-name">${productData.name}</div>
                        <div class="order-user-info">От: ${userData.username} (${userData.class})</div>
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

        // Получаем данные заказа перед обновлением
        const { data: order, error: orderError } = await state.supabase
            .from('orders')
            .select('user_id, total_amount, status')
            .eq('id', orderId)
            .single();

        if (orderError) {
            throw orderError;
        }

        console.log(`🛠️ Updating order ${orderId} from ${order.status} to ${status}`);

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