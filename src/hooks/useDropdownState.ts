// Dropdown state hook for menu and select components
import { useCallback, useEffect, useRef, useState } from 'react'

export interface DropdownPosition {
  /** Position relative to trigger element */
  placement: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end' | 'left-start' | 'left-end' | 'right-start' | 'right-end'
  /** Whether to flip position if there's not enough space */
  autoFlip?: boolean
  /** Offset from trigger element in pixels */
  offset?: number
  /** Whether to match trigger width */
  matchTriggerWidth?: boolean
}

export interface DropdownStateOptions<TValue = unknown> {
  /** Initial open state */
  initialOpen?: boolean
  /** Initial selected value */
  initialValue?: TValue
  /** Whether to close on selection */
  closeOnSelect?: boolean
  /** Whether to close on escape key */
  closeOnEscape?: boolean
  /** Whether to close when clicking outside */
  closeOnClickOutside?: boolean
  /** Whether dropdown is disabled */
  disabled?: boolean
  /** Multiple selection mode */
  multiple?: boolean
  /** Search/filter functionality */
  searchable?: boolean
  /** Animation duration in milliseconds */
  animationDuration?: number
  /** Position configuration */
  position?: DropdownPosition
  /** Callback when dropdown opens */
  onOpen?: () => void
  /** Callback when dropdown closes */
  onClose?: () => void
  /** Callback when value changes */
  onValueChange?: (value: TValue | TValue[]) => void
  /** Callback when search changes */
  onSearchChange?: (search: string) => void
}

export interface DropdownItem<TValue = unknown> {
  /** Unique identifier */
  id: string
  /** Display label */
  label: string
  /** Item value */
  value: TValue
  /** Whether item is disabled */
  disabled?: boolean
  /** Icon component or name */
  icon?: React.ReactNode | string
  /** Additional description */
  description?: string
  /** Custom render function */
  render?: (item: DropdownItem<TValue>) => React.ReactNode
  /** Item group */
  group?: string
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

export interface DropdownStateResult<TValue = unknown> {
  /** Whether dropdown is open */
  isOpen: boolean
  /** Current selected value(s) */
  value: TValue | TValue[] | undefined
  /** Current search query */
  searchQuery: string
  /** Focused item index */
  focusedIndex: number
  /** Whether dropdown is disabled */
  disabled: boolean
  /** Filtered items based on search */
  filteredItems: DropdownItem<TValue>[]
  /** Selected items (for multiple mode) */
  selectedItems: DropdownItem<TValue>[]
  
  // Refs for DOM elements
  /** Ref for trigger element */
  triggerRef: React.RefObject<HTMLElement>
  /** Ref for dropdown content */
  dropdownRef: React.RefObject<HTMLElement>
  /** Ref for search input */
  searchRef: React.RefObject<HTMLInputElement>
  
