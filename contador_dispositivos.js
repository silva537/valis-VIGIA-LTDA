// contador_dispositivos.js

async function atualizarContadorDispositivos() {
    // Procura o container na tela onde o número será exibido
    let el = document.getElementById("qtdDispositivosLogados");

    // Se o elemento ainda não existir no HTML, cria um card dinamicamente no topo da página
    if (!el) {
        const painel = document.querySelector(".container") || document.body;
        const cardInfo = document.createElement("div");
        cardInfo.className = "card-info-dispositivos";
        cardInfo.style.cssText = `
            background: var(--bg-card, #2d3748);
            color: var(--text-color, #ffffff);
            padding: 12px 16px;
            border-radius: 8px;
            margin: 10px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.9rem;
            border: 1px solid var(--input-border, #4a5568);
        `;
        cardInfo.innerHTML = `
            <span>📱 Dispositivos com Registros:</span>
            <strong id="qtdDispositivosLogados" style="font-size: 1.1rem; color: #38a169;">Carregando...</strong>
        `;
        // Insere o card antes de outros elementos do painel
        painel.insertBefore(cardInfo, painel.firstChild);
        el = document.getElementById("qtdDispositivosLogados");
    }

    // Verifica se a conexão global com o Supabase está ativa
    if (typeof _supabase === 'undefined' || !_supabase) {
        if (el) el.innerText = "Indisponível (Offline)";
        return;
    }

    try {
        // Busca a lista de device_id cadastrados na tabela
        const { data, error } = await _supabase
            .from('logs_ponto')
            .select('device_id');

        if (error) {
            console.error("Erro ao contar dispositivos:", error);
            if (el) el.innerText = "--";
            return;
        }

        if (data) {
            // Filtra os IDs válidos e conta apenas os únicos (Set elimina duplicados)
            const dispositivosUnicos = new Set(
                data
                    .map(item => item.device_id)
                    .filter(id => id !== null && id !== undefined && id !== "")
            );

            // Atualiza o contador no HTML
            el.innerText = `${dispositivosUnicos.size} dispositivo(s)`;
        }
    } catch (err) {
        console.error("Exceção ao obter dispositivos:", err);
        if (el) el.innerText = "--";
    }
}

// Executa a contagem assim que a página é carregada
document.addEventListener("DOMContentLoaded", () => {
    // Aguarda um pequeno intervalo para garantir a inicialização das variáveis globais
    setTimeout(atualizarContadorDispositivos, 1000);

    // Opcional: Atualiza a contagem a cada 30 segundos
    setInterval(atualizarContadorDispositivos, 30000);
});
