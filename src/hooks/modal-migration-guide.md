# Modal State Hooks Migration Guide

This guide shows how to migrate from simple `useState<boolean>` patterns to the new reusable modal state hooks for better state management, accessibility, and animation support.

## Overview

The new hooks provide:
- **State Machine Management**: Type-safe state transitions with validation
- **Accessibility Features**: Focus management, escape key handling, scroll lock
- **Animation Support**: Built-in timing for smooth transitions
- **Better Developer Experience**: Simplified API with comprehensive functionality

## Available Hooks

1. **`useModalState`** - Generic modal management with state machine
2. **`useExpandableState`** - For collapsible/expandable content 
3. **`useDropdownState`** - For dropdown menus and select components

## Migration Examples

### 1. BlogLazyImage - Lightbox Modal

**Before:**
```tsx
const [showLightbox, setShowLightbox] = useState(false)

const handleLightboxToggle = useCallback(() => {
  if (!lightbox.enabled) return
  
  setShowLightbox(prev => {
    const newState = !prev
    if (newState && lightbox.onOpen) {
      lightbox.onOpen()
    } else if (!newState && lightbox.onClose) {
      lightbox.onClose()
    }
    return newState
  })
}, [lightbox])

// Manual cleanup and focus management
useEffect(() => {
  if (showLightbox) {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }
}, [showLightbox])
```

**After:**
```tsx
import { useModalState } from '../hooks/useModalState'

const lightboxModal = useModalState({
  closeOnEscape: true,
  closeOnClickOutside: true,
  lockBodyScroll: true,
  onOpen: lightbox.onOpen,
  onClose: lightbox.onClose
})

const handleLightboxToggle = useCallback(() => {
  if (!lightbox.enabled) return
  
  if (lightboxModal.isOpen) {
    lightboxModal.close()
  } else {
    lightboxModal.openPreview(src, 'image')
  }
}, [lightbox.enabled, lightboxModal, src])

// Lightbox component
const Lightbox = () => lightboxModal.isOpen && (
  <div 
    className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
    onClick={lightboxModal.close}
    role="dialog"
    aria-modal="true"
    aria-label="Image lightbox"
  >
    <img
      src={imageSrc}
      alt={alt}
      className="max-w-full max-h-full object-contain"
      onClick={(e) => e.stopPropagation()}
    />
  </div>
)
```

### 2. BlogShare - Share Panel Modal

**Before:**
```tsx
const [isSharePanelOpen, setIsSharePanelOpen] = useState(false)

const toggleSharePanel = () => setIsSharePanelOpen(prev => !prev)

// Manual outside click handling
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (shareRef.current && !shareRef.current.contains(event.target as Node)) {
      setIsSharePanelOpen(false)
    }
  }

  if (isSharePanelOpen) {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }
}, [isSharePanelOpen])
```

**After:**
```tsx
import { useModalState } from '../hooks/useModalState'

const shareModal = useModalState({
  closeOnEscape: true,
  closeOnClickOutside: true,
  lockBodyScroll: false, // Don't lock scroll for small panels
  animationDuration: 150
})

const toggleSharePanel = () => shareModal.toggle()

// Usage in component
{shareModal.isOpen && (
  <div ref={shareModal.dropdownRef} className="share-panel">
    {/* Share options */}
  </div>
)}
```

### 3. BlogTags - Tag Creation Modal

**Before:**
```tsx
const [isCreateTagModalOpen, setIsCreateTagModalOpen] = useState(false)
const [isLoading, setIsLoading] = useState(false)
const [error, setError] = useState<string | null>(null)

const openCreateTagModal = () => {
  setIsCreateTagModalOpen(true)
  setError(null)
}

const closeCreateTagModal = () => {
  setIsCreateTagModalOpen(false)
  setError(null)
}

const handleCreateTag = async (tagData: CreateTagData) => {
  setIsLoading(true)
  setError(null)
  
  try {
    await createTag(tagData)
    closeCreateTagModal()
  } catch (err) {
    setError(err.message)
  } finally {
    setIsLoading(false)
  }
}
```

**After:**
```tsx
import { useModalState } from '../hooks/useModalState'

const tagModal = useModalState<CreateTagData>({
  closeOnEscape: true,
  autoFocus: true,
  onClose: () => {
    // Clear form data when modal closes
    tagModal.setContent(undefined)
  }
})

const openCreateTagModal = () => {
  tagModal.openCreate('tag')
}

const handleCreateTag = async (tagData: CreateTagData) => {
  tagModal.showLoading('Creating tag...')
  
  try {
    await createTag(tagData)
    tagModal.close()
  } catch (err) {
    tagModal.showError(err.message, true) // retryable
  }
}

// State is automatically managed
const isLoading = tagModal.isLoading
const hasError = tagModal.hasError
const isOpen = tagModal.isOpen
```

### 4. BlogComments - Reply Form Modal

**Before:**
```tsx
const [activeReplyId, setActiveReplyId] = useState<string | null>(null)
const [replyContent, setReplyContent] = useState('')

const openReplyForm = (commentId: string) => {
  setActiveReplyId(commentId)
  setReplyContent('')
}

const closeReplyForm = () => {
  setActiveReplyId(null)
  setReplyContent('')
}
```

**After:**
```tsx
import { useModalState } from '../hooks/useModalState'

interface ReplyFormContent {
  commentId: string
  content: string
}

const replyModal = useModalState<ReplyFormContent>({
  closeOnEscape: true,
  closeOnClickOutside: false, // Don't close while typing
})

const openReplyForm = (commentId: string) => {
  replyModal.openCreate('reply', commentId)
  replyModal.setContent({ commentId, content: '' })
}

const updateReplyContent = (content: string) => {
  const current = replyModal.content
  if (current) {
    replyModal.setContent({ ...current, content })
  }
}

// Check if replying to specific comment
const isReplyingTo = (commentId: string) => {
  return replyModal.isOpen && 
         replyModal.state.type === 'create' && 
         replyModal.state.parentId === commentId
}
```

