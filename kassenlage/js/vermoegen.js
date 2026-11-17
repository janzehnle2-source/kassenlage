/* Vermögen: Kontostände über die Zeit, Trade-Republic-Wert aus den eigenen Kaufkursen,
   Gesamtverlauf, Kuchendiagramm-Daten, Sparquote und Tipps. */
(function (root) {
  'use strict';
  const FA = root.FA = root.FA || {};
  const U = FA.util, A = FA.analyse, G = FA.gehalt;
  const W = FA.vermoegen = {};
  const r2 = U.r2;

  let cache = {};
  const altLeeren = G.leeren;
  G.leeren = function () { altLeeren(); cache = {}; };

  W.giro = st => (st.konten || []).find(k => k.id === 'giro') || null;
  W.ARTEN = [['bar', 'Bargeld'], ['konto', 'Weiteres Konto'], ['sparen', 'Sparprodukt']];

  /* Tagesreihe aus festen Ständen (Ankern) und Bewegungen.
     Ein Stand gilt für das Ende seines Tages. Davor wird zurück-, danach vorgerechnet. */
  function reihe(anker, deltas, start, ende) {
    const n = U.tageZwischen(start, ende) + 1;
    if (n < 1 || !anker.length) return null;
    const tage = new Array(n), werte = new Array(n), fest = {};
    for (let i = 0; i < n; i++) tage[i] = U.plusTage(start, i);
    for (const a of anker) fest[a.datum] = Number(a.wert);
    const i0 = Math.max(0, Math.min(n - 1, U.tageZwischen(start, anker[0].datum)));
    werte[i0] = fest[tage[i0]] != null ? fest[tage[i0]] : Number(anker[0].wert);
    for (let i = i0 + 1; i < n; i++) werte[i] = fest[tage[i]] != null ? fest[tage[i]] : werte[i - 1] + (deltas[tage[i]] || 0);
    for (let i = i0 - 1; i >= 0; i--) werte[i] = werte[i + 1] - (deltas[tage[i + 1]] || 0);
    return { start: start, tage: tage, werte: werte };
  }

  // Verlauf eines Kontos. Ohne eingetragenen Stand ist das Konto unbekannt.
  W.kontoReihe = function (st, konto, heute) {
    if (!konto) return null;
    const anker = (konto.staende || []).filter(a => a.datum && a.datum <= heute && !isNaN(Number(a.wert))).sort((a, b) => a.datum < b.datum ? -1 : 1);
    if (!anker.length) return null;
    const deltas = {};
    let erste = anker[0].datum, letzte = anker[anker.length - 1].datum;
    for (const t of st.tx) {
      if ((t.konto || 'giro') !== konto.id || t.datum > heute) continue;
      deltas[t.datum] = (deltas[t.datum] || 0) + t.betrag;
      if (t.datum < erste) erste = t.datum;
      if (t.datum > letzte) letzte = t.datum;
    }
    const r = reihe(anker, deltas, erste, heute);
    if (r) r.letzte = letzte;
    return r;
  };

  /* Trade Republic.
     Depot: Stückzahl mal letzter bekannter Kurs. Kurse stammen aus den eigenen Käufen und Verkäufen.
     Ein von Hand eingetragener Depotwert rückt alle Kurse auf diesen Wert.
     Guthaben: Summe aller Geldbewegungen ab einem eingetragenen Stand, sonst ab 0 vor der ersten Buchung. */
  W.tr = function (st, heute) {
    const tr = st.depots.tr, res = { depot: null, cash: null, cashFehlt: false, cashAb0: false };
    const b = tr.buchungen.filter(x => x.datum <= heute && x.art !== 'storniert' && x.art !== 'massnahme').sort((x, y) => x.datum < y.datum ? -1 : x.datum > y.datum ? 1 : 0);
    const handel = {}, hand = {};
    let ersteD = null, letzteD = null;
    const merke = function (d) { if (!ersteD || d < ersteD) ersteD = d; if (!letzteD || d > letzteD) letzteD = d; };
    for (const x of b) if (x.art === 'kauf' || x.art === 'sparplan' || x.art === 'verkauf') { (handel[x.datum] = handel[x.datum] || []).push(x); merke(x.datum); }
    for (const w of tr.werte || []) if (w.datum <= heute) { hand[w.datum] = Number(w.wert); merke(w.datum); }
    if (ersteD) {
      const n = U.tageZwischen(ersteD, heute) + 1, tage = new Array(n), werte = new Array(n), pos = {};
      let ohnePos = null, aktuell = 0;
      for (let i = 0; i < n; i++) {
        const d = tage[i] = U.plusTage(ersteD, i);
        if (handel[d] || hand[d] != null) {
          for (const x of handel[d] || []) {
            const key = x.isin || x.name || '?', p = pos[key] || (pos[key] = { stueck: 0, preis: 0 });
            const menge = Math.abs(x.stueck || 0), preis = x.kurs > 0 ? x.kurs : (menge > 0 ? Math.abs(x.betrag) / menge : 0);
            p.stueck = x.art === 'verkauf' ? Math.max(0, p.stueck - menge) : p.stueck + menge;
            if (preis > 0) p.preis = preis;
          }
          let summe = 0;
          for (const k in pos) summe += pos[k].stueck * pos[k].preis;
          if (hand[d] != null) {
            if (summe > 0.005) { const f = hand[d] / summe; for (const k in pos) pos[k].preis *= f; summe = hand[d]; ohnePos = null; }
            else ohnePos = hand[d];
          }
          aktuell = summe > 0.005 ? summe : (ohnePos != null ? ohnePos : 0);
        }
        werte[i] = aktuell;
      }
      res.depot = { start: ersteD, tage: tage, werte: werte, letzte: letzteD };
    }
    const anker = (tr.guthaben || []).filter(a => a.datum && a.datum <= heute).sort((a, c) => a.datum < c.datum ? -1 : 1);
    if (b.length || anker.length) {
      const deltas = {};
      let erste = anker.length ? anker[0].datum : null, letzte = anker.length ? anker[anker.length - 1].datum : null;
      for (const x of b) {
        deltas[x.datum] = (deltas[x.datum] || 0) + (x.betrag || 0) - Math.abs(x.gebuehr || 0) + (x.steuer || 0);
        if (!letzte || x.datum > letzte) letzte = x.datum;
      }
      let a = anker, start = erste;
      if (!anker.length) { start = U.plusTage(b[0].datum, -1); a = [{ datum: start, wert: 0 }]; res.cashAb0 = true; }
      else if (b.length && b[0].datum < start) start = b[0].datum;
      const r = reihe(a, deltas, start, heute);
      if (r) {
        r.letzte = letzte;
        // Fehlen Buchungen im Export, rutscht das gerechnete Guthaben ins Minus. Dann lieber gar keinen Wert zeigen.
        if (res.cashAb0 && Math.min.apply(null, r.werte) < -1) res.cashFehlt = true; else res.cash = r;
      }
    }
    return res;
  };

  // Gesamtverlauf über alle bekannten Teile. Scalable Capital (Altersvorsorge) zählt bewusst nicht mit.
  W.gesamt = function (st, heute) {
    if (cache[heute]) return cache[heute];
    const teile = [], giro = W.giro(st), tr = W.tr(st, heute);
    teile.push({ id: 'giro', name: 'Girokonto', gruppe: 'giro', reihe: W.kontoReihe(st, giro, heute) });
    teile.push({ id: 'trdepot', name: 'Trade Republic Depot', gruppe: 'tr', reihe: tr.depot });
    teile.push({ id: 'trcash', name: 'Trade Republic Guthaben', gruppe: 'tr', reihe: tr.cash });
    for (const k of st.konten || []) if (k.id !== 'giro') teile.push({ id: k.id, name: k.name, gruppe: 'weitere', reihe: W.kontoReihe(st, k, heute), konto: k });
    for (const t of teile) { t.wert = t.reihe ? r2(t.reihe.werte[t.reihe.werte.length - 1]) : null; t.letzte = t.reihe ? t.reihe.letzte : null; }
    const bekannt = teile.filter(t => t.reihe);
    const g = { teile: teile, tr: tr, summe: null, start: null, ende: null, tage: [], reihen: {}, gruppen: [], hinweise: [], giroFehlt: !teile[0].reihe };
    if (bekannt.length) {
      // Der Verlauf beginnt mit dem Girokonto. Das Depot ist vor dem ersten Kauf leer (0),
      // ein später erfasstes Konto wie Bargeld wird davor mit seinem ersten Stand angesetzt.
      let start = teile[0].reihe ? teile[0].reihe.start : bekannt[0].reihe.start, ende = bekannt[0].letzte;
      for (const t of bekannt) {
        if (!teile[0].reihe && t.reihe.start < start) start = t.reihe.start;
        if (t.letzte > ende) ende = t.letzte;
      }
      if (ende > heute) ende = heute;
      if (ende < start) ende = start;
      const n = U.tageZwischen(start, ende) + 1;
      g.start = start; g.ende = ende;
      for (let i = 0; i < n; i++) g.tage.push(U.plusTage(start, i));
      g.reihen.gesamt = new Array(n).fill(0);
      for (const t of bekannt) {
        if (g.gruppen.indexOf(t.gruppe) < 0) { g.gruppen.push(t.gruppe); g.reihen[t.gruppe] = new Array(n).fill(0); }
        const off = U.tageZwischen(t.reihe.start, start), w = t.reihe.werte, davor = t.id === 'trdepot' ? 0 : w[0];
        for (let i = 0; i < n; i++) { const j = off + i, v = j < 0 ? davor : w[Math.min(w.length - 1, j)]; g.reihen.gesamt[i] += v; g.reihen[t.gruppe][i] += v; }
        if (t.gruppe === 'weitere' && off < -3) g.hinweise.push('„' + t.name + '“ ist erst seit ' + U.datumDE(t.reihe.start) + ' erfasst. Davor rechnet die App mit dem ersten eingetragenen Stand.');
      }
      g.summe = r2(g.reihen.gesamt[n - 1]);
      if (ende < heute) g.hinweise.push('Daten bis ' + U.datumDE(ende) + '. Neuere Buchungen fehlen noch.');
      const dep = teile[1];
      if (dep.reihe && U.tageZwischen(dep.letzte, ende) > 45) g.hinweise.push('Der Depotwert stammt vom ' + U.datumDE(dep.letzte) + '. Seitdem kennt die App keinen neueren Kurs.');
    }
    if (tr.cashFehlt) g.hinweise.push('Das Guthaben bei Trade Republic lässt sich aus dem Export nicht berechnen. Trag es unter Vermögen ein.');
    cache[heute] = g;
    return g;
  };

  W.kontoStand = function (st, heute) { const t = W.gesamt(st, heute).teile[0]; return t.wert; };

  // Ausschnitt für das Diagramm: W = 7 Tage, M = 30 Tage, J = 365 Tage, X = alles
  W.ausschnitt = function (g, zeitraum, gruppe) {
    const n = g.tage.length, tageN = { W: 7, M: 30, J: 365 }[zeitraum];
    const i0 = tageN ? Math.max(0, n - 1 - tageN) : 0;
    const reihen = {};
    for (const k in g.reihen) reihen[k] = g.reihen[k].slice(i0);
    return { tage: g.tage.slice(i0), reihen: reihen, voll: !!tageN && n - 1 >= tageN };
  };

  // Veränderung seit gestern, in dieser Woche, in diesem Monat, in diesem Jahr
  W.aenderungen = function (g, heute) {
    if (g.summe == null) return [];
    const ende = g.ende, jetzt = g.reihen.gesamt[g.tage.length - 1];
    const seit = function (datum) { const i = U.tageZwischen(g.start, datum); return i >= 0 ? r2(jetzt - g.reihen.gesamt[i]) : null; };
    const montag = U.plusTage(ende, -((U.wochentag(ende) + 6) % 7));
    return [
      { name: ende === heute ? 'Seit gestern' : 'Zum Vortag', diff: seit(U.plusTage(ende, -1)) },
      { name: 'Diese Woche', diff: seit(U.plusTage(montag, -1)) },
      { name: 'Dieser Monat', diff: seit(U.plusTage(ende.slice(0, 7) + '-01', -1)) },
      { name: 'Dieses Jahr', diff: seit(U.plusTage(ende.slice(0, 4) + '-01-01', -1)) }
    ];
  };

  const istTr = t => /trade republic/.test(U.norm((t.gegen || '') + ' ' + (t.text || '')));

  // Was in einem Monat zu Trade Republic ging: aus dem Export, sonst aus dem Girokonto
  W.trMonat = function (st, ym) {
    let ein = 0, inv = 0, n = 0;
    for (const x of st.depots.tr.buchungen) {
      if (x.datum.slice(0, 7) !== ym) continue;
      n++;
      if (x.art === 'einzahlung') ein += x.betrag; else if (x.art === 'kauf' || x.art === 'sparplan') inv += Math.abs(x.betrag);
    }
    if (n) return { eingezahlt: r2(ein), investiert: r2(inv), quelle: 'tr' };
    let giro = 0;
    for (const t of st.tx) if (t.datum.slice(0, 7) === ym && A.txTyp(st, t) === 'sparen' && istTr(t)) giro -= t.betrag;
    return { eingezahlt: r2(giro), investiert: 0, quelle: 'giro' };
  };

  // Kontostand minus feste Zahlungen und Sparpläne, die in diesem Monat noch kommen
  W.verfuegbar = function (st, heute, p) {
    const stand = W.kontoStand(st, heute);
    return stand == null ? null : r2(stand - p.fixOffen - p.sparOffen);
  };

  /* Kuchendiagramm eines Monats. Sechs Kategorien haben eine feste Farbe, alles andere läuft unter "Übrige Ausgaben".
     Der Überschuss steht in Grüntönen daneben: Trade Republic, weiteres Sparen, auf dem Girokonto geblieben. */
  W.FEST = ['wohnen', 'lebensmittel', 'transport', 'restaurant', 'abos', 'shopping'];
  W.torte = function (st, ym) {
    const m = A.monat(st, ym);
    let tr = 0, sparSonst = 0;
    for (const t of st.tx) {
      if (t.datum.slice(0, 7) !== ym || A.txTyp(st, t) !== 'sparen') continue;
      if (istTr(t)) tr -= t.betrag; else sparSonst -= t.betrag;
    }
    tr = Math.max(0, r2(tr)); sparSonst = Math.max(0, r2(sparSonst));
    const ueber = r2(m.ein - m.aus), rest = Math.max(0, r2(ueber - tr - sparSonst));
    let ausgaben = 0;
    for (const k in m.proKat) if (m.proKat[k] > 0) ausgaben += m.proKat[k];
    const summe = ausgaben + tr + sparSonst + rest, stuecke = [], gefaltet = [];
    let uebrige = 0;
    for (const k in m.proKat) {
      const v = m.proKat[k];
      if (!(v > 0)) continue;
      const fi = W.FEST.indexOf(k);
      if (fi > -1 && v / summe >= 0.025) stuecke.push({ key: 'kat:' + k, name: A.katName(st, k), wert: r2(v), farbe: 'd' + (fi + 1), ord: fi });
      else { uebrige += v; gefaltet.push({ kat: k, name: A.katName(st, k), wert: r2(v) }); }
    }
    stuecke.sort((a, b) => a.ord - b.ord);
    gefaltet.sort((a, b) => b.wert - a.wert);
    if (uebrige > 0.004) stuecke.push({ key: 'uebrige', name: 'Übrige Ausgaben', wert: r2(uebrige), farbe: 'dgrau' });
    if (tr > 0.004) stuecke.push({ key: 'tr', name: 'Trade Republic', wert: tr, farbe: 'dg1' });
    if (sparSonst > 0.004) stuecke.push({ key: 'spar', name: 'Weiteres Sparen', wert: sparSonst, farbe: 'dg2' });
    if (rest > 0.004) stuecke.push({ key: 'rest', name: 'Auf dem Girokonto geblieben', wert: rest, farbe: 'dg3' });
    for (const s of stuecke) s.anteil = summe > 0 ? s.wert / summe : 0;
    let hinweis = '';
    if (!(m.ein > 0) && stuecke.length) hinweis = 'In diesem Monat ist noch kein Geld eingegangen. Das Diagramm zeigt deshalb nur, wohin Geld geflossen ist.';
    else if (ueber < 0) hinweis = 'Du hast ' + U.eur(-ueber) + ' mehr ausgegeben als eingenommen. Deshalb gibt es kein Stück für den Überschuss.';
    else if (tr + sparSonst > ueber + 0.004) hinweis = 'Du hast ' + U.eur(tr + sparSonst - ueber) + ' mehr gespart und investiert, als in diesem Monat übrig war. Das Geld kam vom Girokonto.';
    return { ym: ym, stuecke: stuecke, summe: r2(summe), ein: m.ein, aus: m.aus, ueber: ueber, tr: tr, sparSonst: sparSonst, rest: rest, gefaltet: gefaltet, hinweis: hinweis };
  };

  // Durchschnitt der letzten bis zu drei vollen Monate
  W.sparquote = function (st, heute) {
    const ym = heute.slice(0, 7), liste = [];
    for (let i = 1; i <= 6 && liste.length < 3; i++) { const m = A.monat(st, U.ymPlus(ym, -i)); if (m.anzahl >= 5 && m.ein > 0) liste.push(m); }
    if (!liste.length) return null;
    const mittel = f => r2(liste.reduce((s, m) => s + f(m), 0) / liste.length);
    const ein = mittel(m => m.ein), aus = mittel(m => m.aus), spar = mittel(m => m.spar);
    return { monate: liste, ein: ein, aus: aus, spar: spar, zurueck: r2(ein - aus), quote: ein > 0 ? (ein - aus) / ein : 0, geblieben: r2(ein - aus - spar) };
  };

  const FILM = ['netflix', 'disney', 'prime video', 'amazon prime', 'wow', 'dazn', 'sky', 'paramount', 'apple tv', 'rtl', 'joyn', 'youtube'];
  const MUSIK = ['spotify', 'deezer', 'apple music', 'tidal', 'amazon music'];
  const VERTRAG = ['strom', 'stadtwerke', 'energie', 'gas', 'telekom', 'vodafone', '1&1', 'telefonica', 'congstar', 'mobilfunk'];

  // Tipps nur aus den eigenen Daten, ohne Produktwerbung
  W.tipps = function (st, heute, p) {
    const tipps = [], wk = p.wiederkehrend.filter(w => w.typ === 'ausgabe' && w.mittel < 0);
    const passt = (w, liste) => { const n = ' ' + U.norm(w.name) + ' '; return liste.some(x => n.indexOf(x) > -1); };
    const summe = l => l.reduce((s, w) => s - w.mittel, 0), namen = l => l.map(w => w.name).join(', ');
    const film = wk.filter(w => passt(w, FILM)), musik = wk.filter(w => passt(w, MUSIK));
    if (film.length > 1) tipps.push({ titel: film.length + ' Streaming-Dienste gleichzeitig', text: namen(film) + ' kosten zusammen ' + U.eur(summe(film)) + ' im Monat. Abwechselnd statt gleichzeitig gebucht, sparst du den Preis der anderen.' });
    if (musik.length > 1) tipps.push({ titel: 'Zwei Musik-Abos', text: namen(musik) + ' kosten zusammen ' + U.eur(summe(musik)) + ' im Monat. Meist reicht eines davon.' });
    const abos = wk.filter(w => w.kat === 'abos');
    if (abos.length) tipps.push({ titel: 'Abos und Verträge', text: abos.length + (abos.length === 1 ? ' Abo kostet ' : ' Abos kosten zusammen ') + U.eur(summe(abos)) + ' im Monat, das sind ' + U.eur0(summe(abos) * 12) + ' im Jahr. Prüfe, welche du noch nutzt.' });
    wk.filter(w => w.aenderung && w.aenderung.neu > w.aenderung.alt).forEach(w => tipps.push({ titel: 'Teurer geworden: ' + w.name, text: 'Jetzt ' + U.eur(w.aenderung.neu) + ' statt ' + U.eur(w.aenderung.alt) + '. Das sind ' + U.eur0((w.aenderung.neu - w.aenderung.alt) * 12) + ' mehr im Jahr.' }));
    const vertraege = wk.filter(w => w.kat === 'versicherung' || passt(w, VERTRAG));
    if (vertraege.length) tipps.push({ titel: 'Einmal im Jahr vergleichen', text: 'Für Strom, Mobilfunk und Versicherungen zahlst du zusammen ' + U.eur(summe(vertraege)) + ' im Monat (' + namen(vertraege) + '). Ein Tarifvergleich vor dem Ende der Laufzeit lohnt sich oft.' });
    // Kategorie im letzten vollen Monat deutlich über dem eigenen Schnitt
    const ym = heute.slice(0, 7), lm = A.monat(st, U.ymPlus(ym, -1)), davor = [];
    for (let i = 2; i <= 5 && davor.length < 3; i++) { const m = A.monat(st, U.ymPlus(ym, -i)); if (m.anzahl >= 5) davor.push(m); }
    if (lm.anzahl >= 5 && davor.length >= 2) {
      const auff = [];
      for (const k in lm.proKat) {
        const schnitt = davor.reduce((s, m) => s + (m.proKat[k] || 0), 0) / davor.length, v = lm.proKat[k];
        if (v - schnitt > 30 && v > 1.25 * schnitt) auff.push({ k: k, v: v, schnitt: schnitt });
      }
      auff.sort((a, b) => (b.v - b.schnitt) - (a.v - a.schnitt));
      auff.slice(0, 2).forEach(a => tipps.push({ titel: 'Mehr als sonst: ' + A.katName(st, a.k), text: 'Im ' + U.monatNur(lm.ym) + ' waren es ' + U.eur(a.v) + ', in den Monaten davor im Schnitt ' + U.eur(a.schnitt) + '.' }));
    }
    const q = W.sparquote(st, heute);
    if (q) {
      const locker = q.monate.reduce((s, m) => s + (m.proKat.restaurant || 0) + (m.proKat.shopping || 0), 0) / q.monate.length;
      if (locker > 60) tipps.push({ titel: 'Was realistisch drin wäre', text: 'Für Restaurant und Shopping gibst du im Schnitt ' + U.eur(locker) + ' im Monat aus. Mit 15 % weniger wären das ' + U.eur0(locker * 0.15 * 12) + ' mehr im Jahr.' });
      if (q.geblieben > 100) tipps.push({ titel: 'Geld, das liegen bleibt', text: 'Im Schnitt bleiben ' + U.eur(q.geblieben) + ' im Monat auf dem Girokonto übrig. Ein Dauerauftrag über die Hälfte davon würde ' + U.eur0(q.geblieben / 2 * 12) + ' im Jahr automatisch zur Seite legen.' });
    }
    return tipps;
  };
})(typeof window !== 'undefined' ? window : globalThis);
