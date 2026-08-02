import { Router } from "express";
import {
  db,
  sliderImagesTable,
  galleryAlbumsTable,
  galleryPhotosTable,
  testimonialsTable,
  toppersTable,
  downloadsTable,
  enquiriesTable,
  admissionApplicationsTable,
  studentsTable,
  teachersTable,
  noticesTable,
  contactPersonsTable,
  classesTable,
  sectionsTable,
  examsTable,
  examMarksTable,
  examSchedulesTable,
  subjectsTable,
  gradingRulesTable,
  admitCardHoldsTable,
  appSettingsTable,
  certificateRequestsTable,
} from "@workspace/db";
import { eq, desc, asc, count, sql, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware";
import { logger } from "../lib/logger";
import { getSetting, setSetting } from "./settings";

const router = Router();

// ─── Branding (public GET, admin POST) ──────────────────────────────────────

const BRANDING_KEYS = [
  "school_name", "school_logo_url", "school_motto", "school_tagline",
  "school_established", "school_principal_name", "school_principal_photo",
  "school_address", "school_contact_number", "school_email", "school_website",
  "school_facebook", "school_twitter", "school_instagram", "school_youtube",
  "school_short_name", "school_affiliation", "school_vision", "school_mission",
] as const;

router.get("/website/branding", async (_req, res) => {
  try {
    const values = await Promise.all(BRANDING_KEYS.map(k => getSetting(k)));
    const result: Record<string, string> = {};
    BRANDING_KEYS.forEach((k, i) => { result[k] = values[i]; });
    res.json(result);
  } catch (err) {
    logger.error({ err }, "website/branding GET error");
    res.status(500).json({ error: "Failed to load branding" });
  }
});

router.post("/website/branding", requireAuth("admin"), async (req, res) => {
  try {
    const body = req.body as Partial<Record<typeof BRANDING_KEYS[number], string>>;
    await Promise.all(
      BRANDING_KEYS
        .filter(k => k in body)
        .map(k => setSetting(k, (body[k] ?? "").trim()))
    );
    logger.info("School branding updated");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "website/branding POST error");
    res.status(500).json({ error: "Failed to save branding" });
  }
});

// ─── Stats (public) ─────────────────────────────────────────────────────────
router.get("/website/stats", async (_req, res) => {
  try {
    const [studentResult, teacherResult] = await Promise.all([
      db.select({ count: count() }).from(studentsTable),
      db.select({ count: count() }).from(teachersTable),
    ]);
    res.json({
      students: Number(studentResult[0]?.count ?? 0),
      teachers: Number(teacherResult[0]?.count ?? 0),
      yearsOfExcellence: new Date().getFullYear() - 2000,
    });
  } catch (err) {
    logger.error({ err }, "website/stats error");
    res.json({ students: 0, teachers: 0, yearsOfExcellence: 24 });
  }
});

// ─── Slider ─────────────────────────────────────────────────────────────────
router.get("/website/slider", async (_req, res) => {
  try {
    const slides = await db
      .select()
      .from(sliderImagesTable)
      .where(eq(sliderImagesTable.isVisible, true))
      .orderBy(asc(sliderImagesTable.displayOrder));
    res.json(slides);
  } catch (err) {
    logger.error({ err }, "website/slider error");
    res.json([]);
  }
});

router.post("/website/slider", requireAuth("admin"), async (req, res) => {
  const { title, subtitle, imageUrl, ctaText, ctaLink, displayOrder, bgGradient } = req.body;
  const [slide] = await db
    .insert(sliderImagesTable)
    .values({
      title: title ?? "",
      subtitle: subtitle ?? "",
      imageUrl: imageUrl ?? "",
      ctaText: ctaText ?? "",
      ctaLink: ctaLink ?? "",
      displayOrder: Number(displayOrder) || 0,
      bgGradient: bgGradient ?? "from-blue-900 to-blue-700",
      isVisible: true,
    })
    .returning();
  res.json(slide);
});

router.put("/website/slider/:id", requireAuth("admin"), async (req, res) => {
  const [slide] = await db
    .update(sliderImagesTable)
    .set(req.body)
    .where(eq(sliderImagesTable.id, parseInt(req.params['id'] as string)))
    .returning();
  res.json(slide);
});

router.delete("/website/slider/:id", requireAuth("admin"), async (req, res) => {
  await db.delete(sliderImagesTable).where(eq(sliderImagesTable.id, parseInt(req.params['id'] as string)));
  res.json({ success: true });
});

// ─── Gallery Albums ─────────────────────────────────────────────────────────
router.get("/website/gallery/albums", async (_req, res) => {
  try {
    const albums = await db
      .select()
      .from(galleryAlbumsTable)
      .where(eq(galleryAlbumsTable.isVisible, true))
      .orderBy(desc(galleryAlbumsTable.createdAt));
    res.json(albums);
  } catch (err) {
    logger.error({ err }, "website/gallery error");
    res.json([]);
  }
});

