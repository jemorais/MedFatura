// Script para ativar modo de desenvolvimento sem login
// Instruções:
// 1. Abra o console do navegador (F12)
// 2. Cole este código e execute
// 3. Atualize a página - você estará logado como administrador

(function() {
    // Configurar header para bypass de autenticação
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        let [url, options = {}] = args;
        
        // Adicionar header de bypass para todas as requisições
        if (!options.headers) {
            options.headers = {};
        }
        
        // Copiar headers existentes
        const newHeaders = new Headers(options.headers);
        newHeaders.set('x-dev-bypass-auth', 'true');
        
        return originalFetch(url, {
            ...options,
            headers: newHeaders
        });
    };

    // Criar cookie de sessão fake para o frontend
    document.cookie = 'session_token=dev-bypass-token; path=/; max-age=86400';
    
    // Forçar estado de autenticação no frontend
    const fakeUser = {
        id: 1,
        email: 'dev@medfatura.com',
        name: 'Desenvolvedor',
        user_type: 'admin',
        cpf_crm: 'DEV123'
    };

    // Mockar resposta do /api/users/me
    const originalThen = Promise.prototype.then;
    Promise.prototype.then = function(onResolve, onReject) {
        return originalThen.call(this, (response) => {
            if (response.url && response.url.includes('/api/users/me')) {
                return new Response(JSON.stringify(fakeUser), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            return response;
        }, onReject);
    };

    console.log('🔓 Modo de desenvolvimento ativado!');
    console.log('✅ Você está logado como administrador');
    console.log('🔄 Atualize a página para aplicar as mudanças');
})();