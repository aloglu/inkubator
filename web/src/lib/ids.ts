/**
 * New ids in the server's format (`<prefix>_<32 hex>`). Uses getRandomValues,
 * which, unlike randomUUID, also works on plain-http pages such as a
 * self-hosted server reached by its LAN address.
 */
export function newId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
