/**
 * Mask mobile number: show only last 4 digits (e.g. XXXXXX1234).
 * Used for NBFC Admin in ready-for-disbursement and profile contexts.
 */
export function maskMobileLast4(mobile: string | null | undefined): string {
  if (mobile == null || typeof mobile !== 'string') return mobile ?? '—';
  const s = String(mobile).trim();
  if (s.length === 0) return '—';
  if (s.length <= 4) return 'XXXX';
  return 'XXXXXX' + s.slice(-4);
}
