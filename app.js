// --- CONFIGURAÇÃO DO SUPABASE ---
const SUPABASE_URL = 'https://sxrthryhzodryrzndveg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_3FDSO7qfonD0BLRTzPT6bA_7a7jUarD';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const VALORES_TURNO = {
    "Manhã": 100.00,
    "Noturno": 100.00,
    "24h": 250.00
};

let metaFinanceira = parseFloat(localStorage.getItem("metaFinanceira")) || 1000.00;

document.addEventListener("DOMContentLoaded", () => {
    const dataInput = document.getElementById("data");
    if (dataInput) {
        dataInput.valueAsDate = new Date();
    }
    
    const turnoSelect = document.getElementById("turno");
    if (turnoSelect) {
        turnoSelect.addEventListener("change", atualizarCamposTurno);
    }

    atualizarCamposTurno();
    carregarTemaSalvo();
    renderizar();
    renderizarLogs();
    renderizarAvisos(); // Carrega os avisos da nuvem ao iniciar
});

function enviarNotificacaoLocal(titulo, mensagem) {
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(titulo, {
                body: mensagem,
                icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
                vibrate: [200, 100, 200]
            });
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
        if (turno === "Manhã") {
            inicioInput.value = "06:00";
            fimInput.value = "18:00";
        } else if (turno === "Noturno") {
            inicioInput.value = "18:00";
            fimInput.value = "06:00";
        } else if (turno === "24h") {
            inicioInput.value = "06:00";
            fimInput.value = "06:00";
        }
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

    if (themeBtn) {
        themeBtn.innerText = temaSalvo === "dark" ? "☀️ Tema Claro" : "🌙 Tema Escuro";
    }
}

// --- REGISTRAR PONTO DIRETO NA NUVEM (SUPABASE) ---
async function registrarPonto(tipo) {
    const agora = new Date();
    const horaStr = agora.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
    const dataIso = agora.toISOString().split('T')[0];
    const dataHoraStr = agora.toLocaleDateString("pt-BR") + " às " + horaStr;

    const { error } = await _supabase
        .from('logs_ponto')
        .insert([{ id: Date.now(), tipo: tipo, data_hora: dataHoraStr }]);

    if (error) {
        console.error("Erro ao sincronizar log com a nuvem:", error);
        alert("❌ Erro ao enviar log para a nuvem.");
        return;
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
            obs: document.getElementById("obs").value.trim() || "Fechamento automático via Check-out"
        };

        plantoes.push(novoPlantao);
        salvarStorage(plantoes);

        if (tag) {
            tag.className = "status-tag inactive";
            tag.innerText = "INATIVO";
        }
        if (txt) txt.innerText = "Plantão finalizado e registrado no extrato abaixo!";
        if (liveInfo) liveInfo.style.display = "none";

        document.getElementById("colega").value = "";
        document.getElementById("obs").value = "";

        renderizar();
        renderizarLogs();
        
        enviarNotificacaoLocal("🔴 Plantão Encerrado", `Check-out registrado às ${horaStr}. Extrato atualizado!`);
        alert("🟢 Plantão fechado com sucesso! Registrado na tabela abaixo.");
    } else {
        if (tag) {
            tag.className = "status-tag active";
            tag.innerText = "EM ANDAMENTO";
        }
        if (txt) txt.innerText = `Ponto em execução: ${tipo}`;

        const lastEvent = document.getElementById("lastEvent");
        const lastTime = document.getElementById("lastTime");
        if (lastEvent) lastEvent.innerText = tipo;
        if (lastTime) lastTime.innerText = horaStr;
        if (liveInfo) liveInfo.style.display = "flex";

        renderizarLogs();

        enviarNotificacaoLocal("🟢 Ponto Registrado", `${tipo} efetuado com sucesso às ${horaStr}.`);
    }
}

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
        obs: document.getElementById("obs").value.trim()
    };

    plantoes.push(novo);
    salvarStorage(plantoes);

    document.getElementById("colega").value = "";
    document.getElementById("obs").value = "";
    renderizar();

    enviarNotificacaoLocal("📋 Plantão Salvo", `Plantão salvo no sistema com sucesso.`);
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

    const { data: logs, error } = await _supabase
        .from('logs_ponto')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.error("Erro ao buscar logs do Supabase:", error);
        container.innerHTML = `<p class="vazio">Erro ao carregar logs da nuvem.</p>`;
        return;
    }

    if (!logs || logs.length === 0) {
        container.innerHTML = `<p class="vazio">Nenhum log de ponto registrado.</p>`;
        return;
    }

    container.innerHTML = logs.map(log => `
        <div class="log-item">
            <span><strong>${log.tipo}</strong></span>
            <span>${log.data_hora}</span>
        </div>
    `).join("");
}

