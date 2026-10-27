// =====================================================================
// CuentasPQ · pantalla. Lee todo de Supabase (solo lectura) y dibuja las 4 pestañas.
// =====================================================================
(function () {
  'use strict';
  var C = window.CPQ.calc, API = window.CPQ.api, CFG = window.CPQ_CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };
  var AR = 'America/Argentina/Buenos_Aires';

  var S = {
    quotes: new Map(), inst: [], instBy: new Map(), hol: new Set(), official: [],
    comm: 0, period: 'hoy', sort: {}, charts: {}, hist: {}, hcur: null,
    staticAt: 0, busy: false, errors: []
  };

  // ---------- comisión (se recuerda en este navegador; por defecto 0 %) ----------
  function loadComm() {
    try { var v = Number(localStorage.getItem('cuentaspq_comm_v6')); return Number.isFinite(v) && v >= 0 && v <= 5 ? v / 100 : 0; } catch (e) { return 0; }
  }
  function saveComm(pct) { try { localStorage.setItem('cuentaspq_comm_v6', String(pct)); } catch (e) { /* sin almacenamiento: no pasa nada */ } }

  // ---------- helpers de datos ----------
  function qv(sym) {
    var x = S.quotes.get(String(sym).toUpperCase());
    return x ? { last: C.pos(x.last), pct: C.num(x.pct_change), vol: C.num(x.volume) } : { last: null, pct: null, vol: null };
  }
  function setText(id, t) { var e = $(id); if (e) e.textContent = t; }
  function vr(p) { var v = C.num(p); return '<span class="variation ' + (v === null || v === 0 ? 'muted' : v > 0 ? 'green' : 'red') + '">' + C.pctPoints(v) + '</span>'; }
  function blue(t) { return '<span class="blue">' + t + '</span>'; }
  function yellow(t) { return '<span class="yellow">' + t + '</span>'; }
  function timeAr(ms, withDate) {
    var d = new Date(ms);
    var t = d.toLocaleTimeString('es-AR', { timeZone: AR, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    return withDate ? C.dateEs(C.arDate(d)).slice(0, 5) + ' ' + t : t;
  }

  // ---------- tablas ordenables ----------
  function drawTable(id, cols, rows, defCmp) {
    var el = $(id); if (!el) return;
    var st = S.sort[id], sorted = rows.slice();
    var col = st && st.k ? cols.filter(function (c) { return c.k === st.k; })[0] : null;
    if (col) sorted.sort(function (a, b) { return C.compare(col.val(a), col.val(b), st.dir); }); else sorted.sort(defCmp);
    var head = '<thead><tr>' + cols.map(function (c) {
      var arrow = col && col.k === c.k ? '<span class="arrow">' + (st.dir > 0 ? '▲' : '▼') + '</span>' : '';
      return '<th class="sortable" data-t="' + id + '" data-k="' + c.k + '" data-d="' + (c.first || 1) + '">' + c.label + arrow + '</th>';
    }).join('') + '</tr></thead>';
    var body = sorted.length ? sorted.map(function (r) {
      return '<tr>' + cols.map(function (c) { return '<td' + (c.cls ? ' class="' + c.cls + '"' : '') + '>' + c.html(r) + '</td>'; }).join('') + '</tr>';
    }).join('') : '<tr><td colspan="' + cols.length + '" class="empty">Sin datos.</td></tr>';
    el.innerHTML = head + '<tbody>' + body + '</tbody>';
  }
  var byOrden = function (a, b) { return C.compare(a.orden, b.orden, 1); };
  var byVenc = function (a, b) { return C.compare(a.venc, b.venc, 1) || C.compare(a.orden, b.orden, 1); };
  var tk = function (r) { return '<span class="symbol">' + esc(r.tk) + '</span>'; };

  document.addEventListener('click', function (e) {
    var th = e.target.closest ? e.target.closest('th.sortable') : null;
    if (!th) return;
    var id = th.getAttribute('data-t'), k = th.getAttribute('data-k'), st = S.sort[id];
    if (st && st.k === k) st.dir = -st.dir; else S.sort[id] = { k: k, dir: Number(th.getAttribute('data-d')) || 1 };
    renderAll();
  });

  // ---------- gráficos ----------
  function lineChart(id, labels, datasets, tip) {
    var cv = $(id), empty = $(id.replace('Chart', 'ChartEmpty'));
    if (!cv || !empty) return;
    var has = labels.length >= 2 && datasets.some(function (ds) { return ds.data.some(function (v) { return v !== null && v !== undefined; }); });
    if (!window.Chart) { cv.classList.add('hide'); empty.textContent = 'No se pudo cargar la librería de gráficos.'; empty.classList.remove('hide'); return; }
    if (!has) {
      if (S.charts[id]) { S.charts[id].destroy(); delete S.charts[id]; }
      cv.classList.add('hide'); empty.classList.remove('hide'); return;
    }
    cv.classList.remove('hide'); empty.classList.add('hide');
    var ch = S.charts[id];
    if (ch && ch.data.datasets.length === datasets.length) {
      ch.data.labels = labels;
      datasets.forEach(function (ds, i) { ch.data.datasets[i].data = ds.data; });
      ch.update('none'); return;
    }
    if (ch) ch.destroy();
    S.charts[id] = new window.Chart(cv, {
      type: 'line', data: { labels: labels, datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: datasets.length > 1, labels: { color: '#cbd5e1' } }, tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + tip(c.raw); } } } },
        scales: { x: { ticks: { color: '#94a3b8', maxTicksLimit: 7 }, grid: { display: false } }, y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,.08)' } } }
      }
    });
  }
  var ds = function (label, data, color, fill, pts) {
    return { label: label, data: data, borderColor: color, backgroundColor: color + '22', fill: !!fill, pointRadius: pts || 0, borderWidth: 2, tension: .2, spanGaps: true };
  };
  var x100 = function (v) { return v === null || v === undefined ? null : v * 100; };

  async function loadHist(period, force) {
    var c = S.hist[period];
    if (!force && c && Date.now() - c.t < (period === 'hoy' ? 25000 : 600000)) return c;
    var out;
    if (period === 'hoy') {
      var rows = await API.get('fx_intraday', { select: 'ts,mep,ccl,canje_mep_ccl,canje_ccl_mep', order: 'ts.desc', limit: '450' });
      var ls = C.lastSession(rows);
      out = {
        kind: 'intra', date: ls.date,
        labels: ls.rows.map(function (r) { return new Date(r.ts).toLocaleTimeString('es-AR', { timeZone: AR, hour: '2-digit', minute: '2-digit', hour12: false }); }),
        mep: ls.rows.map(function (r) { return C.num(r.mep); }), ccl: ls.rows.map(function (r) { return C.num(r.ccl); }),
        c1: ls.rows.map(function (r) { return x100(C.num(r.canje_mep_ccl)); }), c2: ls.rows.map(function (r) { return x100(C.num(r.canje_ccl_mep)); })
      };
    } else {
      var d = await API.getAll('fx_daily', { select: 'fecha,mep_close,ccl_close,canje_mep_ccl_close,canje_ccl_mep_close', fecha: 'gte.' + C.periodStart(period, C.arDate(new Date())), order: 'fecha.asc' });
      out = {
        kind: 'daily', date: null,
        labels: d.map(function (r) { return r.fecha.slice(8, 10) + '/' + r.fecha.slice(5, 7) + '/' + r.fecha.slice(2, 4); }),
        mep: d.map(function (r) { return C.num(r.mep_close); }), ccl: d.map(function (r) { return C.num(r.ccl_close); }),
        c1: d.map(function (r) { return x100(C.num(r.canje_mep_ccl_close)); }), c2: d.map(function (r) { return x100(C.num(r.canje_ccl_mep_close)); })
      };
    }
    out.t = Date.now(); S.hist[period] = out; return out;
  }
  var PLABEL = { '1M': 'último mes', '6M': 'últimos 6 meses', '1A': 'último año', '5A': 'últimos 5 años' };
  function drawHist(h) {
    if (!h) return;
    var title = 'Evolución';
    if (h.kind === 'intra') title += h.date ? (h.date === C.arDate(new Date()) ? ' · hoy' : ' · última rueda ' + C.dateEs(h.date)) : ' · sin datos';
    else title += ' · ' + PLABEL[S.period];
    setText('histTitle', title);
    var pts = h.kind === 'intra' ? 1.5 : 0;
    lineChart('mepChart', h.labels, [ds('MEP', h.mep, '#60a5fa', true, pts)], function (v) { return C.money(v); });
    lineChart('cclChart', h.labels, [ds('CCL', h.ccl, '#fbbf24', true, pts)], function (v) { return C.money(v); });
    lineChart('canjeChart', h.labels, [ds('MEP → cable', h.c1, '#10b981', false, pts), ds('cable → MEP', h.c2, '#a78bfa', false, pts)], function (v) { return C.fmt(v) + '%'; });
  }

  // ---------- pestaña: dólares ----------
  function renderFX() {
    var a = qv('AL30'), d = qv('AL30D'), c = qv('AL30C'), cm = S.comm;
    var mep = C.mepOffer(a.last, d.last, cm), ccl = C.cclOffer(a.last, c.last, cm);
    setText('mepValue', C.money(mep)); setText('cclValue', C.money(ccl));
    setText('canjeDC', C.pctFrac(C.canjeMepCcl(d.last, c.last, cm))); setText('canjeCD', C.pctFrac(C.canjeCclMep(d.last, c.last, cm)));

    var rows = [
      { tk: 'AL30 · pesos', q: a, imp: null, o: 1 }, { tk: 'AL30D · especie MEP', q: d, imp: mep, o: 2 }, { tk: 'AL30C · especie cable', q: c, imp: ccl, o: 3 }
    ];
    drawTable('tblFx', [
      { k: 'tk', label: 'Operación / especie', html: tk, val: function (r) { return r.o; } },
      { k: 'l', label: 'Último', html: function (r) { return blue(C.fmt(r.q.last, 2)); }, val: function (r) { return r.q.last; } },
      { k: 'imp', label: 'Precio implícito', html: function (r) { return blue(r.imp === null ? '—' : C.money(r.imp)); }, val: function (r) { return r.imp; } },
      { k: 'v', label: 'Variación', html: function (r) { return vr(r.q.pct); }, val: function (r) { return r.q.pct; } }
    ], rows, function (x, y) { return x.o - y.o; });

    var seen = {}, cards = [];
    S.official.forEach(function (o) { if (!seen[o.codigo]) { seen[o.codigo] = 1; cards.push(o); } });
    $('officialCards').innerHTML = cards.length ? cards.map(function (o) {
      return '<div class="card"><div class="metric-label">' + esc(o.descripcion || o.codigo) + ' (' + esc(o.codigo) + ')</div><div class="metric-value">' + C.money(o.valor) +
        '</div><div class="metric-foot">BCRA · fecha ' + C.dateEs(o.fecha) + '</div></div>';
    }).join('') : '<div class="card"><div class="empty small">Sin datos todavía.</div></div>';
  }

  // ---------- pestaña: soberanos ----------
  function renderSov() {
    var q = ($('sovSearch').value || '').toUpperCase();
    var rows = S.inst.filter(function (i) { return i.tipo === 'soberano' && i.ticker.toUpperCase().indexOf(q) >= 0; }).map(function (i) {
      var s = C.symbolsFor(i), p = qv(s.p), d = qv(s.d), c = qv(s.c);
      var par = i.par_ley ? S.instBy.get(String(i.par_ley).toUpperCase()) : null;
      var dPar = par ? qv(C.symbolsFor(par).d).last : null;
      return { orden: i.orden, tk: i.ticker, p: p, d: d, c: c, mep: C.ratio(p.last, d.last), ccl: C.ratio(p.last, c.last), canje: C.canjeMepCcl(d.last, c.last, S.comm), ley: C.ratio(d.last, dPar) };
    });
    drawTable('tblSov', [
      { k: 'tk', label: 'Bono', html: function (r) { return tk(r) + '<div class="small muted">T+1</div>'; }, val: function (r) { return r.tk; } },
      { k: 'p', label: 'Pesos', first: -1, html: function (r) { return blue(C.fmt(r.p.last, 2)); }, val: function (r) { return r.p.last; } },
      { k: 'pv', label: 'Var. %', first: -1, html: function (r) { return vr(r.p.pct); }, val: function (r) { return r.p.pct; } },
      { k: 'd', label: 'MEP (D)', first: -1, html: function (r) { return blue(C.fmt(r.d.last, 2)); }, val: function (r) { return r.d.last; } },
      { k: 'dv', label: 'Var. %', first: -1, html: function (r) { return vr(r.d.pct); }, val: function (r) { return r.d.pct; } },
      { k: 'c', label: 'Cable (C)', first: -1, html: function (r) { return blue(C.fmt(r.c.last, 2)); }, val: function (r) { return r.c.last; } },
      { k: 'cv', label: 'Var. %', first: -1, html: function (r) { return vr(r.c.pct); }, val: function (r) { return r.c.pct; } },
      { k: 'mep', label: 'MEP implícito', first: -1, html: function (r) { return blue(r.mep === null ? '—' : C.money(r.mep)); }, val: function (r) { return r.mep; } },
      { k: 'ccl', label: 'CCL implícito', first: -1, html: function (r) { return blue(r.ccl === null ? '—' : C.money(r.ccl)); }, val: function (r) { return r.ccl; } },
      { k: 'canje', label: 'Canje salir*', first: -1, html: function (r) { return yellow(C.pctFrac(r.canje)); }, val: function (r) { return r.canje; } },
      { k: 'ley', label: 'Ratio de ley*', first: -1, html: function (r) { return yellow(r.ley === null ? '—' : C.fmt(r.ley, 4)); }, val: function (r) { return r.ley; } }
    ], rows, byOrden);
  }

  // ---------- pestaña: tasa fija y CER ----------
  function renderRates() {
    var today = C.arDate(new Date()), settle = C.nextBusinessDay(today, S.hol);
    setText('settleInfo', 'Liquidación T+1: ' + C.dateEs(settle) + ' · precios por 100 nominales');

    var fixed = S.inst.filter(function (i) { return i.tipo === 'tasa_fija' && i.vencimiento; }).map(function (i) {
      var q = qv(C.symbolsFor(i).p), days = C.daysBetween(settle, i.vencimiento), tf = C.tasaFija(q.last, i.finish, days, S.comm);
      return { orden: i.orden, tk: i.ticker, venc: i.vencimiento, days: days, q: q, finish: C.num(i.finish), tf: tf };
    }).filter(function (r) { return r.days > 0; });
    drawTable('tblFixed', [
      { k: 'tk', label: 'Ticker', html: tk, val: function (r) { return r.tk; } },
      { k: 'l', label: 'Último', first: -1, html: function (r) { return blue(C.fmt(r.q.last, 3)); }, val: function (r) { return r.q.last; } },
      { k: 'pc', label: 'c/comisión', first: -1, html: function (r) { return blue(C.fmt(r.tf.pc, 3)); }, val: function (r) { return r.tf.pc; } },
      { k: 'v', label: 'Var. %', first: -1, html: function (r) { return vr(r.q.pct); }, val: function (r) { return r.q.pct; } },
      { k: 'venc', label: 'Vencimiento', html: function (r) { return C.dateEs(r.venc); }, val: function (r) { return r.venc; } },
      { k: 'days', label: 'Días', html: function (r) { return String(r.days); }, val: function (r) { return r.days; } },
      { k: 'fin', label: 'Finish', first: -1, html: function (r) { return C.fmt(r.finish, 4); }, val: function (r) { return r.finish; } },
      { k: 'rend', label: 'Rendimiento', first: -1, html: function (r) { return yellow(C.pctFrac(r.tf.rend)); }, val: function (r) { return r.tf.rend; } },
      { k: 'tna', label: 'TNA', first: -1, html: function (r) { return yellow(C.pctFrac(r.tf.tna)); }, val: function (r) { return r.tf.tna; } },
      { k: 'tem', label: 'TEM', first: -1, html: function (r) { return yellow(C.pctFrac(r.tf.tem)); }, val: function (r) { return r.tf.tem; } },
      { k: 'vol', label: 'Volumen', first: -1, html: function (r) { return C.fmt(r.q.vol, 0); }, val: function (r) { return r.q.vol; } }
    ], fixed, byVenc);

    var curve = fixed.filter(function (r) { return r.tf.tna !== null; }).sort(function (a, b) { return a.days - b.days; });
    lineChart('fixedChart', curve.map(function (r) { return r.days + ' d'; }), [ds('TNA (%)', curve.map(function (r) { return r.tf.tna * 100; }), '#fbbf24', true, 3)], function (v) { return C.fmt(v) + '%'; });

    function cerRows(tipos) {
      return S.inst.filter(function (i) { return tipos.indexOf(i.tipo) >= 0 && (!i.vencimiento || i.vencimiento >= today); }).map(function (i) {
        return { orden: i.orden, tk: i.ticker, venc: i.vencimiento, days: i.vencimiento ? C.daysBetween(settle, i.vencimiento) : null, q: qv(C.symbolsFor(i).p), nota: i.nota };
      });
    }
    var cerCols = [
      { k: 'tk', label: 'Ticker', html: function (r) { return tk(r) + (r.nota ? '<div class="small muted">' + esc(r.nota) + '</div>' : ''); }, val: function (r) { return r.tk; } },
      { k: 'l', label: 'Último', first: -1, html: function (r) { return blue(C.fmt(r.q.last, 3)); }, val: function (r) { return r.q.last; } },
      { k: 'v', label: 'Var. %', first: -1, html: function (r) { return vr(r.q.pct); }, val: function (r) { return r.q.pct; } },
      { k: 'venc', label: 'Vencimiento', html: function (r) { return C.dateEs(r.venc); }, val: function (r) { return r.venc; } },
      { k: 'days', label: 'Días', html: function (r) { return r.days === null ? '—' : String(r.days); }, val: function (r) { return r.days; } },
      { k: 'tir', label: 'TIR', html: function () { return '<span class="muted">—</span>'; }, val: function () { return null; } },
      { k: 'tna', label: 'TNA', html: function () { return '<span class="muted">—</span>'; }, val: function () { return null; } },
      { k: 'dur', label: 'Duration', html: function () { return '<span class="muted">—</span>'; }, val: function () { return null; } },
      { k: 'vol', label: 'Volumen', first: -1, html: function (r) { return C.fmt(r.q.vol, 0); }, val: function (r) { return r.q.vol; } }
    ];
    drawTable('tblCer', cerCols, cerRows(['cer', 'tx']), byVenc);
    drawTable('tblDual', cerCols, cerRows(['dual']), byVenc);
  }

  // ---------- pestaña: equity ----------
  function renderEquity() {
    var stocks = S.inst.filter(function (i) { return i.tipo === 'accion'; }).map(function (i) {
      var s = C.symbolsFor(i), p = qv(s.p), d = qv(s.d);
      return { orden: i.orden, tk: i.ticker, p: p, d: d, mep: C.ratio(p.last, d.last) };
    });
    drawTable('tblStocks', [
      { k: 'tk', label: 'Acción', html: tk, val: function (r) { return r.tk; } },
      { k: 'p', label: 'Pesos', first: -1, html: function (r) { return blue(C.fmt(r.p.last, 2)); }, val: function (r) { return r.p.last; } },
      { k: 'pv', label: 'Var. %', first: -1, html: function (r) { return vr(r.p.pct); }, val: function (r) { return r.p.pct; } },
      { k: 'd', label: 'MEP', first: -1, html: function (r) { return blue(C.fmt(r.d.last, 4)); }, val: function (r) { return r.d.last; } },
      { k: 'dv', label: 'Var. %', first: -1, html: function (r) { return vr(r.d.pct); }, val: function (r) { return r.d.pct; } },
      { k: 'mep', label: 'MEP implícito', first: -1, html: function (r) { return blue(r.mep === null ? '—' : C.money(r.mep)); }, val: function (r) { return r.mep; } }
    ], stocks, byOrden);

    var q = ($('cedearSearch').value || '').toUpperCase();
    var ced = S.inst.filter(function (i) { return i.tipo === 'cedear' && i.ticker.toUpperCase().indexOf(q) >= 0; }).map(function (i) {
      var s = C.symbolsFor(i), p = qv(s.p), d = qv(s.d), c = qv(s.c);
      return { orden: i.orden, tk: i.ticker, p: p, d: d, c: c, mep: C.ratio(p.last, d.last), ccl: C.ratio(p.last, c.last), canje: C.ratio(d.last, c.last) === null ? null : C.ratio(d.last, c.last) - 1 };
    });
    var px = function (k, label, get, dec) {
      return { k: k, label: label, first: -1, html: function (r) { return blue(C.fmt(get(r), dec)); }, val: get };
    };
    drawTable('tblCedears', [
      { k: 'tk', label: 'CEDEAR', html: tk, val: function (r) { return r.tk; } },
      px('p', 'Pesos', function (r) { return r.p.last; }, 2),
      { k: 'pv', label: 'Var. %', first: -1, html: function (r) { return vr(r.p.pct); }, val: function (r) { return r.p.pct; } },
      px('d', 'MEP', function (r) { return r.d.last; }, 4),
      { k: 'dv', label: 'Var. %', first: -1, html: function (r) { return vr(r.d.pct); }, val: function (r) { return r.d.pct; } },
      px('c', 'Cable', function (r) { return r.c.last; }, 4),
      { k: 'cv', label: 'Var. %', first: -1, html: function (r) { return vr(r.c.pct); }, val: function (r) { return r.c.pct; } },
      { k: 'mep', label: 'MEP implícito', first: -1, html: function (r) { return blue(r.mep === null ? '—' : C.money(r.mep)); }, val: function (r) { return r.mep; } },
      { k: 'ccl', label: 'CCL implícito', first: -1, html: function (r) { return blue(r.ccl === null ? '—' : C.money(r.ccl)); }, val: function (r) { return r.ccl; } },
      { k: 'canje', label: 'Canje implícito', first: -1, html: function (r) { return yellow(C.pctFrac(r.canje)); }, val: function (r) { return r.canje; } }
    ], ced, byOrden);
  }

  // ---------- estado de los datos ----------
  function renderStatus() {
    var now = new Date(), open = C.isMarketOpen(now, S.hol), newest = null;
    S.quotes.forEach(function (q) { var t = Date.parse(q.updated_at); if (t && (!newest || t > newest)) newest = t; });
    var dot = $('statusDot'), label;
    if (!newest) { dot.className = 'dot bad'; label = 'Sin datos'; }
    else if (open && now - newest > 180000) { dot.className = 'dot stale'; label = 'Datos demorados · último ' + timeAr(newest, false); }
    else if (open) { dot.className = 'dot ok'; label = 'Datos al ' + timeAr(newest, false); }
    else { dot.className = 'dot off'; label = 'Mercado cerrado · último dato ' + timeAr(newest, C.arDate(new Date(newest)) !== C.arDate(now)); }
    setText('statusText', label);
    ['fxUpdated', 'sovUpdated', 'ratesUpdated', 'equityUpdated'].forEach(function (id) { setText(id, label); });
  }

  function renderAll() { renderStatus(); renderFX(); renderSov(); renderRates(); renderEquity(); drawHist(S.hcur); }

  // ---------- carga de datos ----------
  async function loadStatic() {
    var r = await Promise.all([
      API.get('instruments', { select: '*', activo: 'eq.true', order: 'orden.asc' }),
      API.getAll('holidays', { select: 'fecha' })
    ]);
    S.inst = r[0]; S.instBy = new Map(S.inst.map(function (i) { return [String(i.ticker).toUpperCase(), i]; }));
    S.hol = new Set(r[1].map(function (h) { return h.fecha; }));
    S.staticAt = Date.now();
  }

  async function refresh() {
    if (S.busy) return;
    S.busy = true;
    var btn = $('refreshBtn'); btn.textContent = '↻ Actualizando…'; btn.disabled = true;
    var errs = [];
    var jobs = [
      API.getAll('quotes_latest', { select: 'ticker,last,pct_change,volume,updated_at' }).then(function (rows) {
        S.quotes = new Map(rows.map(function (r) { return [String(r.ticker).toUpperCase(), r]; }));
      }),
      API.get('official_rates', { select: '*', order: 'fecha.desc', limit: '12' }).then(function (r) { S.official = r; })
    ];
    if (!S.staticAt || Date.now() - S.staticAt > 300000) jobs.push(loadStatic());
    var res = await Promise.all(jobs.map(function (p) { return p.catch(function (e) { errs.push(e.message); }); }));
    try { S.hcur = await loadHist(S.period, false); } catch (e) { errs.push(e.message); }
    renderAll();
    var box = $('errBox');
    if (errs.length) { box.textContent = 'No se pudieron leer algunos datos (' + errs.slice(0, 3).join(' · ') + '). Se reintenta solo en unos segundos.'; box.classList.remove('hide'); }
    else box.classList.add('hide');
    btn.textContent = '↻ Actualizar'; btn.disabled = false; S.busy = false;
    return res;
  }

  // ---------- eventos ----------
  function init() {
    S.comm = loadComm();
    $('commissionInput').value = (S.comm * 100).toFixed(2);
    document.querySelectorAll('.disclaimer').forEach(function (e) { e.textContent = CFG.DISCLAIMER; });

    $('commissionInput').addEventListener('input', function () {
      var v = Number(this.value);
      if (this.value === '' || !Number.isFinite(v) || v < 0 || v > 5) return;
      S.comm = v / 100; saveComm(v); renderAll();
    });
    $('commissionInput').addEventListener('change', function () { this.value = (S.comm * 100).toFixed(2); });
    $('refreshBtn').addEventListener('click', function () { refresh(); });
    $('sovSearch').addEventListener('input', renderSov);
    $('cedearSearch').addEventListener('input', renderEquity);

    document.querySelectorAll('.tab').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t === b); });
        ['fx', 'sov', 'rates', 'equity'].forEach(function (k) { $('page-' + k).classList.toggle('hide', k !== b.getAttribute('data-tab')); });
        Object.keys(S.charts).forEach(function (k) { S.charts[k].resize(); });
      });
    });
    $('periodBar').addEventListener('click', async function (e) {
      var b = e.target.closest ? e.target.closest('button[data-p]') : null;
      if (!b) return;
      S.period = b.getAttribute('data-p');
      document.querySelectorAll('#periodBar button').forEach(function (x) { x.classList.toggle('on', x === b); });
      try { S.hcur = await loadHist(S.period, true); } catch (err) { S.hcur = null; $('errBox').textContent = 'No se pudo leer el historial (' + err.message + ').'; $('errBox').classList.remove('hide'); }
      drawHist(S.hcur);
    });

    document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
    setInterval(function () { if (!document.hidden) refresh(); }, CFG.REFRESH_MS);
    return refresh();
  }

  window.CPQ.app = { S: S, refresh: refresh, init: init, renderAll: renderAll };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
