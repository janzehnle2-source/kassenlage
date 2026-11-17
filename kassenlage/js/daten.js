/* Speicher: alles bleibt im Browser dieses Geräts (IndexedDB), auf Wunsch verschlüsselt.
   Dazu: verschlüsselte Sicherungsdatei und Beispieldaten. */
(function (root) {
  'use strict';
  const FA = root.FA = root.FA || {};
  const U = FA.util;
  const D = FA.daten = {};
  const DB = 'kassenlage', STORE = 'kv', KEY = 'daten', LS = 'kassenlage-daten';
  const RUNDEN = 250000;

  let modus = 'idb';      // 'idb' | 'ls' | 'mem'
  let schluessel = null;  // { key, salt } wenn die App-Sperre aktiv ist
  let timer = null;
  D.state = null;
  D.modus = () => modus;
  D.gesperrtAktiv = () => !!schluessel;
  D.kryptoDa = () => !!(root.crypto && root.crypto.subtle);

  D.neu = function () {
    return {
      v: 1, eingerichtet: false, demo: false,
      steuer: { steuerklasse: 1, kirchensteuer: false, bundesland: '', kvZusatz: null, kinder: 0, kinderlosZuschlag: true },
      arbeit: { wochenstunden: 40, stundensatz: null, gehaltstag: 0, zuschlagInland: 0, zuschlagAusland: 0, stdWerktag: 8, stdSamstag: 0, stdSonntag: 0, ueberstundenZuschlag: 0, verzugMonate: 0, nettoAbzug: 0, wegKm: 0, wegKosten: 0 },
      gehalt: [],
      konten: [{ id: 'giro', name: 'Girokonto', art: 'giro', staende: [] }],
      budgets: {}, sparziele: [],
      einstellungen: { thema: 'system', hinweisGehalt: true, hinweisHoch: true },
      erstattung: { km: 0, tage: 0, weitereWk: 0, spenden: 0 },
      kategorien: JSON.parse(JSON.stringify(FA.import.STANDARD_KATEGORIEN)),
      regeln: [], tx: [], einsaetze: [],
      depots: { tr: { buchungen: [], werte: [], guthaben: [] }, sc: { sparplaene: [], einzel: [], werte: [] } },
      meta: { importe: {}, sicherung: null }
    };
  };

  // Füllt fehlende Felder auf, damit alte Sicherungen mit neueren Versionen funktionieren.
  D.normalisieren = function (s) {
    const n = D.neu();
    if (!s || typeof s !== 'object') return n;
    for (const k of ['steuer', 'arbeit', 'erstattung', 'meta', 'einstellungen']) s[k] = Object.assign({}, n[k], s[k] || {});
    if (!Array.isArray(s.konten)) s.konten = [];
    if (!s.konten.some(k => k.id === 'giro')) s.konten.unshift({ id: 'giro', name: 'Girokonto', art: 'giro', staende: [] });
    for (const k of s.konten) if (!Array.isArray(k.staende)) k.staende = [];
    // Ältere Fassung: ein einzelner Kontostand
    if (s.konto && s.konto.stand != null && s.konto.stand !== '' && s.konto.datum) { const giro = s.konten.find(k => k.id === 'giro'); if (!giro.staende.length) giro.staende.push({ datum: s.konto.datum, wert: Number(s.konto.stand) }); }
    delete s.konto;
    if (!s.budgets || typeof s.budgets !== 'object') s.budgets = {};
    if (!Array.isArray(s.sparziele)) s.sparziele = [];
    for (const k of ['gehalt', 'regeln', 'tx', 'einsaetze']) if (!Array.isArray(s[k])) s[k] = [];
    if (!Array.isArray(s.kategorien) || !s.kategorien.length) s.kategorien = n.kategorien;
    s.depots = s.depots || {};
    s.depots.tr = Object.assign({ buchungen: [], werte: [], guthaben: [] }, s.depots.tr || {});
    s.depots.sc = Object.assign({ sparplaene: [], einzel: [], werte: [] }, s.depots.sc || {});
    s.meta.importe = s.meta.importe || {};
    s.v = 1;
    return s;
  };

  // ---------- IndexedDB mit Rückfall ----------
  function idb() {
    return new Promise(function (ok, fehler) {
      try {
        const rq = root.indexedDB.open(DB, 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
        rq.onsuccess = () => ok(rq.result);
        rq.onerror = () => fehler(rq.error);
        rq.onblocked = () => fehler(new Error('blockiert'));
      } catch (e) { fehler(e); }
    });
  }
  function idbLesen() {
    return idb().then(db => new Promise(function (ok, fehler) {
      const rq = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      rq.onsuccess = () => { db.close(); ok(rq.result == null ? null : rq.result); };
      rq.onerror = () => { db.close(); fehler(rq.error); };
    }));
  }
  function idbSchreiben(wert) {
    return idb().then(db => new Promise(function (ok, fehler) {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(wert, KEY);
      tx.oncomplete = () => { db.close(); ok(); };
      tx.onerror = () => { db.close(); fehler(tx.error); };
      tx.onabort = () => { db.close(); fehler(tx.error); };
    }));
  }
  function rohLesen() {
    return idbLesen().catch(function () {
      modus = 'ls';
      try { return root.localStorage.getItem(LS); } catch (e) { modus = 'mem'; return null; }
    });
  }
  function rohSchreiben(text) {
    if (modus === 'idb') return idbSchreiben(text).catch(function () { modus = 'ls'; return rohSchreiben(text); });
    if (modus === 'ls') { try { root.localStorage.setItem(LS, text); } catch (e) { modus = 'mem'; } }
    return Promise.resolve();
  }

  // ---------- Verschlüsselung (AES-GCM, Schlüssel aus Passwort per PBKDF2) ----------
  const enc = new TextEncoder(), dec = new TextDecoder();
  function b64(bytes) {
    let s = '';
    const a = new Uint8Array(bytes);
    for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function unb64(s) {
    const bin = atob(s), a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }
  function ableiten(pw, salt) {
    return crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey'])
      .then(k => crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: RUNDEN, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']));
  }
  function verschluesseln(key, salt, klartext) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(klartext))
      .then(c => JSON.stringify({ kassenlage: 1, enc: true, salt: b64(salt), iv: b64(iv), daten: b64(c) }));
  }
  function entschluesseln(huelle, pw, fertigerKey) {
    const salt = unb64(huelle.salt);
    const p = fertigerKey ? Promise.resolve(fertigerKey) : ableiten(pw, salt);
    return p.then(key => crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(huelle.iv) }, key, unb64(huelle.daten))
      .then(buf => ({ text: dec.decode(buf), key: key, salt: salt })));
  }

  // ---------- Laden, Speichern, Sperre ----------
  let gesperrteHuelle = null;

  D.laden = function () {
    return rohLesen().then(function (roh) {
      if (!roh) { D.state = D.neu(); return { status: 'neu' }; }
      let h;
      try { h = JSON.parse(roh); } catch (e) { D.state = D.neu(); return { status: 'neu', defekt: true }; }
      if (h && h.enc) { gesperrteHuelle = h; return { status: 'gesperrt' }; }
      D.state = D.normalisieren(h && h.daten ? h.daten : h);
      return { status: 'ok' };
    });
  };

  D.entsperren = function (pw) {
    if (!gesperrteHuelle) return Promise.resolve(true);
    return entschluesseln(gesperrteHuelle, pw).then(function (r) {
      D.state = D.normalisieren(JSON.parse(r.text));
      schluessel = { key: r.key, salt: r.salt };
      gesperrteHuelle = null;
      return true;
    }).catch(() => false);
  };

  D.jetztSpeichern = function () {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!D.state) return Promise.resolve();
    const klartext = JSON.stringify(D.state);
    if (schluessel) return verschluesseln(schluessel.key, schluessel.salt, klartext).then(rohSchreiben);
    return rohSchreiben(JSON.stringify({ kassenlage: 1, enc: false, daten: D.state }));
  };
  D.speichern = function () {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { D.jetztSpeichern().catch(() => {}); }, 250);
  };

  D.passwortSetzen = function (pw) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return ableiten(pw, salt).then(function (key) { schluessel = { key: key, salt: salt }; return D.jetztSpeichern(); });
  };
  D.passwortEntfernen = function () { schluessel = null; return D.jetztSpeichern(); };

  D.allesLoeschen = function () {
    schluessel = null; gesperrteHuelle = null;
    D.state = D.neu();
    return D.jetztSpeichern();
  };
  // Für den Fall "Passwort vergessen": gespeicherte Daten verwerfen und leer anfangen.
  D.verwerfen = function () { return D.allesLoeschen(); };

  // ---------- Sicherungsdatei ----------
  D.sicherungErstellen = function (pw) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const kopie = JSON.parse(JSON.stringify(D.state));
    kopie.meta.sicherung = new Date().toISOString();
    return ableiten(pw, salt).then(key => verschluesseln(key, salt, JSON.stringify(kopie)));
  };
  D.sicherungLesen = function (text, pw) {
    let h;
    try { h = JSON.parse(text); } catch (e) { return Promise.reject(new Error('format')); }
    if (!h || !h.kassenlage) return Promise.reject(new Error('format'));
    if (!h.enc) return Promise.resolve(D.normalisieren(h.daten));
    return entschluesseln(h, pw).then(r => D.normalisieren(JSON.parse(r.text)), () => { throw new Error('passwort'); });
  };

  // ---------- Beispieldaten (frei erfunden, zum Ausprobieren) ----------
  D.beispiel = function (heute) {
    FA.gehalt.leeren();
    const s = D.neu();
    s.demo = true; s.eingerichtet = true;
    s.steuer = { steuerklasse: 1, kirchensteuer: true, bundesland: 'BW', kvZusatz: 2.9, kinder: 0, kinderlosZuschlag: true };
    s.arbeit = { wochenstunden: 40, stundensatz: null, gehaltstag: 0, zuschlagInland: 20, zuschlagAusland: 25, stdWerktag: 10, stdSamstag: 7, stdSonntag: 0, ueberstundenZuschlag: 0, verzugMonate: 1, nettoAbzug: 0, wegKm: 60, wegKosten: 0.3 };
    const ym = heute.slice(0, 7), jahr = heute.slice(0, 4);
    s.gehalt = [
      { id: 'g1', art: 'grund', name: 'Grundgehalt', betrag: 3600, ab: (Number(jahr) - 1) + '-01-01' },
      { id: 'g2', art: 'grund', name: 'Grundgehalt nach Erhöhung', betrag: 3800, ab: jahr + '-04-01' },
      { id: 'g3', art: 'einmal', name: 'Weihnachtsgeld', betrag: 1900, ab: (Number(jahr) - 1) + '-01-01', monat: 11 }
    ];
    // Ein abgeschlossener Auslandseinsatz im Vormonat
    const vm = U.ymPlus(ym, -1);
    let start = vm + '-05';
    while (U.wochentag(start) !== 1) start = U.plusTage(start, 1);
    const e = Object.assign(FA.einsatz.neu(s), {
      id: 'e1', titel: 'Inbetriebnahme Roboterzelle', land: 'Spanien – im Übrigen', stadt: 'Ourense', ausland: true,
      start: start, ende: U.plusTage(start, 11), zuschlag: 25, vmaVoll: 34, vmaTeil: 23, vmaVomAg: true,
      unterkunftKosten: 0, unterkunftErstattung: 0, km: 0, ausgabenTag: 22, ersparnisTag: 14, verzug: 1,
      posten: [{ name: 'Maut und Parken', betrag: 46, erstattet: true }, { name: 'Arbeitshandschuhe', betrag: 19, erstattet: false }]
    });
    s.einsaetze = [e];
    // Kontobewegungen der letzten vier Monate, mit festem Zufall, damit die Vorschau stabil bleibt
    let saat = 7;
    const zufall = () => { saat = (saat * 16807) % 2147483647; return saat / 2147483647; };
    const tx = [];
    const buche = function (datum, betrag, gegen, text) {
      if (datum > heute) return;
      const t = { id: 'd' + tx.length, datum: datum, betrag: U.r2(betrag), gegen: gegen, text: text || '', art: '', quelle: 'sparkasse' };
      t.key = 'demo|' + tx.length;
      t.kat = FA.import.kategorie(t, []);
      tx.push(t);
    };
    for (let i = 4; i >= 0; i--) {
      const m = U.ymPlus(ym, -i), dim = U.tageImMonat(m);
      const tag = t => m + '-' + U.z2(Math.min(t, dim));
      const pm = FA.gehalt.planMonat(s, m);
      buche(pm.datum, pm.auszahlung, 'Musterfirma Automation GmbH', 'Lohn/Gehalt ' + U.monatName(m));
      buche(tag(1), -780, 'Hausverwaltung Sonnenhof', 'Miete und Nebenkosten');
      buche(tag(3), -64, 'Stadtwerke', 'Strom Abschlag');
      buche(tag(5), -39.99, 'Telekom Deutschland', 'Mobilfunk');
      buche(tag(8), i <= 1 ? -19.99 : -17.99, 'Netflix', 'Abo');
      buche(tag(8), -11.99, 'Spotify', 'Premium');
      buche(tag(12), -34.9, 'Clever Fit', 'Mitgliedsbeitrag');
      buche(tag(15), -58.4, 'HUK-Coburg', 'Kfz-Versicherung');
      buche(tag(2), -300, 'Trade Republic', 'Sparplan Einzahlung');
      buche(tag(2), -150, 'Scalable Capital', 'Sparplan Altersvorsorge');
      for (let d = 2; d <= dim; d += 3) buche(tag(d + Math.floor(zufall() * 2)), -(18 + zufall() * 55), ['REWE', 'EDEKA', 'Lidl', 'ALDI Süd'][Math.floor(zufall() * 4)], 'Kartenzahlung');
      for (let d = 6; d <= dim; d += 9) buche(tag(d), -(52 + zufall() * 28), ['Aral Tankstelle', 'Shell Tankstelle'][Math.floor(zufall() * 2)], 'Kartenzahlung');
      for (let d = 4; d <= dim; d += 7) buche(tag(d + 1), -(14 + zufall() * 38), ['Gasthaus Linde', 'Pizzeria Roma', 'Lieferando'][Math.floor(zufall() * 3)], 'Kartenzahlung');
      if (i % 2 === 0) buche(tag(18), -(35 + zufall() * 90), 'Amazon', 'Bestellung');
      if (i === 0) buche(tag(9), -389, 'MediaMarkt', 'Kartenzahlung');
      buche(tag(20), -50, 'Geldautomat', 'Bargeld');
    }
    s.tx = tx;
    s.konten[0].staende = [{ datum: U.plusTage(heute, -40), wert: 2140 }];
    s.konten.push({ id: 'bar', name: 'Bargeld', art: 'bar', staende: [{ datum: U.plusTage(heute, -20), wert: 120 }] });
    s.budgets = { lebensmittel: 350, restaurant: 120 };
    s.sparziele = [{ id: 'z1', name: 'Notgroschen', ziel: 6000, gespart: 3800, bis: '' }];
    // Depot-Beispiel
    const b = [];
    for (let i = 14; i >= 0; i--) {
      const m = U.ymPlus(ym, -i), d = m + '-02';
      if (d > heute) continue;
      b.push({ id: 'te' + i, datum: d, kat: 'CASH', typ: 'DEPOSIT', name: '', isin: '', stueck: 0, kurs: 0, betrag: 300, gebuehr: 0, steuer: 0, art: 'einzahlung' });
      const kurs = 118 + (14 - i) * 1.6;
      b.push({ id: 'ts' + i, datum: d, kat: 'TRADING', typ: 'SAVINGS_PLAN', name: 'Vanguard FTSE All-World (Acc)', isin: 'IE00BK5BQT80', stueck: U.r2(250 / kurs * 1000) / 1000, kurs: kurs, betrag: -250, gebuehr: 0, steuer: 0, art: 'sparplan' });
    }
    b.push({ id: 'tz1', datum: U.ymPlus(ym, -1) + '-01', kat: 'CASH', typ: 'INTEREST', name: '', isin: '', stueck: 0, kurs: 0, betrag: 3.42, gebuehr: 0, steuer: -0.9, art: 'zinsen' });
    s.depots.tr.buchungen = b;
    s.depots.tr.werte = [{ datum: heute, wert: 4215 }];
    s.depots.sc.sparplaene = [{ id: 'p1', name: 'ETF Altersvorsorge', betrag: 150, tag: 2, start: (Number(jahr) - 2) + '-06-02', ende: '' }];
    s.depots.sc.werte = [{ datum: heute, wert: 4890 }];
    s.meta.importe = { bank: { zeit: new Date().toISOString(), anzahl: tx.length, bis: tx.length ? tx.reduce((x, t) => t.datum > x ? t.datum : x, '') : null }, tr: { zeit: new Date().toISOString(), anzahl: b.length, bis: heute } };
    FA.gehalt.leeren();
    return s;
  };
})(typeof window !== 'undefined' ? window : globalThis);
