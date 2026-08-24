import type { Locale } from './config';

export const PRAYER_SPACE_ARTICLE_SLUG = 'a-daily-prayer-space-for-real-life' as const;

export type PrayerSpaceArticleSection = {
  heading: string;
  paragraphs: string[];
  numberedPractices?: string[];
  reflectionPrompts?: string[];
};

export type PrayerSpaceArticleCta = {
  eyebrow: string;
  title: string;
  body: string;
  label: string;
  path: string;
};

export type PrayerSpaceArticleContent = {
  title: string;
  description: string;
  category: string;
  publishedAt: string;
  updatedAt: string;
  dateLabel: string;
  readTime: string;
  heroQuote: string;
  sections: PrayerSpaceArticleSection[];
  cta?: PrayerSpaceArticleCta;
};

export const prayerSpaceArticleByLocale = {
  en: {
    title: 'A daily Prayer Space for real life: from need to gratitude',
    description:
      'A private, Scripture-grounded rhythm for naming what you carry, writing your own prayer, and remembering how God met you over time.',
    category: 'Prayer',
    publishedAt: '2026-08-03',
    updatedAt: '2026-08-03',
    dateLabel: 'August 3, 2026',
    readTime: '10 min read',
    heroQuote:
      'Prayer does not need polished language. It needs an honest place to begin, a truth to stand on, and room to remember.',
    sections: [
      {
        heading: 'Prayer often begins before the words arrive',
        paragraphs: [
          'A concern can follow you through an ordinary day without ever becoming a clear prayer. It may appear as a name you keep remembering, a decision that will not settle, gratitude you do not want to lose, or a fear that feels too complicated to explain. When everything remains in your head, the concern is easily rehearsed but rarely held with intention. A dedicated Prayer Space creates a gentle threshold: stop, notice what is present, and bring that reality to God without pretending it is already resolved.',
          'The purpose is not to turn prayer into another productivity system. A useful space should reduce pressure, not create a score. It gives a simple shape to a deeply personal practice: name the need, receive a relevant passage of Scripture, write your own prayer, keep the intention private, and return later to remember what happened. Some entries may be brief. Others may accompany you for months. Both belong, because faithfulness is not measured by length, eloquence, or a perfect daily streak.',
        ],
      },
      {
        heading: 'Start by naming the need honestly',
        paragraphs: [
          'The first movement is deliberately small: give the concern a name. “Wisdom for this conversation,” “Mum’s appointment,” “Courage to begin again,” or “Thank you for today” is enough. A clear title does not force a conclusion; it simply separates this need from the swirl around it. Naming can also reveal that several different things are tangled together. You may discover a practical task, an emotion that needs compassion, and a request you want to place before God. They do not have to become one polished sentence.',
          'Honesty matters more than religious vocabulary. You can acknowledge anger, uncertainty, disappointment, hope, relief, or silence. The Prayer Space is private, so its value comes from giving you room to write what is true rather than what would sound impressive to someone else. If you cannot identify a request, begin with “This is what I am carrying.” If gratitude is the truest response, begin there. If the only honest words are “I do not know,” they can still open a sincere prayer.',
        ],
        reflectionPrompts: [
          'What keeps returning to my attention today?',
          'Am I bringing a request, a person, a decision, a lament, or gratitude?',
          'What would I say if I did not have to make these words sound spiritual?',
        ],
      },
      {
        heading: 'Let approved Scripture give the prayer a foundation',
        paragraphs: [
          'After you name the need, Prayer Space can retrieve a related passage from Vella’s approved, stored Scripture library. The words are drawn from that curated library; they are not authored, rewritten, or translated by artificial intelligence. That distinction protects the boundary between biblical text and generated commentary. Read the passage in context, notice what it actually says, and allow it to widen or correct the frame of your request. Scripture can offer language for trust, lament, courage, confession, patience, or praise without being reduced to a slogan.',
          'A related verse is not a prediction that events will unfold in the way you prefer. It is a companion for prayer and an invitation to attend to God’s character. You may follow the passage into Scripture search, read the surrounding verses, save it as a favorite, or add a note about what you noticed. If the connection feels incomplete, keep searching rather than forcing it. The goal is not to find a sentence that guarantees an answer; it is to let trustworthy words steady an honest conversation with God.',
        ],
      },
      {
        heading: 'Write the prayer that is actually yours',
        paragraphs: [
          'Prayer Space does not generate a prayer or place an AI chat between you and God. The words remain yours. You can respond to the passage, ask directly for help, confess what needs changing, name the good you hope for, or leave a few unfinished lines. Writing slowly can expose assumptions that fast thoughts conceal. It can also make room for a different request: not only “change this circumstance,” but “give me wisdom, love, endurance, and the courage to take the next faithful step within it.”',
          'Your prayer text and private intention stay private. There is no public post, group prayer wall, circle sharing, or automatic community distribution. The text is never sent to AI, and it is never copied into a notification. This is important because spiritual honesty requires a trustworthy container. You remain free to share something separately with a pastor, friend, or community when you choose, but using Prayer Space does not publish or forward what you wrote. Privacy is part of the practice, not a small setting hidden after the fact.',
        ],
      },
      {
        heading: 'Mark prayed, then remember without forcing an outcome',
        paragraphs: [
          'When you have paused with an intention, mark it as prayed. That small action is not a claim that the concern has ended; it records that you brought it before God today. Returning to pray again is not failure or needless repetition. Some prayers remain open through long seasons. The timeline can hold those repeated moments without demanding a dramatic update, helping you see that persistence itself may be part of the story.',
          'Later, you may mark an intention as answered and add gratitude. “Answered” does not have to mean that every request resolved exactly as hoped. Sometimes circumstances change; sometimes guidance becomes clearer; sometimes help arrives through another person; sometimes the honest update is grief, waiting, or a different kind of grace. The gratitude timeline is a place to remember faithfully, not to manufacture a testimony. It can preserve specific gifts while leaving unresolved pain unnamed as victory. Prayer makes room for hope and lament together.',
        ],
        reflectionPrompts: [
          'What has changed in the situation, in me, or in the help available to me?',
          'Is there a specific gift I want to remember without minimizing what is still difficult?',
          'Does this intention need another prayer, a practical action, wise counsel, or patient waiting?',
        ],
      },
      {
        heading: 'Connect one private rhythm with the rest of your journey',
        paragraphs: [
          'Prayer Space works best as one doorway within a wider spiritual rhythm. Daily Light can offer a quiet starting point before you name the day’s concern. Scripture and search can help you read beyond a retrieved passage. Journeys can provide a longer theme when a need cannot be held in a single session. Notes and favorites preserve insights you want to revisit. Optional notifications can invite you back at a time you choose, but they never include the private prayer text or disclose the intention on the lock screen.',
          'Community can still matter deeply without turning private prayers into content. A shared reflection, general encouragement, or conversation with trusted people can accompany the practice while the prayer itself stays yours. Vella does not post the prayer to a feed or expose it to groups or circles. This separation gives you agency: you decide what, if anything, becomes a conversation. The app can support attention and memory, while relationships provide listening, discernment, practical care, and the embodied companionship that a private tool cannot replace.',
        ],
      },
      {
        heading: 'A seven-minute rhythm you can return to',
        paragraphs: [
          'You do not need to complete every movement perfectly or use Prayer Space every day. Try this short rhythm when a need keeps resurfacing. Slow down enough to be truthful, but let the structure serve you rather than control you. On a crowded day, one sentence may be the whole prayer. On a spacious day, follow the Scripture into context, write more, or revisit an older intention. The durable habit is not producing an entry; it is learning how to return with attention.',
        ],
        numberedPractices: [
          'Arrive. Take one unhurried breath and notice what is happening in your body, thoughts, and surroundings. You do not need to become calm before beginning.',
          'Name. Give the need a simple, private title and describe what you are carrying without editing it for an audience.',
          'Receive. Read the retrieved passage from the approved Scripture library, then check its surrounding context and notice one phrase that meets you honestly.',
          'Respond. Write your own prayer. Ask, lament, confess, thank, or remain with a question; no generated language is required.',
          'Entrust. Mark the intention as prayed and choose one wise next step if action is needed.',
          'Remember. Return later to pray again, record an answer, or add gratitude without claiming that every story ended as you wished.',
        ],
      },
      {
        heading: 'Know what a prayer app cannot carry',
        paragraphs: [
          'Prayer Space is a spiritual reflection tool, not a substitute for a pastor, a trusted community, medical or mental-health care, safeguarding help, or crisis support. Some needs require another person who can listen, assess risk, and act with you. If you are in danger, experiencing abuse, thinking about harming yourself or someone else, or facing a medical emergency, contact local emergency or crisis services now and reach a trusted person nearby. You do not need to keep an urgent situation inside a private journal.',
          'Used within those boundaries, a private prayer record can do something quietly valuable. It can help you notice what you are carrying, return to approved Scripture, speak in your own voice, and remember both waiting and gratitude with integrity. It does not promise control over outcomes. It offers a faithful place for attention. Over time, that simple sequence can reveal not a flawless story, but a real one: needs named, prayers offered, help received, questions carried, and grace remembered.',
        ],
      },
    ],
    cta: {
      eyebrow: 'A private rhythm',
      title: 'Meet Vella’s Prayer Space',
      body: 'Name what you carry, receive approved Scripture, write your own private prayer, and return to a timeline of prayer and gratitude.',
      label: 'Explore Prayer Space',
      path: '/features/prayer-space',
    },
  },
  pt: {
    title: 'Um Espaço de Oração diário para a vida real: da necessidade à gratidão',
    description:
      'Um ritmo privado, firmado nas Escrituras, para nomear o que você carrega, escrever sua própria oração e recordar como Deus o encontrou ao longo do tempo.',
    category: 'Oração',
    publishedAt: '2026-08-03',
    updatedAt: '2026-08-03',
    dateLabel: '3 de agosto de 2026',
    readTime: '10 min de leitura',
    heroQuote:
      'A oração não precisa de palavras perfeitas. Precisa de um lugar honesto para começar, uma verdade onde se apoiar e espaço para recordar.',
    sections: [
      {
        heading: 'A oração muitas vezes começa antes de as palavras chegarem',
        paragraphs: [
          'Uma preocupação pode acompanhar você durante um dia comum sem nunca se transformar em uma oração clara. Talvez seja um nome que sempre volta à memória, uma decisão que não se resolve, uma gratidão que você não quer perder ou um medo complicado demais para explicar. Quando tudo permanece na cabeça, a preocupação é repetida muitas vezes, mas raramente é acolhida com intenção. Um Espaço de Oração dedicado cria uma passagem gentil: parar, perceber o que está presente e levar essa realidade a Deus sem fingir que ela já foi resolvida.',
          'A proposta não é transformar a oração em mais um sistema de produtividade. Um espaço útil deve aliviar a pressão, não criar uma pontuação. Ele dá uma forma simples a uma prática profundamente pessoal: nomear a necessidade, receber uma passagem bíblica relacionada, escrever sua própria oração, manter a intenção privada e voltar mais tarde para recordar o que aconteceu. Algumas entradas serão breves; outras poderão acompanhar você por meses. Ambas pertencem a esse lugar, porque fidelidade não se mede por tamanho, eloquência ou uma sequência diária perfeita.',
        ],
      },
      {
        heading: 'Comece nomeando a necessidade com honestidade',
        paragraphs: [
          'O primeiro movimento é propositalmente pequeno: dê um nome ao que preocupa você. “Sabedoria para esta conversa”, “Consulta da minha mãe”, “Coragem para recomeçar” ou “Obrigado por hoje” já basta. Um título claro não força uma conclusão; apenas separa essa necessidade do turbilhão ao redor. Nomear também pode revelar que coisas diferentes estão misturadas. Talvez exista uma tarefa prática, uma emoção que precisa de compaixão e um pedido que você deseja colocar diante de Deus. Nada disso precisa virar uma frase bonita.',
          'A honestidade importa mais do que um vocabulário religioso. Você pode reconhecer raiva, incerteza, decepção, esperança, alívio ou silêncio. Como o Espaço de Oração é privado, seu valor está em oferecer liberdade para escrever o que é verdadeiro, e não o que impressionaria outra pessoa. Se você não consegue identificar um pedido, comece com “É isto que estou carregando”. Se a gratidão for a resposta mais verdadeira, comece por ela. Se as únicas palavras honestas forem “Eu não sei”, elas ainda podem abrir uma oração sincera.',
        ],
        reflectionPrompts: [
          'O que continua voltando à minha atenção hoje?',
          'Estou trazendo um pedido, uma pessoa, uma decisão, um lamento ou gratidão?',
          'O que eu diria se não precisasse fazer estas palavras parecerem espirituais?',
        ],
      },
      {
        heading: 'Deixe uma Escritura aprovada dar fundamento à oração',
        paragraphs: [
          'Depois de nomear a necessidade, o Espaço de Oração pode buscar uma passagem relacionada na biblioteca de Escrituras aprovada e armazenada pela Vella. As palavras vêm dessa biblioteca cuidadosamente selecionada; não são escritas, reescritas nem traduzidas por inteligência artificial. Essa distinção protege o limite entre o texto bíblico e um comentário gerado. Leia a passagem em seu contexto, observe o que ela realmente diz e permita que amplie ou corrija a perspectiva do seu pedido. A Escritura oferece linguagem para confiança, lamento, coragem, confissão, paciência e louvor sem ser reduzida a um slogan.',
          'Um versículo relacionado não é uma previsão de que os acontecimentos seguirão a sua preferência. É companhia para a oração e um convite a prestar atenção no caráter de Deus. Você pode seguir a passagem na busca bíblica, ler os versículos ao redor, salvá-la como favorita ou acrescentar uma nota sobre o que percebeu. Se a relação parecer incompleta, continue buscando em vez de forçá-la. A meta não é encontrar uma frase que garanta uma resposta, mas permitir que palavras confiáveis deem firmeza a uma conversa honesta com Deus.',
        ],
      },
      {
        heading: 'Escreva a oração que é verdadeiramente sua',
        paragraphs: [
          'O Espaço de Oração não gera uma oração nem coloca uma conversa com inteligência artificial entre você e Deus. As palavras continuam sendo suas. Você pode responder à passagem, pedir ajuda diretamente, confessar o que precisa mudar, nomear o bem que espera ou deixar algumas linhas inacabadas. Escrever devagar pode revelar pressupostos escondidos por pensamentos rápidos. Também pode abrir espaço para outro pedido: não apenas “mude esta circunstância”, mas “dê-me sabedoria, amor, perseverança e coragem para dar o próximo passo fiel dentro dela”.',
          'O texto da oração e a intenção particular permanecem privados. Não existe publicação, mural coletivo de oração, compartilhamento em grupo ou círculo, nem distribuição automática à comunidade. O texto nunca é enviado para inteligência artificial e nunca aparece copiado em uma notificação. Isso importa porque a honestidade espiritual precisa de um recipiente confiável. Você continua livre para compartilhar algo separadamente com um pastor, amigo ou comunidade quando decidir, mas usar o Espaço de Oração não publica nem encaminha o que você escreveu. A privacidade faz parte da prática desde o início.',
        ],
      },
      {
        heading: 'Marque como orado e recorde sem forçar um desfecho',
        paragraphs: [
          'Quando você tiver dedicado um momento a uma intenção, marque-a como orada. Esse gesto pequeno não afirma que a preocupação terminou; registra que hoje você a levou diante de Deus. Voltar a orar não é fracasso nem repetição inútil. Algumas orações permanecem abertas durante longas fases. A linha do tempo pode guardar esses encontros sucessivos sem exigir uma atualização dramática, ajudando você a perceber que a perseverança também pode fazer parte da história.',
          'Mais tarde, você pode marcar uma intenção como respondida e acrescentar gratidão. “Respondida” não precisa significar que tudo se resolveu exatamente como você esperava. Às vezes as circunstâncias mudam; às vezes a orientação fica mais clara; às vezes a ajuda chega por outra pessoa; e às vezes a atualização honesta é luto, espera ou uma graça diferente. A linha do tempo de gratidão serve para recordar com fidelidade, não para fabricar um testemunho. Ela preserva dádivas específicas sem chamar uma dor ainda aberta de vitória. Oração comporta esperança e lamento juntos.',
        ],
        reflectionPrompts: [
          'O que mudou na situação, em mim ou na ajuda disponível?',
          'Existe uma dádiva específica que quero lembrar sem diminuir o que ainda é difícil?',
          'Esta intenção precisa de outra oração, uma ação prática, conselho sábio ou espera paciente?',
        ],
      },
      {
        heading: 'Conecte um ritmo privado ao restante da sua jornada',
        paragraphs: [
          'O Espaço de Oração funciona melhor como uma porta dentro de um ritmo espiritual mais amplo. A Luz Diária pode oferecer um começo sereno antes de você nomear a preocupação do dia. Escrituras e busca ajudam a ler além da passagem sugerida. Jornadas fornecem um tema mais longo quando uma necessidade não cabe em uma única sessão. Notas e favoritos preservam descobertas que você deseja revisitar. Notificações opcionais podem convidar você a voltar no horário escolhido, mas nunca incluem o texto privado da oração nem revelam a intenção na tela bloqueada.',
          'A comunidade ainda pode ser muito importante sem transformar orações privadas em conteúdo. Uma reflexão compartilhada, um encorajamento geral ou uma conversa com pessoas confiáveis pode acompanhar a prática enquanto a oração permanece sua. A Vella não publica a oração em um feed nem a expõe a grupos ou círculos. Essa separação preserva sua autonomia: você decide se algo se torna conversa. O aplicativo pode apoiar atenção e memória; os relacionamentos oferecem escuta, discernimento, cuidado prático e a companhia concreta que uma ferramenta privada não substitui.',
        ],
      },
      {
        heading: 'Um ritmo de sete minutos ao qual você pode voltar',
        paragraphs: [
          'Você não precisa completar cada movimento perfeitamente nem usar o Espaço de Oração todos os dias. Experimente este ritmo curto quando uma necessidade insistir em voltar. Diminua a velocidade o bastante para ser verdadeiro, mas deixe a estrutura servir você, e não controlar você. Em um dia cheio, uma frase pode ser toda a oração. Em um dia espaçoso, siga a Escritura em seu contexto, escreva mais ou reveja uma intenção antiga. O hábito duradouro não é produzir uma entrada; é aprender a voltar com atenção.',
        ],
        numberedPractices: [
          'Chegue. Respire sem pressa e perceba o que acontece no corpo, nos pensamentos e ao redor. Você não precisa se acalmar antes de começar.',
          'Nomeie. Dê à necessidade um título simples e privado e descreva o que está carregando sem editar para uma plateia.',
          'Receba. Leia a passagem recuperada da biblioteca bíblica aprovada, confira o contexto ao redor e observe uma frase que encontre você com honestidade.',
          'Responda. Escreva sua própria oração. Peça, lamente, confesse, agradeça ou permaneça com uma pergunta; nenhuma linguagem gerada é necessária.',
          'Confie. Marque a intenção como orada e escolha um próximo passo sábio se alguma ação for necessária.',
          'Recorde. Volte depois para orar novamente, registrar uma resposta ou acrescentar gratidão sem afirmar que toda história terminou como você desejava.',
        ],
      },
      {
        heading: 'Reconheça o que um aplicativo de oração não pode carregar',
        paragraphs: [
          'O Espaço de Oração é uma ferramenta de reflexão espiritual, não um substituto para pastor, comunidade de confiança, atendimento médico ou psicológico, proteção contra violência nem apoio em crises. Algumas necessidades exigem outra pessoa capaz de ouvir, avaliar riscos e agir com você. Se você estiver em perigo, sofrendo abuso, pensando em ferir a si mesmo ou outra pessoa, ou enfrentando uma emergência médica, procure agora os serviços locais de emergência ou crise e alguém confiável que esteja perto. Você não precisa manter uma situação urgente dentro de um diário privado.',
          'Dentro desses limites, um registro particular de oração pode fazer algo discretamente valioso. Ele ajuda você a perceber o que carrega, voltar a uma Escritura aprovada, falar com sua própria voz e recordar tanto a espera quanto a gratidão com integridade. Não promete controle sobre os resultados. Oferece um lugar fiel para a atenção. Com o tempo, essa sequência simples revela não uma história perfeita, mas uma história real: necessidades nomeadas, orações oferecidas, ajuda recebida, perguntas sustentadas e graça recordada.',
        ],
      },
    ],
    cta: {
      eyebrow: 'Um ritmo privado',
      title: 'Conheça o Espaço de Oração da Vella',
      body: 'Nomeie o que você carrega, receba uma Escritura aprovada, escreva sua própria oração privada e volte a uma linha do tempo de oração e gratidão.',
      label: 'Explorar o Espaço de Oração',
      path: '/features/prayer-space',
    },
  },
  es: {
    title: 'Un Espacio de Oración diario para la vida real: de la necesidad a la gratitud',
    description:
      'Un ritmo privado, arraigado en las Escrituras, para nombrar lo que llevas, escribir tu propia oración y recordar cómo Dios te encontró a lo largo del tiempo.',
    category: 'Oración',
    publishedAt: '2026-08-03',
    updatedAt: '2026-08-03',
    dateLabel: '3 de agosto de 2026',
    readTime: '10 min de lectura',
    heroQuote:
      'La oración no necesita palabras perfectas. Necesita un lugar honesto donde comenzar, una verdad donde apoyarse y espacio para recordar.',
    sections: [
      {
        heading: 'La oración suele comenzar antes de que lleguen las palabras',
        paragraphs: [
          'Una preocupación puede acompañarte durante un día corriente sin llegar nunca a convertirse en una oración clara. Quizá sea un nombre que vuelve a tu memoria, una decisión que no se asienta, una gratitud que no quieres perder o un temor demasiado complejo para explicar. Cuando todo permanece en la cabeza, la preocupación se repite con facilidad, pero pocas veces se sostiene con intención. Un Espacio de Oración dedicado crea un umbral amable: detenerte, reconocer lo que está presente y llevar esa realidad ante Dios sin fingir que ya está resuelta.',
          'El propósito no es convertir la oración en otro sistema de productividad. Un espacio útil debe aliviar la presión, no crear una puntuación. Da una forma sencilla a una práctica profundamente personal: nombrar la necesidad, recibir un pasaje bíblico relacionado, escribir tu propia oración, mantener privada la intención y volver después para recordar lo ocurrido. Algunas entradas serán breves; otras podrán acompañarte durante meses. Ambas tienen cabida, porque la fidelidad no se mide por la extensión, la elocuencia ni una racha diaria perfecta.',
        ],
      },
      {
        heading: 'Empieza nombrando la necesidad con honestidad',
        paragraphs: [
          'El primer movimiento es deliberadamente pequeño: ponle nombre a la inquietud. “Sabiduría para esta conversación”, “La cita médica de mamá”, “Valor para empezar de nuevo” o “Gracias por hoy” es suficiente. Un título claro no obliga a una conclusión; simplemente separa esa necesidad del remolino que la rodea. Nombrar también puede mostrar que varias cosas están enredadas: una tarea práctica, una emoción que necesita compasión y una petición que deseas presentar a Dios. No tienen que convertirse en una frase pulida.',
          'La honestidad importa más que el vocabulario religioso. Puedes reconocer enojo, incertidumbre, decepción, esperanza, alivio o silencio. Como el Espacio de Oración es privado, su valor está en darte libertad para escribir lo verdadero y no lo que impresionaría a otra persona. Si no logras identificar una petición, empieza con “Esto es lo que llevo”. Si la gratitud es la respuesta más sincera, comienza allí. Si las únicas palabras honestas son “No lo sé”, todavía pueden abrir una oración sincera.',
        ],
        reflectionPrompts: [
          '¿Qué sigue reclamando mi atención hoy?',
          '¿Traigo una petición, una persona, una decisión, un lamento o gratitud?',
          '¿Qué diría si no tuviera que hacer que estas palabras sonaran espirituales?',
        ],
      },
      {
        heading: 'Deja que una Escritura aprobada dé fundamento a la oración',
        paragraphs: [
          'Después de nombrar la necesidad, el Espacio de Oración puede recuperar un pasaje relacionado de la biblioteca de Escrituras aprobada y almacenada por Vella. Las palabras proceden de esa biblioteca seleccionada; la inteligencia artificial no las escribe, reescribe ni traduce. Esta distinción protege el límite entre el texto bíblico y el comentario generado. Lee el pasaje en contexto, observa lo que realmente dice y permite que amplíe o corrija el enfoque de tu petición. La Escritura ofrece lenguaje para confianza, lamento, valentía, confesión, paciencia y alabanza sin reducirse a un eslogan.',
          'Un versículo relacionado no predice que los acontecimientos se desarrollarán como prefieres. Es compañía para la oración y una invitación a atender al carácter de Dios. Puedes seguir el pasaje en la búsqueda bíblica, leer los versículos cercanos, guardarlo como favorito o añadir una nota sobre lo que observaste. Si la relación parece incompleta, sigue buscando en lugar de forzarla. La meta no es hallar una frase que garantice una respuesta, sino dejar que palabras fiables den estabilidad a una conversación honesta con Dios.',
        ],
      },
      {
        heading: 'Escribe la oración que de verdad es tuya',
        paragraphs: [
          'El Espacio de Oración no genera una oración ni coloca un chat de inteligencia artificial entre Dios y tú. Las palabras siguen siendo tuyas. Puedes responder al pasaje, pedir ayuda directamente, confesar lo que necesita cambiar, nombrar el bien que esperas o dejar unas líneas sin terminar. Escribir despacio puede revelar suposiciones que los pensamientos rápidos ocultan. También abre lugar para una petición distinta: no solo “cambia esta circunstancia”, sino “dame sabiduría, amor, perseverancia y valor para dar el siguiente paso fiel dentro de ella”.',
          'El texto de tu oración y la intención privada permanecen privados. No hay publicación pública, muro colectivo de oración, intercambio en grupo o círculo, ni distribución automática a la comunidad. El texto nunca se envía a una inteligencia artificial y nunca se copia en una notificación. Esto importa porque la honestidad espiritual necesita un recipiente fiable. Puedes compartir algo por separado con un pastor, amigo o comunidad cuando lo decidas, pero usar el Espacio de Oración no publica ni reenvía lo escrito. La privacidad forma parte de la práctica desde el principio.',
        ],
      },
      {
        heading: 'Marca que has orado y recuerda sin forzar un desenlace',
        paragraphs: [
          'Cuando hayas dedicado un momento a una intención, márcala como orada. Ese pequeño gesto no afirma que la preocupación haya terminado; registra que hoy la presentaste ante Dios. Volver a orar no es un fracaso ni una repetición innecesaria. Algunas oraciones quedan abiertas durante temporadas largas. La línea de tiempo puede guardar esos momentos repetidos sin exigir una actualización espectacular y ayudarte a ver que la perseverancia también puede formar parte de la historia.',
          'Más adelante puedes marcar una intención como respondida y añadir gratitud. “Respondida” no tiene que significar que todo se resolvió exactamente como esperabas. A veces cambian las circunstancias; a veces la orientación se vuelve más clara; a veces la ayuda llega mediante otra persona; y a veces la actualización honesta es duelo, espera u otra clase de gracia. La línea de gratitud es un lugar para recordar con fidelidad, no para fabricar un testimonio. Conserva dones concretos sin llamar victoria al dolor aún abierto. La oración deja convivir esperanza y lamento.',
        ],
        reflectionPrompts: [
          '¿Qué ha cambiado en la situación, en mí o en la ayuda disponible?',
          '¿Hay un regalo concreto que quiero recordar sin minimizar lo que sigue siendo difícil?',
          '¿Esta intención necesita otra oración, una acción práctica, consejo sabio o espera paciente?',
        ],
      },
      {
        heading: 'Conecta un ritmo privado con el resto de tu camino',
        paragraphs: [
          'El Espacio de Oración funciona mejor como una puerta dentro de un ritmo espiritual más amplio. Luz Diaria puede ofrecer un comienzo tranquilo antes de nombrar la preocupación del día. Escrituras y búsqueda ayudan a leer más allá del pasaje sugerido. Los recorridos ofrecen un tema prolongado cuando una necesidad no cabe en una sola sesión. Notas y favoritos conservan ideas que deseas visitar de nuevo. Las notificaciones opcionales pueden invitarte a regresar a la hora elegida, pero jamás incluyen el texto privado de la oración ni revelan la intención en la pantalla bloqueada.',
          'La comunidad todavía puede importar profundamente sin convertir las oraciones privadas en contenido. Una reflexión compartida, un ánimo general o una conversación con personas de confianza pueden acompañar la práctica mientras la oración sigue siendo tuya. Vella no publica la oración en un feed ni la expone a grupos o círculos. Esa separación protege tu capacidad de decidir qué se convierte en conversación. La aplicación apoya atención y memoria; las relaciones aportan escucha, discernimiento, cuidado práctico y la compañía encarnada que ninguna herramienta privada puede reemplazar.',
        ],
      },
      {
        heading: 'Un ritmo de siete minutos al que puedes volver',
        paragraphs: [
          'No necesitas completar cada movimiento a la perfección ni utilizar el Espacio de Oración todos los días. Prueba este ritmo breve cuando una necesidad reaparezca. Ve lo bastante despacio como para ser sincero, pero deja que la estructura te sirva en vez de dominarte. En un día lleno, una sola frase puede ser toda la oración. En un día amplio, sigue la Escritura dentro de su contexto, escribe más o revisa una intención anterior. El hábito duradero no consiste en producir una entrada, sino en aprender a volver con atención.',
        ],
        numberedPractices: [
          'Llega. Respira sin prisa y observa lo que ocurre en tu cuerpo, tus pensamientos y tu entorno. No tienes que calmarte antes de empezar.',
          'Nombra. Da a la necesidad un título sencillo y privado, y describe lo que llevas sin editarlo para un público.',
          'Recibe. Lee el pasaje recuperado de la biblioteca bíblica aprobada, revisa su contexto cercano y observa una frase que te encuentre con honestidad.',
          'Responde. Escribe tu propia oración. Pide, lamenta, confiesa, agradece o permanece con una pregunta; no necesitas lenguaje generado.',
          'Confía. Marca la intención como orada y elige un siguiente paso prudente si hace falta actuar.',
          'Recuerda. Regresa después para volver a orar, registrar una respuesta o añadir gratitud sin afirmar que toda historia acabó como deseabas.',
        ],
      },
      {
        heading: 'Reconoce lo que una aplicación de oración no puede sostener',
        paragraphs: [
          'El Espacio de Oración es una herramienta de reflexión espiritual, no sustituye a un pastor, una comunidad de confianza, la atención médica o de salud mental, la protección ante abusos ni el apoyo en una crisis. Algunas necesidades requieren a otra persona capaz de escuchar, evaluar riesgos y actuar contigo. Si estás en peligro, sufres abuso, piensas hacerte daño o dañar a alguien, o afrontas una emergencia médica, contacta ahora con los servicios locales de emergencia o crisis y con una persona cercana de confianza. No tienes que encerrar una situación urgente dentro de un diario privado.',
          'Dentro de esos límites, un registro privado de oración puede hacer algo discretamente valioso. Puede ayudarte a reconocer lo que llevas, volver a una Escritura aprobada, hablar con tu propia voz y recordar con integridad tanto la espera como la gratitud. No promete controlar los resultados. Ofrece un lugar fiel para prestar atención. Con el tiempo, esa secuencia sencilla revela no una historia impecable, sino una historia real: necesidades nombradas, oraciones ofrecidas, ayuda recibida, preguntas sostenidas y gracia recordada.',
        ],
      },
    ],
    cta: {
      eyebrow: 'Un ritmo privado',
      title: 'Conoce el Espacio de Oración de Vella',
      body: 'Nombra lo que llevas, recibe una Escritura aprobada, escribe tu propia oración privada y regresa a una línea de oración y gratitud.',
      label: 'Explorar el Espacio de Oración',
      path: '/features/prayer-space',
    },
  },
  fr: {
    title: 'Un Espace de prière quotidien pour la vie réelle : du besoin à la gratitude',
    description:
      'Un rythme privé, enraciné dans les Écritures, pour nommer ce que vous portez, écrire votre propre prière et vous souvenir de la présence de Dieu au fil du temps.',
    category: 'Prière',
    publishedAt: '2026-08-03',
    updatedAt: '2026-08-03',
    dateLabel: '3 août 2026',
    readTime: '10 min de lecture',
    heroQuote:
      'La prière n’exige pas des mots parfaits. Elle demande un point de départ sincère, une vérité où s’appuyer et un espace pour se souvenir.',
    sections: [
      {
        heading: 'La prière commence souvent avant que les mots arrivent',
        paragraphs: [
          'Une préoccupation peut vous accompagner pendant une journée ordinaire sans jamais devenir une prière claire. Ce peut être un nom qui revient à votre mémoire, une décision qui ne s’apaise pas, une gratitude que vous ne voulez pas perdre ou une peur trop complexe à expliquer. Tant que tout reste dans votre tête, l’inquiétude se répète facilement mais elle est rarement portée avec intention. Un Espace de prière dédié crée un seuil bienveillant : s’arrêter, reconnaître ce qui est là et présenter cette réalité à Dieu sans prétendre qu’elle est déjà résolue.',
          'Le but n’est pas de transformer la prière en un nouveau système de productivité. Un espace utile doit alléger la pression, pas créer un score. Il donne une forme simple à une pratique profondément personnelle : nommer le besoin, recevoir un passage biblique pertinent, écrire votre propre prière, garder l’intention privée, puis revenir plus tard pour vous souvenir. Certaines entrées seront brèves ; d’autres pourront vous accompagner pendant des mois. Toutes ont leur place, car la fidélité ne se mesure ni à la longueur, ni à l’éloquence, ni à une série quotidienne parfaite.',
        ],
      },
      {
        heading: 'Commencez par nommer le besoin avec sincérité',
        paragraphs: [
          'Le premier mouvement est volontairement modeste : donnez un nom à la préoccupation. « Sagesse pour cette conversation », « Le rendez-vous de maman », « Courage de recommencer » ou « Merci pour aujourd’hui » suffit. Un titre clair ne force pas une conclusion ; il distingue simplement ce besoin du tourbillon environnant. Nommer peut aussi révéler plusieurs choses entremêlées : une tâche concrète, une émotion qui demande de la compassion et une requête à déposer devant Dieu. Elles n’ont pas besoin de devenir une phrase parfaitement formulée.',
          'La sincérité compte davantage que le vocabulaire religieux. Vous pouvez reconnaître la colère, l’incertitude, la déception, l’espérance, le soulagement ou le silence. Parce que l’Espace de prière est privé, sa valeur tient à la liberté d’écrire ce qui est vrai plutôt que ce qui impressionnerait quelqu’un. Si vous ne trouvez pas de demande précise, commencez par « Voilà ce que je porte ». Si la gratitude est la réponse la plus juste, commencez par elle. Si vos seuls mots sincères sont « Je ne sais pas », ils peuvent tout de même ouvrir une véritable prière.',
        ],
        reflectionPrompts: [
          'Qu’est-ce qui revient sans cesse à mon attention aujourd’hui ?',
          'Est-ce que j’apporte une demande, une personne, une décision, une plainte ou de la gratitude ?',
          'Que dirais-je si je n’avais pas à donner à ces mots une apparence spirituelle ?',
        ],
      },
      {
        heading: 'Laissez une Écriture approuvée fonder la prière',
        paragraphs: [
          'Après avoir nommé le besoin, l’Espace de prière peut retrouver un passage correspondant dans la bibliothèque d’Écritures approuvée et stockée par Vella. Les mots proviennent de cette bibliothèque soigneusement choisie ; ils ne sont ni écrits, ni reformulés, ni traduits par une intelligence artificielle. Cette distinction protège la frontière entre le texte biblique et un commentaire généré. Lisez le passage dans son contexte, observez ce qu’il dit vraiment et laissez-le élargir ou corriger votre requête. L’Écriture offre des mots pour la confiance, la plainte, le courage, la confession, la patience et la louange sans devenir un slogan.',
          'Un verset associé ne prédit pas que les événements suivront vos préférences. Il accompagne la prière et invite à considérer le caractère de Dieu. Vous pouvez poursuivre le passage dans la recherche biblique, lire les versets voisins, l’enregistrer dans vos favoris ou ajouter une note sur ce que vous avez remarqué. Si le lien paraît incomplet, continuez à chercher au lieu de le forcer. Le but n’est pas de trouver une phrase garantissant une réponse, mais de laisser des paroles dignes de confiance stabiliser une conversation sincère avec Dieu.',
        ],
      },
      {
        heading: 'Écrivez la prière qui vous appartient vraiment',
        paragraphs: [
          'L’Espace de prière ne génère pas de prière et ne place pas une conversation avec l’intelligence artificielle entre Dieu et vous. Les mots restent les vôtres. Vous pouvez répondre au passage, demander directement de l’aide, confesser ce qui doit changer, nommer le bien espéré ou laisser quelques lignes inachevées. Écrire lentement peut révéler les suppositions que des pensées rapides cachent. Cela ouvre aussi une autre demande : pas seulement « change cette situation », mais « donne-moi la sagesse, l’amour, l’endurance et le courage d’accomplir le prochain pas fidèle au cœur de cette situation ».',
          'Le texte de votre prière et l’intention personnelle restent privés. Il n’existe aucune publication publique, aucun mur collectif de prières, aucun partage avec un groupe ou un cercle, ni aucune diffusion automatique à la communauté. Le texte n’est jamais envoyé à une intelligence artificielle et n’est jamais repris dans une notification. C’est essentiel, car la sincérité spirituelle réclame un cadre fiable. Vous pouvez partager séparément quelque chose avec un pasteur, un ami ou une communauté si vous le décidez, mais utiliser l’Espace de prière ne publie ni ne transmet vos mots. La confidentialité appartient à la pratique elle-même.',
        ],
      },
      {
        heading: 'Indiquez que vous avez prié, puis souvenez-vous sans imposer une issue',
        paragraphs: [
          'Après avoir consacré un moment à une intention, marquez-la comme priée. Ce petit geste ne prétend pas que la préoccupation a pris fin ; il consigne que vous l’avez présentée à Dieu aujourd’hui. Revenir prier n’est ni un échec ni une répétition inutile. Certaines prières demeurent ouvertes pendant de longues saisons. La chronologie peut accueillir ces moments répétés sans exiger une évolution spectaculaire et vous aider à reconnaître que la persévérance fait elle aussi partie de l’histoire.',
          'Plus tard, vous pouvez indiquer qu’une intention a reçu une réponse et ajouter votre gratitude. « Répondue » ne signifie pas forcément que tout s’est déroulé comme vous l’espériez. Parfois les circonstances changent ; parfois une direction apparaît ; parfois l’aide vient d’une autre personne ; parfois la mise à jour sincère est le deuil, l’attente ou une grâce différente. La chronologie de gratitude sert à se souvenir fidèlement, non à fabriquer un témoignage. Elle conserve des dons précis sans appeler victoire une douleur encore ouverte. La prière accueille ensemble l’espérance et la plainte.',
        ],
        reflectionPrompts: [
          'Qu’est-ce qui a changé dans la situation, en moi ou dans l’aide disponible ?',
          'Y a-t-il un don précis dont je veux me souvenir sans minimiser ce qui reste difficile ?',
          'Cette intention appelle-t-elle une autre prière, une action concrète, un conseil sage ou une attente patiente ?',
        ],
      },
      {
        heading: 'Reliez un rythme privé au reste de votre cheminement',
        paragraphs: [
          'L’Espace de prière fonctionne au mieux comme une porte au sein d’un rythme spirituel plus large. Lumière quotidienne peut offrir un commencement paisible avant de nommer la préoccupation du jour. Les Écritures et la recherche permettent de lire au-delà du passage proposé. Les parcours développent un thème quand un besoin dépasse une seule séance. Notes et favoris gardent les découvertes à revisiter. Des notifications facultatives peuvent vous inviter à revenir à l’heure choisie, mais elles ne contiennent jamais le texte privé de la prière et ne révèlent pas l’intention sur l’écran verrouillé.',
          'La communauté peut rester profondément importante sans transformer des prières privées en contenu. Une réflexion partagée, un encouragement général ou une conversation avec des personnes de confiance peuvent accompagner la pratique tandis que la prière reste la vôtre. Vella ne publie pas la prière dans un fil et ne l’expose ni aux groupes ni aux cercles. Cette séparation préserve votre choix : vous décidez ce qui devient éventuellement une conversation. L’application soutient l’attention et la mémoire ; les relations apportent écoute, discernement, aide concrète et cette présence incarnée qu’aucun outil privé ne remplace.',
        ],
      },
      {
        heading: 'Un rythme de sept minutes auquel revenir',
        paragraphs: [
          'Vous n’avez pas à accomplir parfaitement chaque mouvement ni à utiliser l’Espace de prière tous les jours. Essayez ce rythme bref lorsqu’un besoin revient. Ralentissez assez pour être sincère, tout en laissant la structure vous servir plutôt que vous commander. Un jour chargé, une phrase peut constituer toute la prière. Un jour plus libre, suivez l’Écriture dans son contexte, écrivez davantage ou reprenez une ancienne intention. L’habitude durable n’est pas de produire une entrée ; elle consiste à apprendre à revenir avec attention.',
        ],
        numberedPractices: [
          'Arrivez. Prenez une respiration tranquille et remarquez votre corps, vos pensées et ce qui vous entoure. Vous n’avez pas à vous calmer avant de commencer.',
          'Nommez. Donnez au besoin un titre simple et privé, puis décrivez ce que vous portez sans l’adapter à un public.',
          'Recevez. Lisez le passage retrouvé dans la bibliothèque biblique approuvée, vérifiez son contexte proche et relevez une phrase qui vous rejoint avec justesse.',
          'Répondez. Écrivez votre propre prière. Demandez, plaignez-vous, confessez, remerciez ou restez avec une question ; aucun langage généré n’est nécessaire.',
          'Confiez. Marquez l’intention comme priée et choisissez une prochaine étape sage si une action est nécessaire.',
          'Souvenez-vous. Revenez plus tard pour prier encore, consigner une réponse ou ajouter de la gratitude sans affirmer que toute histoire s’est terminée comme vous le souhaitiez.',
        ],
      },
      {
        heading: 'Reconnaissez ce qu’une application de prière ne peut pas porter',
        paragraphs: [
          'L’Espace de prière est un outil de réflexion spirituelle, pas un remplacement pour un pasteur, une communauté fiable, des soins médicaux ou psychologiques, une protection face aux violences ou un soutien de crise. Certains besoins exigent une personne capable d’écouter, d’évaluer le danger et d’agir avec vous. Si vous êtes en danger, subissez des violences, envisagez de vous blesser ou de blesser quelqu’un, ou vivez une urgence médicale, contactez immédiatement les services locaux d’urgence ou de crise et une personne de confiance proche de vous. Vous n’avez pas à enfermer une situation urgente dans un journal privé.',
          'Dans ces limites, un journal de prière privé peut accomplir quelque chose de discrètement précieux. Il aide à reconnaître ce que vous portez, à revenir vers une Écriture approuvée, à parler de votre propre voix et à vous souvenir avec intégrité de l’attente comme de la gratitude. Il ne promet aucune maîtrise des résultats. Il offre un lieu fidèle pour l’attention. Avec le temps, cette séquence simple révèle non une histoire sans défaut, mais une histoire réelle : des besoins nommés, des prières offertes, de l’aide reçue, des questions portées et la grâce remémorée.',
        ],
      },
    ],
    cta: {
      eyebrow: 'Un rythme privé',
      title: 'Découvrez l’Espace de prière de Vella',
      body: 'Nommez ce que vous portez, recevez une Écriture approuvée, écrivez votre propre prière privée et retrouvez une chronologie de prière et de gratitude.',
      label: 'Explorer l’Espace de prière',
      path: '/features/prayer-space',
    },
  },
  de: {
    title: 'Ein täglicher Gebetsraum für das wirkliche Leben: vom Anliegen zur Dankbarkeit',
    description:
      'Ein privater, in der Bibel verwurzelter Rhythmus, um dein Anliegen zu benennen, dein eigenes Gebet zu schreiben und dich später an Gottes Begleitung zu erinnern.',
    category: 'Gebet',
    publishedAt: '2026-08-03',
    updatedAt: '2026-08-03',
    dateLabel: '3. August 2026',
    readTime: '10 Min. Lesezeit',
    heroQuote:
      'Gebet braucht keine perfekten Worte. Es braucht einen ehrlichen Anfang, eine tragfähige Wahrheit und Raum für Erinnerung.',
    sections: [
      {
        heading: 'Gebet beginnt oft, bevor die Worte da sind',
        paragraphs: [
          'Ein Anliegen kann dich durch einen gewöhnlichen Tag begleiten, ohne je zu einem klaren Gebet zu werden. Vielleicht ist es ein Name, der immer wieder auftaucht, eine Entscheidung, die nicht zur Ruhe kommt, eine Dankbarkeit, die du nicht verlieren möchtest, oder eine Angst, die zu kompliziert erscheint. Solange alles nur im Kopf bleibt, wird die Sorge leicht wiederholt, aber selten bewusst getragen. Ein eigener Gebetsraum schafft eine sanfte Schwelle: innehalten, wahrnehmen, was da ist, und diese Wirklichkeit vor Gott bringen, ohne so zu tun, als wäre sie bereits gelöst.',
          'Dabei geht es nicht darum, Gebet in ein weiteres Produktivitätssystem zu verwandeln. Ein hilfreicher Raum soll Druck mindern, nicht Punkte vergeben. Er gibt einer zutiefst persönlichen Praxis eine einfache Form: das Bedürfnis benennen, eine passende Bibelstelle empfangen, dein eigenes Gebet schreiben, das Anliegen privat halten und später zurückkehren, um dich zu erinnern. Manche Einträge sind kurz, andere begleiten dich monatelang. Beides hat seinen Platz, denn Treue wird nicht an Länge, sprachlicher Schönheit oder einer lückenlosen täglichen Serie gemessen.',
        ],
      },
      {
        heading: 'Benenne dein Anliegen ehrlich',
        paragraphs: [
          'Der erste Schritt ist bewusst klein: Gib dem Anliegen einen Namen. „Weisheit für dieses Gespräch“, „Mamas Untersuchung“, „Mut für einen Neuanfang“ oder „Danke für heute“ genügt. Ein klarer Titel erzwingt keine Lösung; er hebt dieses eine Bedürfnis nur aus dem inneren Durcheinander heraus. Beim Benennen kann sich auch zeigen, dass mehrere Dinge miteinander verknüpft sind: eine praktische Aufgabe, ein Gefühl, das Mitgefühl braucht, und eine Bitte, die du vor Gott legen möchtest. Daraus muss kein vollendeter Satz werden.',
          'Ehrlichkeit ist wichtiger als religiöse Sprache. Du darfst Ärger, Ungewissheit, Enttäuschung, Hoffnung, Erleichterung oder Schweigen wahrnehmen. Weil der Gebetsraum privat ist, liegt sein Wert in der Freiheit, das Wahre aufzuschreiben statt etwas, das andere beeindrucken würde. Wenn du keine konkrete Bitte findest, beginne mit „Das trage ich gerade“. Wenn Dankbarkeit die ehrlichste Antwort ist, beginne dort. Wenn die einzigen aufrichtigen Worte „Ich weiß es nicht“ lauten, können auch sie ein echtes Gebet eröffnen.',
        ],
        reflectionPrompts: [
          'Was kehrt heute immer wieder in meine Aufmerksamkeit zurück?',
          'Bringe ich eine Bitte, einen Menschen, eine Entscheidung, eine Klage oder Dankbarkeit mit?',
          'Was würde ich sagen, wenn diese Worte nicht geistlich klingen müssten?',
        ],
      },
      {
        heading: 'Lass eine freigegebene Bibelstelle dem Gebet Grund geben',
        paragraphs: [
          'Nachdem du das Anliegen benannt hast, kann der Gebetsraum eine passende Stelle aus Vellas freigegebener, gespeicherter Bibelbibliothek abrufen. Die Worte stammen aus dieser sorgfältig zusammengestellten Sammlung; sie werden nicht von künstlicher Intelligenz verfasst, umgeschrieben oder übersetzt. Diese Unterscheidung schützt die Grenze zwischen Bibeltext und generiertem Kommentar. Lies die Stelle in ihrem Zusammenhang, achte auf ihre tatsächliche Aussage und lass sie deine Bitte erweitern oder korrigieren. Die Bibel gibt Sprache für Vertrauen, Klage, Mut, Bekenntnis, Geduld und Lob, ohne zum bloßen Spruch zu werden.',
          'Ein verwandter Vers ist keine Vorhersage, dass alles nach deinen Wünschen verlaufen wird. Er begleitet das Gebet und lädt dazu ein, auf Gottes Wesen zu achten. Du kannst die Stelle über die Bibelsuche weiterverfolgen, die Verse davor und danach lesen, sie als Favorit speichern oder eine Notiz ergänzen. Wirkt die Verbindung unvollständig, suche weiter, statt sie zu erzwingen. Das Ziel ist nicht ein Satz, der eine bestimmte Antwort garantiert, sondern verlässliche Worte, die ein ehrliches Gespräch mit Gott tragen.',
        ],
      },
      {
        heading: 'Schreibe das Gebet, das wirklich deines ist',
        paragraphs: [
          'Der Gebetsraum erzeugt kein Gebet und stellt keinen KI-Chat zwischen dich und Gott. Die Worte bleiben deine. Du kannst auf die Bibelstelle antworten, unmittelbar um Hilfe bitten, bekennen, was sich ändern muss, das erhoffte Gute benennen oder ein paar Zeilen unvollendet lassen. Langsames Schreiben kann Annahmen sichtbar machen, die schnelle Gedanken verdecken. So entsteht auch Raum für eine andere Bitte: nicht nur „Verändere diese Lage“, sondern „Gib mir Weisheit, Liebe, Ausdauer und Mut für den nächsten treuen Schritt mitten darin.“',
          'Dein Gebetstext und dein persönliches Anliegen bleiben privat. Es gibt keinen öffentlichen Beitrag, keine gemeinsame Gebetswand, kein Teilen in Gruppen oder Kreisen und keine automatische Weitergabe an die Community. Der Text wird niemals an eine KI gesendet und niemals in eine Benachrichtigung übernommen. Das ist wichtig, weil geistliche Ehrlichkeit einen verlässlichen Rahmen braucht. Du kannst dich bewusst einem Pastor, Freund oder einer Gemeinschaft anvertrauen, doch die Nutzung des Gebetsraums veröffentlicht oder versendet nichts von dem, was du geschrieben hast. Privatsphäre gehört von Anfang an zur Praxis.',
        ],
      },
      {
        heading: 'Als gebetet markieren und ohne erzwungenes Ergebnis erinnern',
        paragraphs: [
          'Wenn du mit einem Anliegen innegehalten hast, markiere es als gebetet. Diese kleine Handlung behauptet nicht, dass die Sorge beendet sei; sie hält fest, dass du sie heute vor Gott gebracht hast. Erneut dafür zu beten ist weder Versagen noch unnötige Wiederholung. Manche Gebete bleiben über lange Zeiten offen. Die Zeitleiste kann diese wiederkehrenden Momente bewahren, ohne eine dramatische Veränderung zu fordern, und dir zeigen, dass auch Beharrlichkeit ein Teil der Geschichte sein kann.',
          'Später kannst du ein Anliegen als beantwortet markieren und Dankbarkeit hinzufügen. „Beantwortet“ muss nicht bedeuten, dass sich alles genau wie erhofft gelöst hat. Manchmal verändern sich Umstände, manchmal wird Orientierung klarer, manchmal kommt Hilfe durch einen Menschen, und manchmal lautet die ehrliche Aktualisierung Trauer, Warten oder eine andere Form von Gnade. Die Dankbarkeits-Zeitleiste dient wahrhaftiger Erinnerung, nicht einem künstlichen Zeugnis. Sie bewahrt konkrete Geschenke, ohne offenen Schmerz zum Sieg umzudeuten. Im Gebet dürfen Hoffnung und Klage nebeneinander bestehen.',
        ],
        reflectionPrompts: [
          'Was hat sich in der Situation, in mir oder bei der verfügbaren Hilfe verändert?',
          'Gibt es ein konkretes Geschenk, an das ich mich erinnern möchte, ohne das Schwierige kleinzureden?',
          'Braucht dieses Anliegen ein weiteres Gebet, einen praktischen Schritt, weisen Rat oder geduldiges Warten?',
        ],
      },
      {
        heading: 'Verbinde den privaten Rhythmus mit deinem weiteren Weg',
        paragraphs: [
          'Der Gebetsraum wirkt am besten als eine Tür in einem umfassenderen geistlichen Rhythmus. Das Tägliche Licht kann einen ruhigen Anfang schenken, bevor du das Anliegen des Tages benennst. Bibel und Suche helfen, über die vorgeschlagene Stelle hinauszulesen. Wege können ein längerfristiges Thema begleiten, wenn ein Bedürfnis nicht in eine Sitzung passt. Notizen und Favoriten bewahren Einsichten. Freiwillige Benachrichtigungen dürfen dich zu einer gewählten Zeit zurückrufen, enthalten aber niemals den privaten Gebetstext und zeigen das Anliegen nicht auf dem Sperrbildschirm.',
          'Gemeinschaft kann weiterhin wesentlich sein, ohne private Gebete zu Inhalten zu machen. Eine geteilte Reflexion, allgemeine Ermutigung oder ein Gespräch mit vertrauten Menschen kann die Praxis begleiten, während das Gebet deines bleibt. Vella veröffentlicht es nicht in einem Feed und zeigt es weder Gruppen noch Kreisen. Diese Trennung bewahrt deine Entscheidungsfreiheit: Du bestimmst, was überhaupt zum Gespräch wird. Die App unterstützt Aufmerksamkeit und Erinnerung; Beziehungen bieten Zuhören, Unterscheidung, praktische Hilfe und jene leibhaftige Begleitung, die ein privates Werkzeug nicht ersetzen kann.',
        ],
      },
      {
        heading: 'Ein Sieben-Minuten-Rhythmus zum Wiederkehren',
        paragraphs: [
          'Du musst nicht jeden Schritt perfekt vollenden oder den Gebetsraum täglich nutzen. Probiere diesen kurzen Rhythmus aus, wenn ein Anliegen wiederkehrt. Werde langsam genug, um ehrlich zu sein, aber lass die Struktur dir dienen, statt dich zu beherrschen. An einem vollen Tag kann ein Satz das ganze Gebet sein. An einem ruhigen Tag kannst du den biblischen Zusammenhang lesen, mehr schreiben oder ein älteres Anliegen aufrufen. Die tragfähige Gewohnheit ist nicht das Produzieren eines Eintrags, sondern das aufmerksame Wiederkehren.',
        ],
        numberedPractices: [
          'Ankommen. Atme einmal ohne Eile und nimm Körper, Gedanken und Umgebung wahr. Du musst nicht erst ruhig werden, um zu beginnen.',
          'Benennen. Gib dem Anliegen einen einfachen, privaten Titel und beschreibe, was du trägst, ohne es für ein Publikum zu bearbeiten.',
          'Empfangen. Lies die abgerufene Stelle aus der freigegebenen Bibelbibliothek, prüfe ihren Zusammenhang und beachte einen Satz, der dich ehrlich erreicht.',
          'Antworten. Schreibe dein eigenes Gebet. Bitte, klage, bekenne, danke oder bleibe bei einer Frage; generierte Sprache ist nicht nötig.',
          'Anvertrauen. Markiere das Anliegen als gebetet und wähle einen weisen nächsten Schritt, falls Handeln nötig ist.',
          'Erinnern. Kehre später zurück, bete erneut, notiere eine Antwort oder füge Dank hinzu, ohne zu behaupten, jede Geschichte sei wie gewünscht ausgegangen.',
        ],
      },
      {
        heading: 'Erkenne, was eine Gebets-App nicht tragen kann',
        paragraphs: [
          'Der Gebetsraum ist ein Werkzeug zur geistlichen Reflexion, kein Ersatz für einen Pastor, eine vertrauenswürdige Gemeinschaft, medizinische oder psychologische Versorgung, Schutz bei Gewalt oder Krisenhilfe. Manche Anliegen brauchen einen Menschen, der zuhören, Risiken einschätzen und mit dir handeln kann. Wenn du in Gefahr bist, Missbrauch erlebst, daran denkst, dir oder jemand anderem etwas anzutun, oder einen medizinischen Notfall hast, kontaktiere jetzt den örtlichen Notruf oder Krisendienst und eine vertraute Person in deiner Nähe. Du musst eine dringende Situation nicht in einem privaten Tagebuch verschließen.',
          'Innerhalb dieser Grenzen kann ein privater Gebetsverlauf etwas still Wertvolles tun. Er hilft dir wahrzunehmen, was du trägst, zu freigegebener Bibel zurückzukehren, mit deiner eigenen Stimme zu sprechen und sowohl Warten als auch Dankbarkeit aufrichtig zu erinnern. Er verspricht keine Kontrolle über Ergebnisse. Er bietet einen verlässlichen Ort für Aufmerksamkeit. Mit der Zeit zeigt diese einfache Abfolge keine makellose, sondern eine wirkliche Geschichte: benannte Bedürfnisse, gesprochene Gebete, empfangene Hilfe, getragene Fragen und erinnerte Gnade.',
        ],
      },
    ],
    cta: {
      eyebrow: 'Ein privater Rhythmus',
      title: 'Entdecke Vellas Gebetsraum',
      body: 'Benenne, was du trägst, empfange freigegebene Bibelworte, schreibe dein eigenes privates Gebet und kehre zu einer Zeitleiste aus Gebet und Dankbarkeit zurück.',
      label: 'Gebetsraum entdecken',
      path: '/features/prayer-space',
    },
  },
  it: {
    title: 'Uno Spazio di preghiera quotidiano per la vita reale: dal bisogno alla gratitudine',
    description:
      'Un ritmo privato, radicato nella Scrittura, per dare un nome a ciò che porti, scrivere la tua preghiera e ricordare nel tempo come Dio ti ha incontrato.',
    category: 'Preghiera',
    publishedAt: '2026-08-03',
    updatedAt: '2026-08-03',
    dateLabel: '3 agosto 2026',
    readTime: '10 min di lettura',
    heroQuote:
      'La preghiera non ha bisogno di parole perfette. Ha bisogno di un inizio sincero, di una verità su cui poggiare e di spazio per ricordare.',
    sections: [
      {
        heading: 'La preghiera spesso comincia prima che arrivino le parole',
        paragraphs: [
          'Una preoccupazione può accompagnarti durante una giornata normale senza diventare mai una preghiera chiara. Può essere un nome che continua a tornare, una decisione che non si assesta, una gratitudine che non vuoi perdere o una paura troppo complessa da spiegare. Quando tutto resta nella mente, la preoccupazione viene ripetuta facilmente, ma raramente viene custodita con intenzione. Uno Spazio di preghiera dedicato crea una soglia gentile: fermarti, riconoscere ciò che è presente e portare quella realtà a Dio senza fingere che sia già risolta.',
          'Lo scopo non è trasformare la preghiera in un altro sistema di produttività. Uno spazio utile dovrebbe ridurre la pressione, non assegnare un punteggio. Offre una forma semplice a una pratica profondamente personale: dare un nome al bisogno, ricevere un brano biblico pertinente, scrivere la tua preghiera, mantenere privata l’intenzione e tornare in seguito per ricordare ciò che è accaduto. Alcune note saranno brevi, altre potranno accompagnarti per mesi. Entrambe hanno un posto, perché la fedeltà non si misura dalla lunghezza, dall’eloquenza o da una serie quotidiana perfetta.',
        ],
      },
      {
        heading: 'Comincia dando al bisogno un nome sincero',
        paragraphs: [
          'Il primo movimento è volutamente piccolo: dai un nome alla preoccupazione. “Saggezza per questa conversazione”, “La visita della mamma”, “Coraggio per ricominciare” o “Grazie per oggi” è sufficiente. Un titolo chiaro non impone una conclusione; separa semplicemente quel bisogno dal vortice circostante. Dare un nome può anche rivelare che più cose sono intrecciate: un compito pratico, un’emozione che richiede compassione e una richiesta che vuoi deporre davanti a Dio. Non devono diventare un’unica frase elegante.',
          'La sincerità conta più del vocabolario religioso. Puoi riconoscere rabbia, incertezza, delusione, speranza, sollievo o silenzio. Poiché lo Spazio di preghiera è privato, il suo valore sta nella libertà di scrivere ciò che è vero invece di ciò che farebbe bella figura davanti ad altri. Se non riesci a individuare una richiesta, comincia con “Questo è ciò che porto”. Se la gratitudine è la risposta più autentica, parti da lì. Se le sole parole sincere sono “Non lo so”, possono comunque aprire una preghiera vera.',
        ],
        reflectionPrompts: [
          'Che cosa continua a tornare alla mia attenzione oggi?',
          'Sto portando una richiesta, una persona, una decisione, un lamento o gratitudine?',
          'Che cosa direi se queste parole non dovessero sembrare spirituali?',
        ],
      },
      {
        heading: 'Lascia che una Scrittura approvata dia fondamento alla preghiera',
        paragraphs: [
          'Dopo aver nominato il bisogno, lo Spazio di preghiera può recuperare un brano pertinente dalla raccolta di Scritture approvata e archiviata da Vella. Le parole provengono da quella biblioteca selezionata; non sono scritte, riscritte o tradotte dall’intelligenza artificiale. Questa distinzione protegge il confine tra testo biblico e commento generato. Leggi il brano nel suo contesto, osserva che cosa dice davvero e lascia che allarghi o corregga l’inquadratura della tua richiesta. La Scrittura offre parole per fiducia, lamento, coraggio, confessione, pazienza e lode senza ridursi a uno slogan.',
          'Un versetto collegato non è una previsione che gli eventi seguiranno le tue preferenze. È un compagno per la preghiera e un invito a considerare il carattere di Dio. Puoi proseguire con la ricerca nella Bibbia, leggere i versetti vicini, salvarlo tra i preferiti o aggiungere una nota su ciò che hai osservato. Se il collegamento sembra incompleto, continua a cercare invece di forzarlo. Lo scopo non è trovare una frase che garantisca una risposta, ma permettere a parole affidabili di dare stabilità a una conversazione sincera con Dio.',
        ],
      },
      {
        heading: 'Scrivi la preghiera che è davvero tua',
        paragraphs: [
          'Lo Spazio di preghiera non genera una preghiera e non colloca una chat di intelligenza artificiale tra te e Dio. Le parole restano tue. Puoi rispondere al brano, chiedere aiuto direttamente, confessare ciò che deve cambiare, nominare il bene che speri o lasciare alcune righe incomplete. Scrivere lentamente può far emergere presupposti nascosti dai pensieri veloci. Può anche aprire una richiesta diversa: non soltanto “cambia questa circostanza”, ma “dammi saggezza, amore, perseveranza e coraggio per compiere il prossimo passo fedele dentro di essa”.',
          'Il testo della preghiera e l’intenzione personale rimangono privati. Non esistono post pubblici, bacheche collettive di preghiera, condivisioni in gruppi o cerchie, né distribuzione automatica alla comunità. Il testo non viene mai inviato all’intelligenza artificiale e non viene mai copiato in una notifica. È importante, perché la sincerità spirituale richiede un contenitore affidabile. Sei libero di condividere qualcosa separatamente con un pastore, un amico o una comunità quando lo scegli, ma usare lo Spazio di preghiera non pubblica né inoltra ciò che hai scritto. La riservatezza è parte della pratica stessa.',
        ],
      },
      {
        heading: 'Segna di aver pregato, poi ricorda senza forzare un esito',
        paragraphs: [
          'Quando hai sostato con un’intenzione, segnala di aver pregato. Quel piccolo gesto non dichiara che la preoccupazione sia terminata; registra che oggi l’hai portata davanti a Dio. Tornare a pregare non è un fallimento né una ripetizione inutile. Alcune preghiere restano aperte per stagioni lunghe. La cronologia può custodire questi momenti ripetuti senza pretendere un aggiornamento straordinario, aiutandoti a vedere che anche la perseveranza può far parte della storia.',
          'Più avanti puoi segnare un’intenzione come esaudita e aggiungere gratitudine. “Esaudita” non deve significare che tutto si è risolto esattamente come speravi. A volte cambiano le circostanze; a volte la direzione diventa più chiara; a volte l’aiuto arriva attraverso una persona; a volte l’aggiornamento sincero è dolore, attesa o una grazia diversa. La cronologia della gratitudine serve a ricordare fedelmente, non a fabbricare una testimonianza. Conserva doni precisi senza chiamare vittoria un dolore ancora aperto. Nella preghiera speranza e lamento possono stare insieme.',
        ],
        reflectionPrompts: [
          'Che cosa è cambiato nella situazione, in me o nell’aiuto disponibile?',
          'C’è un dono preciso che voglio ricordare senza sminuire ciò che resta difficile?',
          'Questa intenzione richiede un’altra preghiera, un’azione concreta, un consiglio saggio o un’attesa paziente?',
        ],
      },
      {
        heading: 'Collega un ritmo privato al resto del tuo cammino',
        paragraphs: [
          'Lo Spazio di preghiera funziona al meglio come una porta dentro un ritmo spirituale più ampio. Luce quotidiana può offrire un inizio quieto prima di nominare la preoccupazione del giorno. Scrittura e ricerca aiutano a leggere oltre il brano proposto. I percorsi sviluppano un tema più lungo quando un bisogno non entra in una singola sessione. Note e preferiti conservano intuizioni da rileggere. Le notifiche facoltative possono invitarti a tornare all’ora scelta, ma non includono mai il testo privato della preghiera né rivelano l’intenzione sulla schermata bloccata.',
          'La comunità può restare profondamente importante senza trasformare le preghiere private in contenuti. Una riflessione condivisa, un incoraggiamento generale o una conversazione con persone fidate possono accompagnare la pratica mentre la preghiera rimane tua. Vella non la pubblica in un feed e non la espone a gruppi o cerchie. Questa separazione tutela la tua scelta: sei tu a decidere che cosa, eventualmente, diventa conversazione. L’app sostiene attenzione e memoria; le relazioni offrono ascolto, discernimento, aiuto concreto e quella compagnia incarnata che uno strumento privato non può sostituire.',
        ],
      },
      {
        heading: 'Un ritmo di sette minuti a cui tornare',
        paragraphs: [
          'Non devi completare perfettamente ogni movimento né usare lo Spazio di preghiera tutti i giorni. Prova questo ritmo breve quando un bisogno continua a riaffiorare. Rallenta abbastanza per essere sincero, ma lascia che la struttura ti serva invece di controllarti. In una giornata piena, una frase può essere tutta la preghiera. In un giorno più libero, segui la Scrittura nel contesto, scrivi di più o torna a un’intenzione precedente. L’abitudine duratura non consiste nel produrre una nota, ma nell’imparare a ritornare con attenzione.',
        ],
        numberedPractices: [
          'Arriva. Fai un respiro senza fretta e nota che cosa accade nel corpo, nei pensieri e intorno a te. Non devi calmarti prima di cominciare.',
          'Nomina. Dai al bisogno un titolo semplice e privato e descrivi ciò che porti senza modificarlo per un pubblico.',
          'Ricevi. Leggi il brano recuperato dalla biblioteca biblica approvata, controlla il contesto vicino e nota una frase che ti incontri con sincerità.',
          'Rispondi. Scrivi la tua preghiera. Chiedi, lamentati, confessa, ringrazia o resta con una domanda; non serve alcun linguaggio generato.',
          'Affida. Segna di aver pregato per l’intenzione e scegli un prossimo passo saggio se occorre agire.',
          'Ricorda. Torna in seguito per pregare ancora, registrare una risposta o aggiungere gratitudine senza dire che ogni storia sia finita come desideravi.',
        ],
      },
      {
        heading: 'Riconosci ciò che un’app di preghiera non può portare',
        paragraphs: [
          'Lo Spazio di preghiera è uno strumento di riflessione spirituale, non sostituisce un pastore, una comunità affidabile, l’assistenza medica o psicologica, la protezione dagli abusi o il supporto nelle crisi. Alcuni bisogni richiedono una persona che possa ascoltare, valutare il rischio e agire con te. Se sei in pericolo, subisci violenza, pensi di fare del male a te stesso o ad altri, oppure affronti un’emergenza medica, contatta subito i servizi locali di emergenza o crisi e una persona fidata vicina. Non devi rinchiudere una situazione urgente in un diario privato.',
          'Entro questi confini, un registro privato di preghiera può fare qualcosa di discretamente prezioso. Può aiutarti a riconoscere ciò che porti, tornare a una Scrittura approvata, parlare con la tua voce e ricordare con integrità sia l’attesa sia la gratitudine. Non promette controllo sui risultati. Offre un luogo fedele per l’attenzione. Nel tempo, quella semplice sequenza rivela non una storia impeccabile, ma una storia reale: bisogni nominati, preghiere offerte, aiuto ricevuto, domande portate e grazia ricordata.',
        ],
      },
    ],
    cta: {
      eyebrow: 'Un ritmo privato',
      title: 'Scopri lo Spazio di preghiera di Vella',
      body: 'Dai un nome a ciò che porti, ricevi una Scrittura approvata, scrivi la tua preghiera privata e torna a una cronologia di preghiera e gratitudine.',
      label: 'Esplora lo Spazio di preghiera',
      path: '/features/prayer-space',
    },
  },
  ru: {
    title: 'Ежедневное Пространство молитвы для реальной жизни: от нужды к благодарности',
    description:
      'Личный ритм, укоренённый в Писании: назвать то, что вы несёте, написать собственную молитву и со временем вспомнить, как Бог был рядом.',
    category: 'Молитва',
    publishedAt: '2026-08-03',
    updatedAt: '2026-08-03',
    dateLabel: '3 августа 2026 г.',
    readTime: '10 мин чтения',
    heroQuote:
      'Молитве не нужны безупречные слова. Ей нужны честное начало, надёжная истина и место для памяти.',
    sections: [
      {
        heading: 'Молитва часто начинается раньше, чем появляются слова',
        paragraphs: [
          'Забота может сопровождать вас весь обычный день, так и не став ясной молитвой. Это может быть имя, которое снова приходит на ум, решение, не дающее покоя, благодарность, которую не хочется потерять, или страх, который слишком сложно объяснить. Пока всё остаётся только в голове, тревога легко повторяется, но редко удерживается осознанно. Отдельное Пространство молитвы создаёт мягкий порог: остановиться, заметить то, что уже присутствует, и принести эту реальность Богу, не притворяясь, будто всё уже разрешилось.',
          'Цель не в том, чтобы превратить молитву в ещё одну систему продуктивности. Полезное пространство должно уменьшать давление, а не начислять баллы. Оно придаёт простую форму глубоко личной практике: назвать нужду, получить связанный с ней отрывок Писания, написать свою молитву, оставить намерение личным и позже вернуться, чтобы вспомнить произошедшее. Одни записи будут короткими, другие смогут сопровождать вас месяцами. И те и другие уместны, ведь верность не измеряется длиной, красноречием или безупречной ежедневной серией.',
        ],
      },
      {
        heading: 'Сначала честно назовите нужду',
        paragraphs: [
          'Первый шаг намеренно мал: дайте заботе имя. «Мудрость для этого разговора», «Мамино обследование», «Смелость начать снова» или «Спасибо за сегодняшний день» — этого достаточно. Ясный заголовок не навязывает вывод; он лишь отделяет одну нужду от окружающего внутреннего шума. Называя её, вы можете увидеть, что переплелись разные вещи: практическая задача, чувство, которому нужно сострадание, и просьба, которую хочется принести Богу. Их не требуется превращать в одну красивую фразу.',
          'Честность важнее религиозной лексики. Можно признать гнев, неуверенность, разочарование, надежду, облегчение или молчание. Пространство молитвы остаётся личным, поэтому его ценность — в свободе написать правду, а не то, что впечатлило бы другого. Если не получается сформулировать просьбу, начните словами: «Вот что я сейчас несу». Если самый честный ответ — благодарность, начните с неё. Если единственные правдивые слова — «Я не знаю», даже они могут открыть искреннюю молитву.',
        ],
        reflectionPrompts: [
          'Что сегодня снова и снова возвращается в моё внимание?',
          'Я приношу просьбу, человека, решение, плач или благодарность?',
          'Что бы я сказал, если бы этим словам не нужно было звучать духовно?',
        ],
      },
      {
        heading: 'Пусть одобренный текст Писания станет основанием молитвы',
        paragraphs: [
          'После того как нужда названа, Пространство молитвы может найти связанный отрывок в одобренной и сохранённой библиотеке Писания Vella. Слова берутся из этой отобранной библиотеки; искусственный интеллект не сочиняет, не переписывает и не переводит их. Такое различие защищает границу между библейским текстом и сгенерированным комментарием. Прочитайте отрывок в контексте, заметьте, что он действительно говорит, и позвольте ему расширить или исправить взгляд на просьбу. Писание даёт язык для доверия, плача, мужества, исповедания, терпения и хвалы, не превращаясь в лозунг.',
          'Связанный стих не предсказывает, что события развернутся так, как вам хочется. Это спутник молитвы и приглашение обратить внимание на характер Бога. Можно продолжить чтение через поиск по Писанию, посмотреть соседние стихи, сохранить отрывок в избранное или добавить заметку о том, что вы увидели. Если связь кажется неполной, продолжайте искать, не вынуждая текст подходить. Цель не в том, чтобы найти фразу, гарантирующую ответ, а в том, чтобы надёжные слова поддержали честный разговор с Богом.',
        ],
      },
      {
        heading: 'Напишите молитву, которая действительно принадлежит вам',
        paragraphs: [
          'Пространство молитвы не генерирует молитву и не помещает чат с искусственным интеллектом между вами и Богом. Слова остаются вашими. Можно ответить на отрывок, прямо попросить о помощи, исповедать то, что должно измениться, назвать добро, на которое вы надеетесь, или оставить несколько строк незаконченными. Медленное письмо обнаруживает предположения, которые скрывают быстрые мысли. Оно открывает место и для другой просьбы: не только «измени обстоятельства», но и «дай мне мудрость, любовь, стойкость и смелость сделать следующий верный шаг внутри них».',
          'Текст молитвы и личное намерение остаются закрытыми. Здесь нет публичной публикации, общей стены молитв, обмена в группе или круге и автоматической рассылки сообществу. Текст никогда не отправляется искусственному интеллекту и никогда не вставляется в уведомление. Это важно: духовной честности нужен надёжный контейнер. Вы по-прежнему можете по своему решению отдельно поделиться чем-то с пастором, другом или общиной, но использование Пространства молитвы не публикует и не пересылает написанное. Конфиденциальность — часть самой практики, а не скрытая дополнительная настройка.',
        ],
      },
      {
        heading: 'Отметьте, что помолились, и вспоминайте, не требуя определённого исхода',
        paragraphs: [
          'Уделив время намерению, отметьте его как молитвенное. Этот небольшой жест не означает, что забота закончилась; он фиксирует, что сегодня вы принесли её Богу. Возвращаться к молитве — не неудача и не бессмысленное повторение. Некоторые молитвы остаются открытыми долгие сезоны. Временная шкала может хранить эти повторяющиеся моменты, не требуя впечатляющих изменений, и помогать видеть, что настойчивость тоже бывает частью истории.',
          'Позже намерение можно отметить как получившее ответ и добавить благодарность. «Ответ» не обязательно означает, что всё разрешилось точно по вашим ожиданиям. Иногда меняются обстоятельства, иногда направление становится яснее, иногда помощь приходит через другого человека, а иногда честное обновление — это горе, ожидание или иная благодать. Лента благодарности нужна для верной памяти, а не для изготовления красивого свидетельства. Она сохраняет конкретные дары, не называя победой всё ещё открытую боль. В молитве надежда и плач могут оставаться рядом.',
        ],
        reflectionPrompts: [
          'Что изменилось в ситуации, во мне или в доступной помощи?',
          'Есть ли конкретный дар, который я хочу запомнить, не преуменьшая оставшиеся трудности?',
          'Нужны ли этому намерению ещё одна молитва, практический шаг, мудрый совет или терпеливое ожидание?',
        ],
      },
      {
        heading: 'Свяжите личный ритм с остальной частью пути',
        paragraphs: [
          'Пространство молитвы лучше всего работает как одна дверь в более широкий духовный ритм. Ежедневный свет может дать спокойное начало перед тем, как вы назовёте заботу дня. Писание и поиск помогают читать дальше предложенного отрывка. Путешествия раскрывают тему дольше, если нужду нельзя вместить в одну сессию. Заметки и избранное сохраняют открытия, к которым хочется вернуться. Необязательные уведомления могут пригласить вас обратно в выбранное время, но они никогда не содержат личный текст молитвы и не показывают намерение на заблокированном экране.',
          'Сообщество по-прежнему может быть глубоко важным, не превращая личные молитвы в контент. Общая рефлексия, общее ободрение или разговор с надёжными людьми способны сопровождать практику, пока сама молитва остаётся вашей. Vella не публикует её в ленте и не открывает группам или кругам. Такое разделение сохраняет свободу выбора: только вы решаете, что станет темой разговора. Приложение поддерживает внимание и память; отношения дают слушание, различение, практическую заботу и живое присутствие, которое личный цифровой инструмент заменить не может.',
        ],
      },
      {
        heading: 'Семиминутный ритм, к которому можно возвращаться',
        paragraphs: [
          'Не нужно выполнять каждое движение идеально или пользоваться Пространством молитвы ежедневно. Попробуйте этот короткий ритм, когда нужда снова напоминает о себе. Замедлитесь настолько, чтобы быть честными, но пусть структура служит вам, а не управляет вами. В загруженный день вся молитва может состоять из одного предложения. В свободный день можно прочитать контекст Писания, написать больше или вернуться к прежнему намерению. Устойчивая привычка — не в создании записи, а в умении снова приходить со вниманием.',
        ],
        numberedPractices: [
          'Придите. Сделайте один неспешный вдох и заметьте тело, мысли и окружающую обстановку. Чтобы начать, не обязательно сначала успокоиться.',
          'Назовите. Дайте нужде простой личный заголовок и опишите то, что несёте, не редактируя это для аудитории.',
          'Примите. Прочитайте найденный отрывок из одобренной библейской библиотеки, проверьте ближайший контекст и отметьте фразу, которая честно вас встречает.',
          'Ответьте. Напишите собственную молитву. Просите, плачьте, исповедуйте, благодарите или останьтесь с вопросом; сгенерированный текст не нужен.',
          'Доверьте. Отметьте намерение как молитвенное и выберите следующий мудрый шаг, если требуется действие.',
          'Вспомните. Позже вернитесь, снова помолитесь, запишите ответ или добавьте благодарность, не утверждая, что каждая история завершилась по желанию.',
        ],
      },
      {
        heading: 'Помните, чего молитвенное приложение не может нести',
        paragraphs: [
          'Пространство молитвы — инструмент духовного размышления, а не замена пастору, надёжной общине, медицинской или психологической помощи, защите от насилия или кризисной поддержке. Некоторые нужды требуют человека, который способен выслушать, оценить риск и действовать вместе с вами. Если вы в опасности, переживаете насилие, думаете причинить вред себе или другому человеку либо столкнулись с медицинской чрезвычайной ситуацией, немедленно обратитесь в местную экстренную или кризисную службу и к близкому надёжному человеку. Срочную ситуацию не нужно запирать в личном дневнике.',
          'В этих границах личная история молитвы может сделать нечто тихо ценное. Она помогает увидеть, что вы несёте, вернуться к одобренному Писанию, говорить собственным голосом и честно помнить как ожидание, так и благодарность. Она не обещает контроля над результатом. Она предлагает надёжное место для внимания. Со временем эта простая последовательность показывает не безупречную, а настоящую историю: названные нужды, принесённые молитвы, полученную помощь, удержанные вопросы и сохранённую память о благодати.',
        ],
      },
    ],
    cta: {
      eyebrow: 'Личный ритм',
      title: 'Познакомьтесь с Пространством молитвы Vella',
      body: 'Назовите то, что несёте, примите одобренный отрывок Писания, напишите личную молитву и возвращайтесь к истории молитвы и благодарности.',
      label: 'Открыть Пространство молитвы',
      path: '/features/prayer-space',
    },
  },
  pl: {
    title: 'Codzienna Przestrzeń Modlitwy na prawdziwe życie: od potrzeby do wdzięczności',
    description:
      'Prywatny rytm zakorzeniony w Piśmie: nazwij to, co nosisz, napisz własną modlitwę i z czasem przypominaj sobie, jak Bóg ci towarzyszył.',
    category: 'Modlitwa',
    publishedAt: '2026-08-03',
    updatedAt: '2026-08-03',
    dateLabel: '3 sierpnia 2026',
    readTime: '10 min czytania',
    heroQuote:
      'Modlitwa nie potrzebuje doskonałych słów. Potrzebuje szczerego początku, prawdy, na której można stanąć, i miejsca na pamięć.',
    sections: [
      {
        heading: 'Modlitwa często zaczyna się, zanim pojawią się słowa',
        paragraphs: [
          'Troska może towarzyszyć ci przez zwyczajny dzień, a jednak nigdy nie stać się jasną modlitwą. Może to być imię, które wciąż wraca, decyzja, która nie daje spokoju, wdzięczność, której nie chcesz utracić, albo lęk zbyt złożony, by go wyjaśnić. Gdy wszystko zostaje w głowie, łatwo powtarzać zmartwienie, lecz trudno świadomie je unieść. Osobna Przestrzeń Modlitwy tworzy łagodny próg: zatrzymaj się, zauważ, co jest obecne, i przynieś tę rzeczywistość Bogu, nie udając, że została już rozwiązana.',
          'Nie chodzi o przekształcenie modlitwy w kolejny system produktywności. Pomocna przestrzeń powinna zmniejszać presję, a nie przyznawać punkty. Nadaje prosty kształt głęboko osobistej praktyce: nazwij potrzebę, przyjmij powiązany fragment Pisma, napisz własną modlitwę, zachowaj intencję dla siebie i wróć później, aby pamiętać. Niektóre wpisy będą krótkie, inne mogą towarzyszyć ci miesiącami. Jedne i drugie mają swoje miejsce, bo wierności nie mierzy się długością, elokwencją ani idealną codzienną serią.',
        ],
      },
      {
        heading: 'Zacznij od szczerego nazwania potrzeby',
        paragraphs: [
          'Pierwszy ruch jest celowo mały: nadaj trosce nazwę. „Mądrość przed tą rozmową”, „Badanie mamy”, „Odwaga, by zacząć od nowa” albo „Dziękuję za dzisiaj” wystarczy. Jasny tytuł nie wymusza rozwiązania; jedynie oddziela tę potrzebę od otaczającego zamętu. Nazywanie może także ujawnić, że splątało się kilka różnych rzeczy: praktyczne zadanie, emocja potrzebująca współczucia oraz prośba, którą chcesz położyć przed Bogiem. Nie muszą tworzyć jednego dopracowanego zdania.',
          'Szczerość jest ważniejsza niż religijne słownictwo. Możesz uznać złość, niepewność, rozczarowanie, nadzieję, ulgę albo milczenie. Ponieważ Przestrzeń Modlitwy jest prywatna, jej wartość polega na swobodzie zapisania prawdy, a nie czegoś, co zrobiłoby wrażenie na innych. Jeśli nie potrafisz określić prośby, zacznij od „Oto, co dzisiaj noszę”. Jeśli najprawdziwszą odpowiedzią jest wdzięczność, zacznij właśnie tam. Jeśli jedyne szczere słowa brzmią „Nie wiem”, one również mogą otworzyć prawdziwą modlitwę.',
        ],
        reflectionPrompts: [
          'Co dzisiaj wciąż wraca do mojej uwagi?',
          'Czy przynoszę prośbę, osobę, decyzję, lament czy wdzięczność?',
          'Co powiedziałbym, gdyby te słowa nie musiały brzmieć duchowo?',
        ],
      },
      {
        heading: 'Niech zatwierdzony tekst Pisma da modlitwie fundament',
        paragraphs: [
          'Po nazwaniu potrzeby Przestrzeń Modlitwy może odnaleźć powiązany fragment w zatwierdzonej i zapisanej bibliotece Pisma Velli. Słowa pochodzą z tej starannie dobranej biblioteki; sztuczna inteligencja ich nie pisze, nie przeredagowuje ani nie tłumaczy. To rozróżnienie chroni granicę między tekstem biblijnym a wygenerowanym komentarzem. Przeczytaj fragment w kontekście, zauważ, co rzeczywiście mówi, i pozwól mu poszerzyć lub skorygować ramę twojej prośby. Pismo daje język zaufania, lamentu, odwagi, wyznania, cierpliwości i uwielbienia, nie stając się prostym hasłem.',
          'Powiązany werset nie jest przepowiednią, że wydarzenia potoczą się zgodnie z twoimi oczekiwaniami. Towarzyszy modlitwie i zaprasza do uważności na charakter Boga. Możesz przejść do wyszukiwania w Piśmie, przeczytać sąsiednie wersety, zapisać fragment w ulubionych albo dodać notatkę o tym, co zauważyłeś. Jeśli związek wydaje się niepełny, szukaj dalej, zamiast go wymuszać. Celem nie jest znalezienie zdania gwarantującego odpowiedź, lecz pozwolenie, by wiarygodne słowa ustabilizowały szczerą rozmowę z Bogiem.',
        ],
      },
      {
        heading: 'Napisz modlitwę, która naprawdę jest twoja',
        paragraphs: [
          'Przestrzeń Modlitwy nie generuje modlitwy i nie umieszcza czatu ze sztuczną inteligencją między tobą a Bogiem. Słowa pozostają twoje. Możesz odpowiedzieć na fragment, bezpośrednio poprosić o pomoc, wyznać to, co wymaga zmiany, nazwać dobro, którego pragniesz, albo pozostawić kilka niedokończonych wersów. Powolne pisanie potrafi odsłonić założenia ukryte przez szybkie myśli. Otwiera też miejsce na inną prośbę: nie tylko „zmień te okoliczności”, lecz także „daj mi mądrość, miłość, wytrwałość i odwagę do następnego wiernego kroku pośród nich”.',
          'Tekst modlitwy i osobista intencja pozostają prywatne. Nie ma publicznego wpisu, wspólnej ściany modlitw, udostępniania w grupie lub kręgu ani automatycznego przekazywania społeczności. Tekst nigdy nie jest wysyłany do sztucznej inteligencji i nigdy nie trafia do powiadomienia. To ważne, ponieważ duchowa szczerość potrzebuje bezpiecznego miejsca. Nadal możesz świadomie podzielić się czymś osobno z pastorem, przyjacielem lub wspólnotą, lecz użycie Przestrzeni Modlitwy nie publikuje ani nie przesyła tego, co napiszesz. Prywatność jest częścią praktyki od samego początku.',
        ],
      },
      {
        heading: 'Oznacz jako omodlone i pamiętaj bez wymuszania zakończenia',
        paragraphs: [
          'Gdy zatrzymasz się przy intencji, oznacz ją jako omodloną. Ten mały gest nie oznacza, że troska się skończyła; zapisuje, że dzisiaj przyniosłeś ją Bogu. Ponowna modlitwa nie jest porażką ani zbędnym powtórzeniem. Niektóre modlitwy pozostają otwarte przez długie okresy. Oś czasu może przechować te kolejne chwile bez żądania spektakularnej aktualizacji i pomóc ci zauważyć, że sama wytrwałość również bywa częścią historii.',
          'Później możesz oznaczyć intencję jako wysłuchaną i dodać wdzięczność. „Wysłuchana” nie musi znaczyć, że wszystko rozwiązało się dokładnie tak, jak oczekiwałeś. Czasem zmieniają się okoliczności, czasem kierunek staje się wyraźniejszy, czasem pomoc przychodzi przez inną osobę, a czasem uczciwą aktualizacją jest żałoba, czekanie lub inny rodzaj łaski. Oś wdzięczności służy wiernej pamięci, a nie produkowaniu świadectwa. Zachowuje konkretne dary, nie nazywając zwycięstwem wciąż otwartego bólu. Modlitwa mieści razem nadzieję i lament.',
        ],
        reflectionPrompts: [
          'Co zmieniło się w sytuacji, we mnie albo w dostępnej pomocy?',
          'Czy istnieje konkretny dar, który chcę zapamiętać bez pomniejszania tego, co nadal trudne?',
          'Czy ta intencja potrzebuje kolejnej modlitwy, praktycznego działania, mądrej rady lub cierpliwego czekania?',
        ],
      },
      {
        heading: 'Połącz prywatny rytm z resztą swojej drogi',
        paragraphs: [
          'Przestrzeń Modlitwy działa najlepiej jako jedno wejście w szerszy rytm duchowy. Codzienne Światło może dać spokojny początek, zanim nazwiesz troskę dnia. Pismo i wyszukiwanie pomagają czytać dalej niż wskazany fragment. Drogi rozwijają dłuższy temat, gdy potrzeba nie mieści się w jednej sesji. Notatki i ulubione zachowują odkrycia, do których chcesz wrócić. Opcjonalne powiadomienia mogą zaprosić cię o wybranej porze, lecz nigdy nie zawierają prywatnego tekstu modlitwy ani nie ujawniają intencji na zablokowanym ekranie.',
          'Wspólnota nadal może mieć ogromne znaczenie bez zamieniania prywatnych modlitw w treść. Wspólna refleksja, ogólne słowo wsparcia lub rozmowa z zaufanymi ludźmi mogą towarzyszyć praktyce, podczas gdy modlitwa pozostaje twoja. Vella nie publikuje jej w kanale i nie ujawnia grupom ani kręgom. To rozdzielenie zachowuje twoją sprawczość: ty decydujesz, co w ogóle stanie się rozmową. Aplikacja wspiera uwagę i pamięć; relacje oferują słuchanie, rozeznanie, praktyczną troskę oraz żywą obecność, której prywatne narzędzie nie zastąpi.',
        ],
      },
      {
        heading: 'Siedmiominutowy rytm, do którego można wracać',
        paragraphs: [
          'Nie musisz wykonywać każdego ruchu idealnie ani używać Przestrzeni Modlitwy codziennie. Wypróbuj ten krótki rytm, gdy potrzeba znowu się pojawia. Zwolnij na tyle, by mówić prawdę, ale pozwól strukturze służyć, a nie rządzić. W zajęty dzień jedno zdanie może być całą modlitwą. W spokojniejszy dzień przeczytaj kontekst Pisma, napisz więcej albo wróć do starszej intencji. Trwałym nawykiem nie jest tworzenie wpisu; jest nim uczenie się uważnego powrotu.',
        ],
        numberedPractices: [
          'Przyjdź. Weź jeden spokojny oddech i zauważ ciało, myśli oraz otoczenie. Nie musisz najpierw się uspokoić, żeby zacząć.',
          'Nazwij. Nadaj potrzebie prosty, prywatny tytuł i opisz to, co nosisz, bez redagowania dla odbiorców.',
          'Przyjmij. Przeczytaj fragment pobrany z zatwierdzonej biblioteki Pisma, sprawdź pobliski kontekst i zauważ zdanie, które uczciwie cię spotyka.',
          'Odpowiedz. Napisz własną modlitwę. Proś, lamentuj, wyznawaj, dziękuj albo pozostań z pytaniem; wygenerowane słowa nie są potrzebne.',
          'Powierz. Oznacz intencję jako omodloną i wybierz następny mądry krok, jeśli potrzebne jest działanie.',
          'Pamiętaj. Wróć później, pomódl się ponownie, zapisz odpowiedź lub dodaj wdzięczność, nie twierdząc, że każda historia zakończyła się po twojej myśli.',
        ],
      },
      {
        heading: 'Rozpoznaj, czego aplikacja modlitewna nie może unieść',
        paragraphs: [
          'Przestrzeń Modlitwy jest narzędziem duchowej refleksji, a nie zamiennikiem pastora, zaufanej wspólnoty, opieki medycznej lub psychologicznej, ochrony przed przemocą ani pomocy kryzysowej. Niektóre potrzeby wymagają osoby, która potrafi słuchać, ocenić ryzyko i działać razem z tobą. Jeśli jesteś w niebezpieczeństwie, doświadczasz przemocy, myślisz o skrzywdzeniu siebie lub kogoś innego albo stoisz wobec nagłego zagrożenia zdrowia, natychmiast skontaktuj się z lokalnymi służbami ratunkowymi lub kryzysowymi oraz z zaufaną osobą w pobliżu. Pilnej sytuacji nie trzeba zamykać w prywatnym dzienniku.',
          'W tych granicach prywatny zapis modlitwy może robić coś cicho wartościowego. Pomaga zauważyć, co nosisz, wrócić do zatwierdzonego Pisma, mówić własnym głosem i uczciwie pamiętać zarówno czekanie, jak i wdzięczność. Nie obiecuje kontroli nad wynikami. Oferuje wierne miejsce dla uwagi. Z czasem ta prosta kolejność odsłania nie idealną, lecz prawdziwą historię: nazwane potrzeby, ofiarowane modlitwy, otrzymaną pomoc, niesione pytania oraz zapamiętaną łaskę.',
        ],
      },
    ],
    cta: {
      eyebrow: 'Prywatny rytm',
      title: 'Poznaj Przestrzeń Modlitwy Velli',
      body: 'Nazwij to, co nosisz, przyjmij zatwierdzony fragment Pisma, napisz prywatną modlitwę i wracaj do osi modlitwy oraz wdzięczności.',
      label: 'Odkryj Przestrzeń Modlitwy',
      path: '/features/prayer-space',
    },
  },
} satisfies Record<Locale, PrayerSpaceArticleContent>;
