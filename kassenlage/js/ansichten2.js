/* Hauptbereiche: Dashboard, Ausgaben, Vermögen, Mehr. Dazu Detailseiten und die neuen Eingabeblätter. */
(function (root) {
  'use strict';
  const FA = root.FA;
  const U = FA.util, G = FA.gehalt, A = FA.analyse, W = FA.vermoegen, X = FA.diagramm;
  const V = FA.ansichten, H = V.h, F = V.felder;
  const esc = U.esc, eur = U.eur, eur0 = U.eur0, r2 = U.r2, zl = H.zl, vz = H.vz, i = V.i;
  const pz = a => (a > 0 && a < 0.005 ? 'unter 1 %' : Math.round(a * 100) + ' %');

  V.titel = function (ui) {
    if (ui.sub) return { einsatz: 'Einsatz', buchungen: 'Buchungen', tr: 'Trade Republic', scalable: 'Scalable Capital', gehaltsteuer: 'Gehalt und Steuer', gehalt: 'Gehalt und Zuschläge', sparziele: 'Sparziele und Tipps', einstellungen: 'Einstellungen', kategorien: 'Kategorien und Regeln', import: 'Daten importieren', sicherung: 'Sicherung und Sperre', info: 'Datenschutz und Hilfe' }[ui.sub.art] || '';
    return { dashboard: 'Dashboard', ausgaben: 'Ausgaben', einsaetze: 'Einsätze', vermoegen: 'Vermögen', mehr: 'Mehr' }[ui.ansicht];
  };

  function trend(diff, basis, text) {
    const kl = diff > 0.004 ? 'plus' : diff < -0.004 ? 'minus' : '';
    const pfeil = diff > 0.004 ? '▲ ' : diff < -0.004 ? '▼ ' : '';
    const pct = basis && Math.abs(basis) > 0.5 ? ' (' + U.num(Math.round(Math.abs(diff / basis) * 1000) / 10) + ' %)' : '';
    return '<span class="' + kl + '">' + (pfeil ? '<span aria-hidden="true">' + pfeil + '</span>' : '') + U.eurVz(diff) + pct + '</span> ' + text;
  }

  // Linienchart mit Zeitraum-Wahl. haupt = Linie, deren Wert die große Zahl zeigt.
  function verlaufBlock(g, ui, haupt, linienWahl) {
    const a = W.ausschnitt(g, ui.zeitraum);
    let aktiv = [haupt];
    if (linienWahl) { aktiv = ['gesamt'].concat(g.gruppen).filter(k => ui.linien[k]); if (!aktiv.length) aktiv = ['gesamt']; }
    const w = a.reihen[haupt], diff = r2(w[w.length - 1] - w[0]);
    const text = a.voll ? { W: 'in 7 Tagen', M: 'in 30 Tagen', J: 'in 12 Monaten' }[ui.zeitraum] : 'seit ' + U.datumDE(a.tage[0]);
    let h = '<p class="trend" id="vl-info">' + trend(diff, w[0], text) + ' ' + i('veraenderung') + '</p>';
    h += '<div class="verlauf" id="verlauf">' + X.linie(a, aktiv, haupt) + '</div>';
    h += '<div class="pillen" role="group" aria-label="Zeitraum">' + [['W', '1W'], ['M', '1M'], ['J', '1J'], ['X', 'Max']].map(z => '<button class="pille" data-akt="zeitraum" data-z="' + z[0] + '" aria-pressed="' + (ui.zeitraum === z[0]) + '">' + z[1] + '</button>').join('') + '</div>';
    if (linienWahl && g.gruppen.length) h += '<div class="pillen frei" role="group" aria-label="Linien">' + ['gesamt'].concat(g.gruppen).map(k => '<button class="pille" data-akt="linie" data-key="' + k + '" aria-pressed="' + (aktiv.indexOf(k) > -1) + '"><i class="pk-' + k + '"></i>' + X.NAMEN[k] + '</button>').join('') + '</div>';
    return h;
  }

  // ---------- Dashboard ----------
  V.dashboard = function (st, ui) {
    const heute = U.heute(), ymH = heute.slice(0, 7), ym = ui.monat || ymH, mn = U.monatNur(ym);
    let h = H.banner(st);
    if (!st.tx.length && !G.hatGehalt(st) && !st.einsaetze.length && !st.depots.tr.buchungen.length) return h + H.start();
    const g = W.gesamt(st, heute);

    h += '<section class="buehne"><p class="etikett">Gesamtvermögen' + (g.summe != null && g.giroFehlt ? ' ohne Girokonto' : '') + ' ' + i('vermoegen') + '</p>';
    if (g.summe == null) h += '<p class="zahl-gross offen">noch offen</p><p class="unter">Trag deinen Kontostand ein. Dann zeigt die App dein Vermögen und wie es sich entwickelt.</p><div class="knoepfe"><button class="knopf" data-akt="kontostand" data-id="giro">Kontostand eintragen</button></div>';
    else {
      h += '<p class="zahl-gross" id="vl-wert">' + eur(g.summe) + '</p>' + verlaufBlock(g, ui, 'gesamt', true);
      h += '<div class="wechsel">' + W.aenderungen(g, heute).map(x => '<div><span>' + x.name + '</span>' + (x.diff == null ? '<em>keine Daten</em>' : '<strong>' + vz(x.diff) + '</strong>') + '</div>').join('') + '</div>';
      if (g.giroFehlt) h += '<div class="knoepfe"><button class="knopf zweit" data-akt="kontostand" data-id="giro">Kontostand eintragen</button></div>';
    }
    if (g.hinweise.length) h += '<ul class="notiz">' + g.hinweise.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
    h += '</section>';

    // Monat
    const p = A.prognose(st, heute), m = ym === ymH ? p.ist : A.monat(st, ym), ueber = r2(m.ein - m.aus);
    let k = '';
    if (!st.tx.length) {
      if (G.hatGehalt(st)) k += '<p class="etikett">Erwartete Auszahlung im ' + mn + ' ' + i('netto') + '</p><p class="zahl">' + eur(G.planMonat(st, ym).auszahlung) + '</p>';
      k += '<p class="unter">Die App kennt deine Ausgaben noch nicht. Importiere deine Kontoumsätze oder trag Ausgaben von Hand ein.</p><div class="knoepfe"><button class="knopf" data-akt="geh" data-art="import">Kontoumsätze importieren</button><button class="knopf zweit" data-akt="buchung-neu">Ausgabe eintragen</button></div>';
    } else {
      if (ym === ymH) { const verf = W.verfuegbar(st, heute, p); if (verf != null) k += '<p class="etikett">Verfügbar ' + i('verfuegbar') + '</p><p class="zahl">' + eur(verf) + '</p>'; }
      const z = [zl('Einnahmen', vz(m.ein)), zl('Ausgaben', vz(-m.aus)), zl((ueber < 0 ? 'Defizit ' : 'Überschuss ') + i('ueberschuss'), vz(ueber), 'summe')];
      if (ym === ymH) z.push(zl('Voraussichtlich übrig am Monatsende ' + i('prognose'), vz(p.uebrig)));
      const tm = W.trMonat(st, ym);
      if (tm.eingezahlt > 0 || tm.investiert > 0) z.push(zl('In Trade Republic eingezahlt', eur(tm.eingezahlt), '', tm.quelle === 'tr' ? 'davon ' + eur(tm.investiert) + ' in Wertpapiere investiert' : 'laut Girokonto'));
      k += '<div class="buch">' + z.join('') + '</div>';
      if (ym === ymH && p.annahmen.length) k += '<details><summary>So ist die Prognose gerechnet</summary><ul>' + p.annahmen.map(a => '<li>' + esc(a) + '</li>').join('') + '</ul></details>';
      k += '<div class="knoepfe"><button class="knopf zweit" data-akt="nav" data-ziel="ausgaben">Ausgaben ansehen</button></div>';
    }
    h += '<section>' + H.monatswahl(ym, ymH) + '<div class="karte">' + k + '</div></section>';

    // Kuchendiagramm
    const t = W.torte(st, ym);
    if (t.stuecke.length) {
      const mitte = t.ein > 0 ? { label: 'Einnahmen', wert: eur0(t.ein) } : { label: 'Abgeflossen', wert: eur0(t.summe) };
      h += '<section><h2>Wohin dein Geld geht ' + i('torte') + '</h2><div class="torte">' + X.torte(t, mitte) + '<div class="leg-liste">' +
        t.stuecke.map(s => '<button class="leg" data-akt="torte" data-key="' + esc(s.key) + '"><i class="' + s.farbe + '"></i><span class="n">' + esc(s.name) + '</span><span class="p">' + pz(s.anteil) + '</span><span class="w">' + eur0(s.wert) + '</span></button>').join('') +
        '</div></div>' + (t.hinweis ? '<p class="unter">' + esc(t.hinweis) + '</p>' : '') + '</section>';
    }

    if (ym === ymH) {
      const e = st.einstellungen;
      const hw = A.hinweise(st, heute, p).filter(x => !(x.typ === 'gehalt' && !e.hinweisGehalt) && !(x.typ === 'hoch' && !e.hinweisHoch));
      if (hw.length) h += '<section><h2>Hinweise</h2><ul class="hinw">' + hw.map(x => '<li class="' + x.art + '"><span class="z" aria-hidden="true">' + (x.art === 'gut' ? '✓' : x.art === 'warn' ? '!' : 'i') + '</span><span>' + esc(x.text) + (x.akt ? ' <button data-akt="geh" data-art="' + x.akt + '">' + (x.akt === 'import' ? 'Jetzt importieren' : 'Sicherung erstellen') + '</button>' : '') + '</span></li>').join('') + '</ul></section>';
    }
    const im = st.meta.importe || {};
    h += '<section><p class="unter">Girokonto: ' + (im.bank ? 'Buchungen bis ' + U.datumDE(im.bank.bis) : 'noch kein Import') + '. Trade Republic: ' + (im.tr ? 'Buchungen bis ' + U.datumDE(im.tr.bis) : 'noch kein Import') + '.</p><div class="knoepfe"><button class="knopf zweit" data-akt="geh" data-art="import">Daten importieren</button></div></section>';
    return h;
  };

  // ---------- Ausgaben ----------
  function katListe(st, m, vor) {
    const b = st.budgets || {};
    const keys = st.kategorien.filter(k => k.typ === 'ausgabe' && ((m.proKat[k.id] || 0) > 0.004 || b[k.id] > 0)).map(k => k.id).sort((x, y) => (m.proKat[y] || 0) - (m.proKat[x] || 0));
    if (!keys.length) return '';
    const max = Math.max.apply(null, keys.map(k => m.proKat[k] || 0)) || 1;
    return '<section><h2>Kategorien</h2><div class="balken">' + keys.map(function (k) {
      const v = m.proKat[k] || 0, bud = b[k] > 0 ? b[k] : 0, alt = vor.proKat[k] || 0, diff = v - alt;
      let klein;
      if (bud) klein = v > bud ? '<small class="minus">Budget ' + eur0(bud) + ', um ' + eur0(v - bud) + ' überschritten</small>' : '<small>von ' + eur0(bud) + ' Budget</small>';
      else klein = vor.anzahl ? '<small>' + (Math.abs(diff) < 1 ? 'wie im ' + U.monatNur(vor.ym) : eur0(Math.abs(diff)) + (diff > 0 ? ' mehr als im ' : ' weniger als im ') + U.monatNur(vor.ym)) + '</small>' : '';
      const breite = bud ? Math.min(100, v / bud * 100) : v / max * 100;
      return '<button class="bz" data-akt="kat-zeigen" data-kat="' + esc(k) + '"><span class="n">' + esc(A.katName(st, k)) + klein + '</span><span class="w">' + eur(v) + '</span><span class="spur' + (bud ? ' budget' : '') + (bud && v > bud ? ' ueber' : '') + '"><i style="width:' + Math.max(1, breite).toFixed(1) + '%"></i></span></button>';
    }).join('') + '</div><div class="knoepfe"><button class="knopf zweit" data-akt="budgets">Budgets festlegen</button>' + i('budget') + '</div></section>';
  }

  V.ausgaben = function (st, ui) {
    const heute = U.heute(), ymH = heute.slice(0, 7), ym = ui.monat || ymH;
    let h = H.banner(st);
    if (!st.tx.length) return h + '<section><p class="aussage lang">Noch keine Buchungen.</p><p class="unter">Importiere die Umsätze deiner Sparkasse oder trag eine Ausgabe von Hand ein.</p><div class="knoepfe"><button class="knopf" data-akt="geh" data-art="import">Kontoumsätze importieren</button><button class="knopf zweit" data-akt="buchung-neu">Buchung eintragen</button></div></section>';
    const m = A.monat(st, ym), vor = A.monat(st, U.ymPlus(ym, -1));
    h += '<section class="buehne">' + H.monatswahl(ym, ymH) + '<p class="etikett">Ausgaben im ' + U.monatNur(ym) + '</p><p class="zahl-gross">' + eur(m.aus) + '</p>';
    if (vor.anzahl) { const d = r2(m.aus - vor.aus); h += '<p class="trend">' + (Math.abs(d) < 1 ? 'So viel wie im ' + U.monatNur(vor.ym) : eur0(Math.abs(d)) + (d > 0 ? ' mehr als im ' : ' weniger als im ') + U.monatNur(vor.ym)) + (ym === ymH ? '. Der Monat läuft noch.' : '.') + '</p>'; }
    h += '<div class="knoepfe"><button class="knopf" data-akt="buchung-neu">Buchung eintragen</button><button class="knopf zweit" data-akt="geh" data-art="buchungen">Alle Buchungen</button></div></section>';
    h += katListe(st, m, vor) + H.verlauf(st, ym, 6, ym);
    const wk = A.prognose(st, heute).wiederkehrend.filter(w => w.typ === 'ausgabe' && w.mittel < 0);
    if (wk.length) h += '<section><h2>Feste Zahlungen</h2><details><summary>' + wk.length + ' erkannt, zusammen ' + eur(wk.reduce((s, w) => s - w.mittel, 0)) + ' pro Monat</summary><div class="buch">' + wk.map(w => zl(esc(w.name), eur(-w.mittel), '', 'meist um den ' + w.tag + '. des Monats, ' + esc(A.katName(st, w.kat)))).join('') + '</div></details></section>';
    return h + H.wochen(st, ym);
  };

  // ---------- Vermögen ----------
  const zeile = (akt, titel, klein, wert) => '<li><button ' + akt + '><span><strong>' + titel + '</strong><small>' + klein + '</small></span><span class="w">' + wert + '</span></button></li>';

  V.vermoegen = function (st) {
    const heute = U.heute(), g = W.gesamt(st, heute), giro = g.teile[0], dep = g.teile[1], cash = g.teile[2];
    let h = H.banner(st) + '<section class="buehne"><p class="etikett">Gesamtvermögen' + (g.summe != null && g.giroFehlt ? ' ohne Girokonto' : '') + ' ' + i('vermoegen') + '</p><p class="zahl-gross' + (g.summe == null ? ' offen' : '') + '">' + (g.summe == null ? 'noch offen' : eur(g.summe)) + '</p></section>';
    let l = zeile('data-akt="kontostand" data-id="giro"', 'Girokonto', giro.reihe ? 'Daten bis ' + U.datumDE(giro.letzte) + '. Antippen, um den Stand zu korrigieren.' : 'Kontostand eintragen, damit die App rechnen kann.', giro.reihe ? eur(giro.wert) : 'offen');
    const trDa = dep.reihe || cash.reihe;
    l += zeile('data-akt="geh" data-art="tr"', 'Trade Republic', trDa ? 'Depot ' + (dep.reihe ? eur(dep.wert) : 'offen') + ', Guthaben ' + (cash.reihe ? eur(cash.wert) : 'offen') : 'Noch kein Import.', trDa ? eur((dep.wert || 0) + (cash.wert || 0)) : 'offen');
    for (const t of g.teile.slice(3)) l += zeile('data-akt="kontostand" data-id="' + esc(t.id) + '"', esc(t.name), t.reihe ? 'Stand vom ' + U.datumDE(t.letzte) + '. Antippen zum Ändern.' : 'Stand eintragen.', t.reihe ? eur(t.wert) : 'offen');
    h += '<section><h2>Konten und Depots</h2><ul class="punkte">' + l + '</ul><div class="knoepfe"><button class="knopf zweit" data-akt="konto-neu">Konto oder Bargeld hinzufügen</button></div></section>';
    const sc = A.depotSc(st, heute);
    h += '<section><h2>Altersvorsorge ' + i('scalable') + '</h2><ul class="punkte">' + zeile('data-akt="geh" data-art="scalable"', 'Scalable Capital', sc.wert ? 'Depotwert vom ' + U.datumDE(sc.wert.datum) + '. Zählt nicht zum Gesamtvermögen.' : (sc.plaene.length ? 'Eingezahlt ' + eur(sc.eingezahlt) + '. Depotwert noch nicht eingetragen.' : 'Sparplan und Depotwert eintragen.'), sc.wert ? eur(sc.wert.wert) : 'offen') + '</ul></section>';
    if (g.hinweise.length) h += '<section><ul class="notiz">' + g.hinweise.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></section>';
    return h;
  };

  // Eigener Verlauf nur für Trade Republic, über die ganze Laufzeit des Exports
  function trVerlauf(g, heute) {
    const d = g.tr.depot, c = g.tr.cash, teile = [d, c].filter(Boolean);
    if (!teile.length) return null;
    let start = teile[0].start, ende = teile[0].letzte;
    for (const r of teile) { if (r.start < start) start = r.start; if (r.letzte > ende) ende = r.letzte; }
    if (ende > heute) ende = heute;
    const n = U.tageZwischen(start, ende) + 1, tage = [], w = new Array(n).fill(0);
    for (let k = 0; k < n; k++) tage.push(U.plusTage(start, k));
    for (const r of teile) { const off = U.tageZwischen(r.start, start); for (let k = 0; k < n; k++) { const j = off + k; w[k] += j < 0 ? (r === d ? 0 : r.werte[0]) : r.werte[Math.min(r.werte.length - 1, j)]; } }
    return { tage: tage, reihen: { tr: w }, gruppen: ['tr'] };
  }

  function trSeite(st, ui) {
    const heute = U.heute(), g = W.gesamt(st, heute), tr = A.depotTr(st), dep = g.teile[1], cash = g.teile[2];
    if (!tr.anzahl && !dep.reihe && !cash.reihe) return '<section><p class="aussage lang">Noch keine Daten von Trade Republic.</p><p class="unter">In der Trade-Republic-App: Profil, Kontoauszüge, Transaktionsexport, „Alle Transaktionen“, Erstellen. Die CSV-Datei dann hier importieren.</p><div class="knoepfe"><button class="knopf" data-akt="geh" data-art="import">CSV importieren</button><button class="knopf zweit" data-akt="depotwert" data-depot="tr">Depotwert von Hand eintragen</button></div></section>';
    let h = '<section class="buehne"><p class="etikett">Depot und Guthaben</p><p class="zahl-gross" id="vl-wert">' + eur((dep.wert || 0) + (cash.wert || 0)) + '</p>';
    const v = trVerlauf(g, heute);
    if (v && v.tage.length > 1) h += verlaufBlock(v, ui, 'tr', false);
    h += '</section>';
    h += '<section><h2>Bestand</h2><div class="buch">' +
      zl('Depotwert ' + i('trwert'), dep.reihe ? eur(dep.wert) : 'offen', '', dep.reihe ? 'letzter bekannter Kurs vom ' + U.datumDE(dep.letzte) : '') +
      zl('Kaufpreis der Wertpapiere', eur(tr.investiert)) +
      (dep.reihe ? zl('Buchgewinn', vz(r2(dep.wert - tr.investiert)), 'summe') : '') +
      zl('Guthaben ' + i('trguthaben'), cash.reihe ? eur(cash.wert) : 'offen', '', cash.reihe ? (g.tr.cashAb0 ? 'aus dem Export gerechnet' : 'ab deinem eingetragenen Stand gerechnet') : 'bitte eintragen') +
      '</div><div class="knoepfe"><button class="knopf zweit" data-akt="depotwert" data-depot="tr">Depotwert eintragen</button><button class="knopf zweit" data-akt="tr-guthaben">Guthaben eintragen</button></div></section>';
    const tm = W.trMonat(st, heute.slice(0, 7));
    const z = [zl('Eingezahlt im ' + U.monatNur(heute.slice(0, 7)), eur(tm.eingezahlt)), zl('Davon investiert', eur(tm.investiert))];
    if (tr.sparplanMonat) z.push(zl('Sparpläne pro Monat', eur(tr.sparplanMonat), '', 'Durchschnitt der letzten drei Monate'));
    z.push(zl('Eingezahlt insgesamt', eur(tr.eingezahlt)));
    if (tr.ausgezahlt) z.push(zl('Ausgezahlt insgesamt', eur(-tr.ausgezahlt)));
    h += '<section><h2>Einzahlungen und Sparpläne</h2><div class="buch">' + z.join('') + '</div></section>';
    const e = [];
    if (tr.dividenden) e.push(zl('Dividenden und Ausschüttungen', eur(tr.dividenden)));
    if (tr.zinsen) e.push(zl('Zinsen', eur(tr.zinsen)));
    if (tr.bonus) e.push(zl('Saveback und Boni', eur(tr.bonus)));
    if (tr.verkaeufe) e.push(zl('Gewinn aus Verkäufen', vz(tr.realisiert), '', 'Verkaufserlös minus durchschnittlicher Kaufpreis'));
    if (tr.gebuehren) e.push(zl('Gebühren', eur(-tr.gebuehren)));
    if (tr.steuern) e.push(zl('Steuern', eur(-tr.steuern)));
    if (tr.karte) e.push(zl('Kartenzahlungen', eur(-tr.karte), '', 'zählen in dieser Version nicht zu den Ausgaben'));
    if (e.length) h += '<section><h2>Erträge und Kosten</h2><div class="buch">' + e.join('') + '</div></section>';
    if (tr.positionen.length) h += '<section><details><summary>' + tr.positionen.length + (tr.positionen.length === 1 ? ' Position' : ' Positionen') + ' anzeigen</summary><div class="buch">' + tr.positionen.map(p => zl(esc(p.name), eur(p.kosten), '', U.num(Math.round(p.stueck * 1000) / 1000) + ' Stück, im Schnitt gekauft zu ' + eur(p.schnitt))).join('') + '</div></details></section>';
    h += '<section><p class="merk">' + tr.anzahl + ' Buchungen vom ' + U.datumDE(tr.von) + ' bis ' + U.datumDE(tr.bis) + '.' + (tr.sonst ? ' ' + tr.sonst + ' davon konnte die App keiner Art zuordnen, sie fehlen in den Summen.' : '') + ' Die Zahlen zeigen nur, was aus deinen Daten hervorgeht. Das ist keine Anlageberatung.</p></section>';
    return h;
  }

  function scalableSeite(st) {
    const heute = U.heute(), sc = A.depotSc(st, heute);
    let h = '<section class="buehne"><p class="etikett">Altersvorsorge ' + i('scalable') + '</p><p class="zahl-gross' + (sc.wert ? '' : ' offen') + '">' + (sc.wert ? eur(sc.wert.wert) : 'noch offen') + '</p>' +
      (sc.wert ? '<p class="trend">' + trend(sc.gewinn, sc.eingezahlt, 'gegenüber dem eingezahlten Geld') + '</p>' : '<p class="unter">Der kostenlose Tarif hat keinen Export. Leg deinen Sparplan einmal an und trag gelegentlich den Depotwert ein.</p>') + '</section>';
    if (sc.plaene.length || sc.einzel.length) {
      h += '<section><h2>Sparpläne und Käufe</h2><ul class="punkte">' +
        sc.plaene.map(p => zeile('data-akt="sparplan" data-id="' + esc(p.id) + '"', esc(p.name || 'Sparplan'), eur(p.betrag) + ' am ' + p.tag + '. des Monats seit ' + U.datumDE(p.start) + (p.aktiv ? '' : ', beendet am ' + U.datumDE(p.ende)) + ', ' + p.ausfuehrungen + ' Ausführungen', eur(p.summe))).join('') +
        sc.einzel.map(x => zeile('data-akt="einzel-weg" data-id="' + esc(x.id) + '"', esc(x.text || 'Einzelkauf'), U.datumDE(x.datum) + '. Antippen zum Entfernen.', eur(x.betrag))).join('') +
        '</ul><div class="buch">' + zl('Eingezahlt', eur(sc.eingezahlt), 'summe') + (sc.wert ? zl('Depotwert', eur(sc.wert.wert), '', 'eingetragen am ' + U.datumDE(sc.wert.datum)) : '') + '</div></section>';
    }
    h += '<section><div class="knoepfe"><button class="knopf" data-akt="depotwert" data-depot="sc">Depotwert eintragen</button><button class="knopf zweit" data-akt="sparplan">Sparplan anlegen</button><button class="knopf zweit" data-akt="einzel">Einzelkauf eintragen</button></div><p class="merk">Scalable Capital zählt als Altersvorsorge nicht zum Gesamtvermögen. Die Zahlen sind keine Anlageberatung.</p></section>';
    return h;
  }

  // ---------- Mehr ----------
  const punkt = (art, titel, text) => '<li><button data-akt="geh" data-art="' + art + '"><span><strong>' + titel + '</strong><small>' + text + '</small></span><span class="pfeil">›</span></button></li>';

  V.mehr = function (st) {
    return H.banner(st) + '<section><ul class="punkte">' +
      punkt('gehaltsteuer', 'Gehalt und Steuer', 'Nächste Zahlungen, Lohnabrechnung, Kirchensteuer, Steuererklärung') +
      punkt('sparziele', 'Sparziele und Tipps', 'Was du zurücklegst, Abos, Einsparmöglichkeiten') +
      punkt('import', 'Daten importieren', 'CSV-Dateien der Sparkasse und von Trade Republic') +
      punkt('einstellungen', 'Einstellungen', 'Darstellung, Gehalt, Kategorien, Hinweise, Sicherung, Datenschutz') +
      '</ul></section>';
  };

  function gehaltSteuer(st, ui) {
    let h = '';
    if (G.hatGehalt(st)) {
      const heute = U.heute(), ym = heute.slice(0, 7), z = [];
      for (let k = 0; k < 4 && z.length < 3; k++) {
        const pm = G.planMonat(st, U.ymPlus(ym, k));
        if (pm.datum < heute) continue;
        const extra = pm.teile.filter(t => t.art === 'einmal').map(t => t.name).concat(pm.zusatz > 0 || pm.spesen > 0 ? ['Einsatz ' + pm.einsaetze.join(', ')] : []);
        z.push(zl(U.datumDE(pm.datum), eur(pm.auszahlung), '', 'Gehalt ' + U.monatNur(pm.ym) + (extra.length ? ' mit ' + esc(extra.join(' und ')) : '')));
      }
      h += '<section><h2>Nächste Zahlungen ' + i('netto') + '</h2><div class="buch">' + z.join('') + '</div></section>';
      const vs = A.vorschau(st, heute, 3).zeilen.filter(x => x.saldo != null);
      if (vs.length) h += '<section><h2>Die nächsten Monate</h2><div class="buch">' + vs.map(x => zl(U.monatName(x.ym), vz(x.saldo), '', 'Einnahmen ' + eur0(x.ein) + ', Ausgaben ' + eur0(x.aus) + (x.spar ? ', Sparen ' + eur0(x.spar) : '') + (x.konto != null ? '. Konto am Monatsende etwa ' + eur0(x.konto) : ''))).join('') + '</div><p class="unter">Einnahmen aus deinen Gehaltsdaten samt Einsätzen, Ausgaben als Durchschnitt der letzten Monate.</p></section>';
    }
    return h + V.steuer(st, ui);
  }

  function sparSeite(st) {
    const heute = U.heute(), q = W.sparquote(st, heute), p = A.prognose(st, heute);
    let h = '';
    if (q) h += '<section class="buehne"><p class="etikett">Zurückgelegt pro Monat ' + i('sparquote') + '</p><p class="zahl-gross">' + eur(q.zurueck) + '</p><p class="trend">' + pz(q.quote) + ' deiner Einnahmen, Schnitt aus ' + q.monate.length + (q.monate.length === 1 ? ' Monat' : ' Monaten') + '</p><div class="buch">' + q.monate.map(m => zl(U.monatName(m.ym), vz(r2(m.ein - m.aus)), '', m.spar > 0 ? 'davon ' + eur0(m.spar) + ' ins Depot und Sparen' : '')).join('') + '</div></section>';
    else h += '<section><p class="unter">Sobald ein voller Monat mit Buchungen importiert ist, zeigt die App hier, wie viel du zurücklegst.</p></section>';
    h += '<section><h2>Sparziele</h2>';
    if (!st.sparziele.length) h += '<p class="unter">Du hast kein Sparziel angelegt. Das ist freiwillig.</p>';
    else h += '<div class="balken">' + st.sparziele.map(function (z) {
      const ant = z.ziel > 0 ? Math.min(1, (z.gespart || 0) / z.ziel) : 0, offen = Math.max(0, z.ziel - (z.gespart || 0));
      let klein = eur0(z.gespart || 0) + ' von ' + eur0(z.ziel);
      if (z.bis && z.bis > heute && offen > 0) { const mon = Math.max(1, (Number(z.bis.slice(0, 4)) - Number(heute.slice(0, 4))) * 12 + Number(z.bis.slice(5, 7)) - Number(heute.slice(5, 7))); klein += ', bis ' + U.monatName(z.bis.slice(0, 7)) + ' noch ' + eur0(offen / mon) + ' pro Monat'; }
      return '<button class="bz" data-akt="sparziel" data-id="' + esc(z.id) + '"><span class="n">' + esc(z.name) + '<small>' + klein + '</small></span><span class="w">' + pz(ant) + '</span><span class="spur budget"><i style="width:' + Math.max(1, ant * 100).toFixed(1) + '%"></i></span></button>';
    }).join('') + '</div>';
    h += '<div class="knoepfe"><button class="knopf zweit" data-akt="sparziel">Sparziel anlegen</button></div></section>';
    const wk = p.wiederkehrend.filter(w => w.typ === 'ausgabe' && w.mittel < 0);
    if (wk.length) h += '<section><h2>Abos und feste Zahlungen</h2><details><summary>' + wk.length + ' erkannt, zusammen ' + eur(wk.reduce((s, w) => s - w.mittel, 0)) + ' pro Monat</summary><div class="buch">' + wk.map(w => zl(esc(w.name), eur(-w.mittel), '', esc(A.katName(st, w.kat)))).join('') + '</div></details></section>';
    const tipps = W.tipps(st, heute, p);
    h += '<section><h2>Tipps aus deinen Daten</h2>' + (tipps.length ? tipps.map(t => '<div class="tipp"><strong>' + esc(t.titel) + '</strong><p>' + esc(t.text) + '</p></div>').join('') : '<p class="unter">Noch keine Tipps. Dafür braucht die App Buchungen aus mindestens drei Monaten.</p>') +
      '<p class="merk">Die Tipps entstehen nur aus deinen Buchungen. Es gibt keine Werbung und keine Produktempfehlungen. Das ist keine Finanzberatung.</p></section>';
    return h;
  }

  function einstellungen(st) {
    const e = st.einstellungen;
    let h = '';
    if (!FA.VORSCHAU) h += '<section><h2>Darstellung</h2><div class="wahl">' + [['system', 'Wie das Gerät'], ['hell', 'Hell'], ['dunkel', 'Dunkel']].map(o => '<label><input type="radio" name="thema" value="' + o[0] + '" data-wechsel="thema"' + (e.thema === o[0] ? ' checked' : '') + '> ' + o[1] + '</label>').join('') + '</div></section>';
    h += '<section><h2>Hinweise auf dem Dashboard</h2>' + F.hf('Gehaltseingang', 'hinweisGehalt', e.hinweisGehalt, 'Zeigt, wann das Gehalt erwartet wird oder eingegangen ist.', 'data-wechsel="hinweis"') + F.hf('Ungewöhnlich hohe Ausgaben', 'hinweisHoch', e.hinweisHoch, 'Markiert Buchungen und Wochen, die deutlich über deinem Schnitt liegen.', 'data-wechsel="hinweis"') +
      '<p class="merk">Die App kann keine Push-Nachrichten schicken. Die Hinweise erscheinen, sobald du sie öffnest und Daten importierst.</p></section>';
    h += '<section><ul class="punkte">' +
      punkt('gehalt', 'Gehalt und Zuschläge', 'Gehaltsbausteine, Lohnerhöhung, Arbeitszeit, Steuerdaten') +
      punkt('kategorien', 'Kategorien und Regeln', 'Eigene Kategorien, gemerkte Zuordnungen') +
      '<li><button data-akt="budgets"><span><strong>Budgets</strong><small>Monatliche Obergrenzen je Kategorie</small></span><span class="pfeil">›</span></button></li>' +
      '<li><button data-akt="nav" data-ziel="vermoegen"><span><strong>Konten</strong><small>Girokonto, Bargeld und weitere Konten stehen unter Vermögen</small></span><span class="pfeil">›</span></button></li>' +
      punkt('sicherung', 'Sicherung und Sperre', 'Verschlüsselte Sicherungsdatei, App-Passwort') +
      punkt('info', 'Datenschutz und Hilfe', 'Was gespeichert wird und wie du alles löschst') +
      '</ul></section><section><h2>Währung</h2><p class="unter">Die App rechnet in Euro. Für Einsätze im Ausland trägst du Währung und Wechselkurs direkt im Einsatz ein.</p></section>';
    return h;
  }

  V.sub = {
    einsatz: (st, ui) => V.einsatz(st, ui.sub.id),
    buchungen: (st, ui) => '<section><div class="knoepfe"><button class="knopf" data-akt="buchung-neu">Buchung eintragen</button><button class="knopf zweit" data-akt="geh" data-art="import">CSV importieren</button></div></section>' + V.buchungen(st, ui),
    tr: trSeite, scalable: scalableSeite, gehaltsteuer: gehaltSteuer, gehalt: st => V.gehalt(st), sparziele: sparSeite, einstellungen: einstellungen,
    kategorien: st => V.kategorien(st), import: (st, ui) => V.import(st, ui), sicherung: (st, ui) => V.sicherung(st, ui), info: st => V.info(st)
  };

  // ---------- Blätter ----------
  const dz = (label, wert) => '<div class="dz"><span>' + label + '</span><strong>' + wert + '</strong></div>';
  const senden = text => '<p class="fehler" id="form-fehler" hidden></p><div class="knoepfe"><button class="knopf" type="submit">' + (text || 'Speichern') + '</button>';
  const MARKEN = [['', 'Keine'], ['einsatz', 'Serviceeinsatz'], ['spese', 'Spese'], ['reisekosten', 'Reisekosten'], ['investition', 'Investition']];
  V.MARKEN = MARKEN;

  // Stück des Kuchendiagramms: Betrag, Anteil und was dahintersteckt
  V.torteBlatt = function (st, ym, key) {
    const t = W.torte(st, ym), s = t.stuecke.find(x => x.key === key);
    if (!s) return null;
    let k = '<p class="zahl">' + eur(s.wert) + '</p><p class="trend">' + pz(s.anteil) + (t.ein > 0 ? ' deiner Einnahmen im ' : ' des abgeflossenen Geldes im ') + U.monatNur(ym) + '</p>';
    const imMonat = x => x.datum.slice(0, 7) === ym;
    if (key.indexOf('kat:') === 0) {
      const kat = key.slice(4), liste = st.tx.filter(x => imMonat(x) && x.kat === kat && x.betrag < 0 && A.txTyp(st, x) === 'ausgabe').sort((a, b) => a.betrag - b.betrag).slice(0, 5);
      k += '<h3>Größte Buchungen</h3><div class="liste">' + liste.map(x => H.txZeile(st, x)).join('') + '</div><div class="knoepfe"><button class="knopf zweit" data-akt="kat-zeigen" data-kat="' + esc(kat) + '">Alle Buchungen der Kategorie</button></div>';
    } else if (key === 'uebrige') {
      k += '<h3>Darin enthalten</h3><ul class="punkte">' + t.gefaltet.map(x => '<li><button data-akt="kat-zeigen" data-kat="' + esc(x.kat) + '"><span><strong>' + esc(x.name) + '</strong></span><span class="w">' + eur(x.wert) + '</span></button></li>').join('') + '</ul>';
    } else if (key === 'tr') {
      const tm = W.trMonat(st, ym), g = W.gesamt(st, U.heute()), dep = g.teile[1], tr = A.depotTr(st);
      k += '<div class="buch">' + zl('Vom Girokonto überwiesen', eur(t.tr)) + (tm.quelle === 'tr' ? zl('Bei Trade Republic eingegangen', eur(tm.eingezahlt)) + zl('In Wertpapiere investiert', eur(tm.investiert)) : '') +
        (dep.reihe ? zl('Depotwert heute', eur(dep.wert), '', 'letzter bekannter Kurs vom ' + U.datumDE(dep.letzte)) + zl('Buchgewinn', vz(r2(dep.wert - tr.investiert))) : '') + '</div>' +
        (tm.quelle === 'tr' ? '' : '<p class="unter">Für diesen Monat gibt es noch keinen Trade-Republic-Export. Die Zahl stammt aus dem Girokonto.</p>') +
        '<div class="knoepfe"><button class="knopf zweit" data-akt="geh" data-art="tr">Trade Republic öffnen</button></div>';
    } else if (key === 'spar') {
      const liste = st.tx.filter(x => imMonat(x) && A.txTyp(st, x) === 'sparen' && !/trade republic/.test(U.norm((x.gegen || '') + ' ' + (x.text || ''))));
      k += '<h3>Buchungen</h3><div class="liste">' + liste.map(x => H.txZeile(st, x)).join('') + '</div>';
    } else {
      k += '<div class="buch">' + zl('Überschuss im ' + U.monatNur(ym), eur(t.ueber)) + (t.tr ? zl('Zu Trade Republic', eur(-t.tr)) : '') + (t.sparSonst ? zl('Weiteres Sparen', eur(-t.sparSonst)) : '') + zl('Auf dem Girokonto geblieben', eur(t.rest), 'summe') + '</div><p class="unter">Dieses Geld wurde weder ausgegeben noch angelegt.</p>';
    }
    return { titel: s.name, html: k };
  };

  V.form.tx = function (st, t) {
    const key = U.schluessel(t), gleiche = st.tx.filter(x => x.id !== t.id && U.schluessel(x) === key).length;
    const konto = (st.konten.find(k => k.id === (t.konto || 'giro')) || {}).name || 'ohne Konto';
    const eins = st.einsaetze.map(e => [e.id, (e.titel || e.stadt || 'Einsatz') + ', ' + U.datumDE(e.start)]);
    const beruf = t.marke === 'einsatz' || t.marke === 'spese' || t.marke === 'reisekosten';
    return { titel: 'Buchung', html: '<form data-form="tx"><input type="hidden" name="id" value="' + esc(t.id) + '">' +
      '<p class="zahl ' + (t.betrag > 0 ? 'plus' : '') + '">' + U.eurVz(t.betrag) + '</p><div class="buch">' +
      dz('Datum', U.datumDE(t.datum)) + dz('Händler oder Empfänger', esc(t.gegen || 'ohne Angabe')) + dz('Konto', esc(konto) + (t.quelle === 'manuell' ? ', von Hand eingetragen' : ', aus dem Import')) + (t.text ? dz('Buchungstext', esc(t.text)) : '') + '</div>' +
      F.sf('Kategorie', 'kat', st.kategorien.map(k => [k.id, k.name]), t.kat) +
      (key ? F.hf('Neue Kategorie für diesen Empfänger merken', 'merken', true, 'Greift nur, wenn du die Kategorie änderst.' + (gleiche ? ' Dann wechseln auch ' + gleiche + ' weitere ' + (gleiche === 1 ? 'Buchung' : 'Buchungen') + ' und künftige Importe.' : ' Gilt dann für künftige Importe.')) : '') +
      F.sf('Markieren als', 'marke', MARKEN, t.marke || '', '„Investition“ zählt als Sparen statt als Ausgabe. Die anderen Markierungen ordnen die Buchung einem Einsatz zu.', 'data-wechsel="tx-marke"') +
      '<div id="tx-einsatz"' + (beruf && eins.length ? '' : ' hidden') + '>' + F.sf('Gehört zu Einsatz', 'einsatzId', [['', 'Kein bestimmter']].concat(eins), t.einsatzId || '') + '</div>' +
      F.tf('Notiz', 'notiz', t.notiz || '', 'text', '', 'maxlength="200"') +
      senden() + (t.quelle === 'manuell' ? '<button class="knopf gefahr" type="button" data-akt="tx-weg" data-id="' + esc(t.id) + '">Löschen</button>' : '') + '</div>' +
      (t.quelle === 'manuell' ? '' : '<p class="merk">Importierte Buchungen lassen sich nicht löschen, sie kämen beim nächsten Import wieder. Soll eine Buchung nicht mitzählen, wähle die Kategorie „Umbuchung (zählt nicht mit)“.</p>') + '</form>' };
  };

  V.form.buchung = function (st) {
    const kats = st.kategorien.filter(k => k.typ !== 'neutral').map(k => [k.id, k.name]);
    return { titel: 'Buchung eintragen', html: '<form data-form="buchung"><div class="wahl"><label><input type="radio" name="richtung" value="aus" checked> Ausgabe</label><label><input type="radio" name="richtung" value="ein"> Einnahme</label></div>' +
      '<div class="gitter">' + F.zf('Betrag in €', 'betrag', '', '', 'required') + F.tf('Datum', 'datum', U.heute(), 'date', '', 'required') + '</div>' +
      F.tf('Wo oder wofür', 'gegen', '', 'text', '', 'maxlength="80"') +
      '<div class="gitter">' + F.sf('Kategorie', 'kat', [['', 'Automatisch']].concat(kats), '') + F.sf('Konto', 'konto', st.konten.map(k => [k.id, k.name]), 'giro', 'Kartenzahlungen kommen später mit dem Import. Die App führt beide dann zusammen.') + '</div>' +
      F.tf('Notiz', 'notiz', '', 'text', '', 'maxlength="200"') + senden() + '</div></form>' };
  };

  V.form.kontostand = function (st, konto) {
    const giro = konto.id === 'giro', heute = U.heute();
    const stand = giro ? W.kontoStand(st, heute) : (konto.staende.length ? konto.staende.slice().sort((a, b) => a.datum < b.datum ? -1 : 1)[konto.staende.length - 1].wert : null);
    return { titel: konto.name, html: '<form data-form="kontostand"><input type="hidden" name="id" value="' + esc(konto.id) + '"><p class="unter">' + (giro ? 'Schau im Online-Banking nach deinem Kontostand und trag ihn mit dem passenden Datum ein. Die App rechnet alle Buchungen davor und danach dazu.' : 'Trag den aktuellen Stand ein. Frühere Stände bleiben für den Verlauf erhalten.') + '</p>' +
      '<div class="gitter">' + F.zf('Stand in €', 'wert', stand, '', 'required') + F.tf('Stand vom', 'datum', heute, 'date', '', 'required') + '</div>' + senden() +
      (giro ? '' : '<button class="knopf gefahr" type="button" data-akt="konto-weg" data-id="' + esc(konto.id) + '">Konto entfernen</button>') + '</div></form>' };
  };

  V.form.kontoNeu = () => ({ titel: 'Konto oder Bargeld', html: '<form data-form="konto-neu"><p class="unter">Für alles, was zum Vermögen zählt und nicht importiert wird: Bargeld, Tagesgeld, ein zweites Konto.</p>' +
    F.tf('Bezeichnung', 'name', '', 'text', '', 'required maxlength="40"') + F.sf('Art', 'art', W.ARTEN, 'bar') +
    '<div class="gitter">' + F.zf('Stand in €', 'wert', '', '', 'required') + F.tf('Stand vom', 'datum', U.heute(), 'date', '', 'required') + '</div>' + senden('Hinzufügen') + '</div></form>' });

  V.form.budgets = function (st) {
    const q = W.sparquote(st, U.heute());
    const schnitt = id => q ? q.monate.reduce((s, m) => s + (m.proKat[id] || 0), 0) / q.monate.length : 0;
    return { titel: 'Budgets', html: '<form data-form="budgets"><p class="unter">Trag ein, was du pro Monat höchstens ausgeben willst. Leere Felder haben kein Budget.</p><div class="gitter">' +
      st.kategorien.filter(k => k.typ === 'ausgabe').map(k => F.zf(esc(k.name), 'b-' + k.id, st.budgets[k.id] || '', schnitt(k.id) > 0.5 ? 'Schnitt zuletzt ' + eur0(schnitt(k.id)) : '')).join('') + '</div>' + senden() + '</div></form>' };
  };

  V.form.sparziel = function (z) {
    return { titel: z.id ? 'Sparziel' : 'Sparziel anlegen', html: '<form data-form="sparziel"><input type="hidden" name="id" value="' + esc(z.id || '') + '">' + F.tf('Wofür', 'name', z.name || '', 'text', '', 'required maxlength="40"') +
      '<div class="gitter">' + F.zf('Zielbetrag in €', 'ziel', z.ziel, '', 'required') + F.zf('Schon gespart in €', 'gespart', z.gespart || 0, 'Den Betrag passt du selbst an.') + '</div>' +
      F.tf('Erreichen bis', 'bis', z.bis || '', 'date', 'Freiwillig. Dann rechnet die App aus, was pro Monat nötig ist.') + senden() +
      (z.id ? '<button class="knopf gefahr" type="button" data-akt="sparziel-weg" data-id="' + esc(z.id) + '">Löschen</button>' : '') + '</div></form>' };
  };

  V.form.trGuthaben = function (st) {
    const g = W.gesamt(st, U.heute()).teile[2];
    return { titel: 'Guthaben bei Trade Republic', html: '<form data-form="tr-guthaben"><p class="unter">Das Geld auf deinem Verrechnungskonto, das nicht in Wertpapieren steckt. Du findest es in der Trade-Republic-App. Ab diesem Stand rechnet die App mit den Buchungen aus dem Export weiter.</p>' +
      '<div class="gitter">' + F.zf('Guthaben in €', 'wert', g.reihe ? g.wert : '', '', 'required') + F.tf('Stand vom', 'datum', U.heute(), 'date', '', 'required') + '</div>' + senden() + '</div></form>' };
  };
})(typeof window !== 'undefined' ? window : globalThis);