router.get("/website/gallery/albums/all", requireAuth("admin"), async (_req, res) => {
  const albums = await db.select().from(galleryAlbumsTable).orderBy(desc(galleryAlbumsTable.createdAt));
  res.json(albums);
});

router.post("/website/gallery/albums", requireAuth("admin"), async (req, res) => {
  const { name, description, coverImageUrl, albumDate } = req.body;
  const [album] = await db
    .insert(galleryAlbumsTable)
    .values({
      name,
      description: description ?? "",
      coverImageUrl: coverImageUrl ?? "",
      albumDate: albumDate || null,
      isVisible: true,
    })
    .returning();
  res.json(album);
});

router.put("/website/gallery/albums/:id", requireAuth("admin"), async (req, res) => {
  const [album] = await db
    .update(galleryAlbumsTable)
    .set(req.body)
    .where(eq(galleryAlbumsTable.id, parseInt(req.params['id'] as string)))
    .returning();
  res.json(album);
});

router.delete("/website/gallery/albums/:id", requireAuth("admin"), async (req, res) => {
  const id = parseInt(req.params['id'] as string);
  await db.delete(galleryPhotosTable).where(eq(galleryPhotosTable.albumId, id));
  await db.delete(galleryAlbumsTable).where(eq(galleryAlbumsTable.id, id));
  res.json({ success: true });
});

router.get("/website/gallery/albums/:albumId/photos", async (req, res) => {
  const albumId = parseInt(req.params['albumId'] as string);
  const photos = await db
    .select()
    .from(galleryPhotosTable)
    .where(eq(galleryPhotosTable.albumId, albumId))
    .orderBy(asc(galleryPhotosTable.displayOrder));
  res.json(photos);
});

router.post(
  "/website/gallery/albums/:albumId/photos",
  requireAuth("admin"),
  async (req, res) => {
    const albumId = parseInt(req.params['albumId'] as string);
    const { imageUrl, caption, displayOrder } = req.body;
    const [photo] = await db
      .insert(galleryPhotosTable)
      .values({ albumId, imageUrl, caption: caption ?? "", displayOrder: Number(displayOrder) || 0 })
      .returning();
    res.json(photo);
  }
);

router.delete(
  "/website/gallery/photos/:id",
  requireAuth("admin"),
  async (req, res) => {
    await db.delete(galleryPhotosTable).where(eq(galleryPhotosTable.id, parseInt(req.params['id'] as string)));
    res.json({ success: true });
  }
);

// ─── Testimonials ────────────────────────────────────────────────────────────
router.get("/website/testimonials", async (_req, res) => {
  try {
    const items = await db
      .select()
      .from(testimonialsTable)
      .where(eq(testimonialsTable.isVisible, true))
      .orderBy(asc(testimonialsTable.displayOrder));
    res.json(items);
  } catch (err) {
    logger.error({ err }, "website/testimonials error");
    res.json([]);
  }
});

router.post("/website/testimonials", requireAuth("admin"), async (req, res) => {
  const { name, designation, content, rating, photoUrl, displayOrder } = req.body;
  const [item] = await db
    .insert(testimonialsTable)
    .values({
      name,
      designation: designation ?? "",
      content,
      rating: Number(rating) || 5,
      photoUrl: photoUrl ?? "",
      displayOrder: Number(displayOrder) || 0,
      isVisible: true,
    })
    .returning();
  res.json(item);
});

router.put("/website/testimonials/:id", requireAuth("admin"), async (req, res) => {
  const [item] = await db
    .update(testimonialsTable)
    .set(req.body)
    .where(eq(testimonialsTable.id, parseInt(req.params['id'] as string)))
    .returning();
  res.json(item);
});

router.delete("/website/testimonials/:id", requireAuth("admin"), async (req, res) => {
  await db.delete(testimonialsTable).where(eq(testimonialsTable.id, parseInt(req.params['id'] as string)));
  res.json({ success: true });
});

// ─── Toppers ─────────────────────────────────────────────────────────────────
router.get("/website/toppers", async (_req, res) => {
  try {
    const items = await db
      .select()
      .from(toppersTable)
      .where(eq(toppersTable.isVisible, true))
      .orderBy(asc(toppersTable.rank));
    res.json(items);
  } catch (err) {
    logger.error({ err }, "website/toppers error");
    res.json([]);
  }
});

router.post("/website/toppers", requireAuth("admin"), async (req, res) => {
  const { studentName, className, marks, percentage, examType, session, rank, photoUrl } = req.body;
  const [item] = await db
    .insert(toppersTable)
    .values({
      studentName,
      className,
      marks: marks ?? "",
      percentage: percentage ?? "0",
      examType: examType ?? "Annual",
      session: session ?? "",
      rank: Number(rank) || 1,
      photoUrl: photoUrl ?? "",
      isVisible: true,
    })
    .returning();
  res.json(item);
});

router.delete("/website/toppers/:id", requireAuth("admin"), async (req, res) => {
  await db.delete(toppersTable).where(eq(toppersTable.id, parseInt(req.params['id'] as string)));
  res.json({ success: true });
});

