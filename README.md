# DependableCalls Website

This is the implementation of the DependableCalls pay-per-call network platform based on the specifications in the parent directory.

## Tech Stack

- **Frontend**: Vite + React + TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Payments**: Stripe
- **Hosting**: Netlify with Edge Functions

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Stripe account

### Environment Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your environment variables:
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key
   - `VITE_STRIPE_PUBLISHABLE_KEY` - Your Stripe publishable key

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

### Database Setup

1. Create a new Supabase project
2. Run the database migrations from `supabase/migrations/`
3. Set up Row Level Security policies

## Project Structure

```
src/
├── components/     # Reusable UI components
├── hooks/         # Custom React hooks
├── lib/           # External library configurations
├── pages/         # Page components
├── services/      # API and business logic
├── store/         # Zustand state management
├── types/         # TypeScript type definitions
└── utils/         # Utility functions
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Features

- 🔐 Authentication with Supabase Auth
- 📊 Real-time call tracking dashboard
- 💳 Stripe payment integration
- 📱 Mobile-responsive design
- 🚀 Optimized performance
- 🛡️ Fraud prevention system
- 📈 Analytics and reporting

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

Private and confidential