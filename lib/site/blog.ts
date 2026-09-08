import type { Locale } from './config';
import { PRAYER_SPACE_ARTICLE_SLUG, prayerSpaceArticleByLocale } from './prayerSpaceArticle';

export const BLOG_SLUGS = [
  PRAYER_SPACE_ARTICLE_SLUG,
  'a-gentle-daily-scripture-rhythm',
  'praying-when-your-mind-will-not-slow-down',
  'read-scripture-with-curiosity',
] as const;

export type BlogSlug = (typeof BLOG_SLUGS)[number];

export type BlogSection = {
  heading: string;
  paragraphs: string[];
  numberedPractices?: string[];
  reflectionPrompts?: string[];
};

export type BlogPost = {
  slug: BlogSlug;
  locale: Locale;
  title: string;
  description: string;
  category: string;
  publishedAt: string;
  updatedAt?: string;
  dateLabel: string;
  readTime: string;
  heroQuote: string;
  sections: BlogSection[];
  cta?: {
    eyebrow: string;
    title: string;
    body: string;
    label: string;
    path: string;
  };
};

type BlogPostContent = Omit<BlogPost, 'slug' | 'locale'>;

const en = {
  [PRAYER_SPACE_ARTICLE_SLUG]: prayerSpaceArticleByLocale.en,
  'a-gentle-daily-scripture-rhythm': {
    title: 'A gentle daily Scripture rhythm that can survive real life',
    description:
      'A practical, grace-filled way to return to Scripture consistently without turning your spiritual life into another performance goal.',
    category: 'Daily rhythms',
    publishedAt: '2026-07-28',
    updatedAt: '2026-09-07',
    dateLabel: 'July 28, 2026',
    readTime: '9 min read',
    heroQuote: 'A lasting rhythm is not built by having perfect days. It is built by knowing how to return on ordinary ones.',
    sections: [
      {
        heading: 'Begin with relationship, not a streak',
        paragraphs: [
          'Many attempts at daily Bible reading begin with sincere desire and quietly become a test of discipline. We choose an ambitious plan, miss a morning, and feel that the whole effort has been spoiled. Scripture then starts to carry the emotional weight of a task we are failing instead of an invitation to know God. A gentler rhythm changes the question. Instead of asking, “How do I never miss?” ask, “How can I make returning simple?”',
          'Consistency matters, but it is a fruit rather than the center. The center is attention: receiving the words in front of you, noticing what they reveal, and responding honestly. Some days that may take twenty minutes. On a crowded day it may be one paragraph read twice. Both can be real encounters. A small practice offered with presence is more nourishing than a large practice rushed through to protect a record.',
        ],
      },
      {
        heading: 'Choose an anchor that already exists',
        paragraphs: [
          'Habits become easier when they attach to a moment that is already part of life. Choose an anchor you can recognize: the first cup of coffee, the train ride, the school drop-off, the moment before opening your laptop, or the few minutes after brushing your teeth at night. The anchor is more useful than a precise clock time because ordinary schedules move. “After I make tea” can survive a late morning better than “at 6:15.”',
          'Prepare the path before you need it. Leave a Bible where the anchor happens, save tomorrow’s passage, or keep a notebook and pen together. Put the phone on Do Not Disturb if it tends to pull you elsewhere. These are not elaborate productivity tricks; they are small acts of hospitality toward your future attention. You are making it easier to say yes when the moment arrives.',
        ],
        reflectionPrompts: [
          'Which part of my day happens reliably enough to become an anchor?',
          'What one source of friction could I remove tonight?',
        ],
      },
      {
        heading: 'Use a four-movement practice',
        paragraphs: [
          'A repeatable shape removes the pressure to invent a spiritual experience every day. The following movements are intentionally simple. They work with a Gospel paragraph, a Psalm, part of a letter, or a section from a longer reading plan. Move slowly enough to notice, but do not worry about completing every movement perfectly.',
        ],
        numberedPractices: [
          'Arrive. Take one unhurried breath and name what you are bringing into the moment: distraction, gratitude, tiredness, hope, or uncertainty. You do not need to become calm before you begin.',
          'Read. Read a short passage once for its overall movement, then again more slowly. If a phrase catches your attention, pause there rather than racing toward the end.',
          'Notice. Ask what the passage says about God, people, desire, fear, grace, or faithful action. Distinguish what is actually in the text from what you expected it to say.',
          'Respond. Offer one honest sentence of prayer and choose one small response for the day. The response might be remembering a phrase, apologizing, waiting, giving thanks, or asking a better question.',
        ],
      },
      {
        heading: 'Create a minimum for crowded days',
        paragraphs: [
          'Decide in advance what counts on a day when time and energy are scarce. A compassionate minimum might be: read four verses, choose one phrase, and pray one sentence. This is not a loophole or a lesser form of faithfulness. It keeps the door open. When the only available choices seem to be a full study or nothing, nothing wins too often.',
          'Your minimum should be small enough to do honestly, even when traveling, caring for someone, or moving through a demanding season. On spacious days, stay longer. On difficult days, keep the thread. A rhythm can expand and contract without disappearing. That flexibility is one reason it can become part of a life rather than a short-lived project.',
        ],
      },
      {
        heading: 'Let missed days teach you how to return',
        paragraphs: [
          'You will miss days. The important moment is not the miss; it is the story you tell afterward. Shame says you have proved that you are inconsistent and should wait for a cleaner restart. Grace says today is available. Do not double the next reading as punishment, and do not spend the whole time reviewing your failure. Open the passage assigned for today—or the next passage in sequence—and begin.',
          'If interruptions repeat, treat them as information. Perhaps the anchor is unrealistic, the reading is too long, or the plan does not fit your current season. Adjusting a practice is not abandoning it. A parent with a newborn, a student in exams, and someone working shifts need different containers. Faithfulness is responsive to reality; it does not pretend reality is absent.',
        ],
      },
      {
        heading: 'Try this for seven days',
        paragraphs: [
          'For one week, use the same anchor and the four movements. Keep the passage short enough that you can reread it. At the end of each day, write only one line: “Today I noticed…” Do not score the experience. The purpose of the line is to preserve attention, not to prove that every reading felt profound.',
          'At the end of the week, look for what helped you become present. Keep what served that purpose and release what created unnecessary pressure. Then begin another week. A daily Scripture rhythm grows through these quiet revisions. Over time, the familiar act of returning becomes its own kind of welcome—a place where you can arrive honestly and listen again.',
        ],
        reflectionPrompts: [
          'What did I notice repeatedly this week?',
          'When did the practice feel most alive or honest?',
          'What adjustment would make returning gentler next week?',
        ],
      },
    ],
  },
  'praying-when-your-mind-will-not-slow-down': {
    title: 'How to pray when your mind will not slow down',
    description:
      'Simple, honest ways to pray through mental noise—without pretending to feel peaceful or treating prayer as a test you must pass.',
    category: 'Prayer',
    publishedAt: '2026-07-28',
    dateLabel: 'July 28, 2026',
    readTime: '10 min read',
    heroQuote: 'Prayer does not begin when every thought becomes quiet. It begins when you bring the mind you actually have.',
    sections: [
      {
        heading: 'You do not have to become calm before you pray',
        paragraphs: [
          'When thoughts are moving quickly, prayer can feel impossible. You begin a sentence and remember an unfinished task. You try to be still and become more aware of every worry. It is easy to conclude that you are doing prayer badly. But attention that wanders is not a moral failure, and agitation does not place you outside God’s presence. The Psalms are full of voices that arrive distressed, confused, angry, and afraid.',
          'Begin by dropping the requirement to manufacture a spiritual mood. Prayer can be distracted and still be sincere. It can contain repetition, silence, tears, incomplete sentences, or a list written on paper because spoken words will not hold together. The aim is not to demonstrate control over your inner world. It is to practice truthful presence before God within it.',
        ],
      },
      {
        heading: 'Give the noise a name',
        paragraphs: [
          'Mental noise often feels larger when it remains vague. Try naming what is happening without judging it: “I am replaying that conversation.” “I am afraid of tomorrow.” “My body is tired and my thoughts are jumping.” Naming is not the same as solving. It simply turns a cloud into something you can bring into prayer.',
          'If several concerns compete for attention, place them on a page. Write each one in a few words, then say, “These are the things I am carrying.” The page can hold what you do not need to rehearse for the next few minutes. You may return to practical action later; prayer is not a substitute for action. For now, naming helps you stop fighting the fact that these thoughts exist.',
        ],
        reflectionPrompts: [
          'What thought keeps asking for my attention?',
          'Is it asking for prayer, a practical next step, a conversation, or rest?',
        ],
      },
      {
        heading: 'Borrow words when your own are difficult',
        paragraphs: [
          'You do not have to generate fresh language every time you pray. Borrowed words can carry you when your own thoughts are tangled. Read a short Psalm aloud, slowly enough to hear it. The language does not need to match your experience perfectly. Notice one line that gives shape to what you cannot yet say, and repeat it as a request, a protest, or an expression of trust.',
          'You can also use a brief prayer that fits inside one breath: “God, meet me here.” “Give me light for the next step.” “Hold what I cannot hold.” Repetition is not empty when it is attentive. Each return becomes a way of gathering the mind without scolding it. When distraction comes, notice it and come back to the sentence as gently as you would guide a child home.',
        ],
      },
      {
        heading: 'A five-minute prayer for a crowded mind',
        paragraphs: [
          'Structure can be kind when concentration is limited. Set a quiet five-minute boundary—not as a countdown to success, but as permission to stop carrying everything at once. Keep your eyes open if closing them makes thoughts louder. Sit, walk slowly, or hold a warm cup. Choose a posture that helps you remain present rather than one that merely looks prayerful.',
        ],
        numberedPractices: [
          'Arrive for one minute. Notice your feet, your breathing, and the room. Say, “I am here, and God is here.”',
          'Name for one minute. Speak or write the central concern without editing it into respectable language.',
          'Receive for one minute. Read two or three verses and choose one phrase to hold.',
          'Ask for one minute. Request the grace, courage, wisdom, or help needed for the next faithful step—not for every possible future.',
          'Release for one minute. End with an open hand and the words, “What I cannot resolve now, I entrust to you.”',
        ],
      },
      {
        heading: 'Do not use Scripture to silence honest distress',
        paragraphs: [
          'A verse can offer companionship and perspective, but it should not become a weapon against your own emotions. Reading “do not be anxious” as “a faithful person would not feel this” adds shame to distress. Read the surrounding passage. Notice the invitation, the relationship, and the practices named there. Biblical hope is not denial; it can coexist with lament, questions, and the need for help.',
          'It is also wise to distinguish spiritual practice from health care. Prayer may be deeply supportive, but it is not a replacement for professional care. If anxiety, panic, sleeplessness, or distress is persistent, intense, or affecting your safety and daily life, consider speaking with a qualified mental-health professional or medical provider. If you may be in immediate danger or thinking about harming yourself, contact local emergency services or a crisis line in your country now, and reach out to someone you trust.',
        ],
      },
      {
        heading: 'Let prayer end with one next step',
        paragraphs: [
          'A noisy mind often wants certainty about the entire future. Prayer can narrow the horizon to what faithfulness looks like next. Perhaps you need to send one message, write down tomorrow’s first task, drink water, apologize, ask for help, or go to bed. A concrete response does not solve everything, but it gives concern a place to move.',
          'Sometimes the next step is simply to return to the same short prayer later. Do not measure the prayer by whether you feel different immediately. Peace is not a performance metric. The honest act of turning toward God, receiving a few true words, and choosing the next loving action is already a meaningful practice—even while thoughts continue to move.',
        ],
        reflectionPrompts: [
          'What am I trying to solve all at once?',
          'What grace do I need for the next hour rather than the whole future?',
          'Who could help me carry this wisely?',
        ],
      },
    ],
  },
  'read-scripture-with-curiosity': {
    title: 'Read Scripture with curiosity: a repeatable five-part method',
    description:
      'A practical method for moving beyond quick answers by noticing context, asking better questions, tracing connections, and responding honestly.',
    category: 'Scripture study',
    publishedAt: '2026-07-28',
    updatedAt: '2026-09-07',
    dateLabel: 'July 28, 2026',
    readTime: '11 min read',
    heroQuote: 'Curiosity slows the rush to make a passage say something and creates room to hear what it is actually saying.',
    sections: [
      {
        heading: 'Replace the pressure to understand everything',
        paragraphs: [
          'People often approach the Bible carrying two unhelpful expectations: that the meaning should be obvious immediately, and that every reading should produce a personal lesson. When neither happens, we may skim faster, reach for someone else’s answer, or decide we are not good at Scripture. Curiosity offers another posture. It treats confusion as a doorway to attention rather than evidence of failure.',
          'A curious reader asks before concluding. Who is speaking? What happened just before this? Why is this detail repeated? What kind of writing is this? What would the first hearers have recognized that I do not? These questions do not make reading cold or merely academic. They protect us from forcing our assumptions onto the text and can deepen wonder, humility, and response.',
        ],
      },
      {
        heading: 'The method: Read, Notice, Ask, Trace, Respond',
        paragraphs: [
          'Use a passage short enough to read several times—perhaps six to fifteen verses. The method works best when you write at least a few observations. You do not need special tools for the first pass. Let the passage have its own voice before opening notes, commentaries, or search results.',
        ],
        numberedPractices: [
          'Read. Read once for the whole movement. Identify the genre, speaker, audience, setting, and what changes from beginning to end.',
          'Notice. Mark repeated words, contrasts, cause-and-effect statements, questions, images, commands, promises, and surprises. Write observations before interpretations.',
          'Ask. Turn what you notice into genuine questions. Ask what is clear, what is uncertain, and what assumption you may be bringing with you.',
          'Trace. Read the paragraphs around the passage, then follow important themes or quotations to other parts of Scripture. Let clearer context constrain imaginative guesses.',
          'Respond. Summarize the central movement in your own words. Name what invites trust, repentance, gratitude, courage, or further study, and choose one proportionate response.',
        ],
      },
      {
        heading: 'Separate observation from interpretation',
        paragraphs: [
          'Observation describes what is on the page: “The question appears three times,” “the crowd leaves,” or “the poem moves from complaint to praise.” Interpretation proposes what those details mean. Both matter, but keeping them distinct for a little while reduces the chance that our first impression becomes the only possible reading.',
          'Try filling two columns. In the first, write only what another reader could point to in the text. In the second, write possible meanings and the evidence for each. Use phrases such as “This may suggest…” rather than claiming certainty too quickly. The goal is not endless hesitation; it is responsible confidence shaped by evidence, context, and the wider witness of Scripture.',
        ],
      },
      {
        heading: 'Let genre change the questions',
        paragraphs: [
          'A proverb describes wise patterns; it is not usually an unconditional guarantee. Poetry uses image and emotional intensity. A letter belongs to a real community with a particular problem. Narrative tells what happened without necessarily approving every action. Prophecy can combine warning, hope, symbolism, and historical circumstance. The same reading technique cannot be applied mechanically to all of them.',
          'Before drawing a conclusion, name the genre and ask what readers normally expect from that kind of writing. With a Psalm, notice movement, metaphor, and prayer. With a Gospel scene, notice characters, conflict, and what the narrator emphasizes. With a letter, follow the argument across paragraphs and watch connecting words such as “therefore,” “but,” and “because.” Genre is not a barrier between you and meaning; it is part of how meaning is communicated.',
        ],
      },
      {
        heading: 'Use tools after you have paid attention',
        paragraphs: [
          'Study Bibles, cross-references, maps, dictionaries, trusted teachers, and Bible-search tools can answer historical and linguistic questions. Use them to test and enrich what you have noticed, not to bypass the encounter. Compare more than one responsible source when an issue is disputed, and distinguish the biblical text from a commentator’s conclusion.',
          'Technology can help locate passages or organize themes, but generated summaries can be mistaken and should never be presented as Scripture. Verify quotations in a reliable Bible translation and examine their context. A helpful tool sends you back to the text with better questions. An unhelpful one gives an answer so quickly that you stop looking.',
        ],
      },
      {
        heading: 'Stay honest when a passage is difficult',
        paragraphs: [
          'Some passages are difficult because the world behind them is unfamiliar. Others raise serious moral, theological, or personal questions. Curiosity does not require pretending those tensions are simple. Write the difficulty plainly. Seek historical context, read how thoughtful interpreters disagree, and ask how the passage relates to the character and teaching of Jesus and the broader biblical story.',
          'Resist both quick dismissal and quick defense. Humility can say, “I do not yet understand this,” while continuing to learn. If a passage has been used to wound or control you, study in the company of trustworthy people who respect your agency and safety. Wise reading bears good fruit: truthfulness, love, justice, repentance, courage, and greater attention to God and neighbor—not coercion or contempt.',
        ],
      },
      {
        heading: 'Build a weekly curiosity practice',
        paragraphs: [
          'Choose one short passage for a week. On the first day, read and notice. On the second, collect questions. On the third, explore immediate context. On the fourth, trace one theme or cross-reference. On the fifth, consult one or two trustworthy resources. On the sixth, write a short summary. On the seventh, return to the passage and respond in prayer or action.',
          'Repeated reading lets the text become more than a prompt for a quick thought. Details emerge, questions mature, and premature conclusions loosen. You may finish the week with some questions unanswered. That is not wasted study. Curiosity teaches you to remain present long enough for understanding to deepen—and to carry both conviction and humility into the way you live.',
        ],
        reflectionPrompts: [
          'What did I notice only after the second or third reading?',
          'Which conclusion is strongly supported, and which remains tentative?',
          'What response fits the passage without making it say more than it says?',
        ],
      },
    ],
  },
} satisfies Record<BlogSlug, BlogPostContent>;

