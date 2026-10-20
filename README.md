# Auftragsboard

Ein Kanban-Board im Stil von Asana, mit dem du Aufträge von einem Bereich in den nächsten schiebst.
Design und Bedienung sind an Asanas Board- und Listenansicht angelehnt; alle Bilder sind eigene Illustrationen.

## Starten

Keine Installation nötig – einfach `index.html` im Browser öffnen.
Oder lokal ausliefern: `python3 -m http.server` und http://localhost:8000 aufrufen.

## Funktionen

- **Bereiche** (Spalten) anlegen: am Ende über „+ Bereich hinzufügen“ oder mit **+** im Spaltenkopf
  direkt rechts neben einer bestehenden Spalte; per Doppelklick umbenennen, verschieben (‹ ›) und löschen (×)
- **Aufträge** mit Titel, Beschreibung, Zuständigem, Fälligkeitsdatum und Priorität
- **Eigene Felder** (Button „Felder“): z. B. Kunde, Auftragsnummer, Betrag – Typen Text, mehrzeiliger Text,
  Zahl, Datum, Auswahl, Ja/Nein und Link. Felder lassen sich umbenennen, sortieren, löschen und
  wahlweise auf der Karte anzeigen
- **Verschieben** per Drag & Drop, mit den Pfeilen ← → auf der Karte, über das Feld „Bereich“ im Dialog
  oder per Tastatur (Karte fokussieren, `Shift` + `←`/`→`)
- **Seitenleiste mit allen Bereichen** (z. B. Resinvorbereitung → Kommissionieren → Laser → Aufbau →
  Produktion → Quality → Verpackung → Erledigt) inkl. Anzahl offener Aufträge; Klick zeigt die Liste des Bereichs
- **Board- und Listenansicht** (Tabs „Board“ / „Liste“)
- **Liste wie in Asana:** pro Bereich nach **Gruppen** (z. B. VC / MC) unterteilt, Abschnitte einklappbar,
  Sortieren per Klick auf die Spaltenüberschrift, **Summen** für Zahlenfelder (z. B. Säulen) je Gruppe,
  Button „→ nächster Bereich“ beim Überfahren einer Zeile
- **Unteraufgaben** je Auftrag mit Fortschritt (z. B. ☑ 1/3)
- **Standardfelder** Zuständig, Fälligkeit und Priorität einzeln ein- oder ausblendbar
- **Karten wie in Asana:** Titelbild, Erledigt-Haken, farbige Pillen für Priorität und Auswahlfelder,
  Avatar mit Initialen, Fälligkeit als „Heute“, „Morgen“, „Gestern“ oder Datum
- **Titelbilder** pro Auftrag hochladen (werden automatisch verkleinert)
- **Erledigt** markieren und erledigte Aufträge ausblenden
- **Beispiele**: lädt ein Produktions-Board mit Beispielaufträgen (ausgedachte Kunden und Nummern)
- **Verlauf** je Auftrag: wann er in welchen Bereich verschoben wurde
- Überfällige Aufträge werden rot, bald fällige grün markiert
- **Suche** über Titel, Beschreibung, Zuständige und eigene Felder
- **Export/Import** als JSON-Datei (Backup oder Übertragen auf ein anderes Gerät)
- Daten werden automatisch im Browser (localStorage) gespeichert
- Funktioniert auch am Handy und im Dark Mode
