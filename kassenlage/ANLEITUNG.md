# Kassenlage – Anleitung

Kassenlage ist deine private Finanz-App: Kontoumsätze auswerten, Serviceeinsätze durchrechnen, Lohnsteuer und Kirchensteuer schätzen, Depots im Blick behalten. Alle Daten bleiben auf deinem Gerät. Die App hat keine Verbindung zu deiner Bank und kann nichts überweisen.

Es gibt keine Installationsbefehle. Die App besteht aus einem Ordner mit Dateien, die jeder Browser direkt ausführt.

## 1. Was im Ordner liegt

```
kassenlage/
  index.html              Startseite der App
  manifest.webmanifest    Name und Icon für die Installation
  sw.js                   sorgt dafür, dass die App offline startet
  css/app.css             Aussehen
  icons/                  App-Icons
  js/steuerwerte.js       Steuer- und Abgabenwerte je Jahr (jedes Jahr ergänzen)
  js/steuer.js            Lohnsteuer, Kirchensteuer, Sozialabgaben, Steuererklärung
  js/gehalt.js            Gehaltsbausteine und Jahresplan
  js/einsatz.js           Serviceeinsatz-Rechner
  js/import.js            CSV-Import und automatische Kategorien
  js/analyse.js           Monatszahlen, feste Zahlungen, Prognose, Hinweise, Depots
  js/vermoegen.js         Vermögensverlauf, Kontostände, Kuchendiagramm, Sparquote, Tipps
  js/diagramme.js         Linienchart und Kuchendiagramm
  js/info.js              Texte hinter den i-Knöpfen
  js/daten.js             Speicher, Verschlüsselung, Sicherung, Beispieldaten
  js/ansichten.js         Einsätze, Steuer, Buchungsliste, Formulare
  js/ansichten2.js        Dashboard, Ausgaben, Vermögen, Mehr
  js/app.js               Bedienung
  js/thema.js             Hell oder Dunkel beim Start
  js/basis.js             kleine Helfer (Datum, Geldformat)
  ANLEITUNG.md            diese Datei
```

## 2. Am Laptop ausprobieren (zwei Minuten)

1. ZIP-Datei entpacken: Rechtsklick, „Alle extrahieren“.
2. Im Ordner `kassenlage` die Datei `index.html` doppelt anklicken. Sie öffnet sich im Browser (Edge oder Chrome).
3. „Erst mit Beispieldaten ansehen“ antippen und durch die Bereiche klicken.

Das ist nur zum Ansehen gedacht. Für den echten Gebrauch nimm die Internet-Adresse aus Schritt 3. Der Browser speichert die Daten getrennt für die Datei auf der Festplatte und für die Internet-Adresse.

## 3. Online stellen, damit das iPhone die App installieren kann

Ein iPhone installiert eine Web-App nur von einer https-Adresse. Dafür reicht ein kostenloses Konto bei GitHub. Dort liegt nur das Programm. Deine Finanzdaten liegen nie dort, sie bleiben im Browser deines Geräts.

Wichtig zu wissen: Im kostenlosen Tarif muss der Ablageort öffentlich sein. Jeder, der die Adresse kennt, kann die leere App öffnen und den Programmcode lesen. Deine Daten sieht niemand.

1. Auf github.com ein Konto anlegen (E-Mail-Adresse, Passwort, Benutzername). Das machst du selbst.
2. Oben rechts auf das Plus klicken, „New repository“ wählen. Als Namen zum Beispiel `kassenlage` eintragen, „Public“ auswählen, „Create repository“.
3. Auf der nächsten Seite den Link „uploading an existing file“ anklicken.
4. Im Explorer den Ordner `kassenlage` öffnen, alles darin markieren (Strg+A) und in das Browserfenster ziehen. Wichtig: den Inhalt des Ordners hochladen, nicht den Ordner selbst. `index.html` muss auf der obersten Ebene liegen.
5. Unten auf „Commit changes“ klicken.
6. Oben auf „Settings“ klicken, links „Pages“ wählen. Bei „Source“ die Einstellung „Deploy from a branch“ wählen, bei „Branch“ `main` und `/ (root)`, dann „Save“.
7. Nach ein paar Minuten steht auf derselben Seite die Adresse, nach dem Muster `https://deinname.github.io/kassenlage/`. Änderungen können bis zu zehn Minuten brauchen.