const es = {
  [PRAYER_SPACE_ARTICLE_SLUG]: prayerSpaceArticleByLocale.es,
  'a-gentle-daily-scripture-rhythm': {
    title: 'Un ritmo diario y amable con la Escritura que cabe en la vida real',
    description:
      'Una manera práctica y llena de gracia de volver a la Biblia con constancia, sin convertir la vida espiritual en otra meta de rendimiento.',
    category: 'Ritmos diarios',
    publishedAt: '2026-07-28',
    dateLabel: '28 de julio de 2026',
    readTime: '9 min de lectura',
    heroQuote: 'Un ritmo duradero no se construye con días perfectos, sino aprendiendo a volver en los días normales.',
    sections: [
      {
        heading: 'Empieza por la relación, no por la racha',
        paragraphs: [
          'Muchos intentos de leer la Biblia a diario nacen de un deseo sincero y terminan convirtiéndose, sin darnos cuenta, en una prueba de disciplina. Elegimos un plan ambicioso, perdemos una mañana y sentimos que todo se arruinó. Entonces la Escritura empieza a cargar con el peso emocional de una tarea que no cumplimos, en lugar de ser una invitación a conocer a Dios. Un ritmo más amable cambia la pregunta: en vez de “¿Cómo no vuelvo a fallar?”, pregunta “¿Cómo puedo hacer que regresar sea sencillo?”',
          'La constancia importa, pero es un fruto y no el centro. El centro es la atención: recibir las palabras que tienes delante, observar lo que revelan y responder con honestidad. Algunos días eso tomará veinte minutos. En un día lleno quizá sea un párrafo leído dos veces. Ambos pueden ser encuentros reales. Una práctica pequeña ofrecida con presencia alimenta más que una grande hecha con prisa para conservar una racha.',
        ],
      },
      {
        heading: 'Elige un ancla que ya exista',
        paragraphs: [
          'Los hábitos son más fáciles cuando se unen a un momento que ya forma parte de la vida. Escoge un ancla reconocible: el primer café, el trayecto al trabajo, la vuelta del colegio, el instante antes de abrir el portátil o los minutos después de lavarte los dientes por la noche. El ancla es más útil que una hora exacta porque los horarios se mueven. “Después de preparar el té” sobrevive mejor a una mañana tardía que “a las 6:15”.',
          'Prepara el camino antes de necesitarlo. Deja la Biblia donde sucede ese momento, marca el pasaje de mañana o mantén juntos el cuaderno y el bolígrafo. Activa No molestar si el teléfono suele llevarte a otra parte. No son trucos sofisticados de productividad; son pequeños gestos de hospitalidad hacia tu atención futura. Estás haciendo más fácil decir que sí cuando llegue el momento.',
        ],
        reflectionPrompts: [
          '¿Qué parte de mi día ocurre con suficiente regularidad para convertirse en ancla?',
          '¿Qué pequeña fricción puedo eliminar esta noche?',
        ],
      },
      {
        heading: 'Usa una práctica de cuatro movimientos',
        paragraphs: [
          'Una forma repetible quita la presión de inventar una experiencia espiritual cada día. Los movimientos siguientes son deliberadamente sencillos. Funcionan con un párrafo de un Evangelio, un Salmo, parte de una carta o una sección de un plan más largo. Avanza despacio para poder observar, sin preocuparte por hacer cada paso a la perfección.',
        ],
        numberedPractices: [
          'Llega. Respira sin prisa y nombra lo que traes contigo: distracción, gratitud, cansancio, esperanza o incertidumbre. No necesitas estar en calma antes de empezar.',
          'Lee. Lee un pasaje corto una vez para captar su movimiento general y otra vez más despacio. Si una frase llama tu atención, detente allí en vez de correr hasta el final.',
          'Observa. Pregunta qué dice el pasaje sobre Dios, las personas, el deseo, el miedo, la gracia o una acción fiel. Distingue lo que está en el texto de lo que esperabas que dijera.',
          'Responde. Ofrece una frase honesta de oración y elige una respuesta pequeña para el día: recordar una línea, pedir perdón, esperar, agradecer o formular una pregunta mejor.',
        ],
      },
      {
        heading: 'Crea un mínimo para los días llenos',
        paragraphs: [
          'Decide de antemano qué cuenta cuando el tiempo y la energía escasean. Un mínimo compasivo podría ser: leer cuatro versículos, elegir una frase y hacer una oración. No es una trampa ni una forma menor de fidelidad. Mantiene la puerta abierta. Cuando las únicas opciones parecen ser un estudio completo o nada, demasiadas veces gana la nada.',
          'Tu mínimo debe ser lo bastante pequeño para hacerlo con sinceridad mientras viajas, cuidas a alguien o atraviesas una temporada exigente. En días espaciosos, quédate más. En días difíciles, conserva el hilo. Un ritmo puede ensancharse y contraerse sin desaparecer. Esa flexibilidad le permite formar parte de una vida y no ser solo un proyecto de pocas semanas.',
        ],
      },
      {
        heading: 'Deja que los días perdidos te enseñen a volver',
        paragraphs: [
          'Habrá días que no leas. El momento importante no es la ausencia, sino la historia que te cuentas después. La vergüenza dice que ya demostraste ser inconstante y que debes esperar un reinicio impecable. La gracia dice que hoy está disponible. No dupliques la siguiente lectura como castigo ni pases todo el tiempo repasando el fallo. Abre el pasaje de hoy —o el siguiente de la secuencia— y comienza.',
          'Si las interrupciones se repiten, míralas como información. Quizá el ancla no sea realista, la lectura sea demasiado larga o el plan no encaje en esta etapa. Ajustar una práctica no significa abandonarla. Una madre o un padre con un recién nacido, un estudiante en época de exámenes y quien trabaja por turnos necesitan recipientes diferentes. La fidelidad responde a la realidad; no finge que no existe.',
        ],
      },
      {
        heading: 'Pruébalo durante siete días',
        paragraphs: [
          'Durante una semana, utiliza la misma ancla y los cuatro movimientos. Elige un pasaje lo bastante corto para releerlo. Al final de cada día escribe una sola línea: “Hoy observé…” No puntúes la experiencia. Esa línea sirve para conservar la atención, no para demostrar que cada lectura fue profunda.',
          'Al terminar la semana, busca qué te ayudó a estar presente. Conserva lo que sirvió y suelta lo que produjo presión innecesaria. Después empieza otra semana. Un ritmo diario crece mediante estas revisiones silenciosas. Con el tiempo, el gesto familiar de volver se convierte en una bienvenida: un lugar al que puedes llegar con honestidad y escuchar de nuevo.',
        ],
        reflectionPrompts: [
          '¿Qué observé varias veces esta semana?',
          '¿Cuándo se sintió la práctica más viva y honesta?',
          '¿Qué ajuste haría más amable el regreso la próxima semana?',
        ],
      },
    ],
  },
  'praying-when-your-mind-will-not-slow-down': {
    title: 'Cómo orar cuando la mente no se detiene',
    description:
      'Maneras sencillas y honestas de orar en medio del ruido mental, sin fingir paz ni tratar la oración como una prueba que hay que aprobar.',
    category: 'Oración',
    publishedAt: '2026-07-28',
    dateLabel: '28 de julio de 2026',
    readTime: '10 min de lectura',
    heroQuote: 'La oración no empieza cuando todos los pensamientos se callan. Empieza cuando traes la mente que realmente tienes.',
    sections: [
      {
        heading: 'No tienes que calmarte antes de orar',
        paragraphs: [
          'Cuando los pensamientos avanzan deprisa, orar puede parecer imposible. Empiezas una frase y recuerdas una tarea pendiente. Intentas estar quieto y notas todavía más cada preocupación. Es fácil concluir que estás orando mal. Pero una atención que se dispersa no es un fracaso moral, y la agitación no te deja fuera de la presencia de Dios. Los Salmos están llenos de voces que llegan afligidas, confusas, enfadadas y con miedo.',
          'Empieza por soltar la exigencia de fabricar un estado espiritual. La oración puede estar distraída y seguir siendo sincera. Puede contener repetición, silencio, lágrimas, frases incompletas o una lista escrita cuando las palabras habladas no se sostienen. El propósito no es demostrar control sobre tu mundo interior, sino practicar una presencia verdadera ante Dios dentro de él.',
        ],
      },
      {
        heading: 'Ponle nombre al ruido',
        paragraphs: [
          'El ruido mental suele parecer mayor cuando permanece indefinido. Intenta nombrar lo que ocurre sin juzgarlo: “Estoy repitiendo esa conversación.” “Tengo miedo de mañana.” “Mi cuerpo está cansado y mis pensamientos saltan.” Nombrar no es resolver. Solo convierte una nube en algo que puedes llevar a la oración.',
          'Si varias preocupaciones compiten por tu atención, ponlas en una página. Escribe cada una en pocas palabras y di: “Estas son las cosas que llevo conmigo.” La página puede sostener lo que no necesitas ensayar durante los próximos minutos. Después podrás volver a la acción práctica; la oración no sustituye la acción. Por ahora, nombrar te ayuda a dejar de luchar contra el hecho de que esos pensamientos existen.',
        ],
        reflectionPrompts: [
          '¿Qué pensamiento sigue pidiendo mi atención?',
          '¿Necesita oración, un paso práctico, una conversación o descanso?',
        ],
      },
      {
        heading: 'Toma palabras prestadas cuando las tuyas no lleguen',
        paragraphs: [
          'No necesitas producir un lenguaje nuevo cada vez que oras. Las palabras prestadas pueden sostenerte cuando tus pensamientos están enredados. Lee en voz alta un Salmo breve, con suficiente lentitud para oírlo. No hace falta que cada frase coincida perfectamente con tu experiencia. Encuentra una línea que dé forma a lo que todavía no puedes decir y repítela como petición, protesta o confianza.',
          'También puedes usar una oración que quepa en una respiración: “Dios, encuéntrame aquí.” “Dame luz para el siguiente paso.” “Sostén lo que yo no puedo sostener.” La repetición no está vacía cuando es atenta. Cada regreso reúne la mente sin reprenderla. Cuando aparezca una distracción, obsérvala y vuelve a la frase con la amabilidad con que acompañarías a un niño a casa.',
        ],
      },
      {
        heading: 'Una oración de cinco minutos para una mente llena',
        paragraphs: [
          'Una estructura puede ser bondadosa cuando la concentración es limitada. Reserva cinco minutos tranquilos, no como cuenta atrás hacia el éxito, sino como permiso para dejar de cargarlo todo a la vez. Mantén los ojos abiertos si cerrarlos hace más fuertes los pensamientos. Siéntate, camina despacio o sostén una taza caliente. Elige una postura que te ayude a estar presente, no solo una que parezca espiritual.',
        ],
        numberedPractices: [
          'Llega durante un minuto. Nota los pies, la respiración y la habitación. Di: “Estoy aquí, y Dios está aquí.”',
          'Nombra durante un minuto. Di o escribe la preocupación central sin editarla para que suene respetable.',
          'Recibe durante un minuto. Lee dos o tres versículos y elige una frase para conservar.',
          'Pide durante un minuto. Pide la gracia, el valor, la sabiduría o la ayuda para el siguiente paso fiel, no para todos los futuros posibles.',
          'Suelta durante un minuto. Termina con la mano abierta y las palabras: “Lo que no puedo resolver ahora, te lo confío.”',
        ],
      },
      {
        heading: 'No uses la Escritura para silenciar un dolor honesto',
        paragraphs: [
          'Un versículo puede ofrecer compañía y perspectiva, pero no debería convertirse en un arma contra tus emociones. Leer “no se inquieten” como “una persona fiel no sentiría esto” añade vergüenza al sufrimiento. Lee el contexto. Observa la invitación, la relación y las prácticas que aparecen allí. La esperanza bíblica no es negación; puede convivir con el lamento, las preguntas y la necesidad de ayuda.',
          'También conviene distinguir la práctica espiritual de la atención sanitaria. La oración puede ser un apoyo profundo, pero no sustituye el cuidado profesional. Si la ansiedad, el pánico, el insomnio o la angustia son persistentes, intensos o afectan tu seguridad y vida diaria, considera hablar con un profesional cualificado de salud mental o medicina. Si existe peligro inmediato o piensas en hacerte daño, contacta ahora con emergencias o una línea de crisis de tu país y busca a alguien de confianza.',
        ],
      },
      {
        heading: 'Deja que la oración termine con un paso siguiente',
        paragraphs: [
          'Una mente acelerada suele querer certeza sobre todo el futuro. La oración puede reducir el horizonte a lo que significa ser fiel ahora. Tal vez necesites enviar un mensaje, anotar la primera tarea de mañana, beber agua, pedir perdón, solicitar ayuda o irte a dormir. Una respuesta concreta no soluciona todo, pero da a la preocupación un lugar hacia el que moverse.',
          'A veces el siguiente paso es simplemente volver más tarde a la misma oración breve. No midas la oración por cómo te sientes inmediatamente. La paz no es una métrica de rendimiento. El acto honesto de orientarte hacia Dios, recibir unas palabras verdaderas y elegir la siguiente acción amorosa ya es una práctica significativa, incluso mientras los pensamientos siguen moviéndose.',
        ],
        reflectionPrompts: [
          '¿Qué estoy intentando resolver de una sola vez?',
          '¿Qué gracia necesito para la próxima hora y no para todo el futuro?',
          '¿Quién podría ayudarme a llevar esto con sabiduría?',
        ],
      },
    ],
  },
  'read-scripture-with-curiosity': {
    title: 'Lee la Escritura con curiosidad: un método repetible en cinco partes',
    description:
      'Un método práctico para ir más allá de las respuestas rápidas mediante el contexto, mejores preguntas, conexiones y una respuesta honesta.',
    category: 'Estudio bíblico',
    publishedAt: '2026-07-28',
    dateLabel: '28 de julio de 2026',
    readTime: '11 min de lectura',
    heroQuote: 'La curiosidad frena la prisa por hacer que un pasaje diga algo y abre espacio para oír lo que realmente está diciendo.',
    sections: [
      {
        heading: 'Cambia la presión de entenderlo todo',
        paragraphs: [
          'A menudo nos acercamos a la Biblia con dos expectativas poco útiles: que el significado debería ser evidente de inmediato y que cada lectura debería producir una lección personal. Cuando no sucede, leemos más deprisa, buscamos la respuesta de otra persona o decidimos que no se nos da bien la Escritura. La curiosidad ofrece otra postura. Trata la confusión como una puerta a la atención, no como prueba de fracaso.',
          'Un lector curioso pregunta antes de concluir. ¿Quién habla? ¿Qué ocurrió antes? ¿Por qué se repite este detalle? ¿Qué clase de texto es? ¿Qué reconocerían los primeros oyentes que yo no reconozco? Estas preguntas no hacen que la lectura sea fría o meramente académica. Nos protegen de imponer nuestras suposiciones al texto y pueden profundizar el asombro, la humildad y la respuesta.',
        ],
      },
      {
        heading: 'El método: Lee, Observa, Pregunta, Conecta, Responde',
        paragraphs: [
          'Usa un pasaje lo bastante corto para leerlo varias veces, quizá entre seis y quince versículos. El método funciona mejor si escribes algunas observaciones. No necesitas herramientas especiales para la primera lectura. Deja que el pasaje tenga voz propia antes de abrir notas, comentarios o resultados de búsqueda.',
        ],
        numberedPractices: [
          'Lee. Lee una vez para captar el movimiento completo. Identifica género, hablante, audiencia, escenario y qué cambia entre el principio y el final.',
          'Observa. Marca palabras repetidas, contrastes, causas y efectos, preguntas, imágenes, mandatos, promesas y sorpresas. Escribe observaciones antes que interpretaciones.',
          'Pregunta. Convierte lo observado en preguntas reales. Anota qué está claro, qué permanece incierto y qué suposición podrías estar aportando.',
          'Conecta. Lee los párrafos cercanos y sigue los temas o citas importantes a otros lugares de la Biblia. Deja que el contexto claro limite las conjeturas imaginativas.',
          'Responde. Resume el movimiento central con tus palabras. Nombra qué invita a confiar, arrepentirse, agradecer, tener valor o seguir estudiando, y elige una respuesta proporcionada.',
        ],
      },
      {
        heading: 'Separa observación e interpretación',
        paragraphs: [
          'La observación describe lo que aparece en la página: “La pregunta se repite tres veces”, “la multitud se marcha” o “el poema pasa de la queja a la alabanza”. La interpretación propone qué significan esos detalles. Ambas importan, pero mantenerlas separadas un poco reduce la posibilidad de que la primera impresión se convierta en la única lectura posible.',
          'Prueba con dos columnas. En la primera escribe solo lo que otro lector podría señalar en el texto. En la segunda, posibles significados y la evidencia para cada uno. Usa frases como “Esto puede sugerir…” en lugar de afirmar certeza demasiado pronto. No se trata de dudar sin fin, sino de formar una confianza responsable, modelada por la evidencia, el contexto y el testimonio más amplio de la Escritura.',
        ],
      },
      {
        heading: 'Deja que el género cambie las preguntas',
        paragraphs: [
          'Un proverbio describe patrones sabios; normalmente no es una garantía incondicional. La poesía usa imágenes e intensidad emocional. Una carta pertenece a una comunidad real con un problema concreto. La narrativa cuenta lo sucedido sin aprobar necesariamente cada acción. La profecía puede unir advertencia, esperanza, símbolo y circunstancias históricas. No se puede aplicar mecánicamente la misma técnica a todo.',
          'Antes de concluir, nombra el género y pregunta qué esperan normalmente los lectores de ese tipo de escritura. En un Salmo, observa el movimiento, la metáfora y la oración. En una escena del Evangelio, los personajes, el conflicto y el énfasis del narrador. En una carta, sigue el argumento entre párrafos y conectores como “por tanto”, “pero” y “porque”. El género no bloquea el significado; forma parte de cómo se comunica.',
        ],
      },
      {
        heading: 'Usa herramientas después de prestar atención',
        paragraphs: [
          'Biblias de estudio, referencias cruzadas, mapas, diccionarios, docentes fiables y herramientas de búsqueda pueden responder preguntas históricas y lingüísticas. Úsalos para comprobar y enriquecer lo observado, no para evitar el encuentro. Compara más de una fuente responsable cuando exista debate y distingue entre el texto bíblico y la conclusión de un comentarista.',
          'La tecnología puede localizar pasajes y organizar temas, pero los resúmenes generados pueden equivocarse y nunca deben presentarse como Escritura. Verifica las citas en una traducción bíblica fiable y examina su contexto. Una buena herramienta te devuelve al texto con mejores preguntas. Una mala responde tan deprisa que dejas de mirar.',
        ],
      },
      {
        heading: 'Sé honesto cuando un pasaje sea difícil',
        paragraphs: [
          'Algunos pasajes son difíciles porque su mundo nos resulta desconocido. Otros plantean preguntas morales, teológicas o personales serias. La curiosidad no exige fingir que esas tensiones son simples. Escribe la dificultad claramente. Busca contexto histórico, lee cómo discrepan intérpretes cuidadosos y pregunta cómo se relaciona el pasaje con el carácter y la enseñanza de Jesús y con la historia bíblica completa.',
          'Resiste tanto el rechazo rápido como la defensa apresurada. La humildad puede decir “Todavía no lo entiendo” mientras sigue aprendiendo. Si un pasaje se ha utilizado para herirte o controlarte, estúdialo junto a personas confiables que respeten tu libertad y seguridad. Una lectura sabia produce buenos frutos: verdad, amor, justicia, arrepentimiento, valor y más atención a Dios y al prójimo, no coacción o desprecio.',
        ],
      },
      {
        heading: 'Construye una práctica semanal de curiosidad',
        paragraphs: [
          'Elige un pasaje corto para una semana. El primer día, lee y observa. El segundo, reúne preguntas. El tercero, explora el contexto inmediato. El cuarto, sigue un tema o referencia. El quinto, consulta una o dos fuentes fiables. El sexto, escribe un resumen breve. El séptimo, vuelve al pasaje y responde en oración o acción.',
          'La lectura repetida permite que el texto sea más que un punto de partida para una idea rápida. Aparecen detalles, maduran preguntas y se aflojan conclusiones prematuras. Quizá termines la semana con preguntas abiertas. No es estudio perdido. La curiosidad te enseña a permanecer el tiempo suficiente para que la comprensión crezca y a llevar convicción y humildad a tu manera de vivir.',
        ],
        reflectionPrompts: [
          '¿Qué observé solo después de la segunda o tercera lectura?',
          '¿Qué conclusión está bien respaldada y cuál sigue siendo provisional?',
          '¿Qué respuesta encaja con el pasaje sin hacerle decir más de lo que dice?',
        ],
      },
    ],
  },
} satisfies Record<BlogSlug, BlogPostContent>;

