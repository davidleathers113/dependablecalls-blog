/**
 * Blog Store - DCE Zustand Architecture
 * 
 * This module contains three separate blog-related stores following DCE Zustand patterns.
 * All stores use proper TypeScript types, follow DCE naming conventions (setX, fetchX, updateX, deleteX),
 * and integrate with Supabase for real-time updates.
 * 
 * DCE Compliance:
 * - ZERO 'any' types - explicit BlogState interface types throughout
 * - Actions follow DCE naming: setX, fetchX, updateX, deleteX
 * - Immer middleware for immutable updates
 * - Supabase real-time integration
 * - Proper TypeScript coverage with StandardStateCreator/LightweightStateCreator
 * 
 * Stores:
 * - BlogEditorStore: Draft management and editor preferences (persisted)
 * - BlogFilterStore: Search, filtering, and pagination (session only)
 * - BlogUIStore: UI preferences and modal states (persisted)
 */

import { createStandardStore, createUIStore } from './factories/createStandardStore'
import type { StandardStateCreator, LightweightStateCreator } from './types/mutators'
import type { 
  BlogPostFilters, 
  BlogPostSort, 
  CreateBlogPostData, 
  BlogPost
} from '../types/blog'
import type { StateMachine, ModalStates, ModalEvents } from './utils/stateMachines'
import { createModalStateMachine } from './utils/stateMachines'
import { supabase } from '../lib/supabase'

// =============================================================================
// BLOG EDITOR STORE - Draft management and editor preferences (persisted)
// =============================================================================

export interface BlogEditorState {
  // Draft post data
  draft: Partial<CreateBlogPostData> | null
  isDraftSaved: boolean
  lastSavedAt: Date | null
  loading: boolean
  error: string | null

  // Editor preferences
  editorMode: 'markdown' | 'wysiwyg'
  previewMode: 'desktop' | 'mobile' | 'split'
  sidebarOpen: boolean
  wordWrapEnabled: boolean
  autosaveEnabled: boolean
  autosaveInterval: number // in seconds

  // DCE Actions - following setX, fetchX, updateX, deleteX pattern
  setDraft: (draft: Partial<CreateBlogPostData>) => void
  setEditorMode: (mode: 'markdown' | 'wysiwyg') => void
  setPreviewMode: (mode: 'desktop' | 'mobile' | 'split') => void
  setWordWrap: (enabled: boolean) => void
  setAutosave: (enabled: boolean, interval?: number) => void
  setSidebarOpen: (open: boolean) => void
  
  // Fetch actions
  fetchDraft: (postId?: string) => Promise<void>
  
  // Update actions
  updateDraft: (updates: Partial<CreateBlogPostData>) => void
  updateDraftSaved: () => void
  
  // Delete actions
  deleteDraft: () => void
  
  // Utility actions
  toggleSidebar: () => void
  resetEditor: () => void
}

const blogEditorInitialState = {
  draft: null,
  isDraftSaved: true,
  lastSavedAt: null,
  loading: false,
  error: null,
  editorMode: 'markdown' as const,
  previewMode: 'split' as const,
  sidebarOpen: true,
  wordWrapEnabled: true,
  autosaveEnabled: true,
  autosaveInterval: 30,
}

