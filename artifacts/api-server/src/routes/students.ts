import { Router } from "express";
import { db, studentsTable, vehiclesTable, tripsTable, classesTable, sectionsTable, transportRoutesTable, parentsTable, studentParentTable, teacherAdmissionPermissionsTable, teachersTable, appSettingsTable } from "@workspace/db";
import { eq, ilike, and, inArray, type SQL } from "drizzle-orm";
import { getCurrentSessionName } from "../lib/session-context";
import bcrypt from "bcryptjs";
import { requireAuth } from "../lib/auth-middleware";
import { sendAdmissionEmail } from "../lib/mailer";

const router = Router();

async function getSchoolSettings() {
  const rows = await db
    .select({ key: appSettingsTable.key, value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(inArray(appSettingsTable.key, ["school_name", "school_address", "school_contact_number", "school_email", "school_logo_url"]));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

function getPortalOrigin(req: any): string {
  const origin = req.headers["origin"] as string | undefined;
  if (origin) return origin.replace(/\/$/, "");
  const host = req.headers["host"] as string | undefined;
  const proto = (req.headers["x-forwarded-proto"] as string | undefined) || (req.socket?.encrypted ? "https" : "http");
  return host ? `${proto}://${host}` : "";
}

const fullSelect = {
  id: studentsTable.id,
  uniqueId: studentsTable.uniqueId,
  rollNo: studentsTable.rollNo,
  studentName: studentsTable.studentName,
  fatherName: studentsTable.fatherName,
  vehicleId: studentsTable.vehicleId,
  vehicleName: vehiclesTable.name,
  tripId: studentsTable.tripId,
  tripName: tripsTable.name,
  classId: studentsTable.classId,
  className: classesTable.name,
  sectionId: studentsTable.sectionId,
  sectionName: sectionsTable.name,
  whatsappNumber: studentsTable.whatsappNumber,
  parentEmail: studentsTable.parentEmail,
  address: studentsTable.address,
  hasVehicle: studentsTable.hasVehicle,
  hasTrip: studentsTable.hasTrip,
  transportRouteId: studentsTable.transportRouteId,
  transportMonths: studentsTable.transportMonths,
  transportFromMonth: studentsTable.transportFromMonth,
  transportStopMonth: studentsTable.transportStopMonth,
  transportRouteName: transportRoutesTable.name,
  transportRoutePricePerMonth: transportRoutesTable.pricePerMonth,
  photoUrl: studentsTable.photoUrl,
  admissionDate: studentsTable.admissionDate,
  dateOfBirth: studentsTable.dateOfBirth,
  motherName: studentsTable.motherName,
  aadharNumber: studentsTable.aadharNumber,
  panNumber: studentsTable.panNumber,
  gender: studentsTable.gender,
  previousSchool: studentsTable.previousSchool,
  studentType: studentsTable.studentType,
  isPromoted: studentsTable.isPromoted,
  session: studentsTable.session,
  previousYearDue: studentsTable.previousYearDue,
  previousYearDueRemarks: studentsTable.previousYearDueRemarks,
  feeFromApril: studentsTable.feeFromApril,
  category: studentsTable.category,
  religion: studentsTable.religion,
  bloodGroup: studentsTable.bloodGroup,
  nationality: studentsTable.nationality,
  emergencyContact: studentsTable.emergencyContact,
  createdAt: studentsTable.createdAt,
};

const joins = (q: any) => q
  .leftJoin(vehiclesTable, eq(studentsTable.vehicleId, vehiclesTable.id))
  .leftJoin(tripsTable, eq(studentsTable.tripId, tripsTable.id))
  .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
  .leftJoin(sectionsTable, eq(studentsTable.sectionId, sectionsTable.id))
  .leftJoin(transportRoutesTable, eq(studentsTable.transportRouteId, transportRoutesTable.id));

const toISO = (r: any) => ({
  ...r,
  uniqueId: r.uniqueId ?? "",
  transportRoutePricePerMonth: r.transportRoutePricePerMonth != null ? parseFloat(r.transportRoutePricePerMonth) : null,
  createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
});

async function generateRollAndId(cId: number, sId: number, sessionName: string) {
  // Roll number: sequential within the class+section (used for exam rolls etc.)
  const inSection = await db.select({ id: studentsTable.id })
    .from(studentsTable)
    .where(and(eq(studentsTable.classId, cId), eq(studentsTable.sectionId, sId)));
  const rollNo = inSection.length + 1;

  // Enrollment serial: use MAX of existing serials so deletions never cause
  // a serial to be reused. Parse the leading integer from each stored uniqueId.
  const allInSession = await db.select({ uniqueId: studentsTable.uniqueId }).from(studentsTable);
  const maxSerial = allInSession.reduce((max, s) => {
    const n = parseInt((s.uniqueId ?? "").split("/")[0] ?? "0", 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 0);
  const serial = maxSerial + 1;

  // Parse session name: "2027-2028" or "2027-28" → startShort="27", endShort="28"
  const parts = (sessionName || "").split("-");
  const startShort = (parts[0] ?? String(new Date().getFullYear())).slice(-2);
  const endShort = (parts[parts.length - 1] ?? "").slice(-2);
  const uniqueId = `${serial}/${startShort}/${endShort}`;

  return { rollNo, uniqueId };
}

// ── Public search endpoint (no auth) — safe fields only ─────────────────────
router.get("/students/public/search", async (req, res) => {
  const { uniqueId, name, fatherName, classId } = req.query;

  // Public-safe fields only — no DOB, Aadhar, phone, email, or contact details
  // Financial transport fields (hasVehicle, previousYearDue etc.) are included because
  // they are required for the fee register calculation on the public payment page.
  const safeSelect = {
    id: studentsTable.id,
    uniqueId: studentsTable.uniqueId,
    rollNo: studentsTable.rollNo,
    studentName: studentsTable.studentName,
    fatherName: studentsTable.fatherName,
    className: classesTable.name,
    sectionName: sectionsTable.name,
    classId: studentsTable.classId,
    photoUrl: studentsTable.photoUrl,
    previousYearDue: studentsTable.previousYearDue,
    previousYearDueRemarks: studentsTable.previousYearDueRemarks,
    hasVehicle: studentsTable.hasVehicle,
    transportFromMonth: studentsTable.transportFromMonth,
    transportStopMonth: studentsTable.transportStopMonth,
    transportRoutePricePerMonth: transportRoutesTable.pricePerMonth,
    studentType: studentsTable.studentType,
  };

  if (uniqueId && typeof uniqueId === "string" && uniqueId.trim()) {
    const [row] = await joins(
      db.select(safeSelect).from(studentsTable)
    ).where(eq(studentsTable.uniqueId, uniqueId.trim()));
    if (!row) return res.status(404).json({ error: "Student not found with this admission number" });
    return res.json([{ ...row, transportRoutePricePerMonth: row.transportRoutePricePerMonth != null ? parseFloat(row.transportRoutePricePerMonth as string) : null }]);
  }

  if (name && typeof name === "string" && name.trim()) {
    const conditions: SQL[] = [ilike(studentsTable.studentName, `%${name.trim()}%`)];
    if (fatherName && typeof fatherName === "string" && fatherName.trim()) {
      conditions.push(ilike(studentsTable.fatherName, `%${fatherName.trim()}%`));
    }
    if (classId) {
      const cId = parseInt(classId as string, 10);
      if (!isNaN(cId)) conditions.push(eq(studentsTable.classId, cId));
    }
    const rows = await joins(
      db.select(safeSelect).from(studentsTable)
    ).where(and(...conditions));
    return res.json(rows.map((r: any) => ({ ...r, transportRoutePricePerMonth: r.transportRoutePricePerMonth != null ? parseFloat(r.transportRoutePricePerMonth as string) : null })));
  }

  return res.status(400).json({ error: "Provide admissionNo or studentName to search" });
});

// ── Public endpoint (no auth) — safe fields only ──────────────────────────
router.get("/students/public/:enrollmentId", async (req, res) => {
  const { enrollmentId } = req.params;
  const [row] = await joins(
    db.select({
      id: studentsTable.id,
      uniqueId: studentsTable.uniqueId,
      rollNo: studentsTable.rollNo,
      studentName: studentsTable.studentName,
      fatherName: studentsTable.fatherName,
      motherName: studentsTable.motherName,
      className: classesTable.name,
      sectionName: sectionsTable.name,
      session: studentsTable.session,
      admissionDate: studentsTable.admissionDate,
      studentType: studentsTable.studentType,
      gender: studentsTable.gender,
      category: studentsTable.category,
      photoUrl: studentsTable.photoUrl,
      dateOfBirth: studentsTable.dateOfBirth,
    }).from(studentsTable)
  ).where(eq(studentsTable.uniqueId, enrollmentId));
  if (!row) return res.status(404).json({ error: "Student not found" });
  return res.json(row);
});

router.get("/students/by-uid/:uniqueId", requireAuth("admin"), async (req, res) => {
  const uniqueId = req.params['uniqueId'] as string;
  const [row] = await joins(
    db.select(fullSelect).from(studentsTable)
  ).where(eq(studentsTable.uniqueId, uniqueId));
  if (!row) return res.status(404).json({ error: "Student not found" });
  return res.json(toISO(row));
});

router.get("/students/next-roll", requireAuth("admin"), async (req, res) => {
  const cId = parseInt(req.query.classId as string, 10);
  const sId = parseInt(req.query.sectionId as string, 10);
  if (isNaN(cId) || isNaN(sId)) return res.status(400).json({ error: "classId and sectionId are required" });
  const sessionName = getCurrentSessionName() || "";
  const result = await generateRollAndId(cId, sId, sessionName);
  return res.json(result);
});

router.get("/students", requireAuth("admin", "teacher"), async (req, res) => {
  const { search, vehicleId, classId, sectionId, tripId } = req.query;
  const role = (req as any).user?.role;
  // Teachers must always filter by classId (they can only see their own class)
  if (role === "teacher" && !classId) {
    return res.status(403).json({ error: "Teachers must filter by classId" });
  }
  const conditions: SQL[] = [];

  if (search && typeof search === "string" && search.trim())
    conditions.push(ilike(studentsTable.studentName, `%${search.trim()}%`));
  if (vehicleId) { const id = parseInt(vehicleId as string, 10); if (!isNaN(id)) conditions.push(eq(studentsTable.vehicleId, id)); }
  if (classId)   { const id = parseInt(classId as string, 10);   if (!isNaN(id)) conditions.push(eq(studentsTable.classId, id)); }
  if (sectionId) { const id = parseInt(sectionId as string, 10); if (!isNaN(id)) conditions.push(eq(studentsTable.sectionId, id)); }
  if (tripId)    { const id = parseInt(tripId as string, 10);    if (!isNaN(id)) conditions.push(eq(studentsTable.tripId, id)); }

  const rows = await joins(
    db.select(fullSelect).from(studentsTable)
  ).where(conditions.length > 0 ? and(...conditions) : undefined)
   .orderBy(studentsTable.classId, studentsTable.sectionId, studentsTable.rollNo);

  return res.json(rows.map(toISO));
});

router.post("/students", requireAuth("admin", "teacher"), async (req, res) => {
  const role = (req as any).user?.role;
  const teacherId = (req as any).user?.id;

  const {
    studentName, fatherName, vehicleId, tripId, classId, sectionId,
    whatsappNumber, parentEmail, address, hasVehicle, hasTrip,
    transportRouteId, transportMonths, transportFromMonth,
    photoUrl, admissionDate, dateOfBirth, motherName, aadharNumber,
    panNumber, gender, previousSchool, studentType, session, previousYearDue, previousYearDueRemarks, feeFromApril,
    category, religion, bloodGroup, nationality, emergencyContact,
  } = req.body;

  if (!studentName || !classId || !sectionId) {
    return res.status(400).json({ error: "studentName, classId, sectionId are required" });
  }

  // Teachers: validate permission and class/section restriction
  if (role === "teacher") {
    const [perm] = await db.select().from(teacherAdmissionPermissionsTable).where(eq(teacherAdmissionPermissionsTable.teacherId, teacherId));
    if (!perm || perm.isLocked || (perm.expiresAt && perm.expiresAt <= new Date())) {
      return res.status(403).json({ error: "Student Records tab is currently locked. Contact admin." });
    }
    const [teacher] = await db.select({ classAssigned: teachersTable.classAssigned, sectionAssigned: teachersTable.sectionAssigned })
      .from(teachersTable).where(eq(teachersTable.id, teacherId));
    if (!teacher?.classAssigned || !teacher?.sectionAssigned) {
      return res.status(403).json({ error: "You are not assigned to a class and section." });
    }
    if (parseInt(classId, 10) !== teacher.classAssigned || parseInt(sectionId, 10) !== teacher.sectionAssigned) {
      return res.status(403).json({ error: "You can only add students to your assigned class and section." });
    }
  }

  const cId = parseInt(classId, 10);
  const sId = parseInt(sectionId, 10);
  // Use the session sent by the client; fall back to the server-side current session
  const sessionForId = (session ? String(session).trim() : null) || getCurrentSessionName() || "";
  const { rollNo, uniqueId } = await generateRollAndId(cId, sId, sessionForId);

  const [student] = await db.insert(studentsTable).values({
    uniqueId,
    rollNo,
    studentName: String(studentName).trim(),
    fatherName: fatherName ? String(fatherName).trim() : "",
    vehicleId: hasVehicle && vehicleId ? parseInt(vehicleId, 10) : null,
    tripId: hasTrip && tripId ? parseInt(tripId, 10) : null,
    classId: cId,
    sectionId: sId,
    whatsappNumber: whatsappNumber ? String(whatsappNumber).trim() : "",
    parentEmail: parentEmail ? String(parentEmail).trim() : "",
    address: address ? String(address).trim() : "",
    hasVehicle: !!hasVehicle,
    hasTrip: !!hasTrip,
    transportRouteId: hasVehicle && transportRouteId ? parseInt(transportRouteId, 10) : null,
    transportMonths: transportMonths ? parseInt(transportMonths, 10) : 12,
    transportFromMonth: transportFromMonth !== undefined ? parseInt(transportFromMonth) || 4 : 4,
    photoUrl: photoUrl ? String(photoUrl) : "",
    admissionDate: admissionDate ? String(admissionDate).trim() : "",
    dateOfBirth: dateOfBirth ? String(dateOfBirth).trim() : "",
    motherName: motherName ? String(motherName).trim() : "",
    aadharNumber: aadharNumber ? String(aadharNumber).trim() : "",
    panNumber: panNumber ? String(panNumber).trim() : "",
    gender: gender ? String(gender).trim() : "",
    previousSchool: previousSchool ? String(previousSchool).trim() : "",
    studentType: studentType ? String(studentType).trim() : "",
    session: session ? String(session).trim() : "",
    previousYearDue: previousYearDue != null ? String(parseFloat(previousYearDue) || 0) : "0",
    previousYearDueRemarks: previousYearDueRemarks ? String(previousYearDueRemarks).trim() : "",
    feeFromApril: !!feeFromApril,
    category: category ? String(category).trim() : "",
    religion: religion ? String(religion).trim() : "",
    bloodGroup: bloodGroup ? String(bloodGroup).trim() : "",
    nationality: nationality ? String(nationality).trim() : "",
    emergencyContact: emergencyContact ? String(emergencyContact).trim() : "",
  }).returning();

  const [full] = await joins(
    db.select(fullSelect).from(studentsTable)
  ).where(eq(studentsTable.id, student.id));

  // Guard: if the join unexpectedly returns nothing, fall back to the
  // plain inserted row so we always return valid JSON.
  const responseData = full ?? student;

  // Auto-create or find parent account and link the student
  if (parentEmail) {
    const emailLower = String(parentEmail).trim().toLowerCase();
    if (emailLower) {
      try {
        const [existingParent] = await db.select().from(parentsTable).where(eq(parentsTable.email, emailLower));
        let parentId: number;
        let plainPassword: string | null = null;
        let isNewParent = false;

        if (existingParent) {
          parentId = existingParent.id;
        } else {
          const randomPass = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 6);
          plainPassword = randomPass;
          isNewParent = true;
          const passwordHash = await bcrypt.hash(randomPass, 10);
          const [newParent] = await db.insert(parentsTable).values({
            email: emailLower,
            fatherName: fatherName ? String(fatherName).trim() : "",
            motherName: motherName ? String(motherName).trim() : "",
            mobile: whatsappNumber ? String(whatsappNumber).trim() : "",
            passwordHash,
            mustChangePassword: true,
          }).returning();
          parentId = newParent.id;
        }

        await db.insert(studentParentTable).values({ parentId, studentId: student.id })
          .onConflictDoNothing();

        // Send admission email: credentials for new parents, details-only for existing ones
        const portalOrigin = getPortalOrigin(req);
        const capturedPassword = plainPassword;
        const capturedIsNew = isNewParent;
        Promise.resolve().then(async () => {
          const settings = await getSchoolSettings();
          await sendAdmissionEmail({
            parentEmail: emailLower,
            ...(capturedIsNew && capturedPassword ? { parentPassword: capturedPassword } : {}),
            studentName: String(studentName).trim(),
            fatherName: fatherName ? String(fatherName).trim() : "",
            motherName: motherName ? String(motherName).trim() : "",
            className: (responseData as any).className ?? "",
            sectionName: (responseData as any).sectionName ?? "",
            uniqueId: (responseData as any).uniqueId ?? "",
            gender: gender ? String(gender).trim() : "",
            dateOfBirth: dateOfBirth ? String(dateOfBirth).trim() : "",
            admissionDate: admissionDate ? String(admissionDate).trim() : "",
            bloodGroup: bloodGroup ? String(bloodGroup).trim() : "",
            address: address ? String(address).trim() : "",
            whatsappNumber: whatsappNumber ? String(whatsappNumber).trim() : "",
            photoUrl: photoUrl ? String(photoUrl) : "",
            session: session ? String(session).trim() : "",
            portalUrl: portalOrigin,
            schoolName: settings["school_name"] || "",
            schoolAddress: settings["school_address"] || "",
            schoolPhone: settings["school_contact_number"] || "",
            schoolEmail: settings["school_email"] || "",
            schoolLogoUrl: settings["school_logo_url"] || "",
          });
        }).catch((err) => { /* non-fatal — student already saved */ void err; });
      } catch {
        // Non-fatal: student is created regardless
      }
    }
  }

  return res.status(201).json(toISO(responseData));
});

router.patch("/students/:id", requireAuth("admin"), async (req, res) => {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });

  // Capture old parentEmail before update so we can detect changes
  const [existingStudent] = await db
    .select({ parentEmail: studentsTable.parentEmail })
    .from(studentsTable)
    .where(eq(studentsTable.id, id));
  const oldParentEmail = existingStudent?.parentEmail?.toLowerCase().trim() ?? "";

  const {
    studentName, fatherName, vehicleId, tripId, classId, sectionId,
    whatsappNumber, parentEmail, address, hasVehicle, hasTrip,
    transportRouteId, transportMonths, transportFromMonth,
    photoUrl, admissionDate, dateOfBirth, motherName, aadharNumber,
    panNumber, gender, previousSchool, studentType, session, previousYearDue, previousYearDueRemarks, feeFromApril,
    category, religion, bloodGroup, nationality, emergencyContact,
  } = req.body;

  if (!studentName || !classId || !sectionId) {
    return res.status(400).json({ error: "studentName, classId, sectionId are required" });
  }

  const studentUpdates: any = {
    studentName: String(studentName).trim(),
    fatherName: fatherName ? String(fatherName).trim() : "",
    vehicleId: vehicleId != null ? parseInt(String(vehicleId), 10) : null,
    tripId: tripId != null ? parseInt(String(tripId), 10) : null,
    classId: parseInt(classId, 10),
    sectionId: parseInt(sectionId, 10),
    whatsappNumber: whatsappNumber ? String(whatsappNumber).trim() : "",
    parentEmail: parentEmail ? String(parentEmail).trim() : "",
    address: address ? String(address).trim() : "",
    hasVehicle: !!hasVehicle,
    hasTrip: !!hasTrip,
    transportRouteId: transportRouteId != null ? parseInt(String(transportRouteId), 10) : null,
    transportMonths: transportMonths ? parseInt(transportMonths, 10) : 12,
    transportFromMonth: transportFromMonth !== undefined ? parseInt(transportFromMonth) || 4 : 4,
    photoUrl: photoUrl !== undefined ? String(photoUrl) : "",
    admissionDate: admissionDate ? String(admissionDate).trim() : "",
    dateOfBirth: dateOfBirth ? String(dateOfBirth).trim() : "",
    motherName: motherName ? String(motherName).trim() : "",
    aadharNumber: aadharNumber ? String(aadharNumber).trim() : "",
    panNumber: panNumber ? String(panNumber).trim() : "",
    gender: gender ? String(gender).trim() : "",
    previousSchool: previousSchool ? String(previousSchool).trim() : "",
    studentType: studentType ? String(studentType).trim() : "",
    session: session ? String(session).trim() : "",
    // Only overwrite previousYearDue when the caller explicitly sends it.
    // Absent (undefined) means "leave as-is"; using != null here would map
    // undefined → "0" because undefined == null is true in JS, silently
    // wiping the existing value on every partial update (e.g. record-list-tab).
    ...(previousYearDue !== undefined ? {
      previousYearDue: previousYearDue != null ? String(parseFloat(previousYearDue) || 0) : "0",
    } : {}),
    ...(previousYearDueRemarks !== undefined ? {
      previousYearDueRemarks: String(previousYearDueRemarks).trim(),
    } : {}),
    // Same defensive pattern: only overwrite when explicitly sent by the caller.
    // Callers that omit these fields (e.g. partial transport-only PATCHes) must
    // not silently reset them to false/"".
    ...(feeFromApril !== undefined ? { feeFromApril: !!feeFromApril } : {}),
    ...(category !== undefined ? { category: String(category).trim() } : {}),
    ...(religion !== undefined ? { religion: String(religion).trim() } : {}),
    ...(bloodGroup !== undefined ? { bloodGroup: String(bloodGroup).trim() } : {}),
    ...(nationality !== undefined ? { nationality: String(nationality).trim() } : {}),
    ...(emergencyContact !== undefined ? { emergencyContact: String(emergencyContact).trim() } : {}),
  };
  if ("transportStopMonth" in req.body) {
    studentUpdates.transportStopMonth = req.body.transportStopMonth !== null && req.body.transportStopMonth !== undefined
      ? parseInt(req.body.transportStopMonth)
      : null;
  }
  await db.update(studentsTable).set(studentUpdates).where(eq(studentsTable.id, id));

  const [full] = await joins(
    db.select(fullSelect).from(studentsTable)
  ).where(eq(studentsTable.id, id));

  // Auto-create or update parent link when parentEmail is added or changed
  const newParentEmail = parentEmail ? String(parentEmail).trim().toLowerCase() : "";
  if (newParentEmail && newParentEmail !== oldParentEmail) {
    try {
      // Remove existing student-parent links for this student if email changed
      if (oldParentEmail) {
        const [oldParent] = await db.select({ id: parentsTable.id })
          .from(parentsTable).where(eq(parentsTable.email, oldParentEmail));
        if (oldParent) {
          await db.delete(studentParentTable)
            .where(and(eq(studentParentTable.studentId, id), eq(studentParentTable.parentId, oldParent.id)));
        }
      }
      // Find or create parent with new email
      const [existingParent] = await db.select().from(parentsTable).where(eq(parentsTable.email, newParentEmail));
      let parentId: number;
      let patchPlainPassword: string | null = null;
      let patchIsNewParent = false;
      if (existingParent) {
        parentId = existingParent.id;
      } else {
        const randomPass = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 6);
        patchPlainPassword = randomPass;
        patchIsNewParent = true;
        const passwordHash = await bcrypt.hash(randomPass, 10);
        const [newParent] = await db.insert(parentsTable).values({
          email: newParentEmail,
          fatherName: fatherName ? String(fatherName).trim() : "",
          motherName: full?.motherName ? String(full.motherName).trim() : "",
          mobile: whatsappNumber ? String(whatsappNumber).trim() : "",
          passwordHash,
          mustChangePassword: true,
        }).returning();
        parentId = newParent.id;
      }
      await db.insert(studentParentTable).values({ parentId, studentId: id }).onConflictDoNothing();

      // Send admission email when parentEmail changes (new parent = with credentials, existing = details only)
      if (full) {
        const portalOrigin = getPortalOrigin(req);
        const capturedPass = patchPlainPassword;
        const capturedIsNew = patchIsNewParent;
        const capturedFull = full;
        Promise.resolve().then(async () => {
          const settings = await getSchoolSettings();
          await sendAdmissionEmail({
            parentEmail: newParentEmail,
            ...(capturedIsNew && capturedPass ? { parentPassword: capturedPass } : {}),
            studentName: capturedFull.studentName,
            fatherName: capturedFull.fatherName ?? "",
            motherName: capturedFull.motherName ?? "",
            className: (capturedFull as any).className ?? "",
            sectionName: (capturedFull as any).sectionName ?? "",
            uniqueId: capturedFull.uniqueId ?? "",
            gender: capturedFull.gender ?? "",
            dateOfBirth: capturedFull.dateOfBirth ?? "",
            admissionDate: capturedFull.admissionDate ?? "",
            bloodGroup: capturedFull.bloodGroup ?? "",
            address: capturedFull.address ?? "",
            whatsappNumber: capturedFull.whatsappNumber ?? "",
            photoUrl: capturedFull.photoUrl ?? "",
            session: capturedFull.session ?? "",
            portalUrl: portalOrigin,
            schoolName: settings["school_name"] || "",
            schoolAddress: settings["school_address"] || "",
            schoolPhone: settings["school_contact_number"] || "",
            schoolEmail: settings["school_email"] || "",
            schoolLogoUrl: settings["school_logo_url"] || "",
          });
        }).catch((err) => { void err; });
      }
    } catch {
      // Non-fatal: student update is already saved
    }
  }

  return res.json(toISO(full));
});

router.delete("/students/:id", requireAuth("admin"), async (req, res) => {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
  await db.delete(studentsTable).where(eq(studentsTable.id, id));
  return res.status(204).end();
});

export default router;
