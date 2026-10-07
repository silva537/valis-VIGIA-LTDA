/**
 * VALIS DEV Log — arquivo externo (não pesa o index)
 * Registro só para cargo DEV: boots, sync, login, updates.
 */
(function (global) {
  const KEY = 'valis_dev_log_v1';
  const MAX = 200;

  function now() {
    try { return new Date().toISOString(); } catch (e) { return String(Date.now()); }
  }

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function write(arr) {
    try {
      localStorage.setItem(KEY, JSON.stringify(arr.slice(0, MAX)));
    } catch (e) {}
  }

  const ValisDevLog = {
    add: function (event, detail) {
      const entry = {
        em: now(),
        event: String(event || 'event'),
        detail: detail == null ? '' : (typeof detail === 'string' ? detail : JSON.stringify(detail)),
        ver: (global.APP_VERSION || '')
      };
      const arr = read();
      arr.unshift(entry);
      write(arr);
      try {
        if (global.firebaseOk && global.fbDb && global.DataService && global.DataService.mode === 'firebase') {
          global.fbDb.collection('valis').doc('dev_log').set({
            items: arr.slice(0, 80),
            updatedAt: entry.em
          }, { merge: true }).catch(function () {});
        }
      } catch (e) {}
      return entry;
    },
    list: function () { return read(); },
    clear: function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      try {
        if (global.firebaseOk && global.fbDb) {
          global.fbDb.collection('valis').doc('dev_log').set({ items: [], updatedAt: now() }).catch(function () {});
        }
      } catch (e) {}
    },
    pullFirebase: async function () {
      try {
        if (!global.firebaseOk || !global.fbDb) return read();
        const snap = await global.fbDb.collection('valis').doc('dev_log').get();
        if (snap.exists && snap.data() && Array.isArray(snap.data().items)) {
          const remote = snap.data().items;
          const local = read();
          const map = {};
          local.concat(remote).forEach(function (x) {
            const k = (x.em || '') + '|' + (x.event || '');
            map[k] = x;
          });
          const merged = Object.keys(map).map(function (k) { return map[k]; })
            .sort(function (a, b) { return String(b.em).localeCompare(String(a.em)); });
          write(merged);
          return merged;
        }
      } catch (e) {}
      return read();
    }
  };

  global.ValisDevLog = ValisDevLog;
})(typeof window !== 'undefined' ? window : this);
