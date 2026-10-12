---
name: frontend-dev
description: "Activates the up frontend developer role. Use when working in frontend/ — pages, the handbook workspace, domain/use-case changes, DependencyContext wiring, Tailwind v4 styling, Vite config, or TypeScript type errors. Loads verified knowledge of the existing React 19 + TypeScript + Clean Architecture app and its current gaps."
disable-model-invocation: false
---

# up Frontend Developer

Frontend developer for `up`. Verified context for `frontend/`. Code is the source of truth; re-read before relying on this.

## Stack

- React 19, Vite 8, **TypeScript**, Tailwind v4 (`@tailwindcss/vite`), Radix UI primitives, lucide-react,
  `motion`, `jspdf`. Dev server port 3000.
- Lint is `npm run lint` == `tsc --noEmit`. There is **no ESLint** config. Build is `npm run build`.
- `bun.lock` exists but **npm is authoritative**; keep `package-lock.json` behaviour consistent.

## Clean Architecture layers

- `src/domain/` — entities (`entities/Handbook.ts`), repository interfaces (`repositories/IHandbookRepository.ts`),
  errors (`errors/DomainError.ts` → `Result<T>`, `ErrorCode`). No React, no I/O.
- `src/application/use-cases/HandbookUseCases.ts` — use cases; depend only on domain interfaces.
- `src/infrastructure/` — adapters: `api/HandbookApiClient.ts`, `pdf/JsPdfHandbookExporter.ts`,
  `persistence/LocalStorageHandbookRepository.ts`, `templates/CurriculumTemplateGenerator.ts`.
- `src/presentation/` — React components + `context/DependencyContext.tsx` (DI) and `ThemeContext`.
- `src/architecture/assumptionsAndVerification.ts` + `scripts/verify-all.ts` — the assumption/verification harness.
- `scripts/verify-all.ts` also runs a static audit: domain must not import application/infrastructure/
  presentation/react; no `style={{...}}`; no `window.alert/confirm/open`; no `ui/dialog.tsx`.

## Current reality (verified 2026-10-12)

- The app persists to **localStorage** by default (`DependencyContext.tsx`) and exports PDF client-side
  with jsPDF. It is **not** wired to the backend.
- `RemoteApiHandbookRepository` exists but is used only by the verification script.
- The domain model is a **click-step recorder**; the reference sample handbooks are richer lesson pages.
  Do not assume the model is final — the product-model decision is deferred.

## Adding a UI library

Radix primitives live under `src/components/ui/*`. Add new primitives there, keep them unstyled-beyond-
Tailwind, and wire them through presentation components. Respect the static audit (no inline styles).

## Done checklist

1. `npm run lint` (tsc) clean and `npm run build` succeeds.
2. No inline `style={{...}}`; no `window.alert/confirm/open`.
3. Domain layer imports nothing from application/infrastructure/presentation/React.
4. Constructive dependencies injected via `DependencyContext`, not imported directly by components.
