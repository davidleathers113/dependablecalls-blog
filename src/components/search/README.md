# DCE Platform Search System

A comprehensive, performant, and accessible search system for the DependableCalls Exchange platform, built with React 19.1, TypeScript 5.8, and Supabase full-text search.

## 🚨 DCE Critical Rules Compliance

- ✅ **NO REGEX** - All validation uses Zod schemas and validator.js
- ✅ **NO 'any' types** - Strict TypeScript with proper type definitions
- ✅ **Zustand state management** - No Redux or MobX
- ✅ **Tailwind CSS classes** - No inline styles
- ✅ **90% test coverage** - Comprehensive testing with Vitest
- ✅ **Accessibility compliant** - WCAG 2.1 AA standards

## Architecture Overview

### Components

```
src/components/search/
├── SearchBar.tsx              # Reusable search input component
├── GlobalSearch.tsx           # Legacy modal (maintained for compatibility)
├── GlobalSearchModal.tsx      # Enhanced modal with Supabase integration
├── SearchErrorBoundary.tsx    # Error boundary for search components
└── __tests__/
    ├── SearchBar.test.tsx     # Comprehensive SearchBar tests
    └── GlobalSearch.test.tsx  # Legacy tests
```

### Hooks

```
src/hooks/
├── useSearch.ts               # Legacy Fuse.js search hook
├── useSupabaseSearch.ts       # New Supabase-integrated search hook
└── useDebounce.ts            # Debouncing utility
```

### Services

```
src/services/
└── searchService.ts          # Core search service with Supabase integration
```

### State Management

```
src/store/
└── searchStore.ts            # Zustand store for global search state
```

### Types

```
src/types/
├── search.ts                 # General search type definitions
└── supabase-search.ts       # Supabase-specific search types
```

## Key Features

### 🔍 Unified Search Experience
- **Global Search**: Search across campaigns, calls, users, and navigation
- **Category Filtering**: Filter results by type (campaigns, calls, settings, etc.)
- **Real-time Suggestions**: Dynamic autocomplete with debounced queries
- **Keyboard Shortcuts**: `Cmd+K` or `Ctrl+K` to open search modal

### 🎯 Role-Based Search
- **Supplier**: Search campaigns, calls, and reports they have access to
- **Buyer**: Search campaigns they've created and associated calls
- **Admin**: Full access including user search capabilities
- **Network**: Network-wide campaigns and performance data

### 📊 Supabase Integration
- **Full-Text Search**: PostgreSQL text search vectors for accurate matching
- **Performance Optimized**: Database views and indexing for fast queries
- **Real-time Updates**: Live search results via Supabase Realtime
- **Analytics Tracking**: Search behavior analysis for UX improvement

### ♿ Accessibility First
- **ARIA Compliant**: Full screen reader support
- **Keyboard Navigation**: Arrow keys, Enter, Escape
- **Focus Management**: Proper focus handling and visual indicators
- **High Contrast**: Supports all accessibility themes

## Usage Examples

### Basic SearchBar

```tsx
import { SearchBar } from '@/components/search/SearchBar'

function MyComponent() {
  return (
    <SearchBar
      placeholder="Search campaigns..."
      size="md"
      onSearch={(query) => console.log('Search:', query)}
      showSuggestions={true}
    />
  )
}
```

### SearchBar with Custom Suggestions

```tsx
import { SearchBar } from '@/components/search/SearchBar'
import type { SearchSuggestion } from '@/types/search'

const suggestions: SearchSuggestion[] = [
  {
    id: '1',
    text: 'Campaign Alpha',
    category: 'campaigns',
    url: '/app/campaigns/1'
  }
]

function MyComponent() {
  return (
    <SearchBar
      suggestions={suggestions}
      onSuggestionSelect={(suggestion) => {
        // Handle suggestion selection
        navigate(suggestion.url)
      }}
    />
  )
}
```

### Global Search Modal

```tsx
import { GlobalSearchModal } from '@/components/search/GlobalSearchModal'
import { useSearchModal } from '@/store/searchStore'

function App() {
  const isOpen = useSearchModal()
  const { setModalOpen } = useSearchActions()

  return (
    <GlobalSearchModal
      isOpen={isOpen}
      onClose={() => setModalOpen(false)}
      categories={['campaigns', 'calls']}
    />
  )
}
```

