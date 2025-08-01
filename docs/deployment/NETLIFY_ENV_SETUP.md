# Netlify Environment Variables Setup

This guide explains how to configure the required environment variables for the Dependable Calls blog on Netlify.

## Required Environment Variables

The following environment variables must be set in your Netlify dashboard:

### Supabase Configuration
- `VITE_SUPABASE_URL` - Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for server-side operations)

### Stripe Configuration
- `VITE_STRIPE_PUBLISHABLE_KEY` - Your Stripe publishable key (starts with `pk_`)
- `STRIPE_SECRET_KEY` - Your Stripe secret key (starts with `sk_`)
- `STRIPE_WEBHOOK_ENDPOINT_SECRET` - Your Stripe webhook endpoint secret (starts with `whsec_`)

### Sentry Configuration (Optional)
- `VITE_SENTRY_DSN` - Your Sentry DSN for error tracking

## How to Set Environment Variables on Netlify

1. **Navigate to your site settings**:
   - Go to https://app.netlify.com
   - Select your site
   - Click on "Site configuration" in the sidebar

2. **Access environment variables**:
   - Click on "Environment variables" under the "Site configuration" section

3. **Add variables**:
   - Click "Add a variable"
   - Choose "Add a single variable"
   - Enter the key and value
   - Select which contexts to apply it to (Production, Preview, etc.)
   - Click "Create variable"

4. **For sensitive variables** (like API keys):
   - Consider using "Secret" visibility to hide the value in logs
   - Apply only to Production context if not needed in previews

## Getting Your API Keys

### Supabase
1. Log in to your Supabase dashboard
2. Select your project
3. Go to Settings → API
4. Copy the Project URL and anon public key
5. For service role key, it's under the same page (keep this secret!)

### Stripe
1. Log in to your Stripe dashboard
2. Toggle between Test/Live mode as needed
3. Go to Developers → API keys
4. Copy your publishable and secret keys
5. For webhook secret:
   - Go to Developers → Webhooks
   - Create an endpoint for `https://yourdomain.netlify.app/.netlify/functions/stripe-webhook`
   - Copy the signing secret

### Sentry (Optional)
1. Log in to Sentry
2. Go to Settings → Projects → Your Project → Client Keys (DSN)
3. Copy the DSN value

## Testing Your Configuration

After setting up the environment variables:

1. Trigger a new deploy on Netlify
2. Check the deploy logs for any environment variable errors
3. Visit your site and check the browser console
4. The "Missing Supabase environment variables" error should be resolved

## Security Notes

- Never commit these values to your repository
- Use Netlify's secret variables for sensitive keys
- Rotate keys regularly
- Use different keys for development and production

## Troubleshooting

If you still see errors after setting variables:
1. Ensure variable names match exactly (case-sensitive)
2. Check that you've triggered a new deploy after adding variables
3. Verify the values don't have extra spaces or quotes
4. For Vite variables, ensure they start with `VITE_` to be exposed to the client