# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup          # First-time setup: install deps, generate Prisma client, run migrations
npm run dev            # Start dev server (Next.js + Turbopack) on localhost:3000
npm run dev:daemon     # Start dev server in background, logs to logs.txt
npm run build          # Production build
npm run lint           # ESLint
npm test               # Run all tests (vitest)
npx vitest run src/lib/__tests__/file-system.test.ts  # Run a single test file
npm run db:reset       # Reset the SQLite database
```

## Architecture

UIGen is an AI-powered React component generator. Users describe components in a chat interface, Claude generates code via tool calls, and the result renders live in a sandboxed iframe preview.

### Data Flow

```
Chat Input → POST /api/chat (streaming) → Claude with tools → VirtualFileSystem mutations
    ↓
FileSystemContext (React state) ← tool call results update files
    ↓
PreviewFrame: Babel transforms JSX → blob URLs → import map → sandboxed iframe render
```

### Key Concepts

**Virtual File System** (`src/lib/file-system.ts`): An in-memory tree structure (`Map<string, FileNode>`) that stores all generated files. No disk I/O. Serializable for persistence. The AI manipulates files through two tools:
- `str_replace_editor` (`src/lib/tools/str-replace.ts`): create, view, str_replace, insert commands
- `file_manager` (`src/lib/tools/file-manager.ts`): rename, delete commands

**Preview Pipeline** (`src/lib/transform/jsx-transformer.ts`): Client-side transformation chain:
1. Babel transpiles all JSX/TSX files
2. Each transformed file becomes a blob URL
3. Import map resolves local files (`@/` alias), npm packages (via `esm.sh` CDN), and placeholders for missing imports
4. Generated HTML rendered in iframe with `allow-scripts allow-same-origin` sandbox

**Dual Provider** (`src/lib/provider.ts`): If `ANTHROPIC_API_KEY` is set, uses `claude-haiku-4-5` via Vercel AI SDK. Otherwise, a `MockLanguageModel` returns hardcoded component sequences (counter/form/card) for development without API costs.

**State Management**: Two React contexts wrap the main layout:
- `FileSystemProvider` (`src/lib/contexts/file-system-context.tsx`): owns `VirtualFileSystem` instance, handles tool call side effects, triggers re-renders via `refreshTrigger` counter
- `ChatProvider` (`src/lib/contexts/chat-context.tsx`): wraps Vercel AI SDK's `useChat`, sends serialized file system state with each request

### Layout

The main UI (`src/app/main-content.tsx`) is a resizable two-panel layout:
- Left panel: Chat interface
- Right panel: Tabbed Preview (iframe) / Code (FileTree + Monaco editor)

### Auth & Persistence

JWT-based auth (`src/lib/auth.ts`) with bcrypt passwords. SQLite via Prisma (`prisma/schema.prisma`). Projects store serialized messages and file system state as JSON strings. Anonymous users can use the app but projects aren't saved. Prisma client outputs to `src/generated/prisma`.

### AI System Prompt

Defined in `src/lib/prompts/generation.tsx`. Key constraints for the AI: every project needs `/App.jsx` as entrypoint, use Tailwind CSS for styling, use `@/` import alias for local files, no HTML files.

## Conventions

- Path alias: `@/*` maps to `./src/*`
- UI components use shadcn/ui (new-york style) with Radix primitives in `src/components/ui/`
- Tests live in `__tests__/` directories adjacent to the code they test, using vitest + jsdom + React Testing Library
- The API route at `src/app/api/chat/route.ts` uses `maxDuration = 120` and `maxSteps = 40` (4 for mock)
