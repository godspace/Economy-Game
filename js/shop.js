// shop.js - ИСПРАВЛЕННЫЙ ФАЙЛ БЕЗ ДУБЛИРУЮЩИХ ЭКСПОРТОВ
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

// Функция для периодической проверки статуса буста - УПРОЩЕННАЯ ВЕРСИЯ
export function startBoostStatusPolling() {
    // Убираем частый polling - проверяем только при событиях
    console.log('Boost status polling configured for event-based updates');
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

// Функция для автоматической деактивации бустов при исчерпании лимита
// Функция для автоматической деактивации бустов при исчерпании лимита - ОТКЛЮЧАЕМ
export async function deactivateExhaustedBoosts(userId) {
    try {
        if (!state.supabase) return;

        console.log('🔍 Проверка исчерпанных бустов для пользователя:', userId);

        // Проверяем текущий лимит
        const { checkUniquePlayersLimit } = await import('./users.js');
        const limitCheck = await checkUniquePlayersLimit(userId);
        
        const totalLimit = limitCheck.baseLimit + limitCheck.boostLimit;
        const isLimitExhausted = limitCheck.usedSlots >= totalLimit;
        
        console.log('📊 Статус лимита:', {
            usedSlots: limitCheck.usedSlots,
            totalLimit: totalLimit,
            isExhausted: isLimitExhausted
        });

        // ОТКЛЮЧАЕМ АВТОДЕАКТИВАЦИЮ - бусты остаются активными до истечения времени
        // if (isLimitExhausted && limitCheck.hasActiveBoost) {
        //     console.log('🔚 Лимит исчерпан, деактивируем бусты');
        //     
        //     const { error } = await state.supabase
        //         .from('user_boosts')
        //         .update({ is_active: false })
        //         .eq('user_id', userId)
        //         .eq('boost_type', 'unique_players')
        //         .eq('is_active', true);
        //
        //     if (error) {
        //         console.error('❌ Ошибка деактивации бустов:', error);
        //     } else {
        //         console.log('✅ Бусты деактивированы');
        //         state.hasActiveUniquePlayersBoost = false;
        //         updateBoostUI(false, null);
        //         showBoostNotification('Буст деактивирован: лимит уникальных игроков исчерпан');
        //     }
        // }

    } catch (error) {
        console.error('❌ Ошибка проверки исчерпанных бустов:', error);
    }
}

// Функция для показа уведомлений о бустах
export function showBoostNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const bgColor = type === 'success' ? '#4caf50' : 
                   type === 'warning' ? '#ff9800' : 
                   type === 'error' ? '#f44336' : '#2196f3';
    
    notification.style.cssText = `
        position: fixed;
        top: 120px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 12px 18px;
        border-radius: 8px;
        z-index: 10001;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        max-width: 300px;
        word-wrap: break-word;
        border-left: 4px solid ${type === 'success' ? '#45a049' : 
                            type === 'warning' ? '#e68900' : 
                            type === 'error' ? '#d32f2f' : '#1976d2'};
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 
                          type === 'warning' ? 'fa-exclamation-triangle' : 
                          type === 'error' ? 'fa-times-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Автоматическое скрытие через 5 секунд
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// Обновляем функцию updateBoostStatus для более детальной проверки
export async function updateBoostStatus() {
    try {
        if (!state.supabase || !state.currentUserProfile) return;

        console.log('🔄 Checking boost status for user:', state.currentUserProfile.id);

        // Сначала проверяем и деактивируем исчерпанные бусты
        await deactivateExhaustedBoosts(state.currentUserProfile.id);

        // Затем проверяем активные бусты
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
            
            // Перезагружаем магазин для обновления кнопок
            if (document.getElementById('shopTab')?.classList.contains('active')) {
                await loadShop();
            }
            
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

// Функция для обновления UI буста С ПРОГРЕСС-БАРОМ ИЗ 6 СЕКЦИЙ
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
            background: white;
            color: #333;
            padding: 15px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            border: 2px solid #ffd700;
            min-width: 200px;
        `;
        
        // Добавляем обработчик клика для закрытия
        boostIndicator.addEventListener('click', function() {
            this.style.display = 'none';
            // Сохраняем состояние закрытия в localStorage
            localStorage.setItem('boostIndicatorClosed', 'true');
        });
        
        document.body.appendChild(boostIndicator);
    }

    // Проверяем, не закрыл ли пользователь индикатор вручную
    const isManuallyClosed = localStorage.getItem('boostIndicatorClosed') === 'true';
    
    if (hasActiveBoost && boostData && !isManuallyClosed) {
        const expiresAt = new Date(boostData.expires_at);
        const now = new Date();
        const totalDuration = 6 * 60 * 60 * 1000; // 6 часов в миллисекундах
        const timeLeft = expiresAt - now;
        const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));
        const minutesLeft = Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60)));
        
        // Рассчитываем прогресс (6 секций = 6 часов)
        const progress = Math.min(6, Math.max(0, 6 - hoursLeft));
        const progressPercent = (timeLeft / totalDuration) * 100;
        
        // Создаем прогресс-бар из 6 секций
        const progressBarHTML = `
            <div style="display: flex; gap: 4px; margin: 10px 0; height: 20px;">
                ${Array.from({length: 6}, (_, i) => `
                    <div style="
                        flex: 1;
                        background: ${i < progress ? '#e9ecef' : '#ffd700'};
                        border-radius: 4px;
                        transition: all 0.3s ease;
                        ${i < progress ? 'opacity: 0.5;' : 'box-shadow: 0 0 5px rgba(255, 215, 0, 0.5);'}
                    "></div>
                `).join('')}
            </div>
        `;
        
        boostIndicator.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <strong style="color: #ff6b00; display: flex; align-items: center; gap: 5px;">
                    <i class="fas fa-rocket"></i> Буст +5 игроков
                </strong>
                <small style="color: #666; font-size: 0.8rem;">
                    ${hoursLeft}ч ${minutesLeft}м
                </small>
            </div>
            ${progressBarHTML}
            <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: #666;">
                <span>${6 - progress}/6 ч</span>
                <span>Осталось: ${hoursLeft}ч ${minutesLeft}м</span>
            </div>
            <div style="text-align: center; margin-top: 5px;">
                <small style="color: #999; cursor: pointer;">Нажмите, чтобы скрыть</small>
            </div>
        `;
        boostIndicator.style.display = 'block';
        
        // Обновляем каждые 60 минут (1 час) вместо 1 минуты
        setTimeout(() => {
            if (state.isAuthenticated && state.currentUserProfile) {
                updateBoostStatus();
            }
        }, 60 * 60 * 1000); // 60 минут
        
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
        
        // Проверяем активные бусты для отображения информации
        const hasActiveBoost = state.hasActiveUniquePlayersBoost;
        
        // Особые условия для бустов
        let buttonClass, buttonText, disabled, specialInfo = '';
        
        if (product.product_type === 'unique_players_boost') {
            // УБИРАЕМ БЛОКИРОВКУ - можно покупать несколько бустов
            buttonClass = canAfford ? 'btn-warning' : 'btn-disabled';
            buttonText = canAfford ? 'Купить и активировать' : 'Недостаточно монет';
            disabled = !canAfford;
            
            if (hasActiveBoost) {
                specialInfo = `
                    <div style="color: var(--info); margin: 10px 0; padding: 12px; background: #e3f2fd; border-radius: 8px; border-left: 4px solid #2196f3;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                            <i class="fas fa-info-circle"></i>
                            <strong>Буст уже активен</strong>
                        </div>
                        <div style="font-size: 0.9rem;">
                            При покупке нового буста лимит увеличится дополнительно!
                        </div>
                    </div>
                `;
            } else {
                specialInfo = `
                    <div style="color: var(--success); margin: 10px 0; padding: 12px; background: #e8f5e8; border-radius: 8px; border-left: 4px solid #4caf50;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                            <i class="fas fa-rocket"></i>
                            <strong>Буст уникальных игроков</strong>
                        </div>
                        <div style="font-size: 0.9rem;">
                            +5 слотов для уникальных игроков на 24 часа
                        </div>
                    </div>
                `;
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

// Функция для покупки и активации буста - ДОБАВЛЕНА ЗАЩИТА ОТ ДУБЛИРОВАНИЯ
// Функция для покупки и активации буста - УБИРАЕМ ПРОВЕРКУ НА СУЩЕСТВУЮЩИЕ БУСТЫ
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

        // УБИРАЕМ ПРОВЕРКУ НА СУЩЕСТВУЮЩИЕ БУСТЫ - можно покупать несколько

        // 1. Сначала создаем заказ
        const { data: order, error: orderError } = await state.supabase
            .from('orders')
            .insert({
                user_id: state.currentUserProfile.id,
                product_id: productId,
                quantity: 1,
                total_amount: price,
                status: 'completed'
            })
            .select()
            .single();

        if (orderError) {
            console.error('❌ Ошибка создания заказа:', orderError);
            throw new Error('Ошибка создания заказа: ' + orderError.message);
        }

        console.log('✅ Заказ создан:', order);

        // 2. Вычитаем монеты
        const { error: updateError } = await state.supabase
            .from('profiles')
            .update({ coins: state.supabase.raw('coins - ?', price) })
            .eq('id', state.currentUserProfile.id);

        if (updateError) {
            console.error('❌ Ошибка списания монет:', updateError);
            throw new Error('Ошибка списания монет: ' + updateError.message);
        }

        // 3. Создаем запись буста
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // 24 часа

        const { data: boost, error: boostError } = await state.supabase
            .from('user_boosts')
            .insert({
                user_id: state.currentUserProfile.id,
                boost_type: 'unique_players',
                boost_value: 5,
                expires_at: expiresAt.toISOString(),
                is_active: true
            })
            .select()
            .single();

        if (boostError) {
            console.error('❌ Ошибка создания буста:', boostError);
            throw new Error('Ошибка активации буста: ' + boostError.message);
        } else {
            console.log('✅ Буст создан:', boost);
        }

        alert('🎯 Буст уникальных игроков активирован! +5 слотов на 24 часа!');
        
        // Обновляем баланс пользователя
        await updateUserBalance();
        
        // Обновляем статус буста
        state.hasActiveUniquePlayersBoost = true;
        
        // Перезагружаем магазин для обновления кнопок
        await loadShop();
        
        // Обновляем UI буста
        updateBoostUI(true, boost);
        
        // Обновляем лимит индикатор
        try {
            const { updateLimitIndicator } = await import('./users.js');
            await updateLimitIndicator();
        } catch (error) {
            console.error('Error updating limit indicator after boost purchase:', error);
        }
        
        // Показываем уведомление
        showBoostNotification('Буст активирован! +5 слотов для уникальных игроков', 'success');

    } catch (error) {
        console.error('❌ Ошибка покупки буста:', error);
        alert('Ошибка: ' + error.message);
    }
}

// Функция для ручной активации буста (для админов) - С ДОПОЛНИТЕЛЬНОЙ ПРОВЕРКОЙ
async function manuallyActivateBoost(userId) {
    try {
        if (!state.supabase || !state.isAdmin) {
            throw new Error('Недостаточно прав');
        }

        console.log('🛠️ Ручная активация буста для пользователя:', userId);

        // Проверяем, нет ли уже активного буста
        const { data: existingBoosts, error: checkError } = await state.supabase
            .from('user_boosts')
            .select('id')
            .eq('user_id', userId)
            .eq('boost_type', 'unique_players')
            .eq('is_active', true)
            .gt('expires_at', new Date().toISOString());

        if (checkError) {
            console.error('❌ Ошибка проверки существующих бустов:', checkError);
            throw new Error('Ошибка проверки существующих бустов');
        }

        if (existingBoosts && existingBoosts.length > 0) {
            console.log('⚠️ У пользователя уже есть активный буст:', existingBoosts);
            throw new Error('У пользователя уже есть активный буст');
        }

        // Прямая вставка буста
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        const { data: boost, error } = await state.supabase
            .from('user_boosts')
            .insert({
                user_id: userId,
                boost_type: 'unique_players',
                boost_value: 5,
                expires_at: expiresAt.toISOString(),
                is_active: true
            })
            .select()
            .single();

        if (error) {
            console.error('❌ Ошибка вставки буста:', error);
            throw new Error('Ошибка вставки: ' + error.message);
        }

        console.log('✅ Буст успешно создан:', boost);
        return true;

    } catch (error) {
        console.error('❌ Ошибка ручной активации буста:', error);
        throw new Error('Ошибка активации: ' + error.message);
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

        // Получаем данные заказа перед обновлением
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
        
        // ИСПРАВЛЕНИЕ: Активируем буст только при ПОДТВЕРЖДЕНИИ заказа (confirmed), а не при завершении (completed)
        if (status === 'confirmed' && isBoostProduct && order.status !== 'confirmed') {
            console.log('🚀 Активируем буст для пользователя:', order.user_id);
            
            // Проверяем, нет ли уже активного буста
            const { data: existingBoosts, error: checkError } = await state.supabase
                .from('user_boosts')
                .select('id')
                .eq('user_id', order.user_id)
                .eq('boost_type', 'unique_players')
                .eq('is_active', true)
                .gt('expires_at', new Date().toISOString());

            if (checkError) {
                console.error('Ошибка проверки существующих бустов:', checkError);
                adminNotes = (adminNotes || '') + ' Ошибка проверки бустов. ';
            } else if (existingBoosts && existingBoosts.length > 0) {
                console.log('⚠️ У пользователя уже есть активный буст, пропускаем создание');
                adminNotes = (adminNotes || '') + ' Буст не активирован: у пользователя уже есть активный буст. ';
            } else {
                try {
                    await manuallyActivateBoost(order.user_id);
                    adminNotes = (adminNotes || '') + ' Буст активирован автоматически.';
                } catch (boostError) {
                    console.error('Ошибка активации буста:', boostError);
                    adminNotes = (adminNotes || '') + ' Ошибка активации буста: ' + boostError.message;
                }
            }
        }

        // Если отменяем заказ - возвращаем деньги
        if (status === 'cancelled' && order.status !== 'cancelled') {
            console.log(`💰 Returning ${order.total_amount} coins to user ${order.user_id}`);
            
            // ИСПРАВЛЕНИЕ: Вместо state.supabase.raw() используем отдельные запросы
            
            // 1. Получаем текущий баланс пользователя
            const { data: userProfile, error: profileError } = await state.supabase
                .from('profiles')
                .select('coins')
                .eq('id', order.user_id)
                .single();

            if (profileError) {
                console.error('❌ Profile error:', profileError);
                throw profileError;
            }

            // 2. Обновляем баланс
            const newBalance = (userProfile.coins || 0) + order.total_amount;
            const { error: refundError } = await state.supabase
                .from('profiles')
                .update({ 
                    coins: newBalance,
                    updated_at: new Date().toISOString()
                })
                .eq('id', order.user_id);

            if (refundError) {
                console.error('❌ Refund error:', refundError);
                throw refundError;
            }
            
            console.log('✅ Balance updated:', newBalance);
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

// УДАЛЕН ДУБЛИРУЮЩИЙ ЭКСПОРТ В КОНЦЕ ФАЙЛА
// Все функции уже экспортированы индивидуально в месте их объявления
