# Reusable Modal State Hooks

A collection of sophisticated React hooks for managing modal, expandable, and dropdown component states with built-in accessibility, animations, and state machine management.

## Overview

These hooks replace simple `useState<boolean>` patterns with comprehensive state management solutions that provide:

- **State Machine Management**: Type-safe transitions with validation
- **Accessibility Features**: Focus management, keyboard navigation, ARIA support
- **Animation Support**: Built-in timing and transition states
- **SSR Compatibility**: No direct DOM access during initialization
- **TypeScript Generics**: Type-safe content management
- **Comprehensive Documentation**: JSDoc comments and examples

## Available Hooks

### 1. `useModalState<TContent>`

Generic modal management with full state machine support.

**Features:**
- Multiple modal types (create, edit, delete, view, preview, confirmation, loading, error)
- Focus management and restoration
- Escape key handling
- Click outside detection
- Body scroll locking
- Animation timing
- Content management with TypeScript generics

**Basic Usage:**
```tsx
const modal = useModalState({
  closeOnEscape: true,
  lockBodyScroll: true,
  onOpen: () => console.log('Modal opened'),
  onClose: () => console.log('Modal closed')
})

// Open different modal types
modal.openCreate('blog-post')
modal.openEdit('123', 'blog-post', true)
modal.openConfirmation('delete', 'blog post', true)

// State checking
if (modal.isOpen) {
  // Render modal
}
```

### 2. `useExpandableState<TData>`

For managing collapsible/expandable content with tree structures.

**Features:**
- Hierarchical item management
- Lazy loading of children
- Level-based expansion limits
- Sibling collapse options
- Persistence to localStorage
- Animation support
- Async data loading

**Basic Usage:**
```tsx
const expandable = useExpandableState({
  initialItems: treeData,
  maxExpandedLevel: 3,
  persistState: true,
  storageKey: 'sidebar-tree',
  loadChildren: async (itemId) => {
    return await api.getChildren(itemId)
  }
})

// Usage in component
expandable.toggle(itemId)
expandable.isExpanded(itemId)
expandable.expandAll()
```

### 3. `useDropdownState<TValue>`

For dropdown menus and select components with full keyboard navigation.

**Features:**
- Single and multiple selection modes
- Search/filter functionality
- Keyboard navigation (arrows, enter, escape)
- Position management with auto-flip
- Focus management
- Custom item rendering
- Grouped options support

**Basic Usage:**
```tsx
const dropdown = useDropdownState(items, {
  multiple: false,
  searchable: true,
  closeOnSelect: true,
  position: { placement: 'bottom-start', autoFlip: true }
})

// Usage in component
<button ref={dropdown.triggerRef} onClick={dropdown.toggle}>
  {dropdown.getDisplayText() || 'Select...'}
</button>

{dropdown.isOpen && (
  <div ref={dropdown.dropdownRef}>
    {dropdown.filteredItems.map(item => (
      <div onClick={() => dropdown.select(item)}>
        {item.label}
      </div>
    ))}
  </div>
)}
```

## State Machine Integration

All hooks integrate with the project's state machine system from `src/store/utils/stateMachines.ts`:

```tsx
// Access state machine for advanced use cases
const modal = useModalState()

// Check transition history
console.log(modal.stateMachine.transitions)

// Rollback to previous state
modal.rollback()

// Custom state transitions
modal.stateMachine.transition(newState, 'custom_reason', { metadata: 'value' })
```

## Accessibility Features

### Focus Management
- Automatic focus on modal open
- Focus restoration on modal close
- Keyboard trap within modals
- Focus indicators for keyboard users

### Keyboard Navigation
- `Escape` key to close modals
- `Arrow keys` for dropdown navigation
- `Enter/Space` for selection
- `Tab` navigation within components

### ARIA Support
- Proper role attributes (`dialog`, `menu`, `listbox`)
- `aria-modal` for modal dialogs
- `aria-expanded` for expandable content
- `aria-selected` for dropdown items
- Screen reader announcements

## Animation Support

### Built-in Timing
```tsx
const modal = useModalState({
  animationDuration: 300 // Custom timing
})

// Animation states are managed automatically
if (modal.isAnimating) {
  // Show transition states
}
```

### CSS Integration
```css
.modal-enter {
  opacity: 0;
  transform: scale(0.95);
}

.modal-enter-active {
  opacity: 1;
  transform: scale(1);
  transition: all 200ms ease-out;
}

.modal-exit {
  opacity: 1;
  transform: scale(1);
}

.modal-exit-active {
  opacity: 0;
  transform: scale(0.95);
  transition: all 150ms ease-in;
}
```

## SSR Compatibility

All hooks are designed to work with server-side rendering:

```tsx
// Safe initialization - no DOM access
const modal = useModalState({
  // All options are safe for SSR
})

// DOM-dependent features only activate client-side
useEffect(() => {
  // Client-side only code
}, [])
```