const fr = {
  [PRAYER_SPACE_ARTICLE_SLUG]: prayerSpaceArticleByLocale.fr,
  'a-gentle-daily-scripture-rhythm': {
    title: 'Un rythme quotidien et paisible avec les Écritures, adapté à la vie réelle',
    description:
      'Une manière concrète et pleine de grâce de revenir régulièrement à la Bible sans transformer la vie spirituelle en objectif de performance.',
    category: 'Rythmes quotidiens',
    publishedAt: '2026-07-28',
    dateLabel: '28 juillet 2026',
    readTime: '9 min de lecture',
    heroQuote: 'Un rythme durable ne naît pas de journées parfaites, mais de notre capacité à revenir pendant les journées ordinaires.',
    sections: [
      {
        heading: 'Commencez par la relation, pas par la série',
        paragraphs: [
          'Beaucoup de projets de lecture quotidienne commencent par un désir sincère et deviennent peu à peu un test de discipline. Nous choisissons un plan ambitieux, manquons une matinée et avons l’impression d’avoir tout gâché. Les Écritures portent alors le poids d’une tâche dans laquelle nous échouons au lieu de rester une invitation à connaître Dieu. Un rythme plus doux change la question : au lieu de demander « Comment ne plus jamais manquer ? », demandez « Comment rendre le retour simple ? »',
          'La régularité compte, mais elle est un fruit, pas le centre. Le centre, c’est l’attention : accueillir les mots devant soi, remarquer ce qu’ils révèlent et répondre avec honnêteté. Certains jours, cela prendra vingt minutes. Lors d’une journée chargée, ce sera peut-être un paragraphe lu deux fois. Les deux peuvent être de vraies rencontres. Une petite pratique vécue avec présence nourrit davantage qu’une grande pratique précipitée pour préserver une série.',
        ],
      },
      {
        heading: 'Choisissez un repère qui existe déjà',
        paragraphs: [
          'Une habitude devient plus facile lorsqu’elle s’attache à un moment déjà présent dans la vie : le premier café, le trajet, le retour de l’école, l’instant avant d’ouvrir l’ordinateur ou les minutes après s’être brossé les dents. Ce repère est plus utile qu’une heure exacte, car les emplois du temps bougent. « Après avoir préparé le thé » résiste mieux à une matinée tardive que « à 6 h 15 ».',
          'Préparez le chemin avant d’en avoir besoin. Laissez une Bible là où ce moment se déroule, marquez le passage du lendemain ou gardez carnet et stylo ensemble. Activez le mode Ne pas déranger si le téléphone détourne facilement votre attention. Ce ne sont pas des astuces compliquées de productivité, mais de petits gestes d’hospitalité envers votre attention future. Vous rendez le oui plus facile lorsque le moment arrive.',
        ],
        reflectionPrompts: [
          'Quel moment de ma journée est assez stable pour devenir un repère ?',
          'Quel petit obstacle puis-je enlever dès ce soir ?',
        ],
      },
      {
        heading: 'Adoptez une pratique en quatre mouvements',
        paragraphs: [
          'Une forme répétable enlève la pression d’inventer chaque jour une expérience spirituelle. Les mouvements suivants sont volontairement simples. Ils conviennent à un paragraphe d’Évangile, un Psaume, un extrait de lettre ou une étape d’un plan plus long. Avancez assez lentement pour remarquer, sans chercher à accomplir parfaitement chaque mouvement.',
        ],
        numberedPractices: [
          'Arrivez. Respirez sans hâte et nommez ce que vous apportez : distraction, gratitude, fatigue, espérance ou incertitude. Vous n’avez pas besoin d’être calme avant de commencer.',
          'Lisez. Lisez un court passage une première fois pour son mouvement général, puis une seconde fois plus lentement. Si une phrase vous retient, restez-y plutôt que de courir vers la fin.',
          'Remarquez. Demandez ce que le passage dit de Dieu, des personnes, du désir, de la peur, de la grâce ou d’une action fidèle. Distinguez ce qui est écrit de ce que vous pensiez y trouver.',
          'Répondez. Formulez une phrase de prière honnête et choisissez une petite réponse pour la journée : garder une parole, demander pardon, attendre, remercier ou poser une meilleure question.',
        ],
      },
      {
        heading: 'Définissez un minimum pour les journées chargées',
        paragraphs: [
          'Décidez à l’avance de ce qui compte lorsque le temps et l’énergie manquent. Un minimum bienveillant pourrait être : lire quatre versets, choisir une phrase et dire une prière. Ce n’est ni une échappatoire ni une fidélité au rabais. Cela garde la porte ouverte. Quand les seules options semblent être une étude complète ou rien, le rien gagne trop souvent.',
          'Votre minimum doit être assez petit pour être vécu sincèrement en voyage, en prenant soin de quelqu’un ou pendant une saison exigeante. Les jours plus vastes, restez davantage. Les jours difficiles, gardez le fil. Un rythme peut s’élargir et se resserrer sans disparaître. Cette souplesse lui permet de devenir une part de la vie plutôt qu’un projet éphémère.',
        ],
      },
      {
        heading: 'Laissez les jours manqués vous apprendre à revenir',
        paragraphs: [
          'Vous manquerez des jours. Le moment décisif n’est pas l’absence, mais l’histoire racontée ensuite. La honte dit que vous avez prouvé votre inconstance et qu’il faut attendre un redémarrage parfait. La grâce dit qu’aujourd’hui est disponible. Ne doublez pas la lecture suivante comme punition et ne passez pas tout le temps à revoir l’échec. Ouvrez le passage du jour — ou le suivant — et commencez.',
          'Si les interruptions se répètent, considérez-les comme des informations. Le repère est peut-être irréaliste, la lecture trop longue ou le plan mal adapté à votre saison. Ajuster une pratique n’est pas l’abandonner. Le parent d’un nouveau-né, l’étudiant en examen et la personne qui travaille en horaires décalés ont besoin de cadres différents. La fidélité répond à la réalité ; elle ne prétend pas qu’elle n’existe pas.',
        ],
      },
      {
        heading: 'Essayez pendant sept jours',
        paragraphs: [
          'Pendant une semaine, gardez le même repère et les quatre mouvements. Choisissez un passage assez court pour le relire. À la fin de chaque journée, écrivez une seule ligne : « Aujourd’hui, j’ai remarqué… » Ne notez pas l’expérience. Cette ligne protège l’attention ; elle ne sert pas à prouver que chaque lecture fut profonde.',
          'À la fin de la semaine, repérez ce qui vous a aidé à être présent. Gardez ce qui a servi ce but et relâchez ce qui a créé une pression inutile. Puis commencez une nouvelle semaine. Un rythme quotidien grandit grâce à ces ajustements discrets. Avec le temps, le geste familier du retour devient un accueil : un lieu où arriver avec honnêteté et écouter encore.',
        ],
        reflectionPrompts: [
          'Qu’ai-je remarqué plusieurs fois cette semaine ?',
          'Quand la pratique a-t-elle semblé la plus vivante ou honnête ?',
          'Quel ajustement rendrait le retour plus doux la semaine prochaine ?',
        ],
      },
    ],
  },
  'praying-when-your-mind-will-not-slow-down': {
    title: 'Comment prier quand l’esprit ne ralentit pas',
    description:
      'Des manières simples et honnêtes de prier au milieu du bruit mental, sans feindre la paix ni transformer la prière en examen à réussir.',
    category: 'Prière',
    publishedAt: '2026-07-28',
    dateLabel: '28 juillet 2026',
    readTime: '10 min de lecture',
    heroQuote: 'La prière ne commence pas lorsque toutes les pensées se taisent. Elle commence lorsque vous apportez l’esprit que vous avez réellement.',
    sections: [
      {
        heading: 'Vous n’avez pas besoin d’être calme avant de prier',
        paragraphs: [
          'Quand les pensées vont vite, prier peut sembler impossible. Vous commencez une phrase et vous souvenez d’une tâche inachevée. Vous tentez le silence et percevez davantage chaque inquiétude. Il devient facile de conclure que vous priez mal. Pourtant, une attention qui s’égare n’est pas une faute morale, et l’agitation ne vous place pas hors de la présence de Dieu. Les Psaumes sont remplis de voix qui arrivent bouleversées, confuses, en colère ou effrayées.',
          'Commencez par abandonner l’obligation de fabriquer une ambiance spirituelle. La prière peut être distraite et rester sincère. Elle peut contenir répétition, silence, larmes, phrases inachevées ou une liste écrite lorsque les mots parlés ne tiennent pas ensemble. Il ne s’agit pas de prouver que vous maîtrisez votre monde intérieur, mais d’y pratiquer une présence vraie devant Dieu.',
        ],
      },
      {
        heading: 'Donnez un nom au bruit',
        paragraphs: [
          'Le bruit mental paraît souvent plus grand lorsqu’il reste vague. Essayez de nommer ce qui se passe sans le juger : « Je rejoue cette conversation. » « J’ai peur de demain. » « Mon corps est fatigué et mes pensées sautent. » Nommer n’est pas résoudre. C’est simplement transformer un nuage en quelque chose que l’on peut apporter dans la prière.',
          'Si plusieurs préoccupations réclament votre attention, posez-les sur une page. Écrivez chacune en quelques mots, puis dites : « Voilà ce que je porte. » La page peut garder ce que vous n’avez pas besoin de répéter pendant quelques minutes. Vous reviendrez ensuite à l’action concrète ; la prière ne la remplace pas. Pour l’instant, nommer aide à cesser de lutter contre l’existence de ces pensées.',
        ],
        reflectionPrompts: [
          'Quelle pensée continue de réclamer mon attention ?',
          'Demande-t-elle une prière, une action concrète, une conversation ou du repos ?',
        ],
      },
      {
        heading: 'Empruntez des mots lorsque les vôtres sont difficiles',
        paragraphs: [
          'Vous n’avez pas à créer une langue nouvelle à chaque prière. Des mots empruntés peuvent vous porter lorsque vos pensées sont emmêlées. Lisez lentement un court Psaume à voix haute. Son langage n’a pas besoin de correspondre exactement à votre expérience. Repérez une ligne qui donne une forme à ce que vous ne savez pas encore dire et répétez-la comme demande, protestation ou confiance.',
          'Vous pouvez aussi choisir une prière qui tient dans un souffle : « Dieu, rejoins-moi ici. » « Éclaire mon prochain pas. » « Porte ce que je ne peux pas porter. » La répétition n’est pas vide lorsqu’elle est attentive. Chaque retour rassemble l’esprit sans le gronder. Quand la distraction vient, remarquez-la et revenez à la phrase avec la douceur de celui qui raccompagne un enfant chez lui.',
        ],
      },
      {
        heading: 'Une prière de cinq minutes pour un esprit encombré',
        paragraphs: [
          'Une structure peut être bienveillante lorsque la concentration est limitée. Accordez-vous cinq minutes tranquilles, non comme un compte à rebours vers la réussite, mais comme la permission de ne pas tout porter à la fois. Gardez les yeux ouverts si les fermer amplifie les pensées. Asseyez-vous, marchez lentement ou tenez une tasse chaude. Choisissez une posture qui vous aide à être présent, pas seulement une posture qui paraît pieuse.',
        ],
        numberedPractices: [
          'Arrivez pendant une minute. Sentez vos pieds, votre respiration et la pièce. Dites : « Je suis ici, et Dieu est ici. »',
          'Nommez pendant une minute. Dites ou écrivez la préoccupation centrale sans la rendre plus présentable.',
          'Recevez pendant une minute. Lisez deux ou trois versets et choisissez une phrase à garder.',
          'Demandez pendant une minute. Demandez la grâce, le courage, la sagesse ou l’aide pour le prochain pas fidèle, pas pour tous les avenirs possibles.',
          'Déposez pendant une minute. Terminez la main ouverte : « Ce que je ne peux pas résoudre maintenant, je te le confie. »',
        ],
      },
      {
        heading: 'N’utilisez pas les Écritures pour faire taire une détresse réelle',
        paragraphs: [
          'Un verset peut offrir présence et perspective, mais ne doit pas devenir une arme contre vos émotions. Lire « ne vous inquiétez pas » comme « une personne fidèle ne ressentirait pas cela » ajoute de la honte à la détresse. Lisez le contexte. Remarquez l’invitation, la relation et les pratiques proposées. L’espérance biblique n’est pas le déni ; elle peut coexister avec la plainte, les questions et le besoin d’aide.',
          'Il est également sage de distinguer pratique spirituelle et soins de santé. La prière peut apporter un soutien profond, mais elle ne remplace pas un accompagnement professionnel. Si l’anxiété, la panique, l’insomnie ou la détresse persistent, deviennent intenses ou affectent votre sécurité et votre quotidien, parlez-en à un professionnel qualifié en santé mentale ou à un médecin. En cas de danger immédiat ou d’idées d’automutilation, contactez maintenant les urgences ou une ligne de crise de votre pays et une personne de confiance.',
        ],
      },
      {
        heading: 'Laissez la prière se terminer par un prochain pas',
        paragraphs: [
          'Un esprit agité cherche souvent une certitude pour tout l’avenir. La prière peut réduire l’horizon à la fidélité du prochain instant. Il vous faut peut-être envoyer un message, noter la première tâche de demain, boire de l’eau, demander pardon, chercher de l’aide ou aller dormir. Une réponse concrète ne résout pas tout, mais donne à l’inquiétude un lieu où avancer.',
          'Parfois, le prochain pas consiste simplement à reprendre la même courte prière plus tard. Ne mesurez pas la prière à votre ressenti immédiat. La paix n’est pas un indicateur de performance. Le geste honnête de se tourner vers Dieu, de recevoir quelques paroles vraies et de choisir la prochaine action aimante est déjà une pratique pleine de sens, même si les pensées continuent à bouger.',
        ],
        reflectionPrompts: [
          'Qu’est-ce que j’essaie de résoudre en une seule fois ?',
          'De quelle grâce ai-je besoin pour l’heure qui vient plutôt que pour tout l’avenir ?',
          'Qui pourrait m’aider à porter cela avec sagesse ?',
        ],
      },
    ],
  },
  'read-scripture-with-curiosity': {
    title: 'Lire les Écritures avec curiosité : une méthode en cinq étapes',
    description:
      'Une méthode concrète pour dépasser les réponses rapides en observant le contexte, en posant de meilleures questions, en suivant les liens et en répondant honnêtement.',
    category: 'Étude biblique',
    publishedAt: '2026-07-28',
    dateLabel: '28 juillet 2026',
    readTime: '11 min de lecture',
    heroQuote: 'La curiosité ralentit notre désir de faire dire quelque chose au texte et ouvre un espace pour entendre ce qu’il dit réellement.',
    sections: [
      {
        heading: 'Remplacez la pression de tout comprendre',
        paragraphs: [
          'Nous approchons souvent la Bible avec deux attentes peu utiles : le sens devrait être immédiatement évident et chaque lecture devrait produire une leçon personnelle. Quand ce n’est pas le cas, nous parcourons le texte plus vite, cherchons la réponse de quelqu’un d’autre ou décidons que nous ne savons pas lire les Écritures. La curiosité propose une autre posture. Elle considère la confusion comme une porte vers l’attention plutôt qu’une preuve d’échec.',
          'Un lecteur curieux questionne avant de conclure. Qui parle ? Que s’est-il passé juste avant ? Pourquoi ce détail revient-il ? De quel genre de texte s’agit-il ? Que reconnaissaient les premiers auditeurs que j’ignore ? Ces questions ne rendent pas la lecture froide ou seulement académique. Elles nous empêchent d’imposer nos présupposés et peuvent approfondir l’émerveillement, l’humilité et la réponse.',
        ],
      },
      {
        heading: 'La méthode : Lire, Remarquer, Questionner, Relier, Répondre',
        paragraphs: [
          'Choisissez un passage assez court pour être relu, peut-être six à quinze versets. La méthode fonctionne mieux si vous notez quelques observations. Aucun outil particulier n’est nécessaire au premier passage. Laissez le texte faire entendre sa voix avant d’ouvrir notes, commentaires ou résultats de recherche.',
        ],
        numberedPractices: [
          'Lisez. Lisez une fois pour saisir le mouvement général. Identifiez le genre, celui qui parle, le public, la situation et ce qui change entre le début et la fin.',
          'Remarquez. Relevez les mots répétés, contrastes, causes et conséquences, questions, images, ordres, promesses et surprises. Écrivez les observations avant les interprétations.',
          'Questionnez. Transformez ce que vous remarquez en vraies questions. Notez ce qui est clair, ce qui reste incertain et les présupposés que vous apportez peut-être.',
          'Reliez. Lisez les paragraphes voisins, puis suivez les thèmes ou citations importantes ailleurs dans la Bible. Laissez le contexte le plus clair limiter les suppositions imaginatives.',
          'Répondez. Résumez le mouvement central avec vos mots. Nommez ce qui invite à la confiance, au repentir, à la gratitude, au courage ou à une étude plus poussée, puis choisissez une réponse proportionnée.',
        ],
      },
      {
        heading: 'Séparez observation et interprétation',
        paragraphs: [
          'L’observation décrit ce qui est sur la page : « La question apparaît trois fois », « la foule s’en va » ou « le poème passe de la plainte à la louange ». L’interprétation propose le sens de ces détails. Les deux comptent, mais les garder séparées un moment diminue le risque que notre première impression devienne la seule lecture possible.',
          'Essayez deux colonnes. Dans la première, écrivez seulement ce qu’un autre lecteur pourrait montrer dans le texte. Dans la seconde, inscrivez les sens possibles et leurs indices. Employez « Cela pourrait suggérer… » plutôt que d’affirmer trop vite. Il ne s’agit pas d’hésiter sans fin, mais de construire une confiance responsable, façonnée par les indices, le contexte et l’ensemble du témoignage biblique.',
        ],
      },
      {
        heading: 'Laissez le genre modifier les questions',
        paragraphs: [
          'Un proverbe décrit des chemins de sagesse ; ce n’est généralement pas une garantie absolue. La poésie emploie images et intensité. Une lettre appartient à une vraie communauté confrontée à un problème précis. Un récit raconte ce qui s’est passé sans approuver chaque geste. La prophétie peut mêler avertissement, espérance, symbole et situation historique. Une technique unique ne s’applique pas mécaniquement à tout.',
          'Avant de conclure, nommez le genre et demandez ce qu’un lecteur attend normalement de ce type d’écriture. Dans un Psaume, observez le mouvement, la métaphore et la prière. Dans une scène d’Évangile, les personnages, le conflit et les choix du narrateur. Dans une lettre, suivez l’argument entre les paragraphes et les mots comme « donc », « mais » et « car ». Le genre ne bloque pas le sens ; il participe à sa communication.',
        ],
      },
      {
        heading: 'Utilisez les outils après avoir prêté attention',
        paragraphs: [
          'Bibles d’étude, renvois, cartes, dictionnaires, enseignants fiables et outils de recherche peuvent éclairer les questions historiques et linguistiques. Servez-vous-en pour tester et enrichir ce que vous avez remarqué, pas pour contourner la rencontre. Comparez plusieurs sources sérieuses lorsqu’un point fait débat et distinguez le texte biblique de la conclusion d’un commentateur.',
          'La technologie peut retrouver des passages et organiser des thèmes, mais les résumés générés peuvent se tromper et ne doivent jamais être présentés comme l’Écriture. Vérifiez les citations dans une traduction biblique fiable et examinez leur contexte. Un bon outil vous ramène au texte avec de meilleures questions. Un mauvais répond si vite que vous cessez de regarder.',
        ],
      },
      {
        heading: 'Restez honnête devant un passage difficile',
        paragraphs: [
          'Certains passages sont difficiles parce que leur monde nous est étranger. D’autres soulèvent de sérieuses questions morales, théologiques ou personnelles. La curiosité ne demande pas de prétendre que ces tensions sont simples. Écrivez clairement la difficulté. Cherchez le contexte historique, lisez les désaccords d’interprètes attentifs et demandez comment le passage rejoint le caractère et l’enseignement de Jésus et l’histoire biblique dans son ensemble.',
          'Résistez au rejet rapide comme à la défense précipitée. L’humilité peut dire « Je ne comprends pas encore » tout en continuant à apprendre. Si un texte a servi à vous blesser ou vous contrôler, étudiez auprès de personnes fiables qui respectent votre liberté et votre sécurité. Une lecture sage porte de bons fruits : vérité, amour, justice, repentance, courage et attention à Dieu et au prochain, non contrainte ou mépris.',
        ],
      },
      {
        heading: 'Créez une pratique hebdomadaire de curiosité',
        paragraphs: [
          'Choisissez un court passage pour la semaine. Le premier jour, lisez et remarquez. Le deuxième, recueillez les questions. Le troisième, explorez le contexte immédiat. Le quatrième, suivez un thème ou un renvoi. Le cinquième, consultez une ou deux ressources fiables. Le sixième, écrivez un résumé. Le septième, revenez au texte et répondez par la prière ou l’action.',
          'La relecture permet au texte de devenir plus qu’un prétexte à une pensée rapide. Des détails apparaissent, les questions mûrissent et les conclusions hâtives se desserrent. Vous terminerez peut-être avec des questions ouvertes. Ce n’est pas du temps perdu. La curiosité apprend à rester assez longtemps pour que la compréhension s’approfondisse et à vivre avec conviction comme avec humilité.',
        ],
        reflectionPrompts: [
          'Qu’ai-je remarqué seulement à la deuxième ou troisième lecture ?',
          'Quelle conclusion est solidement étayée et laquelle reste provisoire ?',
          'Quelle réponse respecte le passage sans lui faire dire davantage ?',
        ],
      },
    ],
  },
} satisfies Record<BlogSlug, BlogPostContent>;

