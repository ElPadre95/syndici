# src/server/

Server-only business logic and data access.

Rules (see `CONVENTIONS.md` §5):

- **All** Prisma access lives here — never in a component (client or server).
- Business logic (amounts, statuses, receipt numbering, authorization) lives here,
  server-side, not in the rendering layer. This is the structural fix for the
  prototype's client-side logic (audit `reference/audit/03-architecture.md` §4).

Empty for now: the data model and server layer are a **separate, later step**.
