// The public address of the site, used in links meant for search engines and
// link previews. Set SITE_URL on the server; locally it is the dev address.
export const SITE_URL = (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

// Who runs the service and how to reach it, shown on the legal and contact pages.
// Set the real values on the server once the ИП is registered and the mailbox exists.
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@tapwear.kg';
export const OPERATOR_NAME = process.env.NEXT_PUBLIC_OPERATOR_NAME ?? 'владелец сервиса TapWear';
