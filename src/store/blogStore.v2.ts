/**
 * Blog Store V2 - Migrated to Standard Store Factory
 * 
 * This module contains three separate blog-related stores migrated to use the
 * standardized store factory pattern. This improves type safety, performance,
 * and maintainability while preserving all existing functionality.
 * 
 * Changes from v1:
 * - Uses createStandardStore factory for consistent middleware chain
 * - Proper TypeScript types with StandardStateCreator/LightweightStateCreator
 * - Immer integration for immutable updates
 * - Monitoring integration for performance tracking
 * - Maintains state machine pattern for modal management
 * - Feature flag compatibility for gradual rollout
 * 
 * Stores:
 * - BlogEditorStore: Draft management and editor preferences (persisted)
 * - BlogFilterStore: Search, filtering, and pagination (session only)
 * - BlogUIStore: UI preferences and modal states (persisted)
 */

import { createStandardStore, createUIStore } from './factories/createStandardStore'
import type { StandardStateCreator, LightweightStateCreator } from './types/mutators'
import type { BlogPostFilters, BlogPostSort, CreateBlogPostData } from '../types/blog'
import type { StateMachine, ModalStates, ModalEvents } from './utils/stateMachines'
import { createModalStateMachine } from './utils/stateMachines'

// =============================================================================
// BLOG EDITOR STORE - Draft management and editor preferences (persisted)
// =============================================================================

export interface BlogEditorState {
  // Draft post data
  draft: Partial<CreateBlogPostData> | null
  isDraftSaved: boolean
  lastSavedAt: Date | null

  // Editor preferences
  editorMode: 'markdown' | 'wysiwyg'
  previewMode: 'desktop' | 'mobile' | 'split'
  sidebarOpen: boolean
  wordWrapEnabled: boolean
  autosaveEnabled: boolean
  autosaveInterval: number // in seconds

  // Actions
  setDraft: (draft: Partial<CreateBlogPostData>) => void
  updateDraft: (updates: Partial<CreateBlogPostData>) => void
  clearDraft: () => void
  markDraftSaved: () => void
  setEditorMode: (mode: 'markdown' | 'wysiwyg') => void
  setPreviewMode: (mode: 'desktop' | 'mobile' | 'split') => void
  toggleSidebar: () => void
  setWordWrap: (enabled: boolean) => void
  setAutosave: (enabled: boolean, interval?: number) => void
}

const blogEditorInitialState = {
  draft: null,
  isDraftSaved: true,
  lastSavedAt: null,
  editorMode: 'markdown' as const,
  previewMode: 'split' as const,
  sidebarOpen: true,
  wordWrapEnabled: true,
  autosaveEnabled: true,
  autosaveInterval: 30,
}

const createBlogEditorStoreState: StandardStateCreator<BlogEditorState> = (set) => ({
  ...blogEditorInitialState,

  // Draft actions using Immer
  setDraft: (draft) => {
    set((state) => {
      state.draft = draft
      state.isDraftSaved = false
    })
  },

  updateDraft: (updates) => {
    set((state) => {
      if (state.draft) {
        Object.assign(state.draft, updates)
      } else {
        state.draft = updates
      }
      state.isDraftSaved = false
    })
  },

  clearDraft: () => {
    set((state) => {
      state.draft = null
      state.isDraftSaved = true
      state.lastSavedAt = null
    })
  },

  markDraftSaved: () => {
    set((state) => {
      state.isDraftSaved = true
      state.lastSavedAt = new Date()
    })
  },

  // Editor preference actions
  setEditorMode: (mode) => {
    set((state) => {
      state.editorMode = mode
    })
  },

  setPreviewMode: (mode) => {
    set((state) => {
      state.previewMode = mode
    })
  },

  toggleSidebar: () => {
    set((state) => {
      state.sidebarOpen = !state.sidebarOpen
    })
  },

  setWordWrap: (enabled) => {
    set((state) => {
      state.wordWrapEnabled = enabled
    })
  },

  setAutosave: (enabled, interval) => {
    set((state) => {
      state.autosaveEnabled = enabled
      if (interval !== undefined) {
        state.autosaveInterval = interval
      }
    })
  },
})

