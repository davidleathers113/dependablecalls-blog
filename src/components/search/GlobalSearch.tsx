import { Fragment } from 'react'
import { Dialog, Transition, Combobox } from '@headlessui/react'
import { MagnifyingGlassIcon, XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { 
  FolderIcon, 
  DocumentIcon, 
  CogIcon, 
  QuestionMarkCircleIcon,
  ChartBarIcon,
  UserGroupIcon
} from '@heroicons/react/20/solid'
import { useNavigate } from 'react-router-dom'
import { useGlobalSearch } from '../../hooks/useSearch'
import { SearchErrorBoundary } from './SearchErrorBoundary'

interface GlobalSearchProps {
  isOpen: boolean
  onClose: () => void
}

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Navigation: FolderIcon,
  Campaigns: ChartBarIcon,
  Settings: CogIcon,
  Help: QuestionMarkCircleIcon,
  Legal: DocumentIcon,
  Users: UserGroupIcon,
}

function GlobalSearchCore({ isOpen, onClose }: GlobalSearchProps) {
  const navigate = useNavigate()
  const { 
    query, 
    setQuery, 
    searchResults, 
    isSearching, 
    isLoading,
    categories,
    selectedCategory,
    setSelectedCategory,
    clearSearch,
    error,
    retrySearch,
    hasError,
    canRetry
  } = useGlobalSearch()
  
  const handleSelect = (url: string) => {
    navigate(url)
    handleClose()
  }
  
  const handleClose = () => {
    clearSearch()
    onClose()
  }
  
  // Announce search results to screen readers
  const getAriaLabel = () => {
    if (isLoading) return 'Loading search index'
    if (isSearching) return 'Searching'
    if (query && searchResults.length === 0) return `No results found for ${query}`
    if (searchResults.length > 0) return `${searchResults.length} results found`
    return 'Search dialog'
  }
  
  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog 
        as="div" 
        className="relative z-50" 
        onClose={handleClose}
        aria-label={getAriaLabel()}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-25 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto p-4 sm:p-6 md:p-20">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel 
              className="mx-auto max-w-2xl transform divide-y divide-gray-100 overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black ring-opacity-5 transition-all"
              role="search"
              aria-label="Global site search"
            >
              <Combobox onChange={handleSelect} aria-label="Search results">
                <div className="relative">
                  <MagnifyingGlassIcon
                    className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-gray-400"
                    aria-hidden="true"
                  />
                  <Combobox.Input
                    className="h-12 w-full border-0 bg-transparent pl-11 pr-4 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm"
                    placeholder="Search..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    autoFocus
                    aria-label="Search query"
                    aria-describedby="search-help"
                    aria-autocomplete="list"
                    aria-controls="search-results"
                    aria-expanded={searchResults.length > 0}
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-sm p-1"
                      aria-label="Clear search query"
                    >
                      <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {/* Category filter pills */}
                {categories.length > 0 && (
                  <div 
                    className="flex flex-wrap gap-2 border-t border-gray-100 px-4 py-2.5"
                    role="group"
                    aria-label="Filter search results by category"
                  >
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                        selectedCategory === null
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      aria-pressed={selectedCategory === null}
                      aria-label="Show all categories"
                    >
                      All
                    </button>
                    {categories.map((category) => (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                          selectedCategory === category
                            ? 'bg-primary-100 text-primary-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        aria-pressed={selectedCategory === category}
                        aria-label={`Filter by ${category} category`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                )}

                {/* Results */}
                {(query || searchResults.length > 0) && (
                  <Combobox.Options 
                    static 
                    className="max-h-80 scroll-py-2 overflow-y-auto py-2"
                    id="search-results"
                    aria-live="polite"
                    aria-label={`Search results: ${searchResults.length} items found`}
                  >
                    {hasError ? (
                      <div className="px-4 py-14 text-center sm:px-14" role="alert">
                        <ExclamationTriangleIcon
                          className="mx-auto h-6 w-6 text-red-400"
                          aria-hidden="true"
                        />
                        <p className="mt-4 text-sm text-gray-900">
                          Unable to load search
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {error || 'Something went wrong loading the search index'}
                        </p>
                        {canRetry && (
                          <button
                            onClick={retrySearch}
                            className="mt-4 inline-flex items-center rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            Try Again
                          </button>
                        )}
                      </div>
                    ) : isLoading ? (
                      <div className="px-4 py-14 text-center sm:px-14" role="status" aria-live="polite">
                        <div 
                          className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent"
                          aria-hidden="true"
                        />
                        <p className="mt-4 text-sm text-gray-900">Loading search index...</p>
                      </div>
                    ) : isSearching ? (
                      <div className="px-4 py-14 text-center sm:px-14" role="status" aria-live="polite">
                        <div 
                          className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent"
                          aria-hidden="true"
                        />
                        <p className="mt-4 text-sm text-gray-900">Searching...</p>
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="px-4 py-14 text-center sm:px-14" role="status">
                        <MagnifyingGlassIcon
                          className="mx-auto h-6 w-6 text-gray-400"
                          aria-hidden="true"
                        />
                        <p className="mt-4 text-sm text-gray-900">
                          No results found for "{query}"
                        </p>
                        {selectedCategory && (
                          <p className="mt-1 text-xs text-gray-500">
                            in {selectedCategory} category
                          </p>
                        )}
                      </div>
                    ) : (
                      searchResults.map((result) => {
                        const Icon = categoryIcons[result.category] || DocumentIcon
                        return (
                          <Combobox.Option
                            key={result.id}
                            value={result.url}
                            className={({ active }) =>
                              `cursor-pointer select-none px-4 py-2 ${
                                active ? 'bg-primary-50' : ''
                              }`
                            }
                          >
                            {({ active }) => (
                              <div className="flex items-start">
                                <Icon
                                  className={`mt-0.5 h-5 w-5 flex-shrink-0 ${
                                    active ? 'text-primary-600' : 'text-gray-400'
                                  }`}
                                  aria-hidden="true"
                                />
                                <div className="ml-3 flex-1">
                                  <p className={`text-sm font-medium ${
                                    active ? 'text-primary-900' : 'text-gray-900'
                                  }`}>
                                    {result.title}
                                  </p>
                                  {result.description && (
                                    <p className={`mt-0.5 text-xs ${
                                      active ? 'text-primary-700' : 'text-gray-500'
                                    }`}>
                                      {result.description}
                                    </p>
                                  )}
                                  <p className={`mt-0.5 text-xs ${
                                    active ? 'text-primary-600' : 'text-gray-400'
                                  }`}>
                                    {result.category}
                                  </p>
                                </div>
                              </div>
                            )}
                          </Combobox.Option>
                        )
                      })
                    )}
                  </Combobox.Options>
                )}

                {/* Quick actions when no query */}
                {!query && searchResults.length === 0 && !isLoading && (
                  <div className="border-t border-gray-100 px-4 py-4">
                    <p 
                      className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3"
                      id="quick-actions-heading"
                    >
                      Quick Actions
                    </p>
                    <div className="space-y-2" role="group" aria-labelledby="quick-actions-heading">
                      <button
                        onClick={() => handleSelect('/app/campaigns/new')}
                        className="flex w-full items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        aria-label="Navigate to create new campaign page"
                      >
                        <ChartBarIcon className="mr-3 h-5 w-5 text-gray-400" aria-hidden="true" />
                        Create New Campaign
                      </button>
                      <button
                        onClick={() => handleSelect('/app/dashboard')}
                        className="flex w-full items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        aria-label="Navigate to main dashboard"
                      >
                        <FolderIcon className="mr-3 h-5 w-5 text-gray-400" aria-hidden="true" />
                        Go to Dashboard
                      </button>
                      <button
                        onClick={() => handleSelect('/app/settings/account')}
                        className="flex w-full items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        aria-label="Navigate to account settings page"
                      >
                        <CogIcon className="mr-3 h-5 w-5 text-gray-400" aria-hidden="true" />
                        Account Settings
                      </button>
                    </div>
                  </div>
                )}

                {/* Search tips */}
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5" role="region" aria-label="Keyboard shortcuts help">
                  <div className="flex items-center justify-between" id="search-help">
                    <p className="text-xs text-gray-500">
                      Press <kbd className="mx-1 rounded bg-white px-1.5 py-0.5 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300" aria-label="Enter key">↵</kbd> to select
                    </p>
                    <p className="text-xs text-gray-500">
                      Press <kbd className="mx-1 rounded bg-white px-1.5 py-0.5 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300" aria-label="Escape key">ESC</kbd> to close
                    </p>
                  </div>
                </div>
              </Combobox>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  )
}

// Main exported component wrapped with error boundary
export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  return (
    <SearchErrorBoundary>
      <GlobalSearchCore isOpen={isOpen} onClose={onClose} />
    </SearchErrorBoundary>
  )
}