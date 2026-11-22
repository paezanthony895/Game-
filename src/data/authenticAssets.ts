import type { CrestStatus, KitPattern, KitSelection, Team } from '../types/football';

export interface AuthenticClubAsset {
  clubId: string;
  shieldType:
    | 'river_sash'
    | 'boca_stars'
    | 'racing_cilindro'
    | 'independiente_diablo'
    | 'san_lorenzo'
    | 'estudiantes_leon'
    | 'velez_v'
    | 'flamengo_crf'
    | 'palmeiras_p'
    | 'corinthians_anchor'
    | 'sao_paulo_spfc'
    | 'santos_sfc'
    | 'gremio_tricolor'
    | 'inter_sci'
    | 'real_madrid_crown'
    | 'barcelona_crest'
    | 'atletico_oso'
    | 'athletic_bilbao'
    | 'man_city_ship'
    | 'arsenal_cannon'
    | 'liverpool_liverbird'
    | 'chelsea_lion'
    | 'man_utd_devil'
    | 'tottenham_cockerel'
    | 'inter_milan_mono'
    | 'ac_milan_cross'
    | 'juventus_jj'
    | 'napoli_n'
    | 'roma_lupa'
    | 'lazio_eagle'
    | 'bayern_bavaria'
    | 'dortmund_bvb'
    | 'leverkusen_lion'
    | 'psg_eiffel'
    | 'marseille_om'
    | 'benfica_eagle'
    | 'porto_dragon'
    | 'sporting_lion'
    | 'ajax_hero'
    | 'penarol_rails'
    | 'nacional_bolso'
    | 'colo_colo'
    | 'america_mex'
    | 'chivas_mex'
    | 'al_ahly_eagle'
    | 'al_hilal_crescent';
  monogram: string;
  crown?: boolean;
  starsCount?: number;
  homePrimary: string;
  homeSecondary: string;
  homePattern: KitPattern;
  awayPrimary: string;
  awaySecondary: string;
  thirdPrimary: string;
  thirdSecondary: string;
  thirdPattern: KitPattern;
  gkPrimary: string;
  gkSecondary: string;
}

