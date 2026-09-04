# Build Order — BizFlow Development Roadmap

*Extracted from `/docs/product/blueprint.md` Section 71. This is the sequenced, step-by-step development plan Claude Code should follow, in order. Update the "Current build step" section in `CLAUDE.md` at the root as each step completes.*

Sequenced for fastest path to a demonstrable, sellable core loop (signup → customer → quote → invoice → payment → dashboard), with foundational/cross-cutting concerns (auth, tenancy, RBAC) built first since every later module depends on them.

### Step 1 — Foundation & Tooling
**Objective:** repo, CI/CD skeleton, Docker Compose local environment, base NestJS + React apps wired together.
**Why now:** everything else depends on a working scaffold.
**Dependencies:** none.
**DB changes:** initial empty schema/migration tooling setup.
**Backend:** NestJS project structure, config module, logging, health-check endpoint.
**Frontend:** Vite + React app shell, routing skeleton, design-system base (Tailwind/Radix setup).
**Tests:** CI pipeline runs a trivial test successfully.
**Acceptance criteria:** `docker-compose up` runs API + frontend + Postgres + Redis locally; CI passes on an empty PR.
**Deliverables:** working scaffold, CLAUDE.md, initial /docs structure.

### Step 2 — Authentication
**Objective:** signup/login/logout, password hashing, session/JWT issuance.
**Why now:** every subsequent feature requires an authenticated user.
**Dependencies:** Step 1.
**DB changes:** `users` table.
**Backend:** `auth` module (register, login, refresh, guards).
**Frontend:** signup/login pages, auth state management.
**Tests:** unit tests for password hashing/token issuance; API tests for auth endpoints including failure cases.
**Acceptance criteria:** a user can register, log in, and access a protected route; invalid credentials are rejected.
**Deliverables:** working auth module.

### Step 3 — Multi-Tenancy & Organizations
**Objective:** organization creation, membership, base tenant-scoping infrastructure (repository guard + RLS).
**Why now:** must exist before any business data module, since every subsequent table depends on `organization_id` scoping.
**Dependencies:** Step 2.
**DB changes:** `organizations`, `organization_settings`, `memberships` tables; RLS policies established as a pattern.
**Backend:** `organizations` module; base tenant-scoped repository class; tenant-context middleware/guard.
**Frontend:** organization creation flow (name/country/currency), org switcher (for multi-org users).
**Tests:** **tenant isolation test suite established here as the template** for all future modules; API tests for org creation/membership.
**Acceptance criteria:** a logged-in user can create an org and is denied access to any other org's (currently empty) data by construction.
**Deliverables:** tenancy foundation + isolation test template used by every future module.

### Step 4 — Users, Roles & Permissions
**Objective:** invite teammates, assign roles (Owner/Admin/Member), enforce role-based guards.
**Why now:** needed before building modules that require permission checks (nearly everything financial).
**Dependencies:** Step 3.
**DB changes:** `roles`, `permissions` (or a simpler role-enum-based approach for MVP).
**Backend:** `users` module extension (invitations), permission guard decorator pattern.
**Frontend:** team management screen, invitation flow.
**Tests:** permission-denied cases for a sample protected endpoint.
**Acceptance criteria:** an Owner can invite a Member; a Member is denied access to an Owner-only action.
**Deliverables:** RBAC pattern reusable by every later module.

