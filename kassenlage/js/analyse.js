/* Auswertung: Monatszahlen, wiederkehrende Zahlungen, Prognose, Hinweise, Depots. */
(function (root) {
  'use strict';
  const FA = root.FA = root.FA || {};
  const U = FA.util, G = FA.gehalt;
  const A = FA.analyse = {};
  const r2 = U.r2;

  A.katTyp = function (st, id) {
    const k = (st.kategorien || []).find(x => x.id === id);
    return k ? k.typ : 'ausgabe';
  };
  // Art einer Buchung: die Markierung "Investition" zählt als Sparen, sonst entscheidet die Kategorie
  A.txTyp = (st, t) => t.marke === 'investition' ? 'sparen' : A.katTyp(st, t.kat);
  A.katName = function (st, id) {
    const k = (st.kategorien || []).find(x => x.id === id);
    return k ? k.name : 'Ohne Kategorie';
  };

  // Zahlen eines Monats. Rückerstattungen mindern die Ausgaben ihrer Kategorie.
  A.monat = function (st, ym) {
    const r = { ym: ym, ein: 0, aus: 0, spar: 0, proKat: {}, anzahl: 0, groesste: [] };
    for (const t of st.tx) {
      if (t.datum.slice(0, 7) !== ym) continue;
      const typ = A.txTyp(st, t);
      if (typ === 'neutral') continue;
      r.anzahl++;
      if (typ === 'sparen') r.spar -= t.betrag;
      else if (typ === 'einnahme') r.ein += t.betrag;
      else { r.aus -= t.betrag; r.proKat[t.kat] = (r.proKat[t.kat] || 0) - t.betrag; if (t.betrag < 0) r.groesste.push(t); }
    }
    r.ein = r2(r.ein); r.aus = r2(r.aus); r.spar = r2(r.spar);
    r.uebrig = r2(r.ein - r.aus - r.spar);
    r.groesste.sort((a, b) => a.betrag - b.betrag);
    r.groesste = r.groesste.slice(0, 5);
    return r;
  };

  A.monateMitDaten = function (st) {
    const s = new Set();
    for (const t of st.tx) s.add(t.datum.slice(0, 7));
    return Array.from(s).sort();
  };

  // Bis zu welchem Tag reichen die Kontodaten? Ohne Bankimport gilt heute (Handeingabe).
  A.datenBis = function (st, heute) {
    let bis = null, bank = false;
    for (const t of st.tx) if (t.quelle !== 'manuell') { bank = true; if (!bis || t.datum > bis) bis = t.datum; }
    if (!bank) return heute;
    return bis > heute ? heute : bis;
  };

  // Ausgaben je Woche (Montag bis Sonntag) innerhalb eines Monats
  A.wochen = function (st, ym) {
    const dim = U.tageImMonat(ym), wochen = [];
    let tag = 1;
    while (tag <= dim) {
      const von = ym + '-' + U.z2(tag);
      const wt = (U.wochentag(von) + 6) % 7; // 0 = Montag
      const ende = Math.min(dim, tag + (6 - wt));
      wochen.push({ von: von, bis: ym + '-' + U.z2(ende), summe: 0 });
      tag = ende + 1;
    }
    for (const t of st.tx) {
      if (t.datum.slice(0, 7) !== ym || A.txTyp(st, t) !== 'ausgabe') continue;
      const w = wochen.find(x => t.datum >= x.von && t.datum <= x.bis);
      if (w) w.summe -= t.betrag;
    }
    wochen.forEach(w => { w.summe = r2(w.summe); });
    return wochen;
  };

  /* Wiederkehrende Zahlungen: gleicher Empfänger, in mindestens drei Monaten, höchstens etwa einmal pro Monat,
     Beträge ähnlich, zuletzt innerhalb von 45 Tagen vor dem Datenstand. */
  A.wiederkehrend = function (st, bis) {
    const ab = U.plusTage(bis, -400), gruppen = new Map();
    for (const t of st.tx) {
      if (t.datum < ab || t.datum > bis) continue;
      const typ = A.txTyp(st, t);
      if (typ === 'neutral') continue;
      const key = (t.betrag < 0 ? '-' : '+') + U.schluessel(t);
      if (key.length < 3) continue;
      if (!gruppen.has(key)) gruppen.set(key, []);
      gruppen.get(key).push(t);
    }
    const liste = [];
    gruppen.forEach(function (g, key) {
      g.sort((a, b) => a.datum < b.datum ? -1 : 1);
      const monate = new Set(g.map(t => t.datum.slice(0, 7)));
      if (monate.size < 3 || g.length / monate.size > 1.34) return;
      const letzte = g[g.length - 1];
      if (U.tageZwischen(letzte.datum, bis) > 45) return;
      const sorted = Array.from(monate).sort();
      const spanne = (Number(sorted[sorted.length - 1].slice(0, 4)) - Number(sorted[0].slice(0, 4))) * 12 + Number(sorted[sorted.length - 1].slice(5, 7)) - Number(sorted[0].slice(5, 7)) + 1;
      if (monate.size / spanne < 0.6) return;
      const betraege = g.slice(-6).map(t => Math.abs(t.betrag));
      const med = U.median(betraege);
      if (!(med > 0)) return;
      const ausgabe = letzte.betrag < 0;
      if (ausgabe && (Math.max.apply(null, betraege) - Math.min.apply(null, betraege)) / med > 0.25) return;
      const letzte3 = g.slice(-3);
      const mittel = r2(letzte3.reduce((s, t) => s + t.betrag, 0) / letzte3.length);
      const vorher = g[g.length - 2];
      let aenderung = null;
      if (ausgabe && vorher) {
        const alt = Math.abs(vorher.betrag), neu = Math.abs(letzte.betrag);
        const stabilVorher = g.length < 3 || Math.abs(Math.abs(g[g.length - 3].betrag) - alt) < 0.005;
        if (stabilVorher && Math.abs(neu - alt) > 0.009 && Math.abs(neu - alt) / alt < 0.5) aenderung = { alt: alt, neu: neu };
      }
      liste.push({
        key: key, name: letzte.gegen || letzte.text || 'Unbekannt', betrag: letzte.betrag, mittel: mittel,
        tag: Math.round(U.median(g.map(t => Number(t.datum.slice(8, 10))))),
        anzahl: g.length, letzte: letzte.datum, kat: letzte.kat, typ: A.katTyp(st, letzte.kat), aenderung: aenderung
      });
    });
    liste.sort((a, b) => a.mittel - b.mittel);
    return liste;
  };

  // Durchschnitt der letzten bis zu drei vollen Monate vor ym (nur Monate mit Buchungen)
  A.schnitt = function (st, ym) {
    const r = { monate: 0, ein: 0, aus: 0, spar: 0, tage: 0, liste: [] };
    for (let i = 1; i <= 6 && r.monate < 3; i++) {
      const m = A.monat(st, U.ymPlus(ym, -i));
      if (m.anzahl < 5 || !(m.aus > 0)) continue; // nur Monate mit echten Kontodaten
      r.monate++; r.ein += m.ein; r.aus += m.aus; r.spar += m.spar; r.tage += U.tageImMonat(m.ym); r.liste.push(m);
    }
    if (r.monate) { r.ein = r2(r.ein / r.monate); r.aus = r2(r.aus / r.monate); r.spar = r2(r.spar / r.monate); }
    return r;
  };

  // Prognose für den laufenden Monat, mit allen Annahmen im Klartext.
  A.prognose = function (st, heute) {
    const ym = heute.slice(0, 7), dim = U.tageImMonat(ym);
    const ist = A.monat(st, ym);
    const bis = A.datenBis(st, heute);
    const standTag = !bis || bis < ym + '-01' ? 0 : (bis.slice(0, 7) === ym ? Number(bis.slice(8, 10)) : dim);
    const restTage = dim - standTag;
    const wk = A.wiederkehrend(st, bis && bis > ym + '-01' ? bis : heute);
    const gesehen = new Set();
    for (const t of st.tx) if (t.datum.slice(0, 7) === ym) gesehen.add((t.betrag < 0 ? '-' : '+') + U.schluessel(t));
    let fixOffen = 0, sparOffen = 0, einOffen = 0;
    const offen = [], hatPlan = G.hatGehalt(st);
    for (const w of wk) {
      if (gesehen.has(w.key)) continue;
      if (hatPlan && w.kat === 'gehalt') continue; // das Gehalt kommt aus den Gehaltsdaten, samt Einsätzen
      if (w.typ === 'sparen') { sparOffen -= w.mittel; offen.push(w); }
      else if (w.typ === 'einnahme') { einOffen += w.mittel; offen.push(w); }
      else if (w.mittel < 0) { fixOffen -= w.mittel; offen.push(w); }
    }
    // Feste Zahlungen aus den Vormonaten herausrechnen, der Rest sind "variable" Ausgaben pro Tag
    const s = A.schnitt(st, ym);
    const fixMonat = wk.filter(w => w.typ === 'ausgabe' && w.mittel < 0).reduce((x, w) => x - w.mittel, 0);
    const varTag = s.monate ? Math.max(0, (s.aus - fixMonat)) / (s.tage / s.monate) : 0;
    const varRest = r2(varTag * restTage);
    const annahmen = [];
    let gehaltGeplant = 0;
    const gehaltDa = st.tx.some(t => t.datum.slice(0, 7) === ym && t.kat === 'gehalt' && t.betrag > 0);
    if (!gehaltDa && hatPlan) {
      const pm = G.planMonat(st, ym);
      if (pm.datum > (bis || '')) { gehaltGeplant = pm.auszahlung; einOffen += pm.auszahlung; annahmen.push('Gehalt am ' + U.datumDE(pm.datum) + ' laut deinen Gehaltsdaten: ' + U.eur(pm.auszahlung) + '.'); }
    }
    if (standTag > 0 && standTag < dim) annahmen.push('Kontodaten bis ' + U.datumDE(bis) + '. Für die restlichen ' + restTage + ' Tage rechne ich mit dem Durchschnitt.');
    if (standTag === 0 && st.tx.length) annahmen.push('Für diesen Monat gibt es noch keine Buchungen. Alles ist geschätzt.');
    if (s.monate) annahmen.push('Übliche Ausgaben ohne feste Zahlungen: ' + U.eur(varTag) + ' pro Tag (Durchschnitt aus ' + s.monate + (s.monate === 1 ? ' Monat' : ' Monaten') + ').');
    else if (st.tx.length) annahmen.push('Es fehlen volle Vormonate, deshalb gibt es noch keinen Durchschnitt für die restlichen Tage.');
    if (offen.length) annahmen.push('Noch erwartet in diesem Monat: ' + offen.map(w => w.name + ' (' + U.eur(w.mittel) + ')').join(', ') + '.');
    const ein = r2(ist.ein + einOffen), aus = r2(ist.aus + fixOffen + varRest), spar = r2(ist.spar + sparOffen);
    return {
      ym: ym, ist: ist, standTag: standTag, restTage: restTage, datenBis: bis,
      einOffen: r2(einOffen), fixOffen: r2(fixOffen), varRest: varRest, sparOffen: r2(sparOffen), varTag: varTag,
      ein: ein, aus: aus, spar: spar, uebrig: r2(ein - aus - spar),
      offen: offen, wiederkehrend: wk, annahmen: annahmen, gehaltGeplant: gehaltGeplant, schnitt: s
    };
  };

  // Aktueller Kontostand aus dem eingetragenen Stand plus allen Buchungen danach
  A.kontostand = st => FA.vermoegen.kontoStand(st, U.heute());

  // Vorschau auf die nächsten Monate
  A.vorschau = function (st, heute, anzahl) {
    const ym = heute.slice(0, 7), p = A.prognose(st, heute), s = p.schnitt;
    const zeilen = [];
    let konto = A.kontostand(st);
    if (konto != null) konto = r2(konto + p.einOffen - p.fixOffen - p.varRest - p.sparOffen);
    const kontoMonatsende = konto;
    for (let i = 1; i <= anzahl; i++) {
      const m = U.ymPlus(ym, i);
      let ein = null, quelle = '';
      if (G.hatGehalt(st)) { const pm = G.planMonat(st, m); ein = pm.auszahlung; quelle = pm.zusatz > 0 || pm.spesen > 0 ? 'Gehalt mit Einsatz' : 'Gehalt'; }
      else if (s.monate) { ein = s.ein; quelle = 'Durchschnitt'; }
      const aus = s.monate ? s.aus : null, spar = s.monate ? s.spar : 0;
      const saldo = (ein != null && aus != null) ? r2(ein - aus - spar) : null;
      if (konto != null && saldo != null) konto = r2(konto + saldo); else konto = null;
      zeilen.push({ ym: m, ein: ein, aus: aus, spar: spar, saldo: saldo, konto: konto, quelle: quelle });
    }
    return { zeilen: zeilen, kontoMonatsende: kontoMonatsende, monate: s.monate };
  };

  // Hinweise für die Übersicht
  A.hinweise = function (st, heute, p) {
    const h = [], ym = heute.slice(0, 7);
    const gehalt = st.tx.filter(t => t.datum.slice(0, 7) === ym && t.kat === 'gehalt' && t.betrag > 0);
    if (gehalt.length) {
      const g = gehalt[gehalt.length - 1];
      h.push({ typ: 'gehalt', art: 'gut', text: 'Gehalt am ' + U.datumDE(g.datum) + ' eingegangen: ' + U.eur(gehalt.reduce((s, t) => s + t.betrag, 0)) + '.' });
    } else if (G.hatGehalt(st)) {
      const pm = G.planMonat(st, ym);
      h.push({ typ: 'gehalt', art: 'info', text: 'Gehalt erwartet am ' + U.datumDE(pm.datum) + ': etwa ' + U.eur(pm.auszahlung) + (pm.zusatz > 0 || pm.spesen > 0 ? ' (mit Einsatz ' + pm.einsaetze.join(', ') + ')' : '') + '.' });
    }
    // Ungewöhnlich hohe Einzelausgaben der letzten 30 Tage im Vergleich zur Kategorie
    const bis = p.datenBis || heute, ab30 = U.plusTage(bis, -30), ab200 = U.plusTage(bis, -210);
    const proKat = {};
    for (const t of st.tx) if (t.betrag < 0 && t.datum >= ab200 && t.datum < ab30 && A.txTyp(st, t) === 'ausgabe') (proKat[t.kat] = proKat[t.kat] || []).push(-t.betrag);
    const fixKeys = new Set(p.wiederkehrend.map(w => w.key));
    const hoch = [], alle = [];
    for (const t of st.tx) if (t.betrag < 0 && t.datum >= ab200 && t.datum < ab30 && A.txTyp(st, t) === 'ausgabe' && !fixKeys.has('-' + U.schluessel(t))) alle.push(-t.betrag);
    for (const t of st.tx) {
      if (t.betrag >= 0 || t.datum < ab30 || t.datum > bis || A.txTyp(st, t) !== 'ausgabe') continue;
      if (fixKeys.has('-' + U.schluessel(t))) continue;
      const alt = proKat[t.kat];
      if (alt && alt.length >= 4) {
        const mittel = alt.reduce((s, x) => s + x, 0) / alt.length;
        if (-t.betrag > 50 && -t.betrag > 2.5 * mittel) hoch.push({ t: t, mittel: mittel, kat: true });
      } else if (alle.length >= 8) {
        const mittel = alle.reduce((s, x) => s + x, 0) / alle.length;
        if (-t.betrag > 100 && -t.betrag > 3 * mittel) hoch.push({ t: t, mittel: mittel, kat: false });
      }
    }
    hoch.sort((a, b) => a.t.betrag - b.t.betrag);
    hoch.slice(0, 3).forEach(x => h.push({ typ: 'hoch', art: 'warn', text: 'Ungewöhnlich hoch: ' + (x.t.gegen || x.t.text) + ' am ' + U.datumDE(x.t.datum) + ' mit ' + U.eur(-x.t.betrag) + '. ' + (x.kat ? 'Üblich sind in „' + A.katName(st, x.t.kat) + '“ etwa ' : 'Deine Ausgaben liegen sonst im Schnitt bei ') + U.eur(x.mittel) + ' pro Buchung.' }));
    // Laufende Woche gegen den Wochenschnitt
    if (p.schnitt.monate && p.standTag > 0) {
      const wochen = A.wochen(st, ym);
      const w = wochen.find(x => bis >= x.von && bis <= x.bis);
      const wochenSchnitt = p.schnitt.aus / (p.schnitt.tage / p.schnitt.monate) * 7;
      const fixMonat = p.wiederkehrend.filter(x => x.typ === 'ausgabe' && x.mittel < 0).reduce((s, x) => s - x.mittel, 0);
      const varWoche = Math.max(0, wochenSchnitt - fixMonat / 4.35);
      if (w && varWoche > 0) {
        let varDieseWoche = 0;
        for (const t of st.tx) if (t.datum >= w.von && t.datum <= w.bis && A.txTyp(st, t) === 'ausgabe' && !fixKeys.has((t.betrag < 0 ? '-' : '+') + U.schluessel(t))) varDieseWoche -= t.betrag;
        if (varDieseWoche > 1.3 * varWoche && varDieseWoche - varWoche > 40) h.push({ typ: 'hoch', art: 'warn', text: 'Diese Woche hast du ' + U.eur(varDieseWoche) + ' ausgegeben. Üblich sind etwa ' + U.eur(varWoche) + ' pro Woche (ohne feste Zahlungen).' });
      }
    }
    p.wiederkehrend.filter(w => w.aenderung).forEach(w => h.push({ art: 'info', text: 'Preis geändert: ' + w.name + ' kostet jetzt ' + U.eur(w.aenderung.neu) + ' statt ' + U.eur(w.aenderung.alt) + '.' }));
    // Datenstand und Sicherung
    const hatBank = st.tx.some(t => t.quelle !== 'manuell');
    if (hatBank && p.datenBis && U.tageZwischen(p.datenBis, heute) > 10) h.push({ art: 'info', text: 'Die Kontodaten reichen bis ' + U.datumDE(p.datenBis) + '. Ein neuer Import bringt die Übersicht auf Stand.', akt: 'import' });
    const sich = st.meta && st.meta.sicherung;
    if (st.tx.length + (st.einsaetze || []).length > 0 && !st.demo && (!sich || U.tageZwischen(sich.slice(0, 10), heute) > 30)) h.push({ art: 'info', text: sich ? 'Die letzte Sicherung ist vom ' + U.datumDE(sich.slice(0, 10)) + '.' : 'Es gibt noch keine Sicherung deiner Daten.', akt: 'sicherung' });
    return h;
  };

  // Trade Republic: Zusammenfassung der importierten Buchungen
  A.depotTr = function (st) {
    const b = ((st.depots || {}).tr || {}).buchungen || [];
    const r = { anzahl: b.length, eingezahlt: 0, ausgezahlt: 0, kaeufe: 0, verkaeufe: 0, dividenden: 0, zinsen: 0, gebuehren: 0, steuern: 0, karte: 0, bonus: 0, realisiert: 0, sparplanMonat: 0, sparplanAnzahl: 0, positionen: [], sonst: 0, von: null, bis: null };
    const pos = {};
    const sortiert = b.slice().sort((x, y) => x.datum < y.datum ? -1 : x.datum > y.datum ? 1 : 0);
    const sparMonate = {};
    for (const x of sortiert) {
      if (!r.von || x.datum < r.von) r.von = x.datum;
      if (!r.bis || x.datum > r.bis) r.bis = x.datum;
      if (x.art === 'storniert' || x.art === 'massnahme') continue;
      r.gebuehren += Math.abs(x.gebuehr || 0);
      r.steuern -= x.steuer || 0;
      if (x.art === 'einzahlung') r.eingezahlt += x.betrag;
      else if (x.art === 'auszahlung') r.ausgezahlt -= x.betrag;
      else if (x.art === 'dividende') r.dividenden += x.betrag;
      else if (x.art === 'zinsen') r.zinsen += x.betrag;
      else if (x.art === 'karte') r.karte -= x.betrag;
      else if (x.art === 'bonus') r.bonus += x.betrag;
      else if (x.art === 'steuer') r.steuern -= x.betrag;
      else if (x.art === 'gebuehr') r.gebuehren -= x.betrag;
      else if (x.art === 'kauf' || x.art === 'sparplan' || x.art === 'verkauf') {
        const key = x.isin || x.name || '?';
        const p = pos[key] || (pos[key] = { isin: x.isin, name: x.name || x.isin || 'Unbekannt', stueck: 0, kosten: 0, realisiert: 0 });
        if (x.name) p.name = x.name;
        const stueck = Math.abs(x.stueck || 0);
        if (x.art === 'verkauf') {
          const erloes = Math.abs(x.betrag) - Math.abs(x.gebuehr || 0);
          r.verkaeufe += Math.abs(x.betrag);
          const schnitt = p.stueck > 0 ? p.kosten / p.stueck : 0;
          const menge = Math.min(stueck, p.stueck);
          p.realisiert += erloes - schnitt * menge;
          p.kosten -= schnitt * menge; p.stueck -= menge;
        } else {
          const kosten = Math.abs(x.betrag) + Math.abs(x.gebuehr || 0);
          r.kaeufe += Math.abs(x.betrag);
          p.kosten += kosten; p.stueck += stueck;
          if (x.art === 'sparplan') { r.sparplanAnzahl++; sparMonate[x.datum.slice(0, 7)] = (sparMonate[x.datum.slice(0, 7)] || 0) + Math.abs(x.betrag); }
        }
      } else r.sonst++;
    }
    for (const k in pos) {
      const p = pos[k];
      r.realisiert += p.realisiert;
      if (p.stueck > 1e-6) r.positionen.push({ isin: p.isin, name: p.name, stueck: p.stueck, kosten: r2(p.kosten), schnitt: p.kosten / p.stueck });
    }
    r.positionen.sort((x, y) => y.kosten - x.kosten);
    r.investiert = r2(r.positionen.reduce((s, p) => s + p.kosten, 0));
    const sm = Object.keys(sparMonate).sort().slice(-3);
    r.sparplanMonat = sm.length ? r2(sm.reduce((s, m) => s + sparMonate[m], 0) / sm.length) : 0;
    ['eingezahlt', 'ausgezahlt', 'kaeufe', 'verkaeufe', 'dividenden', 'zinsen', 'gebuehren', 'steuern', 'karte', 'bonus', 'realisiert'].forEach(k => { r[k] = r2(r[k]); });
    const werte = ((st.depots || {}).tr || {}).werte || [];
    r.wert = werte.length ? werte[werte.length - 1] : null;
    r.gewinn = r.wert ? r2(r.wert.wert - r.investiert) : null;
    return r;
  };

  // Scalable Capital: Sparpläne werden aus Betrag, Tag und Start hochgerechnet
  A.depotSc = function (st, heute) {
    const d = (st.depots || {}).sc || {};
    const r = { plaene: [], eingezahlt: 0, sparplanMonat: 0 };
    for (const p of d.sparplaene || []) {
      if (!p.start || !(p.betrag > 0)) continue;
      const ende = p.ende && p.ende < heute ? p.ende : heute;
      const tag = p.tag > 0 ? p.tag : 1;
      let ym = p.start.slice(0, 7), n = 0, schutz = 0;
      while (schutz++ < 600) {
        const dim = U.tageImMonat(ym);
        const datum = ym + '-' + U.z2(Math.min(tag, dim));
        if (datum > ende) break;
        if (datum >= p.start) n++;
        ym = U.ymPlus(ym, 1);
      }
      const summe = r2(n * p.betrag), aktiv = !p.ende || p.ende >= heute;
      r.plaene.push({ id: p.id, name: p.name, betrag: p.betrag, tag: tag, start: p.start, ende: p.ende, ausfuehrungen: n, summe: summe, aktiv: aktiv });
      r.eingezahlt += summe;
      if (aktiv) r.sparplanMonat += p.betrag;
    }
    for (const e of d.einzel || []) r.eingezahlt += e.betrag || 0;
    r.einzel = d.einzel || [];
    r.eingezahlt = r2(r.eingezahlt);
    const werte = d.werte || [];
    r.wert = werte.length ? werte[werte.length - 1] : null;
    r.gewinn = r.wert ? r2(r.wert.wert - r.eingezahlt) : null;
    return r;
  };
})(typeof window !== 'undefined' ? window : globalThis);