export const AUTHENTIC_CLUB_ASSETS: Record<string, AuthenticClubAsset> = {
  // ARGENTINA
  club_riv: {
    clubId: 'club_riv',
    shieldType: 'river_sash',
    monogram: 'CARP',
    homePrimary: '#FFFFFF',
    homeSecondary: '#D91A2A',
    homePattern: 'sash',
    awayPrimary: '#B91C1C',
    awaySecondary: '#FFFFFF',
    thirdPrimary: '#111827',
    thirdSecondary: '#D91A2A',
    thirdPattern: 'sash',
    gkPrimary: '#16A34A',
    gkSecondary: '#FFFFFF',
  },
  club_boc: {
    clubId: 'club_boc',
    shieldType: 'boca_stars',
    monogram: 'CABJ',
    starsCount: 3,
    homePrimary: '#002B7F',
    homeSecondary: '#F5C400',
    homePattern: 'hoops',
    awayPrimary: '#F5C400',
    awaySecondary: '#002B7F',
    thirdPrimary: '#F8FAFC',
    thirdSecondary: '#002B7F',
    thirdPattern: 'hoops',
    gkPrimary: '#EA580C',
    gkSecondary: '#111827',
  },
  club_rac: {
    clubId: 'club_rac',
    shieldType: 'racing_cilindro',
    monogram: 'RC',
    homePrimary: '#63B3ED',
    homeSecondary: '#FFFFFF',
    homePattern: 'stripes',
    awayPrimary: '#0F172A',
    awaySecondary: '#63B3ED',
    thirdPrimary: '#1E3A8A',
    thirdSecondary: '#F59E0B',
    thirdPattern: 'solid',
    gkPrimary: '#F59E0B',
    gkSecondary: '#0F172A',
  },
  club_ind: {
    clubId: 'club_ind',
    shieldType: 'independiente_diablo',
    monogram: 'CAI',
    homePrimary: '#DC2626',
    homeSecondary: '#FFFFFF',
    homePattern: 'solid',
    awayPrimary: '#1E3A8A',
    awaySecondary: '#FFFFFF',
    thirdPrimary: '#FFFFFF',
    thirdSecondary: '#DC2626',
    thirdPattern: 'sash',
    gkPrimary: '#0F172A',
    gkSecondary: '#FACC15',
  },
  club_slo: {
    clubId: 'club_slo',
    shieldType: 'san_lorenzo',
    monogram: 'CASLA',
    homePrimary: '#1E3A8A',
    homeSecondary: '#DC2626',
    homePattern: 'stripes',
    awayPrimary: '#FFFFFF',
    awaySecondary: '#1E3A8A',
    thirdPrimary: '#0F172A',
    thirdSecondary: '#DC2626',
    thirdPattern: 'solid',
    gkPrimary: '#10B981',
    gkSecondary: '#0F172A',
  },
  club_est: {
    clubId: 'club_est',
    shieldType: 'estudiantes_leon',
    monogram: 'EdeLP',
    starsCount: 4,
    homePrimary: '#DC2626',
    homeSecondary: '#FFFFFF',
    homePattern: 'stripes',
    awayPrimary: '#111827',
    awaySecondary: '#DC2626',
    thirdPrimary: '#FFFFFF',
    thirdSecondary: '#DC2626',
    thirdPattern: 'halves',
    gkPrimary: '#F59E0B',
    gkSecondary: '#111827',
  },
  club_vel: {
    clubId: 'club_vel',
    shieldType: 'velez_v',
    monogram: 'CAVS',
    starsCount: 1,
    homePrimary: '#FFFFFF',
    homeSecondary: '#1D4ED8',
    homePattern: 'sash',
    awayPrimary: '#1D4ED8',
    awaySecondary: '#FFFFFF',
    thirdPrimary: '#15803D',
    thirdSecondary: '#DC2626',
    thirdPattern: 'stripes',
    gkPrimary: '#E11D48',
    gkSecondary: '#FFFFFF',
  },

  // BRAZIL
  club_fla: {
    clubId: 'club_fla',
    shieldType: 'flamengo_crf',
    monogram: 'CRF',
    starsCount: 3,
    homePrimary: '#DC2626',
    homeSecondary: '#111827',
    homePattern: 'hoops',
    awayPrimary: '#FFFFFF',
    awaySecondary: '#DC2626',
    thirdPrimary: '#111827',
    thirdSecondary: '#F59E0B',
    thirdPattern: 'solid',
    gkPrimary: '#0284C7',
    gkSecondary: '#FFFFFF',
  },
  club_pal: {
    clubId: 'club_pal',
    shieldType: 'palmeiras_p',
    monogram: 'SEP',
    starsCount: 3,
    homePrimary: '#15803D',
    homeSecondary: '#FFFFFF',
    homePattern: 'solid',
    awayPrimary: '#FFFFFF',
    awaySecondary: '#15803D',
    thirdPrimary: '#D9F99D',
    thirdSecondary: '#15803D',
    thirdPattern: 'solid',
    gkPrimary: '#1E3A8A',
    gkSecondary: '#FFFFFF',
  },
  club_sao: {
    clubId: 'club_sao',
    shieldType: 'sao_paulo_spfc',
    monogram: 'SPFC',
    starsCount: 3,
    homePrimary: '#FFFFFF',
    homeSecondary: '#DC2626',
    homePattern: 'hoops',
    awayPrimary: '#DC2626',
    awaySecondary: '#111827',
    thirdPrimary: '#111827',
    thirdSecondary: '#DC2626',
    thirdPattern: 'solid',
    gkPrimary: '#111827',
    gkSecondary: '#FFFFFF',
  },
  club_cor_bra: {
    clubId: 'club_cor_bra',
    shieldType: 'corinthians_anchor',
    monogram: 'SCCP',
    homePrimary: '#FFFFFF',
    homeSecondary: '#111827',
    homePattern: 'solid',
    awayPrimary: '#111827',
    awaySecondary: '#FFFFFF',
    thirdPrimary: '#F59E0B',
    thirdSecondary: '#111827',
    thirdPattern: 'stripes',
    gkPrimary: '#EAB308',
    gkSecondary: '#111827',
  },
  club_san_bra: {
    clubId: 'club_san_bra',
    shieldType: 'santos_sfc',
    monogram: 'SFC',
    starsCount: 2,
    homePrimary: '#FFFFFF',
    homeSecondary: '#111827',
    homePattern: 'solid',
    awayPrimary: '#111827',
    awaySecondary: '#FFFFFF',
    thirdPrimary: '#0F172A',
    thirdSecondary: '#D4AF37',
    thirdPattern: 'stripes',
    gkPrimary: '#0284C7',
    gkSecondary: '#FFFFFF',
  },
  club_gre_bra: {
    clubId: 'club_gre_bra',
    shieldType: 'gremio_tricolor',
    monogram: 'GFBPA',
    starsCount: 3,
    homePrimary: '#0284C7',
    homeSecondary: '#111827',
    homePattern: 'stripes',
    awayPrimary: '#FFFFFF',
    awaySecondary: '#0284C7',
    thirdPrimary: '#111827',
    thirdSecondary: '#38BDF8',
    thirdPattern: 'solid',
    gkPrimary: '#6D28D9',
    gkSecondary: '#FFFFFF',
  },
  club_int_bra: {
    clubId: 'club_int_bra',
    shieldType: 'inter_sci',
    monogram: 'SCI',
    homePrimary: '#DC2626',
    homeSecondary: '#FFFFFF',
    homePattern: 'solid',
    awayPrimary: '#FFFFFF',
    awaySecondary: '#DC2626',
    thirdPrimary: '#111827',
    thirdSecondary: '#DC2626',
    thirdPattern: 'solid',
    gkPrimary: '#16A34A',
    gkSecondary: '#FFFFFF',
  },

  // SPAIN
  club_rma: {
    clubId: 'club_rma',
    shieldType: 'real_madrid_crown',
    monogram: 'MCF',
    crown: true,
    homePrimary: '#FFFFFF',
    homeSecondary: '#D4AF37',
    homePattern: 'solid',
    awayPrimary: '#EA580C',
    awaySecondary: '#0F172A',
    thirdPrimary: '#1E293B',
    thirdSecondary: '#D4AF37',
    thirdPattern: 'solid',
    gkPrimary: '#16A34A',
    gkSecondary: '#FFFFFF',
  },
  club_fcb: {
    clubId: 'club_fcb',
    shieldType: 'barcelona_crest',
    monogram: 'FCB',
    homePrimary: '#004D98',
    homeSecondary: '#A50044',
    homePattern: 'halves',
    awayPrimary: '#111827',
    awaySecondary: '#A50044',
    thirdPrimary: '#84CC16',
    thirdSecondary: '#004D98',
    thirdPattern: 'solid',
    gkPrimary: '#F97316',
    gkSecondary: '#111827',
  },
  club_atm: {
    clubId: 'club_atm',
    shieldType: 'atletico_oso',
    monogram: 'ATM',
    homePrimary: '#CB3524',
    homeSecondary: '#FFFFFF',
    homePattern: 'stripes',
    awayPrimary: '#1E293B',
    awaySecondary: '#38BDF8',
    thirdPrimary: '#1E3A8A',
    thirdSecondary: '#F43F5E',
    thirdPattern: 'solid',
    gkPrimary: '#EAB308',
    gkSecondary: '#111827',
  },
  club_ath: {
    clubId: 'club_ath',
    shieldType: 'athletic_bilbao',
    monogram: 'AC',
    homePrimary: '#DC2626',
    homeSecondary: '#FFFFFF',
    homePattern: 'stripes',
    awayPrimary: '#0284C7',
    awaySecondary: '#FFFFFF',
    thirdPrimary: '#6D28D9',
    thirdSecondary: '#FFFFFF',
    thirdPattern: 'solid',
    gkPrimary: '#111827',
    gkSecondary: '#DC2626',
  },

  // ENGLAND
  club_mci: {
    clubId: 'club_mci',
    shieldType: 'man_city_ship',
    monogram: 'MCFC',
    homePrimary: '#6CABDD',
    homeSecondary: '#FFFFFF',
    homePattern: 'solid',
    awayPrimary: '#1E293B',
    awaySecondary: '#FACC15',
    thirdPrimary: '#7F1D1D',
    thirdSecondary: '#D4AF37',
    thirdPattern: 'hoops',
    gkPrimary: '#F97316',
    gkSecondary: '#111827',
  },
  club_ars: {
    clubId: 'club_ars',
    shieldType: 'arsenal_cannon',
    monogram: 'AFC',
    homePrimary: '#EF0107',
    homeSecondary: '#FFFFFF',
    homePattern: 'solid',
    awayPrimary: '#111827',
    awaySecondary: '#DC2626',
    thirdPrimary: '#38BDF8',
    thirdSecondary: '#1E3A8A',
    thirdPattern: 'solid',
    gkPrimary: '#EAB308',
    gkSecondary: '#111827',
  },
  club_liv: {
    clubId: 'club_liv',
    shieldType: 'liverpool_liverbird',
    monogram: 'LFC',
    homePrimary: '#C8102E',
    homeSecondary: '#F6EB61',
    homePattern: 'solid',
    awayPrimary: '#1E293B',
    awaySecondary: '#14B8A6',
    thirdPrimary: '#FFFFFF',
    thirdSecondary: '#C8102E',
    thirdPattern: 'solid',
    gkPrimary: '#16A34A',
    gkSecondary: '#111827',
  },
  club_che: {
    clubId: 'club_che',
    shieldType: 'chelsea_lion',
    monogram: 'CFC',
    homePrimary: '#034694',
    homeSecondary: '#FFFFFF',
    homePattern: 'solid',
    awayPrimary: '#F8FAFC',
    awaySecondary: '#EA580C',
    thirdPrimary: '#111827',
    thirdSecondary: '#F43F5E',
    thirdPattern: 'solid',
    gkPrimary: '#84CC16',
    gkSecondary: '#111827',
  },
  club_mun: {
    clubId: 'club_mun',
    shieldType: 'man_utd_devil',
    monogram: 'MUFC',
    homePrimary: '#DA291C',
    homeSecondary: '#FFFFFF',
    homePattern: 'solid',
    awayPrimary: '#1E3A8A',
    awaySecondary: '#FFFFFF',
    thirdPrimary: '#FFFFFF',
    thirdSecondary: '#DA291C',
    thirdPattern: 'hoops',
    gkPrimary: '#7C3AED',
    gkSecondary: '#FFFFFF',
  },
  club_tot: {
    clubId: 'club_tot',
    shieldType: 'tottenham_cockerel',
    monogram: 'THFC',
    homePrimary: '#FFFFFF',
    homeSecondary: '#132257',
    homePattern: 'solid',
    awayPrimary: '#38BDF8',
    awaySecondary: '#132257',
    thirdPrimary: '#166534',
    thirdSecondary: '#BBF7D0',
    thirdPattern: 'solid',
    gkPrimary: '#FACC15',
    gkSecondary: '#132257',
  },

  // ITALY
  club_int_ita: {
    clubId: 'club_int_ita',
    shieldType: 'inter_milan_mono',
    monogram: 'IM',
    starsCount: 2,
    homePrimary: '#0068A8',
    homeSecondary: '#111827',
    homePattern: 'stripes',
    awayPrimary: '#FFFFFF',
    awaySecondary: '#0068A8',
    thirdPrimary: '#F59E0B',
    thirdSecondary: '#111827',
    thirdPattern: 'solid',
    gkPrimary: '#E11D48',
    gkSecondary: '#FFFFFF',
  },
  club_acm: {
    clubId: 'club_acm',
    shieldType: 'ac_milan_cross',
    monogram: 'ACM',
    starsCount: 1,
    homePrimary: '#FB090B',
    homeSecondary: '#111827',
    homePattern: 'stripes',
    awayPrimary: '#FFFFFF',
    awaySecondary: '#FB090B',
    thirdPrimary: '#374151',
    thirdSecondary: '#10B981',
    thirdPattern: 'solid',
    gkPrimary: '#84CC16',
    gkSecondary: '#111827',
  },
  club_juv: {
    clubId: 'club_juv',
    shieldType: 'juventus_jj',
    monogram: 'JJ',
    starsCount: 3,
    homePrimary: '#FFFFFF',
    homeSecondary: '#111827',
    homePattern: 'stripes',
    awayPrimary: '#FACC15',
    awaySecondary: '#1E3A8A',
    thirdPrimary: '#0F172A',
    thirdSecondary: '#D4AF37',
    thirdPattern: 'solid',
    gkPrimary: '#EA580C',
    gkSecondary: '#111827',
  },
  club_nap: {
    clubId: 'club_nap',
    shieldType: 'napoli_n',
    monogram: 'N',
    homePrimary: '#0080FF',
    homeSecondary: '#FFFFFF',
    homePattern: 'solid',
    awayPrimary: '#FFFFFF',
    awaySecondary: '#0080FF',
    thirdPrimary: '#0F172A',
    thirdSecondary: '#0080FF',
    thirdPattern: 'solid',
    gkPrimary: '#F43F5E',
    gkSecondary: '#FFFFFF',
  },
  club_rom: {
    clubId: 'club_rom',
    shieldType: 'roma_lupa',
    monogram: 'ASR',
    homePrimary: '#8E1F2F',
    homeSecondary: '#F0BC42',
    homePattern: 'solid',
    awayPrimary: '#FFFFFF',
    awaySecondary: '#8E1F2F',
    thirdPrimary: '#0F172A',
    thirdSecondary: '#F0BC42',
    thirdPattern: 'solid',
    gkPrimary: '#16A34A',
    gkSecondary: '#FFFFFF',
  },
  club_laz: {
    clubId: 'club_laz',
    shieldType: 'lazio_eagle',
    monogram: 'SSL',
    homePrimary: '#87D8F7',
    homeSecondary: '#FFFFFF',
    homePattern: 'solid',
    awayPrimary: '#FACC15',
    awaySecondary: '#0F172A',
    thirdPrimary: '#0F172A',
    thirdSecondary: '#87D8F7',
    thirdPattern: 'solid',
    gkPrimary: '#16A34A',
    gkSecondary: '#FFFFFF',
  },

  // GERMANY
  club_bay: {
    clubId: 'club_bay',
    shieldType: 'bayern_bavaria',
    monogram: 'FCB',
    starsCount: 5,
    homePrimary: '#DC052D',
    homeSecondary: '#FFFFFF',
    homePattern: 'solid',
    awayPrimary: '#111827',
    awaySecondary: '#38BDF8',
    thirdPrimary: '#F8FAFC',
    thirdSecondary: '#DC052D',
    thirdPattern: 'solid',
    gkPrimary: '#0284C7',
    gkSecondary: '#FFFFFF',
  },
  club_bvb: {
    clubId: 'club_bvb',
    shieldType: 'dortmund_bvb',
    monogram: 'BVB09',
    starsCount: 2,
    homePrimary: '#FDE100',
    homeSecondary: '#111827',
    homePattern: 'stripes',
    awayPrimary: '#111827',
    awaySecondary: '#FDE100',
    thirdPrimary: '#FFFFFF',
    thirdSecondary: '#111827',
    thirdPattern: 'solid',
    gkPrimary: '#EA580C',
    gkSecondary: '#FFFFFF',
  },
  club_b04: {
    clubId: 'club_b04',
    shieldType: 'leverkusen_lion',
    monogram: 'B04',
    homePrimary: '#E32221',
    homeSecondary: '#111827',
    homePattern: 'solid',
    awayPrimary: '#FFFFFF',
    awaySecondary: '#E32221',
    thirdPrimary: '#111827',
    thirdSecondary: '#E32221',
    thirdPattern: 'sash',
    gkPrimary: '#10B981',
    gkSecondary: '#111827',
  },

  // FRANCE & EUROPE
  club_psg: {
    clubId: 'club_psg',
    shieldType: 'psg_eiffel',
    monogram: 'PSG',
    homePrimary: '#004170',
    homeSecondary: '#DA291C',
    homePattern: 'stripes',
    awayPrimary: '#FFFFFF',
    awaySecondary: '#DA291C',
    thirdPrimary: '#F43F5E',
    thirdSecondary: '#111827',
    thirdPattern: 'solid',
    gkPrimary: '#FACC15',
    gkSecondary: '#111827',
  },
  club_om: {
    clubId: 'club_om',
    shieldType: 'marseille_om',
    monogram: 'OM',
    starsCount: 1,
    homePrimary: '#FFFFFF',
    homeSecondary: '#2FAEE0',
    homePattern: 'solid',
    awayPrimary: '#0F172A',
    awaySecondary: '#2FAEE0',
    thirdPrimary: '#EA580C',
    thirdSecondary: '#0F172A',
    thirdPattern: 'solid',
    gkPrimary: '#16A34A',
    gkSecondary: '#FFFFFF',
  },
  club_ben_por: {
    clubId: 'club_ben_por',
    shieldType: 'benfica_eagle',
    monogram: 'SLB',
    starsCount: 3,
    homePrimary: '#E30613',
    homeSecondary: '#FFFFFF',
    homePattern: 'solid',
    awayPrimary: '#111827',
    awaySecondary: '#E30613',
    thirdPrimary: '#F8FAFC',
    thirdSecondary: '#D4AF37',
    thirdPattern: 'solid',
    gkPrimary: '#0284C7',
    gkSecondary: '#FFFFFF',
  },
  club_fcp: {
    clubId: 'club_fcp',
    shieldType: 'porto_dragon',
    monogram: 'FCP',
    homePrimary: '#00428C',
    homeSecondary: '#FFFFFF',
    homePattern: 'stripes',
    awayPrimary: '#EA580C',
    awaySecondary: '#00428C',
    thirdPrimary: '#0F172A',
    thirdSecondary: '#38BDF8',
    thirdPattern: 'solid',
    gkPrimary: '#84CC16',
    gkSecondary: '#0F172A',
  },
  club_scp: {
    clubId: 'club_scp',
    shieldType: 'sporting_lion',
    monogram: 'SCP',
    homePrimary: '#008057',
    homeSecondary: '#FFFFFF',
    homePattern: 'hoops',
    awayPrimary: '#111827',
    awaySecondary: '#008057',
    thirdPrimary: '#FFFFFF',
    thirdSecondary: '#D4AF37',
    thirdPattern: 'solid',
    gkPrimary: '#E11D48',
    gkSecondary: '#FFFFFF',
  },
  club_aja: {
    clubId: 'club_aja',
    shieldType: 'ajax_hero',
    monogram: 'AJAX',
    starsCount: 3,
    homePrimary: '#FFFFFF',
    homeSecondary: '#D2122E',
    homePattern: 'stripes',
    awayPrimary: '#1E3A8A',
    awaySecondary: '#FACC15',
    thirdPrimary: '#374151',
    thirdSecondary: '#D2122E',
    thirdPattern: 'solid',
    gkPrimary: '#16A34A',
    gkSecondary: '#FFFFFF',
  },
};

