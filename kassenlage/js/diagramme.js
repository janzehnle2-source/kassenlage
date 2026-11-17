/* Diagramme als SVG: Vermögensverlauf (Linien) und Monatsübersicht (Ring). */
(function (root) {
  'use strict';
  const FA = root.FA = root.FA || {};
  const U = FA.util;
  const X = FA.diagramm = { aktuell: null, standard: null };

  X.NAMEN = { gesamt: 'Gesamt', giro: 'Girokonto', tr: 'Trade Republic', weitere: 'Weitere' };

  function nett(x) {
    if (!(x > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(x))), f = x / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }

  /* Linienchart. a = { tage, reihen }, aktiv = sichtbare Linien, haupt = Linie für die große Zahl.
     Alle Linien teilen sich eine Euro-Achse. */
  X.linie = function (a, aktiv, haupt) {
    const n = a.tage.length;
    if (n < 2) { X.aktuell = null; return '<p class="leer">Für einen Verlauf braucht es Daten von mindestens zwei Tagen. Nach dem nächsten Import erscheint hier die Linie.</p>'; }
    const B = 340, H = 190, l = 2, r = 46, o = 12, u = 24, iw = B - l - r, ih = H - o - u;
    let min = Infinity, max = -Infinity;
    for (const k of aktiv) for (const v of a.reihen[k]) { if (v < min) min = v; if (v > max) max = v; }
    if (max - min < 1) { max += 1; min -= 1; }
    const pad = (max - min) * 0.08;
    min -= pad; max += pad;
    const x = i => l + i / (n - 1) * iw, y = v => o + ih - (v - min) / (max - min) * ih;
    const schritt = nett((max - min) / 3);
    let s = '<svg viewBox="0 0 ' + B + ' ' + H + '" role="img" aria-label="Verlauf vom ' + U.datumDE(a.tage[0]) + ' bis ' + U.datumDE(a.tage[n - 1]) + '">';
    for (let t = Math.ceil(min / schritt) * schritt; t <= max; t += schritt) {
      s += '<line class="ach" x1="' + l + '" x2="' + (l + iw) + '" y1="' + y(t).toFixed(1) + '" y2="' + y(t).toFixed(1) + '"/><text x="' + (B - 2) + '" y="' + (y(t) + 3.5).toFixed(1) + '" text-anchor="end">' + U.num(Math.round(t)) + '</text>';
    }
    if (min < 0 && max > 0) s += '<line class="null" x1="' + l + '" x2="' + (l + iw) + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '"/>';
    // Hauptlinie zuletzt, damit sie oben liegt
    const folge = aktiv.filter(k => k !== haupt).concat(aktiv.indexOf(haupt) > -1 ? [haupt] : []);
    for (const k of folge) {
      let d = '';
      const w = a.reihen[k];
      for (let i = 0; i < n; i++) d += (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(w[i]).toFixed(1);
      s += '<path class="ln ln-' + k + '" d="' + d + '"/>';
    }
    s += '<text x="' + l + '" y="' + (H - 6) + '">' + U.datumKurz(a.tage[0]) + a.tage[0].slice(2, 4) + '</text><text x="' + (l + iw) + '" y="' + (H - 6) + '" text-anchor="end">' + U.datumKurz(a.tage[n - 1]) + a.tage[n - 1].slice(2, 4) + '</text>';
    s += '<line id="vl-linie" class="faden" x1="0" x2="0" y1="' + o + '" y2="' + (o + ih) + '" visibility="hidden"/>';
    for (const k of folge) s += '<circle class="vl-punkt pk-' + k + '" data-key="' + k + '" r="4.5" cx="0" cy="0" visibility="hidden"/>';
    s += '<rect class="flaeche" x="0" y="0" width="' + B + '" height="' + H + '"/></svg>';
    X.aktuell = { tage: a.tage, reihen: a.reihen, aktiv: folge, haupt: haupt, B: B, l: l, iw: iw, y: y };
    X.standard = null;
    return s;
  };

  // Ring aus Stücken { key, name, wert, anteil, farbe }. Tippen öffnet die Details.
  X.torte = function (t, mitte) {
    const S = 220, c = S / 2, ra = 104, ri = 68;
    const pt = (rad, w) => (c + rad * Math.cos(w)).toFixed(2) + ' ' + (c + rad * Math.sin(w)).toFixed(2);
    let s = '<svg viewBox="0 0 ' + S + ' ' + S + '" role="img" aria-label="Aufteilung im ' + U.monatName(t.ym) + '">';
    let w0 = -Math.PI / 2;
    for (const st of t.stuecke) {
      const winkel = st.anteil * Math.PI * 2;
      if (!(winkel > 0)) continue;
      let d;
      if (st.anteil > 0.9995) {
        d = 'M' + pt(ra, 0) + 'A' + ra + ' ' + ra + ' 0 1 1 ' + pt(ra, Math.PI) + 'A' + ra + ' ' + ra + ' 0 1 1 ' + pt(ra, 0) + 'Z M' + pt(ri, 0) + 'A' + ri + ' ' + ri + ' 0 1 0 ' + pt(ri, Math.PI) + 'A' + ri + ' ' + ri + ' 0 1 0 ' + pt(ri, 0) + 'Z';
      } else {
        const w1 = w0 + winkel, gross = winkel > Math.PI ? 1 : 0;
        d = 'M' + pt(ra, w0) + 'A' + ra + ' ' + ra + ' 0 ' + gross + ' 1 ' + pt(ra, w1) + 'L' + pt(ri, w1) + 'A' + ri + ' ' + ri + ' 0 ' + gross + ' 0 ' + pt(ri, w0) + 'Z';
      }
      s += '<path class="st ' + st.farbe + '" fill-rule="evenodd" d="' + d + '" data-akt="torte" data-key="' + U.esc(st.key) + '"><title>' + U.esc(st.name) + ': ' + U.eur(st.wert) + ', ' + Math.round(st.anteil * 100) + ' %</title></path>';
      w0 += winkel;
    }
    s += '<text class="m1" x="' + c + '" y="' + (c - 6) + '" text-anchor="middle">' + U.esc(mitte.label) + '</text><text class="m2" x="' + c + '" y="' + (c + 18) + '" text-anchor="middle">' + U.esc(mitte.wert) + '</text></svg>';
    return s;
  };
})(typeof window !== 'undefined' ? window : globalThis);