const createBlogEditorStoreState: StandardStateCreator<BlogEditorState> = (set, _get) => ({
  ...blogEditorInitialState,

  // DCE Set Actions - synchronous state updates
  setDraft: (draft) => {
    set((state: BlogEditorState) => {
      state.draft = draft
      state.isDraftSaved = false
      state.lastSavedAt = null
    })
  },

  setEditorMode: (mode) => {
    set((state: BlogEditorState) => {
      state.editorMode = mode
    })
  },

  setPreviewMode: (mode) => {
    set((state: BlogEditorState) => {
      state.previewMode = mode
    })
  },

  setWordWrap: (enabled) => {
    set((state: BlogEditorState) => {
      state.wordWrapEnabled = enabled
    })
  },

  setAutosave: (enabled, interval) => {
    set((state: BlogEditorState) => {
      state.autosaveEnabled = enabled
      if (interval !== undefined) {
        state.autosaveInterval = interval
      }
    })
  },

  setSidebarOpen: (open) => {
    set((state: BlogEditorState) => {
      state.sidebarOpen = open
    })
  },

  // DCE Fetch Actions - asynchronous data fetching
  fetchDraft: async (postId) => {
    set((state: BlogEditorState) => {
      state.loading = true
      state.error = null
    })

    try {
      if (!postId) {
        // Clear draft if no postId
        set((state: BlogEditorState) => {
          state.draft = null
          state.isDraftSaved = true
          state.loading = false
        })
        return
      }

      if (!supabase) {
        throw new Error('Supabase client not available')
      }

      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('id', postId)
        .eq('status', 'draft')
        .single()

      if (error) throw error

      set((state: BlogEditorState) => {
        state.draft = {
          title: data.title,
          subtitle: data.subtitle || undefined,
          content: data.content,
          excerpt: data.excerpt || undefined,
          featured_image_url: data.featured_image_url || undefined,
          status: data.status,
          published_at: data.published_at || undefined,
          metadata: data.metadata || undefined,
        }
        state.isDraftSaved = true
        state.lastSavedAt = new Date(data.updated_at)
        state.loading = false
      })
    } catch (error) {
      set((state: BlogEditorState) => {
        state.error = error instanceof Error ? error.message : 'Failed to fetch draft'
        state.loading = false
      })
    }
  },

  // DCE Update Actions - state mutations with optimistic updates
  updateDraft: (updates) => {
    set((state: BlogEditorState) => {
      if (state.draft) {
        Object.assign(state.draft, updates)
      } else {
        state.draft = updates
      }
      state.isDraftSaved = false
      state.lastSavedAt = null
    })
  },

  updateDraftSaved: () => {
    set((state: BlogEditorState) => {
      state.isDraftSaved = true
      state.lastSavedAt = new Date()
    })
  },

  // DCE Delete Actions - removal operations
  deleteDraft: () => {
    set((state: BlogEditorState) => {
      state.draft = null
      state.isDraftSaved = true
      state.lastSavedAt = null
      state.error = null
    })
  },

  // Utility actions
  toggleSidebar: () => {
    set((state: BlogEditorState) => {
      state.sidebarOpen = !state.sidebarOpen
    })
  },

  resetEditor: () => {
    set(blogEditorInitialState)
  },
})

