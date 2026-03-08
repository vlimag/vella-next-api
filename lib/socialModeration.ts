const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-5.2';

const FAITH_KEYWORDS = [
  'god',
  'jesus',
  'christ',
  'bible',
  'scripture',
  'prayer',
  'faith',
  'church',
  'gospel',
  'deus',
  'cristo',
  'biblia',
  'oracao',
  'oración',
  'dios',
  'dieu',
  'gott',
  'gesu',
  'бог',
  'молит',
  'wiara',
  'modlit',
];

const SPAM_SELL_KEYWORDS = [
  'buy now',
  'discount',
  'promo',
  'coupon',
  'subscribe my channel',
  'dm for price',
  'cashapp',
  'bitcoin giveaway',
  'onlyfans',
  'click here',
];

type ModerationVerdict = {
  allowed: boolean;
  reason: string;
  tags: string[];
  source: 'heuristic' | 'openai';
};

type OpenAiModerationInput = {
  text: string;
  imageDataUrl?: string;
};

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function heuristics(input: string, options?: { hasImage?: boolean }): ModerationVerdict {
  const normalized = input.toLowerCase();
  const tags: string[] = [];

  if (/https?:\/\//.test(normalized) || /www\./.test(normalized)) {
    tags.push('external_link');
  }

  if (SPAM_SELL_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    tags.push('selling_or_spam');
  }

  const hasFaithSignal = FAITH_KEYWORDS.some((keyword) => normalized.includes(keyword));
  const shouldRequireFaithKeyword = !options?.hasImage;
  if (!hasFaithSignal) {
    tags.push('off_topic_not_faith_related');
  }

  if (tags.includes('selling_or_spam')) {
    return {
      allowed: false,
      reason: 'This content looks like selling, spam, or solicitation.',
      tags,
      source: 'heuristic',
    };
  }

  if (shouldRequireFaithKeyword && tags.includes('off_topic_not_faith_related')) {
    return {
      allowed: false,
      reason: 'Feed posts must be related to faith, scripture, prayer, or Christian life.',
      tags,
      source: 'heuristic',
    };
  }

  return {
    allowed: true,
    reason: 'Accepted by heuristics.',
    tags,
    source: 'heuristic',
  };
}

async function openAiModerate(input: OpenAiModerationInput): Promise<ModerationVerdict | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const userContent: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: [
        'Review this user content.',
        'Reject if any of the following is true:',
        '- Offensive, hate, harassment, sexual content, violent threats, self-harm instructions.',
        '- Not related to Christianity, faith practice, prayer, scripture, testimony, church life, or spiritual reflection.',
        '- Selling products/services, scam signals, spam, or solicitation.',
        '- Image contains nudity, violence, hateful symbols, illegal activity, or explicit advertising.',
        'Return strict JSON:',
        '{"allowed":true|false,"reason":"short reason","tags":["..."]}',
        `Text: """${input.text}"""`,
        input.imageDataUrl ? 'An image is included and must also be evaluated.' : 'No image included.',
      ].join('\n'),
    },
  ];

  if (input.imageDataUrl) {
    userContent.push({
      type: 'image_url',
      image_url: {
        url: input.imageDataUrl,
        detail: 'low',
      },
    });
  }

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a strict social feed moderator for a Christian app. Return JSON only.',
        },
        {
          role: 'user',
          content: userContent,
        },
      ],
    }),
  });

  if (!response.ok) {
    console.error('[social-moderation] openai_failed', { status: response.status });
    return null;
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const raw = payload.choices?.[0]?.message?.content ?? '';
  const parsed = parseJsonObject(raw);
  if (!parsed) return null;

  const allowed = Boolean(parsed.allowed);
  const reason = typeof parsed.reason === 'string' && parsed.reason.trim().length > 0
    ? parsed.reason.trim()
    : allowed
      ? 'Accepted by moderation.'
      : 'Rejected by moderation.';
  const tags = Array.isArray(parsed.tags) ? parsed.tags.filter((tag) => typeof tag === 'string') as string[] : [];

  return {
    allowed,
    reason,
    tags,
    source: 'openai',
  };
}

export async function moderateFaithPostContent(input: {
  text: string;
  imageDataUrl?: string;
}): Promise<ModerationVerdict> {
  const trimmedText = input.text.trim();
  const hasImage = Boolean(input.imageDataUrl);

  if (trimmedText.length < 2 && !hasImage) {
    return {
      allowed: false,
      reason: 'Please write a little more before posting.',
      tags: ['too_short'],
      source: 'heuristic',
    };
  }

  const heuristicVerdict = heuristics(trimmedText, { hasImage });
  if (!heuristicVerdict.allowed) {
    return heuristicVerdict;
  }

  const aiVerdict = await openAiModerate({
    text: trimmedText.length > 0 ? trimmedText : '[empty]',
    imageDataUrl: input.imageDataUrl,
  });
  if (!aiVerdict) {
    return heuristicVerdict;
  }

  return aiVerdict;
}

export async function moderateFaithContent(input: string): Promise<ModerationVerdict> {
  return moderateFaithPostContent({ text: input });
}
