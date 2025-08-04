/**
 * Blog Store Migrations - Phase 3.1b
 * Handles migrations for all blog-related stores:
 * - blog-editor-store (drafts + preferences)
 * - blog-filter-store (NO persistence - session only)
 * - blog-ui-store (UI preferences)
 */

import { z } from 'zod'
import { registerMigration, type Migration } from './index'
import { 
  CreateBlogPostDataSchema
} from '../schemas/blogStore.schema'

// ======================
// BLOG EDITOR STORE MIGRATIONS
// ======================

// V1 Schema (initial - basic editor with drafts)
const BlogEditorPersistedV1Schema = z.object({
  draft: CreateBlogPostDataSchema.nullable(),
  editorMode: z.enum(['markdown', 'wysiwyg']),
  previewMode: z.enum(['desktop', 'mobile', 'split']),
  wordWrapEnabled: z.boolean(),
  autosaveEnabled: z.boolean(),
  autosaveInterval: z.number(),
})

// V2 Schema (adds collaborative editing and version history)
const BlogEditorPersistedV2Schema = z.object({
  draft: CreateBlogPostDataSchema.nullable(),
  editorMode: z.enum(['markdown', 'wysiwyg']),
  previewMode: z.enum(['desktop', 'mobile', 'split']),
  wordWrapEnabled: z.boolean(),
  autosaveEnabled: z.boolean(),
  autosaveInterval: z.number(),
  
  // NEW: Editor enhancements
  editorTheme: z.enum(['default', 'dark', 'high-contrast']).default('default'),
  showLineNumbers: z.boolean().default(true),
  enableVimMode: z.boolean().default(false),
  
  // NEW: Version history for drafts
  draftHistory: z.array(z.object({
    id: z.string(),
    content: z.string(),
    timestamp: z.string(),
    autoSaved: z.boolean(),
  })).default([]),
  
  // NEW: Collaborative features (for future multi-user editing)
  collaboration: z.object({
    enabled: z.boolean().default(false),
    showCursors: z.boolean().default(true),
    showComments: z.boolean().default(true),
    autoSync: z.boolean().default(true),
  }).default({
    enabled: false,
    showCursors: true,
    showComments: true,
    autoSync: true,
  }),
})

type BlogEditorPersistedV1 = z.infer<typeof BlogEditorPersistedV1Schema>
type BlogEditorPersistedV2 = z.infer<typeof BlogEditorPersistedV2Schema>

// Migration from V1 to V2: Add editor enhancements
const blogEditorV1ToV2Migration: Migration<BlogEditorPersistedV1, BlogEditorPersistedV2> = {
  version: 1,
  targetVersion: 2,
  storeName: 'blog-editor-store',
  description: 'Add editor theme, line numbers, vim mode, draft history, and collaboration features',
  createdAt: new Date().toISOString(),
  isBreaking: false,
  
  // Forward migration: V1 -> V2
  up: (state: BlogEditorPersistedV1): BlogEditorPersistedV2 => {
    return {
      ...state,
      editorTheme: 'default' as const,
      showLineNumbers: true,
      enableVimMode: false,
      draftHistory: state.draft ? [{
        id: `migration-${Date.now()}`,
        content: state.draft.content,
        timestamp: new Date().toISOString(),
        autoSaved: false,
      }] : [],
      collaboration: {
        enabled: false,
        showCursors: true,
        showComments: true,
        autoSync: true,
      },
    }
  },
  
  // Rollback migration: V2 -> V1
  down: (state: BlogEditorPersistedV2): BlogEditorPersistedV1 => {
     
    const { editorTheme: _editorTheme, showLineNumbers: _showLineNumbers, enableVimMode: _enableVimMode, draftHistory: _draftHistory, collaboration: _collaboration, ...rest } = state
    return rest
  },
  
  // Validation schemas
  fromSchema: BlogEditorPersistedV1Schema,
  toSchema: BlogEditorPersistedV2Schema as z.ZodType<BlogEditorPersistedV2>,
}

