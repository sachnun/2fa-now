# AGENTS.md

## Commands
- `npm run dev` - Start dev server
- `npm run build` - Production build (run before committing)
- `npm run lint` - ESLint with Next.js rules
- `npx prisma migrate dev` - Run database migrations
- No test framework configured

## Code Style

### TypeScript & Imports
- Strict mode; use `import type { X }` for type-only imports
- Path alias: `@/*` maps to root (e.g., `@/lib/auth`)
- Group imports: react, external libs, local modules

### React/Next.js
- App Router in `app/`; use `"use client"` directive for client components
- Export: `export default function ComponentName()`
- Props: `Readonly<{ children: React.ReactNode }>`
- Inline prop types for component-specific props (no separate interface file)

### Formatting & Naming
- Double quotes, 2-space indent; Tailwind for styling with `dark:` variants
- camelCase functions/variables, PascalCase components, UPPER_CASE constants
- Interfaces: PascalCase (e.g., `SecretEntry`)

### Error Handling
- API routes: return `NextResponse.json({ error: "Message" }, { status: code })`
- Client: use empty catch blocks for non-critical errors, show UI feedback for user-facing errors
