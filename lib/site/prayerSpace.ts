import type { Locale } from './config';

export const PRAYER_SPACE_PATH = '/features/prayer-space' as const;
export const PRAYER_SPACE_ARTICLE_PATH = '/blog/a-daily-prayer-space-for-real-life' as const;

type PrayerSpaceStep = {
  number: string;
  title: string;
  body: string;
};

type PrayerSpaceItem = {
  title: string;
  body: string;
};

type PrayerSpaceFaq = {
  question: string;
  answer: string;
};

export type PrayerSpaceCopy = {
  locale: Locale;
  seoTitle: string;
  seoDescription: string;
  eyebrow: string;
  title: string;
  accent: string;
  body: string;
  primaryCta: string;
  articleCta: string;
  trustLine: string;
  preview: {
    title: string;
    needLabel: string;
    need: string;
    scriptureLabel: string;
    scripture: string;
    reference: string;
    prayerLabel: string;
    prayer: string;
    privateLabel: string;
    prayedLabel: string;
    answeredLabel: string;
  };
  promise: {
    eyebrow: string;
    title: string;
    body: string;
    points: string[];
  };
  flow: {
    eyebrow: string;
    title: string;
    body: string;
    steps: PrayerSpaceStep[];
  };
  privacy: {
    eyebrow: string;
    title: string;
    body: string;
    points: string[];
  };
  complements: {
    eyebrow: string;
    title: string;
    body: string;
    items: PrayerSpaceItem[];
  };
  faq: {
    eyebrow: string;
    title: string;
    items: PrayerSpaceFaq[];
  };
  closing: {
    eyebrow: string;
    title: string;
    body: string;
    primaryCta: string;
    secondaryCta: string;
  };
};

type PrayerSpaceContent = Omit<PrayerSpaceCopy, 'locale'>;

