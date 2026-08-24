export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound?: 'default' | null;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  data?: Record<string, unknown>;
};

export type ExpoPushTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};

export type ExpoPushReceipt = {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
};

const EXPO_SEND_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

function headers() {
  const result: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (process.env.EXPO_ACCESS_TOKEN) {
    result.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }
  return result;
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

export async function sendExpoPushMessages(messages: ExpoPushMessage[]) {
  const tickets: ExpoPushTicket[] = [];
  for (const batch of chunks(messages, 100)) {
    const response = await fetch(EXPO_SEND_URL, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(batch),
    });
    const payload = await response.json().catch(() => null) as { data?: ExpoPushTicket[]; errors?: unknown } | null;
    if (!response.ok || !payload?.data) {
      throw new Error(`Expo push request failed (${response.status})`);
    }
    tickets.push(...payload.data);
  }
  return tickets;
}

export async function getExpoPushReceipts(ticketIds: string[]) {
  const receipts: Record<string, ExpoPushReceipt> = {};
  for (const batch of chunks(ticketIds, 1000)) {
    const response = await fetch(EXPO_RECEIPTS_URL, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ ids: batch }),
    });
    const payload = await response.json().catch(() => null) as { data?: Record<string, ExpoPushReceipt> } | null;
    if (!response.ok || !payload?.data) {
      throw new Error(`Expo receipt request failed (${response.status})`);
    }
    Object.assign(receipts, payload.data);
  }
  return receipts;
}
