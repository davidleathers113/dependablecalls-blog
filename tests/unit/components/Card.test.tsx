import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/common/Card'

describe('Card Component', () => {
  describe('Basic Card', () => {
    it('renders children content', () => {
      render(<Card>Card content</Card>)
      expect(screen.getByText('Card content')).toBeInTheDocument()
    })

    it('renders different variants', () => {
      const { rerender } = render(<Card variant="default">Default</Card>)
      expect(screen.getByText('Default').parentElement).toHaveClass('shadow-sm')
      
      rerender(<Card variant="bordered">Bordered</Card>)
      expect(screen.getByText('Bordered').parentElement).toHaveClass('border-gray-200')
      
      rerender(<Card variant="elevated">Elevated</Card>)
      expect(screen.getByText('Elevated').parentElement).toHaveClass('shadow-lg')
    })

    it('applies different padding sizes', () => {
      const { rerender } = render(<Card padding="none">No padding</Card>)
      expect(screen.getByText('No padding').parentElement).not.toHaveClass('p-4', 'p-6', 'p-8')
      
      rerender(<Card padding="sm">Small padding</Card>)
      expect(screen.getByText('Small padding').parentElement).toHaveClass('p-4')
      
      rerender(<Card padding="md">Medium padding</Card>)
      expect(screen.getByText('Medium padding').parentElement).toHaveClass('p-6')
      
      rerender(<Card padding="lg">Large padding</Card>)
      expect(screen.getByText('Large padding').parentElement).toHaveClass('p-8')
    })

    it('applies hover effect when enabled', () => {
      render(<Card hover>Hoverable</Card>)
      expect(screen.getByText('Hoverable').parentElement).toHaveClass('hover:shadow-md')
    })

    it('applies clickable styles when enabled', () => {
      render(<Card clickable>Clickable</Card>)
      expect(screen.getByText('Clickable').parentElement).toHaveClass('cursor-pointer')
    })

    it('combines hover and clickable properties', () => {
      render(<Card hover clickable>Interactive</Card>)
      const card = screen.getByText('Interactive').parentElement
      expect(card).toHaveClass('hover:shadow-md')
      expect(card).toHaveClass('cursor-pointer')
    })

    it('applies custom className', () => {
      render(<Card className="custom-card">Custom</Card>)
      expect(screen.getByText('Custom').parentElement).toHaveClass('custom-card')
    })

    it('forwards ref correctly', () => {
      const ref = vi.fn()
      render(<Card ref={ref}>Ref Card</Card>)
      
      expect(ref).toHaveBeenCalled()
      expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLDivElement)
    })

    it('handles click events', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      
      render(<Card onClick={handleClick} clickable>Click me</Card>)
      
      await user.click(screen.getByText('Click me').parentElement!)
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('passes through HTML attributes', () => {
      render(
        <Card 
          id="test-card" 
          data-testid="card-test"
          role="article"
          aria-label="Test card"
        >
          With attributes
        </Card>
      )
      
      const card = screen.getByText('With attributes').parentElement
      expect(card).toHaveAttribute('id', 'test-card')
      expect(card).toHaveAttribute('data-testid', 'card-test')
      expect(card).toHaveAttribute('role', 'article')
      expect(card).toHaveAttribute('aria-label', 'Test card')
    })
  })

  describe('CardHeader Component', () => {
    it('renders title and description', () => {
      render(
        <CardHeader 
          title="Card Title" 
          description="Card description text"
        />
      )
      
      expect(screen.getByText('Card Title')).toBeInTheDocument()
      expect(screen.getByText('Card Title')).toHaveClass('text-lg', 'font-semibold')
      expect(screen.getByText('Card description text')).toBeInTheDocument()
      expect(screen.getByText('Card description text')).toHaveClass('text-sm', 'text-gray-500')
    })

    it('renders actions', () => {
      const ActionButton = () => <button>Action</button>
      render(
        <CardHeader 
          title="With Actions"
          actions={<ActionButton />}
        />
      )
      
      expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
    })

    it('renders children instead of title/description', () => {
      render(
        <CardHeader>
          <h4>Custom header content</h4>
        </CardHeader>
      )
      
      expect(screen.getByText('Custom header content')).toBeInTheDocument()
    })

    it('applies border bottom style', () => {
      render(<CardHeader title="Bordered" />)
      expect(screen.getByText('Bordered').parentElement?.parentElement).toHaveClass('border-b', 'border-gray-200')
    })

    it('applies custom className', () => {
      render(<CardHeader className="custom-header" title="Custom" />)
      expect(screen.getByText('Custom').parentElement?.parentElement).toHaveClass('custom-header')
    })

    it('handles long title with truncation', () => {
      render(
        <CardHeader 
          title="This is a very long title that should be truncated when it exceeds the available space"
        />
      )
      
      expect(screen.getByText(/This is a very long title/)).toHaveClass('truncate')
    })
  })

  describe('CardContent Component', () => {
    it('renders children', () => {
      render(
        <CardContent>
          <p>Content paragraph</p>
        </CardContent>
      )
      
      expect(screen.getByText('Content paragraph')).toBeInTheDocument()
    })

    it('applies vertical padding', () => {
      render(<CardContent>Padded content</CardContent>)
      expect(screen.getByText('Padded content').parentElement).toHaveClass('py-4')
    })

    it('applies custom className', () => {
      render(<CardContent className="custom-content">Custom</CardContent>)
      expect(screen.getByText('Custom').parentElement).toHaveClass('custom-content')
    })

    it('forwards ref correctly', () => {
      const ref = vi.fn()
      render(<CardContent ref={ref}>Ref content</CardContent>)
      
      expect(ref).toHaveBeenCalled()
      expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLDivElement)
    })
  })

  describe('CardFooter Component', () => {
    it('renders children', () => {
      render(
        <CardFooter>
          <button>Footer action</button>
        </CardFooter>
      )
      
      expect(screen.getByRole('button', { name: 'Footer action' })).toBeInTheDocument()
    })

    it('applies border top style', () => {
      render(<CardFooter>Footer content</CardFooter>)
      expect(screen.getByText('Footer content').parentElement).toHaveClass('border-t', 'border-gray-200')
    })

    it('applies top padding', () => {
      render(<CardFooter>Padded footer</CardFooter>)
      expect(screen.getByText('Padded footer').parentElement).toHaveClass('pt-4')
    })

    it('applies custom className', () => {
      render(<CardFooter className="custom-footer">Custom</CardFooter>)
      expect(screen.getByText('Custom').parentElement).toHaveClass('custom-footer')
    })
  })

  describe('Card Composition', () => {
    it('renders complete card with all sections', () => {
      render(
        <Card>
          <CardHeader 
            title="Complete Card" 
            description="With all sections"
            actions={<button>Edit</button>}
          />
          <CardContent>
            <p>Main content goes here</p>
          </CardContent>
          <CardFooter>
            <button>Save</button>
            <button>Cancel</button>
          </CardFooter>
        </Card>
      )
      
      expect(screen.getByText('Complete Card')).toBeInTheDocument()
      expect(screen.getByText('With all sections')).toBeInTheDocument()
      expect(screen.getByText('Main content goes here')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    })

    it('maintains proper layout structure', () => {
      const { container } = render(
        <Card>
          <CardHeader title="Layout Test" />
          <CardContent>Content</CardContent>
          <CardFooter>Footer</CardFooter>
        </Card>
      )
      
      const card = container.firstChild as HTMLElement
      expect(card.children).toHaveLength(3)
      expect(card.children[0]).toHaveClass('border-b') // Header
      expect(card.children[1]).toHaveClass('py-4') // Content
      expect(card.children[2]).toHaveClass('border-t') // Footer
    })
  })

  describe('Accessibility', () => {
    it('supports ARIA attributes on Card', () => {
      render(
        <Card role="article" aria-label="Product card">
          <CardContent>Product info</CardContent>
        </Card>
      )
      
      const card = screen.getByRole('article')
      expect(card).toHaveAttribute('aria-label', 'Product card')
    })

    it('maintains semantic HTML structure', () => {
      render(
        <Card>
          <CardHeader>
            <h2>Semantic Header</h2>
          </CardHeader>
          <CardContent>
            <p>Semantic paragraph</p>
          </CardContent>
        </Card>
      )
      
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
      expect(screen.getByText('Semantic paragraph').tagName).toBe('P')
    })

    it('supports keyboard navigation for clickable cards', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      
      render(
        <Card clickable onClick={handleClick} tabIndex={0}>
          Keyboard accessible
        </Card>
      )
      
      const card = screen.getByText('Keyboard accessible').parentElement
      card?.focus()
      
      await user.keyboard('{Enter}')
      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('Performance', () => {
    it('renders efficiently with complex content', () => {
      const start = performance.now()
      
      const { rerender } = render(
        <Card>
          <CardHeader title="Performance Test" description="Initial" />
          <CardContent>
            {Array.from({ length: 100 }, (_, i) => (
              <div key={i}>Item {i}</div>
            ))}
          </CardContent>
        </Card>
      )
      
      // Multiple re-renders
      for (let i = 0; i < 10; i++) {
        rerender(
          <Card>
            <CardHeader title="Performance Test" description={`Update ${i}`} />
            <CardContent>
              {Array.from({ length: 100 }, (_, j) => (
                <div key={j}>Item {j} - {i}</div>
              ))}
            </CardContent>
          </Card>
        )
      }
      
      const duration = performance.now() - start
      expect(duration).toBeLessThan(200) // Should complete within 200ms
    })
  })

  describe('Edge Cases', () => {
    it('handles empty card gracefully', () => {
      render(<Card />)
      expect(document.querySelector('.rounded-lg')).toBeInTheDocument()
    })

    it('handles CardHeader without props', () => {
      render(<CardHeader />)
      // Should render without errors
      expect(document.querySelector('.border-b')).toBeInTheDocument()
    })

    it('handles deeply nested content', () => {
      render(
        <Card>
          <CardContent>
            <Card variant="bordered">
              <CardContent>
                <Card variant="elevated">
                  <CardContent>Deeply nested</CardContent>
                </Card>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      )
      
      expect(screen.getByText('Deeply nested')).toBeInTheDocument()
    })
  })
})