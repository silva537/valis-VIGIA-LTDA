// --- PARTE 1/2: SUPABASE, INDEXEDDB, GPS, STORAGE E REGISTRO DE PONTO ---
const SUPABASE_URL = 'https://sxrthryhzodryrzndveg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4cnRocnloem9kcnlyem5kdmVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MzQ1NDksImV4cCI6MjEwNjIxMDU0OX0.83mFWcQ9LZvklAxPIH9vtWytIvZkW7_ZFXZXKmFzZdo';

let _supabase = null;
window.modoOfflineSimulado = false; 
let dbOffline = null;

// Funções de Armazenamento Local (Essenciais para o extrato e dashboard)
function buscarPlantoes() {
    try {
        return JSON.parse(localStorage.getItem("plantoes")) || [];
    } catch (e) {
        return [];
    }
}

function salvarStorage(plantoes) {
    localStorage.setItem("plantoes", JSON.stringify(plantoes));
}

function atualizarDashboard() {
    const plantoes = buscarPlantoes();
    let totalRecebido = plantoes.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);
    
    const elTotal = document.getElementById("totalRecebido");
    if (elTotal) elTotal.innerText = `R$ ${totalRecebido.toFixed(2)}`;

    const elMeta = document.getElementById("metaProgresso");
    if (elMeta && metaFinanceira > 0) {
        let prog = (totalRecebido / metaFinanceira) * 100;
        elMeta.style.width = `${Math.min(prog, 100)}%`;
    }
}

function inicializarIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("ValisPontoDB", 1);
        request.onerror = (e) => reject(e);
        request.onsuccess = (e) => {
            dbOffline = e.target.result;
            resolve(dbOffline);
        };
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("fila_offline")) {
                db.createObjectStore("fila_offline", { keyPath: "id", autoIncrement: true });
            }
        };
    });
}

async function salvarNaFilaOffline(dados) {
    if (!dbOffline) await inicializarIndexedDB();
    return new Promise((resolve, reject) => {
        const transaction = dbOffline.transaction(["fila_offline"], "readwrite");
        const store = transaction.objectStore("fila_offline");
        store.add({ ...dados, timestamp: Date.now() });
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = (e) => reject(e);
    });
}

async function sincronizarFilaOffline() {
    if (!_supabase || window.modoOfflineSimulado || !dbOffline) return;
    const transaction = dbOffline.transaction(["fila_offline"], "readwrite");
    const store = transaction.objectStore("fila_offline");
    const request = store.getAll();

    request.onsuccess = async () => {
        const itens = request.result;
        if (!itens || itens.length === 0) return;

        for (const item of itens) {
            try {
                const { error } = await _supabase.from('logs_ponto').insert([item.payload]);
                if (!error) {
                    const deleteTx = dbOffline.transaction(["fila_offline"], "readwrite");
                    deleteTx.objectStore("fila_offline").delete(item.id);
                }
            } catch (err) {
                console.warn("Fila offline: falha ao reenviar item:", err);
            }
        }
    };
}

try {
    if (typeof supabase !== 'undefined') {
        _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (e) {
    console.error("Erro ao inicializar Supabase:", e);
}

const VALORES_TURNO = { "Manhã": 100.00, "Noturno": 100.00, "24h": 200.00 };
let metaFinanceira = parseFloat(localStorage.getItem("metaFinanceira")) || 1000.00;

document.addEventListener("DOMContentLoaded", async () => {
    await inicializarIndexedDB();
    sincronizarFilaOffline();
    setInterval(sincronizarFilaOffline, 30000);

    const dataInput = document.getElementById("data");
    if (dataInput) dataInput.valueAsDate = new Date();
    
    const turnoSelect = document.getElementById("turno");
    if (turnoSelect) turnoSelect.addEventListener("change", atualizarCamposTurno);

    atualizarCamposTurno();
    carregarTemaSalvo();
    renderizar();
    renderizarLogs(); 
});

function obterGPS() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve(null),
            { timeout: 8000, enableHighAccuracy: true }
        );
    });
}

function enviarNotificacaoLocal(titulo, mensagem) {
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(titulo, { body: mensagem, icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' });
        });
    }
}

