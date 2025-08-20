# 🚀 Guia de Migração para Supabase e Deploy

## 📋 Pré-requisitos

- Conta no [Supabase](https://supabase.com)
- Conta no [Cloudflare](https://cloudflare.com) (para deploy)
- Node.js 18+ instalado
- Git configurado

## 🗄️ 1. Configuração do Supabase

### 1.1 Criar Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e faça login
2. Clique em "New Project"
3. Escolha sua organização
4. Configure:
   - **Name**: `MedFatura`
   - **Database Password**: Crie uma senha forte
   - **Region**: `South America (São Paulo)` (mais próximo do Brasil)
5. Clique em "Create new project"
6. Aguarde a criação (pode levar alguns minutos)

### 1.2 Configurar o Banco de Dados

1. No painel do Supabase, vá para **SQL Editor**
2. Clique em "New Query"
3. Copie todo o conteúdo do arquivo `supabase-schema.sql`
4. Cole no editor e execute (botão "Run")
5. Verifique se todas as tabelas foram criadas em **Table Editor**

### 1.3 Obter Credenciais

1. Vá para **Settings** > **API**
2. Anote as seguintes informações:
   - **Project URL**
   - **anon public key**
   - **service_role key** (mantenha em segredo!)

### 1.4 Configurar Storage (para arquivos)

1. Vá para **Storage**
2. Clique em "Create a new bucket"
3. Configure:
   - **Name**: `invoices`
   - **Public**: `false` (privado)
4. Clique em "Create bucket"

## ⚙️ 2. Configuração do Projeto

### 2.1 Variáveis de Ambiente

1. Copie o arquivo `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edite o arquivo `.env` com suas credenciais do Supabase:
   ```env
   SUPABASE_URL=https://seu-projeto.supabase.co
   SUPABASE_ANON_KEY=sua_anon_key_aqui
   SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_aqui
   DATABASE_URL=postgresql://postgres:sua_senha@db.seu-projeto.supabase.co:5432/postgres
   ```

### 2.2 Atualizar Código para Supabase

O arquivo `src/react-app/utils/supabase.ts` já está configurado. Você precisará:

1. Instalar o cliente do Supabase:
   ```bash
   npm install @supabase/supabase-js
   ```

2. Atualizar as funções de banco de dados no `src/worker/index.ts` para usar Supabase

## 🚀 3. Deploy no Cloudflare Workers

### 3.1 Configurar Cloudflare Workers

1. Instale o Wrangler CLI:
   ```bash
   npm install -g wrangler
   ```

2. Faça login no Cloudflare:
   ```bash
   wrangler login
   ```

3. Configure as variáveis de ambiente no Cloudflare:
   ```bash
   wrangler secret put SUPABASE_URL
   wrangler secret put SUPABASE_ANON_KEY
   wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   wrangler secret put SESSION_SECRET
   ```

### 3.2 Deploy da Aplicação

1. Build do projeto:
   ```bash
   npm run build
   ```

2. Deploy:
   ```bash
   npm run deploy
   ```

3. Configure o domínio customizado (opcional):
   - No painel do Cloudflare Workers
   - Vá para **Triggers** > **Custom Domains**
   - Adicione seu domínio

## 🧪 4. Testes e Validação

### 4.1 Testes Locais

1. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

2. Teste as funcionalidades:
   - [ ] Login/Registro
   - [ ] Upload de faturas
   - [ ] Sistema de notificações
   - [ ] Pagamentos pendentes
   - [ ] Download de arquivos

### 4.2 Testes em Produção

1. Acesse a URL do deploy
2. Teste todas as funcionalidades
3. Verifique os logs no Cloudflare Workers
4. Monitore o banco de dados no Supabase

## 📊 5. Monitoramento e Manutenção

### 5.1 Supabase Dashboard

- **Database**: Monitore queries e performance
- **Auth**: Gerencie usuários
- **Storage**: Monitore uso de arquivos
- **Logs**: Verifique erros e atividades

### 5.2 Cloudflare Analytics

- **Workers Analytics**: Performance e uso
- **Security**: Ataques bloqueados
- **Caching**: Eficiência do cache

## 🔧 6. Troubleshooting

### Problemas Comuns

1. **Erro de CORS**:
   - Verifique as configurações de CORS no Supabase
   - Configure os domínios permitidos

2. **Erro de autenticação**:
   - Verifique as chaves da API
   - Confirme as políticas RLS

3. **Upload de arquivos falha**:
   - Verifique as permissões do bucket
   - Confirme o tamanho máximo do arquivo

4. **Queries lentas**:
   - Verifique os índices no banco
   - Otimize as queries

### Logs Úteis

```bash
# Logs do Cloudflare Workers
wrangler tail

# Logs do Supabase (no dashboard)
# Settings > Logs
```

## 📝 7. Próximos Passos

- [ ] Configurar backup automático
- [ ] Implementar monitoramento de uptime
- [ ] Configurar alertas de erro
- [ ] Otimizar performance
- [ ] Implementar testes automatizados
- [ ] Configurar CI/CD

## 🆘 Suporte

Em caso de problemas:

1. Verifique os logs no Supabase e Cloudflare
2. Consulte a documentação oficial:
   - [Supabase Docs](https://supabase.com/docs)
   - [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
3. Verifique as issues no GitHub do projeto

---

**✅ Checklist de Deploy:**

- [ ] Projeto criado no Supabase
- [ ] Schema do banco executado
- [ ] Bucket de storage criado
- [ ] Variáveis de ambiente configuradas
- [ ] Código atualizado para Supabase
- [ ] Deploy realizado no Cloudflare
- [ ] Testes em produção executados
- [ ] Monitoramento configurado

**🎉 Parabéns! Sua aplicação MedFatura está no ar!**