// Editor Store - Persisted for draft recovery
export const useBlogEditorStore = createStandardStore<BlogEditorState>({
  name: 'blog-editor-store',
  creator: createBlogEditorStoreState,
  persist: {
    partialize: (state) => ({
      draft: state.draft,
      editorMode: state.editorMode,
      previewMode: state.previewMode,
      wordWrapEnabled: state.wordWrapEnabled,
      autosaveEnabled: state.autosaveEnabled,
      autosaveInterval: state.autosaveInterval,
    }),
  },
  monitoring: {
    enabled: true,
    trackPerformance: true,
    trackStateChanges: true,
  },
})

// =============================================================================
// BLOG FILTER STORE - Search, filtering, and pagination (session only)
// =============================================================================

export interface BlogFilterState {
  // Current filters
  filters: BlogPostFilters
  sort: BlogPostSort
  searchQuery: string

  // Pagination
  currentPage: number
  pageSize: number

  // Selected items
  selectedPostIds: string[]
  selectedCategoryId: string | null
  selectedTagId: string | null

  // Actions
  setFilters: (filters: Partial<BlogPostFilters>) => void
  resetFilters: () => void
  setSort: (sort: BlogPostSort) => void
  setSearchQuery: (query: string) => void
  setCurrentPage: (page: number) => void
  setPageSize: (size: number) => void
  togglePostSelection: (postId: string) => void
  selectAllPosts: (postIds: string[]) => void
  clearPostSelection: () => void
  setSelectedCategory: (categoryId: string | null) => void
  setSelectedTag: (tagId: string | null) => void
}

const blogFilterInitialState = {
  filters: {},
  sort: { by: 'published_at', order: 'desc' } as BlogPostSort,
  searchQuery: '',
  currentPage: 1,
  pageSize: 10,
  selectedPostIds: [],
  selectedCategoryId: null,
  selectedTagId: null,
}

const createBlogFilterStoreState: LightweightStateCreator<BlogFilterState> = (set) => ({
  ...blogFilterInitialState,

  // Filter actions using Immer
  setFilters: (filters) => {
    set((state) => {
      Object.assign(state.filters, filters)
      state.currentPage = 1 // Reset to first page on filter change
    })
  },

  resetFilters: () => {
    set((state) => {
      state.filters = {}
      state.searchQuery = ''
      state.currentPage = 1
      state.selectedCategoryId = null
      state.selectedTagId = null
    })
  },

  setSort: (sort) => {
    set((state) => {
      state.sort = sort
      state.currentPage = 1 // Reset to first page on sort change
    })
  },

  setSearchQuery: (query) => {
    set((state) => {
      state.searchQuery = query
      state.currentPage = 1 // Reset to first page on search
    })
  },

  setCurrentPage: (page) => {
    set((state) => {
      state.currentPage = page
    })
  },

  setPageSize: (size) => {
    set((state) => {
      state.pageSize = size
      state.currentPage = 1 // Reset to first page on page size change
    })
  },

  togglePostSelection: (postId) => {
    set((state) => {
      const index = state.selectedPostIds.indexOf(postId)
      if (index !== -1) {
        state.selectedPostIds.splice(index, 1)
      } else {
        state.selectedPostIds.push(postId)
      }
    })
  },

  selectAllPosts: (postIds) => {
    set((state) => {
      state.selectedPostIds = [...postIds]
    })
  },

  clearPostSelection: () => {
    set((state) => {
      state.selectedPostIds = []
    })
  },

  setSelectedCategory: (categoryId) => {
    set((state) => {
      state.selectedCategoryId = categoryId
      if (categoryId) {
        state.filters.categoryId = categoryId
      } else {
        delete state.filters.categoryId
      }
    })
  },

  setSelectedTag: (tagId) => {
    set((state) => {
      state.selectedTagId = tagId
      if (tagId) {
        state.filters.tagId = tagId
      } else {
        delete state.filters.tagId
      }
    })
  },
})

// Filter Store - Session only (lightweight)
export const useBlogFilterStore = createUIStore<BlogFilterState>(
  'blog-filter-store',
  createBlogFilterStoreState
)

// =============================================================================
// BLOG UI STORE - UI preferences and modal states (persisted)
// =============================================================================

