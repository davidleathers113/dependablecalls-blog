// Expandable state hook for collapsible content
import { useCallback, useEffect, useRef, useState } from 'react'

// Local type definitions for expandable state management
export interface ExpandableItem<TData = unknown> {
  id: string
  title: string
  level: number
  parentId?: string
  hasChildren: boolean
  isLoaded: boolean
  data?: TData
}

export type ExpandableState =
  | { type: 'collapsed'; itemId: string }
  | { type: 'expanded'; itemId: string; childrenLoaded?: boolean }
  | { type: 'loading'; itemId: string; operation: 'expand' | 'collapse' | 'load_children' }
  | { type: 'error'; itemId: string; message: string }

export interface StateMachine<TState> {
  state: TState
  previousState: TState | null
  transitions: Array<{
    from: string | null
    to: string
    timestamp: number
    reason?: string
    metadata?: Record<string, unknown>
  }>
  canTransitionTo: (newType: TState extends { type: string } ? TState['type'] : string) => boolean
  transition: (newState: TState, reason?: string, metadata?: Record<string, unknown>) => void
  rollback: () => boolean
}


export interface ExpandableStateOptions<TData = unknown> {
  /** Initial items */
  initialItems?: ExpandableItem<TData>[]
  /** Initial expanded items */
  initialExpanded?: Set<string>
  /** Maximum expanded level (0 = no limit) */
  maxExpandedLevel?: number
  /** Whether to collapse siblings when expanding */
  collapseSiblings?: boolean
  /** Whether to remember expanded state in localStorage */
  persistState?: boolean
  /** Storage key for persistence */
  storageKey?: string
  /** Animation duration in milliseconds */
  animationDuration?: number
  /** Async data loader function */
  loadChildren?: (itemId: string) => Promise<ExpandableItem<TData>[]>
  /** Callback when item expands */
  onExpand?: (itemId: string, item: ExpandableItem<TData>) => void
  /** Callback when item collapses */
  onCollapse?: (itemId: string, item: ExpandableItem<TData>) => void
  /** Callback when loading starts */
  onLoadingStart?: (itemId: string) => void
  /** Callback when loading completes */
  onLoadingComplete?: (itemId: string, children: ExpandableItem<TData>[]) => void
  /** Callback when loading fails */
  onLoadingError?: (itemId: string, error: Error) => void
}

export interface ExpandableStateResult<TData = unknown> {
  /** Current expandable state */
  state: ExpandableState
  /** All items */
  items: ExpandableItem<TData>[]
  /** Set of expanded item IDs */
  expandedItems: Set<string>
  /** Set of currently loading item IDs */
  loadingItems: Set<string>
  /** Maximum expanded level */
  maxExpandedLevel: number
  /** State machine instance */
  stateMachine: StateMachine<ExpandableState>
  
  // Actions
  /** Expand an item */
  expand: (itemId: string) => Promise<void>
  /** Collapse an item */
  collapse: (itemId: string) => void
  /** Toggle an item's expanded state */
  toggle: (itemId: string) => Promise<void>
  /** Expand all items up to max level */
  expandAll: (maxLevel?: number) => Promise<void>
  /** Collapse all items */
  collapseAll: () => void
  /** Load children for an item */
  loadChildren: (itemId: string) => Promise<void>
  /** Check if item is expanded */
  isExpanded: (itemId: string) => boolean
  /** Check if item is loading */
  isLoading: (itemId: string) => boolean
  /** Get children of an item */
  getChildren: (itemId: string) => ExpandableItem<TData>[]
  /** Get parent of an item */
  getParent: (itemId: string) => ExpandableItem<TData> | undefined
  /** Get siblings of an item */
  getSiblings: (itemId: string) => ExpandableItem<TData>[]
  /** Add new items */
  addItems: (items: ExpandableItem<TData>[]) => void
  /** Remove items */
  removeItems: (itemIds: string[]) => void
  /** Update item data */
  updateItem: (itemId: string, updates: Partial<ExpandableItem<TData>>) => void
}

