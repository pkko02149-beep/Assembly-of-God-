// Shared helpers for the per-month "Previous Year Due" breakdown.
// Admins enter this breakdown on the Records tab, which stores it as a JSON
// string (month number -> amount) in the student's `previousYearDueRemarks`
// column. Older records may have plain text remarks or none at all — in that
// case there is no monthly breakdown and callers should fall back to showing
// just the lump total.

export const PREV_YEAR_MONTHS = [
  { num: 4, label: "April" }, { num: 5, label: "May" }, { num: 6, label: "June" },
  { num: 7, label: "July" }, { num: 8, label: "August" }, { num: 9, label: "September" },
  { num: 10, label: "October" }, { num: 11, label: "November" }, { num: 12, label: "December" },
  { num: 1, label: "January" }, { num: 2, label: "February" }, { num: 3, label: "March" },
];

export function parsePrevYearMonthlyAmounts(remarks: string | null | undefined): Record<number, string> {
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
  label: string;
  amount: number;
}

export interface PrevYearDueMonthStatus extends PrevYearDueMonthEntry {
  /** Original amount owed for this month, before deducting payments. */
  originalAmount: number;
  paid: boolean;
}

/** Returns the per-month breakdown (months with a positive amount only), in session order. */
export function getPrevYearDueMonths(remarks: string | null | undefined): PrevYearDueMonthEntry[] {
  const amounts = parsePrevYearMonthlyAmounts(remarks);
  return PREV_YEAR_MONTHS
    .map(({ num, label }) => ({ month: num, label, amount: parseFloat(amounts[num] || "0") || 0 }))
    .filter(entry => entry.amount > 0);
}

/**
 * Returns the per-month breakdown with amounts already paid deducted, so the
 * boxes always sum to the actual outstanding `prevDueRemaining` total rather
 * than the original lump breakdown. Previous-due payments aren't recorded
 * against a specific month (they carry `month: 0`), so paid amounts are
 * applied earliest-month-first (session order) as a reasonable allocation.
 * Fully paid-off months are dropped from the result.
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
 * Returns the per-month breakdown for ALL months that have a due amount,
 * including months that are fully paid off. Unlike `getPrevYearDueMonthsRemaining`,
 * paid-off months are kept in the result (with `paid: true` and `amount: 0`)
 * so the UI can keep showing the box with a Paid badge instead of hiding it.
 */
export function getPrevYearDueMonthsAll(
  remarks: string | null | undefined,
  paidSoFar: number,
): PrevYearDueMonthStatus[] {
  let remainingToDeduct = Math.max(0, paidSoFar);
  const result: PrevYearDueMonthStatus[] = [];
  for (const entry of getPrevYearDueMonths(remarks)) {
    const deduction = Math.min(entry.amount, remainingToDeduct);
    remainingToDeduct -= deduction;
    const remaining = entry.amount - deduction;
    result.push({ ...entry, originalAmount: entry.amount, amount: remaining, paid: remaining <= 0 });
  }
  return result;
}
