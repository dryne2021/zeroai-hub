// Mirrors the database trigger (mask_contact_details) so the composer can warn before sending.
const EMAIL = /[A-Za-z0-9._%+-]+\s*(@|\(at\)|\[at\])\s*[A-Za-z0-9-]+((\.|\s*\(dot\)\s*|\s*\[dot\]\s*)[A-Za-z]{2,})+/gi;
const SPELLED_EMAIL = /[A-Za-z0-9._%+-]+\s+at\s+[A-Za-z0-9-]+\s+dot\s+[A-Za-z]{2,}/gi;
const PHONE_CANDIDATE = /\+?\d[\d\s\-.()]{6,}\d/g;
const LINKS = /(wa\.me|whatsapp\.com|t\.me|telegram\.me)\/\S+/gi;

export function containsContactDetails(text: string) {
  return maskContactDetails(text).masked;
}

export function maskContactDetails(text: string): { text: string; masked: boolean } {
  let out = text.replace(EMAIL, "[email hidden]").replace(SPELLED_EMAIL, "[email hidden]");
  out = out.replace(PHONE_CANDIDATE, (m) => (m.replace(/\D/g, "").length >= 9 ? "[phone hidden]" : m));
  out = out.replace(LINKS, "[link hidden]");
  return { text: out, masked: out !== text };
}
