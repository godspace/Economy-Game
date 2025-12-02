// auth.js - УПРОЩЕННАЯ АУТЕНТИФИКАЦИЯ ТОЛЬКО ПО КОДУ СТУДЕНТА (ИСПРАВЛЕННЫЙ)
import { state, dom, SUPABASE_CONFIG } from './config.js';
import { showAuthSection, showProfileSection, showAuthError, hideAuthError, updateUserBalanceDisplay } from './ui.js';

let supabaseInitialized = false;

export async function initSupabase() {
    return new Promise((resolve, reject) => {
        try {
            console.log('Initializing Supabase...');
            
            if (typeof window.supabase === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
                script.onload = () => {
                    initializeClient();
                    resolve();
                };
                script.onerror = () => reject(new Error('Failed to load Supabase library'));
                document.head.appendChild(script);
            } else {
                initializeClient();
                resolve();
            }
            
            function initializeClient() {
                try {
                    state.supabase = window.supabase.createClient(
                        SUPABASE_CONFIG.url, 
                        SUPABASE_CONFIG.key,
                        {
                            auth: {
                                persistSession: false,
                                autoRefreshToken: false,
                                detectSessionInUrl: false
                            }
                        }
                    );
                    supabaseInitialized = true;
                    console.log('Supabase initialized successfully');
                } catch (error) {
                    reject(error);
                }
            }
        } catch (error) {
            console.error('Error initializing Supabase:', error);
            reject(error);
        }
    });
}

export async function checkAuth() {
    try {
        // Проверяем, есть ли сохраненный код в localStorage
        const savedCode = localStorage.getItem('student_code');
        if (savedCode) {
            await handleCodeAuth(savedCode, true);
        } else {
            showAuthSection();
        }
    } catch (error) {
        console.error('Error checking auth:', error);
        showAuthSection();
    }
}

export async function handleAuth(e) {
    e.preventDefault();
    
    if (!state.supabase || !supabaseInitialized) {
        showAuthError('Система не инициализирована');
        return;
    }
    
    const code = document.getElementById('code')?.value.trim();
    
    if (!code) {
        showAuthError('Пожалуйста, введите ваш код');
        return;
    }
    
    hideAuthError();
    
    if (dom.authBtn) {
        dom.authBtn.disabled = true;
        dom.authBtn.textContent = 'Вход...';
    }
    
    try {
        await handleCodeAuth(code, false);
    } catch (error) {
        console.error('Auth error:', error);
        showAuthError('Ошибка входа. Проверьте код.');
    } finally {
        if (dom.authBtn) {
            dom.authBtn.disabled = false;
            dom.authBtn.textContent = 'Войти';
        }
    }
}

async function handleCodeAuth(code, isAutoLogin = false) {
    try {
        console.log('Checking student with code:', code);
        
        // Проверяем, что студент существует
        const { data: student, error: studentError } = await state.supabase
            .from('students')
            .select('*')
            .eq('code', code)
            .single();

        if (studentError || !student) {
            throw new Error('Неверный код студента');
        }

        console.log('Student found:', student);

        // Ищем существующий профиль
        const { data: existingProfile, error: profileError } = await state.supabase
            .from('profiles')
            .select('*')
            .eq('student_id', student.id)
            .maybeSingle();

        let profile;

        if (existingProfile) {
            console.log('Profile found, logging in...');
            profile = existingProfile;
        } else {
            // Создаем новый профиль через RPC функцию, которая возвращает JSON
            console.log('Creating new profile via RPC...');
            
            // Пробуем RPC функцию
            try {
                const { data: rpcResult, error: rpcError } = await state.supabase.rpc(
                    'create_profile_safe_json', 
                    {
                        p_student_id: student.id
                    }
                );
                
                if (rpcError) {
                    console.log('RPC function error, trying direct method:', rpcError);
                    throw rpcError;
                }
                
                console.log('RPC result:', rpcResult);
                
                // RPC функция возвращает JSON с profile_id
                if (rpcResult && rpcResult.profile_id) {
                    // Загружаем профиль по ID
                    const { data: newProfile, error: loadError } = await state.supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', rpcResult.profile_id)
                        .single();

                    if (loadError) {
                        throw new Error(`Ошибка загрузки профиля: ${loadError.message}`);
                    }
                    profile = newProfile;
                } else {
                    throw new Error('RPC функция вернула неверный формат');
                }
            } catch (rpcError) {
                console.log('RPC function not available or failed, using direct method');
                
                // Fallback: прямой метод с обработкой ошибок RLS
                const { data: newProfile, error: insertError } = await state.supabase
                    .from('profiles')
                    .insert({
                        student_id: student.id,
                        username: `${student.first_name} ${student.last_name}`,
                        class: student.class,
                        coins: 1000,
                        reputation: 100
                    })
                    .select()
                    .single();

                if (insertError) {
                    console.error('Error creating profile:', insertError);
                    
                    // Если ошибка рекурсии RLS, пытаемся использовать обходной путь
                    if (insertError.message.includes('infinite recursion') || insertError.message.includes('PGRST116')) {
                        console.log('RLS recursion detected, trying alternative...');
                        
                        // Пробуем через функцию create_profile_direct
                        const { data: altResult, error: altError } = await state.supabase.rpc(
                            'create_profile_direct',
                            {
                                p_student_id: student.id,
                                p_username: `${student.first_name} ${student.last_name}`,
                                p_class: student.class
                            }
                        );
                        
                        if (altError) {
                            throw new Error('Пожалуйста, обратитесь к администратору для создания профиля');
                        }
                        
                        // Загружаем созданный профиль
                        const { data: loadedProfile, error: loadError } = await state.supabase
                            .from('profiles')
                            .select('*')
                            .eq('student_id', student.id)
                            .single();
                            
                        if (loadError) {
                            throw new Error(`Ошибка загрузки созданного профиля: ${loadError.message}`);
                        }
                        profile = loadedProfile;
                    } else {
                        throw new Error(`Ошибка создания профиля: ${insertError.message}`);
                    }
                } else {
                    profile = newProfile;
                }
            }
            
            console.log('Profile created successfully', profile);
        }

        // Сохраняем состояние
        state.currentUserProfile = profile;
        state.currentUser = { id: profile.id };
        state.isAuthenticated = true;

        // Сохраняем код для автоматического входа
        if (!isAutoLogin) {
            localStorage.setItem('student_code', code);
        }

        await checkAdminStatus();
        await loadBoostStatus();
        updateUI();
        showProfileSection();

    } catch (error) {
        console.error('Student verification error:', error);
        showAuthError(error.message || 'Ошибка создания профиля. Обратитесь к администратору.');
        throw error;
    }
}

