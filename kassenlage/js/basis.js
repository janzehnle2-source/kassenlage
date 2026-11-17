/* Kleine Helfer: Datum, Geldformat, Zahlen lesen. */
(function (root) {
  'use strict';
  const FA = root.FA = root.FA || {};
  const U = FA.util = {};

  const z2 = n => (n < 10 ? '0' : '') + n;
  const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  U.z2 = z2;
  U.MONATE = MONATE;

  // Datum als Text 'JJJJ-MM-TT'; gerechnet wird in UTC, damit die Zeitumstellung nichts verschiebt.
  U.d = s => { const p = String(s).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); };
  U.iso = d => d.toISOString().slice(0, 10);
  U.heute = () => { const n = new Date(); return n.getFullYear() + '-' + z2(n.getMonth() + 1) + '-' + z2(n.getDate()); };
  U.ymPlus = (ym, n) => {
    let y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) + n;
    y += Math.floor((m - 1) / 12);
    m = ((m - 1) % 12 + 12) % 12 + 1;
    return y + '-' + z2(m);
  };
  U.tageImMonat = ym => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
  U.plusTage = (s, n) => { const d = U.d(s); d.setUTCDate(d.getUTCDate() + n); return U.iso(d); };
  U.tageZwischen = (a, b) => Math.round((U.d(b) - U.d(a)) / 86400000);
  U.wochentag = s => U.d(s).getUTCDay(); // 0 = Sonntag
  U.monatName = ym => MONATE[Number(ym.slice(5, 7)) - 1] + ' ' + ym.slice(0, 4);
  U.monatNur = ym => MONATE[Number(ym.slice(5, 7)) - 1];
  U.monatKurz = ym => KURZ[Number(ym.slice(5, 7)) - 1];
  U.datumDE = s => s ? s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4) : '';
  U.datumKurz = s => s ? s.slice(8, 10) + '.' + s.slice(5, 7) + '.' : '';

  // Gehaltstag eines Monats; fällt er aufs Wochenende, gilt der Freitag davor. tag 0 = Monatsende.
  U.gehaltsDatum = function (ym, tag) {
    const dim = U.tageImMonat(ym);
    const t = tag > 0 ? Math.min(tag, dim) : dim;
    let s = ym + '-' + z2(t);
    const wt = U.wochentag(s);
    if (wt === 6) s = U.plusTage(s, -1); else if (wt === 0) s = U.plusTage(s, -2);
    return s;
  };

  const fEur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
  const fEur0 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const fZahl = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
  U.eur = x => fEur.format(Math.abs(x || 0) < 0.005 ? 0 : x);
  U.eur0 = x => fEur0.format(Math.round(x || 0) || 0);
  U.eurVz = x => (x > 0.004 ? '+' : '') + U.eur(x);
  U.num = x => fZahl.format(x || 0);
  U.r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;

  // Liest deutsche und englische Schreibweisen: "1.234,56", "1234.56", "12,50-", "(12,50)".
  U.zahl = function (v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    let s = String(v == null ? '' : v).trim().replace(/[€$£%\s ']/g, '').replace(/[−–]/g, '-');
    if (!s) return NaN;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/-$/.test(s)) { neg = true; s = s.slice(0, -1); }
    const k = s.lastIndexOf(','), p = s.lastIndexOf('.');
    if (k > -1 && p > -1) s = k > p ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (k > -1) s = s.split(',').length > 2 ? s.replace(/,/g, '') : s.replace(',', '.');
    else if (p > -1 && /^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = Number(s);
    return isNaN(n) ? NaN : (neg ? -n : n);
  };
  // Für Eingabefelder: leeres Feld ergibt den Vorgabewert.
  U.zahlOder = (v, vorgabe) => { const n = U.zahl(v); return isNaN(n) ? vorgabe : n; };
  U.zahlText = x => (x == null || x === '' || isNaN(x)) ? '' : String(Math.round(x * 10000) / 10000).replace('.', ',');

  U.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  U.norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9äöüß&+.\/ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  // Schlüssel, unter dem Buchungen desselben Empfängers zusammenfinden (Ziffern wie Filialnummern fallen weg).
  U.schluessel = function (t) {
    const ohneZiffern = s => U.norm(s).replace(/\d+/g, ' ').replace(/\s+/g, ' ').trim();
    return ohneZiffern(t.gegen) || ohneZiffern(t.text).slice(0, 28);
  };
  U.median = function (a) {
    if (!a.length) return 0;
    const s = a.slice().sort((x, y) => x - y), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
})(typeof window !== 'undefined' ? window : globalThis);