### Step 5 — CRM Core (Leads & Customers)
**Objective:** create/manage leads, convert to customers, contacts, notes/activities.
**Why now:** this is the entry point of the core value loop and the first real "business data" module, proving the tenancy + RBAC patterns end-to-end.
**Dependencies:** Steps 3–4.
**DB changes:** `leads`, `customers`, `contacts`.
**Backend:** `crm` module.
**Frontend:** leads/customers list + detail views, using the reusable table component built here for reuse across the app.
**Tests:** unit/service tests, API tests, tenant isolation tests (following Step 3's template).
**Acceptance criteria:** a user can create a lead, convert it to a customer, and add notes.
**Deliverables:** CRM module + the reusable data-table pattern for the rest of the frontend.

### Step 6 — Catalog (Products & Services)
**Objective:** manage sellable items (`catalog_items`).
**Why now:** required before quotations/invoices can reference line items.
**Dependencies:** Step 3.
**DB changes:** `catalog_items`.
**Backend:** `sales` module (catalog portion).
**Frontend:** catalog management screen.
**Tests:** unit + API tests.
**Acceptance criteria:** a user can create products/services with prices and (basic) tax association.
**Deliverables:** catalog module.

### Step 7 — Tax Engine (basic)
**Objective:** configurable tax rules applied to catalog items/invoices.
**Why now:** must exist before invoice/quote totals can be calculated correctly.
**Dependencies:** Step 6.
**DB changes:** `tax_rules`.
**Backend:** tax calculation service (pure, well-tested domain logic).
**Frontend:** basic tax settings screen.
**Tests:** extensive unit tests on tax calculation edge cases (inclusive/exclusive, multiple rates).
**Acceptance criteria:** correct tax totals computed for a range of test scenarios.
**Deliverables:** tax calculation service reused by quotations and invoicing.

### Step 8 — Quotations
**Objective:** create, send, and track quotations; convert accepted quotations to invoices.
**Why now:** the natural next step in the sales workflow, and the direct predecessor to invoicing.
**Dependencies:** Steps 5–7.
**DB changes:** `quotations`, `quotation_items`.
**Backend:** quotation service (creation, status transitions, PDF generation trigger, convert-to-invoice).
**Frontend:** quotation builder (line items, totals), PDF preview, send flow.
**Tests:** unit tests on quotation totals/status transitions, API tests, E2E test for create→send.
**Acceptance criteria:** a user creates a quotation, sends it by email as a PDF, and can mark it accepted.
**Deliverables:** quotation module + PDF generation infrastructure (reused by invoicing).

### Step 9 — Invoicing
**Objective:** invoices (standalone or converted from quotations), PDF, email send, status tracking, overdue detection, credit notes.
**Why now:** the core monetizable deliverable of the MVP.
**Dependencies:** Step 8 (for conversion), Step 7 (tax).
**DB changes:** `invoices`, `invoice_items`, `credit_notes`.
**Backend:** `invoicing` module; scheduled job for overdue-status transition (Step 1 of scheduling infra, Section 35).
**Frontend:** invoice builder, list with status filters, PDF/email send, credit-note flow.
**Tests:** unit tests on invoice totals/status, API tests, E2E test for quote→invoice conversion, isolation tests.
**Acceptance criteria:** a user can send an invoice, it correctly reflects tax totals, and overdue status updates automatically via the scheduled job.
**Deliverables:** invoicing module, queue/worker infrastructure (BullMQ) stood up here for the first time.

### Step 10 — Payments (Manual + One Provider)
**Objective:** record manual payments; integrate one online provider (Stripe) behind the adapter interface; partial payments; payment links.
**Why now:** closes the core loop (get paid), the ultimate proof of value.
**Dependencies:** Step 9.
**DB changes:** `payments`.
**Backend:** `payments` module with the provider-adapter interface (Section 25) built from the start (even with only one live adapter), webhook handling, reconciliation logic.
**Frontend:** "Record payment" flow, payment link generation/display, invoice payment-status reflecting reconciled payments.
**Tests:** webhook signature/idempotency tests, reconciliation tests, API tests.
**Acceptance criteria:** an invoice can be paid via a Stripe payment link or marked paid manually, and its status updates correctly, including partial payments.
**Deliverables:** payments module + provider-adapter pattern ready for future providers.

### Step 11 — Dashboard
**Objective:** the primary "what's happening in my business" screen, aggregating data from Steps 5–10.
**Why now:** requires real data from the prior modules to be meaningful; this is the moment the product "clicks" for a demo/pilot user.
**Dependencies:** Steps 5–10.
**DB changes:** none (read-model queries; Redis caching of expensive aggregates introduced here).
**Backend:** `reports`/dashboard aggregation service.
**Frontend:** dashboard screen with KPI cards and charts (Recharts).
**Tests:** aggregation correctness tests.
**Acceptance criteria:** dashboard accurately reflects revenue, outstanding/overdue invoices, and recent activity for the current org.
**Deliverables:** dashboard + the caching pattern reused by future reports.

### Step 12 — Expenses & Tasks (lightweight)
**Objective:** basic expense entry/categories and simple tasks tied to customers/invoices.
**Why now:** rounds out the MVP's "should have" scope without blocking the core loop above.
**Dependencies:** Step 5 (tasks reference customers), Step 3.
**DB changes:** `expenses`, `expense_categories`, `tasks`.
**Backend:** `expenses`, `tasks` modules.
**Frontend:** expense entry screen, task list/detail with due dates.
**Tests:** standard unit/API/isolation tests.
**Acceptance criteria:** a user can log an expense and create/complete a task linked to a customer.
**Deliverables:** expenses + tasks modules.

### Step 13 — Notifications & Basic Reports
**Objective:** in-app + email notifications (invoice sent, payment received, task due); a handful of exportable reports.
**Why now:** improves retention/engagement once the core loop is live; low risk to sequence after the revenue-critical path.
**Dependencies:** Step 9–10 (events to notify on).
**DB changes:** `notifications`.
**Backend:** `notifications` module (consuming domain events emitted by invoicing/payments/tasks), `reports` module additions.
**Frontend:** notification center, report screens with CSV export.
**Tests:** notification delivery tests, report accuracy tests.
**Acceptance criteria:** a user is notified when an invoice is paid; a sales/revenue report exports correctly.
**Deliverables:** notification infrastructure (event-driven pattern usable by future automation), initial report set.

### Step 14 — Subscriptions (BizFlow billing the organization)
**Objective:** plans, trial, upgrade/downgrade, BizFlow charging the org itself.
**Why now:** required before the product can actually generate revenue; deliberately built as a clearly separate domain from Step 10's payments (Section 26).
**Dependencies:** Step 3 (org), independent of Steps 5–13's business data.
**DB changes:** `plans`, `subscriptions`, `subscription_items`, `usage_records`.
**Backend:** `subscriptions` module, integrated with the same Stripe adapter but a fully separate service/billing flow from customer-facing payments.
**Frontend:** plan selection, billing settings, upgrade/downgrade flow.
**Tests:** billing lifecycle tests (trial expiry, failed payment/dunning, plan limit enforcement).
**Acceptance criteria:** an org can select a plan, be billed, and have plan limits (e.g., invoice count) enforced.
**Deliverables:** subscriptions module — MVP is now commercially launchable.

### Step 15 — Recurring Invoices & First Automations
**Objective:** recurring invoice generation; 2–3 hardcoded-but-configurable reminder automations (overdue invoice reminder, quote-expiry reminder).
**Why now:** first Phase-2-adjacent capability, high leverage for retention, and validates the queue/scheduler infrastructure under a slightly more complex, multi-step job before investing in the generic automation engine.
**Dependencies:** Steps 9, 13.
**DB changes:** `invoices.recurrence_rule` (or a small `recurring_invoice_schedules` table).
**Backend:** scheduled job extensions.
**Frontend:** "make recurring" toggle on invoices; reminder settings.
**Tests:** scheduled job correctness/idempotency tests.
**Acceptance criteria:** a recurring invoice generates correctly on schedule; an overdue reminder email is sent once per invoice, not duplicated.
**Deliverables:** recurring billing + first automation behaviors, informing the design of the future generic automation engine.

### Step 16+ — Phase 2 (post-MVP, sequenced after real customer feedback)
