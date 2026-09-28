function atualizarDashboard() {
    const plantoes = buscarPlantoes();

    let totalValores = 0;
    let totalSono = 0;
    let proprios = 0;
    let coberturas = 0;

    plantoes.forEach(item => {
        totalValores += parseFloat(item.valor) || 0;
        totalSono += parseFloat(item.sono) || 0;
        if (item.colega) {
            coberturas++;
        } else {
            proprios++;
        }
    });

    const qtd = plantoes.length;
    const mediaValor = qtd > 0 ? (totalValores / qtd) : 0;
    const mediaSono = qtd > 0 ? (totalSono / qtd) : 0;

    const totalPlantoesEl = document.getElementById("totalPlantoes");
    if (totalPlantoesEl) totalPlantoesEl.innerText = qtd;

    const propriosCoberturasEl = document.getElementById("propriosCoberturas");
    if (propriosCoberturasEl) propriosCoberturasEl.innerText = `${proprios} / ${coberturas}`;

    const mediaPorPlantaoEl = document.getElementById("mediaPorPlantao");
    if (mediaPorPlantaoEl) mediaPorPlantaoEl.innerText = `R$ ${mediaValor.toFixed(2)}`;

    const mediaSonoEl = document.getElementById("mediaSono");
    if (mediaSonoEl) mediaSonoEl.innerText = `${mediaSono.toFixed(1)}h`;

    const totalFiltradoEl = document.getElementById("totalFiltrado");
    if (totalFiltradoEl) totalFiltradoEl.innerText = `R$ ${totalValores.toFixed(2)}`;

    const meta = parseFloat(localStorage.getItem("metaFinanceira")) || 1000.00;
    const percentual = Math.min((totalValores / meta) * 100, 100).toFixed(0);

    const metaValorTextEl = document.getElementById("metaValorText");
    if (metaValorTextEl) metaValorTextEl.innerText = `R$ ${meta.toFixed(2)}`;

    const metaPercentTextEl = document.getElementById("metaPercentText");
    if (metaPercentTextEl) metaPercentTextEl.innerText = `${percentual}%`;

    const metaProgressBarEl = document.getElementById("metaProgressBar");
    if (metaProgressBarEl) metaProgressBarEl.style.width = `${percentual}%`;
}
