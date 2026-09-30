// --- FUNÇÕES DE REGISTRO DE PONTO E AÇÕES DA INTERFACE ---

function registrarPonto(tipo) {
    const sonoInput = document.getElementById("sono");
    const turnoInput = document.getElementById("turno");
    
    const horasSono = sonoInput ? parseFloat(sonoInput.value) || 0 : 0;
    const tipoTurno = turnoInput ? turnoInput.value : "Manhã";

    if (typeof baterPonto === 'function') {
        baterPonto(tipo, horasSono, tipoTurno);
    }

    const agora = new Date();
    const horaFormatada = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    let logs = JSON.parse(localStorage.getItem("logs_ponto")) || [];
    logs.unshift({ tipo: tipo, hora: horaFormatada, data: agora.toLocaleDateString('pt-BR') });
    localStorage.setItem("logs_ponto", JSON.stringify(logs));

    renderizarLogs();
    atualizarStatusPlantao(tipo, horaFormatada);
}

function registrarSaidaAlmoco() {
    registrarPonto("Saída Almoço 🍔");
}

function registrarRetornoAlmoco() {
    registrarPonto("Retorno Almoço 🔙");
}

function atualizarStatusPlantao(tipo, hora) {
    const statusTag = document.getElementById("statusPlantaoTag");
    const statusTexto = document.getElementById("statusPlantaoTexto");
    const liveInfo = document.getElementById("liveInfo");
    const lastEvent = document.getElementById("lastEvent");
    const lastTime = document.getElementById("lastTime");

    if (tipo.includes("Check-in") || tipo.includes("Retorno")) {
        if (statusTag) { statusTag.innerText = "EM ANDAMENTO"; statusTag.className = "status-tag active"; }
        if (statusTexto) statusTexto.innerText = "Plantão ativo em monitoramento.";
    } else {
        if (statusTag) { statusTag.innerText = "INATIVO"; statusTag.className = "status-tag inactive"; }
        if (statusTexto) statusTexto.innerText = "Nenhum plantão em andamento no momento.";
    }

    if (liveInfo) liveInfo.style.display = "flex";
    if (lastEvent) lastEvent.innerText = tipo;
    if (lastTime) lastTime.innerText = hora;
}

function renderizarLogs() {
    const container = document.getElementById("logsCheckin");
    if (!container) return;

    const logs = JSON.parse(localStorage.getItem("logs_ponto")) || [];
    if (logs.length === 0) {
        container.innerHTML = `<p class="vazio" style="text-align: center;">Nenhum log de ponto registrado.</p>`;
        return;
    }

    container.innerHTML = logs.map(l => `
        <div class="log-item">
            <span>${l.tipo}</span>
            <strong>${l.data} às ${l.hora}</strong>
        </div>
    `).join('');
}

function salvarPlantao() {
    const data = document.getElementById("data").value;
    const turno = document.getElementById("turno").value;
    const horaInicio = document.getElementById("horaInicio").value;
    const horaFim = document.getElementById("horaFim").value;
    const sono = document.getElementById("sono").value;
    const valor = document.getElementById("valor").value;
    const horasExtras = document.getElementById("horasExtras").value;
    const colega = document.getElementById("colega").value;
    const obs = document.getElementById("obs").value;

    if (!data) {
        alert("Por favor, selecione uma data!");
        return;
    }

    const novoPlantao = {
        id: Date.now(),
        data,
        turno,
        horaInicio,
        horaFim,
        sono,
        valor,
        horasExtras,
        colega,
        obs
    };

    let plantoes = buscarPlantoes();
    plantoes.unshift(novoPlantao);
    salvarStorage(plantoes);

    renderizar();
    if (typeof SistemaNotificacoes !== 'undefined') {
        SistemaNotificacoes.enviar("Sucesso", "Plantão salvo com sucesso!", "success");
    } else {
        alert("Plantão salvo com sucesso!");
    }
}

function renderizar() {
    const tabela = document.getElementById("tabelaExtrato");
    if (!tabela) return;

    const plantoes = buscarPlantoes();
    if (plantoes.length === 0) {
        tabela.innerHTML = `<tr><td colspan="4" style="text-align: center;">Nenhum plantão cadastrado.</td></tr>`;
        if (typeof atualizarDashboard === 'function') atualizarDashboard();
        return;
    }

    tabela.innerHTML = plantoes.map(p => `
        <tr>
            <td>
                <strong>${p.data.split('-').reverse().join('/')}</strong><br>
                <span class="sub-text">${p.colega ? 'Cobertura: ' + p.colega : 'Próprio'}</span>
            </td>
            <td>${p.turno}<br><span class="sub-text">${p.horaInicio} - ${p.horaFim}</span></td>
            <td class="valor-cell">R$ ${parseFloat(p.valor).toFixed(2)}</td>
            <td>
                <button class="btn-sm btn-danger" onclick="excluirPlantao(${p.id})">🗑️</button>
            </td>
        </tr>
    `).join('');

    if (typeof atualizarDashboard === 'function') atualizarDashboard();
}

