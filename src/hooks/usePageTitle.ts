import { useEffect } from 'react'

/**
 * Custom hook to set the page title
 * @param title - The page title (without the site name suffix)
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    const previousTitle = document.title
    document.title = `${title} - DependableCalls`

    // Cleanup function to restore previous title
    return () => {
      document.title = previousTitle
    }
  }, [title])
}