const pt = {
  [PRAYER_SPACE_ARTICLE_SLUG]: prayerSpaceArticleByLocale.pt,
  'a-gentle-daily-scripture-rhythm': {
    title: 'Um ritmo diário e gentil com as Escrituras que cabe na vida real',
    description:
      'Uma forma prática e cheia de graça de voltar à Bíblia com constância, sem transformar a vida espiritual em mais uma meta de desempenho.',
    category: 'Ritmos diários',
    publishedAt: '2026-07-28',
    updatedAt: '2026-09-07',
    dateLabel: '28 de julho de 2026',
    readTime: '9 min de leitura',
    heroQuote: 'Um ritmo duradouro não nasce de dias perfeitos, mas de saber voltar nos dias comuns.',
    sections: [
      {
        heading: 'Comece pela relação, não pela sequência',
        paragraphs: [
          'Muitas tentativas de leitura diária da Bíblia começam com um desejo sincero e, aos poucos, viram um teste de disciplina. Escolhemos um plano ambicioso, perdemos uma manhã e sentimos que estragamos tudo. As Escrituras passam a carregar o peso emocional de uma tarefa em que estamos falhando, em vez de serem um convite para conhecer Deus. Um ritmo mais gentil muda a pergunta: em vez de “Como nunca mais faltar?”, pergunte “Como posso tornar o retorno simples?”',
          'A constância importa, mas é fruto, não centro. O centro é a atenção: receber as palavras diante de você, perceber o que revelam e responder com honestidade. Em alguns dias isso levará vinte minutos. Em um dia cheio, talvez seja um parágrafo lido duas vezes. Ambos podem ser encontros reais. Uma prática pequena, feita com presença, alimenta mais do que uma grande prática apressada para proteger uma sequência.',
        ],
      },
      {
        heading: 'Escolha uma âncora que já existe',
        paragraphs: [
          'Hábitos ficam mais fáceis quando se ligam a um momento que já faz parte da vida. Escolha uma âncora reconhecível: o primeiro café, o trajeto para o trabalho, a volta da escola, o instante antes de abrir o computador ou os minutos depois de escovar os dentes à noite. A âncora é mais útil que um horário exato porque a rotina se move. “Depois de fazer o café” resiste melhor a uma manhã atrasada do que “às 6h15”.',
          'Prepare o caminho antes de precisar dele. Deixe a Bíblia onde esse momento acontece, marque a passagem de amanhã ou mantenha caderno e caneta juntos. Ative o modo Não Perturbe se o celular costuma puxar sua atenção. Isso não é uma técnica elaborada de produtividade; é um pequeno gesto de hospitalidade com a sua atenção futura. Você facilita o sim quando a hora chega.',
        ],
        reflectionPrompts: [
          'Qual parte do meu dia é estável o bastante para servir de âncora?',
          'Que pequena dificuldade posso remover ainda hoje?',
        ],
      },
      {
        heading: 'Use uma prática de quatro movimentos',
        paragraphs: [
          'Uma forma repetível elimina a pressão de fabricar uma experiência espiritual nova todos os dias. Os movimentos abaixo são intencionalmente simples. Funcionam com um trecho dos Evangelhos, um Salmo, parte de uma carta ou uma leitura de um plano maior. Vá devagar o suficiente para notar, sem se preocupar em executar cada etapa com perfeição.',
        ],
        numberedPractices: [
          'Chegue. Respire sem pressa e nomeie o que você traz: distração, gratidão, cansaço, esperança ou incerteza. Não é preciso ficar calmo antes de começar.',
          'Leia. Leia um trecho curto uma vez para perceber o movimento geral e depois outra vez, mais devagar. Se uma frase chamar sua atenção, pare ali em vez de correr até o fim.',
          'Perceba. Pergunte o que o texto mostra sobre Deus, as pessoas, o desejo, o medo, a graça ou uma ação fiel. Separe o que está no texto do que você esperava encontrar.',
          'Responda. Faça uma oração honesta de uma frase e escolha uma pequena resposta para o dia: guardar uma frase, pedir perdão, esperar, agradecer ou formular uma pergunta melhor.',
        ],
      },
      {
        heading: 'Defina um mínimo para dias cheios',
        paragraphs: [
          'Decida antes o que conta quando tempo e energia estiverem escassos. Um mínimo compassivo pode ser: ler quatro versículos, escolher uma frase e fazer uma oração. Não é uma brecha nem uma fé menor. É uma forma de manter a porta aberta. Quando as únicas opções parecem ser um estudo completo ou nada, o nada vence vezes demais.',
          'Seu mínimo precisa ser pequeno o bastante para ser feito com sinceridade durante uma viagem, no cuidado de alguém ou em uma fase exigente. Nos dias espaçosos, fique mais. Nos difíceis, preserve o fio. Um ritmo pode se expandir e se contrair sem desaparecer. Essa flexibilidade permite que ele se torne parte da vida, e não apenas um projeto curto.',
        ],
      },
      {
        heading: 'Deixe os dias perdidos ensinarem você a voltar',
        paragraphs: [
          'Você vai perder alguns dias. O momento decisivo não é a falta, mas a história que você conta depois. A vergonha diz que você provou ser inconstante e deve esperar um recomeço perfeito. A graça diz que hoje está disponível. Não dobre a leitura seguinte como punição e não gaste todo o tempo revendo a falha. Abra a passagem de hoje — ou a próxima da sequência — e comece.',
          'Se as interrupções se repetirem, trate-as como informação. Talvez a âncora seja irrealista, a leitura longa demais ou o plano inadequado à sua fase. Ajustar a prática não é abandoná-la. Quem cuida de um bebê, quem atravessa provas e quem trabalha em turnos precisa de formatos diferentes. A fidelidade responde à realidade; não finge que ela não existe.',
        ],
      },
      {
        heading: 'Experimente por sete dias',
        paragraphs: [
          'Durante uma semana, use a mesma âncora e os quatro movimentos. Mantenha a passagem curta o bastante para reler. Ao final de cada dia, escreva apenas uma linha: “Hoje eu percebi…” Não dê nota à experiência. A linha serve para guardar atenção, não para provar que toda leitura foi profunda.',
          'No fim da semana, observe o que ajudou você a estar presente. Guarde o que serviu a esse propósito e solte o que criou pressão desnecessária. Então comece outra semana. Um ritmo diário cresce por meio dessas revisões silenciosas. Com o tempo, o gesto familiar de voltar se torna uma acolhida: um lugar onde você pode chegar com honestidade e escutar de novo.',
        ],
        reflectionPrompts: [
          'O que notei mais de uma vez nesta semana?',
          'Quando a prática pareceu mais viva e honesta?',
          'Que ajuste tornaria o retorno mais gentil na próxima semana?',
        ],
      },
    ],
  },
  'praying-when-your-mind-will-not-slow-down': {
    title: 'Como orar quando a mente não desacelera',
    description:
      'Formas simples e honestas de orar em meio ao barulho mental, sem fingir paz nem tratar a oração como uma prova.',
    category: 'Oração',
    publishedAt: '2026-07-28',
    dateLabel: '28 de julho de 2026',
    readTime: '10 min de leitura',
    heroQuote: 'A oração não começa quando todos os pensamentos se aquietam. Começa quando você traz a mente que realmente tem.',
    sections: [
      {
        heading: 'Você não precisa se acalmar antes de orar',
        paragraphs: [
          'Quando os pensamentos correm, orar pode parecer impossível. Você inicia uma frase e lembra de uma tarefa inacabada. Tenta ficar quieto e percebe ainda mais cada preocupação. É fácil concluir que está orando mal. Mas uma atenção que se dispersa não é falha moral, e a agitação não coloca você fora da presença de Deus. Os Salmos estão cheios de vozes que chegam angustiadas, confusas, iradas e com medo.',
          'Comece abandonando a exigência de fabricar um estado espiritual. A oração pode ser distraída e ainda sincera. Pode conter repetição, silêncio, lágrimas, frases incompletas ou uma lista no papel quando as palavras faladas não se sustentam. O objetivo não é demonstrar controle sobre o mundo interior, mas praticar uma presença verdadeira diante de Deus dentro dele.',
        ],
      },
      {
        heading: 'Dê nome ao barulho',
        paragraphs: [
          'O ruído mental costuma parecer maior quando permanece vago. Tente nomear o que acontece sem julgamento: “Estou repetindo aquela conversa.” “Tenho medo de amanhã.” “Meu corpo está cansado e meus pensamentos pulam.” Nomear não é resolver. É apenas transformar uma nuvem em algo que pode ser levado à oração.',
          'Se várias preocupações disputam sua atenção, coloque-as no papel. Escreva cada uma em poucas palavras e diga: “Estas são as coisas que estou carregando.” A página pode segurar o que você não precisa ensaiar nos próximos minutos. Você poderá voltar à ação prática depois; oração não substitui ação. Por agora, nomear ajuda a parar de lutar contra a existência desses pensamentos.',
        ],
        reflectionPrompts: [
          'Que pensamento continua pedindo minha atenção?',
          'Ele pede oração, um próximo passo prático, uma conversa ou descanso?',
        ],
      },
      {
        heading: 'Use palavras emprestadas quando as suas forem difíceis',
        paragraphs: [
          'Você não precisa criar uma linguagem nova toda vez que ora. Palavras emprestadas podem sustentar você quando os pensamentos estão emaranhados. Leia um Salmo curto em voz alta, devagar o bastante para ouvi-lo. A linguagem não precisa coincidir perfeitamente com sua experiência. Perceba uma linha que dê forma ao que você ainda não consegue dizer e repita-a como pedido, protesto ou confiança.',
          'Você também pode usar uma oração breve que caiba em uma respiração: “Deus, encontra-me aqui.” “Dá-me luz para o próximo passo.” “Sustenta o que eu não consigo sustentar.” A repetição não é vazia quando há atenção. Cada retorno reúne a mente sem repreendê-la. Quando a distração vier, perceba-a e volte à frase com a gentileza de quem conduz uma criança para casa.',
        ],
      },
      {
        heading: 'Uma oração de cinco minutos para uma mente cheia',
        paragraphs: [
          'Uma estrutura pode ser bondosa quando a concentração é pequena. Reserve cinco minutos tranquilos — não como contagem para o sucesso, mas como permissão para não carregar tudo ao mesmo tempo. Mantenha os olhos abertos se fechá-los aumentar o barulho. Sente-se, caminhe devagar ou segure uma xícara quente. Escolha uma postura que ajude a permanecer presente, não apenas uma que pareça religiosa.',
        ],
        numberedPractices: [
          'Chegue por um minuto. Perceba os pés, a respiração e o ambiente. Diga: “Eu estou aqui, e Deus está aqui.”',
          'Nomeie por um minuto. Fale ou escreva a preocupação central sem editá-la para soar respeitável.',
          'Receba por um minuto. Leia dois ou três versículos e escolha uma frase para guardar.',
          'Peça por um minuto. Peça a graça, a coragem, a sabedoria ou a ajuda necessárias para o próximo passo fiel — não para todos os futuros possíveis.',
          'Entregue por um minuto. Termine com a mão aberta e as palavras: “O que não posso resolver agora, eu confio a ti.”',
        ],
      },
      {
        heading: 'Não use as Escrituras para calar uma dor honesta',
        paragraphs: [
          'Um versículo pode oferecer companhia e perspectiva, mas não deve virar arma contra suas emoções. Ler “não andem ansiosos” como “uma pessoa fiel não sentiria isso” acrescenta vergonha ao sofrimento. Leia o contexto. Perceba o convite, a relação e as práticas ali presentes. A esperança bíblica não é negação; ela pode conviver com lamento, perguntas e necessidade de ajuda.',
          'Também é importante distinguir prática espiritual de cuidado de saúde. A oração pode oferecer apoio profundo, mas não substitui acompanhamento profissional. Se ansiedade, pânico, insônia ou sofrimento forem persistentes, intensos ou afetarem sua segurança e vida diária, considere procurar um profissional de saúde mental ou médico qualificado. Se houver perigo imediato ou pensamentos de se machucar, contate agora o serviço de emergência ou uma linha de crise do seu país e procure alguém de confiança.',
        ],
      },
      {
        heading: 'Deixe a oração terminar em um próximo passo',
        paragraphs: [
          'Uma mente acelerada costuma querer certeza sobre todo o futuro. A oração pode estreitar o horizonte para o que significa ser fiel agora. Talvez você precise enviar uma mensagem, anotar a primeira tarefa de amanhã, beber água, pedir perdão, buscar ajuda ou dormir. Uma resposta concreta não resolve tudo, mas oferece um lugar para a preocupação se mover.',
          'Às vezes, o próximo passo é apenas voltar à mesma oração breve mais tarde. Não meça a oração pelo que você sente imediatamente. Paz não é indicador de desempenho. O gesto honesto de voltar-se para Deus, receber algumas palavras verdadeiras e escolher a próxima ação amorosa já é uma prática significativa — mesmo enquanto os pensamentos continuam em movimento.',
        ],
        reflectionPrompts: [
          'O que estou tentando resolver de uma só vez?',
          'De que graça preciso para a próxima hora, e não para todo o futuro?',
          'Quem poderia me ajudar a carregar isso com sabedoria?',
        ],
      },
    ],
  },
  'read-scripture-with-curiosity': {
    title: 'Leia as Escrituras com curiosidade: um método repetível em cinco partes',
    description:
      'Um método prático para ir além das respostas rápidas, percebendo contexto, fazendo perguntas melhores, seguindo conexões e respondendo com honestidade.',
    category: 'Estudo bíblico',
    publishedAt: '2026-07-28',
    updatedAt: '2026-09-07',
    dateLabel: '28 de julho de 2026',
    readTime: '11 min de leitura',
    heroQuote: 'A curiosidade desacelera a pressa de fazer um texto dizer algo e abre espaço para ouvir o que ele realmente diz.',
    sections: [
      {
        heading: 'Troque a pressão de entender tudo',
        paragraphs: [
          'Muitas pessoas se aproximam da Bíblia com duas expectativas pouco úteis: que o sentido deveria ser óbvio imediatamente e que toda leitura deveria produzir uma lição pessoal. Quando isso não acontece, lemos mais depressa, buscamos a resposta de outra pessoa ou decidimos que não somos bons nas Escrituras. A curiosidade oferece outra postura. Ela trata a confusão como porta para a atenção, não como prova de fracasso.',
          'Quem lê com curiosidade pergunta antes de concluir. Quem está falando? O que aconteceu antes? Por que este detalhe se repete? Que tipo de texto é este? O que os primeiros ouvintes reconheceriam que eu não reconheço? Essas perguntas não tornam a leitura fria ou apenas acadêmica. Elas protegem contra a imposição de nossas suposições e podem aprofundar admiração, humildade e resposta.',
        ],
      },
      {
        heading: 'O método: Leia, Perceba, Pergunte, Conecte, Responda',
        paragraphs: [
          'Use uma passagem curta o bastante para ser lida várias vezes — talvez de seis a quinze versículos. O método funciona melhor quando você registra algumas observações. Não são necessárias ferramentas especiais na primeira leitura. Deixe o texto ter voz própria antes de abrir notas, comentários ou resultados de busca.',
        ],
        numberedPractices: [
          'Leia. Leia uma vez para perceber o movimento completo. Identifique gênero, quem fala, público, cenário e o que muda do início ao fim.',
          'Perceba. Marque palavras repetidas, contrastes, relações de causa e efeito, perguntas, imagens, ordens, promessas e surpresas. Escreva observações antes das interpretações.',
          'Pergunte. Transforme o que percebeu em perguntas genuínas. Registre o que está claro, o que continua incerto e que suposição você pode estar trazendo.',
          'Conecte. Leia os parágrafos ao redor e siga temas ou citações importantes em outras partes da Bíblia. Deixe o contexto mais claro limitar hipóteses imaginativas.',
          'Responda. Resuma o movimento central com suas palavras. Nomeie o que convida à confiança, arrependimento, gratidão, coragem ou estudo e escolha uma resposta proporcional.',
        ],
      },
      {
        heading: 'Separe observação de interpretação',
        paragraphs: [
          'A observação descreve o que está na página: “A pergunta aparece três vezes”, “a multidão vai embora” ou “o poema passa da queixa ao louvor”. A interpretação propõe o sentido desses detalhes. Ambas importam, mas mantê-las separadas por um tempo reduz a chance de transformar a primeira impressão na única leitura possível.',
          'Experimente duas colunas. Na primeira, escreva apenas o que outro leitor poderia apontar no texto. Na segunda, registre sentidos possíveis e a evidência de cada um. Use expressões como “Isso pode sugerir…” em vez de declarar certeza cedo demais. O objetivo não é hesitar para sempre, mas construir uma confiança responsável, moldada por evidência, contexto e pelo testemunho mais amplo das Escrituras.',
        ],
      },
      {
        heading: 'Deixe o gênero mudar as perguntas',
        paragraphs: [
          'Um provérbio descreve padrões de sabedoria; normalmente não é garantia incondicional. A poesia usa imagem e intensidade emocional. Uma carta pertence a uma comunidade real e a um problema específico. A narrativa conta o que aconteceu sem aprovar necessariamente cada ação. A profecia pode combinar alerta, esperança, símbolo e circunstância histórica. A mesma técnica não pode ser aplicada mecanicamente a tudo.',
          'Antes de concluir, nomeie o gênero e pergunte o que leitores costumam esperar desse tipo de escrita. Em um Salmo, note movimento, metáfora e oração. Em uma cena dos Evangelhos, observe personagens, conflito e ênfase do narrador. Em uma carta, acompanhe o argumento entre parágrafos e conectivos como “portanto”, “mas” e “porque”. O gênero não é barreira para o sentido; faz parte de como o sentido é comunicado.',
        ],
      },
      {
        heading: 'Use ferramentas depois de prestar atenção',
        paragraphs: [
          'Bíblias de estudo, referências cruzadas, mapas, dicionários, professores confiáveis e ferramentas de busca podem esclarecer questões históricas e linguísticas. Use-os para testar e enriquecer o que você percebeu, não para evitar o encontro. Compare mais de uma fonte responsável quando houver divergência e diferencie o texto bíblico da conclusão de um comentarista.',
          'A tecnologia pode ajudar a localizar passagens e organizar temas, mas resumos gerados podem errar e nunca devem ser apresentados como Escritura. Confira citações em uma tradução bíblica confiável e examine o contexto. Uma boa ferramenta devolve você ao texto com perguntas melhores. Uma ferramenta ruim responde tão rápido que você para de olhar.',
        ],
      },
      {
        heading: 'Permaneça honesto diante de um texto difícil',
        paragraphs: [
          'Alguns textos são difíceis porque o mundo por trás deles é desconhecido. Outros levantam questões morais, teológicas ou pessoais sérias. Curiosidade não exige fingir que essas tensões são simples. Escreva a dificuldade com clareza. Busque contexto histórico, leia como intérpretes cuidadosos divergem e pergunte como a passagem se relaciona com o caráter e o ensino de Jesus e com a história bíblica mais ampla.',
          'Resista tanto ao descarte rápido quanto à defesa apressada. A humildade pode dizer “Ainda não entendo” e continuar aprendendo. Se uma passagem foi usada para ferir ou controlar você, estude na companhia de pessoas confiáveis que respeitem sua autonomia e segurança. Uma leitura sábia produz bons frutos: verdade, amor, justiça, arrependimento, coragem e mais atenção a Deus e ao próximo — não coerção ou desprezo.',
        ],
      },
      {
        heading: 'Crie uma prática semanal de curiosidade',
        paragraphs: [
          'Escolha uma passagem curta para a semana. No primeiro dia, leia e perceba. No segundo, reúna perguntas. No terceiro, explore o contexto imediato. No quarto, siga um tema ou referência. No quinto, consulte uma ou duas fontes confiáveis. No sexto, escreva um pequeno resumo. No sétimo, volte ao texto e responda em oração ou ação.',
          'A releitura permite que o texto seja mais que um ponto de partida para uma ideia rápida. Detalhes surgem, perguntas amadurecem e conclusões prematuras afrouxam. Talvez a semana termine com questões abertas. Isso não é estudo perdido. A curiosidade ensina a permanecer presente o bastante para aprofundar o entendimento — e a levar convicção e humildade para a forma de viver.',
        ],
        reflectionPrompts: [
          'O que percebi somente na segunda ou terceira leitura?',
          'Que conclusão está bem sustentada e qual ainda é provisória?',
          'Que resposta corresponde ao texto sem fazê-lo dizer mais do que diz?',
        ],
      },
    ],
  },
} satisfies Record<BlogSlug, BlogPostContent>;

