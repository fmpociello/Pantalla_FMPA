// Lectura de Supabase (solo lectura, con la clave pública). Sin librerías: usa fetch directo a la API REST.
(function (root) {
  'use strict';
  var cfg = root.CPQ_CONFIG;

  async function get(table, params) {
    var url = new URL(cfg.SUPABASE_URL + '/rest/v1/' + table);
    Object.keys(params || {}).forEach(function (k) { url.searchParams.set(k, params[k]); });
    var r = await fetch(url.toString(), { headers: { apikey: cfg.SUPABASE_KEY, Accept: 'application/json' } });
    if (!r.ok) throw new Error(table + ': HTTP ' + r.status);
    return r.json();
  }

  // Trae todo paginando de a 1000 filas (el servidor corta en 1000 por consulta)
  async function getAll(table, params) {
    var out = [], off = 0, size = 1000;
    for (;;) {
      var p = Object.assign({}, params, { limit: String(size), offset: String(off) });
      var rows = await get(table, p);
      out = out.concat(rows);
      if (rows.length < size) break;
      off += size;
    }
    return out;
  }

  root.CPQ = root.CPQ || {};
  root.CPQ.api = { get: get, getAll: getAll };
})(typeof window !== 'undefined' ? window : globalThis);
