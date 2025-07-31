import { describe, it, expect } from 'vitest'
import { render, screen } from '../../setup/test-utils'

// Example component test - remove this once real components are tested
const ExampleComponent = ({ title }: { title: string }) => (
  <div>
    <h1>{title}</h1>
    <p>This is an example component for testing setup verification.</p>
  </div>
)

describe('Example Component Test', () => {
  it('renders title correctly', () => {
    render(<ExampleComponent title="Test Title" />)
    
    expect(screen.getByRole('heading', { name: 'Test Title' })).toBeInTheDocument()
  })

  it('renders description text', () => {
    render(<ExampleComponent title="Test" />)
    
    expect(screen.getByText('This is an example component for testing setup verification.')).toBeInTheDocument()
  })
})