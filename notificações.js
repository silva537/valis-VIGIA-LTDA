// Pedir permissão ao carregar
async function solicitarPermissaoNotificacao() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

// Renderizar banner no topo da tela
function exibirBannerTopo(mensagem, tipo = 'info') {
  let banner = document.getElementById('banner-notificacao');
  
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'banner-notificacao';
    banner.style.position = 'fixed';
    banner.style.top = '0';
    banner.style.left = '0';
    banner.style.width = '100%';
    banner.style.padding = '12px 16px';
    banner.style.backgroundColor = tipo === 'erro' ? '#e53e3e' : '#2b6cb0';
    banner.style.color = '#ffffff';
    banner.style.textAlign = 'center';
    banner.style.zIndex = '9999';
    banner.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    document.body.prepend(banner);
  }

  banner.innerText = mensagem;
}

// Atualize a função de buscar para chamar o banner
async function buscarNotificacoes() {
  const { data, error } = await supabase
    .from('notificacao')
    .select('*')
    .eq('ativa', true)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return;

  const ultimaNotificacao = data[0];
  exibirBannerTopo(ultimaNotificacao.mensagem, ultimaNotificacao.tipo);
}

// Inicializar
solicitarPermissaoNotificacao();
buscarNotificacoes();
async function criarNotificacaoDev(titulo, mensagem, tipo = 'info') {
  const { data, error } = await supabase
    .from('notificacao')
    .insert([
      {
        titulo: titulo,
        mensagem: mensagem,
        tipo: tipo,
        ativa: true
      }
    ]);

  if (error) {
    console.error('Erro ao enviar notificação pelo menu dev:', error);
    alert('Erro ao enviar!');
  } else {
    alert('Notificação enviada com sucesso!');
  }
}