async function renderizarAvisos() {
    const container = document.getElementById("muralAvisos");
    if (!container) return;

    const { data: avisos, error } = await _supabase
        .from('avisos_equipe')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.error("Erro ao buscar avisos:", error);
        container.innerHTML = `<p class="vazio">Erro ao carregar avisos.</p>`;
        return;
    }

    if (!avisos || avisos.length === 0) {
        container.innerHTML = `<p class="vazio">Nenhum aviso geral no momento.</p>`;
        return;
    }

    container.innerHTML = avisos.map(aviso => `
        <div class="log-item" style="flex-direction: column; align-items: flex-start; gap: 2px;">
            <span style="color: #00ffcc; font-weight: bold;">📢 ${aviso.titulo}</span>
            <span>${aviso.mensagem}</span>
        </div>
    `).join("");
}

async function promptCriarAviso() {
    const titulo = prompt("Digite o Título do Aviso Geral:");
    if (!titulo) return;

    const mensagem = prompt("Digite a Mensagem do Aviso:");
    if (!mensagem) return;

    const { error } = await _supabase
        .from('avisos_equipe')
        .insert([{ id: Date.now(), titulo: titulo, mensagem: mensagem }]);

    if (error) {
        alert("❌ Erro ao publicar aviso na nuvem.");
        console.error(error);
    } else {
        alert("📢 Aviso publicado com sucesso para toda a equipe!");
        renderizarAvisos();
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

    let csvContent = "data:text/csv;charset=utf-8,Data;Turno;Valor;Sono;Colega;Observacao\n";

    plantoes.forEach(p => {
        csvContent += `${p.data};${p.turno};${p.valor};${p.sono};${p.colega};${p.obs}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Valis_Naturalidade_Plantoes.csv`);
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

function tentarAbrirMenuDev() {
    const devDropdown = document.getElementById("devDropdown");
    const sisDropdown = document.getElementById("sistemaDropdown");
    if (sisDropdown) sisDropdown.classList.remove("show");

    const jaAutenticado = sessionStorage.getItem("devUnlocked") === "true";

    if (!jaAutenticado) {
        const senhaInformada = prompt("🔒 Área Restrita: Digite a senha de Desenvolvedor:");
        if (senhaInformada === "valis2026") {
            sessionStorage.setItem("devUnlocked", "true");
            const tag = document.getElementById("statusDevTag");
            if(tag) {
                tag.className = "status-tag active";
                tag.innerText = "AUTORIZADO";
            }
            alert("🔓 Acesso liberado ao Menu Dev!");
        } else if (senhaInformada !== null) {
            alert("❌ Senha incorreta!");
            return;
        } else {
            return; 
        }
    }

    if (devDropdown) {
        devDropdown.classList.toggle("show");
    }
}

function bloquearMenuDev() {
    sessionStorage.removeItem("devUnlocked");
    const devDropdown = document.getElementById("devDropdown");
    if (devDropdown) devDropdown.classList.remove("show");
    const tag = document.getElementById("statusDevTag");
    if(tag) {
        tag.className = "status-tag dev-tag";
        tag.innerText = "PROTEGIDO";
    }
    alert("🔒 Menu Dev bloqueado com sucesso.");
}

async function limparLogsGlobalSupabase() {
    const primeiraConf = confirm("⚠️ ATENÇÃO: Isso apagará permanentemente os logs de ponto de TODOS OS USUÁRIOS conectados à nuvem. Deseja continuar?");
    if (!primeiraConf) return;

    const segundaConf = confirm("🚨 ÚLTIMA CHANCE: Tem certeza ABSOLUTA que deseja zerar os logs globais de todos os aparelhos?");
    if (!segundaConf) return;

    const { error } = await _supabase
        .from('logs_ponto')
        .delete()
        .neq('id', 0);

    if (error) {
        alert("❌ Erro ao limpar logs globais na nuvem.");
        console.error(error);
    } else {
        alert("🧹 Sucesso! Todos os logs globais foram apagados da nuvem.");
        renderizarLogs();
    }
}

function dumpLocalStorage() {
    const dadosGerais = {
        plantoes: JSON.parse(localStorage.getItem("plantoes")) || [],
        metaFinanceira: localStorage.getItem("metaFinanceira") || 1000,
        temaPonto: localStorage.getItem("temaPonto") || "dark"
    };
    console.group("🖥️ [VALIS DEV STATE INSPECTOR]");
    console.log("Dados Atuais:", dadosGerais);
    console.groupEnd();
    alert("💻 Estado atual do localStorage impresso no Console do Navegador (F12)!");
}

function toggleMenuSistema() {
    const sisDropdown = document.getElementById("sistemaDropdown");
    const devDropdown = document.getElementById("devDropdown");
    if (devDropdown) devDropdown.classList.remove("show");
    if (sisDropdown) sisDropdown.classList.toggle("show");
}

document.addEventListener("click", (event) => {
    const wrappers = document.querySelectorAll(".dev-menu-wrapper");
    let clickInside = false;
    wrappers.forEach(w => {
        if (w.contains(event.target)) clickInside = true;
    });

    if (!clickInside) {
        const devDropdown = document.getElementById("devDropdown");
        const sisDropdown = document.getElementById("sistemaDropdown");
        if (sisDropdown) sisDropdown.classList.remove("show");
    }
});

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
            if (dados.metaFinanceira) localStorage.setItem("metaFinanceira", dados.metaFinanceira);
            if (dados.temaPonto) localStorage.setItem("temaPonto", dados.temaPonto);

            alert("✅ Backup restaurado com sucesso! O app será reiniciado.");
            location.reload();
        } catch (err) {
            alert("❌ Erro ao processar arquivo JSON.");
        }
    };
    reader.readAsText(file);
}