function excluirPlantao(id) {
    if (confirm("Deseja realmente excluir este registro de plantão?")) {
        let plantoes = buscarPlantoes().filter(p => p.id !== id);
        salvarStorage(plantoes);
        renderizar();
    }
}

function ajustarMeta() {
    const novaMeta = prompt("Digite a nova meta financeira (R$):", localStorage.getItem("metaFinanceira") || "1000.00");
    if (novaMeta && !isNaN(novaMeta)) {
        localStorage.setItem("metaFinanceira", parseFloat(novaMeta).toFixed(2));
        if (typeof atualizarDashboard === 'function') atualizarDashboard();
    }
}

function configurarDatasFolha() {
    const fechamento = prompt("Dia do mês para Fechamento da Folha (ex: 25):", localStorage.getItem("diaFechamento") || "25");
    const recebimento = prompt("Dia do mês para Recebimento (ex: 5):", localStorage.getItem("diaRecebimento") || "5");
    if (fechamento) {
        const elF = document.getElementById("lblDiaFechamento");
        if (elF) elF.innerText = `Dia ${fechamento}`;
        localStorage.setItem("diaFechamento", fechamento);
    }
    if (recebimento) {
        const elR = document.getElementById("lblDiaRecebimento");
        if (elR) elR.innerText = `Dia ${recebimento.padStart(2, '0')}`;
        localStorage.setItem("diaRecebimento", recebimento);
    }
}

function gerarResumoMensalAutomatico() {
    const plantoes = buscarPlantoes();
    if (plantoes.length === 0) {
        alert("Nenhum registro para gerar resumo.");
        return;
    }
    let total = plantoes.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);
    alert(`📊 RESUMO MENSAL AUTOMÁTICO\n\nTotal de plantões: ${plantoes.length}\nValor Acumulado: R$ ${total.toFixed(2)}`);
}

function fecharFolha() {
    if (confirm("Deseja arquivar e fechar a folha atual? Todos os plantões locais serão zerados.")) {
        salvarStorage([]);
        renderizar();
        alert("Folha fechada com sucesso!");
    }
}

function exportarExcel() {
    const plantoes = buscarPlantoes();
    if (plantoes.length === 0) {
        alert("Sem dados para exportar!");
        return;
    }
    let csvContent = "data:text/csv;charset=utf-8,Data,Turno,Inicio,Fim,Valor,Cobertura,Observacao\n";
    plantoes.forEach(p => {
        csvContent += `${p.data},${p.turno},${p.horaInicio},${p.horaFim},${p.valor},"${p.colega || ''}","${p.obs || ''}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "extrato_plantoes.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- FUNÇÕES DEV & DIAGNÓSTICO ---
function injetarDadosTeste() {
    const mock = [
        { id: Date.now(), data: "2026-09-28", turno: "Manhã", horaInicio: "06:00", horaFim: "18:00", sono: "7", valor: "100.00", colega: "", obs: "Turno tranquilo" },
        { id: Date.now() - 1000, data: "2026-09-29", turno: "Noturno", horaInicio: "18:00", horaFim: "06:00", sono: "8", valor: "100.00", colega: "Carlos", obs: "Ronda OK" }
    ];
    salvarStorage(mock);
    renderizar();
    alert("Dados fictícios inseridos!");
}

let modoOfflineSimulado = false;
function alternarModoOffline() {
    modoOfflineSimulado = !modoOfflineSimulado;
    const btn = document.getElementById("btnModoOffline");
    if (btn) {
        btn.innerHTML = `🌐 Modo Offline Simulado: <strong style="color:${modoOfflineSimulado ? '#ef4444' : '#10b981'}">${modoOfflineSimulado ? 'ON' : 'OFF'}</strong>`;
    }
    alert(modoOfflineSimulado ? "⚠ Modo offline simulado ATIVADO." : "🟢 Modo offline simulado DESATIVADO.");
}

function mostrarConsoleLocal() {
    alert("🖥️ Console Dev Local: Todos os serviços estão ativos.");
}

function toggleCSSOutline() {
    document.body.classList.toggle("debug-css-outline");
    if (!document.getElementById("debug-css-style")) {
        const style = document.createElement("style");
        style.id = "debug-css-style";
        style.innerText = ".debug-css-outline * { outline: 1px solid red !important; }";
        document.head.appendChild(style);
    }
}

function testarVibracao() {
    if ("vibrate" in navigator) {
        navigator.vibrate([100, 50, 100]);
        alert("📳 Vibração testada com sucesso!");
    } else {
        alert("Vibração não suportada neste dispositivo/navegador.");
    }
}

async function testarPingSupabase() {
    const inicio = Date.now();
    try {
        if (!_supabase) throw new Error("Supabase não carregado");
        const { error } = await _supabase.from('logs_ponto').select('id').limit(1);
        const tempo = Date.now() - inicio;
        if (error) throw error;
        alert(`⚡ Ping com a nuvem Supabase: ${tempo}ms`);
    } catch (e) {
        alert("❌ Falha na conexão com a nuvem Supabase.");
    }
}
