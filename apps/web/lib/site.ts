// The public address of the site, used in links meant for search engines and
// link previews. Set SITE_URL on the server; locally it is the dev address.
export const SITE_URL = (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
