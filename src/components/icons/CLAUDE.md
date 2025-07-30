# Icons Components Directory

This directory contains SVG icon components and icon-related utilities for the DCE platform.

## Directory Purpose
- Houses reusable icon components
- Provides consistent icon sizing
- Manages icon color theming
- Optimizes SVG performance

## Icon Sources
- **Heroicons** - Primary icon library
- **Custom Icons** - Platform-specific icons
- **Brand Icons** - Third-party service logos

## Icon Component Pattern
```tsx
interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export function PhoneIcon({ size = 'md', color = 'currentColor', ...props }: IconProps) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };
  
  return (
    <svg
      className={sizes[size]}
      fill="none"
      stroke={color}
      viewBox="0 0 24 24"
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="..." />
    </svg>
  );
}
```

## Icon Categories
- **Navigation** - Menu, arrow, close icons
- **Actions** - Edit, delete, add, save
- **Status** - Success, error, warning, info
- **Communication** - Phone, email, chat
- **Data** - Charts, reports, analytics
- **User** - Profile, settings, logout

## Usage Guidelines
- Use semantic names
- Include aria-labels
- Consistent sizing system
- Support dark mode
- Optimize SVG paths

## Accessibility
- Decorative icons: `aria-hidden="true"`
- Functional icons: proper labels
- Keyboard focus indicators
- High contrast support

## Performance
- Inline SVGs for flexibility
- Tree-shakeable exports
- Minimal SVG markup
- CSS-based animations

## CRITICAL RULES
- USE Heroicons when available
- OPTIMIZE SVG file size
- MAINTAIN consistent style
- INCLUDE accessibility attrs
- TEST icon visibility