Andere kostenlose Anbieter gehen genauso, zum Beispiel Cloudflare Pages oder Netlify. Die App braucht nur einen Ort, der die Dateien ausliefert.

## 4. Aufs iPhone holen

1. Die Adresse aus Schritt 3 in Safari öffnen (nicht in Chrome).
2. Auf das Teilen-Symbol tippen, dann „Zum Home-Bildschirm“.
3. Die App erscheint als „Kassenlage“ auf dem Home-Bildschirm und startet ohne Browserleiste, auch ohne Internet.

Öffne die App danach immer über das Icon. Safari und die installierte App haben getrennte Speicher.

## 5. Am Laptop als App

Die Adresse in Edge oder Chrome öffnen. Rechts in der Adressleiste erscheint ein Symbol „App installieren“. Danach liegt Kassenlage im Startmenü.

## 6. Einrichten

Beim ersten Start „Gehalt und Steuerdaten eintragen“ wählen:

- Bruttogehalt pro Monat und seit wann es gilt
- Steuerklasse, Bundesland, Kirchensteuer, Kinder
- Zusatzbeitrag der Krankenkasse (steht auf der Lohnabrechnung, sonst leer lassen)
- Wochenstunden, Zuschläge im Inland und Ausland, Stunden je Werktag und Samstag auf Einsatz
- ob Einsatz-Anteile im selben Monat oder später ausgezahlt werden

Vergleiche danach unter „Mehr“, „Gehalt und Steuer“ das Netto mit deiner Lohnabrechnung. Weicht es ab, liegt es meist am Zusatzbeitrag der Krankenkasse oder an Abzügen wie VWL. Beides lässt sich unter „Mehr“, „Einstellungen“, „Gehalt und Zuschläge“ einstellen.

Lohnerhöhung: unter „Mehr“, „Einstellungen“, „Gehalt und Zuschläge“ auf „Lohnerhöhung eintragen“, neuen Betrag und das Datum, ab dem er gilt. Die Zeit davor bleibt unverändert. Weihnachtsgeld und Prämien kommen als „Einmalzahlung“ dazu.

**Kontostand eintragen:** Damit die App dein Vermögen kennt, braucht sie einmal deinen Kontostand. Auf dem Dashboard „Kontostand eintragen“ antippen, den Stand aus dem Online-Banking und das passende Datum eintragen. Alle importierten Buchungen davor und danach rechnet die App selbst dazu. Weicht der Stand später ab, trägst du ihn unter „Vermögen“ neu ein.

## 6a. Die fünf Bereiche

- **Dashboard:** Gesamtvermögen mit Verlauf (1 Woche, 1 Monat, 1 Jahr, alles), Veränderung seit gestern, in dieser Woche, diesem Monat und diesem Jahr. Darunter der Monat: verfügbares Geld, Einnahmen, Ausgaben, Überschuss, Einzahlung bei Trade Republic und das Kuchendiagramm. Einzelne Buchungen stehen hier nicht.
- **Ausgaben:** Kategorien mit Budgets, Monatsvergleich, feste Zahlungen. Ein Tipp auf eine Kategorie zeigt die Buchungen dahinter. Jede Buchung hat eine Detailseite mit Kategorie, Notiz und Markierung (Serviceeinsatz, Spese, Reisekosten, Investition).
- **Einsätze:** Serviceeinsätze berechnen und vergleichen.
- **Vermögen:** Girokonto, Trade Republic, Bargeld und weitere Konten. Scalable Capital steht als Altersvorsorge getrennt und zählt nicht zum Gesamtvermögen.
- **Mehr:** Gehalt und Steuer, Sparziele und Tipps, Import, Einstellungen (Hell oder Dunkel, Hinweise, Kategorien, Sicherung, Datenschutz).

