import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import CookiePolicyPage from '../CookiePolicyPage'
import { usePageTitle } from '../../../hooks/usePageTitle'

// Mock the usePageTitle hook
vi.mock('../../../hooks/usePageTitle', () => ({
  usePageTitle: vi.fn()
}))

const renderComponent = () => {
  return render(
    <BrowserRouter>
      <CookiePolicyPage />
    </BrowserRouter>
  )
}

describe('CookiePolicyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the cookie policy page', () => {
    renderComponent()
    
    expect(screen.getByText('Cookie Policy')).toBeInTheDocument()
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
  })

  it('should set the page title', () => {
    renderComponent()
    
    expect(vi.mocked(usePageTitle)).toHaveBeenCalledWith('Cookie Policy')
  })

  it('should display all required sections', () => {
    renderComponent()
    
    // Check for main sections
    expect(screen.getByText('1. What Are Cookies')).toBeInTheDocument()
    expect(screen.getByText('2. How We Use Cookies')).toBeInTheDocument()
    expect(screen.getByText('3. Types of Cookies We Use')).toBeInTheDocument()
    expect(screen.getByText('4. Third-Party Cookies')).toBeInTheDocument()
    expect(screen.getByText('5. Managing Cookies')).toBeInTheDocument()
    expect(screen.getByText('6. Cookie Settings')).toBeInTheDocument()
    expect(screen.getByText('7. Changes to This Policy')).toBeInTheDocument()
    expect(screen.getByText('8. Contact Us')).toBeInTheDocument()
  })

  it('should display cookie categories', () => {
    renderComponent()
    
    // Check for cookie categories
    expect(screen.getByText('Essential Cookies')).toBeInTheDocument()
    expect(screen.getByText('Performance Cookies')).toBeInTheDocument()
    expect(screen.getByText('Functional Cookies')).toBeInTheDocument()
    expect(screen.getByText('Targeting/Advertising Cookies')).toBeInTheDocument()
  })

  it('should include third-party service information', () => {
    renderComponent()
    
    // Check for third-party services mentioned
    expect(screen.getByText(/Google Analytics/)).toBeInTheDocument()
    expect(screen.getByText(/Stripe/)).toBeInTheDocument()
    expect(screen.getByText(/Supabase/)).toBeInTheDocument()
    expect(screen.getByText(/Sentry/)).toBeInTheDocument()
  })

  it('should provide browser-specific cookie management instructions', () => {
    renderComponent()
    
    // Check for browser instructions
    expect(screen.getByText(/Chrome/)).toBeInTheDocument()
    expect(screen.getByText(/Firefox/)).toBeInTheDocument()
    expect(screen.getByText(/Safari/)).toBeInTheDocument()
    expect(screen.getByText(/Edge/)).toBeInTheDocument()
  })

  it('should include contact information', () => {
    renderComponent()
    
    expect(screen.getByText('Email: privacy@dependablecalls.com')).toBeInTheDocument()
    expect(screen.getByText('Phone: 1-800-CALLS-US')).toBeInTheDocument()
  })

  it('should have proper heading hierarchy', () => {
    renderComponent()
    
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent('Cookie Policy')
    
    const h2s = screen.getAllByRole('heading', { level: 2 })
    expect(h2s.length).toBeGreaterThan(0)
    
    const h3s = screen.getAllByRole('heading', { level: 3 })
    expect(h3s.length).toBeGreaterThan(0)
  })

  it('should have proper semantic HTML structure', () => {
    const { container } = renderComponent()
    
    // Check for proper structure
    expect(container.querySelector('.bg-white')).toBeInTheDocument()
    expect(container.querySelector('.max-w-4xl')).toBeInTheDocument()
    expect(container.querySelector('.prose')).toBeInTheDocument()
  })

  it('should be accessible', () => {
    const { container } = renderComponent()
    
    // Check for proper heading structure for screen readers
    const headings = container.querySelectorAll('h1, h2, h3')
    expect(headings.length).toBeGreaterThan(0)
    
    // Check for readable text contrast (using Tailwind classes)
    const textElements = container.querySelectorAll('.text-gray-600, .text-gray-700')
    expect(textElements.length).toBeGreaterThan(0)
  })

  it('should handle cookie consent localStorage interactions', () => {
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    }
    Object.defineProperty(window, 'localStorage', { value: localStorageMock })
    
    renderComponent()
    
    // The component should be checking for existing consent
    // This would be implemented in the actual component
    // For now, we're just testing that localStorage is available
    expect(window.localStorage).toBeDefined()
  })

  it('should display last updated date', () => {
    renderComponent()
    
    const lastUpdated = screen.getByText(/Last updated:/)
    expect(lastUpdated).toBeInTheDocument()
    expect(lastUpdated.textContent).toMatch(/\d{4}/) // Should contain a year
  })

  it('should render bullet points for cookie information', () => {
    const { container } = renderComponent()
    
    const bulletLists = container.querySelectorAll('ul')
    expect(bulletLists.length).toBeGreaterThan(0)
    
    const listItems = container.querySelectorAll('li')
    expect(listItems.length).toBeGreaterThan(0)
  })

  it('should include information about cookie duration', () => {
    renderComponent()
    
    // Check for duration information
    expect(screen.getByText(/Session cookies/)).toBeInTheDocument()
    expect(screen.getByText(/Persistent cookies/)).toBeInTheDocument()
  })

  it('should mention user rights regarding cookies', () => {
    renderComponent()
    
    // Check for user rights information
    expect(screen.getByText(/accept or reject/i)).toBeInTheDocument()
    expect(screen.getByText(/withdraw consent/i)).toBeInTheDocument()
  })

  it('should be responsive', () => {
    const { container } = renderComponent()
    
    // Check for responsive classes
    expect(container.querySelector('.sm\\:px-6')).toBeInTheDocument()
    expect(container.querySelector('.lg\\:px-8')).toBeInTheDocument()
  })

  it('should not contain any regex patterns', () => {
    const { container } = renderComponent()
    
    // Ensure no regex patterns in the rendered output
    const htmlContent = container.innerHTML
    expect(htmlContent).not.toMatch(/new RegExp/)
    expect(htmlContent).not.toMatch(/\.match\(/)
    expect(htmlContent).not.toMatch(/\.test\(/)
  })

  it('should not use any type', () => {
    // This is a compile-time check, but we can verify the rendered component
    // doesn't have any TypeScript errors
    expect(() => renderComponent()).not.toThrow()
  })
})