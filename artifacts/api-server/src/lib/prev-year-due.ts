// Server-side mirror of the frontend's per-month "Previous Year Due" helper
// (artifacts/school-mgmt/src/lib/prev-year-due.ts). Kept in sync manually
// since the two packages don't share a lib for this. Used to validate which
// previous-due months a parent/guest selected and compute the payable amount
// server-side rather than trusting a client-supplied total.

export const PREV_YEAR_MONTHS = [
  { num: 4, label: "April" }, { num: 5, label: "May" }, { num: 6, label: "June" },
  { num: 7, label: "July" }, { num: 8, label: "August" }, { num: 9, label: "September" },
  { num: 10, label: "October" }, { num: 11, label: "November" }, { num: 12, label: "December" },
  { num: 1, label: "January" }, { num: 2, label: "February" }, { num: 3, label: "March" },
];

function parsePrevYearMonthlyAmounts(remarks: string | null | undefined): Record<number, string> {
  try {
    if (remarks && remarks.startsWith("{")) {
      const parsed = JSON.parse(remarks) as Record<string, number | string>;
      const result: Record<number, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        result[parseInt(k, 10)] = String(v);
      }
      return result;
    }
  } catch { /* ignore malformed remarks */ }
  return {};
}

export interface PrevYearDueMonthEntry {
  month: number;
  amount: number;
}

function getPrevYearDueMonths(remarks: string | null | undefined): PrevYearDueMonthEntry[] {
  const amounts = parsePrevYearMonthlyAmounts(remarks);
  return PREV_YEAR_MONTHS
    .map(({ num }) => ({ month: num, amount: parseFloat(amounts[num] || "0") || 0 }))
    .filter(entry => entry.amount > 0);
}

/**
 * Per-month breakdown with amounts already paid deducted FIFO (session
 * order), mirroring the frontend display. Fully paid-off months are dropped.
 */
export function getPrevYearDueMonthsRemaining(
  remarks: string | null | undefined,
  paidSoFar: number,
): PrevYearDueMonthEntry[] {
  let remainingToDeduct = Math.max(0, paidSoFar);
  const result: PrevYearDueMonthEntry[] = [];
  for (const entry of getPrevYearDueMonths(remarks)) {
    const deduction = Math.min(entry.amount, remainingToDeduct);
    remainingToDeduct -= deduction;
    const remaining = entry.amount - deduction;
    if (remaining > 0) result.push({ ...entry, amount: remaining });
  }
  return result;
}

/**
 * Computes the amount payable for a previous-due request, validated against
 * server-side data rather than trusting the client:
 * - If a monthly breakdown exists, the client MUST supply a non-empty,
 *   valid `prevDueMonths` selection — the amount is the sum of just those
 *   months' remaining balances. A request with no valid month selected is
 *   rejected (returns 0) rather than silently charging the full balance,
 *   so the charged amount always matches what the client displayed/selected.
 * - Only when there is NO monthly breakdown at all (old-style lump due, no
 *   `previousYearDueRemarks` JSON) does it fall back to the full remaining
 *   lump amount — that's the only case with no months to select from.
 */
export function resolvePrevDueAmount(
  remarks: string | null | undefined,
  prevDueRemaining: number,
  paidSoFar: number,
  prevDueMonths: number[] | undefined,
  includePrevDue: boolean | undefined,
): number {
  if (!includePrevDue) return 0;
  const remainingMonths = getPrevYearDueMonthsRemaining(remarks, paidSoFar);
  if (remainingMonths.length === 0) return prevDueRemaining;

  if (!Array.isArray(prevDueMonths) || prevDueMonths.length === 0) return 0;
  const selected = new Set(prevDueMonths.map(m => Number(m)));
  const sum = remainingMonths
    .filter(entry => selected.has(entry.month))
    .reduce((s, entry) => s + entry.amount, 0);
  return Math.min(sum, prevDueRemaining);
}
