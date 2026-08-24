const OPENAI_CLASSIFIER_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODERATION_URL = 'https://api.openai.com/v1/moderations';
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-5.6';

const CLEAR_SPAM_PATTERNS = [
  /\bbuy now\b/i,
  /\bdm (?:me )?for (?:the )?price\b/i,
  /\bsubscribe (?:to )?my channel\b/i,
  /\b(?:bitcoin|crypto) giveaway\b/i,
  /\b(?:promo|coupon) code\b/i,
  /\bcashapp\b/i,
  /\bonlyfans\b/i,
];

type ModerationVerdict = {
  allowed: boolean;
  reason: string;
  tags: string[];
  source: 'heuristic' | 'openai' | 'openai_moderation' | 'unavailable';
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

function heuristics(input: string): ModerationVerdict {
  const tags: string[] = [];

  if (/https?:\/\//i.test(input) || /www\./i.test(input)) {
    tags.push('external_link');
  }

  if (CLEAR_SPAM_PATTERNS.some((pattern) => pattern.test(input))) {
    tags.push('selling_or_spam');
  }

  if (tags.includes('selling_or_spam')) {
    return {
      allowed: false,
      reason: 'This content looks like selling, spam, or solicitation.',
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

async function openAiSafetyModerate(input: OpenAiModerationInput): Promise<ModerationVerdict | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const moderationInput: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: input.text.trim().length > 0 ? input.text : '[image-only community post]',
    },
  ];
  if (input.imageDataUrl) {
    moderationInput.push({
      type: 'image_url',
      image_url: { url: input.imageDataUrl },
    });
  }

  try {
    const response = await fetch(OPENAI_MODERATION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input: moderationInput,
      }),
    });

    if (!response.ok) {
      console.error('[social-moderation] safety_provider_failed', { status: response.status });
      return null;
    }

    const payload = (await response.json()) as {
      results?: Array<{
        flagged?: boolean;
        categories?: Record<string, boolean>;
      }>;
    };
    const result = payload.results?.[0];
    if (!result || typeof result.flagged !== 'boolean') return null;

    const tags = Object.entries(result.categories ?? {})
      .filter(([, flagged]) => flagged)
      .map(([category]) => category);

    return {
      allowed: !result.flagged,
      reason: result.flagged
        ? 'This content may be harmful or abusive and cannot be shared.'
        : 'Accepted by safety moderation.',
      tags,
      source: 'openai_moderation',
    };
  } catch (error) {
    console.error('[social-moderation] safety_provider_error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function openAiFaithClassify(input: OpenAiModerationInput): Promise<ModerationVerdict | null> {
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
        'Evaluate meaning across languages and Christian traditions, including Catholic, Orthodox, Protestant, and liturgical expressions.',
        'Do not reject content merely because it is unfamiliar or lacks common English faith keywords. Mark it unrelated only when it is clearly off-topic.',
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

  let response: Response;
  try {
    response = await fetch(OPENAI_CLASSIFIER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
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
  } catch (error) {
    console.error('[social-moderation] classifier_provider_error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

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

  const heuristicVerdict = heuristics(trimmedText);
  if (!heuristicVerdict.allowed) {
    return heuristicVerdict;
  }

  const safetyVerdict = await openAiSafetyModerate({
    text: trimmedText.length > 0 ? trimmedText : '[empty]',
    imageDataUrl: input.imageDataUrl,
  });
  if (!safetyVerdict) {
    return {
      allowed: false,
      reason: 'Safety checks are temporarily unavailable. Please try again shortly.',
      tags: ['moderation_unavailable'],
      source: 'unavailable',
    };
  }
  if (!safetyVerdict.allowed) {
    return safetyVerdict;
  }

  const aiVerdict = await openAiFaithClassify({
    text: trimmedText.length > 0 ? trimmedText : '[empty]',
    imageDataUrl: input.imageDataUrl,
  });
  if (!aiVerdict) {
    return {
      allowed: false,
      reason: 'Safety checks are temporarily unavailable. Please try again shortly.',
      tags: ['moderation_unavailable'],
      source: 'unavailable',
    };
  }

  return aiVerdict;
}

export async function moderateFaithContent(input: string): Promise<ModerationVerdict> {
  return moderateFaithPostContent({ text: input });
}

export async function moderateSocialProfileContent(input: string): Promise<ModerationVerdict> {
  const trimmedText = input.trim();
  if (trimmedText.length === 0) {
    return {
      allowed: true,
      reason: 'No public profile text to moderate.',
      tags: [],
      source: 'heuristic',
    };
  }

  const heuristicVerdict = heuristics(trimmedText);
  if (!heuristicVerdict.allowed) return heuristicVerdict;

  const safetyVerdict = await openAiSafetyModerate({ text: trimmedText });
  if (!safetyVerdict) {
    return {
      allowed: false,
      reason: 'Safety checks are temporarily unavailable. Please try again shortly.',
      tags: ['moderation_unavailable'],
      source: 'unavailable',
    };
  }
  return safetyVerdict;
}

export async function moderateSocialAvatarContent(imageDataUrl: string): Promise<ModerationVerdict> {
  const safetyVerdict = await openAiSafetyModerate({
    text: 'Public community profile avatar.',
    imageDataUrl,
  });
  if (!safetyVerdict) {
    return {
      allowed: false,
      reason: 'Safety checks are temporarily unavailable. Please try again shortly.',
      tags: ['moderation_unavailable'],
      source: 'unavailable',
    };
  }
  return safetyVerdict;
}
