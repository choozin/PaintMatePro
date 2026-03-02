# PaintMatePro - Permanent Todo List

## Completed Prerequisites
- [x] Crew Boss Roles, Org Settings, & Terminology
- [x] Employee Pay Rates & Compensation Base
- [x] Granular Schedule Assignments (per-day, per-employee)
- [x] Schedule Day View (duration-based rendering, overlap layout, crew colors, continued labels)

## Time & Pay — Phase 1: Foundation ✅
- [x] Clean up temp files (`tsc_output_utf8*.txt`) and add to `.gitignore`
- [x] Verify TimeTracking and Payroll pages are routable from the sidebar
- [x] Add `approve_timesheets` permission (distinct from `manage_payroll`)
- [x] Add Pay Period config to Org schema (weekly / bi-weekly / semi-monthly / monthly)
- [x] Expand `TimeEntry` schema (GPS, mileage, rejected status, rejection notes)

## Time & Pay — Phase 2: Core Features (Steps 1-3) ✅
- [x] **Step 1: Pay Page** — OT rules engine, pay-period navigation, salary support, batch approve/reject/process, CSV export
- [x] **Step 2: RBAC** — 3-tier access (admin→all, crew leader→crew, employee→self) on both TimeTracking + Payroll
- [x] **Step 3: Timesheet Workflow** — Save Draft / Submit / Approve / Reject / Process pipeline

## Time & Pay — Bug Fixes & Refinements ✅
- [x] Project dropdown filtered to date-scheduled projects + custom job input
- [x] Validation preventing save/submit without required fields
- [x] Fixed weekly status aggregation (mixed/count-based, "Draft"/"Submitted"/"Mixed")
- [x] Draft entries = bold, submitted = faded/light visual distinction
- [x] Per-row submit button with confirmation dialog (replaces floating bar)
- [x] Custom job name persistence on reopen
- [x] Payroll only shows employees with submitted (non-draft) entries
- [x] Per-date rejection dialog with checkboxes and reason text area
- [x] Permission-gated Export CSV and Process buttons (`manage_payroll` only)
- [x] Approve mutation targets only 'submitted' entries (not drafts)
- [x] Expandable detail rows in Payroll table (per-day: date, project, hours, type, status)
- [x] Rejected dates notification banner on Time Tracking page

## Time & Pay — Phase 3: Industry-Standard Enhancements
### High Impact
- [ ] GPS Clock-In/Out — Log coordinates with time entries for on-site verification
- [ ] Overtime Rules Engine — Auto-calculate OT (>8 hrs/day, >40 hrs/week, holidays) instead of manual
- [ ] Employee Self-Service "My Pay" View — Timesheets, schedule, hours, estimated pay, pay history
### Medium Impact
- [ ] Break Compliance Alerts — Warn if 6+ hrs logged without a break
- [ ] Mileage/Travel Tracking — Add mileage field to complement `workType: 'travel'`
- [ ] Photo/Note Attachments on Time Entries — Before/after documentation per shift
### Lower Priority
- [ ] QuickBooks/Xero Integration — Direct API export of approved payroll data
- [ ] Job Costing Dashboard — Compare estimated vs actual labor hours per project

## Other Backlog
- [ ] Add a password reset feature
- [ ] Make the nav open by default (with login screen) if user is not logged in
- [ ] Add the ability to delete users from an App Management page

## Invoicing — Phase 2
- [ ] Stripe Connect setup & Pay Now integration (deploy Cloud Functions, configure Stripe keys, wire up portal Pay Now button)
- [ ] Credit Notes / Refunds
- [ ] Accounts Receivable Aging Report (CSV/PDF export)
- [ ] QuickBooks/Xero integration

## Invoicing — Post Phase 2
- [ ] Automated email reminders for overdue invoices (configurable: 1 day, 7 days, 14 days after due)
- [ ] Recurring invoices (for maintenance contracts, HOAs, etc.)

## Design Principles
> All features must scale gracefully from a solo operator (1 person, no crews) to a large multi-crew company. Never remove existing functionality — only expand and enhance.
