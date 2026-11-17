/* Steuer- und Sozialversicherungswerte je Jahr.
   Einmal im Jahr (Januar) prüfen und einen neuen Block ergänzen.
   Die Quellen zu jedem Wert stehen in ANLEITUNG.md. */
(function (root) {
  'use strict';
  const FA = root.FA = root.FA || {};

  FA.STEUERWERTE = {
    2026: {
      // Einkommensteuertarif § 32a EStG
      grundfreibetrag: 12348, zone2Bis: 17799, zone3Bis: 69878, zone4Bis: 277825,
      y1: 914.51, y2: 1400,
      z1: 173.10, z2: 2397, z3: 1034.87,
      spitzenSatz: 0.42, spitzenAbzug: 11135.63,
      reichenSatz: 0.45, reichenAbzug: 19470.38,
      // Pauschbeträge
      arbeitnehmerPauschbetrag: 1230, sonderausgabenPauschbetrag: 36, entlastungAlleinerziehend: 4260,
      // Solidaritätszuschlag (Freigrenze bezogen auf die Jahressteuer)
      soliFreigrenze: 20350, soliSatz: 0.055, soliMilderung: 0.119,
      // Beitragsbemessungsgrenzen pro Monat
      bbgRvMonat: 8450, bbgKvMonat: 5812.5,
      // Arbeitnehmeranteile
      rvAn: 0.093, avAn: 0.013, kvAllgAn: 0.073, kvErmAn: 0.07, kvZusatzDurchschnitt: 2.9,
      pvAn: 0.018, pvKinderlos: 0.006, pvAbschlagKind: 0.0025, pvSachsenExtra: 0.005,
      // Vorsorge
      vorsorgeSonstigeMax: 1900, krankengeldKuerzung: 0.04,
      // Fahrten und Verpflegung
      entfernungspauschale: 0.38, dienstreiseKm: 0.30,
      vmaInland: { voll: 28, teil: 14, nacht: 20 }
    }
  };

  /* Amtliche Pauschbeträge für Verpflegung und Übernachtung im Ausland, gültig ab 1.1.2026.
     Quelle: BMF-Schreiben vom 5.12.2025, IV C 5 - S 2353/00094/007/012.
     Je Zeile: Land oder Ort; 24 Stunden; An- und Abreisetag; Übernachtung (Euro).
     Jedes Jahr im Januar durch die neue Tabelle ersetzen und "jahr" anpassen. */
  FA.SPESEN = {
    jahr: 2026,
    quelle: 'BMF-Schreiben vom 5.12.2025',
    zeilen: `Ägypten;50;33;112
Äthiopien;44;29;159
Äquatorialguinea;42;28;166
Albanien;33;22;116
Algerien;47;32;120
Andorra;45;30;135
Angola;40;27;368
Argentinien;42;28;119
Armenien;29;20;107
Aserbaidschan;44;29;88
Australien – Canberra;74;49;186
Australien – Sydney;57;38;173
Australien – im Übrigen;57;38;173
Bahrain;48;32;153
Bangladesch;46;31;189
Barbados;54;36;206
Belgien;59;40;141
Benin;40;27;168
Bhutan;27;18;176
Bolivien;46;31;108
Bosnien und Herzegowina;32;21;109
Botsuana;40;27;105
Brasilien – Brasilia;51;34;88
Brasilien – Rio de Janeiro;69;46;140
Brasilien – Sao Paulo;46;31;151
Brasilien – im Übrigen;46;31;88
Brunei;45;30;110
Bulgarien;38;25;109
Burkina Faso;39;26;230
Burundi;58;39;102
Chile;44;29;154
China – Hongkong;83;56;209
China – Peking;57;38;184
China – Shanghai;48;32;142
China – im Übrigen;48;32;142
Costa Rica;60;40;127
Côte d’Ivoire;60;40;171
Dänemark;75;50;183
Dominikanische Republik;50;33;167
Dschibuti;77;52;255
Ecuador;27;18;103
El Salvador;65;44;161
Eritrea;46;31;78
Estland;39;26;125
Fidschi;32;21;183
Finnland;54;36;171
Frankreich – Paris sowie die Departments 77, 78, 91 bis 95;58;39;159
Frankreich – im Übrigen;53;36;105
Gabun;64;43;263
Gambia;40;27;161
Georgien;45;30;87
Ghana;46;31;203
Griechenland – Athen;40;27;139
Griechenland – im Übrigen;36;24;150
Guatemala;46;31;124
Guinea;59;40;140
Guinea-Bissau;32;21;113
Honduras;57;38;198
Indien – Bangalore;42;28;155
Indien – Chennai;22;15;80
Indien – Kalkutta;32;21;167
Indien – Mumbai;53;36;218
Indien – Neu Delhi;46;31;211
Indien – im Übrigen;22;15;80
Indonesien;45;30;179
Iran;33;22;196
Irland;64;43;164
Island;62;41;187
Israel;59;40;268
Italien – Mailand;42;28;191
Italien – Rom;48;32;150
Italien – im Übrigen;42;28;150
Jamaika;39;26;171
Japan – Tokio;50;33;285
Japan – Osaka;33;22;141
Japan – im Übrigen;33;22;141
Jordanien;57;38;134
Kambodscha;42;28;108
Kamerun;56;37;275
Kanada – Ottawa;62;41;214
Kanada – Toronto;54;36;392
Kanada – Vancouver;63;42;304
Kanada – im Übrigen;54;36;214
Kap Verde;38;25;90
Kasachstan;33;22;108
Katar;81;54;128
Kenia;48;32;217
Kirgisistan;35;24;80
Kolumbien;34;23;123
Kongo, Republik;53;36;215
Kongo, Demokratische Republik;65;44;337
Korea, Republik;39;26;130
Kosovo;24;16;71
Kroatien;46;31;191
Kuba;51;34;170
Kuwait;63;42;224
Laos;35;24;71
Lesotho;28;19;104
Lettland;46;31;119
Libanon;69;46;146
Liberia;65;44;173
Liechtenstein;57;38;234
Litauen;48;32;124
Luxemburg;63;42;139
Madagaskar;33;22;116
Malawi;41;28;109
Malaysia;36;24;86
Malediven;70;47;200
Mali;42;28;141
Malta;59;40;191
Marokko;41;28;87
Marshall Inseln;45;30;112
Mauretanien;35;24;86
Mauritius;44;29;172
Mexiko;40;27;337
Moldau, Republik;26;17;73
Monaco;52;35;187
Mongolei;23;16;92
Montenegro;32;21;85
Mosambik;51;34;208
Myanmar;23;16;103
Namibia;28;19;146
Nepal;33;22;125
Neuseeland;58;39;148
Nicaragua;46;31;105
Niederlande;58;39;167
Niger;42;28;131
Nigeria;52;35;202
Nordmazedonien;27;18;89
Norwegen;75;50;139
Österreich;50;33;117
Oman;64;43;141
Pakistan;41;28;199
Palau;51;34;193
Panama;41;28;82
Papua-Neuguinea;59;40;159
Paraguay;39;26;124
Peru;52;35;128
Philippinen;41;28;140
Polen – Breslau;34;23;124
Polen – Warschau;40;27;143
Polen – im Übrigen;34;23;124
Portugal;32;21;111
Ruanda;44;29;117
Rumänien;38;25;103
Russische Föderation – Moskau;30;20;235
Russische Föderation – St. Petersburg;28;19;133
Russische Föderation – im Übrigen;28;19;133
Sambia;38;25;105
Samoa;39;26;105
San Marino;34;23;79
São Tomé – Príncipe;36;24;147
Saudi-Arabien – Djidda;57;38;181
Saudi-Arabien – Riad;56;37;186
Saudi-Arabien – im Übrigen;56;37;181
Schweden;66;44;140
Schweiz – Bern;82;55;195
Schweiz – Genf;70;47;197
Schweiz – im Übrigen;70;47;195
Senegal;48;32;160
Serbien;27;18;97
Sierra Leone;57;38;145
Simbabwe;63;42;198
Singapur;71;48;277
Slowakische Republik;33;22;121
Slowenien;38;25;126
Spanien – Barcelona;34;23;144
Spanien – Kanarische Inseln;36;24;103
Spanien – Madrid;42;28;131
Spanien – Palma de Mallorca;44;29;142
Spanien – im Übrigen;34;23;103
Sri Lanka;36;24;112
Südafrika – Kapstadt;33;22;130
Südafrika – Johannesburg;36;24;129
Südafrika – im Übrigen;29;20;109
Südsudan;51;34;159
Tadschikistan;27;18;85
Taiwan;51;34;174
Tansania;44;29;97
Thailand;36;24;114
Togo;36;24;144
Tonga;29;20;102
Trinidad und Tobago;66;44;203
Tschad;42;28;155
Tschechische Republik;32;21;77
Türkei – Ankara;32;21;110
Türkei – Izmir;44;29;120
Türkei – im Übrigen;24;16;107
Tunesien;40;27;144
Turkmenistan;28;19;135
Uganda;45;30;207
Ukraine;33;22;180
Ungarn;32;21;85
Uruguay;40;27;113
Usbekistan;32;21;133
Vatikanstaat;48;32;150
Venezuela;51;34;178
Vereinigte Arabische Emirate;81;54;169
USA – Atlanta;77;52;182
USA – Boston;63;42;333
USA – Chicago;65;44;233
USA – Houston;62;41;204
USA – Los Angeles;64;43;262
USA – Miami;65;44;256
USA – New York City;66;44;308
USA – San Francisco;59;40;327
USA – Washington, D. C.;66;44;203
USA – im Übrigen;59;40;182
Vereinigtes Königreich – London;66;44;163
Vereinigtes Königreich – im Übrigen;52;35;99
Vietnam;36;24;111
Weißrussland;21;14;148
Zentralafrikanische Republik;53;36;210
Zypern;42;28;125`
  };
  // Übliche Namen, die in der amtlichen Tabelle anders heißen
  const ALIAS = {
    'tschechien': 'Tschechische Republik', 'slowakei': 'Slowakische Republik', 'usa': 'USA – im Übrigen', 'vereinigte staaten': 'USA – im Übrigen', 'amerika': 'USA – im Übrigen',
    'grossbritannien': 'Vereinigtes Königreich – im Übrigen', 'großbritannien': 'Vereinigtes Königreich – im Übrigen', 'england': 'Vereinigtes Königreich – im Übrigen', 'uk': 'Vereinigtes Königreich – im Übrigen',
    'südkorea': 'Korea, Republik', 'korea': 'Korea, Republik', 'russland': 'Russische Föderation – im Übrigen', 'belarus': 'Weißrussland', 'elfenbeinküste': 'Côte d’Ivoire',
    'moldawien': 'Moldau, Republik', 'moldau': 'Moldau, Republik', 'holland': 'Niederlande', 'vae': 'Vereinigte Arabische Emirate', 'dubai': 'Vereinigte Arabische Emirate', 'kongo': 'Kongo, Republik',
    'hongkong': 'China – Hongkong', 'mallorca': 'Spanien – Palma de Mallorca', 'kanaren': 'Spanien – Kanarische Inseln', 'germany': 'Deutschland', 'inland': 'Deutschland'
  };
  let spesenListe = null, spesenIndex = null;
  function spesenLaden() {
    if (spesenListe) return;
    const norm = FA.util.norm, inl = FA.STEUERWERTE[FA.SPESEN.jahr].vmaInland;
    spesenListe = [{ name: 'Deutschland', voll: inl.voll, teil: inl.teil, nacht: inl.nacht, inland: true }];
    for (const z of FA.SPESEN.zeilen.split('\n')) { const t = z.split(';'); spesenListe.push({ name: t[0], voll: Number(t[1]), teil: Number(t[2]), nacht: Number(t[3]), inland: false }); }
    spesenListe.sort((x, y) => (x.inland ? -1 : y.inland ? 1 : x.name.localeCompare(y.name, 'de')));
    spesenIndex = {};
    for (const e of spesenListe) {
      spesenIndex[norm(e.name)] = e;
      const teile = e.name.split(' – ');
      if (teile.length === 2 && teile[1] === 'im Übrigen') spesenIndex[norm(teile[0])] = e; // nur das Land getippt
    }
    for (const k in ALIAS) spesenIndex[norm(k)] = spesenIndex[norm(ALIAS[k])];
  }
  FA.spesen = {
    liste: function () { spesenLaden(); return spesenListe; },
    /* Sucht Land oder Ort. Steht ein fertig eingegebenes Land nicht in der Tabelle,
       gilt nach dem BMF-Schreiben der Satz von Luxemburg (ersatz = true). */
    finde: function (text, fertig) {
      spesenLaden();
      const n = FA.util.norm(text);
      if (!n) return null;
      if (spesenIndex[n]) return spesenIndex[n];
      if (!fertig) return null;
      const lux = spesenIndex.luxemburg;
      return { name: String(text).trim(), voll: lux.voll, teil: lux.teil, nacht: lux.nacht, inland: false, ersatz: true };
    }
  };

  FA.BUNDESLAENDER = [
    ['BW', 'Baden-Württemberg'], ['BY', 'Bayern'], ['BE', 'Berlin'], ['BB', 'Brandenburg'], ['HB', 'Bremen'],
    ['HH', 'Hamburg'], ['HE', 'Hessen'], ['MV', 'Mecklenburg-Vorpommern'], ['NI', 'Niedersachsen'],
    ['NW', 'Nordrhein-Westfalen'], ['RP', 'Rheinland-Pfalz'], ['SL', 'Saarland'], ['SN', 'Sachsen'],
    ['ST', 'Sachsen-Anhalt'], ['SH', 'Schleswig-Holstein'], ['TH', 'Thüringen']
  ];
})(typeof window !== 'undefined' ? window : globalThis);
