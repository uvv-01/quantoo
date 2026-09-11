# Development Setup

## Prerequisites

- Node.js 20+ (recommended: 22)
- npm 10+
- PostgreSQL (for database features)
- Git

## Quick Start

```bash
# Clone the repository
git clone https://github.com/uvv-01/quantoo.git
cd quantoo

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your database URL
# DATABASE_URL="postgresql://user:password@localhost:5432/quantoo_dev?schema=public"

# Generate Prisma client
npx prisma generate

# Set up database schema
npx prisma db push

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run typecheck` | TypeScript type checking |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |
| `npx prisma studio` | Open Prisma Studio |
| `npx prisma db push` | Push schema to database |
| `npx prisma migrate dev` | Create migration |

## Project Structure

```
├── app/                  # Next.js App Router
│   ├── api/health/       # Health check endpoint
│   ├── dashboard/        # Dashboard (Phase 1 shell)
│   ├── problems/         # Problem catalog (Phase 1 shell)
│   ├── learn/            # Learning paths (Phase 1 shell)
│   ├── projects/         # Projects (Phase 1 shell)
│   ├── profile/          # User profile (Phase 1 shell)
│   └── settings/         # Settings (Phase 1 shell)
├── components/
│   ├── ui/               # Reusable UI components
│   ├── layout/           # Layout components
│   └── providers/        # Context providers
├── lib/                  # Shared utilities
├── prisma/               # Database schema
├── tests/                # Unit tests
└── docs/                 # Documentation
```

## Coding Standards

- TypeScript strict mode — no `any` types
- Use `cn()` for class merging (Tailwind + conditional classes)
- Use semantic HTML with ARIA attributes
- Follow existing component patterns
- All new routes need error handling, loading states, and empty states
- No fabricated data — use explicit empty states
