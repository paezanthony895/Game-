import type { PlayerPosition } from '../types/football';

export type FormationCategory =
  | 'Línea de 4'
  | 'Línea de 3'
  | 'Línea de 5'
  | 'Históricas / Especiales';

export type FormationStyle =
  | 'Posesión'
  | 'Contragolpe'
  | 'Presión Alta'
  | 'Defensiva'
  | 'Equilibrada'
  | 'Ultra Ofensiva';

export type TacticalPositionCode =
  | 'POR'
  | 'DFC'
  | 'LD'
  | 'LI'
  | 'CAD'
  | 'CAI'
  | 'LIB'
  | 'MCD'
  | 'MC'
  | 'MD'
  | 'MI'
  | 'MCO'
  | 'SD'
  | 'ED'
  | 'EI'
  | 'F9'
  | 'DC';

export interface FormationPlayerCoord {
  /** Número de slot del 1 al 11 */
  numero_slot: number;
  /** Código táctico en español (POR, DFC, LD, LI, MCD, MC, MCO, ED, EI, DC, LIB, CAD, CAI, F9, SD, MD, MI) */
  posicion: TacticalPositionCode;
  /** Coordenada longitudinal normalizada de 0 (propia línea de meta) a 100 (línea de meta rival) */
  x: number;
  /** Coordenada transversal normalizada de 0 (banda superior/izquierda) a 100 (banda inferior/derecha) */
  y: number;
  /** Rol interno compatible con el motor de simulación 3D */
  role: PlayerPosition;
}

export interface FormationSlot {
  role: PlayerPosition;
  /** Normalized X across own half -> full pitch: 0.04 (GK) to 0.92 (ST) when attacking right */
  x: number;
  /** Normalized Y across pitch width: 0.08 (top touchline) to 0.92 (bottom touchline) */
  y: number;
}

export interface FormationDefinition {
  id: string;
  nombre: string;
  name: string;
  categoria: FormationCategory;
  estilo: FormationStyle;
  descripcion_tactica: string;
  description: string;
  jugadores: FormationPlayerCoord[];
  slots: FormationSlot[];
}

export const FORMATION_CATEGORIES: FormationCategory[] = [
  'Línea de 4',
  'Línea de 3',
  'Línea de 5',
  'Históricas / Especiales',
];

function mapPosicionToEngineRole(pos: TacticalPositionCode): PlayerPosition {
  switch (pos) {
    case 'POR':
      return 'GK';
    case 'DFC':
    case 'LIB':
      return 'CB';
    case 'LI':
    case 'CAI':
      return 'LB';
    case 'LD':
    case 'CAD':
      return 'RB';
    case 'MCD':
      return 'CDM';
    case 'MC':
    case 'MD':
    case 'MI':
      return 'CM';
    case 'MCO':
    case 'SD':
      return 'CAM';
    case 'EI':
      return 'LW';
    case 'ED':
      return 'RW';
    case 'DC':
    case 'F9':
      return 'ST';
  }
}

interface RawFormationSeed {
  id: string;
  nombre: string;
  categoria: FormationCategory;
  estilo: FormationStyle;
  descripcion_tactica: string;
  jugadores: Array<{
    numero_slot: number;
    posicion: TacticalPositionCode;
    x: number;
    y: number;
  }>;
}

function buildFormation(seed: RawFormationSeed): FormationDefinition {
  const jugadores: FormationPlayerCoord[] = seed.jugadores.map((j, idx) => {
    const role = mapPosicionToEngineRole(j.posicion);
    return {
      numero_slot: j.numero_slot ?? idx + 1,
      posicion: j.posicion,
      x: Math.max(2, Math.min(96, j.x)),
      y: Math.max(5, Math.min(95, j.y)),
      role,
    };
  });

  const slots: FormationSlot[] = jugadores.map((j) => ({
    role: j.role,
    x: Number((j.x / 100).toFixed(4)),
    y: Number((j.y / 100).toFixed(4)),
  }));

  return {
    id: seed.id,
    nombre: seed.nombre,
    name: seed.nombre,
    categoria: seed.categoria,
    estilo: seed.estilo,
    descripcion_tactica: seed.descripcion_tactica,
    description: seed.descripcion_tactica,
    jugadores,
    slots,
  };
}

