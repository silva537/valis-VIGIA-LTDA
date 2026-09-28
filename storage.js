function buscarPlantoes() {
    try {
        return JSON.parse(localStorage.getItem("plantoes")) || [];
    } catch (e) {
        console.error("Erro ao ler dados do localStorage:", e);
        return [];
    }
}

function salvarStorage(lista) {
    try {
        localStorage.setItem("plantoes", JSON.stringify(lista));
    } catch (e) {
        console.error("Erro ao salvar dados no localStorage:", e);
    }
}