function atualizarCamposTurno() {
    const turnoEl = document.getElementById("turno");
    const valorInput = document.getElementById("valor");
    const inicioInput = document.getElementById("horaInicio");
    const fimInput = document.getElementById("horaFim");

    if (!turnoEl || !valorInput) return;
    const turno = turnoEl.value;
    valorInput.value = (VALORES_TURNO[turno] || 100).toFixed(2);

    if (inicioInput && fimInput) {
        if (turno === "Manhã") { inicioInput.value = "06:00"; fimInput.value = "18:00"; }
        else if (turno === "Noturno") { inicioInput.value = "18:00"; fimInput.value = "06:00"; }
        else if (turno === "24h") { inicioInput.value = "06:00"; fimInput.value = "06:00"; }
    }
}

function toggleTema() {
    const htmlEl = document.documentElement;
    const currentTheme = htmlEl.getAttribute("data-theme");
    const themeBtn = document.getElementById("themeBtn");

    if (currentTheme === "dark") {
        htmlEl.setAttribute("data-theme", "light");
        if (themeBtn) themeBtn.innerText = "🌙 Tema Escuro";
        localStorage.setItem("temaPonto", "light");
    } else {
        htmlEl.setAttribute("data-theme", "dark");
        if (themeBtn) themeBtn.innerText = "☀️ Tema Claro";
        localStorage.setItem("temaPonto", "dark");
    }
}

function carregarTemaSalvo() {
    const temaSalvo = localStorage.getItem("temaPonto") || "dark";
    const themeBtn = document.getElementById("themeBtn");
    document.documentElement.setAttribute("data-theme", temaSalvo);
    if (themeBtn) themeBtn.innerText = temaSalvo === "dark" ? "☀️ Tema Claro" : "🌙 Tema Escuro";
}

async function registrarPonto(tipo) {
    const agora = new Date();
    const horaStr = agora.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
    const dataIso = agora.toISOString().split('T')[0];

    const coords = await obterGPS();
    
    const payloadLog = { 
        type: tipo, 
        lat: coords ? coords.lat : null, 
        lng: coords ? coords.lng : null 
    };

    if (_supabase && !window.modoOfflineSimulado) {
        try {
            const { error } = await _supabase.from('logs_ponto').insert([payloadLog]);
            if (error) {
                await salvarNaFilaOffline({ payload: payloadLog });
            }
        } catch (e) {
            await salvarNaFilaOffline({ payload: payloadLog });
        }
    } else {
        await salvarNaFilaOffline({ payload: payloadLog });
    }

    const tag = document.getElementById("statusPlantaoTag");
    const txt = document.getElementById("statusPlantaoTexto");
    const liveInfo = document.getElementById("liveInfo");

    if (tipo.includes("Check-out")) {
        const turnoSel = document.getElementById("turno").value;
        const valorVal = parseFloat(document.getElementById("valor").value) || VALORES_TURNO[turnoSel] || 100;
        const plantoes = buscarPlantoes();

        const novoPlantao = {
            id: Date.now(),
            data: document.getElementById("data").value || dataIso,
            turno: turnoSel,
            horaInicio: document.getElementById("horaInicio").value || "06:00",
            horaFim: horaStr,
            sono: parseFloat(document.getElementById("sono").value) || 0,
            valor: valorVal,
            horasExtras: parseFloat(document.getElementById("horasExtras").value) || 0,
            colega: document.getElementById("colega").value.trim(),
            obs: document.getElementById("obs").value.trim() || "Fechamento automático via Check-out",
            gps: coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : "Não obtido"
        };

        plantoes.push(novoPlantao);
        salvarStorage(plantoes);

        if (tag) { tag.className = "status-tag inactive"; tag.innerText = "INATIVO"; }
        if (txt) txt.innerText = "Plantão finalizado e registado!";
        if (liveInfo) liveInfo.style.display = "none";

        document.getElementById("colega").value = "";
        document.getElementById("obs").value = "";
        renderizar();
        renderizarLogs();
        enviarNotificacaoLocal("🔴 Plantão Encerrado", `Check-out registado às ${horaStr}.`);
        alert("🟢 Plantão fechado com sucesso!");
    } else {
        if (tag) { tag.className = "status-tag active"; tag.innerText = "EM ANDAMENTO"; }
        if (txt) txt.innerText = `Ponto em execução: ${tipo}`;
        renderizarLogs();
        enviarNotificacaoLocal("🟢 Ponto Registrado", `${tipo} efetuado com sucesso às ${horaStr}.`);
    }
}
// --- PARTE 2/2: GESTÃO, CRUD, EXPORTAÇÃO E FERRAMENTAS DEV / SISTEMA ---