## TypeScript Support

### Generic Content Types
```tsx
interface FormData {
  title: string
  description: string
  tags: string[]
}

const modal = useModalState<FormData>({
  content: { title: '', description: '', tags: [] }
})

// Type-safe content access
modal.content?.title // string | undefined
modal.setContent({ title: 'New Title' }) // Partial<FormData>
```

### Dropdown Item Types
```tsx
interface Product {
  id: string
  name: string
  price: number
}

const dropdown = useDropdownState<Product>(productItems, {
  onValueChange: (product) => {
    // product is typed as Product | Product[]
  }
})
```

## Performance Optimization

### Memoization
```tsx
// Memoize options to prevent re-renders
const modalOptions = useMemo(() => ({
  closeOnEscape: true,
  lockBodyScroll: true,
  onOpen: handleOpen,
  onClose: handleClose
}), [handleOpen, handleClose])

const modal = useModalState(modalOptions)
```

### Lazy Loading
```tsx
const expandable = useExpandableState({
  loadChildren: useCallback(async (itemId) => {
    // Only load when needed
    return await api.getChildren(itemId)
  }, [])
})
```

## Testing

### Unit Testing
```tsx
import { renderHook, act } from '@testing-library/react'
import { useModalState } from './useModalState'

test('modal opens and closes correctly', () => {
  const { result } = renderHook(() => useModalState())
  
  expect(result.current.isOpen).toBe(false)
  
  act(() => {
    result.current.openCreate('test')
  })
  
  expect(result.current.isOpen).toBe(true)
  expect(result.current.state.type).toBe('create')
})
```

### Integration Testing
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { BlogLazyImageExample } from './examples/blog-component-examples'

test('lightbox opens on image click', () => {
  render(<BlogLazyImageExample src="/test.jpg" alt="Test" />)
  
  fireEvent.click(screen.getByAltText('Test'))
  
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByLabelText('Lightbox: Test')).toBeInTheDocument()
})
```

## Migration from useState

### Before
```tsx
const [isOpen, setIsOpen] = useState(false)
const [isLoading, setIsLoading] = useState(false)
const [error, setError] = useState<string | null>(null)

// Manual focus management
// Manual escape key handling
// Manual animation timing
// Manual accessibility
```

### After
```tsx
const modal = useModalState({
  closeOnEscape: true,
  lockBodyScroll: true,
  autoFocus: true
})

// All features built-in:
// - Focus management ✅
// - Escape key handling ✅
// - Animation timing ✅
// - Accessibility ✅
// - State machine validation ✅
```

## Examples

See `src/hooks/examples/blog-component-examples.tsx` for complete implementations of:

1. **BlogLazyImage** - Lightbox modal with image preview
2. **BlogShare** - Share panel with social media options
3. **BlogTags** - Tag creation modal with form handling
4. **BlogComments** - Reply form modal with nested comments
5. **BlogNewsletter** - Success modal with auto-close timing

## Best Practices

### 1. Content Management
```tsx
// Use typed content for complex data
interface ModalContent {
  formData: FormData
  validationErrors: Record<string, string>
  isDirty: boolean
}

const modal = useModalState<ModalContent>()

// Update content incrementally
const updateContent = (updates: Partial<ModalContent>) => {
  modal.setContent(current => ({ ...current, ...updates }))
}
```

### 2. State-Based Rendering
```tsx
// Use state type for conditional rendering
const renderContent = () => {
  switch (modal.state.type) {
    case 'create': return <CreateForm />
    case 'edit': return <EditForm id={modal.state.id} />
    case 'loading': return <LoadingSpinner />
    case 'error': return <ErrorMessage />
    default: return null
  }
}
```

### 3. Error Handling
```tsx
const handleAsyncAction = async () => {
  modal.showLoading('Processing...')
  
  try {
    await performAction()
    modal.close()
  } catch (error) {
    modal.showError(error.message, true) // retryable
  }
}
```

### 4. Form Integration
```tsx
const modal = useModalState({
  closeOnEscape: false, // Don't close while typing
  onClose: (state) => {
    // Warn about unsaved changes
    if (state.type === 'edit' && state.isDirty) {
      return !confirm('Discard changes?')
    }
  }
})
```

## Contributing

When extending these hooks:

1. Maintain TypeScript strict mode compatibility
2. Add comprehensive JSDoc documentation
3. Include accessibility features
4. Test with screen readers
5. Ensure SSR compatibility
6. Add examples for new features
7. Update migration guide

## Browser Support

- **Modern browsers**: Full support with all features
- **IE11**: Basic functionality (no modern JS features)
- **Mobile**: Touch-friendly with proper viewport handling
- **Screen readers**: Full ARIA support for JAWS, NVDA, VoiceOver