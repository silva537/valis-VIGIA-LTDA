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

    // Atualização de elementos
    document.getElementById("totalPlantoes").innerText = qtd;
    document.getElementById("propriosCoberturas").innerText = `${proprios} / ${coberturas}`;
    document.getElementById("mediaPorPlantao").innerText = `R$ ${mediaValor.toFixed(2)}`;
    document.getElementById("mediaSono").innerText = `${mediaSono.toFixed(1)}h`;
    document.getElementById("totalFiltrado").innerText = `R$ ${totalValores.toFixed(2)}`;

    // Progresso da Meta
    const meta = parseFloat(localStorage.getItem("metaFinanceira")) || 1000.00;
    const percentual = Math.min((totalValores / meta) * 100, 100).toFixed(0);

    document.getElementById("metaValorText").innerText = `R$ ${meta.toFixed(2)}`;
    document.getElementById("metaPercentText").innerText = `${percentual}%`;
    document.getElementById("metaProgressBar").style.width = `${percentual}%`;
}