### 5. BlogNewsletter - Success Modal

**Before:**
```tsx
const [showSuccessModal, setShowSuccessModal] = useState(false)
const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null)

const showSuccess = (data: SubscriptionData) => {
  setSubscriptionData(data)
  setShowSuccessModal(true)
  
  // Auto-close after 3 seconds
  setTimeout(() => {
    setShowSuccessModal(false)
    setSubscriptionData(null)
  }, 3000)
}
```

**After:**
```tsx
import { useModalState } from '../hooks/useModalState'

interface SuccessContent {
  email: string
  preferences: string[]
  timestamp: Date
}

const successModal = useModalState<SuccessContent>({
  closeOnEscape: true,
  lockBodyScroll: false,
  animationDuration: 300
})

const showSuccess = (data: SubscriptionData) => {
  successModal.setContent({
    email: data.email,
    preferences: data.preferences,
    timestamp: new Date()
  })
  successModal.openConfirmation('subscribe', 'newsletter', false)
  
  // Auto-close after 3 seconds
  setTimeout(() => {
    successModal.close()
  }, 3000)
}
```

## Advanced Usage Patterns

### 1. Complex Modal Workflows

```tsx
const workflowModal = useModalState<WorkflowData>({
  onStateChange: (newState, prevState) => {
    // Track modal state transitions
    analytics.track('modal_transition', {
      from: prevState?.type,
      to: newState.type,
      entityType: newState.entityType
    })
  }
})

// Multi-step workflow
const startWorkflow = () => {
  workflowModal.openCreate('workflow')
  // Step 1: Create
}

const moveToEdit = (id: string) => {
  workflowModal.openEdit(id, 'workflow', true) // isDirty = true
  // Step 2: Edit with unsaved changes protection
}

const confirmDeletion = (id: string) => {
  workflowModal.openConfirmation('delete', 'workflow item', true) // destructive
  // Step 3: Confirmation with warning
}
```

### 2. State Machine Integration

```tsx
const advancedModal = useModalState({
  onStateChange: (newState, prevState) => {
    // Access full state machine for debugging
    console.log('Transition History:', advancedModal.stateMachine.transitions)
    
    // Rollback on certain conditions
    if (newState.type === 'error' && canRecover) {
      setTimeout(() => {
        advancedModal.rollback() // Return to previous state
      }, 1000)
    }
  }
})
```

### 3. Performance Optimization

```tsx
// Memoize modal options to prevent unnecessary re-renders
const modalOptions = useMemo(() => ({
  closeOnEscape: true,
  lockBodyScroll: true,
  onOpen: () => trackModalOpen('lightbox'),
  onClose: () => trackModalClose('lightbox')
}), [])

const optimizedModal = useModalState(modalOptions)
```

## Migration Checklist

When migrating existing modal implementations:

### ✅ State Management
- [ ] Replace `useState<boolean>` with appropriate hook
- [ ] Update state checking from `isOpen` to `modal.isOpen`
- [ ] Replace manual toggle functions with `modal.toggle()`
- [ ] Remove manual loading/error state management

### ✅ Accessibility
- [ ] Remove manual focus management code
- [ ] Remove manual escape key handlers
- [ ] Remove manual scroll lock implementation
- [ ] Add proper ARIA attributes to modal elements

### ✅ Animation
- [ ] Remove manual animation timing code
- [ ] Configure `animationDuration` in hook options
- [ ] Remove manual CSS transition classes

### ✅ Event Handling
- [ ] Remove manual click outside detection
- [ ] Replace with `closeOnClickOutside` option
- [ ] Remove manual keyboard event handlers

### ✅ Testing
- [ ] Update tests to use hook return values
- [ ] Test accessibility features
- [ ] Test keyboard navigation
- [ ] Test state machine transitions

## Common Patterns and Best Practices

### 1. Modal Content Management

```tsx
// Store complex modal content in hook state
interface FormModalContent {
  formData: FormData
  validationErrors: Record<string, string>
  isDirty: boolean
}

const formModal = useModalState<FormModalContent>()

// Update content incrementally
const updateFormData = (updates: Partial<FormData>) => {
  const current = formModal.content
  formModal.setContent({
    ...current,
    formData: { ...current?.formData, ...updates },
    isDirty: true
  })
}
```

### 2. Conditional Rendering

```tsx
// Use state type for conditional rendering
const renderModalContent = () => {
  switch (modal.state.type) {
    case 'create':
      return <CreateForm onSubmit={handleCreate} />
    case 'edit':
      return <EditForm id={modal.state.id} onSubmit={handleUpdate} />
    case 'delete':
      return <DeleteConfirmation id={modal.state.id} onConfirm={handleDelete} />
    case 'loading':
      return <LoadingSpinner message={modal.state.operation} />
    case 'error':
      return <ErrorMessage message={modal.state.message} onRetry={modal.state.retryable ? handleRetry : undefined} />
    default:
      return null
  }
}
```

### 3. Integration with Forms

```tsx
const formModal = useModalState({
  closeOnEscape: false, // Don't close while user is typing
  onClose: (state) => {
    // Warn about unsaved changes
    if (state.type === 'edit' && state.isDirty) {
      return !confirm('You have unsaved changes. Are you sure you want to close?')
    }
  }
})

// Update modal state when form becomes dirty
const handleFormChange = (isDirty: boolean) => {
  if (formModal.state.type === 'edit') {
    formModal.updateState({ isDirty })
  }
}
```

This migration provides significant improvements in code maintainability, accessibility, and user experience while reducing boilerplate code.