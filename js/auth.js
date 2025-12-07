// auth.js - модуль аутентификации и управления сессией

// Проверяем, что Supabase инициализирован
if (typeof window.SUPABASE === 'undefined') {
    console.error('Supabase не инициализирован в config.js');
    // Создаем заглушку, чтобы не было ошибок
    window.SUPABASE = {
        from: () => ({
            select: () => Promise.resolve({ data: null, error: { message: 'Supabase не инициализирован' } }),
            insert: () => Promise.resolve({ data: null, error: { message: 'Supabase не инициализирован' } }),
            update: () => Promise.resolve({ data: null, error: { message: 'Supabase не инициализирован' } }),
            eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'Supabase не инициализирован' } }) })
        }),
        auth: { getSession: () => Promise.resolve({ data: { session: null }, error: null }) }
    };
}

// Используем глобальный клиент Supabase
const supabase = window.SUPABASE;

// Проверка подключения к Supabase (упрощенная версия)
async function testSupabaseConnection() {
    console.log('Проверка подключения к Supabase...');
    
    try {
        // Простой тестовый запрос
        const { data, error } = await supabase
            .from('students')
            .select('count')
            .limit(1);
        
        if (error) {
            console.error('Ошибка подключения к Supabase:', error);
            return false;
        }
        
        console.log('Подключение к Supabase успешно');
        return true;
    } catch (error) {
        console.error('Ошибка при проверке подключения:', error);
        return false;
    }
}


class AuthManager {
    constructor() {
        this.currentUser = null;
        this.lastActionTime = 0;
        this.RATE_LIMIT = GAME_CONFIG.RATE_LIMIT_MS;
        
        this.initEventListeners();
        this.checkExistingSession();
    }

    // Инициализация обработчиков событий
    initEventListeners() {
        document.getElementById('login-btn').addEventListener('click', () => this.login());
        document.getElementById('code-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
    }

    // Проверка существующей сессии
    async checkExistingSession() {
        const savedUserId = localStorage.getItem('trust_evolution_user_id');
        const savedCode = localStorage.getItem('trust_evolution_code');
        
        if (savedUserId && savedCode) {
            await this.validateAndLoadUser(savedUserId, savedCode);
        }
    }

    // Основная функция входа
    // Основная функция входа
    async login() {
        const codeInput = document.getElementById('code-input');
        const code = codeInput.value.trim();
        const errorEl = document.getElementById('login-error');

        // Валидация кода
        if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
            this.showError(errorEl, 'Введите 6-значный код цифрами');
            return;
        }

        this.showLoader(true);
        errorEl.style.display = 'none';

        try {
            console.log('Поиск студента с кодом:', code);
            
            // Ищем студента по коду
            const { data: student, error } = await supabase
                .from('students')
                .select('*')
                .eq('code', code)
                .single();

            if (error) {
                console.error('Ошибка поиска студента:', error);
                
                if (error.code === 'PGRST116') {
                    this.showError(errorEl, 'Код не найден. Проверьте правильность ввода.');
                } else {
                    this.showError(errorEl, 'Ошибка подключения к базе данных');
                }
                return;
            }

            if (!student) {
                this.showError(errorEl, 'Код не найден');
                return;
            }

            console.log('Студент найден:', student);
            
            // Проверяем или создаем профиль
            await this.createOrGetProfile(student);
            
            // Сохраняем сессию
            localStorage.setItem('trust_evolution_user_id', student.id);
            localStorage.setItem('trust_evolution_code', code);
            
            // Переключаем экран
            this.switchToApp();
            
        } catch (error) {
            console.error('Login error:', error);
            this.showError(errorEl, 'Ошибка входа. Попробуйте еще раз.');
        } finally {
            this.showLoader(false);
        }
    }

