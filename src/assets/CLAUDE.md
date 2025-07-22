# Asset Management

# Asset Structure

```
assets/
├── images/        # Static images
├── icons/         # SVG icons
├── fonts/         # Custom fonts
├── videos/        # Video files
└── data/          # Static JSON data
```

# Image Guidelines

- Use WebP format for photos (fallback to JPG)
- Use SVG for logos and icons
- Use PNG for images requiring transparency
- Optimize all images before committing

# Image Optimization

```bash
# Use these tools before adding images:
# - imageoptim (Mac)
# - squoosh.app (Web)
# - sharp-cli (Node.js)
```

# SVG Best Practices

- Remove unnecessary metadata
- Use currentColor for dynamic colors
- Optimize with SVGO
- Inline critical SVGs

```tsx
// Using SVG as React component
import { ReactComponent as Logo } from '@/assets/icons/logo.svg'

export function Header() {
  return <Logo className="h-8 w-8 text-primary" />
}
```

# Image Imports

```tsx
// Static imports for build optimization
import heroImage from '@/assets/images/hero.webp'
import heroImageFallback from '@/assets/images/hero.jpg'

// Use in component
;<picture>
  <source srcSet={heroImage} type="image/webp" />
  <img src={heroImageFallback} alt="Hero" />
</picture>
```

# Responsive Images

```tsx
// Define srcset for different screen sizes
const imageSizes = {
  small: '/assets/images/hero-400w.webp',
  medium: '/assets/images/hero-800w.webp',
  large: '/assets/images/hero-1200w.webp',
}

;<img
  srcSet={`
    ${imageSizes.small} 400w,
    ${imageSizes.medium} 800w,
    ${imageSizes.large} 1200w
  `}
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
  src={imageSizes.medium}
  alt="Responsive image"
/>
```

# Icon System

- Use Heroicons for UI icons
- Custom icons as SVG components
- Consistent 24x24 viewBox
- Support dark mode

```tsx
// Icon wrapper component
export function Icon({ name, className = 'h-6 w-6' }: IconProps) {
  const IconComponent = iconMap[name]
  return <IconComponent className={className} />
}
```

# Font Loading

```css
/* Use font-display: swap for performance */
@font-face {
  font-family: 'CustomFont';
  src: url('/assets/fonts/custom.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
```

# Static Data Files

```tsx
// Import JSON data
import campaignTypes from '@/assets/data/campaign-types.json'
import statesList from '@/assets/data/states.json'

// Type-safe imports
interface CampaignType {
  id: string
  name: string
  category: string
}

const typedCampaignTypes: CampaignType[] = campaignTypes
```

# Asset Loading Strategies

```tsx
// Lazy load non-critical images
const LazyImage = ({ src, alt }: ImageProps) => {
  return <img loading="lazy" src={src} alt={alt} decoding="async" />
}

// Preload critical assets
;<link rel="preload" as="image" href="/assets/images/hero.webp" />
```

# File Naming Conventions

- Lowercase with hyphens: `user-avatar.svg`
- Include dimensions: `hero-1920x1080.jpg`
- Version large files: `video-v2.mp4`
- Descriptive names: `call-tracking-dashboard.png`

# Asset Size Limits

- Images: Max 500KB (optimize larger)
- Icons: Max 5KB per SVG
- Videos: Use external CDN
- Total bundle: Monitor with build tools

# CDN Integration

```tsx
// Use CDN for large assets
const CDN_URL = import.meta.env.VITE_CDN_URL

export function getAssetUrl(path: string): string {
  if (import.meta.env.PROD) {
    return `${CDN_URL}${path}`
  }
  return path
}
```

# Dark Mode Assets

```tsx
// Provide dark mode variants
const logo = {
  light: '/assets/images/logo-light.svg',
  dark: '/assets/images/logo-dark.svg',
}

export function Logo() {
  const { theme } = useTheme()
  return <img src={logo[theme]} alt="Logo" />
}
```

# Performance Monitoring

```tsx
// Track asset loading performance
export function trackAssetPerformance() {
  window.addEventListener('load', () => {
    const resources = performance.getEntriesByType('resource')
    const images = resources.filter((r) => r.name.includes('/assets/images/'))

    images.forEach((img) => {
      if (img.duration > 1000) {
        console.warn(`Slow asset: ${img.name} (${img.duration}ms)`)
      }
    })
  })
}
```

# Build Optimization

- Vite automatically optimizes assets
- Use dynamic imports for large assets
- Enable compression in production
- Monitor bundle analyzer output

# DCE-Specific Assets

- Call tracking flow diagrams
- Campaign category icons
- User role badges
- Quality score indicators
- Fraud alert icons
- Payment method logos

# Asset Security

- Sanitize SVG uploads
- Validate file types
- Limit file sizes
- Use CSP headers for assets
- No sensitive data in filenames

# Testing Assets

```tsx
// Test asset loading
describe('Asset Loading', () => {
  it('should load critical images', async () => {
    const img = screen.getByAltText('Hero')
    await waitFor(() => {
      expect(img).toHaveAttribute('src')
      expect(img.complete).toBe(true)
    })
  })
})
```

# CRITICAL RULES

- NO unoptimized images in repository
- NO assets over 1MB without approval
- ALWAYS provide alt text for images
- ALWAYS optimize SVGs before use
- ALWAYS use appropriate format
- NEVER commit sensitive data in assets
- USE lazy loading for non-critical images
- MONITOR asset performance impact
- PROVIDE dark mode variants when needed
