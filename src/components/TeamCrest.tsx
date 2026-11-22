import React from 'react';
import { AUTHENTIC_CLUB_ASSETS } from '../data/authenticAssets';
import { WORLD_CUP_STARS } from '../data/database';
import type { Team } from '../types/football';

interface TeamCrestProps {
  team: Team;
  size?: number;
  className?: string;
  showBadgeStatus?: boolean;
}

function hashCrestId(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function renderFivePointStar(cx: number, cy: number, rOuter: number, fill = '#FACC15', stroke = '#78350F'): React.ReactNode {
  const rInner = rOuter * 0.44;
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? rOuter : rInner;
    pts.push(`${(cx + Math.cos(angle) * r).toFixed(2)},${(cy + Math.sin(angle) * r).toFixed(2)}`);
  }
  return <polygon key={`${cx}_${cy}`} points={pts.join(' ')} fill={fill} stroke={stroke} strokeWidth="0.65" />;
}

export const TeamCrest: React.FC<TeamCrestProps> = ({
  team,
  size = 40,
  className = '',
  showBadgeStatus = false,
}) => {
  // 1. Imported external official crest URL or Data URI takes priority
  const officialImgUrl = team.logoUrl || team.crestUrl;
  if (officialImgUrl) {
    return (
      <div
        className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
        style={{ width: size, height: size }}
        title={`${team.name} (Escudo Oficial Importado)`}
      >
        <img
          src={officialImgUrl}
          alt={`Escudo de ${team.name}`}
          className="w-full h-full object-contain drop-shadow-md"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  // 2. National Team Official Federation Shield + World Cup Champion Stars
  if (team.type === 'national') {
    const p = team.primaryColor;
    const s = team.secondaryColor;
    const a = team.awayColor || '#FFFFFF';
    const uid = `nat_${team.id}`;
    const wcStars = team.worldCupStars ?? WORLD_CUP_STARS[team.id] ?? 0;
    const h = hashCrestId(team.id);
    const shieldVariant = h % 3; // 0: Classic FIFA Swiss Shield, 1: Royal Rounded Crest, 2: Hexagonal Federation Badge

    const shieldPath =
      shieldVariant === 1
        ? 'M11 12 C11 9 53 9 53 12 V34 C53 47 43 56 32 60 C21 56 11 47 11 34 Z'
        : shieldVariant === 2
          ? 'M14 10 L32 8 L50 10 L53 33 C52 46 43 55 32 60 C21 55 12 46 11 33 Z'
          : 'M10 11 H54 V34 C54 47 44 55 32 60 C20 55 10 47 10 34 Z';

    const starNodes: React.ReactNode[] = [];
    if (wcStars > 0) {
      const spacing = wcStars >= 5 ? 7.8 : wcStars === 4 ? 8.8 : 9.5;
      const startX = 32 - ((wcStars - 1) * spacing) / 2;
      for (let i = 0; i < wcStars; i++) {
        const sx = startX + i * spacing;
        const archOffset = Math.abs(i - (wcStars - 1) / 2) * 0.65;
        starNodes.push(renderFivePointStar(sx, 5.2 + archOffset, 3.6, '#FACC15', '#78350F'));
      }
    }

    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        className={`shrink-0 select-none drop-shadow-sm ${className}`}
        aria-label={`Insignia federativa de ${team.name}`}
      >
        <defs>
          <clipPath id={uid}>
            <path d={shieldPath} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${uid})`}>
          {team.kitPattern === 'stripes' ? (
            <>
              <rect x="8" y="8" width="10" height="54" fill={p} />
              <rect x="18" y="8" width="9" height="54" fill={s} />
              <rect x="27" y="8" width="10" height="54" fill={p} />
              <rect x="37" y="8" width="9" height="54" fill={s} />
              <rect x="46" y="8" width="10" height="54" fill={p} />
            </>
          ) : team.kitPattern === 'hoops' ? (
            <>
              <rect x="8" y="8" width="48" height="17" fill={p} />
              <rect x="8" y="25" width="48" height="17" fill={s} />
              <rect x="8" y="42" width="48" height="18" fill={p} />
            </>
          ) : team.kitPattern === 'sash' ? (
            <>
              <rect x="8" y="8" width="48" height="52" fill={p} />
              <polygon points="8,52 48,8 56,14 16,58" fill={s} />
            </>
          ) : team.kitPattern === 'halves' ? (
            <>
              <rect x="8" y="8" width="24" height="52" fill={p} />
              <rect x="32" y="8" width="24" height="52" fill={s} />
            </>
          ) : (
            <>
              <rect x="8" y="8" width="48" height="34" fill={p} />
              <rect x="8" y="42" width="48" height="18" fill={s} />
              <polygon points="8,8 56,8 32,26" fill={a} opacity="0.22" />
            </>
          )}
          <circle cx="32" cy="31" r="13.5" fill="rgba(11,17,23,0.52)" stroke="#FACC15" strokeWidth="1.6" />
        </g>
        <path
          d={shieldPath}
          fill="none"
          stroke={wcStars > 0 ? '#FACC15' : '#D97706'}
          strokeWidth="2.8"
        />
        {team.flag ? (
          <text x="32" y="36.5" textAnchor="middle" fontSize="17">
            {team.flag}
          </text>
        ) : (
          <text
            x="32"
            y="35.5"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="12"
            fontWeight="900"
            fontFamily="Barlow Condensed, sans-serif"
          >
            {team.shortName}
          </text>
        )}
        <rect x="15" y="46.5" width="34" height="9.5" rx="2.5" fill="#0B1117" stroke="#F59E0B" strokeWidth="1" />
        <text
          x="32"
          y="53.5"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="7.4"
          fontWeight="800"
          fontFamily="Barlow Condensed, sans-serif"
        >
          {team.shortName}
        </text>
        {starNodes}
      </svg>
    );
  }

  // 3. Authentic Club Heraldry SVG (IdentityRenderer for all 125 Clubs)
  const auth = AUTHENTIC_CLUB_ASSETS[team.id];
  const p = team.primaryColor;
  const s = team.secondaryColor;
  const a = team.crest?.accentColor || '#D4AF37';
  const uid = `crest_${team.id}`;
  const monogram = auth?.monogram ?? team.shortName;

  const renderAuthenticClubHeraldry = () => {
    // Direct club ID bespoke designs for Spanish LaLiga / Historic & Argentine Liga Profesional clubs
    switch (team.id) {
      case 'club_atm':
        return (
          <>
            <path d="M11 8 H53 V33 C53 47 43 55 32 59 C21 55 11 47 11 33 Z" fill="#FFFFFF" stroke="#1E3A8A" strokeWidth="3" />
            <rect x="17" y="22" width="6" height="31" fill="#CB3524" />
            <rect x="29" y="22" width="6" height="34" fill="#CB3524" />
            <rect x="41" y="22" width="6" height="31" fill="#CB3524" />
            <polygon points="11,8 53,8 53,22 11,36" fill="#1E3A8A" />
            <circle cx="20" cy="15" r="1.6" fill="#FFFFFF" />
            <circle cx="28" cy="13" r="1.6" fill="#FFFFFF" />
            <circle cx="36" cy="13" r="1.6" fill="#FFFFFF" />
            <circle cx="44" cy="15" r="1.6" fill="#FFFFFF" />
          </>
        );
      case 'club_ath':
        return (
          <>
            <path d="M10 10 H54 L49 38 C46 50 38 56 32 59 C26 56 18 50 15 38 Z" fill="#FFFFFF" stroke="#111827" strokeWidth="2.8" />
            <rect x="16" y="11" width="7" height="42" fill="#EE2523" />
            <rect x="29" y="11" width="7" height="45" fill="#EE2523" />
            <rect x="41" y="11" width="7" height="42" fill="#EE2523" />
            <polygon points="12,11 46,11 16,38" fill="#111827" />
            <text x="32" y="25" textAnchor="middle" fill="#FFFFFF" fontSize="9.5" fontWeight="900">ATH</text>
          </>
        );
      case 'club_rso':
        return (
          <>
            <path d="M21 12 L26 6 L32 10 L38 6 L43 12 Z" fill="#D4AF37" stroke="#991B1B" strokeWidth="1" />
            <circle cx="32" cy="36" r="21" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="3" />
            <rect x="19" y="18" width="6" height="36" fill="#0067B1" />
            <rect x="29" y="16" width="6" height="40" fill="#0067B1" />
            <rect x="39" y="18" width="6" height="36" fill="#0067B1" />
            <circle cx="32" cy="36" r="9" fill="#D4AF37" stroke="#111827" strokeWidth="1.5" />
            <text x="32" y="39.5" textAnchor="middle" fill="#111827" fontSize="8.5" fontWeight="900">RSO</text>
          </>
        );
      case 'club_bet':
        return (
          <>
            <path d="M22 11 L26 5 L32 9 L38 5 L42 11 Z" fill="#D4AF37" stroke="#B91C1C" strokeWidth="1" />
            <polygon points="32,14 56,36 32,58 8,36" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="2.6" />
            <rect x="22" y="21" width="5" height="30" fill="#0BB363" />
            <rect x="30" y="17" width="5" height="38" fill="#0BB363" />
            <rect x="38" y="21" width="5" height="30" fill="#0BB363" />
            <circle cx="32" cy="36" r="9.5" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="2" />
            <text x="32" y="39.5" textAnchor="middle" fill="#0BB363" fontSize="9.5" fontWeight="900">RBB</text>
          </>
        );
      case 'club_vil':
        return (
          <>
            <path d="M22 11 L26 5 L32 9 L38 5 L42 11 Z" fill="#D4AF37" />
            <circle cx="32" cy="36" r="21" fill="#FBE106" stroke="#005187" strokeWidth="3.2" />
            <circle cx="32" cy="36" r="14" fill="#005187" stroke="#D4AF37" strokeWidth="1.8" />
            <text x="32" y="40" textAnchor="middle" fill="#FBE106" fontSize="11.5" fontWeight="900">VCF</text>
          </>
        );
      case 'club_sev':
        return (
          <>
            <path d="M11 8 H53 V33 C53 47 43 55 32 59 C21 55 11 47 11 33 Z" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="3" />
            <rect x="18" y="31" width="6" height="24" fill="#D41920" />
            <rect x="30" y="31" width="6" height="26" fill="#D41920" />
            <rect x="42" y="31" width="6" height="24" fill="#D41920" />
            <path d="M11 8 H53 V31 H11 Z" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.5" />
            <circle cx="41" cy="20" r="8" fill="#D41920" />
            <text x="41" y="23" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="900">SFC</text>
          </>
        );
      case 'club_val':
        return (
          <>
            <path d="M16 14 L32 7 L48 14 L32 18 Z" fill="#111827" />
            <path d="M13 15 H51 V34 C51 47 42 55 32 59 C22 55 13 47 13 34 Z" fill="#FACC15" stroke="#111827" strokeWidth="2.8" />
            <rect x="20" y="16" width="4" height="39" fill="#DC2626" />
            <rect x="30" y="16" width="4" height="41" fill="#DC2626" />
            <rect x="40" y="16" width="4" height="39" fill="#DC2626" />
            <rect x="14" y="25" width="36" height="10" fill="#FFFFFF" stroke="#111827" strokeWidth="1" />
            <text x="32" y="33" textAnchor="middle" fill="#111827" fontSize="8.5" fontWeight="900">VALENCIA</text>
          </>
        );
      case 'club_ind':
        return (
          <>
            <path d="M11 8 H53 V33 C53 47 43 55 32 59 C21 55 11 47 11 33 Z" fill="#EC1C24" stroke="#FFFFFF" strokeWidth="3" />
            <line x1="13" y1="10" x2="51" y2="51" stroke="#FFFFFF" strokeWidth="2.5" />
            <line x1="51" y1="10" x2="13" y2="51" stroke="#FFFFFF" strokeWidth="2.5" />
            <rect x="20" y="24" width="24" height="13" rx="2" fill="#1E3A8A" stroke="#FFFFFF" strokeWidth="1.5" />
            <text x="32" y="34" textAnchor="middle" fill="#FFFFFF" fontSize="10.5" fontWeight="900">CAI</text>
          </>
        );
      case 'club_rac':
        return (
          <>
            <path d="M11 8 H53 V33 C53 47 43 55 32 59 C21 55 11 47 11 33 Z" fill="#FFFFFF" stroke="#005187" strokeWidth="2.8" />
            <rect x="16" y="9" width="7" height="46" fill="#6CABDD" />
            <rect x="29" y="9" width="7" height="48" fill="#6CABDD" />
            <rect x="41" y="9" width="7" height="46" fill="#6CABDD" />
            <rect x="13" y="14" width="38" height="11" rx="2" fill="#FFFFFF" stroke="#005187" strokeWidth="1.2" />
            <text x="32" y="22.5" textAnchor="middle" fill="#005187" fontSize="9.5" fontWeight="900">RACING</text>
          </>
        );
      case 'club_slo':
        return (
          <>
            <circle cx="32" cy="32" r="25" fill="#002B5C" stroke="#D4AF37" strokeWidth="2.8" />
            <rect x="18" y="12" width="7" height="40" fill="#D91A2A" />
            <rect x="32" y="10" width="7" height="44" fill="#D91A2A" />
            <circle cx="32" cy="32" r="13" fill="#002B5C" stroke="#FFFFFF" strokeWidth="1.8" />
            <text x="32" y="36" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="900">CASLA</text>
          </>
        );
      case 'club_est':
        return (
          <>
            <path d="M12 10 L32 6 L52 10 V34 C52 47 43 55 32 59 C21 55 12 47 12 34 Z" fill="#FFFFFF" stroke="#111827" strokeWidth="2.6" />
            <rect x="17" y="9" width="7" height="46" fill="#E31E24" />
            <rect x="29" y="8" width="7" height="49" fill="#E31E24" />
            <rect x="41" y="9" width="7" height="46" fill="#E31E24" />
            <text x="32" y="35" textAnchor="middle" fill="#111827" fontSize="11" fontWeight="900" stroke="#FFFFFF" strokeWidth="0.6">EDLP</text>
          </>
        );
      case 'club_vel':
        return (
          <>
            <path d="M11 8 H53 V33 C53 47 43 55 32 59 C21 55 11 47 11 33 Z" fill="#FFFFFF" stroke="#004996" strokeWidth="3" />
            <polyline points="12,18 32,44 52,18" fill="none" stroke="#004996" strokeWidth="8" />
            <text x="32" y="21" textAnchor="middle" fill="#004996" fontSize="9.5" fontWeight="900">CAVS</text>
          </>
        );
      case 'club_ros':
        return (
          <>
            <path d="M11 8 H53 V33 C53 47 43 55 32 59 C21 55 11 47 11 33 Z" fill="#0038A8" stroke="#FCDD09" strokeWidth="3" />
            <rect x="19" y="9" width="8" height="46" fill="#FCDD09" />
            <rect x="37" y="9" width="8" height="46" fill="#FCDD09" />
            <circle cx="32" cy="32" r="11" fill="#0038A8" stroke="#FCDD09" strokeWidth="2" />
            <text x="32" y="36" textAnchor="middle" fill="#FCDD09" fontSize="9.5" fontWeight="900">CARC</text>
          </>
        );
      case 'club_new_arg':
        return (
          <>
            <path d="M11 8 H53 V33 C53 47 43 55 32 59 C21 55 11 47 11 33 Z" fill="#111827" stroke="#FFFFFF" strokeWidth="2.8" />
            <path d="M32 8 H53 V33 C53 47 43 55 32 59 Z" fill="#E31E24" />
            <text x="32" y="37" textAnchor="middle" fill="#FFFFFF" fontSize="13.5" fontWeight="900">NOB</text>
          </>
        );
      default:
        break;
    }

    switch (auth?.shieldType) {
      case 'river_sash':
        return (
          <>
            <path d="M11 8 H53 V33 C53 47 43 55 32 59 C21 55 11 47 11 33 Z" fill="#FFFFFF" stroke="#111827" strokeWidth="2.8" />
            <polygon points="14,47 46,10 52,14 20,52" fill="#D91A2A" />
            <text x="32" y="37" textAnchor="middle" fill="#111827" fontSize="13.5" fontWeight="900" fontFamily="Barlow Condensed, sans-serif" stroke="#FFFFFF" strokeWidth="0.6">
              CARP
            </text>
          </>
        );
      case 'boca_stars':
        return (
          <>
            <path d="M11 9 H53 V33 C53 47 43 55 32 59 C21 55 11 47 11 33 Z" fill="#002B7F" stroke="#F5C400" strokeWidth="3" />
            <rect x="12" y="25" width="40" height="13" fill="#F5C400" />
            <text x="32" y="35" textAnchor="middle" fill="#002B7F" fontSize="12.5" fontWeight="900" fontFamily="Barlow Condensed, sans-serif">
              CABJ
            </text>
            <circle cx="23" cy="17" r="2" fill="#F5C400" />
            <circle cx="32" cy="15" r="2.2" fill="#F5C400" />
            <circle cx="41" cy="17" r="2" fill="#F5C400" />
            <circle cx="26" cy="46" r="1.8" fill="#F5C400" />
            <circle cx="32" cy="48" r="1.8" fill="#F5C400" />
            <circle cx="38" cy="46" r="1.8" fill="#F5C400" />
          </>
        );
      case 'real_madrid_crown':
        return (
          <>
            <path d="M21 13 L25 6 L32 11 L39 6 L43 13 Z" fill="#D4AF37" stroke="#B91C1C" strokeWidth="1.2" />
            <circle cx="32" cy="36" r="21" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="3.5" />
            <line x1="18" y1="23" x2="46" y2="49" stroke="#1E3A8A" strokeWidth="5.5" />
            <circle cx="32" cy="36" r="18" fill="none" stroke="#D4AF37" strokeWidth="1.5" />
            <text x="32" y="41" textAnchor="middle" fill="#D4AF37" fontSize="13.5" fontWeight="900" fontFamily="Barlow Condensed, sans-serif" stroke="#0F172A" strokeWidth="0.6">
              MCF
            </text>
          </>
        );
      case 'barcelona_crest':
        return (
          <>
            <path d="M10 11 H54 V33 C54 47 44 55 32 59 C20 55 10 47 10 33 Z" fill="#004D98" stroke="#D4AF37" strokeWidth="3" />
            <rect x="12" y="12" width="20" height="14" fill="#FFFFFF" />
            <rect x="20" y="12" width="4" height="14" fill="#DC2626" />
            <rect x="12" y="17" width="20" height="4" fill="#DC2626" />
            <rect x="32" y="12" width="20" height="14" fill="#FACC15" />
            <rect x="35" y="12" width="3" height="14" fill="#DC2626" />
            <rect x="41" y="12" width="3" height="14" fill="#DC2626" />
            <rect x="47" y="12" width="3" height="14" fill="#DC2626" />
            <rect x="11" y="26" width="42" height="9" fill="#D4AF37" />
            <text x="32" y="33" textAnchor="middle" fill="#111827" fontSize="9.5" fontWeight="900" fontFamily="Barlow Condensed, sans-serif">
              FCB
            </text>
            <rect x="19" y="35" width="8" height="20" fill="#A50044" />
            <rect x="36" y="35" width="8" height="20" fill="#A50044" />
            <circle cx="32" cy="45" r="4.5" fill="#D4AF37" />
          </>
        );
      case 'arsenal_cannon':
        return (
          <>
            <path d="M11 8 H53 V33 C53 47 43 55 32 59 C21 55 11 47 11 33 Z" fill="#EF0107" stroke="#D4AF37" strokeWidth="3" />
            <path d="M11 8 H20 V52 C14 47 11 40 11 33 Z" fill="#023474" />
            <path d="M53 8 H44 V52 C50 47 53 40 53 33 Z" fill="#023474" />
            <rect x="18" y="31" width="28" height="5" rx="2" fill="#D4AF37" />
            <circle cx="25" cy="38" r="5" fill="none" stroke="#D4AF37" strokeWidth="2.5" />
            <text x="32" y="22" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="900" fontFamily="Barlow Condensed, sans-serif">
              ARSENAL
            </text>
          </>
        );
      case 'man_city_ship':
        return (
          <>
            <circle cx="32" cy="32" r="25" fill="#6CABDD" stroke="#D4AF37" strokeWidth="3" />
            <circle cx="32" cy="32" r="18" fill="#FFFFFF" stroke="#1C2C5B" strokeWidth="2" />
            <path d="M22 25 H42 L38 31 H26 Z" fill="#D4AF37" />
            <circle cx="32" cy="40" r="4.5" fill="#DC2626" />
            <text x="32" y="13" textAnchor="middle" fill="#1C2C5B" fontSize="7.5" fontWeight="900">
              MANCHESTER
            </text>
            <text x="32" y="55" textAnchor="middle" fill="#1C2C5B" fontSize="8" fontWeight="900">
              CITY
            </text>
          </>
        );
      case 'juventus_jj':
        return (
          <>
            <path d="M11 8 H53 V33 C53 47 43 55 32 59 C21 55 11 47 11 33 Z" fill="#111827" stroke="#D4AF37" strokeWidth="2.5" />
            <path d="M24 14 H31 V40 C31 46 26 50 20 51" fill="none" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M36 14 H42 V42 C42 49 35 54 25 55" fill="none" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" />
          </>
        );
      case 'inter_milan_mono':
        return (
          <>
            <circle cx="32" cy="32" r="25" fill="#0068A8" stroke="#D4AF37" strokeWidth="3.5" />
            <circle cx="32" cy="32" r="19" fill="#111827" stroke="#FFFFFF" strokeWidth="2" />
            <text x="32" y="38" textAnchor="middle" fill="#D4AF37" fontSize="16" fontWeight="900" fontFamily="Barlow Condensed, sans-serif">
              IM
            </text>
          </>
        );
      case 'ac_milan_cross':
        return (
          <>
            <ellipse cx="32" cy="32" rx="20" ry="26" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="3" />
            <path d="M32 7 A19 25 0 0 0 32 57 Z" fill="#FB090B" />
            <rect x="19" y="10" width="5" height="44" fill="#111827" />
            <rect x="27" y="7" width="5" height="50" fill="#111827" />
            <rect x="39" y="10" width="4" height="44" fill="#FB090B" />
            <rect x="32" y="30" width="19" height="4" fill="#FB090B" />
            <text x="32" y="21" textAnchor="middle" fill="#111827" fontSize="8.5" fontWeight="900" stroke="#FFFFFF" strokeWidth="0.4">
              ACM
            </text>
          </>
        );
      case 'bayern_bavaria':
        return (
          <>
            <circle cx="32" cy="32" r="25" fill="#DC052D" stroke="#D4AF37" strokeWidth="3" />
            <circle cx="32" cy="32" r="16" fill="#0066B2" stroke="#FFFFFF" strokeWidth="2" />
            <polygon points="32,18 40,26 32,34 24,26" fill="#FFFFFF" />
            <polygon points="32,30 40,38 32,46 24,38" fill="#FFFFFF" />
            <text x="32" y="13" textAnchor="middle" fill="#FFFFFF" fontSize="7.5" fontWeight="900">
              FC BAYERN
            </text>
          </>
        );
      case 'dortmund_bvb':
        return (
          <>
            <circle cx="32" cy="32" r="25" fill="#FDE100" stroke="#111827" strokeWidth="3.5" />
            <text x="32" y="33" textAnchor="middle" fill="#111827" fontSize="16" fontWeight="900" fontFamily="Barlow Condensed, sans-serif">
              BVB
            </text>
            <text x="32" y="47" textAnchor="middle" fill="#111827" fontSize="11" fontWeight="900" fontFamily="Barlow Condensed, sans-serif">
              09
            </text>
          </>
        );
      case 'psg_eiffel':
        return (
          <>
            <circle cx="32" cy="32" r="25" fill="#004170" stroke="#D4AF37" strokeWidth="3" />
            <circle cx="32" cy="32" r="18" fill="#004170" stroke="#FFFFFF" strokeWidth="1.5" />
            <path d="M32 16 L23 45 H28 L32 30 L36 45 H41 Z" fill="#DA291C" stroke="#FFFFFF" strokeWidth="1" />
            <text x="32" y="13" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="900">
              PARIS
            </text>
          </>
        );
      case 'flamengo_crf':
        return (
          <>
            <path d="M11 8 H53 V33 C53 47 43 55 32 59 C21 55 11 47 11 33 Z" fill="#111827" stroke="#D4AF37" strokeWidth="2.8" />
            <rect x="12" y="15" width="40" height="7" fill="#DC2626" />
            <rect x="12" y="29" width="40" height="7" fill="#DC2626" />
            <rect x="13" y="43" width="38" height="7" fill="#DC2626" />
            <rect x="11" y="8" width="18" height="18" fill="#DC2626" stroke="#FFFFFF" strokeWidth="1" />
            <text x="20" y="20" textAnchor="middle" fill="#FFFFFF" fontSize="9.5" fontWeight="900">
              CRF
            </text>
          </>
        );
      case 'palmeiras_p':
        return (
          <>
            <circle cx="32" cy="32" r="25" fill="#15803D" stroke="#FFFFFF" strokeWidth="3" />
            <circle cx="32" cy="32" r="18" fill="#15803D" stroke="#FFFFFF" strokeWidth="1.5" />
            <text x="32" y="38" textAnchor="middle" fill="#FFFFFF" fontSize="19" fontWeight="900" fontFamily="Barlow Condensed, sans-serif">
              P
            </text>
            <text x="32" y="53" textAnchor="middle" fill="#FFFFFF" fontSize="7" fontWeight="900">
              PALMEIRAS
            </text>
          </>
        );
      default: {
        // Multi-Silhouette Heraldic Generator for all remaining clubs (no generic repetition!)
        const h = hashCrestId(team.id);
        const silhouette = auth?.shieldType
          ? auth.shieldType
          : (['circular_ring', 'swiss_shield', 'oval_italian', 'royal_crown', 'diamond_crest', 'heater_quartered'][
              h % 6
            ] as string);
        const hasCrown = silhouette === 'royal_crown' || team.name.toLowerCase().includes('real ');
        const hasTitleStar = team.overall >= 81 || h % 3 === 0;
        const shapePath =
          silhouette === 'circular_ring'
            ? 'M 32,7 A 25,25 0 1,0 32,57 A 25,25 0 1,0 32,7 Z'
            : silhouette === 'oval_italian'
              ? 'M 32,6 C 45,6 52,17 52,32 C 52,47 45,58 32,58 C 19,58 12,47 12,32 C 12,17 19,6 32,6 Z'
              : silhouette === 'diamond_crest'
                ? 'M 32,7 L 56,32 L 32,57 L 8,32 Z'
                : silhouette === 'swiss_shield'
                  ? 'M 10,10 L 32,7 L 54,10 L 52,35 C 50,47 42,55 32,59 C 22,55 14,47 12,35 Z'
                  : 'M 11,11 H 53 V 33 C 53,47 43,55 32,59 C 21,55 11,47 11,33 Z';

        return (
          <>
            <defs>
              <clipPath id={uid}>
                <path d={shapePath} />
              </clipPath>
            </defs>
            {hasCrown && (
              <path d="M22 11 L26 5 L32 9 L38 5 L42 11 Z" fill="#D4AF37" stroke="#991B1B" strokeWidth="0.9" />
            )}
            <g clipPath={`url(#${uid})`}>
              <rect x="0" y="0" width="64" height="64" fill={p} />
              {team.kitPattern === 'stripes' ? (
                <>
                  <rect x="14" y="0" width="7" height="64" fill={s} />
                  <rect x="28" y="0" width="8" height="64" fill={s} />
                  <rect x="43" y="0" width="7" height="64" fill={s} />
                </>
              ) : team.kitPattern === 'hoops' ? (
                <>
                  <rect x="0" y="15" width="64" height="9" fill={s} />
                  <rect x="0" y="33" width="64" height="9" fill={s} />
                </>
              ) : team.kitPattern === 'sash' ? (
                <polygon points="8,54 50,8 58,14 16,60" fill={s} />
              ) : team.kitPattern === 'halves' || silhouette === 'heater_quartered' ? (
                <>
                  <rect x="32" y="0" width="32" height="32" fill={s} />
                  <rect x="0" y="32" width="32" height="32" fill={s} />
                </>
              ) : (
                <>
                  <polygon points="0,0 64,0 32,28" fill={s} opacity="0.35" />
                  <rect x="0" y="42" width="64" height="22" fill={s} opacity="0.85" />
                </>
              )}
              {silhouette === 'circular_ring' ? (
                <circle cx="32" cy="32" r="16.5" fill="rgba(11,17,23,0.82)" stroke={a} strokeWidth="2.2" />
              ) : (
                <rect x="11" y="23" width="42" height="16" rx="3" fill="rgba(11,17,23,0.84)" stroke={a} strokeWidth="1.6" />
              )}
            </g>
            <path d={shapePath} fill="none" stroke={a} strokeWidth="2.8" />
            {hasTitleStar && !hasCrown && renderFivePointStar(32, 13.5, 3.4, '#FACC15', '#78350F')}
            <text
              x="32"
              y="35"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="11.5"
              fontWeight="900"
              fontFamily="Barlow Condensed, sans-serif"
            >
              {monogram}
            </text>
          </>
        );
      }
    }
  };

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        className="shrink-0 select-none drop-shadow-sm"
        aria-label={`Escudo de ${team.name}`}
      >
        {renderAuthenticClubHeraldry()}
      </svg>
      {showBadgeStatus && (
        <span
          className={`absolute -bottom-1 -right-1 rounded px-1 py-0.2 text-[8px] font-bold uppercase ${
            team.crestStatus === 'official_imported'
              ? 'bg-emerald-600 text-white'
              : team.crestStatus === 'authentic_heraldry'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-slate-300 border border-slate-600'
          }`}
        >
          {team.crestStatus === 'official_imported'
            ? 'IMG'
            : team.crestStatus === 'authentic_heraldry'
              ? 'OFICIAL'
              : 'PEND'}
        </span>
      )}
    </div>
  );
};

export const IdentityRenderer = TeamCrest;