// ─── Downloads ───────────────────────────────────────────────────────────────
router.get("/website/downloads", async (req, res) => {
  try {
    const { category, featured } = req.query;
    let items = await db
      .select()
      .from(downloadsTable)
      .where(eq(downloadsTable.isVisible, true))
      .orderBy(desc(downloadsTable.createdAt));
    if (category && category !== "all") items = items.filter((d) => d.category === category);
    if (featured === "true") items = items.filter((d) => d.isFeatured);
    res.json(items);
  } catch (err) {
    logger.error({ err }, "website/downloads error");
    res.json([]);
  }
});

router.post("/website/downloads", requireAuth("admin"), async (req, res) => {
  const { title, category, description, fileUrl, fileType, isFeatured } = req.body;
  const [item] = await db
    .insert(downloadsTable)
    .values({
      title,
      category: category ?? "general",
      description: description ?? "",
      fileUrl: fileUrl ?? "",
      fileType: fileType ?? "pdf",
      isFeatured: !!isFeatured,
      isVisible: true,
      downloadCount: 0,
    })
    .returning();
  res.json(item);
});

router.put("/website/downloads/:id", requireAuth("admin"), async (req, res) => {
  const [item] = await db
    .update(downloadsTable)
    .set(req.body)
    .where(eq(downloadsTable.id, parseInt(req.params['id'] as string)))
    .returning();
  res.json(item);
});

router.post("/website/downloads/:id/increment", async (req, res) => {
  const id = parseInt(req.params['id'] as string);
  const [current] = await db.select().from(downloadsTable).where(eq(downloadsTable.id, id));
  if (!current) { res.status(404).json({ error: "Not found" }); return; }
  const [item] = await db
    .update(downloadsTable)
    .set({ downloadCount: (current.downloadCount ?? 0) + 1 })
    .where(eq(downloadsTable.id, id))
    .returning();
  res.json(item);
});

router.delete("/website/downloads/:id", requireAuth("admin"), async (req, res) => {
  await db.delete(downloadsTable).where(eq(downloadsTable.id, parseInt(req.params['id'] as string)));
  res.json({ success: true });
});

// ─── Enquiries ───────────────────────────────────────────────────────────────
router.post("/website/enquiry", async (req, res) => {
  const { name, email, phone, message, studentClass } = req.body;
  if (!name?.trim() || !phone?.trim()) {
    res.status(400).json({ error: "Name and phone are required" });
    return;
  }
  const [item] = await db
    .insert(enquiriesTable)
    .values({
      name: name.trim(),
      email: email?.trim() ?? "",
      phone: phone.trim(),
      message: message?.trim() ?? "",
      studentClass: studentClass?.trim() ?? "",
      status: "new",
    })
    .returning();
  res.json(item);
});

router.get("/website/enquiries", requireAuth("admin"), async (_req, res) => {
  const items = await db.select().from(enquiriesTable).orderBy(desc(enquiriesTable.createdAt));
  res.json(items);
});

router.patch("/website/enquiries/:id", requireAuth("admin"), async (req, res) => {
  const [item] = await db
    .update(enquiriesTable)
    .set(req.body)
    .where(eq(enquiriesTable.id, parseInt(req.params['id'] as string)))
    .returning();
  res.json(item);
});

// ─── Admission Applications ──────────────────────────────────────────────────
router.post("/website/admission/apply", async (req, res) => {
  const { studentName, dateOfBirth, gender, fatherName, motherName, phone, alternatePhone, email, address, classApplied, previousSchool, previousClass, category, religion, message } = req.body;
  if (!studentName?.trim() || !phone?.trim() || !classApplied?.trim()) {
    res.status(400).json({ error: "Student name, phone, and class applied are required" });
    return;
  }
  const [item] = await db
    .insert(admissionApplicationsTable)
    .values({
      studentName: studentName.trim(),
      dateOfBirth: dateOfBirth?.trim() ?? "",
      gender: gender?.trim() ?? "",
      fatherName: fatherName?.trim() ?? "",
      motherName: motherName?.trim() ?? "",
      phone: phone.trim(),
      alternatePhone: alternatePhone?.trim() ?? "",
      email: email?.trim() ?? "",
      address: address?.trim() ?? "",
      classApplied: classApplied.trim(),
      previousSchool: previousSchool?.trim() ?? "",
      previousClass: previousClass?.trim() ?? "",
      category: category?.trim() ?? "General",
      religion: religion?.trim() ?? "",
      message: message?.trim() ?? "",
      status: "pending",
    })
    .returning();
  res.json(item);
});

router.get("/website/admission/applications", requireAuth("admin"), async (_req, res) => {
  const items = await db.select().from(admissionApplicationsTable).orderBy(desc(admissionApplicationsTable.createdAt));
  res.json(items);
});

