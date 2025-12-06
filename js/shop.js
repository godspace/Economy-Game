// shop.js - модуль магазина и покупок
class ShopManager {
    constructor() {
        this.items = [
            {
                id: 'baunty',
                name: 'Baunty',
                description: 'Сладкий приз за успехи в игре',
                price: 99,
                icon: 'redeem',
                color: '#FF9800'
            }
        ];
        
        this.purchaseHistory = [];
        this.initEventListeners();
    }

    // Инициализация обработчиков событий
    initEventListeners() {
        // Обработчики покупки
        document.addEventListener('click', (e) => {
            const buyBtn = e.target.closest('.buy-btn');
            if (buyBtn) {
                const itemId = buyBtn.dataset.item;
                this.purchaseItem(itemId);
            }
        });

        // Обновление баланса при переключении на вкладку магазина
        document.querySelector('.tab-btn[data-tab="shop"]').addEventListener('click', () => {
            this.updateShopBalance();
            this.loadPurchaseHistory();
        });
    }

    // Обновление баланса в магазине
    updateShopBalance() {
        if (!authManager.currentUser) return;
        
        const shopBalanceEl = document.getElementById('shop-balance');
        if (shopBalanceEl) {
            shopBalanceEl.textContent = authManager.currentUser.coins;
        }

        // Обновляем состояние кнопок покупки
        this.updateBuyButtons();
    }

    // Обновление состояния кнопок покупки
    updateBuyButtons() {
        if (!authManager.currentUser) return;

        const bauntyItem = this.items.find(item => item.id === 'baunty');
        const buyBtn = document.querySelector('.buy-btn[data-item="baunty"]');
        
        if (buyBtn && bauntyItem) {
            const hasEnoughCoins = authManager.currentUser.coins >= bauntyItem.price;
            
            buyBtn.disabled = !hasEnoughCoins;
            buyBtn.innerHTML = hasEnoughCoins ? 
                `Купить за ${bauntyItem.price} <span class="material-icons">monetization_on</span>` :
                `Недостаточно монет`;
            
            // Проверяем, не куплен ли уже Baunty сегодня
            this.checkRecentPurchase();
        }
    }

    // Проверка недавних покупок
    async checkRecentPurchase() {
        if (!authManager.currentUser) return;

        try {
            const today = new Date().toISOString().split('T')[0];
            
            const { data: recentPurchase, error } = await supabase
                .from('orders')
                .select('id')
                .eq('profile_id', authManager.currentUser.id)
                .eq('item_name', 'Baunty')
                .gte('created_at', today)
                .limit(1);

            if (error) throw error;

            const buyBtn = document.querySelector('.buy-btn[data-item="baunty"]');
            if (buyBtn && recentPurchase && recentPurchase.length > 0) {
                buyBtn.disabled = true;
                buyBtn.innerHTML = 'Уже куплено сегодня';
            }

        } catch (error) {
            console.error('Ошибка проверки покупок:', error);
        }
    }

    // Покупка предмета
    async purchaseItem(itemId) {
        if (!authManager.currentUser || !authManager.canPerformAction()) {
            return;
        }

        // Находим предмет
        const item = this.items.find(i => i.id === itemId);
        if (!item) {
            authManager.showToast('Предмет не найден', 'error');
            return;
        }

        // Проверяем баланс
        if (authManager.currentUser.coins < item.price) {
            authManager.showToast(`Недостаточно монет. Нужно ${item.price}`, 'warning');
            return;
        }

        // Подтверждение покупки
        if (!await this.confirmPurchase(item)) {
            return;
        }

        authManager.showLoader(true);

        try {
            // Генерируем хеш для транзакции
            const transactionHash = this.generateTransactionHash(
                authManager.currentUser.id,
                item.price,
                `purchase_${itemId}`
            );

            // Начинаем транзакцию
            const { data: transaction, error: transactionError } = await supabase
                .from('transactions')
                .insert({
                    profile_id: authManager.currentUser.id,
                    amount: -item.price, // Отрицательная сумма для списания
                    type: 'purchase',
                    hash: transactionHash,
                    details: { item_id: itemId, item_name: item.name }
                })
                .select()
                .single();

            if (transactionError) throw transactionError;

            // Создаем заказ
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    profile_id: authManager.currentUser.id,
                    item_name: item.name,
                    status: 'pending'
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // Обновляем баланс пользователя
            const newCoins = authManager.currentUser.coins - item.price;
            await supabase
                .from('profiles')
                .update({ coins: newCoins })
                .eq('id', authManager.currentUser.id);

            // Обновляем текущего пользователя
            authManager.currentUser.coins = newCoins;

            // Логируем активность
            await authManager.logActivity('purchase_item', {
                item_id: itemId,
                item_name: item.name,
                price: item.price,
                order_id: order.id,
                transaction_id: transaction.id
            });

            // Показываем уведомление
            authManager.showToast(`Вы купили ${item.name}! Ожидайте подтверждения.`, 'success');

            // Обновляем UI
            this.updateShopBalance();
            this.loadPurchaseHistory();
            
            if (window.appManager) {
                appManager.updateCoinsDisplay(newCoins);
            }

            // Показываем чек покупки
            this.showReceipt(item, order);

        } catch (error) {
            console.error('Ошибка покупки:', error);
            authManager.showToast('Ошибка при покупке. Попробуйте снова.', 'error');
        } finally {
            authManager.showLoader(false);
        }
    }

