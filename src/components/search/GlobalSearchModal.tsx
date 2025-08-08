import React, { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition, Combobox } from '@headlessui/react'
import { 
  MagnifyingGlassIcon, 
  XMarkIcon, 
  ExclamationTriangleIcon,
  ClockIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import { useSupabaseSearch } from '../../hooks/useSupabaseSearch'
import { categoryIcons, type SearchCategory } from '../../services/searchService'
import { SearchErrorBoundary } from './SearchErrorBoundary'
import { clsx } from 'clsx'

interface GlobalSearchModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback when modal is closed */
  onClose: () => void
  /** Initial search query */
  initialQuery?: string
  /** Categories to search in */
  categories?: SearchCategory[]
}

/**
 * Core search modal component
 */
function GlobalSearchModalCore({ 
  isOpen, 
  onClose, 
  initialQuery = '',
  categories 
}: GlobalSearchModalProps) {
  const navigate = useNavigate()
  const [selectedIndex, setSelectedIndex] = useState(-1)
  
  const {
    query,
    setQuery,
    results,
    isLoading,
    error,
    hasSearched,
    resultCount,
    search: _search,
    clearSearch,
    retrySearch,
    categories: availableCategories,
    selectedCategories,
    setSelectedCategories,
    suggestions,
    isSuggestionsLoading: _isSuggestionsLoading
  } = useSupabaseSearch({
    categories,
    autoSearch: true,
    minQueryLength: 2,
    limit: 15,
    debounceMs: 300
  })

  // Set initial query when modal opens
  useEffect(() => {
    if (isOpen && initialQuery) {
      setQuery(initialQuery)
    }
  }, [isOpen, initialQuery, setQuery])

  // Handle result selection
  const handleSelect = (url: string) => {
    navigate(url)
    handleClose()
  }

  // Handle modal close
  const handleClose = () => {
    clearSearch()
    setSelectedIndex(-1)
    onClose()
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const resultsCount = results.length
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => prev < resultsCount - 1 ? prev + 1 : 0)
        break
        
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : resultsCount - 1)
        break
        
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleSelect(results[selectedIndex].url)
        }
        break
        
      case 'Escape':
        e.preventDefault()
        handleClose()
        break
    }
  }

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(-1)
  }, [results])

  // Generate ARIA label for screen readers
  const getAriaLabel = () => {
    if (isLoading) return 'Searching...'
    if (error) return 'Search error occurred'
    if (hasSearched && resultCount === 0) return `No results found for "${query}"`
    if (hasSearched && resultCount > 0) return `${resultCount} results found for "${query}"`
    return 'Global search dialog'
  }

  const showResults = hasSearched && (results.length > 0 || isLoading || error)
  const showSuggestions = !hasSearched && suggestions.length > 0 && query.length > 0

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={handleClose}
        aria-label={getAriaLabel()}
      >
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
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
              className="mx-auto max-w-3xl transform divide-y divide-gray-100 overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black ring-opacity-5 transition-all"
              role="search"
              aria-label="Global search"
            >
              <Combobox
                onChange={handleSelect}
                aria-label="Search results"
              >
                {/* Search Input */}
                <div className="relative">
                  <MagnifyingGlassIcon
                    className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-gray-400"
                    aria-hidden="true"
                  />
                  <Combobox.Input
                    className="h-12 w-full border-0 bg-transparent pl-11 pr-4 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm"
                    placeholder="Search campaigns, calls, settings..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    aria-label="Search query"
                    aria-describedby="search-help"
                    aria-autocomplete="list"
                    aria-expanded={showResults || showSuggestions}
                  />
                  
                  {/* Clear button */}
                  {query && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-sm p-1"
                      aria-label="Clear search"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>

                {/* Category Filters */}
                {availableCategories.length > 1 && (
                  <div
                    className="border-t border-gray-100 px-4 py-3"
                    role="group"
                    aria-label="Filter by category"
                  >
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedCategories([])}
                        className={clsx(
                          'rounded-full px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500',
                          selectedCategories.length === 0
                            ? 'bg-primary-100 text-primary-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        )}
                        aria-pressed={selectedCategories.length === 0}
                      >
                        All
                      </button>
                      {availableCategories.map((category) => {
                        const isSelected = selectedCategories.includes(category)
                        const Icon = categoryIcons[category]
                        
                        return (
                          <button
                            key={category}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedCategories(selectedCategories.filter(c => c !== category))
                              } else {
                                setSelectedCategories([...selectedCategories, category])
                              }
                            }}
                            className={clsx(
                              'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500',
                              isSelected
                                ? 'bg-primary-100 text-primary-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            )}
                            aria-pressed={isSelected}
                            aria-label={`Filter by ${category}`}
                          >
                            {Icon && <Icon className="mr-1 h-3 w-3" />}
                            {category.charAt(0).toUpperCase() + category.slice(1)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Search Results */}
                {showResults && (
                  <Combobox.Options
                    static
                    className="max-h-96 scroll-py-2 overflow-y-auto py-2"
                    aria-live="polite"
                    aria-label={`Search results: ${resultCount} items`}
                  >
                    {error ? (
                      <div className="px-4 py-14 text-center sm:px-14" role="alert">
                        <ExclamationTriangleIcon
                          className="mx-auto h-6 w-6 text-red-400"
                          aria-hidden="true"
                        />
                        <p className="mt-4 text-sm text-gray-900">Search Error</p>
                        <p className="mt-1 text-xs text-gray-500">{error}</p>
                        <button
                          onClick={retrySearch}
                          className="mt-4 inline-flex items-center rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          Try Again
                        </button>
                      </div>
                    ) : isLoading ? (
                      <div className="px-4 py-14 text-center sm:px-14" role="status">
                        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
                        <p className="mt-4 text-sm text-gray-900">Searching...</p>
                      </div>
                    ) : results.length === 0 ? (
                      <div className="px-4 py-14 text-center sm:px-14">
                        <MagnifyingGlassIcon
                          className="mx-auto h-6 w-6 text-gray-400"
                          aria-hidden="true"
                        />
                        <p className="mt-4 text-sm text-gray-900">
                          No results found for "{query}"
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Try adjusting your search or removing filters
                        </p>
                      </div>
                    ) : (
                      results.map((result, index) => {
                        const isSelected = index === selectedIndex
                        const Icon = categoryIcons[result.type] || MagnifyingGlassIcon
                        
                        return (
                          <Combobox.Option
                            key={result.id}
                            value={result.url}
                            className={({ active }) =>
                              clsx(
                                'cursor-pointer select-none px-4 py-3 transition-colors',
                                active || isSelected ? 'bg-primary-50' : 'hover:bg-gray-50'
                              )
                            }
                          >
                            {({ active }) => (
                              <div className="flex items-start">
                                <Icon
                                  className={clsx(
                                    'mt-0.5 h-5 w-5 flex-shrink-0',
                                    active || isSelected ? 'text-primary-600' : 'text-gray-400'
                                  )}
                                  aria-hidden="true"
                                />
                                <div className="ml-3 flex-1 min-w-0">
                                  <p
                                    className={clsx(
                                      'text-sm font-medium truncate',
                                      active || isSelected ? 'text-primary-900' : 'text-gray-900'
                                    )}
                                  >
                                    {result.title}
                                  </p>
                                  {result.description && (
                                    <p
                                      className={clsx(
                                        'mt-0.5 text-xs truncate',
                                        active || isSelected ? 'text-primary-700' : 'text-gray-500'
                                      )}
                                    >
                                      {result.description}
                                    </p>
                                  )}
                                  <div className="mt-1 flex items-center">
                                    <span
                                      className={clsx(
                                        'text-xs',
                                        active || isSelected ? 'text-primary-600' : 'text-gray-400'
                                      )}
                                    >
                                      {result.category}
                                    </span>
                                    {result.score && result.score > 0.8 && (
                                      <ArrowTrendingUpIcon
                                        className={clsx(
                                          'ml-1 h-3 w-3',
                                          active || isSelected ? 'text-primary-500' : 'text-gray-300'
                                        )}
                                        aria-label="High relevance"
                                      />
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </Combobox.Option>
                        )
                      })
                    )}
                  </Combobox.Options>
                )}

                {/* Search Suggestions */}
                {showSuggestions && (
                  <div className="border-t border-gray-100 px-4 py-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Suggestions
                    </p>
                    <div className="space-y-1">
                      {suggestions.map((suggestion, _index) => (
                        <button
                          key={suggestion}
                          onClick={() => setQuery(suggestion)}
                          className="flex w-full items-center rounded-md px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <ClockIcon className="mr-2 h-4 w-4 text-gray-400" />
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                {!query && (
                  <div className="border-t border-gray-100 px-4 py-4">
                    <p
                      className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3"
                      id="quick-actions"
                    >
                      Quick Actions
                    </p>
                    <div className="space-y-2" role="group" aria-labelledby="quick-actions">
                      <button
                        onClick={() => handleSelect('/app/campaigns/new')}
                        className="flex w-full items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <categoryIcons.campaigns className="mr-3 h-5 w-5 text-gray-400" />
                        Create New Campaign
                      </button>
                      <button
                        onClick={() => handleSelect('/app/dashboard')}
                        className="flex w-full items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <categoryIcons.navigation className="mr-3 h-5 w-5 text-gray-400" />
                        Go to Dashboard
                      </button>
                      <button
                        onClick={() => handleSelect('/app/settings')}
                        className="flex w-full items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <categoryIcons.settings className="mr-3 h-5 w-5 text-gray-400" />
                        Account Settings
                      </button>
                    </div>
                  </div>
                )}

                {/* Help Text */}
                <div
                  className="border-t border-gray-100 bg-gray-50 px-4 py-2.5"
                  role="region"
                  aria-label="Keyboard shortcuts"
                  id="search-help"
                >
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>
                      Press{' '}
                      <kbd className="mx-1 rounded bg-white px-1.5 py-0.5 font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300">
                        ↵
                      </kbd>{' '}
                      to select
                    </span>
                    <span>
                      Press{' '}
                      <kbd className="mx-1 rounded bg-white px-1.5 py-0.5 font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300">
                        ESC
                      </kbd>{' '}
                      to close
                    </span>
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

/**
 * Main export wrapped with error boundary
 */
export function GlobalSearchModal(props: GlobalSearchModalProps) {
  return (
    <SearchErrorBoundary>
      <GlobalSearchModalCore {...props} />
    </SearchErrorBoundary>
  )
}