router.patch("/website/admission/applications/:id", requireAuth("admin"), async (req, res) => {
  const { status, remarks } = req.body;
  const updates: Record<string, unknown> = {};
  if (status !== undefined) updates.status = status;
  if (remarks !== undefined) updates.remarks = remarks;
  updates.updatedAt = new Date();
  const [item] = await db
    .update(admissionApplicationsTable)
    .set(updates)
    .where(eq(admissionApplicationsTable.id, parseInt(req.params['id'] as string)))
    .returning();
  res.json(item);
});

router.delete("/website/admission/applications/:id", requireAuth("admin"), async (req, res) => {
  await db.delete(admissionApplicationsTable).where(eq(admissionApplicationsTable.id, parseInt(req.params['id'] as string)));
  res.json({ ok: true });
});

// Public: look up an admission application by reference number (APP-XXXXX)
router.get("/website/admission/status", async (req, res) => {
  const refNo = (req.query.refNo as string || "").trim().toUpperCase();
  if (!refNo) {
    res.status(400).json({ error: "refNo is required" });
    return;
  }
  // Accept formats: APP-00001, APP00001, or plain numeric id
  const match = refNo.match(/^(?:APP-?)?(\d+)$/);
  if (!match) {
    res.status(400).json({ error: "Invalid reference number format. Use APP-XXXXX." });
    return;
  }
  const id = parseInt(match[1] as string, 10);
  const rows = await db
    .select({
      id: admissionApplicationsTable.id,
      studentName: admissionApplicationsTable.studentName,
      classApplied: admissionApplicationsTable.classApplied,
      status: admissionApplicationsTable.status,
      remarks: admissionApplicationsTable.remarks,
      createdAt: admissionApplicationsTable.createdAt,
      updatedAt: admissionApplicationsTable.updatedAt,
    })
    .from(admissionApplicationsTable)
    .where(eq(admissionApplicationsTable.id, id))
    .limit(1);
  if (!rows.length) {
    res.status(404).json({ error: "No application found with this reference number." });
    return;
  }
  res.json(rows[0]);
});

// Admission info (editable fields: fee info, timing, transport, uniform)
const ADMISSION_INFO_KEYS = ["admission_fee_info", "admission_timing", "admission_transport", "admission_uniform"] as const;

router.get("/website/admission/info", async (_req, res) => {
  const result: Record<string, string> = {};
  for (const key of ADMISSION_INFO_KEYS) {
    const val = await getSetting(key);
    result[key] = val ?? "";
  }
  res.json(result);
});

router.post("/website/admission/info", requireAuth("admin"), async (req, res) => {
  for (const key of ADMISSION_INFO_KEYS) {
    if (req.body[key] !== undefined) {
      await setSetting(key, req.body[key]);
    }
  }
  res.json({ ok: true });
});

// ─── Public News/Notices (for homepage ticker) ───────────────────────────────
// Only shows admin-created notices targeted to parents — excludes teacher portal
// notices and teacher-management notices. Returns className for class-specific
// notices so the website can display a class label.
router.get("/website/news", async (_req, res) => {
  try {
    const items = await db
      .select({
        id: noticesTable.id,
        title: noticesTable.title,
        content: noticesTable.content,
        createdAt: noticesTable.createdAt,
        classId: noticesTable.classId,
        className: classesTable.name,
      })
      .from(noticesTable)
      .leftJoin(classesTable, eq(noticesTable.classId, classesTable.id))
      .where(
        and(
          eq(noticesTable.isActive, true),
          eq(noticesTable.authorRole, "admin"),
          eq(noticesTable.targetRole, "parents")
        )
      )
      .orderBy(desc(noticesTable.createdAt))
      .limit(10);
    res.json(items);
  } catch (err) {
    logger.error({ err }, "website/news error");
    res.json([]);
  }
});

// ─── Contact Persons ─────────────────────────────────────────────────────────

router.get("/website/contacts", async (_req, res) => {
  try {
    const items = await db.select().from(contactPersonsTable).orderBy(contactPersonsTable.sortOrder, contactPersonsTable.id);
    res.json(items);
  } catch (err) {
    logger.error({ err }, "website/contacts GET error");
    res.json([]);
  }
});

router.post("/website/contacts", requireAuth("admin"), async (req, res) => {
  try {
    const { name, role, phone, email, department, availability, sortOrder } = req.body;
    if (!name) { res.status(400).json({ error: "name is required" }); return; }
    const [item] = await db.insert(contactPersonsTable).values({ name, role: role || "", phone: phone || "", email: email || "", department: department || "", availability: availability || "Mon–Sat, 8 AM – 4 PM", sortOrder: sortOrder ?? 0 }).returning();
    res.json(item);
  } catch (err) {
    logger.error({ err }, "website/contacts POST error");
    res.status(500).json({ error: "Failed to create contact" });
  }
});

router.put("/website/contacts/:id", requireAuth("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    const { name, role, phone, email, department, availability, sortOrder } = req.body;
    const [item] = await db.update(contactPersonsTable).set({ name, role, phone, email, department, availability, sortOrder }).where(eq(contactPersonsTable.id, id)).returning();
    if (!item) { res.status(404).json({ error: "Not found" }); return; }
    res.json(item);
  } catch (err) {
    logger.error({ err }, "website/contacts PUT error");
    res.status(500).json({ error: "Failed to update contact" });
  }
});

