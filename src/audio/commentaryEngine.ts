import type { GameSettings } from '../types/football';
import { soundEngine } from './soundEngine';

export type CommentaryEventType =
  | 'match_intro'
  | 'kickoff'
  | 'pass'
  | 'through_pass'
  | 'attack_buildup'
  | 'counter_attack'
  | 'approach_box'
  | 'dribble_encara'
  | 'shot'
  | 'shot_post'
  | 'save'
  | 'goal'
  | 'goal_spectacular'
  | 'goal_late'
  | 'replay_analysis'
  | 'penalty_awarded'
  | 'penalty_shootout_kick'
  | 'free_kick'
  | 'corner'
  | 'foul'
  | 'advantage'
  | 'yellow_card'
  | 'red_card'
  | 'offside'
  | 'substitution'
  | 'injury'
  | 'halftime'
  | 'second_half'
  | 'added_time'
  | 'extra_time'
  | 'fulltime';

export interface CommentaryContext {
  type: CommentaryEventType;
  playerName?: string;
  secondPlayerName?: string;
  teamName?: string;
  opponentName?: string;
  stadiumName?: string;
  minute?: number;
  homeScore?: number;
  awayScore?: number;
  addedMinutes?: number;
}

export interface DualVoiceLine {
  relator: string;
  comentarista?: string;
  crowdChant?: string;
}

export interface CommentarySubtitle {
  id: string;
  text: string;
  comentaristaText?: string;
  crowdChantText?: string;
  excitement: 'normal' | 'high' | 'goal';
  timestamp: number;
}

interface TemplateEntry {
  id: CommentaryEventType;
  priority: number; // 1 (lowest: pass) .. 10 (highest: goal)
  excitement: 'normal' | 'high' | 'goal';
  cooldownMs: number;
  variants: ((ctx: CommentaryContext, spicy: boolean) => DualVoiceLine)[];
}

/**
 * BANCO DE INSULTOS Y CÁNTICOS DE CANCHA LATINOAMERICANA ("Modo Hinchada Picante")
 * Sin insultos racistas, homofóbicos ni contra grupos protegidos. Puro folclore picante de tribuna.
 */
export const CROWD_INSULTS_BANK = {
  referee: [
    '¡Árbitro vendido, comprate anteojos, ladrón!',
    '¡Referí caradura, estás cobrando todo para ellos, sinvergüenza!',
    '¡Qué cobrás, juez de cartón! ¡Dejá jugar al fútbol, burro!',
    '¡Árbitro ciego, esa falta la vio todo el estadio menos vos!',
    '¡Largá el silbato, ladrón, nos están bombeando en nuestra propia cancha!',
    '¡Andate a dirigir al barrio, referí desastre!',
  ],
  rivalMiss: [
    '¡Burrooo! ¡A dónde la mandaste, tenés dos ladrillos en los pies!',
    '¡Jajaja, a la tribuna la tiró! ¡Dedicate a otra cosa, tronco!',
    '¡Qué muerto que sos, hermano, erraste abajo del arco!',
    '¡Sacá el paracaídas que esa pelota todavía sigue subiendo, perro!',
    '¡Pateaste con el diario del domingo, amargo!',
    '¡Devolvé la camiseta, tronco, cómo vas a pifiar así!',
  ],
  rivalFoul: [
    '¡Amarilla, juez! ¡Fue a romperlo, qué carnicero!',
    '¡Echalo, árbitro, vino a pegar patadas toda la noche!',
    '¡Cortala con la guadaña, picapiedra, jugá a la pelota!',
    '¡Roja directa, juez, casi le lleva la tibia a la casa!',
  ],
  rivalKeeper: [
    '¡Tenés manos de manteca, arquero, ya te vamos a embocar!',
    '¡Soltá el travesaño, arquero con suerte, no sabés ni cómo la sacaste!',
    '¡Hacé tiempo ahora, cagón, que igual te lo damos vuelta!',
  ],
  ownTeamLosing: [
    '¡Pongan huevos, que acá no se juega de paseo, transpiren la camiseta!',
    '¡Movete, equipo, movete! ¡Dejen de caminar la cancha, pechos fríos!',
    '¡Despiértense de una vez, que la gente vino a verlos ganar!',
    '¡Un poquito más de sangre, muchachos, no pueden perder todas las divididas!',
  ],
} as const;

