# AGENTS.md

## Build & Run Commands
- `npm run dev` - Start development server
- `npm run build` - Production build
- `npm run lint` - Run ESLint
- No test framework configured

## Code Style Guidelines

### TypeScript
- Strict mode enabled; use `import type { X }` for type-only imports
- Path alias: `@/*` maps to root directory

### React/Next.js
- App Router (app/ directory); PascalCase for components
- Export components as `export default function ComponentName()`
- Type props with `Readonly<{ children: React.ReactNode }>`
- Use `next/image` for images, `next/font` for fonts

### Formatting
- Double quotes for strings; 2-space indentation
- Tailwind CSS utility classes; use `dark:` prefix for dark mode
- External links: `target="_blank" rel="noopener noreferrer"`
