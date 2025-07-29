import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import type { BlogPostFilters, BlogPostSort, CreateBlogPostData } from '../types/blog'

interface BlogEditorState {
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

interface BlogFilterState {
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

interface BlogUIState {
  // Layout preferences
  viewMode: 'grid' | 'list' | 'compact'
  showFilters: boolean
  showMetrics: boolean

  // Modal states
  isCreateModalOpen: boolean
  isEditModalOpen: boolean
  editingPostId: string | null
  isDeleteModalOpen: boolean
  deletingPostId: string | null

  // Feature toggles
  enableComments: boolean
  enableRealtime: boolean
  showDrafts: boolean

  // Actions
  setViewMode: (mode: 'grid' | 'list' | 'compact') => void
  toggleFilters: () => void
  toggleMetrics: () => void
  openCreateModal: () => void
  closeCreateModal: () => void
  openEditModal: (postId: string) => void
  closeEditModal: () => void
  openDeleteModal: (postId: string) => void
  closeDeleteModal: () => void
  setEnableComments: (enabled: boolean) => void
  setEnableRealtime: (enabled: boolean) => void
  setShowDrafts: (show: boolean) => void
}

// Editor Store - Persisted for draft recovery
export const useBlogEditorStore = create<BlogEditorState>()(
  persist(
    subscribeWithSelector((set) => ({
      // Initial state
      draft: null,
      isDraftSaved: true,
      lastSavedAt: null,
      editorMode: 'markdown',
      previewMode: 'split',
      sidebarOpen: true,
      wordWrapEnabled: true,
      autosaveEnabled: true,
      autosaveInterval: 30,

      // Actions
      setDraft: (draft) =>
        set({
          draft,
          isDraftSaved: false,
        }),

      updateDraft: (updates) =>
        set((state) => ({
          draft: state.draft ? { ...state.draft, ...updates } : updates,
          isDraftSaved: false,
        })),

      clearDraft: () =>
        set({
          draft: null,
          isDraftSaved: true,
          lastSavedAt: null,
        }),

      markDraftSaved: () =>
        set({
          isDraftSaved: true,
          lastSavedAt: new Date(),
        }),

      setEditorMode: (mode) => set({ editorMode: mode }),

      setPreviewMode: (mode) => set({ previewMode: mode }),

      toggleSidebar: () =>
        set((state) => ({
          sidebarOpen: !state.sidebarOpen,
        })),

      setWordWrap: (enabled) => set({ wordWrapEnabled: enabled }),

      setAutosave: (enabled, interval) =>
        set({
          autosaveEnabled: enabled,
          ...(interval && { autosaveInterval: interval }),
        }),
    })),
    {
      name: 'blog-editor-storage',
      partialize: (state) => ({
        draft: state.draft,
        editorMode: state.editorMode,
        previewMode: state.previewMode,
        wordWrapEnabled: state.wordWrapEnabled,
        autosaveEnabled: state.autosaveEnabled,
        autosaveInterval: state.autosaveInterval,
      }),
    }
  )
)

// Filter Store - Session only
export const useBlogFilterStore = create<BlogFilterState>((set) => ({
  // Initial state
  filters: {},
  sort: { by: 'published_at', order: 'desc' },
  searchQuery: '',
  currentPage: 1,
  pageSize: 10,
  selectedPostIds: [],
  selectedCategoryId: null,
  selectedTagId: null,

  // Actions
  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
      currentPage: 1, // Reset to first page on filter change
    })),

  resetFilters: () =>
    set({
      filters: {},
      searchQuery: '',
      currentPage: 1,
      selectedCategoryId: null,
      selectedTagId: null,
    }),

  setSort: (sort) =>
    set({
      sort,
      currentPage: 1, // Reset to first page on sort change
    }),

  setSearchQuery: (query) =>
    set({
      searchQuery: query,
      currentPage: 1, // Reset to first page on search
    }),

  setCurrentPage: (page) => set({ currentPage: page }),

  setPageSize: (size) =>
    set({
      pageSize: size,
      currentPage: 1, // Reset to first page on page size change
    }),

  togglePostSelection: (postId) =>
    set((state) => ({
      selectedPostIds: state.selectedPostIds.includes(postId)
        ? state.selectedPostIds.filter((id) => id !== postId)
        : [...state.selectedPostIds, postId],
    })),

  selectAllPosts: (postIds) => set({ selectedPostIds: postIds }),

  clearPostSelection: () => set({ selectedPostIds: [] }),

  setSelectedCategory: (categoryId) =>
    set({
      selectedCategoryId: categoryId,
      filters: categoryId ? { categoryId } : {},
    }),

  setSelectedTag: (tagId) =>
    set({
      selectedTagId: tagId,
      filters: tagId ? { tagId } : {},
    }),
}))

// UI Store - Persisted for user preferences
export const useBlogUIStore = create<BlogUIState>()(
  persist(
    (set) => ({
      // Initial state
      viewMode: 'grid',
      showFilters: true,
      showMetrics: true,
      isCreateModalOpen: false,
      isEditModalOpen: false,
      editingPostId: null,
      isDeleteModalOpen: false,
      deletingPostId: null,
      enableComments: true,
      enableRealtime: true,
      showDrafts: false,

      // Actions
      setViewMode: (mode) => set({ viewMode: mode }),

      toggleFilters: () =>
        set((state) => ({
          showFilters: !state.showFilters,
        })),

      toggleMetrics: () =>
        set((state) => ({
          showMetrics: !state.showMetrics,
        })),

      openCreateModal: () => set({ isCreateModalOpen: true }),

      closeCreateModal: () => set({ isCreateModalOpen: false }),

      openEditModal: (postId) =>
        set({
          isEditModalOpen: true,
          editingPostId: postId,
        }),

      closeEditModal: () =>
        set({
          isEditModalOpen: false,
          editingPostId: null,
        }),

      openDeleteModal: (postId) =>
        set({
          isDeleteModalOpen: true,
          deletingPostId: postId,
        }),

      closeDeleteModal: () =>
        set({
          isDeleteModalOpen: false,
          deletingPostId: null,
        }),

      setEnableComments: (enabled) => set({ enableComments: enabled }),

      setEnableRealtime: (enabled) => set({ enableRealtime: enabled }),

      setShowDrafts: (show) => set({ showDrafts: show }),
    }),
    {
      name: 'blog-ui-storage',
      partialize: (state) => ({
        viewMode: state.viewMode,
        showFilters: state.showFilters,
        showMetrics: state.showMetrics,
        enableComments: state.enableComments,
        enableRealtime: state.enableRealtime,
        showDrafts: state.showDrafts,
      }),
    }
  )
)

// Combined hook for convenience
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

// Selectors
export const blogSelectors = {
  // Editor selectors
  hasDraft: (state: BlogEditorState) => state.draft !== null,
  isDraftValid: (state: BlogEditorState) => {
    const draft = state.draft
    return draft?.title && draft?.content && draft?.title.length > 0
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

  // UI selectors
  hasOpenModals: (state: BlogUIState) => {
    return state.isCreateModalOpen || state.isEditModalOpen || state.isDeleteModalOpen
  },
}
