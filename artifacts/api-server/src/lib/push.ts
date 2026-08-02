import webpush from "web-push";
import { db, pushSubscriptionsTable, studentsTable, studentParentTable } from "@workspace/db";
import { eq, inArray, and } from "drizzle-orm";
import { logger } from "./logger";

let vapidInitialized = false;

export function initVapid(): void {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@school.example.com";

  if (!publicKey || !privateKey) {
    logger.warn("VAPID keys not configured — push notifications disabled");
    return;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidInitialized = true;
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

/**
 * Send a push notification to all parents linked to a given student via student_parent.
 */
async function sendPushToStudent(studentId: number, payload: object): Promise<void> {
  if (!vapidInitialized) return;

  // Find parent IDs linked to this student
  const links = await db
    .select({ parentId: studentParentTable.parentId })
    .from(studentParentTable)
    .where(eq(studentParentTable.studentId, studentId));

  if (links.length === 0) return;

  const parentIds = links.map((l) => l.parentId);

  // Find push subscriptions for those parents
  const subs = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(inArray(pushSubscriptionsTable.parentId, parentIds));

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
    } catch (err) {
      logger.error({ err, endpoint: sub.endpoint }, "Push send failed");
    }
  }
}

/**
 * Send a push notification to all parents of students in a class (and optionally section).
 */
async function sendPushToClass(
  classId: number,
  sectionId: number | undefined,
  payload: object
): Promise<void> {
  if (!vapidInitialized) return;

  const studentsQuery = db
    .select({ id: studentsTable.id })
    .from(studentsTable)
    .where(
      sectionId
        ? and(eq(studentsTable.classId, classId), eq(studentsTable.sectionId, sectionId))
        : eq(studentsTable.classId, classId)
    );

  const students = await studentsQuery;
  for (const s of students) {
    await sendPushToStudent(s.id, payload);
  }
}

export async function notifyHomeworkAssigned(params: {
  classId?: number;
  sectionId?: number;
  title: string;
  subject: string;
}): Promise<void> {
  try {
    const payload = {
      title: "New Homework",
      body: `${params.subject}: ${params.title}`,
      type: "homework",
    };

    if (params.classId) {
      await sendPushToClass(params.classId, params.sectionId, payload);
    } else {
      // No class filter — notify all students
      const students = await db.select({ id: studentsTable.id }).from(studentsTable);
      for (const s of students) {
        await sendPushToStudent(s.id, payload);
      }
    }
  } catch (err) {
    logger.error({ err }, "notifyHomeworkAssigned failed");
  }
}

export async function notifyResultsPublished(params: {
  examId: number;
  examName: string;
}): Promise<void> {
  try {
    const payload = {
      title: "Results Published",
      body: `Results for ${params.examName} are now available`,
      type: "results",
    };

    const students = await db.select({ id: studentsTable.id }).from(studentsTable);
    for (const s of students) {
      await sendPushToStudent(s.id, payload);
    }
  } catch (err) {
    logger.error({ err }, "notifyResultsPublished failed");
  }
}
