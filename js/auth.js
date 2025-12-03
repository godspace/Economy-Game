// auth.js - УПРОЩЕННАЯ АУТЕНТИФИКАЦИЯ ТОЛЬКО ПО КОДУ СТУДЕНТА (ИСПРАВЛЕННАЯ)
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
            // Используем безопасную RPC функцию для создания профиля
            console.log('Creating new profile via RPC...');
            
            try {
                const { data: newProfileId, error: rpcError } = await state.supabase.rpc(
                    'create_profile_safe', 
                    {
                        p_student_id: student.id
                    }
                );
                
                if (rpcError) {
                    // Если RPC функция не существует, используем резервный метод
                    console.log('RPC function not found, using fallback method');
                    
                    // Временно отключаем проверку RLS рекурсии
                    // Используем прямой INSERT, но с обработкой ошибок
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
                        if (insertError.message.includes('infinite recursion')) {
                            // Пробуем альтернативный метод через students таблицу
                            console.log('Trying alternative profile creation method...');
                            throw new Error('Пожалуйста, обратитесь к администратору для создания профиля');
                        }
                        console.error('Error creating profile:', insertError);
                        throw new Error(`Ошибка создания профиля: ${insertError.message}`);
                    }
                    profile = newProfile;
                } else {
                    // RPC функция успешно создала профиль, загружаем его
                    const { data: newProfile, error: loadError } = await state.supabase
                        .from('profiles')
                        .select('*')
                        .eq('student_id', student.id)
                        .single();
                    
                    if (loadError) {
                        throw new Error(`Ошибка загрузки профиля: ${loadError.message}`);
                    }
                    profile = newProfile;
                }
                
                console.log('Profile created successfully', profile);
            } catch (rpcError) {
                console.error('RPC error:', rpcError);
                throw new Error(`Не удалось создать профиль: ${rpcError.message}`);
            }
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
        
        // Способ 1: Используем простую RPC функцию
        try {
            const { data: isAdminResult, error: rpcError } = await state.supabase.rpc(
                'check_admin_status_simple',
                { p_user_id: state.currentUserProfile.id }
            );
            
            if (!rpcError && typeof isAdminResult === 'boolean') {
                state.isAdmin = isAdminResult;
                console.log('🔧 User is admin (via RPC):', state.isAdmin);
                updateAdminTabVisibility();
                return state.isAdmin;
            }
        } catch (rpcError) {
            console.log('RPC function failed, using direct query:', rpcError);
        }
        
        // Способ 2: Простой прямой запрос (теперь работает с simple_admin_select политикой)
        const { data: admin, error } = await state.supabase
            .from('admins')
            .select('user_id')
            .eq('user_id', state.currentUserProfile.id)
            .maybeSingle();

        state.isAdmin = !error && !!admin;
        console.log('🔧 User is admin (via direct query):', state.isAdmin);
        
        updateAdminTabVisibility();
        return state.isAdmin;
        
    } catch (error) {
        console.error('Error checking admin status:', error);
        state.isAdmin = false;
        updateAdminTabVisibility();
        return false;
    }
}
