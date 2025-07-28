# Suggested Commands for DCE Website Development

## Development
- `npm run dev` - Start development server (localhost:5173)
- `npm run preview` - Preview production build

## Building
- `npm run build` - TypeScript check and production build

## Testing
- `npm test` - Run Vitest unit tests
- `npm run test:ci` - Run tests with coverage
- `npm run test:ui` - Run tests with UI interface
- `npm run test:e2e` - Run Playwright end-to-end tests
- `npm run test:e2e:ui` - Run Playwright tests with UI

## Code Quality
- `npm run lint` - Run ESLint and TypeScript checks
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run type-check` - TypeScript type checking only

## Analysis
- `npm run size` - Check bundle sizes
- `npm run analyze` - Analyze bundle size with details

## Git Hooks
- `npm run prepare` - Setup Husky git hooks (runs automatically on install)

## System Commands (macOS)
- `git status` - Check git status
- `git diff` - View changes
- `git add -p` - Stage changes interactively
- `git commit -m "message"` - Commit changes
- `ls -la` - List files with details
- `find . -name "*.tsx"` - Find files by pattern
- `grep -r "pattern" .` - Search for pattern in files