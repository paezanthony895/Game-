import type {
  ChallengeScenario,
  Confederation,
  DominantFoot,
  Player,
  PlayerAppearance,
  PlayerAttributes,
  PlayerPosition,
  Team,
} from '../types/football';
import { NATION_SEEDS, type NationSeed } from './nations';
import { CLUB_SEEDS, type ClubSeed } from './clubs';
import { enrichTeamWithAuthenticAssets } from './authenticAssets';
import {
  buildPlayerAppearance,
  generateRegionalProceduralName,
  REAL_TEAM_SQUADS,
} from './realSquads';

/**
 * Estrellas oficiales de Copas del Mundo FIFA para las selecciones campeonas del mundo:
 * Brasil (5), Alemania (4), Italia (4), Argentina (3), Francia (2), Uruguay (2), Inglaterra (1), España (1)
 */
export const WORLD_CUP_STARS: Record<string, number> = {
  nat_bra: 5,
  nat_ger: 4,
  nat_ita: 4,
  nat_arg: 3,
  nat_fra: 2,
  nat_uru: 2,
  nat_eng: 1,
  nat_esp: 1,
};

export function hasRealSquad2026(teamId: string): boolean {
  const squad = REAL_TEAM_SQUADS[teamId];
  return Boolean(squad && squad.length >= 18);
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seedStr: string): () => number {
  let s = hashString(seedStr) || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function clampAttr(val: number): number {
  return Math.max(32, Math.min(99, Math.round(val)));
}

function buildAttributesForRole(role: PlayerPosition, targetOvr: number, rng: () => number): PlayerAttributes {
  const j = () => (rng() - 0.5) * 10;
  const b = targetOvr;

  if (role === 'GK') {
    return {
      pace: clampAttr(b * 0.52 + j()),
      acceleration: clampAttr(b * 0.55 + j()),
      stamina: clampAttr(b * 0.72 + j()),
      strength: clampAttr(b * 0.85 + j()),
      ballControl: clampAttr(b * 0.62 + j()),
      dribbling: clampAttr(b * 0.45 + j()),
      shortPassing: clampAttr(b * 0.74 + j()),
      longPassing: clampAttr(b * 0.82 + j()),
      vision: clampAttr(b * 0.68 + j()),
      finishing: clampAttr(b * 0.35 + j()),
      shotPower: clampAttr(b * 0.78 + j()),
      accuracy: clampAttr(b * 0.60 + j()),
      heading: clampAttr(b * 0.55 + j()),
      marking: clampAttr(b * 0.45 + j()),
      tackling: clampAttr(b * 0.48 + j()),
      positioning: clampAttr(b * 0.96 + j() * 0.5),
      reflexes: clampAttr(b * 1.03 + j() * 0.5),
      reactions: clampAttr(b * 0.99 + j() * 0.5),
    };
  }

  const isDef = role === 'CB' || role === 'LB' || role === 'RB';
  const isFullback = role === 'LB' || role === 'RB';
  const isMid = role === 'CDM' || role === 'CM' || role === 'CAM';
  const isWing = role === 'LW' || role === 'RW';
  const isFwd = role === 'ST' || isWing;

  return {
    pace: clampAttr(b + (isWing || isFullback ? 7 : isFwd ? 4 : isDef ? -4 : 0) + j()),
    acceleration: clampAttr(b + (isWing || isFullback ? 7 : isFwd ? 4 : isDef ? -4 : 1) + j()),
    stamina: clampAttr(b + (isMid || isFullback ? 6 : 1) + j()),
    strength: clampAttr(b + (role === 'CB' || role === 'ST' || role === 'CDM' ? 7 : -3) + j()),
    ballControl: clampAttr(b + (isMid || isFwd ? 5 : -5) + j()),
    dribbling: clampAttr(b + (isWing || role === 'CAM' ? 8 : isFwd ? 4 : isDef ? -10 : 1) + j()),
    shortPassing: clampAttr(b + (isMid ? 8 : isDef ? -2 : 1) + j()),
    longPassing: clampAttr(b + (role === 'CDM' || role === 'CM' ? 7 : isFullback ? 2 : -4) + j()),
    vision: clampAttr(b + (role === 'CAM' || role === 'CM' ? 9 : isDef ? -7 : 1) + j()),
    finishing: clampAttr(b + (role === 'ST' ? 10 : isWing || role === 'CAM' ? 5 : isDef ? -18 : -5) + j()),
    shotPower: clampAttr(b + (isFwd ? 6 : role === 'CDM' ? 3 : -4) + j()),
    accuracy: clampAttr(b + (isFwd || role === 'CAM' ? 6 : -4) + j()),
    heading: clampAttr(b + (role === 'CB' || role === 'ST' ? 9 : -6) + j()),
    marking: clampAttr(b + (isDef ? 10 : role === 'CDM' ? 8 : -16) + j()),
    tackling: clampAttr(b + (isDef ? 11 : role === 'CDM' ? 9 : -15) + j()),
    positioning: clampAttr(b + (isFwd || isDef ? 4 : 2) + j()),
    reflexes: clampAttr(b * 0.55 + j()),
    reactions: clampAttr(b + 2 + j() * 0.6),
  };
}

const SQUAD_TEMPLATE: { role: PlayerPosition; num: number }[] = [
  { role: 'GK', num: 1 },
  { role: 'LB', num: 3 },
  { role: 'CB', num: 4 },
  { role: 'CB', num: 5 },
  { role: 'RB', num: 2 },
  { role: 'CDM', num: 6 },
  { role: 'CM', num: 8 },
  { role: 'CM', num: 10 },
  { role: 'LW', num: 11 },
  { role: 'ST', num: 9 },
  { role: 'RW', num: 7 },
  // 7 substitutes covering every line
  { role: 'GK', num: 13 },
  { role: 'CB', num: 15 },
  { role: 'LB', num: 12 },
  { role: 'CDM', num: 14 },
  { role: 'CAM', num: 16 },
  { role: 'RW', num: 17 },
  { role: 'ST', num: 19 },
];

export function generateSquadForTeam(
  teamId: string,
  countryName: string,
  countryCode: string,
  confederation: string,
  teamOvr: number
): Player[] {
  const rng = createRng(teamId);
  const conf = (confederation || 'UEFA') as Confederation;
  const curatedRoster = REAL_TEAM_SQUADS[teamId];

  if (curatedRoster && curatedRoster.length >= 11) {
    return SQUAD_TEMPLATE.map((slot, idx) => {
      const seed = curatedRoster[idx];
      const role = seed?.role ?? slot.role;
      const num = seed?.num ?? slot.num;
      const playerOvr = seed?.ovr ?? Math.max(60, Math.min(96, Math.round(teamOvr - 2)));
      const age = seed?.age ?? Math.floor(21 + rng() * 10);
      const potential = Math.min(97, Math.max(playerOvr, playerOvr + (age < 24 ? 5 : 1)));
      const preferredFoot: DominantFoot =
        seed?.foot ??
        (role === 'LB' || role === 'LW' ? 'Izquierdo' : 'Derecho');

      const playerName =
        seed?.name ??
        generateRegionalProceduralName(teamId, countryCode, conf, idx);

      const aspecto = buildPlayerAppearance(
        playerName,
        role,
        countryCode,
        conf,
        preferredFoot,
        seed?.heightCm,
        seed?.aspecto
      );
      const heightCm = aspecto.alturaCm;

      const bodyBuild =
        role === 'CB' || (role === 'ST' && heightCm >= 184)
          ? 'robusto'
          : role === 'LW' || role === 'RW'
          ? 'delgado'
          : 'atletico';

      return {
        id: `${teamId}_p${idx + 1}`,
        name: playerName,
        number: num,
        position: role,
        age,
        nationality: countryName,
        heightCm,
        bodyBuild,
        preferredFoot,
        overall: playerOvr,
        potential,
        fitness: Math.floor(92 + rng() * 8),
        morale: Math.floor(82 + rng() * 16),
        form: Math.floor(7 + rng() * 3),
        injuredMatches: 0,
        suspendedMatches: 0,
        yellowAccumulated: 0,
        seasonGoals: 0,
        seasonAssists: 0,
        attributes: buildAttributesForRole(role, playerOvr, rng),
        aspecto,
        isProcedural: false,
      };
    });
  }

  // Motor Procedural Regional Mejorado (18 jugadores con nombres, apellidos y aspecto regionales)
  const usedNames = new Set<string>();

  return SQUAD_TEMPLATE.map((slot, idx) => {
    let fullName = generateRegionalProceduralName(teamId, countryCode, conf, idx);
    let attempt = 0;
    while (usedNames.has(fullName) && attempt < 16) {
      attempt++;
      fullName = generateRegionalProceduralName(`${teamId}_${attempt}`, countryCode, conf, idx + attempt * 5);
    }
    usedNames.add(fullName);

    const isStarter = idx < 11;
    const starBoost = idx === 9 || idx === 7 ? 3 : 0;
    const playerOvr = Math.max(
      52,
      Math.min(96, Math.round(teamOvr + (isStarter ? starBoost : -3) + (rng() - 0.5) * 4))
    );
    const age = Math.floor(19 + rng() * 14);
    const potential = Math.min(
      97,
      playerOvr + (age < 24 ? Math.floor(3 + rng() * 7) : Math.floor(rng() * 2))
    );
    const footRoll = rng();
    const preferredFoot: DominantFoot =
      slot.role === 'LB' || slot.role === 'LW'
        ? footRoll < 0.72
          ? 'Izquierdo'
          : 'Derecho'
        : footRoll < 0.14
        ? 'Ambidiestro'
        : footRoll < 0.30
        ? 'Izquierdo'
        : 'Derecho';

    const rawHeight =
      slot.role === 'GK' || slot.role === 'CB'
        ? Math.floor(185 + rng() * 12)
        : slot.role === 'LW' || slot.role === 'RW' || slot.role === 'CAM'
        ? Math.floor(169 + rng() * 12)
        : Math.floor(175 + rng() * 14);

    const aspecto = buildPlayerAppearance(
      fullName,
      slot.role,
      countryCode,
      conf,
      preferredFoot,
      rawHeight
    );
    const heightCm = aspecto.alturaCm;

    const bodyBuild =
      slot.role === 'CB' || (slot.role === 'ST' && heightCm >= 184)
        ? 'robusto'
        : slot.role === 'LW' || slot.role === 'RW'
        ? 'delgado'
        : 'atletico';

    return {
      id: `${teamId}_p${idx + 1}`,
      name: fullName,
      number: slot.num,
      position: slot.role,
      age,
      nationality: countryName,
      heightCm,
      bodyBuild,
      preferredFoot,
      overall: playerOvr,
      potential,
      fitness: Math.floor(89 + rng() * 11),
      morale: Math.floor(76 + rng() * 20),
      form: Math.floor(6 + rng() * 4),
      injuredMatches: 0,
      suspendedMatches: 0,
      yellowAccumulated: 0,
      seasonGoals: 0,
      seasonAssists: 0,
      attributes: buildAttributesForRole(slot.role, playerOvr, rng),
      aspecto,
      isProcedural: true,
    };
  });
}

function buildTeamFromNation(seed: NationSeed): Team {
  const teamId = `nat_${seed.code.toLowerCase()}`;
  const isReal2026 = hasRealSquad2026(teamId);
  const players = generateSquadForTeam(
    teamId,
    seed.name,
    seed.code,
    seed.confederation,
    seed.ovr
  );
  return {
    id: teamId,
    name: seed.name,
    shortName: seed.code,
    type: 'national',
    country: seed.name,
    countryCode: seed.code,
    confederation: seed.confederation,
    city: seed.city,
    flag: seed.flag,
    primaryColor: seed.primary,
    secondaryColor: seed.secondary,
    awayColor: seed.away,
    kitPattern: seed.pattern,
    worldCupStars: WORLD_CUP_STARS[teamId] ?? 0,
    crest: {
      shape: 'shield',
      primaryColor: seed.primary,
      secondaryColor: seed.secondary,
      accentColor: '#F59E0B',
      symbol: 'star',
    },
    stadium: {
      id: `stad_nat_${seed.code.toLowerCase()}`,
      name: seed.stadium,
      city: seed.city,
      capacity: 65000,
      turfTone: 'emerald',
      standColor: seed.primary,
      hasRoof: true,
    },
    formationId: seed.ovr >= 84 ? '4-3-3' : seed.ovr >= 76 ? '4-2-3-1' : '4-4-2',
    tacticalStyle: seed.ovr >= 85 ? 'PRESION_ALTA' : 'EQUILIBRADO',
    overall: seed.ovr,
    attack: Math.min(95, seed.ovr + 1),
    midfield: seed.ovr,
    defense: Math.max(52, seed.ovr - 1),
    budgetMillions: 0,
    rosterSource: isReal2026 ? 'curated' : 'procedural',
    isNonFifa: seed.isNonFifa,
    players,
  };
}

function buildTeamFromClub(seed: ClubSeed): Team {
  const teamId = `club_${seed.id}`;
  const isReal2026 = hasRealSquad2026(teamId);
  const players = generateSquadForTeam(
    teamId,
    seed.country,
    seed.countryCode,
    seed.confederation,
    seed.ovr
  );
  return {
    id: teamId,
    name: seed.name,
    shortName: seed.shortName,
    type: 'club',
    country: seed.country,
    countryCode: seed.countryCode,
    confederation: seed.confederation,
    leagueId: seed.leagueId,
    leagueName: seed.leagueName,
    division: seed.division,
    city: seed.city,
    primaryColor: seed.primary,
    secondaryColor: seed.secondary,
    awayColor: seed.away,
    kitPattern: seed.pattern,
    crest: {
      shape: seed.division === 1 ? 'shield' : 'circle',
      primaryColor: seed.primary,
      secondaryColor: seed.secondary,
      accentColor: '#F59E0B',
      symbol: seed.isHistoric ? 'crown' : 'ball',
    },
    stadium: {
      id: `stad_${seed.id}`,
      name: seed.stadium,
      city: seed.city,
      capacity: seed.capacity,
      turfTone: seed.division >= 3 ? 'worn' : 'emerald',
      standColor: seed.primary,
      hasRoof: seed.capacity > 30000,
    },
    formationId: seed.ovr >= 83 ? '4-3-3' : '4-2-3-1',
    tacticalStyle: seed.ovr >= 84 ? 'POSESION' : 'EQUILIBRADO',
    overall: seed.ovr,
    attack: Math.min(95, seed.ovr + 1),
    midfield: seed.ovr,
    defense: Math.max(54, seed.ovr - 1),
    budgetMillions: seed.budget,
    rosterSource: isReal2026 ? 'curated' : 'procedural',
    isHistoric: seed.isHistoric,
    players,
  };
}

function buildAllStarTeams(): Team[] {
  const worldXI: Team = {
    id: 'allstar_world',
    name: 'FIFA World XI All-Star',
    shortName: 'WXI',
    type: 'club',
    country: 'Internacional',
    countryCode: 'INT',
    confederation: 'UEFA',
    leagueId: 'allstar',
    leagueName: 'All-Star Showcase',
    division: 0,
    city: 'Ginebra',
    primaryColor: '#0F172A',
    secondaryColor: '#F59E0B',
    awayColor: '#F8FAFC',
    kitPattern: 'sash',
    crest: { shape: 'diamond', primaryColor: '#0F172A', secondaryColor: '#F59E0B', accentColor: '#10B981', symbol: 'crown' },
    stadium: { id: 'stad_allstar', name: 'Arena Atlas Global', city: 'Ginebra', capacity: 90000, turfTone: 'emerald', standColor: '#F59E0B', hasRoof: true },
    formationId: '4-3-3',
    tacticalStyle: 'PRESION_ALTA',
    overall: 93,
    attack: 94,
    midfield: 93,
    defense: 92,
    budgetMillions: 500,
    rosterSource: 'curated',
    isHistoric: true,
    players: generateSquadForTeam('allstar_world', 'Internacional', 'ESP', 'UEFA', 93),
  };

  const americasXI: Team = {
    id: 'allstar_americas',
    name: 'América Leyendas All-Star XI',
    shortName: 'AXI',
    type: 'club',
    country: 'América',
    countryCode: 'AME',
    confederation: 'CONMEBOL',
    leagueId: 'allstar',
    leagueName: 'All-Star Showcase',
    division: 0,
    city: 'Buenos Aires',
    primaryColor: '#065F46',
    secondaryColor: '#FACC15',
    awayColor: '#FFFFFF',
    kitPattern: 'stripes',
    crest: { shape: 'shield', primaryColor: '#065F46', secondaryColor: '#FACC15', accentColor: '#FFFFFF', symbol: 'eagle' },
    stadium: { id: 'stad_americas', name: 'Estadio Monumental de América', city: 'Buenos Aires', capacity: 85000, turfTone: 'classic', standColor: '#10B981', hasRoof: true },
    formationId: '4-2-3-1',
    tacticalStyle: 'CONTRAATAQUE',
    overall: 92,
    attack: 94,
    midfield: 91,
    defense: 90,
    budgetMillions: 450,
    rosterSource: 'curated',
    isHistoric: true,
    players: generateSquadForTeam('allstar_americas', 'América', 'ARG', 'CONMEBOL', 92),
  };

  return [worldXI, americasXI];
}

let cachedBaseTeams: Team[] | null = null;

export function getBaseDatabaseTeams(): Team[] {
  if (!cachedBaseTeams) {
    const nations = NATION_SEEDS.map((s) => enrichTeamWithAuthenticAssets(buildTeamFromNation(s)));
    const clubs = CLUB_SEEDS.map((s) => enrichTeamWithAuthenticAssets(buildTeamFromClub(s)));
    const allStars = buildAllStarTeams().map((t) => enrichTeamWithAuthenticAssets(t));
    cachedBaseTeams = [...clubs, ...nations, ...allStars];
  }
  return cachedBaseTeams;
}

export function getAllTeamsWithCustom(customTeams: Team[]): Team[] {
  const base = getBaseDatabaseTeams();
  const customById = new Map<string, Team>();
  const customByName = new Map<string, Team>();
  for (const ct of customTeams) {
    const enriched = enrichTeamWithAuthenticAssets(ct);
    customById.set(enriched.id, enriched);
    customByName.set(enriched.name.trim().toLowerCase(), enriched);
  }

  const matchedCustomIds = new Set<string>();
  const merged = base.map((t) => {
    const match = customById.get(t.id) ?? customByName.get(t.name.trim().toLowerCase());
    if (match) {
      matchedCustomIds.add(match.id);
      return enrichTeamWithAuthenticAssets({
        ...t,
        ...match,
        id: t.id, // mantener ID canónico del equipo base
      });
    }
    return t;
  });

  const newOnes = customTeams
    .filter((ct) => !matchedCustomIds.has(ct.id) && !base.some((b) => b.id === ct.id))
    .map((ct) => enrichTeamWithAuthenticAssets(ct));

  return [...newOnes, ...merged];
}

function normalizeImportedPlayer(
  raw: Record<string, unknown>,
  teamId: string,
  country: string,
  countryCode: string,
  confederation: Confederation,
  teamOvr: number,
  idx: number,
  fallbackPlayer?: Player
): Player {
  const rng = createRng(`${teamId}_imp_${idx}`);
  const slot = SQUAD_TEMPLATE[idx] ?? { role: 'CM' as PlayerPosition, num: idx + 1 };
  const name =
    typeof raw.name === 'string' && raw.name.trim()
      ? raw.name.trim()
      : fallbackPlayer?.name ?? generateRegionalProceduralName(teamId, countryCode, confederation, idx);
  const position =
    (typeof raw.position === 'string'
      ? (raw.position as PlayerPosition)
      : typeof raw.role === 'string'
      ? (raw.role as PlayerPosition)
      : fallbackPlayer?.position) ?? slot.role;
  const number =
    typeof raw.number === 'number'
      ? raw.number
      : typeof raw.num === 'number'
      ? raw.num
      : fallbackPlayer?.number ?? slot.num;
  const overall =
    typeof raw.overall === 'number'
      ? Math.max(45, Math.min(99, raw.overall))
      : typeof raw.ovr === 'number'
      ? Math.max(45, Math.min(99, raw.ovr))
      : fallbackPlayer?.overall ?? teamOvr;
  const rawAspecto = (raw.aspecto ?? raw.appearance) as Partial<PlayerAppearance> | undefined;
  const footStr =
    typeof raw.preferredFoot === 'string'
      ? (raw.preferredFoot as DominantFoot)
      : rawAspecto?.piernaHabil === 'I'
      ? 'Izquierdo'
      : rawAspecto?.piernaHabil === 'A'
      ? 'Ambidiestro'
      : fallbackPlayer?.preferredFoot ?? 'Derecho';

  const explicitHeight =
    typeof raw.heightCm === 'number'
      ? raw.heightCm
      : typeof rawAspecto?.alturaCm === 'number'
      ? rawAspecto.alturaCm
      : fallbackPlayer?.heightCm;

  const aspecto = buildPlayerAppearance(
    name,
    position,
    countryCode,
    confederation,
    footStr,
    explicitHeight,
    rawAspecto
  );

  const heightCm = aspecto.alturaCm;
  const age = typeof raw.age === 'number' ? raw.age : fallbackPlayer?.age ?? 25;

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `${teamId}_p${idx + 1}`,
    name,
    number,
    position,
    age,
    nationality: typeof raw.nationality === 'string' ? raw.nationality : country,
    heightCm,
    bodyBuild:
      position === 'CB' || (position === 'ST' && heightCm >= 184)
        ? 'robusto'
        : position === 'LW' || position === 'RW'
        ? 'delgado'
        : 'atletico',
    preferredFoot: footStr,
    overall,
    potential: typeof raw.potential === 'number' ? raw.potential : Math.min(98, overall + 3),
    fitness: 96,
    morale: 92,
    form: 8,
    injuredMatches: 0,
    suspendedMatches: 0,
    yellowAccumulated: 0,
    seasonGoals: 0,
    seasonAssists: 0,
    attributes:
      raw.attributes && typeof raw.attributes === 'object'
        ? (raw.attributes as PlayerAttributes)
        : fallbackPlayer?.attributes ?? buildAttributesForRole(position, overall, rng),
    aspecto,
    isProcedural: false,
  };
}

