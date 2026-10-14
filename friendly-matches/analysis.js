'use strict';
const { EmbedBuilder } = require('discord.js');
function valid(n) { return typeof n === 'number' && Number.isFinite(n) && n >= 0; }
function total(players, key) { return players.length && players.every(p => valid(p[key])) ? players.reduce((sum, p) => sum + p[key], 0) : null; }
function fmt(n, digits = 0) { return valid(n) ? n.toLocaleString('de-DE', { maximumFractionDigits: digits }) : '–'; }
function rate(made, attempts) { return valid(made) && valid(attempts) && attempts > 0 && made <= attempts ? 100 * made / attempts : null; }
function midfield(match) {
  const players = match.own.players.filter(p => p.position === 'midfielder');
  if (!players.length) return 'Keine Mittelfeldspieler in den EA-Daten ausgewiesen. Der Aufbau lässt sich hier nicht beurteilen.';
  const made = total(players, 'passes'); const attempts = total(players, 'passAttempts'); const quote = rate(made, attempts);
  if (quote === null) return 'Keine vollständigen oder plausiblen Passdaten des Mittelfelds vorhanden. Der Aufbau lässt sich hier nicht beurteilen.';
  const failed = attempts - made;
  let verdict;
  if (quote < 75) verdict = 'Mindestens jeder vierte Mittelfeldpass kam nicht an. Die Passsicherheit ist in diesem Spiel ein klarer Ansatzpunkt für die Nachbesprechung.';
  else if (quote < 90) verdict = `Der überwiegende Teil der Mittelfeldpässe kam an. Die ${failed} nicht angekommenen Pässe sind ein Ansatzpunkt, um eure Ballverluste im Aufbau anzuschauen.`;
  else verdict = 'Das Mittelfeld hat seine Pässe überwiegend sicher angebracht. An der reinen Passsicherheit fällt hier wenig auf.';
  return `**${fmt(made)}/${fmt(attempts)} Pässe angekommen · ${fmt(quote, 1)} % · ${fmt(failed)} Fehlpässe**\n${verdict}\nOb die Pässe nach vorn führten oder unter Druck gespielt wurden, zeigen diese Werte nicht.`;
}
function finishing(match) {
  const team = match.own; const shots = team.shots;
  const playerGoals = total(team.players, 'goals');
  if (!valid(shots) || !valid(team.goals)) return 'Schuss- oder Torwerte fehlen. Die Abschlussausbeute lässt sich nicht bestimmen.';
  if (playerGoals === null || playerGoals !== team.goals || team.goals > shots) return `**EA-Ergebnis: ${fmt(team.goals)} Tore · ${fmt(shots)} Schüsse**\nTeamtore und dokumentierte Spielertore oder Schüsse passen nicht zusammen. Deshalb gibt es hier keine Abschlussbewertung; Wertungstore oder Eigentore können die Ausbeute verfälschen.`;
  if (!shots) return '**0 Schüsse · 0 Tore**\nIhr habt keinen erfassten Abschluss abgegeben. In diesem Spiel liegt der Ansatzpunkt zunächst darin, überhaupt zu Abschlüssen zu kommen.';
  const quote = 100 * team.goals / shots;
  const verdict = team.goals === 0 ? `Keiner eurer ${fmt(shots)} Abschlüsse führte zu einem Tor.`
    : `Ihr habt ${fmt(team.goals)} von ${fmt(shots)} Abschlüssen verwertet, also ungefähr einen Treffer je ${fmt(shots / team.goals, 1)} Schüsse.`;
  return `**${fmt(team.goals)} Tore aus ${fmt(shots)} Schüssen · ${fmt(quote, 1)} % Ausbeute**\n${verdict}\nOb gute Chancen vergeben oder ungünstige Abschlüsse genommen wurden, lässt sich ohne Chancenqualität nicht unterscheiden.`;
}
function defense(match) {
  const shots = match.opponent.shots; const goals = match.opponent.goals;
  const made = total(match.own.players, 'tackles'); const attempts = total(match.own.players, 'tackleAttempts'); const quote = rate(made, attempts);
  const lines = [`**Gegner: ${fmt(shots)} Schüsse · ${fmt(goals)} Tore**`];
  if (valid(shots) && valid(goals)) {
    if (!shots && !goals) lines.push('Ihr habt keinen erfassten gegnerischen Abschluss zugelassen und zu null gespielt.');
    else if (!goals) lines.push(`Ihr habt zu null gespielt, obwohl der Gegner ${fmt(shots)} Abschlüsse hatte.`);
    else lines.push(`Der Gegner hatte ${fmt(shots)} erfasste Abschlüsse; EA führt ${fmt(goals)} Gegentore für euch. Schaut euch die Situationen vor diesen Treffern als Team an.`);
  } else lines.push('Die gegnerischen Abschlusswerte fehlen; die defensive Belastung bleibt offen.');
  if (quote !== null) {
    lines.push(`**Tacklings im gesamten Team: ${fmt(made)}/${fmt(attempts)} erfolgreich · ${fmt(quote, 1)} %**`);
    lines.push(quote < 50 ? 'Mehr als die Hälfte eurer Tacklingversuche war nicht erfolgreich. Timing und Absicherung sind sinnvolle Prüfpunkte.' : 'Mindestens die Hälfte eurer Tacklingversuche war erfolgreich. Das allein sagt noch nichts über zugelassene Räume oder die Qualität der Gegenchancen.');
  } else if (attempts === 0) lines.push('Keine Tacklingversuche erfasst; daraus lässt sich keine Tacklingquote ableiten.');
  else lines.push('Die Tacklingdaten sind unvollständig.');
  return lines.join('\n');
}
function goalkeeper(match) {
  const keepers = match.own.players.filter(p => p.position === 'goalkeeper' && valid(p.secondsPlayed) && p.secondsPlayed > 0);
  if (!keepers.length) return 'Kein menschlicher Torwart mit Einsatzzeit in den EA-Daten ausgewiesen. Eine individuelle Torwartbewertung ist nicht möglich.';
  const saves = total(keepers, 'saves');
  const ratings = keepers.map(p => p.rating);
  const rating = ratings.every(valid) ? ratings.reduce((n, r) => n + r, 0) / ratings.length : null;
  const goals = match.opponent.goals;
  const lines = [`**${fmt(saves)} Paraden · ${fmt(goals)} Team-Gegentore · ${keepers.length > 1 ? 'Ø ' : ''}EA-Note ${fmt(rating, 1)}**`];
  if (keepers.length !== 1) lines.push('Mehrere Torwarte mit Einsatzzeit erfasst. Die Gegentore können keinem einzelnen Keeper sicher zugeordnet werden.');
  else if (total(match.opponent.players, 'goals') !== goals) lines.push('EA-Teamtore und dokumentierte gegnerische Spielertore weichen ab. Deshalb gibt es keine individuelle Einordnung der Gegentore.');
  else if (keepers[0].secondsPlayed < match.durationSeconds - 60) lines.push('Der Keeper war nicht während der gesamten erfassten Spielzeit dabei. Die Team-Gegentore lassen sich ihm nicht vollständig zuordnen.');
  else if (!valid(saves) || !valid(goals)) lines.push('Für eine Einordnung fehlen Paraden oder Gegentore.');
  else if (!goals) lines.push(saves > 0 ? `Der Keeper hat ${fmt(saves)} Paraden beigesteuert und zu null gespielt.` : 'Zu null und ohne erfasste Parade. Der Keeper musste laut diesen Werten wenig eingreifen.');
  else if (saves > 0) lines.push(`Der Keeper hat ${fmt(saves)} Abschlüsse abgewehrt; trotzdem gab es ${fmt(goals)} Gegentore. Ob die Gegentore haltbar waren, ist aus den Werten nicht erkennbar.`);
  else lines.push('Keine Parade bei Gegentoren erfasst. Das ist ein Anlass, die Gegentorszenen anzusehen, aber kein Beleg für Torwartfehler.');
  return lines.join('\n');
}
function buildAnalysis(match) {
  const embed = new EmbedBuilder().setColor(0xe84a8a).setTitle('🔎 Matchanalyse · Loco Squad');
  const labels = ['⚙️ Spielaufbau im Mittelfeld', '🎯 Chancenverwertung', '🛡️ Defensive Stabilität', '🧤 Torwartleistung'];
  if (match.termination || !valid(match.durationSeconds)) {
    embed.setDescription(match.termination ? `Vorzeitig beendet${match.minutes === null ? '' : ` nach ca. ${match.minutes}′`}. EA-Wertung: ${match.own.goals}:${match.opponent.goals}.` : 'Die Spielzeit fehlt.');
    labels.forEach(name => embed.addFields({ name, value: 'Keine reguläre Leistungsbewertung: Die Daten bilden kein verlässlich vollständiges Spiel ab.' }));
  } else {
    [midfield, finishing, defense, goalkeeper].forEach((analyze, index) => embed.addFields({ name: labels[index], value: analyze(match).slice(0, 1024) }));
  }
  embed.setFooter({ text: 'Einordnung dieses Spiels anhand der EA-Werte · keine Ursachen- oder Schuldzuweisung' });
  return embed;
}
module.exports = { buildAnalysis, midfield, finishing, defense, goalkeeper };
