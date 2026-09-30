/* ==========================================================================
   BLOCO 1 DE 3: CONFIGURAÇÃO, SUPABASE, NOTIFICAÇÕES, GEOFENCING E SUPORTE
   ========================================================================== */

// CREDENCIAIS DO SUPABASE
const SUPABASE_URL = "https://sxrthryhzodryrzndveg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_3FDSO7qfonD0BLRTzPT6bA_7a7jUarD";

// Inicialização do cliente Supabase Global
const _supabase = (window.supabase && window.supabase.createClient) 
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
    : null;

// CONFIGURAÇÕES E ESTADO GLOBAL
const COORDENADAS_USINA = { lat: -22.5412, lng: -43.6854, raioMetros: 500 };
const DEV_PASSWORD_HASH = "valis2026";

let dbOffline = null;
let modoOfflineSimulado = false;
let idDispositivoLocal = localStorage.getItem("device_id") || `DEV-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
localStorage.setItem("device_id", idDispositivoLocal);

// MÓDULO DE NOTIFICAÇÕES (WEB NOTIFICATIONS API + TOASTS IN-APP)
const SistemaNotificacoes = {
  async solicitarPermissao() {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      const permissao = await Notification.requestPermission();
      return permissao === "granted";
    }
    return Notification.permission === "granted";
  },

  enviar(titulo, mensagem, tipo = "info") {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(titulo, {
          body: mensagem,
          icon: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
          vibrate: [200, 100, 200]
        });
      } catch (e) {
        console.warn("Erro ao disparar notificação nativa:", e);
      }
    }
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
      box-shadow: 0 4px 6px rgba(0,0,0,0.2);
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

// MÓDULO DE GEOFENCING E GPS
function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
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

// INICIALIZAÇÃO DO INDEXEDDB LOCAL
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
      SistemaNotificacoes.enviar("Modo Offline", "Registro salvo localmente na fila. Será sincronizado na reconexão.", "info");
      resolve(true);
    };
    tx.onerror = () => reject(tx.error);
  });
}

// MONITORAMENTO DE FADIGA
function verificarAlertaFadiga(horasSono, tipoTurno) {
  const painel = document.getElementById("painelAlertaFadiga");
  const limiteMinimo = (tipoTurno === "Noturno" || tipoTurno === "24h") ? 6 : 5;
  
  if (painel) {
    if (horasSono > 0 && horasSono < limiteMinimo) {
      painel.style.display = "block";
      painel.style.backgroundColor = "rgba(220, 38, 38, 0.2)";
      painel.style.border = "1px solid #dc2626";
      painel.style.color = "#f87171";
      painel.innerText = `⚠️ Atenção: Apenas ${horasSono}h de sono para o turno ${tipoTurno}. Risco elevado de fadiga!`;
    } else {
      painel.style.display = "none";
    }
  }

  if (horasSono < limiteMinimo && horasSono > 0) {
    SistemaNotificacoes.enviar(
      "Alerta Crítico de Fadiga",
      `Atenção: Apenas ${horasSono}h de sono registradas para o turno ${tipoTurno}. Cautela redobrada na ronda!`,
      "danger"
    );
    return true;
  }
  return false;
}

// REGISTRO DE PONTO INTEGRADO
async function registrarPonto(tipoPonto) {
  SistemaNotificacoes.solicitarPermissao();
  
  const horasSono = parseFloat(document.getElementById("sono")?.value || 0);
  const tipoTurno = document.getElementById("turno")?.value || "Manhã";

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
  if (navigator.onLine && !modoOfflineSimulado && _supabase) {
    try {
      const { error } = await _supabase.from("logs_ponto").insert([payloadPonto]);
      if (error) throw error;
      SistemaNotificacoes.enviar("Ponto Registrado", `Ponto (${tipoPonto}) confirmado na nuvem!`, "success");
    } catch (err) {
      console.error("Erro no envio do ponto:", err);
      await salvarNaFilaOffline(payloadPonto);
    }
  } else {
    await salvarNaFilaOffline(payloadPonto);
  }

  // Atualiza Log Local
  const logsLocais = JSON.parse(localStorage.getItem("logs_ponto") || "[]");
  logsLocais.unshift({
    tipo: tipoPonto,
    horario: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    data: new Date().toLocaleDateString("pt-BR")
  });
  localStorage.setItem("logs_ponto", JSON.stringify(logsLocais));

  if (typeof renderizarLogsPonto === "function") {
    renderizarLogsPonto();
  }
}

function registrarSaidaAlmoco() {
  registrarPonto("Saída Almoço");
}

function registrarRetornoAlmoco() {
  registrarPonto("Retorno Almoço");
}
/* ==========================================================================
   BLOCO 3 DE 3: MENUS (DEV & SISTEMA), SINCRONIZAÇÃO E INICIALIZAÇÃO
   ========================================================================== */

// PRESENÇA DE DISPOSITIVO E SINCRONIZAÇÃO DE FILA
async function registrarPresencaDispositivo() {
  if (!navigator.onLine || modoOfflineSimulado || !_supabase) return;

  try {
    await _supabase.from("dispositivos_ativos").upsert({
      device_id: idDispositivoLocal,
      ultimo_ping: new Date().toISOString(),
      status: "ONLINE"
    }, { onConflict: 'device_id' });
  } catch (e) {
    console.warn("Falha ao registrar presença do dispositivo:", e);
  }
}

async function sincronizarFilaOffline() {
  if (!navigator.onLine || modoOfflineSimulado || !dbOffline || !_supabase) return;

  const tx = dbOffline.transaction("fila_offline", "readwrite");
  const store = tx.objectStore("fila_offline");
  const request = store.getAll();

  request.onsuccess = async () => {
    const itens = request.result;
    if (!itens || itens.length === 0) return;

    for (const item of itens) {
      const { id, timestamp, ...dadosEnvio } = item;
      try {
        const { error } = await _supabase.from("logs_ponto").insert([dadosEnvio]);
        if (!error) {
          const deleteTx = dbOffline.transaction("fila_offline", "readwrite");
          deleteTx.objectStore("fila_offline").delete(id);
        }
      } catch (e) {
        console.error("Erro na sincronização:", e);
      }
    }
    SistemaNotificacoes.enviar("Sincronização", "Dados da fila offline enviados com sucesso!", "success");
  };
}

// LÓGICA DO MENU DEVELOPER E MENU SISTEMA/ATUALIZAÇÕES (CORRIGIDO)

// Alterna a abertura do Menu Sistema (Engrenagem ⚙)
function toggleMenuSistema(event) {
  if (event) event.stopPropagation();
  
  const sistemaDropdown = document.getElementById("sistemaDropdown");
  const devDropdown = document.getElementById("devDropdown");
  
  if (devDropdown) devDropdown.classList.remove("show"); // Fecha o menu Dev se estiver aberto
  
  if (sistemaDropdown) {
    sistemaDropdown.classList.toggle("show");
  }
}

// Abre/libera o Menu Developer (Ferramentas 🛠️)
function abrirMenuDev(event) {
  if (event) event.stopPropagation();

  const devDropdown = document.getElementById("devDropdown");
  const sistemaDropdown = document.getElementById("sistemaDropdown");

  if (sistemaDropdown) sistemaDropdown.classList.remove("show"); // Fecha o menu Sistema se estiver aberto

  if (devDropdown && devDropdown.classList.contains("show")) {
    devDropdown.classList.remove("show");
    return;
  }

  // Verifica se já foi liberado na sessão para não pedir senha toda hora
  if (sessionStorage.getItem("dev_unlocked") === "true") {
    if (devDropdown) devDropdown.classList.add("show");
    atualizarTagDev(true);
    return;
  }

  const senha = prompt("Digite a senha do Menu Developer:");
  if (senha === DEV_PASSWORD_HASH) {
    sessionStorage.setItem("dev_unlocked", "true");
    SistemaNotificacoes.enviar("Acesso Dev", "Menu de desenvolvedor desbloqueado.", "info");
    if (devDropdown) devDropdown.classList.add("show");
    atualizarTagDev(true);
  } else if (senha !== null) {
    SistemaNotificacoes.enviar("Acesso Negado", "Senha incorreta do Menu Dev.", "danger");
  }
}

function bloquearMenuDev() {
  const devDropdown = document.getElementById("devDropdown");
  if (devDropdown) devDropdown.classList.remove("show");
  sessionStorage.removeItem("dev_unlocked");
  atualizarTagDev(false);
  SistemaNotificacoes.enviar("Menu Dev", "Sessão do Menu Dev bloqueada.", "info");
}

function atualizarTagDev(liberado) {
  const tag = document.getElementById("statusDevTag");
  if (tag) {
    if (liberado) {
      tag.innerText = "LIBERADO";
      tag.className = "status-tag active";
    } else {
      tag.innerText = "PROTEGIDO";
      tag.className = "status-tag dev-tag";
    }
  }
}

// AÇÕES DO MENU SISTEMA / ATUALIZAÇÕES
async function forcarVerificacaoAtualizacao() {
  SistemaNotificacoes.enviar("Atualização", "Buscando novas versões...", "info");
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        SistemaNotificacoes.enviar("Atualização", "Service Worker atualizado! Recarregando...", "success");
        setTimeout(() => window.location.reload(), 1200);
      } else {
        window.location.reload();
      }
    } catch (e) {
      window.location.reload();
    }
  } else {
    window.location.reload();
  }
}

function limparCacheERecarregar() {
  if (confirm("Isso limpará os arquivos em cache do navegador e recarregará o aplicativo. Continuar?")) {
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (let name of names) caches.delete(name);
      });
    }
    localStorage.removeItem("pwa_cache_version");
    SistemaNotificacoes.enviar("Cache Limpo", "Recarregando a aplicação...", "warning");
    setTimeout(() => window.location.reload(true), 1000);
  }
}

// FERRAMENTAS DEV AUXILIARES
function alternarModoOffline() {
  modoOfflineSimulado = !modoOfflineSimulado;
  const btn = document.getElementById("btnModoOffline");
  if (btn) {
    btn.innerHTML = `🌐 Modo Offline Simulado: <strong style="color:${modoOfflineSimulado ? '#ef4444' : '#10b981'}">${modoOfflineSimulado ? 'ON' : 'OFF'}</strong>`;
  }
  SistemaNotificacoes.enviar("Modo Offline Simulado", `Simulação alterada para: ${modoOfflineSimulado ? 'ATIVADA' : 'DESATIVADA'}`, modoOfflineSimulado ? "warning" : "info");
}

function testarVibracao() {
  if (navigator.vibrate) {
    navigator.vibrate([100, 50, 100, 50, 200]);
    SistemaNotificacoes.enviar("Haptic Test", "Padrão de vibração acionado.", "info");
  } else {
    SistemaNotificacoes.enviar("Haptic Test", "Vibração não suportada neste dispositivo.", "warning");
  }
}

function testarPingSupabase() {
  const inicio = Date.now();
  if (!_supabase) {
    SistemaNotificacoes.enviar("Ping Falhou", "Cliente Supabase não inicializado.", "danger");
    return;
  }
  _supabase.from("dispositivos_ativos").select("count", { count: "exact", head: true })
    .then(({ error }) => {
      const latencia = Date.now() - inicio;
      if (error) {
        SistemaNotificacoes.enviar("Erro Ping", error.message, "danger");
      } else {
        SistemaNotificacoes.enviar("Ping Nuvem", `Resposta do Supabase: ${latencia}ms`, "success");
      }
    });
}

function toggleCSSOutline() {
  document.body.classList.toggle("debug-outline");
  SistemaNotificacoes.enviar("Debugger Visual", "CSS Outline alternado.", "info");
}

function mostrarConsoleLocal() {
  let devConsole = document.getElementById("devConsoleScreen");
  if (!devConsole) {
    devConsole = document.createElement("div");
    devConsole.id = "devConsoleScreen";
    devConsole.style.cssText = "position:fixed; bottom:0; left:0; width:100%; height:150px; background:rgba(0,0,0,0.9); color:#00ffcc; font-family:monospace; font-size:11px; padding:10px; overflow-y:scroll; z-index:9999; border-top:2px solid #00ffcc;";
    document.body.appendChild(devConsole);
  } else {
    devConsole.style.display = devConsole.style.display === "none" ? "block" : "none";
  }
}

function injetarDadosTeste() {
  document.getElementById("data").value = new Date().toISOString().split("T")[0];
  document.getElementById("sono").value = "7";
  document.getElementById("valor").value = "120.00";
  document.getElementById("obs").value = "Plantão de teste injetado via Menu Dev.";
  SistemaNotificacoes.enviar("Mock Data", "Dados de teste inseridos nos campos.", "info");
}

function exportarBackupDev() {
  if (!dbOffline) return;
  const tx = dbOffline.transaction("fila_offline", "readonly");
  const request = tx.objectStore("fila_offline").getAll();
  
  request.onsuccess = () => {
    const dados = {
      plantoes: JSON.parse(localStorage.getItem("plantoes")) || [],
      logs_ponto: JSON.parse(localStorage.getItem("logs_ponto")) || [],
      fila_offline: request.result
    };
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_valis_${idDispositivoLocal}.json`;
    a.click();
    SistemaNotificacoes.enviar("Backup Dev", "Dados locais exportados com sucesso.", "success");
  };
}

function importarBackupJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const json = JSON.parse(e.target.result);
      if (json.plantoes) localStorage.setItem("plantoes", JSON.stringify(json.plantoes));
      if (json.logs_ponto) localStorage.setItem("logs_ponto", JSON.stringify(json.logs_ponto));
      SistemaNotificacoes.enviar("Importação", "Backup importado com sucesso! Recarregando...", "success");
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      SistemaNotificacoes.enviar("Erro Backup", "Arquivo JSON inválido.", "danger");
    }
  };
  reader.readAsText(file);
}

function hardResetDev() {
  if (confirm("Atenção: Isso apagará todas as configurações locais e fila offline. Confirmar?")) {
    localStorage.clear();
    sessionStorage.clear();
    if (indexedDB) indexedDB.deleteDatabase("ValisAppDB");
    SistemaNotificacoes.enviar("Reset Dev", "Dados locais redefinidos. Recarregando...", "warning");
    setTimeout(() => location.reload(), 1500);
  }
}

// Fechar menus ao clicar fora deles
document.addEventListener("click", (e) => {
  const isDevWrapper = e.target.closest(".dev-menu-wrapper");
  if (!isDevWrapper) {
    const devDropdown = document.getElementById("devDropdown");
    const sistemaDropdown = document.getElementById("sistemaDropdown");
    if (devDropdown) devDropdown.classList.remove("show");
    if (sistemaDropdown) sistemaDropdown.classList.remove("show");
  }
});

