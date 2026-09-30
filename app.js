/* ==========================================================================
   BLOCO 1 DE 3: CONFIGURAÇÃO, SUPABASE, NOTIFICAÇÕES E GEOFENCING
   ========================================================================== */

// 1. CREDENCIAIS DO SUPABASE
const SUPABASE_URL = "https://sxrthryhzodryrzndveg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_3FDSO7qfonD0BLRTzPT6bA_7a7jUarD";        // Insira a chave pública (anon key) aqui

// Inicialização do cliente Supabase
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// 2. CONFIGURAÇÕES E ESTADO GLOBAL
const COORDENADAS_USINA = { lat: -22.5412, lng: -43.6854, raioMetros: 500 };
const DEV_PASSWORD_HASH = "valis2026"; // Senha do Menu Dev

let dbOffline = null;
let idDispositivoLocal = localStorage.getItem("device_id") || `DEV-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
localStorage.setItem("device_id", idDispositivoLocal);

// 3. MÓDULO DE NOTIFICAÇÕES (WEB NOTIFICATIONS API + TOASTS IN-APP)
const SistemaNotificacoes = {
  async solicitarPermissao() {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      const permissao = await Notification.requestPermission();
      return permissao === "granted";
    }
    return Notification.permission === "granted";
  },

  enviar(titulo, mensagem, tipo = "info") {
    // 1. Notificação Nativa do Navegador/Android (Termux/PWA)
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(titulo, {
        body: mensagem,
        icon: "/assets/icon-192.png",
        vibrate: [200, 100, 200]
      });
    }

    // 2. Notificação Visual na Tela (Toast)
    this.exibirToast(`${titulo}: ${mensagem}`, tipo);
  },

  exibirToast(texto, tipo) {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.style.cssText = "position: fixed; bottom: 20px; right: 20px; z-index: 9999;";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    const cores = {
      info: "#0284c7",
      success: "#16a34a",
      warning: "#d97706",
      danger: "#dc2626"
    };

    toast.style.cssText = `
      background: ${cores[tipo] || cores.info};
      color: #fff;
      padding: 12px 20px;
      margin-top: 8px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      font-family: sans-serif;
      font-size: 14px;
      transition: opacity 0.3s ease;
    `;
    toast.innerText = texto;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
};

// 4. MÓDULO DE GEOFENCING E GPS
function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Raio da Terra em metros
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function obterLocalizacaoAtual() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalização não suportada no dispositivo."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

async function verificarGeofencingUsinas() {
  try {
    const coords = await obterLocalizacaoAtual();
    const distancia = calcularDistanciaHaversine(
      coords.lat, coords.lng,
      COORDENADAS_USINA.lat, COORDENADAS_USINA.lng
    );

    const dentroDoPerimetro = distancia <= COORDENADAS_USINA.raioMetros;
    if (!dentroDoPerimetro) {
      SistemaNotificacoes.enviar(
        "Aviso de Geofencing",
        `Você está a ${Math.round(distancia)}m da usina. Registros fora de raio serão marcados para auditoria.`,
        "warning"
      );
    }
    return { dentroDoPerimetro, distancia, coords };
  } catch (error) {
    SistemaNotificacoes.enviar("Erro de GPS", "Não foi possível obter sua localização exata.", "danger");
    return { dentroDoPerimetro: false, distancia: null, coords: null };
  }
}
/* ==========================================================================
   BLOCO 2 DE 3: BANCO OFFLINE (INDEXEDDB), PONTO E ALERTAS DE FADIGA
   ========================================================================== */

// 5. INICIALIZAÇÃO DO INDEXEDDB LOCAL
function inicializarIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("ValisAppDB", 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("fila_offline")) {
        db.createObjectStore("fila_offline", { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = (e) => {
      dbOffline = e.target.result;
      resolve(dbOffline);
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

async function salvarNaFilaOffline(dados) {
  if (!dbOffline) await inicializarIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = dbOffline.transaction("fila_offline", "readwrite");
    const store = tx.objectStore("fila_offline");
    store.add({ ...dados, timestamp: new Date().toISOString() });
    tx.oncomplete = () => {
      SistemaNotificacoes.enviar("Modo Offline", "Registro salvo localmente. Será sincronizado quando houver rede.", "info");
      resolve(true);
    };
    tx.onerror = () => reject(tx.error);
  });
}

// 6. MONITORAMENTO DE FADIGA
function verificarAlertaFadiga(horasSono, tipoTurno) {
  const limiteMinimo = (tipoTurno === "NOTURNO" || tipoTurno === "24H") ? 6 : 5;
  if (horasSono < limiteMinimo) {
    SistemaNotificacoes.enviar(
      "Alerta Crítico de Fadiga",
      `Atenção: Apenas ${horasSono}h de sono registradas para o turno ${tipoTurno}. Mantenha cautela redobrada na ronda!`,
      "danger"
    );
    return true;
  }
  return false;
}

// 7. REGISTRO DE PONTO INTEGRADO
async function baterPonto(tipoPonto, horasSono, tipoTurno) {
  SistemaNotificacoes.solicitarPermissao();
  
  // Avalia Fadiga
  verificarAlertaFadiga(horasSono, tipoTurno);

  // Valida Posição GPS
  const geo = await verificarGeofencingUsinas();

  const payloadPonto = {
    device_id: idDispositivoLocal,
    tipo: tipoPonto,
    horas_sono: horasSono,
    turno: tipoTurno,
    latitude: geo.coords ? geo.coords.lat : null,
    longitude: geo.coords ? geo.coords.lng : null,
    fora_do_raio: !geo.dentroDoPerimetro,
    criado_em: new Date().toISOString()
  };

  // Tenta envio online ou guarda offline
  if (navigator.onLine && supabase) {
    try {
      const { error } = await supabase.from("registros_ponto").insert([payloadPonto]);
      if (error) throw error;
      SistemaNotificacoes.enviar("Ponto Registrado", `Ponto (${tipoPonto}) confirmado no servidor!`, "success");
    } catch (err) {
      await salvarNaFilaOffline(payloadPonto);
    }
  } else {
    await salvarNaFilaOffline(payloadPonto);
  }
}
/* ==========================================================================
   BLOCO 3 DE 3: PRESENÇA, SINCRONIZAÇÃO, MENU DEV E INICIALIZAÇÃO
   ========================================================================== */

// 8. PRESENÇA DE DISPOSITIVO E SINCRONIZAÇÃO DE FILA
async function registrarPresencaDispositivo() {
  if (!navigator.onLine || !supabase) return;

  try {
    await supabase.from("dispositivos_ativos").upsert({
      device_id: idDispositivoLocal,
      ultimo_ping: new Date().toISOString(),
      status: "ONLINE"
    });
  } catch (e) {
    console.warn("Falha ao registrar presença do dispositivo:", e);
  }
}

async function sincronizarFilaOffline() {
  if (!navigator.onLine || !dbOffline || !supabase) return;

  const tx = dbOffline.transaction("fila_offline", "readwrite");
  const store = tx.objectStore("fila_offline");
  const request = store.getAll();

  request.onsuccess = async () => {
    const itens = request.result;
    if (itens.length === 0) return;

    for (const item of itens) {
      const { id, ...dadosEnvio } = item;
      try {
        const { error } = await supabase.from("registros_ponto").insert([dadosEnvio]);
        if (!error) {
          const deleteTx = dbOffline.transaction("fila_offline", "readwrite");
          deleteTx.objectStore("fila_offline").delete(id);
        }
      } catch (e) {
        console.error("Erro na sincronização:", e);
      }
    }
    SistemaNotificacoes.enviar("Sincronização", "Dados offline enviados com sucesso!", "success");
  };
}

// 9. MENU DEVELOPER E FERRAMENTAS DO SISTEMA
function abrirMenuDev() {
  const senha = prompt("Digite a senha do Menu Developer:");
  if (senha === DEV_PASSWORD_HASH) {
    SistemaNotificacoes.enviar("Acesso Dev", "Menu de desenvolvedor desbloqueado.", "info");
    const devPanel = document.getElementById("dev-panel");
    if (devPanel) devPanel.classList.remove("hidden");
  } else {
    SistemaNotificacoes.enviar("Acesso Negado", "Senha incorreta do Menu Dev.", "danger");
  }
}

async function testarConexaoDev() {
  const inicio = Date.now();
  if (!navigator.onLine || !supabase) {
    SistemaNotificacoes.enviar("Diagnóstico Dev", "Dispositivo sem conexão com a rede/servidor.", "warning");
    return;
  }
  try {
    const { error } = await supabase.from("dispositivos_ativos").select("count", { count: "exact", head: true });
    const latencia = Date.now() - inicio;
    if (error) throw error;
    SistemaNotificacoes.enviar("Diagnóstico Dev", `Conexão Ok! Latência da nuvem: ${latencia}ms`, "success");
  } catch (err) {
    SistemaNotificacoes.enviar("Diagnóstico Dev", "Erro ao conectar ao Supabase.", "danger");
  }
}

function exportarBackupDev() {
  if (!dbOffline) return;
  const tx = dbOffline.transaction("fila_offline", "readonly");
  const request = tx.objectStore("fila_offline").getAll();
  
  request.onsuccess = () => {
    const dados = JSON.stringify(request.result, null, 2);
    const blob = new Blob([dados], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_valis_${idDispositivoLocal}.json`;
    a.click();
    SistemaNotificacoes.enviar("Backup Dev", "Fila offline exportada com sucesso.", "success");
  };
}

