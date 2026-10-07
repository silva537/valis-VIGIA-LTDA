/**
 * VALIS Update — checagem de version.json (externo)
 * Usado com vercel.json (Cache-Control) para o WebInto pegar deploy novo.
 */
(function (global) {
  function bust(url) {
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
  }

  const ValisUpdate = {
    lastCheck: null,
    lastRemote: null,
    check: async function (opts) {
      opts = opts || {};
      try {
        const res = await fetch(bust('version.json'), {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        this.lastCheck = Date.now();
        if (!res.ok) {
          if (global.ValisDevLog) global.ValisDevLog.add('update_check_fail', { status: res.status });
          return { ok: false, status: res.status };
        }
        const data = await res.json();
        this.lastRemote = data;
        const local = String(global.APP_VERSION || '');
        const remote = String((data && data.v) || '');
        if (global.ValisDevLog) {
          global.ValisDevLog.add('update_check_ok', { local: local, remote: remote });
        }
        if (remote && local && remote !== local && data.forceReload === true) {
          return { ok: true, update: true, data: data };
        }
        return { ok: true, update: false, data: data };
      } catch (e) {
        if (global.ValisDevLog) global.ValisDevLog.add('update_check_error', String(e && e.message || e));
        return { ok: false, error: String(e && e.message || e) };
      }
    },
    softReload: function (ver) {
      try {
        const path = (location.pathname || '/index.html').split('?')[0];
        location.replace(path + '?v=' + encodeURIComponent(ver || 'new') + '&r=' + Date.now());
      } catch (e) {
        location.reload();
      }
    }
  };

  global.ValisUpdate = ValisUpdate;
})(typeof window !== 'undefined' ? window : this);