Hinter jedem kleinen „i“ steht eine kurze Erklärung: was der Wert bedeutet, welche Daten dahinterstecken und warum er von der echten Abrechnung abweichen kann.

**Woher der Depotwert kommt:** Die App kennt keine Börsenkurse und schickt nichts ins Internet. Sie rechnet den Wert deines Trade-Republic-Depots aus den Kursen deiner eigenen Käufe und Sparpläne, meist also ein Punkt pro Monat. Trägst du unter „Vermögen“, „Trade Republic“ einen Depotwert ein, gilt dieser ab dem Tag. Das Guthaben auf dem Verrechnungskonto rechnet die App aus dem Export. Stimmt es nicht mit der Trade-Republic-App überein, trägst du es dort von Hand ein.

## 7. Daten importieren

Unter „Mehr“, „Daten importieren“ eine oder mehrere CSV-Dateien auswählen. Die App erkennt selbst, was es ist, und überspringt Buchungen, die schon da sind. Du kannst also ruhig überlappende Zeiträume importieren.

**Sparkasse:** Im Online-Banking das Girokonto öffnen, Zeitraum wählen, „Exportieren“, Format „CSV-CAMT“. Beim ersten Mal den längsten Zeitraum nehmen, danach reicht einmal im Monat. Vorgemerkte Umsätze lässt die App aus, sie kommen beim nächsten Import als gebuchte Umsätze.

**Trade Republic:** In der App auf Profil, Kontoauszüge, Transaktionsexport, Teilen, Zeitraum wählen, Erstellen. Die Datei in „Dateien“ sichern und in Kassenlage auswählen. Kartenzahlungen mit der Trade-Republic-Karte zählen in dieser Version nicht zu den Ausgaben.

**Scalable Capital:** Der kostenlose Tarif hat keinen Export. Unter „Vermögen“, „Scalable Capital“ den Sparplan einmal anlegen und gelegentlich den Depotwert eintragen.

**Kategorien:** Tippst du eine Buchung an und änderst die Kategorie, merkt sich die App das für diesen Empfänger, auch für künftige Importe. Überweisungen zwischen eigenen Konten bekommen „Umbuchung (zählt nicht mit)“.

## 8. Sicherung, iCloud und zweites Gerät

Die Daten liegen nur im Browser-Speicher des jeweiligen Geräts. Handy und Laptop gleichen sich nicht automatisch ab.

- **Sicherung erstellen:** „Mehr“, „Einstellungen“, „Sicherung und Sperre“, „Sicherung erstellen“, Passwort wählen, „Datei jetzt speichern“. Auf dem iPhone „In Dateien sichern“ wählen und iCloud Drive als Ort nehmen.
- **Auf ein anderes Gerät bringen:** dort die App öffnen, „Sicherung einspielen“, Datei und Passwort wählen. Das ersetzt die Daten auf diesem Gerät.
- **App-Sperre:** Mit einem Passwort werden die Daten auf dem Gerät verschlüsselt gespeichert. Es gibt kein „Passwort vergessen“. Erstelle vorher eine Sicherung.

Mach die Sicherung am besten nach jedem Import. Die App erinnert dich nach 30 Tagen.

## 9. App aktualisieren

Bekommst du neue Dateien, lade sie bei GitHub in dasselbe Repository hoch („Add file“, „Upload files“). Gleichnamige Dateien werden ersetzt. Die App zeigt die neue Fassung beim zweiten Öffnen danach. Deine Daten bleiben erhalten.

## 10. Jedes Jahr im Januar

Die Steuer- und Abgabenwerte stehen in `js/steuerwerte.js`. Für ein neues Jahr den Block `2026: { ... }` kopieren, die Jahreszahl ändern und die Werte anpassen: Tarifformel, Grundfreibetrag, Beitragsbemessungsgrenzen, Beitragssätze, Pauschalen. Fehlt ein Jahr, rechnet die App mit dem letzten bekannten und zeigt einen Hinweis.