const RAW_FORMATIONS: RawFormationSeed[] = [
  // ============================================================================
  // 1. CON LÍNEA DE 4 DEFENSORES (Clásicas y Modernas)
  // ============================================================================
  {
    id: '4-3-3',
    nombre: '4-3-3 (Contención / Pivote único)',
    categoria: 'Línea de 4',
    estilo: 'Equilibrada',
    descripcion_tactica:
      'Fortalezas: Un MCD ancla protege a los centrales y libera a dos interiores (MC) para asociarse con los extremos abiertos. Debilidades: Si el pivote único es superado en transición, la defensa queda expuesta.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'LI', x: 22, y: 14 },
      { numero_slot: 3, posicion: 'DFC', x: 18, y: 37 },
      { numero_slot: 4, posicion: 'DFC', x: 18, y: 63 },
      { numero_slot: 5, posicion: 'LD', x: 22, y: 86 },
      { numero_slot: 6, posicion: 'MCD', x: 35, y: 50 },
      { numero_slot: 7, posicion: 'MC', x: 47, y: 30 },
      { numero_slot: 8, posicion: 'MC', x: 47, y: 70 },
      { numero_slot: 9, posicion: 'EI', x: 71, y: 16 },
      { numero_slot: 10, posicion: 'DC', x: 78, y: 50 },
      { numero_slot: 11, posicion: 'ED', x: 71, y: 84 },
    ],
  },
  {
    id: '4-3-3-ofensiva',
    nombre: '4-3-3 (Ofensiva / Con Enganche MCO)',
    categoria: 'Línea de 4',
    estilo: 'Presión Alta',
    descripcion_tactica:
      'Fortalezas: Triángulo invertido en mediocampo con un MCO detrás del 9 para filtrar pases letales entre líneas. Debilidades: Menor cobertura frente a la línea defensiva ante contragolpes por el carril central.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'LI', x: 23, y: 14 },
      { numero_slot: 3, posicion: 'DFC', x: 18, y: 37 },
      { numero_slot: 4, posicion: 'DFC', x: 18, y: 63 },
      { numero_slot: 5, posicion: 'LD', x: 23, y: 86 },
      { numero_slot: 6, posicion: 'MC', x: 41, y: 34 },
      { numero_slot: 7, posicion: 'MC', x: 41, y: 66 },
      { numero_slot: 8, posicion: 'MCO', x: 57, y: 50 },
      { numero_slot: 9, posicion: 'EI', x: 73, y: 17 },
      { numero_slot: 10, posicion: 'DC', x: 80, y: 50 },
      { numero_slot: 11, posicion: 'ED', x: 73, y: 83 },
    ],
  },
  {
    id: '4-3-3-falso-9',
    nombre: '4-3-3 (Falso 9)',
    categoria: 'Línea de 4',
    estilo: 'Posesión',
    descripcion_tactica:
      'Fortalezas: El Falso 9 (F9) retrocede al mediocampo para generar superioridad 4v3 y arrastrar centrales, abriendo diagonales para EI y ED. Debilidades: Falta de referencia fija en el área para centros laterales.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'LI', x: 24, y: 14 },
      { numero_slot: 3, posicion: 'DFC', x: 19, y: 37 },
      { numero_slot: 4, posicion: 'DFC', x: 19, y: 63 },
      { numero_slot: 5, posicion: 'LD', x: 24, y: 86 },
      { numero_slot: 6, posicion: 'MCD', x: 36, y: 50 },
      { numero_slot: 7, posicion: 'MC', x: 49, y: 31 },
      { numero_slot: 8, posicion: 'MC', x: 49, y: 69 },
      { numero_slot: 9, posicion: 'EI', x: 75, y: 20 },
      { numero_slot: 10, posicion: 'F9', x: 64, y: 50 },
      { numero_slot: 11, posicion: 'ED', x: 75, y: 80 },
    ],
  },
  {
    id: '4-4-2',
    nombre: '4-4-2 (Clásica / Plana)',
    categoria: 'Línea de 4',
    estilo: 'Equilibrada',
    descripcion_tactica:
      'Fortalezas: Dos líneas de cuatro compactas que cubren todo el ancho del campo y dos delanteros (DC) que se complementan en el área. Debilidades: Puede sufrir inferioridad 2v3 en el círculo central ante sistemas con tres volantes.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'LI', x: 21, y: 15 },
      { numero_slot: 3, posicion: 'DFC', x: 18, y: 38 },
      { numero_slot: 4, posicion: 'DFC', x: 18, y: 62 },
      { numero_slot: 5, posicion: 'LD', x: 21, y: 85 },
      { numero_slot: 6, posicion: 'MI', x: 45, y: 15 },
      { numero_slot: 7, posicion: 'MC', x: 42, y: 38 },
      { numero_slot: 8, posicion: 'MC', x: 42, y: 62 },
      { numero_slot: 9, posicion: 'MD', x: 45, y: 85 },
      { numero_slot: 10, posicion: 'DC', x: 74, y: 38 },
      { numero_slot: 11, posicion: 'DC', x: 74, y: 62 },
    ],
  },
  {
    id: '4-4-2-rombo',
    nombre: '4-4-2 (Rombo / Diamante estrecho)',
    categoria: 'Línea de 4',
    estilo: 'Posesión',
    descripcion_tactica:
      'Fortalezas: Dominio absoluto del carril interior con MCD, dos MC y un MCO conectando con la dupla de ataque. Debilidades: Exige laterales de gran recorrido físico para cubrir las bandas desprotegidas.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'LI', x: 23, y: 14 },
      { numero_slot: 3, posicion: 'DFC', x: 18, y: 38 },
      { numero_slot: 4, posicion: 'DFC', x: 18, y: 62 },
      { numero_slot: 5, posicion: 'LD', x: 23, y: 86 },
      { numero_slot: 6, posicion: 'MCD', x: 34, y: 50 },
      { numero_slot: 7, posicion: 'MC', x: 47, y: 31 },
      { numero_slot: 8, posicion: 'MC', x: 47, y: 69 },
      { numero_slot: 9, posicion: 'MCO', x: 60, y: 50 },
      { numero_slot: 10, posicion: 'DC', x: 76, y: 38 },
      { numero_slot: 11, posicion: 'DC', x: 76, y: 62 },
    ],
  },
  {
    id: '4-2-3-1',
    nombre: '4-2-3-1 (Estándar / Con extremos)',
    categoria: 'Línea de 4',
    estilo: 'Equilibrada',
    descripcion_tactica:
      'Fortalezas: El esquema moderno más versátil; doble pivote (MCD) que aporta equilibrio y tres mediapuntas/extremos abasteciendo al 9. Debilidades: El DC puede quedar aislado si los extremos tardan en replegar o subir.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'LI', x: 21, y: 15 },
      { numero_slot: 3, posicion: 'DFC', x: 18, y: 38 },
      { numero_slot: 4, posicion: 'DFC', x: 18, y: 62 },
      { numero_slot: 5, posicion: 'LD', x: 21, y: 85 },
      { numero_slot: 6, posicion: 'MCD', x: 36, y: 37 },
      { numero_slot: 7, posicion: 'MCD', x: 36, y: 63 },
      { numero_slot: 8, posicion: 'EI', x: 58, y: 17 },
      { numero_slot: 9, posicion: 'MCO', x: 57, y: 50 },
      { numero_slot: 10, posicion: 'ED', x: 58, y: 83 },
      { numero_slot: 11, posicion: 'DC', x: 77, y: 50 },
    ],
  },
  {
    id: '4-2-3-1-estrecha',
    nombre: '4-2-3-1 (Estrecha / Con 3 mediapuntas)',
    categoria: 'Línea de 4',
    estilo: 'Posesión',
    descripcion_tactica:
      'Fortalezas: Tres enganches (MCO) entre líneas crean paredes rápidas y sobrecargan la frontal del área rival. Debilidades: Poca amplitud natural si los laterales (LI/LD) no se proyectan simultáneamente.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'LI', x: 24, y: 13 },
      { numero_slot: 3, posicion: 'DFC', x: 18, y: 38 },
      { numero_slot: 4, posicion: 'DFC', x: 18, y: 62 },
      { numero_slot: 5, posicion: 'LD', x: 24, y: 87 },
      { numero_slot: 6, posicion: 'MCD', x: 36, y: 38 },
      { numero_slot: 7, posicion: 'MCD', x: 36, y: 62 },
      { numero_slot: 8, posicion: 'MCO', x: 58, y: 29 },
      { numero_slot: 9, posicion: 'MCO', x: 56, y: 50 },
      { numero_slot: 10, posicion: 'MCO', x: 58, y: 71 },
      { numero_slot: 11, posicion: 'DC', x: 77, y: 50 },
    ],
  },
  {
    id: '4-1-4-1',
    nombre: '4-1-4-1 (Equilibrada)',
    categoria: 'Línea de 4',
    estilo: 'Equilibrada',
    descripcion_tactica:
      'Fortalezas: Un MCD barre detrás de una línea de cuatro volantes que cierra espacios y lanza ataques por bandas e interiores. Debilidades: Distancia amplia entre la línea de volantes y el único delantero centro.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'LI', x: 21, y: 15 },
      { numero_slot: 3, posicion: 'DFC', x: 18, y: 38 },
      { numero_slot: 4, posicion: 'DFC', x: 18, y: 62 },
      { numero_slot: 5, posicion: 'LD', x: 21, y: 85 },
      { numero_slot: 6, posicion: 'MCD', x: 33, y: 50 },
      { numero_slot: 7, posicion: 'MI', x: 52, y: 15 },
      { numero_slot: 8, posicion: 'MC', x: 49, y: 38 },
      { numero_slot: 9, posicion: 'MC', x: 49, y: 62 },
      { numero_slot: 10, posicion: 'MD', x: 52, y: 85 },
      { numero_slot: 11, posicion: 'DC', x: 76, y: 50 },
    ],
  },
  {
    id: '4-3-2-1',
    nombre: '4-3-2-1 ("Árbol de Navidad")',
    categoria: 'Línea de 4',
    estilo: 'Posesión',
    descripcion_tactica:
      'Fortalezas: Estructura piramidal con tres mediocentros de contención/creación y dos mediapuntas (MCO) detrás del 9, ideal para control interior. Debilidades: Dependencia total de los laterales para abrir la cancha.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'LI', x: 23, y: 13 },
      { numero_slot: 3, posicion: 'DFC', x: 18, y: 38 },
      { numero_slot: 4, posicion: 'DFC', x: 18, y: 62 },
      { numero_slot: 5, posicion: 'LD', x: 23, y: 87 },
      { numero_slot: 6, posicion: 'MC', x: 40, y: 30 },
      { numero_slot: 7, posicion: 'MCD', x: 38, y: 50 },
      { numero_slot: 8, posicion: 'MC', x: 40, y: 70 },
      { numero_slot: 9, posicion: 'MCO', x: 60, y: 36 },
      { numero_slot: 10, posicion: 'MCO', x: 60, y: 64 },
      { numero_slot: 11, posicion: 'DC', x: 78, y: 50 },
    ],
  },
  {
    id: '4-2-2-2',
    nombre: '4-2-2-2 (Cuadrado mágico / Estilo brasileño)',
    categoria: 'Línea de 4',
    estilo: 'Presión Alta',
    descripcion_tactica:
      'Fortalezas: El famoso "Cuadrado Mágico" en el medio (2 MCD + 2 MCO) combinado con dos delanteros móviles genera ataques vertiginosos. Debilidades: Requiere coordinación milimétrica para cubrir las bandas en fase defensiva.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'LI', x: 22, y: 14 },
      { numero_slot: 3, posicion: 'DFC', x: 18, y: 38 },
      { numero_slot: 4, posicion: 'DFC', x: 18, y: 62 },
      { numero_slot: 5, posicion: 'LD', x: 22, y: 86 },
      { numero_slot: 6, posicion: 'MCD', x: 38, y: 36 },
      { numero_slot: 7, posicion: 'MCD', x: 38, y: 64 },
      { numero_slot: 8, posicion: 'MCO', x: 58, y: 26 },
      { numero_slot: 9, posicion: 'MCO', x: 58, y: 74 },
      { numero_slot: 10, posicion: 'DC', x: 76, y: 37 },
      { numero_slot: 11, posicion: 'DC', x: 76, y: 63 },
    ],
  },
  {
    id: '4-2-4',
    nombre: '4-2-4 (Ultra ofensiva)',
    categoria: 'Línea de 4',
    estilo: 'Ultra Ofensiva',
    descripcion_tactica:
      'Fortalezas: Cuatro atacantes netos (EI, dos DC y ED) que fijan a toda la defensa rival y buscan goles rápidos en remontadas. Debilidades: Solo dos mediocentros deben sostener un enorme vacío en la mitad de la cancha.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'LI', x: 22, y: 15 },
      { numero_slot: 3, posicion: 'DFC', x: 18, y: 38 },
      { numero_slot: 4, posicion: 'DFC', x: 18, y: 62 },
      { numero_slot: 5, posicion: 'LD', x: 22, y: 85 },
      { numero_slot: 6, posicion: 'MC', x: 43, y: 38 },
      { numero_slot: 7, posicion: 'MC', x: 43, y: 62 },
      { numero_slot: 8, posicion: 'EI', x: 72, y: 15 },
      { numero_slot: 9, posicion: 'DC', x: 78, y: 39 },
      { numero_slot: 10, posicion: 'DC', x: 78, y: 61 },
      { numero_slot: 11, posicion: 'ED', x: 72, y: 85 },
    ],
  },
  {
    id: '4-5-1',
    nombre: '4-5-1 (Plana / Defensiva)',
    categoria: 'Línea de 4',
    estilo: 'Defensiva',
    descripcion_tactica:
      'Fortalezas: Bloque medio-bajo casi impenetrable con cinco volantes alineados que asfixian las líneas de pase rivales. Debilidades: El único delantero centro queda muy lejos del arco rival y depende de contragolpes largos.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'LI', x: 20, y: 15 },
      { numero_slot: 3, posicion: 'DFC', x: 17, y: 38 },
      { numero_slot: 4, posicion: 'DFC', x: 17, y: 62 },
      { numero_slot: 5, posicion: 'LD', x: 20, y: 85 },
      { numero_slot: 6, posicion: 'MI', x: 42, y: 13 },
      { numero_slot: 7, posicion: 'MC', x: 40, y: 32 },
      { numero_slot: 8, posicion: 'MCD', x: 38, y: 50 },
      { numero_slot: 9, posicion: 'MC', x: 40, y: 68 },
      { numero_slot: 10, posicion: 'MD', x: 42, y: 87 },
      { numero_slot: 11, posicion: 'DC', x: 72, y: 50 },
    ],
  },
  {
    id: '4-1-2-1-2-abierta',
    nombre: '4-1-2-1-2 (Abierta / Con volantes externos)',
    categoria: 'Línea de 4',
    estilo: 'Contragolpe',
    descripcion_tactica:
      'Fortalezas: Rombo amplio con MI y MD pegados a la banda, un MCO creativo y doble punta para transiciones veloces. Debilidades: El MCD único tiene que cubrir mucho terreno horizontal entre ambos costados.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'LI', x: 21, y: 15 },
      { numero_slot: 3, posicion: 'DFC', x: 18, y: 38 },
      { numero_slot: 4, posicion: 'DFC', x: 18, y: 62 },
      { numero_slot: 5, posicion: 'LD', x: 21, y: 85 },
      { numero_slot: 6, posicion: 'MCD', x: 34, y: 50 },
      { numero_slot: 7, posicion: 'MI', x: 49, y: 16 },
      { numero_slot: 8, posicion: 'MD', x: 49, y: 84 },
      { numero_slot: 9, posicion: 'MCO', x: 61, y: 50 },
      { numero_slot: 10, posicion: 'DC', x: 77, y: 37 },
      { numero_slot: 11, posicion: 'DC', x: 77, y: 63 },
    ],
  },
  {
    id: '4-1-2-1-2-cerrada',
    nombre: '4-1-2-1-2 (Cerrada / Diamante compacto)',
    categoria: 'Línea de 4',
    estilo: 'Posesión',
    descripcion_tactica:
      'Fortalezas: Triangulación rapidísima a un toque por el eje central gracias a la cercanía entre MCD, interiores, MCO y los dos DC. Debilidades: Vulnerable a cambios de orientación rápidos hacia los extremos rivales.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'LI', x: 24, y: 14 },
      { numero_slot: 3, posicion: 'DFC', x: 18, y: 38 },
      { numero_slot: 4, posicion: 'DFC', x: 18, y: 62 },
      { numero_slot: 5, posicion: 'LD', x: 24, y: 86 },
      { numero_slot: 6, posicion: 'MCD', x: 34, y: 50 },
      { numero_slot: 7, posicion: 'MC', x: 48, y: 34 },
      { numero_slot: 8, posicion: 'MC', x: 48, y: 66 },
      { numero_slot: 9, posicion: 'MCO', x: 62, y: 50 },
      { numero_slot: 10, posicion: 'DC', x: 77, y: 40 },
      { numero_slot: 11, posicion: 'DC', x: 77, y: 60 },
    ],
  },
  {
    id: '4-1-3-2',
    nombre: '4-1-3-2 (Ofensiva)',
    categoria: 'Línea de 4',
    estilo: 'Presión Alta',
    descripcion_tactica:
      'Fortalezas: Cinco futbolistas volcados al ataque (MI, MCO, MD y dos DC) respaldados por un pivote defensivo. Debilidades: Si se pierde la pelota en salida, el MCD queda en inferioridad ante contragolpes.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'LI', x: 22, y: 15 },
      { numero_slot: 3, posicion: 'DFC', x: 18, y: 38 },
      { numero_slot: 4, posicion: 'DFC', x: 18, y: 62 },
      { numero_slot: 5, posicion: 'LD', x: 22, y: 85 },
      { numero_slot: 6, posicion: 'MCD', x: 35, y: 50 },
      { numero_slot: 7, posicion: 'MI', x: 55, y: 18 },
      { numero_slot: 8, posicion: 'MCO', x: 56, y: 50 },
      { numero_slot: 9, posicion: 'MD', x: 55, y: 82 },
      { numero_slot: 10, posicion: 'DC', x: 77, y: 38 },
      { numero_slot: 11, posicion: 'DC', x: 77, y: 62 },
    ],
  },
  {
    id: '4-6-0',
    nombre: '4-6-0 (Sin delantero centro / Falso 9 doble)',
    categoria: 'Línea de 4',
    estilo: 'Posesión',
    descripcion_tactica:
      'Fortalezas: Seis centrocampistas/mediapuntas móviles que desorientan a los centrales rivales sin darles referencia de marca y llegan por sorpresa. Debilidades: Carece de rematador nato de área ante defensas cerradas.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'LI', x: 23, y: 14 },
      { numero_slot: 3, posicion: 'DFC', x: 18, y: 38 },
      { numero_slot: 4, posicion: 'DFC', x: 18, y: 62 },
      { numero_slot: 5, posicion: 'LD', x: 23, y: 86 },
      { numero_slot: 6, posicion: 'MCD', x: 36, y: 39 },
      { numero_slot: 7, posicion: 'MCD', x: 36, y: 61 },
      { numero_slot: 8, posicion: 'EI', x: 60, y: 16 },
      { numero_slot: 9, posicion: 'F9', x: 64, y: 40 },
      { numero_slot: 10, posicion: 'F9', x: 64, y: 60 },
      { numero_slot: 11, posicion: 'ED', x: 60, y: 84 },
    ],
  },

  // ============================================================================
  // 2. CON LÍNEA DE 3 DEFENSORES (Posesión y Presión)
  // ============================================================================
  {
    id: '3-5-2',
    nombre: '3-5-2 (Clásica)',
    categoria: 'Línea de 3',
    estilo: 'Equilibrada',
    descripcion_tactica:
      'Fortalezas: Tres centrales sólidos, dos carrileros (CAI/CAD) que hacen toda la banda y superioridad en el medio con tres volantes y dos puntas. Debilidades: Espacios a la espalda de los carrileros si pierden el balón arriba.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'DFC', x: 18, y: 25 },
      { numero_slot: 3, posicion: 'DFC', x: 16, y: 50 },
      { numero_slot: 4, posicion: 'DFC', x: 18, y: 75 },
      { numero_slot: 5, posicion: 'CAI', x: 46, y: 12 },
      { numero_slot: 6, posicion: 'MCD', x: 36, y: 50 },
      { numero_slot: 7, posicion: 'MC', x: 48, y: 34 },
      { numero_slot: 8, posicion: 'MC', x: 48, y: 66 },
      { numero_slot: 9, posicion: 'CAD', x: 46, y: 88 },
      { numero_slot: 10, posicion: 'DC', x: 75, y: 38 },
      { numero_slot: 11, posicion: 'DC', x: 75, y: 62 },
    ],
  },
  {
    id: '3-4-3',
    nombre: '3-4-3 (Plana)',
    categoria: 'Línea de 3',
    estilo: 'Presión Alta',
    descripcion_tactica:
      'Fortalezas: Amplitud ofensiva máxima con carrileros y extremos doblando por banda y presión alta asfixiante. Debilidades: El doble pivote central puede verse superado por equipos con tres mediocampistas interiores.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'DFC', x: 18, y: 25 },
      { numero_slot: 3, posicion: 'DFC', x: 16, y: 50 },
      { numero_slot: 4, posicion: 'DFC', x: 18, y: 75 },
      { numero_slot: 5, posicion: 'CAI', x: 45, y: 13 },
      { numero_slot: 6, posicion: 'MC', x: 42, y: 38 },
      { numero_slot: 7, posicion: 'MC', x: 42, y: 62 },
      { numero_slot: 8, posicion: 'CAD', x: 45, y: 87 },
      { numero_slot: 9, posicion: 'EI', x: 72, y: 18 },
      { numero_slot: 10, posicion: 'DC', x: 78, y: 50 },
      { numero_slot: 11, posicion: 'ED', x: 72, y: 82 },
    ],
  },
  {
    id: '3-4-3-rombo',
    nombre: '3-4-3 (Rombo en el medio - estilo Cruyff)',
    categoria: 'Línea de 3',
    estilo: 'Posesión',
    descripcion_tactica:
      'Fortalezas: Inspirada en el Dream Team de Cruyff; el rombo interior (MCD, dos MC y MCO) genera líneas de pase constantes hacia los tres delanteros. Debilidades: Riesgo altísimo en defensa si la presión tras pérdida falla.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'DFC', x: 19, y: 25 },
      { numero_slot: 3, posicion: 'DFC', x: 17, y: 50 },
      { numero_slot: 4, posicion: 'DFC', x: 19, y: 75 },
      { numero_slot: 5, posicion: 'MCD', x: 34, y: 50 },
      { numero_slot: 6, posicion: 'MC', x: 47, y: 28 },
      { numero_slot: 7, posicion: 'MC', x: 47, y: 72 },
      { numero_slot: 8, posicion: 'MCO', x: 60, y: 50 },
      { numero_slot: 9, posicion: 'EI', x: 74, y: 15 },
      { numero_slot: 10, posicion: 'DC', x: 80, y: 50 },
      { numero_slot: 11, posicion: 'ED', x: 74, y: 85 },
    ],
  },
  {
    id: '3-4-1-2',
    nombre: '3-4-1-2 (Con enganche)',
    categoria: 'Línea de 3',
    estilo: 'Posesión',
    descripcion_tactica:
      'Fortalezas: Un enganche puro (MCO) libre detrás de dos delanteros centro con respaldo de doble pivote y carrileros. Debilidades: Si los carrileros no retroceden a tiempo, los centrales quedan en 1v1 en las bandas.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'DFC', x: 18, y: 25 },
      { numero_slot: 3, posicion: 'DFC', x: 16, y: 50 },
      { numero_slot: 4, posicion: 'DFC', x: 18, y: 75 },
      { numero_slot: 5, posicion: 'CAI', x: 45, y: 13 },
      { numero_slot: 6, posicion: 'MCD', x: 39, y: 38 },
      { numero_slot: 7, posicion: 'MCD', x: 39, y: 62 },
      { numero_slot: 8, posicion: 'CAD', x: 45, y: 87 },
      { numero_slot: 9, posicion: 'MCO', x: 60, y: 50 },
      { numero_slot: 10, posicion: 'DC', x: 77, y: 38 },
      { numero_slot: 11, posicion: 'DC', x: 77, y: 62 },
    ],
  },
  {
    id: '3-4-2-1',
    nombre: '3-4-2-1 (Doble mediapunta)',
    categoria: 'Línea de 3',
    estilo: 'Presión Alta',
    descripcion_tactica:
      'Fortalezas: Dos mediapuntas interiores (MCO) ocupan los medios espacios ("half-spaces") mientras los carrileros dan toda la amplitud. Debilidades: Requiere centrales veloces para cubrir la espalda de los carrileros.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'DFC', x: 18, y: 25 },
      { numero_slot: 3, posicion: 'DFC', x: 16, y: 50 },
      { numero_slot: 4, posicion: 'DFC', x: 18, y: 75 },
      { numero_slot: 5, posicion: 'CAI', x: 47, y: 12 },
      { numero_slot: 6, posicion: 'MCD', x: 39, y: 39 },
      { numero_slot: 7, posicion: 'MCD', x: 39, y: 61 },
      { numero_slot: 8, posicion: 'CAD', x: 47, y: 88 },
      { numero_slot: 9, posicion: 'MCO', x: 63, y: 34 },
      { numero_slot: 10, posicion: 'MCO', x: 63, y: 66 },
      { numero_slot: 11, posicion: 'DC', x: 79, y: 50 },
    ],
  },
  {
    id: '3-1-4-2',
    nombre: '3-1-4-2 (Pivote único)',
    categoria: 'Línea de 3',
    estilo: 'Posesión',
    descripcion_tactica:
      'Fortalezas: Un MCD organizador conecta la salida de tres centrales con dos interiores ofensivos, dos carrileros y dos delanteros. Debilidades: El pivote único sufre si el rival juega con doble enganche.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'DFC', x: 18, y: 25 },
      { numero_slot: 3, posicion: 'DFC', x: 16, y: 50 },
      { numero_slot: 4, posicion: 'DFC', x: 18, y: 75 },
      { numero_slot: 5, posicion: 'MCD', x: 33, y: 50 },
      { numero_slot: 6, posicion: 'CAI', x: 50, y: 12 },
      { numero_slot: 7, posicion: 'MC', x: 51, y: 36 },
      { numero_slot: 8, posicion: 'MC', x: 51, y: 64 },
      { numero_slot: 9, posicion: 'CAD', x: 50, y: 88 },
      { numero_slot: 10, posicion: 'DC', x: 76, y: 38 },
      { numero_slot: 11, posicion: 'DC', x: 76, y: 62 },
    ],
  },
  {
    id: '3-3-1-3',
    nombre: '3-3-1-3 (Estilo Bielsa)',
    categoria: 'Línea de 3',
    estilo: 'Presión Alta',
    descripcion_tactica:
      'Fortalezas: Sello de Marcelo Bielsa; presión hombre a hombre en todo el campo, enganche conductor y tridente de ataque vertical. Debilidades: Desgaste físico extremo y duelos directos 3v3 en la última línea.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'DFC', x: 19, y: 25 },
      { numero_slot: 3, posicion: 'DFC', x: 17, y: 50 },
      { numero_slot: 4, posicion: 'DFC', x: 19, y: 75 },
      { numero_slot: 5, posicion: 'CAI', x: 42, y: 16 },
      { numero_slot: 6, posicion: 'MCD', x: 39, y: 50 },
      { numero_slot: 7, posicion: 'CAD', x: 42, y: 84 },
      { numero_slot: 8, posicion: 'MCO', x: 58, y: 50 },
      { numero_slot: 9, posicion: 'EI', x: 75, y: 15 },
      { numero_slot: 10, posicion: 'DC', x: 80, y: 50 },
      { numero_slot: 11, posicion: 'ED', x: 75, y: 85 },
    ],
  },
  {
    id: '3-3-4',
    nombre: '3-3-4 (Ultra ofensiva)',
    categoria: 'Línea de 3',
    estilo: 'Ultra Ofensiva',
    descripcion_tactica:
      'Fortalezas: Asedio total con cuatro delanteros (dos extremos y dos puntas) para romper defensas cerradas en los minutos finales. Debilidades: Altísima fragilidad defensiva en las bandas y en transición.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'DFC', x: 18, y: 25 },
      { numero_slot: 3, posicion: 'DFC', x: 16, y: 50 },
      { numero_slot: 4, posicion: 'DFC', x: 18, y: 75 },
      { numero_slot: 5, posicion: 'MC', x: 43, y: 27 },
      { numero_slot: 6, posicion: 'MCD', x: 38, y: 50 },
      { numero_slot: 7, posicion: 'MC', x: 43, y: 73 },
      { numero_slot: 8, posicion: 'EI', x: 73, y: 14 },
      { numero_slot: 9, posicion: 'DC', x: 79, y: 38 },
      { numero_slot: 10, posicion: 'DC', x: 79, y: 62 },
      { numero_slot: 11, posicion: 'ED', x: 73, y: 86 },
    ],
  },
  {
    id: '3-2-4-1',
    nombre: '3-2-4-1 (Caja en el mediocampo - estilo Guardiola moderno)',
    categoria: 'Línea de 3',
    estilo: 'Posesión',
    descripcion_tactica:
      'Fortalezas: Cuadrado en el mediocampo (2 MCD + 2 MCO) que garantiza superioridad posicional, con extremos bien abiertos fijando laterales y un 9 letal. Debilidades: Exige defensores centrales rapidísimos para defender a campo abierto.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'DFC', x: 19, y: 26 },
      { numero_slot: 3, posicion: 'DFC', x: 17, y: 50 },
      { numero_slot: 4, posicion: 'DFC', x: 19, y: 74 },
      { numero_slot: 5, posicion: 'MCD', x: 36, y: 39 },
      { numero_slot: 6, posicion: 'MCD', x: 36, y: 61 },
      { numero_slot: 7, posicion: 'EI', x: 62, y: 12 },
      { numero_slot: 8, posicion: 'MCO', x: 58, y: 37 },
      { numero_slot: 9, posicion: 'MCO', x: 58, y: 63 },
      { numero_slot: 10, posicion: 'ED', x: 62, y: 88 },
      { numero_slot: 11, posicion: 'DC', x: 80, y: 50 },
    ],
  },

  // ============================================================================
  // 3. CON LÍNEA DE 5 DEFENSORES (Carrileros y Bloque Bajo)
  // ============================================================================
  {
    id: '5-3-2',
    nombre: '5-3-2 (Contragolpe)',
    categoria: 'Línea de 5',
    estilo: 'Contragolpe',
    descripcion_tactica:
      'Fortalezas: Cinco defensores cierran todos los pasillos interiores hacia el área y lanzan pases directos a la dupla de delanteros. Debilidades: Cede la iniciativa y la posesión en tres cuartos de cancha.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'CAI', x: 23, y: 12 },
      { numero_slot: 3, posicion: 'DFC', x: 17, y: 32 },
      { numero_slot: 4, posicion: 'DFC', x: 15, y: 50 },
      { numero_slot: 5, posicion: 'DFC', x: 17, y: 68 },
      { numero_slot: 6, posicion: 'CAD', x: 23, y: 88 },
      { numero_slot: 7, posicion: 'MC', x: 41, y: 31 },
      { numero_slot: 8, posicion: 'MCD', x: 36, y: 50 },
      { numero_slot: 9, posicion: 'MC', x: 41, y: 69 },
      { numero_slot: 10, posicion: 'DC', x: 72, y: 38 },
      { numero_slot: 11, posicion: 'DC', x: 72, y: 62 },
    ],
  },
  {
    id: '5-4-1-plana',
    nombre: '5-4-1 (Plana / Ultradefensiva)',
    categoria: 'Línea de 5',
    estilo: 'Defensiva',
    descripcion_tactica:
      'Fortalezas: Doble muralla de 5 y 4 jugadores delante del arquero, ideal para proteger ventajas mínimas ante rivales superiores. Debilidades: Producción ofensiva muy reducida con un solo atacante aislado.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'LI', x: 20, y: 12 },
      { numero_slot: 3, posicion: 'DFC', x: 16, y: 32 },
      { numero_slot: 4, posicion: 'DFC', x: 15, y: 50 },
      { numero_slot: 5, posicion: 'DFC', x: 16, y: 68 },
      { numero_slot: 6, posicion: 'LD', x: 20, y: 88 },
      { numero_slot: 7, posicion: 'MI', x: 40, y: 15 },
      { numero_slot: 8, posicion: 'MC', x: 38, y: 38 },
      { numero_slot: 9, posicion: 'MC', x: 38, y: 62 },
      { numero_slot: 10, posicion: 'MD', x: 40, y: 85 },
      { numero_slot: 11, posicion: 'DC', x: 71, y: 50 },
    ],
  },
  {
    id: '5-4-1-diamante',
    nombre: '5-4-1 (Diamante)',
    categoria: 'Línea de 5',
    estilo: 'Contragolpe',
    descripcion_tactica:
      'Fortalezas: Combina la seguridad de 5 defensores con un rombo en el medio que permite salir jugando por dentro con un MCO detrás del 9. Debilidades: Los carrileros deben recorrer 70 metros para dar amplitud en ataque.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'CAI', x: 23, y: 12 },
      { numero_slot: 3, posicion: 'DFC', x: 16, y: 32 },
      { numero_slot: 4, posicion: 'DFC', x: 15, y: 50 },
      { numero_slot: 5, posicion: 'DFC', x: 16, y: 68 },
      { numero_slot: 6, posicion: 'CAD', x: 23, y: 88 },
      { numero_slot: 7, posicion: 'MCD', x: 33, y: 50 },
      { numero_slot: 8, posicion: 'MC', x: 45, y: 32 },
      { numero_slot: 9, posicion: 'MC', x: 45, y: 68 },
      { numero_slot: 10, posicion: 'MCO', x: 58, y: 50 },
      { numero_slot: 11, posicion: 'DC', x: 75, y: 50 },
    ],
  },
  {
    id: '5-2-3',
    nombre: '5-2-3 (Con extremos rápidos)',
    categoria: 'Línea de 5',
    estilo: 'Contragolpe',
    descripcion_tactica:
      'Fortalezas: Recuperación en bloque bajo y lanzamiento inmediato hacia dos extremos explosivos (EI/ED) y un delantero centro. Debilidades: Solo dos mediocentros puros para contener el juego interior rival.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'CAI', x: 25, y: 12 },
      { numero_slot: 3, posicion: 'DFC', x: 17, y: 32 },
      { numero_slot: 4, posicion: 'DFC', x: 15, y: 50 },
      { numero_slot: 5, posicion: 'DFC', x: 17, y: 68 },
      { numero_slot: 6, posicion: 'CAD', x: 25, y: 88 },
      { numero_slot: 7, posicion: 'MC', x: 41, y: 38 },
      { numero_slot: 8, posicion: 'MC', x: 41, y: 62 },
      { numero_slot: 9, posicion: 'EI', x: 69, y: 18 },
      { numero_slot: 10, posicion: 'DC', x: 76, y: 50 },
      { numero_slot: 11, posicion: 'ED', x: 69, y: 82 },
    ],
  },
  {
    id: '5-2-1-2',
    nombre: '5-2-1-2 (Con enganche y carrileros)',
    categoria: 'Línea de 5',
    estilo: 'Equilibrada',
    descripcion_tactica:
      'Fortalezas: Tres centrales y doble pivote aseguran el cerrojo central mientras un MCO enlaza con dos puntas y carrileros profundos. Debilidades: Si el rival bloquea al MCO, la transición ofensiva pierde fluidez.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'CAI', x: 26, y: 12 },
      { numero_slot: 3, posicion: 'DFC', x: 17, y: 32 },
      { numero_slot: 4, posicion: 'DFC', x: 15, y: 50 },
      { numero_slot: 5, posicion: 'DFC', x: 17, y: 68 },
      { numero_slot: 6, posicion: 'CAD', x: 26, y: 88 },
      { numero_slot: 7, posicion: 'MCD', x: 38, y: 38 },
      { numero_slot: 8, posicion: 'MCD', x: 38, y: 62 },
      { numero_slot: 9, posicion: 'MCO', x: 57, y: 50 },
      { numero_slot: 10, posicion: 'DC', x: 75, y: 38 },
      { numero_slot: 11, posicion: 'DC', x: 75, y: 62 },
    ],
  },

  // ============================================================================
  // 4. HISTÓRICAS, EXÓTICAS Y EXPERIMENTALES
  // ============================================================================
  {
    id: '3-2-2-3-wm',
    nombre: '3-2-2-3 (Formación "WM" clásica)',
    categoria: 'Históricas / Especiales',
    estilo: 'Equilibrada',
    descripcion_tactica:
      'Fortalezas: Creada por Herbert Chapman en los años 30; dibuja una W en ataque (EI, dos MCO interiores, ED y DC) y una M en defensa (3 DFC + 2 MCD). Debilidades: Distancias largas entre líneas ante ataques modernos.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'DFC', x: 18, y: 22 },
      { numero_slot: 3, posicion: 'DFC', x: 16, y: 50 },
      { numero_slot: 4, posicion: 'DFC', x: 18, y: 78 },
      { numero_slot: 5, posicion: 'MCD', x: 36, y: 36 },
      { numero_slot: 6, posicion: 'MCD', x: 36, y: 64 },
      { numero_slot: 7, posicion: 'MCO', x: 56, y: 34 },
      { numero_slot: 8, posicion: 'MCO', x: 56, y: 66 },
      { numero_slot: 9, posicion: 'EI', x: 76, y: 15 },
      { numero_slot: 10, posicion: 'DC', x: 80, y: 50 },
      { numero_slot: 11, posicion: 'ED', x: 76, y: 85 },
    ],
  },
  {
    id: '2-3-5-piramide',
    nombre: '2-3-5 (La Pirámide invertida histórica)',
    categoria: 'Históricas / Especiales',
    estilo: 'Ultra Ofensiva',
    descripcion_tactica:
      'Fortalezas: El esquema clásico de inicios del siglo XX; cinco delanteros en línea (2 extremos, 2 interiores SD y 1 centrodelantero) que abruman el área rival. Debilidades: Solo dos zagueros (DFC) guardan la retaguardia.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'DFC', x: 18, y: 36 },
      { numero_slot: 3, posicion: 'DFC', x: 18, y: 64 },
      { numero_slot: 4, posicion: 'MC', x: 40, y: 24 },
      { numero_slot: 5, posicion: 'MCD', x: 38, y: 50 },
      { numero_slot: 6, posicion: 'MC', x: 40, y: 76 },
      { numero_slot: 7, posicion: 'EI', x: 74, y: 12 },
      { numero_slot: 8, posicion: 'SD', x: 71, y: 32 },
      { numero_slot: 9, posicion: 'DC', x: 79, y: 50 },
      { numero_slot: 10, posicion: 'SD', x: 71, y: 68 },
      { numero_slot: 11, posicion: 'ED', x: 74, y: 88 },
    ],
  },
  {
    id: '1-3-3-3-catenaccio',
    nombre: '1-3-3-3 (Catenaccio clásico con líbero)',
    categoria: 'Históricas / Especiales',
    estilo: 'Defensiva',
    descripcion_tactica:
      'Fortalezas: El legendario Catenaccio italiano; un Líbero (LIB) barre libre detrás de la línea de tres marcadores, lanzando contragolpes letales. Debilidades: El líbero habilita el fuera de juego si no coordina su salida.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'LIB', x: 12, y: 50 },
      { numero_slot: 3, posicion: 'LI', x: 22, y: 20 },
      { numero_slot: 4, posicion: 'DFC', x: 21, y: 50 },
      { numero_slot: 5, posicion: 'LD', x: 22, y: 80 },
      { numero_slot: 6, posicion: 'MC', x: 43, y: 24 },
      { numero_slot: 7, posicion: 'MCD', x: 40, y: 50 },
      { numero_slot: 8, posicion: 'MC', x: 43, y: 76 },
      { numero_slot: 9, posicion: 'EI', x: 72, y: 20 },
      { numero_slot: 10, posicion: 'DC', x: 77, y: 50 },
      { numero_slot: 11, posicion: 'ED', x: 72, y: 80 },
    ],
  },
  {
    id: '6-3-1-cerrojo',
    nombre: '6-3-1 ("Cerrojo" / Autobús defensivo total)',
    categoria: 'Históricas / Especiales',
    estilo: 'Defensiva',
    descripcion_tactica:
      'Fortalezas: Seis defensores en la frontal del área propia más tres mediocentros de contención; bloquea cualquier intento de penetración o centro. Debilidades: Renuncia casi por completo al ataque posicional.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'LI', x: 18, y: 10 },
      { numero_slot: 3, posicion: 'DFC', x: 15, y: 26 },
      { numero_slot: 4, posicion: 'DFC', x: 14, y: 42 },
      { numero_slot: 5, posicion: 'DFC', x: 14, y: 58 },
      { numero_slot: 6, posicion: 'DFC', x: 15, y: 74 },
      { numero_slot: 7, posicion: 'LD', x: 18, y: 90 },
      { numero_slot: 8, posicion: 'MC', x: 36, y: 28 },
      { numero_slot: 9, posicion: 'MCD', x: 34, y: 50 },
      { numero_slot: 10, posicion: 'MC', x: 36, y: 72 },
      { numero_slot: 11, posicion: 'DC', x: 68, y: 50 },
    ],
  },
  {
    id: '2-4-4-experimental',
    nombre: '2-4-4 (Esquema experimental ultra ofensivo)',
    categoria: 'Históricas / Especiales',
    estilo: 'Ultra Ofensiva',
    descripcion_tactica:
      'Fortalezas: Ocho jugadores entre mediocampo y delantera para presionar arriba y saturar el área rival en búsqueda de goles desesperados. Debilidades: Solo dos defensores centrales protegen todo el ancho del campo.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'DFC', x: 19, y: 35 },
      { numero_slot: 3, posicion: 'DFC', x: 19, y: 65 },
      { numero_slot: 4, posicion: 'MI', x: 46, y: 14 },
      { numero_slot: 5, posicion: 'MC', x: 44, y: 38 },
      { numero_slot: 6, posicion: 'MC', x: 44, y: 62 },
      { numero_slot: 7, posicion: 'MD', x: 46, y: 86 },
      { numero_slot: 8, posicion: 'EI', x: 74, y: 14 },
      { numero_slot: 9, posicion: 'DC', x: 79, y: 38 },
      { numero_slot: 10, posicion: 'DC', x: 79, y: 62 },
      { numero_slot: 11, posicion: 'ED', x: 74, y: 86 },
    ],
  },
  {
    id: '2-2-6-experimental',
    nombre: '2-2-6 (Esquema experimental sobrecarga total)',
    categoria: 'Históricas / Especiales',
    estilo: 'Ultra Ofensiva',
    descripcion_tactica:
      'Fortalezas: Seis atacantes fijando toda la última línea rival para bombardeo constante de centros y remates. Debilidades: Esquema kamikaze ante cualquier pérdida de balón en mitad de cancha.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'DFC', x: 18, y: 36 },
      { numero_slot: 3, posicion: 'DFC', x: 18, y: 64 },
      { numero_slot: 4, posicion: 'MCD', x: 40, y: 37 },
      { numero_slot: 5, posicion: 'MCD', x: 40, y: 63 },
      { numero_slot: 6, posicion: 'EI', x: 73, y: 10 },
      { numero_slot: 7, posicion: 'SD', x: 70, y: 27 },
      { numero_slot: 8, posicion: 'DC', x: 80, y: 42 },
      { numero_slot: 9, posicion: 'DC', x: 80, y: 58 },
      { numero_slot: 10, posicion: 'SD', x: 70, y: 73 },
      { numero_slot: 11, posicion: 'ED', x: 73, y: 90 },
    ],
  },
  {
    id: '4-3-3-asimetrica',
    nombre: '4-3-3 Asimétrica (Lateral extremo + Extremo de mediapunta)',
    categoria: 'Históricas / Especiales',
    estilo: 'Posesión',
    descripcion_tactica:
      'Fortalezas: El lateral izquierdo (CAI) sube como extremo profundo mientras el extremo izquierdo se cierra como mediapunta interior (MCO), creando sobrecarga inesperada. Debilidades: Requiere basculación defensiva hacia la banda izquierda.',
    jugadores: [
      { numero_slot: 1, posicion: 'POR', x: 5, y: 50 },
      { numero_slot: 2, posicion: 'CAI', x: 52, y: 12 },
      { numero_slot: 3, posicion: 'DFC', x: 18, y: 30 },
      { numero_slot: 4, posicion: 'DFC', x: 18, y: 55 },
      { numero_slot: 5, posicion: 'LD', x: 21, y: 82 },
      { numero_slot: 6, posicion: 'MCD', x: 35, y: 46 },
      { numero_slot: 7, posicion: 'MC', x: 46, y: 32 },
      { numero_slot: 8, posicion: 'MC', x: 46, y: 66 },
      { numero_slot: 9, posicion: 'MCO', x: 64, y: 32 },
      { numero_slot: 10, posicion: 'DC', x: 79, y: 50 },
      { numero_slot: 11, posicion: 'ED', x: 73, y: 84 },
    ],
  },
];

export const FORMATIONS: FormationDefinition[] = RAW_FORMATIONS.map(buildFormation);

export function getFormation(id: string): FormationDefinition {
  return FORMATIONS.find((f) => f.id === id) ?? FORMATIONS[0];
}

export function getFormationsByCategory(
  category: FormationCategory | 'Todas'
): FormationDefinition[] {
  if (category === 'Todas') return FORMATIONS;
  return FORMATIONS.filter((f) => f.categoria === category);
}
