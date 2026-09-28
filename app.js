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
    atualizarCamposTurno();
    carregarTemaSalvo();
    renderizar();
});

const turnoSelect = document.getElementById("turno");
if (turnoSelect) {
    turnoSelect.addEventListener("change", atualizarCamposTurno);
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

/* GERENCIAMENTO DE TEMAS (CLARO / ESCURO) */
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

/* REGISTRO DE PONTO INTERATIVO E FECHAMENTO AUTOMÁTICO */
function registrarPonto(tipo) {
    const logs = JSON.parse(localStorage.getItem("logsPonto")) || [];
    const agora = new Date();
    const horaStr = agora.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
    const dataIso = agora.toISOString().split('T')[0];
    const dataHoraStr = agora.toLocaleDateString("pt-BR") + " às " + horaStr;

    // Salva o log de check-in / check-out
    logs.push({ tipo, dataHora: dataHoraStr });
    localStorage.setItem("logsPonto", JSON.stringify(logs));

    const tag = document.getElementById("statusPlantaoTag");
    const txt = document.getElementById("statusPlantaoTexto");
    const liveInfo = document.getElementById("liveInfo");

    if (tipo.includes("Check-out")) {
        // --- FECHAMENTO AUTOMÁTICO DO PLANTÃO ---
        const turnoSel = document.getElementById("turno").value;
        const valorVal = parseFloat(document.getElementById("valor").value) || VALORES_TURNO[turnoSel] || 100;

        const plantoes = buscarPlantoes();

        const novoPlantao = {
            id: Date.now(),
            data: document.getElementById("data").value || dataIso,
            turno: turnoSel,
            horaInicio: document.getElementById("horaInicio").value || "06:00",
            horaFim: horaStr, // Registra o horário exato do Check-out
            sono: parseFloat(document.getElementById("sono").value) || 0,
            valor: valorVal,
            horasExtras: parseFloat(document.getElementById("horasExtras").value) || 0,
            colega: document.getElementById("colega").value.trim(),
            obs: document.getElementById("obs").value.trim() || "Fechamento automático via Check-out"
        };

        plantoes.push(novoPlantao);
        salvarStorage(plantoes);

        // Reseta o painel superior para inativo
        if (tag) {
            tag.className = "status-tag inactive";
            tag.innerText = "INATIVO";
        }
        if (txt) txt.innerText = "Plantão finalizado e registrado no extrato abaixo!";
        if (liveInfo) liveInfo.style.display = "none";

        // Limpa campos opcionais
        document.getElementById("colega").value = "";
        document.getElementById("obs").value = "";

        // Atualiza a tabela na tela
        renderizar();
        alert("🟢 Plantão fechado com sucesso! Registrado na tabela abaixo.");
    } else {
        // --- CHECK-IN OU REFEIÇÃO EM ANDAMENTO ---
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

function renderizarLogs() {
    const logs = JSON.parse(localStorage.getItem("logsPonto")) || [];
    const container = document.getElementById("logsCheckin");

    if (!container) return;

    if (logs.length === 0) {
        container.innerHTML = `<p class="vazio">Nenhum log de ponto registrado.</p>`;
        return;
    }

    container.innerHTML = logs.slice().reverse().map(log => `
        <div class="log-item">
            <span><strong>${log.tipo}</strong></span>
            <span>${log.dataHora}</span>
        </div>
    `).join("");
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
    link.setAttribute("download", `Vales_Naturalidade_Plantoes.csv`);
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

    // Ordena do mais recente para o mais antigo
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
/* CONTROLADOR DO MENU DEV (TRÊS TRACINHOS) */
function toggleMenuDev() {
    const dropdown = document.getElementById("devDropdown");
    if (dropdown) {
        dropdown.classList.toggle("show");
    }
}

// Fecha o menu Dev se clicar fora dele
document.addEventListener("click", (event) => {
    const wrapper = document.querySelector(".dev-menu-wrapper");
    const dropdown = document.getElementById("devDropdown");
    if (wrapper && dropdown && !wrapper.contains(event.target)) {
        dropdown.classList.remove("show");
    }
});
