// Дополнительные функции безопасности для всей системы

class SecurityManager {
    static init() {
        this.preventSensitiveDataExposure()
        this.monitorForTampering()
        this.setupRequestValidation()
    }
    
    static preventSensitiveDataExposure() {
        // Предотвращаем вывод чувствительных данных в консоль
        const originalConsoleLog = console.log
        console.log = function(...args) {
            const sensitiveKeywords = ['supabase', 'key', 'secret', 'token', 'password']
            const stringArgs = JSON.stringify(args).toLowerCase()
            
            if (sensitiveKeywords.some(keyword => stringArgs.includes(keyword))) {
                console.warn('Попытка вывода чувствительных данных заблокирована')
                return
            }
            
            originalConsoleLog.apply(console, args)
        }
    }
    
    static monitorForTampering() {
        // Мониторинг попыток подмены данных
        let originalPlayerData = null
        
        setInterval(() => {
            const currentData = sessionStorage.getItem('player')
            
            if (!originalPlayerData) {
                originalPlayerData = currentData
                return
            }
            
            if (currentData !== originalPlayerData) {
                // Обнаружена попытка изменения данных
                console.error('Обнаружена попытка несанкционированного изменения данных!')
                sessionStorage.setItem('player', originalPlayerData)
                alert('Обнаружена попытка взлома! Пожалуйста, перезайдите в систему.')
                window.location.href = 'index.html'
            }
        }, 1000) // Проверка каждую секунду
    }
    
    static setupRequestValidation() {
        // Добавляем заголовки безопасности ко всем fetch запросам
        const originalFetch = window.fetch
        window.fetch = function(resource, init = {}) {
            const modifiedInit = {
                ...init,
                headers: {
                    ...init.headers,
                    'X-Request-Source': 'GameApp',
                    'X-Request-Time': Date.now().toString()
                }
            }
            
            return originalFetch(resource, modifiedInit)
        }
    }
    
    // Метод для проверки целостности данных
    static async validateDataIntegrity(playerId) {
        try {
            const response = await fetch(`/api/validate-player/${playerId}`)
            return response.ok
        } catch (error) {
            console.error('Data integrity check failed:', error)
            return false
        }
    }
}

// Инициализируем защиту на всех страницах
if (window.location.pathname.includes('.html')) {
    SecurityManager.init()
}

export { SecurityManager }