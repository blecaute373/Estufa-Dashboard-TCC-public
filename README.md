# 🌿 Estufa 01 — Sistema de Autenticação

## Estrutura
```
estufa/
├── server.js          ← Servidor Express (auth + API)
├── package.json
├── estufa.db          ← Banco SQLite (criado automaticamente)
├── .jwt_secret        ← Chave JWT (criada automaticamente, NÃO commite)
└── public/
    ├── login.html     ← Tela de login/registro
    ├── dashboard.html ← Dashboard protegido
    ├── admin.html     ← Painel de logs de acesso
    └── style.css      ← CSS do dashboard
```

## Instalação

```bash
npm install
node server.js
```

Acesse http://localhost:3000

## Fluxo de Acesso

1. **Primeiro acesso** → `/login` detecta que não há usuários e abre aba "Registrar"
2. **Registro** → usuário cria conta com nome, e-mail e senha
3. **Login** → usuário entra com nome ou e-mail + senha
4. **Dashboard** → protegido por JWT (cookie httpOnly)
5. **Qualquer pessoa** pode se registrar (registro aberto)

## Segurança

| Camada | Implementação |
|--------|--------------|
| Senhas | bcryptjs com 12 rounds de salt |
| Sessão | JWT httpOnly cookie (8h) |
| Brute-force | Rate limit: 20 req / 15 min por IP |
| Erros | Mensagem genérica (não revela se usuário existe) |
| Segredo JWT | 64 bytes aleatórios, gerado uma vez, salvo em `.jwt_secret` |

## Em Produção (HTTPS)

Descomente no `server.js`:
```js
// secure: true   // ← linha nas opções de cookie
```

E rode atrás de NGINX/Caddy com certificado SSL.

## Painel Admin

`/admin` → Logs de acesso em tempo real:
- Data/hora, usuário, evento, IP, User-Agent
- Filtros por tipo de evento
- Lista de usuários cadastrados
