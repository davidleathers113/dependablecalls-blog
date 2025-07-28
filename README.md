# DCE Platform - Dependable Calls Exchange

A modern pay-per-call network platform connecting suppliers (traffic providers) with buyers (advertisers) for high-quality lead generation.

## 🚀 Overview

DCE Platform facilitates real-time call tracking and lead management for performance-based marketing campaigns. Built with cutting-edge technologies for reliability, scalability, and real-time performance.

### Key Features

- **Real-time Call Tracking** - Monitor calls as they happen with live status updates
- **Campaign Management** - Create and manage targeted campaigns with advanced filtering
- **Fraud Prevention** - Built-in fraud detection and quality scoring
- **Role-based Access** - Separate interfaces for suppliers, buyers, and administrators
- **Analytics Dashboard** - Comprehensive reporting and performance metrics

## 🛠️ Technology Stack

- **Frontend**: Vite 7.0 + React 19.1 + TypeScript 5.8
- **Styling**: Tailwind CSS 4.1 + Headless UI 2.2
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **State Management**: Zustand 5.0 + React Query 5.83
- **Testing**: Vitest 3.2 + Playwright 1.54
- **Hosting**: Netlify with Edge Functions

## 📋 Prerequisites

- Node.js 22.15.0 or higher
- npm 10.x or higher
- Supabase CLI

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/your-org/dce-website.git
cd dce-website
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# Supabase
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Sentry (optional)
VITE_SENTRY_DSN=your-sentry-dsn
```

### 4. Set up the database

```bash
# Start Supabase locally
npx supabase start

# Run migrations
npx supabase db push

# Seed test data (optional)
npx supabase db seed
```

### 5. Set up test accounts

```bash
# Create test accounts and update seed data
npm run setup:test-accounts

# Reset database with test data
npx supabase db reset
```

See [Test Accounts Setup Guide](./docs/TEST_ACCOUNTS_SETUP.md) for detailed information about test credentials and usage.

### 6. Start the development server

```bash
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173)

## 🏗️ Project Structure

```
dce-website/
├── src/
│   ├── components/     # Reusable React components
│   ├── pages/         # Route-based page components
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Shared utilities
│   ├── store/         # Zustand state management
│   ├── services/      # Business logic layer
│   ├── integrations/  # Third-party integrations
│   ├── types/         # TypeScript definitions
│   └── utils/         # Helper functions
├── tests/
│   ├── unit/          # Unit tests
│   ├── integration/   # Integration tests
│   ├── e2e/          # End-to-end tests
│   └── fixtures/      # Test data
├── supabase/
│   ├── migrations/    # Database migrations
│   └── functions/     # Edge functions
└── .github/
    └── workflows/     # CI/CD pipelines
```

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run tests with coverage
npm run test:ci

# Run E2E tests
npm run test:e2e

# Open test UI
npm run test:ui
```

## 📦 Building for Production

```bash
# Type check
npm run type-check

# Lint code
npm run lint

# Build production bundle
npm run build

# Preview production build
npm run preview
```

## 🚢 Deployment

The project is configured for automatic deployment to Netlify:

1. Push to `main` branch triggers production deployment
2. Pull requests create preview deployments
3. Environment variables are managed in Netlify dashboard

### Manual deployment

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy to production
netlify deploy --prod
```

## 🔧 Development Guidelines

### Code Quality Rules

- **NO regex patterns** - Use validator.js or zod for validation
- **NO any types** - Always use proper TypeScript types
- **Fix all TypeScript/ESLint errors** immediately
- **90% test coverage minimum** for all code
- **Commit every 30 minutes** during active development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run type-check` - Check TypeScript types
- `npm test` - Run tests
- `npm run test:ci` - Run tests with coverage
- `npm run test:e2e` - Run E2E tests

## 🏛️ Architecture Overview

### Frontend Architecture

- **Pages**: Route-based components for each major section
- **Components**: Reusable UI components following atomic design
- **Hooks**: Custom hooks for data fetching and business logic
- **Store**: Centralized state management with Zustand
- **Services**: Abstraction layer for API calls and business logic

### Backend Architecture

- **Database**: PostgreSQL with Row Level Security (RLS)
- **Authentication**: Supabase Auth with JWT tokens
- **Real-time**: WebSocket connections for live updates
- **Edge Functions**: Serverless functions for complex operations

### Security Features

- Row Level Security (RLS) for data access control
- Role-based permissions (Supplier/Buyer/Admin)
- Fraud detection algorithms
- Rate limiting on API endpoints
- Secure webhook verification

### Authentication Setup

The platform uses **Magic Link Authentication** (passwordless login) powered by Supabase Auth.

#### Configuration Steps:

1. **Configure Supabase Dashboard**
   - Navigate to Authentication > URL Configuration
   - Set Site URL to `http://localhost:5173` (development) or your production URL
   - Add `/auth/callback` to Redirect URLs (e.g., `http://localhost:5173/auth/callback`)

2. **Email Templates** (optional)
   - Customize magic link emails in Authentication > Email Templates
   - Modify the "Magic Link" template to match your brand

3. **Rate Limits**
   - Default: 1 magic link request per 60 seconds per email
   - Adjust in Authentication > Rate Limits if needed

#### How It Works:

1. Users enter their email address on login/register pages
2. System sends a secure magic link to their email
3. Clicking the link authenticates them and redirects to the dashboard
4. New users are prompted to select their account type (Supplier/Buyer/Network)

#### Benefits:

- No passwords to remember or reset
- Enhanced security (links expire after single use)
- Reduced friction for users
- Protection against password-based attacks

## 🤝 User Roles

### Suppliers (Traffic Providers)

- Browse active campaigns
- Generate tracking numbers
- Monitor call performance
- Track earnings

### Buyers (Advertisers)

- Create and manage campaigns
- Set targeting criteria
- Monitor lead quality
- Manage campaign budgets

### Administrators

- Platform oversight
- User management
- Fraud investigation
- System configuration

## 📊 Key Features

### Call Tracking

- Real-time call status updates
- Duration tracking
- Quality scoring
- Performance metrics

### Campaign Management

- Geographic targeting
- Time-based restrictions
- Budget controls
- Performance optimization

### Analytics & Reporting

- Real-time dashboards
- Historical reports
- Export functionality
- Custom metrics

## 🐛 Troubleshooting

### Common Issues

1. **Supabase connection errors**
   - Verify environment variables
   - Check Supabase service status
   - Ensure migrations are applied

2. **Build errors**
   - Clear node_modules and reinstall
   - Check TypeScript errors with `npm run type-check`
   - Ensure all environment variables are set

## 📚 Documentation

- See `/CLAUDE.md` files in each directory for detailed patterns
- API documentation available at `/api/docs`
- Component storybook (if configured) at `npm run storybook`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Convention

Follow conventional commits:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test additions/changes
- `chore:` Build process updates

## 📄 License

This project is proprietary and confidential. All rights reserved.

## 🆘 Support

- Technical issues: tech-support@dependablecalls.com
- Business inquiries: info@dependablecalls.com
- Documentation: See `/docs` directory

---

Built with ❤️ by the DCE Team
