/**
 * VALIS — FCM: push sob demanda + lembrete diário de ponto
 *
 * Deploy:
 *   firebase init functions
 *   npm i firebase-admin firebase-functions
 *   copie/mescle este arquivo em functions/index.js
 *   firebase deploy --only functions
 *
 * Agendar 17:55 horário de Brasília (America/Sao_Paulo):
 *   - Firebase Console > Functions > lembretePontoDiario
 *   - ou Cloud Scheduler: 55 17 * * *  (timezone America/Sao_Paulo)
 *
 * Tokens ficam em Firestore: valis/fcm_tokens
 * Estrutura por usuário:
 *   { silva: { token, lembAtivo, lembHora, lembTexto, nome, ... }, ... }
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp();

function coletarDestinos(data, { soLembreteAtivo, horaAgora } = {}) {
  const out = [];
  if (!data || typeof data !== 'object') return out;
  Object.keys(data).forEach((k) => {
    if (k === 'updatedAt' || k === 'tokens') return;
    const v = data[k];
    if (!v) return;
    if (typeof v === 'string' && v.length > 20) {
      out.push({ user: k, token: v, lembAtivo: true, lembHora: '17:55', lembTexto: '' });
      return;
    }
    if (typeof v === 'object' && v.token && String(v.token).length > 20) {
      if (soLembreteAtivo && !v.lembAtivo) return;
      if (horaAgora && v.lembHora && String(v.lembHora).slice(0, 5) !== horaAgora) return;
      out.push({
        user: k,
        token: v.token,
        lembAtivo: !!v.lembAtivo,
        lembHora: v.lembHora || '17:55',
        lembTexto: v.lembTexto || 'Hora de bater o ponto na usina!'
      });
    }
  });
  // formato alternativo data.tokens
  if (data.tokens && typeof data.tokens === 'object') {
    Object.keys(data.tokens).forEach((k) => {
      const t = data.tokens[k];
      if (typeof t === 'string' && t.length > 20) out.push({ user: k, token: t, lembAtivo: true, lembHora: '17:55', lembTexto: '' });
    });
  }
  return out;
}

async function enviarLista(destinos, titleFn, bodyFn) {
  const tokens = destinos.map((d) => d.token).filter(Boolean);
  if (!tokens.length) return { success: 0, failure: 0 };
  // sendEachForMulticast em lotes de 500
  let success = 0, failure = 0;
  for (let i = 0; i < tokens.length; i += 500) {
    const slice = destinos.slice(i, i + 500);
    const resp = await admin.messaging().sendEachForMulticast({
      tokens: slice.map((d) => d.token),
      notification: {
        title: titleFn(slice[0]),
        body: bodyFn(slice[0])
      },
      webpush: {
        fcmOptions: { link: '/' },
        notification: {
          requireInteraction: true,
          tag: 'valis-lemb-ponto',
          vibrate: [200, 100, 200, 100, 200]
        }
      },
      data: { tipo: 'lembrete_ponto' }
    });
    success += resp.successCount;
    failure += resp.failureCount;
  }
  return { success, failure };
}

/** HTTP: envio manual (teste / painel) */
exports.enviarPushValis = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('POST only');
  const secret = process.env.VALIS_PUSH_SECRET || (functions.config().valis && functions.config().valis.push_secret);
  if (secret && req.get('x-valis-secret') !== secret) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const { title, body, token, user } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'title e body obrigatórios' });
  try {
    const snap = await admin.firestore().collection('valis').doc('fcm_tokens').get();
    const data = snap.exists ? snap.data() : {};
    let destinos = coletarDestinos(data);
    if (token) destinos = [{ user: 'manual', token, lembAtivo: true, lembHora: '', lembTexto: body }];
    if (user) destinos = destinos.filter((d) => d.user === String(user).toLowerCase());
    const r = await enviarLista(destinos, () => title, () => body);
    res.json({ ok: true, ...r, n: destinos.length });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

/**
 * Agenda diária 17:55 America/Sao_Paulo (ajuste se mudar o horário padrão).
 * Quem configurou outra hora no app: a function filtra por lembHora === "17:55".
 * Para cobrir vários horários, rode a cada 5 min (ver lembretePontoTick).
 */
exports.lembretePontoDiario = functions.pubsub
  .schedule('55 17 * * *')
  .timeZone('America/Sao_Paulo')
  .onRun(async () => {
    const snap = await admin.firestore().collection('valis').doc('fcm_tokens').get();
    const data = snap.exists ? snap.data() : {};
    const destinos = coletarDestinos(data, { soLembreteAtivo: true, horaAgora: '17:55' });
    const r = await enviarLista(
      destinos,
      () => '⏰ VALIS — Bater o ponto',
      (d) => d.lembTexto || 'Hora de bater o ponto na usina! Faça o check-in no app.'
    );
    console.log('lembretePontoDiario', r, 'destinos', destinos.length);
    return null;
  });

/**
 * A cada 5 minutos: envia para quem configurou lembHora igual ao HH:mm atual (Brasília).
 * Preferível se cada vigilante tiver horário diferente.
 */
exports.lembretePontoTick = functions.pubsub
  .schedule('every 5 minutes')
  .timeZone('America/Sao_Paulo')
  .onRun(async () => {
    const now = new Date();
    // horário em America/Sao_Paulo
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = fmt.formatToParts(now);
    const hh = parts.find((p) => p.type === 'hour').value;
    const mm = parts.find((p) => p.type === 'minute').value;
    const horaAgora = `${hh}:${mm}`;
    // só minutos múltiplos de 5 batem com schedule "every 5 minutes"
    const snap = await admin.firestore().collection('valis').doc('fcm_tokens').get();
    const data = snap.exists ? snap.data() : {};
    const destinos = coletarDestinos(data, { soLembreteAtivo: true, horaAgora });
    if (!destinos.length) {
      console.log('lembretePontoTick sem destinos', horaAgora);
      return null;
    }
    const r = await enviarLista(
      destinos,
      () => '⏰ VALIS — Bater o ponto',
      (d) => d.lembTexto || 'Hora de bater o ponto na usina!'
    );
    console.log('lembretePontoTick', horaAgora, r);
    return null;
  });
