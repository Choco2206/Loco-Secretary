'use strict';
const { EmbedBuilder } = require('discord.js');
const ANALYSIS_VERSION = 7;
function valid(n) { return typeof n === 'number' && Number.isFinite(n) && n >= 0; }
function total(players, key) { return players.length && players.every(p => valid(p[key])) ? players.reduce((sum, p) => sum + p[key], 0) : null; }
function fmt(n, digits = 0) { return valid(n) ? n.toLocaleString('de-DE', { maximumFractionDigits: digits }) : '–'; }
function name(p) { return String(`${p.name || 'Spieler'}${p.lineupPosition ? ` · ${p.lineupPosition}` : ''}`).slice(0, 40).replace(/([\\*_`~|<>])/g, '\\$1'); }
function rate(made, attempts) { return valid(made) && valid(attempts) && attempts > 0 && made <= attempts ? 100 * made / attempts : null; }
function passing(team, position) {
  const rows = position ? team.players.filter(p => p.position === position) : team.players;
  const made = total(rows, 'passes'); const attempts = total(rows, 'passAttempts');
  return { rows, made, attempts, quote: rate(made, attempts) };
}
function passLabel(p) { return `${fmt(p.made)}/${fmt(p.attempts)} Pässe · ${fmt(p.quote, 1)} %`; }
function tackles(team) {
  const made = total(team.players, 'tackles'); const attempts = total(team.players, 'tackleAttempts');
  return { made, attempts, quote: rate(made, attempts) };
}
function keeperContext(team) {
  const rows = team.players.filter(p => p.position === 'goalkeeper' && valid(p.secondsPlayed) && p.secondsPlayed > 0);
  return { rows, saves: total(rows, 'saves'), rating: rows.length === 1 && valid(rows[0].rating) ? rows[0].rating : null };
}
function scoring(team) {
  return valid(team.goals) && valid(team.shots) && total(team.players, 'goals') === team.goals && team.goals <= team.shots;
}
function passHighlights(rows) {
  const eligible = rows.filter(p => valid(p.passAttempts) && p.passAttempts >= 10 && rate(p.passes, p.passAttempts) !== null);
  const ranked = eligible.map(p => ({ p, q: rate(p.passes, p.passAttempts) })).sort((a, b) => a.q - b.q || b.p.passAttempts - a.p.passAttempts);
  const low = ranked[0]; const best = [...ranked].sort((a, b) => b.q - a.q || b.p.passAttempts - a.p.passAttempts)[0];
  const lines = [];
  if (low && low.q < 85 && low.p.passAttempts - low.p.passes >= 3) lines.push(`**${name(low.p)}:** ${low.p.passAttempts - low.p.passes} von ${low.p.passAttempts} Pässen kamen nicht an (${fmt(low.q, 1)} % angekommen). Passentscheidungen in diesen Szenen prüfen.`);
  if (best && best.q >= 90 && (!lines.length || best.p.id !== low.p.id)) lines.push(`**${name(best.p)}** brachte ${best.p.passes}/${best.p.passAttempts} Pässe an (${fmt(best.q, 1)} %): hohe Passsicherheit bei mindestens zehn Versuchen.`);
  return lines.slice(0, 2);
}
function midfield(match) {
  const own = passing(match.own, 'midfielder'); const opp = passing(match.opponent, 'midfielder');
  const lines = [`**Mittelfeld Loco: ${passLabel(own)}**`];
  if (own.quote === null) lines.push('Keine vollständigen oder plausiblen eigenen Mittelfeld-Passdaten vorhanden; der Aufbau bleibt offen.');
  else {
    lines.push(`${own.attempts - own.made} Fehlpässe im eigenen Mittelfeld.`);
    if (opp.quote !== null) {
      const delta = own.quote - opp.quote;
      lines.push(Math.abs(delta) < 3 ? 'Eure Passsicherheit im Mittelfeld war im Spielkontext unauffällig.' : delta < 0 ? 'Die Passsicherheit im Mittelfeld war in diesem Spiel ein Ansatzpunkt: die nicht angekommenen Zuspiele nachbesprechen.' : 'Die Passsicherheit im Mittelfeld war in diesem Spiel eine relative Stärke.');
      if (valid(match.own.shots) && valid(match.opponent.shots) && own.attempts > opp.attempts && match.own.shots < match.opponent.shots) lines.push('Euer Passaufwand im Mittelfeld schlug sich nicht in einem Abschlussvorteil nieder. Den Übergang vom Passspiel zum Abschluss anschauen.');
    }
    lines.push(...passHighlights(own.rows));
  }
  return lines.join(' ');
}
function finishing(match) {
  const own = match.own; const opp = match.opponent;
  if (!valid(own.shots) || !valid(own.goals)) return 'Schuss- oder Torwerte fehlen. Die Abschlussausbeute lässt sich nicht bestimmen.';
  if (!scoring(own)) return `**Loco: ${fmt(own.goals)} Tore · ${fmt(own.shots)} Schüsse**\nTeamtore, dokumentierte Spielertore oder Schüsse passen nicht zusammen. Deshalb keine Abschlussbewertung; Wertungs- oder Eigentore können die Ausbeute verfälschen.`;
  const quote = rate(own.goals, own.shots);
  const lines = [`**Loco: ${own.goals} Tore aus ${own.shots} Schüssen${quote === null ? '' : ` · ${fmt(quote, 1)} % Ausbeute`}**`];
  const oppQuote = scoring(opp) ? rate(opp.goals, opp.shots) : null;
  const opposingKeeper = keeperContext(opp);
  if (opposingKeeper.saves > 0) lines.push('Ein Teil eurer Abschlüsse wurde vom gegnerischen Torwart abgewehrt. Ob Platzierung oder Chancenqualität das Problem war, zeigen erst die Szenen.');
  if (!own.shots) lines.push('Ihr habt keinen erfassten Abschluss abgegeben: zuerst die Abschlussfindung nachbesprechen.');
  else if (!own.goals) lines.push(`Keiner eurer ${own.shots} Abschlüsse führte zu einem Tor.`);
  else if (quote !== null && oppQuote !== null && own.shots > opp.shots && quote < oppQuote) lines.push('Euer Abschlussvolumen reichte nicht für eine entsprechend hohe Ausbeute. Die Auswahl und Ausführung der Abschlüsse nachbesprechen.');
  else if (quote !== null && oppQuote !== null && quote > oppQuote) lines.push('Eure Verwertung war im Spielkontext eine relative Stärke.');
  const attackers = own.players.filter(p => p.position !== 'goalkeeper' && valid(p.shots) && p.shots >= 3 && valid(p.goals) && p.goals <= p.shots);
  const waste = attackers.filter(p => p.goals === 0).sort((a, b) => b.shots - a.shots)[0];
  const scorer = own.players.filter(p => valid(p.goals) && p.goals > 0 && valid(p.shots) && p.goals <= p.shots).sort((a, b) => b.goals - a.goals || a.shots - b.shots)[0];
  if (waste) lines.push(`**${name(waste)}:** ${waste.shots} Schüsse ohne Tor. Diese Abschlussszenen gezielt anschauen.`);
  if (scorer) lines.push(`**${name(scorer)}:** ${scorer.goals} Treffer aus ${scorer.shots} Abschlüssen${valid(scorer.assists) && scorer.assists > 0 ? ` und ${scorer.assists} Vorlagen` : ''}.`);
  else {
    const creator = own.players.filter(p => valid(p.assists) && p.assists >= 2).sort((a, b) => b.assists - a.assists)[0];
    if (creator && (!waste || creator.id !== waste.id)) lines.push(`**${name(creator)}:** ${creator.assists} Vorlagen als positiver Beitrag zur Torentstehung.`);
  }
  return lines.join(' ');
}
function defense(match) {
  const own = tackles(match.own); const opp = tackles(match.opponent);
  const lines = [`**Loco ließ ${fmt(match.opponent.shots)} Schüsse und ${fmt(match.opponent.goals)} Gegentore zu.**`,
    `**Loco-Tacklings: ${fmt(own.made)}/${fmt(own.attempts)} erfolgreich · ${fmt(own.quote, 1)} %**`];
  if (own.quote !== null && opp.quote !== null && own.attempts >= 5 && opp.attempts >= 5) {
    lines.push(own.quote < opp.quote ? 'Die Erfolgsquote eurer Tacklings fiel im Spielkontext niedrig aus. Timing und Absicherung als gesamtes Team prüfen.' : own.quote > opp.quote ? 'Die Erfolgsquote eurer Tacklings war eine relative Stärke. Die zugelassenen Abschlüsse trotzdem gemeinsam betrachten.' : 'Die Tacklingquote allein erklärt den Spielverlauf nicht.');
  }
  if (valid(match.opponent.shots) && valid(match.own.shots) && match.opponent.shots > match.own.shots) lines.push('Die Schussbilanz zeigt, dass Loco zu viele gegnerische Abschlussgelegenheiten im Verhältnis zu den eigenen zuließ. Ihre Entstehung ist ein Schwerpunkt.');
  const candidates = match.own.players.filter(p => ['defender', 'midfielder'].includes(p.position) && p.tackleAttempts >= 5 && rate(p.tackles, p.tackleAttempts) !== null);
  const low = candidates.filter(p => rate(p.tackles, p.tackleAttempts) < 50).sort((a, b) => rate(a.tackles, a.tackleAttempts) - rate(b.tackles, b.tackleAttempts) || b.tackleAttempts - a.tackleAttempts)[0];
  const strong = candidates.filter(p => rate(p.tackles, p.tackleAttempts) >= 70).sort((a, b) => b.tackles - a.tackles)[0];
  if (low) lines.push(`**${name(low)}:** ${low.tackles}/${low.tackleAttempts} Tacklings erfolgreich. Die erfolglosen Versuche auf Timing und Unterstützung prüfen.`);
  if (strong) lines.push(`**${name(strong)}:** ${strong.tackles}/${strong.tackleAttempts} Tacklings erfolgreich, ein positiver Beitrag zu den Balleroberungen.`);
  return lines.join(' ');
}
function goalkeeper(match) {
  const own = keeperContext(match.own); const opp = keeperContext(match.opponent);
  const lines = [];
  if (!own.rows.length) lines.push('Kein menschlicher Torwart mit Einsatzzeit bei Loco in den EA-Daten ausgewiesen. Eine individuelle Bewertung ist nicht möglich.');
  else {
    lines.push(`**${own.rows.length === 1 ? name(own.rows[0]) : 'Loco-Torwarte'}: ${fmt(own.saves)} Paraden · EA-Note ${fmt(own.rating, 1)}**`);
    if (own.rows.length > 1) lines.push('Mehrere Torwarte mit Einsatzzeit: keine sichere individuelle Zuordnung der Team-Gegentore.');
    else if (own.rows[0].secondsPlayed < match.durationSeconds - 60) lines.push('Der Keeper war nicht während der gesamten erfassten Spielzeit dabei; die Team-Gegentore werden ihm nicht vollständig zugeordnet.');
  }
  lines.push(`Bei ${fmt(match.opponent.shots)} gegnerischen Schüssen kassierte Loco ${fmt(match.opponent.goals)} Gegentore.`);
  if (own.rows.length === 1 && own.rows[0].secondsPlayed >= match.durationSeconds - 60 && scoring(match.opponent) && valid(own.saves)) {
    if (match.opponent.goals === 0) lines.push(own.saves > 0 ? 'Euer Keeper hat mit seinen Paraden zum Zu-null-Spiel beigetragen.' : 'Zu null ohne erfasste Parade: anhand dieser Werte wenig direkte Torwartaktionen.');
    else if (own.saves > 0) lines.push('Euer Keeper musste eingreifen. Die Gegentore gemeinsam mit den zugelassenen Abschlüssen betrachten.');
    else lines.push('Keine Parade bei Gegentoren: die Gegentorszenen prüfen, ohne daraus automatisch einen Torwartfehler abzuleiten.');
  }
  if (valid(own.saves) && valid(opp.saves) && own.saves !== opp.saves) lines.push(own.saves > opp.saves ? 'Euer Keeper verzeichnete im Spielkontext mehr Abwehraktionen. Das spricht für mehr erfasste Eingriffe, beweist aber keine bessere Torwartleistung.' : 'Euer Keeper verzeichnete im Spielkontext weniger Abwehraktionen. Daraus lässt sich keine schwächere Torwartleistung ableiten.');
  return lines.join(' ');
}
function coachingFocus(match) {
  const notes = []; const mid = passing(match.own, 'midfielder'); const opposingMid = passing(match.opponent, 'midfielder');
  if (mid.attempts >= 20 && mid.quote !== null && (mid.quote < 75 || opposingMid.quote !== null && mid.quote + 8 < opposingMid.quote)) notes.push('**Aufbau:** nicht angekommene Mittelfeldpässe und die jeweiligen Passentscheidungen nachbesprechen.');
  if (scoring(match.own) && match.own.shots >= 5 && rate(match.own.goals, match.own.shots) < 15) notes.push('**Abschluss:** eure Abschlussszenen auf Auswahl und Ausführung durchgehen.');
  const own = tackles(match.own); const opp = tackles(match.opponent);
  if (notes.length < 2 && own.attempts >= 10 && own.quote !== null && own.quote < 40 && (opp.quote === null || own.quote < opp.quote)) notes.push('**Defensivarbeit:** erfolglose Tacklings mit der Absicherung durch Mitspieler zusammen anschauen.');
  if (notes.length < 2 && valid(match.opponent.shots) && valid(match.own.shots) && match.opponent.shots > match.own.shots) notes.push('**Gegenabschlüsse:** die Situationen vor gegnerischen Schüssen als Team analysieren.');
  return notes.slice(0, 2).join('\n') || 'Aus diesen Zahlen ergibt sich kein eindeutiger einzelner Schwachpunkt. Die gegentor- und abschlussrelevanten Szenen gemeinsam anschauen.';
}
function fitAnalysis(embed, budget = 6000) {
  const e = embed.toJSON(); const fixed = (e.title?.length || 0) + (e.description?.length || 0) + (e.footer?.text?.length || 0) + (e.fields || []).reduce((n, f) => n + f.name.length, 0);
  const each = Math.max(1, Math.min(1024, Math.floor((budget - fixed) / (e.fields?.length || 1))));
  embed.setFields((e.fields || []).map(f => {
    if (f.value.length <= each) return f;
    const part = f.value.slice(0, Math.max(1, each - 1)); const lastBreak = Math.max(part.lastIndexOf('\n'), part.lastIndexOf('. ') + 1);
    return { ...f, value: `${lastBreak > each / 2 ? part.slice(0, lastBreak) : part}…` };
  }));
  return embed;
}
function buildAnalysis(match, budget = 6000) {
  const embed = new EmbedBuilder().setColor(0xe84a8a).setTitle('🔎 Matchanalyse · Loco Squad');
  const labels = ['⚙️ Spielaufbau im Mittelfeld', '🎯 Chancenverwertung', '🛡️ Defensive Stabilität', '🧤 Torwartleistung'];
  if (match.termination || !valid(match.durationSeconds)) {
    embed.setDescription(match.termination ? `Vorzeitig beendet${match.minutes === null ? '' : ` nach ca. ${match.minutes}′`}. EA-Wertung: ${match.own.goals}:${match.opponent.goals}.` : 'Die Spielzeit fehlt.');
    labels.forEach(name => embed.addFields({ name, value: 'Keine reguläre Leistungsbewertung: Die Daten bilden kein verlässlich vollständiges Spiel ab.' }));
  } else {
    [midfield, finishing, defense, goalkeeper].forEach((analyze, index) => embed.addFields({ name: labels[index], value: analyze(match).slice(0, 1024) }));
    embed.addFields({ name: '🎯 Schwerpunkte für die Nachbesprechung', value: coachingFocus(match) });
    if (match.own.players.length) {
      embed.setDescription('Analyse der erfassten Spielwerte im Vergleich zum Gegner. Fokus: Loco Squad.');
    }
  }
  embed.setFooter({ text: `Analyse v${ANALYSIS_VERSION} · Fokus Loco Squad · Ursachen und Chancenqualität erfordern Spielszenen` });
  return fitAnalysis(embed, budget);
}
module.exports = { ANALYSIS_VERSION, buildAnalysis, fitAnalysis, midfield, finishing, defense, goalkeeper, coachingFocus };