const de = {
  [PRAYER_SPACE_ARTICLE_SLUG]: prayerSpaceArticleByLocale.de,
  'a-gentle-daily-scripture-rhythm': {
    title: 'Ein sanfter täglicher Bibelrhythmus, der zum wirklichen Leben passt',
    description:
      'Ein praktischer und gnädiger Weg, regelmäßig zur Bibel zurückzukehren, ohne das geistliche Leben zu einem weiteren Leistungsziel zu machen.',
    category: 'Tägliche Rhythmen',
    publishedAt: '2026-07-28',
    dateLabel: '28. Juli 2026',
    readTime: '9 Min. Lesezeit',
    heroQuote: 'Ein tragfähiger Rhythmus entsteht nicht durch perfekte Tage, sondern dadurch, dass wir an gewöhnlichen Tagen zurückfinden.',
    sections: [
      {
        heading: 'Beginne mit Beziehung, nicht mit einer Serie',
        paragraphs: [
          'Viele Vorhaben zum täglichen Bibellesen beginnen mit ehrlicher Sehnsucht und werden unmerklich zu einer Disziplinprüfung. Wir wählen einen ehrgeizigen Plan, verpassen einen Morgen und glauben, alles sei verdorben. Die Bibel trägt dann das emotionale Gewicht einer Aufgabe, an der wir scheitern, statt eine Einladung zu sein, Gott kennenzulernen. Ein sanfterer Rhythmus verändert die Frage: Statt „Wie verpasse ich nie wieder einen Tag?“ frage „Wie kann ich die Rückkehr einfach machen?“',
          'Beständigkeit ist wichtig, aber sie ist eine Frucht und nicht der Mittelpunkt. Im Mittelpunkt steht Aufmerksamkeit: die Worte vor uns aufnehmen, wahrnehmen, was sie zeigen, und ehrlich antworten. An manchen Tagen dauert das zwanzig Minuten. An einem vollen Tag ist es vielleicht ein Absatz, zweimal gelesen. Beides kann eine wirkliche Begegnung sein. Eine kleine Praxis mit Gegenwart nährt mehr als eine große, die wir hastig erledigen, um eine Serie zu retten.',
        ],
      },
      {
        heading: 'Wähle einen Anker, der schon da ist',
        paragraphs: [
          'Gewohnheiten werden leichter, wenn sie an einen Moment geknüpft sind, der bereits zum Leben gehört: der erste Kaffee, die Zugfahrt, der Weg nach der Schule, der Augenblick vor dem Öffnen des Laptops oder die Minuten nach dem Zähneputzen. Ein Anker ist nützlicher als eine genaue Uhrzeit, weil Tagespläne sich verschieben. „Nachdem ich Tee gemacht habe“ übersteht einen späten Morgen besser als „um 6:15 Uhr“.',
          'Bereite den Weg vor, bevor du ihn brauchst. Lege eine Bibel dorthin, wo der Anker stattfindet, markiere den Text für morgen oder bewahre Notizbuch und Stift zusammen auf. Schalte „Nicht stören“ ein, wenn das Telefon dich leicht wegzieht. Das sind keine komplizierten Produktivitätstricks, sondern kleine Gesten der Gastfreundschaft für deine zukünftige Aufmerksamkeit. Du machst das Ja leichter, wenn der Moment kommt.',
        ],
        reflectionPrompts: [
          'Welcher Teil meines Tages ist verlässlich genug, um ein Anker zu werden?',
          'Welches kleine Hindernis kann ich heute Abend beseitigen?',
        ],
      },
      {
        heading: 'Nutze eine Praxis mit vier Bewegungen',
        paragraphs: [
          'Eine wiederholbare Form nimmt den Druck, jeden Tag ein neues geistliches Erlebnis erzeugen zu müssen. Die folgenden Bewegungen sind bewusst einfach. Sie funktionieren mit einem Abschnitt aus einem Evangelium, einem Psalm, einem Brief oder einem längeren Leseplan. Gehe langsam genug, um wahrzunehmen, ohne jeden Schritt perfekt erfüllen zu wollen.',
        ],
        numberedPractices: [
          'Ankommen. Atme einmal ohne Eile und benenne, was du mitbringst: Ablenkung, Dankbarkeit, Müdigkeit, Hoffnung oder Unsicherheit. Du musst nicht erst ruhig werden.',
          'Lesen. Lies einen kurzen Text zunächst im Ganzen und dann noch einmal langsamer. Wenn ein Satz deine Aufmerksamkeit weckt, bleibe dort, statt zum Ende zu eilen.',
          'Wahrnehmen. Frage, was der Text über Gott, Menschen, Sehnsucht, Angst, Gnade oder treues Handeln sagt. Unterscheide, was wirklich dasteht, von dem, was du erwartet hast.',
          'Antworten. Sprich einen ehrlichen Gebetssatz und wähle eine kleine Antwort für den Tag: einen Satz bewahren, um Vergebung bitten, warten, danken oder eine bessere Frage stellen.',
        ],
      },
      {
        heading: 'Bestimme ein Minimum für volle Tage',
        paragraphs: [
          'Entscheide im Voraus, was an Tagen mit wenig Zeit und Kraft zählt. Ein barmherziges Minimum könnte sein: vier Verse lesen, einen Satz auswählen und einen Satz beten. Das ist kein Schlupfloch und keine geringere Treue. Es hält die Tür offen. Wenn die einzigen Möglichkeiten ein vollständiges Studium oder gar nichts zu sein scheinen, gewinnt zu oft das Nichts.',
          'Dein Minimum sollte klein genug sein, um es auch auf Reisen, in der Pflege eines Menschen oder in einer fordernden Lebensphase ehrlich zu tun. An weiten Tagen bleib länger. An schweren Tagen halte den Faden. Ein Rhythmus kann sich ausdehnen und zusammenziehen, ohne zu verschwinden. Gerade diese Beweglichkeit macht ihn zu einem Teil des Lebens statt zu einem kurzlebigen Projekt.',
        ],
      },
      {
        heading: 'Lass versäumte Tage die Rückkehr lehren',
        paragraphs: [
          'Du wirst Tage auslassen. Entscheidend ist nicht das Versäumnis, sondern die Geschichte, die du danach erzählst. Scham sagt, du hättest deine Unbeständigkeit bewiesen und müsstest auf einen sauberen Neustart warten. Gnade sagt: Heute ist verfügbar. Verdopple die nächste Lesung nicht als Strafe und verbringe die Zeit nicht damit, dein Scheitern zu betrachten. Öffne den heutigen Text — oder den nächsten in der Reihe — und beginne.',
          'Wenn Unterbrechungen sich wiederholen, behandle sie als Information. Vielleicht ist der Anker unrealistisch, der Abschnitt zu lang oder der Plan passt nicht zu deiner jetzigen Situation. Eine Praxis anzupassen heißt nicht, sie aufzugeben. Eltern eines Neugeborenen, Studierende in Prüfungen und Menschen im Schichtdienst brauchen verschiedene Gefäße. Treue reagiert auf die Wirklichkeit; sie tut nicht so, als gäbe es sie nicht.',
        ],
      },
      {
        heading: 'Probiere es sieben Tage lang',
        paragraphs: [
          'Nutze eine Woche lang denselben Anker und die vier Bewegungen. Halte den Text so kurz, dass du ihn wiederholen kannst. Schreibe am Ende jedes Tages nur eine Zeile: „Heute ist mir aufgefallen …“ Bewerte die Erfahrung nicht. Die Zeile bewahrt Aufmerksamkeit; sie soll nicht beweisen, dass jede Lesung tief war.',
          'Schau am Ende der Woche, was dir geholfen hat, gegenwärtig zu sein. Behalte, was diesem Ziel diente, und lass los, was unnötigen Druck schuf. Dann beginne eine weitere Woche. Ein täglicher Bibelrhythmus wächst durch solche stillen Korrekturen. Mit der Zeit wird die vertraute Rückkehr selbst zu einem Willkommen — zu einem Ort, an dem du ehrlich ankommen und wieder hören kannst.',
        ],
        reflectionPrompts: [
          'Was ist mir in dieser Woche wiederholt aufgefallen?',
          'Wann fühlte sich die Praxis am lebendigsten oder ehrlichsten an?',
          'Welche Veränderung würde die Rückkehr nächste Woche sanfter machen?',
        ],
      },
    ],
  },
  'praying-when-your-mind-will-not-slow-down': {
    title: 'Wie du beten kannst, wenn deine Gedanken nicht langsamer werden',
    description:
      'Einfache, ehrliche Wege zum Gebet inmitten innerer Unruhe – ohne Frieden vorspielen oder das Gebet als Prüfung betrachten zu müssen.',
    category: 'Gebet',
    publishedAt: '2026-07-28',
    dateLabel: '28. Juli 2026',
    readTime: '10 Min. Lesezeit',
    heroQuote: 'Gebet beginnt nicht erst, wenn jeder Gedanke still ist. Es beginnt, wenn du den Geist mitbringst, den du wirklich hast.',
    sections: [
      {
        heading: 'Du musst vor dem Beten nicht ruhig werden',
        paragraphs: [
          'Wenn Gedanken rasen, kann Gebet unmöglich wirken. Du beginnst einen Satz und erinnerst dich an eine unerledigte Aufgabe. Du versuchst still zu sein und nimmst jede Sorge noch deutlicher wahr. Schnell entsteht der Eindruck, du würdest schlecht beten. Doch abschweifende Aufmerksamkeit ist kein moralisches Versagen, und Unruhe stellt dich nicht außerhalb von Gottes Gegenwart. Die Psalmen sind voller Stimmen, die bekümmert, verwirrt, wütend oder ängstlich ankommen.',
          'Lass zuerst die Forderung los, eine geistliche Stimmung herstellen zu müssen. Gebet kann zerstreut und trotzdem aufrichtig sein. Es darf Wiederholung, Schweigen, Tränen, unvollständige Sätze oder eine schriftliche Liste enthalten, wenn gesprochene Worte nicht zusammenhalten. Es geht nicht darum, Kontrolle über dein Inneres zu beweisen, sondern darin wahrhaftig vor Gott gegenwärtig zu sein.',
        ],
      },
      {
        heading: 'Gib dem Lärm einen Namen',
        paragraphs: [
          'Innerer Lärm wirkt oft größer, solange er unbestimmt bleibt. Benenne ohne Urteil, was geschieht: „Ich spiele dieses Gespräch immer wieder ab.“ „Ich fürchte mich vor morgen.“ „Mein Körper ist müde und meine Gedanken springen.“ Benennen ist nicht lösen. Es macht aus einer Wolke etwas, das du ins Gebet bringen kannst.',
          'Wenn mehrere Sorgen um Aufmerksamkeit ringen, lege sie auf eine Seite. Schreibe jede in wenigen Worten auf und sage: „Das sind die Dinge, die ich trage.“ Das Papier kann halten, was du in den nächsten Minuten nicht weiter proben musst. Später kannst du zu praktischen Schritten zurückkehren; Gebet ersetzt Handeln nicht. Jetzt hilft das Benennen, nicht länger gegen die bloße Existenz der Gedanken zu kämpfen.',
        ],
        reflectionPrompts: [
          'Welcher Gedanke verlangt immer wieder meine Aufmerksamkeit?',
          'Braucht er Gebet, einen konkreten Schritt, ein Gespräch oder Ruhe?',
        ],
      },
      {
        heading: 'Leihe dir Worte, wenn eigene schwerfallen',
        paragraphs: [
          'Du musst nicht bei jedem Gebet neue Sprache erzeugen. Geliehene Worte können dich tragen, wenn die eigenen Gedanken verknotet sind. Lies einen kurzen Psalm langsam laut. Seine Sprache muss nicht vollkommen zu deinem Erleben passen. Suche eine Zeile, die dem Form gibt, was du noch nicht sagen kannst, und wiederhole sie als Bitte, Klage oder Ausdruck des Vertrauens.',
          'Du kannst auch ein Gebet nutzen, das in einen Atemzug passt: „Gott, begegne mir hier.“ „Gib mir Licht für den nächsten Schritt.“ „Trage, was ich nicht tragen kann.“ Wiederholung ist nicht leer, wenn sie aufmerksam geschieht. Jede Rückkehr sammelt den Geist, ohne ihn zu tadeln. Wenn Ablenkung kommt, nimm sie wahr und kehre so freundlich zum Satz zurück, wie du ein Kind nach Hause begleiten würdest.',
        ],
      },
      {
        heading: 'Ein Fünf-Minuten-Gebet für einen vollen Kopf',
        paragraphs: [
          'Struktur kann freundlich sein, wenn Konzentration knapp ist. Setze einen ruhigen Rahmen von fünf Minuten — nicht als Countdown zum Erfolg, sondern als Erlaubnis, nicht alles gleichzeitig zu tragen. Lass die Augen offen, wenn das Schließen die Gedanken lauter macht. Sitze, gehe langsam oder halte eine warme Tasse. Wähle eine Haltung, die dir Gegenwart ermöglicht, nicht nur eine, die gebetvoll aussieht.',
        ],
        numberedPractices: [
          'Eine Minute ankommen. Spüre Füße, Atmung und Raum. Sage: „Ich bin hier, und Gott ist hier.“',
          'Eine Minute benennen. Sprich oder schreibe die zentrale Sorge aus, ohne sie in respektable Sprache umzuschreiben.',
          'Eine Minute empfangen. Lies zwei oder drei Verse und wähle einen Satz zum Festhalten.',
          'Eine Minute bitten. Bitte um Gnade, Mut, Weisheit oder Hilfe für den nächsten treuen Schritt — nicht für jede denkbare Zukunft.',
          'Eine Minute loslassen. Beende mit offener Hand: „Was ich jetzt nicht lösen kann, vertraue ich dir an.“',
        ],
      },
      {
        heading: 'Nutze die Bibel nicht, um ehrliche Not zum Schweigen zu bringen',
        paragraphs: [
          'Ein Vers kann Begleitung und Perspektive schenken, sollte aber nicht zur Waffe gegen deine Gefühle werden. „Sorgt euch nicht“ als „Ein gläubiger Mensch würde so etwas nicht fühlen“ zu lesen, fügt der Not Scham hinzu. Lies den Zusammenhang. Achte auf Einladung, Beziehung und die genannten Praktiken. Biblische Hoffnung ist keine Verleugnung; sie kann mit Klage, Fragen und dem Bedürfnis nach Hilfe bestehen.',
          'Es ist außerdem wichtig, geistliche Praxis von Gesundheitsversorgung zu unterscheiden. Gebet kann tief unterstützen, ersetzt aber keine professionelle Hilfe. Wenn Angst, Panik, Schlaflosigkeit oder Belastung anhalten, sehr stark sind oder Sicherheit und Alltag beeinträchtigen, sprich mit einer qualifizierten psychotherapeutischen oder medizinischen Fachperson. Bei unmittelbarer Gefahr oder Gedanken an Selbstverletzung wende dich jetzt an den Notruf oder eine Krisenhilfe in deinem Land und an einen Menschen deines Vertrauens.',
        ],
      },
      {
        heading: 'Lass das Gebet mit einem nächsten Schritt enden',
        paragraphs: [
          'Ein unruhiger Geist will oft Gewissheit über die ganze Zukunft. Gebet kann den Horizont auf den nächsten treuen Schritt verengen. Vielleicht musst du eine Nachricht senden, die erste Aufgabe für morgen notieren, Wasser trinken, dich entschuldigen, Hilfe suchen oder schlafen gehen. Eine konkrete Antwort löst nicht alles, gibt der Sorge aber einen Ort, an den sie sich bewegen kann.',
          'Manchmal ist der nächste Schritt nur, später zu demselben kurzen Gebet zurückzukehren. Miss das Gebet nicht daran, ob du dich sofort anders fühlst. Frieden ist keine Leistungskennzahl. Sich ehrlich Gott zuzuwenden, einige wahre Worte zu empfangen und die nächste liebevolle Handlung zu wählen, ist bereits eine bedeutsame Praxis — auch wenn die Gedanken weiterziehen.',
        ],
        reflectionPrompts: [
          'Was versuche ich auf einmal zu lösen?',
          'Welche Gnade brauche ich für die nächste Stunde statt für die ganze Zukunft?',
          'Wer könnte mir helfen, das weise zu tragen?',
        ],
      },
    ],
  },
  'read-scripture-with-curiosity': {
    title: 'Die Bibel neugierig lesen: eine wiederholbare Methode in fünf Schritten',
    description:
      'Eine praktische Methode, um durch Kontext, bessere Fragen, Verbindungen und ehrliche Antwort über schnelle Lösungen hinauszugehen.',
    category: 'Bibelstudium',
    publishedAt: '2026-07-28',
    dateLabel: '28. Juli 2026',
    readTime: '11 Min. Lesezeit',
    heroQuote: 'Neugier bremst den Drang, einen Text etwas sagen zu lassen, und schafft Raum zu hören, was er tatsächlich sagt.',
    sections: [
      {
        heading: 'Ersetze den Druck, alles verstehen zu müssen',
        paragraphs: [
          'Oft nähern wir uns der Bibel mit zwei wenig hilfreichen Erwartungen: Die Bedeutung müsse sofort offensichtlich sein, und jede Lesung müsse eine persönliche Lektion liefern. Wenn beides ausbleibt, lesen wir schneller, greifen nach der Antwort eines anderen oder halten uns für ungeeignet. Neugier bietet eine andere Haltung. Sie betrachtet Verwirrung als Tür zur Aufmerksamkeit statt als Beweis des Scheiterns.',
          'Neugierige Leser fragen, bevor sie schließen. Wer spricht? Was geschah unmittelbar zuvor? Warum wird dieses Detail wiederholt? Welche Textgattung ist das? Was hätten die ersten Hörer erkannt, was mir fehlt? Solche Fragen machen das Lesen nicht kalt oder bloß akademisch. Sie schützen davor, unsere Annahmen in den Text zu legen, und können Staunen, Demut und Antwort vertiefen.',
        ],
      },
      {
        heading: 'Die Methode: Lesen, Wahrnehmen, Fragen, Verfolgen, Antworten',
        paragraphs: [
          'Wähle einen Abschnitt, der kurz genug ist, um ihn mehrmals zu lesen — vielleicht sechs bis fünfzehn Verse. Die Methode funktioniert besser, wenn du einige Beobachtungen notierst. Für den ersten Durchgang brauchst du keine besonderen Hilfsmittel. Lass den Text selbst sprechen, bevor du Anmerkungen, Kommentare oder Suchergebnisse öffnest.',
        ],
        numberedPractices: [
          'Lesen. Lies einmal für die gesamte Bewegung. Bestimme Gattung, Sprecher, Publikum, Situation und was sich vom Anfang zum Ende verändert.',
          'Wahrnehmen. Markiere Wiederholungen, Gegensätze, Ursache und Wirkung, Fragen, Bilder, Gebote, Verheißungen und Überraschungen. Notiere Beobachtungen vor Deutungen.',
          'Fragen. Verwandle Wahrgenommenes in echte Fragen. Halte fest, was klar ist, was offenbleibt und welche Annahme du möglicherweise mitbringst.',
          'Verfolgen. Lies die umliegenden Absätze und verfolge zentrale Themen oder Zitate an andere Stellen der Bibel. Lass klaren Kontext fantasievolle Vermutungen begrenzen.',
          'Antworten. Fasse die zentrale Bewegung in eigenen Worten zusammen. Benenne, was zu Vertrauen, Umkehr, Dank, Mut oder weiterer Beschäftigung einlädt, und wähle eine angemessene Antwort.',
        ],
      },
      {
        heading: 'Trenne Beobachtung und Deutung',
        paragraphs: [
          'Beobachtung beschreibt, was auf der Seite steht: „Die Frage erscheint dreimal“, „die Menge geht weg“ oder „das Gedicht bewegt sich von Klage zu Lob“. Deutung schlägt vor, was diese Details bedeuten. Beides ist wichtig. Werden sie eine Weile getrennt, sinkt das Risiko, dass der erste Eindruck zur einzig möglichen Lesart wird.',
          'Probiere zwei Spalten. Schreibe in die erste nur, worauf ein anderer Leser im Text zeigen könnte. In die zweite kommen mögliche Bedeutungen und ihre Belege. Formuliere „Das könnte darauf hindeuten …“, statt zu früh Gewissheit zu beanspruchen. Ziel ist nicht endloses Zögern, sondern verantwortliche Zuversicht aus Belegen, Kontext und dem weiteren Zeugnis der Bibel.',
        ],
      },
      {
        heading: 'Lass die Gattung deine Fragen verändern',
        paragraphs: [
          'Ein Sprichwort beschreibt weise Muster; es ist meist keine bedingungslose Garantie. Poesie arbeitet mit Bildern und emotionaler Intensität. Ein Brief gehört zu einer wirklichen Gemeinde mit einer bestimmten Frage. Erzählung berichtet, was geschah, ohne jede Handlung gutzuheißen. Prophetie kann Warnung, Hoffnung, Symbolik und Geschichte verbinden. Dieselbe Technik passt nicht mechanisch auf alles.',
          'Benenne vor einer Schlussfolgerung die Gattung und frage, was Leser von dieser Art Text erwarten. In einem Psalm achte auf Bewegung, Metaphern und Gebet. In einer Evangeliumsszene auf Figuren, Konflikt und die Betonung des Erzählers. In einem Brief folge dem Gedankengang über Absätze hinweg und Wörtern wie „darum“, „aber“ und „denn“. Die Gattung versperrt den Sinn nicht; sie vermittelt ihn.',
        ],
      },
      {
        heading: 'Nutze Hilfsmittel erst nach eigener Aufmerksamkeit',
        paragraphs: [
          'Studienbibeln, Querverweise, Karten, Wörterbücher, vertrauenswürdige Lehrende und Suchwerkzeuge können historische und sprachliche Fragen klären. Nutze sie, um deine Beobachtungen zu prüfen und zu vertiefen, nicht um die Begegnung zu umgehen. Vergleiche bei umstrittenen Themen mehrere verantwortliche Quellen und unterscheide den Bibeltext von der Folgerung eines Kommentators.',
          'Technik kann Stellen finden oder Themen ordnen, doch generierte Zusammenfassungen können irren und dürfen nie als Schrift ausgegeben werden. Prüfe Zitate in einer verlässlichen Bibelübersetzung und lies den Zusammenhang. Ein hilfreiches Werkzeug führt mit besseren Fragen zum Text zurück. Ein schlechtes antwortet so schnell, dass du aufhörst hinzusehen.',
        ],
      },
      {
        heading: 'Bleibe bei schwierigen Texten ehrlich',
        paragraphs: [
          'Manche Abschnitte sind schwierig, weil ihre Welt uns fremd ist. Andere werfen ernste moralische, theologische oder persönliche Fragen auf. Neugier verlangt nicht, diese Spannungen für einfach zu erklären. Schreibe die Schwierigkeit klar auf. Suche historischen Kontext, lies, wo sorgfältige Ausleger uneins sind, und frage nach der Beziehung zum Charakter und zur Lehre Jesu und zur größeren biblischen Geschichte.',
          'Widerstehe schneller Ablehnung ebenso wie hastiger Verteidigung. Demut kann sagen: „Ich verstehe das noch nicht“, und weiterlernen. Wenn ein Text benutzt wurde, um dich zu verletzen oder zu kontrollieren, studiere mit vertrauenswürdigen Menschen, die deine Selbstbestimmung und Sicherheit achten. Weise Lektüre trägt gute Frucht: Wahrheit, Liebe, Gerechtigkeit, Umkehr, Mut und Aufmerksamkeit für Gott und den Nächsten — nicht Zwang oder Verachtung.',
        ],
      },
      {
        heading: 'Entwickle eine wöchentliche Neugierpraxis',
        paragraphs: [
          'Wähle für eine Woche einen kurzen Text. Am ersten Tag lies und beobachte. Am zweiten sammle Fragen. Am dritten erkunde den unmittelbaren Kontext. Am vierten verfolge ein Thema oder einen Querverweis. Am fünften nutze ein oder zwei verlässliche Quellen. Am sechsten schreibe eine kurze Zusammenfassung. Am siebten kehre zurück und antworte in Gebet oder Handlung.',
          'Wiederholtes Lesen macht den Text zu mehr als einem Auslöser für einen schnellen Gedanken. Details treten hervor, Fragen reifen, voreilige Schlüsse lockern sich. Vielleicht endet die Woche mit offenen Fragen. Das ist kein verlorenes Studium. Neugier lehrt, lange genug gegenwärtig zu bleiben, damit Verständnis wachsen kann — und Überzeugung wie Demut ins Leben mitzunehmen.',
        ],
        reflectionPrompts: [
          'Was habe ich erst beim zweiten oder dritten Lesen bemerkt?',
          'Welche Schlussfolgerung ist gut belegt, welche bleibt vorläufig?',
          'Welche Antwort passt zum Text, ohne ihn mehr sagen zu lassen?',
        ],
      },
    ],
  },
} satisfies Record<BlogSlug, BlogPostContent>;

