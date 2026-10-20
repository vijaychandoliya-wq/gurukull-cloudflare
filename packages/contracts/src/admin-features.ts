// Backend implementation capabilities; genuine acceptance results are recorded separately.
export const adminFeatures = [
  {
    "path": "/dashboard",
    "title": "Dashboard",
    "status": "read_only",
    "reason": "School setup status and genuine directory counts only. Attendance, finance and analytics are not implemented."
  },
  {
    "path": "/students",
    "title": "Students",
    "status": "implemented",
    "reason": "Student create, read and edit; actual current academic year and class/section required. Secure login issued separately."
  },
  {
    "path": "/students/:id",
    "title": "Student Profile",
    "status": "implemented",
    "reason": "Tenant-scoped student profile and editing. Medical/documents/conduct workflows remain separate."
  },
  {
    "path": "/id-cards",
    "title": "Student ID cards",
    "status": "implemented",
    "reason": "Actual current-year student card data, preview and browser printing with real admission numbers. Final printing requires school address/year and complete profile data. Photo/logo uploads and physical print acceptance remain separate."
  },
  {
    "path": "/teachers",
    "title": "Teachers",
    "status": "implemented",
    "reason": "Teacher create, read and edit; actual school settings/current academic year required. Secure login issued separately."
  },
  {
    "path": "/teachers/:id",
    "title": "Teacher Profile",
    "status": "implemented",
    "reason": "Tenant-scoped teacher profile and editing. Assignments are a separate workflow."
  },
  {
    "path": "/teacher-id-cards",
    "title": "Teacher ID cards",
    "status": "implemented",
    "reason": "Actual teacher card data, preview and browser printing using the genuine employee number. No fabricated school board/year. Photo/logo uploads and physical print acceptance remain separate."
  },
  {
    "path": "/staff-id-cards",
    "title": "Staff ID cards",
    "status": "implemented",
    "reason": "Actual staff-profile employee numbers, card preview and browser printing. Administrator accounts without a staff profile are not given invented employee IDs. Photo/logo uploads and print acceptance remain separate."
  },
  {
    "path": "/student-portal",
    "title": "Student Portal",
    "status": "implemented",
    "reason": "Own published homework/text submissions, timetable, attendance, actual fee invoices and published exam subject scores; administrator preview of actual students. Own quizzes/results, transport, certificates and scheduled existing meeting links are connected. Private document uploads remain separate. Actual student login acceptance pending activation/roster."
  },
  {
    "path": "/parent-portal",
    "title": "Parent Portal",
    "status": "implemented",
    "reason": "Linked-child homework/submissions, timetable, attendance, actual fees and published exam subject scores; administrator preview of genuine families. Own quizzes/results, transport, certificates and scheduled existing meeting links are connected. Private document uploads remain separate. Actual parent login acceptance pending activation/family records."
  },
  {
    "path": "/academics",
    "title": "Academics",
    "status": "implemented",
    "reason": "Actual academic years, classes and sections can be created. No invented templates."
  },
  {
    "path": "/subjects",
    "title": "Subjects",
    "status": "implemented",
    "reason": "Current-year subjects and teacher assignments with explicit weekly periods. Genuine record acceptance pending school setup."
  },
  {
    "path": "/timetable",
    "title": "Timetable",
    "status": "implemented",
    "reason": "Actual teaching-day/period configuration and assigned slots; class, teacher and room conflicts, stale updates, retry protection and recoverable removal. Real scheduling acceptance remains pending."
  },
  {
    "path": "/homework",
    "title": "Homework",
    "status": "implemented",
    "reason": "Assigned homework draft/publish, administrator approval, versioned editing/archive, text submissions and review. Attachments and notification delivery remain separate; actual class acceptance pending."
  },
  {
    "path": "/lesson-plans",
    "title": "Lesson Plan",
    "status": "implemented",
    "reason": "Assigned lesson stages, draft/publish validation, administrator approval, editing and archive/restore. Genuine teacher acceptance pending."
  },
  {
    "path": "/promotion",
    "title": "Promotion",
    "status": "implemented",
    "reason": "Actual individual promote/retain/graduate operations, class/year/date validation, immutable enrollment history, session/key revocation and guarded latest-operation undo. Graduations populate the genuine alumni directory. Actual roster and year-rollover acceptance remain pending; bulk promotion is separate."
  },
  {
    "path": "/parents",
    "title": "Parents",
    "status": "implemented",
    "reason": "Parent create, read and edit with versioned actual child links and occupational details. Individual login issued separately; genuine family acceptance pending."
  },
  {
    "path": "/attendance",
    "title": "Attendance",
    "status": "implemented",
    "reason": "Current-roster present/absent recording by session with actual reasons, version/retry protection and parent/student reads. Existing late/half-day/excused records require a separate review workflow; actual roster acceptance pending."
  },
  {
    "path": "/discipline",
    "title": "Discipline",
    "status": "implemented",
    "reason": "Actual student conduct records, active reporting teachers, school-local incident date/time, versioned edits, archive/restore and explicit parent/student visibility. Parent read acknowledgements are separate from push delivery. PDF attachments and notification delivery remain pending; genuine-record acceptance is not complete."
  },
  {
    "path": "/exams",
    "title": "Exams",
    "status": "implemented",
    "reason": "Actual exam dates and result policy, assigned subject schedules, maximum/pass marks, class time conflicts, explicit grade bands, archive/restore and complete-roster publication. No default grade scale. Genuine exam and assigned-teacher acceptance pending actual records."
  },
  {
    "path": "/marks-entry/:scheduleId",
    "title": "Marks Entry",
    "status": "implemented",
    "reason": "Actual assigned roster, up to 50 versioned scores/absence records per save, two-decimal marks and maximum checks. Published results lock edits; future exams cannot be marked. Real marking and Free batch CPU acceptance pending."
  },
  {
    "path": "/exam-results/:examId",
    "title": "Exam Results",
    "status": "implemented",
    "reason": "Recorded totals with the saved absence/rounding policy and actual grade bands; incomplete marks have no computed result. Published results and subject scores are restricted to the actual student and linked parents. Genuine result acceptance pending."
  },
  {
    "path": "/quizzes",
    "title": "Quizzes",
    "status": "implemented",
    "reason": "Actual assigned questions/answer keys, administrator approval, explicit windows and server deadlines, bounded own-student attempts, saved answers, exact grading, manual review with immutable correction history and own/linked-child results. Expired saved attempts can be explicitly finalized. Real timed-student/teacher acceptance remains pending; no background deadline sweep or notification delivery."
  },
  {
    "path": "/fees",
    "title": "Fees",
    "status": "implemented",
    "reason": "Actual fee groups, student invoices, explicit numbering policy, integer currency collections/concessions, version/retry/overpayment checks, immutable receipts, ledger corrections and unpaid cancellation. Does not charge or refund through a provider; fee structures/bulk assignment, reminders and genuine financial reconciliation remain separate."
  },
  {
    "path": "/payroll",
    "title": "Payroll",
    "status": "implemented",
    "reason": "Actual salary templates, fixed/percentage/employee/formula heads, exact arithmetic with explicit rounding, versioned employee structures, immutable draft/published/void payslips and bounded manual payment/reversal ledger. Own employee payslips are scoped. No guessed tax, automatic leave deductions or provider transfers; genuine payroll reconciliation remains pending."
  },
  {
    "path": "/staff",
    "title": "Staff",
    "status": "implemented",
    "reason": "Staff create, read and edit with separate individual credentials."
  },
  {
    "path": "/leaves",
    "title": "Staff Leave",
    "status": "implemented",
    "reason": "Actual leave policies, own staff/teacher applications and administrator review/cancellation. Overlap and approved allowance checks; chargeable days supplied explicitly. Payroll deduction/notifications are separate. Genuine employee acceptance pending."
  },
  {
    "path": "/library",
    "title": "Library",
    "status": "implemented",
    "reason": "Actual ISBN catalog, individually identified copies and borrower cards, explicit lending/due dates, versioned extensions, return/cancellation and retained loan history. Concurrent double lending is prevented. Own/linked-student reads are scoped. Cover uploads, fine policies and notification delivery remain separate; real lending acceptance is pending."
  },
  {
    "path": "/transport",
    "title": "Transport",
    "status": "implemented",
    "reason": "Actual vehicles/drivers/capacities, current-year routes/service windows, incremental stops and own/linked-student assignments. Vehicle/class conflicts, capacity, version/retry checks and retained archive/restore. Fares do not create invoices; GPS and delivery are separate. Real transport acceptance remains pending."
  },
  {
    "path": "/inventory",
    "title": "Inventory",
    "status": "implemented",
    "reason": "Actual categories, suppliers and stock items; versioned atomic movements, insufficient-stock checks, immutable ledger, compensating corrections and archive/restore. Genuine stock acceptance pending actual setup and records."
  },
  {
    "path": "/notices",
    "title": "Notices",
    "status": "implemented",
    "reason": "Notice create/edit, school/role/class audiences, scheduled publication, expiry, archive and restore. Attachments, backgrounds and notification delivery are not included."
  },
  {
    "path": "/reception",
    "title": "Reception",
    "status": "implemented",
    "reason": "Actual visitor entries, student/host links, school-calendar date and entry/exit validation, versioned editing and exited-visit archive/restore. Genuine reception acceptance pending actual records."
  },
  {
    "path": "/certificates",
    "title": "Certificates",
    "status": "implemented",
    "reason": "Actual text templates and explicit certificate numbers, immutable student/school snapshots, void history, authenticated print and own/linked-child reads. No forged signature/image or PDF delivery. Actual student and physical print acceptance remain pending."
  },
  {
    "path": "/alumni",
    "title": "Alumni",
    "status": "implemented",
    "reason": "Actual historical alumni create/edit and archive/restore, or genuine graduation-linked profiles. No invented graduates, account privileges or invitations. Actual alumni and graduation acceptance remain pending."
  },
  {
    "path": "/live-classes",
    "title": "Live Class",
    "status": "implemented",
    "reason": "Actual assigned schedules with class/teacher conflicts, approval, archive/restore and role-scoped links to existing Google Meet, Zoom or Teams meetings. Student/parent links open in the scheduled window. Provider hosting, recording and attendance are separate; real member/provider acceptance remains pending."
  },
  {
    "path": "/settings",
    "title": "Settings",
    "status": "implemented",
    "reason": "Actual school settings can be saved. Activation is gated on Free capacity/recovery verification."
  },
  {
    "path": "/profile",
    "title": "Profile",
    "status": "implemented",
    "reason": "Own profile reads and updates. Photo/private uploads and owner-key recovery remain separate."
  },
  {
    "path": "/feature-report",
    "title": "Administrator feature report",
    "status": "read_only",
    "reason": "Loads current backend feature capabilities and release with explicit refresh. Real-data acceptance is reported separately."
  },
  {
    "path": "/roles",
    "title": "Roles and account access",
    "status": "implemented",
    "reason": "Tenant-bound individual access-key issuance/revocation for real teacher/staff/parent/student accounts; no arbitrary platform privilege grants."
  }
] as const;
