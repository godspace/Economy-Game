// shop.js - ОБНОВЛЯЕМ ТОЛЬКО ФУНКЦИЮ renderProducts

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
        
        // Определяем URL изображения - для буста используем специальное изображение
        const imageUrl = product.product_type === 'unique_players_boost' 
            ? 'https://raw.githubusercontent.com/godspace/Economy-Game/refs/heads/main/rocket.png'
            : product.image_url;
        
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
                <img src="${imageUrl}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/200x200?text=Товар'">
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