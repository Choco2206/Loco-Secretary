# Automatische Friendly-Match-Statistiken

Der normale Start mit `npm start` aktiviert den Feed für EA-Club **18360** (Loco Squad, `common-gen5`) in Discord-Kanal **1559992305467916399**.

Der Bot prüft täglich von **20:00 bis 04:00 Uhr Europe/Berlin** alle zehn Minuten, mit einer Abschlussprüfung um 04:00. Sommer- und Winterzeit werden automatisch berücksichtigt. Es werden alle neuen verfügbaren Freundschaftsspiele aus diesem Abend chronologisch veröffentlicht, nicht nur das jeweils letzte Spiel. Beim Start während des Zeitfensters werden die verfügbaren Spiele seit 20 Uhr nachgeholt. Ältere Abende und Spiele außerhalb des Zeitfensters werden nicht veröffentlicht.

Jedes Match bekommt eine Nachricht mit fünf Embeds:

1. Ergebnisgrafik ganz oben: Loco-Logo links, Endergebnis mittig, Gegnerlogo rechts.
2. Darunter Torschützen, Vorlagen, offizieller EA-Man-of-the-Match und Teamwerte (Schüsse, Passquote, durchschnittliches Rating, Tackle-Quote, erfolgreiche Pässe, Paraden).
3. Spielertabelle Loco Squad mit kleinem Teamlogo mit Position, Rating, Toren, Assists, erfolgreichen/versuchten Pässen und Passquote.
4. Gleiche Tabelle für den Gegner, ebenfalls mit kleinem Teamlogo.
5. Matchanalyse für Loco Squad: Mittelfeldaufbau, Abschlussausbeute, Defensive und Torwart, jeweils mit konkreten Zahlen und einer begrenzten Einordnung dieses Spiels.

Logos stammen aus den EA-Wappen-Assets. Wenn EA kein passendes Bild liefert, zeigt die Grafik die Teaminitialen. Fehlende Werte erscheinen als „–“. Teamquoten werden aus den summierten Spielerwerten berechnet, nicht als Durchschnitt der individuellen Quoten. Spielzeit entspricht dem längsten von EA gelieferten `secondsPlayed`/`gameTime`-Wert, auf Minuten gerundet. MOTM wird ausschließlich anhand der EA-Markierung angezeigt.

Die EA-Anfragen verwenden den bestehenden Client samt Zeitlimit, Anfrageabstand und Wiederholungen. `maxResultCount=50` wird angefragt; EA kann dennoch weniger Spiele zurückgeben. Spiele, die EA zwischen zwei Prüfungen bereits aus seiner Historie entfernt, lassen sich damit nicht garantiert nachholen.

Doppelte Veröffentlichungen werden durch Match-IDs in `data/friendlyMatches.json` verhindert. Vor jeder Abfrage wird zusätzlich der jüngste Discord-Verlauf auf eigene Match-Nachrichten geprüft, auch wenn die lokale Datei durch ein Deployment verloren gegangen ist. Nach einem unklaren Sendefehler wird der nächste Versuch ebenfalls zuerst mit dem Kanal abgeglichen. Ein beschädigter Speicher wird nicht stillschweigend gelöscht.

Der Bot braucht im Zielkanal „Kanal ansehen“, „Nachrichtenverlauf anzeigen“, „Nachrichten senden“, „Links einbetten“ und „Dateien anhängen“. Die Speicherdatei sollte auf einem persistenten Volume liegen. Optional setzt `DATA_DIR` den Speicherordner für diesen Feed. Es wird kein Discord-Token oder zusätzlicher API-Key benötigt, außer dem bereits konfigurierten Bot-Token.

Prüfen: `npm test`. Ein Vorschau-Rendering wird mit echten EA-Response-Strukturen in den Tests geprüft. Nach einem Deployment lassen sich Aktivierung und neue Posts an den Logzeilen mit `[friendly-matches]` erkennen.

## Einmalige Vorschau vom 14.10.2026

Auf Nutzerwunsch wird Match `99102133640243` (Loco Squad 0:4 TSG Purion) einmal außerhalb des Abendfilters berücksichtigt. Der kurzlebige Auftrag in `friendly-matches/preview-request.json` läuft am 14.10.2026 um 22:30 Uhr deutscher Zeit automatisch aus. Normale Match-ID-Speicherung und Discord-Verlaufsabgleich verhindern doppelte Posts. Danach bleibt ausschließlich der normale Zeitplan aktiv.