In derselben Datei steht unter `FA.SPESEN` die amtliche Spesentabelle für das Ausland. Jede Zeile hat die Form `Land;voller Tag;An- und Abreisetag;Übernachtung`. Wenn das Bundesfinanzministerium die neue Tabelle veröffentlicht, die Zeilen ersetzen und `jahr` und `quelle` anpassen.

## 11. Woher die Zahlen kommen (Stand November 2026)

- Einkommensteuertarif 2026, § 32a EStG: Grundfreibetrag 12.348 €, Formeln der Tarifzonen
- Sozialversicherung 2026: Beitragsbemessungsgrenzen 5.812,50 € (Kranken- und Pflegeversicherung) und 8.450 € (Renten- und Arbeitslosenversicherung) pro Monat, Rentenversicherung 18,6 %, Arbeitslosenversicherung 2,6 %, Krankenversicherung 14,6 % plus Zusatzbeitrag (Durchschnitt 2,9 %), Pflegeversicherung 3,6 % plus 0,6 % für Kinderlose
- Vorsorgepauschale im Lohnsteuerabzug nach den Regeln ab 2026
- Solidaritätszuschlag: Freigrenze 20.350 € Jahressteuer
- Kirchensteuer: 8 % der Lohnsteuer in Baden-Württemberg und Bayern, sonst 9 %
- Entfernungspauschale 38 Cent ab dem ersten Kilometer, Dienstreisen 30 Cent je Kilometer
- Verpflegungspauschalen: Inland 28 € und 14 €. Ausland: die vollständige amtliche Tabelle 2026 mit 214 Ländern und Orten (BMF-Schreiben vom 5.12.2025, IV C 5 - S 2353/00094/007/012). Im Einsatzformular wählst du das Land aus der Liste, die App trägt den Satz ein. Für Länder, die nicht in der Tabelle stehen, gilt laut BMF der Satz von Luxemburg. Die App holt die Tabelle nicht aus dem Internet. Sie ist fest eingebaut und steht in `js/steuerwerte.js` unter `FA.SPESEN`. Das Bundesfinanzministerium veröffentlicht jedes Jahr im Dezember eine neue Tabelle, dann die Zeilen dort ersetzen.
- Bezahlt der Arbeitgeber das Frühstück, sinkt die Verpflegungspauschale je Übernachtung um 20 % des vollen Tagessatzes (§ 9 Abs. 4a EStG). Dafür gibt es im Formular ein Häkchen.

## 12. Was die App rechnet und was nicht

Alle Steuer-, Abgaben- und Spesenwerte sind Vorschätzungen. Verbindlich sind die Abrechnung deines Arbeitgebers und der Steuerbescheid. Die App gibt keine Steuer-, Rechts- oder Anlageberatung.

Vereinfachungen in dieser Version:

- Steuerklassen 1 bis 4. Die Klassen 5 und 6 fehlen.
- Kinderfreibeträge bei Kirchensteuer und Solidaritätszuschlag bleiben außen vor.
- Zuschläge gelten als voll steuer- und beitragspflichtig. Steuerfreie Nacht-, Sonntags- und Feiertagszuschläge sind nicht abgebildet.
- Mehrstunden gelten als ausbezahlt.
- Die App kennt keine Börsenkurse. Der Depotwert stammt aus deinen eigenen Kaufkursen oder aus Werten, die du einträgst. Zwischen zwei Käufen bleibt die Linie flach.
- Aktiensplits und andere Kapitalmaßnahmen im Trade-Republic-Export wertet die App nicht aus.
- Die Vorschau im Chat speichert nicht zuverlässig. Echte Daten gehören in die installierte App.
- Kein automatischer Bankabruf, keine Push-Nachrichten. Hinweise erscheinen in der Übersicht, sobald du Daten importierst.
