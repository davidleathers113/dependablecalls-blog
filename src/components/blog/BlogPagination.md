# BlogPagination Component

A comprehensive pagination component for blog listings with support for multiple variants, keyboard navigation, URL parameter integration, and accessibility features.

## Features

- **Multiple Variants**: Simple, compact, and full pagination layouts
- **URL Integration**: Automatically syncs with URL parameters for bookmarkable pagination
- **Keyboard Navigation**: Arrow keys, Home, End key support
- **Loading States**: Shows loading indicators during page transitions
- **Responsive Design**: Mobile-optimized with separate mobile/desktop layouts
- **Accessibility**: Full ARIA support with proper labels and roles
- **Page Size Control**: Configurable items per page with dropdown selector
- **Jump to Page**: Quick navigation to specific pages
- **Ellipsis Handling**: Smart page number display for large page counts
- **Error Boundaries**: Graceful error handling and fallbacks

## Basic Usage

```tsx
import BlogPagination, { useBlogPagination } from '../components/blog/BlogPagination'

function BlogPage() {
  const totalItems = 150
  const {
    pagination,
    handlePageChange,
    handlePageSizeChange
  } = useBlogPagination(totalItems)

  return (
    <div>
      {/* Your blog posts here */}
      
      <BlogPagination
        pagination={pagination}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  )
}
```

## Variants

### Full Variant (Default)
Complete pagination with all features including page numbers, first/last buttons, and optional jump-to-page.

```tsx
<BlogPagination
  pagination={pagination}
  variant="full"
  showJumpToPage={true}
  onPageChange={handlePageChange}
/>
```

### Simple Variant
Previous/Next buttons with page count display.

```tsx
<BlogPagination
  pagination={pagination}
  variant="simple"
  onPageChange={handlePageChange}
/>
```

### Compact Variant
Minimal space usage with only navigation arrows and page count.

```tsx
<BlogPagination
  pagination={pagination}
  variant="compact"
  showItemsPerPage={false}
  showTotalInfo={false}
  onPageChange={handlePageChange}
/>
```

## Props

### BlogPaginationProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `pagination` | `PaginationInfo` | Required | Current pagination state |
| `loading` | `boolean` | `false` | Shows loading state |
| `variant` | `'simple' \| 'full' \| 'compact'` | `'full'` | Pagination layout variant |
| `showItemsPerPage` | `boolean` | `true` | Show page size selector |
| `pageSizeOptions` | `number[]` | `[5, 10, 20, 50]` | Available page sizes |
| `showTotalInfo` | `boolean` | `true` | Show "Showing X to Y of Z results" |
| `showJumpToPage` | `boolean` | `false` | Show jump to page input |
| `enableKeyboardNav` | `boolean` | `true` | Enable keyboard navigation |
| `maxPageButtons` | `number` | `7` | Maximum page buttons to show |
| `onPageChange` | `(page: number) => void` | Optional | Page change callback |
| `onPageSizeChange` | `(pageSize: number) => void` | Optional | Page size change callback |
| `className` | `string` | `''` | Additional CSS classes |
| `ariaLabel` | `string` | `'Blog pagination'` | ARIA label |

### PaginationInfo

| Property | Type | Description |
|----------|------|-------------|
| `currentPage` | `number` | Current page number (1-based) |
| `totalPages` | `number` | Total number of pages |
| `totalItems` | `number` | Total number of items |
| `itemsPerPage` | `number` | Items per page |
| `hasNextPage` | `boolean` | Whether there's a next page |
| `hasPreviousPage` | `boolean` | Whether there's a previous page |

## Hook Usage

### useBlogPagination

The hook provides state management and URL synchronization for pagination.

```tsx
const {
  pagination,
  handlePageChange,
  handlePageSizeChange,
  resetPagination,
  getPaginationParams,
  updatePagination
} = useBlogPagination(totalItems, {
  defaultPageSize: 10,
  maxPageSize: 100,
  minPageSize: 5
})
```

#### Hook Returns

| Property | Type | Description |
|----------|------|-------------|
| `pagination` | `PaginationInfo` | Current pagination state |
| `handlePageChange` | `(page: number) => void` | Change current page |
| `handlePageSizeChange` | `(pageSize: number) => void` | Change page size |
| `resetPagination` | `() => void` | Reset to first page |
| `getPaginationParams` | `() => { page: number; per_page: number }` | Get params for API calls |
| `updatePagination` | `(totalItems: number) => void` | Update with new item count |

## URL Parameters

The component automatically manages these URL parameters:

- `page`: Current page number (omitted if page 1)
- `per_page`: Items per page (omitted if default size)

## Keyboard Navigation

When `enableKeyboardNav` is true (default):

- **Arrow Left**: Previous page
- **Arrow Right**: Next page  
- **Home**: First page
- **End**: Last page
- **Enter**: Submit jump-to-page input

## Integration with Blog Store

The component integrates with the blog filter store for state management:

```tsx
import { useBlogFilterStore } from '../store/blogStore'

function BlogPageWithStore() {
  const { currentPage, pageSize, setCurrentPage, setPageSize } = useBlogFilterStore()
  
  // Use with React Query for data fetching
  const { data, isLoading } = useQuery({
    queryKey: ['blog-posts', currentPage, pageSize],
    queryFn: () => fetchBlogPosts({ page: currentPage, per_page: pageSize })
  })

  const pagination: PaginationInfo = {
    currentPage,
    totalPages: Math.ceil((data?.total || 0) / pageSize),
    totalItems: data?.total || 0,
    itemsPerPage: pageSize,
    hasNextPage: currentPage < Math.ceil((data?.total || 0) / pageSize),
    hasPreviousPage: currentPage > 1
  }

  return (
    <BlogPagination
      pagination={pagination}
      loading={isLoading}
      onPageChange={setCurrentPage}
      onPageSizeChange={setPageSize}
    />
  )
}
```

## Styling

The component uses Tailwind CSS classes and follows the existing design system:

- Responsive breakpoints (sm:, md:, lg:)
- Consistent button styles with existing Button component
- Loading states with existing Loading component
- Proper focus states and accessibility

## Accessibility

- Full ARIA support with proper labels and roles
- Keyboard navigation support
- Screen reader friendly
- Focus management
- High contrast mode support

## Testing

Comprehensive test suite includes:

- Unit tests for all variants
- Keyboard navigation testing
- URL parameter integration
- Loading states
- Error boundaries
- Accessibility testing

Run tests with:

```bash
npm test src/components/blog/__tests__/BlogPagination.test.tsx
```

## Examples

See `BlogPagination.examples.tsx` for comprehensive usage examples including:

- Basic pagination
- All variants
- Loading states
- Custom configurations
- Hook integration
- Large datasets with ellipsis

## Error Handling

The component includes error boundaries and graceful fallbacks:

- Invalid page numbers are corrected automatically
- Page size constraints are enforced
- URL parameter validation
- Loading state error handling

## Performance

- Efficient page number calculation with memoization
- Minimal re-renders with proper dependency arrays
- URL parameter updates use `replace: true` to avoid history pollution
- Keyboard event debouncing for jump-to-page