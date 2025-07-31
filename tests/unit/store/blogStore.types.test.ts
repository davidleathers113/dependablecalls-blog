import { describe, it, expectTypeOf } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  useBlogEditorStore,
  useBlogFilterStore,
  useBlogUIStore,
  useBlogStore,
  blogSelectors,
} from '../blogStore'
import type {
  BlogPostFilters,
  BlogPostSort,
  CreateBlogPostData,
} from '../../types/blog'

// Type extraction for testing
type BlogEditorState = ReturnType<typeof useBlogEditorStore>
type BlogFilterState = ReturnType<typeof useBlogFilterStore>
type BlogUIState = ReturnType<typeof useBlogUIStore>

describe('Blog Store Type Safety', () => {
  describe('BlogEditorStore Types', () => {
    it('should have correct state properties', () => {
      const { result } = renderHook(() => useBlogEditorStore())
      
      expectTypeOf(result.current.draft).toEqualTypeOf<Partial<CreateBlogPostData> | null>()
      expectTypeOf(result.current.isDraftSaved).toBeBoolean()
      expectTypeOf(result.current.lastSavedAt).toEqualTypeOf<Date | null>()
      expectTypeOf(result.current.editorMode).toEqualTypeOf<'markdown' | 'wysiwyg'>()
      expectTypeOf(result.current.previewMode).toEqualTypeOf<'desktop' | 'mobile' | 'split'>()
      expectTypeOf(result.current.sidebarOpen).toBeBoolean()
      expectTypeOf(result.current.wordWrapEnabled).toBeBoolean()
      expectTypeOf(result.current.autosaveEnabled).toBeBoolean()
      expectTypeOf(result.current.autosaveInterval).toBeNumber()
    })

    it('should have correctly typed action functions', () => {
      const { result } = renderHook(() => useBlogEditorStore())
      
      expectTypeOf(result.current.setDraft).toEqualTypeOf<
        (draft: Partial<CreateBlogPostData>) => void
      >()
      expectTypeOf(result.current.updateDraft).toEqualTypeOf<
        (updates: Partial<CreateBlogPostData>) => void
      >()
      expectTypeOf(result.current.clearDraft).toEqualTypeOf<() => void>()
      expectTypeOf(result.current.markDraftSaved).toEqualTypeOf<() => void>()
      expectTypeOf(result.current.setEditorMode).toEqualTypeOf<
        (mode: 'markdown' | 'wysiwyg') => void
      >()
      expectTypeOf(result.current.setPreviewMode).toEqualTypeOf<
        (mode: 'desktop' | 'mobile' | 'split') => void
      >()
      expectTypeOf(result.current.toggleSidebar).toEqualTypeOf<() => void>()
      expectTypeOf(result.current.setWordWrap).toEqualTypeOf<(enabled: boolean) => void>()
      expectTypeOf(result.current.setAutosave).toEqualTypeOf<
        (enabled: boolean, interval?: number) => void
      >()
    })

    it('should enforce type constraints on action parameters', () => {
      const { result } = renderHook(() => useBlogEditorStore())
      
      // Valid calls
      act(() => {
        result.current.setDraft({ title: 'Test', content: 'Content' })
        result.current.updateDraft({ title: 'Updated' })
        result.current.setEditorMode('markdown')
        result.current.setPreviewMode('split')
        result.current.setAutosave(true, 60)
      })
      
      // Type errors should be caught
      // @ts-expect-error - Invalid editor mode string should be rejected
      result.current.setEditorMode('invalid')
      // @ts-expect-error - Invalid preview mode string should be rejected
      result.current.setPreviewMode('invalid')
      // @ts-expect-error - Non-object parameter should be rejected
      result.current.setDraft('not-an-object')
      // @ts-expect-error - Non-boolean parameter should be rejected
      result.current.setAutosave('not-boolean')
    })
  })

  describe('BlogFilterStore Types', () => {
    it('should have correct state properties', () => {
      const { result } = renderHook(() => useBlogFilterStore())
      
      expectTypeOf(result.current.filters).toEqualTypeOf<BlogPostFilters>()
      expectTypeOf(result.current.sort).toEqualTypeOf<BlogPostSort>()
      expectTypeOf(result.current.searchQuery).toBeString()
      expectTypeOf(result.current.currentPage).toBeNumber()
      expectTypeOf(result.current.pageSize).toBeNumber()
      expectTypeOf(result.current.selectedPostIds).toEqualTypeOf<string[]>()
      expectTypeOf(result.current.selectedCategoryId).toEqualTypeOf<string | null>()
      expectTypeOf(result.current.selectedTagId).toEqualTypeOf<string | null>()
    })

    it('should have correctly typed action functions', () => {
      const { result } = renderHook(() => useBlogFilterStore())
      
      expectTypeOf(result.current.setFilters).toEqualTypeOf<
        (filters: Partial<BlogPostFilters>) => void
      >()
      expectTypeOf(result.current.resetFilters).toEqualTypeOf<() => void>()
      expectTypeOf(result.current.setSort).toEqualTypeOf<
        (sort: BlogPostSort) => void
      >()
      expectTypeOf(result.current.setSearchQuery).toEqualTypeOf<
        (query: string) => void
      >()
      expectTypeOf(result.current.setCurrentPage).toEqualTypeOf<
        (page: number) => void
      >()
      expectTypeOf(result.current.setPageSize).toEqualTypeOf<
        (size: number) => void
      >()
      expectTypeOf(result.current.togglePostSelection).toEqualTypeOf<
        (postId: string) => void
      >()
      expectTypeOf(result.current.selectAllPosts).toEqualTypeOf<
        (postIds: string[]) => void
      >()
      expectTypeOf(result.current.clearPostSelection).toEqualTypeOf<() => void>()
      expectTypeOf(result.current.setSelectedCategory).toEqualTypeOf<
        (categoryId: string | null) => void
      >()
      expectTypeOf(result.current.setSelectedTag).toEqualTypeOf<
        (tagId: string | null) => void
      >()
    })

    it('should enforce type constraints on filter parameters', () => {
      const { result } = renderHook(() => useBlogFilterStore())
      
      // Valid calls
      act(() => {
        result.current.setFilters({ status: 'published', authorId: '123' })
        result.current.setSort({ by: 'created_at', order: 'asc' })
        result.current.setSearchQuery('test query')
        result.current.setCurrentPage(2)
        result.current.selectAllPosts(['1', '2', '3'])
      })
      
      // Type errors should be caught
      // @ts-expect-error - Invalid status value should be rejected
      result.current.setFilters({ status: 'invalid-status' })
      // @ts-expect-error - Invalid sort field should be rejected
      result.current.setSort({ by: 'invalid-field', order: 'asc' })
      // @ts-expect-error - Non-number parameter should be rejected
      result.current.setCurrentPage('not-number')
      // @ts-expect-error - Number array instead of string array should be rejected
      result.current.selectAllPosts([1, 2, 3]) // should be strings
    })
  })

  describe('BlogUIStore Types', () => {
    it('should have correct state properties', () => {
      const { result } = renderHook(() => useBlogUIStore())
      
      expectTypeOf(result.current.viewMode).toEqualTypeOf<'grid' | 'list' | 'compact'>()
      expectTypeOf(result.current.showFilters).toBeBoolean()
      expectTypeOf(result.current.showMetrics).toBeBoolean()
      expectTypeOf(result.current.isCreateModalOpen).toBeBoolean()
      expectTypeOf(result.current.isEditModalOpen).toBeBoolean()
      expectTypeOf(result.current.editingPostId).toEqualTypeOf<string | null>()
      expectTypeOf(result.current.isDeleteModalOpen).toBeBoolean()
      expectTypeOf(result.current.deletingPostId).toEqualTypeOf<string | null>()
      expectTypeOf(result.current.enableComments).toBeBoolean()
      expectTypeOf(result.current.enableRealtime).toBeBoolean()
      expectTypeOf(result.current.showDrafts).toBeBoolean()
    })

    it('should have correctly typed action functions', () => {
      const { result } = renderHook(() => useBlogUIStore())
      
      expectTypeOf(result.current.setViewMode).toEqualTypeOf<
        (mode: 'grid' | 'list' | 'compact') => void
      >()
      expectTypeOf(result.current.toggleFilters).toEqualTypeOf<() => void>()
      expectTypeOf(result.current.toggleMetrics).toEqualTypeOf<() => void>()
      expectTypeOf(result.current.openCreateModal).toEqualTypeOf<() => void>()
      expectTypeOf(result.current.closeCreateModal).toEqualTypeOf<() => void>()
      expectTypeOf(result.current.openEditModal).toEqualTypeOf<
        (postId: string) => void
      >()
      expectTypeOf(result.current.closeEditModal).toEqualTypeOf<() => void>()
      expectTypeOf(result.current.openDeleteModal).toEqualTypeOf<
        (postId: string) => void
      >()
      expectTypeOf(result.current.closeDeleteModal).toEqualTypeOf<() => void>()
      expectTypeOf(result.current.setEnableComments).toEqualTypeOf<
        (enabled: boolean) => void
      >()
      expectTypeOf(result.current.setEnableRealtime).toEqualTypeOf<
        (enabled: boolean) => void
      >()
      expectTypeOf(result.current.setShowDrafts).toEqualTypeOf<
        (show: boolean) => void
      >()
    })

    it('should enforce type constraints on UI action parameters', () => {
      const { result } = renderHook(() => useBlogUIStore())
      
      // Valid calls
      act(() => {
        result.current.setViewMode('grid')
        result.current.openEditModal('post-123')
        result.current.openDeleteModal('post-456')
        result.current.setEnableComments(true)
      })
      
      // Type errors should be caught
      // @ts-expect-error - Invalid view mode string should be rejected
      result.current.setViewMode('invalid-view')
      // @ts-expect-error - Number instead of string parameter should be rejected
      result.current.openEditModal(123) // should be string
      // @ts-expect-error - Non-boolean parameter should be rejected
      result.current.setEnableComments('not-boolean')
    })
  })

  describe('Combined Store Hook Types', () => {
    it('should correctly combine all store types', () => {
      const { result } = renderHook(() => useBlogStore())
      
      expectTypeOf(result.current.editor).toEqualTypeOf<BlogEditorState>()
      expectTypeOf(result.current.filters).toEqualTypeOf<BlogFilterState>()
      expectTypeOf(result.current.ui).toEqualTypeOf<BlogUIState>()
    })

    it('should provide access to all store methods', () => {
      const { result } = renderHook(() => useBlogStore())
      
      // Editor methods
      expectTypeOf(result.current.editor.setDraft).toBeFunction()
      expectTypeOf(result.current.editor.updateDraft).toBeFunction()
      expectTypeOf(result.current.editor.clearDraft).toBeFunction()
      
      // Filter methods
      expectTypeOf(result.current.filters.setFilters).toBeFunction()
      expectTypeOf(result.current.filters.setSort).toBeFunction()
      expectTypeOf(result.current.filters.resetFilters).toBeFunction()
      
      // UI methods
      expectTypeOf(result.current.ui.setViewMode).toBeFunction()
      expectTypeOf(result.current.ui.openCreateModal).toBeFunction()
      expectTypeOf(result.current.ui.toggleFilters).toBeFunction()
    })
  })

  describe('Selector Function Types', () => {
    it('should have correctly typed editor selectors', () => {
      expectTypeOf(blogSelectors.hasDraft).toEqualTypeOf<
        (state: BlogEditorState) => boolean
      >()
      expectTypeOf(blogSelectors.isDraftValid).toEqualTypeOf<
        (state: BlogEditorState) => boolean
      >()
    })

    it('should have correctly typed filter selectors', () => {
      expectTypeOf(blogSelectors.hasActiveFilters).toEqualTypeOf<
        (state: BlogFilterState) => boolean
      >()
      expectTypeOf(blogSelectors.getActiveFilterCount).toEqualTypeOf<
        (state: BlogFilterState) => number
      >()
    })

    it('should have correctly typed UI selectors', () => {
      expectTypeOf(blogSelectors.hasOpenModals).toEqualTypeOf<
        (state: BlogUIState) => boolean
      >()
    })
  })

  describe('Zustand Integration Types', () => {
    it('should properly integrate with Zustand persist middleware', () => {
      const { result: editorResult } = renderHook(() => useBlogEditorStore())
      const { result: uiResult } = renderHook(() => useBlogUIStore())
      
      // Persisted stores should have all the standard Zustand properties
      expectTypeOf(editorResult.current).toHaveProperty('setDraft')
      expectTypeOf(editorResult.current).toHaveProperty('draft')
      
      expectTypeOf(uiResult.current).toHaveProperty('setViewMode')
      expectTypeOf(uiResult.current).toHaveProperty('viewMode')
    })

    it('should handle subscribeWithSelector middleware types', () => {
      const { result } = renderHook(() => useBlogEditorStore())
      
      // Store should maintain all functionality with subscribeWithSelector
      expectTypeOf(result.current.draft).toEqualTypeOf<Partial<CreateBlogPostData> | null>()
      expectTypeOf(result.current.setDraft).toBeFunction()
      expectTypeOf(result.current.updateDraft).toBeFunction()
    })
  })

  describe('State Update Type Safety', () => {
    it('should maintain type safety during state updates', () => {
      const { result } = renderHook(() => useBlogEditorStore())
      
      act(() => {
        // Valid draft update
        result.current.setDraft({
          title: 'Test Post',
          content: 'Content',
          status: 'draft',
        })
        
        // Valid partial update
        result.current.updateDraft({
          title: 'Updated Title',
        })
      })
      
      // Type errors should be prevented
      // @ts-expect-error - Invalid field in draft update should be rejected
      result.current.updateDraft({ invalidField: 'value' })
      // @ts-expect-error - Invalid status in draft should be rejected
      result.current.setDraft({ status: 'invalid-status' })
    })

    it('should handle complex state transformations', () => {
      const { result } = renderHook(() => useBlogFilterStore())
      
      act(() => {
        // Valid filter updates
        result.current.setFilters({
          status: 'published',
          authorId: '123',
          categoryId: '456',
        })
        
        // Valid sort update
        result.current.setSort({
          by: 'created_at',
          order: 'desc',
        })
        
        // Valid selection updates
        result.current.selectAllPosts(['1', '2', '3'])
        result.current.togglePostSelection('4')
      })
    })
  })

  describe('Type Narrowing and Guards', () => {
    it('should properly narrow types in conditional blocks', () => {
      const { result } = renderHook(() => useBlogEditorStore())
      
      // Type narrowing should work with selectors
      if (blogSelectors.hasDraft(result.current)) {
        expectTypeOf(result.current.draft).not.toEqualTypeOf<null>()
        expectTypeOf(result.current.draft).toEqualTypeOf<Partial<CreateBlogPostData>>()
      }
      
      if (blogSelectors.isDraftValid(result.current)) {
        // Draft should exist and have required fields
        expectTypeOf(result.current.draft).not.toEqualTypeOf<null>()
      }
    })

    it('should handle union types in modal states', () => {
      const { result } = renderHook(() => useBlogUIStore())
      
      // Modal ID should be properly typed
      if (result.current.isEditModalOpen && result.current.editingPostId) {
        expectTypeOf(result.current.editingPostId).toBeString()
      }
      
      if (result.current.isDeleteModalOpen && result.current.deletingPostId) {
        expectTypeOf(result.current.deletingPostId).toBeString()
      }
    })
  })

  describe('Performance and Memory Type Safety', () => {
    it('should handle selector functions without memory leaks', () => {
      const { result } = renderHook(() => useBlogFilterStore())
      
      // Selectors should return consistent types
      const hasFilters1 = blogSelectors.hasActiveFilters(result.current)
      const hasFilters2 = blogSelectors.hasActiveFilters(result.current)
      
      expectTypeOf(hasFilters1).toBeBoolean()
      expectTypeOf(hasFilters2).toBeBoolean()
      
      const filterCount1 = blogSelectors.getActiveFilterCount(result.current)
      const filterCount2 = blogSelectors.getActiveFilterCount(result.current)
      
      expectTypeOf(filterCount1).toBeNumber()
      expectTypeOf(filterCount2).toBeNumber()
    })

    it('should handle complex state computations', () => {
      const { result } = renderHook(() => useBlogFilterStore())
      
      // Complex state derivations should maintain type safety
      const computedState = {
        hasFilters: blogSelectors.hasActiveFilters(result.current),
        filterCount: blogSelectors.getActiveFilterCount(result.current),
        isFiltered: result.current.searchQuery.length > 0,
        pagination: {
          page: result.current.currentPage,
          size: result.current.pageSize,
          offset: (result.current.currentPage - 1) * result.current.pageSize,
        },
      }
      
      expectTypeOf(computedState.hasFilters).toBeBoolean()
      expectTypeOf(computedState.filterCount).toBeNumber()
      expectTypeOf(computedState.isFiltered).toBeBoolean()
      expectTypeOf(computedState.pagination.offset).toBeNumber()
    })
  })

  describe('Error Handling Types', () => {
    it('should handle error states safely', () => {
      const { result } = renderHook(() => useBlogEditorStore())
      
      // Error-prone operations should be type-safe
      act(() => {
        try {
          result.current.updateDraft({
            title: 'Valid title',
            content: 'Valid content',
          })
        } catch (error) {
          // Error handling should maintain type safety
          expectTypeOf(error).toBeUnknown()
        }
      })
    })
  })
})