// EXPOSIÇÃO EXPLICITA DE FUNÇÕES AO ESCOPO GLOBAL
window.registrarPonto = registrarPonto;
window.registrarSaidaAlmoco = registrarSaidaAlmoco;
window.registrarRetornoAlmoco = registrarRetornoAlmoco;
window.abrirMenuDev = abrirMenuDev;
window.bloquearMenuDev = bloquearMenuDev;
window.toggleMenuSistema = toggleMenuSistema;
window.forcarVerificacaoAtualizacao = forcarVerificacaoAtualizacao;
window.limparCacheERecarregar = limparCacheERecarregar;
window.alternarModoOffline = alternarModoOffline;
window.testarVibracao = testarVibracao;
window.testarPingSupabase = testarPingSupabase;
window.toggleCSSOutline = toggleCSSOutline;
window.mostrarConsoleLocal = mostrarConsoleLocal;
window.injetarDadosTeste = injetarDadosTeste;
window.exportarBackupDev = exportarBackupDev;
window.importarBackupJSON = importarBackupJSON;
window.hardResetDev = hardResetDev;
window.verificarGeofencingUsinas = verificarGeofencingUsinas;
window.SistemaNotificacoes = SistemaNotificacoes;

// EVENT LISTENERS E INICIALIZAÇÃO GERAL
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

  registrarPresencaDispositivo();
  setInterval(registrarPresencaDispositivo, 60000);

  setInterval(sincronizarFilaOffline, 30000);
});