const it = {
  [PRAYER_SPACE_ARTICLE_SLUG]: prayerSpaceArticleByLocale.it,
  'a-gentle-daily-scripture-rhythm': {
    title: 'Un ritmo quotidiano e gentile con la Scrittura, adatto alla vita reale',
    description:
      'Un modo pratico e pieno di grazia per tornare con costanza alla Bibbia, senza trasformare la vita spirituale in un altro obiettivo di rendimento.',
    category: 'Ritmi quotidiani',
    publishedAt: '2026-07-28',
    dateLabel: '28 luglio 2026',
    readTime: '9 min di lettura',
    heroQuote: 'Un ritmo duraturo non nasce da giornate perfette, ma dal saper tornare in quelle ordinarie.',
    sections: [
      {
        heading: 'Comincia dalla relazione, non dalla serie',
        paragraphs: [
          'Molti tentativi di leggere la Bibbia ogni giorno iniziano con un desiderio sincero e diventano silenziosamente una prova di disciplina. Scegliamo un piano ambizioso, saltiamo una mattina e sentiamo di aver rovinato tutto. La Scrittura comincia così a portare il peso emotivo di un compito in cui stiamo fallendo, invece di essere un invito a conoscere Dio. Un ritmo più gentile cambia la domanda: invece di “Come faccio a non saltare mai?”, chiedi “Come posso rendere semplice il ritorno?”',
          'La costanza conta, ma è un frutto, non il centro. Al centro c’è l’attenzione: accogliere le parole davanti a noi, notare ciò che rivelano e rispondere con sincerità. Alcuni giorni richiederà venti minuti. In una giornata piena, forse sarà un paragrafo letto due volte. Entrambi possono essere incontri reali. Una piccola pratica vissuta con presenza nutre più di una grande pratica affrettata solo per salvare una serie.',
        ],
      },
      {
        heading: 'Scegli un’ancora che esiste già',
        paragraphs: [
          'Le abitudini diventano più facili quando si legano a un momento che fa già parte della vita: il primo caffè, il viaggio in treno, il rientro da scuola, l’istante prima di aprire il computer o i minuti dopo essersi lavati i denti. Un’ancora è più utile di un’ora precisa perché gli orari cambiano. “Dopo aver preparato il tè” resiste meglio a una mattina in ritardo di “alle 6:15”.',
          'Prepara la strada prima di averne bisogno. Lascia una Bibbia dove avviene quel momento, segna il brano di domani o tieni insieme quaderno e penna. Attiva Non disturbare se il telefono tende a portarti altrove. Non sono trucchi sofisticati di produttività; sono piccoli gesti di ospitalità verso la tua attenzione futura. Rendi più facile dire sì quando arriva il momento.',
        ],
        reflectionPrompts: [
          'Quale momento della mia giornata è abbastanza stabile da diventare un’ancora?',
          'Quale piccolo ostacolo posso togliere già stasera?',
        ],
      },
      {
        heading: 'Usa una pratica in quattro movimenti',
        paragraphs: [
          'Una forma ripetibile elimina la pressione di inventare ogni giorno un’esperienza spirituale. I movimenti seguenti sono volutamente semplici. Funzionano con un paragrafo del Vangelo, un Salmo, parte di una lettera o una sezione di un piano più lungo. Procedi abbastanza lentamente da notare, senza preoccuparti di eseguire ogni passaggio alla perfezione.',
        ],
        numberedPractices: [
          'Arriva. Fai un respiro senza fretta e dai un nome a ciò che porti: distrazione, gratitudine, stanchezza, speranza o incertezza. Non devi essere calmo prima di iniziare.',
          'Leggi. Leggi un breve brano una volta per coglierne il movimento generale, poi di nuovo più lentamente. Se una frase richiama la tua attenzione, fermati invece di correre alla fine.',
          'Nota. Chiedi cosa dice il testo su Dio, le persone, il desiderio, la paura, la grazia o un’azione fedele. Distingui ciò che è scritto da ciò che ti aspettavi.',
          'Rispondi. Offri una frase sincera di preghiera e scegli una piccola risposta per la giornata: ricordare una frase, chiedere scusa, aspettare, ringraziare o formulare una domanda migliore.',
        ],
      },
      {
        heading: 'Crea un minimo per i giorni pieni',
        paragraphs: [
          'Decidi in anticipo cosa conta quando tempo ed energia sono scarsi. Un minimo compassionevole potrebbe essere: leggere quattro versetti, scegliere una frase e pregare con una frase. Non è una scappatoia né una fedeltà inferiore. Tiene aperta la porta. Quando le uniche opzioni sembrano uno studio completo o nulla, troppo spesso vince il nulla.',
          'Il tuo minimo deve essere abbastanza piccolo da poterlo vivere con sincerità durante un viaggio, mentre ti prendi cura di qualcuno o in una stagione impegnativa. Nei giorni ampi resta più a lungo. In quelli difficili conserva il filo. Un ritmo può allargarsi e restringersi senza scomparire. Questa flessibilità gli permette di diventare parte della vita, non un progetto breve.',
        ],
      },
      {
        heading: 'Lascia che i giorni saltati ti insegnino a tornare',
        paragraphs: [
          'Salterai dei giorni. Il momento decisivo non è l’assenza, ma la storia che racconti dopo. La vergogna dice che hai dimostrato di essere incostante e devi attendere un nuovo inizio perfetto. La grazia dice che oggi è disponibile. Non raddoppiare la lettura successiva come punizione e non passare tutto il tempo a ripensare al fallimento. Apri il brano di oggi — o il successivo — e comincia.',
          'Se le interruzioni si ripetono, trattale come informazioni. Forse l’ancora non è realistica, il brano è troppo lungo o il piano non si adatta alla stagione attuale. Modificare una pratica non significa abbandonarla. Un genitore con un neonato, uno studente durante gli esami e chi lavora a turni hanno bisogno di contenitori diversi. La fedeltà risponde alla realtà; non finge che non esista.',
        ],
      },
      {
        heading: 'Prova per sette giorni',
        paragraphs: [
          'Per una settimana usa la stessa ancora e i quattro movimenti. Scegli un brano abbastanza breve da rileggerlo. Alla fine di ogni giorno scrivi una sola riga: “Oggi ho notato…” Non dare un voto all’esperienza. La riga serve a custodire l’attenzione, non a dimostrare che ogni lettura è stata profonda.',
          'Alla fine della settimana osserva cosa ti ha aiutato a essere presente. Conserva ciò che ha servito questo scopo e lascia ciò che ha creato pressione inutile. Poi comincia un’altra settimana. Un ritmo quotidiano cresce attraverso queste revisioni silenziose. Col tempo, il gesto familiare di tornare diventa un’accoglienza: un luogo in cui arrivare con sincerità e ascoltare ancora.',
        ],
        reflectionPrompts: [
          'Che cosa ho notato più volte questa settimana?',
          'Quando la pratica è sembrata più viva o sincera?',
          'Quale modifica renderebbe più gentile il ritorno la prossima settimana?',
        ],
      },
    ],
  },
  'praying-when-your-mind-will-not-slow-down': {
    title: 'Come pregare quando la mente non rallenta',
    description:
      'Modi semplici e sinceri per pregare in mezzo al rumore mentale, senza fingere pace né trattare la preghiera come una prova da superare.',
    category: 'Preghiera',
    publishedAt: '2026-07-28',
    dateLabel: '28 luglio 2026',
    readTime: '10 min di lettura',
    heroQuote: 'La preghiera non comincia quando ogni pensiero tace. Comincia quando porti la mente che hai davvero.',
    sections: [
      {
        heading: 'Non devi calmarti prima di pregare',
        paragraphs: [
          'Quando i pensieri corrono, pregare può sembrare impossibile. Inizi una frase e ricordi un compito incompleto. Cerchi il silenzio e diventi ancora più consapevole di ogni preoccupazione. È facile concludere che stai pregando male. Ma un’attenzione che vaga non è una colpa morale, e l’agitazione non ti colloca fuori dalla presenza di Dio. I Salmi sono pieni di voci che arrivano afflitte, confuse, arrabbiate e impaurite.',
          'Comincia lasciando cadere l’obbligo di produrre uno stato spirituale. La preghiera può essere distratta e rimanere sincera. Può contenere ripetizione, silenzio, lacrime, frasi incomplete o un elenco scritto quando le parole dette non restano insieme. Lo scopo non è mostrare il controllo sul tuo mondo interiore, ma praticare una presenza vera davanti a Dio dentro di esso.',
        ],
      },
      {
        heading: 'Dai un nome al rumore',
        paragraphs: [
          'Il rumore mentale sembra spesso più grande quando resta vago. Prova a nominare ciò che accade senza giudicarlo: “Sto ripetendo quella conversazione.” “Ho paura di domani.” “Il mio corpo è stanco e i pensieri saltano.” Dare un nome non equivale a risolvere. Trasforma una nuvola in qualcosa che puoi portare nella preghiera.',
          'Se diverse preoccupazioni competono per l’attenzione, mettile su una pagina. Scrivi ciascuna in poche parole e di’: “Queste sono le cose che porto.” La pagina può sostenere ciò che non devi ripassare per i prossimi minuti. Tornerai poi all’azione concreta; la preghiera non la sostituisce. Per ora, nominare ti aiuta a smettere di combattere il fatto che quei pensieri esistano.',
        ],
        reflectionPrompts: [
          'Quale pensiero continua a chiedere la mia attenzione?',
          'Chiede preghiera, un passo concreto, una conversazione o riposo?',
        ],
      },
      {
        heading: 'Prendi in prestito parole quando le tue sono difficili',
        paragraphs: [
          'Non devi creare un linguaggio nuovo ogni volta che preghi. Parole prese in prestito possono sostenerti quando i pensieri sono aggrovigliati. Leggi ad alta voce un Salmo breve, abbastanza lentamente da ascoltarlo. Il linguaggio non deve coincidere perfettamente con la tua esperienza. Nota una riga che dia forma a ciò che non sai ancora dire e ripetila come richiesta, protesta o fiducia.',
          'Puoi anche usare una breve preghiera che stia in un respiro: “Dio, incontrami qui.” “Dammi luce per il prossimo passo.” “Sostieni ciò che non riesco a sostenere.” La ripetizione non è vuota quando è attenta. Ogni ritorno raccoglie la mente senza rimproverarla. Quando arriva la distrazione, notala e torna alla frase con la gentilezza con cui accompagneresti a casa un bambino.',
        ],
      },
      {
        heading: 'Una preghiera di cinque minuti per una mente affollata',
        paragraphs: [
          'Una struttura può essere gentile quando la concentrazione è limitata. Stabilisci cinque minuti tranquilli, non come conto alla rovescia verso il successo, ma come permesso di non portare tutto insieme. Tieni gli occhi aperti se chiuderli rende i pensieri più rumorosi. Siediti, cammina lentamente o tieni una tazza calda. Scegli una postura che aiuti a essere presente, non solo una che sembri devota.',
        ],
        numberedPractices: [
          'Arriva per un minuto. Nota i piedi, il respiro e la stanza. Di’: “Io sono qui, e Dio è qui.”',
          'Nomina per un minuto. Di’ o scrivi la preoccupazione centrale senza renderla più rispettabile.',
          'Ricevi per un minuto. Leggi due o tre versetti e scegli una frase da custodire.',
          'Chiedi per un minuto. Chiedi grazia, coraggio, saggezza o aiuto per il prossimo passo fedele, non per ogni futuro possibile.',
          'Affida per un minuto. Concludi con la mano aperta: “Ciò che ora non posso risolvere, lo affido a te.”',
        ],
      },
      {
        heading: 'Non usare la Scrittura per mettere a tacere un disagio sincero',
        paragraphs: [
          'Un versetto può offrire compagnia e prospettiva, ma non dovrebbe diventare un’arma contro le tue emozioni. Leggere “non siate in ansia” come “una persona fedele non proverebbe questo” aggiunge vergogna alla sofferenza. Leggi il contesto. Nota l’invito, la relazione e le pratiche indicate. La speranza biblica non è negazione; può convivere con il lamento, le domande e il bisogno di aiuto.',
          'È anche saggio distinguere la pratica spirituale dall’assistenza sanitaria. La preghiera può offrire un sostegno profondo, ma non sostituisce le cure professionali. Se ansia, panico, insonnia o sofferenza sono persistenti, intensi o compromettono sicurezza e vita quotidiana, parla con un professionista qualificato della salute mentale o con un medico. In caso di pericolo immediato o pensieri di farti del male, contatta subito i servizi di emergenza o una linea di crisi del tuo Paese e una persona fidata.',
        ],
      },
      {
        heading: 'Lascia che la preghiera finisca con un prossimo passo',
        paragraphs: [
          'Una mente accelerata cerca spesso certezze su tutto il futuro. La preghiera può restringere l’orizzonte a ciò che significa essere fedeli adesso. Forse devi inviare un messaggio, annotare il primo compito di domani, bere acqua, chiedere scusa, cercare aiuto o andare a dormire. Una risposta concreta non risolve tutto, ma offre alla preoccupazione un luogo verso cui muoversi.',
          'A volte il passo successivo è semplicemente tornare più tardi alla stessa breve preghiera. Non misurare la preghiera da come ti senti subito dopo. La pace non è una metrica di rendimento. L’atto sincero di rivolgersi a Dio, ricevere alcune parole vere e scegliere la prossima azione amorevole è già una pratica significativa, anche se i pensieri continuano a muoversi.',
        ],
        reflectionPrompts: [
          'Che cosa sto cercando di risolvere tutto insieme?',
          'Di quale grazia ho bisogno per la prossima ora, non per tutto il futuro?',
          'Chi potrebbe aiutarmi a portare questo con saggezza?',
        ],
      },
    ],
  },
  'read-scripture-with-curiosity': {
    title: 'Leggere la Scrittura con curiosità: un metodo ripetibile in cinque parti',
    description:
      'Un metodo pratico per andare oltre le risposte rapide, osservando il contesto, ponendo domande migliori, seguendo connessioni e rispondendo con sincerità.',
    category: 'Studio biblico',
    publishedAt: '2026-07-28',
    dateLabel: '28 luglio 2026',
    readTime: '11 min di lettura',
    heroQuote: 'La curiosità rallenta la fretta di far dire qualcosa a un brano e crea spazio per ascoltare ciò che sta realmente dicendo.',
    sections: [
      {
        heading: 'Sostituisci la pressione di capire tutto',
        paragraphs: [
          'Spesso ci avviciniamo alla Bibbia con due aspettative poco utili: che il significato debba essere subito evidente e che ogni lettura debba produrre una lezione personale. Quando non accade, scorriamo più in fretta, cerchiamo la risposta di qualcun altro o decidiamo di non essere capaci. La curiosità offre un’altra postura. Tratta la confusione come porta verso l’attenzione, non come prova di fallimento.',
          'Chi legge con curiosità domanda prima di concludere. Chi parla? Che cosa è accaduto prima? Perché questo dettaglio si ripete? Che genere di testo è? Che cosa avrebbero riconosciuto i primi ascoltatori che io non riconosco? Queste domande non rendono la lettura fredda o solo accademica. Ci proteggono dall’imporre le nostre supposizioni e possono approfondire stupore, umiltà e risposta.',
        ],
      },
      {
        heading: 'Il metodo: Leggi, Nota, Domanda, Collega, Rispondi',
        paragraphs: [
          'Usa un brano abbastanza breve da poterlo leggere più volte, forse da sei a quindici versetti. Il metodo funziona meglio se scrivi alcune osservazioni. Non servono strumenti particolari al primo passaggio. Lascia che il brano abbia una propria voce prima di aprire note, commentari o risultati di ricerca.',
        ],
        numberedPractices: [
          'Leggi. Leggi una volta per cogliere il movimento complessivo. Individua genere, voce, destinatari, ambientazione e cosa cambia dall’inizio alla fine.',
          'Nota. Segna parole ripetute, contrasti, causa ed effetto, domande, immagini, comandi, promesse e sorprese. Scrivi osservazioni prima delle interpretazioni.',
          'Domanda. Trasforma ciò che noti in domande autentiche. Chiedi cosa è chiaro, cosa è incerto e quale presupposto potresti portare con te.',
          'Collega. Leggi i paragrafi intorno e segui temi o citazioni importanti in altre parti della Bibbia. Lascia che il contesto chiaro limiti le ipotesi fantasiose.',
          'Rispondi. Riassumi il movimento centrale con parole tue. Nomina ciò che invita a fiducia, pentimento, gratitudine, coraggio o ulteriore studio e scegli una risposta proporzionata.',
        ],
      },
      {
        heading: 'Separa osservazione e interpretazione',
        paragraphs: [
          'L’osservazione descrive ciò che è sulla pagina: “La domanda appare tre volte”, “la folla se ne va” o “la poesia passa dal lamento alla lode”. L’interpretazione propone il significato di questi dettagli. Entrambe contano, ma tenerle distinte per un po’ riduce il rischio che la prima impressione diventi l’unica lettura possibile.',
          'Prova due colonne. Nella prima scrivi solo ciò che un altro lettore potrebbe indicare nel testo. Nella seconda, possibili significati e le prove di ciascuno. Usa frasi come “Questo potrebbe suggerire…” invece di rivendicare certezza troppo presto. Lo scopo non è un’esitazione infinita, ma una fiducia responsabile plasmata da prove, contesto e dalla testimonianza più ampia della Scrittura.',
        ],
      },
      {
        heading: 'Lascia che il genere cambi le domande',
        paragraphs: [
          'Un proverbio descrive modelli saggi; di solito non è una garanzia incondizionata. La poesia usa immagini e intensità emotiva. Una lettera appartiene a una comunità reale con un problema specifico. La narrazione racconta ciò che è accaduto senza approvare necessariamente ogni azione. La profezia può unire avvertimento, speranza, simboli e circostanze storiche. La stessa tecnica non si applica meccanicamente a tutto.',
          'Prima di concludere, nomina il genere e chiedi cosa ci si aspetta da quel tipo di scrittura. In un Salmo, nota il movimento, la metafora e la preghiera. In una scena del Vangelo, i personaggi, il conflitto e l’enfasi del narratore. In una lettera, segui l’argomento attraverso i paragrafi e parole come “dunque”, “ma” e “perché”. Il genere non ostacola il significato; è parte di come viene comunicato.',
        ],
      },
      {
        heading: 'Usa gli strumenti dopo aver prestato attenzione',
        paragraphs: [
          'Bibbie di studio, riferimenti incrociati, mappe, dizionari, insegnanti affidabili e strumenti di ricerca possono chiarire domande storiche e linguistiche. Usali per verificare e arricchire ciò che hai notato, non per evitare l’incontro. Confronta più fonti responsabili quando una questione è discussa e distingui il testo biblico dalla conclusione di un commentatore.',
          'La tecnologia può localizzare brani o organizzare temi, ma i riassunti generati possono sbagliare e non devono mai essere presentati come Scrittura. Verifica le citazioni in una traduzione biblica affidabile ed esamina il contesto. Uno strumento utile ti rimanda al testo con domande migliori. Uno inutile risponde così in fretta che smetti di guardare.',
        ],
      },
      {
        heading: 'Resta sincero quando un brano è difficile',
        paragraphs: [
          'Alcuni brani sono difficili perché il loro mondo ci è estraneo. Altri sollevano serie domande morali, teologiche o personali. La curiosità non richiede di fingere che queste tensioni siano semplici. Scrivi la difficoltà con chiarezza. Cerca il contesto storico, leggi come interpreti attenti dissentono e chiedi come il brano si rapporta al carattere e all’insegnamento di Gesù e alla storia biblica più ampia.',
          'Resisti sia al rifiuto rapido sia alla difesa frettolosa. L’umiltà può dire “Non lo capisco ancora” e continuare a imparare. Se un brano è stato usato per ferirti o controllarti, studia con persone affidabili che rispettino la tua libertà e sicurezza. Una lettura saggia porta buoni frutti: verità, amore, giustizia, pentimento, coraggio e attenzione a Dio e al prossimo, non coercizione o disprezzo.',
        ],
      },
      {
        heading: 'Costruisci una pratica settimanale di curiosità',
        paragraphs: [
          'Scegli un breve brano per una settimana. Il primo giorno leggi e nota. Il secondo raccogli domande. Il terzo esplora il contesto immediato. Il quarto segui un tema o un riferimento. Il quinto consulta una o due fonti affidabili. Il sesto scrivi un breve riassunto. Il settimo torna al brano e rispondi con preghiera o azione.',
          'La lettura ripetuta permette al testo di diventare più di uno spunto per un pensiero veloce. Emergono dettagli, maturano domande e si allentano conclusioni premature. Potresti finire la settimana con questioni aperte. Non è studio sprecato. La curiosità insegna a restare presenti abbastanza a lungo perché la comprensione cresca e a portare convinzione e umiltà nel modo di vivere.',
        ],
        reflectionPrompts: [
          'Che cosa ho notato solo alla seconda o terza lettura?',
          'Quale conclusione è ben sostenuta e quale resta provvisoria?',
          'Quale risposta rispetta il brano senza fargli dire più di quanto dica?',
        ],
      },
    ],
  },
} satisfies Record<BlogSlug, BlogPostContent>;

