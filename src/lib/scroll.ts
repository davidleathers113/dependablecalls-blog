/**
 * Smooth scroll utility functions
 */

export function scrollToElement(elementId: string, offset: number = 80): void {
  const element = document.getElementById(elementId)
  if (!element) {
    console.warn(`Element with id "${elementId}" not found`)
    return
  }

  const elementPosition = element.getBoundingClientRect().top + window.pageYOffset
  const offsetPosition = elementPosition - offset

  window.scrollTo({
    top: offsetPosition,
    behavior: 'smooth',
  })
}

export function scrollToTop(): void {
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}

export function handleAnchorClick(
  event: React.MouseEvent<HTMLAnchorElement>,
  targetId: string,
  offset: number = 80
): void {
  event.preventDefault()
  scrollToElement(targetId, offset)
}