function pickCrowdInsult(category: keyof typeof CROWD_INSULTS_BANK): string {
  const arr = CROWD_INSULTS_BANK[category];
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * BANCO DE RELATOS CON DUPLA (RELATOR + COMENTARISTA DE APOYO)
 * Al menos 15 variantes distintas en las categorías principales de juego para que no se repitan.
 */
export const COMMENTARY_TEMPLATES: Record<CommentaryEventType, TemplateEntry> = {
  goal: {
    id: 'goal',
    priority: 10,
    excitement: 'goal',
    cooldownMs: 400,
    variants: [
      (c) => ({
        relator: `¡Llega al área ${c.playerName}, acomoda el cuerpo, define cruzado... ¡GOOOOOOL! ¡GOOOOOL DE ${(c.teamName || 'SU EQUIPO').toUpperCase()}! ¡En el minuto ${c.minute || 1}, pone las cosas ${c.homeScore} a ${c.awayScore}!`,
        comentarista: `¡Qué bárbaro cómo aguantó la marca y esperó el momento exacto para soltar el latigazo! Definición de jerarquía pura.`,
      }),
      (c) => ({
        relator: `¡Se filtra en el área ${c.playerName}, enfrenta al arquero, le pega de primera... ¡GOOOOOOL! ¡CANTALO, CANTALO, CANTALO! ¡GOLAZO DE ${(c.teamName || '').toUpperCase()}!`,
        comentarista: `Toda la jugada nace de la presión alta. Cuando recuperás ahí arriba con el rival abierto, no perdonás.`,
      }),
      (c) => ({
        relator: `¡Atención que encaró ${c.playerName}, dejó pagando al central, sacó el derechazo... ¡GOOOOOOL! ¡EXPLOTA LA TRIBUNA CON EL ${c.homeScore} A ${c.awayScore}!`,
        comentarista: `Mirá dónde la clavó, imposible para cualquier arquero del mundo. Un remate seco y esquinado.`,
      }),
      (c) => ({
        relator: `¡Ahí la tiene ${c.playerName} al borde del área, apunta al rincón... ¡GOOOOOOL! ¡SÍ, SEÑORES, GOL DE ${(c.teamName || '').toUpperCase()} AL MINUTO ${c.minute || 1}!`,
        comentarista: `Le dieron medio metro y te liquida. No podés dejar pensar a un definidor de esta categoría.`,
      }),
      (c) => ({
        relator: `¡Apareció como un fantasma ${c.playerName} entre los centrales, conecta el envío y la manda a guardar! ¡GOOOOOOL DE ${(c.teamName || '').toUpperCase()}!`,
        comentarista: `El desmarque en diagonal fue de manual. Durmió toda la última línea de ${c.opponentName || 'la defensa'}.`,
      }),
      (c) => ({
        relator: `¡Pisa el área grande ${c.playerName}, amaga con el cuerpo, define abajo contra el palo... ¡GOOOOOOL! ¡Ahora están ${c.homeScore} a ${c.awayScore}!`,
        comentarista: `Sangre fría dentro del área cuando las pulsaciones van a mil. Qué clase para definir.`,
      }),
      (c) => ({
        relator: `¡Recibe ${c.playerName}, gira en una baldosa, suelta el cañonazo... ¡GOOOOOOLAZO DE ${(c.teamName || '').toUpperCase()}! ¡Se cae el estadio!`,
        comentarista: `El control orientado es medio gol. En un solo toque ya se había sacado al marcador de encima.`,
      }),
      (c) => ({
        relator: `¡Se escapa mano a mano ${c.playerName}, el arquero sale a achicar, la toca suave a un costado... ¡GOOOOOOL DE ${(c.teamName || '').toUpperCase()}!`,
        comentarista: `Pura categoría. Levantó la cabeza antes de impactar y vio exactamente qué palo quedaba libre.`,
      }),
      (c) => ({
        relator: `¡Pelota profunda para ${c.playerName}, controla en velocidad, fusila al arquero... ¡GOOOOOOL! ¡Minuto ${c.minute || 1} y el marcador está ${c.homeScore} a ${c.awayScore}!`,
        comentarista: `Un contragolpe letal a tres toques. Así se castiga cuando el rival pierde la pelota en salida.`,
      }),
      (c) => ({
        relator: `¡Se mete a pura potencia ${c.playerName}, gana el forcejeo, remata cruzado... ¡GOOOOOOL DE ${(c.teamName || '').toUpperCase()}! ¡Rompió el arco!`,
        comentarista: `Puso el cuerpo, aguantó el empujón del zaguero y definió con el alma. Gol de goleador de raza.`,
      }),
      (c) => ({
        relator: `¡Le quedó picando en la medialuna a ${c.playerName}, no lo dudó ni un segundo... ¡GOOOOOOL! ¡Adentro, contra la red para el ${c.homeScore} a ${c.awayScore}!`,
        comentarista: `Cuando le pegás con esa rosca interna la pelota viaja buscándole el rincón más lejano al guardameta.`,
      }),
      (c) => ({
        relator: `¡Qué jugada colectiva de ${c.teamName}! ¡Aparece ${c.playerName} para darle el pase a la red... ¡GOOOOOOL, SEÑORAS Y SEÑORES!`,
        comentarista: `Fútbol total. Tocaron cinco jugadores seguidos hasta encontrar el hueco perfecto dentro del área.`,
      }),
      (c) => ({
        relator: `¡Se acomoda ${c.playerName} para su pierna hábil, saca el latigazo rasante... ¡GOOOOOOL DE ${(c.teamName || '').toUpperCase()}! ¡Delirio en las tribunas!`,
        comentarista: `La pelota pica justo antes del manotazo del arquero y se vuelve inatajable. Gran ejecución.`,
      }),
      (c) => ({
        relator: `¡Ataca con todo ${c.teamName}, la recibe ${c.playerName} en el punto penal, define de primera... ¡GOOOOOOL! ¡GOLAZO AL MINUTO ${c.minute || 1}!`,
        comentarista: `No necesitó ni pararla. El recurso del remate a un toque descolocó por completo a toda la defensa.`,
      }),
      (c) => ({
        relator: `¡Ahí va ${c.playerName}, se abre el espacio, suelta el bombazo al primer palo... ¡GOOOOOOL DE ${(c.teamName || '').toUpperCase()}! ¡Esto está ${c.homeScore} a ${c.awayScore}!`,
        comentarista: `Todos esperaban el centro o el tiro cruzado y les quemó el primer poste. Sorpresa absoluta.`,
      }),
      (c) => ({
        relator: `¡No lo pueden parar a ${c.playerName}, entra al área a pura gambeta y define... ¡GOOOOOOL! ¡Para sacarse el sombrero con ${(c.teamName || '').toUpperCase()}!`,
        comentarista: `Una obra de arte individual en el momento donde el partido pedía rebeldía. Impresionante.`,
      }),
    ],
  },

  shot: {
    id: 'shot',
    priority: 6,
    excitement: 'high',
    cooldownMs: 1350,
    variants: [
      (c, spicy) => ({
        relator: `¡Se perfila ${c.playerName} desde afuera del área, saca el derechazo potente... uyyy, pasó besando el palo!`,
        comentarista: spicy
          ? `¡Pero cómo vas a errar ese arco con todo el espacio del mundo! La tribuna se agarra la cabeza.`
          : `Le dio con muchísima rosca, si iba diez centímetros más adentro era golazo.`,
        crowdChant: spicy ? pickCrowdInsult('rivalMiss') : undefined,
      }),
      (c, spicy) => ({
        relator: `¡Probó de media distancia ${c.playerName} buscando sorprender al arquero!`,
        comentarista: spicy
          ? `¡A cualquier lado la mandó! Tenía pase claro a la derecha y quiso hacer la heroica.`
          : `Buen intento para romper el bloque bajo cuando no hay líneas de pase internas.`,
      }),
      (c) => ({
        relator: `¡Sacó el latigazo cruzado ${c.playerName} apenas pisó la medialuna del área!`,
        comentarista: `Se tuvo toda la fe del mundo. El remate viajó a más de cien kilómetros por hora.`,
      }),
      (c) => ({
        relator: `¡Enganchó hacia adentro ${c.playerName} y soltó el buscapié venenoso contra el arco!`,
        comentarista: `Esos tiros rasantes que pasan entre tantas piernas siempre complican la visual del portero.`,
      }),
      (c, spicy) => ({
        relator: `¡Recibió libre ${c.playerName}, apuntó al ángulo superior y le dio con alma y vida!`,
        comentarista: spicy
          ? `¡Le pegó con el tobillo, hermano! Mirá la bronca que hay en la popular con esa definición.`
          : `Le entró un poquito abajo a la pelota y por eso tomó demasiada altura.`,
        crowdChant: spicy ? pickCrowdInsult('rivalMiss') : undefined,
      }),
      (c) => ({
        relator: `¡Remate de primera intención de ${c.playerName} sin dejarla caer!`,
        comentarista: `Excelente gesto técnico volcando el cuerpo hacia adelante para que no se le vaya arriba.`,
      }),
      (c) => ({
        relator: `¡Cañonazo violento de ${c.playerName} que hace levantar a todo el estadio de sus asientos!`,
        comentarista: `Avisa ${c.teamName}. Ya es la segunda vez que encuentran espacio en la zona de volantes.`,
      }),
      (c) => ({
        relator: `¡Buscó el rincón más lejano ${c.playerName} con un tiro colocado lleno de efecto!`,
        comentarista: `Intentó asegurar dirección antes que potencia. Pasó realmente muy cerca del poste.`,
      }),
      (c, spicy) => ({
        relator: `¡Se animó ${c.playerName} desde veintidós metros, le prende mecha al balón!`,
        comentarista: spicy
          ? `¡Qué manera de regalar la jugada! El técnico en el banco quiere romper el pizarrón.`
          : `Había que terminar la jugada para evitar el contragolpe rival.`,
      }),
      (c) => ({
        relator: `¡Gira rápido ${c.playerName} entre dos marcas y saca el disparo a quemarropa!`,
        comentarista: `Qué velocidad de ejecución en espacios reducidos. Casi no necesita recorrido de pierna.`,
      }),
      (c) => ({
        relator: `¡Entra en carrera ${c.playerName} y suelta una bomba tremenda hacia la valla!`,
        comentarista: `Cuando viene lanzado en velocidad tiene uno de los remates más pesados del campeonato.`,
      }),
      (c) => ({
        relator: `¡Zurdazo seco de ${c.playerName} al primer palo buscando el descuido del guardameta!`,
        comentarista: `Muy inteligente apuntando al poste corto cuando la defensa basculaba hacia el centro.`,
      }),
      (c, spicy) => ({
        relator: `¡Tuvo el gol en sus pies ${c.playerName}, le pegó mordido y se pierde una chance clarísima!`,
        comentarista: spicy
          ? `¡No se puede creer el gol que acaba de desperdiciar abajo del arco! ¡Imperdonable en este nivel!`
          : `Apuró demasiado el impacto cuando todavía tenía un segundo más para controlar.`,
        crowdChant: spicy ? pickCrowdInsult('rivalMiss') : undefined,
      }),
      (c) => ({
        relator: `¡La empalmó de lleno ${c.playerName} tras el rebote en la puerta del área!`,
        comentarista: `Siempre hay que estar atento a la segunda jugada. Casi rompe el marcador.`,
      }),
      (c) => ({
        relator: `¡Disparo con comba hacia adentro de ${c.playerName} buscando el ángulo derecho!`,
        comentarista: `Hermosa parábola tomó esa pelota. El arquero solo atinó a acompañarla con la mirada.`,
      }),
    ],
  },

  save: {
    id: 'save',
    priority: 7,
    excitement: 'high',
    cooldownMs: 1350,
    variants: [
      (c, spicy) => ({
        relator: `¡ATAJADÓN MONUMENTAL! ¡Voló de palo a palo ${c.playerName} para ahogar el grito de gol!`,
        comentarista: spicy
          ? `¡No se puede creer lo que acaba de sacar este arquero! ¡La tribuna lo insulta de arriba a abajo!`
          : `Puro reflejo felino. Una atajada que vale exactamente lo mismo que un gol.`,
        crowdChant: spicy ? pickCrowdInsult('rivalKeeper') : undefined,
      }),
      (c) => ({
        relator: `¡Manotazo salvador de ${c.playerName} enviando la pelota por encima del travesaño!`,
        comentarista: `Qué fuerza de piernas para impulsarse cuando la pelota ya se metía en el ángulo.`,
      }),
      (c) => ({
        relator: `¡Gigante, enorme ${c.playerName} achicando en el mano a mano y quedándose con el duelo!`,
        comentarista: `Salió en el instante preciso, abrió los brazos y le cerró absolutamente todos los ángulos de tiro.`,
      }),
      (c) => ({
        relator: `¡Tapada espectacular a quemarropa de ${c.playerName} cuando ya todos cantaban el tanto!`,
        comentarista: `Tiempo de reacción de menos de una décima de segundo. Arquero de equipo grande.`,
      }),
      (c, spicy) => ({
        relator: `¡Se estiró cuan largo es ${c.playerName} abajo contra el poste para desviar ese misil!`,
        comentarista: spicy
          ? `¡Qué suerte tuvo ese arquero, hermano! ¡Pero también qué masita le tiró el delantero!`
          : `Ir abajo tan rápido para un arquero de su altura demuestra una agilidad notable.`,
      }),
      (c) => ({
        relator: `¡Con las dos manos firmes responde ${c.playerName} ante el bombazo de media distancia!`,
        comentarista: `Seguridad total sin dar rebote corto en una zona donde merodeaban dos delanteros.`,
      }),
      (c) => ({
        relator: `¡Increíble reacción de ${c.playerName} a puro instinto sobre la línea de sentencia!`,
        comentarista: `Sus compañeros van a abrazarlo porque acaba de mantener vivo a ${c.teamName} en el partido.`,
      }),
      (c) => ({
        relator: `¡Descolgó del ángulo ${c.playerName} una pelota que llevaba destino de red!`,
        comentarista: `Ubicación perfecta. Como estaba medio paso adelantado en la bisectriz, llegó con la yema de los dedos.`,
      }),
      (c) => ({
        relator: `¡Puñetazo salvador de ${c.playerName} despejando el peligro en el corazón del área chica!`,
        comentarista: `Cuando hay tanta gente tapando la visión, lo más seguro es despejar fuerte hacia los costados.`,
      }),
      (c) => ({
        relator: `¡Se viste de héroe ${c.playerName} con una atajada doble memorable para ${c.teamName}!`,
        comentarista: `No solo tapó el remate sino que se levantó como un resorte para cubrir el segundo palo.`,
      }),
      (c) => ({
        relator: `¡Con el pie al estilo futsal salvó ${c.playerName} el remate rasante a contrapié!`,
        comentarista: `Recurso extraordinario cuando el peso del cuerpo ya iba hacia el otro costado.`,
      }),
      (c) => ({
        relator: `¡Muralla infranqueable hoy ${c.playerName} bajo los tres Caños de ${c.teamName}!`,
        comentarista: `Está transmitiendo una confianza tremenda a toda su línea de cuatro defensores.`,
      }),
      (c) => ({
        relator: `¡Qué volada fotográfica de ${c.playerName} para desviar el tiro con rosca!`,
        comentarista: `Tenía efecto hacia afuera y aun así corrigió la mano en el aire para sacarla al córner.`,
      }),
      (c) => ({
        relator: `¡Le adivinó la intención ${c.playerName} y contuvo el disparo sin dar rebote!`,
        comentarista: `Lectura corporal perfecta del perfil del pateador antes del impacto.`,
      }),
      (c) => ({
        relator: `¡Salvada milagrosa de ${c.playerName} en el minuto ${c.minute || 1} para sostener el marcador!`,
        comentarista: `Si este partido termina así, el premio a la figura de la cancha ya tiene nombre y apellido.`,
      }),
    ],
  },

  foul: {
    id: 'foul',
    priority: 5,
    excitement: 'high',
    cooldownMs: 2100,
    variants: [
      (c, spicy) => ({
        relator: `¡Falta dura de ${c.playerName}! El árbitro hace sonar el silbato y cobra tiro libre.`,
        comentarista: spicy
          ? `¡Por favor, qué está viendo el árbitro! ¡Eso era tarjeta acá y en cualquier parte del mundo!`
          : `Llegó medio segundo tarde al cruce y terminó llevándose puesto el tobillo de apoyo.`,
        crowdChant: spicy ? pickCrowdInsult('referee') : undefined,
      }),
      (c, spicy) => ({
        relator: `¡Cae derribado el atacante tras el cruce de ${c.playerName} y estalla la protesta en la cancha!`,
        comentarista: spicy
          ? `¡Esto es un escándalo, hermano! ¡Se están dando con todo y al juez se le escapó el partido de las manos!`
          : `Falta táctica para cortar el ataque antes de que pudieran girar de frente a los centrales.`,
        crowdChant: spicy ? pickCrowdInsult('rivalFoul') : undefined,
      }),
      (c, spicy) => ({
        relator: `¡Infracción sancionada contra ${c.playerName} en la mitad del terreno!`,
        comentarista: spicy
          ? `¡Mirá cómo protesta la tribuna contra el juez! ¡No le perdonan ni una sola dividida!`
          : `Le puso el brazo arriba en el forcejeo y el reglamento ahí es claro.`,
        crowdChant: spicy ? pickCrowdInsult('referee') : undefined,
      }),
      (c) => ({
        relator: `¡Se tiró a barrer a destiempo ${c.playerName} y el árbitro no duda en marcar la falta!`,
        comentarista: `Cuando vas al piso sobre césped rápido y no tocás primero la pelota, corrés un riesgo enorme.`,
      }),
      (c) => ({
        relator: `¡Cortó con falta ${c.playerName} cuando se armaba la transición rápida del rival!`,
        comentarista: `Infracción inteligente desde lo táctico porque el equipo había quedado totalmente descompensado.`,
      }),
      (c, spicy) => ({
        relator: `¡Empujón claro de ${c.playerName} en la disputa del balón! Tiro libre peligroso.`,
        comentarista: spicy
          ? `¡Qué verde estuvo para hacer esa falta ahí al borde del área! ¡Regaló una pelota parada de gol!`
          : `Innecesaria la falta porque el delantero ya estaba de espaldas y encerrado contra la raya.`,
      }),
      (c) => ({
        relator: `¡Falta de ${c.playerName} sobre el conductor del equipo rival en tres cuartos de cancha!`,
        comentarista: `La orden del banco es clara: que no reciba cómodo ni pueda filtrar pases entre líneas.`,
      }),
      (c) => ({
        relator: `¡Choque fuerte abajo, el juez cobra infracción de ${c.playerName} y pide calma a los jugadores!`,
        comentarista: `Se está jugando con los dientes apretados cada metro de la cancha, como una verdadera final.`,
      }),
      (c) => ({
        relator: `¡Traba fuerte ${c.playerName}, se lleva pierna y pelota, y el árbitro sanciona tiro libre!`,
        comentarista: `En velocidad pareció limpia, pero el impulso posterior terminó derribando al adversario.`,
      }),
      (c, spicy) => ({
        relator: `¡Agarrón de camiseta de ${c.playerName} que no pasa desapercibido para el colegiado!`,
        comentarista: spicy
          ? `¡Casi le lleva la camiseta de recuerdo a la casa! ¡Y encima le protesta al árbitro, qué caradura!`
          : `Cuando el extremo te gana en el primer metro de arranque, ya no lo alcanzás limpio.`,
      }),
      (c) => ({
        relator: `¡Pitazo del juez! Falta en ataque cometida por ${c.playerName} en su afán por recuperar.`,
        comentarista: `La presión alta es excelente, pero hay que medir el ímpetu para no darle respiro al rival.`,
      }),
      (c) => ({
        relator: `¡Entrada al límite de ${c.playerName}! El árbitro marca el tiro libre y le advierte verbalmente.`,
        comentarista: `Le dijo clarito: una más como esa y se va amonestado. Queda en la cuerda floja.`,
      }),
      (c) => ({
        relator: `¡Obstrucción de ${c.playerName} cortando la pared en la zona de gestación!`,
        comentarista: `Dejó la cadera puesta para frenar la diagonal del volante que iba a buscar la devolución.`,
      }),
      (c) => ({
        relator: `¡Pisotón involuntario pero falta al fin de ${c.playerName} en el círculo central!`,
        comentarista: `Los dos fueron a disputar una pelota dividida y llegó una fracción de segundo después.`,
      }),
      (c, spicy) => ({
        relator: `¡Sanciona falta el árbitro contra ${c.playerName} y se escuchan silbidos ensordecedores en la tribuna!`,
        comentarista: spicy
          ? `¡La hinchada está que arde con el arbitraje de hoy! ¡Sienten que todas las chiquitas van para el mismo lado!`
          : `El clima en el estadio mete muchísima presión en cada decisión dividida.`,
        crowdChant: spicy ? pickCrowdInsult('referee') : undefined,
      }),
    ],
  },

  attack_buildup: {
    id: 'attack_buildup',
    priority: 2,
    excitement: 'normal',
    cooldownMs: 4000,
    variants: [
      (c, spicy) => ({
        relator: `Adelanta todas sus líneas ${c.teamName}, conduce con cabeza levantada ${c.playerName} buscando el espacio.`,
        comentarista:
          spicy && (c.homeScore ?? 0) < (c.awayScore ?? 0)
            ? `La gente empieza a impacientarse en la tribuna, piden que metan la pelota al área de una vez.`
            : `Fijate cómo se mueven en bloque: suben los laterales y los interiores ofrecen triángulo de apoyo.`,
        crowdChant:
          spicy && (c.homeScore ?? 0) < (c.awayScore ?? 0)
            ? pickCrowdInsult('ownTeamLosing')
            : undefined,
      }),
      (c) => ({
        relator: `Maneja la posesión ${c.teamName} en terreno adversario a través de los pies de ${c.playerName}.`,
        comentarista: `Mueven la pelota de lado a lado para obligar a bascular al bloque defensivo y encontrar el hueco.`,
      }),
      (c) => ({
        relator: `Progresa con criterio ${c.playerName}, pisa tres cuartos de cancha y prepara la ofensiva de ${c.teamName}.`,
        comentarista: `Ya hay tres compañeros picando al espacio entre los zagueros y los mediocentros.`,
      }),
      (c) => ({
        relator: `Sale jugando limpio desde el fondo ${c.teamName}, la lleva pegada al botín ${c.playerName}.`,
        comentarista: `Buena salida bajo presión sin revolear la pelota. Buscan superioridad numérica en el medio.`,
      }),
      (c) => ({
        relator: `Se planta en campo rival ${c.teamName}, pide la pelota ${c.playerName} para organizar el ataque.`,
        comentarista: `Cuando él entra en contacto con el balón, todo el equipo encuentra claridad conceptual.`,
      }),
      (c) => ({
        relator: `Toca y va ${c.playerName}, busca romper la primera línea de presión con conducción dinámica.`,
        comentarista: `Esa aceleración gradual en los primeros metros es clave para desacomodar las marcas zonales.`,
      }),
      (c) => ({
        relator: `Elabora con paciencia ${c.teamName} al minuto ${c.minute || 1}, la distribuye ${c.playerName}.`,
        comentarista: `El rival se repliega en treinta metros, así que la precisión en el pase corto es fundamental.`,
      }),
      (c) => ({
        relator: `Abre la cancha ${c.playerName} buscando amplitud por las bandas para ${c.teamName}.`,
        comentarista: `Estirar a la defensa a lo ancho de los sesenta y ocho metros siempre abre carriles internos.`,
      }),
      (c) => ({
        relator: `Asume el protagonismo ${c.teamName}, lleva las riendas del mediocampo ${c.playerName}.`,
        comentarista: `Buen posicionamiento preventivo de los defensores por si llegan a perder la pelota.`,
      }),
      (c) => ({
        relator: `Cambia de ritmo ${c.playerName} pasando la línea central, se viene el avance de ${c.teamName}.`,
        comentarista: `Observá cómo el delantero centro fija a los dos centrales para liberar la medialuna.`,
      }),
      (c) => ({
        relator: `Rota el esférico ${c.teamName}, la pisa y contemporiza ${c.playerName} esperando el desmarque.`,
        comentarista: `No se trata de correr por correr, sino de acelerar en el último tercio cuando aparece la ventaja.`,
      }),
      (c) => ({
        relator: `Gana metros en el campo ${c.playerName}, empuja ${c.teamName} con todo su bloque ofensivo.`,
        comentarista: `El partido está intenso y táctico, cada metro ganado en la zona media vale oro.`,
      }),
      (c) => ({
        relator: `Conecta líneas ${c.playerName} ofreciendo descarga limpia para la progresión de ${c.teamName}.`,
        comentarista: `Un mediocampista moderno: recibe perfilado para poder girar y atacar en un solo movimiento.`,
      }),
      (c) => ({
        relator: `Insiste por el carril central ${c.teamName} bajo la conducción de ${c.playerName}.`,
        comentarista: `Están preparando la pared corta en la puerta del área para quedar mano a mano.`,
      }),
      (c) => ({
        relator: `Se asocia en corto ${c.playerName}, suma pases ${c.teamName} buscando desgastar al rival.`,
        comentarista: `Hacer correr detrás de la pelota al adversario pasa factura física en los últimos veinte minutos.`,
      }),
    ],
  },

  pass: {
    id: 'pass',
    priority: 1,
    excitement: 'normal',
    cooldownMs: 3900,
    variants: [
      (c) => ({
        relator: `Entrega limpia al pie de ${c.playerName}, mantiene la circulación ${c.teamName}.`,
      }),
      (c) => ({
        relator: `Toca de primera ${c.playerName} dándole velocidad a la rotación del balón.`,
      }),
      (c) => ({
        relator: `Buena descarga de ${c.playerName} para oxigenar la salida de ${c.teamName}.`,
      }),
      (c) => ({
        relator: `Cabeza levantada y pase firme de ${c.playerName} cruzando la mitad de la cancha.`,
      }),
      (c) => ({
        relator: `Se apoya ${c.playerName} con su compañero y ya pica a buscar la devolución.`,
      }),
      (c) => ({
        relator: `Distribuye con criterio ${c.playerName}, no rifa la pelota ${c.teamName}.`,
      }),
      (c) => ({
        relator: `Pase rasante y preciso de ${c.playerName} rompiendo la presión inicial.`,
      }),
      (c) => ({
        relator: `La cambia de sector ${c.playerName} buscando al compañero libre por el costado.`,
      }),
      (c) => ({
        relator: `Controla y entrega rápido ${c.playerName}, dinámica pura en el mediocampo.`,
      }),
      (c) => ({
        relator: `Juega seguro al pie ${c.playerName}, administra los tiempos ${c.teamName}.`,
      }),
      (c) => ({
        relator: `Toque corto de ${c.playerName} armando la triangulación por la banda.`,
      }),
      (c) => ({
        relator: `Descarga hacia atrás ${c.playerName} para volver a empezar con más claridad.`,
      }),
      (c) => ({
        relator: `Pase firme de ${c.playerName} que supera la línea de volantes.`,
      }),
      (c) => ({
        relator: `La hace circular ${c.playerName} al ras del césped con mucha precisión.`,
      }),
      (c) => ({
        relator: `Conecta ${c.playerName} en la zona media y sostiene la posesión ${c.teamName}.`,
      }),
    ],
  },

  through_pass: {
    id: 'through_pass',
    priority: 4,
    excitement: 'high',
    cooldownMs: 2600,
    variants: [
      (c) => ({
        relator: `¡Qué pelota filtró ${c.playerName}! ¡Pase quirúrgico entre los centrales que rompe toda la defensa!`,
        comentarista: `Vio el pasillo antes que nadie en el estadio. Un pase digno de un diez clásico.`,
      }),
      (c) => ({
        relator: `¡Atención con ese pase profundo al vacío de ${c.playerName} para la diagonal del atacante!`,
        comentarista: `La puso con la fuerza justa para que el delantero no tenga ni que frenar su carrera.`,
      }),
      (c) => ({
        relator: `¡Pared espectacular y balón filtrado de ${c.playerName} a la espalda de la zaga!`,
        comentarista: `Así se rompe una línea defensiva adelantada: toque y desmarque explosivo al espacio.`,
      }),
      (c) => ({
        relator: `¡La puso como con un guante ${c.playerName} entre líneas! ¡Se viene el peligro de gol!`,
        comentarista: `Tres defensores quedaron fuera de foco con un solo toque vertical.`,
      }),
    ],
  },

  counter_attack: {
    id: 'counter_attack',
    priority: 5,
    excitement: 'high',
    cooldownMs: 3200,
    variants: [
      (c) => ({
        relator: `¡Sale la contra eléctrica de ${c.teamName}! ¡A toda velocidad conduce ${c.playerName} con campo abierto!`,
        comentarista: `Quedaron tres contra dos en transición. Si deciden bien el último pase, esto termina en la red.`,
      }),
      (c) => ({
        relator: `¡Recuperación y contragolpe letal liderado por ${c.playerName} a casi nueve metros por segundo!`,
        comentarista: `Mirá cómo vuelan por las bandas acompañando la jugada. Transición defensa-ataque de manual.`,
      }),
      (c) => ({
        relator: `¡Se arma la réplica furiosa de ${c.teamName} con ${c.playerName} lanzado en sprint!`,
        comentarista: `El rival quedó partido al medio tras perder la pelota en salida.`,
      }),
    ],
  },

  approach_box: {
    id: 'approach_box',
    priority: 4,
    excitement: 'high',
    cooldownMs: 2900,
    variants: [
      (c) => ({
        relator: `¡Atención que pisa el área grande ${c.playerName}! ¡Hay aroma de gol para ${c.teamName}!`,
        comentarista: `Ya está dentro de la zona de gatillo, si encuentra medio metro va a sacar el remate.`,
      }),
      (c) => ({
        relator: `¡Se mete en zona caliente ${c.playerName}, amaga ante su marcador, se levanta la tribuna!`,
        comentarista: `Cuidado que dentro del área cualquier contacto a esa velocidad es penal.`,
      }),
      (c) => ({
        relator: `¡Merodea el área rival ${c.teamName} con ${c.playerName} listo para definir!`,
        comentarista: `Dos compañeros más llegan por el segundo palo esperando el centro atrás.`,
      }),
    ],
  },

  dribble_encara: {
    id: 'dribble_encara',
    priority: 4,
    excitement: 'high',
    cooldownMs: 2900,
    variants: [
      (c) => ({
        relator: `¡Encara ${c.playerName} con la pelota atada al pie, engancha en velocidad y deja pagando a su marca!`,
        comentarista: `Cómo inclina el cuerpo en el giro para cambiar de dirección sin perder inercia. Puro potrero.`,
      }),
      (c) => ({
        relator: `¡Se saca un rival de encima ${c.playerName} a pura gambeta y cambio de ritmo!`,
        comentarista: `El uno contra uno es el arma más valiosa del fútbol moderno para romper esquemas cerrados.`,
      }),
    ],
  },

  shot_post: {
    id: 'shot_post',
    priority: 8,
    excitement: 'high',
    cooldownMs: 1200,
    variants: [
      (c) => ({
        relator: `¡AL PALOOO! ¡Reventó el poste el remate violento de ${c.playerName} cuando el arquero ya estaba vencido!`,
        comentarista: `¡Todavía está temblando el arco! Por dos centímetros no estamos gritando uno de los goles del año.`,
      }),
      (c) => ({
        relator: `¡UYYY, PEGÓ EN EL TRAVESAÑO! ¡El metal le dijo que no a ${c.playerName} en una jugada dramática!`,
        comentarista: `El sonido seco del impacto se escuchó en todo el estadio. Se salvó de milagro la visita.`,
      }),
    ],
  },

  goal_spectacular: {
    id: 'goal_spectacular',
    priority: 10,
    excitement: 'goal',
    cooldownMs: 400,
    variants: [
      (c) => ({
        relator: `¡PERO QUÉ GOLAZO HICISTE, ${c.playerName?.toUpperCase()}! ¡GOOOOOOL DE ${(c.teamName || '').toUpperCase()}! ¡La clavó en el ángulo donde duermen las arañas!`,
        comentarista: `¡Para cerrar el estadio y aplaudir de pie! La curva que tomó esa pelota es una obra maestra de la física.`,
      }),
      (c) => ({
        relator: `¡UNA JOYA MONUMENTAL DEL FÚTBOL! ¡GOOOOOOLAZO DE ${c.playerName} PARA PONER EL ${c.homeScore} A ${c.awayScore}!`,
        comentarista: `Un misil teledirigido de más de treinta metros por segundo directo al rincón. Inatajable.`,
      }),
    ],
  },

  goal_late: {
    id: 'goal_late',
    priority: 10,
    excitement: 'goal',
    cooldownMs: 400,
    variants: [
      (c) => ({
        relator: `¡AGONÍA Y DELIRIO EN EL MINUTO ${c.minute}! ¡GOOOOOOL DE ${(c.teamName || '').toUpperCase()}! ¡${c.playerName} desata la locura total sobre la hora!`,
        comentarista: `¡Así es el fútbol sudamericano! Cuando parecía que no quedaba tiempo para nada, aparece el héroe de la noche.`,
      }),
    ],
  },

  replay_analysis: {
    id: 'replay_analysis',
    priority: 7,
    excitement: 'high',
    cooldownMs: 3000,
    variants: [
      (c) => ({
        relator: `Ahí vemos la repetición en cámara lenta con los tres ángulos de televisión de la definición de ${c.playerName || 'la jugada'}.`,
        comentarista: `Fijate en la cámara detrás del arco la rosca que toma el balón y cómo el arquero queda totalmente sin reacción.`,
      }),
      (c) => ({
        relator: `Reiteramos la maniobra completa en la repetición oficial de la transmisión.`,
        comentarista: `En cámara lenta se aprecia perfecto el desmarque previo y el golpeo seco al rincón más lejano.`,
      }),
    ],
  },

  match_intro: {
    id: 'match_intro',
    priority: 8,
    excitement: 'high',
    cooldownMs: 10000,
    variants: [
      (c) => ({
        relator: `¡Señoras y señores, bienvenidos a una jornada inolvidable en el ${c.stadiumName || 'estadio'}! Ya están en cancha ${c.teamName} frente a ${c.opponentName}.`,
        comentarista: `Un placer enorme acompañarlos. Cancha rápida de ciento cinco por sesenta y ocho metros y dos equipos que prometen un partidazo.`,
      }),
      (c) => ({
        relator: `¡Hola, qué tal! Cómo les va... Explotan las tribunas del ${c.stadiumName || 'coliseo'} para recibir a ${c.teamName} contra ${c.opponentName}.`,
        comentarista: `Marco imponente en las gradas. Veremos quién logra imponer la presión alta desde el primer cuarto de hora.`,
      }),
    ],
  },

  kickoff: {
    id: 'kickoff',
    priority: 6,
    excitement: 'normal',
    cooldownMs: 4000,
    variants: [
      (c) => ({
        relator: `¡Pitazo del árbitro, ya rueda la pelota! Mueve ${c.teamName || 'el conjunto local'} y comienza la emoción.`,
        comentarista: `Ya vemos cómo se paran los dos bloques tácticos sobre el césped.`,
      }),
    ],
  },

  penalty_awarded: {
    id: 'penalty_awarded',
    priority: 9,
    excitement: 'high',
    cooldownMs: 1000,
    variants: [
      (c, spicy) => ({
        relator: `¡PENAAAL! ¡El árbitro señala el punto fatídico de los doce pasos a favor de ${c.teamName}!`,
        comentarista: spicy
          ? `¡Se vuelven locos todos! ¡La mitad del estadio festeja y la otra mitad insulta al juez sin parar!`
          : `Contacto claro abajo dentro del área cuando ya se perfilaba para definir.`,
        crowdChant: spicy ? pickCrowdInsult('referee') : undefined,
      }),
    ],
  },

  penalty_shootout_kick: {
    id: 'penalty_shootout_kick',
    priority: 8,
    excitement: 'high',
    cooldownMs: 1200,
    variants: [
      (c) => ({
        relator: `Camina hacia el punto penal el ejecutante de ${c.teamName}... tensión máxima desde los doce pasos.`,
        comentarista: `Duelo psicológico puro entre el pateador y los reflejos del arquero.`,
      }),
    ],
  },

  free_kick: {
    id: 'free_kick',
    priority: 5,
    excitement: 'normal',
    cooldownMs: 2500,
    variants: [
      (c) => ({
        relator: `Tiro libre peligroso para ${c.teamName}. Se acomoda la barrera y toma carrera ${c.playerName || 'el especialista'}.`,
        comentarista: `Distancia ideal para intentar pasarla con rosca por encima de la barrera.`,
      }),
    ],
  },

  corner: {
    id: 'corner',
    priority: 5,
    excitement: 'normal',
    cooldownMs: 2000,
    variants: [
      (c) => ({
        relator: `¡Tiro de esquina para ${c.teamName}! Suben las torres desde el fondo a buscar el cabezazo ganador.`,
        comentarista: `El balón detenido siempre es una llave maestra cuando el partido está cerrado.`,
      }),
    ],
  },

  advantage: {
    id: 'advantage',
    priority: 6,
    excitement: 'high',
    cooldownMs: 2000,
    variants: [
      (c) => ({
        relator: `¡Hubo falta pero el juez levanta ambos brazos y aplica una gran LEY DE VENTAJA para ${c.teamName}!`,
        comentarista: `Excelente criterio arbitral para no cortar un ataque que tenía superioridad numérica.`,
      }),
    ],
  },

  yellow_card: {
    id: 'yellow_card',
    priority: 7,
    excitement: 'high',
    cooldownMs: 1500,
    variants: [
      (c, spicy) => ({
        relator: `¡Tarjeta amarilla para ${c.playerName} en ${c.teamName}! Queda amonestado y condicionado.`,
        comentarista: spicy
          ? `¡Estaba pegando gratis desde hace rato y la tribuna le pedía la roja a los gritos!`
          : `Va a tener que medir cada cruce de ahora en adelante para no dejar a su equipo con diez.`,
        crowdChant: spicy ? pickCrowdInsult('rivalFoul') : undefined,
      }),
    ],
  },

  red_card: {
    id: 'red_card',
    priority: 9,
    excitement: 'goal',
    cooldownMs: 1000,
    variants: [
      (c, spicy) => ({
        relator: `¡TARJETA ROJA DIRECTA! ¡Expulsado ${c.playerName} y ${c.teamName} se queda con un hombre menos!`,
        comentarista: spicy
          ? `¡Se armó el tumulto generalizado y la hinchada lo despide con una lluvia de insultos camino al vestuario!`
          : `Una imprudencia tremenda que cambia por completo el planteo táctico del partido.`,
        crowdChant: spicy ? pickCrowdInsult('rivalFoul') : undefined,
      }),
    ],
  },

  offside: {
    id: 'offside',
    priority: 5,
    excitement: 'normal',
    cooldownMs: 2200,
    variants: [
      (c) => ({
        relator: `Bandera arriba del juez de línea: posición adelantada sancionada a ${c.playerName}.`,
        comentarista: `Picó medio segundo antes de que saliera el pase filtrado. Achicó bien hacia adelante la defensa.`,
      }),
    ],
  },

  substitution: {
    id: 'substitution',
    priority: 6,
    excitement: 'normal',
    cooldownMs: 1500,
    variants: [
      (c) => ({
        relator: `Modificación táctica en ${c.teamName}: ingresa con piernas frescas ${c.playerName}.`,
        comentarista: `Busca renovar el oxígeno y ganar explosión en los metros finales.`,
      }),
    ],
  },

  injury: {
    id: 'injury',
    priority: 7,
    excitement: 'high',
    cooldownMs: 2000,
    variants: [
      (c) => ({
        relator: `Quedó tendido sobre el césped ${c.playerName} con muestras de dolor.`,
        comentarista: `Veremos si puede continuar o si el cuerpo técnico tiene que mover el banco.`,
      }),
    ],
  },

  halftime: {
    id: 'halftime',
    priority: 8,
    excitement: 'high',
    cooldownMs: 3000,
    variants: [
      (c) => ({
        relator: `¡Pitazo del árbitro, final del primer tiempo! Nos vamos al descanso con ${c.teamName} ${c.homeScore}, ${c.opponentName} ${c.awayScore}.`,
        comentarista: `Primeros cuarenta y cinco minutos de altísimo voltaje táctico. Habrá mucho para ajustar en el vestuario.`,
      }),
    ],
  },

  second_half: {
    id: 'second_half',
    priority: 7,
    excitement: 'high',
    cooldownMs: 3000,
    variants: [
      (c) => ({
        relator: `¡Arranca el complemento! Quedan cuarenta y cinco minutos decisivos entre ${c.teamName} y ${c.opponentName}.`,
        comentarista: `Veremos quién toma la iniciativa ahora que el desgaste físico empieza a pesar.`,
      }),
    ],
  },

  added_time: {
    id: 'added_time',
    priority: 6,
    excitement: 'high',
    cooldownMs: 5000,
    variants: [
      (c) => ({
        relator: `El cuarto árbitro levanta el cartel luminoso: se van a jugar ${c.addedMinutes || 3} minutos más de descuento.`,
        comentarista: `Final abierto y dramático, nadie regala absolutamente nada.`,
      }),
    ],
  },

  extra_time: {
    id: 'extra_time',
    priority: 8,
    excitement: 'high',
    cooldownMs: 3000,
    variants: [
      () => ({
        relator: `¡Igualdad en el tiempo reglamentario! Nos vamos al alargue a puro corazón y dramatismo.`,
        comentarista: `Acá empieza a jugar la cabeza y la resistencia física de cada plantel.`,
      }),
    ],
  },

  fulltime: {
    id: 'fulltime',
    priority: 10,
    excitement: 'goal',
    cooldownMs: 1000,
    variants: [
      (c) => ({
        relator: `¡FINAL DEL PARTIDO, SEÑORAS Y SEÑORES! Ha terminado esta gran historia: ${c.teamName} ${c.homeScore}, ${c.opponentName} ${c.awayScore}.`,
        comentarista: `Un espectáculo digno de las grandes noches de fútbol. Se definió en los detalles.`,
      }),
    ],
  },
};

interface QueuedCommentaryAudio {
  id: string;
  priority: number;
  excitement: 'normal' | 'high' | 'goal';
  relatorText: string;
  comentaristaText?: string;
  crowdChantText?: string;
}

/**
 * MOTOR DE RELATO DE DOBLE VOZ CON GEMINI 3.8 TTS Y COLA CON PRIORIDAD + AUDIO DUCKING
 * Cero uso de window.speechSynthesis (eliminado por completo).
 */
export class CommentaryEngine {
  private settings: GameSettings['audio'] | null = null;
  private recentPhrases: string[] = [];
  private lastSpokenByType = new Map<CommentaryEventType, number>();
  private currentPriority = 0;
  private currentEndTime = 0;
  private onSubtitleCallback?: (sub: CommentarySubtitle) => void;

  private audioQueue: QueuedCommentaryAudio[] = [];
  private isPlayingAudio = false;
  private activeSourceNode: AudioBufferSourceNode | null = null;

  public setSettings(audio: GameSettings['audio']): void {
    this.settings = audio;
  }

  public setSubtitleListener(cb?: (sub: CommentarySubtitle) => void): void {
    this.onSubtitleCallback = cb;
  }

  public isSpicyModeEnabled(): boolean {
    return this.settings?.spicyCrowdMode !== false;
  }

  public buildPhrase(ctx: CommentaryContext): {
    line: DualVoiceLine;
    combinedText: string;
    entry: TemplateEntry;
  } {
    const entry = COMMENTARY_TEMPLATES[ctx.type] ?? COMMENTARY_TEMPLATES.pass;
    const pool = entry.variants;
    const spicy = this.isSpicyModeEnabled();

    let chosenLine = pool[0](ctx, spicy);
    for (let attempt = 0; attempt < pool.length; attempt++) {
      const idx = (attempt + Math.floor(Math.random() * pool.length)) % pool.length;
      const candidate = pool[idx](ctx, spicy);
      if (!this.recentPhrases.includes(candidate.relator)) {
        chosenLine = candidate;
        break;
      }
    }

    this.recentPhrases.push(chosenLine.relator);
    if (this.recentPhrases.length > 14) {
      this.recentPhrases.shift();
    }

    const combinedText = chosenLine.comentarista
      ? `🎙️ Relator: ${chosenLine.relator} — 🎧 Comentarista: ${chosenLine.comentarista}`
      : `🎙️ ${chosenLine.relator}`;

    return { line: chosenLine, combinedText, entry };
  }

  public trigger(ctx: CommentaryContext): CommentarySubtitle | null {
    const now = performance.now();
    const entry = COMMENTARY_TEMPLATES[ctx.type];
    if (!entry) return null;

    // Cooldown per event category
    const lastTypeTime = this.lastSpokenByType.get(ctx.type) ?? -99999;
    if (now - lastTypeTime < entry.cooldownMs) {
      return null;
    }

    // Priority check so low-priority pass calls don't interrupt a goal or shot call
    if (now < this.currentEndTime && entry.priority <= this.currentPriority) {
      return null;
    }

    this.lastSpokenByType.set(ctx.type, now);
    const { line, combinedText } = this.buildPhrase(ctx);
    const durationEstimateMs = Math.max(2100, combinedText.length * 46);
    this.currentPriority = entry.priority;
    this.currentEndTime = now + durationEstimateMs;

    const subtitle: CommentarySubtitle = {
      id: `${ctx.type}_${Math.round(now)}`,
      text: line.relator,
      comentaristaText: line.comentarista,
      crowdChantText: line.crowdChant,
      excitement: entry.excitement,
      timestamp: now,
    };

    this.onSubtitleCallback?.(subtitle);

    if (
      this.settings &&
      !this.settings.masterMuted &&
      this.settings.commentaryEnabled !== false &&
      this.settings.commentaryVolume > 0.02 &&
      typeof window !== 'undefined'
    ) {
      this.enqueueNeuralCommentary({
        id: subtitle.id,
        priority: entry.priority,
        excitement: entry.excitement,
        relatorText: line.relator,
        comentaristaText: line.comentarista,
        crowdChantText: line.crowdChant,
      });
    }

    return subtitle;
  }

  private enqueueNeuralCommentary(item: QueuedCommentaryAudio): void {
    // High priority events (goals, red cards, penalties) preempt current playback and clear lower-priority queue
    if (item.priority >= 9) {
      this.audioQueue = [item];
      if (this.activeSourceNode) {
        try {
          this.activeSourceNode.stop();
          this.activeSourceNode.disconnect();
        } catch {
          // ignore
        }
        this.activeSourceNode = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
      this.isPlayingAudio = false;
      void this.processAudioQueue();
      return;
    }

    // Keep queue bounded to max 2 items so commentary never lags behind live play
    if (this.audioQueue.length >= 2) {
      const lowestIdx = this.audioQueue.findIndex((q) => q.priority < item.priority);
      if (lowestIdx !== -1) {
        this.audioQueue.splice(lowestIdx, 1, item);
      }
    } else {
      this.audioQueue.push(item);
    }

    if (!this.isPlayingAudio) {
      void this.processAudioQueue();
    }
  }

  private async processAudioQueue(): Promise<void> {
    if (this.isPlayingAudio || this.audioQueue.length === 0) return;
    const nextItem = this.audioQueue.shift();
    if (!nextItem) return;

    this.isPlayingAudio = true;

    try {
      // Trigger crowd chant reaction in parallel if spicy crowd mode produced a chant
      if (nextItem.crowdChantText && this.isSpicyModeEnabled()) {
        soundEngine.trigger('foul_boo');
      }

      await this.speakWithBrowserSynthesis(nextItem);
    } catch {
      // Fallback: keep subtitle visible and restore ducking cleanly
    } finally {
      soundEngine.setCommentaryDucking(false);
      this.isPlayingAudio = false;
      if (this.audioQueue.length > 0) {
        void this.processAudioQueue();
      }
    }
  }

  private async speakWithBrowserSynthesis(item: QueuedCommentaryAudio): Promise<void> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const commVol = this.settings?.commentaryVolume ?? 0.9;
    if (commVol <= 0.01 || this.settings?.masterMuted || !this.settings?.commentaryEnabled) return;

    const synth = window.speechSynthesis;
    const voices = synth.getVoices();
    const esVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('es'));
    const relatorVoice =
      esVoices.find((v) => v.lang.includes('AR') || v.lang.includes('419') || v.lang.includes('MX')) ??
      esVoices[0] ??
      null;
    const comentaristaVoice =
      esVoices.length > 1
        ? esVoices.find((v) => v !== relatorVoice) ?? esVoices[0]
        : relatorVoice;

    soundEngine.setCommentaryDucking(true);

    const speakUtterance = (
      text: string,
      voice: SpeechSynthesisVoice | null,
      rate: number,
      pitch: number
    ) =>
      new Promise<void>((resolve) => {
        if (!text || this.settings?.masterMuted) {
          resolve();
          return;
        }
        try {
          const u = new SpeechSynthesisUtterance(text);
          u.lang = voice?.lang || 'es-AR';
          if (voice) u.voice = voice;
          u.volume = Math.max(0.1, Math.min(1.0, commVol));
          u.rate = rate;
          u.pitch = pitch;
          const timeoutId = window.setTimeout(() => resolve(), 6500);
          u.onend = () => {
            window.clearTimeout(timeoutId);
            resolve();
          };
          u.onerror = () => {
            window.clearTimeout(timeoutId);
            resolve();
          };
          synth.speak(u);
        } catch {
          resolve();
        }
      });

    const relatorRate =
      item.excitement === 'goal'
        ? 1.22
        : item.excitement === 'high'
        ? 1.16
        : 1.08;
    const relatorPitch =
      item.excitement === 'goal'
        ? 1.18
        : item.excitement === 'high'
        ? 1.1
        : 1.02;

    await speakUtterance(item.relatorText, relatorVoice, relatorRate, relatorPitch);
    if (item.comentaristaText && item.priority >= 6) {
      await speakUtterance(item.comentaristaText, comentaristaVoice, 1.04, 0.92);
    }
  }

  private async playWavBase64(base64Wav: string): Promise<void> {
    const ctx = soundEngine.getAudioContext();
    if (!ctx) return;

    const commVol = this.settings?.commentaryVolume ?? 0.9;
    if (commVol <= 0.01 || this.settings?.masterMuted) return;

    const binary = atob(base64Wav);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));

    // Activate automatic audio ducking while commentators speak
    soundEngine.setCommentaryDucking(true);

    await new Promise<void>((resolve) => {
      const src = ctx.createBufferSource();
      src.buffer = audioBuffer;

      // Broadcast compressor/EQ warmth
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 110;

      const gain = ctx.createGain();
      gain.gain.value = Math.min(1.2, commVol * 1.05);

      src.connect(filter).connect(gain).connect(ctx.destination);
      this.activeSourceNode = src;

      src.onended = () => {
        if (this.activeSourceNode === src) {
          this.activeSourceNode = null;
        }
        resolve();
      };

      src.start();
    });
  }

  public stop(): void {
    this.audioQueue = [];
    if (this.activeSourceNode) {
      try {
        this.activeSourceNode.stop();
        this.activeSourceNode.disconnect();
      } catch {
        // ignore
      }
      this.activeSourceNode = null;
    }
    this.isPlayingAudio = false;
    soundEngine.setCommentaryDucking(false);
  }
}

export const commentaryEngine = new CommentaryEngine();
