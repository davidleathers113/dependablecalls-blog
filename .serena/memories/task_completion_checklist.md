# Task Completion Checklist

When completing any coding task, always follow these steps:

## 1. Code Quality Checks
- Run `npm run lint` to check for ESLint errors
- Run `npm run type-check` for TypeScript errors
- Fix ALL linting and type errors immediately

## 2. Testing
- Run `npm test` to ensure unit tests pass
- For UI changes, consider running `npm run test:e2e`
- Ensure test coverage remains above 90%

## 3. Pre-commit
- Run combined check: `npm run lint && npm test`
- Stage changes with `git add -p` for selective staging
- Write descriptive commit messages

## 4. Important Reminders
- Never use regex - use validator.js or zod instead
- Never use 'any' type - always specify proper types
- Commit work every 30 minutes
- Fix all TypeScript/ESLint errors before moving on
- Follow existing code patterns and conventions

## 5. Bundle Size (for significant changes)
- Run `npm run size` to check bundle impact
- Use `npm run analyze` if bundle size increased significantly