const ru = {
  [PRAYER_SPACE_ARTICLE_SLUG]: prayerSpaceArticleByLocale.ru,
  'a-gentle-daily-scripture-rhythm': {
    title: 'Бережный ежедневный ритм чтения Писания, который выдерживает реальную жизнь',
    description:
      'Практичный и исполненный благодати способ регулярно возвращаться к Библии, не превращая духовную жизнь в очередную гонку за результатом.',
    category: 'Ежедневные ритмы',
    publishedAt: '2026-07-28',
    dateLabel: '28 июля 2026 года',
    readTime: '9 минут чтения',
    heroQuote: 'Устойчивый ритм рождается не из идеальных дней, а из умения возвращаться в дни самые обычные.',
    sections: [
      {
        heading: 'Начните с отношений, а не с непрерывной серии',
        paragraphs: [
          'Многие попытки читать Библию ежедневно начинаются с искреннего желания, а затем незаметно превращаются в проверку дисциплины. Мы выбираем амбициозный план, пропускаем одно утро и чувствуем, будто всё испорчено. Тогда Писание начинает нести эмоциональный груз невыполненной задачи, вместо того чтобы оставаться приглашением узнавать Бога. Более бережный ритм меняет вопрос. Вместо «Как больше никогда не пропускать?» спросите: «Как сделать возвращение простым?»',
          'Постоянство важно, но это плод, а не центр. В центре находится внимание: принять слова перед собой, заметить, что они открывают, и честно ответить. Иногда на это уйдёт двадцать минут. В загруженный день это может быть один абзац, прочитанный дважды. И то и другое способно стать настоящей встречей. Маленькая практика с полным присутствием питает глубже, чем большая, выполненная в спешке ради сохранения серии.',
        ],
      },
      {
        heading: 'Выберите уже существующую опору',
        paragraphs: [
          'Привычки даются легче, когда соединены с моментом, который уже есть в жизни: первая чашка кофе, поездка на работу, возвращение после школы, минута перед открытием ноутбука или время после вечерней чистки зубов. Такая опора полезнее точного часа, потому что расписание меняется. «После того как заварю чай» переживёт позднее утро лучше, чем «в 6:15».',
          'Подготовьте путь заранее. Оставьте Библию там, где наступает этот момент, отметьте завтрашний отрывок или держите блокнот и ручку вместе. Включите режим «Не беспокоить», если телефон обычно уводит внимание. Это не сложные приёмы продуктивности, а небольшие жесты гостеприимства по отношению к вашему будущему вниманию. Вы облегчаете согласие, когда момент приходит.',
        ],
        reflectionPrompts: [
          'Какая часть моего дня достаточно постоянна, чтобы стать опорой?',
          'Какую небольшую помеху я могу убрать уже сегодня вечером?',
        ],
      },
      {
        heading: 'Используйте практику из четырёх движений',
        paragraphs: [
          'Повторяемая форма снимает необходимость каждый день создавать особенное духовное переживание. Следующие движения намеренно просты. Они подходят для абзаца из Евангелия, псалма, части послания или отрывка из более длинного плана. Двигайтесь достаточно медленно, чтобы замечать, но не стремитесь выполнить каждый шаг идеально.',
        ],
        numberedPractices: [
          'Придите. Сделайте один неторопливый вдох и назовите то, с чем вы пришли: рассеянность, благодарность, усталость, надежду или неуверенность. Не нужно сначала успокаиваться.',
          'Прочитайте. Сначала прочитайте короткий отрывок целиком, а затем ещё раз, медленнее. Если фраза привлекла внимание, задержитесь на ней, а не спешите к концу.',
          'Заметьте. Спросите, что текст говорит о Боге, людях, желаниях, страхе, благодати или верном поступке. Отделите то, что действительно написано, от ожидаемого вами смысла.',
          'Ответьте. Произнесите одно честное предложение молитвы и выберите небольшой ответ на день: сохранить фразу, попросить прощения, подождать, поблагодарить или задать более точный вопрос.',
        ],
      },
      {
        heading: 'Определите минимум для перегруженных дней',
        paragraphs: [
          'Заранее решите, что будет достаточным в день, когда мало времени и сил. Милосердный минимум может выглядеть так: прочитать четыре стиха, выбрать одну фразу и помолиться одним предложением. Это не лазейка и не менее значимая верность. Так дверь остаётся открытой. Когда выбор сводится к полноценному изучению или ничему, слишком часто побеждает ничто.',
          'Минимум должен быть настолько небольшим, чтобы его можно было честно выполнить в поездке, во время заботы о близком или в трудный период. В свободный день оставайтесь дольше. В тяжёлый — сохраняйте нить. Ритм может расширяться и сжиматься, не исчезая. Именно гибкость позволяет ему стать частью жизни, а не коротким проектом.',
        ],
      },
      {
        heading: 'Пусть пропущенные дни учат возвращаться',
        paragraphs: [
          'Вы будете пропускать дни. Важен не сам пропуск, а история, которую вы расскажете себе после. Стыд говорит: вы доказали свою непоследовательность и должны ждать идеального нового старта. Благодать говорит: сегодняшний день доступен. Не удваивайте следующую порцию чтения в наказание и не тратьте всё время на разбор неудачи. Откройте сегодняшний отрывок — или следующий по порядку — и начните.',
          'Если помехи повторяются, воспринимайте их как информацию. Возможно, опора нереалистична, чтение слишком длинное или план не подходит нынешнему периоду. Изменить практику — не значит бросить её. Родителю новорождённого, студенту во время экзаменов и человеку со сменным графиком нужны разные формы. Верность отвечает на реальность, а не делает вид, будто её нет.',
        ],
      },
      {
        heading: 'Попробуйте семь дней',
        paragraphs: [
          'В течение недели используйте одну и ту же опору и четыре движения. Выбирайте отрывок достаточно короткий, чтобы перечитать его. В конце дня запишите всего одну строку: «Сегодня я заметил(а)…» Не выставляйте опыту оценку. Эта строка нужна, чтобы сохранить внимание, а не доказать, что каждое чтение было глубоким.',
          'В конце недели посмотрите, что помогало вам присутствовать. Оставьте то, что служило этой цели, и отпустите то, что создавало лишнее давление. Затем начните ещё одну неделю. Ежедневный ритм растёт через такие тихие корректировки. Со временем знакомый жест возвращения сам становится приветствием — местом, куда можно прийти честно и снова слушать.',
        ],
        reflectionPrompts: [
          'Что я замечал(а) несколько раз на этой неделе?',
          'Когда практика ощущалась наиболее живой и честной?',
          'Какое изменение сделает возвращение на следующей неделе бережнее?',
        ],
      },
    ],
  },
  'praying-when-your-mind-will-not-slow-down': {
    title: 'Как молиться, когда мысли не замедляются',
    description:
      'Простые и честные способы молиться среди внутреннего шума — без притворного спокойствия и без отношения к молитве как к экзамену.',
    category: 'Молитва',
    publishedAt: '2026-07-28',
    dateLabel: '28 июля 2026 года',
    readTime: '10 минут чтения',
    heroQuote: 'Молитва начинается не тогда, когда все мысли затихли, а когда вы приносите тот разум, который у вас есть сейчас.',
    sections: [
      {
        heading: 'Не нужно сначала успокоиться',
        paragraphs: [
          'Когда мысли несутся, молитва может казаться невозможной. Вы начинаете предложение и вспоминаете незавершённое дело. Пытаетесь побыть в тишине и ещё сильнее замечаете каждую тревогу. Легко решить, что вы молитесь неправильно. Но блуждающее внимание — не нравственный провал, а внутреннее возбуждение не выводит вас за пределы Божьего присутствия. Псалмы полны голосов, которые приходят в смятении, растерянности, гневе и страхе.',
          'Сначала отпустите требование создать особое духовное состояние. Молитва может быть рассеянной и всё равно искренней. В ней могут быть повторы, тишина, слёзы, незаконченные предложения или список на бумаге, если устные слова не складываются. Цель не в том, чтобы доказать контроль над внутренним миром, а в том, чтобы честно присутствовать перед Богом прямо внутри него.',
        ],
      },
      {
        heading: 'Назовите шум',
        paragraphs: [
          'Внутренний шум часто кажется больше, пока остаётся расплывчатым. Попробуйте без осуждения назвать происходящее: «Я снова прокручиваю тот разговор». «Я боюсь завтрашнего дня». «Моё тело устало, а мысли скачут». Назвать — не значит решить. Это всего лишь превращает облако в то, что можно принести в молитву.',
          'Если несколько забот спорят за внимание, перенесите их на страницу. Запишите каждую несколькими словами и скажите: «Вот что я несу». Бумага может удержать то, что вам не нужно снова прокручивать ближайшие минуты. Позже вы вернётесь к практическим действиям; молитва не заменяет их. Сейчас называние помогает перестать воевать с самим фактом существования этих мыслей.',
        ],
        reflectionPrompts: [
          'Какая мысль снова и снова требует моего внимания?',
          'Нужны ли здесь молитва, конкретный шаг, разговор или отдых?',
        ],
      },
      {
        heading: 'Возьмите слова взаймы, если своих не хватает',
        paragraphs: [
          'Вам не нужно каждый раз придумывать новый язык молитвы. Заимствованные слова могут нести, когда собственные мысли спутаны. Медленно прочитайте вслух короткий псалом. Его язык не обязан идеально совпадать с вашим опытом. Найдите строку, которая придаёт форму тому, что вы ещё не можете сказать, и повторяйте её как просьбу, жалобу или выражение доверия.',
          'Можно выбрать короткую молитву на один вдох: «Боже, встреть меня здесь». «Дай свет для следующего шага». «Удержи то, что я не могу удержать». Повторение не пусто, если наполнено вниманием. Каждое возвращение собирает разум, не ругая его. Когда приходит отвлечение, заметьте его и вернитесь к фразе с той же добротой, с какой проводили бы ребёнка домой.',
        ],
      },
      {
        heading: 'Пятиминутная молитва для перегруженного ума',
        paragraphs: [
          'Когда сосредоточиться трудно, структура может быть проявлением доброты. Выделите спокойные пять минут — не как отсчёт до успеха, а как разрешение не нести всё одновременно. Если с закрытыми глазами мысли звучат громче, оставьте их открытыми. Сядьте, медленно пройдитесь или возьмите тёплую чашку. Выберите положение, которое помогает присутствовать, а не просто выглядит молитвенным.',
        ],
        numberedPractices: [
          'Одну минуту приходите. Почувствуйте стопы, дыхание и комнату. Скажите: «Я здесь, и Бог здесь».',
          'Одну минуту называйте. Скажите или запишите главную заботу, не редактируя её ради приличного звучания.',
          'Одну минуту принимайте. Прочитайте два-три стиха и выберите фразу, которую будете держать.',
          'Одну минуту просите. Просите благодати, смелости, мудрости или помощи для ближайшего верного шага, а не для всех возможных вариантов будущего.',
          'Одну минуту отпускайте. Закончите с открытой ладонью: «То, что сейчас не могу решить, я доверяю Тебе».',
        ],
      },
      {
        heading: 'Не используйте Писание, чтобы заглушить настоящую боль',
        paragraphs: [
          'Стих может дать поддержку и перспективу, но не должен становиться оружием против ваших чувств. Если прочитать «не тревожьтесь» как «верующий человек такого не чувствует», к боли прибавится стыд. Читайте окружающий текст. Замечайте приглашение, отношения и названные практики. Библейская надежда — не отрицание; она может сосуществовать с плачем, вопросами и потребностью в помощи.',
          'Также важно различать духовную практику и заботу о здоровье. Молитва способна глубоко поддерживать, но не заменяет профессиональную помощь. Если тревога, паника, бессонница или страдание сохраняются, становятся сильными либо мешают безопасности и повседневной жизни, обратитесь к квалифицированному специалисту по психическому здоровью или врачу. При непосредственной опасности или мыслях о причинении себе вреда немедленно свяжитесь с экстренной службой или кризисной линией в своей стране и с человеком, которому доверяете.',
        ],
      },
      {
        heading: 'Пусть молитва завершится одним следующим шагом',
        paragraphs: [
          'Беспокойный разум часто требует определённости обо всём будущем. Молитва может сузить горизонт до ближайшего верного шага. Возможно, нужно отправить одно сообщение, записать первую задачу на завтра, выпить воды, попросить прощения, обратиться за помощью или лечь спать. Конкретный ответ не решает всего, но даёт заботе направление.',
          'Иногда следующий шаг — просто вернуться к той же короткой молитве позже. Не измеряйте молитву тем, изменилось ли самочувствие немедленно. Спокойствие — не показатель эффективности. Честно повернуться к Богу, принять несколько истинных слов и выбрать следующий поступок любви — уже значимая практика, даже когда мысли продолжают двигаться.',
        ],
        reflectionPrompts: [
          'Что я пытаюсь решить всё сразу?',
          'Какая благодать нужна мне на ближайший час, а не на всё будущее?',
          'Кто может помочь мне нести это мудро?',
        ],
      },
    ],
  },
  'read-scripture-with-curiosity': {
    title: 'Читайте Писание с любопытством: повторяемый метод из пяти частей',
    description:
      'Практичный метод, помогающий выйти за пределы быстрых ответов через контекст, более точные вопросы, связи и честный отклик.',
    category: 'Изучение Библии',
    publishedAt: '2026-07-28',
    dateLabel: '28 июля 2026 года',
    readTime: '11 минут чтения',
    heroQuote: 'Любопытство замедляет желание заставить отрывок что-то сказать и освобождает место, чтобы услышать, что он говорит на самом деле.',
    sections: [
      {
        heading: 'Откажитесь от требования понять всё',
        paragraphs: [
          'Часто мы подходим к Библии с двумя бесполезными ожиданиями: смысл должен быть очевиден сразу, а каждое чтение обязано дать личный урок. Если этого не происходит, мы начинаем скользить быстрее, хватаемся за чужой ответ или решаем, что не умеем читать Писание. Любопытство предлагает другую позицию. Оно воспринимает непонимание как дверь к вниманию, а не как доказательство неудачи.',
          'Любопытный читатель спрашивает прежде, чем заключать. Кто говорит? Что произошло перед этим? Почему деталь повторяется? Что это за жанр? Что первые слушатели узнавали без труда, а я не замечаю? Эти вопросы не делают чтение холодным или только академическим. Они защищают от навязывания тексту наших предположений и углубляют удивление, смирение и ответ.',
        ],
      },
      {
        heading: 'Метод: Прочитайте, Заметьте, Спросите, Проследите, Ответьте',
        paragraphs: [
          'Выберите отрывок, достаточно короткий для нескольких прочтений, — например, от шести до пятнадцати стихов. Метод работает лучше, если записать хотя бы несколько наблюдений. Для первого прохода специальные инструменты не нужны. Дайте тексту прозвучать самостоятельно, прежде чем открывать примечания, комментарии или результаты поиска.',
        ],
        numberedPractices: [
          'Прочитайте. Первый раз — ради общей линии. Определите жанр, говорящего, слушателей, обстановку и то, что меняется от начала к концу.',
          'Заметьте. Отметьте повторы, противопоставления, причины и следствия, вопросы, образы, повеления, обещания и неожиданности. Сначала запишите наблюдения, потом толкования.',
          'Спросите. Превратите замеченное в настоящие вопросы. Отделите ясное от неясного и назовите предположение, которое, возможно, привносите сами.',
          'Проследите. Прочитайте соседние абзацы, а затем найдите важные темы или цитаты в других частях Библии. Пусть ясный контекст ограничивает воображаемые догадки.',
          'Ответьте. Перескажите основное движение своими словами. Назовите, что зовёт к доверию, покаянию, благодарности, смелости или дальнейшему изучению, и выберите соразмерный отклик.',
        ],
      },
      {
        heading: 'Разделяйте наблюдение и толкование',
        paragraphs: [
          'Наблюдение описывает то, что находится на странице: «вопрос повторяется трижды», «толпа уходит» или «стихотворение движется от жалобы к хвале». Толкование предлагает значение этих деталей. Важно и то и другое, но временное разделение уменьшает риск, что первое впечатление станет единственно возможным прочтением.',
          'Попробуйте две колонки. В первой пишите только то, на что другой читатель мог бы указать в тексте. Во второй — возможные значения и подтверждения каждого. Используйте фразы вроде «Это может указывать…», а не заявляйте уверенность слишком рано. Цель не в бесконечном сомнении, а в ответственной уверенности, сформированной свидетельствами, контекстом и более широким голосом Писания.',
        ],
      },
      {
        heading: 'Пусть жанр меняет вопросы',
        paragraphs: [
          'Притча описывает мудрые закономерности, но обычно не даёт безусловной гарантии. Поэзия использует образы и эмоциональную силу. Послание адресовано реальному сообществу с конкретной проблемой. Повествование рассказывает, что произошло, не обязательно одобряя каждый поступок. Пророчество может сочетать предупреждение, надежду, символы и историю. Один приём нельзя механически применять ко всему.',
          'Перед выводом назовите жанр и спросите, чего читатель обычно ждёт от такого письма. В псалме замечайте движение, метафору и молитву. В евангельской сцене — персонажей, конфликт и акценты рассказчика. В послании следите за аргументом между абзацами и словами «поэтому», «но», «потому что». Жанр не отделяет от смысла; он участвует в его передаче.',
        ],
      },
      {
        heading: 'Используйте инструменты после собственного внимания',
        paragraphs: [
          'Учебные Библии, перекрёстные ссылки, карты, словари, надёжные учителя и поисковые инструменты помогают с историческими и языковыми вопросами. Используйте их, чтобы проверять и обогащать замеченное, а не обходить встречу. В спорных вопросах сравнивайте несколько ответственных источников и отличайте библейский текст от вывода комментатора.',
          'Технологии могут находить отрывки и упорядочивать темы, но созданные ими резюме способны ошибаться и никогда не должны выдаваться за Писание. Проверяйте цитаты в надёжном переводе Библии и изучайте контекст. Хороший инструмент возвращает к тексту с лучшими вопросами. Плохой отвечает так быстро, что вы перестаёте смотреть.',
        ],
      },
      {
        heading: 'Оставайтесь честными перед трудным отрывком',
        paragraphs: [
          'Некоторые тексты сложны, потому что их мир нам незнаком. Другие поднимают серьёзные нравственные, богословские или личные вопросы. Любопытство не требует делать вид, будто напряжение легко разрешить. Чётко запишите трудность. Ищите исторический контекст, читайте, в чём расходятся вдумчивые толкователи, и спрашивайте, как отрывок связан с характером и учением Иисуса и всей библейской историей.',
          'Избегайте как быстрого отвержения, так и поспешной защиты. Смирение может сказать: «Я пока не понимаю», продолжая учиться. Если отрывок использовали, чтобы ранить или контролировать вас, изучайте его с надёжными людьми, уважающими вашу свободу и безопасность. Мудрое чтение приносит добрый плод: правдивость, любовь, справедливость, покаяние, смелость и внимание к Богу и ближнему — не принуждение или презрение.',
        ],
      },
      {
        heading: 'Создайте еженедельную практику любопытства',
        paragraphs: [
          'Выберите один короткий отрывок на неделю. В первый день читайте и замечайте. Во второй собирайте вопросы. В третий исследуйте ближайший контекст. В четвёртый проследите тему или ссылку. В пятый обратитесь к одному-двум надёжным ресурсам. В шестой напишите краткое резюме. В седьмой вернитесь к тексту и ответьте молитвой или поступком.',
          'Повторное чтение позволяет тексту стать чем-то большим, чем повод для быстрой мысли. Проявляются детали, вопросы созревают, поспешные выводы ослабевают. Возможно, к концу недели некоторые вопросы останутся. Это не потерянное изучение. Любопытство учит оставаться достаточно долго, чтобы понимание углублялось, а убеждённость и смирение вместе входили в вашу жизнь.',
        ],
        reflectionPrompts: [
          'Что я заметил(а) только при втором или третьем чтении?',
          'Какой вывод хорошо подтверждён, а какой остаётся предварительным?',
          'Какой отклик соответствует тексту, не заставляя его говорить больше?',
        ],
      },
    ],
  },
} satisfies Record<BlogSlug, BlogPostContent>;

