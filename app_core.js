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
    renderizarAvisos();
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