  // Actions
  /** Open dropdown */
  open: () => void
  /** Close dropdown */
  close: () => void
  /** Toggle dropdown */
  toggle: () => void
  /** Select an item */
  select: (item: DropdownItem<TValue>) => void
  /** Deselect an item (multiple mode) */
  deselect: (item: DropdownItem<TValue>) => void
  /** Clear all selections */
  clear: () => void
  /** Set search query */
  setSearch: (query: string) => void
  /** Focus next item */
  focusNext: () => void
  /** Focus previous item */
  focusPrevious: () => void
  /** Focus item by index */
  focusItem: (index: number) => void
  /** Select focused item */
  selectFocused: () => void
  /** Check if item is selected */
  isSelected: (item: DropdownItem<TValue>) => boolean
  /** Get display text for current selection */
  getDisplayText: () => string
}

/**
 * Dropdown state hook for managing dropdown/select component state
 * 
 * @example
 * ```tsx
 * const dropdown = useDropdownState(items, {
 *   closeOnSelect: true,
 *   searchable: true,
 *   position: { placement: 'bottom-start', autoFlip: true },
 *   onValueChange: (value) => console.log('Selected:', value)
 * })
 * 
 * // Use in component
 * <div className="relative">
 *   <button
 *     ref={dropdown.triggerRef}
 *     onClick={dropdown.toggle}
 *     disabled={dropdown.disabled}
 *   >
 *     {dropdown.getDisplayText() || 'Select option...'}
 *   </button>
 *   
 *   {dropdown.isOpen && (
 *     <div ref={dropdown.dropdownRef} className="dropdown-content">
 *       {dropdown.searchable && (
 *         <input
 *           ref={dropdown.searchRef}
 *           value={dropdown.searchQuery}
 *           onChange={(e) => dropdown.setSearch(e.target.value)}
 *           placeholder="Search..."
 *         />
 *       )}
 *       {dropdown.filteredItems.map((item, index) => (
 *         <div
 *           key={item.id}
 *           className={`dropdown-item ${index === dropdown.focusedIndex ? 'focused' : ''}`}
 *           onClick={() => dropdown.select(item)}
 *         >
 *           {item.label}
 *         </div>
 *       ))}
 *     </div>
 *   )}
 * </div>
 * ```
 */
export function useDropdownState<TValue = unknown>(
  items: DropdownItem<TValue>[] = [],
  options: DropdownStateOptions<TValue> = {}
): DropdownStateResult<TValue> {
  const {
    initialOpen = false,
    initialValue,
    closeOnSelect = true,
    closeOnEscape = true,
    closeOnClickOutside = true,
    disabled = false,
    multiple = false,
    searchable = false,
    animationDuration = 150,
    // position = { placement: 'bottom-start', autoFlip: true }, - unused
    onOpen,
    onClose,
    onValueChange,
    onSearchChange
  } = options

  // State
  const [isOpen, setIsOpen] = useState(initialOpen)
  const [value, setValue] = useState<TValue | TValue[] | undefined>(initialValue)
  const [searchQuery, setSearchQuery] = useState('')
  const [focusedIndex, setFocusedIndex] = useState(-1)

  // Refs
  const triggerRef = useRef<HTMLElement>(null)
  const dropdownRef = useRef<HTMLElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Filter items based on search query
  const filteredItems = searchable && searchQuery
    ? items.filter(item => 
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : items

  // Get selected items
  const selectedItems = multiple && Array.isArray(value)
    ? items.filter(item => value.includes(item.value))
    : value !== undefined
    ? items.filter(item => item.value === value)
    : []

  // Actions
  const open = useCallback(() => {
    if (disabled) return
    
    setIsOpen(true)
    setFocusedIndex(0)
    
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current)
    }
    animationTimeoutRef.current = setTimeout(() => {
      // Focus search input if searchable
      if (searchable && searchRef.current) {
        searchRef.current.focus()
      }
    }, animationDuration)
    
    if (onOpen) onOpen()
  }, [disabled, animationDuration, searchable, onOpen])

  const close = useCallback(() => {
    setIsOpen(false)
    setSearchQuery('')
    setFocusedIndex(-1)
    
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current)
    }
    animationTimeoutRef.current = setTimeout(() => {
      // Animation complete
    }, animationDuration)
    
    // Return focus to trigger
    if (triggerRef.current) {
      triggerRef.current.focus()
    }
    
