// =====================================================================
// CuentasPQ · cálculos puros (sin DOM). Se usan en la web y se prueban en Node.
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

  var api = {
    num: num, pos: pos, arDate: arDate, arMinutes: arMinutes, addDays: addDays, dayOfWeek: dayOfWeek, daysBetween: daysBetween,
    isBusinessDay: isBusinessDay, nextBusinessDay: nextBusinessDay, isMarketOpen: isMarketOpen, dayStartIso: dayStartIso,
    arDateOfTs: arDateOfTs, periodStart: periodStart, lastSession: lastSession, symbolsFor: symbolsFor,
    mepOffer: mepOffer, cclOffer: cclOffer, canjeMepCcl: canjeMepCcl, canjeCclMep: canjeCclMep, ratio: ratio,
    tasaFija: tasaFija, compare: compare, fmt: fmt, money: money, pctPoints: pctPoints, pctFrac: pctFrac, dateEs: dateEs
  };
  root.CPQ = root.CPQ || {};
  root.CPQ.calc = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
