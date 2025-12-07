// Минимальный профиль.js - остальная логика в game.js
document.addEventListener('DOMContentLoaded', function() {
    const playerData = sessionStorage.getItem('player');
    
    if (!playerData) {
        window.location.href = 'index.html';
        return;
    }
    
    const player = JSON.parse(playerData);
    
    // Обновляем базовую информацию
    document.getElementById('playerName').textContent = 
        `${player.first_name} ${player.last_name}`;
    document.getElementById('playerClass').textContent = player.class;
    document.getElementById('playerCode').textContent = player.code;
    document.getElementById('balanceValue').textContent = player.balance;
    
    // Инициалы для аватара
    const initials = (player.first_name[0] + player.last_name[0]).toUpperCase();
    document.getElementById('avatarInitials').textContent = initials;
    
    // Генерируем цвет аватара
    const colors = [
        '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
        '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50',
        '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800',
        '#ff5722', '#795548', '#9e9e9e', '#607d8b'
    ];
    
    const hash = player.code.split('').reduce((acc, char) => {
        return acc + char.charCodeAt(0);
    }, 0);
    
    const colorIndex = hash % colors.length;
    document.getElementById('playerAvatarColor').style.background = colors[colorIndex];
});