const pl = {
  [PRAYER_SPACE_ARTICLE_SLUG]: prayerSpaceArticleByLocale.pl,
  'a-gentle-daily-scripture-rhythm': {
    title: 'Łagodny codzienny rytm czytania Pisma, który mieści się w prawdziwym życiu',
    description:
      'Praktyczny i pełen łaski sposób regularnego powracania do Biblii bez zamieniania życia duchowego w kolejny cel do osiągnięcia.',
    category: 'Codzienne rytmy',
    publishedAt: '2026-07-28',
    dateLabel: '28 lipca 2026',
    readTime: '9 min czytania',
    heroQuote: 'Trwały rytm nie powstaje dzięki idealnym dniom, lecz dzięki umiejętności powrotu w dniach zwyczajnych.',
    sections: [
      {
        heading: 'Zacznij od relacji, nie od serii',
        paragraphs: [
          'Wiele prób codziennego czytania Biblii zaczyna się od szczerego pragnienia, a po cichu staje się sprawdzianem dyscypliny. Wybieramy ambitny plan, opuszczamy jeden poranek i czujemy, że wszystko zostało zepsute. Pismo zaczyna wtedy nieść emocjonalny ciężar zadania, którego nie wykonujemy, zamiast pozostać zaproszeniem do poznawania Boga. Łagodniejszy rytm zmienia pytanie. Zamiast „Jak już nigdy nie opuścić dnia?” zapytaj: „Jak mogę ułatwić sobie powrót?”',
          'Regularność ma znaczenie, ale jest owocem, a nie centrum. W centrum jest uwaga: przyjęcie słów, które masz przed sobą, dostrzeżenie tego, co odsłaniają, i szczera odpowiedź. Czasem zajmie to dwadzieścia minut. W pełnym dniu może to być jeden akapit przeczytany dwa razy. Oba spotkania mogą być prawdziwe. Mała praktyka przeżyta z obecnością karmi bardziej niż duża, wykonana w pośpiechu tylko po to, by zachować serię.',
        ],
      },
      {
        heading: 'Wybierz kotwicę, która już istnieje',
        paragraphs: [
          'Nawyki stają się łatwiejsze, gdy łączą się z momentem, który już należy do życia: pierwszą kawą, jazdą pociągiem, powrotem ze szkoły, chwilą przed otwarciem laptopa albo minutami po wieczornym myciu zębów. Kotwica jest użyteczniejsza niż dokładna godzina, bo rozkład dnia się przesuwa. „Po zaparzeniu herbaty” lepiej przetrwa późny poranek niż „o 6:15”.',
          'Przygotuj drogę, zanim będzie potrzebna. Zostaw Biblię tam, gdzie pojawia się kotwica, zaznacz jutrzejszy fragment albo trzymaj notatnik i długopis razem. Włącz tryb Nie przeszkadzać, jeśli telefon zwykle odciąga uwagę. To nie są wymyślne sztuczki produktywności, ale małe gesty gościnności wobec twojej przyszłej uwagi. Ułatwiasz sobie powiedzenie „tak”, gdy nadejdzie moment.',
        ],
        reflectionPrompts: [
          'Która część mojego dnia jest na tyle stała, by stać się kotwicą?',
          'Jaką małą przeszkodę mogę usunąć jeszcze dziś wieczorem?',
        ],
      },
      {
        heading: 'Skorzystaj z praktyki czterech ruchów',
        paragraphs: [
          'Powtarzalna forma zdejmuje presję tworzenia każdego dnia nowego duchowego przeżycia. Poniższe ruchy są celowo proste. Działają z akapitem Ewangelii, psalmem, częścią listu lub fragmentem dłuższego planu. Idź na tyle wolno, by zauważać, ale nie martw się o doskonałe wykonanie każdego kroku.',
        ],
        numberedPractices: [
          'Przyjdź. Weź jeden spokojny oddech i nazwij to, co przynosisz: rozproszenie, wdzięczność, zmęczenie, nadzieję albo niepewność. Nie musisz najpierw się uspokoić.',
          'Przeczytaj. Przeczytaj krótki fragment raz, by uchwycić całość, a potem ponownie, wolniej. Jeśli zdanie przyciąga uwagę, zatrzymaj się przy nim zamiast biec do końca.',
          'Zauważ. Zapytaj, co tekst mówi o Bogu, ludziach, pragnieniu, lęku, łasce lub wiernym działaniu. Oddziel to, co naprawdę jest w tekście, od tego, czego się spodziewasz.',
          'Odpowiedz. Wypowiedz jedno szczere zdanie modlitwy i wybierz małą odpowiedź na dzień: zachować frazę, przeprosić, poczekać, podziękować albo zadać lepsze pytanie.',
        ],
      },
      {
        heading: 'Ustal minimum na przepełnione dni',
        paragraphs: [
          'Z góry zdecyduj, co będzie wystarczające, gdy czasu i siły jest mało. Współczujące minimum może oznaczać: przeczytać cztery wersety, wybrać jedną frazę i wypowiedzieć jedno zdanie modlitwy. To nie furtka ani mniejsza wierność. Dzięki temu drzwi pozostają otwarte. Gdy jedynym wyborem wydaje się pełne studium albo nic, zbyt często wygrywa nic.',
          'Minimum powinno być na tyle małe, by można je było szczerze praktykować w podróży, podczas opieki nad kimś lub w wymagającym okresie. W przestronne dni zostań dłużej. W trudne zachowaj nić. Rytm może się rozszerzać i kurczyć, nie znikając. Ta elastyczność pozwala mu stać się częścią życia, a nie krótkotrwałym projektem.',
        ],
      },
      {
        heading: 'Pozwól opuszczonym dniom uczyć cię powrotu',
        paragraphs: [
          'Będą dni, które opuścisz. Ważny jest nie sam brak, lecz historia, którą opowiesz potem. Wstyd mówi, że dowiodłeś braku wytrwałości i musisz czekać na idealny restart. Łaska mówi, że dziś jest dostępne. Nie podwajaj kolejnego czytania jako kary i nie spędzaj całego czasu na analizowaniu porażki. Otwórz dzisiejszy fragment — lub kolejny w planie — i zacznij.',
          'Jeśli przerwy się powtarzają, potraktuj je jako informację. Być może kotwica jest nierealna, czytanie za długie albo plan nie pasuje do obecnego etapu. Dostosowanie praktyki nie jest porzuceniem jej. Rodzic noworodka, student podczas egzaminów i osoba pracująca zmianowo potrzebują innych ram. Wierność odpowiada na rzeczywistość; nie udaje, że jej nie ma.',
        ],
      },
      {
        heading: 'Spróbuj przez siedem dni',
        paragraphs: [
          'Przez tydzień korzystaj z tej samej kotwicy i czterech ruchów. Wybierz fragment na tyle krótki, by go ponownie przeczytać. Na koniec każdego dnia zapisz tylko jedno zdanie: „Dziś zauważyłem/am…” Nie oceniaj doświadczenia. Zdanie ma zachować uwagę, a nie udowodnić, że każde czytanie było głębokie.',
          'Pod koniec tygodnia zobacz, co pomogło ci być obecnym. Zachowaj to, co temu służyło, i puść to, co tworzyło niepotrzebną presję. Potem rozpocznij kolejny tydzień. Codzienny rytm rośnie przez takie ciche korekty. Z czasem znajomy gest powrotu sam staje się powitaniem — miejscem, do którego można przyjść szczerze i znów słuchać.',
        ],
        reflectionPrompts: [
          'Co zauważałem/am wielokrotnie w tym tygodniu?',
          'Kiedy praktyka była najbardziej żywa lub szczera?',
          'Jaka zmiana uczyni powrót w przyszłym tygodniu łagodniejszym?',
        ],
      },
    ],
  },
  'praying-when-your-mind-will-not-slow-down': {
    title: 'Jak się modlić, gdy myśli nie zwalniają',
    description:
      'Proste i szczere sposoby modlitwy pośród wewnętrznego hałasu — bez udawania spokoju i traktowania modlitwy jak egzaminu.',
    category: 'Modlitwa',
    publishedAt: '2026-07-28',
    dateLabel: '28 lipca 2026',
    readTime: '10 min czytania',
    heroQuote: 'Modlitwa nie zaczyna się wtedy, gdy wszystkie myśli cichną. Zaczyna się, gdy przynosisz umysł, który naprawdę masz.',
    sections: [
      {
        heading: 'Nie musisz najpierw się uspokoić',
        paragraphs: [
          'Gdy myśli pędzą, modlitwa może wydawać się niemożliwa. Zaczynasz zdanie i przypominasz sobie niedokończone zadanie. Próbujesz siedzieć w ciszy i jeszcze wyraźniej zauważasz każdą troskę. Łatwo uznać, że modlisz się źle. Jednak błądząca uwaga nie jest moralnym upadkiem, a pobudzenie nie umieszcza cię poza obecnością Boga. Psalmy są pełne głosów, które przychodzą zrozpaczone, zagubione, zagniewane i przestraszone.',
          'Zacznij od porzucenia wymogu wytworzenia duchowego nastroju. Modlitwa może być rozproszona i nadal szczera. Może zawierać powtórzenia, ciszę, łzy, urwane zdania albo listę na papierze, gdy słowa nie chcą się połączyć. Celem nie jest pokazanie kontroli nad wewnętrznym światem, lecz prawdziwa obecność przed Bogiem właśnie w jego środku.',
        ],
      },
      {
        heading: 'Nazwij hałas',
        paragraphs: [
          'Wewnętrzny hałas często wydaje się większy, dopóki pozostaje niejasny. Spróbuj bez osądu nazwać to, co się dzieje: „Wciąż odtwarzam tamtą rozmowę”. „Boję się jutra”. „Moje ciało jest zmęczone, a myśli skaczą”. Nazwanie nie jest rozwiązaniem. Zmienia tylko chmurę w coś, co możesz przynieść do modlitwy.',
          'Jeśli kilka trosk walczy o uwagę, połóż je na kartce. Zapisz każdą w kilku słowach i powiedz: „Oto rzeczy, które niosę”. Kartka może potrzymać to, czego nie musisz powtarzać przez następne minuty. Później wrócisz do działania; modlitwa nie jest jego zamiennikiem. Teraz nazwanie pomaga przestać walczyć z samym faktem istnienia tych myśli.',
        ],
        reflectionPrompts: [
          'Która myśl wciąż domaga się mojej uwagi?',
          'Czy potrzebuje modlitwy, konkretnego kroku, rozmowy czy odpoczynku?',
        ],
      },
      {
        heading: 'Pożycz słowa, gdy własne są trudne',
        paragraphs: [
          'Nie musisz za każdym razem tworzyć nowego języka modlitwy. Pożyczone słowa mogą cię nieść, kiedy twoje myśli są splątane. Przeczytaj na głos krótki psalm, na tyle wolno, by go usłyszeć. Jego język nie musi idealnie pasować do twojego doświadczenia. Znajdź zdanie, które nadaje kształt temu, czego jeszcze nie umiesz powiedzieć, i powtarzaj je jako prośbę, protest lub wyraz zaufania.',
          'Możesz też użyć krótkiej modlitwy mieszczącej się w jednym oddechu: „Boże, spotkaj mnie tutaj”. „Daj mi światło na następny krok”. „Utrzymaj to, czego ja nie potrafię”. Powtarzanie nie jest puste, jeśli pozostaje uważne. Każdy powrót zbiera umysł bez karcenia go. Gdy przychodzi rozproszenie, zauważ je i wróć do zdania z łagodnością, z jaką odprowadza się dziecko do domu.',
        ],
      },
      {
        heading: 'Pięciominutowa modlitwa dla przepełnionego umysłu',
        paragraphs: [
          'Struktura może być życzliwa, gdy trudno się skupić. Wyznacz pięć spokojnych minut — nie jako odliczanie do sukcesu, lecz pozwolenie, by przez chwilę nie dźwigać wszystkiego naraz. Zostaw oczy otwarte, jeśli po zamknięciu myśli stają się głośniejsze. Usiądź, idź powoli albo trzymaj ciepły kubek. Wybierz postawę, która pomaga być obecnym, nie tylko taką, która wygląda modlitewnie.',
        ],
        numberedPractices: [
          'Przez minutę przychodź. Poczuj stopy, oddech i pokój. Powiedz: „Jestem tutaj i Bóg jest tutaj”.',
          'Przez minutę nazywaj. Wypowiedz lub zapisz główną troskę bez przerabiania jej na bardziej przyzwoitą.',
          'Przez minutę przyjmuj. Przeczytaj dwa lub trzy wersety i wybierz zdanie, które zachowasz.',
          'Przez minutę proś. Proś o łaskę, odwagę, mądrość lub pomoc dla najbliższego wiernego kroku — nie dla wszystkich możliwych przyszłości.',
          'Przez minutę oddawaj. Zakończ z otwartą dłonią: „To, czego nie mogę teraz rozwiązać, powierzam Tobie”.',
        ],
      },
      {
        heading: 'Nie używaj Pisma do uciszania prawdziwego cierpienia',
        paragraphs: [
          'Werset może dać towarzystwo i perspektywę, ale nie powinien stać się bronią przeciw twoim emocjom. Odczytanie „nie troszczcie się” jako „wierząca osoba by tego nie czuła” dodaje wstyd do cierpienia. Przeczytaj kontekst. Zauważ zaproszenie, relację i wskazane praktyki. Biblijna nadzieja nie jest zaprzeczaniem; może współistnieć z lamentem, pytaniami i potrzebą pomocy.',
          'Ważne jest też odróżnienie praktyki duchowej od opieki zdrowotnej. Modlitwa może głęboko wspierać, ale nie zastępuje profesjonalnej pomocy. Jeśli lęk, panika, bezsenność lub cierpienie są długotrwałe, intensywne albo wpływają na bezpieczeństwo i codzienne życie, porozmawiaj z wykwalifikowanym specjalistą zdrowia psychicznego lub lekarzem. Jeśli grozi ci bezpośrednie niebezpieczeństwo albo myślisz o zrobieniu sobie krzywdy, natychmiast skontaktuj się z numerem alarmowym lub linią kryzysową w swoim kraju oraz z zaufaną osobą.',
        ],
      },
      {
        heading: 'Niech modlitwa zakończy się jednym następnym krokiem',
        paragraphs: [
          'Rozpędzony umysł często chce pewności dotyczącej całej przyszłości. Modlitwa może zawęzić horyzont do najbliższego wiernego kroku. Być może trzeba wysłać wiadomość, zapisać pierwsze zadanie na jutro, napić się wody, przeprosić, poprosić o pomoc lub pójść spać. Konkretna odpowiedź nie rozwiązuje wszystkiego, ale daje trosce kierunek.',
          'Czasami następnym krokiem jest po prostu powrót do tej samej krótkiej modlitwy później. Nie oceniaj modlitwy po tym, czy natychmiast czujesz się inaczej. Spokój nie jest wskaźnikiem skuteczności. Szczery zwrot ku Bogu, przyjęcie kilku prawdziwych słów i wybór kolejnego gestu miłości są już znaczącą praktyką — nawet gdy myśli nadal się poruszają.',
        ],
        reflectionPrompts: [
          'Co próbuję rozwiązać wszystko naraz?',
          'Jakiej łaski potrzebuję na następną godzinę, a nie na całą przyszłość?',
          'Kto może pomóc mi nieść to mądrze?',
        ],
      },
    ],
  },
  'read-scripture-with-curiosity': {
    title: 'Czytaj Pismo z ciekawością: powtarzalna metoda w pięciu częściach',
    description:
      'Praktyczna metoda wychodzenia poza szybkie odpowiedzi przez kontekst, lepsze pytania, śledzenie powiązań i szczerą odpowiedź.',
    category: 'Studium Biblii',
    publishedAt: '2026-07-28',
    dateLabel: '28 lipca 2026',
    readTime: '11 min czytania',
    heroQuote: 'Ciekawość hamuje pośpiech, by zmusić fragment do powiedzenia czegoś, i otwiera przestrzeń na usłyszenie tego, co rzeczywiście mówi.',
    sections: [
      {
        heading: 'Porzuć presję zrozumienia wszystkiego',
        paragraphs: [
          'Często podchodzimy do Biblii z dwoma mało pomocnymi oczekiwaniami: znaczenie powinno być oczywiste od razu, a każde czytanie powinno przynieść osobistą lekcję. Gdy tak się nie dzieje, przyspieszamy, sięgamy po cudzą odpowiedź albo uznajemy, że nie umiemy czytać Pisma. Ciekawość proponuje inną postawę. Traktuje niezrozumienie jak drzwi do uwagi, nie jak dowód porażki.',
          'Ciekawy czytelnik pyta, zanim wyciągnie wniosek. Kto mówi? Co wydarzyło się wcześniej? Dlaczego ten szczegół się powtarza? Jaki to rodzaj tekstu? Co pierwsi słuchacze rozpoznawali, a czego ja nie widzę? Takie pytania nie czynią czytania chłodnym ani wyłącznie akademickim. Chronią przed narzucaniem tekstowi własnych założeń i mogą pogłębić zachwyt, pokorę oraz odpowiedź.',
        ],
      },
      {
        heading: 'Metoda: Przeczytaj, Zauważ, Zapytaj, Prześledź, Odpowiedz',
        paragraphs: [
          'Wybierz fragment na tyle krótki, by przeczytać go kilka razy — może sześć do piętnastu wersetów. Metoda działa lepiej, gdy zapiszesz choć kilka obserwacji. Do pierwszego podejścia nie potrzeba szczególnych narzędzi. Pozwól tekstowi zabrzmieć własnym głosem, zanim otworzysz przypisy, komentarze czy wyniki wyszukiwania.',
        ],
        numberedPractices: [
          'Przeczytaj. Najpierw czytaj dla całego ruchu. Określ gatunek, mówiącego, odbiorców, sytuację i to, co zmienia się od początku do końca.',
          'Zauważ. Zaznacz powtórzenia, kontrasty, przyczyny i skutki, pytania, obrazy, nakazy, obietnice i zaskoczenia. Zapisuj obserwacje przed interpretacjami.',
          'Zapytaj. Zamień to, co zauważasz, w prawdziwe pytania. Nazwij to, co jest jasne, co niepewne i jakie założenie możesz wnosić.',
          'Prześledź. Przeczytaj sąsiednie akapity, a potem poszukaj ważnych tematów lub cytatów w innych częściach Biblii. Niech wyraźny kontekst ogranicza fantazyjne domysły.',
          'Odpowiedz. Streść centralny ruch własnymi słowami. Nazwij to, co zaprasza do zaufania, pokuty, wdzięczności, odwagi lub dalszego studium, i wybierz proporcjonalną odpowiedź.',
        ],
      },
      {
        heading: 'Oddziel obserwację od interpretacji',
        paragraphs: [
          'Obserwacja opisuje to, co znajduje się na stronie: „pytanie pojawia się trzy razy”, „tłum odchodzi” albo „poemat przechodzi od skargi do uwielbienia”. Interpretacja proponuje znaczenie tych szczegółów. Obie są ważne, ale chwilowe rozdzielenie zmniejsza ryzyko, że pierwsze wrażenie stanie się jedyną możliwą lekturą.',
          'Spróbuj dwóch kolumn. W pierwszej zapisuj tylko to, co inny czytelnik mógłby wskazać w tekście. W drugiej — możliwe znaczenia i dowody dla każdego. Używaj zdań takich jak „To może sugerować…”, zamiast zbyt szybko ogłaszać pewność. Celem nie jest wieczne wahanie, ale odpowiedzialna ufność kształtowana przez dowody, kontekst i szersze świadectwo Pisma.',
        ],
      },
      {
        heading: 'Pozwól gatunkowi zmienić pytania',
        paragraphs: [
          'Przysłowie opisuje mądre prawidłowości; zwykle nie jest bezwarunkową gwarancją. Poezja używa obrazów i emocjonalnej intensywności. List należy do prawdziwej wspólnoty z konkretnym problemem. Opowieść przedstawia wydarzenia, niekoniecznie aprobując każde działanie. Proroctwo może łączyć ostrzeżenie, nadzieję, symbole i historię. Nie da się mechanicznie zastosować tej samej techniki do wszystkiego.',
          'Przed wnioskiem nazwij gatunek i zapytaj, czego czytelnik zwykle oczekuje od takiego pisma. W psalmie zauważ ruch, metaforę i modlitwę. W scenie ewangelicznej — postacie, konflikt i akcent narratora. W liście śledź argument przez kolejne akapity oraz słowa „dlatego”, „ale” i „ponieważ”. Gatunek nie oddziela od znaczenia; jest częścią sposobu, w jaki znaczenie zostaje przekazane.',
        ],
      },
      {
        heading: 'Sięgaj po narzędzia po własnej uważnej lekturze',
        paragraphs: [
          'Biblie studyjne, odsyłacze, mapy, słowniki, zaufani nauczyciele i narzędzia wyszukiwania pomagają odpowiadać na pytania historyczne i językowe. Używaj ich, by sprawdzić i wzbogacić to, co zauważyłeś, nie by ominąć spotkanie. Gdy sprawa jest sporna, porównaj kilka odpowiedzialnych źródeł i odróżniaj tekst biblijny od wniosku komentatora.',
          'Technologia może odnajdywać fragmenty lub porządkować tematy, ale generowane podsumowania mogą się mylić i nigdy nie powinny być przedstawiane jako Pismo. Sprawdzaj cytaty w wiarygodnym przekładzie Biblii i badaj kontekst. Dobre narzędzie odsyła do tekstu z lepszymi pytaniami. Złe odpowiada tak szybko, że przestajesz patrzeć.',
        ],
      },
      {
        heading: 'Pozostań szczery wobec trudnego fragmentu',
        paragraphs: [
          'Niektóre fragmenty są trudne, bo ich świat jest nam obcy. Inne podnoszą poważne pytania moralne, teologiczne lub osobiste. Ciekawość nie wymaga udawania, że napięcia są proste. Zapisz trudność wprost. Szukaj kontekstu historycznego, czytaj, gdzie uważni interpretatorzy się różnią, i pytaj, jak fragment odnosi się do charakteru i nauczania Jezusa oraz całej historii biblijnej.',
          'Opieraj się zarówno szybkiemu odrzuceniu, jak i pośpiesznej obronie. Pokora może powiedzieć: „Jeszcze tego nie rozumiem” i nadal się uczyć. Jeśli fragment został użyty, by cię zranić lub kontrolować, studiuj z godnymi zaufania ludźmi, którzy szanują twoją wolność i bezpieczeństwo. Mądra lektura przynosi dobry owoc: prawdę, miłość, sprawiedliwość, pokutę, odwagę oraz uwagę wobec Boga i bliźniego — nie przymus czy pogardę.',
        ],
      },
      {
        heading: 'Zbuduj tygodniową praktykę ciekawości',
        paragraphs: [
          'Wybierz jeden krótki fragment na tydzień. Pierwszego dnia czytaj i zauważaj. Drugiego zbieraj pytania. Trzeciego zbadaj bezpośredni kontekst. Czwartego prześledź jeden temat lub odsyłacz. Piątego sięgnij po jedno lub dwa wiarygodne źródła. Szóstego napisz krótkie podsumowanie. Siódmego wróć do fragmentu i odpowiedz modlitwą lub działaniem.',
          'Powtarzane czytanie pozwala, by tekst stał się czymś więcej niż pretekstem do szybkiej myśli. Wyłaniają się szczegóły, pytania dojrzewają, a przedwczesne wnioski słabną. Możesz zakończyć tydzień z pytaniami bez odpowiedzi. To nie jest stracone studium. Ciekawość uczy pozostawać wystarczająco długo, by zrozumienie mogło się pogłębić, a przekonanie i pokora razem kształtowały życie.',
        ],
        reflectionPrompts: [
          'Co zauważyłem/am dopiero przy drugim lub trzecim czytaniu?',
          'Który wniosek ma mocne podstawy, a który pozostaje roboczy?',
          'Jaka odpowiedź pasuje do fragmentu, nie każąc mu mówić więcej?',
        ],
      },
    ],
  },
} satisfies Record<BlogSlug, BlogPostContent>;

const postsByLocale = {
  en,
  pt,
  es,
  fr,
  de,
  it,
  ru,
  pl,
} satisfies Record<Locale, Record<BlogSlug, BlogPostContent>>;

function isBlogSlug(value: string): value is BlogSlug {
  return (BLOG_SLUGS as readonly string[]).includes(value);
}

export function getPosts(locale: Locale): BlogPost[] {
  return BLOG_SLUGS.map((slug) => ({
    slug,
    locale,
    ...postsByLocale[locale][slug],
  }));
}

export function getPost(locale: Locale, slug: string): BlogPost | undefined {
  if (!isBlogSlug(slug)) return undefined;

  return {
    slug,
    locale,
    ...postsByLocale[locale][slug],
  };
}