function hardResetDev() {
  if (confirm("Atenção: Isso apagará todas as configurações locais e fila offline. Confirmar?")) {
    localStorage.clear();
    if (indexedDB) indexedDB.deleteDatabase("ValisAppDB");
    SistemaNotificacoes.enviar("Reset Dev", "Dados locais redefinidos. Recarregando...", "warning");
    setTimeout(() => location.reload(), 1500);
  }
}

// 10. EXPOSIÇÃO EXPLICITA DE FUNÇÕES AO ESCOPO GLOBAL (HTML ONCLICK)
window.baterPonto = baterPonto;
window.abrirMenuDev = abrirMenuDev;
window.testarConexaoDev = testarConexaoDev;
window.exportarBackupDev = exportarBackupDev;
window.hardResetDev = hardResetDev;
window.verificarGeofencingUsinas = verificarGeofencingUsinas;
window.SistemaNotificacoes = SistemaNotificacoes;

// 11. EVENT LISTENERS E INICIALIZAÇÃO GERAL
window.addEventListener("online", () => {
  SistemaNotificacoes.enviar("Conexão Restabelecida", "Você está online novamente.", "success");
  sincronizarFilaOffline();
});

window.addEventListener("offline", () => {
  SistemaNotificacoes.enviar("Sem Conexão", "Você está trabalhando em modo offline.", "warning");
});

document.addEventListener("DOMContentLoaded", async () => {
  await inicializarIndexedDB();
  SistemaNotificacoes.solicitarPermissao();

  // Batimento contínuo de presença (ping a cada 60s)
  registrarPresencaDispositivo();
  setInterval(registrarPresencaDispositivo, 60000);

  // Tentativa periódica de sincronização offline
  setInterval(sincronizarFilaOffline, 30000);
});