// State machine implementation with transition tracking
function createBaseStateMachine<TState extends { type: string }>(
  initialState: TState
): StateMachine<TState> {
  let state = initialState
  let previousState: TState | null = null
  const transitions: Array<{
    from: string | null
    to: string
    timestamp: number
    reason?: string
    metadata?: Record<string, unknown>
  }> = []

  return {
    state,
    previousState,
    transitions,

     
    canTransitionTo: (_newType: TState['type']): boolean => {
      return true // Default implementation - allows all transitions
    },

    transition: (newState: TState, reason?: string, metadata?: Record<string, unknown>): void => {
      previousState = state
      transitions.push({
        from: state.type,
        to: newState.type,
        timestamp: Date.now(),
        reason,
        metadata
      })
      state = newState
    },

    rollback: (): boolean => {
      if (previousState) {
        const currentState = state
        state = previousState
        previousState = currentState
        transitions.push({
          from: currentState.type,
          to: state.type,
          timestamp: Date.now(),
          reason: 'rollback'
        })
        return true
      }
      return false
    }
  }
}

/**
 * Expandable state hook for managing collapsible content
 * 
 * @example
 * ```tsx
 * const expandable = useExpandableState({
 *   initialItems: treeData,
 *   maxExpandedLevel: 3,
 *   persistState: true,
 *   storageKey: 'sidebar-tree',
 *   loadChildren: async (itemId) => {
 *     const response = await api.getChildren(itemId)
 *     return response.data
 *   }
 * })
 * 
 * // Use in component
 * <div>
 *   {expandable.items.map(item => (
 *     <TreeItem
 *       key={item.id}
 *       item={item}
 *       isExpanded={expandable.isExpanded(item.id)}
 *       isLoading={expandable.isLoading(item.id)}
 *       onToggle={() => expandable.toggle(item.id)}
 *     />
 *   ))}
 * </div>
 * ```
 */
