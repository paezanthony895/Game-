import type {
  CompetitionState,
  FixtureItem,
  GameMode,
  LeagueStandingRow,
  Team,
} from '../types/football';

export function computeLeagueStandings(
  teamIds: string[],
  teamsById: Map<string, Team>,
  fixtures: FixtureItem[]
): LeagueStandingRow[] {
  const table = new Map<string, LeagueStandingRow>();
  for (const id of teamIds) {
    table.set(id, {
      teamId: id,
      teamName: teamsById.get(id)?.name ?? id,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0,
    });
  }

  for (const fx of fixtures) {
    if (!fx.played || fx.homeGoals === undefined || fx.awayGoals === undefined) continue;
    const h = table.get(fx.homeTeamId);
    const a = table.get(fx.awayTeamId);
    if (!h || !a) continue;

    h.played++;
    a.played++;
    h.gf += fx.homeGoals;
    h.ga += fx.awayGoals;
    a.gf += fx.awayGoals;
    a.ga += fx.homeGoals;

    if (fx.homeGoals > fx.awayGoals) {
      h.won++;
      h.points += 3;
      a.lost++;
    } else if (fx.homeGoals < fx.awayGoals) {
      a.won++;
      a.points += 3;
      h.lost++;
    } else {
      h.drawn++;
      a.drawn++;
      h.points += 1;
      a.points += 1;
    }
    h.gd = h.gf - h.ga;
    a.gd = a.gf - a.ga;
  }

  return Array.from(table.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.teamName.localeCompare(b.teamName);
  });
}

export function generateRoundRobinFixtures(teamIds: string[]): FixtureItem[] {
  const list = [...teamIds];
  if (list.length % 2 === 1) list.push('BYE');
  const n = list.length;
  const rounds = n - 1;
  const fixtures: FixtureItem[] = [];

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      const home = list[i];
      const away = list[n - 1 - i];
      if (home !== 'BYE' && away !== 'BYE') {
        fixtures.push({
          id: `fx_r${r + 1}_${i}`,
          round: r + 1,
          homeTeamId: r % 2 === 0 ? home : away,
          awayTeamId: r % 2 === 0 ? away : home,
          played: false,
        });
      }
    }
    const fixed = list[0];
    const rest = list.slice(1);
    rest.unshift(rest.pop()!);
    list.splice(0, list.length, fixed, ...rest);
  }

  return fixtures;
}

export function generateKnockoutFixtures(teamIds: string[], roundNumber: number): FixtureItem[] {
  const fixtures: FixtureItem[] = [];
  for (let i = 0; i + 1 < teamIds.length; i += 2) {
    fixtures.push({
      id: `ko_r${roundNumber}_${i}`,
      round: roundNumber,
      homeTeamId: teamIds[i],
      awayTeamId: teamIds[i + 1],
      played: false,
    });
  }
  return fixtures;
}

export function simulateCpuMatchScore(
  homeTeam: Team,
  awayTeam: Team,
  allowDraw: boolean,
  rng: () => number
): { homeGoals: number; awayGoals: number } {
  const diff = (homeTeam.overall - awayTeam.overall) / 14;
  const homeExp = Math.max(0.4, 1.35 + diff * 0.65);
  const awayExp = Math.max(0.4, 1.15 - diff * 0.55);

  const sampleGoals = (lambda: number) => {
    let g = 0;
    for (let i = 0; i < 6; i++) {
      if (rng() < lambda / 5.5) g++;
    }
    return g;
  };

  let hg = sampleGoals(homeExp);
  let ag = sampleGoals(awayExp);
  if (!allowDraw && hg === ag) {
    if (rng() < 0.5 + diff * 0.15) hg++;
    else ag++;
  }
  return { homeGoals: hg, awayGoals: ag };
}

export function createCompetition(
  name: string,
  mode: GameMode,
  participantIds: string[],
  userTeamId: string,
  teamsById: Map<string, Team>,
  knockoutOnly = false
): CompetitionState {
  const fixtures = knockoutOnly
    ? generateKnockoutFixtures(participantIds, 1)
    : generateRoundRobinFixtures(participantIds);

  return {
    id: `comp_${Date.now()}`,
    name,
    mode,
    teamIds: participantIds,
    userTeamId,
    stage: knockoutOnly ? 'knockout' : mode === 'league' ? 'league' : 'groups',
    currentRound: 1,
    fixtures,
    standings: computeLeagueStandings(participantIds, teamsById, fixtures),
  };
}

