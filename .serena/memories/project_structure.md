# DCE Website Project Structure

## Root Directory
```
dce-website/
├── src/                    # Source code
├── public/                 # Static assets
├── supabase/              # Supabase functions and migrations
├── netlify/               # Netlify functions
├── tests/                 # Test files
├── playwright-tests/      # E2E tests
├── docs/                  # Documentation
├── scripts/               # Build/utility scripts
├── performance/           # Performance configs
└── pm-oversight-logs/     # Project management logs
```

## Source Directory Structure
```
src/
├── main.tsx              # Application entry point
├── App.tsx               # Root component
├── index.css             # Global styles
├── components/           # Reusable React components
├── pages/                # Route-based page components
├── hooks/                # Custom React hooks
├── store/                # Zustand state management
├── integrations/         # External service integrations
├── services/             # Business logic and API calls
├── lib/                  # Utility functions
├── utils/                # Helper functions
├── types/                # TypeScript type definitions
├── data/                 # Static data/constants
├── assets/               # Images, fonts, etc.
└── test/                 # Test utilities
```

## Configuration Files
- `vite.config.ts` - Vite build configuration
- `tsconfig.json` - TypeScript config (references app and node configs)
- `tsconfig.app.json` - App-specific TypeScript config
- `eslint.config.js` - ESLint flat config
- `tailwind.config.js` - Tailwind CSS config
- `postcss.config.js` - PostCSS config
- `playwright.config.ts` - Playwright E2E test config
- `.env.example` - Environment variables template
- `netlify.toml` - Netlify deployment config
- `docker-compose.yml` - Docker configuration