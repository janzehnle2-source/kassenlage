/* Serviceeinsatz-Rechner: Stunden, Zuschläge, Spesen, eigene Kosten, Geldfluss. */
(function (root) {
  'use strict';
  const FA = root.FA = root.FA || {};
  const U = FA.util, S = FA.steuer, G = FA.gehalt;
  const E = FA.einsatz = {};
  const r2 = U.r2;
  const n = (v, d) => (v === '' || v == null || isNaN(v)) ? d : Number(v);

  // Zählt Werktage, Samstage und Sonntage zwischen Start und Ende (beide eingeschlossen), auch je Monat.
  E.tage = function (start, ende) {
    const r = { moFr: 0, sa: 0, so: 0, tage: 0, proMonat: {} };
    if (!start || !ende || ende < start) return r;
    let d = start, schutz = 0;
    while (d <= ende && schutz++ < 800) {
      const wt = U.wochentag(d), ym = d.slice(0, 7);
      const pm = r.proMonat[ym] || (r.proMonat[ym] = { moFr: 0, sa: 0, so: 0, tage: 0 });
      if (wt === 0) { r.so++; pm.so++; } else if (wt === 6) { r.sa++; pm.sa++; } else { r.moFr++; pm.moFr++; }
      r.tage++; pm.tage++;
      d = U.plusTage(d, 1);
    }
    return r;
  };

  // Alles, was ohne Steuerrechnung feststeht.
  E.grund = function (e, st) {
    const a = st.arbeit || {};
    const z = E.tage(e.start, e.ende);
    const moFr = n(e.tageMoFr, z.moFr), sa = n(e.samstage, z.sa), so = n(e.sonntage, 0);
    const hW = n(e.stdWerktag, n(a.stdWerktag, 8)), hSa = n(e.stdSamstag, n(a.stdSamstag, 0)), hSo = n(e.stdSonntag, n(a.stdSonntag, 0));
    const ws = a.wochenstunden > 0 ? a.wochenstunden : 40;
    const stunden = moFr * hW + sa * hSa + so * hSo;
    const soll = moFr * ws / 5;
    const mehr = Math.max(0, stunden - soll);
    const satz = G.stundensatz(st, (e.start || U.heute()).slice(0, 7));
    const zProz = n(e.zuschlag, e.ausland ? n(a.zuschlagAusland, 0) : n(a.zuschlagInland, 0));
    const ueZ = n(a.ueberstundenZuschlag, 0);
    const zuschlagBetrag = r2(stunden * satz * zProz / 100);
    const mehrBetrag = r2(mehr * satz * (1 + ueZ / 100));
    const zusatzBrutto = r2(zuschlagBetrag + mehrBetrag);
    const verzug = Math.max(0, Math.round(n(e.verzug, n(a.verzugMonate, 0))));

    // Zusatzlohn nach Arbeitsmonat aufteilen; ausgezahlt wird jeweils "verzug" Monate später.
    const yms = Object.keys(z.proMonat).sort();
    const gew = yms.map(ym => { const p = z.proMonat[ym]; return p.moFr * hW + p.sa * hSa + p.so * hSo; });
    const gs = gew.reduce((s, x) => s + x, 0);
    const teile = [];
    let rest = zusatzBrutto;
    yms.forEach(function (ym, i) {
      const letzter = i === yms.length - 1;
      const anteil = gs > 0 ? gew[i] / gs : 1 / yms.length;
      const betrag = letzter ? r2(rest) : r2(zusatzBrutto * anteil);
      rest -= betrag;
      teile.push({ ym: ym, zahlYm: U.ymPlus(ym, verzug), zusatzBrutto: betrag });
    });

    // Spesen und Kosten
    const tage = z.tage;
    const reisetage = Math.min(tage, Math.max(0, n(e.reisetage, tage > 1 ? 2 : (tage === 1 ? 1 : 0))));
    const volleTage = Math.max(0, tage - reisetage);
    const naechte = Math.max(0, n(e.naechte, Math.max(0, tage - 1)));
    const kurs = n(e.kurs, 1) > 0 ? n(e.kurs, 1) : 1; // 1 EUR = kurs Fremdwährung
    const vmaVoll = n(e.vmaVoll, 0), vmaTeil = n(e.vmaTeil, 0);
    // Bezahlt der Arbeitgeber das Frühstück, sinkt die Pauschale je Übernachtung um 20 % des vollen Tagessatzes
    const vmaBrutto = volleTage * vmaVoll + reisetage * vmaTeil;
    const vmaKuerzung = e.fruehstueck ? r2(Math.min(vmaBrutto, naechte * 0.2 * vmaVoll)) : 0;
    const vmaAnspruch = r2(vmaBrutto - vmaKuerzung);
    const verpflegung = e.vmaVomAg ? vmaAnspruch : 0;
    const unterkunftErst = r2(naechte * n(e.unterkunftErstattung, 0));
    const unterkunftKosten = r2(naechte * n(e.unterkunftKosten, 0) / kurs);
    const km = n(e.km, 0);
    const kmErst = r2(km * n(e.kmSatz, 0)), kmEigen = r2(km * n(e.kmKosten, 0));
    let postenSumme = 0, postenErst = 0;
    const posten = (e.posten || []).map(function (p) {
      const eur = r2(n(p.betrag, 0) / kurs);
      postenSumme += eur; if (p.erstattet) postenErst += eur;
      return { name: p.name, betrag: eur, erstattet: !!p.erstattet };
    });
    postenSumme = r2(postenSumme); postenErst = r2(postenErst);
    const vorOrt = r2(tage * n(e.ausgabenTag, 0) / kurs);
    const ersparnis = r2(tage * n(e.ersparnisTag, 0));
    // Arbeitsweg, der an jedem Einsatztag wegfällt: Kilometer pro Arbeitstag mal Tage mal eigene Kosten je km
    const wegKm = Math.max(0, n(e.wegKm, 0)), wegKosten = Math.max(0, n(e.wegKosten, 0)), wegTage = Math.max(0, n(e.wegTage, moFr));
    const wegGesamtKm = wegKm * wegTage, wegErsparnis = r2(wegGesamtKm * wegKosten);
    const spesenSteuerfrei = r2(verpflegung + unterkunftErst + kmErst + postenErst);
    const eigeneKosten = r2(unterkunftKosten + kmEigen + postenSumme + vorOrt);
    const endYm = (e.ende || e.start || U.heute()).slice(0, 7);
    const w = S.werte(Number(endYm.slice(0, 4)));

    // Was der Arbeitgeber nicht erstattet, kann in die Steuererklärung (Werbungskosten).
    const werbungskosten = r2(
      (e.vmaVomAg ? 0 : vmaAnspruch) +
      Math.max(0, unterkunftKosten - unterkunftErst) +
      Math.max(0, km * w.dienstreiseKm - kmErst) +
      (postenSumme - postenErst)
    );

    return {
      id: e.id, titel: e.titel || [e.stadt, e.land].filter(Boolean).join(', ') || 'Einsatz',
      start: e.start, ende: e.ende, ausland: !!e.ausland,
      tage: tage, moFr: moFr, sa: sa, so: so, autoTage: z,
      hW: hW, hSa: hSa, hSo: hSo, stunden: stunden, soll: soll, mehr: mehr, satz: satz, wochenstunden: ws,
      zProz: zProz, ueZ: ueZ, zuschlagBetrag: zuschlagBetrag, mehrBetrag: mehrBetrag, zusatzBrutto: zusatzBrutto,
      verzug: verzug, teile: teile,
      reisetage: reisetage, volleTage: volleTage, naechte: naechte, kurs: kurs, waehrung: e.waehrung || 'EUR',
      vmaVoll: vmaVoll, vmaTeil: vmaTeil, vmaAnspruch: vmaAnspruch, vmaKuerzung: vmaKuerzung, vmaVomAg: !!e.vmaVomAg, verpflegung: verpflegung,
      unterkunftErst: unterkunftErst, unterkunftKosten: unterkunftKosten,
      km: km, kmErst: kmErst, kmEigen: kmEigen,
      posten: posten, postenSumme: postenSumme, postenErst: postenErst,
      vorOrt: vorOrt, ersparnis: ersparnis,
      wegKm: wegKm, wegKosten: wegKosten, wegTage: wegTage, wegGesamtKm: wegGesamtKm, wegErsparnis: wegErsparnis,
      spesenSteuerfrei: spesenSteuerfrei, eigeneKosten: eigeneKosten,
      spesenYm: U.ymPlus(endYm, verzug), werbungskosten: werbungskosten, wkJahr: Number(endYm.slice(0, 4)),
      ohneGehalt: !(satz > 0)
    };
  };

  // Vollständiges Ergebnis mit Netto-Wirkung und Zahlungsterminen.
  E.berechne = function (e, st) {
    const r = E.grund(e, st);
    const a = st.arbeit || {};
    const o = S.optionen(st.steuer);
    let zusatzNetto = 0;
    for (const t of r.teile) {
      const jahr = Number(t.zahlYm.slice(0, 4));
      const g = G.monat(st, t.zahlYm);
      const ohne = S.abrechnung({ laufend: g.laufend, einmal: 0, jahr: jahr, o: o });
      const mit = S.abrechnung({ laufend: g.laufend + t.zusatzBrutto, einmal: 0, jahr: jahr, o: o });
      t.nettoOhne = ohne.netto; t.nettoMit = mit.netto; t.bruttoOhne = ohne.brutto; t.bruttoMit = mit.brutto;
      t.netto = r2(mit.netto - ohne.netto);
      t.datum = U.gehaltsDatum(t.zahlYm, a.gehaltstag);
      zusatzNetto += t.netto;
    }
    r.zusatzNetto = r2(zusatzNetto);
    r.abzuege = r2(r.zusatzBrutto - r.zusatzNetto);
    r.bleibtProEuro = r.zusatzBrutto > 0 ? r.zusatzNetto / r.zusatzBrutto : 0;
    r.spesenDatum = U.gehaltsDatum(r.spesenYm, a.gehaltstag);
    r.plus = r2(r.zusatzNetto + r.spesenSteuerfrei - r.eigeneKosten);
    // Wer nicht zur Firma fährt, kann für diese Tage keine Pendlerpauschale ansetzen. Das mindert die Steuererstattung.
    r.wegSteuer = 0;
    if (r.wegErsparnis > 0) {
      const w = S.werte(r.wkJahr), einfach = r.wegKm / 2;
      if (einfach * w.entfernungspauschale * 220 > w.arbeitnehmerPauschbetrag) {
        const jb = G.plan(st, r.wkJahr).summen.brutto, split = o.steuerklasse === 3;
        const zvE = Math.max(0, jb - w.arbeitnehmerPauschbetrag - w.sonderausgabenPauschbetrag - S.vorsorgepauschale(jb, o, w));
        const abzug = einfach * w.entfernungspauschale * r.wegTage;
        r.wegAbzug = r2(abzug);
        r.wegSteuer = r2((S.est(zvE, w, split) - S.est(Math.max(0, zvE - abzug), w, split)) * (1 + (o.kirchensteuer ? o.kistSatz / 100 : 0)));
      }
    }
    r.gesamt = r2(r.plus + r.ersparnis + r.wegErsparnis - r.wegSteuer);
    r.proTag = r.tage > 0 ? r2(r.gesamt / r.tage) : 0;

    // Geldfluss: erst die eigenen Kosten, dann die Zahlungen
    const fluss = [];
    if (r.eigeneKosten > 0) fluss.push({ datum: r.start, bis: r.ende, betrag: -r.eigeneKosten, text: 'Eigene Kosten während des Einsatzes' });
    const proDatum = {};
    for (const t of r.teile) if (t.netto) proDatum[t.datum] = (proDatum[t.datum] || 0) + t.netto;
    Object.keys(proDatum).sort().forEach(d => fluss.push({ datum: d, betrag: r2(proDatum[d]), text: 'Mehr Netto durch Zuschläge und Mehrstunden' }));
    if (r.spesenSteuerfrei > 0) fluss.push({ datum: r.spesenDatum, betrag: r.spesenSteuerfrei, text: 'Spesen und Erstattungen (steuerfrei)' });
    fluss.sort((x, y) => x.datum < y.datum ? -1 : x.datum > y.datum ? 1 : 0);
    r.fluss = fluss;
    r.letzteZahlung = fluss.length ? fluss[fluss.length - 1].datum : null;
    return r;
  };

  // Vorgaben für ein neues Einsatzformular
  E.neu = function (st) {
    const a = st.arbeit || {};
    const w = S.werte(Number(U.heute().slice(0, 4)));
    return {
      id: null, titel: '', land: '', stadt: '', ausland: false, start: '', ende: '',
      tageMoFr: '', samstage: '', sonntage: 0,
      stdWerktag: n(a.stdWerktag, 8), stdSamstag: n(a.stdSamstag, 0), stdSonntag: n(a.stdSonntag, 0),
      zuschlag: n(a.zuschlagInland, 0), reisetage: 2,
      vmaVoll: w.vmaInland.voll, vmaTeil: w.vmaInland.teil, vmaVomAg: true, fruehstueck: false,
      naechte: '', unterkunftKosten: 0, unterkunftErstattung: 0,
      km: 0, kmSatz: w.dienstreiseKm, kmKosten: 0,
      posten: [], ausgabenTag: 0, ersparnisTag: 0,
      wegKm: n(a.wegKm, 0), wegKosten: n(a.wegKosten, 0), wegTage: '',
      waehrung: 'EUR', kurs: 1, verzug: n(a.verzugMonate, 0), notiz: ''
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
