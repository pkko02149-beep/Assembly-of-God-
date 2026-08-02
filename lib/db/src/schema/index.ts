import { pgTable, serial, text, integer, timestamp, boolean, date, numeric, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vehiclesTable = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

export const tripsTable = pgTable("trips", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

export const classesTable = pgTable("classes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

export const sectionsTable = pgTable("sections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  classId: integer("class_id"),
});

export const transportRoutesTable = pgTable("transport_routes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  pricePerMonth: numeric("price_per_month", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  uniqueId: text("unique_id").notNull().default(""),
  rollNo: integer("roll_no").notNull().default(0),
  studentName: text("student_name").notNull(),
  fatherName: text("father_name").default("").notNull(),
  vehicleId: integer("vehicle_id"),
  tripId: integer("trip_id"),
  classId: integer("class_id").notNull(),
  sectionId: integer("section_id").notNull(),
  whatsappNumber: text("whatsapp_number").notNull().default(""),
  parentEmail: text("parent_email").default("").notNull(),
  address: text("address").default("").notNull(),
  hasVehicle: boolean("has_vehicle").default(false).notNull(),
  hasTrip: boolean("has_trip").default(false).notNull(),
  transportRouteId: integer("transport_route_id"),
  transportMonths: integer("transport_months").default(12).notNull(),
  photoUrl: text("photo_url").default(""),
  admissionDate: text("admission_date").default(""),
  dateOfBirth: text("date_of_birth").default(""),
  motherName: text("mother_name").default(""),
  aadharNumber: text("aadhar_number").default(""),
  panNumber: text("pan_number").default(""),
  gender: text("gender").default(""),
  previousSchool: text("previous_school").default(""),
  studentType: text("student_type").default(""),
  isPromoted: boolean("is_promoted").default(false).notNull(),
  feeFromApril: boolean("fee_from_april").default(false).notNull(),
  transportFromMonth: integer("transport_from_month").default(4).notNull(),
  transportStopMonth: integer("transport_stop_month"),
  session: text("session").default(""),
  previousYearDue: numeric("previous_year_due", { precision: 10, scale: 2 }).default("0"),
  previousYearDueRemarks: text("previous_year_due_remarks").default(""),
  category: text("category").default(""),
  religion: text("religion").default(""),
  bloodGroup: text("blood_group").default(""),
  nationality: text("nationality").default(""),
  emergencyContact: text("emergency_contact").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const expendituresTable = pgTable("expenditures", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  category: text("category").notNull().default("general"),
  paymentMethod: text("payment_method").default("cash").notNull(),
  date: date("date").notNull(),
  description: text("description").default(""),
  billNo: text("bill_no").default(""),
  paidTo: text("paid_to").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  date: date("date").notNull(),
  status: text("status").notNull(),
  classId: integer("class_id").notNull(),
  sectionId: integer("section_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const appSettingsTable = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull().default(""),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Fee Management Tables ─────────────────────────────────────

export const feeCategoriesTable = pgTable("fee_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").default("").notNull(),
  frequency: text("frequency").notNull().default("monthly"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const feeStructuresTable = pgTable("fee_structures", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").notNull(),
  categoryId: integer("category_id").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  session: text("session").notNull().default(""),
  dueDay: integer("due_day").default(10),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const feePaymentsTable = pgTable("fee_payments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  categoryId: integer("category_id").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  paidAmount: numeric("paid_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 10, scale: 2 }).default("0").notNull(),
  fine: numeric("fine", { precision: 10, scale: 2 }).default("0").notNull(),
  status: text("status").notNull().default("pending"),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  session: text("session").notNull().default(""),
  paymentDate: date("payment_date"),
  paymentMethod: text("payment_method").default("cash").notNull(),
  receiptNo: text("receipt_no").default("").notNull(),
  remarks: text("remarks").default("").notNull(),
  isPreviousDue: boolean("is_previous_due").default(false).notNull(),
  previousSession: text("previous_session").default(""),
  collectedBy: text("collected_by").default("").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Teacher / Parent / Portal Tables ─────────────────────────────────────────

export const teachersTable = pgTable("teachers", {
  id: serial("id").primaryKey(),
  employeeId: text("employee_id").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  mobile: text("mobile").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  classAssigned: integer("class_assigned"),
  sectionAssigned: integer("section_assigned"),
  subject: text("subject").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teacherAdmissionPermissionsTable = pgTable("teacher_admission_permissions", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().unique(),
  isLocked: boolean("is_locked").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  grantedAt: timestamp("granted_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const parentsTable = pgTable("parents", {
  id: serial("id").primaryKey(),
  fatherName: text("father_name").default("").notNull(),
  motherName: text("mother_name").default("").notNull(),
  email: text("email").notNull().unique(),
  mobile: text("mobile").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  mustChangePassword: boolean("must_change_password").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const studentParentTable = pgTable("student_parent", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  parentId: integer("parent_id").notNull(),
});

export const homeworkTable = pgTable("homework", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").notNull(),
  sectionId: integer("section_id"),
  subject: text("subject").notNull(),
  title: text("title").notNull(),
  description: text("description").default("").notNull(),
  titleHi: text("title_hi").default("").notNull(),
  descriptionHi: text("description_hi").default("").notNull(),
  dueDate: date("due_date").notNull(),
  teacherId: integer("teacher_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const studentMarksTable = pgTable("student_marks", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  subject: text("subject").notNull(),
  examName: text("exam_name").notNull(),
  marks: numeric("marks", { precision: 6, scale: 2 }).notNull(),
  maxMarks: numeric("max_marks", { precision: 6, scale: 2 }).notNull().default("100"),
  teacherId: integer("teacher_id").notNull(),
  classId: integer("class_id").notNull(),
  sectionId: integer("section_id"),
  examDate: date("exam_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leaveRequestsTable = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  userType: text("user_type").notNull(),
  userId: integer("user_id").notNull(),
  studentId: integer("student_id"),
  reason: text("reason").notNull(),
  fromDate: date("from_date").notNull(),
  toDate: date("to_date").notNull(),
  status: text("status").notNull().default("pending"),
  adminRemarks: text("admin_remarks").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const noticesTable = pgTable("notices", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  targetRole: text("target_role").notNull().default("all"),
  classId: integer("class_id"),
  sectionId: integer("section_id"),
  authorRole: text("author_role").notNull().default("admin"),
  authorId: integer("author_id"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const periodsTable = pgTable("periods", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startTime: text("start_time").notNull().default(""),
  endTime: text("end_time").notNull().default(""),
  isBreak: boolean("is_break").default(false).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const timetableTable = pgTable("timetable", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").notNull(),
  sectionId: integer("section_id"),
  dayOfWeek: integer("day_of_week").notNull(),
  period: integer("period").notNull(),
  periodId: integer("period_id"),
  subject: text("subject").notNull(),
  teacherId: integer("teacher_id").notNull(),
  startTime: text("start_time").notNull().default(""),
  endTime: text("end_time").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Exam Management ──────────────────────────────────────────────────────────

export const subjectsTable = pgTable("subjects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().default(""),
  classId: integer("class_id").notNull(),
  maxTheoryMarks: numeric("max_theory_marks", { precision: 6, scale: 2 }).notNull().default("100"),
  maxPracticalMarks: numeric("max_practical_marks", { precision: 6, scale: 2 }).notNull().default("0"),
  maxInternalMarks: numeric("max_internal_marks", { precision: 6, scale: 2 }).notNull().default("0"),
  isOptional: boolean("is_optional").default(false).notNull(),
  orderIndex: integer("order_index").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const examsTable = pgTable("exams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("unit_test"),
  session: text("session").notNull().default(""),
  startDate: date("start_date"),
  endDate: date("end_date"),
  resultPublishDate: date("result_publish_date"),
  status: text("status").notNull().default("draft"),
  classes: text("classes").notNull().default("[]"),
  passingPercentage: numeric("passing_percentage", { precision: 5, scale: 2 }).notNull().default("33"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const examSchedulesTable = pgTable("exam_schedules", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull(),
  subjectId: integer("subject_id").notNull(),
  classId: integer("class_id").notNull(),
  examDate: date("exam_date"),
  startTime: text("start_time").default("").notNull(),
  endTime: text("end_time").default("").notNull(),
  room: text("room").default("").notNull(),
  invigilator: text("invigilator").default("").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const examMarksTable = pgTable("exam_marks", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull(),
  studentId: integer("student_id").notNull(),
  subjectId: integer("subject_id").notNull(),
  classId: integer("class_id").notNull(),
  sectionId: integer("section_id"),
  theoryMarks: numeric("theory_marks", { precision: 6, scale: 2 }),
  practicalMarks: numeric("practical_marks", { precision: 6, scale: 2 }),
  internalMarks: numeric("internal_marks", { precision: 6, scale: 2 }),
  totalMarks: numeric("total_marks", { precision: 6, scale: 2 }),
  grade: text("grade").default("").notNull(),
  percentage: numeric("percentage", { precision: 5, scale: 2 }),
  remarks: text("remarks").default("").notNull(),
  isAbsent: boolean("is_absent").default(false).notNull(),
  isLocked: boolean("is_locked").default(false).notNull(),
  isHeld: boolean("is_held").default(false).notNull(),
  enteredByTeacherId: integer("entered_by_teacher_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const gradingRulesTable = pgTable("grading_rules", {
  id: serial("id").primaryKey(),
  minPercent: numeric("min_percent", { precision: 5, scale: 2 }).notNull(),
  maxPercent: numeric("max_percent", { precision: 5, scale: 2 }).notNull(),
  grade: text("grade").notNull(),
  gradePoint: numeric("grade_point", { precision: 4, scale: 2 }).notNull().default("0"),
  description: text("description").default("").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teacherSubjectAssignmentsTable = pgTable("teacher_subject_assignments", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull(),
  subjectId: integer("subject_id").notNull(),
  classId: integer("class_id").notNull(),
  sectionId: integer("section_id"),
  session: text("session").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const marksAuditLogTable = pgTable("marks_audit_log", {
  id: serial("id").primaryKey(),
  examMarkId: integer("exam_mark_id").notNull(),
  changedByRole: text("changed_by_role").notNull().default("admin"),
  changedByTeacherId: integer("changed_by_teacher_id"),
  oldTheoryMarks: numeric("old_theory_marks", { precision: 6, scale: 2 }),
  newTheoryMarks: numeric("new_theory_marks", { precision: 6, scale: 2 }),
  oldPracticalMarks: numeric("old_practical_marks", { precision: 6, scale: 2 }),
  newPracticalMarks: numeric("new_practical_marks", { precision: 6, scale: 2 }),
  reason: text("reason").default("").notNull(),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
});

// ─── FIR Register ─────────────────────────────────────────────────────────────

export const firRecordsTable = pgTable("fir_records", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  classId: integer("class_id").notNull(),
  incidentDate: date("incident_date").notNull(),
  description: text("description").notNull(),
  actionTaken: text("action_taken").default("").notNull(),
  severity: text("severity").notNull().default("minor"), // minor | major | critical
  status: text("status").notNull().default("open"), // open | resolved
  resolvedAt: date("resolved_at"), // date when the incident was resolved
  reportedById: integer("reported_by_id").notNull(), // teacher id
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Teacher Mark Approvals ────────────────────────────────────────────────────
export const teacherMarkApprovalsTable = pgTable("teacher_mark_approvals", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull(),
  examId: integer("exam_id").notNull(),
  classId: integer("class_id").notNull(),
  subjectId: integer("subject_id").notNull(),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  validUntil: timestamp("valid_until"),
  adminNote: text("admin_note").default(""),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
});

// ─── Web Push Subscriptions ────────────────────────────────────────────────────
export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  parentId: integer("parent_id").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Admit Card Holds ──────────────────────────────────────────────────────────
export const admitCardHoldsTable = pgTable("admit_card_holds", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  examId: integer("exam_id").notNull(),
  held: boolean("held").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Activity / Audit Log ─────────────────────────────────────────────────────

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorName: text("actor_name").notNull().default("Admin"),
  actorRole: text("actor_role").notNull().default("admin"),
  action: text("action").notNull(),
  description: text("description").notNull().default(""),
  entityType: text("entity_type").notNull().default(""),
  entityId: integer("entity_id"),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Staff Users ───────────────────────────────────────────────────────────────

export const staffUsersTable = pgTable("staff_users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("accountant"),
  permissions: text("permissions").notNull().default("{}"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Website CMS Tables ────────────────────────────────────────────────────────

export const sliderImagesTable = pgTable("slider_images", {
  id: serial("id").primaryKey(),
  title: text("title").notNull().default(""),
  subtitle: text("subtitle").default(""),
  imageUrl: text("image_url").default(""),
  ctaText: text("cta_text").default(""),
  ctaLink: text("cta_link").default(""),
  displayOrder: integer("display_order").notNull().default(0),
  isVisible: boolean("is_visible").default(true).notNull(),
  bgGradient: text("bg_gradient").default("from-blue-900 to-blue-700"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const galleryAlbumsTable = pgTable("gallery_albums", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").default(""),
  coverImageUrl: text("cover_image_url").default(""),
  albumDate: date("album_date"),
  isVisible: boolean("is_visible").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const galleryPhotosTable = pgTable("gallery_photos", {
  id: serial("id").primaryKey(),
  albumId: integer("album_id").notNull(),
  imageUrl: text("image_url").notNull(),
  caption: text("caption").default(""),
  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const testimonialsTable = pgTable("testimonials", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  designation: text("designation").default(""),
  content: text("content").notNull(),
  rating: integer("rating").default(5).notNull(),
  photoUrl: text("photo_url").default(""),
  isVisible: boolean("is_visible").default(true).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const toppersTable = pgTable("toppers", {
  id: serial("id").primaryKey(),
  studentName: text("student_name").notNull(),
  className: text("class_name").notNull(),
  marks: text("marks").default(""),
  percentage: numeric("percentage", { precision: 5, scale: 2 }).default("0"),
  examType: text("exam_type").default("Annual"),
  session: text("session").default(""),
  rank: integer("rank").default(1).notNull(),
  photoUrl: text("photo_url").default(""),
  isVisible: boolean("is_visible").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const downloadsTable = pgTable("downloads", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull().default("general"),
  description: text("description").default(""),
  fileUrl: text("file_url").notNull().default(""),
  fileType: text("file_type").default("pdf"),
  isFeatured: boolean("is_featured").default(false).notNull(),
  isVisible: boolean("is_visible").default(true).notNull(),
  downloadCount: integer("download_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const enquiriesTable = pgTable("enquiries", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").default(""),
  phone: text("phone").notNull().default(""),
  message: text("message").default(""),
  studentClass: text("student_class").default(""),
  status: text("status").default("new").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Admission Applications ────────────────────────────────────────────────────

export const admissionApplicationsTable = pgTable("admission_applications", {
  id: serial("id").primaryKey(),
  studentName: text("student_name").notNull(),
  dateOfBirth: text("date_of_birth").default(""),
  gender: text("gender").default(""),
  fatherName: text("father_name").default("").notNull(),
  motherName: text("mother_name").default(""),
  phone: text("phone").notNull(),
  alternatePhone: text("alternate_phone").default(""),
  email: text("email").default(""),
  address: text("address").default(""),
  classApplied: text("class_applied").notNull(),
  previousSchool: text("previous_school").default(""),
  previousClass: text("previous_class").default(""),
  category: text("category").default("General"),
  religion: text("religion").default(""),
  message: text("message").default(""),
  status: text("status").default("pending").notNull(),
  remarks: text("remarks").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Contact Persons (Website Contact Page) ───────────────────────────────────

export const contactPersonsTable = pgTable("contact_persons", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").default(""),
  department: text("department").default(""),
  availability: text("availability").default("Mon–Sat, 8 AM – 4 PM"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teacherDocumentsTable = pgTable("teacher_documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subject: text("subject").notNull().default(""),
  description: text("description").default(""),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").default("pdf"),
  teacherId: integer("teacher_id").notNull(),
  teacherName: text("teacher_name").notNull().default(""),
  classId: integer("class_id").notNull(),
  className: text("class_name").default(""),
  sectionId: integer("section_id"),
  sectionName: text("section_name").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const certificateRequestsTable = pgTable("certificate_requests", {
  id: serial("id").primaryKey(),
  admissionNumber: text("admission_number").notNull(),
  studentName: text("student_name").notNull().default(""),
  certificateType: text("certificate_type").notNull(),
  status: text("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  issuedAt: timestamp("issued_at"),
  remarks: text("remarks").default(""),
  certificateNumber: text("certificate_number").default(""),
  leavingDate: text("leaving_date").default(""),
  leavingReason: text("leaving_reason").default(""),
  penNumber: text("pen_number").default(""),
});

// ─── Occasional Collections ────────────────────────────────────────────────────

export const occasionalCollectionsTable = pgTable("occasional_collections", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").default(""),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  session: text("session").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const occasionalCollectionPaymentsTable = pgTable("occasional_collection_payments", {
  id: serial("id").primaryKey(),
  collectionId: integer("collection_id").notNull(),
  studentId: integer("student_id").notNull(),
  paidAmount: numeric("paid_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("unpaid"), // unpaid | partial | paid
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type OccasionalCollection = typeof occasionalCollectionsTable.$inferSelect;
export type OccasionalCollectionPayment = typeof occasionalCollectionPaymentsTable.$inferSelect;

// ─── Academic Sessions ─────────────────────────────────────────────────────────

export const academicSessionsTable = pgTable("academic_sessions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),                   // e.g. "2026-2027"
  yearStart: integer("year_start").notNull(),
  yearEnd: integer("year_end").notNull(),
  isCurrent: boolean("is_current").default(false).notNull(),
  schemaName: text("schema_name").notNull().unique(), // e.g. "y2026_2027"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AcademicSession = typeof academicSessionsTable.$inferSelect;

// Teacher year-end promotion is configured globally because permissions and the
// source/target session pair are shared by every academic-session schema.
export const teacherPromotionConfigsTable = pgTable("teacher_promotion_configs", {
  id: serial("id").primaryKey(),
  sourceSessionId: integer("source_session_id").notNull(),
  targetSessionId: integer("target_session_id").notNull(),
  windowHours: integer("window_hours").notNull().default(72),
  windowOpenedAt: timestamp("window_opened_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  sourceTargetUnique: unique("teacher_promotion_source_target_unique").on(table.sourceSessionId, table.targetSessionId),
}));

export const teacherPromotionPermissionsTable = pgTable("teacher_promotion_permissions", {
  id: serial("id").primaryKey(),
  configId: integer("config_id").notNull(),
  teacherId: integer("teacher_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  configTeacherUnique: unique("teacher_promotion_config_teacher_unique").on(table.configId, table.teacherId),
}));

export type TeacherPromotionConfig = typeof teacherPromotionConfigsTable.$inferSelect;
export type TeacherPromotionPermission = typeof teacherPromotionPermissionsTable.$inferSelect;

export const insertVehicleSchema = createInsertSchema(vehiclesTable).omit({ id: true });
export const insertTripSchema = createInsertSchema(tripsTable).omit({ id: true });
export const insertClassSchema = createInsertSchema(classesTable).omit({ id: true });
export const insertSectionSchema = createInsertSchema(sectionsTable).omit({ id: true });
export const insertTransportRouteSchema = createInsertSchema(transportRoutesTable).omit({ id: true, createdAt: true });
export const insertStudentSchema = createInsertSchema(studentsTable).omit({ id: true, createdAt: true });
export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true, createdAt: true });
export const insertFeeCategorySchema = createInsertSchema(feeCategoriesTable).omit({ id: true, createdAt: true });
export const insertFeeStructureSchema = createInsertSchema(feeStructuresTable).omit({ id: true, createdAt: true });
export const insertFeePaymentSchema = createInsertSchema(feePaymentsTable).omit({ id: true, createdAt: true });

export type Vehicle = typeof vehiclesTable.$inferSelect;
export type Trip = typeof tripsTable.$inferSelect;
export type SchoolClass = typeof classesTable.$inferSelect;
export type Section = typeof sectionsTable.$inferSelect;
export type TransportRoute = typeof transportRoutesTable.$inferSelect;
export type Student = typeof studentsTable.$inferSelect;
export type Attendance = typeof attendanceTable.$inferSelect;
export type FeeCategory = typeof feeCategoriesTable.$inferSelect;
export type FeeStructure = typeof feeStructuresTable.$inferSelect;
export type FeePayment = typeof feePaymentsTable.$inferSelect;

export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;

export type AuditLog = typeof auditLogsTable.$inferSelect;
