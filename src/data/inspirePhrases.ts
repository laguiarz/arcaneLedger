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
  /** Optional Forgotten Realms lore that inspired the phrase. Shown small,
   *  in parentheses, so a curious player can ask Brunella "contame más". */
  lore?: string;
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
  // Brunella — High Elf bardo del Colegio del Saber. Canta a Myth Drannor, la
  // "Ciudad del Canto", y a la historia élfica de Cormanthyr: aforismos y versos
  // (la barra / marca el verso) con la serenidad de quien ya cantó mil gestas.
  brunella: [
    // Lote musical / élfico — la "Ciudad del Canto", Myth Drannor: rimas y
    // referencias a la historia élfica (el mythal, los Cantaespadas, el Coronal
    // Eltargrim y la Apertura, la Guerra de las Lágrimas, el capitán Fflar, la
    // Srinshee, Cormanthyr, el Retiro a Evermeet). La barra (/) marca el verso.
    {
      text: "En la Ciudad del Canto la guerra se libraba en clave: / cada estocada una nota, cada nota algo grave.",
      tags: COMBAT,
      lore: "Myth Drannor era llamada la Ciudad del Canto; sus Cantaespadas fundían música, magia y esgrima.",
    },
    {
      text: "Como Cantaespadas de Cormanthyr: / la hoja es el verso y el verso, el porvenir.",
      tags: COMBAT,
      lore: "Los Cantaespadas (bladesingers) élficos unían danza, hechicería y espada en un solo arte marcial.",
    },
    {
      text: "Fflar sostuvo la línea hasta el último compás. / Sostené la tuya: la balada hace el resto, y más.",
      tags: COMBAT,
      lore: "El capitán Fflar Starbrow Melruth lideró la defensa de Myth Drannor en la Guerra de las Lágrimas.",
    },
    {
      text: "Que tu defensa sea un mythal: trama de luz que ningún mal traspasa.",
      tags: COMBAT,
      lore: "El mythal era el escudo mágico que envolvía Myth Drannor, tejido por sus archimagos.",
    },
    {
      text: "No es la espada la que sostiene el reino, sino la mano que se niega a soltarla.No es la muralla la que guarda la memoria,sino el corazón que rehúsa olvidarla.",
      tags: COMBAT,
      lore: "La Guerra de las Lágrimas (711–714 DR) fue la caída de Myth Drannor ante el Ejército de la Oscuridad.",
    },
    {
      text: "Si hay que caer, cae como cayó Myth Drannor: / tan alto que aún hoy se la nombra con honor.",
      tags: COMBAT,
      lore: "Myth Drannor cayó en 714 DR, pero su esplendor la volvió legendaria por milenios.",
    },
    {
      text: "Bladesinger no separa la danza de la batalla. / Que tu acto sea las dos, y que nada te falla.",
      tags: COMBAT,
      lore: "El Canto de Espadas élfico no distingue al bailarín del guerrero: son una misma cosa.",
    },
    {
      text: "Que hoy nuestras espadas escriban el verso que mañana otros cantarán.",
      tags: COMBAT,
      lore: "",
    },
    {
      text: "Srinshee esperó el momento sin perder la calma. / Esperá el tuyo: la paciencia también es un arma.",
      tags: TASK,
      lore: "La Srinshee fue una legendaria maga élfica de Cormanthyr, guardiana de la Corona del Coronal.",
    },
    {
      text: "El mythal se tejió hilo por hilo, sin apuro. / Tejé tu obra igual: paso firme y pulso seguro.",
      tags: TASK,
      lore: "Tejer un mythal llevaba años de trabajo mágico coordinado entre muchos archimagos.",
    },
    {
      text: "En la Corte Élfica pesaba cada palabra dicha. / Elegí bien la tuya y se abre cualquier rendija.",
      tags: TASK,
      lore: "La corte del Coronal de Cormanthyr regía con ceremonia y diplomacia milenaria.",
    },
    {
      text: "Los N'Vaelahr cuidaban la ciudad desde la sombra. / Sé esa vigilia fina que protege y no se nombra.",
      tags: TASK,
      lore: "Los N'Vaelahr eran los agentes secretos de Cormanthyr: espías y guardianes en las sombras.",
    },
    {
      text: "Afiná el alma como afinaban el mythal: / un solo tono falso y se cae el portal. No falles.",
      tags: TASK,
      lore: "Sostener un mythal exigía precisión absoluta: un error podía colapsar toda su trama.",
    },
    {
      text: "Un verso bien puesto desarma más que un ejército entero.",
      tags: TASK,
      lore: "En la Ciudad del Canto la palabra y la música tenían tanto poder como la espada.",
    },
    {
      text: "Eltargrim abrió la ciudad y nació una era. / Abrí vos esta puerta; el mundo entero espera.",
      tags: BOTH,
      lore: "El Coronal Eltargrim decretó la Apertura (~261 DR), admitiendo a otras razas en Myth Drannor.",
    },
    {
      text: "Myth Drannor ardió, pero su canción no: / lo que de veras se canta nunca se apagó.",
      tags: BOTH,
      lore: "Aun tras su destrucción, el recuerdo y las canciones de Myth Drannor perduraron en Faerûn.",
    },
    {
      text: "Los elfos zarparon a Evermeet y el bosque siguió en flor. / Aun en la pérdida hay música. Seguí, cantor.",
      tags: BOTH,
      lore: "En El Retiro, muchos elfos de Faerûn navegaron a la isla de Evermeet, su refugio ancestral.",
    },
    {
      text: "Toda gesta élfica empezó con un verso a media voz. / Decí el tuyo, y que retumbe veloz.",
      tags: BOTH,
      lore: "La tradición élfica preservaba sus gestas en canto antes que en piedra o tinta.",
    },
    {
      text: "Si el mythal te abriga el corazón, / no hay sombra que silencie tu canción.",
      tags: BOTH,
      lore: "El mythal de Myth Drannor no solo defendía: era símbolo del alma misma de la ciudad.",
    },
    {
      text: "De Cormanthyr al alba que vendrá, / tu nombre en la balada quedará.",
      tags: BOTH,
      lore: "Cormanthyr fue el gran imperio élfico del bosque de Cormanthor, con Myth Drannor por joya.",
    },
    {
      text: "Hubo lágrimas, y aun así floreció. / Florecé vos también: la larga noche pasó.",
      tags: BOTH,
      lore: "Pese a la devastación de la Guerra de las Lágrimas, la vida élfica del bosque resurgió con el tiempo.",
    },
    {
      text: "Cada coronal pasó, y la corona siguió cantando sola. / Lo que importa sobrevive a quien lo porta. Va la ola.",
      tags: BOTH,
      lore: "Cormanthyr fue regido por una sucesión de Coronales, elegidos por la Espada-Corona.",
    },
    {
      text: "La belleza de Myth Drannor no estaba en sus torres / sino en que se atrevió. Atrevete y no te borres.",
      tags: BOTH,
      lore: "La grandeza de Myth Drannor nació de atreverse a unir razas y artes nunca antes reunidas.",
    },
    {
      text: "Lo que Netheril derribó, la memoria lo volvió a levantar. Levantate igual.",
      tags: BOTH,
      lore: "Netheril fue el legendario imperio de magos humanos; su caída es emblema de toda gloria perdida y recordada.",
    },
    {
      text: "Donde hubo una Ciudad del Canto puede haber otra. Empezá a cantar.",
      tags: BOTH,
      lore: "Siglos después de su caída, Myth Drannor fue refundada por los elfos retornados a Cormanthor.",
    },
    // Personajes y eventos de la Guerra de las Lágrimas y la caída.
    {
      text: "Fflar cruzó el acero con Aulmpiter sin pestañear. / Cruzá vos el tuyo: el miedo no sabe rimar.",
      tags: COMBAT,
      lore: "El capitán Fflar cayó en duelo contra Aulmpiter, general nycaloth, en la batalla final por la ciudad.",
    },
    {
      text: "Tres generales de sombra sitiaron la Ciudad del Canto. / La canción no se rindió, y eso pudo tanto.",
      tags: COMBAT,
      lore: "Tres generales nycaloth —Aulmpiter, Gaulguth y Malimshaer— comandaron el Ejército de la Oscuridad.",
    },
    {
      text: "Contra el Ejército de la Oscuridad cada elfo valió por cien. / Valé vos por mil: la balada lo escribe bien.",
      tags: COMBAT,
      lore: "El Ejército de la Oscuridad fue la horda de demonios y monstruos que asoló Cormanthyr en la Guerra de las Lágrimas.",
    },
    {
      text: "El nigromante alado tardó una guerra entera en caer. / Lo imposible también cae: empujá, que está por ceder.",
      tags: COMBAT,
      lore: "Los nycaloth eran demonios alados; vencerlos le costó a Cormanthyr toda la Guerra de las Lágrimas.",
    },
    {
      text: "La Srinshee guardó la corona hasta hallar mano leal. / Esperá tu momento: la paciencia no tiene rival.",
      tags: TASK,
      lore: "Al caer la ciudad, la Srinshee reclamó la Espada-Corona y desapareció, hecha leyenda.",
    },
    {
      text: "Aquí Elminster aprendió que la magia es paciencia con chispa. / Respirá, observá, y que la idea justa no se disipa.",
      tags: TASK,
      lore: "Elminster Aumar pasó su juventud entre los elfos de Cormanthyr, formándose como mago.",
    },
    {
      text: "Siglos después unos pocos volvieron a las ruinas a soñar. / Donde otros vieron escombros, ellos vieron lugar.",
      tags: BOTH,
      lore: "Tras siglos en ruinas, aventureros como los Caballeros de Myth Drannor volvieron a explorarla y liberarla.",
    },
    {
      text: "Cormanthor sigue verde sobre la ciudad dormida. / Lo bello echa raíz aun bajo la herida.",
      tags: BOTH,
      lore: "Cormanthor es el vasto bosque que rodeaba Myth Drannor; sobrevivió a la caída de la ciudad.",
    },
    // Crónicas de las hojas legendarias — las tres Espadas Élficas de Cormanthyr.
    {
      text: "La Espada-Corona no eligió al más fuerte sino al más digno. / Pelea como quien ya fue elegido: sé tu propio signo.",
      tags: COMBAT,
      lore: "La Espada-Corona (Crownblade), una de las tres Espadas Élficas, elegía y probaba al Coronal.",
    },
    {
      text: "La Warblade cantaba al desenvainar. / Dale al filo de tu espada algo que contar.",
      tags: COMBAT,
      lore: "La Hoja de Guerra (Warblade) era una de las tres Espadas Élficas de Cormanthyr, ligada a la defensa.",
    },
    {
      text: "La Hoja del Arte no cortaba: revelaba lo bello escondido. / Mirá distinto el problema y verás por dónde ha cedido.",
      tags: TASK,
      lore: "La Hoja del Arte (Artblade), tercera de las Espadas Élficas, encarnaba la creación más que la destrucción.",
    },
    // Versos de gesta — fragmentos de la balada de la Ciudad del Canto.
    {
      text: "Dice la balada: 'cantó el elfo al filo del final, / y el final, por respeto, se hizo menos mortal'. Cantá igual.",
      tags: BOTH,
      lore: "Las baladas élficas sobre Myth Drannor cantan tanto su gloria como su caída.",
    },
    {
      text: "La gesta no la hace el que nunca temió, / sino el que tembló, cantó, y aun así no aflojó.",
      tags: BOTH,
      lore: "Los héroes de la Ciudad del Canto no eran intrépidos: eran quienes vencían su miedo cantando.",
    },
    {
      text: "Un mythal no se alza en un día ni con una sola voz. / Sumá la tuya al coro: lo demás lo hace el reloj.",
      tags: BOTH,
      lore: "Levantar el mythal de Myth Drannor fue obra colectiva de muchos magos a lo largo de años.",
    },
    // Ronda con lore — referencias a Cormanthyr y Myth Drannor, con la nota
    // histórica (entre paréntesis, en letra chica) para el que quiera saber más.
    {
      text: "En la Torre del Canto del Viento la magia se estudiaba como música. / Estudiá tu jugada igual: cada gesto, una rúbrica.",
      tags: TASK,
      lore: "La Torre del Canto del Viento (Windsong Tower) fue la gran academia de magia de Myth Drannor.",
    },
    {
      text: "Los Akh'Faer entraban en batalla cantando sus conjuros. / Que tu hechizo rime con tu voluntad y no habrá muros.",
      tags: COMBAT,
      lore: "Los Akh'Faer eran la hueste de magos de guerra de Cormanthyr; los Akh'Velahr, su ejército regular.",
    },
    {
      text: "En la Piedra Erecta elfos y humanos sellaron su pacto. / Buscá vos también la alianza: la palabra justa es flecha de acto.",
      tags: TASK,
      lore: "La Piedra Erecta (Standing Stone) marcó en el Año 1 DR el pacto entre los elfos de Cormanthor y los Dalesmen.",
    },
    {
      text: "Los baelnorn aún velan las tumbas que el mundo olvidó. / Velá tu carga con esa misma fe: lealtad que no expiró.",
      tags: TASK,
      lore: "Los baelnorn son liches élficos benévolos que custodian las criptas de Cormanthyr durante siglos.",
    },
    {
      text: "Tras la caída, en el Lugar de la Danza nacieron Los que Tañen el Arpa. / De toda ruina brota un arpa: tañé la tuya, que no se te escapa.",
      tags: BOTH,
      lore: "Los Arpistas (Harpers) se fundaron en 720 DR, en el Dancing Place cerca de Myth Drannor, para preservar el saber.",
    },
    {
      text: "Josidiah Starym buscó la Hoja del Arte y halló su propio valor. / Buscá vos el tuyo: el arma despierta al que ya es valedor.",
      tags: COMBAT,
      lore: "Josidiah Starym, héroe Cormanthyrano, recuperó la Hoja del Arte (Artblade) en la era fundacional de la ciudad.",
    },
    {
      text: "Los demonios alados volvieron por venganza tras siglos de cadena. / Que el rencor del enemigo sea su grieta, no tu condena.",
      tags: COMBAT,
      lore: "Los nycaloth que arrasaron Myth Drannor habían sido encadenados siglos antes y regresaron por venganza.",
    },
    {
      text: "Aquí el enano forjaba junto al elfo cantor. / Lo mejor nace cuando se suman manos de distinto don y color.",
      tags: BOTH,
      lore: "Tras la Apertura, enanos, gnomos, humanos y medianos llevaron sus artes a Myth Drannor; su orfebrería fue legendaria.",
    },
    {
      text: "La Espada-Corona probaba el corazón, no el linaje, del que la alzaba. / Mostrá el tuyo sin miedo: lo que sos pesa más que de dónde llegabas.",
      tags: TASK,
      lore: "La Espada-Corona (Crownblade) elegía al Coronal probando su alma; el linaje por sí solo no bastaba.",
    },
    {
      text: "Cuando murió Eltargrim, la corona quedó sin frente que ceñir. / Un vacío también es una oportunidad: andá vos a cubrir.",
      tags: BOTH,
      lore: "Tras la muerte de Eltargrim (661 DR) la Espada-Corona no eligió sucesor y Cormanthyr quedó debilitado.",
    },
    {
      text: "El mythal dejaba volar al digno y cegaba al que venía a hacer mal. / Aprendé las reglas del lugar y jugalas: el saber es tu mythal.",
      tags: TASK,
      lore: "El mythal de Myth Drannor imponía reglas mágicas: permitía volar a algunos y vedaba ciertos conjuros y razas hostiles.",
    },
    {
      text: "Dicen que sus torres crecían como cantadas, no construidas. / Hacé tu obra así: que parezca nacida, no sufrida.",
      tags: BOTH,
      lore: "Las torres de Myth Drannor, alzadas con magia élfica, parecían más crecidas que edificadas.",
    },
    {
      text: "Cuando cayó, sellaron la ciudad con su música adentro. / Pelea para que ninguna voz tuya quede presa en el encierro.",
      tags: COMBAT,
      lore: "Tras la caída de 714 DR, Myth Drannor quedó sellada y plagada de demonios durante siglos.",
    },
    {
      text: "Toda gran magia de aquí llevaba la bendición de la Dama de los Misterios. / Confiá: hay una mano mayor sosteniendo tus tanteos serios.",
      tags: TASK,
      lore: "Los mythals se tejían con la gracia de Mystra (Mystryl), diosa de la magia y patrona de Elminster.",
    },
    {
      text: "La llamaron Guerra de las Lágrimas porque hasta los fuertes lloraron. / Llorá si hay que llorar, pero cantando: así los bravos pelearon.",
      tags: BOTH,
      lore: "La Guerra de las Lágrimas (711–714 DR) se llamó así por el duelo inmenso que dejó la caída de la ciudad.",
    },
    {
      text: "No todos zarparon a Evermeet: algunos eligieron quedarse a recordar. / Sé memoria viva: hay un coraje quieto en no olvidar.",
      tags: BOTH,
      lore: "Durante El Retiro a Evermeet muchos elfos partieron, pero algunos permanecieron como guardianes del recuerdo.",
    },
    {
      text: "Gaulguth sembró ruina y aun así no quebró el canto de la ciudad. / Que ningún golpe te calle: cantá más fuerte, por verdad.",
      tags: COMBAT,
      lore: "Gaulguth fue uno de los tres generales nycaloth del Ejército de la Oscuridad en la Guerra de las Lágrimas.",
    },
    {
      text: "Cada hoja forjada en Myth Drannor guardaba una nota afinada. / Empuñá la tuya como un instrumento: filo y melodía aliada.",
      tags: COMBAT,
      lore: "La metalurgia mágica de Myth Drannor, obra de elfos y enanos, producía armas afamadas en todo Faerûn.",
    },
    {
      text: "Mil años después, su nombre todavía hace bajar la voz. / Hacé hoy algo digno de que mañana lo nombren así: veloz y feroz.",
      tags: BOTH,
      lore: "Myth Drannor cayó en 714 DR; mil años después su nombre sigue evocando asombro y duelo en Faerûn.",
    },
    {
      text: "El último gran sabio salió de aquí con una sola certeza: seguir aprendiendo. / Salí vos igual de cada golpe: más sabio, no más temiendo.",
      tags: TASK,
      lore: "Elminster Aumar vivió entre los elfos de Cormanthyr y consideró a Myth Drannor el hogar de su juventud.",
    },
  ],
};

export function getInspirePhraseDeck(name: string): InspirePhrase[] | undefined {
  return inspirePhraseDecks[name];
}
