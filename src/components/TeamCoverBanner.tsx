import React from 'react';
import type { Team } from '../types/football';
import { TeamCrest } from './TeamCrest';

interface TeamCoverBannerProps {
  team: Team;
  compact?: boolean;
  className?: string;
}

const OFFICIAL_CLUB_MOTTOS: Record<string, { motto: string; titles: number; founded: string }> = {
  club_rma: { motto: '¡HALA MADRID Y NADA MÁS!', titles: 15, founded: '1902' },
  club_fcb: { motto: 'MÉS QUE UN CLUB', titles: 5, founded: '1899' },
  club_atm: { motto: 'CORAJE Y CORAZÓN', titles: 11, founded: '1903' },
  club_ath: { motto: 'UNIQUE IN THE WORLD', titles: 8, founded: '1898' },
  club_mci: { motto: 'SUPERBIA IN PROELIO', titles: 10, founded: '1880' },
  club_ars: { motto: 'VICTORIA CONCORDIA CRESCIT', titles: 13, founded: '1886' },
  club_liv: { motto: "YOU'LL NEVER WALK ALONE", titles: 6, founded: '1892' },
  club_che: { motto: 'PRIDE OF LONDON', titles: 2, founded: '1905' },
  club_mun: { motto: 'GLORY GLORY MAN UNITED', titles: 20, founded: '1878' },
  club_tot: { motto: 'TO DARE IS TO DO', titles: 2, founded: '1882' },
  club_bay: { motto: 'MIA SAN MIA', titles: 6, founded: '1900' },
  club_b04: { motto: 'WERKSELF UNBEATEN', titles: 1, founded: '1904' },
  club_bvb: { motto: 'ECHTE LIEBE', titles: 1, founded: '1909' },
  club_int_ita: { motto: 'FRATELLI DEL MONDO', titles: 3, founded: '1908' },
  club_acm: { motto: 'SEMPRE MILAN', titles: 7, founded: '1899' },
  club_juv: { motto: 'FINO ALLA FINE', titles: 2, founded: '1897' },
  club_nap: { motto: 'FORZA NAPOLI SEMPRE', titles: 3, founded: '1926' },
  club_psg: { motto: 'ICI C’EST PARIS', titles: 12, founded: '1970' },
  club_riv: { motto: 'EL MÁS GRANDE LEJOS', titles: 4, founded: '1901' },
  club_boc: { motto: 'LA MITAD MÁS UNO', titles: 6, founded: '1905' },
  club_rac: { motto: 'EL PRIMER GRANDE', titles: 1, founded: '1903' },
  club_fla: { motto: 'UMA VEZ FLAMENGO', titles: 3, founded: '1895' },
  club_pal: { motto: 'AVANTI PALESTRA', titles: 3, founded: '1914' },
  club_mia: { motto: 'FREEDOM TO DREAM', titles: 1, founded: '2018' },
  club_nas_ksa: { motto: 'AL-AALAMI KNIGHTS', titles: 9, founded: '1955' },
  club_hil_ksa: { motto: 'BLUE WAVE RIYADH', titles: 4, founded: '1957' },
  club_ame: { motto: 'ÓDIAME MÁS • GRANDEZA', titles: 15, founded: '1916' },
  nat_arg: { motto: 'CAMPEONES DEL MUNDO ★★★', titles: 3, founded: '1893' },
  nat_bra: { motto: 'PENTACAMPEÃO MUNDIAL ★★★★★', titles: 5, founded: '1914' },
  nat_esp: { motto: 'LA ROJA • CAMPEONA DE EUROPA', titles: 1, founded: '1909' },
  nat_fra: { motto: 'LES BLEUS ★★', titles: 2, founded: '1904' },
  nat_eng: { motto: 'THREE LIONS ★', titles: 1, founded: '1863' },
  nat_ger: { motto: 'DIE MANNSCHAFT ★★★★', titles: 4, founded: '1900' },
  nat_uru: { motto: 'LA GARRA CHARRÚA ★★★★', titles: 4, founded: '1900' },
  nat_por: { motto: 'A SELEÇÃO DAS QUINAS', titles: 1, founded: '1914' },
  nat_col: { motto: 'LA TRICOLor CAFETERA', titles: 1, founded: '1924' },
};

