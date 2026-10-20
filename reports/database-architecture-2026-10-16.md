# Gurukull Cloudflare database architecture

The current live mobile API is a shared Cloudflare Worker backed by the D1
binding DB (gurukul-d1-prod). Schools are rows in schools; the rest of the
records carry school_id. R2 stores private files and KV stores session/cache
data.

## Request and tenant flow

```mermaid
flowchart LR
  A[Teacher app] --> W[Shared Worker API]
  B[Parent app] --> W
  C[Admin web portal] --> W
  W --> R[resolveSchool]
  R -->|school code| S[(D1: schools)]
  R -->|custom hostname| D[(D1: domains)]
  R -->|sets tenant| Q[All tenant-scoped queries]
  Q --> DB[(D1: gurukul-d1-prod)]
  W --> KV[(KV: KV_SESSIONS)]
  W --> R2[(R2: gurukul-prod-private)]
  DB --> O[outbox / delivery worker]
  O --> K[notifications and device delivery]
```

The mobile apps use the school-code branch. A custom domain can use the
hostname branch when that hostname exists in domains. The Worker rejects a
missing code, an unknown code, or a code that disagrees with the mapped domain.

## Core entity relationships

```mermaid
erDiagram
  SCHOOLS ||--o{ DOMAINS : has
  SCHOOLS ||--o{ USERS : owns
  SCHOOLS ||--o{ ACADEMIC_YEARS : defines
  SCHOOLS ||--o{ CLASSES : contains
  CLASSES ||--o{ SECTIONS : contains
  ACADEMIC_YEARS ||--o{ STUDENTS : enrolls
  CLASSES ||--o{ STUDENTS : places
  SECTIONS ||--o{ STUDENTS : places
  USERS ||--o| STUDENTS : student_account
  USERS ||--o| TEACHERS : teacher_account
  USERS ||--o| STAFF_PROFILES : staff_account
  USERS ||--o| PARENT_PROFILES : parent_profile
  USERS ||--o{ USER_ROLES : receives
  USERS ||--o{ SESSIONS : opens
  USERS ||--o{ USER_ACCESS_CREDENTIALS : uses
  USERS ||--o{ PARENT_STUDENT_LINKS : parent
  STUDENTS ||--o{ PARENT_STUDENT_LINKS : child
  ACADEMIC_YEARS ||--o{ SUBJECTS : catalogs
  SECTIONS ||--o{ SUBJECTS : offers
  USERS ||--o{ TEACHER_ASSIGNMENTS : teaches
  SUBJECTS ||--o{ TEACHER_ASSIGNMENTS : assigned
  ACADEMIC_YEARS ||--o{ TEACHER_ASSIGNMENTS : scopes
  TEACHER_ASSIGNMENTS ||--o{ TIMETABLES : schedules
  SUBJECTS ||--o{ TIMETABLES : scheduled
  STUDENTS ||--o{ ATTENDANCE : has
  STUDENTS ||--o{ FEE_INVOICES : billed
  FEE_GROUPS ||--o{ FEE_INVOICES : categorizes
  FEE_INVOICES ||--o{ FEE_PAYMENTS : receives
  TEACHER_ASSIGNMENTS ||--o{ HOMEWORKS : supports
  HOMEWORKS ||--o{ HOMEWORK_SUBMISSIONS : receives
  STUDENTS ||--o{ HOMEWORK_SUBMISSIONS : submits
  EXAMS ||--o{ EXAM_SCHEDULES : contains
  EXAM_SCHEDULES ||--o{ EXAM_MARKS : records
  STUDENTS ||--o{ EXAM_MARKS : earns
  LIBRARY_BOOKS ||--o{ LIBRARY_COPIES : has
  LIBRARY_COPIES ||--o{ LIBRARY_LOANS : loaned
  LIBRARY_CARDS ||--o{ LIBRARY_LOANS : borrows
  STUDENTS ||--o{ TRANSPORT_ASSIGNMENTS : rides
  TRANSPORT_ROUTES ||--o{ TRANSPORT_ASSIGNMENTS : serves
  STUDENTS ||--o{ STUDENT_CONDUCT : has
  STUDENTS ||--o{ CERTIFICATE_ISSUES : receives
```

## Table inventory by area

**Tenant and identity:** schools, domains, users, sessions, devices,
user_profiles, user_roles, user_access_credentials, parent_profiles,
staff_profiles, students, teachers, parent_student_links.

**Academics:** academic_years, classes, sections, subjects,
teacher_assignments, timetables, timetable_configuration,
timetable_archives, school_configuration.

**Learning and communication:** homeworks, homework_submissions,
lesson_plans, notices, attendance, attendance_batches, absent_reasons,
exams, exam_schedules, exam_marks, exam_grade_bands, school_quizzes,
school_quiz_attempts, quiz_review_history, student_conduct,
conduct_parent_reads, school_live_classes, live_class_link_launches.

**Finance and people operations:** fee_groups, fee_invoices, fee_payments,
finance_policy, fee_ledger_entries, leave_types, staff_leaves,
payroll_templates, payroll_structures, payroll_payslips, payroll_payments.

**Operations:** library_categories, library_books, library_copies,
library_cards, library_loans, inventory_categories, inventory_suppliers,
inventory_items, inventory_transactions, visitor_logs, transport_vehicles,
transport_routes, transport_stops, transport_assignments.

**Lifecycle and documents:** student_lifecycle, alumni_profiles,
certificate_templates, certificate_issues, files.

**Reliability, audit, and delivery:** outbox, changelog, command_idempotency,
mutation_commands, command_guards, audit_events, delivery_outcomes,
upload_reservations, storage_limits, provisioning_operations,
login_attempts, administrator enrollment tables, and access-key tables.

## Isolation rule

Every school-owned table includes school_id, and API queries bind the
authenticated user's school_id in their WHERE clauses. Composite foreign keys
and SQLite triggers reject relationships that mix schools. The shared D1
database therefore provides infrastructure sharing while preserving tenant
data isolation.