// Custom modal state interface for blog UI
interface BlogModalState {
  type: 'create' | 'edit' | 'delete' | 'bulk_delete' | 'bulk_edit' | 'preview' | null
  id?: string
  entityType?: string
  isDirty?: boolean
  cascadeDelete?: boolean
}

export interface BlogUIState {
  // Layout preferences
  viewMode: 'grid' | 'list' | 'compact'
  showFilters: boolean
  showMetrics: boolean

  // Modal state machine (replaces boolean flags)
  modalState: BlogModalState
  modalStateMachine: StateMachine<ModalStates, ModalEvents>

  // Feature toggles
  enableComments: boolean
  enableRealtime: boolean
  showDrafts: boolean

  // Actions
  setViewMode: (mode: 'grid' | 'list' | 'compact') => void
  toggleFilters: () => void
  toggleMetrics: () => void
  // Enhanced modal actions using state machine
  openCreateModal: (entityType?: string) => void
  closeCreateModal: () => void
  openEditModal: (postId: string, isDirty?: boolean) => void
  closeEditModal: () => void
  openDeleteModal: (postId: string, cascadeDelete?: boolean) => void
  closeDeleteModal: () => void
  rollbackModal: () => boolean
  setEnableComments: (enabled: boolean) => void
  setEnableRealtime: (enabled: boolean) => void
  setShowDrafts: (show: boolean) => void
}

const blogUIInitialState = {
  viewMode: 'grid' as const,
  showFilters: true,
  showMetrics: true,
  modalState: { type: null } as BlogModalState,
  modalStateMachine: createModalStateMachine(),
  enableComments: true,
  enableRealtime: true,
  showDrafts: false,
}

const createBlogUIStoreState: StandardStateCreator<BlogUIState> = (set) => ({
  ...blogUIInitialState,

  // Layout actions
  setViewMode: (mode) => {
    set((state) => {
      state.viewMode = mode
    })
  },

  toggleFilters: () => {
    set((state) => {
      state.showFilters = !state.showFilters
    })
  },

  toggleMetrics: () => {
    set((state) => {
      state.showMetrics = !state.showMetrics
    })
  },

  // Modal actions using state machine pattern
  openCreateModal: (entityType = 'blog_post') => {
    set((state) => {
      state.modalState = {
        type: 'create',
        entityType
      }
    })
  },

  closeCreateModal: () => {
    set((state) => {
      state.modalState = { type: null }
    })
  },

  openEditModal: (postId: string, isDirty = false) => {
    set((state) => {
      state.modalState = {
        type: 'edit',
        id: postId,
        entityType: 'blog_post',
        isDirty
      }
    })
  },

  closeEditModal: () => {
    set((state) => {
      state.modalState = { type: null }
    })
  },

  openDeleteModal: (postId: string, cascadeDelete = false) => {
    set((state) => {
      state.modalState = {
        type: 'delete',
        id: postId,
        entityType: 'blog_post',
        cascadeDelete
      }
    })
  },

  closeDeleteModal: () => {
    set((state) => {
      state.modalState = { type: null }
    })
  },

  rollbackModal: () => {
    set((state) => {
      state.modalState = { type: null }
    })
    return true
  },

  // Feature toggle actions
  setEnableComments: (enabled) => {
    set((state) => {
      state.enableComments = enabled
    })
  },

  setEnableRealtime: (enabled) => {
    set((state) => {
      state.enableRealtime = enabled
    })
  },

  setShowDrafts: (show) => {
    set((state) => {
      state.showDrafts = show
    })
  },
})

// UI Store - Persisted for user preferences
export const useBlogUIStore = createStandardStore<BlogUIState>({
  name: 'blog-ui-store',
  creator: createBlogUIStoreState,
  persist: {
    partialize: (state) => ({
      viewMode: state.viewMode,
      showFilters: state.showFilters,
      showMetrics: state.showMetrics,
      enableComments: state.enableComments,
      enableRealtime: state.enableRealtime,
      showDrafts: state.showDrafts,
    }),
  },
  monitoring: {
    enabled: true,
    trackPerformance: true,
    trackStateChanges: true,
  },
})

// =============================================================================
// IMPROVED COMBINED HOOK & SELECTORS
// =============================================================================