export const TeamCoverBanner: React.FC<TeamCoverBannerProps> = ({
  team,
  compact = false,
  className = '',
}) => {
  const meta = OFFICIAL_CLUB_MOTTOS[team.id] ?? {
    motto: `${team.stadium.name.toUpperCase()} • ${team.city?.toUpperCase() || team.country.toUpperCase()}`,
    titles: team.overall >= 88 ? 5 : team.overall >= 83 ? 3 : team.overall >= 78 ? 1 : 0,
    founded: '1908',
  };

  const starPlayers = [...team.players]
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 3);

  const p1 = team.primaryColor || '#1D4ED8';
  const p2 = team.secondaryColor || '#FACC15';
  const uid = `cover_${team.id.replace(/[^a-zA-Z0-9]/g, '_')}`;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-white/15 bg-[#070B12] select-none shadow-lg ${
        compact ? 'h-24' : 'h-36'
      } ${className}`}
    >
      {/* Official Club / Nation Cover SVG Artwork */}
      <svg
        viewBox="0 0 640 220"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`${uid}_bg`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={p1} stopOpacity="0.92" />
            <stop offset="52%" stopColor="#09101D" stopOpacity="0.96" />
            <stop offset="100%" stopColor={p2} stopOpacity="0.88" />
          </linearGradient>
          <radialGradient id={`${uid}_glow`} cx="78%" cy="22%" r="60%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.38" />
            <stop offset="55%" stopColor={p2} stopOpacity="0.14" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="640" height="220" fill={`url(#${uid}_bg)`} />

        {/* Kit pattern heritage geometry */}
        {team.kitPattern === 'stripes' && (
          <g opacity="0.24">
            <rect x="30" y="0" width="44" height="220" fill={p2} />
            <rect x="118" y="0" width="44" height="220" fill={p2} />
            <rect x="206" y="0" width="44" height="220" fill={p2} />
            <rect x="294" y="0" width="44" height="220" fill={p2} />
            <rect x="382" y="0" width="44" height="220" fill={p2} />
          </g>
        )}
        {team.kitPattern === 'hoops' && (
          <g opacity="0.25">
            <rect x="0" y="28" width="640" height="36" fill={p2} />
            <rect x="0" y="96" width="640" height="38" fill={p2} />
            <rect x="0" y="164" width="640" height="34" fill={p2} />
          </g>
        )}
        {team.kitPattern === 'sash' && (
          <polygon points="-40,220 120,220 420,0 260,0" fill={p2} opacity="0.36" />
        )}
        {team.kitPattern === 'halves' && (
          <rect x="320" y="0" width="320" height="220" fill={p2} opacity="0.28" />
        )}

        {/* Stadium Roof Trusses & Floodlight Beams */}
        <path
          d="M0,45 Q320,-15 640,45 L640,0 L0,0 Z"
          fill="#030712"
          opacity="0.65"
        />
        <g stroke="#FFFFFF" strokeOpacity="0.16" strokeWidth="1.5">
          <line x1="40" y1="0" x2="90" y2="34" />
          <line x1="140" y1="0" x2="170" y2="24" />
          <line x1="250" y1="0" x2="265" y2="18" />
          <line x1="390" y1="0" x2="375" y2="18" />
          <line x1="500" y1="0" x2="470" y2="24" />
          <line x1="600" y1="0" x2="550" y2="34" />
        </g>

        {/* Stadium Floodlight LED nodes */}
        <g fill="#FEF08A" opacity="0.85">
          <circle cx="92" cy="24" r="3" />
          <circle cx="104" cy="22" r="2.5" />
          <circle cx="536" cy="22" r="2.5" />
          <circle cx="548" cy="24" r="3" />
        </g>

        {/* Crowd Tier Silhouette & Pitch Horizon */}
        <path
          d="M0,175 L90,142 L550,142 L640,175 L640,220 L0,220 Z"
          fill="#050B14"
          opacity="0.72"
        />
        <line x1="70" y1="186" x2="570" y2="186" stroke="#10B981" strokeOpacity="0.45" strokeWidth="2" />
        <ellipse cx="320" cy="186" rx="48" ry="11" fill="none" stroke="#10B981" strokeOpacity="0.38" strokeWidth="1.5" />

        {/* Giant Watermark ShortName */}
        <text
          x="615"
          y="155"
          textAnchor="end"
          fill="#FFFFFF"
          fillOpacity="0.08"
          fontFamily="sans-serif"
          fontWeight="900"
          fontSize="118"
          letterSpacing="-4"
        >
          {team.shortName}
        </text>

        <rect width="640" height="220" fill={`url(#${uid}_glow)`} />
      </svg>

      {/* Dark readability vignette */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#050811]/90 via-[#050811]/55 to-transparent" />

      {/* Foreground Content */}
      <div className="relative z-10 h-full flex items-center justify-between px-3.5 py-2.5 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <TeamCrest team={team} size={compact ? 48 : 64} className="drop-shadow-[0_6px_16px_rgba(0,0,0,0.75)]" />
            <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-mono font-black text-[9px] shadow">
              {team.overall}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-1.5 py-0.5 rounded bg-white/15 backdrop-blur-sm text-[9px] font-mono font-bold uppercase tracking-wider text-white">
                {team.leagueName || team.confederation}
              </span>
              {meta.titles > 0 && (
                <span className="text-[10px] text-amber-300 font-bold tracking-tight">
                  {'★'.repeat(Math.min(5, meta.titles))}
                </span>
              )}
              <span className="text-[9px] font-mono text-slate-300/80">
                EST. {meta.founded}
              </span>
            </div>

            <h4 className={`font-display font-black uppercase tracking-tight text-white truncate drop-shadow ${compact ? 'text-base' : 'text-xl'}`}>
              {team.name}
            </h4>

            <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-amber-300/95 truncate">
              {meta.motto}
            </p>

            {!compact && (
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                {starPlayers.map((sp) => (
                  <span
                    key={sp.id}
                    className="px-1.5 py-0.5 rounded bg-black/55 border border-white/15 text-[9px] font-semibold text-slate-100"
                  >
                    <strong className="text-amber-300 font-mono mr-1">#{sp.number}</strong>
                    {sp.name}
                    <span className="ml-1 text-emerald-400 font-mono font-bold">{sp.overall}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Stadium & Kit Badge */}
        <div className="hidden sm:flex flex-col items-end justify-between h-full text-right shrink-0">
          <div className="px-2 py-0.5 rounded bg-black/55 border border-white/15 backdrop-blur-sm">
            <div className="text-[8px] font-mono uppercase tracking-widest text-slate-400">ESTADIO OFICIAL</div>
            <div className="text-[10px] font-bold text-white truncate max-w-[165px]">{team.stadium.name}</div>
            <div className="text-[8px] font-mono text-emerald-400">
              {team.stadium.capacity.toLocaleString()} ESPECTADORES
            </div>
          </div>

          <div className="flex items-center gap-1">
            <span
              className="w-3.5 h-3.5 rounded-full border border-white/40 shadow"
              style={{ backgroundColor: team.primaryColor }}
              title="Color Titular"
            />
            <span
              className="w-3.5 h-3.5 rounded-full border border-white/40 shadow"
              style={{ backgroundColor: team.secondaryColor }}
              title="Color Secundario"
            />
            <span
              className="w-3.5 h-3.5 rounded-full border border-white/40 shadow"
              style={{ backgroundColor: team.awayColor }}
              title="Color Alternativo"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
