# PaintMatePro - Permanent Todo List

## Completed Prerequisites
- [x] Crew Boss Roles, Org Settings, & Terminology
- [x] Employee Pay Rates & Compensation Base
- [x] Granular Schedule Assignments (per-day, per-employee)
- [x] Schedule Day View (duration-based rendering, overlap layout, crew colors, continued labels)

## Time & Pay — Phase 1: Foundation
- [ ] Clean up temp files (`tsc_output_utf8*.txt`) and add to `.gitignore`
- [ ] Verify TimeTracking and Payroll pages are routable from the sidebar
- [ ] Add `approve_timesheets` permission (distinct from `manage_payroll`)
- [ ] Add Pay Period config to Org schema (weekly / bi-weekly / semi-monthly / monthly)

## Time & Pay — Phase 2: Core Features (Steps 1-3)
- [ ] **Step 1: Pay Page** — Create/refine the "Pay" section showing current and past pay period data
- [ ] **Step 2: RBAC** — Enforce role-based filtering (employees see own, crew bosses see crew, admins see all)
- [ ] **Step 3: Timesheet Workflow** — Full submit → approve/reject → process pipeline

## Time & Pay — Phase 3: Industry-Standard Enhancements
### High Impact
- [ ] GPS Clock-In/Out — Log coordinates with time entries for on-site verification
- [ ] Overtime Rules Engine — Auto-calculate OT (>8 hrs/day, >40 hrs/week, holidays) instead of manual
- [ ] Employee Self-Service "My Pay" View — Timesheets, schedule, hours, estimated pay, pay history
### Medium Impact
- [ ] Break Compliance Alerts — Warn if 6+ hrs logged without a break
- [ ] Mileage/Travel Tracking — Add mileage field to complement `workType: 'travel'`
- [ ] Photo/Note Attachments on Time Entries — Before/after documentation per shift
- [ ] Weekly Timesheet Submission Flow — Review → Submit → Notification → Approve/Reject with notes
### Lower Priority
- [ ] QuickBooks/Xero Integration — Direct API export of approved payroll data
- [ ] Job Costing Dashboard — Compare estimated vs actual labor hours per project

## Other Backlog
- [ ] Add a password reset feature
- [ ] Make the nav open by default (with login screen) if user is not logged in
- [ ] Add the ability to delete users from an App Management page

## Design Principles
> All features must scale gracefully from a solo operator (1 person, no crews) to a large multi-crew company. Never remove existing functionality — only expand and enhance.
