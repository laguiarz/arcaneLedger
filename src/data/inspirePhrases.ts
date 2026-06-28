/**
 * Inspire-phrase decks. A Resource with `inspirePhraseDeck: "<key>"` shows a
 * sparkle button in the UI that opens a modal letting the user pick a tag
 * (combat or task) and 1 or 5 phrases at a time. Used phrases are tracked
 * per (deck, tag) pair in localStorage so phrases don't repeat until each
 * pool is exhausted (see src/lib/inspirePhraseRotation.ts).
 *
 * Tags:
 *   - "combat": battle, dying gloriously, striking, wounds, last stands.
 *   - "task":   skill checks, social, perception, exploration, creation.
 * A phrase tagged with both shows up in either pool (separately tracked).
 *
 * Adding more phrases to an existing deck is safe — used markers reference
 * the phrase text, so reordering or deleting won't break rotation.
 */

export type InspireTag = "combat" | "task";

export interface InspirePhrase {
  text: string;
  tags: InspireTag[];
}

const BOTH: InspireTag[] = ["combat", "task"];
const COMBAT: InspireTag[] = ["combat"];
const TASK: InspireTag[] = ["task"];

export const inspirePhraseDecks: Record<string, InspirePhrase[]> = {
  // Lyari Mistweaver — optimistic, dreamy, in awe of the world's details.
  // Sees beauty in the dark, calls allies into their hero moments.
  lyari: [
    { text: "Ahora — ahora es cuando te convertis en leyenda.", tags: BOTH },
    { text: "El peligro es real, pero el miedo... el miedo es la ilusión más burda de todas.", tags: BOTH },
    { text: "Adelante, héroe — la canción ya empezó, sólo tenés que cantarla.", tags: BOTH },
    { text: "Las páginas en blanco se vuelven hacia vos. Escribí algo hermoso.", tags: TASK },
    { text: "Una vez en la vida hay un instante así. Es éste.", tags: BOTH },
    { text: "Hasta en la noche más cerrada hay una grieta por donde se cuela el alba.", tags: BOTH },
    { text: "Donde otros ven oscuridad yo veo el contraste perfecto para tu luz.", tags: BOTH },
    { text: "Si te te tiembla la mano — pensa que no es miedo, es coraje pidiendo permiso.", tags: BOTH },
    { text: "Tu corazón ya conoce el camino. Sólo dejá que tus pies escuchen.", tags: TASK },
    { text: "El mundo es enorme y aun así te hizo lugar a vos.", tags: BOTH },
    { text: "Estamos rotos, sí. Pero un espejo roto refleja la luz en mil direcciones más que uno entero.", tags: BOTH },
    { text: "Hay un canto antiguo que dice tu nombre. Cantalo de vuelta.", tags: BOTH },
    { text: "Cerrá los ojos. Acordate quién sos y lo que esta en juego. Ahora abrilos y vamos con toda.", tags: COMBAT },
    { text: "Que el miedo sea el cincel que le dé forma a su determinación.", tags: BOTH },
    { text: "Yo creo en vos como creo en el alba. Sin pruebas, con certeza.", tags: BOTH },
    { text: "El viento sabe canciones que olvidamos. Dejá que te las recuerde.", tags: TASK },
    { text: "Confío en tus manos como confío en las raíces de un viejo árbol.", tags: BOTH },
    { text: "Aún en invierno, debajo de la nieve, las semillas sueñan. Soñá fuerte.", tags: TASK },
    { text: "El sol no decide salir — simplemente sale. Sé como el sol.", tags: BOTH },
    { text: "El destino vino a buscarte de lejos. No lo hagás esperar.", tags: BOTH },
    { text: "Si las palabras no alcanzan, hablá con los hechos.", tags: COMBAT },
    { text: "El miedo es la sombra del coraje. Donde hay uno, hay el otro.", tags: BOTH },
    { text: "Aún en la peor tormenta, el ojo es calma. Sé ojo de tormenta.", tags: COMBAT },
    { text: "Algunas batallas se ganan con la sonrisa. Probá.", tags: BOTH },
    { text: "El que tiene un porqué resiste cualquier cómo. Tu porqué te está mirando.", tags: BOTH },
    { text: "Si el destino nos ha elegido para morir hoy, que sea con una historia que haga palidecer a los poetas", tags: COMBAT },
    { text: "Aún el desierto florece una vez por década. Hoy es esa vez.", tags: BOTH },
    { text: "Si este fuese el último canto, que sea digno de ser oído.", tags: COMBAT },
    { text: "Pintá tu nombre en el aire con esta acción.", tags: BOTH },
    { text: "Hay constelaciones que todavía no fueron nombradas. Una se va a llamar como vos.", tags: BOTH },
    { text: "Si hemos de caer, caigamos como estrellas: incendiando el cielo para que todos sepan que pasamos por aquí.", tags: COMBAT },
    { text: "Mirá las manos de los héroes — son comunes, iguales a las tuyas, vos podes ser un heroe...", tags: BOTH },
    { text: "Hay tormentas que sólo existen para que después haya arcoíris. Esta es una.", tags: BOTH },
    { text: "Lo efímero no es menor por ser breve.", tags: BOTH },
    { text: "Aun cuando todo parece quieto, las raíces crecen. Estás creciendo.", tags: TASK },
    { text: "El viento está de tu lado. Lo sabe el viento, lo sabés vos.", tags: BOTH },
    { text: "El destino es una piedra sin tallar, fría y muda. Solo aquellos con manos firmes y ojos claros verán la forma que respira en su interior.", tags: TASK },
    { text: "Que esta herida sea el precio de una victoria memorable.", tags: COMBAT },
    { text: "Te miro y veo un poema que todavía no terminó. Escribí el siguiente verso.", tags: BOTH },
    { text: "El mundo ha sido herido muchas veces y aún canta. Haz lo mismo.", tags: BOTH },
    { text: "Una chispa basta para incendiar la historia. Hay leyendas que empiezan con menos que esto.", tags: BOTH },
    { text: "Aun quebrada, la rama sostiene hojas nuevas. Así también vos.", tags: BOTH },
    { text: "El mundo no necesita explicación de tu acto. Necesita el acto.", tags: BOTH },
    { text: "Yo te vi en sueños. Eras enorme. Hacete cargo.", tags: BOTH },
    { text: "Que tu golpe deje eco en generaciones que aún no nacen.", tags: COMBAT },
    { text: "Aún las cosas pequeñas tienen alma — y tu acción de ahora también.", tags: BOTH },
    { text: "Porta tu esperanza como otros portan acero.", tags: BOTH },
    { text: "Antes que tú hubo héroes; después de ti habrá historias.", tags: BOTH },
    { text: "Hasta la luna se levanta despacio — pero llega. Llegá.", tags: BOTH },
    { text: "Ninguna hoja pregunta si caer vale la pena. Solo danza en el viento.", tags: TASK },
    { text: "No luchas solo por hoy, sino por todo lo que vendrá después", tags: COMBAT },
    { text: "Cuando el mundo se sienta frío, soplá tu calor sobre él.", tags: BOTH },
    { text: "Camina sin temor; la senda reconoce a los valientes.", tags: TASK },
    { text: "Que se acuerden de hoy. Que se acuerden de vos.", tags: BOTH },
    { text: "Mirá hacia el horizonte: sí, eso que late ahí, eso es para vos.", tags: BOTH },
    { text: "El mármol teme al cincel hasta descubrir su forma.", tags: TASK },
    { text: "Hay antiguas luces que aún arden en tu sangre. Recuérdalo.", tags: BOTH },
    { text: "Lo real está sobrevalorado. Vos podes dar algo mejor.", tags: TASK },
    { text: "Que su voluntad sea tan firme como la montaña y su mente tan vasta como el océano que la rodea. El resto es solo ruido.", tags: BOTH },
    { text: "Mira tus manos. Parecen carne y hueso, pero son el cincel de la creación. Si crees que no puedes, es porque aún no has decidido darle forma el mundo", tags: BOTH },
    { text: "Nuestro pueblo ha visto mundos nacer de un susurro y morir en un parpadeo. Lo que llamamos 'imposible' es solo una falta de imaginación de los mortales.", tags: BOTH },
    // Lote pícaro — mismo corazón de Lyari, pero con una sonrisa de costado:
    // ingenio, aplomo y encanto de bardo, sin perder la elegancia.
    { text: "Tu enemigo se levantó hoy con una sola mala idea: cruzarse en tu camino.", tags: COMBAT },
    { text: "No es presumir si después lo cumplís. Y lo vas a cumplir.", tags: BOTH },
    { text: "Pegá primero; la disculpa siempre llega elegante y tarde.", tags: COMBAT },
    { text: "Que tu confianza sea tan grande que el dado se sienta observado.", tags: BOTH },
    { text: "Hacé que parezca fácil. Ya tendrás tiempo de contar lo difícil que fue.", tags: BOTH },
    { text: "La elegancia es saber caer y que parezca una reverencia.", tags: BOTH },
    { text: "Sonreí antes de actuar: media batalla se gana con buenos modales y mala intención.", tags: BOTH },
    { text: "Si vas a equivocarte, hacelo con tanto aplomo que nadie se anime a corregirte.", tags: TASK },
    { text: "El destino respeta a los audaces y se ríe con los ingeniosos. Sé las dos cosas.", tags: BOTH },
    { text: "No necesitás suerte. La suerte te necesita a vos para tener buena prensa.", tags: BOTH },
    { text: "Entrá como si el lugar te hubiera estado esperando. Probablemente sí.", tags: TASK },
    { text: "Que tu enemigo recuerde dos cosas: tu nombre y el error de haberlo olvidado.", tags: COMBAT },
    { text: "Improvisá con tanto estilo que hasta el plan original te tenga envidia.", tags: BOTH },
    { text: "Un buen golpe resuelve el presente; una buena frase, la leyenda. Hay tiempo para ambas.", tags: COMBAT },
    { text: "Caminá como si la alfombra roja fuera invisible — pero estuviera ahí.", tags: TASK },
    { text: "El talento abre puertas; el descaro las mantiene abiertas. Tenés las dos llaves.", tags: BOTH },
    // Lote en rima — coplas sueltas, más cantadas que dichas, para que suenen
    // vivas y no a frase armada. La barra (/) marca el corte del verso.
    { text: "El que te subestima / no llega ni a la esquina.", tags: COMBAT },
    { text: "Filo, ritmo y desparpajo: / hoy el miedo va por abajo.", tags: COMBAT },
    { text: "Pegá con calma y sin demora, / que la leyenda se escribe ahora.", tags: COMBAT },
    { text: "Si la cosa se pone fea, / que tu nombre sea la pelea.", tags: COMBAT },
    { text: "Un paso firme, un guiño fino, / y el azar se vuelve tu vecino.", tags: TASK },
    { text: "Pensá rápido, hablá mejor: / la calle es de quien tiene labia y honor.", tags: TASK },
    { text: "No hay cerradura ni desafío / que aguante tu estilo y tu brío.", tags: TASK },
    { text: "Caminá liviano, mirá derecho, / que el mundo se acomoda a tu provecho.", tags: TASK },
    { text: "Si caés, caé con gracia y sin drama, / que hasta el tropiezo te suma a la fama.", tags: BOTH },
    { text: "Tirá el dado, soltá la mano, / que la suerte sigue al que va ufano.", tags: BOTH },
    { text: "Que digan misa, que digan lo que sea: / vos seguí brillando en la pelea.", tags: BOTH },
    { text: "No vine a pedir permiso ni perdón, / vine a ponerle música a la ocasión.", tags: BOTH },
    { text: "Poné el cuerpo, poné el alma, / que tras la tormenta llega tu calma.", tags: BOTH },
    // Coplas cortas y filosas, estilo "El que te ___ / no llega ni a ___":
    // burn breve, dos versos, puro desparpajo.
    { text: "El que se hace el guapo / se vuelve con un trapo.", tags: COMBAT },
    { text: "El que te encara / se va sin la cara.", tags: COMBAT },
    { text: "El que te corre / no llega ni a la torre.", tags: COMBAT },
    { text: "El que te apunta / se queda sin la punta.", tags: COMBAT },
    { text: "El que se te planta / pierde hasta la garganta.", tags: COMBAT },
    { text: "El que viene de malón / se lleva una lección.", tags: COMBAT },
    { text: "El que duda en la movida / ya entregó la partida.", tags: BOTH },
    { text: "El que te quiere engañar / se va sin nada que contar.", tags: TASK },
    { text: "Al que intenta enredarte / lo desarmás sin despeinarte.", tags: TASK },
    { text: "El que dijo que no podías / se come todas sus teorías.", tags: BOTH },
  ],
  // Brunella — High Elf erudita, acólita y calígrafa. Habla en aforismos sobre
  // crónicas, tinta, archivos, historia y fe; ingeniosa y cálida, con la
  // serenidad de quien ya leyó cómo terminan mil leyendas.
  brunella: [
    { text: "Cada gesta empieza siendo una nota al margen. Escribí la tuya.", tags: BOTH },
    { text: "He leído mil crónicas de héroes; ninguno se sentía héroe el día que lo fue.", tags: BOTH },
    { text: "La historia no recuerda a los que dudaron. Avanzá.", tags: BOTH },
    { text: "Hay una palabra exacta para este instante, y es: ahora.", tags: BOTH },
    { text: "Los archivos están llenos de imposibles que alguien, terco, volvió ciertos.", tags: BOTH },
    { text: "El miedo es apenas una nota al pie. El texto principal lo escribís vos.", tags: BOTH },
    { text: "Conozco el final de muchas leyendas. La tuya todavía la estás dictando.", tags: BOTH },
    { text: "Un buen golpe vale por tres tratados.", tags: COMBAT },
    { text: "Que la crónica de hoy se escriba con la tinta del enemigo.", tags: COMBAT },
    { text: "Respirá: hasta los santos firmaban con el pulso temblando.", tags: BOTH },
    { text: "El conocimiento pesa, pero también sostiene. Apoyate en lo que sabés.", tags: TASK },
    { text: "Detalle por detalle se desarma cualquier cerradura del mundo.", tags: TASK },
    { text: "Que no te tiemble la mano: la posteridad copia con prolijidad lo que hoy hagas bien.", tags: TASK },
    { text: "Ningún manuscrito que valga la pena se escribió sin mancharse los dedos.", tags: BOTH },
    { text: "Acordate: el dragón también figura en la crónica… del lado de los vencidos.", tags: COMBAT },
    { text: "Sé de bibliotecas enteras dedicadas a un solo instante de coraje. Dame el tuyo.", tags: BOTH },
    { text: "Lo que no sabés lo improvisás con elegancia. Es casi lo mismo, y a veces mejor.", tags: TASK },
    { text: "Las grandes verdades se dijeron en voz baja y firme. Así, justo así.", tags: BOTH },
    { text: "Toda nota al pie sueña con ser título. Hoy te toca el título.", tags: BOTH },
    { text: "He catalogado peores augurios que éste, y siguen sin cumplirse. Adelante.", tags: COMBAT },
  ],
};

export function getInspirePhraseDeck(name: string): InspirePhrase[] | undefined {
  return inspirePhraseDecks[name];
}
