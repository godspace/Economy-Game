// shop.js
import { state, dom } from './config.js';

export async function loadShop() {
    try {
        console.log('Loading shop...');
        
        if (!state.supabase || !state.isAuthenticated || !state.currentUserProfile) {
            console.error('Supabase or authentication not initialized');
            return;
        }

        // Загружаем товары
        const { data: products, error: productsError } = await state.supabase
            .from('products')
            .select('*')
            .eq('is_active', true);

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
        const buttonClass = isAvailable ? 'btn-success' : 'btn-disabled';
        const buttonText = isAvailable ? 'Купить' : 'Недоступно';
        
        productCard.innerHTML = `
            <div class="product-image">
                <img src="${product.image_url}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/200x200?text=Товар'">
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-description">${product.description}</p>
                <div class="product-price">${product.price} монет</div>
                <button class="${buttonClass} buy-product-btn" 
                        data-product-id="${product.id}" 
                        data-product-name="${product.name}" 
                        data-product-price="${product.price}"
                        ${isAvailable ? '' : 'disabled'}>
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
        if (!state.supabase || !state.currentUser) {
            throw new Error('Система не инициализирована');
        }

        // Используем RPC функцию для атомарной покупки
        const { data: result, error } = await state.supabase.rpc('purchase_product', {
            p_product_id: productId,
            p_quantity: 1
        });

        if (error) {
            throw error;
        }

        if (result && result.success) {
            alert('Заказ успешно создан! Ожидайте подтверждения администратора.');
            
            // Обновляем баланс пользователя
            await updateUserBalance();
            
            // Перезагружаем историю заказов
            await loadOrderHistory();
            
        } else {
            throw new Error(result.message || 'Неизвестная ошибка при покупке');
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
            .eq('id', state.currentUser.id)
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
        if (!state.supabase || !state.currentUser) {
            return;
        }

        const { data: orders, error } = await state.supabase
            .from('orders')
            .select(`
                *,
                products:product_id (name, image_url, price)
            `)
            .eq('user_id', state.currentUser.id)
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
        console.log('Loading admin orders...');
        
        if (!state.supabase || !state.currentUser) {
            console.error('Supabase or current user not initialized');
            return;
        }

        // Проверяем, является ли пользователь админом
        if (state.currentUser.id !== 'e22b418b-4abb-44fa-a9e0-2f92b1386a8b') {
            console.log('User is not admin, hiding admin tab');
            if (dom.adminOrdersTab) {
                dom.adminOrdersTab.style.display = 'none';
            }
            return;
        }

        console.log('User is admin, loading orders...');

        const { data: orders, error } = await state.supabase
            .from('orders')
            .select(`
                *,
                products:product_id (name, image_url),
                profiles:user_id (username, class)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Ошибка загрузки заказов для админа:', error);
            return;
        }

        console.log('Admin orders loaded:', orders);

        renderAdminOrders(orders);

    } catch (error) {
        console.error('Ошибка загрузки заказов для админа:', error);
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

        orderItem.innerHTML = `
            <div class="order-header">
                <div class="order-product-info">
                    <img src="${order.products.image_url}" alt="${order.products.name}" class="order-product-image">
                    <div>
                        <div class="order-product-name">${order.products.name}</div>
                        <div class="order-user-info">От: ${order.profiles.username} (${order.profiles.class})</div>
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

        alert(`Статус заказа обновлен на: ${getStatusInfo(status).text}`);
        
        // Перезагружаем списки заказов
        await loadAdminOrders();
        
        // Если пользователь смотрит свою историю заказов, обновляем и её
        if (dom.shopOrderHistory && dom.shopOrderHistory.innerHTML !== '') {
            await loadOrderHistory();
        }

    } catch (error) {
        console.error('Ошибка обновления статуса заказа:', error);
        alert('Ошибка: ' + error.message);
    }
}
