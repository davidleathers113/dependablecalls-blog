/**
 * Scroll to element with smooth behavior and proper offset
 * @param elementId - The ID of the element to scroll to (without #)
 */
export function scrollToElement(elementId: string): void {
  const element = document.getElementById(elementId)
  if (element) {
    const offset = 80 // Account for fixed header
    const elementPosition = element.getBoundingClientRect().top + window.pageYOffset
    const offsetPosition = elementPosition - offset

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth',
    })
  }
}

/**
 * Handle hash change events for smooth scrolling
 */
export function handleHashChange(): void {
  const hash = window.location.hash
  if (hash) {
    const elementId = hash.substring(1) // Remove the #
    // Small delay to ensure the page has rendered
    setTimeout(() => {
      scrollToElement(elementId)
    }, 100)
  }
}

/**
 * Navigate to homepage section with smooth scrolling
 * @param sectionId - The section ID to scroll to
 */
export function navigateToHomeSection(sectionId: string): void {
  // If we're not on the homepage, navigate there first
  if (window.location.pathname !== '/') {
    window.location.href = `/#${sectionId}`
    return
  }

  // If we're already on the homepage, just scroll
  scrollToElement(sectionId)
}