function salvarPlantao() {
    const dataVal = document.getElementById("data").value;
    const valorVal = parseFloat(document.getElementById("valor").value);

    if (!dataVal || isNaN(valorVal)) {
        alert("Informe pelo menos a data e o valor base.");
        return;
    }

    const plantoes = buscarPlantoes();
    const novo = {
        id: Date.now(),
        data: dataVal,
        turno: document.getElementById("turno").value,
        horaInicio: document.getElementById("horaInicio").value,
        horaFim: document.getElementById("horaFim").value,
        sono: parseFloat(document.getElementById("sono").value) || 0,
        valor: valorVal,
        horasExtras: parseFloat(document.getElementById("horasExtras").value) || 0,
        colega: document.getElementById("colega").value.trim(),
        obs: document.getElementById("obs").value.trim(),
        gps: "Manual"
    };

    plantoes.push(novo);
    salvarStorage(plantoes);
    document.getElementById("colega").value = "";
    document.getElementById("obs").value = "";
    renderizar();
    enviarNotificacaoLocal("📋 Plantão Salvo", "Plantão gravado com sucesso.");
}

function excluirPlantao(id) {
    if (confirm("Deseja remover este registro?")) {
        const filtrados = buscarPlantoes().filter(item => item.id !== id);
        salvarStorage(filtrados);
        renderizar();
    }
}

