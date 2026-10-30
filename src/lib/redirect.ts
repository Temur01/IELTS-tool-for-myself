// Only same-site paths: "//evil.com" or "/\evil.com" would be read by browsers as another host.
export function safeRedirectPath(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/';
}
