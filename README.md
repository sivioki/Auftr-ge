# Auftragsboard

Ein einfaches Kanban-Board (ähnlich wie Asana/Trello), mit dem du Aufträge von einem Bereich in den nächsten schiebst.

## Starten

Keine Installation nötig – einfach `index.html` im Browser öffnen.
Oder lokal ausliefern: `python3 -m http.server` und http://localhost:8000 aufrufen.

## Funktionen

- **Bereiche** (Spalten) anlegen, per Doppelklick umbenennen, verschieben (‹ ›) und löschen (×)
- **Aufträge** mit Titel, Beschreibung, Zuständigem, Fälligkeitsdatum und Priorität
- **Verschieben** per Drag & Drop, mit den Pfeilen ← → auf der Karte, über das Feld „Bereich“ im Dialog
  oder per Tastatur (Karte fokussieren, `Shift` + `←`/`→`)
- **Verlauf** je Auftrag: wann er in welchen Bereich verschoben wurde
- Überfällige Aufträge werden rot markiert
- **Suche** über Titel, Beschreibung und Zuständige
- **Export/Import** als JSON-Datei (Backup oder Übertragen auf ein anderes Gerät)
- Daten werden automatisch im Browser (localStorage) gespeichert
- Funktioniert auch am Handy und im Dark Mode