// ======================
// BLOG FILTER STORE MIGRATIONS (NO-OP - Session Only)
// ======================

// All versions have empty persistence schema
const BlogFilterPersistedV1Schema = z.object({})
const BlogFilterPersistedV2Schema = z.object({})

type BlogFilterPersistedV1 = z.infer<typeof BlogFilterPersistedV1Schema>
type BlogFilterPersistedV2 = z.infer<typeof BlogFilterPersistedV2Schema>

// No-op migration for filter store (session-only)
const blogFilterV1ToV2Migration: Migration<BlogFilterPersistedV1, BlogFilterPersistedV2> = {
  version: 1,
  targetVersion: 2,
  storeName: 'blog-filter-store',
  description: 'No-op migration - Blog filter store has no persistence',
  createdAt: new Date().toISOString(),
  isBreaking: false,
  
  // Forward migration: V1 -> V2 (no-op)
   
  up: (_state: BlogFilterPersistedV1): BlogFilterPersistedV2 => {
    return {}
  },
  
  // Rollback migration: V2 -> V1 (no-op)
   
  down: (_state: BlogFilterPersistedV2): BlogFilterPersistedV1 => {
    return {}
  },
  
  // Validation schemas
  fromSchema: BlogFilterPersistedV1Schema,
  toSchema: BlogFilterPersistedV2Schema as z.ZodType<BlogFilterPersistedV2>,
}

// ======================
// BLOG UI STORE MIGRATIONS
// ======================

// V1 Schema (initial - basic UI preferences)
const BlogUIPersistedV1Schema = z.object({
  viewMode: z.enum(['grid', 'list', 'compact']),
  showFilters: z.boolean(),
  showMetrics: z.boolean(),
  enableComments: z.boolean(),
  enableRealtime: z.boolean(),
  showDrafts: z.boolean(),
})