router.delete("/website/contacts/:id", requireAuth("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    await db.delete(contactPersonsTable).where(eq(contactPersonsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "website/contacts DELETE error");
    res.status(500).json({ error: "Failed to delete contact" });
  }
});

// ─── Birthday Wishes (students with today's birthday) ────────────────────────

router.get("/website/birthdays", async (_req, res) => {
  try {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const pattern = `%-${mm}-${dd}`;
    const all = await db.select({
      id: studentsTable.id,
      name: studentsTable.studentName,
      dateOfBirth: studentsTable.dateOfBirth,
      photoUrl: studentsTable.photoUrl,
      classId: studentsTable.classId,
    }).from(studentsTable).where(sql`${studentsTable.dateOfBirth} LIKE ${pattern}`);
    const classIds = [...new Set(all.map(s => s.classId).filter(Boolean))];
    let classMap: Record<number, string> = {};
    if (classIds.length > 0) {
      const classes = await db.select({ id: classesTable.id, name: classesTable.name }).from(classesTable);
      classMap = Object.fromEntries(classes.map(c => [c.id, c.name]));
    }
    res.json(all.map(s => ({ id: s.id, name: s.name, className: s.classId ? (classMap[s.classId] || "") : "", photoUrl: s.photoUrl })));
  } catch (err) {
    logger.error({ err }, "website/birthdays error");
    res.json([]);
  }
});

// ─── Public Admit Card by Admission Number ────────────────────────────────────
router.get("/website/admit-card", async (req, res) => {
  try {
    const admissionNo = (req.query.admissionNo as string || "").trim();
    if (!admissionNo) { res.status(400).json({ error: "admissionNo is required" }); return; }

    // Find student by uniqueId
    const students = await db
      .select({
        id: studentsTable.id,
        studentName: studentsTable.studentName,
        rollNo: studentsTable.rollNo,
        fatherName: studentsTable.fatherName,
        motherName: studentsTable.motherName,
        classId: studentsTable.classId,
        sectionId: studentsTable.sectionId,
        className: classesTable.name,
        sectionName: sectionsTable.name,
        photoUrl: studentsTable.photoUrl,
      })
      .from(studentsTable)
      .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
      .leftJoin(sectionsTable, eq(studentsTable.sectionId, sectionsTable.id))
      .where(eq(studentsTable.uniqueId, admissionNo));

    if (students.length === 0) { res.json({ found: false }); return; }
    const student = students[0];

    // Get all active/completed/published exams
    const allExams = await db.select().from(examsTable).orderBy(desc(examsTable.id));
    const relevantExams = allExams.filter(e => ["active", "completed", "published"].includes(e.status));
    if (relevantExams.length === 0) { res.json({ found: true, student, exams: [] }); return; }

    const examResults = await Promise.all(relevantExams.map(async (exam) => {
      // Check if admin published admit cards for this exam
      const key = `admit_cards_published_${exam.id}`;
      const pubRows = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key));
      const published = pubRows[0]?.value === "true";
      if (!published) return { examId: exam.id, examName: exam.name, session: exam.session, type: exam.type, notPublished: true };

      // Check hold status for this student
      const holdRows = await db.select().from(admitCardHoldsTable).where(
        and(eq(admitCardHoldsTable.studentId, student.id), eq(admitCardHoldsTable.examId, exam.id))
      );
      const held = holdRows.some(h => h.held);
      if (held) return { examId: exam.id, examName: exam.name, session: exam.session, type: exam.type, held: true, notPublished: false };

      // Get exam schedule for student's class
      const schedules = await db
        .select({
          subjectName: subjectsTable.name,
          examDate: examSchedulesTable.examDate,
          startTime: examSchedulesTable.startTime,
          endTime: examSchedulesTable.endTime,
          room: examSchedulesTable.room,
        })
        .from(examSchedulesTable)
        .leftJoin(subjectsTable, eq(examSchedulesTable.subjectId, subjectsTable.id))
        .where(and(
          eq(examSchedulesTable.examId, exam.id),
          eq(examSchedulesTable.classId, student.classId!),
        ))
        .orderBy(asc(examSchedulesTable.examDate));

      return {
        examId: exam.id,
        examName: exam.name,
        session: exam.session,
        type: exam.type,
        held: false,
        notPublished: false,
        schedules,
      };
    }));

    res.json({
      found: true,
      student: {
        id: student.id,
        studentName: student.studentName,
        rollNo: student.rollNo,
        fatherName: student.fatherName || "",
        motherName: student.motherName || "",
        className: student.className || "",
        sectionName: student.sectionName || "",
        photoUrl: student.photoUrl || "",
      },
      exams: examResults.filter(Boolean),
    });
  } catch (err) {
    logger.error({ err }, "website/admit-card error");
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Public Results by Admission Number ───────────────────────────────────────
async function calcGradePublic(percentage: number): Promise<{ grade: string; gradePoint: string }> {
  const rules = await db.select().from(gradingRulesTable).orderBy(asc(gradingRulesTable.minPercent));
  const defaults = [
    { minPercent: "91", maxPercent: "100", grade: "A1", gradePoint: "10.0" },
    { minPercent: "81", maxPercent: "90",  grade: "A2", gradePoint: "9.0"  },
    { minPercent: "71", maxPercent: "80",  grade: "B1", gradePoint: "8.0"  },
    { minPercent: "61", maxPercent: "70",  grade: "B2", gradePoint: "7.0"  },
    { minPercent: "51", maxPercent: "60",  grade: "C1", gradePoint: "6.0"  },
    { minPercent: "41", maxPercent: "50",  grade: "C2", gradePoint: "5.0"  },
    { minPercent: "33", maxPercent: "40",  grade: "D",  gradePoint: "4.0"  },
    { minPercent: "0",  maxPercent: "32",  grade: "E",  gradePoint: "0.0"  },
  ];
  const list = rules.length > 0 ? rules : defaults;
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i];
    if (percentage >= parseFloat(r.minPercent) && percentage <= parseFloat(r.maxPercent))
      return { grade: r.grade, gradePoint: r.gradePoint };
  }
  return { grade: "E", gradePoint: "0.0" };
}