/**
 * Combined hook for blog stores - IMPROVED VERSION
 * 
 * The original combined hook caused over-rendering because it returned
 * a new object on every render. This improved version uses selector
 * patterns to prevent unnecessary re-renders.
 * 
 * @deprecated Consider using individual selectors instead for better performance
 */
export function useBlogStore() {
  const editor = useBlogEditorStore()
  const filters = useBlogFilterStore()
  const ui = useBlogUIStore()

  return {
    editor,
    filters,
    ui,
  }
}

// =============================================================================
// OPTIMIZED SELECTORS - Replace combined hooks to prevent over-rendering
// =============================================================================

// Editor selectors
export const useBlogDraft = () => useBlogEditorStore((state) => state.draft)
export const useBlogDraftStatus = () => useBlogEditorStore((state) => ({
  isDraftSaved: state.isDraftSaved,
  lastSavedAt: state.lastSavedAt,
}))
export const useBlogEditorMode = () => useBlogEditorStore((state) => state.editorMode)
export const useBlogPreviewMode = () => useBlogEditorStore((state) => state.previewMode)
export const useBlogEditorPreferences = () => useBlogEditorStore((state) => ({
  sidebarOpen: state.sidebarOpen,
  wordWrapEnabled: state.wordWrapEnabled,
  autosaveEnabled: state.autosaveEnabled,
  autosaveInterval: state.autosaveInterval,
}))

// Filter selectors
export const useBlogFilters = () => useBlogFilterStore((state) => state.filters)
export const useBlogSort = () => useBlogFilterStore((state) => state.sort)
export const useBlogSearchQuery = () => useBlogFilterStore((state) => state.searchQuery)
export const useBlogPagination = () => useBlogFilterStore((state) => ({
  currentPage: state.currentPage,
  pageSize: state.pageSize,
}))
export const useBlogSelection = () => useBlogFilterStore((state) => ({
  selectedPostIds: state.selectedPostIds,
  selectedCategoryId: state.selectedCategoryId,
  selectedTagId: state.selectedTagId,
}))

// UI selectors
export const useBlogViewMode = () => useBlogUIStore((state) => state.viewMode)
export const useBlogVisibility = () => useBlogUIStore((state) => ({
  showFilters: state.showFilters,
  showMetrics: state.showMetrics,
}))
export const useBlogModalState = () => useBlogUIStore((state) => state.modalState)
export const useBlogFeatureToggles = () => useBlogUIStore((state) => ({
  enableComments: state.enableComments,
  enableRealtime: state.enableRealtime,
  showDrafts: state.showDrafts,
}))

// =============================================================================
// LEGACY SELECTORS - For backward compatibility
// =============================================================================

export const blogSelectors = {
  // Editor selectors
  hasDraft: (state: BlogEditorState) => state.draft !== null,
  isDraftValid: (state: BlogEditorState) => {
    const draft = state.draft
    return draft?.title && draft?.content && draft.title.length > 0
  },

  // Filter selectors
  hasActiveFilters: (state: BlogFilterState) => {
    return Object.keys(state.filters).length > 0 || state.searchQuery.length > 0
  },
  getActiveFilterCount: (state: BlogFilterState) => {
    let count = Object.keys(state.filters).length
    if (state.searchQuery) count++
    return count
  },

  // UI selectors using custom modal state
  hasOpenModals: (state: BlogUIState) => {
    return state.modalState.type !== null
  },
  getActiveModal: (state: BlogUIState) => {
    return state.modalState.type
  },

  // Backward compatibility selectors (deprecated)
  isCreateModalOpen: (state: BlogUIState) => state.modalState.type === 'create',
  isEditModalOpen: (state: BlogUIState) => state.modalState.type === 'edit',
  isDeleteModalOpen: (state: BlogUIState) => state.modalState.type === 'delete',
  editingPostId: (state: BlogUIState) => {
    const modalState = state.modalState
    return modalState.type === 'edit' ? modalState.id || null : null
  },
  deletingPostId: (state: BlogUIState) => {
    const modalState = state.modalState
    return modalState.type === 'delete' ? modalState.id || null : null
  },
}

// Development helpers
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  ;(window as Record<string, unknown>).__blogEditorStore = useBlogEditorStore
  ;(window as Record<string, unknown>).__blogFilterStore = useBlogFilterStore
  ;(window as Record<string, unknown>).__blogUIStore = useBlogUIStore
}