    if (onClose) onClose()
  }, [animationDuration, onClose])

  const toggle = useCallback(() => {
    if (isOpen) {
      close()
    } else {
      open()
    }
  }, [isOpen, close, open])

  const select = useCallback((item: DropdownItem<TValue>) => {
    if (item.disabled) return

    let newValue: TValue | TValue[]

    if (multiple) {
      const currentArray = Array.isArray(value) ? value : []
      if (currentArray.includes(item.value)) {
        // Deselect if already selected
        newValue = currentArray.filter(v => v !== item.value)
      } else {
        // Add to selection
        newValue = [...currentArray, item.value]
      }
    } else {
      newValue = item.value
    }

    setValue(newValue)
    
    if (onValueChange) {
      onValueChange(newValue)
    }

    if (closeOnSelect && !multiple) {
      close()
    }
  }, [multiple, value, onValueChange, closeOnSelect, close])

  const deselect = useCallback((item: DropdownItem<TValue>) => {
    if (!multiple || !Array.isArray(value)) return

    const newValue = value.filter(v => v !== item.value)
    setValue(newValue)
    
    if (onValueChange) {
      onValueChange(newValue)
    }
  }, [multiple, value, onValueChange])

  const clear = useCallback(() => {
    const newValue = multiple ? [] : undefined
    setValue(newValue)
    
    if (onValueChange) {
      onValueChange(newValue as TValue | TValue[])
    }
  }, [multiple, onValueChange])

  const setSearch = useCallback((query: string) => {
    setSearchQuery(query)
    setFocusedIndex(0) // Reset focus to first item
    
    if (onSearchChange) {
      onSearchChange(query)
    }
  }, [onSearchChange])

  const focusNext = useCallback(() => {
    setFocusedIndex(prev => 
      prev < filteredItems.length - 1 ? prev + 1 : 0
    )
  }, [filteredItems.length])

  const focusPrevious = useCallback(() => {
    setFocusedIndex(prev => 
      prev > 0 ? prev - 1 : filteredItems.length - 1
    )
  }, [filteredItems.length])

  const focusItem = useCallback((index: number) => {
    if (index >= 0 && index < filteredItems.length) {
      setFocusedIndex(index)
    }
  }, [filteredItems.length])

  const selectFocused = useCallback(() => {
    if (focusedIndex >= 0 && focusedIndex < filteredItems.length) {
      const item = filteredItems[focusedIndex]
      select(item)
    }
  }, [focusedIndex, filteredItems, select])

  const isSelected = useCallback((item: DropdownItem<TValue>) => {
    if (multiple && Array.isArray(value)) {
      return value.includes(item.value)
    }
    return value === item.value
  }, [multiple, value])

  const getDisplayText = useCallback(() => {
    if (multiple && Array.isArray(value)) {
      if (value.length === 0) return ''
      if (value.length === 1) {
        const item = items.find(i => i.value === value[0])
        return item?.label || ''
      }
      return `${value.length} selected`
    }
    
    const item = items.find(i => i.value === value)
    return item?.label || ''
  }, [multiple, value, items])

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          focusNext()
          break
        case 'ArrowUp':
          event.preventDefault()
          focusPrevious()
          break
        case 'Enter':
        case ' ':
          if (!searchable || document.activeElement !== searchRef.current) {
            event.preventDefault()
            selectFocused()
          }
          break
        case 'Escape':
          if (closeOnEscape) {
            event.preventDefault()
            close()
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, focusNext, focusPrevious, selectFocused, closeOnEscape, close, searchable])

  // Handle click outside
  useEffect(() => {
    if (!isOpen || !closeOnClickOutside) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        close()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, closeOnClickOutside, close])

  // Cleanup animation timeout
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current)
      }
    }
  }, [])

  // Reset focused index when items change
  useEffect(() => {
    if (focusedIndex >= filteredItems.length) {
      setFocusedIndex(Math.max(0, filteredItems.length - 1))
    }
  }, [filteredItems.length, focusedIndex])

  return {
    isOpen,
    value,
    searchQuery,
    focusedIndex,
    disabled,
    filteredItems,
    selectedItems,
    triggerRef: triggerRef as React.RefObject<HTMLElement>,
    dropdownRef: dropdownRef as React.RefObject<HTMLElement>,
    searchRef: searchRef as React.RefObject<HTMLInputElement>,
    open,
    close,
    toggle,
    select,
    deselect,
    clear,
    setSearch,
    focusNext,
    focusPrevious,
    focusItem,
    selectFocused,
    isSelected,
    getDisplayText
  }
}

// Export hook as default for easier imports
export default useDropdownState