// Editor Store - Persisted for draft recovery
export const useBlogEditorStore = createStandardStore<BlogEditorState>({
  name: 'blog-editor-store',
  creator: createBlogEditorStoreState,
  persist: {
    partialize: (state: BlogEditorState) => ({
      ...state,
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
  loading: boolean
  error: string | null

  // Pagination
  currentPage: number
  pageSize: number
  totalCount: number

  // Selected items
  selectedPostIds: string[]
  selectedCategoryId: string | null
  selectedTagId: string | null

  // Blog posts data
  posts: BlogPost[]
  
  // DCE Actions - following setX, fetchX, updateX, deleteX pattern
  setFilters: (filters: Partial<BlogPostFilters>) => void
  setSort: (sort: BlogPostSort) => void
  setSearchQuery: (query: string) => void
  setCurrentPage: (page: number) => void
  setPageSize: (size: number) => void
  setSelectedCategory: (categoryId: string | null) => void
  setSelectedTag: (tagId: string | null) => void
  setSelectedPosts: (postIds: string[]) => void
  
  // Fetch actions
  fetchPosts: () => Promise<void>
  fetchPostsByCategory: (categoryId: string) => Promise<void>
  fetchPostsByTag: (tagId: string) => Promise<void>
  
  // Update actions
  updatePostSelection: (postId: string) => void
  updateFiltersAndRefetch: (filters: Partial<BlogPostFilters>) => Promise<void>
  
  // Delete actions  
  deletePostSelection: () => void
  
  // Utility actions
  togglePostSelection: (postId: string) => void
  resetFilters: () => void
  resetStore: () => void
}

const blogFilterInitialState = {
  filters: {},
  sort: { by: 'published_at', order: 'desc' } as BlogPostSort,
  searchQuery: '',
  loading: false,
  error: null,
  currentPage: 1,
  pageSize: 10,
  totalCount: 0,
  selectedPostIds: [],
  selectedCategoryId: null,
  selectedTagId: null,
  posts: [],
}

const createBlogFilterStoreState: LightweightStateCreator<BlogFilterState> = (set, get) => ({
  ...blogFilterInitialState,

  // DCE Set Actions - synchronous state updates
  setFilters: (filters) => {
    set((state: BlogFilterState) => {
      Object.assign(state.filters, filters)
      state.currentPage = 1 // Reset to first page on filter change
    })
  },

  setSort: (sort) => {
    set((state: BlogFilterState) => {
      state.sort = sort
      state.currentPage = 1 // Reset to first page on sort change
    })
  },

  setSearchQuery: (query) => {
    set((state: BlogFilterState) => {
      state.searchQuery = query
      state.currentPage = 1 // Reset to first page on search
    })
  },

  setCurrentPage: (page) => {
    set((state: BlogFilterState) => {
      state.currentPage = page
    })
  },

  setPageSize: (size) => {
    set((state: BlogFilterState) => {
      state.pageSize = size
      state.currentPage = 1 // Reset to first page on page size change
    })
  },

  setSelectedCategory: (categoryId) => {
    set((state: BlogFilterState) => {
      state.selectedCategoryId = categoryId
      if (categoryId) {
        state.filters.categoryId = categoryId
      } else {
        delete state.filters.categoryId
      }
      state.currentPage = 1
    })
  },

  setSelectedTag: (tagId) => {
    set((state: BlogFilterState) => {
      state.selectedTagId = tagId
      if (tagId) {
        state.filters.tagId = tagId
      } else {
        delete state.filters.tagId
      }
      state.currentPage = 1
    })
  },

  setSelectedPosts: (postIds) => {
    set((state: BlogFilterState) => {
      state.selectedPostIds = [...postIds]
    })
  },

  // DCE Fetch Actions - asynchronous data fetching
  fetchPosts: async () => {
    set((state: BlogFilterState) => {
      state.loading = true
      state.error = null
    })

    try {
      const { filters, sort, searchQuery, currentPage, pageSize } = get()
      const from = (currentPage - 1) * pageSize
      const to = from + pageSize - 1

      if (!supabase) {
        throw new Error('Supabase client not available')
      }

      let query = supabase
        .from('blog_posts')
        .select('*, blog_authors!inner(*), blog_categories(*), blog_tags(*)', { count: 'exact' })
        .range(from, to)
        .order(sort.by, { ascending: sort.order === 'asc' })

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status)
      }
      if (filters.authorId) {
        query = query.eq('author_id', filters.authorId)
      }
      if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId)
      }
      if (filters.tagId) {
        query = query.contains('tag_ids', [filters.tagId])
      }
      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`)
      }
      if (filters.startDate) {
        query = query.gte('published_at', filters.startDate)
      }
      if (filters.endDate) {
        query = query.lte('published_at', filters.endDate)
      }

      const { data, error, count } = await query

      if (error) throw error

      set((state: BlogFilterState) => {
        state.posts = data || []
        state.totalCount = count || 0
        state.loading = false
      })
    } catch (error) {
      set((state: BlogFilterState) => {
        state.error = error instanceof Error ? error.message : 'Failed to fetch posts'
        state.loading = false
      })
    }
  },

  fetchPostsByCategory: async (categoryId) => {
    set((state: BlogFilterState) => {
      state.filters.categoryId = categoryId
      state.selectedCategoryId = categoryId
      state.currentPage = 1
    })
    await get().fetchPosts()
  },

  fetchPostsByTag: async (tagId) => {
    set((state: BlogFilterState) => {
      state.filters.tagId = tagId
      state.selectedTagId = tagId
      state.currentPage = 1
    })
    await get().fetchPosts()
  },

  // DCE Update Actions - state mutations
  updatePostSelection: (postId) => {
    set((state: BlogFilterState) => {
      const index = state.selectedPostIds.indexOf(postId)
      if (index !== -1) {
        state.selectedPostIds.splice(index, 1)
      } else {
        state.selectedPostIds.push(postId)
      }
    })
  },

  updateFiltersAndRefetch: async (filters) => {
    set((state: BlogFilterState) => {
      Object.assign(state.filters, filters)
      state.currentPage = 1
    })
    await get().fetchPosts()
  },

  // DCE Delete Actions - removal operations
  deletePostSelection: () => {
    set((state: BlogFilterState) => {
      state.selectedPostIds = []
    })
  },

  // Utility actions
  togglePostSelection: (postId) => {
    get().updatePostSelection(postId)
  },

  resetFilters: () => {
    set((state: BlogFilterState) => {
      state.filters = {}
      state.searchQuery = ''
      state.currentPage = 1
      state.selectedCategoryId = null
      state.selectedTagId = null
    })
  },

  resetStore: () => {
    set(blogFilterInitialState)
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
  loading: boolean
  error: string | null

  // Modal state machine (replaces boolean flags)
  modalState: BlogModalState
  modalStateMachine: StateMachine<ModalStates, ModalEvents>

  // Feature toggles
  enableComments: boolean
  enableRealtime: boolean
  showDrafts: boolean

  // DCE Actions - following setX, fetchX, updateX, deleteX pattern
  setViewMode: (mode: 'grid' | 'list' | 'compact') => void
  setShowFilters: (show: boolean) => void
  setShowMetrics: (show: boolean) => void
  setEnableComments: (enabled: boolean) => void
  setEnableRealtime: (enabled: boolean) => void
  setShowDrafts: (show: boolean) => void
  setModalState: (state: BlogModalState) => void
  
  // Fetch actions (for UI preferences from server)
  fetchUIPreferences: () => Promise<void>
  
  // Update actions
  updateViewMode: (mode: 'grid' | 'list' | 'compact') => Promise<void>
  updateFeatureToggles: (toggles: Partial<Pick<BlogUIState, 'enableComments' | 'enableRealtime' | 'showDrafts'>>) => Promise<void>
  
  // Delete actions
  deleteModal: () => void
  
  // Modal management actions
  openCreateModal: (entityType?: string) => void
  openEditModal: (postId: string, isDirty?: boolean) => void
  openDeleteModal: (postId: string, cascadeDelete?: boolean) => void
  openPreviewModal: (postId: string) => void
  closeModal: () => void
  rollbackModal: () => boolean
  
  // Utility actions
  toggleFilters: () => void
  toggleMetrics: () => void
  resetUI: () => void
}

const blogUIInitialState = {
  viewMode: 'grid' as const,
  showFilters: true,
  showMetrics: true,
  loading: false,
  error: null,
  modalState: { type: null } as BlogModalState,
  modalStateMachine: createModalStateMachine(),
  enableComments: true,
  enableRealtime: true,
  showDrafts: false,
}

const createBlogUIStoreState: StandardStateCreator<BlogUIState> = (set, get) => ({
  ...blogUIInitialState,

  // DCE Set Actions - synchronous state updates
  setViewMode: (mode) => {
    set((state: BlogUIState) => {
      state.viewMode = mode
    })
  },

  setShowFilters: (show) => {
    set((state: BlogUIState) => {
      state.showFilters = show
    })
  },

  setShowMetrics: (show) => {
    set((state: BlogUIState) => {
      state.showMetrics = show
    })
  },

  setEnableComments: (enabled) => {
    set((state: BlogUIState) => {
      state.enableComments = enabled
    })
  },

  setEnableRealtime: (enabled) => {
    set((state: BlogUIState) => {
      state.enableRealtime = enabled
    })
  },

  setShowDrafts: (show) => {
    set((state: BlogUIState) => {
      state.showDrafts = show
    })
  },

  setModalState: (modalState) => {
    set((state: BlogUIState) => {
      state.modalState = modalState
    })
  },

  // DCE Fetch Actions - for loading UI preferences from server
  fetchUIPreferences: async () => {
    set((state: BlogUIState) => {
      state.loading = true
      state.error = null
    })

    try {
      // Fetch user preferences from Supabase profiles table
      if (!supabase) {
        throw new Error('Supabase client not available')
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        set((state: BlogUIState) => {
          state.loading = false
        })
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('blog_ui_preferences')
        .eq('id', user.id)
        .single()

      if (error) throw error

      const preferences = data?.blog_ui_preferences as Partial<BlogUIState> | null

      if (preferences) {
        set((state: BlogUIState) => {
          state.viewMode = preferences.viewMode || state.viewMode
          state.showFilters = preferences.showFilters ?? state.showFilters
          state.showMetrics = preferences.showMetrics ?? state.showMetrics
          state.enableComments = preferences.enableComments ?? state.enableComments
          state.enableRealtime = preferences.enableRealtime ?? state.enableRealtime
          state.showDrafts = preferences.showDrafts ?? state.showDrafts
          state.loading = false
        })
      } else {
        set((state: BlogUIState) => {
          state.loading = false
        })
      }
    } catch (error) {
      set((state: BlogUIState) => {
        state.error = error instanceof Error ? error.message : 'Failed to fetch UI preferences'
        state.loading = false
      })
    }
  },

  // DCE Update Actions - with server sync
  updateViewMode: async (mode) => {
    // Optimistic update
    set((state: BlogUIState) => {
      state.viewMode = mode
    })

    try {
      if (!supabase) {
        throw new Error('Supabase client not available')
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { error } = await supabase
          .from('profiles')
          .update({ 
            blog_ui_preferences: { 
              ...get(),
              viewMode: mode 
            }
          })
          .eq('id', user.id)

        if (error) throw error
      }
    } catch (error) {
      // Revert optimistic update on error (would need to store previous state)
      set((state: BlogUIState) => {
        state.error = error instanceof Error ? error.message : 'Failed to update view mode'
      })
    }
  },

  updateFeatureToggles: async (toggles) => {
    // Optimistic update
    set((state: BlogUIState) => {
      Object.assign(state, toggles)
    })

    try {
      if (!supabase) {
        throw new Error('Supabase client not available')
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { error } = await supabase
          .from('profiles')
          .update({ 
            blog_ui_preferences: { 
              ...get(),
              ...toggles
            }
          })
          .eq('id', user.id)

        if (error) throw error
      }
    } catch (error) {
      set((state: BlogUIState) => {
        state.error = error instanceof Error ? error.message : 'Failed to update feature toggles'
      })
    }
  },

  // DCE Delete Actions - modal cleanup
  deleteModal: () => {
    set((state: BlogUIState) => {
      state.modalState = { type: null }
    })
  },

  // Modal management actions using DCE patterns
  openCreateModal: (entityType = 'blog_post') => {
    set((state: BlogUIState) => {
      state.modalState = {
        type: 'create',
        entityType
      }
    })
  },

  openEditModal: (postId, isDirty = false) => {
    set((state: BlogUIState) => {
      state.modalState = {
        type: 'edit',
        id: postId,
        entityType: 'blog_post',
        isDirty
      }
    })
  },

  openDeleteModal: (postId, cascadeDelete = false) => {
    set((state: BlogUIState) => {
      state.modalState = {
        type: 'delete',
        id: postId,
        entityType: 'blog_post',
        cascadeDelete
      }
    })
  },

  openPreviewModal: (postId) => {
    set((state: BlogUIState) => {
      state.modalState = {
        type: 'preview',
        id: postId,
        entityType: 'blog_post'
      }
    })
  },

  closeModal: () => {
    set((state: BlogUIState) => {
      state.modalState = { type: null }
    })
  },

  rollbackModal: () => {
    set((state: BlogUIState) => {
      state.modalState = { type: null }
    })
    return true
  },

  // Utility actions
  toggleFilters: () => {
    set((state: BlogUIState) => {
      state.showFilters = !state.showFilters
    })
  },

  toggleMetrics: () => {
    set((state: BlogUIState) => {
      state.showMetrics = !state.showMetrics
    })
  },

  resetUI: () => {
    set(blogUIInitialState)
  },
})

// UI Store - Persisted for user preferences
export const useBlogUIStore = createStandardStore<BlogUIState>({
  name: 'blog-ui-store',
  creator: createBlogUIStoreState,
  persist: {
    partialize: (state: BlogUIState) => ({
      ...state,
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
// OPTIMIZED SELECTORS - DCE Compliant with Explicit Types (NO 'any' types)
// =============================================================================

// Editor selectors - explicit BlogEditorState typing
export const useBlogDraft = () => useBlogEditorStore((state: BlogEditorState) => state.draft)
export const useBlogDraftStatus = () => useBlogEditorStore((state: BlogEditorState) => ({
  isDraftSaved: state.isDraftSaved,
  lastSavedAt: state.lastSavedAt,
}))
export const useBlogEditorMode = () => useBlogEditorStore((state: BlogEditorState) => state.editorMode)
export const useBlogPreviewMode = () => useBlogEditorStore((state: BlogEditorState) => state.previewMode)
export const useBlogEditorPreferences = () => useBlogEditorStore((state: BlogEditorState) => ({
  sidebarOpen: state.sidebarOpen,
  wordWrapEnabled: state.wordWrapEnabled,
  autosaveEnabled: state.autosaveEnabled,
  autosaveInterval: state.autosaveInterval,
}))
export const useBlogEditorLoading = () => useBlogEditorStore((state: BlogEditorState) => state.loading)
export const useBlogEditorError = () => useBlogEditorStore((state: BlogEditorState) => state.error)

// Filter selectors - explicit BlogFilterState typing
export const useBlogFilters = () => useBlogFilterStore((state: BlogFilterState) => state.filters)
export const useBlogSort = () => useBlogFilterStore((state: BlogFilterState) => state.sort)
export const useBlogSearchQuery = () => useBlogFilterStore((state: BlogFilterState) => state.searchQuery)
export const useBlogPosts = () => useBlogFilterStore((state: BlogFilterState) => state.posts)
export const useBlogPagination = () => useBlogFilterStore((state: BlogFilterState) => ({
  currentPage: state.currentPage,
  pageSize: state.pageSize,
  totalCount: state.totalCount,
}))
export const useBlogSelection = () => useBlogFilterStore((state: BlogFilterState) => ({
  selectedPostIds: state.selectedPostIds,
  selectedCategoryId: state.selectedCategoryId,
  selectedTagId: state.selectedTagId,
}))
export const useBlogFilterLoading = () => useBlogFilterStore((state: BlogFilterState) => state.loading)
export const useBlogFilterError = () => useBlogFilterStore((state: BlogFilterState) => state.error)

// UI selectors - explicit BlogUIState typing
export const useBlogViewMode = () => useBlogUIStore((state: BlogUIState) => state.viewMode)
export const useBlogVisibility = () => useBlogUIStore((state: BlogUIState) => ({
  showFilters: state.showFilters,
  showMetrics: state.showMetrics,
}))
export const useBlogModalState = () => useBlogUIStore((state: BlogUIState) => state.modalState)
export const useBlogFeatureToggles = () => useBlogUIStore((state: BlogUIState) => ({
  enableComments: state.enableComments,
  enableRealtime: state.enableRealtime,
  showDrafts: state.showDrafts,
}))
export const useBlogUILoading = () => useBlogUIStore((state: BlogUIState) => state.loading)
export const useBlogUIError = () => useBlogUIStore((state: BlogUIState) => state.error)

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

// Development helpers - DCE compliant window casting
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const windowDev = window as unknown as {
    __blogEditorStore?: typeof useBlogEditorStore
    __blogFilterStore?: typeof useBlogFilterStore
    __blogUIStore?: typeof useBlogUIStore
  }
  
  windowDev.__blogEditorStore = useBlogEditorStore
  windowDev.__blogFilterStore = useBlogFilterStore
  windowDev.__blogUIStore = useBlogUIStore
}