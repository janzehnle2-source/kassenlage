/* Gehaltsbausteine (mit "gültig ab") und der Jahresplan: was kommt in welchem Monat aufs Konto. */
(function (root) {
  'use strict';
  const FA = root.FA = root.FA || {};
  const U = FA.util, S = FA.steuer;
  const G = FA.gehalt = {};
  const r2 = U.r2;

  // Gehalt eines Monats aus den Bausteinen. Lohnerhöhung = neuer Grundgehalt-Baustein mit späterem Datum.
  G.monat = function (st, ym) {
    const liste = st.gehalt || [], teile = [];
    let laufend = 0, einmal = 0, grund = 0, g = null;
    for (const b of liste) if (b.art === 'grund' && b.ab.slice(0, 7) <= ym && (!g || b.ab > g.ab)) g = b;
    if (g) { grund = g.betrag; laufend += g.betrag; teile.push({ name: g.name || 'Grundgehalt', betrag: g.betrag, art: 'grund' }); }
    for (const b of liste) {
      if (b.art === 'grund' || b.ab.slice(0, 7) > ym) continue;
      if (b.bis && b.bis.slice(0, 7) < ym) continue;
      if (b.art === 'zulage') { laufend += b.betrag; teile.push({ name: b.name || 'Zulage', betrag: b.betrag, art: 'zulage' }); }
      else if (b.art === 'einmal' && Number(b.monat) === Number(ym.slice(5, 7))) { einmal += b.betrag; teile.push({ name: b.name || 'Einmalzahlung', betrag: b.betrag, art: 'einmal' }); }
    }
    return { laufend: laufend, einmal: einmal, grund: grund, teile: teile };
  };

  G.hatGehalt = st => (st.gehalt || []).some(b => b.art === 'grund' && b.betrag > 0);

  // Stundensatz: fester Wert aus den Einstellungen oder Grundgehalt ÷ (Wochenstunden × 4,348).
  G.stundensatz = function (st, ym) {
    const a = st.arbeit || {};
    if (a.stundensatz > 0) return a.stundensatz;
    const g = G.monat(st, ym).grund;
    const ws = a.wochenstunden > 0 ? a.wochenstunden : 40;
    return g > 0 ? g / (ws * 4.348) : 0;
  };

  let cache = {};
  G.leeren = () => { cache = {}; };

  // Jahresplan: Gehalt + Zusatzlohn aus Einsätzen (im Auszahlungsmonat) + steuerfreie Spesen.
  G.plan = function (st, jahr) {
    jahr = Number(jahr);
    if (cache[jahr]) return cache[jahr];
    const o = S.optionen(st.steuer);
    const a = st.arbeit || {};
    const ein = (st.einsaetze || []).map(e => FA.einsatz.grund(e, st));
    const monate = [];
    for (let m = 1; m <= 12; m++) {
      const ym = jahr + '-' + U.z2(m);
      const g = G.monat(st, ym);
      let zusatz = 0, spesen = 0;
      const quellen = [];
      for (const r of ein) {
        let dabei = false;
        for (const t of r.teile) if (t.zahlYm === ym && t.zusatzBrutto > 0) { zusatz += t.zusatzBrutto; dabei = true; }
        if (r.spesenYm === ym && r.spesenSteuerfrei > 0) { spesen += r.spesenSteuerfrei; dabei = true; }
        if (dabei) quellen.push(r.titel);
      }
      monate.push({ ym: ym, basis: g.laufend, zusatz: r2(zusatz), laufend: r2(g.laufend + zusatz), einmal: g.einmal, spesen: r2(spesen), teile: g.teile, einsaetze: quellen });
    }
    const sim = S.jahr(jahr, monate.map(m => ({ laufend: m.laufend, einmal: m.einmal })), o);
    const abzug = a.nettoAbzug > 0 ? a.nettoAbzug : 0;
    monate.forEach(function (m, i) {
      m.abr = sim.zeilen[i];
      m.abzug = m.abr.brutto > 0 ? abzug : 0;
      m.auszahlung = r2(m.abr.netto - m.abzug + m.spesen);
      m.datum = U.gehaltsDatum(m.ym, a.gehaltstag);
    });
    const spesenSumme = r2(monate.reduce((s, m) => s + m.spesen, 0));
    const auszahlungSumme = r2(monate.reduce((s, m) => s + m.auszahlung, 0));
    const plan = { jahr: jahr, monate: monate, summen: sim.summen, spesen: spesenSumme, auszahlung: auszahlungSumme, o: o, w: S.werte(jahr) };
    cache[jahr] = plan;
    return plan;
  };

  G.planMonat = function (st, ym) {
    const p = G.plan(st, ym.slice(0, 4));
    return p.monate[Number(ym.slice(5, 7)) - 1];
  };
})(typeof window !== 'undefined' ? window : globalThis);
