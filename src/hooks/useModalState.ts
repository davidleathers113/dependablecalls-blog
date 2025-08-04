/**
 * Generic modal state hook for blog components
 * Provides state management, accessibility, and animation support
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export interface ModalStateOptions<TContent = unknown> {
  /** Whether to close modal on escape key */
  closeOnEscape?: boolean
  /** Whether to close modal when clicking outside */
  closeOnClickOutside?: boolean
  /** Whether to lock body scroll when modal is open */
  lockBodyScroll?: boolean
  /** Whether to focus the modal when opened */
  autoFocus?: boolean
  /** Custom content for the modal */
  content?: TContent
  /** Animation duration in milliseconds */
  animationDuration?: number
  /** Callback when modal opens */
  onOpen?: () => void
  /** Callback when modal closes */
  onClose?: () => void
}

export interface ModalStateResult<TContent = unknown, TElement extends HTMLElement = HTMLElement> {
  /** Whether modal is currently open */
  isOpen: boolean
  /** Whether modal is in a loading state */
  isLoading: boolean
  /** Whether modal has an error */
  hasError: boolean
  /** Current modal content */
  content: TContent | undefined
  /** Error message if any */
  errorMessage: string | null
  /** Ref for modal DOM element */
  modalRef: React.RefObject<TElement | null>
  
  // Actions
  /** Open the modal */
  open: () => void
  /** Close the modal */
  close: () => void
  /** Toggle the modal */
  toggle: () => void
  /** Show loading state */
  showLoading: () => void
  /** Show error state */
  showError: (message: string) => void
  /** Clear error state */
  clearError: () => void
  /** Update modal content */
  setContent: (content: TContent) => void
}

/**
 * Generic modal state hook with accessibility and animation support
 * 
 * @example
 * ```tsx
 * const modal = useModalState({
 *   closeOnEscape: true,
 *   lockBodyScroll: true,
 *   content: { title: '', description: '' }
 * })
 * 
 * // Usage
 * <button onClick={modal.open}>Open Modal</button>
 * {modal.isOpen && (
 *   <div ref={modal.modalRef} className="modal">
 *     {modal.isLoading ? (
 *       <div>Loading...</div>
 *     ) : modal.hasError ? (
 *       <div>Error: {modal.errorMessage}</div>
 *     ) : (
 *       <div>Modal Content</div>
 *     )}
 *   </div>
 * )}
 * ```
 */
export function useModalState<TContent = unknown, TElement extends HTMLElement = HTMLElement>(
  options: ModalStateOptions<TContent> = {}
): ModalStateResult<TContent, TElement> {
  const {
    closeOnEscape = true,
    closeOnClickOutside = true,
    lockBodyScroll = true,
    autoFocus = true,
    content: initialContent,
    animationDuration = 200,
    onOpen,
    onClose
  } = options

  // State management
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [content, setContent] = useState<TContent | undefined>(initialContent)
  
  // Refs for DOM manipulation
  const modalRef = useRef<TElement>(null)
  const previousFocusRef = useRef<Element | null>(null)

  // Actions
  const open = useCallback(() => {
    setIsOpen(true)
    setIsLoading(false)
    setHasError(false)
    setErrorMessage(null)
    if (onOpen) onOpen()
  }, [onOpen])

  const close = useCallback(() => {
    setIsOpen(false)
    setIsLoading(false)
    setHasError(false)
    setErrorMessage(null)
    if (onClose) onClose()
  }, [onClose])

  const toggle = useCallback(() => {
    if (isOpen) {
      close()
    } else {
      open()
    }
  }, [isOpen, close, open])

  const showLoading = useCallback(() => {
    setIsLoading(true)
    setHasError(false)
    setErrorMessage(null)
  }, [])

  const showError = useCallback((message: string) => {
    setIsLoading(false)
    setHasError(true)
    setErrorMessage(message)
  }, [])

  const clearError = useCallback(() => {
    setHasError(false)
    setErrorMessage(null)
  }, [])

  // Handle escape key
  useEffect(() => {
    if (!closeOnEscape || !isOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [closeOnEscape, isOpen, close])

  // Handle click outside
  useEffect(() => {
    if (!closeOnClickOutside || !isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        close()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [closeOnClickOutside, isOpen, close])

  // Handle body scroll lock
  useEffect(() => {
    if (!lockBodyScroll || !isOpen) return

    const originalStyle = window.getComputedStyle(document.body).overflow
    document.body.style.overflow = 'hidden'
    
    return () => {
      document.body.style.overflow = originalStyle
    }
  }, [lockBodyScroll, isOpen])

  // Handle focus management
  useEffect(() => {
    if (!autoFocus) return

    if (isOpen) {
      // Store current focus
      previousFocusRef.current = document.activeElement
      
      // Focus modal after animation
      const focusTimeout = setTimeout(() => {
        if (modalRef.current) {
          const focusableElement = modalRef.current.querySelector(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          ) as HTMLElement
          
          if (focusableElement) {
            focusableElement.focus()
          } else {
            modalRef.current.focus()
          }
        }
      }, animationDuration)

      return () => {
        clearTimeout(focusTimeout)
        
        // Restore focus when modal closes
        if (previousFocusRef.current && 'focus' in previousFocusRef.current) {
          (previousFocusRef.current as HTMLElement).focus()
        }
      }
    }
  }, [autoFocus, isOpen, animationDuration])

  return {
    isOpen,
    isLoading,
    hasError,
    content,
    errorMessage,
    modalRef,
    open,
    close,
    toggle,
    showLoading,
    showError,
    clearError,
    setContent
  }
}

export default useModalState