### Using Supabase Search Hook

```tsx
import { useSupabaseSearch } from '@/hooks/useSupabaseSearch'

function SearchResults() {
  const {
    query,
    setQuery,
    results,
    isLoading,
    error,
    search,
    clearSearch
  } = useSupabaseSearch({
    categories: ['campaigns'],
    limit: 20,
    autoSearch: true
  })

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
      />
      
      {isLoading && <div>Loading...</div>}
      {error && <div>Error: {error}</div>}
      
      {results.map((result) => (
        <div key={result.id}>
          <h3>{result.title}</h3>
          <p>{result.description}</p>
        </div>
      ))}
    </div>
  )
}
```

### Search Store Usage

```tsx
import { 
  useSearchStore, 
  useSearchActions,
  useSearchResults 
} from '@/store/searchStore'

function SearchComponent() {
  const results = useSearchResults()
  const { search, setQuery } = useSearchActions()

  const handleSearch = async (query: string) => {
    await search(query, {
      categories: ['campaigns', 'calls'],
      limit: 15
    })
  }

  return (
    <div>
      {/* Search UI */}
      {results.map((result) => (
        <SearchResultItem key={result.id} result={result} />
      ))}
    </div>
  )
}
```

## API Reference

### SearchBar Props

```tsx
interface SearchBarProps {
  placeholder?: string                           // Input placeholder
  size?: 'sm' | 'md' | 'lg'                     // Size variant
  variant?: 'default' | 'minimal' | 'rounded'   // Visual style
  showSuggestions?: boolean                      // Enable suggestions
  maxSuggestions?: number                        // Limit suggestions
  onSearch?: (query: string) => void             // Search callback
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void
  suggestions?: SearchSuggestion[]               // Custom suggestions
  isLoading?: boolean                            // Loading state
  disabled?: boolean                             // Disabled state
  className?: string                             // Custom CSS classes
  ariaLabel?: string                             // Accessibility label
}
```

### useSupabaseSearch Options

```tsx
interface UseSupabaseSearchOptions {
  autoSearch?: boolean          // Auto-search on query change
  debounceMs?: number          // Debounce delay (default: 300ms)
  minQueryLength?: number      // Min chars before search (default: 2)
  limit?: number               // Max results (default: 20)
  categories?: SearchCategory[]  // Categories to search
  fuzzyMatch?: boolean         // Enable fuzzy matching
}
```

### Search Categories

```tsx
type SearchCategory = 
  | 'campaigns'    // Campaign management
  | 'calls'        // Call tracking and history
  | 'users'        // User management (admin only)
  | 'navigation'   // Site navigation items
  | 'settings'     // Account and system settings
  | 'help'         // Help documentation
  | 'reports'      // Analytics and reporting
```

## Performance Optimizations

### 1. Debounced Search
```tsx
// Automatic debouncing to reduce API calls
const debouncedQuery = useDebounce(query, 300)
```

### 2. Memoized Results
```tsx
// Memoized filtering for client-side optimization
const filteredResults = useMemo(() => {
  return results.filter(/* filtering logic */)
}, [results, filters])
```

### 3. Virtualized Lists
For large result sets, use react-window:

```tsx
import { FixedSizeList as List } from 'react-window'

function SearchResults({ results }) {
  const Row = ({ index, style }) => (
    <div style={style}>
      <SearchResultItem result={results[index]} />
    </div>
  )

  return (
    <List
      height={400}
      itemCount={results.length}
      itemSize={80}
    >
      {Row}
    </List>
  )
}
```

### 4. Search Result Caching
```tsx
// Automatic caching in search store
const searchWithCache = useCallback(async (query: string) => {
  const cached = getFromCache(query)
  if (cached) return cached
  
  const results = await searchService.globalSearch(query)
  setToCache(query, results)
  return results
}, [])
```

## Database Schema

### Search Analytics Table
```sql
CREATE TABLE search_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  result_count INTEGER NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  search_time_ms INTEGER,
  selected_result_id TEXT,
  search_filters JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for performance
CREATE INDEX idx_search_analytics_query ON search_analytics(query);
CREATE INDEX idx_search_analytics_user_id ON search_analytics(user_id);
CREATE INDEX idx_search_analytics_created_at ON search_analytics(created_at);
```

