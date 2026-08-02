import { Lock } from "lucide-react";

export type SessionStatus = "promoted" | "detained" | "dropped" | null;

/** Derives promotion outcome from the student_type suffix set by the promotion wizard. */
export function getSessionStatus(studentType?: string | null): SessionStatus {
  const t = (studentType ?? "").toLowerCase();
  if (t.includes("/promoted")) return "promoted";
  if (t.includes("/detained")) return "detained";
  if (t.includes("/dropped")) return "dropped";
  return null;
}

/**
 * Small pill badge shown on any student who has been processed through
 * the Year-End Promotion Wizard (promoted, detained, or dropped).
 * Returns null for students not yet processed.
 */
export function SessionStatusBadge({ studentType }: { studentType?: string | null }) {
  const status = getSessionStatus(studentType);
  if (!status) return null;

  const styles: Record<NonNullable<SessionStatus>, string> = {
    promoted:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
    detained:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
    dropped:
      "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  };

  const labels: Record<NonNullable<SessionStatus>, string> = {
    promoted: "Promoted",
    detained: "Detained",
    dropped: "Dropped",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${styles[status]}`}
    >
      <Lock className="h-2.5 w-2.5 shrink-0" />
      {labels[status]}
    </span>
  );
}
