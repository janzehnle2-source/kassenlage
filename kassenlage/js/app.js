/* Steuerung: Navigation, Formulare, Import, Sicherung. */
(function (root) {
  'use strict';
  const FA = root.FA;
  const U = FA.util, G = FA.gehalt, E = FA.einsatz, A = FA.analyse, D = FA.daten, I = FA.import, V = FA.ansichten, X = FA.diagramm;
  const $ = s => document.querySelector(s);
  const heute = U.heute();
  let st = null;

  const ui = {
    ansicht: 'dashboard', sub: null, monat: heute.slice(0, 7), zeitraum: 'M', linien: { gesamt: true, giro: false, tr: false, weitere: false },
    filter: { monat: 'alle', kat: 'alle', suche: '' }, limit: 200,
    steuerJahr: Number(heute.slice(0, 4)), steuerMonat: null,
    importErgebnis: null, sicherungBereit: null, gesperrt: false, merk: null
  };

  // ---------- Zeichnen ----------
  function zeichne(oben) {
    const inhalt = $('#inhalt');
    $('.leiste').hidden = ui.gesperrt;
    if (ui.gesperrt) {
      inhalt.innerHTML = V.sperrbild();
      $('#titel').textContent = 'Kassenlage';
      $('#zurueck').hidden = true;
      return;
    }
    themaAnwenden();
    X.aktuell = null; X.standard = null;
    const h = ui.sub ? V.sub[ui.sub.art](st, ui) : V[ui.ansicht](st, ui);
    inhalt.innerHTML = h;
    $('#titel').textContent = V.titel(ui);
    $('#zurueck').hidden = !ui.sub;
    document.querySelectorAll('.leiste button').forEach(function (b) {
      if (b.dataset.ziel === ui.ansicht) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (oben) root.scrollTo(0, 0);
  }

  function geaendert(oben) {
    G.leeren();
    D.speichern();
    zeichne(oben);
  }

  // ---------- Blatt und Meldung ----------
  function blatt(f) {
    $('#blatt-titel').textContent = f.titel;
    $('#blatt-inhalt').innerHTML = f.html;
    $('#schleier').hidden = false;
    document.body.style.overflow = 'hidden';
    $('#blatt-inhalt').scrollTop = 0;
  }
  function blattZu() {
    $('#schleier').hidden = true;
    $('#blatt-inhalt').innerHTML = '';
    document.body.style.overflow = '';
  }
  let toastTimer = null;
  function toast(text) {
    const t = $('#toast');
    t.textContent = text; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
  }
  function fehler(text) {
    const el = $('#form-fehler');
    if (el) { el.textContent = text; el.hidden = false; el.scrollIntoView({ block: 'nearest' }); }
  }
  const z = (fd, n, vorgabe) => U.zahlOder(fd.get(n), vorgabe);
  const text = (fd, n) => String(fd.get(n) || '').trim();

  // ---------- Aktionen (Klicks) ----------
  const AKT = {
    nav: b => { ui.ansicht = b.dataset.ziel; ui.sub = null; zeichne(true); },
    zurueck: () => { ui.sub = null; zeichne(true); },
    'blatt-zu': blattZu,
    geh: function (b) {
      blattZu();
      ui.sub = { art: b.dataset.art }; ui.ansicht = 'mehr';
      if (b.dataset.art !== 'import') ui.importErgebnis = null;
      zeichne(true);
    },
    monat: b => { ui.monat = U.ymPlus(ui.monat, Number(b.dataset.n)); zeichne(); },
    einrichten: () => blatt(V.form.einrichten(st)),
    'demo-laden': () => { st = D.state = D.beispiel(heute); geaendert(true); toast('Beispieldaten geladen'); },
    'demo-weg': () => { st = D.state = D.neu(); ui.sub = null; ui.ansicht = 'dashboard'; geaendert(true); toast('Beispieldaten entfernt'); },

    'buchung-neu': () => blatt(V.form.buchung(st)),
    tx: function (b) { const t = st.tx.find(x => x.id === b.dataset.id); if (t) blatt(V.form.tx(st, t)); },
    'tx-weg': function (b) { st.tx = st.tx.filter(x => x.id !== b.dataset.id); blattZu(); geaendert(); toast('Buchung gelöscht'); },
    'kat-zeigen': function (b) { ui.filter = { monat: ui.monat, kat: b.dataset.kat, suche: '' }; ui.limit = 200; ui.ansicht = 'buchungen'; ui.sub = null; zeichne(true); },
    'mehr-zeigen': () => { ui.limit += 200; $('#txliste').innerHTML = V.txListe(st, ui); },

    'einsatz-neu': () => blatt(V.form.einsatz(st, E.neu(st))),
    einsatz: b => { ui.sub = { art: 'einsatz', id: b.dataset.id }; ui.ansicht = 'einsaetze'; zeichne(true); },
    'einsatz-bearbeiten': function (b) { const e = st.einsaetze.find(x => x.id === b.dataset.id); if (e) blatt(V.form.einsatz(st, e)); },
    'einsatz-loeschen': function (b) { ui.merk = b.dataset.id; blatt(V.form.frage('Einsatz löschen', 'Der Einsatz und seine Berechnung werden entfernt. Das lässt sich nicht rückgängig machen.', 'Einsatz löschen', 'einsatz-loeschen-ja', true)); },
    'einsatz-loeschen-ja': function () { st.einsaetze = st.einsaetze.filter(x => x.id !== ui.merk); ui.sub = null; blattZu(); geaendert(true); toast('Einsatz gelöscht'); },
    'posten-neu': function () { const l = $('#posten-liste'); l.insertAdjacentHTML('beforeend', V.postenZeile({ name: '', betrag: '', erstattet: true }, l.children.length)); const neu = l.lastElementChild.querySelector('input'); if (neu) neu.focus(); },
    'posten-weg': b => { b.closest('.posten').remove(); },

    baustein: function (b) {
      const vorhanden = b.dataset.id ? st.gehalt.find(x => x.id === b.dataset.id) : null;
      blatt(V.form.baustein(st, vorhanden || { art: b.dataset.neu || 'grund', name: '', betrag: '', ab: heute, monat: 11 }));
    },
    'baustein-weg': function (b) { st.gehalt = st.gehalt.filter(x => x.id !== b.dataset.id); blattZu(); geaendert(); toast('Baustein gelöscht'); },
    arbeit: () => blatt(V.form.arbeit(st)),
    steuerdaten: () => blatt(V.form.steuerdaten(st)),
    konto: () => blatt(V.form.konto(st)),

    depotwert: b => blatt(V.form.depotwert(st, b.dataset.depot)),
    sparplan: function (b) { const p = b.dataset.id ? st.depots.sc.sparplaene.find(x => x.id === b.dataset.id) : null; blatt(V.form.sparplan(st, p || { name: '', betrag: '', tag: 1, start: '', ende: '' })); },
    'sparplan-weg': function (b) { st.depots.sc.sparplaene = st.depots.sc.sparplaene.filter(x => x.id !== b.dataset.id); blattZu(); geaendert(); },
    einzel: () => blatt(V.form.einzel()),
    'einzel-weg': function (b) { st.depots.sc.einzel = st.depots.sc.einzel.filter(x => x.id !== b.dataset.id); geaendert(); },
    'regel-weg': function (b) { st.regeln.splice(Number(b.dataset.i), 1); geaendert(); },

    'sicherung-neu': () => blatt(V.form.sicherungNeu()),
    'sicherung-laden': () => blatt(V.form.sicherungLaden()),
    'sicherung-speichern': function () {
      const name = 'kassenlage-sicherung-' + heute + '.json';
      const fertig = function () { st.meta.sicherung = new Date().toISOString(); ui.sicherungBereit = null; geaendert(); toast('Sicherung gespeichert'); };
      const laden = function () {
        const a = document.createElement('a');
        const url = URL.createObjectURL(new Blob([ui.sicherungBereit], { type: 'application/json' }));
        a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        fertig();
      };
      let datei = null;
      try { datei = new File([ui.sicherungBereit], name, { type: 'application/json' }); } catch (e) { datei = null; }
      const mobil = root.matchMedia && root.matchMedia('(pointer: coarse)').matches;
      if (mobil && datei && navigator.canShare && navigator.canShare({ files: [datei] })) {
        navigator.share({ files: [datei], title: 'Kassenlage Sicherung' }).then(fertig).catch(function (err) { if (!err || err.name !== 'AbortError') laden(); });
      } else laden();
    },
    'sperre-setzen': () => blatt(V.form.sperre()),
    'sperre-weg': () => { D.passwortEntfernen().then(() => { zeichne(); toast('Sperre aufgehoben'); }); },
    'alles-loeschen': () => blatt(V.form.frage('Alle Daten löschen', 'Buchungen, Einsätze, Depots, Gehalts- und Steuerdaten auf diesem Gerät werden entfernt. Ohne Sicherungsdatei sind sie danach weg.', 'Alles löschen', 'alles-loeschen-ja', true)),
    'alles-loeschen-ja': function () { D.allesLoeschen().then(function () { st = D.state; ui.sub = null; ui.ansicht = 'dashboard'; blattZu(); G.leeren(); zeichne(true); toast('Alle Daten gelöscht'); }); },
    'verwerfen-frage': () => blatt(V.form.frage('Daten verwerfen', 'Die verschlüsselten Daten auf diesem Gerät werden gelöscht. Danach kannst du eine Sicherungsdatei einspielen oder neu anfangen.', 'Daten verwerfen', 'verwerfen-ja', true)),
    'verwerfen-ja': function () { D.verwerfen().then(function () { st = D.state; ui.gesperrt = false; blattZu(); G.leeren(); zeichne(true); }); }
  };

  // ---------- Aktionen der neuen Bereiche ----------
  const TAB = { einsatz: 'einsaetze', buchungen: 'ausgaben', tr: 'vermoegen', scalable: 'vermoegen' };
  Object.assign(AKT, {
    geh: function (b) {
      blattZu();
      const art = b.dataset.art, tab = TAB[art] || 'mehr';
      ui.sub = { art: art, von: ui.sub && ui.ansicht === tab && ui.sub.art !== art ? ui.sub : null };
      ui.ansicht = tab;
      if (art !== 'import') ui.importErgebnis = null;
      zeichne(true);
    },
    zurueck: () => { ui.sub = (ui.sub && ui.sub.von) || null; zeichne(true); },
    'kat-zeigen': function (b) { blattZu(); ui.filter = { monat: ui.monat, kat: b.dataset.kat, suche: '' }; ui.limit = 200; ui.sub = { art: 'buchungen' }; ui.ansicht = 'ausgaben'; zeichne(true); },
    info: b => blatt(V.infoBlatt(b.dataset.key)),
    torte: function (b) { const f = V.torteBlatt(st, ui.monat, b.dataset.key); if (f) blatt(f); },
    zeitraum: b => { ui.zeitraum = b.dataset.z; zeichne(); },
    linie: function (b) {
      const k = b.dataset.key;
      ui.linien[k] = !ui.linien[k];
      if (!Object.keys(ui.linien).some(x => ui.linien[x])) ui.linien[k] = true;
      zeichne();
    },
    kontostand: function (b) { const k = st.konten.find(x => x.id === b.dataset.id); if (k) blatt(V.form.kontostand(st, k)); },
    'konto-neu': () => blatt(V.form.kontoNeu()),
    'konto-weg': function (b) {
      st.konten = st.konten.filter(k => k.id !== b.dataset.id || k.id === 'giro');
      for (const t of st.tx) if (t.konto === b.dataset.id) t.konto = 'ohne';
      blattZu(); geaendert(); toast('Konto entfernt');
    },
    budgets: () => blatt(V.form.budgets(st)),
    sparziel: function (b) { blatt(V.form.sparziel((b.dataset.id && st.sparziele.find(x => x.id === b.dataset.id)) || {})); },
    'sparziel-weg': function (b) { st.sparziele = st.sparziele.filter(x => x.id !== b.dataset.id); blattZu(); geaendert(); toast('Sparziel gelöscht'); },
    'tr-guthaben': () => blatt(V.form.trGuthaben(st))
  });

  // ---------- Formulare ----------
  function leseSteuer(fd) {
    const zusatz = text(fd, 'kvZusatz');
    return {
      steuerklasse: Number(fd.get('steuerklasse')) || 1, bundesland: text(fd, 'bundesland'),
      kirchensteuer: fd.get('kirchensteuer') === 'on', kinder: Math.max(0, Math.round(z(fd, 'kinder', 0))),
      kvZusatz: zusatz === '' ? null : z(fd, 'kvZusatz', null), kinderlosZuschlag: true
    };
  }
  function leseArbeit(fd) {
    const satz = z(fd, 'stundensatz', 0), tag = Math.round(z(fd, 'gehaltstag', 0));
    return {
      wochenstunden: z(fd, 'wochenstunden', 40) || 40, stundensatz: satz > 0 ? satz : null,
      gehaltstag: tag >= 1 && tag <= 31 ? tag : 0,
      zuschlagInland: Math.max(0, z(fd, 'zuschlagInland', 0)), zuschlagAusland: Math.max(0, z(fd, 'zuschlagAusland', 0)),
      stdWerktag: Math.max(0, z(fd, 'stdWerktag', 8)), stdSamstag: Math.max(0, z(fd, 'stdSamstag', 0)), stdSonntag: (st.arbeit && st.arbeit.stdSonntag) || 0,
      ueberstundenZuschlag: Math.max(0, z(fd, 'ueberstundenZuschlag', 0)), verzugMonate: Number(fd.get('verzugMonate')) || 0,
      nettoAbzug: Math.max(0, z(fd, 'nettoAbzug', 0)),
      wegKm: Math.max(0, z(fd, 'wegKm', 0)), wegKosten: Math.max(0, z(fd, 'wegKosten', 0))
    };
  }

  const FORM = {
    einrichten: function (f, fd) {
      const brutto = z(fd, 'brutto', 0), ab = text(fd, 'ab');
      if (!(brutto > 0)) return fehler('Bitte dein Bruttogehalt pro Monat eintragen.');
      if (!ab) return fehler('Bitte ein Datum bei „Gültig seit“ wählen.');
      if (!text(fd, 'bundesland')) return fehler('Bitte dein Bundesland wählen.');
      st.steuer = leseSteuer(fd); st.arbeit = leseArbeit(fd);
      st.gehalt = st.gehalt.filter(b => b.art !== 'grund');
      st.gehalt.push({ id: U.uid(), art: 'grund', name: 'Grundgehalt', betrag: brutto, ab: ab });
      st.eingerichtet = true;
      blattZu(); geaendert(true); toast('Gespeichert');
    },
    steuerdaten: function (f, fd) {
      if (!text(fd, 'bundesland')) return fehler('Bitte dein Bundesland wählen.');
      st.steuer = leseSteuer(fd); blattZu(); geaendert(); toast('Gespeichert');
    },
    arbeit: function (f, fd) { st.arbeit = leseArbeit(fd); blattZu(); geaendert(); toast('Gespeichert'); },
    baustein: function (f, fd) {
      const betrag = z(fd, 'betrag', 0), ab = text(fd, 'ab'), art = text(fd, 'art');
      if (!(betrag > 0)) return fehler('Bitte einen Betrag über 0 eintragen.');
      if (!ab) return fehler('Bitte ein Datum bei „Gültig ab“ wählen.');
      const b = { id: text(fd, 'id') || U.uid(), art: art, name: text(fd, 'name') || ({ grund: 'Grundgehalt', zulage: 'Zulage', einmal: 'Einmalzahlung' })[art], betrag: betrag, ab: ab };
      if (art !== 'grund' && text(fd, 'bis')) b.bis = text(fd, 'bis');
      if (art === 'einmal') b.monat = Number(fd.get('monat')) || 11;
      st.gehalt = st.gehalt.filter(x => x.id !== b.id); st.gehalt.push(b);
      blattZu(); geaendert(); toast('Gespeichert');
    },
    buchung: function (f, fd) {
      const betrag = Math.abs(z(fd, 'betrag', 0)), datum = text(fd, 'datum');
      if (!(betrag > 0)) return fehler('Bitte einen Betrag eintragen.');
      if (!datum) return fehler('Bitte ein Datum wählen.');
      const t = { id: U.uid(), datum: datum, betrag: U.r2(fd.get('richtung') === 'ein' ? betrag : -betrag), gegen: text(fd, 'gegen'), text: '', art: '', quelle: 'manuell' };
      t.kat = text(fd, 'kat') || I.kategorie(t, st.regeln);
      st.tx.push(t);
      blattZu(); geaendert(); toast('Buchung gespeichert');
    },
    tx: function (f, fd) {
      const t = st.tx.find(x => x.id === text(fd, 'id'));
      if (!t) return blattZu();
      const kat = text(fd, 'kat'), key = U.schluessel(t);
      t.kat = kat;
      let n = 0;
      if (fd.get('merken') === 'on' && key) {
        st.regeln = st.regeln.filter(r => r.muster !== key);
        st.regeln.push({ muster: key, kat: kat, name: t.gegen || t.text });
        for (const x of st.tx) if (x.id !== t.id && U.schluessel(x) === key && x.kat !== kat) { x.kat = kat; n++; }
      }
      blattZu(); geaendert(); toast(n ? 'Kategorie für ' + (n + 1) + ' Buchungen geändert' : 'Kategorie geändert');
    },
    einsatz: function (f, fd) {
      const start = text(fd, 'start'), ende = text(fd, 'ende');
      if (!start || !ende) return fehler('Bitte ersten und letzten Tag wählen.');
      if (ende < start) return fehler('Der letzte Tag liegt vor dem ersten.');
      if (U.tageZwischen(start, ende) > 400) return fehler('Der Zeitraum ist länger als ein Jahr. Bitte in mehrere Einsätze teilen.');
      const leerOder = n => text(fd, n) === '' ? '' : Math.max(0, z(fd, n, 0));
      const posten = [];
      f.querySelectorAll('.posten').forEach(function (zeile) {
        const name = zeile.querySelector('[name="pn"]').value.trim(), betrag = U.zahlOder(zeile.querySelector('[name="pb"]').value, 0);
        if (name || betrag) posten.push({ name: name, betrag: Math.abs(betrag), erstattet: zeile.querySelector('[name="pe"]').checked });
      });
      const kurs = z(fd, 'kurs', 1);
      const e = {
        id: text(fd, 'id') || U.uid(), titel: text(fd, 'titel'), land: text(fd, 'land'), stadt: text(fd, 'stadt'), ausland: fd.get('ausland') === '1',
        start: start, ende: ende, tageMoFr: leerOder('tageMoFr'), samstage: leerOder('samstage'), sonntage: Math.max(0, z(fd, 'sonntage', 0)),
        stdWerktag: Math.max(0, z(fd, 'stdWerktag', 0)), stdSamstag: Math.max(0, z(fd, 'stdSamstag', 0)), stdSonntag: Math.max(0, z(fd, 'stdSonntag', 0)),
        zuschlag: Math.max(0, z(fd, 'zuschlag', 0)), verzug: Number(fd.get('verzug')) || 0,
        vmaVoll: Math.max(0, z(fd, 'vmaVoll', 0)), vmaTeil: Math.max(0, z(fd, 'vmaTeil', 0)), reisetage: Math.max(0, z(fd, 'reisetage', 0)), vmaVomAg: fd.get('vmaVomAg') === 'on',
        naechte: leerOder('naechte'), unterkunftKosten: Math.max(0, z(fd, 'unterkunftKosten', 0)), unterkunftErstattung: Math.max(0, z(fd, 'unterkunftErstattung', 0)),
        km: Math.max(0, z(fd, 'km', 0)), kmSatz: Math.max(0, z(fd, 'kmSatz', 0)), kmKosten: Math.max(0, z(fd, 'kmKosten', 0)),
        posten: posten, ausgabenTag: Math.max(0, z(fd, 'ausgabenTag', 0)), ersparnisTag: Math.max(0, z(fd, 'ersparnisTag', 0)), fruehstueck: fd.get('fruehstueck') === 'on',
        wegKm: Math.max(0, z(fd, 'wegKm', 0)), wegKosten: Math.max(0, z(fd, 'wegKosten', 0)), wegTage: leerOder('wegTage'),
        waehrung: (text(fd, 'waehrung') || 'EUR').toUpperCase(), kurs: kurs > 0 ? kurs : 1, notiz: text(fd, 'notiz')
      };
      st.einsaetze = st.einsaetze.filter(x => x.id !== e.id); st.einsaetze.push(e);
      // Arbeitsweg und Kosten als Vorgabe für den nächsten Einsatz merken
      if (e.wegKm > 0) st.arbeit.wegKm = e.wegKm;
      if (e.wegKosten > 0) st.arbeit.wegKosten = e.wegKosten;
      ui.sub = { art: 'einsatz', id: e.id }; ui.ansicht = 'einsaetze';
      blattZu(); geaendert(true);
    },
    konto: function (f, fd) {
      const stand = z(fd, 'stand', NaN), datum = text(fd, 'datum');
      if (isNaN(stand) || !datum) return fehler('Bitte Kontostand und Datum eintragen.');
      st.konto = { stand: stand, datum: datum }; blattZu(); geaendert(); toast('Kontostand gespeichert');
    },
    depotwert: function (f, fd) {
      const wert = z(fd, 'wert', NaN), datum = text(fd, 'datum'), d = st.depots[text(fd, 'depot')];
      if (isNaN(wert) || wert < 0 || !datum || !d) return fehler('Bitte Depotwert und Datum eintragen.');
      d.werte = d.werte.filter(x => x.datum !== datum); d.werte.push({ datum: datum, wert: wert });
      d.werte.sort((a, b) => a.datum < b.datum ? -1 : 1);
      blattZu(); geaendert(); toast('Depotwert gespeichert');
    },
    sparplan: function (f, fd) {
      const betrag = z(fd, 'betrag', 0), start = text(fd, 'start'), tag = Math.round(z(fd, 'tag', 1));
      if (!(betrag > 0) || !start) return fehler('Bitte Betrag und erste Ausführung eintragen.');
      const p = { id: text(fd, 'id') || U.uid(), name: text(fd, 'name') || 'Sparplan', betrag: betrag, tag: tag >= 1 && tag <= 31 ? tag : 1, start: start, ende: text(fd, 'ende') };
      st.depots.sc.sparplaene = st.depots.sc.sparplaene.filter(x => x.id !== p.id); st.depots.sc.sparplaene.push(p);
      blattZu(); geaendert(); toast('Sparplan gespeichert');
    },
    einzel: function (f, fd) {
      const betrag = z(fd, 'betrag', NaN), datum = text(fd, 'datum');
      if (isNaN(betrag) || !betrag || !datum) return fehler('Bitte Betrag und Datum eintragen.');
      st.depots.sc.einzel.push({ id: U.uid(), text: text(fd, 'text') || 'Einzelkauf', betrag: betrag, datum: datum });
      blattZu(); geaendert(); toast('Gespeichert');
    },
    kategorie: function (f, fd) {
      const name = text(fd, 'name');
      if (!name) return;
      if (st.kategorien.some(k => k.name.toLowerCase() === name.toLowerCase())) return toast('Diese Kategorie gibt es schon');
      st.kategorien.push({ id: 'k' + U.uid(), name: name, typ: text(fd, 'typ') || 'ausgabe' });
      geaendert(); toast('Kategorie hinzugefügt');
    },
    erstattung: function (f, fd) {
      st.erstattung = { km: Math.max(0, z(fd, 'km', 0)), tage: Math.max(0, Math.round(z(fd, 'tage', 0))), weitereWk: Math.max(0, z(fd, 'weitereWk', 0)), spenden: Math.max(0, z(fd, 'spenden', 0)) };
      geaendert(); toast('Neu gerechnet');
    },
    'sicherung-neu': function (f, fd) {
      const pw = String(fd.get('pw') || ''), pw2 = String(fd.get('pw2') || '');
      if (pw.length < 8) return fehler('Das Passwort braucht mindestens acht Zeichen.');
      if (pw !== pw2) return fehler('Die beiden Passwörter sind verschieden.');
      D.sicherungErstellen(pw).then(function (inhalt) { ui.sicherungBereit = inhalt; blattZu(); zeichne(); }).catch(() => fehler('Die Sicherung konnte nicht erstellt werden.'));
    },
    'sicherung-laden': function (f, fd) {
      const datei = fd.get('datei'), pw = String(fd.get('pw') || '');
      if (!datei || !datei.size) return fehler('Bitte eine Sicherungsdatei wählen.');
      datei.text().then(inhalt => D.sicherungLesen(inhalt, pw)).then(function (neu) {
        st = D.state = neu; ui.sub = null; ui.ansicht = 'dashboard';
        blattZu(); geaendert(true); toast('Sicherung eingespielt');
      }).catch(function (err) { fehler(err && err.message === 'passwort' ? 'Das Passwort passt nicht zu dieser Datei.' : 'Das ist keine Sicherungsdatei von Kassenlage.'); });
    },
    sperre: function (f, fd) {
      const pw = String(fd.get('pw') || ''), pw2 = String(fd.get('pw2') || '');
      if (pw.length < 8) return fehler('Das Passwort braucht mindestens acht Zeichen.');
      if (pw !== pw2) return fehler('Die beiden Passwörter sind verschieden.');
      D.passwortSetzen(pw).then(function () { blattZu(); zeichne(); toast('App-Sperre ist aktiv'); }).catch(() => fehler('Das Passwort konnte nicht gesetzt werden.'));
    },
    entsperren: function (f, fd) {
      D.entsperren(String(fd.get('pw') || '')).then(function (ok) {
        if (!ok) return fehler('Das Passwort stimmt nicht.');
        st = D.state; ui.gesperrt = false; G.leeren(); zeichne(true);
      });
    }
  };

  // ---------- Formulare der neuen Bereiche ----------
  Object.assign(FORM, {
    tx: function (f, fd) {
      const t = st.tx.find(x => x.id === text(fd, 'id'));
      if (!t) return blattZu();
      const kat = text(fd, 'kat'), key = U.schluessel(t), marke = text(fd, 'marke'), neueKat = kat !== t.kat;
      t.kat = kat; t.marke = marke; t.notiz = text(fd, 'notiz');
      t.einsatzId = (marke === 'einsatz' || marke === 'spese' || marke === 'reisekosten') ? text(fd, 'einsatzId') : '';
      let n = 0;
      // Die Regel entsteht nur, wenn die Kategorie wirklich geändert wurde
      if (neueKat && fd.get('merken') === 'on' && key) {
        st.regeln = st.regeln.filter(r => r.muster !== key);
        st.regeln.push({ muster: key, kat: kat, name: t.gegen || t.text });
        for (const x of st.tx) if (x.id !== t.id && U.schluessel(x) === key && x.kat !== kat) { x.kat = kat; n++; }
      }
      blattZu(); geaendert(); toast(n ? 'Gespeichert, Kategorie für ' + (n + 1) + ' Buchungen geändert' : 'Gespeichert');
    },
    buchung: function (f, fd) {
      const betrag = Math.abs(z(fd, 'betrag', 0)), datum = text(fd, 'datum');
      if (!(betrag > 0)) return fehler('Bitte einen Betrag eintragen.');
      if (!datum) return fehler('Bitte ein Datum wählen.');
      const t = { id: U.uid(), datum: datum, betrag: U.r2(fd.get('richtung') === 'ein' ? betrag : -betrag), gegen: text(fd, 'gegen'), text: '', art: '', quelle: 'manuell', konto: text(fd, 'konto') || 'giro', notiz: text(fd, 'notiz') };
      t.kat = text(fd, 'kat') || I.kategorie(t, st.regeln);
      st.tx.push(t);
      blattZu(); geaendert(); toast('Buchung gespeichert');
    },
    kontostand: function (f, fd) {
      const wert = z(fd, 'wert', NaN), datum = text(fd, 'datum'), k = st.konten.find(x => x.id === text(fd, 'id'));
      if (isNaN(wert) || !datum || !k) return fehler('Bitte Stand und Datum eintragen.');
      if (datum > heute) return fehler('Das Datum liegt in der Zukunft.');
      k.staende = k.staende.filter(x => x.datum !== datum); k.staende.push({ datum: datum, wert: wert });
      k.staende.sort((a, b) => a.datum < b.datum ? -1 : 1);
      blattZu(); geaendert(); toast('Stand gespeichert');
    },
    'konto-neu': function (f, fd) {
      const name = text(fd, 'name'), wert = z(fd, 'wert', NaN), datum = text(fd, 'datum');
      if (!name || isNaN(wert) || !datum) return fehler('Bitte Bezeichnung, Stand und Datum eintragen.');
      if (datum > heute) return fehler('Das Datum liegt in der Zukunft.');
      st.konten.push({ id: 'k' + U.uid(), name: name, art: text(fd, 'art') || 'konto', staende: [{ datum: datum, wert: wert }] });
      blattZu(); geaendert(); toast('Konto hinzugefügt');
    },
    budgets: function (f, fd) {
      const b = {};
      for (const k of st.kategorien) { const v = z(fd, 'b-' + k.id, 0); if (v > 0) b[k.id] = v; }
      st.budgets = b; blattZu(); geaendert(); toast('Budgets gespeichert');
    },
    sparziel: function (f, fd) {
      const name = text(fd, 'name'), ziel = z(fd, 'ziel', 0);
      if (!name || !(ziel > 0)) return fehler('Bitte Bezeichnung und Zielbetrag eintragen.');
      const neu = { id: text(fd, 'id') || U.uid(), name: name, ziel: ziel, gespart: Math.max(0, z(fd, 'gespart', 0)), bis: text(fd, 'bis') };
      st.sparziele = st.sparziele.filter(x => x.id !== neu.id); st.sparziele.push(neu);
      blattZu(); geaendert(); toast('Sparziel gespeichert');
    },
    'tr-guthaben': function (f, fd) {
      const wert = z(fd, 'wert', NaN), datum = text(fd, 'datum');
      if (isNaN(wert) || !datum) return fehler('Bitte Guthaben und Datum eintragen.');
      const g = st.depots.tr.guthaben.filter(x => x.datum !== datum); g.push({ datum: datum, wert: wert });
      st.depots.tr.guthaben = g.sort((a, b) => a.datum < b.datum ? -1 : 1);
      blattZu(); geaendert(); toast('Guthaben gespeichert');
    }
  });

  // ---------- Auswahl geändert ----------
  const setze = (id, wert) => { const el = $('#f-' + id); if (el) el.value = U.zahlText(wert); };
  // Land gewählt: Inland oder Ausland setzen, Zuschlag und amtliche Verpflegungssätze eintragen
  function landGewaehlt(wert, fertig) {
    const s = FA.spesen.finde(wert, fertig);
    if (!s) return;
    const radio = document.querySelector('input[name="ausland"][value="' + (s.inland ? '0' : '1') + '"]');
    if (radio) radio.checked = true;
    setze('zuschlag', s.inland ? st.arbeit.zuschlagInland : st.arbeit.zuschlagAusland);
    setze('vmaVoll', s.voll); setze('vmaTeil', s.teil);
    const h = V.spesenHinweis(s), a = $('#spesen-hinweis'), b = $('#nacht-hinweis');
    if (a) a.textContent = h.vma;
    if (b) b.textContent = h.nacht;
  }
  const WECHSEL = {
    filter: function (el) { ui.filter[el.name] = el.value; ui.limit = 200; $('#txliste').innerHTML = V.txListe(st, ui); },
    'steuer-jahr': el => { ui.steuerJahr = Number(el.value); ui.steuerMonat = null; zeichne(); },
    'steuer-monat': el => { ui.steuerMonat = el.value; zeichne(); },
    'baustein-art': function (el) {
      const f = el.closest('form');
      f.querySelector('[data-nur="einmal"]').hidden = el.value !== 'einmal';
      f.querySelector('[data-nur="nichtgrund"]').hidden = el.value === 'grund';
    },
    'einsatz-datum': function () {
      const s = $('#f-start').value, e = $('#f-ende').value;
      if (!s || !e || e < s) return;
      const t = E.tage(s, e);
      setze('tageMoFr', t.moFr); setze('samstage', t.sa); setze('naechte', '');
      setze('reisetage', t.tage > 1 ? 2 : 1);
    },
    'einsatz-ort': function (el) {
      const land = $('#f-land');
      if (el.value === '0') { if (land) land.value = 'Deutschland'; landGewaehlt('Deutschland', true); return; }
      if (land && FA.spesen.finde(land.value, false) && FA.spesen.finde(land.value, false).inland) land.value = '';
      setze('zuschlag', st.arbeit.zuschlagAusland);
      if (land && land.value) { landGewaehlt(land.value, true); return; }
      setze('vmaVoll', ''); setze('vmaTeil', '');
      const h = V.spesenHinweis(null), x = $('#spesen-hinweis'), y = $('#nacht-hinweis');
      if (x) x.textContent = h.vma;
      if (y) y.textContent = h.nacht;
    },
    'einsatz-land': el => landGewaehlt(el.value, true)
  };

  Object.assign(WECHSEL, {
    thema: el => { st.einstellungen.thema = el.value; D.speichern(); themaAnwenden(); },
    hinweis: el => { st.einstellungen[el.name] = el.checked; D.speichern(); },
    'tx-marke': function (el) {
      const feld = $('#tx-einsatz'), beruf = el.value === 'einsatz' || el.value === 'spese' || el.value === 'reisekosten';
      if (feld) feld.hidden = !(beruf && st.einsaetze.length);
    }
  });

  // ---------- Darstellung und Verlauf ----------
  const THEMA_FARBE = { hell: '#ffffff', dunkel: '#0c0d10' };
  function themaAnwenden() {
    if (FA.VORSCHAU || !st) return;
    const t = st.einstellungen.thema, el = document.documentElement;
    if (t === 'hell') el.setAttribute('data-theme', 'light'); else if (t === 'dunkel') el.setAttribute('data-theme', 'dark'); else el.removeAttribute('data-theme');
    try { root.localStorage.setItem('kassenlage-thema', t); } catch (e) { /* ohne Speicher gilt die Wahl bis zum Schließen */ }
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m, n) { m.setAttribute('content', THEMA_FARBE[t] || (n === 0 ? THEMA_FARBE.hell : THEMA_FARBE.dunkel)); });
  }

  // Finger oder Maus über dem Verlauf: Wert und Datum dieses Tages zeigen
  function vlZeige(e) {
    const svg = e.target.closest && e.target.closest('#verlauf svg'), a = X.aktuell;
    if (!svg || !a) return;
    const rect = svg.getBoundingClientRect(), n = a.tage.length;
    const xv = (e.clientX - rect.left) / rect.width * a.B;
    const i = Math.max(0, Math.min(n - 1, Math.round((xv - a.l) / a.iw * (n - 1))));
    const x = (a.l + i / (n - 1) * a.iw).toFixed(1);
    const faden = svg.querySelector('#vl-linie');
    faden.setAttribute('x1', x); faden.setAttribute('x2', x); faden.setAttribute('visibility', 'visible');
    svg.querySelectorAll('.vl-punkt').forEach(function (c) { c.setAttribute('cx', x); c.setAttribute('cy', a.y(a.reihen[c.dataset.key][i]).toFixed(1)); c.setAttribute('visibility', 'visible'); });
    const wert = $('#vl-wert'), info = $('#vl-info');
    if (!wert || !info) return;
    if (!X.standard) X.standard = { wert: wert.innerHTML, info: info.innerHTML };
    wert.textContent = U.eur(a.reihen[a.haupt][i]);
    const andere = a.aktiv.filter(k => k !== a.haupt).map(k => X.NAMEN[k] + ' ' + U.eur(a.reihen[k][i]));
    info.textContent = U.datumDE(a.tage[i]) + (andere.length ? ': ' + andere.join(', ') : '');
  }
  function vlWeg() {
    if (!X.standard) return;
    const wert = $('#vl-wert'), info = $('#vl-info'), svg = $('#verlauf svg');
    if (wert && info) { wert.innerHTML = X.standard.wert; info.innerHTML = X.standard.info; }
    if (svg) svg.querySelectorAll('#vl-linie, .vl-punkt').forEach(c => c.setAttribute('visibility', 'hidden'));
    X.standard = null;
  }
  document.addEventListener('pointerdown', vlZeige);
  document.addEventListener('pointermove', vlZeige);
  document.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') vlWeg(); });
  document.addEventListener('pointercancel', vlWeg);
  document.addEventListener('pointerout', function (e) {
    if (!(e.target.closest && e.target.closest('#verlauf svg'))) return;
    if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('#verlauf svg')) return;
    vlWeg();
  });

  // ---------- Dateien ----------
  function importBank(inhalt, name) {
    const vorhandene = new Set(st.tx.map(t => t.key).filter(Boolean));
    const r = I.bank(inhalt, 'bank', vorhandene);
    if (r.fehler) return { ok: false, datei: name, text: 'Die Spalten wurden nicht erkannt. Gebraucht werden mindestens ein Datum und ein Betrag. Gefunden: ' + (r.kopf || []).slice(0, 8).join(', ') };
    let zusammen = 0;
    for (const t of r.neu) {
      t.konto = 'giro';
      // Von Hand eingetragene Buchung mit gleichem Betrag in den Tagen davor: zusammenführen statt doppelt zählen
      const hand = st.tx.find(x => x.quelle === 'manuell' && (x.konto || 'giro') === 'giro' && Math.abs(x.betrag - t.betrag) < 0.005 && Math.abs(U.tageZwischen(x.datum, t.datum)) <= 4);
      if (hand) { t.kat = hand.kat; t.notiz = hand.notiz; t.marke = hand.marke; t.einsatzId = hand.einsatzId; st.tx = st.tx.filter(x => x !== hand); zusammen++; }
      else t.kat = I.kategorie(t, st.regeln);
      st.tx.push(t);
    }
    const alt = st.meta.importe.bank;
    if (r.gelesen) st.meta.importe.bank = { zeit: new Date().toISOString(), anzahl: r.neu.length, bis: alt && alt.bis > r.bis ? alt.bis : r.bis };
    if (!r.gelesen) return { ok: false, datei: name, text: 'Die Datei enthält keine lesbaren Buchungen.' };
    return { ok: true, datei: name, text: 'Kontoumsätze vom ' + U.datumDE(r.von) + ' bis ' + U.datumDE(r.bis) + ': ' + r.neu.length + ' neue Buchungen übernommen' + (r.doppelt ? ', ' + r.doppelt + ' waren schon da' : '') + (zusammen ? ', ' + zusammen + ' von Hand eingetragene zusammengeführt' : '') + (r.vorgemerkt ? ', ' + r.vorgemerkt + ' vorgemerkte ausgelassen' : '') + (r.uebersprungen ? ', ' + r.uebersprungen + ' Zeilen nicht lesbar' : '') + '.' };
  }
  function importTr(inhalt, name) {
    const vorhandene = new Set(st.depots.tr.buchungen.map(b => b.id));
    const r = I.tr(inhalt, vorhandene);
    if (r.fehler) return { ok: false, datei: name, text: 'Das sieht nach Trade Republic aus, aber die Spalten date, type und amount fehlen.' };
    for (const b of r.neu) st.depots.tr.buchungen.push(b);
    const alt = st.meta.importe.tr;
    if (r.gelesen) st.meta.importe.tr = { zeit: new Date().toISOString(), anzahl: r.neu.length, bis: alt && alt.bis > r.bis ? alt.bis : r.bis };
    if (!r.gelesen) return { ok: false, datei: name, text: 'Die Datei enthält keine lesbaren Buchungen.' };
    const unbekannt = Object.keys(r.unbekannt);
    return { ok: true, datei: name, text: 'Trade Republic vom ' + U.datumDE(r.von) + ' bis ' + U.datumDE(r.bis) + ': ' + r.neu.length + ' neue Buchungen übernommen' + (r.doppelt ? ', ' + r.doppelt + ' waren schon da' : '') + '.' + (unbekannt.length ? ' Nicht zugeordnete Arten: ' + unbekannt.slice(0, 8).join(', ') + '.' : '') };
  }
  const DATEI = {
    csv: function (el) {
      const dateien = Array.from(el.files || []);
      if (!dateien.length) return;
      if (st.demo) { st = D.state = D.neu(); }
      const ergebnis = [];
      let kette = Promise.resolve();
      dateien.forEach(function (datei) {
        kette = kette.then(() => datei.arrayBuffer()).then(function (buf) {
          const inhalt = I.dekodieren(buf), art = I.erkennen(inhalt);
          if (art === 'tr') ergebnis.push(importTr(inhalt, datei.name));
          else if (art === 'bank') ergebnis.push(importBank(inhalt, datei.name));
          else ergebnis.push({ ok: false, datei: datei.name, text: art === 'leer' ? 'Die Datei ist leer.' : 'Das Format wurde nicht erkannt. Die App braucht eine CSV-Datei mit Datum und Betrag in Spalten.' });
        }).catch(() => { ergebnis.push({ ok: false, datei: datei.name, text: 'Die Datei konnte nicht gelesen werden.' }); });
      });
      kette.then(function () {
        ui.importErgebnis = ergebnis; ui.sub = { art: 'import' }; ui.ansicht = 'mehr';
        geaendert(true);
      });
    }
  };

  // ---------- Ereignisse ----------
  document.addEventListener('click', function (e) {
    const b = e.target.closest('[data-akt]');
    if (!b) { if (e.target.id === 'schleier') blattZu(); return; }
    const f = AKT[b.dataset.akt];
    if (f) f(b, e);
  });
  document.addEventListener('submit', function (e) {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    const h = FORM[f.dataset.form];
    if (h) h(f, new FormData(f));
  });
  document.addEventListener('change', function (e) {
    const el = e.target;
    if (el.dataset && el.dataset.wechsel && WECHSEL[el.dataset.wechsel]) WECHSEL[el.dataset.wechsel](el);
    if (el.dataset && el.dataset.datei && DATEI[el.dataset.datei]) DATEI[el.dataset.datei](el);
  });
  document.addEventListener('input', function (e) {
    if (e.target.dataset && e.target.dataset.eingabe === 'suche') { ui.filter.suche = e.target.value; ui.limit = 200; $('#txliste').innerHTML = V.txListe(st, ui); }
  });
  // Auswahl aus der Länderliste sofort übernehmen, nicht erst beim Verlassen des Feldes
  document.addEventListener('input', function (e) { if (e.target.dataset && e.target.dataset.wechsel === 'einsatz-land') landGewaehlt(e.target.value, false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#schleier').hidden) blattZu(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && st) D.jetztSpeichern().catch(() => {}); });

  // ---------- Start ----------
  D.laden().then(function (r) {
    if (r.status === 'gesperrt') { ui.gesperrt = true; zeichne(); return; }
    st = D.state;
    if (r.status === 'neu' && FA.VORSCHAU) st = D.state = D.beispiel(heute);
    G.leeren(); zeichne();
  }).catch(function () { st = D.state = D.neu(); zeichne(); });

  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* nicht überall erlaubt */ }
  if ('serviceWorker' in navigator && !FA.VORSCHAU && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})(window);