const prayerSpaceByLocale = {
  en: {
    seoTitle: 'A private prayer journal for everyday life',
    seoDescription:
      'Turn what is on your heart into a private prayer with approved Scripture, a focused Prayer Moment, and a gentle record of gratitude over time.',
    eyebrow: 'Vella Prayer Space',
    title: 'Remember what matters.',
    accent: 'Pray with intention. Notice what changes.',
    body:
      'Prayer Space gives you a quiet, private path from a real need to approved Scripture, your own words of prayer, and a gratitude timeline you can return to—without turning prayer into content or performance.',
    primaryCta: 'See how Prayer Space works',
    articleCta: 'Read the practical guide',
    trustLine: 'Private by design · Your prayer stays in your words · No prayer text in AI or notifications',
    preview: {
      title: 'A Prayer Moment',
      needLabel: 'On your heart',
      need: 'Peace for the next step',
      scriptureLabel: 'Approved Scripture',
      scripture: '“Cast all your anxiety on him because he cares for you.”',
      reference: '1 Peter 5:7',
      prayerLabel: 'Your prayer',
      prayer: 'Help me place this next step in your hands.',
      privateLabel: 'Private to your account',
      prayedLabel: 'I prayed',
      answeredLabel: 'Answered · gratitude',
    },
    promise: {
      eyebrow: 'Prayer without performance',
      title: 'A place to be honest, not impressive.',
      body:
        'Some needs are too personal for a feed and too important to lose in a hurried day. Prayer Space helps you name one thing, stay with it, and remember how the story unfolds.',
      points: [
        'Begin with a need you choose to name',
        'Receive Scripture from Vella’s approved stored corpus',
        'Write the prayer yourself—Vella never speaks for you',
        'Return later to add gratitude or mark it answered',
      ],
    },
    flow: {
      eyebrow: 'A focused rhythm',
      title: 'From what you carry to a prayer you can revisit.',
      body:
        'The flow is intentionally small. It offers enough structure to help you begin while leaving the meaning, language, and response in your hands.',
      steps: [
        { number: '01', title: 'Name the need', body: 'Choose what is asking for prayer today without having to tell a whole story.' },
        { number: '02', title: 'Receive approved Scripture', body: 'Pause with a passage retrieved from Vella’s stored, approved Bible corpus—not text invented by AI.' },
        { number: '03', title: 'Pray in your own words', body: 'Write an honest prayer, a sentence or several paragraphs. Vella does not generate it for you.' },
        { number: '04', title: 'Mark the moment', body: 'Tap “I prayed” and keep the intention available for another quiet return.' },
        { number: '05', title: 'Notice with gratitude', body: 'Add an update or mark the intention answered while preserving space for outcomes different from what you expected.' },
      ],
    },
    privacy: {
      eyebrow: 'Private by design',
      title: 'Your prayer is not a post, prompt, or notification preview.',
      body:
        'Prayer Space is separate from Vella’s public community surfaces. Its purpose is personal remembrance and prayer, with clear boundaries around sensitive words.',
      points: [
        'Intentions and prayers are not published to Faith Feed or shared with other people',
        'Prayer and intention text is never sent to AI for generation or interpretation',
        'Notifications, when enabled, use a neutral invitation and never include private prayer text',
        'You can update or delete an intention from your account',
      ],
    },
    complements: {
      eyebrow: 'One part of a fuller rhythm',
      title: 'Prayer Space connects the moments Vella already helps you make room for.',
      body:
        'It does not replace Scripture, reflection, community, or wise human care. It gives those practices a private place to become a personal response.',
      items: [
        { title: 'Daily Light', body: 'Carry the day’s Scripture and reflection into one focused Prayer Moment.' },
        { title: 'Scripture and search', body: 'Return to approved biblical text and explore its context rather than treating a generated answer as authority.' },
        { title: 'Guided journeys', body: 'Let a multi-day theme inform prayer while keeping each intention personal and concrete.' },
        { title: 'Notes and favorites', body: 'Save study observations separately and keep Prayer Space centered on intentions, prayer, and gratitude.' },
        { title: 'Optional notifications', body: 'Receive a quiet invitation only when enabled—never the private words you wrote.' },
        { title: 'Community with boundaries', body: 'Choose encouragement in community separately; Prayer Space itself remains private.' },
      ],
    },
    faq: {
      eyebrow: 'Clear answers',
      title: 'About privacy, Scripture, and answered prayer.',
      items: [
        { question: 'Is Prayer Space public?', answer: 'No. Prayer Space is private to your account. Intentions and prayer text are not posted to Faith Feed or shared with other people.' },
        { question: 'Does AI read or write my prayer?', answer: 'No. Vella does not send Prayer Space intention or prayer text to AI, and it does not generate a prayer in your voice. Scripture shown in the flow comes from Vella’s approved stored Bible corpus.' },
        { question: 'Will a notification show what I wrote?', answer: 'No. If you choose to enable notifications, Prayer Space uses a neutral invitation. Your intention and prayer text do not appear in notification content.' },
        { question: 'What does “Answered” mean?', answer: 'It is your own marker for an intention you want to close with an update or gratitude. It does not imply that every prayer resolves in the way expected or on a particular timeline.' },
        { question: 'Is Prayer Space pastoral or mental-health care?', answer: 'No. Vella supports devotional reflection but does not replace trusted pastoral, medical, mental-health, or emergency support. Seek qualified local help when a situation is serious or urgent.' },
      ],
    },
    closing: {
      eyebrow: 'A quieter next step',
      title: 'Give one concern a place to become prayer.',
      body: 'Begin honestly, stay close to Scripture, and leave yourself a gentle record of what you carried and how you returned.',
      primaryCta: 'Read the Prayer Space guide',
      secondaryCta: 'Explore every Vella feature',
    },
  },
  pt: {
    seoTitle: 'Diário de oração privado para a vida real',
    seoDescription:
      'Transforme o que está no seu coração em uma oração privada com Escritura aprovada, um Momento de Oração focado e um registro gentil de gratidão.',
    eyebrow: 'Espaço de Oração Vella',
    title: 'Lembre do que importa.',
    accent: 'Ore com intenção. Perceba o que muda.',
    body:
      'O Espaço de Oração oferece um caminho tranquilo e privado entre uma necessidade real, a Escritura aprovada, sua oração com suas próprias palavras e uma linha do tempo de gratidão — sem transformar oração em conteúdo ou desempenho.',
    primaryCta: 'Ver como o Espaço de Oração funciona',
    articleCta: 'Ler o guia prático',
    trustLine: 'Privado por princípio · A oração continua sendo sua · Nenhum texto de oração vai para IA ou notificações',
    preview: {
      title: 'Um Momento de Oração',
      needLabel: 'No seu coração',
      need: 'Paz para o próximo passo',
      scriptureLabel: 'Escritura aprovada',
      scripture: '“Lancem sobre ele toda a sua ansiedade, porque ele tem cuidado de vocês.”',
      reference: '1 Pedro 5:7',
      prayerLabel: 'Sua oração',
      prayer: 'Ajuda-me a colocar este próximo passo em tuas mãos.',
      privateLabel: 'Privado na sua conta',
      prayedLabel: 'Eu orei',
      answeredLabel: 'Respondida · gratidão',
    },
    promise: {
      eyebrow: 'Oração sem desempenho',
      title: 'Um lugar para ser sincero, não impressionante.',
      body:
        'Algumas necessidades são pessoais demais para um feed e importantes demais para se perderem na pressa. O Espaço de Oração ajuda você a nomear uma coisa, permanecer com ela e lembrar como essa história se desenvolveu.',
      points: [
        'Comece por uma necessidade que você escolhe nomear',
        'Receba Escritura do acervo aprovado e armazenado da Vella',
        'Escreva a própria oração — a Vella nunca fala por você',
        'Volte depois para acrescentar gratidão ou marcar como respondida',
      ],
    },
    flow: {
      eyebrow: 'Um ritmo focado',
      title: 'Do que você carrega a uma oração que pode revisitar.',
      body:
        'O fluxo é intencionalmente simples. Há estrutura suficiente para ajudar você a começar, mas o sentido, as palavras e a resposta continuam em suas mãos.',
      steps: [
        { number: '01', title: 'Nomeie a necessidade', body: 'Escolha o que pede oração hoje sem precisar contar uma história inteira.' },
        { number: '02', title: 'Receba Escritura aprovada', body: 'Pare com uma passagem recuperada do acervo bíblico aprovado da Vella — nunca um texto inventado por IA.' },
        { number: '03', title: 'Ore com suas palavras', body: 'Escreva uma oração sincera, curta ou longa. A Vella não a gera no seu lugar.' },
        { number: '04', title: 'Marque o momento', body: 'Toque em “Eu orei” e mantenha a intenção disponível para outro retorno tranquilo.' },
        { number: '05', title: 'Perceba com gratidão', body: 'Acrescente uma atualização ou marque a intenção como respondida, acolhendo também caminhos diferentes do esperado.' },
      ],
    },
    privacy: {
      eyebrow: 'Privado por princípio',
      title: 'Sua oração não é post, prompt nem prévia de notificação.',
      body:
        'O Espaço de Oração fica separado das áreas públicas da Vella. Ele existe para memória e oração pessoais, com limites claros para palavras sensíveis.',
      points: [
        'Intenções e orações não são publicadas no Faith Feed nem compartilhadas com outras pessoas',
        'O texto da intenção e da oração nunca é enviado à IA para geração ou interpretação',
        'Notificações, quando ativadas, usam um convite neutro e nunca incluem o texto privado',
        'Você pode atualizar ou excluir uma intenção pela sua conta',
      ],
    },
    complements: {
      eyebrow: 'Parte de um ritmo maior',
      title: 'O Espaço de Oração conecta os momentos para os quais a Vella já ajuda a abrir espaço.',
      body:
        'Ele não substitui Escritura, reflexão, comunidade nem cuidado humano responsável. Apenas oferece um lugar privado para essas práticas se tornarem uma resposta pessoal.',
      items: [
        { title: 'Luz Diária', body: 'Leve a Escritura e a reflexão do dia para um Momento de Oração focado.' },
        { title: 'Escritura e busca', body: 'Volte ao texto bíblico aprovado e explore o contexto, sem tratar uma resposta gerada como autoridade.' },
        { title: 'Jornadas guiadas', body: 'Deixe um tema de vários dias orientar a oração, mantendo cada intenção pessoal e concreta.' },
        { title: 'Notas e favoritos', body: 'Guarde observações de estudo separadamente e deixe o Espaço de Oração centrado em intenção, oração e gratidão.' },
        { title: 'Notificações opcionais', body: 'Receba um convite discreto somente se ativar — nunca as palavras privadas que escreveu.' },
        { title: 'Comunidade com limites', body: 'Busque encorajamento na comunidade separadamente; o Espaço de Oração permanece privado.' },
      ],
    },
    faq: {
      eyebrow: 'Respostas claras',
      title: 'Sobre privacidade, Escritura e oração respondida.',
      items: [
        { question: 'O Espaço de Oração é público?', answer: 'Não. O Espaço de Oração é privado na sua conta. Intenções e textos de oração não são publicados no Faith Feed nem compartilhados com outras pessoas.' },
        { question: 'A IA lê ou escreve minha oração?', answer: 'Não. A Vella não envia à IA o texto de intenções ou orações do Espaço de Oração e não cria uma oração na sua voz. A Escritura exibida vem do acervo bíblico aprovado e armazenado da Vella.' },
        { question: 'Uma notificação mostrará o que escrevi?', answer: 'Não. Se você ativar notificações, o Espaço de Oração usa um convite neutro. Sua intenção e sua oração não aparecem no conteúdo da notificação.' },
        { question: 'O que significa “Respondida”?', answer: 'É uma marca pessoal para encerrar uma intenção com atualização ou gratidão. Não significa que toda oração terá o resultado esperado nem seguirá um prazo determinado.' },
        { question: 'O Espaço de Oração substitui cuidado pastoral ou psicológico?', answer: 'Não. A Vella apoia a reflexão devocional, mas não substitui apoio pastoral, médico, psicológico ou de emergência. Procure ajuda qualificada na sua região em situações graves ou urgentes.' },
      ],
    },
    closing: {
      eyebrow: 'Um próximo passo mais tranquilo',
      title: 'Dê a uma preocupação um lugar para se tornar oração.',
      body: 'Comece com sinceridade, permaneça perto da Escritura e preserve um registro gentil do que você levou a Deus e de como voltou.',
      primaryCta: 'Ler o guia do Espaço de Oração',
      secondaryCta: 'Conhecer todos os recursos da Vella',
    },
  },
  es: {
    seoTitle: 'Diario de oración privado para la vida real',
    seoDescription:
      'Convierte lo que llevas en el corazón en una oración privada con Escritura aprobada, un Momento de Oración enfocado y un registro sereno de gratitud.',
    eyebrow: 'Espacio de Oración Vella',
    title: 'Recuerda lo que importa.',
    accent: 'Ora con intención. Observa lo que cambia.',
    body:
      'El Espacio de Oración ofrece un camino sereno y privado desde una necesidad real hasta la Escritura aprobada, tu oración con tus propias palabras y una línea de gratitud a la que puedes volver, sin convertir la oración en contenido o rendimiento.',
    primaryCta: 'Ver cómo funciona',
    articleCta: 'Leer la guía práctica',
    trustLine: 'Privado por diseño · La oración conserva tus palabras · Ningún texto de oración llega a la IA ni a las notificaciones',
    preview: {
      title: 'Un Momento de Oración',
      needLabel: 'En tu corazón',
      need: 'Paz para el siguiente paso',
      scriptureLabel: 'Escritura aprobada',
      scripture: '«Depositen en él toda ansiedad, porque él cuida de ustedes».',
      reference: '1 Pedro 5:7',
      prayerLabel: 'Tu oración',
      prayer: 'Ayúdame a poner este siguiente paso en tus manos.',
      privateLabel: 'Privado en tu cuenta',
      prayedLabel: 'He orado',
      answeredLabel: 'Respondida · gratitud',
    },
    promise: {
      eyebrow: 'Oración sin rendimiento',
      title: 'Un lugar para ser sincero, no impresionante.',
      body: 'Algunas necesidades son demasiado personales para un feed y demasiado importantes para perderse en la prisa. Aquí puedes nombrar una, permanecer con ella y recordar cómo avanza su historia.',
      points: ['Comienza con una necesidad que tú decides nombrar', 'Recibe Escritura del corpus aprobado y almacenado de Vella', 'Escribe tu propia oración; Vella nunca habla por ti', 'Vuelve para añadir gratitud o marcarla como respondida'],
    },
    flow: {
      eyebrow: 'Un ritmo enfocado',
      title: 'De lo que llevas a una oración que puedes revisitar.',
      body: 'El flujo es deliberadamente sencillo: estructura suficiente para empezar, mientras el sentido, las palabras y la respuesta permanecen en tus manos.',
      steps: [
        { number: '01', title: 'Nombra la necesidad', body: 'Elige lo que necesita oración hoy sin tener que contar toda la historia.' },
        { number: '02', title: 'Recibe Escritura aprobada', body: 'Detente en un pasaje del corpus bíblico aprobado de Vella, nunca en un texto inventado por IA.' },
        { number: '03', title: 'Ora con tus palabras', body: 'Escribe una oración sincera, breve o extensa. Vella no la genera por ti.' },
        { number: '04', title: 'Marca el momento', body: 'Toca «He orado» y conserva la intención para otro regreso tranquilo.' },
        { number: '05', title: 'Observa con gratitud', body: 'Añade una actualización o márcala como respondida, dejando espacio para resultados distintos de los esperados.' },
      ],
    },
    privacy: {
      eyebrow: 'Privado por diseño',
      title: 'Tu oración no es una publicación, un prompt ni una vista previa.',
      body: 'El Espacio de Oración está separado de las áreas públicas de Vella. Existe para la memoria y la oración personales, con límites claros para palabras sensibles.',
      points: ['Las intenciones y oraciones no se publican en Faith Feed ni se comparten con otras personas', 'El texto nunca se envía a la IA para generarlo o interpretarlo', 'Las notificaciones opcionales usan una invitación neutra y nunca incluyen texto privado', 'Puedes actualizar o eliminar una intención desde tu cuenta'],
    },
    complements: {
      eyebrow: 'Parte de un ritmo más amplio',
      title: 'El Espacio de Oración conecta los momentos para los que Vella ya te ayuda a hacer lugar.',
      body: 'No sustituye la Escritura, la reflexión, la comunidad ni el cuidado humano sabio. Les da un lugar privado para convertirse en respuesta personal.',
      items: [
        { title: 'Luz diaria', body: 'Lleva la Escritura y la reflexión del día a un Momento de Oración enfocado.' },
        { title: 'Escritura y búsqueda', body: 'Vuelve al texto bíblico aprobado y explora su contexto sin tratar una respuesta generada como autoridad.' },
        { title: 'Caminos guiados', body: 'Deja que un tema de varios días inspire la oración manteniendo cada intención personal.' },
        { title: 'Notas y favoritos', body: 'Guarda el estudio por separado y centra este espacio en intención, oración y gratitud.' },
        { title: 'Notificaciones opcionales', body: 'Recibe una invitación discreta solo si la activas, nunca las palabras privadas que escribiste.' },
        { title: 'Comunidad con límites', body: 'Elige el ánimo comunitario por separado; el Espacio de Oración sigue siendo privado.' },
      ],
    },
    faq: {
      eyebrow: 'Respuestas claras',
      title: 'Sobre privacidad, Escritura y oración respondida.',
      items: [
        { question: '¿El Espacio de Oración es público?', answer: 'No. Es privado en tu cuenta. Las intenciones y oraciones no se publican en Faith Feed ni se comparten con otras personas.' },
        { question: '¿La IA lee o escribe mi oración?', answer: 'No. Vella no envía a la IA el texto de tus intenciones u oraciones ni crea una oración con tu voz. La Escritura mostrada procede del corpus bíblico aprobado y almacenado de Vella.' },
        { question: '¿Una notificación mostrará lo que escribí?', answer: 'No. Si activas las notificaciones, se usa una invitación neutra. Tu intención y tu oración nunca aparecen en el contenido.' },
        { question: '¿Qué significa «Respondida»?', answer: 'Es tu marca personal para cerrar una intención con una actualización o gratitud. No promete que cada oración se resuelva como esperabas ni en un plazo concreto.' },
        { question: '¿Sustituye el cuidado pastoral o psicológico?', answer: 'No. Vella apoya la reflexión devocional, pero no sustituye ayuda pastoral, médica, psicológica o de emergencia. Busca apoyo cualificado local ante una situación grave o urgente.' },
      ],
    },
    closing: {
      eyebrow: 'Un siguiente paso más sereno',
      title: 'Dale a una preocupación un lugar para convertirse en oración.',
      body: 'Comienza con sinceridad, permanece cerca de la Escritura y conserva un registro amable de lo que llevaste a Dios y de cómo regresaste.',
      primaryCta: 'Leer la guía del Espacio de Oración',
      secondaryCta: 'Explorar todas las funciones de Vella',
    },
  },
  fr: {
    seoTitle: 'Journal de prière privé pour la vie réelle',
    seoDescription: 'Transformez ce qui vous tient à cœur en prière privée, avec des Écritures approuvées, un moment de prière ciblé et une mémoire paisible de gratitude.',
    eyebrow: 'Espace de prière Vella',
    title: 'Gardez en mémoire ce qui compte.',
    accent: 'Priez avec intention. Remarquez ce qui change.',
    body: 'L’Espace de prière trace un chemin calme et privé entre un besoin réel, des Écritures approuvées, votre propre prière et une chronologie de gratitude — sans transformer la prière en contenu ni en performance.',
    primaryCta: 'Voir comment cela fonctionne',
    articleCta: 'Lire le guide pratique',
    trustLine: 'Privé par conception · Votre prière garde vos mots · Aucun texte de prière dans l’IA ou les notifications',
    preview: { title: 'Un moment de prière', needLabel: 'Dans votre cœur', need: 'La paix pour la prochaine étape', scriptureLabel: 'Écritures approuvées', scripture: '« Déchargez-vous sur lui de tous vos soucis, car lui-même prend soin de vous. »', reference: '1 Pierre 5.7', prayerLabel: 'Votre prière', prayer: 'Aide-moi à remettre cette prochaine étape entre tes mains.', privateLabel: 'Privé dans votre compte', prayedLabel: 'J’ai prié', answeredLabel: 'Exaucée · gratitude' },
    promise: {
      eyebrow: 'Prier sans performance',
      title: 'Un lieu pour être sincère, pas impressionnant.',
      body: 'Certains besoins sont trop personnels pour un fil public et trop importants pour se perdre dans la hâte. Nommez-en un, demeurez-y et gardez la mémoire de son évolution.',
      points: ['Commencez par un besoin que vous choisissez de nommer', 'Recevez un passage du corpus biblique approuvé et stocké par Vella', 'Écrivez vous-même la prière — Vella ne parle jamais à votre place', 'Revenez ajouter de la gratitude ou la marquer comme exaucée'],
    },
    flow: {
      eyebrow: 'Un rythme attentif',
      title: 'De ce que vous portez à une prière que vous pouvez retrouver.',
      body: 'Le parcours reste volontairement simple : assez de structure pour commencer, tout en laissant le sens, les mots et la réponse entre vos mains.',
      steps: [
        { number: '01', title: 'Nommez le besoin', body: 'Choisissez ce qui appelle la prière aujourd’hui sans devoir raconter toute l’histoire.' },
        { number: '02', title: 'Recevez les Écritures', body: 'Arrêtez-vous sur un passage du corpus biblique approuvé de Vella, jamais sur un texte inventé par une IA.' },
        { number: '03', title: 'Priez avec vos mots', body: 'Écrivez une prière honnête, courte ou longue. Vella ne la produit pas à votre place.' },
        { number: '04', title: 'Marquez ce moment', body: 'Touchez « J’ai prié » et gardez l’intention disponible pour un autre retour paisible.' },
        { number: '05', title: 'Remarquez avec gratitude', body: 'Ajoutez une nouvelle ou marquez l’intention exaucée, en laissant place à une issue différente de celle imaginée.' },
      ],
    },
    privacy: {
      eyebrow: 'Privé par conception',
      title: 'Votre prière n’est ni une publication, ni un prompt, ni un aperçu de notification.',
      body: 'L’Espace de prière est séparé des espaces publics de Vella. Il sert une mémoire et une prière personnelles avec des limites claires pour les mots sensibles.',
      points: ['Les intentions et prières ne sont ni publiées dans Faith Feed ni partagées', 'Leur texte n’est jamais envoyé à une IA pour être généré ou interprété', 'Les notifications facultatives restent neutres et ne reprennent jamais le texte privé', 'Vous pouvez modifier ou supprimer une intention depuis votre compte'],
    },
    complements: {
      eyebrow: 'Une partie d’un rythme plus vaste',
      title: 'L’Espace de prière relie les moments auxquels Vella vous aide déjà à faire place.',
      body: 'Il ne remplace ni les Écritures, ni la réflexion, ni la communauté, ni un accompagnement humain avisé. Il leur offre un lieu privé pour devenir une réponse personnelle.',
      items: [
        { title: 'Lumière quotidienne', body: 'Prolongez le passage et la réflexion du jour par un moment de prière attentif.' },
        { title: 'Écritures et recherche', body: 'Revenez au texte biblique approuvé et à son contexte sans donner autorité à une réponse générée.' },
        { title: 'Parcours guidés', body: 'Laissez un thème sur plusieurs jours nourrir la prière tout en gardant chaque intention personnelle.' },
        { title: 'Notes et favoris', body: 'Conservez l’étude séparément et centrez cet espace sur l’intention, la prière et la gratitude.' },
        { title: 'Notifications facultatives', body: 'Recevez une invitation discrète seulement si vous l’activez, jamais les mots privés écrits.' },
        { title: 'Communauté avec des limites', body: 'Choisissez séparément l’encouragement communautaire ; l’Espace de prière reste privé.' },
      ],
    },
    faq: {
      eyebrow: 'Des réponses claires', title: 'À propos de la confidentialité, des Écritures et de la prière exaucée.',
      items: [
        { question: 'L’Espace de prière est-il public ?', answer: 'Non. Il est privé dans votre compte. Les intentions et prières ne sont ni publiées dans Faith Feed ni partagées avec d’autres personnes.' },
        { question: 'L’IA lit-elle ou écrit-elle ma prière ?', answer: 'Non. Vella n’envoie pas à l’IA le texte de vos intentions ou prières et ne compose pas de prière avec votre voix. Les passages affichés viennent du corpus biblique approuvé et stocké de Vella.' },
        { question: 'Une notification montrera-t-elle mes mots ?', answer: 'Non. Si vous activez les notifications, elles utilisent une invitation neutre. Votre intention et votre prière n’y apparaissent jamais.' },
        { question: 'Que signifie « Exaucée » ?', answer: 'C’est votre repère personnel pour clore une intention avec une nouvelle ou de la gratitude. Il ne promet ni une issue précise ni un délai.' },
        { question: 'Est-ce un accompagnement pastoral ou psychologique ?', answer: 'Non. Vella soutient la réflexion spirituelle sans remplacer une aide pastorale, médicale, psychologique ou d’urgence. Cherchez une aide locale qualifiée si la situation est grave ou urgente.' },
      ],
    },
    closing: { eyebrow: 'Une prochaine étape plus paisible', title: 'Donnez à une préoccupation un lieu où devenir prière.', body: 'Commencez avec sincérité, restez près des Écritures et gardez une trace douce de ce que vous avez confié à Dieu et de votre retour.', primaryCta: 'Lire le guide de l’Espace de prière', secondaryCta: 'Découvrir toutes les fonctions de Vella' },
  },
  de: {
    seoTitle: 'Privates Gebetstagebuch für das wirkliche Leben',
    seoDescription: 'Bringe das, was dich bewegt, in ein privates Gebet mit geprüfter Bibelstelle, einem konzentrierten Gebetsmoment und einer stillen Spur der Dankbarkeit.',
    eyebrow: 'Vella Gebetsraum',
    title: 'Behalte im Herzen, was zählt.',
    accent: 'Bete bewusst. Nimm wahr, was sich verändert.',
    body: 'Der Gebetsraum führt dich ruhig und privat von einem echten Anliegen zu einer geprüften Bibelstelle, deinem Gebet in eigenen Worten und einer Spur der Dankbarkeit — ohne Gebet zu Inhalt oder Leistung zu machen.',
    primaryCta: 'So funktioniert der Gebetsraum',
    articleCta: 'Den praktischen Leitfaden lesen',
    trustLine: 'Bewusst privat · Dein Gebet bleibt in deinen Worten · Kein Gebetstext für KI oder Benachrichtigungen',
    preview: { title: 'Ein Gebetsmoment', needLabel: 'Was dich bewegt', need: 'Frieden für den nächsten Schritt', scriptureLabel: 'Geprüfte Bibelstelle', scripture: '„Alle eure Sorge werft auf ihn; denn er sorgt für euch.“', reference: '1. Petrus 5,7', prayerLabel: 'Dein Gebet', prayer: 'Hilf mir, diesen nächsten Schritt in deine Hände zu legen.', privateLabel: 'Privat in deinem Konto', prayedLabel: 'Ich habe gebetet', answeredLabel: 'Erhört · Dankbarkeit' },
    promise: { eyebrow: 'Gebet ohne Leistungsdruck', title: 'Ein Ort, um ehrlich zu sein, nicht eindrucksvoll.', body: 'Manche Anliegen sind zu persönlich für einen Feed und zu wichtig, um in der Eile unterzugehen. Benenne eines, bleibe dabei und bewahre, wie sich seine Geschichte entfaltet.', points: ['Beginne mit einem Anliegen, das du selbst benennst', 'Empfange eine Stelle aus Vellas geprüftem, gespeichertem Bibelkorpus', 'Schreibe dein Gebet selbst — Vella spricht nie an deiner Stelle', 'Kehre zurück, ergänze Dankbarkeit oder markiere es als erhört'] },
    flow: {
      eyebrow: 'Ein konzentrierter Rhythmus', title: 'Von dem, was du trägst, zu einem Gebet, zu dem du zurückkehren kannst.', body: 'Der Ablauf bleibt bewusst klein: genug Struktur für den Anfang, während Bedeutung, Worte und Antwort in deinen Händen bleiben.',
      steps: [
        { number: '01', title: 'Benenne das Anliegen', body: 'Wähle, was heute Gebet braucht, ohne die ganze Geschichte erzählen zu müssen.' },
        { number: '02', title: 'Empfange geprüfte Schrift', body: 'Verweile bei einer Stelle aus Vellas geprüftem Bibelkorpus, niemals bei einem von KI erfundenen Text.' },
        { number: '03', title: 'Bete mit eigenen Worten', body: 'Schreibe ehrlich, kurz oder ausführlich. Vella erzeugt das Gebet nicht für dich.' },
        { number: '04', title: 'Halte den Moment fest', body: 'Tippe auf „Ich habe gebetet“ und bewahre das Anliegen für eine weitere stille Rückkehr.' },
        { number: '05', title: 'Nimm dankbar wahr', body: 'Ergänze ein Update oder markiere es als erhört, auch wenn die Antwort anders aussieht als erwartet.' },
      ],
    },
    privacy: { eyebrow: 'Bewusst privat', title: 'Dein Gebet ist weder Post noch Prompt oder Benachrichtigungsvorschau.', body: 'Der Gebetsraum ist von Vellas öffentlichen Bereichen getrennt. Er dient persönlicher Erinnerung und Gebet mit klaren Grenzen für sensible Worte.', points: ['Anliegen und Gebete werden weder im Faith Feed veröffentlicht noch mit anderen geteilt', 'Der Text wird nie zur Erzeugung oder Deutung an eine KI gesendet', 'Optionale Benachrichtigungen bleiben neutral und enthalten nie private Gebetsworte', 'Du kannst ein Anliegen in deinem Konto ändern oder löschen'] },
    complements: {
      eyebrow: 'Teil eines größeren Rhythmus', title: 'Der Gebetsraum verbindet die Momente, für die Vella schon Raum schafft.', body: 'Er ersetzt weder die Bibel noch Reflexion, Gemeinschaft oder kluge menschliche Begleitung. Er gibt ihnen einen privaten Ort für deine persönliche Antwort.',
      items: [
        { title: 'Tägliches Licht', body: 'Nimm Bibelstelle und Reflexion des Tages in einen konzentrierten Gebetsmoment mit.' },
        { title: 'Bibel und Suche', body: 'Kehre zum geprüften Bibeltext und Kontext zurück, statt einer generierten Antwort Autorität zu geben.' },
        { title: 'Geführte Wege', body: 'Lass ein mehrtägiges Thema dein Gebet prägen und halte jedes Anliegen persönlich.' },
        { title: 'Notizen und Favoriten', body: 'Bewahre Studiengedanken getrennt und richte den Gebetsraum auf Anliegen, Gebet und Dankbarkeit.' },
        { title: 'Optionale Benachrichtigungen', body: 'Erhalte nur auf Wunsch eine stille Einladung — niemals deine privaten Worte.' },
        { title: 'Gemeinschaft mit Grenzen', body: 'Wähle Ermutigung in der Gemeinschaft separat; der Gebetsraum bleibt privat.' },
      ],
    },
    faq: { eyebrow: 'Klare Antworten', title: 'Über Privatsphäre, Bibeltext und erhörtes Gebet.', items: [
      { question: 'Ist der Gebetsraum öffentlich?', answer: 'Nein. Er ist in deinem Konto privat. Anliegen und Gebetstexte werden nicht im Faith Feed veröffentlicht oder mit anderen Personen geteilt.' },
      { question: 'Liest oder schreibt KI mein Gebet?', answer: 'Nein. Vella sendet Anliegen oder Gebetstexte nicht an KI und schreibt kein Gebet in deiner Stimme. Angezeigte Schriftstellen stammen aus Vellas geprüftem, gespeichertem Bibelkorpus.' },
      { question: 'Zeigt eine Benachrichtigung meinen Text?', answer: 'Nein. Wenn du Benachrichtigungen aktivierst, enthalten sie eine neutrale Einladung. Dein Anliegen und Gebet erscheinen dort nie.' },
      { question: 'Was bedeutet „Erhört“?', answer: 'Es ist deine persönliche Markierung, um ein Anliegen mit einem Update oder Dankbarkeit abzuschließen. Sie verspricht weder ein bestimmtes Ergebnis noch einen Zeitpunkt.' },
      { question: 'Ersetzt dies seelsorgerliche oder psychologische Hilfe?', answer: 'Nein. Vella unterstützt Andacht, ersetzt aber keine seelsorgerliche, medizinische, psychologische oder Notfallhilfe. Suche bei ernsten oder dringenden Situationen qualifizierte Hilfe vor Ort.' },
    ] },
    closing: { eyebrow: 'Ein stillerer nächster Schritt', title: 'Gib einer Sorge einen Ort, an dem sie zum Gebet werden kann.', body: 'Beginne ehrlich, bleibe nahe an der Bibel und bewahre eine sanfte Spur dessen, was du Gott anvertraut hast und wie du zurückgekehrt bist.', primaryCta: 'Den Leitfaden zum Gebetsraum lesen', secondaryCta: 'Alle Vella-Funktionen entdecken' },
  },
  it: {
    seoTitle: 'Diario di preghiera privato per la vita reale',
    seoDescription: 'Trasforma ciò che hai nel cuore in una preghiera privata con Scrittura approvata, un Momento di preghiera focalizzato e una memoria serena di gratitudine.',
    eyebrow: 'Spazio di Preghiera Vella',
    title: 'Ricorda ciò che conta.',
    accent: 'Prega con intenzione. Nota ciò che cambia.',
    body: 'Lo Spazio di Preghiera crea un percorso calmo e privato tra un bisogno reale, la Scrittura approvata, la tua preghiera con parole tue e una linea di gratitudine a cui tornare, senza trasformare la preghiera in contenuto o prestazione.',
    primaryCta: 'Scopri come funziona', articleCta: 'Leggi la guida pratica', trustLine: 'Privato per scelta · La preghiera resta nelle tue parole · Nessun testo di preghiera nell’IA o nelle notifiche',
    preview: { title: 'Un Momento di preghiera', needLabel: 'Nel tuo cuore', need: 'Pace per il prossimo passo', scriptureLabel: 'Scrittura approvata', scripture: '«Gettate in lui ogni vostra preoccupazione, perché egli ha cura di voi.»', reference: '1 Pietro 5:7', prayerLabel: 'La tua preghiera', prayer: 'Aiutami a mettere questo prossimo passo nelle tue mani.', privateLabel: 'Privato nel tuo account', prayedLabel: 'Ho pregato', answeredLabel: 'Esaudita · gratitudine' },
    promise: { eyebrow: 'Preghiera senza prestazione', title: 'Un luogo per essere sinceri, non perfetti.', body: 'Alcuni bisogni sono troppo personali per un feed e troppo importanti per perdersi nella fretta. Nomina una cosa, rimani con essa e ricorda come si sviluppa la sua storia.', points: ['Inizia da un bisogno che scegli tu di nominare', 'Ricevi un passo dal corpus biblico approvato e archiviato di Vella', 'Scrivi tu la preghiera — Vella non parla mai al tuo posto', 'Torna per aggiungere gratitudine o segnarla come esaudita'] },
    flow: { eyebrow: 'Un ritmo focalizzato', title: 'Da ciò che porti a una preghiera che puoi ritrovare.', body: 'Il percorso resta volutamente semplice: struttura sufficiente per cominciare, mentre significato, parole e risposta rimangono nelle tue mani.', steps: [
      { number: '01', title: 'Dai un nome al bisogno', body: 'Scegli ciò che oggi chiede preghiera senza dover raccontare tutta la storia.' },
      { number: '02', title: 'Ricevi la Scrittura approvata', body: 'Fermati su un passo del corpus biblico approvato di Vella, mai su un testo inventato dall’IA.' },
      { number: '03', title: 'Prega con parole tue', body: 'Scrivi una preghiera sincera, breve o lunga. Vella non la genera per te.' },
      { number: '04', title: 'Segna il momento', body: 'Tocca «Ho pregato» e conserva l’intenzione per un altro ritorno tranquillo.' },
      { number: '05', title: 'Nota con gratitudine', body: 'Aggiungi un aggiornamento o segnala l’intenzione come esaudita, anche quando la risposta è diversa dal previsto.' },
    ] },
    privacy: { eyebrow: 'Privato per scelta', title: 'La tua preghiera non è un post, un prompt o un’anteprima di notifica.', body: 'Lo Spazio di Preghiera è separato dalle aree pubbliche di Vella. Serve la memoria e la preghiera personali con confini chiari per parole sensibili.', points: ['Intenzioni e preghiere non vengono pubblicate nel Faith Feed né condivise con altri', 'Il testo non viene mai inviato all’IA per generazione o interpretazione', 'Le notifiche facoltative usano un invito neutro e non includono mai parole private', 'Puoi aggiornare o eliminare un’intenzione dal tuo account'] },
    complements: { eyebrow: 'Parte di un ritmo più ampio', title: 'Lo Spazio di Preghiera collega i momenti a cui Vella ti aiuta già a dare spazio.', body: 'Non sostituisce Scrittura, riflessione, comunità o una saggia cura umana. Offre loro un luogo privato per diventare risposta personale.', items: [
      { title: 'Luce quotidiana', body: 'Porta la Scrittura e la riflessione del giorno in un Momento di preghiera focalizzato.' },
      { title: 'Scrittura e ricerca', body: 'Torna al testo biblico approvato e al contesto senza dare autorità a una risposta generata.' },
      { title: 'Percorsi guidati', body: 'Lascia che un tema di più giorni nutra la preghiera mantenendo personale ogni intenzione.' },
      { title: 'Note e preferiti', body: 'Conserva lo studio separatamente e centra questo spazio su intenzione, preghiera e gratitudine.' },
      { title: 'Notifiche facoltative', body: 'Ricevi un invito discreto solo se lo attivi, mai le parole private che hai scritto.' },
      { title: 'Comunità con confini', body: 'Scegli separatamente l’incoraggiamento della comunità; lo Spazio di Preghiera resta privato.' },
    ] },
    faq: { eyebrow: 'Risposte chiare', title: 'Privacy, Scrittura e preghiera esaudita.', items: [
      { question: 'Lo Spazio di Preghiera è pubblico?', answer: 'No. È privato nel tuo account. Intenzioni e testi di preghiera non vengono pubblicati nel Faith Feed o condivisi con altre persone.' },
      { question: 'L’IA legge o scrive la mia preghiera?', answer: 'No. Vella non invia all’IA il testo di intenzioni o preghiere e non crea una preghiera con la tua voce. La Scrittura mostrata proviene dal corpus biblico approvato e archiviato di Vella.' },
      { question: 'Una notifica mostrerà ciò che ho scritto?', answer: 'No. Se attivi le notifiche, viene usato un invito neutro. La tua intenzione e la tua preghiera non appaiono mai.' },
      { question: 'Che cosa significa «Esaudita»?', answer: 'È un tuo segno personale per chiudere un’intenzione con un aggiornamento o gratitudine. Non promette un esito preciso né una scadenza.' },
      { question: 'Sostituisce l’aiuto pastorale o psicologico?', answer: 'No. Vella sostiene la riflessione devozionale, ma non sostituisce aiuto pastorale, medico, psicologico o di emergenza. Cerca sostegno qualificato locale nelle situazioni gravi o urgenti.' },
    ] },
    closing: { eyebrow: 'Un prossimo passo più quieto', title: 'Dai a una preoccupazione un luogo in cui diventare preghiera.', body: 'Comincia con sincerità, resta vicino alla Scrittura e conserva una traccia gentile di ciò che hai affidato a Dio e di come sei tornato.', primaryCta: 'Leggi la guida allo Spazio di Preghiera', secondaryCta: 'Scopri tutte le funzioni Vella' },
  },
  ru: {
    seoTitle: 'Личный молитвенный дневник для реальной жизни',
    seoDescription: 'Превратите то, что лежит на сердце, в личную молитву с проверенным текстом Писания, сосредоточенной минутой молитвы и бережной историей благодарности.',
    eyebrow: 'Молитвенное пространство Vella',
    title: 'Помните о том, что важно.',
    accent: 'Молитесь осознанно. Замечайте перемены.',
    body: 'Молитвенное пространство предлагает спокойный личный путь от настоящей нужды к проверенному Писанию, молитве своими словами и истории благодарности — не превращая молитву в публикацию или достижение.',
    primaryCta: 'Как это работает', articleCta: 'Прочитать практическое руководство', trustLine: 'Создано для личного · Молитва остаётся вашей · Текст молитвы не попадает в ИИ или уведомления',
    preview: { title: 'Минута молитвы', needLabel: 'Что лежит на сердце', need: 'Мир для следующего шага', scriptureLabel: 'Проверенное Писание', scripture: '«Все заботы ваши возложите на Него, ибо Он печётся о вас».', reference: '1 Петра 5:7', prayerLabel: 'Ваша молитва', prayer: 'Помоги мне отдать этот следующий шаг в Твои руки.', privateLabel: 'Личное в вашем аккаунте', prayedLabel: 'Я помолился', answeredLabel: 'Ответ получен · благодарность' },
    promise: { eyebrow: 'Молитва без показного', title: 'Место для искренности, а не впечатления.', body: 'Некоторые нужды слишком личные для ленты и слишком важные, чтобы затеряться в спешке. Назовите одну, побудьте с ней и сохраните историю того, как всё менялось.', points: ['Начните с нужды, которую сами решили назвать', 'Получите место из проверенного и сохранённого корпуса Библии Vella', 'Напишите молитву сами — Vella не говорит за вас', 'Вернитесь, добавьте благодарность или отметьте ответ'] },
    flow: { eyebrow: 'Сосредоточенный ритм', title: 'От того, что вы несёте, к молитве, к которой можно вернуться.', body: 'Путь намеренно прост: достаточно структуры для начала, а смысл, слова и отклик остаются в ваших руках.', steps: [
      { number: '01', title: 'Назовите нужду', body: 'Выберите то, что сегодня просит молитвы, не рассказывая всю историю.' },
      { number: '02', title: 'Примите проверенное Писание', body: 'Остановитесь на отрывке из проверенного библейского корпуса Vella, а не на тексте, придуманном ИИ.' },
      { number: '03', title: 'Молитесь своими словами', body: 'Напишите искреннюю молитву — одну фразу или несколько абзацев. Vella не создаёт её за вас.' },
      { number: '04', title: 'Отметьте момент', body: 'Нажмите «Я помолился» и сохраните намерение для следующего спокойного возвращения.' },
      { number: '05', title: 'Замечайте с благодарностью', body: 'Добавьте обновление или отметьте ответ, оставляя место и для результата, отличного от ожидаемого.' },
    ] },
    privacy: { eyebrow: 'Создано для личного', title: 'Ваша молитва — не пост, не запрос для ИИ и не текст уведомления.', body: 'Молитвенное пространство отделено от публичных разделов Vella. Оно сохраняет личную память и молитву с ясными границами для чувствительных слов.', points: ['Намерения и молитвы не публикуются в Ленте веры и не передаются другим людям', 'Текст никогда не отправляется ИИ для создания или толкования', 'Необязательные уведомления нейтральны и никогда не содержат личных слов', 'Намерение можно изменить или удалить в своём аккаунте'] },
    complements: { eyebrow: 'Часть большего ритма', title: 'Молитвенное пространство соединяет моменты, для которых Vella уже помогает находить время.', body: 'Оно не заменяет Писание, размышление, общину или мудрую помощь людей, а даёт им личное место стать вашим ответом.', items: [
      { title: 'Свет на каждый день', body: 'Перенесите стих и размышление дня в одну сосредоточенную минуту молитвы.' },
      { title: 'Писание и поиск', body: 'Возвращайтесь к проверенному библейскому тексту и контексту, не наделяя авторитетом сгенерированный ответ.' },
      { title: 'Духовные маршруты', body: 'Пусть многодневная тема питает молитву, а каждое намерение остаётся личным.' },
      { title: 'Заметки и избранное', body: 'Храните учебные наблюдения отдельно, оставляя здесь намерение, молитву и благодарность.' },
      { title: 'Уведомления по желанию', body: 'Получайте тихое приглашение только после включения — никогда не свои личные слова.' },
      { title: 'Сообщество с границами', body: 'Выбирайте общение отдельно; само Молитвенное пространство остаётся личным.' },
    ] },
    faq: { eyebrow: 'Ясные ответы', title: 'О приватности, Писании и ответе на молитву.', items: [
      { question: 'Молитвенное пространство публичное?', answer: 'Нет. Оно личное в вашем аккаунте. Намерения и молитвы не публикуются в Ленте веры и не передаются другим людям.' },
      { question: 'ИИ читает или пишет мою молитву?', answer: 'Нет. Vella не отправляет ИИ текст намерений или молитв и не создаёт молитву вашим голосом. Показанные места Писания поступают из проверенного и сохранённого библейского корпуса Vella.' },
      { question: 'Уведомление покажет написанный текст?', answer: 'Нет. Если включить уведомления, они используют нейтральное приглашение. Намерение и молитва там не появляются.' },
      { question: 'Что значит «Ответ получен»?', answer: 'Это ваша личная отметка, чтобы завершить намерение обновлением или благодарностью. Она не обещает определённого результата или срока.' },
      { question: 'Это заменяет пасторскую или психологическую помощь?', answer: 'Нет. Vella поддерживает духовное размышление, но не заменяет пасторскую, медицинскую, психологическую или экстренную помощь. В серьёзной или срочной ситуации обратитесь за квалифицированной помощью.' },
    ] },
    closing: { eyebrow: 'Более тихий следующий шаг', title: 'Дайте одной заботе место стать молитвой.', body: 'Начните искренне, оставайтесь рядом с Писанием и бережно храните память о том, что доверили Богу и как возвращались.', primaryCta: 'Прочитать руководство', secondaryCta: 'Посмотреть все возможности Vella' },
  },
  pl: {
    seoTitle: 'Prywatny dziennik modlitwy na prawdziwe życie',
    seoDescription: 'Zamień to, co nosisz w sercu, w prywatną modlitwę z zatwierdzonym fragmentem Pisma, skupioną chwilą modlitwy i łagodną historią wdzięczności.',
    eyebrow: 'Przestrzeń Modlitwy Vella',
    title: 'Pamiętaj o tym, co ważne.',
    accent: 'Módl się świadomie. Zauważaj zmiany.',
    body: 'Przestrzeń Modlitwy prowadzi spokojną, prywatną drogą od prawdziwej potrzeby do zatwierdzonego Pisma, modlitwy własnymi słowami i historii wdzięczności — bez zamieniania modlitwy w treść lub osiągnięcie.',
    primaryCta: 'Zobacz, jak to działa', articleCta: 'Przeczytaj praktyczny przewodnik', trustLine: 'Prywatność z założenia · Modlitwa pozostaje Twoja · Tekst nie trafia do AI ani powiadomień',
    preview: { title: 'Chwila Modlitwy', needLabel: 'To, co w sercu', need: 'Pokój na kolejny krok', scriptureLabel: 'Zatwierdzone Pismo', scripture: '„Wszelką troskę swoją złóżcie na Niego, gdyż On ma o was staranie.”', reference: '1 Piotra 5,7', prayerLabel: 'Twoja modlitwa', prayer: 'Pomóż mi oddać ten kolejny krok w Twoje ręce.', privateLabel: 'Prywatne na Twoim koncie', prayedLabel: 'Pomodliłem się', answeredLabel: 'Wysłuchana · wdzięczność' },
    promise: { eyebrow: 'Modlitwa bez presji', title: 'Miejsce na szczerość, nie na wrażenie.', body: 'Niektóre potrzeby są zbyt osobiste na publiczny kanał i zbyt ważne, by zginąć w pośpiechu. Nazwij jedną, pozostań przy niej i zachowaj historię tego, co się zmienia.', points: ['Zacznij od potrzeby, którą samodzielnie chcesz nazwać', 'Otrzymaj fragment z zatwierdzonego, zapisanego korpusu Biblii Vella', 'Napisz modlitwę samodzielnie — Vella nie mówi za Ciebie', 'Wróć, dodaj wdzięczność lub oznacz ją jako wysłuchaną'] },
    flow: { eyebrow: 'Skupiony rytm', title: 'Od tego, co niesiesz, do modlitwy, do której możesz wrócić.', body: 'Droga jest celowo prosta: daje dość struktury, by zacząć, a znaczenie, słowa i odpowiedź pozostawia w Twoich rękach.', steps: [
      { number: '01', title: 'Nazwij potrzebę', body: 'Wybierz to, co dziś prosi o modlitwę, bez konieczności opowiadania całej historii.' },
      { number: '02', title: 'Przyjmij zatwierdzone Pismo', body: 'Zatrzymaj się przy fragmencie z zatwierdzonego korpusu Biblii Vella, nigdy przy tekście wymyślonym przez AI.' },
      { number: '03', title: 'Módl się własnymi słowami', body: 'Napisz szczerą modlitwę — jedno zdanie albo kilka akapitów. Vella nie tworzy jej za Ciebie.' },
      { number: '04', title: 'Zaznacz tę chwilę', body: 'Dotknij „Pomodliłem się” i zachowaj intencję na kolejny spokojny powrót.' },
      { number: '05', title: 'Zauważaj z wdzięcznością', body: 'Dodaj aktualizację lub oznacz intencję jako wysłuchaną, także gdy odpowiedź jest inna od oczekiwanej.' },
    ] },
    privacy: { eyebrow: 'Prywatność z założenia', title: 'Twoja modlitwa nie jest postem, promptem ani podglądem powiadomienia.', body: 'Przestrzeń Modlitwy jest oddzielona od publicznych części Vella. Służy osobistej pamięci i modlitwie z jasnymi granicami dla wrażliwych słów.', points: ['Intencje i modlitwy nie są publikowane w Faith Feed ani udostępniane innym', 'Tekst nigdy nie jest wysyłany do AI w celu tworzenia lub interpretacji', 'Opcjonalne powiadomienia są neutralne i nigdy nie zawierają prywatnych słów', 'Intencję możesz zmienić lub usunąć na swoim koncie'] },
    complements: { eyebrow: 'Część większego rytmu', title: 'Przestrzeń Modlitwy łączy chwile, na które Vella już pomaga robić miejsce.', body: 'Nie zastępuje Pisma, refleksji, wspólnoty ani mądrej ludzkiej pomocy. Daje im prywatne miejsce, by stały się osobistą odpowiedzią.', items: [
      { title: 'Codzienne światło', body: 'Przenieś dzisiejszy fragment i refleksję do jednej skupionej Chwili Modlitwy.' },
      { title: 'Pismo i wyszukiwanie', body: 'Wracaj do zatwierdzonego tekstu Biblii i kontekstu, zamiast uznawać wygenerowaną odpowiedź za autorytet.' },
      { title: 'Prowadzone ścieżki', body: 'Niech kilkudniowy temat wspiera modlitwę, a każda intencja pozostanie osobista.' },
      { title: 'Notatki i ulubione', body: 'Zachowuj obserwacje ze studium osobno, a tutaj skup się na intencji, modlitwie i wdzięczności.' },
      { title: 'Opcjonalne powiadomienia', body: 'Otrzymuj ciche zaproszenie tylko po włączeniu — nigdy prywatne słowa.' },
      { title: 'Społeczność z granicami', body: 'Wybieraj wsparcie społeczności osobno; Przestrzeń Modlitwy pozostaje prywatna.' },
    ] },
    faq: { eyebrow: 'Jasne odpowiedzi', title: 'O prywatności, Piśmie i wysłuchanej modlitwie.', items: [
      { question: 'Czy Przestrzeń Modlitwy jest publiczna?', answer: 'Nie. Jest prywatna na Twoim koncie. Intencje i modlitwy nie są publikowane w Faith Feed ani udostępniane innym osobom.' },
      { question: 'Czy AI czyta lub pisze moją modlitwę?', answer: 'Nie. Vella nie wysyła do AI tekstu intencji ani modlitw i nie tworzy modlitwy Twoim głosem. Pokazane fragmenty pochodzą z zatwierdzonego, zapisanego korpusu Biblii Vella.' },
      { question: 'Czy powiadomienie pokaże mój tekst?', answer: 'Nie. Po włączeniu powiadomienia używają neutralnego zaproszenia. Twoja intencja i modlitwa nigdy się w nim nie pojawią.' },
      { question: 'Co oznacza „Wysłuchana”?', answer: 'To Twój osobisty znacznik zamknięcia intencji aktualizacją lub wdzięcznością. Nie obiecuje określonego rezultatu ani terminu.' },
      { question: 'Czy zastępuje pomoc duszpasterską lub psychologiczną?', answer: 'Nie. Vella wspiera refleksję duchową, lecz nie zastępuje pomocy duszpasterskiej, medycznej, psychologicznej ani ratunkowej. W poważnej lub pilnej sytuacji poszukaj wykwalifikowanej pomocy.' },
    ] },
    closing: { eyebrow: 'Spokojniejszy kolejny krok', title: 'Daj jednej trosce miejsce, w którym stanie się modlitwą.', body: 'Zacznij szczerze, pozostań blisko Pisma i zachowaj łagodną pamięć tego, co powierzasz Bogu i jak wracasz.', primaryCta: 'Przeczytaj przewodnik', secondaryCta: 'Poznaj wszystkie funkcje Vella' },
  },
} satisfies Record<Locale, PrayerSpaceContent>;

export function getPrayerSpaceCopy(locale: Locale): PrayerSpaceCopy {
  return { locale, ...prayerSpaceByLocale[locale] };
}

