/* Ansichten: erzeugen den Inhalt der Bereiche als HTML. Hier wird nichts gespeichert. */
(function (root) {
  'use strict';
  const FA = root.FA = root.FA || {};
  const U = FA.util, S = FA.steuer, G = FA.gehalt, E = FA.einsatz, A = FA.analyse, D = FA.daten;
  const V = FA.ansichten = FA.ansichten || {};
  const esc = U.esc, eur = U.eur, eur0 = U.eur0;

  const zl = (label, wert, kl, klein) => '<div class="zl ' + (kl || '') + '"><span>' + label + (klein ? '<small>' + klein + '</small>' : '') + '</span><span class="w">' + wert + '</span></div>';
  const vz = x => '<span class="' + (x > 0.004 ? 'plus' : x < -0.004 ? 'minus' : '') + '">' + U.eurVz(x) + '</span>';
  const prozent = x => U.num(Math.round(x * 10) / 10) + ' %';

  V.titel = function (ui) {
    if (ui.sub) return { einsatz: 'Einsatz', depots: 'Depots', gehalt: 'Gehalt und Zuschläge', kategorien: 'Kategorien und Regeln', import: 'Daten importieren', sicherung: 'Sicherung und Sperre', info: 'Datenschutz und Hilfe' }[ui.sub.art] || '';
    return { uebersicht: 'Übersicht', buchungen: 'Buchungen', einsaetze: 'Einsätze', steuer: 'Steuer', mehr: 'Mehr' }[ui.ansicht];
  };

  // ---------- Formularbausteine ----------
  const zf = (l, n, v, hilfe, attr) => '<label class="feld"><span>' + l + '</span><input id="f-' + n + '" name="' + n + '" type="text" inputmode="decimal" autocomplete="off" value="' + esc(U.zahlText(v)) + '" ' + (attr || '') + '>' + (hilfe ? '<small>' + hilfe + '</small>' : '') + '</label>';
  const tf = (l, n, v, typ, hilfe, attr) => '<label class="feld"><span>' + l + '</span><input id="f-' + n + '" name="' + n + '" type="' + (typ || 'text') + '" autocomplete="off" value="' + esc(v == null ? '' : v) + '" ' + (attr || '') + '>' + (hilfe ? '<small>' + hilfe + '</small>' : '') + '</label>';
  const sf = (l, n, optionen, aktuell, hilfe, attr) => '<label class="feld"><span>' + l + '</span><select id="f-' + n + '" name="' + n + '" ' + (attr || '') + '>' + optionen.map(o => '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(aktuell) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>' + (hilfe ? '<small>' + hilfe + '</small>' : '') + '</label>';
  const hf = (l, n, an, hilfe, attr) => '<label class="haken"><input id="f-' + n + '" name="' + n + '" type="checkbox"' + (an ? ' checked' : '') + ' ' + (attr || '') + '><span>' + l + (hilfe ? '<small>' + hilfe + '</small>' : '') + '</span></label>';
  V.felder = { zf: zf, tf: tf, sf: sf, hf: hf };

  const hinweisSteuer = '<p class="merk">Alle Steuer- und Abgabenwerte sind Vorschätzungen nach den veröffentlichten Formeln. Die Abrechnung deines Arbeitgebers und der Bescheid vom Finanzamt können abweichen. Das ist keine Steuer- oder Rechtsberatung.</p>';

  // ---------- Übersicht ----------
  function banner(st) {
    let h = '';
    if (FA.VORSCHAU) h += '<div class="banner"><span><strong>Vorschau' + (st.demo ? ' mit Beispieldaten' : '') + '.</strong> ' + (st.demo ? 'Alle Zahlen sind erfunden. ' : '') + 'Echte Daten gehören in die installierte App. Die Vorschau speichert nicht zuverlässig und kann keine Sicherung anlegen.</span></div>';
    else if (st.demo) h += '<div class="banner"><span><strong>Beispieldaten.</strong> Alle Zahlen hier sind erfunden und zeigen nur, wie die App arbeitet.</span><button class="knopf klein zweit" data-akt="demo-weg">Beispieldaten entfernen</button></div>';
    if (D.modus() === 'mem') h += '<div class="banner"><span><strong>Nichts wird gespeichert.</strong> Dieser Browser erlaubt hier keinen Speicher. Nach dem Schließen sind die Eingaben weg.</span></div>';
    return h;
  }

  function start() {
    return '<section><p class="aussage lang">Deine Finanzen und Serviceeinsätze an einem Ort.</p>' +
      '<p class="unter">Alles bleibt auf diesem Gerät. Die App liest nur mit, sie kann nichts überweisen oder abbuchen.</p></section>' +
      '<section><ul class="punkte">' +
      '<li><button data-akt="einrichten"><span><strong>Gehalt und Steuerdaten eintragen</strong><small>Damit rechnet die App Netto, Kirchensteuer und Einsätze aus. Dauert etwa zwei Minuten.</small></span><span class="pfeil">›</span></button></li>' +
      '<li><button data-akt="geh" data-art="import"><span><strong>Kontoumsätze importieren</strong><small>CSV-Datei der Sparkasse oder von Trade Republic auswählen.</small></span><span class="pfeil">›</span></button></li>' +
      '<li><button data-akt="demo-laden"><span><strong>Erst mit Beispieldaten ansehen</strong><small>Erfundene Zahlen zum Ausprobieren. Lassen sich mit einem Tipp wieder entfernen.</small></span><span class="pfeil">›</span></button></li>' +
      '</ul></section>';
  }

  function monatswahl(ym, ymH) {
    return '<div class="monatswahl"><button data-akt="monat" data-n="-1" aria-label="Monat zurück">‹</button><strong>' + U.monatName(ym) + '</strong><button data-akt="monat" data-n="1" aria-label="Monat vor"' + (ym >= ymH ? ' disabled' : '') + '>›</button></div>';
  }

  function nett(x) {
    if (!(x > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(x))), f = x / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }

  // Säulen: Einnahmen und Ausgaben je Monat
  function verlauf(st, ymEnde, n, ymSel) {
    const ms = [];
    for (let i = n - 1; i >= 0; i--) ms.push(A.monat(st, U.ymPlus(ymEnde, -i)));
    const max = Math.max.apply(null, ms.map(m => Math.max(m.ein, m.aus, 0)));
    if (!(max > 0)) return '';
    const B = 340, H = 176, l = 44, r = 6, o = 12, u = 24, iw = B - l - r, ih = H - o - u;
    const schritt = nett(max / 3), top = schritt * Math.ceil(max / schritt), gw = iw / n, bw = Math.min(16, (gw - 12) / 2);
    const y = v => o + ih - (v / top) * ih;
    let s = '<svg viewBox="0 0 ' + B + ' ' + H + '" role="img" aria-label="Einnahmen und Ausgaben der letzten ' + n + ' Monate">';
    for (let t = 0; t <= top + 0.001; t += schritt) s += '<line class="ach" x1="' + l + '" x2="' + (B - r) + '" y1="' + y(t).toFixed(1) + '" y2="' + y(t).toFixed(1) + '"/><text x="' + (l - 6) + '" y="' + (y(t) + 4).toFixed(1) + '" text-anchor="end">' + U.num(t) + '</text>';
    const saeule = function (x, v, kl, titel) {
      const h = Math.max(0, (v / top) * ih), yy = o + ih - h, rr = Math.min(4, h, bw / 2);
      if (h < 0.5) return '';
      return '<path class="' + kl + '" d="M' + x.toFixed(1) + ' ' + (o + ih) + 'V' + (yy + rr).toFixed(1) + 'Q' + x.toFixed(1) + ' ' + yy.toFixed(1) + ' ' + (x + rr).toFixed(1) + ' ' + yy.toFixed(1) + 'H' + (x + bw - rr).toFixed(1) + 'Q' + (x + bw).toFixed(1) + ' ' + yy.toFixed(1) + ' ' + (x + bw).toFixed(1) + ' ' + (yy + rr).toFixed(1) + 'V' + (o + ih) + 'Z"><title>' + esc(titel) + '</title></path>';
    };
    ms.forEach(function (m, i) {
      const x0 = l + i * gw + (gw - (2 * bw + 2)) / 2;
      s += saeule(x0, Math.max(0, m.ein), 'r1', U.monatName(m.ym) + ', Einnahmen: ' + eur(m.ein));
      s += saeule(x0 + bw + 2, Math.max(0, m.aus), 'r2', U.monatName(m.ym) + ', Ausgaben: ' + eur(m.aus));
      s += '<text class="' + (m.ym === ymSel ? 'wert' : '') + '" x="' + (l + i * gw + gw / 2).toFixed(1) + '" y="' + (H - 7) + '" text-anchor="middle">' + U.monatKurz(m.ym) + '</text>';
    });
    s += '</svg><div class="legende"><span><i class="l1"></i>Einnahmen</span><span><i class="l2"></i>Ausgaben</span></div>';
    const tab = '<details><summary>Zahlen als Tabelle</summary><div class="rollen"><table><thead><tr><th>Monat</th><th>Einnahmen</th><th>Ausgaben</th><th>Gespart</th><th>Übrig</th></tr></thead><tbody>' +
      ms.map(m => '<tr><td>' + U.monatName(m.ym) + '</td><td>' + eur(m.ein) + '</td><td>' + eur(m.aus) + '</td><td>' + eur(m.spar) + '</td><td>' + eur(m.uebrig) + '</td></tr>').join('') + '</tbody></table></div></details>';
    return '<section><h2>Monatsvergleich</h2><div class="tafel">' + s + '</div>' + tab + '</section>';
  }

  function kategorien(st, m, vor) {
    const keys = Object.keys(m.proKat).filter(k => m.proKat[k] > 0.004).sort((a, b) => m.proKat[b] - m.proKat[a]);
    if (!keys.length) return '';
    const max = m.proKat[keys[0]];
    return '<section><h2>Ausgaben nach Kategorie</h2><div class="balken">' + keys.map(function (k) {
      const v = m.proKat[k], alt = vor.proKat[k] || 0, diff = v - alt;
      const vergleich = vor.anzahl ? '<small>' + (Math.abs(diff) < 1 ? 'wie im ' + U.monatNur(vor.ym) : (diff > 0 ? '+' : '−') + eur0(Math.abs(diff)).replace('-', '') + ' zum ' + U.monatNur(vor.ym)) + '</small>' : '';
      return '<button class="bz text-knopf" data-akt="kat-zeigen" data-kat="' + esc(k) + '" style="font-weight:400;color:inherit"><span class="n">' + esc(A.katName(st, k)) + vergleich + '</span><span class="w">' + eur(v) + '</span><span class="spur"><i style="width:' + Math.max(1, v / max * 100).toFixed(1) + '%"></i></span></button>';
    }).join('') + '</div></section>';
  }

  function wochen(st, ym) {
    const w = A.wochen(st, ym), max = Math.max.apply(null, w.map(x => x.summe));
    if (!(max > 0)) return '';
    return '<section><h2>Ausgaben je Woche</h2><div class="balken">' + w.map(x => '<div class="bz"><span class="n">' + (x.von === x.bis ? U.datumKurz(x.von) : U.datumKurz(x.von) + ' bis ' + U.datumKurz(x.bis)) + '</span><span class="w">' + eur(x.summe) + '</span><span class="spur"><i style="width:' + (x.summe / max * 100).toFixed(1) + '%"></i></span></div>').join('') + '</div></section>';
  }

  function txZeile(st, t) {
    return '<button class="tx" data-akt="tx" data-id="' + esc(t.id) + '"><span class="wer">' + esc(t.gegen || t.text || 'Ohne Text') + '</span><span class="was"><span class="chip">' + esc(A.katName(st, t.kat)) + '</span>' + esc(t.gegen ? t.text : '') + '</span><span class="w ' + (t.betrag > 0 ? 'plus' : '') + '">' + U.eurVz(t.betrag) + '</span></button>';
  }

  function datenstand(st) {
    const i = st.meta.importe || {}, z = [];
    const zeit = iso => iso ? U.datumDE(iso.slice(0, 10)) : '';
    z.push(zl('Girokonto', i.bank ? 'Buchungen bis ' + U.datumDE(i.bank.bis) : 'noch kein Import', '', i.bank ? 'zuletzt importiert am ' + zeit(i.bank.zeit) : ''));
    z.push(zl('Trade Republic', i.tr ? 'Buchungen bis ' + U.datumDE(i.tr.bis) : 'noch kein Import', '', i.tr ? 'zuletzt importiert am ' + zeit(i.tr.zeit) : ''));
    const sc = st.depots.sc.werte;
    z.push(zl('Scalable Capital', sc.length ? 'Depotwert vom ' + U.datumDE(sc[sc.length - 1].datum) : 'noch kein Depotwert', '', 'wird von Hand eingetragen'));
    z.push(zl('Sicherung', st.meta.sicherung ? 'vom ' + zeit(st.meta.sicherung) : 'noch keine'));
    return '<section><h2>Datenstand</h2><div class="buch">' + z.join('') + '</div><div class="knoepfe"><button class="knopf zweit" data-akt="geh" data-art="import">Daten importieren</button></div></section>';
  }

  V.h = { zl: zl, vz: vz, prozent: prozent, banner: banner, start: start, monatswahl: monatswahl, verlauf: verlauf, wochen: wochen, txZeile: txZeile, hinweisSteuer: hinweisSteuer };

  // ---------- Buchungen ----------
  V.txListe = function (st, ui) {
    const f = ui.filter, such = U.norm(f.suche);
    let liste = st.tx.filter(function (t) {
      if (f.monat !== 'alle' && t.datum.slice(0, 7) !== f.monat) return false;
      if (f.kat !== 'alle' && t.kat !== f.kat) return false;
      if (such && U.norm(t.gegen + ' ' + t.text).indexOf(such) < 0) return false;
      return true;
    });
    liste.sort((a, b) => a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0);
    if (!liste.length) return '<p class="unter">' + (st.tx.length ? 'Keine Buchung passt zu diesem Filter.' : 'Noch keine Buchungen. Importiere eine CSV-Datei deiner Bank oder trag eine Ausgabe von Hand ein.') + '</p>';
    const summe = liste.reduce((s, t) => s + (A.txTyp(st, t) === 'neutral' ? 0 : t.betrag), 0);
    const sicht = liste.slice(0, ui.limit);
    let h = '<p class="unter">' + liste.length + (liste.length === 1 ? ' Buchung' : ' Buchungen') + ', zusammen ' + U.eurVz(summe) + '</p><div class="liste">', tag = '';
    for (const t of sicht) {
      if (t.datum !== tag) { tag = t.datum; h += '<div class="tag">' + ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'][U.wochentag(tag)] + ', ' + U.datumDE(tag) + '</div>'; }
      h += txZeile(st, t);
    }
    h += '</div>';
    if (liste.length > sicht.length) h += '<button class="knopf zweit" data-akt="mehr-zeigen">Weitere ' + Math.min(200, liste.length - sicht.length) + ' anzeigen</button>';
    return h;
  };

  V.buchungen = function (st, ui) {
    const monate = A.monateMitDaten(st).reverse();
    return '<section>' +
      '<div class="filter"><select id="filter-monat" data-wechsel="filter" name="monat" aria-label="Monat"><option value="alle">Alle Monate</option>' + monate.map(m => '<option value="' + m + '"' + (ui.filter.monat === m ? ' selected' : '') + '>' + U.monatName(m) + '</option>').join('') + '</select>' +
      '<select id="filter-kat" data-wechsel="filter" name="kat" aria-label="Kategorie"><option value="alle">Alle Kategorien</option>' + st.kategorien.map(k => '<option value="' + esc(k.id) + '"' + (ui.filter.kat === k.id ? ' selected' : '') + '>' + esc(k.name) + '</option>').join('') + '</select>' +
      '<input id="filter-suche" class="suche" type="search" data-eingabe="suche" placeholder="Suchen" aria-label="Suchen" value="' + esc(ui.filter.suche) + '"></div>' +
      '<div id="txliste">' + V.txListe(st, ui) + '</div></section>';
  };

  // ---------- Einsätze ----------
  V.einsaetze = function (st, ui) {
    let h = '';
    if (!G.hatGehalt(st)) h += '<div class="banner"><span>Ohne Gehalt kann die App keinen Stundensatz und kein Netto ausrechnen.</span><button class="knopf klein" data-akt="einrichten">Gehalt eintragen</button></div>';
    h += '<section><div class="knoepfe"><button class="knopf" data-akt="einsatz-neu">Einsatz berechnen</button></div>';
    const liste = st.einsaetze.map(e => E.berechne(e, st)).sort((a, b) => a.start < b.start ? 1 : -1);
    if (!liste.length) {
      h += '<p class="unter">Trag Ort, Zeitraum und Spesen ein. Die App rechnet aus, was der Einsatz netto bringt, wann das Geld kommt und wie viel du vorstrecken musst.</p></section>';
      return h;
    }
    const jahre = {};
    liste.forEach(r => { const j = (r.ende || r.start).slice(0, 4); (jahre[j] = jahre[j] || []).push(r); });
    h += '</section>';
    Object.keys(jahre).sort().reverse().forEach(function (j) {
      const l = jahre[j], summe = l.reduce((s, r) => s + r.gesamt, 0);
      h += '<section><h2>' + j + '</h2><p class="unter">' + l.length + (l.length === 1 ? ' Einsatz' : ' Einsätze') + ', zusammen ' + U.eurVz(summe) + ' gegenüber normalen Monaten.</p><ul class="punkte">' +
        l.map(r => '<li><button data-akt="einsatz" data-id="' + esc(r.id) + '"><span><strong>' + esc(r.titel) + '</strong><small>' + U.datumDE(r.start) + ' bis ' + U.datumDE(r.ende) + ', ' + r.tage + ' Tage, ' + U.eurVz(r.proTag) + ' pro Tag</small></span><span class="w ' + (r.gesamt >= 0 ? 'plus' : 'minus') + '">' + U.eurVz(r.gesamt) + '</span></button></li>').join('') + '</ul></section>';
    });
    return h;
  };

  V.einsatz = function (st, id) {
    const e = st.einsaetze.find(x => x.id === id);
    if (!e) return '<p class="unter">Dieser Einsatz existiert nicht mehr.</p>';
    const r = E.berechne(e, st);
    const ort = [e.stadt, String(e.land || '').replace(' – im Übrigen', '')].filter(Boolean).join(', ');
    let h = '<section><p class="unter">' + esc(r.titel) + (ort && ort !== r.titel ? ', ' + esc(ort) : '') + '. ' + U.datumDE(r.start) + ' bis ' + U.datumDE(r.ende) + ', ' + r.tage + ' Tage.</p>';
    const mitSparen = r.ersparnis > 0 || r.wegErsparnis > 0;
    if (mitSparen) h += '<p class="aussage lang">' + (r.gesamt >= 0 ? 'Unterm Strich bringt dir der Einsatz voraussichtlich ' + eur0(r.gesamt) + '.' : 'Unterm Strich kostet dich der Einsatz voraussichtlich ' + eur0(-r.gesamt) + '.') + ' ' + V.i('einsatz') + '</p>';
    else h += '<p class="aussage lang">' + (r.plus >= 0 ? 'Der Einsatz bringt dir voraussichtlich ' + eur0(r.plus) + ' mehr als ein normaler Monat.' : 'Der Einsatz kostet dich voraussichtlich ' + eur0(-r.plus) + ' mehr, als er einbringt.') + ' ' + V.i('einsatz') + '</p>';
    if (r.ohneGehalt) h += '<div class="banner"><span>Es ist kein Gehalt eingetragen. Zuschläge und Mehrstunden fehlen deshalb in der Rechnung.</span><button class="knopf klein" data-akt="einrichten">Gehalt eintragen</button></div>';
    h += '<div class="buch">' + zl('Mehr Netto durch Zuschläge und Mehrstunden', vz(r.zusatzNetto)) + zl('Spesen und Erstattungen, steuerfrei', vz(r.spesenSteuerfrei)) + zl('Deine eigenen Kosten', vz(-r.eigeneKosten)) + zl('Plus durch den Einsatz', vz(r.plus), 'summe') + '</div>';
    if (r.ersparnis > 0 || r.wegKm > 0) {
      const sp = [];
      if (r.wegKm > 0) sp.push(zl('Ersparter Arbeitsweg', r.wegKosten > 0 ? vz(r.wegErsparnis) : 'Kosten je km fehlen', '', r.wegTage + ' Tage mal ' + U.num(r.wegKm) + ' km sind ' + U.num(r.wegGesamtKm) + ' km' + (r.wegKosten > 0 ? ', zu ' + eur(r.wegKosten) + ' je km' : '')));
      if (r.ersparnis > 0) sp.push(zl('Ersparte Ausgaben zu Hause', vz(r.ersparnis), '', r.tage + ' Tage'));
      if (r.wegSteuer > 0) sp.push(zl('Weniger Steuererstattung', vz(-r.wegSteuer), '', 'Die Pendlerpauschale entfällt an diesen ' + r.wegTage + ' Tagen'));
      sp.push(zl('Unterm Strich', vz(r.gesamt), 'summe'));
      h += '<h3>Was du zu Hause sparst</h3><div class="buch">' + sp.join('') + '</div>';
    }
    h += '</section>';

    h += '<section><h2>Arbeitszeit</h2><div class="buch">' +
      zl(r.moFr + ' Werktage zu ' + U.num(r.hW) + ' Stunden', U.num(r.moFr * r.hW) + ' Std.') +
      (r.sa ? zl(r.sa + (r.sa === 1 ? ' Samstag' : ' Samstage') + ' zu ' + U.num(r.hSa) + ' Stunden', U.num(r.sa * r.hSa) + ' Std.') : '') +
      (r.so ? zl(r.so + (r.so === 1 ? ' Sonntag' : ' Sonntage') + ' zu ' + U.num(r.hSo) + ' Stunden', U.num(r.so * r.hSo) + ' Std.') : '') +
      zl('Stunden auf dem Einsatz', U.num(r.stunden) + ' Std.', 'summe') +
      zl('Normale Arbeitszeit in dieser Zeit', U.num(r.soll) + ' Std.', '', r.moFr + ' Werktage zu ' + U.num(r.wochenstunden / 5) + ' Stunden') +
      zl('Mehrstunden', U.num(r.mehr) + ' Std.') + '</div></section>';

    h += '<section><h2>Lohn</h2><div class="buch">' +
      zl('Zuschlag ' + U.num(r.zProz) + ' % auf ' + U.num(r.stunden) + ' Stunden', eur(r.zuschlagBetrag), '', 'Stundensatz ' + eur(r.satz)) +
      zl('Mehrstunden ausbezahlt', eur(r.mehrBetrag), '', U.num(r.mehr) + ' Std. zu ' + eur(r.satz) + (r.ueZ ? ' plus ' + U.num(r.ueZ) + ' % Überstundenzuschlag' : '')) +
      zl('Zusätzliches Brutto', eur(r.zusatzBrutto), 'summe') +
      zl('Steuern und Sozialabgaben darauf', eur(-r.abzuege)) +
      zl('Zusätzliches Netto', eur(r.zusatzNetto), 'summe') + '</div>' +
      (r.zusatzBrutto > 0 ? '<p class="unter">Von jedem zusätzlichen Euro bleiben dir etwa ' + Math.round(r.bleibtProEuro * 100) + ' Cent. Der Zusatzlohn fällt in einem Monat an und wird deshalb höher besteuert. Einen Teil davon holst du über die Steuererklärung zurück.</p>' : '') + '</section>';

    const sp = [];
    if (r.vmaAnspruch > 0) sp.push(zl('Verpflegung', r.vmaVomAg ? eur(r.verpflegung) : 'nicht vom Arbeitgeber', '', r.volleTage + ' volle Tage zu ' + eur(r.vmaVoll) + ', ' + r.reisetage + ' Reisetage zu ' + eur(r.vmaTeil) + (r.vmaKuerzung > 0 ? ', abzüglich ' + eur(r.vmaKuerzung) + ' für Frühstück' : '') + (r.vmaVomAg ? '' : '. ' + eur(r.vmaAnspruch) + ' kannst du in der Steuererklärung ansetzen')));
    if (r.unterkunftErst > 0) sp.push(zl('Unterkunft', eur(r.unterkunftErst), '', r.naechte + ' Nächte'));
    if (r.kmErst > 0) sp.push(zl('Fahrt mit dem eigenen Auto', eur(r.kmErst), '', U.num(r.km) + ' km'));
    if (r.postenErst > 0) sp.push(zl('Erstattete Auslagen', eur(r.postenErst)));
    if (sp.length) h += '<section><h2>Spesen vom Arbeitgeber</h2><div class="buch">' + sp.join('') + zl('Spesen zusammen', eur(r.spesenSteuerfrei), 'summe') + '</div></section>';

    const ko = [];
    if (r.unterkunftKosten > 0) ko.push(zl('Unterkunft', eur(r.unterkunftKosten), '', r.naechte + ' Nächte'));
    if (r.kmEigen > 0) ko.push(zl('Fahrt mit dem eigenen Auto', eur(r.kmEigen), '', U.num(r.km) + ' km'));
    r.posten.forEach(p => ko.push(zl(esc(p.name || 'Auslage'), eur(p.betrag), '', p.erstattet ? 'wird erstattet' : 'trägst du selbst')));
    if (r.vorOrt > 0) ko.push(zl('Ausgaben vor Ort', eur(r.vorOrt), '', r.tage + ' Tage'));
    if (ko.length) h += '<section><h2>Deine Kosten</h2>' + (r.kurs !== 1 ? '<p class="unter">Umgerechnet mit 1 EUR = ' + U.num(r.kurs) + ' ' + esc(r.waehrung) + '.</p>' : '') + '<div class="buch">' + ko.join('') + zl('Kosten zusammen', eur(r.eigeneKosten), 'summe') + '</div></section>';

    if (r.fluss.length) {
      h += '<section><h2>Wann das Geld fließt</h2><div class="buch">' + r.fluss.map(f => zl(f.bis ? U.datumDE(f.datum) + ' bis ' + U.datumDE(f.bis) : U.datumDE(f.datum), vz(f.betrag), '', esc(f.text))).join('') + '</div>' +
        '<p class="unter">' + (r.eigeneKosten > 0 ? 'Du streckst ' + eur0(r.eigeneKosten) + ' vor. ' : '') + (r.letzteZahlung ? 'Das letzte Geld aus diesem Einsatz kommt voraussichtlich am ' + U.datumDE(r.letzteZahlung) + '.' : '') + '</p></section>';
    }
    if (r.teile.length && r.zusatzBrutto > 0) {
      h += '<section><h2>Vergleich mit einem normalen Monat</h2><div class="rollen"><table><thead><tr><th>Auszahlung</th><th>Netto normal</th><th>Netto mit Einsatz</th><th>Unterschied</th></tr></thead><tbody>' +
        r.teile.map(t => '<tr><td>' + U.monatName(t.zahlYm) + '</td><td>' + eur(t.nettoOhne) + '</td><td>' + eur(t.nettoMit) + '</td><td>' + U.eurVz(t.netto) + '</td></tr>').join('') + '</tbody></table></div></section>';
    }
    const zug = st.tx.filter(t => t.einsatzId === e.id);
    if (zug.length) h += '<section><h2>Zugeordnete Buchungen</h2><p class="unter">' + zug.length + (zug.length === 1 ? ' Buchung' : ' Buchungen') + ', zusammen ' + U.eurVz(zug.reduce((s, t) => s + t.betrag, 0)) + '. Sie stehen zur Übersicht hier und ändern die Rechnung nicht.</p><div class="liste">' + zug.map(t => txZeile(st, t)).join('') + '</div></section>';
    const ann = [
      'Stundensatz ' + eur(r.satz) + ' aus Grundgehalt geteilt durch ' + U.num(r.wochenstunden) + ' Wochenstunden mal 4,348 Wochen, falls kein fester Satz eingetragen ist.',
      'Der Zuschlag von ' + U.num(r.zProz) + ' % gilt für jede Stunde auf dem Einsatz und ist voll steuer- und beitragspflichtig.',
      'Mehrstunden werden ausbezahlt und landen nicht auf dem Stundenkonto.',
      'Der Zusatzlohn wird ' + (r.verzug === 0 ? 'im selben Monat' : r.verzug === 1 ? 'einen Monat später' : r.verzug + ' Monate später') + ' mit dem Gehalt ausgezahlt, die Spesen mit der letzten Abrechnung.',
      'Verpflegungspauschalen bleiben steuerfrei, solange sie die amtlichen Sätze nicht übersteigen. Die Sätze stammen aus der amtlichen Tabelle ' + FA.SPESEN.jahr + ' (' + FA.SPESEN.quelle + ').',
      'Sozialabgaben nur bis zur Beitragsbemessungsgrenze, Steuer nach der Monatstabelle.'
    ];
    if (r.wegKm > 0) ann.push('Ersparter Arbeitsweg: An ' + r.wegTage + ' Tagen fährst du nicht zur Firma. Gerechnet wird mit deinen eigenen Kosten je Kilometer.' + (r.wegSteuer > 0 ? ' Dafür entfallen ' + eur(r.wegAbzug) + ' Pendlerpauschale (38 Cent je Kilometer einfacher Strecke), bewertet mit deinem Steuersatz.' : ''));
    if (r.werbungskosten > 0) ann.push('Nicht erstattete Kosten von ' + eur(r.werbungskosten) + ' fließen in die Schätzung der Steuererklärung ' + r.wkJahr + ' ein.');
    h += '<section><details><summary>Annahmen dieser Rechnung</summary><ul>' + ann.map(a => '<li>' + a + '</li>').join('') + '</ul></details>' + (e.notiz ? '<p class="unter">Notiz: ' + esc(e.notiz) + '</p>' : '') + hinweisSteuer +
      '<div class="knoepfe"><button class="knopf" data-akt="einsatz-bearbeiten" data-id="' + esc(e.id) + '">Bearbeiten</button><button class="knopf gefahr" data-akt="einsatz-loeschen" data-id="' + esc(e.id) + '">Löschen</button></div></section>';
    return h;
  };

  // ---------- Steuer ----------
  V.steuer = function (st, ui) {
    if (!G.hatGehalt(st)) return '<section><p class="aussage lang">Für die Steuerrechnung fehlt noch dein Gehalt.</p><p class="unter">Mit Bruttogehalt, Steuerklasse und Bundesland rechnet die App Lohnsteuer, Kirchensteuer und Sozialabgaben aus und schätzt deine Steuererklärung.</p><div class="knoepfe"><button class="knopf" data-akt="einrichten">Gehalt und Steuerdaten eintragen</button></div></section>';
    const heute = U.heute(), jahr = ui.steuerJahr, plan = G.plan(st, jahr), o = plan.o, w = plan.w;
    const ym = ui.steuerMonat && ui.steuerMonat.slice(0, 4) === String(jahr) ? ui.steuerMonat : (heute.slice(0, 4) === String(jahr) ? heute.slice(0, 7) : jahr + '-01');
    const m = plan.monate[Number(ym.slice(5, 7)) - 1], a = m.abr;
    const jahre = [];
    for (let j = Number(heute.slice(0, 4)) - 2; j <= Number(heute.slice(0, 4)) + 1; j++) jahre.push([j, String(j)]);
    let h = '<section><div class="filter"><select id="steuer-jahr" data-wechsel="steuer-jahr" aria-label="Jahr">' + jahre.map(x => '<option value="' + x[0] + '"' + (x[0] === Number(jahr) ? ' selected' : '') + '>' + x[1] + '</option>').join('') + '</select>' +
      '<select id="steuer-monat" data-wechsel="steuer-monat" aria-label="Monat">' + plan.monate.map(x => '<option value="' + x.ym + '"' + (x.ym === ym ? ' selected' : '') + '>' + U.monatNur(x.ym) + '</option>').join('') + '</select></div>';
    if (w.ersatz) h += '<div class="banner"><span>Für ' + jahr + ' sind keine eigenen Steuerwerte hinterlegt. Gerechnet wird mit den Werten von ' + w.jahr + '.</span></div>';
    h += '<p class="aussage lang">Im ' + U.monatNur(ym) + ' kommen voraussichtlich ' + eur0(m.auszahlung) + ' aufs Konto. ' + V.i('netto') + '</p></section>';

    const z = [];
    m.teile.filter(t => t.art !== 'einmal').forEach(t => z.push(zl(esc(t.name), eur(t.betrag))));
    if (m.zusatz > 0) z.push(zl('Zuschläge und Mehrstunden', eur(m.zusatz), '', 'aus: ' + esc(m.einsaetze.join(', '))));
    m.teile.filter(t => t.art === 'einmal').forEach(t => z.push(zl(esc(t.name), eur(t.betrag), '', 'Einmalzahlung')));
    z.push(zl('Brutto', eur(a.brutto), 'summe'));
    z.push(zl('Lohnsteuer', eur(-a.lst)));
    if (o.kirchensteuer) z.push(zl('Kirchensteuer', eur(-a.kist), '', U.num(o.kistSatz) + ' % der Lohnsteuer'));
    if (a.soli > 0) z.push(zl('Solidaritätszuschlag', eur(-a.soli)));
    z.push(zl('Rentenversicherung', eur(-a.rv), '', '9,3 %'));
    z.push(zl('Krankenversicherung', eur(-a.kv), '', '7,3 % plus halber Zusatzbeitrag von ' + U.num(S.kvZusatz(o, w)) + ' %' + (o.kvZusatz == null ? ' (Durchschnitt)' : '')));
    z.push(zl('Pflegeversicherung', eur(-a.pv), '', prozent(S.pvSatzAn(o, w) * 100).replace(' %', '') + ' %'));
    z.push(zl('Arbeitslosenversicherung', eur(-a.av), '', '1,3 %'));
    z.push(zl('Netto', eur(a.netto), 'summe'));
    if (m.abzug > 0) z.push(zl('Sonstige Abzüge', eur(-m.abzug)));
    if (m.spesen > 0) z.push(zl('Spesen, steuerfrei', eur(m.spesen)));
    if (m.abzug > 0 || m.spesen > 0) z.push(zl('Auszahlung', eur(m.auszahlung), 'summe'));
    h += '<section><h2>' + U.monatName(ym) + '</h2><div class="buch">' + z.join('') + '</div><p class="unter">Voraussichtlich auf dem Konto am ' + U.datumDE(m.datum) + '. Steuerklasse ' + o.steuerklasse + ', ' + (o.kirchensteuer ? 'mit' : 'ohne') + ' Kirchensteuer.</p>' +
      '<div class="knoepfe"><button class="knopf zweit" data-akt="geh" data-art="gehalt">Gehalt und Steuerdaten ändern</button></div></section>';

    // Jahr
    const s = plan.summen;
    h += '<section><h2>Das Jahr ' + jahr + '</h2><details><summary>Alle zwölf Monate anzeigen</summary><div class="rollen"><table><thead><tr><th>Monat</th><th>Brutto</th><th>Steuern</th><th>Sozialabgaben</th><th>Netto</th><th>Spesen</th></tr></thead><tbody>' +
      plan.monate.map(x => '<tr' + (x.ym === ym ? ' class="jetzt"' : '') + '><td>' + U.monatNur(x.ym) + '</td><td>' + eur0(x.abr.brutto) + '</td><td>' + eur0(x.abr.steuern) + '</td><td>' + eur0(x.abr.sv) + '</td><td>' + eur0(x.abr.netto) + '</td><td>' + (x.spesen ? eur0(x.spesen) : '') + '</td></tr>').join('') +
      '<tr class="summe"><td>Summe</td><td>' + eur0(s.brutto) + '</td><td>' + eur0(s.steuern) + '</td><td>' + eur0(s.sv) + '</td><td>' + eur0(s.netto) + '</td><td>' + (plan.spesen ? eur0(plan.spesen) : '') + '</td></tr></tbody></table></div></details>' +
      '<p class="unter">Von ' + eur0(s.brutto) + ' Brutto gehen ' + eur0(s.lst + s.soli) + ' an Lohnsteuer' + (o.kirchensteuer ? ', ' + eur0(s.kist) + ' an Kirchensteuer' : '') + ' und ' + eur0(s.sv) + ' an Sozialabgaben weg. Das sind zusammen ' + prozent((s.steuern + s.sv) / (s.brutto || 1) * 100) + '.</p></section>';

    // Steuererklärung
    const er = st.erstattung || {};
    const wkEinsatz = st.einsaetze.map(e => E.grund(e, st)).filter(r => r.wkJahr === Number(jahr)).reduce((x, r) => x + r.werbungskosten, 0);
    const wkFahrt = (er.km || 0) * (er.tage || 0) * w.entfernungspauschale;
    const wkSumme = wkFahrt + wkEinsatz + (er.weitereWk || 0);
    const v = S.veranlagung({ jahr: jahr, o: o, brutto: s.brutto, lst: s.lst, soli: s.soli, kist: s.kist, rv: s.rv, av: s.av, kv: s.kv, pv: s.pv, werbungskosten: wkSumme, spenden: er.spenden || 0 });

    if (o.kirchensteuer) {
      h += '<section><h2>Kirchensteuer</h2><div class="buch">' + zl('Gezahlt im Jahr ' + jahr, eur(s.kist), '', 'im Schnitt ' + eur(s.kist / 12) + ' pro Monat') + zl('Zurück über die Steuererklärung', eur(v.kistVorteil), '', 'Kirchensteuer zählt als Sonderausgabe') + zl('Was sie dich wirklich kostet', eur(s.kist - v.kistVorteil), 'summe') + '</div></section>';
    }

    const e2 = [];
    e2.push(zl('Bruttolohn', eur(s.brutto)));
    e2.push(zl('Werbungskosten', eur(-v.wk), '', v.wkPauschale ? 'Pauschbetrag, deine eigenen Kosten von ' + eur(v.wkEchte) + ' liegen darunter' : 'Arbeitsweg ' + eur(wkFahrt) + ', Einsätze ' + eur(wkEinsatz) + ', weitere ' + eur(er.weitereWk || 0)));
    e2.push(zl('Vorsorge', eur(-v.vorsorge), '', 'Renten-, Kranken- und Pflegeversicherung'));
    e2.push(zl('Sonderausgaben', eur(-v.sonderausgaben), '', o.kirchensteuer ? 'Kirchensteuer und Spenden' : 'Spenden oder Pauschbetrag'));
    e2.push(zl('Zu versteuerndes Einkommen', eur(v.zvE), 'summe'));
    e2.push(zl('Einkommensteuer darauf', eur(v.est)));
    e2.push(zl('Schon gezahlte Lohnsteuer', eur(s.lst)));
    e2.push(zl('Lohnsteuer zurück', vz(v.erstLst)));
    if (o.kirchensteuer) e2.push(zl('Kirchensteuer zurück', vz(v.erstKist)));
    if (v.erstSoli) e2.push(zl('Solidaritätszuschlag zurück', vz(v.erstSoli)));
    e2.push(zl(v.erstattung >= 0 ? 'Voraussichtliche Erstattung' : 'Voraussichtliche Nachzahlung', vz(v.erstattung), 'summe'));
    h += '<section><h2>Steuererklärung ' + jahr + '</h2><p class="aussage lang">' + (v.erstattung >= 0 ? 'Über die Steuererklärung bekommst du etwa ' + eur0(v.erstattung) + ' zurück.' : 'Bei der Steuererklärung musst du mit etwa ' + eur0(-v.erstattung) + ' Nachzahlung rechnen.') + ' ' + V.i('erstattung') + '</p>' +
      '<div class="buch">' + e2.join('') + '</div>' +
      '<p class="unter">Jeder weitere Euro Werbungskosten bringt dir etwa ' + Math.round(v.grenzsteuersatz * (1 + (o.kirchensteuer ? o.kistSatz / 100 : 0)) * 100) + ' Cent zurück.</p>' +
      '<form data-form="erstattung" class="kasten"><h3 style="font-size:var(--text)">Deine Angaben für die Schätzung</h3><div class="gitter">' +
      zf('Arbeitsweg, einfache Strecke in km', 'km', er.km || 0) + zf('Tage im Betrieb pro Jahr', 'tage', er.tage || 0, 'ohne Einsatz-, Urlaubs- und Krankheitstage') + zf('Weitere Werbungskosten in €', 'weitereWk', er.weitereWk || 0, 'Werkzeug, Arbeitskleidung, Fortbildung, Gewerkschaft') + zf('Spenden in €', 'spenden', er.spenden || 0) +
      '</div><div class="knoepfe"><button class="knopf" type="submit">Neu rechnen</button></div></form>' +
      '<details><summary>Annahmen dieser Schätzung</summary><ul>' +
      '<li>Grundlage sind deine Gehaltsdaten und die eingetragenen Einsätze für ' + jahr + ', nicht die echte Lohnsteuerbescheinigung.</li>' +
      '<li>Arbeitsweg mit ' + U.num(w.entfernungspauschale * 100) + ' Cent je Kilometer und Tag. Kosten, die der Arbeitgeber bei Einsätzen nicht erstattet, sind eingerechnet.</li>' +
      '<li>Macht dein Arbeitgeber im Dezember einen Lohnsteuer-Jahresausgleich, bekommst du einen Teil der Erstattung schon mit dem Dezembergehalt.</li>' +
      '<li>Nicht berücksichtigt: Kapitalerträge, weitere Einkünfte, Kinderfreibeträge, außergewöhnliche Belastungen, Handwerkerleistungen.</li></ul></details>' + hinweisSteuer + '</section>';
    return h;
  };

  // ---------- Mehr ----------
  V.gehalt = function (st) {
    const heute = U.heute(), a = st.arbeit, s = st.steuer;
    const artName = { grund: 'Grundgehalt', zulage: 'Monatliche Zulage', einmal: 'Einmalzahlung' };
    const liste = st.gehalt.slice().sort((x, y) => x.art === y.art ? (x.ab < y.ab ? 1 : -1) : (['grund', 'zulage', 'einmal'].indexOf(x.art) - ['grund', 'zulage', 'einmal'].indexOf(y.art)));
    let h = '<section><h2>Gehaltsbausteine</h2><p class="unter">Jeder Baustein gilt ab einem Datum. Eine Lohnerhöhung ist einfach ein neues Grundgehalt mit späterem Datum. Die Zeit davor bleibt unverändert.</p>';
    if (liste.length) h += '<ul class="punkte">' + liste.map(b => '<li><button data-akt="baustein" data-id="' + esc(b.id) + '"><span><strong>' + esc(b.name || artName[b.art]) + '</strong><small>' + artName[b.art] + ', gültig ab ' + U.datumDE(b.ab) + (b.bis ? ' bis ' + U.datumDE(b.bis) : '') + (b.art === 'einmal' ? ', jedes Jahr im ' + U.MONATE[(b.monat || 1) - 1] : '') + '</small></span><span class="w">' + eur(b.betrag) + '</span></button></li>').join('') + '</ul>';
    h += '<div class="knoepfe"><button class="knopf" data-akt="baustein" data-neu="grund">Lohnerhöhung eintragen</button><button class="knopf zweit" data-akt="baustein" data-neu="einmal">Weihnachtsgeld oder Prämie</button><button class="knopf zweit" data-akt="baustein" data-neu="zulage">Monatliche Zulage</button></div></section>';
    const satz = G.stundensatz(st, heute.slice(0, 7));
    h += '<section><h2>Arbeitszeit und Einsätze</h2><div class="buch">' +
      zl('Wochenstunden laut Vertrag', U.num(a.wochenstunden)) + zl('Stundensatz', satz ? eur(satz) : 'offen', '', a.stundensatz > 0 ? 'fest eingetragen' : 'aus dem Grundgehalt berechnet') +
      zl('Zuschlag im Inland', U.num(a.zuschlagInland) + ' %') + zl('Zuschlag im Ausland', U.num(a.zuschlagAusland) + ' %') +
      zl('Stunden auf Einsatz', U.num(a.stdWerktag) + ' werktags, ' + U.num(a.stdSamstag) + ' samstags') +
      zl('Auszahlung der Einsatz-Anteile', a.verzugMonate ? a.verzugMonate + (a.verzugMonate === 1 ? ' Monat später' : ' Monate später') : 'im selben Monat') +
      zl('Gehaltseingang', a.gehaltstag > 0 ? 'am ' + a.gehaltstag + '. des Monats' : 'am letzten Banktag des Monats') +
      (a.nettoAbzug > 0 ? zl('Sonstige Abzüge vom Netto', eur(a.nettoAbzug)) : '') + '</div><div class="knoepfe"><button class="knopf zweit" data-akt="arbeit">Ändern</button></div></section>';
    const bl = (FA.BUNDESLAENDER.find(x => x[0] === s.bundesland) || [])[1];
    h += '<section><h2>Steuerdaten</h2><div class="buch">' + zl('Steuerklasse', s.steuerklasse) + zl('Bundesland', bl || 'nicht gewählt') + zl('Kirchensteuer', s.kirchensteuer ? 'ja' : 'nein') + zl('Kinder', s.kinder || 0) +
      zl('Zusatzbeitrag der Krankenkasse', (s.kvZusatz == null || s.kvZusatz === '') ? 'Durchschnitt' : U.num(s.kvZusatz) + ' %') + '</div><div class="knoepfe"><button class="knopf zweit" data-akt="steuerdaten">Ändern</button></div></section>';
    return h;
  };

  V.kategorien = function (st) {
    const typName = { ausgabe: 'Ausgabe', einnahme: 'Einnahme', sparen: 'Sparen', neutral: 'zählt nicht mit' };
    let h = '<section><h2>Kategorien</h2><div class="buch">' + st.kategorien.map(k => zl(esc(k.name), typName[k.typ] || '')).join('') + '</div>' +
      '<form data-form="kategorie" class="kasten"><div class="gitter">' + tf('Neue Kategorie', 'name', '', 'text', '', 'required maxlength="40"') + sf('Art', 'typ', [['ausgabe', 'Ausgabe'], ['einnahme', 'Einnahme'], ['sparen', 'Sparen'], ['neutral', 'Zählt nicht mit']], 'ausgabe') + '</div><div class="knoepfe"><button class="knopf" type="submit">Kategorie hinzufügen</button></div></form></section>';
    h += '<section><h2>Gemerkte Zuordnungen</h2>';
    if (!st.regeln.length) h += '<p class="unter">Noch keine. Wenn du bei einer Buchung die Kategorie änderst, merkt sich die App das für diesen Empfänger.</p>';
    else h += '<div class="buch">' + st.regeln.map((r, i) => '<div class="zl"><span>' + esc(r.name || r.muster) + '<small>' + esc(A.katName(st, r.kat)) + '</small></span><span class="w"><button class="text-knopf" data-akt="regel-weg" data-i="' + i + '">Entfernen</button></span></div>').join('') + '</div>';
    return h + '</section>';
  };

  V.import = function (st, ui) {
    let h = '<section><p class="unter">Wähle eine oder mehrere CSV-Dateien. Die App erkennt selbst, ob es Kontoumsätze oder der Trade-Republic-Export ist, und überspringt Buchungen, die schon da sind. Die Dateien verlassen dein Gerät nicht.</p>' +
      '<label class="knopf" for="datei-csv">CSV-Datei auswählen</label><input id="datei-csv" type="file" accept=".csv,.CSV,text/csv,text/plain" multiple data-datei="csv" style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden"></section>';
    if (ui.importErgebnis && ui.importErgebnis.length) h += '<section><h2>Ergebnis</h2><ul class="hinw">' + ui.importErgebnis.map(e => '<li class="' + (e.ok ? 'gut' : 'warn') + '"><span class="z" aria-hidden="true">' + (e.ok ? '✓' : '!') + '</span><span><strong>' + esc(e.datei) + '</strong><br>' + esc(e.text) + '</span></li>').join('') + '</ul></section>';
    h += '<section><h2>So kommst du an die Dateien</h2><div class="buch">' +
      zl('Sparkasse', '', '', 'Im Online-Banking am Laptop oder Handy: Girokonto öffnen, Zeitraum wählen, dann „Exportieren“ und „CSV-CAMT“ wählen. Für den ersten Import am besten den längsten Zeitraum nehmen, danach reicht einmal im Monat.') +
      zl('Trade Republic', '', '', 'In der App: Profil, Kontoauszüge, Transaktionsexport, Teilen, Zeitraum wählen, Erstellen. Die Datei in „Dateien“ sichern und hier auswählen.') +
      zl('Scalable Capital', '', '', 'Kein Import nötig: Sparplan und Depotwert unter „Depots“ eintragen.') + '</div></section>';
    return h + V.datenstandNur(st);
  };
  V.datenstandNur = st => datenstand(st).replace(/<div class="knoepfe">.*?<\/div>/, '');

  V.sicherung = function (st, ui) {
    const da = D.kryptoDa();
    let h = '<section><h2>Sicherungsdatei</h2><p class="unter">Deine Daten liegen nur in diesem Browser. Löscht das Handy den Speicher oder wechselst du das Gerät, hilft nur eine Sicherung. Die Datei ist mit deinem Passwort verschlüsselt. Speichere sie zum Beispiel in iCloud Drive.</p>' +
      '<div class="buch">' + zl('Letzte Sicherung', st.meta.sicherung ? U.datumDE(st.meta.sicherung.slice(0, 10)) : 'noch keine') + '</div>';
    if (!da) h += '<p class="fehler">Dieser Browser bietet hier keine Verschlüsselung. Öffne die App über ihre https-Adresse.</p>';
    else if (FA.VORSCHAU) h += '<p class="unter">In dieser Vorschau lässt sich keine Datei speichern. In der installierten App funktioniert die Sicherung.</p>';
    else if (ui.sicherungBereit) h += '<div class="knoepfe"><button class="knopf" data-akt="sicherung-speichern">Datei jetzt speichern</button></div><p class="unter">Auf dem iPhone: „In Dateien sichern“ wählen und iCloud Drive als Ort nehmen.</p>';
    else h += '<div class="knoepfe"><button class="knopf" data-akt="sicherung-neu">Sicherung erstellen</button><button class="knopf zweit" data-akt="sicherung-laden">Sicherung einspielen</button></div>';
    h += '</section><section><h2>App-Sperre</h2><p class="unter">Mit einem Passwort werden die Daten auf diesem Gerät verschlüsselt gespeichert und die App fragt beim Öffnen danach. Wer das Passwort vergisst, kommt nur über eine Sicherungsdatei wieder an die Daten.</p>' +
      '<div class="buch">' + zl('Sperre', D.gesperrtAktiv() ? 'aktiv' : 'aus') + '</div>' +
      (da ? '<div class="knoepfe">' + (D.gesperrtAktiv() ? '<button class="knopf zweit" data-akt="sperre-setzen">Passwort ändern</button><button class="knopf gefahr" data-akt="sperre-weg">Sperre aufheben</button>' : '<button class="knopf zweit" data-akt="sperre-setzen">Passwort festlegen</button>') + '</div>' : '') + '</section>';
    return h;
  };

  V.info = function (st) {
    const anzahl = st.tx.length;
    return '<section><h2>Was die App darf</h2><div class="buch">' +
      zl('Nur lesen', '', '', 'Die App hat keine Verbindung zu deiner Bank. Sie kann nichts überweisen, abbuchen oder ändern. Sie liest nur Dateien, die du selbst auswählst.') +
      zl('Keine Zugangsdaten', '', '', 'Passwörter, TANs, Kartennummern und Kontonummern werden nirgends abgefragt oder gespeichert.') +
      zl('Keine Datenübertragung', '', '', 'Die App schickt nichts ins Internet. Es gibt keine Werbung, keine Statistik und keine fremden Schriftarten oder Skripte.') +
      zl('Speicherort', '', '', 'Alles liegt im Browser-Speicher dieses Geräts' + (D.gesperrtAktiv() ? ', verschlüsselt mit deinem Passwort.' : '. Mit der App-Sperre wird es zusätzlich verschlüsselt.') + ' Handy und Laptop haben getrennte Daten. Über die Sicherungsdatei bringst du sie von einem Gerät aufs andere.') +
      '</div></section><section><h2>Gespeichert sind</h2><div class="buch">' + zl('Buchungen', anzahl) + zl('Einsätze', st.einsaetze.length) + zl('Depot-Buchungen', st.depots.tr.buchungen.length) + zl('Gehaltsbausteine', st.gehalt.length) + '</div>' +
      '<div class="knoepfe"><button class="knopf gefahr" data-akt="alles-loeschen">Alle Daten löschen</button></div></section>' +
      '<section><h2>Grenzen</h2><p class="merk">Steuern, Abgaben und Spesen sind Vorschätzungen mit den Werten für 2026. Verbindlich sind die Abrechnung deines Arbeitgebers und der Steuerbescheid. Die App gibt keine Steuer-, Rechts- oder Anlageberatung. Die Steuerwerte stehen in der Datei js/steuerwerte.js und müssen jedes Jahr im Januar ergänzt werden.</p></section>';
  };

  // ---------- Formulare (Blätter) ----------
  V.form = {};

  const steuerFelder = function (s) {
    return sf('Steuerklasse', 'steuerklasse', [[1, '1'], [2, '2 (alleinerziehend)'], [3, '3'], [4, '4']], s.steuerklasse, 'Die Klassen 5 und 6 rechnet diese Version nicht.') +
      sf('Bundesland', 'bundesland', [['', 'Bitte wählen']].concat(FA.BUNDESLAENDER), s.bundesland, 'Bestimmt den Kirchensteuersatz: 8 % in Baden-Württemberg und Bayern, sonst 9 %.', 'required') +
      hf('Ich zahle Kirchensteuer', 'kirchensteuer', s.kirchensteuer) +
      zf('Kinder', 'kinder', s.kinder || 0, 'Ohne Kinder fällt ab 23 Jahren ein Zuschlag in der Pflegeversicherung an.') +
      zf('Zusatzbeitrag der Krankenkasse in %', 'kvZusatz', s.kvZusatz, 'Steht auf der Lohnabrechnung oder bei deiner Kasse. Leer lassen für den Durchschnitt von 2,9 %.');
  };
  const arbeitFelder = function (a) {
    return '<div class="gitter">' + zf('Wochenstunden laut Vertrag', 'wochenstunden', a.wochenstunden) + zf('Fester Stundensatz in €', 'stundensatz', a.stundensatz, 'Leer lassen: Grundgehalt ÷ (Wochenstunden × 4,348).') + '</div>' +
      '<div class="gitter">' + zf('Zuschlag Inland in %', 'zuschlagInland', a.zuschlagInland) + zf('Zuschlag Ausland in %', 'zuschlagAusland', a.zuschlagAusland) + '</div>' +
      '<div class="gitter">' + zf('Stunden je Werktag auf Einsatz', 'stdWerktag', a.stdWerktag) + zf('Stunden je Samstag auf Einsatz', 'stdSamstag', a.stdSamstag) + '</div>' +
      '<div class="gitter">' + zf('Überstundenzuschlag in %', 'ueberstundenZuschlag', a.ueberstundenZuschlag, 'Zusätzlich zum Stundensatz für Mehrstunden. 0, wenn es keinen gibt.') + sf('Einsatz-Anteile werden ausgezahlt', 'verzugMonate', [[0, 'im selben Monat'], [1, 'einen Monat später'], [2, 'zwei Monate später']], a.verzugMonate) + '</div>' +
      '<div class="gitter">' + zf('Gehaltseingang am Tag', 'gehaltstag', a.gehaltstag || '', 'Leer lassen für den letzten Banktag im Monat.') + zf('Sonstige Abzüge vom Netto in €', 'nettoAbzug', a.nettoAbzug, 'Zum Beispiel VWL oder Betriebsrente, pro Monat.') + '</div>' +
      '<div class="gitter">' + zf('Arbeitsweg pro Tag in km, hin und zurück', 'wegKm', a.wegKm, 'Wird bei Einsätzen als gesparte Strecke vorgeschlagen.') + zf('Deine Autokosten je km in €', 'wegKosten', a.wegKosten, 'Verbrauch mal Spritpreis geteilt durch 100, mit Verschleiß mehr.') + '</div>';
  };

  V.form.einrichten = function (st) {
    const jahr = U.heute().slice(0, 4);
    return { titel: 'Gehalt und Steuerdaten', html: '<form data-form="einrichten"><p class="unter">Diese Angaben bleiben auf deinem Gerät. Du kannst alles später ändern.</p>' +
      '<fieldset><legend>Gehalt</legend><div class="gitter">' + zf('Bruttogehalt pro Monat in €', 'brutto', '', '', 'required') + tf('Gültig seit', 'ab', jahr + '-01-01', 'date', '', 'required') + '</div></fieldset>' +
      '<fieldset><legend>Steuer</legend>' + steuerFelder(st.steuer) + '</fieldset>' +
      '<fieldset><legend>Arbeitszeit und Einsätze</legend>' + arbeitFelder(st.arbeit) + '</fieldset>' +
      '<p class="fehler" id="form-fehler" hidden></p><div class="knoepfe"><button class="knopf" type="submit">Speichern</button></div></form>' };
  };
  V.form.steuerdaten = st => ({ titel: 'Steuerdaten', html: '<form data-form="steuerdaten">' + steuerFelder(st.steuer) + '<p class="fehler" id="form-fehler" hidden></p><div class="knoepfe"><button class="knopf" type="submit">Speichern</button></div></form>' });
  V.form.arbeit = st => ({ titel: 'Arbeitszeit und Einsätze', html: '<form data-form="arbeit">' + arbeitFelder(st.arbeit) + '<p class="fehler" id="form-fehler" hidden></p><div class="knoepfe"><button class="knopf" type="submit">Speichern</button></div></form>' });

  V.form.baustein = function (st, b) {
    const neu = !b.id, monate = U.MONATE.map((m, i) => [i + 1, m]);
    return { titel: neu ? (b.art === 'grund' ? 'Lohnerhöhung' : b.art === 'einmal' ? 'Einmalzahlung' : 'Monatliche Zulage') : 'Gehaltsbaustein', html: '<form data-form="baustein"><input type="hidden" name="id" value="' + esc(b.id || '') + '">' +
      sf('Art', 'art', [['grund', 'Grundgehalt pro Monat'], ['zulage', 'Monatliche Zulage'], ['einmal', 'Einmalzahlung, jedes Jahr']], b.art, '', 'data-wechsel="baustein-art"') +
      tf('Bezeichnung', 'name', b.name || '', 'text', 'Zum Beispiel Weihnachtsgeld, Urlaubsgeld, Schichtzulage.', 'maxlength="40"') +
      '<div class="gitter">' + zf('Betrag brutto in €', 'betrag', b.betrag, '', 'required') + tf('Gültig ab', 'ab', b.ab || U.heute(), 'date', 'Bei einer Lohnerhöhung der erste Tag mit dem neuen Gehalt.', 'required') + '</div>' +
      '<div class="gitter"><div data-nur="einmal"' + (b.art === 'einmal' ? '' : ' hidden') + '>' + sf('Auszahlung im Monat', 'monat', monate, b.monat || 11) + '</div><div data-nur="nichtgrund"' + (b.art === 'grund' ? ' hidden' : '') + '>' + tf('Gültig bis', 'bis', b.bis || '', 'date', 'Leer lassen, wenn es kein Ende gibt.') + '</div></div>' +
      '<p class="fehler" id="form-fehler" hidden></p><div class="knoepfe"><button class="knopf" type="submit">Speichern</button>' + (neu ? '' : '<button class="knopf gefahr" type="button" data-akt="baustein-weg" data-id="' + esc(b.id) + '">Löschen</button>') + '</div></form>' };
  };

  V.form.buchung = function (st) {
    const kats = st.kategorien.filter(k => k.typ !== 'neutral').map(k => [k.id, k.name]);
    return { titel: 'Buchung eintragen', html: '<form data-form="buchung"><div class="wahl"><label><input type="radio" name="richtung" value="aus" checked> Ausgabe</label><label><input type="radio" name="richtung" value="ein"> Einnahme</label></div>' +
      '<div class="gitter">' + zf('Betrag in €', 'betrag', '', '', 'required') + tf('Datum', 'datum', U.heute(), 'date', '', 'required') + '</div>' +
      tf('Wo oder wofür', 'gegen', '', 'text', '', 'maxlength="80"') + sf('Kategorie', 'kat', [['', 'Automatisch']].concat(kats), '') +
      '<p class="fehler" id="form-fehler" hidden></p><div class="knoepfe"><button class="knopf" type="submit">Speichern</button></div></form>' };
  };

  V.form.tx = function (st, t) {
    const key = U.schluessel(t), gleiche = st.tx.filter(x => x.id !== t.id && U.schluessel(x) === key).length;
    return { titel: 'Buchung', html: '<form data-form="tx"><input type="hidden" name="id" value="' + esc(t.id) + '"><div class="buch">' +
      zl(esc(t.gegen || 'Ohne Empfänger'), '<strong class="' + (t.betrag > 0 ? 'plus' : '') + '">' + U.eurVz(t.betrag) + '</strong>', '', U.datumDE(t.datum) + (t.quelle === 'manuell' ? ', von Hand eingetragen' : ', aus dem Import')) +
      (t.text ? '<p class="unter" style="padding:0.5rem 0;overflow-wrap:anywhere">' + esc(t.text) + '</p>' : '') + '</div>' +
      sf('Kategorie', 'kat', st.kategorien.map(k => [k.id, k.name]), t.kat) +
      (key ? hf('Für diesen Empfänger merken', 'merken', true, gleiche ? 'Ändert auch ' + gleiche + ' weitere ' + (gleiche === 1 ? 'Buchung' : 'Buchungen') + ' und gilt für künftige Importe.' : 'Gilt für künftige Importe.') : '') +
      '<div class="knoepfe"><button class="knopf" type="submit">Speichern</button>' + (t.quelle === 'manuell' ? '<button class="knopf gefahr" type="button" data-akt="tx-weg" data-id="' + esc(t.id) + '">Löschen</button>' : '') + '</div>' +
      (t.quelle === 'manuell' ? '' : '<p class="merk">Importierte Buchungen lassen sich nicht löschen, sie kämen beim nächsten Import wieder. Soll eine Buchung nicht mitzählen, wähle „Umbuchung (zählt nicht mit)“.</p>') + '</form>' };
  };

  V.postenZeile = function (p, i) {
    return '<div class="posten"><input type="text" name="pn" value="' + esc(p.name || '') + '" placeholder="Wofür" aria-label="Wofür" maxlength="40"><input type="text" inputmode="decimal" name="pb" value="' + esc(U.zahlText(p.betrag)) + '" placeholder="Betrag" aria-label="Betrag"><label><input type="checkbox" name="pe" value="' + i + '"' + (p.erstattet ? ' checked' : '') + '> erstattet</label><button type="button" data-akt="posten-weg" aria-label="Position entfernen">×</button></div>';
  };

  // Text unter den Spesenfeldern: amtlicher Satz für das gewählte Land
  V.spesenHinweis = function (s) {
    if (!s) return { vma: 'Wähle oben ein Land. Dann trägt die App die amtlichen Sätze ein.', nacht: '' };
    const jahr = FA.SPESEN.jahr;
    return {
      vma: s.ersatz ? '„' + s.name + '“ steht nicht in der amtlichen Tabelle ' + jahr + '. Dafür gilt der Satz von Luxemburg: ' + s.voll + ' € pro vollem Tag, ' + s.teil + ' € am An- und Abreisetag.'
        : 'Amtlicher Satz ' + jahr + ' für ' + s.name + ': ' + s.voll + ' € pro vollem Tag, ' + s.teil + ' € am An- und Abreisetag.',
      nacht: 'Amtliche Übernachtungspauschale' + (s.ersatz ? ' (Luxemburg)' : '') + ': ' + s.nacht + ' € pro Nacht. Nur eintragen, wenn dein Arbeitgeber sie ohne Hotelrechnung auszahlt.'
    };
  };

  V.form.einsatz = function (st, e) {
    const neu = !e.id;
    if (e.start && e.ende && (e.tageMoFr === '' || e.samstage === '')) {
      // Leere Felder bedeuten "automatisch": zum Bearbeiten die gezählten Tage anzeigen
      const gezaehlt = E.tage(e.start, e.ende);
      e = Object.assign({}, e, { tageMoFr: e.tageMoFr === '' ? gezaehlt.moFr : e.tageMoFr, samstage: e.samstage === '' ? gezaehlt.sa : e.samstage });
    }
    const hinweis = V.spesenHinweis(e.land ? FA.spesen.finde(e.land, true) : null);
    return { titel: neu ? 'Einsatz berechnen' : 'Einsatz bearbeiten', html: '<form data-form="einsatz"><input type="hidden" name="id" value="' + esc(e.id || '') + '">' +
      tf('Bezeichnung', 'titel', e.titel, 'text', 'Zum Beispiel Kunde oder Anlage.', 'maxlength="60"') +
      tf('Land', 'land', e.land, 'text', 'Tippen oder aus der Liste wählen. Sie enthält alle Länder und Orte der amtlichen Spesentabelle ' + FA.SPESEN.jahr + '.', 'maxlength="80" list="laender" autocomplete="off" data-wechsel="einsatz-land"') + '<datalist id="laender">' + FA.spesen.liste().map(x => '<option value="' + esc(x.name) + '">').join('') + '</datalist>' +
      tf('Stadt', 'stadt', e.stadt, 'text', 'Nur für deine Übersicht.', 'maxlength="40"') +
      '<div class="wahl"><label><input type="radio" name="ausland" value="0"' + (e.ausland ? '' : ' checked') + ' data-wechsel="einsatz-ort"> Inland</label><label><input type="radio" name="ausland" value="1"' + (e.ausland ? ' checked' : '') + ' data-wechsel="einsatz-ort"> Ausland</label></div>' +
      '<div class="gitter">' + tf('Erster Tag (Anreise)', 'start', e.start, 'date', '', 'required data-wechsel="einsatz-datum"') + tf('Letzter Tag (Abreise)', 'ende', e.ende, 'date', '', 'required data-wechsel="einsatz-datum"') + '</div>' +
      '<fieldset><legend>Arbeitszeit</legend><div class="gitter">' + zf('Werktage (Mo bis Fr)', 'tageMoFr', e.tageMoFr, 'Wird aus dem Zeitraum gezählt. Feiertage und freie Tage hier abziehen.') + zf('Samstage gearbeitet', 'samstage', e.samstage) + zf('Sonntage gearbeitet', 'sonntage', e.sonntage) + '</div>' +
      '<div class="gitter">' + zf('Stunden je Werktag', 'stdWerktag', e.stdWerktag) + zf('Stunden je Samstag', 'stdSamstag', e.stdSamstag) + zf('Stunden je Sonntag', 'stdSonntag', e.stdSonntag) + '</div>' +
      '<div class="gitter">' + zf('Zuschlag in %', 'zuschlag', e.zuschlag, 'Auf jede Stunde des Einsatzes.') + sf('Auszahlung', 'verzug', [[0, 'im selben Monat'], [1, 'einen Monat später'], [2, 'zwei Monate später']], e.verzug) + '</div></fieldset>' +
      '<fieldset><legend>Verpflegung</legend><div class="gitter">' + zf('Pauschale voller Tag in €', 'vmaVoll', e.vmaVoll, 'Für jeden vollen Tag vor Ort.') + zf('Pauschale Reisetag in €', 'vmaTeil', e.vmaTeil, 'Für An- und Abreisetag.') + zf('Reisetage', 'reisetage', e.reisetage, 'An- und Abreisetag.') + '</div>' +
      '<p class="unter" id="spesen-hinweis">' + esc(hinweis.vma) + '</p>' +
      hf('Der Arbeitgeber zahlt die Verpflegungspauschale steuerfrei aus', 'vmaVomAg', e.vmaVomAg, 'Wenn nicht, zählt sie zu den Werbungskosten in der Steuererklärung.') +
      hf('Der Arbeitgeber bezahlt das Frühstück', 'fruehstueck', e.fruehstueck, 'Zum Beispiel, wenn es im Hotelpreis enthalten ist. Dann sinkt die Pauschale je Übernachtung um 20 % des vollen Tagessatzes.') + '</fieldset>' +
      '<fieldset><legend>Unterkunft</legend><div class="gitter">' + zf('Nächte', 'naechte', e.naechte, 'Leer lassen: Tage minus eins.') + zf('Was du selbst pro Nacht zahlst', 'unterkunftKosten', e.unterkunftKosten, '0, wenn die Firma das Hotel bucht.') + zf('Erstattung pro Nacht in €', 'unterkunftErstattung', e.unterkunftErstattung, 'Pauschale oder Erstattung vom Arbeitgeber.') + '</div><p class="unter" id="nacht-hinweis">' + esc(hinweis.nacht) + '</p></fieldset>' +
      '<fieldset><legend>Fahrt mit dem eigenen Auto</legend><div class="gitter">' + zf('Kilometer hin und zurück', 'km', e.km) + zf('Erstattung je km in €', 'kmSatz', e.kmSatz, 'Üblich sind 0,30 €.') + zf('Deine Kosten je km in €', 'kmKosten', e.kmKosten, 'Sprit und Verschleiß, grob geschätzt.') + '</div></fieldset>' +
      '<fieldset><legend>Weitere Kosten</legend><p class="unter">Flug, Bahn, Mietwagen, Maut, Parken, Werkzeug. Nur was du selbst bezahlst. „Erstattet“ ankreuzen, wenn du es zurückbekommst.</p><div id="posten-liste" style="display:flex;flex-direction:column;gap:0.5rem">' + (e.posten || []).map(V.postenZeile).join('') + '</div><div class="knoepfe"><button class="knopf zweit klein" type="button" data-akt="posten-neu">Position hinzufügen</button></div></fieldset>' +
      '<fieldset><legend>Arbeitsweg, den du sparst</legend><p class="unter">An Einsatztagen fährst du nicht zur Firma. Die App rechnet die gesparten Kilometer für jeden dieser Tage.</p><div class="gitter">' + zf('Kilometer pro Arbeitstag, hin und zurück', 'wegKm', e.wegKm == null ? st.arbeit.wegKm : e.wegKm) + zf('Deine Autokosten je km in €', 'wegKosten', e.wegKosten == null ? st.arbeit.wegKosten : e.wegKosten, 'Nur Sprit: Verbrauch mal Spritpreis geteilt durch 100. Mit Verschleiß liegt der Wert höher.') + zf('Tage ohne Arbeitsweg', 'wegTage', e.wegTage, 'Leer lassen: alle Werktage des Einsatzes.') + '</div></fieldset>' +
      '<fieldset><legend>Alltag</legend><div class="gitter">' + zf('Deine Ausgaben vor Ort pro Tag', 'ausgabenTag', e.ausgabenTag, 'Essen, Getränke, Kleinkram.') + zf('Ersparte Ausgaben zu Hause pro Tag in €', 'ersparnisTag', e.ersparnisTag, 'Was du an diesen Tagen daheim ausgegeben hättest.') + '</div>' +
      '<div class="gitter">' + tf('Währung vor Ort', 'waehrung', e.waehrung || 'EUR', 'text', 'Gilt für Unterkunft, weitere Kosten und Ausgaben vor Ort.', 'maxlength="3"') + zf('Wechselkurs: 1 EUR sind', 'kurs', e.kurs, 'Bei Euro-Ländern 1.') + '</div></fieldset>' +
      tf('Notiz', 'notiz', e.notiz || '', 'text', '', 'maxlength="200"') +
      '<p class="fehler" id="form-fehler" hidden></p><div class="knoepfe"><button class="knopf" type="submit">' + (neu ? 'Berechnen' : 'Speichern') + '</button></div></form>' };
  };

  V.form.konto = st => ({ titel: 'Kontostand', html: '<form data-form="konto"><p class="unter">Trag den Stand deines Girokontos an einem bestimmten Tag ein. Die App rechnet alle späteren Buchungen dazu.</p><div class="gitter">' + zf('Kontostand in €', 'stand', st.konto.stand, '', 'required') + tf('Stand vom', 'datum', st.konto.datum || U.heute(), 'date', '', 'required') + '</div><p class="fehler" id="form-fehler" hidden></p><div class="knoepfe"><button class="knopf" type="submit">Speichern</button></div></form>' });

  V.form.depotwert = function (st, depot) {
    const d = st.depots[depot], letzter = d.werte.length ? d.werte[d.werte.length - 1] : null;
    return { titel: 'Depotwert ' + (depot === 'tr' ? 'Trade Republic' : 'Scalable Capital'), html: '<form data-form="depotwert"><input type="hidden" name="depot" value="' + depot + '"><p class="unter">Den aktuellen Wert findest du in der App deines Brokers. ' + (depot === 'tr' ? 'Nur der Wert der Wertpapiere, ohne Guthaben auf dem Verrechnungskonto.' : '') + '</p><div class="gitter">' + zf('Depotwert in €', 'wert', letzter ? letzter.wert : '', '', 'required') + tf('Stand vom', 'datum', U.heute(), 'date', '', 'required') + '</div><p class="fehler" id="form-fehler" hidden></p><div class="knoepfe"><button class="knopf" type="submit">Speichern</button></div></form>' };
  };

  V.form.sparplan = function (st, p) {
    const neu = !p.id;
    return { titel: neu ? 'Sparplan anlegen' : 'Sparplan', html: '<form data-form="sparplan"><input type="hidden" name="id" value="' + esc(p.id || '') + '">' + tf('Bezeichnung', 'name', p.name || '', 'text', 'Zum Beispiel der Name des ETF.', 'maxlength="60"') +
      '<div class="gitter">' + zf('Betrag pro Monat in €', 'betrag', p.betrag, '', 'required') + zf('Ausführung am Tag', 'tag', p.tag || 1) + '</div>' +
      '<div class="gitter">' + tf('Erste Ausführung', 'start', p.start || '', 'date', '', 'required') + tf('Beendet am', 'ende', p.ende || '', 'date', 'Leer lassen, solange er läuft.') + '</div>' +
      '<p class="fehler" id="form-fehler" hidden></p><div class="knoepfe"><button class="knopf" type="submit">Speichern</button>' + (neu ? '' : '<button class="knopf gefahr" type="button" data-akt="sparplan-weg" data-id="' + esc(p.id) + '">Löschen</button>') + '</div></form>' };
  };
  V.form.einzel = () => ({ titel: 'Einzelkauf', html: '<form data-form="einzel">' + tf('Bezeichnung', 'text', '', 'text', '', 'maxlength="60"') + '<div class="gitter">' + zf('Betrag in €', 'betrag', '', 'Verkäufe als negativen Betrag eintragen.', 'required') + tf('Datum', 'datum', U.heute(), 'date', '', 'required') + '</div><p class="fehler" id="form-fehler" hidden></p><div class="knoepfe"><button class="knopf" type="submit">Speichern</button></div></form>' });

  const pwFeld = (l, n, neu) => '<label class="feld"><span>' + l + '</span><input id="f-' + n + '" name="' + n + '" type="password" autocomplete="' + (neu ? 'new-password' : 'current-password') + '" required minlength="' + (neu ? 8 : 1) + '"></label>';
  V.form.sicherungNeu = () => ({ titel: 'Sicherung erstellen', html: '<form data-form="sicherung-neu"><p class="unter">Wähle ein Passwort für die Sicherungsdatei, mindestens acht Zeichen. Ohne dieses Passwort lässt sich die Datei nicht mehr öffnen.</p>' + pwFeld('Passwort', 'pw', true) + pwFeld('Passwort wiederholen', 'pw2', true) + '<p class="fehler" id="form-fehler" hidden></p><div class="knoepfe"><button class="knopf" type="submit">Sicherung vorbereiten</button></div></form>' });
  V.form.sicherungLaden = () => ({ titel: 'Sicherung einspielen', html: '<form data-form="sicherung-laden"><p class="unter">Die Daten aus der Datei ersetzen alles, was jetzt in der App ist.</p><label class="feld"><span>Sicherungsdatei</span><input id="f-datei" name="datei" type="file" accept=".json,application/json" required></label>' + pwFeld('Passwort der Sicherung', 'pw', false) + '<p class="fehler" id="form-fehler" hidden></p><div class="knoepfe"><button class="knopf" type="submit">Einspielen</button></div></form>' });
  V.form.sperre = () => ({ titel: 'App-Passwort', html: '<form data-form="sperre"><p class="unter">Mindestens acht Zeichen. Es gibt keine „Passwort vergessen“-Funktion. Erstelle vorher eine Sicherungsdatei.</p>' + pwFeld('Neues Passwort', 'pw', true) + pwFeld('Passwort wiederholen', 'pw2', true) + '<p class="fehler" id="form-fehler" hidden></p><div class="knoepfe"><button class="knopf" type="submit">Passwort festlegen</button></div></form>' });

  V.form.frage = (titel, text, ja, akt, gefahr) => ({ titel: titel, html: '<p>' + text + '</p><div class="knoepfe"><button class="knopf' + (gefahr ? ' gefahr' : '') + '" data-akt="' + akt + '">' + ja + '</button><button class="knopf zweit" data-akt="blatt-zu">Abbrechen</button></div>' });

  V.sperrbild = () => '<div class="sperre"><p class="aussage">Kassenlage ist gesperrt.</p><form data-form="entsperren"><label class="feld"><span>Passwort</span><input id="f-pw" name="pw" type="password" autocomplete="current-password" required></label><p class="fehler" id="form-fehler" hidden></p><div class="knoepfe"><button class="knopf" type="submit">Entsperren</button></div></form><details><summary>Passwort vergessen</summary><ul><li>Ohne Passwort lassen sich die Daten auf diesem Gerät nicht mehr lesen.</li><li>Du kannst sie verwerfen und danach eine Sicherungsdatei einspielen.</li></ul><button class="knopf gefahr klein" data-akt="verwerfen-frage">Daten auf diesem Gerät verwerfen</button></details></div>';
})(typeof window !== 'undefined' ? window : globalThis);
