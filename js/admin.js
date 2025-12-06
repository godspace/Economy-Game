// admin.js - модуль администрирования для управления заказами
class AdminManager {
    constructor() {
        this.isAdmin = false;
        this.orders = [];
        this.currentStatusFilter = 'pending';
        this.initEventListeners();
        this.checkAdminStatus();
    }

    // Инициализация обработчиков событий
    initEventListeners() {
        // Фильтр по статусу заказов
        const statusFilter = document.getElementById('order-status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.currentStatusFilter = e.target.value;
                this.renderOrders();
            });
        }

        // Обработчик кликов по заказам (делегирование)
        document.addEventListener('click', (e) => {
            const orderCard = e.target.closest('.order-card');
            if (orderCard) {
                const orderId = orderCard.dataset.orderId;
                const order = this.orders.find(o => o.id == orderId);
                if (order) {
                    this.showOrderDetails(order);
                }
            }

            // Кнопки действий
            if (e.target.closest('.confirm-order-btn')) {
                e.stopPropagation();
                const orderId = e.target.closest('.confirm-order-btn').dataset.orderId;
                this.confirmOrder(orderId);
            }

            if (e.target.closest('.cancel-order-btn')) {
                e.stopPropagation();
                const orderId = e.target.closest('.cancel-order-btn').dataset.orderId;
                this.cancelOrder(orderId);
            }
        });

        // Обновление списка заказов
        document.querySelector('.tab-btn[data-tab="orders"]')?.addEventListener('click', () => {
            if (this.isAdmin) {
                this.loadOrders();
            }
        });
    }

    // Проверка статуса администратора
    checkAdminStatus() {
        if (!authManager.currentUser) return;

        // Простая проверка по коду (можно расширить)
        const adminCodes = ['000000', '999999'];
        this.isAdmin = adminCodes.includes(authManager.currentUser.code);

        if (this.isAdmin) {
            console.log('Пользователь является администратором');
            // Показываем вкладку "Заказы"
            const ordersTabBtn = document.querySelector('.tab-btn[data-tab="orders"]');
            if (ordersTabBtn) {
                ordersTabBtn.style.display = 'flex';
            }
        }
    }

    // Загрузка заказов
    async loadOrders() {
        if (!this.isAdmin) {
            this.showAdminError();
            return;
        }

        const ordersList = document.getElementById('orders-list');
        if (!ordersList) return;

        ordersList.innerHTML = '<div class="loading-indicator"><span class="material-icons">refresh</span><p>Загрузка заказов...</p></div>';

        try {
            let query = supabase
                .from('orders')
                .select(`
                    id,
                    profile_id,
                    item_name,
                    status,
                    notes,
                    confirmed_by,
                    confirmed_at,
                    created_at,
                    profiles!inner (
                        coins,
                        students (
                            id,
                            class,
                            last_name,
                            first_name
                        )
                    )
                `)
                .order('created_at', { ascending: false });

            // Применяем фильтр
            if (this.currentStatusFilter !== 'all') {
                query = query.eq('status', this.currentStatusFilter);
            }

            const { data: orders, error } = await query;

            if (error) throw error;

            // Преобразуем данные
            this.orders = orders.map(order => ({
                id: order.id,
                profileId: order.profile_id,
                itemName: order.item_name,
                status: order.status,
                notes: order.notes || '',
                confirmedBy: order.confirmed_by,
                confirmedAt: order.confirmed_at,
                createdAt: order.created_at,
                student: {
                    id: order.profiles.students.id,
                    class: order.profiles.students.class,
                    lastName: order.profiles.students.last_name,
                    firstName: order.profiles.students.first_name,
                    fullName: `${order.profiles.students.last_name} ${order.profiles.students.first_name}`,
                    coins: order.profiles.coins
                }
            }));

            this.renderOrders();
            this.updateOrdersStats();

        } catch (error) {
            console.error('Ошибка загрузки заказов:', error);
            ordersList.innerHTML = '<div class="empty-state"><span class="material-icons">error</span><p>Ошибка загрузки заказов</p></div>';
        }
    }

    // Отрисовка списка заказов
    renderOrders() {
        const ordersList = document.getElementById('orders-list');
        if (!ordersList) return;

        // Фильтрация
        let filteredOrders = [...this.orders];
        if (this.currentStatusFilter !== 'all') {
            filteredOrders = filteredOrders.filter(order => order.status === this.currentStatusFilter);
        }

        if (filteredOrders.length === 0) {
            ordersList.innerHTML = '<div class="empty-state"><span class="material-icons">inventory_2</span><p>Нет заказов</p></div>';
            return;
        }

        // Генерируем HTML
        ordersList.innerHTML = filteredOrders.map(order => {
            const date = new Date(order.createdAt).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });

            let statusClass = '';
            let statusText = '';
            let actions = '';

            switch (order.status) {
                case 'pending':
                    statusClass = 'pending';
                    statusText = 'Ожидает';
                    actions = `
                        <button class="confirm-order-btn" data-order-id="${order.id}">
                            <span class="material-icons">check</span>
                            Подтвердить
                        </button>
                        <button class="cancel-order-btn" data-order-id="${order.id}">
                            <span class="material-icons">close</span>
                            Отменить
                        </button>
                    `;
                    break;
                case 'confirmed':
                    statusClass = 'confirmed';
                    statusText = 'Подтвержден';
                    actions = `
                        <div class="confirmed-info">
                            <span class="material-icons">verified</span>
                            Выдан
                        </div>
                    `;
                    break;
                case 'cancelled':
                    statusClass = 'cancelled';
                    statusText = 'Отменен';
                    actions = `
                        <div class="cancelled-info">
                            <span class="material-icons">block</span>
                            Отменен
                        </div>
                    `;
                    break;
            }

            return `
                <div class="order-card ${statusClass}" data-order-id="${order.id}">
                    <div class="order-header">
                        <div class="order-student">
                            <div class="student-avatar" style="background-color: ${MATERIAL_COLORS[order.student.id % MATERIAL_COLORS.length]}">
                                ${order.student.firstName.charAt(0)}
                            </div>
                            <div class="student-info">
                                <div class="student-name">${order.student.fullName}</div>
                                <div class="student-class">${order.student.class} класс</div>
                            </div>
                        </div>
                        <div class="order-status ${statusClass}">
                            ${statusText}
                        </div>
                    </div>
                    
                    <div class="order-details">
                        <div class="order-item">
                            <span class="material-icons">redeem</span>
                            <span>${order.itemName}</span>
                        </div>
                        <div class="order-date">
                            <span class="material-icons">schedule</span>
                            <span>${date}</span>
                        </div>
                    </div>
                    
                    <div class="order-actions">
                        ${actions}
                    </div>
                    
                    ${order.notes ? `
                        <div class="order-notes">
                            <span class="material-icons">notes</span>
                            <span>${order.notes}</span>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    // Показ деталей заказа
    async showOrderDetails(order) {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        
        const student = order.student;
        const orderDate = new Date(order.createdAt).toLocaleString('ru-RU');
        const confirmedDate = order.confirmedAt ? 
            new Date(order.confirmedAt).toLocaleString('ru-RU') : 'Не подтвержден';

        let statusInfo = '';
        if (order.status === 'confirmed' && order.confirmedBy) {
            // Получаем информацию о подтвердившем админе
            const { data: adminData } = await supabase
                .from('students')
                .select('last_name, first_name')
                .eq('id', order.confirmedBy)
                .single();

            if (adminData) {
                statusInfo = `Подтвердил: ${adminData.last_name} ${adminData.first_name}`;
            }
        }

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 450px;">
                <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="margin: 0;">Заказ #${order.id.toString().padStart(6, '0')}</h3>
                    <button id="close-order-modal" class="icon-btn">
                        <span class="material-icons">close</span>
                    </button>
                </div>
                
                <div class="order-detail-section">
                    <h4 style="margin-bottom: 0.5rem; color: #666;">Информация о ученике</h4>
                    <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: #f5f5f5; border-radius: 10px;">
                        <div class="student-avatar-large" style="background-color: ${MATERIAL_COLORS[student.id % MATERIAL_COLORS.length]}; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; font-weight: bold;">
                            ${student.firstName.charAt(0)}
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: bold; font-size: 1.1rem;">${student.fullName}</div>
                            <div style="color: #666;">${student.class} класс</div>
                            <div style="font-size: 0.9rem; color: #888;">Баланс: ${student.coins} монет</div>
                        </div>
                    </div>
                </div>
                
                <div class="order-detail-section">
                    <h4 style="margin-bottom: 0.5rem; color: #666;">Детали заказа</h4>
                    <div style="padding: 1rem; background: #fff8e1; border-radius: 10px;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <span class="material-icons" style="color: #FF9800;">redeem</span>
                            <span style="font-weight: bold;">${order.itemName}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                            <span>Дата заказа:</span>
                            <span>${orderDate}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                            <span>Статус:</span>
                            <span class="order-status-badge ${order.status}">${this.getStatusText(order.status)}</span>
                        </div>
                        ${order.confirmedAt ? `
                            <div style="display: flex; justify-content: space-between;">
                                <span>Подтвержден:</span>
                                <span>${confirmedDate}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                ${order.notes ? `
                    <div class="order-detail-section">
                        <h4 style="margin-bottom: 0.5rem; color: #666;">Заметки</h4>
                        <div style="padding: 1rem; background: #e3f2fd; border-radius: 10px;">
                            ${order.notes}
                        </div>
                    </div>
                ` : ''}
                
                ${statusInfo ? `
                    <div class="order-detail-section">
                        <div style="padding: 1rem; background: #e8f5e9; border-radius: 10px; text-align: center; color: #2e7d32;">
                            <span class="material-icons">verified_user</span>
                            ${statusInfo}
                        </div>
                    </div>
                ` : ''}
                
                ${order.status === 'pending' ? `
                    <div class="order-detail-section" style="margin-top: 1.5rem;">
                        <div style="display: flex; gap: 1rem;">
                            <button id="detail-confirm-order" class="secondary-btn" style="flex: 1; background: #4CAF50;">
                                <span class="material-icons">check</span>
                                Подтвердить выдачу
                            </button>
                            <button id="detail-cancel-order" class="secondary-btn" style="flex: 1; background: #f44336;">
                                <span class="material-icons">close</span>
                                Отменить заказ
                            </button>
                        </div>
                        <div style="margin-top: 1rem;">
                            <textarea id="order-notes-input" placeholder="Добавить заметку..." style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 5px; resize: vertical; min-height: 60px;"></textarea>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        document.body.appendChild(modal);

        // Обработчики
        document.getElementById('close-order-modal').addEventListener('click', () => {
            modal.remove();
        });

        if (order.status === 'pending') {
            document.getElementById('detail-confirm-order').addEventListener('click', async () => {
                const notes = document.getElementById('order-notes-input').value;
                await this.confirmOrder(order.id, notes);
                modal.remove();
            });

            document.getElementById('detail-cancel-order').addEventListener('click', async () => {
                const notes = document.getElementById('order-notes-input').value;
                await this.cancelOrder(order.id, notes);
                modal.remove();
            });
        }

        // Закрытие по клику вне модального окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // Подтверждение заказа
    async confirmOrder(orderId, notes = '') {
        if (!this.isAdmin) {
            authManager.showToast('У вас нет прав администратора', 'error');
            return;
        }

        if (!authManager.canPerformAction()) return;

        const order = this.orders.find(o => o.id == orderId);
        if (!order) {
            authManager.showToast('Заказ не найден', 'error');
            return;
        }

        if (order.status !== 'pending') {
            authManager.showToast('Заказ уже обработан', 'warning');
            return;
        }

        // Подтверждение
        const confirmed = await this.showConfirmDialog('Подтвердить выдачу', `Вы уверены, что выдали Baunty ученику ${order.student.fullName}?`);
        if (!confirmed) return;

        authManager.showLoader(true);

        try {
            // Обновляем заказ
            const { error: updateError } = await supabase
                .from('orders')
                .update({
                    status: 'confirmed',
                    confirmed_by: authManager.currentUser.id,
                    confirmed_at: new Date().toISOString(),
                    notes: notes || null
                })
                .eq('id', orderId);

            if (updateError) throw updateError;

            // Логируем активность
            await authManager.logActivity('order_confirmed', {
                order_id: orderId,
                student_id: order.student.id,
                student_name: order.student.fullName
            });

            // Обновляем список заказов
            await this.loadOrders();

            // Показываем уведомление
            authManager.showToast(`Заказ #${orderId} подтвержден`, 'success');

        } catch (error) {
            console.error('Ошибка подтверждения заказа:', error);
            authManager.showToast('Ошибка при подтверждении заказа', 'error');
        } finally {
            authManager.showLoader(false);
        }
    }

    // Отмена заказа
    async cancelOrder(orderId, notes = '') {
        if (!this.isAdmin) {
            authManager.showToast('У вас нет прав администратора', 'error');
            return;
        }

        if (!authManager.canPerformAction()) return;

        const order = this.orders.find(o => o.id == orderId);
        if (!order) {
            authManager.showToast('Заказ не найден', 'error');
            return;
        }

        if (order.status !== 'pending') {
            authManager.showToast('Заказ уже обработан', 'warning');
            return;
        }

        // Подтверждение
        const confirmed = await this.showConfirmDialog('Отменить заказ', `Вы уверены, что хотите отменить заказ ученика ${order.student.fullName}?`);
        if (!confirmed) return;

        authManager.showLoader(true);

        try {
            // Обновляем заказ
            const { error: updateError } = await supabase
                .from('orders')
                .update({
                    status: 'cancelled',
                    confirmed_by: authManager.currentUser.id,
                    confirmed_at: new Date().toISOString(),
                    notes: notes || null
                })
                .eq('id', orderId);

            if (updateError) throw updateError;

            // Возвращаем монеты ученику
            const itemPrice = 99; // Цена Baunty
            
            const { data: currentProfile } = await supabase
                .from('profiles')
                .select('coins')
                .eq('id', order.student.id)
                .single();

            if (currentProfile) {
                const newCoins = currentProfile.coins + itemPrice;
                
                await supabase
                    .from('profiles')
                    .update({ coins: newCoins })
                    .eq('id', order.student.id);

                // Создаем транзакцию возврата
                const hash = this.generateTransactionHash(
                    order.student.id,
                    itemPrice,
                    'refund_order'
                );

                await supabase.from('transactions').insert({
                    profile_id: order.student.id,
                    amount: itemPrice,
                    type: 'refund',
                    hash: hash,
                    details: { order_id: orderId, reason: 'order_cancelled' }
                });
            }

            // Логируем активность
            await authManager.logActivity('order_cancelled', {
                order_id: orderId,
                student_id: order.student.id,
                student_name: order.student.fullName,
                refund_amount: itemPrice
            });

            // Обновляем список заказов
            await this.loadOrders();

            // Показываем уведомление
            authManager.showToast(`Заказ #${orderId} отменен. Монеты возвращены.`, 'success');

        } catch (error) {
            console.error('Ошибка отмены заказа:', error);
            authManager.showToast('Ошибка при отмене заказа', 'error');
        } finally {
            authManager.showLoader(false);
        }
    }

    // Диалог подтверждения
    async showConfirmDialog(title, message) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 400px;">
                    <h3 style="margin-bottom: 1rem;">${title}</h3>
                    <p style="margin-bottom: 1.5rem; color: #666;">${message}</p>
                    <div style="display: flex; gap: 1rem;">
                        <button id="confirm-dialog-cancel" class="secondary-btn" style="flex: 1; background: #9E9E9E;">
                            Отмена
                        </button>
                        <button id="confirm-dialog-ok" class="secondary-btn" style="flex: 1; background: #2196F3;">
                            Подтвердить
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            document.getElementById('confirm-dialog-cancel').addEventListener('click', () => {
                modal.remove();
                resolve(false);
            });

            document.getElementById('confirm-dialog-ok').addEventListener('click', () => {
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

    // Обновление статистики заказов
    updateOrdersStats() {
        const pendingOrdersEl = document.getElementById('pending-orders');
        if (pendingOrdersEl) {
            const pendingCount = this.orders.filter(o => o.status === 'pending').length;
            pendingOrdersEl.textContent = `${pendingCount} ожидают`;
            
            // Анимация при изменении
            if (pendingCount > 0) {
                pendingOrdersEl.classList.add('has-pending');
            } else {
                pendingOrdersEl.classList.remove('has-pending');
            }
        }
    }

    // Получение текста статуса
    getStatusText(status) {
        switch (status) {
            case 'pending': return 'Ожидает подтверждения';
            case 'confirmed': return 'Подтвержден';
            case 'cancelled': return 'Отменен';
            default: return status;
        }
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

    // Показ ошибки администратора
    showAdminError() {
        const ordersList = document.getElementById('orders-list');
        if (ordersList) {
            ordersList.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons" style="color: #f44336; font-size: 3rem;">admin_panel_settings</span>
                    <p style="margin: 1rem 0;">У вас нет прав администратора</p>
                    <p style="font-size: 0.9rem; color: #666;">Эта вкладка доступна только администраторам системы</p>
                </div>
            `;
        }
    }

    // Автоматическое обновление заказов
    startAutoRefresh() {
        // Обновляем каждые 30 секунд, если вкладка активна
        setInterval(() => {
            const ordersTab = document.getElementById('orders-tab');
            if (this.isAdmin && ordersTab && ordersTab.classList.contains('active')) {
                this.loadOrders();
            }
        }, 30000);
    }

    // Экспорт данных в CSV
    async exportData(type) {
        if (!this.isAdmin) return;

        try {
            let data = [];
            let filename = '';
            let headers = [];

            switch (type) {
                case 'orders':
                    data = this.orders;
                    filename = `orders_${new Date().toISOString().split('T')[0]}.csv`;
                    headers = ['ID', 'Ученик', 'Класс', 'Товар', 'Статус', 'Дата заказа', 'Дата подтверждения', 'Заметки'];
                    break;
                case 'students':
                    const { data: students } = await supabase
                        .from('students')
                        .select('*, profiles(coins)')
                        .order('class')
                        .order('last_name');
                    
                    data = students || [];
                    filename = `students_${new Date().toISOString().split('T')[0]}.csv`;
                    headers = ['ID', 'Класс', 'Фамилия', 'Имя', 'Код', 'Монеты'];
                    break;
                case 'transactions':
                    const { data: transactions } = await supabase
                        .from('transactions')
                        .select('*, profiles(id, students(last_name, first_name, class))')
                        .order('created_at', { ascending: false })
                        .limit(1000);
                    
                    data = transactions || [];
                    filename = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
                    headers = ['ID', 'Ученик', 'Класс', 'Сумма', 'Тип', 'Дата', 'Хеш'];
                    break;
            }

            // Конвертируем в CSV
            const csv = this.convertToCSV(data, type, headers);
            
            // Скачиваем файл
            this.downloadCSV(csv, filename);

            authManager.showToast('Данные экспортированы', 'success');

        } catch (error) {
            console.error('Ошибка экспорта данных:', error);
            authManager.showToast('Ошибка экспорта данных', 'error');
        }
    }

    // Конвертация в CSV
    convertToCSV(data, type, headers) {
        const rows = [headers.join(',')];

        data.forEach(item => {
            let row = [];
            
            switch (type) {
                case 'orders':
                    row = [
                        item.id,
                        `"${item.student.fullName}"`,
                        `"${item.student.class}"`,
                        `"${item.itemName}"`,
                        `"${this.getStatusText(item.status)}"`,
                        `"${new Date(item.createdAt).toLocaleString('ru-RU')}"`,
                        item.confirmedAt ? `"${new Date(item.confirmedAt).toLocaleString('ru-RU')}"` : '',
                        `"${item.notes || ''}"`
                    ];
                    break;
                case 'students':
                    row = [
                        item.id,
                        `"${item.class}"`,
                        `"${item.last_name}"`,
                        `"${item.first_name}"`,
                        `"${item.code}"`,
                        item.profiles?.coins || 0
                    ];
                    break;
                case 'transactions':
                    const student = item.profiles?.students;
                    row = [
                        item.id,
                        student ? `"${student.last_name} ${student.first_name}"` : '',
                        student ? `"${student.class}"` : '',
                        item.amount,
                        `"${item.type}"`,
                        `"${new Date(item.created_at).toLocaleString('ru-RU')}"`,
                        `"${item.hash}"`
                    ];
                    break;
            }
            
            rows.push(row.join(','));
        });

        return rows.join('\n');
    }

    // Скачивание CSV файла
    downloadCSV(csv, filename) {
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }    

}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    window.adminManager = new AdminManager();
    
    // Запускаем автообновление, если пользователь админ
    if (adminManager.isAdmin) {
        adminManager.startAutoRefresh();
    }
});