/**
 * Valida y convierte un archivo/texto JSON en un parche acumulativo de equipos ("Modo Parche Acumulativo").
 * Si un equipo del JSON coincide por `id` o por `name` con un equipo existente en la base de datos (de los 344),
 * fusiona sus datos (escudo/logoUrl, camisetas, 18 jugadores con su `aspecto` físico) sin borrar el resto de equipos,
 * y marca su estado como "Plantilla Real 2026" (`rosterSource: 'curated'`).
 */
export function validateAndParseImportedTeams(
  rawJson: string,
  existingTeams: Team[] = getBaseDatabaseTeams()
): { teams: Team[]; updatedCount: number; createdCount: number; error?: string } {
  try {
    const parsed = JSON.parse(rawJson);
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.teams)
      ? parsed.teams
      : parsed && typeof parsed === 'object' && (typeof parsed.name === 'string' || typeof parsed.id === 'string')
      ? [parsed]
      : null;

    if (!list || list.length === 0) {
      return {
        teams: [],
        updatedCount: 0,
        createdCount: 0,
        error: 'El JSON debe ser un arreglo de equipos, un objeto con "teams", o un objeto de equipo individual.',
      };
    }

    const byId = new Map<string, Team>();
    const byName = new Map<string, Team>();
    const byShort = new Map<string, Team>();
    for (const t of existingTeams) {
      byId.set(t.id.toLowerCase(), t);
      byName.set(t.name.trim().toLowerCase(), t);
      byShort.set(t.shortName.trim().toLowerCase(), t);
    }

    const validTeams: Team[] = [];
    let updatedCount = 0;
    let createdCount = 0;

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (!item || typeof item !== 'object') {
        return {
          teams: [],
          updatedCount: 0,
          createdCount: 0,
          error: `Elemento en índice ${i} inválido.`,
        };
      }

      const rawId = typeof item.id === 'string' ? item.id.trim() : '';
      const rawName = typeof item.name === 'string' ? item.name.trim() : '';
      const existing =
        (rawId ? byId.get(rawId.toLowerCase()) : undefined) ??
        (rawName ? byName.get(rawName.toLowerCase()) : undefined) ??
        (rawId ? byShort.get(rawId.toLowerCase()) : undefined);

      if (!existing && (!rawName || typeof item.country !== 'string')) {
        return {
          teams: [],
          updatedCount: 0,
          createdCount: 0,
          error: `Equipo en índice ${i} inválido: para crear un equipo nuevo requiere "name" y "country" (o "id"/"name" de un equipo existente para parchear).`,
        };
      }

      if (existing) {
        updatedCount++;
      } else {
        createdCount++;
      }

      const id = existing?.id ?? (rawId || `imp_${hashString(rawName + i)}`);
      const name = rawName || existing!.name;
      const country = typeof item.country === 'string' ? item.country : existing!.country;
      const countryCode = (
        typeof item.countryCode === 'string'
          ? item.countryCode
          : existing?.countryCode ?? country.slice(0, 3)
      ).toUpperCase();
      const confederation: Confederation =
        item.confederation || existing?.confederation || 'UEFA';
      const ovr =
        typeof item.overall === 'number'
          ? Math.max(45, Math.min(99, item.overall))
          : existing?.overall ?? 78;

      let players: Player[];
      if (Array.isArray(item.players) && item.players.length > 0) {
        const basePlayers =
          existing?.players ??
          generateSquadForTeam(id, country, countryCode, confederation, ovr);
        players = SQUAD_TEMPLATE.map((_, idx) => {
          const rawP = item.players[idx];
          if (rawP && typeof rawP === 'object') {
            return normalizeImportedPlayer(
              rawP as Record<string, unknown>,
              id,
              country,
              countryCode,
              confederation,
              ovr,
              idx,
              basePlayers[idx]
            );
          }
          return basePlayers[idx];
        });
      } else {
        players =
          existing?.players ??
          generateSquadForTeam(id, country, countryCode, confederation, ovr);
      }

      const logoUrl =
        typeof item.logoUrl === 'string' && item.logoUrl.trim()
          ? item.logoUrl.trim()
          : typeof item.crestUrl === 'string' && item.crestUrl.trim()
          ? item.crestUrl.trim()
          : existing?.logoUrl ?? existing?.crestUrl;

      const primaryColor = item.primaryColor || existing?.primaryColor || '#10B981';
      const secondaryColor = item.secondaryColor || existing?.secondaryColor || '#FFFFFF';
      const awayColor = item.awayColor || existing?.awayColor || '#0F172A';

      const mergedTeam: Team = enrichTeamWithAuthenticAssets({
        ...(existing ?? {}),
        id,
        name,
        shortName: (item.shortName || existing?.shortName || name.slice(0, 3)).toUpperCase(),
        type: item.type === 'national' ? 'national' : existing?.type ?? 'club',
        country,
        countryCode,
        confederation,
        leagueId: item.leagueId || existing?.leagueId || 'imported',
        leagueName: item.leagueName || existing?.leagueName || 'Base Importada',
        division:
          typeof item.division === 'number' ? item.division : existing?.division ?? 1,
        city: item.city || existing?.city || country,
        flag: item.flag || existing?.flag || '🏳️',
        primaryColor,
        secondaryColor,
        awayColor,
        awaySecondaryColor: item.awaySecondaryColor || existing?.awaySecondaryColor,
        awayPattern: item.awayPattern || existing?.awayPattern,
        thirdColor: item.thirdColor || existing?.thirdColor,
        thirdSecondaryColor: item.thirdSecondaryColor || existing?.thirdSecondaryColor,
        thirdPattern: item.thirdPattern || existing?.thirdPattern,
        kitPattern: item.kitPattern || existing?.kitPattern || 'solid',
        logoUrl,
        crestUrl: logoUrl,
        worldCupStars:
          typeof item.worldCupStars === 'number'
            ? item.worldCupStars
            : existing?.worldCupStars ?? WORLD_CUP_STARS[id] ?? 0,
        crest: item.crest ||
          existing?.crest || {
            shape: 'shield',
            primaryColor,
            secondaryColor,
            accentColor: '#F59E0B',
            symbol: 'ball',
          },
        stadium: item.stadium ||
          existing?.stadium || {
            id: `stad_${id}`,
            name: `Estadio ${name}`,
            city: item.city || country,
            capacity: 35000,
            turfTone: 'emerald',
            standColor: primaryColor,
            hasRoof: true,
          },
        formationId: item.formationId || existing?.formationId || '4-3-3',
        tacticalStyle: item.tacticalStyle || existing?.tacticalStyle || 'EQUILIBRADO',
        overall: ovr,
        attack: item.attack ?? existing?.attack ?? ovr,
        midfield: item.midfield ?? existing?.midfield ?? ovr,
        defense: item.defense ?? existing?.defense ?? ovr,
        budgetMillions: item.budgetMillions ?? existing?.budgetMillions ?? 30,
        // Todo equipo importado o parcheado por JSON pasa automáticamente a "Plantilla Real 2026" ('curated')
        rosterSource: 'curated',
        players,
      });

      validTeams.push(mergedTeam);
    }

    return { teams: validTeams, updatedCount, createdCount };
  } catch (e) {
    return {
      teams: [],
      updatedCount: 0,
      createdCount: 0,
      error: e instanceof Error ? e.message : 'Error al leer JSON.',
    };
  }
}