const ASSET_OVERRIDES_STORAGE_KEY = 'atlas_futbol_pro_graphic_assets_v1';

export interface GraphicAssetOverride {
  teamId: string;
  crestUrl?: string;
  homePrimary?: string;
  homeSecondary?: string;
  awayPrimary?: string;
  awaySecondary?: string;
  thirdPrimary?: string;
  thirdSecondary?: string;
  gkPrimary?: string;
  gkSecondary?: string;
}

export function loadImportedGraphicAssets(): Record<string, GraphicAssetOverride> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(ASSET_OVERRIDES_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, GraphicAssetOverride>;
  } catch {
    return {};
  }
}

export function saveImportedGraphicAssets(assets: Record<string, GraphicAssetOverride>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(ASSET_OVERRIDES_STORAGE_KEY, JSON.stringify(assets));
  } catch {
    // ignore quota errors
  }
}

export function enrichTeamWithAuthenticAssets(team: Team): Team {
  const imported = loadImportedGraphicAssets()[team.id];
  const auth = AUTHENTIC_CLUB_ASSETS[team.id];

  const thirdColor = imported?.thirdPrimary ?? auth?.thirdPrimary ?? team.thirdColor ?? '#1E293B';
  const thirdSecondaryColor = imported?.thirdSecondary ?? auth?.thirdSecondary ?? team.thirdSecondaryColor ?? team.primaryColor;
  const thirdPattern = auth?.thirdPattern ?? team.thirdPattern ?? 'solid';
  const gkPrimaryColor = imported?.gkPrimary ?? auth?.gkPrimary ?? team.gkPrimaryColor ?? '#16A34A';
  const gkSecondaryColor = imported?.gkSecondary ?? auth?.gkSecondary ?? team.gkSecondaryColor ?? '#0F172A';
  const crestUrl = imported?.crestUrl ?? team.crestUrl;

  const crestStatus: CrestStatus = crestUrl
    ? 'official_imported'
    : team.type === 'national' || Boolean(auth)
      ? 'authentic_heraldry'
      : 'pending_official';

  return {
    ...team,
    primaryColor: imported?.homePrimary ?? auth?.homePrimary ?? team.primaryColor,
    secondaryColor: imported?.homeSecondary ?? auth?.homeSecondary ?? team.secondaryColor,
    kitPattern: auth?.homePattern ?? team.kitPattern,
    awayColor: imported?.awayPrimary ?? auth?.awayPrimary ?? team.awayColor,
    awaySecondaryColor: imported?.awaySecondary ?? auth?.awaySecondary ?? team.awaySecondaryColor ?? team.primaryColor,
    thirdColor,
    thirdSecondaryColor,
    thirdPattern,
    gkPrimaryColor,
    gkSecondaryColor,
    crestUrl,
    crestStatus,
  };
}

export function resolveActiveKitColors(
  team: Team,
  kit: KitSelection = 'home',
  isGoalkeeper = false
): { primary: string; secondary: string; pattern: KitPattern } {
  if (isGoalkeeper) {
    return {
      primary: team.gkPrimaryColor ?? '#16A34A',
      secondary: team.gkSecondaryColor ?? '#111827',
      pattern: 'solid',
    };
  }
  if (kit === 'away') {
    return {
      primary: team.awayColor,
      secondary: team.awaySecondaryColor ?? team.primaryColor,
      pattern: 'solid',
    };
  }
  if (kit === 'third') {
    return {
      primary: team.thirdColor ?? '#1E293B',
      secondary: team.thirdSecondaryColor ?? team.secondaryColor,
      pattern: team.thirdPattern ?? 'solid',
    };
  }
  return {
    primary: team.primaryColor,
    secondary: team.secondaryColor,
    pattern: team.kitPattern,
  };
}