Layout 2 setzt das Ergebnisbild in ein eigenes erstes Embed, damit Discord es vor den Statistikfeldern zeigt. Die bereits veröffentlichte einmalige Vorschau wird vor Ablauf des Vorschauauftrags bearbeitet, ohne ein weiteres Match zu posten.

Die geprüften EA-Matchantworten liefern `pos` nur als `goalkeeper`, `defender`, `midfielder` oder `forward`. Formation und exakte Slots wie RM, RDM oder LS sind darin nicht enthalten. Die Anzeige bleibt daher TW/ABW/MIT/ANG; aus der Anzahl der Spieler oder deren Archetypen wird keine Formation geraten.

## Spielzeit und vorzeitiges Ende

Die maximale positive Spielzeit der Spieler wird in Grafik und Statistiktext in gerundeten Ingame-Minuten angezeigt. Kurze Einsatzzeiten einzelner Spieler markieren ein durchgespieltes Match nicht als Abbruch. Wenn die maximale Spielzeit unter 90 Minuten liegt, erscheint „Vorzeitig beendet nach ca. … · EA-Wertung …“. Ein gesetztes `winnerByDnf` erzeugt „Abbruch von EA gemeldet“, auch bei 90 oder mehr Minuten. Fehlen positive Spielzeitwerte, wird keine Dauer oder vorzeitige Beendigung erfunden.

Das ist eine Erkennung anhand der gelieferten Daten, keine sichere Aussage über Quit, Verbindungsabbruch oder andere Ursachen. Der Stand beim Abbruch wird nicht aus den individuellen Torschützen rekonstruiert, weil beispielsweise Eigentore und Wertungstore dabei fehlen können. Das von EA gelieferte Ergebnis bleibt maßgeblich.

## Matchanalyse

Der Analyse-Embed steht hinter der Gegner-Spielertabelle. Er verwendet ausschließlich das jeweilige Match, keinen historischen Vergleich. Die Texte sind aus Zahlen abgeleitete feste Regeln, keine erfundenen Beobachtungen von Spielszenen. Beim Mittelfeld werden erfolgreiche und versuchte Pässe summiert. Unter 75 % wird auf mindestens jeden vierten nicht angekommenen Pass hingewiesen; ab 90 % auf hohe reine Passsicherheit. Diese Einordnung belegt keine Progression oder Kreativität. Abschlussausbeute ist Teamtore/Schüsse. Wenn Teamtore, Spielertore und Schüsse nicht zusammenpassen, wird keine Ausbeute bewertet. Chancequalität oder xG liefert der geprüfte Abruf nicht.

Defensive Einordnung nutzt Gegenabschlüsse, Gegentore und erfolgreiche Tacklingversuche aller eigenen Spieler. Die Verteidigung wird nicht pauschal für Team-Gegentore verantwortlich gemacht. Torwarttexte unterscheiden fehlende Keeper, volle oder kurze Einsatzzeit und mehrere Keeper. Gegentore werden bei unklarer Einsatzzeit nicht einem Spieler zugeordnet. Es wird keine vermeintliche Fangquote aus allen gegnerischen Schüssen berechnet. Abbruchspiele und Spiele ohne positive Dauer bekommen einen Hinweis statt normaler Leistungsbewertung.

## Nachpflege vorhandener Matchposts

Bei jeder aktiven EA-Prüfung gleicht der Bot bereits veröffentlichte Match-IDs mit den noch verfügbaren EA-Matches ab. Fehlt einem passenden eigenen Post die Matchanalyse, wird sie als letzter Embed an dieselbe Nachricht angehängt. Vorhandene Embeds und Anhänge bleiben erhalten. Autor und Match-ID müssen übereinstimmen. Der Kanalverlauf und gespeicherte Layoutversion verhindern doppelte Ergänzungen nach Neustarts. Fehlgeschlagene Änderungen werden bei der nächsten Prüfung erneut versucht. Für Matches, deren Daten EA nicht mehr liefert, wird keine Analyse erfunden. Es werden 50 Matches angefragt; die tatsächliche Zahl hängt von EA ab.