export function advanceCompetitionRound(
  comp: CompetitionState,
  userFixtureId: string,
  userHomeGoals: number,
  userAwayGoals: number,
  teamsById: Map<string, Team>,
  rng: () => number = Math.random
): CompetitionState {
  const allowDraw = comp.stage !== 'knockout';
  const updatedFixtures = comp.fixtures.map((fx) => {
    if (fx.played || fx.round !== comp.currentRound) return fx;
    if (fx.id === userFixtureId) {
      return { ...fx, homeGoals: userHomeGoals, awayGoals: userAwayGoals, played: true };
    }
    const home = teamsById.get(fx.homeTeamId);
    const away = teamsById.get(fx.awayTeamId);
    if (!home || !away) {
      return { ...fx, homeGoals: 1, awayGoals: 0, played: true };
    }
    const res = simulateCpuMatchScore(home, away, allowDraw, rng);
    return { ...fx, homeGoals: res.homeGoals, awayGoals: res.awayGoals, played: true };
  });

  const standings = computeLeagueStandings(comp.teamIds, teamsById, updatedFixtures);
  const maxRound = Math.max(...updatedFixtures.map((f) => f.round));

  if (comp.currentRound < maxRound) {
    return {
      ...comp,
      currentRound: comp.currentRound + 1,
      fixtures: updatedFixtures,
      standings,
    };
  }

  // Round completed
  if (comp.stage === 'groups') {
    // Top 4 or 8 advance to knockout
    const advanceCount = standings.length >= 8 ? 8 : standings.length >= 4 ? 4 : 2;
    const qualifiers = standings.slice(0, advanceCount).map((s) => s.teamId);
    const nextRound = comp.currentRound + 1;
    const koFixtures = generateKnockoutFixtures(qualifiers, nextRound);
    return {
      ...comp,
      stage: 'knockout',
      currentRound: nextRound,
      fixtures: [...updatedFixtures, ...koFixtures],
      standings,
    };
  }

  if (comp.stage === 'knockout') {
    const roundFx = updatedFixtures.filter((f) => f.round === comp.currentRound);
    const winners = roundFx.map((f) =>
      (f.homeGoals ?? 0) >= (f.awayGoals ?? 0) ? f.homeTeamId : f.awayTeamId
    );
    if (winners.length <= 1) {
      return {
        ...comp,
        stage: 'completed',
        fixtures: updatedFixtures,
        standings,
        championTeamId: winners[0],
      };
    }
    const nextRound = comp.currentRound + 1;
    const nextKo = generateKnockoutFixtures(winners, nextRound);
    return {
      ...comp,
      currentRound: nextRound,
      fixtures: [...updatedFixtures, ...nextKo],
      standings,
    };
  }

  // League completed
  return {
    ...comp,
    stage: 'completed',
    fixtures: updatedFixtures,
    standings,
    championTeamId: standings[0]?.teamId,
  };
}

export function getCompetitionRoundLabel(comp: CompetitionState, roundNumber = comp.currentRound): string {
  if (comp.stage === 'completed') {
    return 'TORNEO FINALIZADO · CAMPEÓN CORONADO';
  }
  const roundFixtures = comp.fixtures.filter((f) => f.round === roundNumber);
  if (comp.stage === 'league') {
    return `JORNADA ${roundNumber} DE LIGA`;
  }
  const isKnockoutRound = roundFixtures.some((f) => f.id.startsWith('ko_'));
  if (!isKnockoutRound && comp.stage === 'groups') {
    return `FASE DE GRUPOS · FECHA ${roundNumber}`;
  }
  const matchCount = roundFixtures.length;
  if (matchCount >= 8) return 'OCTAVOS DE FINAL';
  if (matchCount === 4) return 'CUARTOS DE FINAL';
  if (matchCount === 2) return 'SEMIFINALES';
  if (matchCount === 1) return 'GRAN FINAL';
  return `ELIMINATORIA · RONDA ${roundNumber}`;
}