    // Подтверждение покупки
    async confirmPurchase(item) {
        return new Promise((resolve) => {
            // Создаем модальное окно подтверждения
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 400px;">
                    <div class="confirm-header" style="text-align: center; padding: 1rem 0;">
                        <div class="item-icon-large" style="background: ${item.color}; width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center;">
                            <span class="material-icons" style="font-size: 2.5rem; color: white;">${item.icon}</span>
                        </div>
                        <h3 style="margin-bottom: 0.5rem;">Купить ${item.name}?</h3>
                        <p style="color: #666;">${item.description}</p>
                    </div>
                    
                    <div class="confirm-details" style="background: #f9f9f9; padding: 1rem; border-radius: 10px; margin: 1rem 0;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <span>Стоимость:</span>
                            <span style="font-weight: bold; color: #FF9800;">
                                ${item.price} <span class="material-icons" style="font-size: 1rem; vertical-align: middle;">monetization_on</span>
                            </span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <span>Ваш баланс:</span>
                            <span>${authManager.currentUser.coins} монет</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-weight: bold; border-top: 1px solid #ddd; padding-top: 0.5rem;">
                            <span>Останется:</span>
                            <span style="color: ${authManager.currentUser.coins - item.price >= 0 ? '#4CAF50' : '#F44336'}">
                                ${authManager.currentUser.coins - item.price} монет
                            </span>
                        </div>
                    </div>
                    
                    <div class="confirm-buttons" style="display: flex; gap: 1rem;">
                        <button id="cancel-purchase" class="secondary-btn" style="flex: 1; background: #9E9E9E;">
                            Отмена
                        </button>
                        <button id="confirm-purchase" class="secondary-btn" style="flex: 1; background: #4CAF50;">
                            Купить
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Обработчики
            document.getElementById('cancel-purchase').addEventListener('click', () => {
                modal.remove();
                resolve(false);
            });

            document.getElementById('confirm-purchase').addEventListener('click', () => {
                modal.remove();
                resolve(true);
            });

            // Закрытие по клику вне модального окна
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                    resolve(false);
                }
            });
        });
    }

    // Показать чек покупки
    showReceipt(item, order) {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="receipt-header" style="text-align: center; padding: 1rem 0; border-bottom: 2px solid #4CAF50;">
                    <div style="color: #4CAF50; font-size: 2rem; margin-bottom: 0.5rem;">
                        <span class="material-icons">check_circle</span>
                    </div>
                    <h3 style="margin-bottom: 0.5rem; color: #4CAF50;">Покупка успешна!</h3>
                    <p style="color: #666;">Номер заказа: #${order.id.toString().padStart(6, '0')}</p>
                </div>
                
                <div class="receipt-details" style="padding: 1rem 0;">
                    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; padding: 1rem; background: #f9f9f9; border-radius: 10px;">
                        <div class="item-icon" style="background: ${item.color}; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                            <span class="material-icons" style="font-size: 1.5rem; color: white;">${item.icon}</span>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: bold;">${item.name}</div>
                            <div style="font-size: 0.9rem; color: #666;">${item.description}</div>
                        </div>
                        <div style="font-weight: bold; color: #FF9800;">
                            ${item.price} <span class="material-icons" style="font-size: 1rem; vertical-align: middle;">monetization_on</span>
                        </div>
                    </div>
                    
                    <div style="background: #f0f8ff; padding: 1rem; border-radius: 10px; margin-bottom: 1rem;">
                        <h4 style="margin-bottom: 0.5rem; color: #2196F3;">Информация о заказе</h4>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                            <span>Дата покупки:</span>
                            <span>${new Date().toLocaleString('ru-RU')}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                            <span>Статус:</span>
                            <span style="color: #FF9800; font-weight: bold;">Ожидает подтверждения</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Заказчик:</span>
                            <span>${authManager.currentUser.fullName}</span>
                        </div>
                    </div>
                    
                    <div style="background: #FFF8E1; padding: 1rem; border-radius: 10px; border-left: 4px solid #FFC107;">
                        <div style="display: flex; align-items: flex-start; gap: 0.5rem;">
                            <span class="material-icons" style="color: #FF9800;">info</span>
                            <div style="font-size: 0.9rem;">
                                <strong>Важно:</strong> После подтверждения админом вы получите уведомление. 
                                Забирайте ваш Baunty у ответственного лица.
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="receipt-footer" style="text-align: center; padding-top: 1rem; border-top: 1px solid #eee;">
                    <button id="close-receipt" class="secondary-btn" style="background: #2196F3; width: 100%;">
                        Понятно
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Обработчик закрытия
        document.getElementById('close-receipt').addEventListener('click', () => {
            modal.remove();
        });

        // Закрытие по клику вне модального окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // Загрузка истории покупок
    async loadPurchaseHistory() {
        if (!authManager.currentUser) return;

        const purchasesList = document.getElementById('purchases-list');
        if (!purchasesList) return;

        try {
            const { data: purchases, error } = await supabase
                .from('orders')
                .select('*')
                .eq('profile_id', authManager.currentUser.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;

            this.purchaseHistory = purchases || [];
            this.renderPurchaseHistory();

        } catch (error) {
            console.error('Ошибка загрузки истории покупок:', error);
            purchasesList.innerHTML = '<div class="empty-state"><span class="material-icons">error</span><p>Ошибка загрузки истории</p></div>';
        }
    }

    // Отрисовка истории покупок
    renderPurchaseHistory() {
        const purchasesList = document.getElementById('purchases-list');
        if (!purchasesList) return;

        if (this.purchaseHistory.length === 0) {
            purchasesList.innerHTML = '<div class="empty-state"><span class="material-icons">shopping_basket</span><p>У вас пока нет покупок</p></div>';
            return;
        }

        purchasesList.innerHTML = this.purchaseHistory.map(order => {
            const item = this.items.find(i => i.name === order.item_name);
            const date = new Date(order.created_at).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            let statusText = '';
            let statusClass = '';
            
            switch (order.status) {
                case 'pending':
                    statusText = 'Ожидает';
                    statusClass = 'pending';
                    break;
                case 'confirmed':
                    statusText = 'Подтвержден';
                    statusClass = 'confirmed';
                    break;
                case 'cancelled':
                    statusText = 'Отменен';
                    statusClass = 'cancelled';
                    break;
                default:
                    statusText = order.status;
                    statusClass = 'unknown';
            }

            return `
                <div class="purchase-card ${statusClass}">
                    <div class="purchase-header">
                        <div class="purchase-item">
                            <div class="purchase-icon" style="background: ${item ? item.color : '#9E9E9E'};">
                                <span class="material-icons">${item ? item.icon : 'shopping_bag'}</span>
                            </div>
                            <div class="purchase-info">
                                <div class="purchase-name">${order.item_name}</div>
                                <div class="purchase-date">${date}</div>
                            </div>
                        </div>
                        <div class="purchase-status ${statusClass}">
                            ${statusText}
                        </div>
                    </div>
                    <div class="purchase-details">
                        <div class="order-id">Заказ #${order.id.toString().padStart(6, '0')}</div>
                        ${order.status === 'confirmed' ? 
                            `<div class="confirmation-info">
                                <span class="material-icons" style="font-size: 1rem;">verified</span>
                                Готов к выдаче
                            </div>` : 
                            ''
                        }
                    </div>
                </div>
            `;
        }).join('');
    }

    // Генерация хеша для транзакции
    generateTransactionHash(profileId, amount, type) {
        const timestamp = Date.now();
        const data = `${profileId}-${amount}-${type}-${timestamp}-${Math.random()}`;
        return this.sha256(data);
    }

    // Простая имитация SHA-256
    sha256(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(64, '0');
    }

    // Получение статистики покупок
    async getPurchaseStats() {
        if (!authManager.currentUser) return null;

        try {
            const { data: purchases, error } = await supabase
                .from('orders')
                .select('status, created_at')
                .eq('profile_id', authManager.currentUser.id);

            if (error) throw error;

            const stats = {
                total: purchases.length,
                pending: purchases.filter(p => p.status === 'pending').length,
                confirmed: purchases.filter(p => p.status === 'confirmed').length,
                cancelled: purchases.filter(p => p.status === 'cancelled').length,
                lastPurchase: purchases.length > 0 ? new Date(purchases[0].created_at) : null
            };

            return stats;

        } catch (error) {
            console.error('Ошибка получения статистики покупок:', error);
            return null;
        }
    }

    // Проверка, можно ли купить предмет сегодня
    async canPurchaseToday(itemId) {
        if (!authManager.currentUser) return false;

        const item = this.items.find(i => i.id === itemId);
        if (!item) return false;

        try {
            const today = new Date().toISOString().split('T')[0];
            
            const { data: recentPurchase, error } = await supabase
                .from('orders')
                .select('id')
                .eq('profile_id', authManager.currentUser.id)
                .eq('item_name', item.name)
                .gte('created_at', today)
                .limit(1);

            if (error) throw error;

            return !(recentPurchase && recentPurchase.length > 0);

        } catch (error) {
            console.error('Ошибка проверки возможности покупки:', error);
            return false;
        }
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    window.shopManager = new ShopManager();
    
    // Инициализируем магазин, если пользователь авторизован
    if (authManager && authManager.currentUser) {
        shopManager.updateShopBalance();
        shopManager.loadPurchaseHistory();
    }
});