function gerarDadosTeste() {
    const plantoesExemplo = [
        { id: Date.now() - 86400000 * 2, data: "2026-09-26", turno: "Manhã", horaInicio: "06:00", horaFim: "18:00", sono: 7, valor: 100, horasExtras: 0, colega: "", obs: "Plantão tranquilo (Teste Automático)" },
        { id: Date.now() - 86400000, data: "2026-09-27", turno: "Noturno", horaInicio: "18:00", horaFim: "06:00", sono: 6, valor: 100, horasExtras: 2, colega: "Vigilante Teste", obs: "Cobertura (Teste Automático)" }
    ];

    const atuais = buscarPlantoes();
    salvarStorage([...atuais, ...plantoesExemplo]);
    renderizar();
    alert("🧪 Dados de teste inseridos com sucesso!");
}

function exibirTermosUso() {
    alert(
        "📜 TERMOS DE USO E POLÍTICA DE PRIVACIDADE (LGPD - Lei nº 13.709/2018)\n\n" +
        "1. Armazenamento Local: Os dados de plantões, horários e valores são gravados prioritariamente no armazenamento local do navegador (LocalStorage).\n\n" +
        "2. Privacidade e Titularidade: O usuário tem total controle sobre seus registros, podendo exportá-los em arquivo CSV ou excluí-los a qualquer momento.\n\n" +
        "3. Notificações e Push: Os alertas são utilizados exclusivamente para gerenciamento dos turnos e registros de ponto em tempo real.\n\n" +
        "4. Marco Civil da Internet: O uso do aplicativo segue os princípios de segurança, proteção à privacidade e transparência das redes."
    );
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then((registration) => {
        registration.update();
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
            refreshing = true;
            console.log("🚀 Nova versão instalada. A recarregar a aplicação...");
            window.location.reload();
        }
    });
}

function forcarVerificacaoAtualizacao() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
            registration.update().then(() => {
                alert("🔍 Verificação concluída! Se houver alguma nova versão, o app atualizará automaticamente.");
            });
        });
    } else {
        alert("O Service Worker não está ativo neste navegador.");
    }
}

function limparCacheERecarregar() {
    if (confirm("Isso apagará o cache local das páginas e recarregará a versão mais recente do servidor. Deseja continuar?")) {
        if ('caches' in window) {
            caches.keys().then((names) => {
                return Promise.all(names.map(name => caches.delete(name)));
            }).then(() => {
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then((registrations) => {
                        for (let registration of registrations) {
                            registration.unregister();
                        }
                        window.location.reload(true);
                    });
                } else {
                    window.location.reload(true);
                }
            });
        } else {
            window.location.reload(true);
        }
    }
}
