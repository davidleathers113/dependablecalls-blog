# Common Shared Components

# UI Components
- `Button.tsx` - Consistent button styles
- `Input.tsx` - Form input fields
- `Modal.tsx` - Modal dialogs
- `LoadingSpinner.tsx` - Loading indicators
- `ErrorBoundary.tsx` - Error handling

# Layout Components
- `Card.tsx` - Content containers
- `Table.tsx` - Data tables
- `Pagination.tsx` - Page navigation
- `Breadcrumbs.tsx` - Navigation trail
- `Sidebar.tsx` - Navigation sidebar

# Form Components
```tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export function Input({ label, error, helperText, required, className, ...props }: InputProps) {
  return (
    <div className="input-group">
      {label && (
        <label className="input-label">
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}
      <input
        className={`input ${error ? 'input-error' : ''} ${className || ''}`}
        aria-invalid={!!error}
        {...props}
      />
      {error && <div className="input-error-text">{error}</div>}
      {helperText && <div className="input-helper-text">{helperText}</div>}
    </div>
  );
}
```

# Data Display Components
```tsx
interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  onSort?: (key: keyof T, direction: 'asc' | 'desc') => void;
  onRowClick?: (item: T) => void;
}

export function Table<T>({ data, columns, loading, onSort, onRowClick }: TableProps<T>) {
  if (loading) return <LoadingSpinner />;
  
  return (
    <table className="data-table">
      <thead>
        <tr>
          {columns.map(column => (
            <th key={String(column.key)} onClick={() => onSort?.(column.key, 'asc')}>
              {column.title}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((item, index) => (
          <tr key={index} onClick={() => onRowClick?.(item)}>
            {columns.map(column => (
              <td key={String(column.key)}>
                {column.render ? column.render(item) : String(item[column.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

# Modal Components
- Confirmation dialogs
- Form modals
- Image/media viewers
- Help and tutorial overlays

# Notification System
```tsx
interface ToastProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onDismiss: () => void;
  autoClose?: boolean;
}

export function Toast({ type, message, onDismiss, autoClose = true }: ToastProps) {
  useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(onDismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [autoClose, onDismiss]);
  
  return (
    <div className={`toast toast-${type}`}>
      <span>{message}</span>
      <button onClick={onDismiss} className="toast-close">×</button>
    </div>
  );
}
```

# Loading States
- Skeleton loaders
- Progress indicators
- Shimmer effects
- Empty state placeholders

# Error Handling
```tsx
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  constructor(props: PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error boundary caught error:', error, errorInfo);
    // Send to error reporting service
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>Oops! Something went wrong</h2>
          <p>We've been notified of this error. Please try refreshing the page.</p>
          <Button onClick={() => window.location.reload()}>Refresh Page</Button>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

# Accessibility Features
- ARIA labels and roles
- Keyboard navigation
- Screen reader support
- Focus management
- Color contrast compliance

# Design System Integration
- Consistent spacing tokens
- Typography scale
- Color palette
- Icon library usage
- Animation standards

# Performance Optimization
- Memoized components
- Lazy loading
- Virtual scrolling for large lists
- Image optimization

# CRITICAL RULES
- NO regex in component logic
- NO any types in props interfaces
- ALWAYS implement accessibility
- ALWAYS handle loading/error states
- USE consistent design tokens
- TEST all interactive elements
- OPTIMIZE for performance
- MAINTAIN design system consistency