    // Создание или получение профиля
    async createOrGetProfile(student) {
        console.log('Создание/получение профиля для студента:', student.id);

        // Сначала проверяем существующий профиль
        const { data: existingProfile, error: fetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', student.id)
            .maybeSingle(); // Используем maybeSingle вместо single

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = не найдено
            console.error('Ошибка при проверке профиля:', fetchError);
            throw fetchError;
        }

        if (existingProfile) {
            console.log('Профиль найден:', existingProfile);
            this.currentUser = {
                ...student,
                ...existingProfile,
                fullName: `${student.last_name} ${student.first_name}`
            };
            
            // Обновляем статус онлайн
            await supabase
                .from('profiles')
                .update({ 
                    online: true, 
                    last_action: new Date().toISOString() 
                })
                .eq('id', student.id);
                
            return;
        }

        // Создаем новый профиль
        console.log('Создаем новый профиль для студента:', student.id);
        const colorIndex = this.calculateColorIndex(student.id);
        
        const newProfile = {
            id: student.id,
            coins: 100,
            online: true,
            deals_cache: {},
            color_index: colorIndex,
            last_action: new Date().toISOString()
        };

        const { data: insertedProfile, error: insertError } = await supabase
            .from('profiles')
            .insert(newProfile)
            .select()
            .single();

        if (insertError) {
            console.error('Ошибка при создании профиля:', insertError);
            
            // Если ошибка "дубликат ключа", пытаемся получить существующий профиль
            if (insertError.code === '23505') {
                const { data: retryProfile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', student.id)
                    .single();
                    
                if (retryProfile) {
                    this.currentUser = {
                        ...student,
                        ...retryProfile,
                        fullName: `${student.last_name} ${student.first_name}`
                    };
                    return;
                }
            }
            throw insertError;
        }

        this.currentUser = {
            ...student,
            ...insertedProfile,
            fullName: `${student.last_name} ${student.first_name}`
        };
        
        // Создаем начальную транзакцию
        await this.createInitialTransaction();
    }

    // Детерминированное вычисление цвета
    calculateColorIndex(studentId) {
        return studentId % MATERIAL_COLORS.length;
    }

    // Создание начальной транзакции
    async createInitialTransaction() {
        // Проверяем, есть ли уже транзакции у пользователя
        const { data: existingTransactions } = await supabase
            .from('transactions')
            .select('id')
            .eq('profile_id', this.currentUser.id)
            .limit(1);

        if (existingTransactions && existingTransactions.length === 0) {
            // Создаем начальную транзакцию в 100 монет
            const hash = this.generateTransactionHash(this.currentUser.id, 100, 'initial');
            
            await supabase.from('transactions').insert({
                profile_id: this.currentUser.id,
                amount: 100,
                type: 'initial',
                hash: hash
            });
        }
    }

    // Генерация хеша для транзакции
    generateTransactionHash(profileId, amount, type) {
        const timestamp = Date.now();
        const data = `${profileId}-${amount}-${type}-${timestamp}-${Math.random()}`;
        return this.sha256(data);
    }

    // Простая имитация SHA-256 (в production используйте crypto.subtle.digest)
    sha256(str) {
        // Временная реализация - в реальном проекте используйте Web Crypto API
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(64, '0');
    }

    // Валидация и загрузка пользователя
    async validateAndLoadUser(userId, code) {
        try {
            const { data: student } = await supabase
                .from('students')
                .select('*')
                .eq('id', userId)
                .eq('code', code)
                .single();

            if (student) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', userId)
                    .single();

                if (profile) {
                    this.currentUser = {
                        ...student,
                        ...profile,
                        fullName: `${student.last_name} ${student.first_name}`
                    };
                    
                    await supabase
                        .from('profiles')
                        .update({ online: true, last_action: new Date() })
                        .eq('id', userId);
                        
                    this.switchToApp();
                }
            }
        } catch (error) {
            console.error('Session validation error:', error);
            localStorage.removeItem('trust_evolution_user_id');
            localStorage.removeItem('trust_evolution_code');
        }
    }

    // Переключение на экран приложения
    switchToApp() {
        // Обновляем UI
        document.getElementById('player-name').textContent = this.currentUser.fullName;
        document.getElementById('coins-count').textContent = this.currentUser.coins;
        
        // Устанавливаем цвет аватара
        const avatar = document.getElementById('player-avatar');
        const colorIndex = this.currentUser.color_index || 0;
        avatar.style.background = `linear-gradient(45deg, ${MATERIAL_COLORS[colorIndex]}, ${this.adjustColor(MATERIAL_COLORS[colorIndex], -20)})`;
        avatar.textContent = this.currentUser.fullName.charAt(0);
        
        // Показываем админскую вкладку если нужно
        this.checkAdminAccess();
        
        // Переключаем экраны
        document.getElementById('auth-screen').classList.remove('active');
        document.getElementById('app-screen').classList.add('active');
        
        // Запускаем обновление статуса
        this.startStatusUpdates();
        
        // Показываем уведомление
        this.showToast(`Добро пожаловать, ${this.currentUser.first_name}!`, 'success');
    }