export async function checkAdminStatus() {
    try {
        if (!state.supabase || !state.currentUserProfile) {
            state.isAdmin = false;
            updateAdminTabVisibility();
            return false;
        }

        console.log('🔧 Checking admin status for profile ID:', state.currentUserProfile.id);
        
        // Пробуем RPC функцию
        try {
            const { data: isAdminResult, error: rpcError } = await state.supabase.rpc(
                'check_is_admin',
                { p_profile_id: state.currentUserProfile.id }
            );
            
            if (!rpcError && typeof isAdminResult === 'boolean') {
                state.isAdmin = isAdminResult;
            } else {
                // Fallback: прямой запрос
                const { data: admin, error } = await state.supabase
                    .from('admins')
                    .select('user_id')
                    .eq('user_id', state.currentUserProfile.id)
                    .maybeSingle();

                state.isAdmin = !error && !!admin;
            }
        } catch (rpcError) {
            console.log('RPC function not available, using direct query');
            const { data: admin, error } = await state.supabase
                .from('admins')
                .select('user_id')
                .eq('user_id', state.currentUserProfile.id)
                .maybeSingle();

            state.isAdmin = !error && !!admin;
        }
        
        console.log('🔧 User is admin:', state.isAdmin);
        
        // Обновляем видимость вкладки администратора
        updateAdminTabVisibility();

        return state.isAdmin;
    } catch (error) {
        console.error('Error checking admin status:', error);
        state.isAdmin = false;
        updateAdminTabVisibility();
        return false;
    }
}

// Функция для обновления видимости вкладки администратора
function updateAdminTabVisibility() {
    const adminTab = document.querySelector('.tab[data-tab="admin"]');
    if (adminTab) {
        adminTab.style.display = state.isAdmin ? 'flex' : 'none';
        console.log('Admin tab visibility updated:', state.isAdmin ? 'visible' : 'hidden');
    } else {
        console.log('Admin tab not found in HTML');
    }
}

async function loadBoostStatus() {
    try {
        const { updateBoostStatus, startBoostStatusPolling } = await import('./shop.js');
        await updateBoostStatus();
        startBoostStatusPolling();
    } catch (error) {
        console.error('Error loading boost status:', error);
    }
}

function updateUI() {
    if (!state.currentUserProfile) return;
    
    const displayName = state.currentUserProfile.username;
    
    if (dom.userGreeting) dom.userGreeting.textContent = `Привет, ${displayName}!`;
    if (dom.userAvatar) dom.userAvatar.textContent = displayName.charAt(0).toUpperCase();
    updateUserBalanceDisplay();
}

export async function handleLogout() {
    try {
        Object.values(state.depositTimers).forEach(timer => {
            if (timer) clearInterval(timer);
        });
        state.depositTimers = {};

        try {
            const { stopBoostStatusPolling } = await import('./shop.js');
            stopBoostStatusPolling();
        } catch (error) {
            console.error('Error stopping boost polling:', error);
        }

        // Очищаем сохраненный код
        localStorage.removeItem('student_code');

        state.currentUser = null;
        state.currentUserProfile = null;
        state.isAuthenticated = false;
        state.isAdmin = false;

        const { clearCache } = await import('./config.js');
        clearCache();

        showAuthSection();
    } catch (error) {
        console.error('Logout error:', error);
        showAuthSection();
    }
}

export function isSupabaseInitialized() {
    return supabaseInitialized && state.supabase !== null;
}