export function useExpandableState<TData = unknown>(
  options: ExpandableStateOptions<TData> = {}
): ExpandableStateResult<TData> {
  const {
    initialItems = [],
    initialExpanded = new Set(),
    maxExpandedLevel = 0,
    collapseSiblings = false,
    persistState = false,
    storageKey = 'expandable-state',
    animationDuration = 200,
    loadChildren: loadChildrenFn,
    onExpand,
    onCollapse,
    onLoadingStart,
    onLoadingComplete,
    onLoadingError
  } = options

  // Initialize state from localStorage if persistence is enabled
  const getInitialState = useCallback((): Set<string> => {
    if (persistState && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey)
        if (saved) {
          const { expandedItems } = JSON.parse(saved)
          return new Set<string>(expandedItems)
        }
      } catch (error) {
        console.warn('Failed to load expandable state from localStorage:', error)
      }
    }
    return initialExpanded
  }, [persistState, storageKey, initialExpanded])

  // State management
  const [stateMachine] = useState(() => 
    createBaseStateMachine<ExpandableState>({ type: 'collapsed', itemId: '' })
  )
  const [state, setState] = useState<ExpandableState>({ type: 'collapsed', itemId: '' })
  const [items, setItems] = useState<ExpandableItem<TData>[]>(initialItems)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(getInitialState)
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set())
  
  // Refs
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Persist state to localStorage
  const persistStateToStorage = useCallback((expanded: Set<string>) => {
    if (persistState && typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          expandedItems: Array.from(expanded)
        }))
      } catch (error) {
        console.warn('Failed to save expandable state to localStorage:', error)
      }
    }
  }, [persistState, storageKey])

  // Helper functions
  const findItem = useCallback((itemId: string): ExpandableItem<TData> | undefined => {
    return items.find(item => item.id === itemId)
  }, [items])

  const getChildren = useCallback((itemId: string): ExpandableItem<TData>[] => {
    return items.filter(item => item.parentId === itemId)
  }, [items])

  const getParent = useCallback((itemId: string): ExpandableItem<TData> | undefined => {
    const item = findItem(itemId)
    return item?.parentId ? findItem(item.parentId) : undefined
  }, [findItem])

  const getSiblings = useCallback((itemId: string): ExpandableItem<TData>[] => {
    const item = findItem(itemId)
    if (!item) return []
    return items.filter(i => i.parentId === item.parentId && i.id !== itemId)
  }, [findItem, items])

  const isExpanded = useCallback((itemId: string): boolean => {
    return expandedItems.has(itemId)
  }, [expandedItems])

  const isLoading = useCallback((itemId: string): boolean => {
    return loadingItems.has(itemId)
  }, [loadingItems])

  // State transition helper
  const transitionToState = useCallback((
    newState: ExpandableState,
    reason?: string,
    metadata?: Record<string, unknown>
  ) => {
    stateMachine.transition(newState, reason, metadata)
    setState(newState)
    
    // Handle animation
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current)
    }
    animationTimeoutRef.current = setTimeout(() => {
      setState(prev => {
        // Create properly typed state transitions
        if (prev.type === 'loading') {
          return { type: 'expanded', itemId: prev.itemId, childrenLoaded: true }
        }
        return prev
      })
    }, animationDuration)
  }, [stateMachine, animationDuration])

  // Load children function - defined before expand to avoid forward reference
  const loadChildren = useCallback(async (itemId: string): Promise<void> => {
    const item = findItem(itemId)
    if (!item || !loadChildrenFn || isLoading(itemId)) return

    transitionToState({ type: 'loading', itemId, operation: 'load_children' }, 'load_children')
    
    const newLoading = new Set(loadingItems)
    newLoading.add(itemId)
    setLoadingItems(newLoading)
    
    if (onLoadingStart) onLoadingStart(itemId)

    try {
      const children = await loadChildrenFn(itemId)
      
      // Update items
      setItems(prevItems => {
        const updatedItems = [...prevItems]
        const itemIndex = updatedItems.findIndex(i => i.id === itemId)
        if (itemIndex !== -1) {
          updatedItems[itemIndex] = { ...updatedItems[itemIndex], isLoaded: true }
        }
        return [...updatedItems, ...children]
      })
      
      if (onLoadingComplete) onLoadingComplete(itemId, children)
    } catch (error) {
      transitionToState({ 
        type: 'error', 
        itemId, 
        message: error instanceof Error ? error.message : 'Failed to load children' 
      }, 'load_error')
      
      if (onLoadingError) onLoadingError(itemId, error instanceof Error ? error : new Error('Unknown error'))
    } finally {
      const newLoading = new Set(loadingItems)
      newLoading.delete(itemId)
      setLoadingItems(newLoading)
    }
  }, [findItem, loadChildrenFn, isLoading, transitionToState, loadingItems, onLoadingStart, onLoadingComplete, onLoadingError])

  // Actions
  const expand = useCallback(async (itemId: string): Promise<void> => {
    const item = findItem(itemId)
    if (!item || isExpanded(itemId)) return

    // Check level constraints
    if (maxExpandedLevel > 0) {
      if (item.level >= maxExpandedLevel) return
    }

    // Collapse siblings if required
    if (collapseSiblings) {
      const siblings = getSiblings(itemId)
      const newExpanded = new Set(expandedItems)
      siblings.forEach(sibling => {
        newExpanded.delete(sibling.id)
        if (onCollapse) onCollapse(sibling.id, sibling)
      })
      setExpandedItems(newExpanded)
    }

    transitionToState({ type: 'expanded', itemId, childrenLoaded: item.isLoaded }, 'expand')
    
    const newExpanded = new Set(expandedItems)
    newExpanded.add(itemId)
    setExpandedItems(newExpanded)
    persistStateToStorage(newExpanded)
    
    // Load children if needed
    if (item.hasChildren && !item.isLoaded && loadChildrenFn) {
      await loadChildren(itemId)
    }
    
    if (onExpand) onExpand(itemId, item)
  }, [
    findItem, isExpanded, maxExpandedLevel, collapseSiblings, getSiblings, 
    expandedItems, onCollapse, transitionToState, onExpand, loadChildrenFn,
    loadChildren, persistStateToStorage
  ])

  const collapse = useCallback((itemId: string): void => {
    const item = findItem(itemId)
    if (!item || !isExpanded(itemId)) return

    transitionToState({ type: 'collapsed', itemId }, 'collapse')
    
    // Collapse item and all descendants
    const newExpanded = new Set(expandedItems)
    const collapseRecursive = (id: string) => {
      newExpanded.delete(id)
      const children = getChildren(id)
      children.forEach(child => collapseRecursive(child.id))
    }
    
    collapseRecursive(itemId)
    setExpandedItems(newExpanded)
    persistStateToStorage(newExpanded)
    
    if (onCollapse) onCollapse(itemId, item)
  }, [findItem, isExpanded, transitionToState, expandedItems, getChildren, persistStateToStorage, onCollapse])

  const toggle = useCallback(async (itemId: string): Promise<void> => {
    if (isExpanded(itemId)) {
      collapse(itemId)
    } else {
      await expand(itemId)
    }
  }, [isExpanded, collapse, expand])

  const expandAll = useCallback(async (maxLevel?: number): Promise<void> => {
    const targetLevel = maxLevel ?? maxExpandedLevel
    const newExpanded = new Set(expandedItems)
    
    for (const item of items) {
      if (targetLevel === 0 || item.level < targetLevel) {
        newExpanded.add(item.id)
        
        // Load children if needed
        if (item.hasChildren && !item.isLoaded && loadChildrenFn) {
          await loadChildren(item.id)
        }
      }
    }
    
    setExpandedItems(newExpanded)
    persistStateToStorage(newExpanded)
  }, [maxExpandedLevel, expandedItems, items, loadChildrenFn, loadChildren, persistStateToStorage])

  const collapseAll = useCallback((): void => {
    transitionToState({ type: 'collapsed', itemId: '' }, 'collapse_all')
    
    const newExpanded = new Set<string>()
    setExpandedItems(newExpanded)
    persistStateToStorage(newExpanded)
    
    expandedItems.forEach(itemId => {
      const item = findItem(itemId)
      if (item && onCollapse) onCollapse(itemId, item)
    })
  }, [transitionToState, persistStateToStorage, expandedItems, findItem, onCollapse])


  const addItems = useCallback((newItems: ExpandableItem<TData>[]): void => {
    setItems(prevItems => [...prevItems, ...newItems])
  }, [])

  const removeItems = useCallback((itemIds: string[]): void => {
    setItems(prevItems => prevItems.filter(item => !itemIds.includes(item.id)))
    
    // Remove from expanded items
    const newExpanded = new Set(expandedItems)
    itemIds.forEach(id => newExpanded.delete(id))
    setExpandedItems(newExpanded)
    persistStateToStorage(newExpanded)
  }, [expandedItems, persistStateToStorage])

  const updateItem = useCallback((itemId: string, updates: Partial<ExpandableItem<TData>>): void => {
    setItems(prevItems => prevItems.map(item => 
      item.id === itemId ? { ...item, ...updates } : item
    ))
  }, [])

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current)
      }
    }
  }, [])

  return {
    state,
    items,
    expandedItems,
    loadingItems,
    maxExpandedLevel,
    stateMachine,
    expand,
    collapse,
    toggle,
    expandAll,
    collapseAll,
    loadChildren,
    isExpanded,
    isLoading,
    getChildren,
    getParent,
    getSiblings,
    addItems,
    removeItems,
    updateItem
  }
}

// Export hook as default for easier imports
export default useExpandableState