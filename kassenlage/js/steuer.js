/* Rechenkern für Lohnsteuer, Kirchensteuer, Solidaritätszuschlag und Sozialabgaben.
   Alles hier ist eine Vorschätzung nach den veröffentlichten Formeln, keine verbindliche Abrechnung. */
(function (root) {
  'use strict';
  const FA = root.FA = root.FA || {};
  const S = FA.steuer = {};
  const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;

  // Werte des Jahres; fehlt ein Jahr, gilt das letzte bekannte davor (ersatz = true).
  S.werte = function (jahr) {
    const alle = FA.STEUERWERTE;
    const jahre = Object.keys(alle).map(Number).sort((a, b) => a - b);
    let j = jahre[0];
    for (const x of jahre) if (x <= jahr) j = x;
    return Object.assign({ jahr: j, ersatz: j !== Number(jahr) }, alle[j]);
  };

  // Macht aus den Einstellungen die Angaben, mit denen gerechnet wird.
  S.optionen = function (s) {
    s = s || {};
    const bl = s.bundesland || '';
    const kinder = Number(s.kinder) || 0;
    let sk = Number(s.steuerklasse) || 1;
    if (sk < 1 || sk > 4) sk = 1;
    return {
      steuerklasse: sk,
      kirchensteuer: !!s.kirchensteuer,
      kistSatz: (bl === 'BW' || bl === 'BY') ? 8 : 9,
      kvZusatz: (s.kvZusatz === '' || s.kvZusatz == null || isNaN(s.kvZusatz)) ? null : Number(s.kvZusatz),
      kinder: kinder,
      kinderlosZuschlag: kinder === 0 && s.kinderlosZuschlag !== false,
      sachsen: bl === 'SN'
    };
  };

  // Einkommensteuer nach Grundtarif auf das zu versteuernde Einkommen (volle Euro).
  S.tarif = function (zvE, w) {
    const x = Math.floor(zvE + 1e-9);
    if (x <= w.grundfreibetrag) return 0;
    let st;
    if (x <= w.zone2Bis) { const y = (x - w.grundfreibetrag) / 10000; st = (w.y1 * y + w.y2) * y; }
    else if (x <= w.zone3Bis) { const z = (x - w.zone2Bis) / 10000; st = (w.z1 * z + w.z2) * z + w.z3; }
    else if (x <= w.zone4Bis) st = w.spitzenSatz * x - w.spitzenAbzug;
    else st = w.reichenSatz * x - w.reichenAbzug;
    return Math.floor(st + 1e-9);
  };
  S.est = (zvE, w, splitting) => splitting ? 2 * S.tarif(zvE / 2, w) : S.tarif(zvE, w);

  S.kvZusatz = (o, w) => (o.kvZusatz == null ? w.kvZusatzDurchschnitt : o.kvZusatz);

  // Arbeitnehmeranteil Pflegeversicherung
  S.pvSatzAn = function (o, w) {
    let s = w.pvAn;
    if (o.sachsen) s += w.pvSachsenExtra;
    const k = o.kinder || 0;
    if (k === 0) { if (o.kinderlosZuschlag) s += w.pvKinderlos; }
    else if (k >= 2) s -= w.pvAbschlagKind * (Math.min(k, 5) - 1);
    return s;
  };

  // Sozialabgaben auf einen Betrag. grenzen = noch freier Spielraum bis zur Bemessungsgrenze.
  S.sv = function (brutto, o, w, grenzen) {
    const basisRv = Math.max(0, Math.min(brutto, grenzen ? grenzen.rv : w.bbgRvMonat));
    const basisKv = Math.max(0, Math.min(brutto, grenzen ? grenzen.kv : w.bbgKvMonat));
    const kvSatz = w.kvAllgAn + S.kvZusatz(o, w) / 200;
    const rv = r2(basisRv * w.rvAn), av = r2(basisRv * w.avAn);
    const kv = r2(basisKv * kvSatz), pv = r2(basisKv * S.pvSatzAn(o, w));
    return { rv: rv, av: av, kv: kv, pv: pv, summe: r2(rv + av + kv + pv), basisRv: basisRv, basisKv: basisKv };
  };

  // Vorsorgepauschale im Lohnsteuerabzug (Stand 2026: ohne Mindestbetrag, Arbeitslosenversicherung nur bis 1.900 € zusammen mit KV/PV).
  S.vorsorgepauschale = function (jahresbrutto, o, w) {
    const rvB = Math.min(jahresbrutto, w.bbgRvMonat * 12), kvB = Math.min(jahresbrutto, w.bbgKvMonat * 12);
    const rv = rvB * w.rvAn;
    const kvpv = kvB * (w.kvErmAn + S.kvZusatz(o, w) / 200 + S.pvSatzAn(o, w));
    const av = rvB * w.avAn;
    const sonst = Math.max(kvpv, Math.min(kvpv + av, w.vorsorgeSonstigeMax));
    return Math.ceil(rv + sonst - 1e-9);
  };

  // Jahreslohnsteuer für einen Jahresbruttolohn
  S.lohnsteuerJahr = function (jahresbrutto, o, w) {
    if (!(jahresbrutto > 0)) return 0;
    let zvE = jahresbrutto - w.arbeitnehmerPauschbetrag - w.sonderausgabenPauschbetrag - S.vorsorgepauschale(jahresbrutto, o, w);
    if (o.steuerklasse === 2) zvE -= w.entlastungAlleinerziehend;
    return S.est(Math.max(0, zvE), w, o.steuerklasse === 3);
  };

  S.soliJahr = function (steuer, o, w) {
    const fg = w.soliFreigrenze * (o.steuerklasse === 3 ? 2 : 1);
    if (steuer <= fg) return 0;
    return Math.min(steuer * w.soliSatz, (steuer - fg) * w.soliMilderung);
  };

  /* Abrechnung eines Monats.
     p.laufend = regelmäßiger Lohn dieses Monats (Grundgehalt, Zulagen, Überstunden, Zuschläge)
     p.einmal  = Einmalzahlung (z. B. Weihnachtsgeld), wird wie ein "sonstiger Bezug" über das Jahr besteuert
     p.jahresLaufend = erwarteter laufender Jahreslohn (für die Einmalzahlung); ohne Angabe laufend × 12
     p.svVorher = bereits verbeitragte Beträge im Jahr {rv, kv}; p.monat = 1..12 */
  S.abrechnung = function (p) {
    const w = S.werte(p.jahr), o = p.o;
    const laufend = Math.max(0, p.laufend || 0), einmal = Math.max(0, p.einmal || 0);
    const lstL = Math.floor(S.lohnsteuerJahr(laufend * 12, o, w) / 12 * 100 + 1e-6) / 100;
    const jl = p.jahresLaufend != null ? p.jahresLaufend : laufend * 12;
    let lstE = 0, soliE = 0;
    if (einmal > 0) {
      const mit = S.lohnsteuerJahr(jl + einmal, o, w), ohne = S.lohnsteuerJahr(jl, o, w);
      lstE = mit - ohne;
      soliE = S.soliJahr(mit, o, w) - S.soliJahr(ohne, o, w);
    }
    const lst = r2(lstL + lstE);
    const soli = r2(S.soliJahr(lstL * 12, o, w) / 12 + soliE);
    const kist = o.kirchensteuer ? r2(lst * o.kistSatz / 100) : 0;
    const svL = S.sv(laufend, o, w);
    let svE = { rv: 0, av: 0, kv: 0, pv: 0, summe: 0, basisRv: 0, basisKv: 0 };
    if (einmal > 0) {
      const m = p.monat || 12;
      const vor = p.svVorher || { rv: Math.min(laufend, w.bbgRvMonat) * (m - 1), kv: Math.min(laufend, w.bbgKvMonat) * (m - 1) };
      svE = S.sv(einmal, o, w, {
        rv: Math.max(0, w.bbgRvMonat * m - vor.rv - svL.basisRv),
        kv: Math.max(0, w.bbgKvMonat * m - vor.kv - svL.basisKv)
      });
    }
    const rv = r2(svL.rv + svE.rv), av = r2(svL.av + svE.av), kv = r2(svL.kv + svE.kv), pv = r2(svL.pv + svE.pv);
    const sv = r2(rv + av + kv + pv), brutto = r2(laufend + einmal), steuern = r2(lst + soli + kist);
    return {
      brutto: brutto, laufend: laufend, einmal: einmal,
      lst: lst, soli: soli, kist: kist, steuern: steuern,
      rv: rv, av: av, kv: kv, pv: pv, sv: sv,
      netto: r2(brutto - steuern - sv),
      basisRv: svL.basisRv + svE.basisRv, basisKv: svL.basisKv + svE.basisKv
    };
  };

  // Ganzes Jahr: monate = 12 Einträge {laufend, einmal}
  S.jahr = function (jahr, monate, o) {
    const jl = monate.reduce((s, m) => s + (m.laufend || 0), 0);
    const vor = { rv: 0, kv: 0 }, zeilen = [];
    const summen = { brutto: 0, lst: 0, soli: 0, kist: 0, steuern: 0, rv: 0, av: 0, kv: 0, pv: 0, sv: 0, netto: 0 };
    monate.forEach(function (m, i) {
      const a = S.abrechnung({ laufend: m.laufend, einmal: m.einmal, jahr: jahr, o: o, jahresLaufend: jl, svVorher: { rv: vor.rv, kv: vor.kv }, monat: i + 1 });
      vor.rv += a.basisRv; vor.kv += a.basisKv;
      for (const k in summen) summen[k] = r2(summen[k] + a[k]);
      zeilen.push(a);
    });
    return { zeilen: zeilen, summen: summen };
  };

  /* Schätzung der Einkommensteuererklärung.
     p: { jahr, o, brutto, lst, soli, kist, rv, av, kv, pv, werbungskosten, spenden } (Jahressummen)
     Liefert alle Zwischenschritte, damit die App sie anzeigen kann. */
  S.veranlagung = function (p) {
    const w = S.werte(p.jahr), o = p.o;
    const wkEchte = Math.max(0, p.werbungskosten || 0);
    const wk = Math.max(w.arbeitnehmerPauschbetrag, wkEchte);
    const kvpv = (p.kv || 0) * (1 - w.krankengeldKuerzung) + (p.pv || 0);
    const sonstVorsorge = Math.max(kvpv, Math.min(kvpv + (p.av || 0), w.vorsorgeSonstigeMax));
    const vorsorge = (p.rv || 0) + sonstVorsorge;
    const spenden = Math.max(0, p.spenden || 0);
    const rechne = function (kistAbzug) {
      const sa = Math.max(w.sonderausgabenPauschbetrag, kistAbzug + spenden);
      let zvE = p.brutto - wk - vorsorge - sa;
      if (o.steuerklasse === 2) zvE -= w.entlastungAlleinerziehend;
      zvE = Math.max(0, zvE);
      const est = S.est(zvE, w, o.steuerklasse === 3);
      return { sa: sa, zvE: Math.floor(zvE), est: est, soli: r2(S.soliJahr(est, o, w)), kist: o.kirchensteuer ? r2(est * o.kistSatz / 100) : 0 };
    };
    const mit = rechne(p.kist || 0), ohne = rechne(0);
    const erstLst = r2((p.lst || 0) - mit.est), erstSoli = r2((p.soli || 0) - mit.soli), erstKist = r2((p.kist || 0) - mit.kist);
    // Was die gezahlte Kirchensteuer als Sonderausgabe an Steuer spart
    const kistVorteil = r2((ohne.est - mit.est) + (ohne.soli - mit.soli) + (ohne.kist - mit.kist));
    return {
      w: w, wk: wk, wkEchte: wkEchte, wkPauschale: wk === w.arbeitnehmerPauschbetrag && wkEchte <= w.arbeitnehmerPauschbetrag,
      vorsorge: r2(vorsorge), sonderausgaben: mit.sa, zvE: mit.zvE,
      est: mit.est, soli: mit.soli, kist: mit.kist,
      erstLst: erstLst, erstSoli: erstSoli, erstKist: erstKist,
      erstattung: r2(erstLst + erstSoli + erstKist),
      kistVorteil: Math.max(0, kistVorteil),
      grenzsteuersatz: mit.zvE > 0 ? (S.est(mit.zvE + 100, w, o.steuerklasse === 3) - mit.est) / 100 : 0
    };
  };

  S.r2 = r2;
})(typeof window !== 'undefined' ? window : globalThis);