// V2 Schema (adds advanced UI customization)
const BlogUIPersistedV2Schema = z.object({
  viewMode: z.enum(['grid', 'list', 'compact']),
  showFilters: z.boolean(),
  showMetrics: z.boolean(),
  enableComments: z.boolean(),
  enableRealtime: z.boolean(),
  showDrafts: z.boolean(),
  
  // NEW: Advanced view customization
  gridSettings: z.object({
    columnsPerRow: z.number().default(3),
    showThumbnails: z.boolean().default(true),
    showExcerpts: z.boolean().default(true),
    cardSize: z.enum(['small', 'medium', 'large']).default('medium'),
  }).default({
    columnsPerRow: 3,
    showThumbnails: true,
    showExcerpts: true,
    cardSize: 'medium',
  }),
  
  listSettings: z.object({
    showThumbnails: z.boolean().default(true),
    showStats: z.boolean().default(true),
    sortBy: z.enum(['date', 'title', 'status', 'views']).default('date'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }).default({
    showThumbnails: true,
    showStats: true,
    sortBy: 'date',
    sortOrder: 'desc',
  }),
  
  // NEW: Workspace customization
  workspace: z.object({
    sidebarWidth: z.number().default(250),
    toolbarVisible: z.boolean().default(true),
    statusBarVisible: z.boolean().default(true),
    minimap: z.boolean().default(false),
  }).default({
    sidebarWidth: 250,
    toolbarVisible: true,
    statusBarVisible: true,
    minimap: false,
  }),
  
  // NEW: Accessibility improvements
  accessibility: z.object({
    highContrast: z.boolean().default(false),
    reducedMotion: z.boolean().default(false),
    screenReaderMode: z.boolean().default(false),
    keyboardShortcuts: z.boolean().default(true),
  }).default({
    highContrast: false,
    reducedMotion: false,
    screenReaderMode: false,
    keyboardShortcuts: true,
  }),
})

type BlogUIPersistedV1 = z.infer<typeof BlogUIPersistedV1Schema>
type BlogUIPersistedV2 = z.infer<typeof BlogUIPersistedV2Schema>

// Migration from V1 to V2: Add advanced UI customization
const blogUIV1ToV2Migration: Migration<BlogUIPersistedV1, BlogUIPersistedV2> = {
  version: 1,
  targetVersion: 2,
  storeName: 'blog-ui-store',
  description: 'Add advanced UI customization, workspace settings, and accessibility options',
  createdAt: new Date().toISOString(),
  isBreaking: false,
  
  // Forward migration: V1 -> V2
  up: (state: BlogUIPersistedV1): BlogUIPersistedV2 => {
    return {
      ...state,
      gridSettings: {
        columnsPerRow: 3,
        showThumbnails: true,
        showExcerpts: true,
        cardSize: 'medium' as const,
      },
      listSettings: {
        showThumbnails: true,
        showStats: true,
        sortBy: 'date' as const,
        sortOrder: 'desc' as const,
      },
      workspace: {
        sidebarWidth: 250,
        toolbarVisible: true,
        statusBarVisible: true,
        minimap: false,
      },
      accessibility: {
        highContrast: false,
        reducedMotion: false,
        screenReaderMode: false,
        keyboardShortcuts: true,
      },
    }
  },
  
  // Rollback migration: V2 -> V1
  down: (state: BlogUIPersistedV2): BlogUIPersistedV1 => {
     
    const { gridSettings: _gridSettings, listSettings: _listSettings, workspace: _workspace, accessibility: _accessibility, ...rest } = state
    return rest
  },
  
  // Validation schemas
  fromSchema: BlogUIPersistedV1Schema,
  toSchema: BlogUIPersistedV2Schema as z.ZodType<BlogUIPersistedV2>,
}

// ======================
// VERSION 2 -> VERSION 3 (PERFORMANCE OPTIMIZATION)
// ======================

// V3 Schema for Blog Editor (adds performance settings)
const BlogEditorPersistedV3Schema = z.object({
  draft: CreateBlogPostDataSchema.nullable(),
  editorMode: z.enum(['markdown', 'wysiwyg']),
  previewMode: z.enum(['desktop', 'mobile', 'split']),
  wordWrapEnabled: z.boolean(),
  autosaveEnabled: z.boolean(),
  autosaveInterval: z.number(),
  editorTheme: z.enum(['default', 'dark', 'high-contrast']).default('default'),
  showLineNumbers: z.boolean().default(true),
  enableVimMode: z.boolean().default(false),
  draftHistory: z.array(z.object({
    id: z.string(),
    content: z.string(),
    timestamp: z.string(),
    autoSaved: z.boolean(),
  })).default([]),
  collaboration: z.object({
    enabled: z.boolean().default(false),
    showCursors: z.boolean().default(true),
    showComments: z.boolean().default(true),
    autoSync: z.boolean().default(true),
  }).default({
    enabled: false,
    showCursors: true,
    showComments: true,
    autoSync: true,
  }),
  
  // NEW: Performance optimizations
  performance: z.object({
    lazyLoading: z.boolean().default(true),
    virtualScrolling: z.boolean().default(false),
    debounceDelay: z.number().default(300), // ms
    maxHistoryItems: z.number().default(50),
    compressionEnabled: z.boolean().default(true),
  }).default({
    lazyLoading: true,
    virtualScrolling: false,
    debounceDelay: 300,
    maxHistoryItems: 50,
    compressionEnabled: true,
  }),
})

type BlogEditorPersistedV3 = z.infer<typeof BlogEditorPersistedV3Schema>

// Migration from V2 to V3: Add performance optimizations
const blogEditorV2ToV3Migration: Migration<BlogEditorPersistedV2, BlogEditorPersistedV3> = {
  version: 2,
  targetVersion: 3,
  storeName: 'blog-editor-store',
  description: 'Add performance optimization settings',
  createdAt: new Date().toISOString(),
  isBreaking: false,
  
  // Forward migration: V2 -> V3
  up: (state: BlogEditorPersistedV2): BlogEditorPersistedV3 => {
    // Trim draft history if it's too long
    const trimmedHistory = state.draftHistory.slice(-50) // Keep last 50 items
    
    return {
      ...state,
      draftHistory: trimmedHistory,
      performance: {
        lazyLoading: true,
        virtualScrolling: false,
        debounceDelay: 300,
        maxHistoryItems: 50,
        compressionEnabled: true,
      },
    }
  },
  
  // Rollback migration: V3 -> V2
  down: (state: BlogEditorPersistedV3): BlogEditorPersistedV2 => {
     
    const { performance: _performance, ...rest } = state
    return rest
  },
  
  // Validation schemas
  fromSchema: BlogEditorPersistedV2Schema as z.ZodType<BlogEditorPersistedV2>,
  toSchema: BlogEditorPersistedV3Schema as z.ZodType<BlogEditorPersistedV3>,
}

// Register all migrations
registerMigration(blogEditorV1ToV2Migration)
registerMigration(blogEditorV2ToV3Migration)
registerMigration(blogFilterV1ToV2Migration) // No-op migration
registerMigration(blogUIV1ToV2Migration)

// Export schemas for testing
export {
  BlogEditorPersistedV1Schema,
  BlogEditorPersistedV2Schema,
  BlogEditorPersistedV3Schema,
  BlogFilterPersistedV1Schema,
  BlogFilterPersistedV2Schema,
  BlogUIPersistedV1Schema,
  BlogUIPersistedV2Schema,
}

// Export types for testing
export type {
  BlogEditorPersistedV1,
  BlogEditorPersistedV2,
  BlogEditorPersistedV3,
  BlogFilterPersistedV1,
  BlogFilterPersistedV2,
  BlogUIPersistedV1,
  BlogUIPersistedV2,
}

// Export migrations for testing
export {
  blogEditorV1ToV2Migration,
  blogEditorV2ToV3Migration,
  blogFilterV1ToV2Migration,
  blogUIV1ToV2Migration,
}

// Development utilities
interface WindowWithBlogMigrations extends Window {
  __dceBlogMigrations?: {
    editor: {
      v1ToV2: Migration<BlogEditorPersistedV1, BlogEditorPersistedV2>
      v2ToV3: Migration<BlogEditorPersistedV2, BlogEditorPersistedV3>
    }
    filter: {
      v1ToV2: Migration<BlogFilterPersistedV1, BlogFilterPersistedV2>
    }
    ui: {
      v1ToV2: Migration<BlogUIPersistedV1, BlogUIPersistedV2>
    }
    schemas: {
      editor: {
        v1: typeof BlogEditorPersistedV1Schema
        v2: typeof BlogEditorPersistedV2Schema
        v3: typeof BlogEditorPersistedV3Schema
      }
      filter: {
        v1: typeof BlogFilterPersistedV1Schema
        v2: typeof BlogFilterPersistedV2Schema
      }
      ui: {
        v1: typeof BlogUIPersistedV1Schema
        v2: typeof BlogUIPersistedV2Schema
      }
    }
  }
}

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as WindowWithBlogMigrations).__dceBlogMigrations = {
    editor: {
      v1ToV2: blogEditorV1ToV2Migration,
      v2ToV3: blogEditorV2ToV3Migration,
    },
    filter: {
      v1ToV2: blogFilterV1ToV2Migration, // No-op
    },
    ui: {
      v1ToV2: blogUIV1ToV2Migration,
    },
    schemas: {
      editor: {
        v1: BlogEditorPersistedV1Schema,
        v2: BlogEditorPersistedV2Schema,
        v3: BlogEditorPersistedV3Schema,
      },
      filter: {
        v1: BlogFilterPersistedV1Schema,
        v2: BlogFilterPersistedV2Schema,
      },
      ui: {
        v1: BlogUIPersistedV1Schema,
        v2: BlogUIPersistedV2Schema,
      },
    },
  }
  
  console.info('📝 Blog Store Migration Info:', {
    editorStore: 'Full persistence with drafts and preferences',
    filterStore: 'Session-only (no persistence)',
    uiStore: 'UI preferences only',
    totalMigrations: 4,
  })
}