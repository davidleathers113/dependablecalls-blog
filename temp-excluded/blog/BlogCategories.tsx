import { useState, useMemo } from 'react'
import { 
  FolderIcon, 
  FolderOpenIcon, 
  ChevronRightIcon, 
  ChevronDownIcon,
  ListBulletIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline'
import { Button } from '../common/Button'
import { Badge } from '../common/Badge'
import { ErrorBoundary } from '../common/ErrorBoundary'
import { AccessibleIcon } from '../common/AccessibleIcon'
import type { BlogCategory } from '../../types/blog'

export interface BlogCategoriesProps {
  /** Current selected category ID */
  selectedCategory?: string
  /** Available categories */
  categories?: BlogCategory[]
  /** Display variant */
  variant?: 'tree' | 'list' | 'grid' | 'sidebar'
  /** Whether categories are clickable/navigable */
  interactive?: boolean
  /** Whether to show post counts */
  showCounts?: boolean
  /** Whether to show category descriptions */
  showDescriptions?: boolean
  /** Whether to show empty categories */
  showEmptyCategories?: boolean
  /** Maximum nesting level to display */
  maxDepth?: number
  /** Whether to start collapsed (tree variant) */
  startCollapsed?: boolean
  /** Called when category selection changes */
  onCategoryChange?: (categoryId: string | null) => void
  /** Custom empty state message */
  emptyStateMessage?: string
  /** Additional CSS classes */
  className?: string
}

interface CategoryItemProps {
  category: BlogCategory
  depth: number
  maxDepth: number
  selectedCategory?: string
  interactive: boolean
  showCounts: boolean
  showDescriptions: boolean
  showEmptyCategories: boolean
  variant: 'tree' | 'list' | 'grid' | 'sidebar'
  onCategoryChange?: (categoryId: string | null) => void
}

const CategoryItem: React.FC<CategoryItemProps> = ({
  category,
  depth,
  maxDepth,
  selectedCategory,
  interactive,
  showCounts,
  showDescriptions,
  showEmptyCategories,
  variant,
  onCategoryChange
}) => {
  const [isExpanded, setIsExpanded] = useState(!category.parent_id) // Root categories start expanded
  const isSelected = selectedCategory === category.id
  const hasChildren = category.children && category.children.length > 0
  const shouldShow = showEmptyCategories || (category.postsCount || 0) > 0

  if (!shouldShow) return null

  const handleClick = () => {
    if (interactive && onCategoryChange) {
      onCategoryChange(isSelected ? null : category.id)
    }
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  const paddingLeft = variant === 'tree' ? depth * 20 : 0

  if (variant === 'grid') {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
        <div 
          className={`cursor-pointer ${isSelected ? 'text-blue-600' : 'text-gray-900'}`}
          onClick={handleClick}
          role={interactive ? 'button' : undefined}
          tabIndex={interactive ? 0 : undefined}
          onKeyDown={(e) => {
            if (interactive && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              handleClick()
            }
          }}
        >
          <div className="flex items-center mb-2">
            <AccessibleIcon 
              icon={isSelected ? FolderOpenIcon : FolderIcon}
              className={`h-5 w-5 mr-2 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`}
            />
            <h3 className="font-medium">{category.name}</h3>
            {showCounts && (category.postsCount || 0) > 0 && (
              <Badge variant="neutral" className="ml-2 text-xs">
                {category.postsCount}
              </Badge>
            )}
          </div>
          {showDescriptions && category.description && (
            <p className="text-sm text-gray-600 line-clamp-2">{category.description}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={variant === 'tree' ? '' : 'border-b border-gray-100 last:border-b-0'}>
      <div
        className={`
          flex items-center py-2 px-3 rounded-md transition-colors
          ${interactive ? 'cursor-pointer hover:bg-gray-50' : ''}
          ${isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}
          ${variant === 'sidebar' ? 'text-sm' : ''}
        `}
        style={{ paddingLeft: `${paddingLeft + 12}px` }}
        onClick={handleClick}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onKeyDown={(e) => {
          if (interactive && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            handleClick()
          }
        }}
      >
        {/* Expand/Collapse Button */}
        {variant === 'tree' && hasChildren && depth < maxDepth && (
          <button
            onClick={handleToggle}
            className="mr-1 p-0.5 hover:bg-gray-200 rounded"
            aria-label={isExpanded ? 'Collapse category' : 'Expand category'}
          >
            <AccessibleIcon 
              icon={isExpanded ? ChevronDownIcon : ChevronRightIcon}
              className="h-4 w-4 text-gray-400"
            />
          </button>
        )}

        {/* Category Icon */}
        <AccessibleIcon 
          icon={isSelected ? FolderOpenIcon : FolderIcon}
          className={`h-4 w-4 mr-2 flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`}
        />

        {/* Category Name */}
        <span className="flex-1 font-medium truncate">{category.name}</span>

        {/* Post Count */}
        {showCounts && (category.postsCount || 0) > 0 && (
          <Badge 
            variant={isSelected ? 'info' : 'neutral'} 
            className="ml-2 text-xs"
          >
            {category.postsCount}
          </Badge>
        )}
      </div>

      {/* Description */}
      {showDescriptions && category.description && (
        <div 
          className="px-3 pb-2 text-sm text-gray-600"
          style={{ paddingLeft: `${paddingLeft + 32}px` }}
        >
          {category.description}
        </div>
      )}

      {/* Children */}
      {variant === 'tree' && hasChildren && isExpanded && depth < maxDepth && (
        <div className="ml-4">
          {category.children!.map((child) => (
            <CategoryItem
              key={child.id}
              category={child}
              depth={depth + 1}
              maxDepth={maxDepth}
              selectedCategory={selectedCategory}
              interactive={interactive}
              showCounts={showCounts}
              showDescriptions={showDescriptions}
              showEmptyCategories={showEmptyCategories}
              variant={variant}
              onCategoryChange={onCategoryChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface CategoryListProps {
  categories: BlogCategory[]
  selectedCategory?: string
  interactive: boolean
  showCounts: boolean
  showDescriptions: boolean
  showEmptyCategories: boolean
  variant: 'tree' | 'list' | 'grid' | 'sidebar'
  maxDepth: number
  onCategoryChange?: (categoryId: string | null) => void
}

const CategoryList: React.FC<CategoryListProps> = ({
  categories,
  selectedCategory,
  interactive,
  showCounts,
  showDescriptions,
  showEmptyCategories,
  variant,
  maxDepth,
  onCategoryChange
}) => {
  const rootCategories = categories.filter(cat => !cat.parent_id)

  if (variant === 'grid') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rootCategories.map((category) => (
          <CategoryItem
            key={category.id}
            category={category}
            depth={0}
            maxDepth={maxDepth}
            selectedCategory={selectedCategory}
            interactive={interactive}
            showCounts={showCounts}
            showDescriptions={showDescriptions}
            showEmptyCategories={showEmptyCategories}
            variant={variant}
            onCategoryChange={onCategoryChange}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={variant === 'sidebar' ? 'space-y-1' : 'space-y-2'}>
      {rootCategories.map((category) => (
        <CategoryItem
          key={category.id}
          category={category}
          depth={0}
          maxDepth={maxDepth}
          selectedCategory={selectedCategory}
          interactive={interactive}
          showCounts={showCounts}
          showDescriptions={showDescriptions}
          showEmptyCategories={showEmptyCategories}
          variant={variant}
          onCategoryChange={onCategoryChange}
        />
      ))}
    </div>
  )
}

const BlogCategoriesInner: React.FC<BlogCategoriesProps> = ({
  selectedCategory,
  categories = [],
  variant = 'list',
  interactive = true,
  showCounts = false,
  showDescriptions = false,
  showEmptyCategories = true,
  maxDepth = 3,
  onCategoryChange,
  emptyStateMessage = "No categories available",
  className = ''
}) => {
  const [isLoading] = useState(false)
  const [error] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'tree' | 'list' | 'grid'>(
    variant === 'sidebar' ? 'list' : variant as 'tree' | 'list' | 'grid'
  )

  // Build category tree with children
  const categoriesWithChildren = useMemo(() => {
    const categoryMap = new Map<string, BlogCategory>()
    
    // Initialize all categories
    categories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] })
    })

    // Build parent-child relationships
    categories.forEach(cat => {
      if (cat.parent_id) {
        const parent = categoryMap.get(cat.parent_id)
        const child = categoryMap.get(cat.id)
        if (parent && child) {
          parent.children = parent.children || []
          parent.children.push(child)
        }
      }
    })

    return Array.from(categoryMap.values())
  }, [categories])

  const handleClearSelection = () => {
    if (onCategoryChange) {
      onCategoryChange(null)
    }
  }

  const selectedCategoryName = selectedCategory 
    ? categories.find(cat => cat.id === selectedCategory)?.name 
    : null

  if (error) {
    return (
      <div className={`text-center py-4 ${className}`}>
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={`space-y-3 ${className}`}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center space-x-3">
            <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 rounded animate-pulse flex-1" />
            <div className="h-4 w-8 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (categories.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <AccessibleIcon icon={FolderIcon} className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500">{emptyStateMessage}</p>
      </div>
    )
  }

  return (
    <div className={`${className}`}>
      {/* Header with view controls (not for sidebar variant) */}
      {variant !== 'sidebar' && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Categories
            {selectedCategoryName && (
              <span className="ml-2 text-base font-normal text-gray-600">
                - {selectedCategoryName}
              </span>
            )}
          </h3>
          
          {/* View Mode Toggle */}
          <div className="flex items-center space-x-1 bg-gray-100 rounded-md p-1">
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'primary' : 'ghost'}
              onClick={() => setViewMode('list')}
              className="p-1"
              aria-label="List view"
            >
              <AccessibleIcon icon={ListBulletIcon} className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'primary' : 'ghost'}
              onClick={() => setViewMode('grid')}
              className="p-1"
              aria-label="Grid view"
            >
              <AccessibleIcon icon={Squares2X2Icon} className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Clear Selection */}
      {selectedCategory && interactive && onCategoryChange && (
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearSelection}
            className="text-gray-600"
          >
            Clear Category Filter
          </Button>
        </div>
      )}

      {/* Categories List */}
      <CategoryList
        categories={categoriesWithChildren}
        selectedCategory={selectedCategory}
        interactive={interactive}
        showCounts={showCounts}
        showDescriptions={showDescriptions}
        showEmptyCategories={showEmptyCategories}
        variant={variant === 'sidebar' ? 'sidebar' : viewMode}
        maxDepth={maxDepth}
        onCategoryChange={onCategoryChange}
      />

      {/* Stats Footer */}
      {variant !== 'sidebar' && categories.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              {categories.length} {categories.length === 1 ? 'category' : 'categories'}
            </span>
            {showCounts && (
              <span>
                {categories.reduce((total, cat) => total + (cat.postsCount || 0), 0)} total posts
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Blog Categories Component
 * 
 * A flexible category navigation system supporting:
 * - Multiple display variants (tree, list, grid, sidebar)
 * - Hierarchical category structures
 * - Interactive filtering and selection
 * - Post counts and descriptions
 * - Collapsible tree navigation
 * - Accessibility features
 * - Loading and error states
 * 
 * @example
 * ```tsx
 * <BlogCategories
 *   selectedCategory={selectedCategoryId}
 *   categories={allCategories}
 *   variant="tree"
 *   interactive={true}
 *   showCounts={true}
 *   showDescriptions={true}
 *   onCategoryChange={(categoryId) => setSelectedCategory(categoryId)}
 * />
 * ```
 */
export const BlogCategories: React.FC<BlogCategoriesProps> = (props) => {
  return (
    <ErrorBoundary>
      <BlogCategoriesInner {...props} />
    </ErrorBoundary>
  )
}

export default BlogCategories