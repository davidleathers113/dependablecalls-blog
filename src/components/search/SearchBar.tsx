import React, { useState, useRef, useEffect, memo } from 'react'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useDebounce } from '../../hooks/useDebounce'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'

export interface SearchBarProps {
  /** Placeholder text for the search input */
  placeholder?: string
  /** Size variant of the search bar */
  size?: 'sm' | 'md' | 'lg'
  /** Whether the search bar should have a border */
  variant?: 'default' | 'minimal' | 'rounded'
  /** Whether to show suggestions dropdown */
  showSuggestions?: boolean
  /** Maximum number of suggestions to show */
  maxSuggestions?: number
  /** Callback when search is performed */
  onSearch?: (query: string) => void
  /** Callback when a suggestion is selected */
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void
  /** Custom suggestions to display */
  suggestions?: SearchSuggestion[]
  /** Loading state */
  isLoading?: boolean
  /** Disabled state */
  disabled?: boolean
  /** Custom CSS classes */
  className?: string
  /** ARIA label for accessibility */
  ariaLabel?: string
}

export interface SearchSuggestion {
  id: string
  title: string
  description?: string
  category: string
  url: string
  icon?: React.ComponentType<{ className?: string }>
}

const sizeClasses = {
  sm: 'h-8 text-sm',
  md: 'h-10 text-sm',
  lg: 'h-12 text-base'
}

const variantClasses = {
  default: 'border border-gray-300 bg-white shadow-sm',
  minimal: 'border-0 bg-gray-50',
  rounded: 'border border-gray-300 bg-white shadow-sm rounded-full'
}

const SearchBarCore = memo<SearchBarProps>(({
  placeholder = 'Search...',
  size = 'md',
  variant = 'default',
  showSuggestions = true,
  maxSuggestions = 5,
  onSearch,
  onSuggestionSelect,
  suggestions = [],
  isLoading = false,
  disabled = false,
  className = '',
  ariaLabel = 'Search'
}) => {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  
  const debouncedQuery = useDebounce(query, 300)
  
  // Filter suggestions based on query
  const filteredSuggestions = React.useMemo(() => {
    if (!debouncedQuery.trim() || !suggestions.length) return []
    
    const lowercaseQuery = debouncedQuery.toLowerCase()
    return suggestions
      .filter(suggestion => 
        suggestion.title.toLowerCase().includes(lowercaseQuery) ||
        suggestion.description?.toLowerCase().includes(lowercaseQuery) ||
        suggestion.category.toLowerCase().includes(lowercaseQuery)
      )
      .slice(0, maxSuggestions)
  }, [debouncedQuery, suggestions, maxSuggestions])
  
  // Handle search submission
  const handleSearch = React.useCallback((searchQuery: string = query) => {
    if (!searchQuery.trim()) return
    
    onSearch?.(searchQuery.trim())
    setIsFocused(false)
    setSelectedIndex(-1)
  }, [query, onSearch])
  
  // Handle suggestion selection
  const handleSuggestionSelect = React.useCallback((suggestion: SearchSuggestion) => {
    if (onSuggestionSelect) {
      onSuggestionSelect(suggestion)
    } else {
      // Default behavior: navigate to suggestion URL
      navigate(suggestion.url)
    }
    
    setQuery('')
    setIsFocused(false)
    setSelectedIndex(-1)
    inputRef.current?.blur()
  }, [onSuggestionSelect, navigate])
  
  // Handle keyboard navigation
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const suggestionsCount = filteredSuggestions.length
    
    switch (e.key) {
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && filteredSuggestions[selectedIndex]) {
          handleSuggestionSelect(filteredSuggestions[selectedIndex])
        } else {
          handleSearch()
        }
        break
        
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < suggestionsCount - 1 ? prev + 1 : 0
        )
        break
        
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestionsCount - 1
        )
        break
        
      case 'Escape':
        setIsFocused(false)
        setSelectedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }, [selectedIndex, filteredSuggestions, handleSearch, handleSuggestionSelect])
  
  // Clear search
  const clearSearch = React.useCallback(() => {
    setQuery('')
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }, [])
  
  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsFocused(false)
        setSelectedIndex(-1)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(-1)
  }, [filteredSuggestions])
  
  const showSuggestionsDropdown = showSuggestions && 
    isFocused && 
    (filteredSuggestions.length > 0 || isLoading)
  
  return (
    <div className={clsx('relative', className)}>
      {/* Search Input */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <MagnifyingGlassIcon 
            className={clsx(
              'h-5 w-5',
              disabled ? 'text-gray-400' : 'text-gray-400'
            )} 
            aria-hidden="true" 
          />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          className={clsx(
            'block w-full pl-10 pr-10 placeholder:text-gray-400 focus:border-primary-500 focus:ring-primary-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
            sizeClasses[size],
            variantClasses[variant],
            variant === 'rounded' ? 'rounded-full' : 'rounded-md'
          )}
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          aria-label={ariaLabel}
          aria-expanded={showSuggestionsDropdown}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-activedescendant={
            selectedIndex >= 0 ? `search-suggestion-${selectedIndex}` : undefined
          }
          role="combobox"
        />
        
        {/* Clear button */}
        {query && !disabled && (
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-sm"
            onClick={clearSearch}
            aria-label="Clear search"
          >
            <XMarkIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        )}
      </div>
      
      {/* Suggestions Dropdown */}
      {showSuggestionsDropdown && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-80 overflow-auto rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
          role="listbox"
          aria-label="Search suggestions"
        >
          {isLoading ? (
            <div className="px-4 py-2 text-center" role="status" aria-live="polite">
              <div className="inline-flex items-center">
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
                <span className="text-sm text-gray-600">Searching...</span>
              </div>
            </div>
          ) : filteredSuggestions.length > 0 ? (
            filteredSuggestions.map((suggestion, index) => {
              const isSelected = index === selectedIndex
              const Icon = suggestion.icon
              
              return (
                <button
                  key={suggestion.id}
                  id={`search-suggestion-${index}`}
                  className={clsx(
                    'flex w-full items-start px-4 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none',
                    isSelected && 'bg-primary-50'
                  )}
                  onClick={() => handleSuggestionSelect(suggestion)}
                  role="option"
                  aria-selected={isSelected}
                >
                  {Icon && (
                    <Icon 
                      className={clsx(
                        'mt-0.5 mr-3 h-5 w-5 flex-shrink-0',
                        isSelected ? 'text-primary-600' : 'text-gray-400'
                      )} 
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={clsx(
                      'text-sm font-medium truncate',
                      isSelected ? 'text-primary-900' : 'text-gray-900'
                    )}>
                      {suggestion.title}
                    </p>
                    {suggestion.description && (
                      <p className={clsx(
                        'mt-0.5 text-xs truncate',
                        isSelected ? 'text-primary-700' : 'text-gray-500'
                      )}>
                        {suggestion.description}
                      </p>
                    )}
                    <p className={clsx(
                      'mt-0.5 text-xs truncate',
                      isSelected ? 'text-primary-600' : 'text-gray-400'
                    )}>
                      {suggestion.category}
                    </p>
                  </div>
                </button>
              )
            })
          ) : query.trim() && (
            <div className="px-4 py-2 text-center text-sm text-gray-500">
              No results found for "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  )
})

SearchBarCore.displayName = 'SearchBar'

export const SearchBar = SearchBarCore