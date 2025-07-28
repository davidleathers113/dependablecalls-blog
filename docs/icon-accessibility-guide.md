# Icon Accessibility Guide

This guide provides best practices for implementing accessible icons throughout the DCE website application.

## Overview

Icons are visual elements that need proper accessibility attributes to ensure they are usable by everyone, including users with screen readers and other assistive technologies.

## AccessibleIcon Component

We've created a reusable `AccessibleIcon` component that wraps Heroicons with built-in accessibility features.

### Basic Usage

```tsx
import AccessibleIcon from '@/components/common/AccessibleIcon'
import { BellIcon } from '@heroicons/react/24/outline'

// Meaningful icon with label
<AccessibleIcon 
  icon={BellIcon} 
  aria-label="Notifications" 
  className="h-6 w-6" 
/>

// Decorative icon (hidden from screen readers)
<AccessibleIcon 
  icon={StarIcon} 
  decorative 
  className="h-5 w-5 text-yellow-400" 
/>

// Icon with title for hover tooltip
<AccessibleIcon 
  icon={UserIcon} 
  aria-label="User profile" 
  title="View your profile settings" 
  className="h-6 w-6" 
/>
```

## When to Use Each Pattern

### 1. Decorative Icons

Use `decorative` prop when the icon is purely visual and doesn't add meaning:

```tsx
// Icon next to text that already describes it
<button>
  <AccessibleIcon icon={SaveIcon} decorative className="h-4 w-4 mr-2" />
  Save Document
</button>

// Visual separator or design element
<AccessibleIcon icon={ChevronRightIcon} decorative className="h-4 w-4 text-gray-400" />
```

### 2. Meaningful Icons

Provide `aria-label` when the icon conveys information:

```tsx
// Icon-only button
<button aria-label="Delete item">
  <AccessibleIcon icon={TrashIcon} decorative className="h-5 w-5" />
</button>

// Status indicator
<AccessibleIcon 
  icon={CheckCircleIcon} 
  aria-label="Task completed" 
  className="h-5 w-5 text-green-500" 
/>
```

### 3. Interactive Icons

For clickable icons, ensure the button/link provides the label:

```tsx
// IconButton component
<IconButton 
  icon={RefreshIcon} 
  aria-label="Refresh data" 
  onClick={handleRefresh}
  className="p-2 hover:bg-gray-100 rounded" 
/>
```

## SVG Accessibility

For custom SVGs, include proper attributes:

```tsx
<svg 
  viewBox="0 0 24 24" 
  aria-label="Facebook" 
  role="img"
  className="h-6 w-6"
>
  <title>Facebook</title>
  <path d="..." />
</svg>
```

## Migration Guide

### Before (Inaccessible)
```tsx
import { BellIcon } from '@heroicons/react/24/outline'

<BellIcon className="h-6 w-6" />
```

### After (Accessible)
```tsx
import { BellIcon } from '@heroicons/react/24/outline'
import AccessibleIcon from '@/components/common/AccessibleIcon'

// For meaningful icons
<AccessibleIcon icon={BellIcon} aria-label="Notifications" className="h-6 w-6" />

// For decorative icons
<AccessibleIcon icon={BellIcon} decorative className="h-6 w-6" />
```

## Testing Accessibility

1. **Screen Reader Testing**: Navigate with screen reader enabled to ensure icons are properly announced or skipped
2. **Keyboard Navigation**: Ensure interactive icons are keyboard accessible
3. **Visual Testing**: Verify icons have sufficient color contrast (4.5:1 for normal text, 3:1 for large text)

## Common Patterns

### Navigation Icons
```tsx
{navigation.map((item) => (
  <Link to={item.href} aria-label={item.name}>
    <AccessibleIcon icon={item.icon} decorative className="h-6 w-6" />
    <span>{item.name}</span>
  </Link>
))}
```

### Status Indicators
```tsx
const statusIcons = {
  success: { icon: CheckCircleIcon, label: 'Success', color: 'text-green-500' },
  error: { icon: XCircleIcon, label: 'Error', color: 'text-red-500' },
  warning: { icon: ExclamationTriangleIcon, label: 'Warning', color: 'text-yellow-500' }
}

<AccessibleIcon 
  icon={statusIcons[status].icon} 
  aria-label={statusIcons[status].label}
  className={`h-5 w-5 ${statusIcons[status].color}`} 
/>
```

### Loading States
```tsx
<AccessibleIcon 
  icon={ArrowPathIcon} 
  aria-label="Loading" 
  className="h-5 w-5 animate-spin" 
/>
```

## Checklist

- [ ] All meaningful icons have `aria-label` or `title`
- [ ] Decorative icons use `decorative` prop
- [ ] Icon-only buttons have accessible labels
- [ ] Custom SVGs include `<title>` elements
- [ ] Interactive icons are keyboard accessible
- [ ] Icons meet color contrast requirements
- [ ] Screen reader testing completed

## Resources

- [WAI-ARIA Authoring Practices - Images](https://www.w3.org/WAI/ARIA/apg/patterns/img/)
- [MDN - ARIA: img role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/img_role)
- [WebAIM - Alternative Text](https://webaim.org/techniques/alttext/)