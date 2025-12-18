# AGENTS.md

## Commands
- `bun dev` - Start development server
- `bun build` - Build for production (runs prisma migrate deploy first)
- `bun lint` - Run ESLint
- `bunx prisma generate` - Generate Prisma client
- `bunx prisma migrate dev` - Create new migration

## Code Style
- TypeScript strict mode enabled
- Use `@/*` path alias for imports (e.g., `import { prisma } from "@/lib/prisma"`)
- No comments in code - keep it clean and self-documenting
- Use `interface` for object types, not `type`
- camelCase for variables/functions, PascalCase for components/interfaces
- Empty catch blocks are acceptable for non-critical errors
- Use `"use client"` directive for client components
- Prefer named exports from lib files
- No emojis in code or messages
