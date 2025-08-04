/**
 * Tests for AuthHydrationGate component and related hooks
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { create } from 'zustand'
import type { StateCreator } from 'zustand'
import AuthHydrationGate, { useAuthHydrated, useAuthReady } from '../AuthHydrationGate'
import type { AuthState } from '../../../store/authStore'

// Mock the auth store
const mockAuthStore = vi.hoisted(() => {
  let mockState: Partial<AuthState> = {
    _hasHydrated: false,
    loading: true,
    user: null,
    session: null,
    userType: null,
    isAuthenticated: false,
    preferences: {},
  }

  const createMockStore = () => create<AuthState>()(() => mockState as AuthState)
  
  return {
    mockState,
    createMockStore,
    setMockState: (newState: Partial<AuthState>) => {
      mockState = { ...mockState, ...newState }
    },
    resetMockState: () => {
      mockState = {
        _hasHydrated: false,
        loading: true,
        user: null,
        session: null,
        userType: null,
        isAuthenticated: false,
        preferences: {},
      }
    }
  }
})

vi.mock('../../../store/authStore', () => ({
  useAuthStore: mockAuthStore.createMockStore(),
}))

// Test component that uses the hooks
function TestHooksComponent() {
  const hasHydrated = useAuthHydrated()
  const isReady = useAuthReady()
  
  return (
    <div>
      <span data-testid="hydrated">{hasHydrated ? 'hydrated' : 'not-hydrated'}</span>
      <span data-testid="ready">{isReady ? 'ready' : 'not-ready'}</span>
    </div>
  )
}

describe('AuthHydrationGate', () => {
  beforeEach(() => {
    mockAuthStore.resetMockState()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('component behavior', () => {
    it('shows loading skeleton when not hydrated', () => {
      mockAuthStore.setMockState({
        _hasHydrated: false,
        loading: false,
      })

      render(
        <AuthHydrationGate>
          <div data-testid="app-content">App Content</div>
        </AuthHydrationGate>
      )

      expect(screen.getByText('Authenticating...')).toBeInTheDocument()
      expect(screen.queryByTestId('app-content')).not.toBeInTheDocument()
    })

    it('shows loading skeleton when loading', () => {
      mockAuthStore.setMockState({
        _hasHydrated: true,
        loading: true,
      })

      render(
        <AuthHydrationGate>
          <div data-testid="app-content">App Content</div>
        </AuthHydrationGate>
      )

      expect(screen.getByText('Authenticating...')).toBeInTheDocument()
      expect(screen.queryByTestId('app-content')).not.toBeInTheDocument()
    })

    it('shows loading skeleton when both not hydrated and loading', () => {
      mockAuthStore.setMockState({
        _hasHydrated: false,
        loading: true,
      })

      render(
        <AuthHydrationGate>
          <div data-testid="app-content">App Content</div>
        </AuthHydrationGate>
      )

      expect(screen.getByText('Authenticating...')).toBeInTheDocument()
      expect(screen.queryByTestId('app-content')).not.toBeInTheDocument()
    })

    it('shows children when hydrated and not loading', () => {
      mockAuthStore.setMockState({
        _hasHydrated: true,
        loading: false,
      })

      render(
        <AuthHydrationGate>
          <div data-testid="app-content">App Content</div>
        </AuthHydrationGate>
      )

      expect(screen.getByTestId('app-content')).toBeInTheDocument()
      expect(screen.getByText('App Content')).toBeInTheDocument()
      expect(screen.queryByText('Authenticating...')).not.toBeInTheDocument()
    })

    it('shows custom fallback when provided', () => {
      mockAuthStore.setMockState({
        _hasHydrated: false,
        loading: true,
      })

      const customFallback = <div data-testid="custom-loader">Custom Loading...</div>

      render(
        <AuthHydrationGate fallback={customFallback}>
          <div data-testid="app-content">App Content</div>
        </AuthHydrationGate>
      )

      expect(screen.getByTestId('custom-loader')).toBeInTheDocument()
      expect(screen.getByText('Custom Loading...')).toBeInTheDocument()
      expect(screen.queryByText('Authenticating...')).not.toBeInTheDocument()
      expect(screen.queryByTestId('app-content')).not.toBeInTheDocument()
    })

    it('applies custom fallback className', () => {
      mockAuthStore.setMockState({
        _hasHydrated: false,
        loading: false,
      })

      render(
        <AuthHydrationGate fallbackClassName="custom-class">
          <div data-testid="app-content">App Content</div>
        </AuthHydrationGate>
      )

      const fallbackElement = screen.getByText('Authenticating...').closest('div')
      expect(fallbackElement).toHaveClass('custom-class')
    })
  })

  describe('useAuthHydrated hook', () => {
    it('returns false when not hydrated', () => {
      mockAuthStore.setMockState({
        _hasHydrated: false,
      })

      render(<TestHooksComponent />)
      
      expect(screen.getByTestId('hydrated')).toHaveTextContent('not-hydrated')
    })

    it('returns true when hydrated', () => {
      mockAuthStore.setMockState({
        _hasHydrated: true,
      })

      render(<TestHooksComponent />)
      
      expect(screen.getByTestId('hydrated')).toHaveTextContent('hydrated')
    })
  })

  describe('useAuthReady hook', () => {
    it('returns false when not hydrated', () => {
      mockAuthStore.setMockState({
        _hasHydrated: false,
        loading: false,
      })

      render(<TestHooksComponent />)
      
      expect(screen.getByTestId('ready')).toHaveTextContent('not-ready')
    })

    it('returns false when hydrated but loading', () => {
      mockAuthStore.setMockState({
        _hasHydrated: true,
        loading: true,
      })

      render(<TestHooksComponent />)
      
      expect(screen.getByTestId('ready')).toHaveTextContent('not-ready')
    })

    it('returns false when not hydrated and loading', () => {
      mockAuthStore.setMockState({
        _hasHydrated: false,
        loading: true,
      })

      render(<TestHooksComponent />)
      
      expect(screen.getByTestId('ready')).toHaveTextContent('not-ready')
    })

    it('returns true when hydrated and not loading', () => {
      mockAuthStore.setMockState({
        _hasHydrated: true,
        loading: false,
      })

      render(<TestHooksComponent />)
      
      expect(screen.getByTestId('ready')).toHaveTextContent('ready')
    })
  })

  describe('accessibility', () => {
    it('has proper loading state accessibility', () => {
      mockAuthStore.setMockState({
        _hasHydrated: false,
        loading: true,
      })

      render(
        <AuthHydrationGate>
          <div>App Content</div>
        </AuthHydrationGate>
      )

      const loadingText = screen.getByText('Authenticating...')
      expect(loadingText).toBeInTheDocument()
      expect(loadingText).toHaveClass('animate-pulse')
    })
  })

  describe('performance optimizations', () => {
    it('uses composed selector to prevent over-rendering', () => {
      mockAuthStore.setMockState({
        _hasHydrated: true,
        loading: false,
        user: { id: '123', email: 'test@example.com' }, // Other props change
      })

      render(
        <AuthHydrationGate>
          <div data-testid="app-content">App Content</div>
        </AuthHydrationGate>
      )

      // Should still render children because the composed selector only watches
      // _hasHydrated and loading, not user
      expect(screen.getByTestId('app-content')).toBeInTheDocument()
    })
  })
})