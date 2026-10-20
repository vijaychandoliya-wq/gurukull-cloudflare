# Gurukul Ant Design Web ERP Portal

An enterprise-grade, standalone School ERP Web Portal built with **Ant Design (antd v5)**, React, TypeScript, and Vite, connected to the modern headless multi-tenant backend engine ([`gurukul-backend-core`](../gurukul-backend-core)).

---

## 1. Features & Capabilities

- **Ant Design System**: Full design token configuration (`#0A2540` Brand Navy, `#F59E0B` Gold, `#1890FF` Info, `#10B981` Success).
- **Multi-Tenancy & School Switcher**: Seamlessly switch between schools (`GW101 Greenwood High`, `GW102 Apex Academy`).
- **Dynamic Role Simulation**: Toggle between **Principal**, **Teacher**, **Accountant**, **Admin**, and **Receptionist**.
- **14 Operational Domain Views**:
  1. 📊 **Executive Command Dashboard**: Real-time KPI statistics, attendance meter, revenue progress, and academic milestones.
  2. 👨‍🎓 **Students & Admissions**: Student table with standard/section filters and enrollment modal.
  3. 📋 **Daily Digital Attendance**: Class-wise attendance grid with Present/Absent toggles, absence reason selector, and parent alert dispatch.
  4. 📝 **Exam Marks Entry & Grading**: Marks spreadsheet with max marks validation and letter grade calculation.
  5. 💳 **Fee Invoicing & Payment Collection**: Invoicing ledger with quick payment modal and computerized receipt generation (`REC-2026-XXXX`).
  6. 🗓️ **Weekly Timetable**: Period schedule grid with collision detection indicator.
  7. 👥 **Staff Leave Approvals**: Multi-tier leave state machine with one-click **Approve** / **Reject** buttons.
  8. 📢 **Notice Board & Circulars**: Official announcement publisher with target audience scoping.
  9. 📜 **Certificate Generator**: Instant issuance of Transfer Certificates (TC), Bonafide, Character, and Study certificates.
  10. ❓ **Online Quizzes & Question Banks**: Timed online quiz manager with multiple-choice questions.
  11. 📦 **Inventory & Asset Management**: Stock levels, supplier directory, and asset issue/return ledger.
  12. 🎓 **Alumni Network**: Alumni directory categorized by graduation year and event registration.
  13. 🏢 **Front-Office & Reception Desk**: Visitor gate pass generator with badge numbers and phone call logs.
  14. 🎥 **Live Video Classrooms**: Scheduled live video classes with Google Meet, Zoom, and Jitsi integration.

---

## 2. Quickstart Guide

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev
# Running on: http://localhost:3001

# 3. Production build
npm run build
```

---

## 3. Backend Integration

The portal communicates directly with `gurukul-backend-core` via RESTful APIs:
- Default URL: `http://localhost:8000` (Configurable via `VITE_API_URL`)
- Request Header: `x-school-code: GW101`
- Auth Header: `Authorization: Bearer <token>`