    // Проверка доступа админа
    checkAdminAccess() {
        // Простая проверка - если код 000000 или 999999
        const adminCodes = ['000000', '999999'];
        const isAdmin = adminCodes.includes(this.currentUser.code);
        
        if (isAdmin) {
            document.querySelector('.tab-btn[data-tab="orders"]').style.display = 'flex';
        }
    }

    // Коррекция цвета для градиента
    adjustColor(color, amount) {
        let usePound = false;
        if (color[0] === "#") {
            color = color.slice(1);
            usePound = true;
        }
        
        const num = parseInt(color, 16);
        let r = (num >> 16) + amount;
        let g = ((num >> 8) & 0x00FF) + amount;
        let b = (num & 0x0000FF) + amount;
        
        r = Math.min(Math.max(0, r), 255);
        g = Math.min(Math.max(0, g), 255);
        b = Math.min(Math.max(0, b), 255);
        
        return (usePound ? "#" : "") + (b | (g << 8) | (r << 16)).toString(16).padStart(6, '0');
    }

    // Выход из системы
    async logout() {
        if (this.currentUser) {
            await supabase
                .from('profiles')
                .update({ online: false })
                .eq('id', this.currentUser.id);
        }
        
        // Очищаем локальное хранилище
        localStorage.removeItem('trust_evolution_user_id');
        localStorage.removeItem('trust_evolution_code');
        
        // Сбрасываем состояние
        this.currentUser = null;
        document.getElementById('code-input').value = '';
        
        // Переключаем экран
        document.getElementById('auth-screen').classList.add('active');
        document.getElementById('app-screen').classList.remove('active');
        
        // Останавливаем обновления статуса
        if (this.statusUpdateInterval) {
            clearInterval(this.statusUpdateInterval);
        }
        
        this.showToast('Вы вышли из системы');
    }

    // Rate limiting проверка
    canPerformAction() {
        const now = Date.now();
        const timeSinceLastAction = now - this.lastActionTime;
        
        if (timeSinceLastAction < this.RATE_LIMIT) {
            const waitTime = Math.ceil((this.RATE_LIMIT - timeSinceLastAction) / 1000);
            this.showToast(`Подождите ${waitTime} секунд перед следующим действием`, 'warning');
            return false;
        }
        
        this.lastActionTime = now;
        return true;
    }

    // Запись лога активности
    async logActivity(action, details = {}) {
        if (!this.currentUser) return;
        
        try {
            // Хеш IP для анонимности (в реальном приложении получайте с сервера)
            const ipHash = 'anonymous';
            
            await supabase.from('activity_logs').insert({
                profile_id: this.currentUser.id,
                action: action,
                details: details,
                ip_hash: ipHash
            });
        } catch (error) {
            console.error('Activity log error:', error);
        }
    }

    // Периодическое обновление статуса
    startStatusUpdates() {
        this.statusUpdateInterval = setInterval(async () => {
            if (this.currentUser) {
                await supabase
                    .from('profiles')
                    .update({ last_action: new Date() })
                    .eq('id', this.currentUser.id);
            }
        }, 30000); // Каждые 30 секунд
    }

    // Вспомогательные методы UI
    showError(errorEl, message) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        setTimeout(() => {
            errorEl.style.display = 'none';
        }, 3000);
    }

    showLoader(show) {
        const loader = document.getElementById('loader');
        loader.classList.toggle('active', show);
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast';
        
        // Добавляем класс типа
        if (type === 'success') toast.classList.add('success');
        if (type === 'warning') toast.classList.add('warning');
        if (type === 'error') toast.classList.add('error');
        
        // Показываем
        toast.classList.add('show');
        
        // Скрываем через 3 секунды
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Проверка подключения к Supabase
async function testSupabaseConnection() {
    console.log('Проверка подключения к Supabase...');
    
    try {
        // Простой тестовый запрос
        const { data, error } = await supabase
            .from('students')
            .select('count')
            .limit(1);
        
        if (error) {
            console.error('Ошибка подключения к Supabase:', error);
            return false;
        }
        
        console.log('Подключение к Supabase успешно');
        return true;
    } catch (error) {
        console.error('Ошибка при проверке подключения:', error);
        return false;
    }
}

// Проверяем подключение при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    const isConnected = await testSupabaseConnection();
    
    if (!isConnected) {
        const errorEl = document.getElementById('login-error');
        if (errorEl) {
            errorEl.textContent = 'Ошибка подключения к серверу. Пожалуйста, проверьте интернет-соединение.';
            errorEl.style.display = 'block';
        }
    }
});

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});