function formatarData(dataIso) {
    if (!dataIso) return "";
    const partes = dataIso.split("-");
    if (partes.length < 3) return dataIso;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

async function renderizarLogs() {
    const container = document.getElementById("logsCheckin");
    if (!container) return;

    if (!_supabase) {
        container.innerHTML = `<p class="vazio">Logs na nuvem inacessíveis. Modo offline.</p>`;
        return;
    }

    if (window.modoOfflineSimulado) {
        container.innerHTML = `<p class="vazio">🌐 Modo Offline Simulado Ativo.</p>`;
        return;
    }

    try {
        // CORRIGIDO: Ordenado com segurança por created_at
        const { data: logs, error } = await _supabase.from('logs_ponto').select('*').order('created_at', { ascending: false });
        if (error || !logs || logs.length === 0) {
            container.innerHTML = `<p class="vazio">Nenhum log de ponto na nuvem.</p>`;
            return;
        }

        container.innerHTML = logs.map(log => {
            const dataFormatada = log.created_at ? new Date(log.created_at).toLocaleString("pt-BR") : "";
            const gpsInfo = log.lat ? ` 📍 (${log.lat.toFixed(3)}, ${log.lng.toFixed(3)})` : "";
            return `
                <div class="log-item">
                    <span><strong>${log.type}</strong>${gpsInfo}</span>
                    <span>${dataFormatada}</span>
                </div>
            `;
        }).join("");
    } catch (e) {
        container.innerHTML = `<p class="vazio">Erro ao carregar logs da nuvem.</p>`;
    }
}

function ajustarMeta() {
    const novaMeta = prompt("Digite o novo valor da meta financeira (R$):", metaFinanceira);
    if (novaMeta && !isNaN(novaMeta)) {
        metaFinanceira = parseFloat(novaMeta);
        localStorage.setItem("metaFinanceira", metaFinanceira);
        renderizar();
    }
}

function fecharFolha() {
    if (confirm("Confirmar fechamento da folha atual? Isso arquivará os registros acumulados.")) {
        salvarStorage([]);
        renderizar();
    }
}

function exportarExcel() {
    const plantoes = buscarPlantoes();
    if (plantoes.length === 0) {
        alert("Sem dados para exportar!");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,Data;Turno;Valor;Sono;Colega;Observacao;GPS\n";
    plantoes.forEach(p => {
        csvContent += `${p.data};${p.turno};${p.valor};${p.sono};${p.colega};${p.obs};${p.gps || 'N/A'}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Valis_Plantoes.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function renderizar() {
    const plantoes = buscarPlantoes();
    const tbody = document.getElementById("tabelaExtrato");
    if (!tbody) return;

    if (plantoes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="vazio">Nenhum registro encontrado.</td></tr>`;
        atualizarDashboard();
        renderizarLogs();
        return;
    }

    const ordenados = plantoes.slice().sort((a, b) => b.id - a.id);
    tbody.innerHTML = ordenados.map(item => `
        <tr>
            <td>
                <strong>${formatarData(item.data)}</strong><br>
                <small class="sub-text">${item.colega ? 'Cobertura: ' + item.colega : 'Próprio'}</small>
            </td>
            <td>
                ${item.turno}<br>
                <small class="sub-text">${item.horaInicio || '--:--'} - ${item.horaFim || '--:--'}</small>
            </td>
            <td class="valor-cell">R$ ${Number(item.valor).toFixed(2)}</td>
            <td>
                <button class="btn-sm btn-danger" onclick="excluirPlantao(${item.id})">Excluir</button>
            </td>
        </tr>
    `).join("");

    atualizarDashboard();
    renderizarLogs();
}

// --- FUNÇÕES DO MENU DEV & MENU SISTEMA ---

function tentarAbrirMenuDev() {
    const devDropdown = document.getElementById("devDropdown");
    const sisDropdown = document.getElementById("sistemaDropdown");
    if (sisDropdown) sisDropdown.classList.remove("show");

    if (sessionStorage.getItem("devUnlocked") !== "true") {
        const senha = prompt("🔒 Área Restrita: Digite a senha de Desenvolvedor:");
        if (senha === "valis2026") {
            sessionStorage.setItem("devUnlocked", "true");
            alert("🔓 Acesso liberado ao Menu Dev!");
        } else {
            if (senha !== null) alert("❌ Senha incorreta!");
            return;
        }
    }
    if (devDropdown) devDropdown.classList.toggle("show");
}

function bloquearMenuDev() {
    sessionStorage.removeItem("devUnlocked");
    const devDropdown = document.getElementById("devDropdown");
    if (devDropdown) devDropdown.classList.remove("show");
    alert("🔒 Menu Dev bloqueado.");
}

function toggleMenuSistema() {
    const sisDropdown = document.getElementById("sistemaDropdown");
    const devDropdown = document.getElementById("devDropdown");
    if (devDropdown) devDropdown.classList.remove("show");
    if (sisDropdown) sisDropdown.classList.toggle("show");
}

function injetarDadosTeste() {
    document.getElementById("data").value = new Date().toISOString().split('T')[0];
    document.getElementById("turno").value = "Noturno";
    document.getElementById("horaInicio").value = "18:00";
    document.getElementById("horaFim").value = "06:00";
    document.getElementById("sono").value = "8";
    document.getElementById("valor").value = "100.00";
    document.getElementById("colega").value = "Simulação Automática";
    alert("📝 Formulário preenchido para teste!");
}

function alternarModoOffline() {
    window.modoOfflineSimulado = !window.modoOfflineSimulado;
    const btn = document.getElementById("btnModoOffline");
    if (btn) {
        btn.innerHTML = window.modoOfflineSimulado 
            ? "🌐 Modo Offline Simulado: <strong style='color:#ef4444'>ON</strong>" 
            : "🌐 Modo Offline Simulado: <strong style='color:#10b981'>OFF</strong>";
    }
    renderizarLogs();
}

let consoleVisivel = false;
function mostrarConsoleLocal() {
    consoleVisivel = !consoleVisivel;
    let consoleEl = document.getElementById("debugConsoleBox");
    if (!consoleEl && consoleVisivel) {
        consoleEl = document.createElement("div");
        consoleEl.id = "debugConsoleBox";
        consoleEl.style.cssText = "position:fixed; bottom:10px; left:10px; right:10px; max-height:150px; background:rgba(0,0,0,0.85); color:#00ffcc; font-family:monospace; font-size:0.7rem; padding:8px; border-radius:6px; z-index:99999; overflow-y:auto; border:1px solid #00ffcc;";
        document.body.appendChild(consoleEl);
    }
    if (consoleEl) {
        consoleEl.style.display = consoleVisivel ? "block" : "none";
        if (consoleVisivel) consoleEl.innerHTML = "<strong>🖥️️ Console de Debug Ativo</strong><br>Sistema pronto.<br>";
    }
}

function toggleCSSOutline() {
    const current = document.documentElement.style.outline;
    if (current && current !== "none") {
        document.documentElement.style.outline = "none";
        alert("🔳 Debugger Visual (CSS Outline) Desativado.");
    } else {
        document.documentElement.style.outline = "2px solid #ff0055";
        alert("🔳 Debugger Visual (CSS Outline) Ativado!");
    }
}

function testarVibracao() {
    if ("vibrate" in navigator) {
        navigator.vibrate([200, 100, 200]);
        alert("📳 Vibração testada com sucesso!");
    } else {
        alert("❌ A API de vibração não é suportada neste dispositivo/navegador.");
    }
}

async function testarPingSupabase() {
    if (!_supabase) {
        alert("❌ Supabase não inicializado.");
        return;
    }
    const inicio = performance.now();
    try {
        const { error } = await _supabase.from('logs_ponto').select('id', { count: 'exact', head: true });
        const fim = performance.now();
        const latencia = (fim - inicio).toFixed(2);
        if (!error) {
            alert(`⚡ Ping / Latência Nuvem: ${latencia} ms (Conexão OK)`);
        } else {
            alert(`⚠ Conectado com aviso: ${error.message} (${latencia} ms)`);
        }
    } catch (err) {
        alert(`❌ Erro ao testar ping: ${err.message}`);
    }
}

function hardResetLocal() {
    if (confirm("🔥 ATENÇÃO: Deseja apagar todo o LocalStorage e zerar os dados salvos no navegador?")) {
        localStorage.clear();
        sessionStorage.clear();
        alert("🔥 Hard Reset realizado com sucesso! Recarregando...");
        location.reload();
    }
}

function exportarBackupJSON() {
    const dados = {
        plantoes: JSON.parse(localStorage.getItem("plantoes")) || [],
        metaFinanceira: localStorage.getItem("metaFinanceira") || 1000,
        temaPonto: localStorage.getItem("temaPonto") || "dark"
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dados, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `valis_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function importarBackupJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const dados = JSON.parse(e.target.result);
            if (dados.plantoes) localStorage.setItem("plantoes", JSON.stringify(dados.plantoes));
            alert("✅ Backup restaurado com sucesso! Recarregando...");
            location.reload();
        } catch (err) {
            alert("❌ Erro ao processar arquivo JSON.");
        }
    };
    reader.readAsText(file);
}

function gerarDadosTeste() {
    const plantoes = buscarPlantoes();
    const hoje = new Date();
    for (let i = 1; i <= 3; i++) {
        const d = new Date(hoje);
        d.setDate(d.getDate() - i);
        plantoes.push({
            id: Date.now() + i,
            data: d.toISOString().split('T')[0],
            turno: i % 2 === 0 ? "Noturno" : "Manhã",
            horaInicio: "06:00",
            horaFim: "18:00",
            sono: 7,
            valor: 100.00,
            horasExtras: 0,
            colega: `Colega Teste ${i}`,
            obs: "Plantão gerado automaticamente para testes",
            gps: "Simulado GPS"
        });
    }
    salvarStorage(plantoes);
    renderizar();
    alert("🧪 3 Plantões de teste gerados com sucesso!");
}

function dumpLocalStorage() {
    const dados = {
        plantoes: buscarPlantoes(),
        metaFinanceira: localStorage.getItem("metaFinanceira"),
        temaPonto: localStorage.getItem("temaPonto")
    };
    console.log("=== STATE DO LOCALSTORAGE ===", dados);
    alert("🖥️ State impresso no Console do navegador (F12 / Inspecionar).");
}

async function limparLogsGlobalSupabase() {
    if (!_supabase) {
        alert("❌ Supabase não inicializado.");
        return;
    }
    if (confirm("☁️ ATENÇÃO: Deseja apagar TODOS os logs da tabela na nuvem (Supabase)?")) {
        try {
            const { error } = await _supabase.from('logs_ponto').delete().gte('id', 0);
            if (error) {
                alert("⚠️ Erro ao limpar logs na nuvem: " + error.message);
            } else {
                alert("☁️ Todos os logs da nuvem foram limpos!");
                renderizarLogs();
            }
        } catch (err) {
            alert("❌ Erro: " + err.message);
        }
    }
}

function forcarVerificacaoAtualizacao() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(reg => {
            if (reg) {
                reg.update();
                alert("🔄 Verificando atualizações no Service Worker...");
            } else {
                alert("⚠️ Nenhum Service Worker registrado.");
            }
        });
    } else {
        alert("❌ Service Worker não suportado.");
    }
}

function limparCacheERecarregar() {
    if (confirm("🧹 Deseja limpar todos os caches do aplicativo e recarregar?")) {
        if ('caches' in window) {
            caches.keys().then(names => {
                names.forEach(name => caches.delete(name));
            });
        }
        alert("🧹 Cache limpo! Recarregando...");
        location.reload();
    }
}

function exibirTermosUso() {
    alert("📜 Termos de Uso & Diretrizes Tecnológicas (LGPD)\n\nSistema exclusivo para controle de plantões e jornadas de vigilantes. Dados armazenados com segurança local e sincronização opcional via nuvem.");
}