### Text Search Vectors
```sql
-- Add search vectors to campaigns
ALTER TABLE campaigns 
ADD COLUMN search_vector tsvector;

-- Update function for search vector
CREATE OR REPLACE FUNCTION update_campaign_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.status, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic updates
CREATE TRIGGER update_campaign_search_vector_trigger
  BEFORE INSERT OR UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_campaign_search_vector();

-- GIN index for full-text search
CREATE INDEX idx_campaigns_search_vector 
ON campaigns USING gin(search_vector);
```

## Testing

### Running Tests
```bash
# Run all search tests
npm test -- src/components/search/

# Run specific test file
npm test -- src/components/search/__tests__/SearchBar.test.tsx

# Run with coverage
npm run test:coverage -- src/components/search/
```

### Test Categories
- **Unit Tests**: Component logic and hooks
- **Integration Tests**: Search service and store interactions
- **Accessibility Tests**: ARIA compliance and keyboard navigation
- **Performance Tests**: Load testing and memory usage
- **E2E Tests**: Complete user journeys with Playwright

### Example Test
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SearchBar } from '../SearchBar'

test('performs search when Enter is pressed', async () => {
  const onSearch = vi.fn()
  render(<SearchBar onSearch={onSearch} />)
  
  const input = screen.getByRole('combobox')
  fireEvent.change(input, { target: { value: 'test query' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  
  expect(onSearch).toHaveBeenCalledWith('test query')
})
```

## Troubleshooting

### Common Issues

1. **Search Results Not Updating**
   ```tsx
   // Ensure search store is properly connected
   const { search, results } = useSupabaseSearch()
   ```

2. **Keyboard Shortcuts Not Working**
   ```tsx
   // Check event listener setup in AppLayout
   useEffect(() => {
     const handleKeyDown = (event: KeyboardEvent) => {
       if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
         event.preventDefault()
         setSearchModalOpen(true)
       }
     }
     document.addEventListener('keydown', handleKeyDown)
     return () => document.removeEventListener('keydown', handleKeyDown)
   }, [setSearchModalOpen])
   ```

3. **Supabase Search Errors**
   ```tsx
   // Check database connection and RLS policies
   const { error } = await supabase
     .from('campaigns')
     .select('*')
     .textSearch('search_vector', query)
   
   if (error) {
     console.error('Search error:', error)
   }
   ```

### Debugging Tips

1. **Enable Debug Logging**
   ```tsx
   // Add to search service
   if (import.meta.env.DEV) {
     console.debug('Search query:', query, 'Options:', options)
   }
   ```

2. **Check Performance**
   ```tsx
   // Monitor search performance
   const startTime = performance.now()
   const results = await searchService.globalSearch(query)
   const endTime = performance.now()
   console.log(`Search took ${endTime - startTime}ms`)
   ```

3. **Validate Permissions**
   ```tsx
   // Ensure proper role-based access
   if (userRole !== 'admin' && categories.includes('users')) {
     throw new Error('Insufficient permissions for user search')
   }
   ```

## Contributing

1. **Follow DCE Rules**: No regex, proper TypeScript, Zustand state
2. **Write Tests**: Maintain 90% coverage requirement
3. **Accessibility**: All components must be WCAG 2.1 AA compliant
4. **Performance**: Consider bundle size and runtime performance
5. **Documentation**: Update this README for any API changes

## Migration Guide

### From Legacy Search (Fuse.js) to Supabase Search

1. **Replace useSearch with useSupabaseSearch**
   ```tsx
   // Old
   import { useSearch } from '@/hooks/useSearch'
   
   // New
   import { useSupabaseSearch } from '@/hooks/useSupabaseSearch'
   ```

2. **Update Search Categories**
   ```tsx
   // Old categories were strings
   categories: ['Navigation', 'Campaigns']
   
   // New categories are typed enums
   categories: ['navigation', 'campaigns']
   ```

3. **Migrate to Search Store**
   ```tsx
   // Old: Component-level state
   const [query, setQuery] = useState('')
   
   // New: Global store
   const { query, setQuery } = useSearchActions()
   ```

This search system provides a robust, scalable, and accessible foundation for the DCE platform's search needs while maintaining strict compliance with platform standards.