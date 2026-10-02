import { API_URL } from './api';

// Anonymous usage events for store statistics: which products were opened and
// which contact buttons were clicked. No personal data is sent: the visitor is
// a random id kept in this browser, and search text is never included.

type EventType = 'product_view' | 'store_view' | 'contact_click';
export type ContactChannel = 'whatsapp' | 'phone' | 'instagram' | 'website';

interface EventFields {
  product_id?: string;
  store_slug?: string;
  variant_id?: string;
  channel?: ContactChannel;
}

const VISITOR_KEY = 'tapwear.visitor';
const SOURCE_KEY = 'tapwear.source';

function uuid(): string {
  return crypto.randomUUID();
}

function visitorId(): string {
  try {
    const saved = localStorage.getItem(VISITOR_KEY);
    if (saved) return saved;
    const created = uuid();
    localStorage.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    // Storage blocked: the visitor is counted per page load instead.
    return uuid();
  }
}

// Where this visit came from. A link can carry ?source=instagram (or utm_source);
// otherwise the referring site is used. Remembered for the rest of the visit.
function visitSource(): string | undefined {
  try {
    const saved = sessionStorage.getItem(SOURCE_KEY);
    if (saved !== null) return saved || undefined;
    const params = new URLSearchParams(window.location.search);
    let source = (params.get('source') ?? params.get('utm_source') ?? '').toLowerCase();
    if (!source && document.referrer) {
      const host = new URL(document.referrer).hostname.replace(/^www\./, '');
      if (host !== window.location.hostname) {
        source = host.includes('instagram') ? 'instagram' : host;
      }
    }
    source = source.replace(/[^a-z0-9_.-]/g, '').slice(0, 50);
    sessionStorage.setItem(SOURCE_KEY, source);
    return source || undefined;
  } catch {
    return undefined;
  }
}

// React's development mode runs effects twice; the same event sent again within
// two seconds is dropped so that a page view is counted once.
let last = { key: '', at: 0 };

export function track(type: EventType, fields: EventFields) {
  if (typeof window === 'undefined') return;
  const key = `${type}:${JSON.stringify(fields)}`;
  if (key === last.key && Date.now() - last.at < 2000) return;
  last = { key, at: Date.now() };
  const body = JSON.stringify({
    events: [
      {
        event_id: uuid(),
        session_id: visitorId(),
        type,
        source: visitSource(),
        occurred_at: new Date().toISOString(),
        ...fields,
      },
    ],
  });
  // keepalive lets the request finish even when the click opens another site.
  // Statistics must never break the page, so failures are ignored.
  fetch(`${API_URL}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined);
}