router.get("/website/results", async (req, res) => {
  try {
    const admissionNo = (req.query.admissionNo as string || "").trim();
    if (!admissionNo) { res.status(400).json({ error: "admissionNo is required" }); return; }

    // Find student by uniqueId (admission number)
    const students = await db
      .select({
        id: studentsTable.id,
        studentName: studentsTable.studentName,
        rollNo: studentsTable.rollNo,
        fatherName: studentsTable.fatherName,
        motherName: studentsTable.motherName,
        classId: studentsTable.classId,
        sectionId: studentsTable.sectionId,
        className: classesTable.name,
        sectionName: sectionsTable.name,
      })
      .from(studentsTable)
      .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
      .leftJoin(sectionsTable, eq(studentsTable.sectionId, sectionsTable.id))
      .where(eq(studentsTable.uniqueId, admissionNo));

    if (students.length === 0) { res.json({ found: false }); return; }
    const student = students[0];

    // Get all published exams
    const publishedExams = await db
      .select()
      .from(examsTable)
      .where(eq(examsTable.status, "published"))
      .orderBy(desc(examsTable.id));

    if (publishedExams.length === 0) { res.json({ found: true, student, exams: [] }); return; }

    // For each published exam, fetch marks for this student
    const results = await Promise.all(publishedExams.map(async (exam) => {
      const marks = await db
        .select({
          id: examMarksTable.id,
          subjectId: examMarksTable.subjectId,
          subjectName: subjectsTable.name,
          subjectCode: subjectsTable.code,
          maxTheoryMarks: subjectsTable.maxTheoryMarks,
          maxPracticalMarks: subjectsTable.maxPracticalMarks,
          maxInternalMarks: subjectsTable.maxInternalMarks,
          theoryMarks: examMarksTable.theoryMarks,
          practicalMarks: examMarksTable.practicalMarks,
          internalMarks: examMarksTable.internalMarks,
          totalMarks: examMarksTable.totalMarks,
          grade: examMarksTable.grade,
          percentage: examMarksTable.percentage,
          remarks: examMarksTable.remarks,
          isAbsent: examMarksTable.isAbsent,
          isHeld: examMarksTable.isHeld,
          orderIndex: subjectsTable.orderIndex,
        })
        .from(examMarksTable)
        .leftJoin(subjectsTable, eq(examMarksTable.subjectId, subjectsTable.id))
        .where(and(
          eq(examMarksTable.studentId, student.id),
          eq(examMarksTable.examId, exam.id),
        ))
        .orderBy(asc(subjectsTable.orderIndex));

      if (marks.length === 0) return null;

      // If any mark is held, return held flag
      if (marks.some(m => m.isHeld)) {
        return { examId: exam.id, examName: exam.name, examType: exam.type, session: exam.session, held: true };
      }

      const totalObtained = marks.reduce((s, m) => s + (m.isAbsent ? 0 : (parseFloat(m.totalMarks || "0") || 0)), 0);
      const totalMax = marks.reduce((s, m) => {
        return s + parseFloat(m.maxTheoryMarks || "0") + parseFloat(m.maxPracticalMarks || "0") + parseFloat(m.maxInternalMarks || "0");
      }, 0);
      const overallPct = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
      const gradeInfo = await calcGradePublic(overallPct);
      const passPct = parseFloat(exam.passingPercentage) || 33;
      const failed = marks.some(m => !m.isAbsent && parseFloat(m.percentage || "0") < passPct);

      return {
        examId: exam.id,
        examName: exam.name,
        examType: exam.type,
        session: exam.session,
        held: false,
        subjects: marks.map(m => ({
          subjectId: m.subjectId,
          subjectName: m.subjectName,
          subjectCode: m.subjectCode,
          theoryMarks: m.theoryMarks,
          practicalMarks: m.practicalMarks,
          internalMarks: m.internalMarks,
          totalMarks: m.totalMarks,
          maxMarks: (parseFloat(m.maxTheoryMarks || "0") + parseFloat(m.maxPracticalMarks || "0") + parseFloat(m.maxInternalMarks || "0")).toString(),
          maxTheoryMarks: m.maxTheoryMarks,
          maxPracticalMarks: m.maxPracticalMarks,
          maxInternalMarks: m.maxInternalMarks,
          grade: m.grade,
          percentage: m.percentage,
          isAbsent: m.isAbsent,
          remarks: m.remarks,
        })),
        totalMarks: totalObtained.toFixed(0),
        maxMarks: totalMax.toFixed(0),
        percentage: overallPct.toFixed(2),
        grade: gradeInfo.grade,
        gradePoint: gradeInfo.gradePoint,
        passFail: failed ? "fail" : "pass",
      };
    }));

    const filteredResults = results.filter(Boolean);

    res.json({
      found: true,
      student: {
        id: student.id,
        studentName: student.studentName,
        rollNo: student.rollNo,
        fatherName: student.fatherName || "",
        motherName: student.motherName || "",
        className: student.className || "",
        sectionName: student.sectionName || "",
      },
      exams: filteredResults,
    });
  } catch (err) {
    logger.error({ err }, "website/results error");
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Certificate Requests ────────────────────────────────────────────────────

// Generate a stable certificate number from a DB record ID
function makeCertNumber(id: number): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `CERT-${yy}${mm}-${String(id).padStart(4, "0")}`;
}

// Record an admin-generated (printed) certificate as issued
// Returns { ok: true, certificateNumber: "CERT-..." } so the frontend can embed it
router.post("/website/certificate-requests/record-issued", requireAuth("admin"), async (req, res) => {
  try {
    const { admissionNumber, studentName, certificateType, leavingDate, leavingReason, penNumber } = req.body as {
      admissionNumber: string; studentName?: string; certificateType: string;
      leavingDate?: string; leavingReason?: string; penNumber?: string;
    };
    if (!admissionNumber?.trim() || !certificateType?.trim()) {
      res.status(400).json({ error: "admissionNumber and certificateType are required" }); return;
    }
    const existing = await db.select().from(certificateRequestsTable)
      .where(and(eq(certificateRequestsTable.admissionNumber, admissionNumber.trim()), eq(certificateRequestsTable.certificateType, certificateType.trim())))
      .limit(1);

    let certNumber: string;
    let record: typeof certificateRequestsTable.$inferSelect;

    if (existing.length > 0) {
      const rec = existing[0];
      certNumber = rec.certificateNumber || makeCertNumber(rec.id);
      const updateFields: Record<string, unknown> = { status: "issued", issuedAt: new Date(), remarks: "Issued directly by admin", certificateNumber: certNumber };
      // Always overwrite leaving fields if supplied (admin may re-print with updated values)
      if (leavingDate !== undefined) updateFields.leavingDate = leavingDate;
      if (leavingReason !== undefined) updateFields.leavingReason = leavingReason;
      if (penNumber !== undefined) updateFields.penNumber = penNumber;
      const [updated] = await db.update(certificateRequestsTable)
        .set(updateFields)
        .where(eq(certificateRequestsTable.id, rec.id))
        .returning();
      record = updated;
    } else {
      const student = await db.select().from(studentsTable).where(eq(studentsTable.uniqueId, admissionNumber.trim())).limit(1);
      const name = student[0]?.studentName || studentName || "";
      const [inserted] = await db.insert(certificateRequestsTable).values({
        admissionNumber: admissionNumber.trim(), studentName: name, certificateType: certificateType.trim(),
        status: "issued", issuedAt: new Date(), remarks: "Issued directly by admin",
        leavingDate: leavingDate || "", leavingReason: leavingReason || "", penNumber: penNumber || "",
      }).returning();
      certNumber = makeCertNumber(inserted.id);
      const [updated] = await db.update(certificateRequestsTable)
        .set({ certificateNumber: certNumber })
        .where(eq(certificateRequestsTable.id, inserted.id))
        .returning();
      record = updated;
    }

    logger.info({ admissionNumber, certificateType, certNumber }, "Certificate recorded as issued by admin");
    res.json({ ok: true, certificateNumber: certNumber, leavingDate: record.leavingDate, leavingReason: record.leavingReason, penNumber: record.penNumber });
  } catch (err) {
    logger.error({ err }, "certificate-requests/record-issued POST error");
    res.status(500).json({ error: "Failed to record certificate" });
  }
});

router.post("/website/certificate-requests", async (req, res) => {
  try {
    const { admissionNumber, studentName, certificateType } = req.body as { admissionNumber: string; studentName?: string; certificateType: string };
    if (!admissionNumber?.trim() || !certificateType?.trim()) {
      res.status(400).json({ error: "admissionNumber and certificateType are required" }); return;
    }
    const existing = await db.select().from(certificateRequestsTable)
      .where(and(eq(certificateRequestsTable.admissionNumber, admissionNumber.trim()), eq(certificateRequestsTable.certificateType, certificateType.trim())))
      .limit(1);
    if (existing.length > 0) {
      // Allow re-request if previously rejected
      if (existing[0].status === "rejected") {
        await db.update(certificateRequestsTable)
          .set({ status: "pending", requestedAt: new Date(), remarks: null })
          .where(eq(certificateRequestsTable.id, existing[0].id));
        res.json({ ok: true, status: "pending", message: "Re-request submitted successfully" }); return;
      }
      res.json({ ok: true, status: existing[0].status, message: "Request already exists" }); return;
    }
    const student = await db.select().from(studentsTable).where(eq(studentsTable.uniqueId, admissionNumber.trim())).limit(1);
    const name = student[0]?.studentName || studentName || "";
    await db.insert(certificateRequestsTable).values({ admissionNumber: admissionNumber.trim(), studentName: name, certificateType: certificateType.trim(), status: "pending" });
    logger.info({ admissionNumber, certificateType }, "Certificate request submitted");
    res.json({ ok: true, status: "pending", message: "Request submitted successfully" });
  } catch (err) {
    logger.error({ err }, "certificate-requests POST error");
    res.status(500).json({ error: "Failed to submit request" });
  }
});

router.get("/website/certificate-requests/check", async (req, res) => {
  try {
    const { admissionNumber, certificateType } = req.query as { admissionNumber?: string; certificateType?: string };
    if (!admissionNumber?.trim()) { res.status(400).json({ error: "admissionNumber is required" }); return; }
    const where = certificateType?.trim()
      ? and(eq(certificateRequestsTable.admissionNumber, admissionNumber.trim()), eq(certificateRequestsTable.certificateType, certificateType.trim()))
      : eq(certificateRequestsTable.admissionNumber, admissionNumber.trim());
    const results = await db.select().from(certificateRequestsTable).where(where).orderBy(desc(certificateRequestsTable.requestedAt));
    res.json({ results });
  } catch (err) {
    logger.error({ err }, "certificate-requests check error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/website/certificate-requests", requireAuth("admin"), async (req, res) => {
  try {
    const results = await db.select().from(certificateRequestsTable).orderBy(desc(certificateRequestsTable.requestedAt));
    res.json(results);
  } catch (err) {
    logger.error({ err }, "certificate-requests GET error");
    res.status(500).json({ error: "Failed to load requests" });
  }
});

router.patch("/website/certificate-requests/:id", requireAuth("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    const { status, remarks } = req.body as { status: string; remarks?: string };
    if (!status) { res.status(400).json({ error: "status is required" }); return; }
    const update: Record<string, unknown> = { status };
    if (remarks !== undefined) update.remarks = remarks;
    if (status === "issued") update.issuedAt = new Date();
    await db.update(certificateRequestsTable).set(update).where(eq(certificateRequestsTable.id, id));
    logger.info({ id, status }, "Certificate request updated");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "certificate-requests PATCH error");
    res.status(500).json({ error: "Failed to update request" });
  }
});

router.delete("/website/certificate-requests/all", requireAuth("admin"), async (_req, res) => {
  try {
    await db.delete(certificateRequestsTable);
    logger.info("All certificate requests cleared");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "certificate-requests DELETE all error");
    res.status(500).json({ error: "Failed to clear requests" });
  }
});

router.delete("/website/certificate-requests/:id", requireAuth("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    await db.delete(certificateRequestsTable).where(eq(certificateRequestsTable.id, id));
    logger.info({ id }, "Certificate request deleted");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "certificate-requests DELETE error");
    res.status(500).json({ error: "Failed to delete request" });
  }
});

// Public certificate verification (no auth required)
router.get("/verify/certificate", async (req, res) => {
  try {
    const adm = (req.query.adm as string | undefined)?.trim();
    const type = (req.query.type as string | undefined)?.trim();
    if (!adm || !type) {
      res.status(400).json({ ok: false, error: "Missing adm or type parameter" }); return;
    }
    const rows = await db.select().from(certificateRequestsTable)
      .where(and(eq(certificateRequestsTable.admissionNumber, adm), eq(certificateRequestsTable.certificateType, type)))
      .limit(1);
    if (rows.length === 0) {
      res.status(404).json({ ok: false, error: "Certificate not found in school records." }); return;
    }
    const cert = rows[0];
    res.json({
      ok: true,
      data: {
        studentName: cert.studentName,
        admissionNumber: cert.admissionNumber,
        certificateType: cert.certificateType,
        status: cert.status,
        issuedAt: cert.issuedAt?.toISOString() ?? null,
        remarks: cert.remarks ?? null,
      },
    });
  } catch (err) {
    logger.error({ err }, "verify/certificate GET error");
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;
