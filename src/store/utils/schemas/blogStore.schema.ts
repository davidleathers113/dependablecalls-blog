/**
 * Blog Store Schema Definitions - Phase 3.1b
 * Versioned schemas for blog store persistence (editor, filter, ui stores)
 */

import { z } from 'zod'
import { registerSchema } from './index'

// Blog post filters schema
const BlogPostFiltersSchema = z.record(z.unknown())

// Blog post sort schema
const BlogPostSortSchema = z.object({
  by: z.string(),
  order: z.enum(['asc', 'desc']),
})

// Create blog post data schema
const CreateBlogPostDataSchema = z.object({
  title: z.string(),
  content: z.string(),
  excerpt: z.string().optional(),
  slug: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  featured_image: z.string().optional(),
  tags: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  meta_description: z.string().optional(),
  scheduled_at: z.string().optional(),
})

// Modal state schema
const ModalStateSchema = z.object({
  type: z.enum(['create', 'edit', 'delete', 'bulk_delete', 'bulk_edit', 'bulk_publish', 'bulk_archive', 'bulk_tag', 'import', 'export', 'preview', 'share']).nullable(),
  id: z.string().optional(),
  entityType: z.string().optional(),
  isDirty: z.boolean().optional(),
  cascadeDelete: z.boolean().optional(),
  selectedIds: z.array(z.string()).optional(),
  bulkAction: z.string().optional(),
  bulkOptions: z.record(z.unknown()).optional(),
  previousState: z.unknown().optional(),
})

// State machine schema (simplified for persistence)
const StateMachineSchema = z.object({
  currentState: z.string(),
  states: z.record(z.unknown()),
  transitions: z.record(z.unknown()),
  history: z.array(z.unknown()).optional(),
})

// ====================
// BLOG EDITOR STORE
// ====================

const BlogEditorStateSchema = z.object({
  // Draft post data
  draft: CreateBlogPostDataSchema.nullable(),
  isDraftSaved: z.boolean(),
  lastSavedAt: z.string().nullable(),

  // Editor preferences
  editorMode: z.enum(['markdown', 'wysiwyg']),
  previewMode: z.enum(['desktop', 'mobile', 'split']),
  sidebarOpen: z.boolean(),
  wordWrapEnabled: z.boolean(),
  autosaveEnabled: z.boolean(),
  autosaveInterval: z.number(),
})

// Persisted blog editor data
const BlogEditorPersistedSchema = z.object({
  draft: CreateBlogPostDataSchema.nullable(),
  editorMode: z.enum(['markdown', 'wysiwyg']),
  previewMode: z.enum(['desktop', 'mobile', 'split']),
  wordWrapEnabled: z.boolean(),
  autosaveEnabled: z.boolean(),
  autosaveInterval: z.number(),
})

// Register blog editor schema
registerSchema(
  'blog-editor-store',
  1,
  BlogEditorPersistedSchema,
  {
    createdAt: new Date().toISOString(),
    description: 'Blog editor store schema - persists drafts and editor preferences',
    isBreaking: false,
  },
  ['draft', 'editorMode', 'previewMode', 'wordWrapEnabled', 'autosaveEnabled', 'autosaveInterval']
)

// ====================
// BLOG FILTER STORE  
// ====================

const BlogFilterStateSchema = z.object({
  // Current filters
  filters: BlogPostFiltersSchema,
  sort: BlogPostSortSchema,
  searchQuery: z.string(),

  // Pagination
  currentPage: z.number(),
  pageSize: z.number(),

  // Selected items
  selectedPostIds: z.array(z.string()),
  selectedCategoryId: z.string().nullable(),
  selectedTagId: z.string().nullable(),
})

// Blog filter store has NO PERSISTENCE (session-only)
const BlogFilterPersistedSchema = z.object({
  // No fields persisted - filter state is session-only
})

// Register blog filter schema (no persistence)
registerSchema(
  'blog-filter-store',
  1,
  BlogFilterPersistedSchema,
  {
    createdAt: new Date().toISOString(),
    description: 'Blog filter store schema - NO PERSISTENCE (session-only filters)',
    isBreaking: false,
  },
  [] // No fields are persisted
)

// ====================
// BLOG UI STORE
// ====================

const BlogUIStateSchema = z.object({
  // Layout preferences
  viewMode: z.enum(['grid', 'list', 'compact']),
  showFilters: z.boolean(),
  showMetrics: z.boolean(),

  // Modal state machine (complex - simplified for persistence)
  modalState: ModalStateSchema,
  modalStateMachine: StateMachineSchema,

  // Feature toggles
  enableComments: z.boolean(),
  enableRealtime: z.boolean(),
  showDrafts: z.boolean(),
})

// Persisted blog UI data (preferences only, not modal state)
const BlogUIPersistedSchema = z.object({
  viewMode: z.enum(['grid', 'list', 'compact']),
  showFilters: z.boolean(),
  showMetrics: z.boolean(),
  enableComments: z.boolean(),
  enableRealtime: z.boolean(),
  showDrafts: z.boolean(),
})

// Register blog UI schema
registerSchema(
  'blog-ui-store',
  1,
  BlogUIPersistedSchema,
  {
    createdAt: new Date().toISOString(),
    description: 'Blog UI store schema - persists user preferences (not modal state)',
    isBreaking: false,
  },
  ['viewMode', 'showFilters', 'showMetrics', 'enableComments', 'enableRealtime', 'showDrafts']
)

// Export schemas
export {
  BlogPostFiltersSchema,
  BlogPostSortSchema,
  CreateBlogPostDataSchema,
  ModalStateSchema,
  StateMachineSchema,
  BlogEditorStateSchema,
  BlogEditorPersistedSchema,
  BlogFilterStateSchema,
  BlogFilterPersistedSchema,
  BlogUIStateSchema,
  BlogUIPersistedSchema,
}

// Export types
export type BlogPostFilters = z.infer<typeof BlogPostFiltersSchema>
export type BlogPostSort = z.infer<typeof BlogPostSortSchema>
export type CreateBlogPostData = z.infer<typeof CreateBlogPostDataSchema>
export type ModalState = z.infer<typeof ModalStateSchema>
export type StateMachine = z.infer<typeof StateMachineSchema>
export type BlogEditorState = z.infer<typeof BlogEditorStateSchema>
export type BlogEditorPersisted = z.infer<typeof BlogEditorPersistedSchema>
export type BlogFilterState = z.infer<typeof BlogFilterStateSchema>
export type BlogFilterPersisted = z.infer<typeof BlogFilterPersistedSchema>
export type BlogUIState = z.infer<typeof BlogUIStateSchema>
export type BlogUIPersisted = z.infer<typeof BlogUIPersistedSchema>