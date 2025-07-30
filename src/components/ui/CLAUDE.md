# UI Components Directory

This directory contains generic, reusable UI components that form the design system foundation for the DCE platform.

## Directory Purpose
- Houses atomic UI components
- Provides consistent design patterns
- Enables rapid UI development
- Maintains visual consistency

## Core Components
- **Button.tsx** - All button variants
- **Card.tsx** - Content containers
- **Modal.tsx** - Dialog windows
- **Dropdown.tsx** - Select menus
- **Table.tsx** - Data tables
- **Badge.tsx** - Status indicators
- **Alert.tsx** - Message displays
- **Spinner.tsx** - Loading indicators
- **Tooltip.tsx** - Hover information
- **Tabs.tsx** - Tab navigation
- **Progress.tsx** - Progress bars
- **Avatar.tsx** - User avatars

## Button Component
```tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'button',
          `button-${variant}`,
          `button-${size}`,
          loading && 'button-loading'
        )}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading && <Spinner className="button-spinner" />}
        {children}
      </button>
    );
  }
);
```

## Table Component
```tsx
interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  onSort?: (column: keyof T) => void;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: string;
}

export function Table<T>({ data, columns, loading, ...props }: TableProps<T>) {
  if (loading) return <TableSkeleton />;
  if (!data.length) return <EmptyState message={props.emptyMessage} />;
  
  return (
    <table className="table">
      <TableHeader columns={columns} onSort={props.onSort} />
      <TableBody data={data} columns={columns} onRowClick={props.onRowClick} />
    </table>
  );
}
```

## Modal System
```tsx
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  return (
    <Dialog open={isOpen} onClose={onClose}>
      <div className={`modal modal-${size}`}>
        {title && (
          <Dialog.Title className="modal-title">{title}</Dialog.Title>
        )}
        <div className="modal-content">{children}</div>
      </div>
    </Dialog>
  );
}
```

## Design Tokens
```css
/* Defined in CSS variables */
:root {
  /* Colors */
  --ui-primary: #2563eb;
  --ui-secondary: #7c3aed;
  --ui-success: #10b981;
  --ui-warning: #f59e0b;
  --ui-danger: #ef4444;
  
  /* Spacing */
  --ui-space-xs: 0.25rem;
  --ui-space-sm: 0.5rem;
  --ui-space-md: 1rem;
  --ui-space-lg: 1.5rem;
  --ui-space-xl: 2rem;
  
  /* Shadows */
  --ui-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --ui-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --ui-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
}
```

## Component Variants
### Alert Types
```tsx
type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export function Alert({ variant, title, children }: AlertProps) {
  const icons = {
    info: <InfoIcon />,
    success: <CheckIcon />,
    warning: <ExclamationIcon />,
    error: <XIcon />
  };
  
  return (
    <div className={`alert alert-${variant}`}>
      {icons[variant]}
      <div>
        {title && <h4>{title}</h4>}
        {children}
      </div>
    </div>
  );
}
```

## Loading States
```tsx
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse bg-gray-200 rounded', className)}
      {...props}
    />
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
```

## Accessibility Features
- Keyboard navigation support
- ARIA attributes
- Focus management
- Screen reader compatibility
- High contrast mode

## Animation Patterns
```css
.button {
  transition: all 0.2s ease;
}

.modal {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateY(-10px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

## Responsive Design
- Mobile-first approach
- Breakpoint utilities
- Flexible layouts
- Touch-friendly targets
- Adaptive components

## Component Composition
```tsx
// Compound components
<Card>
  <Card.Header>
    <Card.Title>Campaign Performance</Card.Title>
  </Card.Header>
  <Card.Body>
    {/* Content */}
  </Card.Body>
  <Card.Footer>
    <Button>View Details</Button>
  </Card.Footer>
</Card>
```

## Theme Support
- Light/dark mode
- Custom color schemes
- Dynamic theming
- CSS variable overrides
- Accessibility themes

## CRITICAL RULES
- MAINTAIN design consistency
- FOLLOW accessibility guidelines
- USE semantic HTML
- OPTIMIZE for performance
- TEST across browsers
- DOCUMENT component APIs