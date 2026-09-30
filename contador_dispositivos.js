// contador_dispositivos.js

async function atualizarContadorDispositivos() {
    let el = document.getElementById("qtdDispositivosLogados");

    if (typeof _supabase === 'undefined' || !_supabase) {
        if (el) el.innerText = "Indisponível (Offline)";
        return;
    }

    try {
        const { data, error } = await _supabase
            .from('logs_ponto')
            .select('device_id');

        if (error) {
            console.error("Erro ao contar dispositivos:", error);
            if (el) el.innerText = "--";
            return;
        }

        if (data) {
            const dispositivosUnicos = new Set(
                data
                    .map(item => item.device_id)
                    .filter(id => id !== null && id !== undefined && id !== "")
            );

            if (el) el.innerText = `${dispositivosUnicos.size} dispositivo(s)`;
        }
    } catch (err) {
        console.error("Exceção ao obter dispositivos:", err);
        if (el) el.innerText = "--";
    }
}

async function atualizarDispositivosOnline() {
    let elOnline = document.getElementById("qtdDispositivosOnline");
    if (!elOnline || typeof _supabase === 'undefined' || !_supabase) return;

    try {
        const dezMinutosAtras = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { count, error } = await _supabase
            .from('dispositivos_ativos')
            .select('*', { count: 'exact', head: true })
            .gte('ultimo_ping', dezMinutosAtras);

        if (!error && count !== null) {
            elOnline.innerText = count;
        }
    } catch (e) {
        console.warn("Erro ao buscar dispositivos online:", e);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        atualizarContadorDispositivos();
        atualizarDispositivosOnline();
    }, 1000);

    setInterval(() => {
        atualizarContadorDispositivos();
        atualizarDispositivosOnline();
    }, 30000);
});
