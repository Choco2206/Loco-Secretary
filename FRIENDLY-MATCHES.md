# Automatische Friendly-Match-Statistiken

Der normale Start mit `npm start` aktiviert den Feed für EA-Club **18360** (Loco Squad, `common-gen5`) in Discord-Kanal **1559992305467916399**.

Der Bot prüft täglich von **20:00 bis 04:00 Uhr Europe/Berlin** alle zehn Minuten, mit einer Abschlussprüfung um 04:00. Sommer- und Winterzeit werden automatisch berücksichtigt. Es werden alle neuen verfügbaren Freundschaftsspiele aus diesem Abend chronologisch veröffentlicht, nicht nur das jeweils letzte Spiel. Beim Start während des Zeitfensters werden die verfügbaren Spiele seit 20 Uhr nachgeholt. Ältere Abende und Spiele außerhalb des Zeitfensters werden nicht veröffentlicht.

Jedes Match bekommt eine Nachricht mit drei Embeds:

1. Ergebnisgrafik: Loco-Logo links, Endergebnis mittig, Gegnerlogo rechts. Darunter Torschützen, Vorlagen, offizieller EA-Man-of-the-Match und Teamwerte (Schüsse, Passquote, durchschnittliches Rating, Tackle-Quote, erfolgreiche Pässe, Paraden).
2. Spielertabelle Loco Squad mit Position, Rating, Toren, Assists, erfolgreichen/versuchten Pässen und Passquote.
3. Gleiche Tabelle für den Gegner.

Logos stammen aus den EA-Wappen-Assets. Wenn EA kein passendes Bild liefert, zeigt die Grafik die Teaminitialen. Fehlende Werte erscheinen als „–“. Teamquoten werden aus den summierten Spielerwerten berechnet, nicht als Durchschnitt der individuellen Quoten. Spielzeit entspricht dem längsten von EA gelieferten `secondsPlayed`/`gameTime`-Wert, auf Minuten gerundet. MOTM wird ausschließlich anhand der EA-Markierung angezeigt.

Die EA-Anfragen verwenden den bestehenden Client samt Zeitlimit, Anfrageabstand und Wiederholungen. `maxResultCount=50` wird angefragt; EA kann dennoch weniger Spiele zurückgeben. Spiele, die EA zwischen zwei Prüfungen bereits aus seiner Historie entfernt, lassen sich damit nicht garantiert nachholen.

Doppelte Veröffentlichungen werden durch Match-IDs in `data/friendlyMatches.json` verhindert. Vor jeder Abfrage wird zusätzlich der jüngste Discord-Verlauf auf eigene Match-Nachrichten geprüft, auch wenn die lokale Datei durch ein Deployment verloren gegangen ist. Nach einem unklaren Sendefehler wird der nächste Versuch ebenfalls zuerst mit dem Kanal abgeglichen. Ein beschädigter Speicher wird nicht stillschweigend gelöscht.

Der Bot braucht im Zielkanal „Kanal ansehen“, „Nachrichtenverlauf anzeigen“, „Nachrichten senden“, „Links einbetten“ und „Dateien anhängen“. Die Speicherdatei sollte auf einem persistenten Volume liegen. Optional setzt `DATA_DIR` den Speicherordner für diesen Feed. Es wird kein Discord-Token oder zusätzlicher API-Key benötigt, außer dem bereits konfigurierten Bot-Token.

Prüfen: `npm test`. Ein Vorschau-Rendering wird mit echten EA-Response-Strukturen in den Tests geprüft. Nach einem Deployment lassen sich Aktivierung und neue Posts an den Logzeilen mit `[friendly-matches]` erkennen.

## Einmalige Vorschau vom 14.10.2026

Auf Nutzerwunsch wird Match `99102133640243` (Loco Squad 0:4 TSG Purion) einmal außerhalb des Abendfilters berücksichtigt. Der kurzlebige Auftrag in `friendly-matches/preview-request.json` läuft am 14.10.2026 um 22:30 Uhr deutscher Zeit automatisch aus. Normale Match-ID-Speicherung und Discord-Verlaufsabgleich verhindern doppelte Posts. Danach bleibt ausschließlich der normale Zeitplan aktiv.
