/* CSV-Import (Sparkasse und andere Banken, Trade Republic) und automatische Kategorien. */
(function (root) {
  'use strict';
  const FA = root.FA = root.FA || {};
  const U = FA.util;
  const I = FA.import = {};
  const r2 = U.r2;

  I.STANDARD_KATEGORIEN = [
    { id: 'wohnen', name: 'Miete / Nebenkosten', typ: 'ausgabe' },
    { id: 'lebensmittel', name: 'Lebensmittel', typ: 'ausgabe' },
    { id: 'restaurant', name: 'Restaurant / Ausgehen', typ: 'ausgabe' },
    { id: 'transport', name: 'Auto / Transport', typ: 'ausgabe' },
    { id: 'abos', name: 'Abos / Verträge', typ: 'ausgabe' },
    { id: 'versicherung', name: 'Versicherungen', typ: 'ausgabe' },
    { id: 'shopping', name: 'Shopping', typ: 'ausgabe' },
    { id: 'gesundheit', name: 'Gesundheit', typ: 'ausgabe' },
    { id: 'reisen', name: 'Reisen', typ: 'ausgabe' },
    { id: 'einsatz', name: 'Serviceeinsatz (Auslagen)', typ: 'ausgabe' },
    { id: 'bargeld', name: 'Bargeld', typ: 'ausgabe' },
    { id: 'sonstiges', name: 'Sonstiges', typ: 'ausgabe' },
    { id: 'gehalt', name: 'Gehalt', typ: 'einnahme' },
    { id: 'spesen', name: 'Spesen / Reisekosten', typ: 'einnahme' },
    { id: 'einnahme', name: 'Sonstige Einnahmen', typ: 'einnahme' },
    { id: 'sparen', name: 'Sparen / Investieren', typ: 'sparen' },
    { id: 'umbuchung', name: 'Umbuchung (zählt nicht mit)', typ: 'neutral' }
  ];

  // Stichworte für Ausgaben. Reihenfolge zählt: die erste passende Zeile gewinnt.
  const STICHWORTE = [
    ['sparen', ['trade republic', 'scalable', 'baader bank', 'sparplan', 'flatex', 'tagesgeld', 'wertpapier']],
    ['wohnen', ['miete', 'nebenkosten', 'hausverwaltung', 'stadtwerke', 'strom', 'enbw', 'e.on', 'vattenfall', 'badenova', 'e-werk', 'rundfunk', 'ard zdf', 'abfall', 'abwasser', 'hausgeld', 'heizung']],
    ['lebensmittel', ['rewe', 'edeka', 'lidl', 'aldi', 'kaufland', 'penny', 'netto', 'norma', 'globus', 'hieber', 'baeckerei', 'bäckerei', 'metzgerei', 'dm-drogerie', 'dm drogerie', 'rossmann', 'getraenke', 'getränke', 'supermarkt', 'mercadona', 'carrefour', 'eroski']],
    ['restaurant', ['restaurant', 'gasthaus', 'gasthof', 'mcdonald', 'burger king', 'subway', 'lieferando', 'pizza', 'doener', 'döner', 'cafe', 'café', 'biergarten', 'kfc', 'imbiss', 'bistro']],
    ['transport', ['tankstelle', 'aral', 'shell', 'esso', 'totalenergies', 'total energies', 'jet tank', 'agip', 'avia', 'omv', 'db vertrieb', 'deutsche bahn', 'flixbus', 'kfz', 'werkstatt', 'a.t.u', 'tuev', 'tüv', 'parken', 'parkhaus', 'maut', 'adac', 'ionity', 'repsol', 'cepsa']],
    ['abos', ['netflix', 'spotify', 'disney', 'amazon prime', 'prime video', 'apple.com/bill', 'youtube', 'dazn', 'wow tv', 'audible', 'telekom', 'vodafone', 'telefonica', '1&1', 'congstar', 'fitness', 'mcfit', 'clever fit', 'icloud', 'google one', 'microsoft', 'adobe', 'playstation', 'xbox', 'nintendo', ' abo ']],
    ['versicherung', ['versicherung', 'allianz', 'huk', 'ergo', 'axa', 'debeka', 'wgv', 'devk', 'signal iduna', 'generali', 'r+v', 'haftpflicht']],
    ['gesundheit', ['apotheke', 'arzt', 'praxis', 'zahnarzt', 'klinik', 'physio', 'optik', 'fielmann']],
    ['reisen', ['booking', 'airbnb', 'hotel', 'ryanair', 'lufthansa', 'eurowings', 'easyjet', 'iberia', 'vueling', 'expedia', 'hostel', 'sixt', 'europcar', 'hertz', 'renfe']],
    ['shopping', ['amazon', 'zalando', 'mediamarkt', 'media markt', 'saturn', 'ikea', 'h&m', 'ebay', 'kleinanzeigen', 'decathlon', 'bauhaus', 'hornbach', 'toom', 'conrad', 'reichelt', 'about you', 'thalia', 'paypal']],
    ['bargeld', ['geldautomat', 'bargeld', 'auszahlung ga', 'ga nr']]
  ];
  const EINNAHMEN = [
    ['gehalt', ['lohn', 'gehalt', 'bezuege', 'bezüge', 'entgelt', 'verguetung', 'vergütung']],
    ['spesen', ['spesen', 'reisekosten', 'auslagen']]
  ];

  // Kategorie einer Buchung: erst eigene Regeln, dann Stichworte, sonst "Sonstiges".
  I.kategorie = function (t, regeln) {
    const key = U.schluessel(t);
    for (const r of regeln || []) if (r.muster && r.muster === key) return r.kat;
    const hay = ' ' + U.norm([t.gegen, t.text, t.art].join(' ')) + ' ';
    const liste = t.betrag >= 0 ? EINNAHMEN : STICHWORTE;
    for (const [kat, worte] of liste) for (const w of worte) if (hay.indexOf(w) > -1) return kat;
    if (t.betrag >= 0) {
      // Rückbuchung vom Depot oder Erstattung eines Händlers bleibt bei der Ausgaben-Kategorie
      for (const [kat, worte] of STICHWORTE) for (const w of worte) if (hay.indexOf(w) > -1) return kat;
      return 'einnahme';
    }
    return 'sonstiges';
  };

  // Datei lesen: UTF-8, sonst Windows-Zeichensatz (Sparkassen-Export).
  I.dekodieren = function (buf) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch (e) { return new TextDecoder('windows-1252').decode(buf); }
  };

  I.csv = function (text) {
    text = String(text).replace(/^﻿/, '');
    const probe = text.slice(0, 5000);
    const zaehle = function (c) { let z = 0, q = false; for (const ch of probe) { if (ch === '"') q = !q; else if (ch === c && !q) z++; } return z; };
    const kand = [';', ',', '\t'].map(c => [c, zaehle(c)]).sort((a, b) => b[1] - a[1]);
    const tr = kand[0][1] > 0 ? kand[0][0] : ';';
    const zeilen = [];
    let zeile = [], feld = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { feld += '"'; i++; } else q = false; }
        else feld += ch;
      } else if (ch === '"') q = true;
      else if (ch === tr) { zeile.push(feld); feld = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        zeile.push(feld); feld = '';
        if (zeile.length > 1 || zeile[0].trim() !== '') zeilen.push(zeile);
        zeile = [];
      } else feld += ch;
    }
    if (feld !== '' || zeile.length) { zeile.push(feld); if (zeile.length > 1 || zeile[0].trim() !== '') zeilen.push(zeile); }
    return { zeilen: zeilen, trenner: tr };
  };

  I.datum = function (v) {
    const s = String(v || '').trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2}|\d{4})$/);
    if (m) {
      const y = m[3].length === 2 ? (Number(m[3]) > 70 ? '19' : '20') + m[3] : m[3];
      const mo = Number(m[2]), d = Number(m[1]);
      if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
      return y + '-' + U.z2(mo) + '-' + U.z2(d);
    }
    return null;
  };

  const kopfNorm = s => String(s).toLowerCase().trim().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/["']/g, '').replace(/\s+/g, ' ');
  const SPALTEN = {
    datum: ['buchungstag', 'buchungsdatum', 'buchung', 'datum', 'date', 'wertstellung', 'valutadatum', 'valuta'],
    betrag: ['betrag', 'umsatz', 'amount', 'betrag (eur)', 'betrag in eur', 'betrag eur'],
    text: ['verwendungszweck', 'beschreibung', 'description', 'buchungsdetails', 'notiz', 'reference'],
    gegen: ['beguenstigter/zahlungspflichtiger', 'name zahlungsbeteiligter', 'zahlungsbeteiligter', 'empfaenger/auftraggeber', 'auftraggeber/empfaenger', 'beguenstigter', 'empfaenger', 'auftraggeber', 'gegenpartei', 'name', 'counterparty', 'payee'],
    art: ['buchungstext', 'umsatzart', 'buchungsart', 'type', 'typ'],
    info: ['info', 'status'],
    soll: ['soll'], haben: ['haben']
  };
  function finde(kopf, namen) {
    for (const nm of namen) { const i = kopf.indexOf(nm); if (i > -1) return i; }
    for (const nm of namen) { const i = kopf.findIndex(h => h.indexOf(nm) === 0); if (i > -1) return i; }
    return -1;
  }
  function zuordnen(kopf) {
    const sp = {};
    for (const k in SPALTEN) sp[k] = finde(kopf, SPALTEN[k]);
    if (sp.datum < 0) return null;
    if (sp.betrag < 0 && !(sp.soll > -1 && sp.haben > -1)) return null;
    return sp;
  }

  I.istTr = kopf => kopf.indexOf('transaction_id') > -1 || (kopf.indexOf('category') > -1 && kopf.indexOf('shares') > -1 && kopf.indexOf('amount') > -1);

  // Erkennt, was für eine Datei es ist.
  I.erkennen = function (text) {
    const zeilen = I.csv(text).zeilen;
    if (!zeilen.length) return 'leer';
    if (I.istTr(zeilen[0].map(kopfNorm))) return 'tr';
    for (let i = 0; i < Math.min(zeilen.length, 25); i++) if (zuordnen(zeilen[i].map(kopfNorm))) return 'bank';
    return 'unbekannt';
  };

  const sauber = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

  // Kontoumsätze einer Bank. vorhandene = Menge der schon gespeicherten Schlüssel (für Dubletten).
  I.bank = function (text, quelle, vorhandene) {
    const zeilen = I.csv(text).zeilen;
    let ki = -1, sp = null;
    for (let i = 0; i < Math.min(zeilen.length, 25); i++) {
      const s = zuordnen(zeilen[i].map(kopfNorm));
      if (s) { ki = i; sp = s; break; }
    }
    if (ki < 0) return { fehler: 'kopf', kopf: zeilen[0] || [] };
    const res = { neu: [], doppelt: 0, uebersprungen: 0, vorgemerkt: 0, von: null, bis: null, gelesen: 0 };
    const zaehler = {};
    for (let i = ki + 1; i < zeilen.length; i++) {
      const z = zeilen[i];
      const datum = I.datum(z[sp.datum]);
      let betrag;
      if (sp.betrag > -1) betrag = U.zahl(z[sp.betrag]);
      else betrag = (U.zahlOder(z[sp.haben], 0)) - Math.abs(U.zahlOder(z[sp.soll], 0));
      if (!datum || isNaN(betrag)) { res.uebersprungen++; continue; }
      if (sp.info > -1 && /vorgemerkt/i.test(z[sp.info] || '')) { res.vorgemerkt++; continue; }
      res.gelesen++;
      const t = {
        datum: datum, betrag: r2(betrag),
        text: sp.text > -1 ? sauber(z[sp.text]) : '',
        gegen: sp.gegen > -1 ? sauber(z[sp.gegen]) : '',
        art: sp.art > -1 ? sauber(z[sp.art]) : '',
        quelle: quelle
      };
      if (!t.text && t.art) t.text = t.art;
      let key = [quelle, datum, t.betrag.toFixed(2), U.norm(t.gegen), U.norm(t.text)].join('|');
      zaehler[key] = (zaehler[key] || 0) + 1;
      key += '#' + zaehler[key];
      if (!res.von || datum < res.von) res.von = datum;
      if (!res.bis || datum > res.bis) res.bis = datum;
      if (vorhandene && vorhandene.has(key)) { res.doppelt++; continue; }
      t.key = key; t.id = U.uid() + i;
      res.neu.push(t);
    }
    return res;
  };

  // Art einer Trade-Republic-Buchung aus Kategorie, Typ und Vorzeichen.
  function trArt(kat, typ, betrag, stueck) {
    const K = String(kat || '').toUpperCase(), T = String(typ || '').toUpperCase();
    if (/CANCEL|STORNO/.test(T)) return 'storniert';
    if (K === 'CORPORATE_ACTION') return 'massnahme';
    if (K === 'TRADING') {
      if (/SELL|TILG|REDEMPTION/.test(T)) return 'verkauf';
      if (/SAVINGS|SPARPLAN|SAVEBACK|ROUND/.test(T)) return 'sparplan';
      if (/BUY/.test(T)) return 'kauf';
      return (stueck < 0 || betrag > 0) ? 'verkauf' : 'kauf';
    }
    if (/DIVIDEND|EARNINGS|COUPON|DISTRIBUTION/.test(T)) return 'dividende';
    if (/INTEREST|ZINS/.test(T)) return 'zinsen';
    if (/CARD|KARTE/.test(T)) return 'karte';
    if (/TAX|STEUER|PRE_DETERMINED/.test(T)) return 'steuer';
    if (/FEE|GEBUEHR/.test(T)) return 'gebuehr';
    if (/SAVEBACK|BONUS|GIFT|REFERRAL/.test(T)) return 'bonus';
    if (/DEPOSIT|PAYIN|PAY_IN|INBOUND|INCOMING|TRANSFER|PAYOUT|PAY_OUT|WITHDRAW|OUTBOUND|OUTGOING|SEPA|DEBIT|CREDIT/.test(T)) return betrag >= 0 ? 'einzahlung' : 'auszahlung';
    return 'sonst';
  }
  I.trArt = trArt;

  // Offizieller Transaktionsexport von Trade Republic (seit April 2026): Komma oder Semikolon, Dezimalpunkt.
  I.tr = function (text, vorhandeneIds) {
    const zeilen = I.csv(text).zeilen;
    if (!zeilen.length) return { fehler: 'leer' };
    const kopf = zeilen[0].map(kopfNorm);
    const c = nm => kopf.indexOf(nm);
    const ix = {
      datum: c('date') > -1 ? c('date') : c('datetime'), kat: c('category'), typ: c('type'), name: c('name'),
      isin: c('symbol') > -1 ? c('symbol') : c('isin'), stueck: c('shares'), kurs: c('price'),
      betrag: c('amount'), gebuehr: c('fee'), steuer: c('tax'), id: c('transaction_id'), konto: c('account_type')
    };
    if (ix.datum < 0 || ix.betrag < 0 || ix.typ < 0) return { fehler: 'kopf', kopf: zeilen[0] };
    const num = function (v) {
      const s = String(v == null ? '' : v).trim();
      if (!s) return 0;
      const x = Number(s);
      if (!isNaN(x)) return x;
      const y = U.zahl(s);
      return isNaN(y) ? 0 : y;
    };
    const hol = (z, i) => (i > -1 && z[i] != null) ? sauber(z[i]) : '';
    const res = { neu: [], doppelt: 0, uebersprungen: 0, von: null, bis: null, gelesen: 0, unbekannt: {} };
    const zaehler = {};
    for (let i = 1; i < zeilen.length; i++) {
      const z = zeilen[i];
      const datum = I.datum(z[ix.datum]);
      if (!datum) { res.uebersprungen++; continue; }
      res.gelesen++;
      const betrag = num(z[ix.betrag]), stueck = num(hol(z, ix.stueck));
      const b = {
        datum: datum, kat: hol(z, ix.kat), typ: hol(z, ix.typ), name: hol(z, ix.name), isin: hol(z, ix.isin),
        stueck: stueck, kurs: num(hol(z, ix.kurs)), betrag: betrag, gebuehr: num(hol(z, ix.gebuehr)), steuer: num(hol(z, ix.steuer)),
        konto: hol(z, ix.konto)
      };
      b.art = trArt(b.kat, b.typ, betrag, stueck);
      if (b.art === 'sonst') res.unbekannt[b.typ || '(leer)'] = (res.unbekannt[b.typ || '(leer)'] || 0) + 1;
      let id = hol(z, ix.id);
      if (!id) {
        id = ['tr', datum, betrag, b.typ, b.isin, stueck].join('|');
        zaehler[id] = (zaehler[id] || 0) + 1;
        id += '#' + zaehler[id];
      }
      b.id = id;
      if (!res.von || datum < res.von) res.von = datum;
      if (!res.bis || datum > res.bis) res.bis = datum;
      if (vorhandeneIds && vorhandeneIds.has(id)) { res.doppelt++; continue; }
      res.neu.push(b);
    }
    return res;
  };
})(typeof window !== 'undefined' ? window : globalThis);
