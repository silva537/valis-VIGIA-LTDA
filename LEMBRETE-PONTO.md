# Lembrete diário de ponto (usina)

## No app (já incluso na 9.1.0)

1. Login → **Perfil (Mais)** → card **Lembrete de ponto**
2. Ative o lembrete, horário (ex.: **17:55**), texto
3. **Salvar lembrete**
4. **Ativar push (app fechado) + sincronizar** (pede permissão de notificação e grava token FCM)

### Comportamento

| Situação | Funciona? |
|----------|-----------|
| App aberto | Sim (verifica a cada 30s) |
| App em segundo plano (navegador/PWA vivo) | Em geral sim (notificação local) |
| App **fechado / morto** | Só com **FCM + Cloud Function** agendada |

## Firebase (app fechado de verdade)

1. Deploy das functions em `functions-fcm-sample.js`
2. Publique `lembretePontoTick` (a cada 5 min) **ou** `lembretePontoDiario` (17:55 fixo)
3. No app, cada usuário ativa o lembrete e o push — o token vai para `valis/fcm_tokens`

Horário usa timezone **America/Sao_Paulo**.
