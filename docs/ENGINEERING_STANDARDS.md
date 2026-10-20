# CloudMateria — Engineering Standards

> **Document ID:** `CM-ENG-STD-001`
> **Classification:** Internal — Engineering
> **Effective Date:** 2026-08-18
> **Last Reviewed:** 2026-08-18
> **Owner:** Engineering Leadership
> **Status:** Active

---

## Preface

This document defines the **mandatory engineering standards** for all code authored, reviewed, generated, or merged within the CloudMateria project. It serves a dual purpose:

1. **For human engineers** — as an onboarding reference and ongoing quality benchmark.
2. **For AI coding assistants** — as a system-level instruction set (e.g., Claude Skill, Cursor rules, or prompt injection) that constrains generated output to production-grade standards.

Compliance with this document is **not optional**. Deviations require explicit, documented justification approved through the standard pull-request review process.

---

## Table of Contents

1. [Guiding Principles](#1-guiding-principles)
2. [System Design & Architecture](#2-system-design--architecture)
3. [No-Hardcoding Policy](#3-no-hardcoding-policy)
4. [Documentation Requirements](#4-documentation-requirements)
5. [Security Standards](#5-security-standards)
6. [Database Engineering](#6-database-engineering)
7. [Frontend Engineering](#7-frontend-engineering)
8. [API Design](#8-api-design)
9. [Observability & Monitoring](#9-observability--monitoring)
10. [CI/CD & Deployment](#10-cicd--deployment)
11. [Dependency Management](#11-dependency-management)
12. [Performance Engineering](#12-performance-engineering)
13. [Code Quality & Review Standards](#13-code-quality--review-standards)
14. [Incident Response & Post-Mortems](#14-incident-response--post-mortems)
15. [Definition of Done](#15-definition-of-done)
16. [Violation Severity Classification](#16-violation-severity-classification)
17. [Revision History](#17-revision-history)

---

## 1. Guiding Principles

These principles are listed in priority order. When principles conflict, higher-ranked principles take precedence.

| # | Principle | Rationale |
|---|-----------|-----------|
| **P-1** | **Security is default-on, not bolted on.** | Every feature is designed assuming hostile input and a multi-tenant environment. Security is never deferred to "v2." |
| **P-2** | **No hardcoding — zero tolerance.** | Nothing environment-specific, secret, or subject to change may live in source code. This includes URLs, API keys, tenant IDs, feature flags, prices, limits, role names, and magic numbers/strings. See [§3](#3-no-hardcoding-policy) for the full policy. |
| **P-3** | **Design before code.** | Every non-trivial feature begins with a written design note: problem statement, constraints, chosen approach, alternatives considered, and trade-offs. Implementation must not begin for work touching data models, authentication, payments, or multi-tenant boundaries without a reviewed design artifact. |
| **P-4** | **Documentation is a deliverable, not an afterthought.** | Code without comments explaining *why* (not *what*) is considered incomplete. Undocumented features will not pass code review. |
| **P-5** | **Simplicity over cleverness.** | Build for the requirements in front of you plus one reasonable step ahead — never for hypothetical future scale. Over-engineering is a defect. |
| **P-6** | **Consistency over personal preference.** | Follow existing patterns in the codebase. Deviations require a documented Architecture Decision Record (ADR). |

---

## 2. System Design & Architecture

### 2.1 Pre-Implementation Requirements

Before writing any implementation code, the following must be defined and documented:

| Artifact | Description |
|----------|-------------|
| **Actors** | All entities that interact with the system — end users, administrators, third-party services, background jobs, internal microservices. |
| **Data Flow Diagram** | The request lifecycle: `ingress → validation → business logic → persistence → response`. Non-trivial flows must include a visual diagram (Mermaid, draw.io, or equivalent). |
| **System Boundaries** | Clear delineation of client-side vs. server-side vs. edge concerns; synchronous vs. asynchronous/queued processing. |
| **Failure Mode Analysis** | Documented behavior when each dependency (database, payment provider, email service, CDN) is unavailable or degraded. Include fallback strategies, circuit-breaker thresholds, and user-facing messaging. |

### 2.2 Architectural Mandates

1. **Layered Architecture** — Enforce strict separation: `Presentation → Application/Business Logic → Data Access`. UI components must never issue direct database queries or raw third-party API calls.
2. **Single Source of Truth** — Every piece of business state has exactly one authoritative location. Validate on both frontend and backend, but the backend is always authoritative.
3. **Idempotency** — All operations that may be retried (webhooks, payment confirmations, background jobs, queue consumers) must be idempotent by design.
4. **Separation of Concerns** — One module/service/function serves one purpose. If a single file handles routing, validation, business logic, and persistence, it must be decomposed.
5. **Dependency Injection** — Use dependency injection or configuration objects. Do not import global singletons with baked-in settings.
6. **Architecture Decision Records (ADRs)** — Significant architectural choices must be documented in `docs/adr/` using the format: `NNNN-title.md` containing date, status, context, decision, and consequences.

### 2.3 Scalability & Maintainability

- Design for horizontal scaling: stateless servers, externalized session/cache stores, shared-nothing architecture.
- Keep business logic framework-agnostic (pure functions/services) so it is testable without instantiating the full application stack.
- Version all APIs exposed to external consumers (`/api/v1/...`). Internal APIs should also be versioned if consumed by independently deployable services.

---

## 3. No-Hardcoding Policy

> **Severity:** Any violation of this policy is a **P0 — Blocking** review finding. See [§16](#16-violation-severity-classification).

| Category | Required Location |
|----------|-------------------|
| API keys, secrets, tokens | `.env` files (never committed) or a secrets manager (e.g., Vault, AWS Secrets Manager, Supabase Vault) |
| URLs, base paths, endpoints | Environment configuration (`process.env.API_BASE_URL`, runtime config) |
| Feature flags, limits, thresholds | Database-driven config table or a typed configuration module with environment overrides |
| Role names, permission strings | Centralized `enums` / `constants` module, or a database-driven roles table |
| Prices, tax rates, currency rules | Database, admin-configurable — never a numeric literal in application code |
| UI copy, text strings | i18n / localization files — never inline in components |
| Tenant-specific values | Multi-tenant configuration resolved at runtime — never per-tenant conditional branches with hardcoded identifiers |
| Timeouts, retry counts, intervals | Typed constants file or environment configuration |

### Decision Heuristic

> If a **non-engineer** might reasonably need to change a value, or if a value **differs between environments** (development / staging / production), it **must not** be a literal in source code.

---

## 4. Documentation Requirements

### 4.1 Per-Feature / Per-PR Checklist

Every feature branch and pull request must include:

- [ ] **README updates** — if setup steps, environment variables, or usage instructions changed.
- [ ] **Inline comments** — explaining non-obvious *why* decisions. Do not restate what the code does.
- [ ] **API documentation** — endpoint, HTTP method, authentication requirements, request/response schema, error codes. OpenAPI/Swagger is required for REST APIs; schema files for GraphQL/tRPC.
- [ ] **Data model documentation** — field definitions, relationships, constraints, and invariants. Kept in sync with the actual schema (via `docs/schema.md`, auto-generated ERD, or migration annotations).
- [ ] **Changelog entry** — for any user-facing change, following [Keep a Changelog](https://keepachangelog.com/) format.

### 4.2 Authoritative Sources

Always follow the **current official documentation** for every framework, library, and service in use (React, Next.js, Supabase, Stripe, etc.). Do not rely on cached knowledge, Stack Overflow snippets, or AI-generated patterns that may reference deprecated APIs. Verify against current docs before implementing — especially for authentication, webhooks, and payment flows.

---

## 5. Security Standards

### 5.1 Baseline Requirements (All Code Paths)

| Control | Requirement |
|---------|-------------|
| **Input Validation** | Schema-based validation (Zod, Yup, or equivalent) at every system boundary — API routes, form submissions, webhook payloads. Ad-hoc conditional checks are insufficient. |
| **Output Encoding** | Prevent XSS by never injecting raw user content into HTML/DOM without sanitization. Use framework-provided escaping mechanisms. |
| **SQL Injection Prevention** | Parameterized queries **only**. String-concatenated SQL is a **P0 violation** with no exceptions. |
| **Authentication & Authorization** | Enforced server-side on **every** route and action. Frontend visibility controls (e.g., hiding a button) are cosmetic, not security. |
| **Least Privilege** | Service roles and API keys scoped to the minimum required permissions. Database admin or service-role keys must never appear in client-side code. |
| **Secrets Management** | Secrets are **never** committed to source control. Maintain a `.env.example` with placeholder values only. CI/CD secrets must use the platform's encrypted secrets store. |
| **Rate Limiting** | Mandatory on all public-facing and authentication endpoints. Configure sensible defaults and document thresholds. |
| **Transport Security** | HTTPS everywhere. Cookies set with `HttpOnly`, `Secure`, and `SameSite` attributes. HSTS headers enabled in production. |
| **Dependency Security** | Packages kept updated. Known CVEs monitored via `npm audit`, Dependabot, or equivalent. Critical/High CVEs addressed within **48 hours** of disclosure. |
| **CORS Policy** | Explicitly configured with allowlisted origins. Wildcard (`*`) origins are prohibited in production. |

### 5.2 Multi-Tenant & Row-Level Security (Supabase or Similar)

1. Every table containing tenant-scoped data **must** have Row-Level Security (RLS) enabled — no exceptions.
2. RLS policies must be **explicit, granular, and tested** — include both positive (authorized access succeeds) and negative (unauthorized access is denied) test cases.
3. Never trust a `tenant_id` supplied by the client without verifying it against the authenticated session's claims.
4. Audit RLS policies during every schema migration that adds or modifies tenant-scoped tables.

### 5.3 Payment Processing (Stripe or Similar)

1. **Verify webhook signatures** on every incoming webhook event — reject unsigned or improperly signed payloads.
2. **Never trust client-side payment amounts** — compute and verify all authoritative amounts server-side.
3. **Log payment state transitions** for auditability with structured, queryable log entries.
4. **Idempotent webhook handlers** — processing the same event multiple times must produce the same result.
5. **PCI compliance** — never store raw card numbers, CVVs, or sensitive authentication data. Delegate tokenization to the payment processor.

---

## 6. Database Engineering

### 6.1 Schema Design

| Standard | Details |
|----------|---------|
| **Normalization** | Normalize by default. Denormalization is permitted only with documented justification (e.g., read-heavy reporting tables) and must reference the originating ADR. |
| **Referential Integrity** | Explicit foreign keys and constraints at the database level. Application-only integrity enforcement is insufficient. |
| **Migration Discipline** | Every schema change is a versioned, reviewable migration file. Manual schema edits in any environment are prohibited. |
| **Naming Conventions** | `snake_case` for all SQL identifiers. Choose singular or plural table names project-wide and enforce consistently. |
| **Indexing Strategy** | Indexes required on all foreign keys and frequently filtered/sorted columns. Query plans must be reviewed for user-facing, high-traffic paths. |
| **Deletion Strategy** | Explicitly decided per entity and documented: soft delete (e.g., financial records, audit trails) vs. hard delete (e.g., ephemeral data, user-requested GDPR erasure). |
| **Timestamps** | `created_at` and `updated_at` columns on every table. Use database-level defaults and triggers where possible. |
| **Multi-Tenancy Model** | Explicitly chosen (shared schema + `tenant_id` + RLS, schema-per-tenant, or database-per-tenant), documented in an ADR, and applied consistently. Mixed strategies are prohibited. |

### 6.2 Query Standards

- Use an ORM or query builder for standard operations; raw SQL only when the ORM is demonstrably insufficient (document why).
- Avoid `SELECT *` in production code — specify columns explicitly.
- All queries involving user-supplied input must use parameterized statements.
- Implement connection pooling with sensible limits; document pool configuration.

---

## 7. Frontend Engineering

### 7.1 Component Architecture

- **Small, composable, single-responsibility components.** Presentational components must be separated from data-fetching and logic containers/hooks.
- **Consistent file structure** — follow the project's established convention for component organization (e.g., `ComponentName/index.tsx`, `ComponentName.styles.ts`, `ComponentName.test.tsx`).

### 7.2 State Management

- **Local state** for local concerns only.
- **Server state** managed via a dedicated library (React Query / TanStack Query or equivalent) — not via prop-drilling or ad-hoc global stores.
- **Global client state** (if required) managed through a single, documented state management solution.

### 7.3 Design System & Accessibility

- **Design tokens** — use a shared token system for spacing, color, typography. No one-off inline magic values. Tailwind configuration or CSS custom properties over hardcoded hex codes and pixel values.
- **Accessibility (a11y) is mandatory** — semantic HTML, proper ARIA labels, keyboard navigation, focus management, and WCAG 2.1 AA contrast ratios.
- **Responsive by default** — mobile-first design, explicitly tested across defined breakpoints.

### 7.4 User Experience Standards

- **All UI states must be designed:** loading, empty/zero-data, error, success, and partial-failure states. Never ship only the happy path.
- **Form validation** mirrored client-side (for UX) and server-side (for security), using a shared validation schema where possible.
- **Optimistic UI updates** with proper rollback on failure for frequently performed actions.

### 7.5 Performance

- Code-splitting and lazy loading for route-level and heavy component boundaries.
- Image optimization (modern formats, responsive sizing, lazy loading).
- Avoid unnecessary re-renders; use memoization deliberately (not reflexively).
- Core Web Vitals (LCP, FID/INP, CLS) must meet "Good" thresholds as defined by Google.

---

## 8. API Design

### 8.1 REST API Standards

- Follow RESTful conventions: proper HTTP methods, meaningful status codes, consistent resource naming (`/api/v1/resources/:id`).
- **Pagination** required on all list endpoints — cursor-based preferred; offset-based acceptable with documented limits.
- **Filtering and sorting** via query parameters with a consistent convention across all endpoints.
- **Error responses** must follow a standardized schema:

  ```json
  {
    "error": {
      "code": "RESOURCE_NOT_FOUND",
      "message": "Human-readable description",
      "details": {}
    }
  }
  ```

- **Request/response contracts** defined in OpenAPI 3.x and kept in sync with the implementation.

### 8.2 Webhook Design

- All outgoing webhooks must include a signature header for verification.
- All incoming webhooks must verify signatures before processing.
- Webhook handlers must be idempotent and return `2xx` promptly (offload heavy processing to background jobs).

---

## 9. Observability & Monitoring

### 9.1 Logging

- Use **structured logging** (JSON format) with consistent fields: `timestamp`, `level`, `message`, `correlation_id`, `service`, `user_id` (where applicable).
- Log levels used correctly: `ERROR` for failures requiring attention, `WARN` for degraded-but-functional states, `INFO` for significant business events, `DEBUG` for development-only detail.
- **Never log secrets**, tokens, passwords, PII, or full request/response bodies containing sensitive data.

### 9.2 Metrics & Alerting

- Instrument key business and system metrics: request latency (p50/p95/p99), error rates, queue depths, active connections.
- Define alerting thresholds for critical metrics with documented runbooks.
- Monitor external dependency health (database, payment provider, email service).

### 9.3 Tracing

- Implement distributed tracing with correlation IDs propagated across service boundaries.
- Trace spans should cover: HTTP handlers, database queries, external API calls, and queue consumers.

---

## 10. CI/CD & Deployment

### 10.1 Pipeline Requirements

- **All merges to the main branch** must pass: linting, type checking, unit tests, integration tests, and security scans.
- **No direct commits to `main`** — all changes flow through pull requests with at least one approved review.
- **Build artifacts** are immutable and environment-agnostic; environment-specific configuration is injected at deploy time.

### 10.2 Deployment Standards

- **Zero-downtime deployments** for production (rolling updates, blue-green, or canary).
- **Rollback capability** — every deployment must be reversible within minutes.
- **Database migrations** run as a separate, ordered step before application deployment.
- **Smoke tests** execute automatically after every production deployment.

### 10.3 Environment Parity

- Development, staging, and production environments must be as similar as possible in configuration, infrastructure, and data shape (with anonymized data in non-production environments).

---

## 11. Dependency Management

- **Pin exact versions** in lock files (`package-lock.json`, `pnpm-lock.yaml`). Lock files are always committed.
- **Evaluate before adopting** — new dependencies require justification: maintenance activity, bundle size impact, license compatibility, and security posture.
- **Prefer well-maintained, widely-adopted packages** over niche alternatives.
- **Audit regularly** — run `npm audit` (or equivalent) in CI; fail the build on critical/high vulnerabilities.
- **License compliance** — only permissive licenses (MIT, Apache 2.0, BSD) unless explicitly approved. GPL/AGPL dependencies require legal review.

---

## 12. Performance Engineering

### 12.1 Backend Performance

- **Database queries** — N+1 queries are prohibited. Use eager loading, batching, or DataLoader patterns.
- **Caching strategy** — define a caching layer (Redis, CDN, in-memory) with explicit TTLs and invalidation rules. Document cache-aside vs. write-through decisions.
- **Async processing** — offload long-running operations (email, PDF generation, image processing) to background job queues.

### 12.2 Frontend Performance

- **Bundle size budgets** — define and enforce maximum bundle sizes per route. Monitor with build-time analysis.
- **Critical rendering path** — minimize render-blocking resources. Inline critical CSS; defer non-essential scripts.
- **Network efficiency** — minimize API calls; batch where possible; use HTTP/2+ and compression (Brotli/gzip).

---

## 13. Code Quality & Review Standards

### 13.1 Non-Negotiable Review Gates

| Gate | Severity |
|------|----------|
| Hardcoded values (see [§3](#3-no-hardcoding-policy)) | **P0 — Blocking** |
| Missing input validation or output encoding | **P0 — Blocking** |
| Missing or bypassed authentication/authorization | **P0 — Blocking** |
| String-concatenated SQL | **P0 — Blocking** |
| Secrets in source code | **P0 — Blocking** |
| Missing tests for business logic | **P1 — Must Fix** |
| Missing error handling | **P1 — Must Fix** |
| Inconsistent naming or style | **P2 — Should Fix** |

### 13.2 Code Standards

- **Consistent formatting** enforced via CI (ESLint + Prettier or equivalent). Formatting is never manually policed.
- **TypeScript strict mode** enabled. Usage of `any` requires an inline comment justifying why and a plan to remove it.
- **Tests required** for: business logic, API routes, RLS policies, and critical user flows (at minimum).
- **No commented-out code** in production branches. Use version control history instead.

### 13.3 Pull Request Standards

- **PRs are small and scoped** — one logical change per PR. Large PRs must be split unless truly atomic.
- **Every PR description** must include:
  - **What** changed
  - **Why** it changed
  - **How** it was tested
  - **Migration/rollback** notes (if applicable)
  - **Screenshots/recordings** for UI changes

---

## 14. Incident Response & Post-Mortems

### 14.1 Incident Severity Levels

| Level | Definition | Response Time |
|-------|------------|---------------|
| **SEV-1** | Complete service outage or data breach | Immediate (< 15 min) |
| **SEV-2** | Major feature degradation affecting many users | < 1 hour |
| **SEV-3** | Minor feature degradation or isolated user impact | < 4 hours |
| **SEV-4** | Cosmetic issue or edge case | Next business day |

### 14.2 Post-Mortem Requirements

Every SEV-1 and SEV-2 incident requires a **blameless post-mortem** within 48 hours, documented in `docs/post-mortems/YYYY-MM-DD-title.md` containing:

- Timeline of events
- Root cause analysis (5 Whys or equivalent)
- Impact assessment (users affected, duration, data implications)
- Action items with owners and due dates
- Lessons learned and process improvements

---

## 15. Definition of Done

A feature is **not complete** until every applicable item is satisfied:

- [ ] Design/approach documented before implementation (for non-trivial work)
- [ ] No hardcoded secrets, URLs, tenant data, or magic values
- [ ] Input validated and output sanitized at every system boundary
- [ ] Authentication and authorization enforced server-side
- [ ] RLS / tenant isolation verified with positive and negative tests (if applicable)
- [ ] Database changes implemented as versioned migrations with appropriate indexes
- [ ] API and data model documentation updated
- [ ] All UI states designed and implemented (loading, empty, error, success)
- [ ] Tests written for critical business logic, API routes, and security policies
- [ ] Implementation verified against current official documentation for all libraries/services
- [ ] Performance impact assessed (query plans reviewed, bundle size checked)
- [ ] Observability instrumented (logging, metrics, tracing as appropriate)
- [ ] Changelog updated for user-facing changes
- [ ] Code reviewed against this document by at least one peer

---

## 16. Violation Severity Classification

| Severity | Label | Definition | Review Action |
|----------|-------|------------|---------------|
| **P0** | **Blocking** | Security vulnerability, data integrity risk, or policy violation with production impact potential. | PR cannot be merged. Must be resolved before re-review. |
| **P1** | **Must Fix** | Functional defect, missing tests, or significant maintainability concern. | Must be resolved in the current PR or a linked follow-up PR (created before merge). |
| **P2** | **Should Fix** | Style inconsistency, minor optimization opportunity, or documentation gap. | Should be resolved in the current PR; may be deferred with reviewer agreement. |
| **P3** | **Nitpick** | Subjective preference or minor suggestion. | Entirely optional — author's discretion. |

---

## 17. Revision History

| Version | Date | Author | Summary of Changes |
|---------|------|--------|---------------------|
| 1.0 | 2026-08-18 | Engineering Leadership | Initial release — comprehensive engineering standards. |

---

> **Governance Note:** This is a living document. All modifications must be proposed via pull request with a rationale section. Changes are effective upon merge to the main branch and approval by Engineering Leadership. The owner is responsible for scheduling periodic reviews (quarterly recommended).
