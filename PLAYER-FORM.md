# Spieler-Formkurven

`npm start` startet einen festen Spieler-Embed pro aktuellem Mitglied mit Rolle `1426495393742454834` im Kanal `1560060808799723601`. Bots werden nicht aufgenommen. Neue Spieler bekommen einen Embed; eigene Formkurven-Nachrichten von ehemaligen Rollenmitgliedern werden entfernt. Andere Nachrichten bleiben unberührt.

EA-Verknüpfungen stammen aus dem bestehenden Power-Ranking-Speicher (`data/powerRanking.json`): Discord-ID, EA-Spieler-ID und Spielername. Die kontobezogene Spieler-ID wird auch bei einer früheren Club-Verknüpfung wiederverwendet, aber ausschließlich Leistungen für Club 18360 werden ausgewertet. Spieler-ID hat Vorrang. Nur bei fehlender Spieler-ID wird ein eindeutig passender Name benutzt. Doppelte Zuordnungen werden nicht ausgewertet. Ohne Verknüpfung erscheint ein Hinweis auf den vorhandenen Verknüpfungsbutton im Power-Ranking.

TW, Abwehr, Mittelfeld und Sturm werden unabhängig verglichen: letzte fünf gültige Einsätze gegenüber den fünf davor. Keine Positionsmischung, kein Gesamtscore. Unter zehn Einsätzen werden die vorhandenen Werte mit „Noch kein Trend“ angezeigt. Passquote wird aus der Summe erfolgreicher und versuchter Pässe berechnet. Sonstige Werte sind Durchschnittswerte pro gültigem Einsatz. Pfeile zeigen nur die Änderung der einzelnen Messgröße und sind kein Urteil über die Gesamtleistung.

Es zählen gespeicherte Friendly Matches aus dem Zeitfenster 20–04 Uhr Europe/Berlin. Vorzeitig beendete Spiele, fehlende Spielzeit und individuelle Einsätze unter 45 Ingame-Minuten werden ausgeschlossen. Die EA-Positionen sind nur TW/ABW/MIT/ANG; exakte Slots liefert der geprüfte Abruf nicht.

Abfragen laufen alle zehn Minuten im Nachtfenster, einschließlich Abschlussprüfung um 04:00. Die Embeds werden auch tagsüber alle zehn Minuten auf Rollen- oder Verknüpfungsänderungen geprüft, ohne dann EA abzufragen. Es gibt keine zusätzliche Start/Stop-Pflicht. Beim ersten Start werden die noch über EA verfügbaren passenden Matches gespeichert; daraus lässt sich keine vollständige frühere Saison rekonstruieren. Später gelieferte EA-Daten können vorhandene Match-Snapshots ergänzen.

Speicherung: `data/playerForm.json`, optional unter `DATA_DIR`. Dieser Ordner muss persistent sein, um die Formhistorie über Deployments hinweg zu behalten. Die Datei enthält Match-Snapshots und die Nachrichten-IDs, keine Tokens. Der Kanalverlauf verhindert doppelte Spieler-Embeds auch nach einem Verlust der Nachrichten-IDs. Ein Verlust der Matchdatei kann historische Werte verlieren, weil EA nur eine begrenzte Matchhistorie liefert.

Bei einem EA-Ausfall bleiben gespeicherte Werte erhalten. Als Zeitstempel erscheint der letzte gültige Einsatz des Spielers, nicht eine vorgetäuschte frische Erfassung. Im Kanal sind die üblichen Rechte „Kanal ansehen“, „Nachrichtenverlauf anzeigen“, „Nachrichten senden“, „Links einbetten“ nötig. Der Bot braucht zum Rollenabgleich Zugriff auf die Mitgliederliste, wie die bestehenden Kader- und Rankingfunktionen.

Prüfung: `npm test`. Logs haben Präfix `[player-form]`.

## Manuelle EA-Zuordnung durch die Teamleitung

Das Admin-Panel des Power-Rankings enthält „EA-ID zuweisen“. Teamleitung wählt ein Discord-Mitglied mit Loco-Squad-Rolle aus und gibt dessen exakten EA-Spielernamen oder numerische EA-Spieler-ID ein, keine Club-ID. Das Profil wird gegen Clubmitglieder und verfügbare Friendly Matches des im Ranking verbundenen Clubs geprüft. Wenn eine der beiden EA-Abfragen ausfällt, kann die andere Quelle verwendet werden. Bei komplettem Ausfall, nicht gefundenem oder mehrdeutigem Profil wird nichts gespeichert.

Die bestehende Zuordnung des ausgewählten Mitglieds wird ersetzt. Bereits anderen Mitgliedern zugewiesene Spieler-IDs oder Namen werden abgewiesen, auch bei älteren Clubverknüpfungen. Admin-Berechtigung wird an jedem Schritt geprüft. Gespeichert werden dieselben Felder wie bei der Selbstverknüpfung plus zuweisende Admin-ID und Quelle `admin_manual`. Das Ranking wird sofort aktualisiert; die Formkurve übernimmt den Link bei ihrer nächsten Zehn-Minuten-Prüfung.