/**
 * Fusiona un lote de equipos importados sobre la lista actual de `customTeams` sin duplicar IDs ni borrar equipos previos.
 */
export function mergeImportedTeamsPatch(currentCustomTeams: Team[], importedPatch: Team[]): Team[] {
  const byId = new Map<string, Team>();
  for (const t of currentCustomTeams) {
    byId.set(t.id, t);
  }
  for (const imp of importedPatch) {
    byId.set(imp.id, imp);
  }
  return Array.from(byId.values());
}

export const CHALLENGE_SCENARIOS: ChallengeScenario[] = [
  {
    id: 'ch_bernabeu_comeback',
    title: 'El Clásico: Remontada en el Minuto 70',
    description: 'Pierdes 0-2 con Real Madrid CF ante FC Barcelona en el Santiago Bernabéu. Dale la vuelta al marcador.',
    homeTeamId: 'club_rma',
    awayTeamId: 'club_fcb',
    userSide: 'home',
    startMinute: 70,
    initialHomeGoals: 0,
    initialAwayGoals: 2,
    difficulty: 6,
    objectiveType: 'comeback',
    objectiveLabel: 'Ganar el Clásico tras remontar un 0-2',
  },
  {
    id: 'ch_david_goliath',
    title: 'Matagigantes en la FA Cup',
    description: 'Dirige a Wrexham AFC (3ª división) y derrota al Manchester City de Haaland en dificultad Muy Difícil.',
    homeTeamId: 'club_wrex',
    awayTeamId: 'club_mci',
    userSide: 'home',
    startMinute: 0,
    initialHomeGoals: 0,
    initialAwayGoals: 0,
    difficulty: 5,
    objectiveType: 'win',
    objectiveLabel: 'Vencer con un equipo de 3ª división',
  },
  {
    id: 'ch_hold_fortress',
    title: 'Resistir la Tormenta Mundialista',
    description: 'Lideras 1-0 con Uruguay desde el minuto 75 contra Francia en Leyenda. Protege tu arco hasta el pitazo final.',
    homeTeamId: 'nat_uru',
    awayTeamId: 'nat_fra',
    userSide: 'home',
    startMinute: 75,
    initialHomeGoals: 1,
    initialAwayGoals: 0,
    difficulty: 7,
    objectiveType: 'hold_lead',
    objectiveLabel: 'Mantener la victoria sin encajar remontada',
  },
  {
    id: 'ch_ultra_boss',
    title: 'Prueba Suprema: ULTRA DIFÍCIL (99% Precisión)',
    description: 'Enfrenta al FIFA World XI All-Star con Argentina en el nivel máximo de IA táctica.',
    homeTeamId: 'nat_arg',
    awayTeamId: 'allstar_world',
    userSide: 'home',
    startMinute: 0,
    initialHomeGoals: 0,
    initialAwayGoals: 0,
    difficulty: 8,
    objectiveType: 'win',
    objectiveLabel: 'Ganar en dificultad ULTRA DIFÍCIL',
  },
];
