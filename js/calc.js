// =====================================================================
// Pantalla - FMPA · cálculos puros (sin DOM). Se usan en la web y se prueban en Node.
// =====================================================================
(function (root) {
  'use strict';
  var AR_TZ = 'America/Argentina/Buenos_Aires';

  // ---------- números ----------
  function num(x) {
    if (x === null || x === undefined || x === '') return null;
    var v = Number(x);
    return Number.isFinite(v) ? v : null;
  }
  function pos(x) { var v = num(x); return v !== null && v > 0 ? v : null; }

  // ---------- fechas: todo como texto "YYYY-MM-DD" (evita problemas de zona horaria) ----------
  function arDate(now) { // fecha de hoy en Argentina
    return new Intl.DateTimeFormat('en-CA', { timeZone: AR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  }
  function arMinutes(now) { // minutos desde las 00:00 en Argentina
    var parts = new Intl.DateTimeFormat('en-GB', { timeZone: AR_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    var h = 0, m = 0;
    parts.forEach(function (p) { if (p.type === 'hour') h = Number(p.value); if (p.type === 'minute') m = Number(p.value); });
    return h * 60 + m;
  }
  function toUTC(d) { var a = d.split('-').map(Number); return Date.UTC(a[0], a[1] - 1, a[2]); }
  function addDays(d, n) { return new Date(toUTC(d) + n * 86400000).toISOString().slice(0, 10); }
  function dayOfWeek(d) { return new Date(toUTC(d)).getUTCDay(); }
  function daysBetween(a, b) { return Math.round((toUTC(b) - toUTC(a)) / 86400000); }
  function isBusinessDay(d, hol) { var w = dayOfWeek(d); return w >= 1 && w <= 5 && !hol.has(d); }
  function nextBusinessDay(d, hol) { var x = addDays(d, 1); while (!isBusinessDay(x, hol)) x = addDays(x, 1); return x; }
  function isMarketOpen(now, hol) {
    var d = arDate(now), m = arMinutes(now);
    return isBusinessDay(d, hol) && m >= 630 && m <= 1020; // 10:30 a 17:00
  }
  function dayStartIso(d) { return new Date(d + 'T00:00:00-03:00').toISOString(); }
  function arDateOfTs(ts) { return arDate(new Date(ts)); }

  // Rango de un gráfico histórico
  function periodStart(period, today) {
    var days = { '1M': 31, '6M': 183, '1A': 366, '5A': 1827 }[period];
    return days ? addDays(today, -days) : '2000-01-01';
  }
  // Intradiario: de las últimas filas (más nuevas primero) nos quedamos con la última rueda, en orden cronológico
  function lastSession(rowsDesc) {
    if (!rowsDesc || !rowsDesc.length) return { date: null, rows: [] };
    var d = arDateOfTs(rowsDesc[0].ts);
    var rows = rowsDesc.filter(function (r) { return arDateOfTs(r.ts) === d; }).reverse();
    return { date: d, rows: rows };
  }

  // ---------- símbolos de data912 de un instrumento ----------
  function symbolsFor(inst) {
    var t = String(inst.ticker).toUpperCase();
    return {
      p: String(inst.simbolo_pesos || t).toUpperCase(),
      d: String(inst.simbolo_mep || t + 'D').toUpperCase(),
      c: String(inst.simbolo_cable || t + 'C').toUpperCase()
    };
  }

  // ---------- dólar y canjes (fórmulas de la hoja "Pantalla" del Excel; comm = comisión por lado, 0.001 = 0,1 %) ----------
  function mepOffer(al30, d, comm) { al30 = pos(al30); d = pos(d); return al30 && d ? (al30 * (1 + comm)) / (d * (1 - comm)) : null; }
  function cclOffer(al30, c, comm) { return mepOffer(al30, c, comm); }
  // "offer - mep a cable"
  function canjeMepCcl(d, c, comm) { d = pos(d); c = pos(c); return d && c ? 1 - (c * (1 - comm)) / (d * (1 + comm)) : null; }
  // "bid - cable a mep"
  function canjeCclMep(d, c, comm) { d = pos(d); c = pos(c); return d && c ? (d * (1 - comm)) / (c * (1 + comm)) - 1 : null; }
  function ratio(a, b) { a = pos(a); b = pos(b); return a && b ? a / b : null; }

  // ---------- tasa fija (hoja "CER - finish" del Excel) ----------
  // price y finish por 100 nominales. TNA = rendimiento × 360/días ; TEM = TNA × 30/365
  function tasaFija(price, finish, days, comm) {
    var p = pos(price), f = pos(finish);
    if (p === null || f === null || !(days > 0)) return { pc: null, rend: null, tna: null, tem: null };
    var pc = p * (1 + comm), rend = f / pc - 1, tna = rend * 360 / days;
    return { pc: pc, rend: rend, tna: tna, tem: tna * 30 / 365 };
  }

  // ---------- orden de tablas (los vacíos siempre al final) ----------
  function compare(a, b, dir) {
    var an = a === null || a === undefined || a === '', bn = b === null || b === undefined || b === '';
    if (an && bn) return 0;
    if (an) return 1;
    if (bn) return -1;
    var r = (typeof a === 'string' || typeof b === 'string') ? String(a).localeCompare(String(b), 'es') : a - b;
    return r * (dir || 1);
  }

  // ---------- formato es-AR ----------
  function fmt(x, d) {
    if (d === undefined) d = 2;
    var v = num(x);
    return v === null ? '—' : v.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function money(x, d) { var v = num(x); return v === null ? '—' : '$ ' + fmt(v, d); }
  function pctPoints(x, d) { var v = num(x); return v === null ? '—' : (v > 0 ? '+' : '') + fmt(v, d === undefined ? 2 : d) + '%'; }   // x ya viene en %
  function pctFrac(x, d) { var v = num(x); return v === null ? '—' : pctPoints(v * 100, d); }                                       // x es fracción
  function dateEs(d) { return d ? d.split('-').reverse().join('/') : '—'; }


  // ---------- calendario hábil ----------
  // Suma n días hábiles (n puede ser negativo). Equivale a WORKDAY.INTL(fecha, n, 1, feriados) de Excel.
  function workdayAdd(d, n, hol) {
    var step = n < 0 ? -1 : 1, left = Math.abs(n), x = d;
    while (left > 0) { x = addDays(x, step); if (isBusinessDay(x, hol)) left--; }
    return x;
  }
  function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); } // m = 1..12

  // ---------- CER: oficial + proyección con inflación mensual (REM) ----------
  // Regla de la hoja "CER - finish": desde el día 16 de cada mes hasta el 15 del siguiente el CER crece cada día
  // (1 + IPC del mes anterior)^(1/días del mes en curso). El IPC del mes M se indica en inflation_projection con mes = 'AAAA-MM'.
  // official: [{fecha:'AAAA-MM-DD', valor}] ; infl: [{mes:'AAAA-MM-01', ipc_mensual, fuente}]
  function buildCER(official, infl) {
    var off = new Map();
    (official || []).forEach(function (r) { var v = pos(r.valor); if (v !== null) off.set(String(r.fecha).slice(0, 10), v); });
    var offDates = Array.from(off.keys()).sort();
    var rates = new Map(), lastMonth = null;
    (infl || []).forEach(function (r) {
      var k = String(r.mes).slice(0, 7), v = num(r.ipc_mensual);
      if (v === null) return;
      rates.set(k, { r: v, supuesto: /supuesto/i.test(String(r.fuente || '')) });
      if (lastMonth === null || k > lastMonth) lastMonth = k;
    });
    var lastOfficial = offDates.length ? offDates[offDates.length - 1] : null;
    var proj = new Map(), extrapAt = new Map();           // fecha -> valor / ¿usó inflación supuesta o extrapolada?
    var cursor = lastOfficial, cursorVal = lastOfficial ? off.get(lastOfficial) : null, cursorExtrap = false;

    function monthShift(y, m, k) { var t = y * 12 + (m - 1) + k; return { y: Math.floor(t / 12), m: (t % 12) + 1 }; }
    function dailyFactor(d) {
      var p = d.split('-').map(Number), y = p[0], m = p[1];
      var per = p[2] >= 16 ? { y: y, m: m } : monthShift(y, m, -1);          // mes en que empezó el tramo (día 16)
      var ipcMonth = monthShift(per.y, per.m, -1);                           // IPC del mes anterior
      var key = ipcMonth.y + '-' + (ipcMonth.m < 10 ? '0' : '') + ipcMonth.m;
      var hit = rates.get(key), extrap = false, rate;
      if (hit) { rate = hit.r; extrap = hit.supuesto; }
      else if (lastMonth !== null) { rate = rates.get(lastMonth).r; extrap = true; }   // sin dato: repite el último mes cargado
      else return null;
      return { f: Math.pow(1 + rate, 1 / daysInMonth(per.y, per.m)), extrap: extrap };
    }
    function at(d) { // -> {v, official, extrap} o null
      if (off.has(d)) return { v: off.get(d), official: true, extrap: false };
      if (proj.has(d)) return { v: proj.get(d), official: false, extrap: extrapAt.get(d) };   // ya calculado antes
      if (cursor === null || d < lastOfficial) return null;
      while (cursor < d) {
        var nx = addDays(cursor, 1), fa = dailyFactor(nx);
        if (fa === null) return null;
        if (off.has(nx)) { cursorVal = off.get(nx); cursorExtrap = false; }
        else { cursorVal = cursorVal * fa.f; cursorExtrap = cursorExtrap || fa.extrap; }
        proj.set(nx, cursorVal); extrapAt.set(nx, cursorExtrap); cursor = nx;
      }
      if (off.has(d)) return { v: off.get(d), official: true, extrap: false };
      return proj.has(d) ? { v: proj.get(d), official: false, extrap: extrapAt.get(d) } : (d === cursor ? { v: cursorVal, official: false, extrap: cursorExtrap } : null);
    }
    return { at: at, lastOfficial: lastOfficial };
  }

  // Un bono CER / dual "bullet" sin intereses (hoja "CER - finish").
  //  price: por 100 VN · emision: CER de emisión · settle/venc: 'AAAA-MM-DD' · lag: días hábiles de rezago (10)
  function cerBond(cer, price, emision, settle, venc, hol, comm, lag) {
    var out = { days: null, cerHoy: null, finishReal: null, tir: null, dur: null, finishProj: null, rendProj: null, tnaProj: null, extrap: false, proj: false };
    var p = pos(price), e = pos(emision);
    if (!venc || e === null) return out;
    var days = daysBetween(settle, venc); out.days = days;
    var hoy = cer.at(workdayAdd(settle, -lag, hol));
    var fin = cer.at(workdayAdd(venc, -lag, hol));
    if (hoy) { out.cerHoy = hoy.v; out.finishReal = hoy.v / e * 100; }
    if (fin) { out.finishProj = fin.v / e * 100; out.extrap = fin.extrap; out.proj = !fin.official; }
    if (p === null || !(days > 0)) return out;
    var pc = p * (1 + comm);
    if (out.finishReal !== null) {                                 // TIR real = XIRR de 2 flujos (365 días), como el Excel
      out.tir = Math.pow(out.finishReal / pc, 365 / days) - 1;
      out.dur = (days / 365) / (1 + out.tir);                      // duration = años / (1 + TIR), como el Excel
    }
    if (out.finishProj !== null) { out.rendProj = out.finishProj / pc - 1; out.tnaProj = out.rendProj * 360 / days; }
    return out;
  }

  // ---------- curva de tendencia logarítmica: y = a + b·ln(x)  (igual que la línea de tendencia logarítmica de Excel) ----------
  function logFit(points) {
    var p = (points || []).filter(function (q) { return num(q.x) !== null && num(q.y) !== null && q.x > 0; });
    if (p.length < 3) return null;
    var n = p.length, sx = 0, sy = 0, i;
    for (i = 0; i < n; i++) { sx += Math.log(p[i].x); sy += p[i].y; }
    var mx = sx / n, my = sy / n, sxy = 0, sxx = 0, sst = 0, sse;
    for (i = 0; i < n; i++) { var dx = Math.log(p[i].x) - mx; sxy += dx * (p[i].y - my); sxx += dx * dx; sst += (p[i].y - my) * (p[i].y - my); }
    if (sxx === 0) return null;
    var b = sxy / sxx, a = my - b * mx;
    sse = 0;
    for (i = 0; i < n; i++) { var e = p[i].y - (a + b * Math.log(p[i].x)); sse += e * e; }
    return { a: a, b: b, r2: sst === 0 ? 1 : 1 - sse / sst, n: n, min: Math.min.apply(null, p.map(function (q) { return q.x; })), max: Math.max.apply(null, p.map(function (q) { return q.x; })) };
  }
  function evalLog(fit, x) { return fit.a + fit.b * Math.log(x); }
  function trendLine(fit, steps) {
    var out = [], k = steps || 40;
    for (var i = 0; i <= k; i++) { var x = fit.min + (fit.max - fit.min) * i / k; out.push({ x: x, y: evalLog(fit, x) }); }
    return out;
  }

  var api = {
    num: num, pos: pos, arDate: arDate, arMinutes: arMinutes, addDays: addDays, dayOfWeek: dayOfWeek, daysBetween: daysBetween,
    isBusinessDay: isBusinessDay, nextBusinessDay: nextBusinessDay, isMarketOpen: isMarketOpen, dayStartIso: dayStartIso,
    arDateOfTs: arDateOfTs, periodStart: periodStart, lastSession: lastSession, symbolsFor: symbolsFor,
    mepOffer: mepOffer, cclOffer: cclOffer, canjeMepCcl: canjeMepCcl, canjeCclMep: canjeCclMep, ratio: ratio,
    tasaFija: tasaFija, workdayAdd: workdayAdd, daysInMonth: daysInMonth, buildCER: buildCER, cerBond: cerBond,
    logFit: logFit, evalLog: evalLog, trendLine: trendLine, compare: compare, fmt: fmt, money: money, pctPoints: pctPoints, pctFrac: pctFrac, dateEs: dateEs
  };
  root.CPQ = root.CPQ || {};
  root.CPQ.calc = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
