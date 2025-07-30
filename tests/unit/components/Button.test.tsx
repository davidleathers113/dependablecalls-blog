import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/common/Button'

describe('Button Component', () => {
  describe('Rendering', () => {
    it('renders with text content', () => {
      render(<Button>Click me</Button>)
      expect(screen.getByRole('button')).toHaveTextContent('Click me')
    })

    it('renders different variants correctly', () => {
      const { rerender } = render(<Button variant="primary">Primary</Button>)
      expect(screen.getByRole('button')).toHaveClass('bg-blue-600')
      
      rerender(<Button variant="secondary">Secondary</Button>)
      expect(screen.getByRole('button')).toHaveClass('bg-gray-600')
      
      rerender(<Button variant="outline">Outline</Button>)
      expect(screen.getByRole('button')).toHaveClass('bg-white')
      
      rerender(<Button variant="ghost">Ghost</Button>)
      expect(screen.getByRole('button')).toHaveClass('bg-transparent')
      
      rerender(<Button variant="danger">Danger</Button>)
      expect(screen.getByRole('button')).toHaveClass('bg-red-600')
    })

    it('renders different sizes correctly', () => {
      const { rerender } = render(<Button size="sm">Small</Button>)
      expect(screen.getByRole('button')).toHaveClass('h-8')
      
      rerender(<Button size="md">Medium</Button>)
      expect(screen.getByRole('button')).toHaveClass('h-10')
      
      rerender(<Button size="lg">Large</Button>)
      expect(screen.getByRole('button')).toHaveClass('h-11')
    })

    it('renders with left icon', () => {
      const LeftIcon = () => <svg data-testid="left-icon" />
      render(<Button leftIcon={<LeftIcon />}>With Icon</Button>)
      
      expect(screen.getByTestId('left-icon')).toBeInTheDocument()
      expect(screen.getByTestId('left-icon').parentElement).toHaveClass('mr-2')
    })

    it('renders with right icon', () => {
      const RightIcon = () => <svg data-testid="right-icon" />
      render(<Button rightIcon={<RightIcon />}>With Icon</Button>)
      
      expect(screen.getByTestId('right-icon')).toBeInTheDocument()
      expect(screen.getByTestId('right-icon').parentElement).toHaveClass('ml-2')
    })

    it('renders full width when specified', () => {
      render(<Button fullWidth>Full Width</Button>)
      expect(screen.getByRole('button')).toHaveClass('w-full')
    })

    it('applies custom className', () => {
      render(<Button className="custom-class">Custom</Button>)
      expect(screen.getByRole('button')).toHaveClass('custom-class')
    })
  })

  describe('Interaction', () => {
    it('handles click events', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      
      render(<Button onClick={handleClick}>Click me</Button>)
      
      await user.click(screen.getByRole('button'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('prevents click when disabled', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      
      render(<Button disabled onClick={handleClick}>Disabled</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      
      await user.click(button)
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('prevents click when loading', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      
      render(<Button loading onClick={handleClick}>Loading</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      
      await user.click(button)
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('handles keyboard events', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      
      render(<Button onClick={handleClick}>Keyboard</Button>)
      
      const button = screen.getByRole('button')
      button.focus()
      
      await user.keyboard('{Enter}')
      expect(handleClick).toHaveBeenCalledTimes(1)
      
      await user.keyboard(' ')
      expect(handleClick).toHaveBeenCalledTimes(2)
    })
  })

  describe('Loading State', () => {
    it('shows loading spinner when loading', () => {
      render(<Button loading>Loading</Button>)
      
      const spinner = screen.getByRole('button').querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
      expect(spinner).toHaveClass('border-current')
    })

    it('hides icons when loading', () => {
      const LeftIcon = () => <svg data-testid="left-icon" />
      const RightIcon = () => <svg data-testid="right-icon" />
      
      render(
        <Button loading leftIcon={<LeftIcon />} rightIcon={<RightIcon />}>
          Loading
        </Button>
      )
      
      expect(screen.queryByTestId('left-icon')).not.toBeInTheDocument()
      expect(screen.queryByTestId('right-icon')).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper button role', () => {
      render(<Button>Accessible</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('supports aria attributes', () => {
      render(
        <Button
          aria-label="Custom action"
          aria-pressed="true"
          aria-expanded="false"
        >
          ARIA Button
        </Button>
      )
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-label', 'Custom action')
      expect(button).toHaveAttribute('aria-pressed', 'true')
      expect(button).toHaveAttribute('aria-expanded', 'false')
    })

    it('indicates disabled state properly', () => {
      render(<Button disabled>Disabled</Button>)
      expect(screen.getByRole('button')).toHaveAttribute('disabled')
    })

    it('has proper focus styles', () => {
      render(<Button>Focusable</Button>)
      const button = screen.getByRole('button')
      
      expect(button).toHaveClass('focus:outline-none')
      expect(button).toHaveClass('focus:ring-2')
      expect(button).toHaveClass('focus:ring-offset-2')
    })
  })

  describe('asChild prop', () => {
    it('renders as slot when asChild is true', () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>
      )
      
      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('href', '/test')
      expect(link).toHaveClass('bg-blue-600') // Should have button styles
    })
  })

  describe('Ref Forwarding', () => {
    it('forwards ref to button element', () => {
      const ref = vi.fn()
      render(<Button ref={ref}>Ref Button</Button>)
      
      expect(ref).toHaveBeenCalled()
      expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLButtonElement)
    })
  })

  describe('Performance', () => {
    it('renders efficiently with multiple re-renders', () => {
      const { rerender } = render(<Button>Initial</Button>)
      
      const start = performance.now()
      
      for (let i = 0; i < 100; i++) {
        rerender(<Button>Updated {i}</Button>)
      }
      
      const duration = performance.now() - start
      expect(duration).toBeLessThan(100) // Should complete within 100ms
    })
  })

  describe('Edge Cases', () => {
    it('handles missing children gracefully', () => {
      render(<Button />)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('handles null/undefined icons', () => {
      render(<Button leftIcon={null} rightIcon={undefined}>Test</Button>)
      expect(screen.getByRole('button')).toHaveTextContent('Test')
    })

    it('maintains button functionality with empty onClick', () => {
      render(<Button onClick={undefined}>No Handler</Button>)
      const button = screen.getByRole('button')
      
      // Should not throw when clicked
      expect(() => fireEvent.click(button)).not.toThrow()
    })
  })
})