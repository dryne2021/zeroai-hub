import "server-only";
import crypto from "node:crypto";

/** Readable temporary password, e.g. "Kite-7Rq4-Harbor-92". Avoids look-alike characters. */
export function temporaryPassword() {
  const words = ["Maple", "Harbor", "Cedar", "Summit", "Canyon", "Atlas", "Beacon", "Granite", "Willow", "Falcon", "River", "Orbit", "Prairie", "Juniper", "Vista", "Ember"];
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const pick = (n: number) => Array.from(crypto.randomBytes(n), (b) => chars[b % chars.length]).join("");
  const word = () => words[crypto.randomInt(words.length)];
  return `${word()}-${pick(4)}-${word()}-${crypto.randomInt(10, 99)}`;
}

export function passwordProblem(password: string): string | null {
  if (password.length < 10) return "Use at least 10 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Use both letters and numbers.";
  return null;
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
