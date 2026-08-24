/** Shared URL guard: only http(s) links may be stored or rendered as hrefs. */

export function isSafeHttpUrl(value: string): boolean {
  const raw = value.trim();
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Normalises a user-entered link, adding https:// when no scheme is present. */
export function normalizeHttpUrl(value: string | null | undefined, label = "Link"): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  if (!isSafeHttpUrl(candidate)) {
    throw new Error(`${label} must be a valid http(s) URL.`);
  }
  return candidate;
}

/** Safe for rendering: returns undefined when the stored value is not http(s). */
export function safeHref(value: string | null | undefined): string | undefined {
  const raw = (value ?? "").trim();
  if (!raw) return undefined;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  return isSafeHttpUrl(candidate) ? candidate : undefined;
}
