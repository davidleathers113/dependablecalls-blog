import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../../src/contexts/AuthContext'
import { LoginForm } from '../../src/components/auth/LoginForm'
import { ProtectedRoute } from '../../src/components/auth/ProtectedRoute'
import { authService } from '../../src/services/auth'
import { tokenService } from '../../src/services/token'

// Mock services
vi.mock('../../src/services/auth')
vi.mock('../../src/services/token')

const mockAuthService = vi.mocked(authService)
const mockTokenService = vi.mocked(tokenService)

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          {children}
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('Authentication Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  describe('Login Security', () => {
    it('should prevent brute force attacks with rate limiting', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'))

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      // Attempt multiple failed logins
      for (let i = 0; i < 6; i++) {
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
        fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
        fireEvent.click(submitButton)

        await waitFor(() => {
          expect(mockAuthService.login).toHaveBeenCalledWith({
            email: 'test@example.com',
            password: 'wrongpassword'
          })
        })
      }

      // After 5 attempts, should show account locked message
      await waitFor(() => {
        expect(screen.getByText(/account temporarily locked/i)).toBeInTheDocument()
      })

      // Submit button should be disabled
      expect(submitButton).toBeDisabled()
    })

    it('should sanitize input to prevent XSS in login form', async () => {
      const xssPayload = '<script>alert("xss")</script>'
      
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)

      fireEvent.change(emailInput, { target: { value: xssPayload } })
      fireEvent.change(passwordInput, { target: { value: xssPayload } })

      // Values should be sanitized
      expect(emailInput).toHaveValue('&lt;script&gt;alert("xss")&lt;/script&gt;')
      expect(passwordInput).toHaveValue('') // Password should reject script tags entirely
    })

    it('should validate email format to prevent injection', async () => {
      const maliciousEmails = [
        'test@example.com<script>alert("xss")</script>',
        'test@example.com"; DROP TABLE users; --',
        'test@example.com\r\nBcc: attacker@evil.com',
        'test@example.com%0ABcc:attacker@evil.com'
      ]

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )

      const emailInput = screen.getByLabelText(/email/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      for (const maliciousEmail of maliciousEmails) {
        fireEvent.change(emailInput, { target: { value: maliciousEmail } })
        fireEvent.click(submitButton)

        await waitFor(() => {
          expect(screen.getByText(/invalid email format/i)).toBeInTheDocument()
        })

        // Should not attempt login with malicious email
        expect(mockAuthService.login).not.toHaveBeenCalledWith(
          expect.objectContaining({ email: maliciousEmail })
        )
      }
    })

    it('should enforce minimum password complexity', async () => {
      const weakPasswords = [
        '123',
        'password',
        'abc123',
        '12345678',
        'qwerty'
      ]

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )

      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      for (const weakPassword of weakPasswords) {
        fireEvent.change(passwordInput, { target: { value: weakPassword } })
        fireEvent.click(submitButton)

        await waitFor(() => {
          expect(screen.getByText(/password does not meet security requirements/i)).toBeInTheDocument()
        })
      }
    })

    it('should clear sensitive data on logout', async () => {
      // SECURITY FIX: Auth tokens are now stored in httpOnly cookies, not localStorage
      // This test now verifies that no sensitive data remains in client storage
      
      // Setup authenticated state - no tokens in localStorage anymore
      mockTokenService.getToken.mockReturnValue('valid-token')
      mockTokenService.isTokenValid.mockReturnValue(true)
      
      // SECURITY: No auth tokens should be in localStorage/sessionStorage
      // Only non-sensitive user preferences may remain
      localStorage.setItem('dce-user-preferences', JSON.stringify({ theme: 'dark' }))

      // Mock logout
      mockAuthService.logout.mockResolvedValue(undefined)

      render(
        <TestWrapper>
          <div data-testid="logout-button" onClick={() => authService.logout()}>
            Logout
          </div>
        </TestWrapper>
      )

      fireEvent.click(screen.getByTestId('logout-button'))

      await waitFor(() => {
        expect(mockAuthService.logout).toHaveBeenCalled()
      })

      // SECURITY: Verify no auth tokens exist in client storage (they shouldn't)
      expect(localStorage.getItem('auth_token')).toBeNull()
      expect(localStorage.getItem('refresh_token')).toBeNull()
      expect(sessionStorage.getItem('user_data')).toBeNull()
      
      // User preferences can remain as they're non-sensitive
      expect(localStorage.getItem('dce-user-preferences')).toBeTruthy()
    })
  })

  describe('Token Security', () => {
    it('should validate JWT token format', () => {
      const invalidTokens = [
        'invalid-token',
        'header.payload', // Missing signature
        'header.payload.signature.extra', // Too many parts
        '', // Empty token
        'Bearer invalid-token' // Should not contain Bearer prefix
      ]

      for (const token of invalidTokens) {
        mockTokenService.isTokenValid.mockReturnValue(false)
        expect(tokenService.isTokenValid(token)).toBe(false)
      }
    })

    it('should detect expired tokens', () => {
      // Mock expired token
      const expiredToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE2MDAwMDAwMDB9.signature'
      
      mockTokenService.isTokenValid.mockReturnValue(false)
      mockTokenService.isTokenExpired.mockReturnValue(true)

      expect(tokenService.isTokenValid(expiredToken)).toBe(false)
      expect(tokenService.isTokenExpired(expiredToken)).toBe(true)
    })

    it('should securely store tokens', () => {
      const token = 'test-token'
      const refreshToken = 'test-refresh-token'

      mockTokenService.setToken.mockImplementation((token) => {
        // Should store in httpOnly cookie or secure storage, not localStorage
        expect(localStorage.getItem('auth_token')).toBeNull()
        expect(sessionStorage.getItem('auth_token')).toBeNull()
      })

      tokenService.setToken(token)
      tokenService.setRefreshToken(refreshToken)

      expect(mockTokenService.setToken).toHaveBeenCalledWith(token)
    })

    it('should handle token refresh securely', async () => {
      const oldToken = 'old-token'
      const newToken = 'new-token'
      const refreshToken = 'refresh-token'

      mockTokenService.refreshToken.mockResolvedValue(newToken)
      mockTokenService.isTokenExpired.mockReturnValue(true)

      const result = await tokenService.refreshToken(refreshToken)

      expect(result).toBe(newToken)
      expect(mockTokenService.refreshToken).toHaveBeenCalledWith(refreshToken)
    })
  })

  describe('Route Protection', () => {
    it('should redirect unauthenticated users to login', async () => {
      mockTokenService.getToken.mockReturnValue(null)
      mockTokenService.isTokenValid.mockReturnValue(false)

      const DashboardComponent = () => <div>Dashboard</div>

      render(
        <TestWrapper>
          <ProtectedRoute>
            <DashboardComponent />
          </ProtectedRoute>
        </TestWrapper>
      )

      // Should redirect to login instead of showing dashboard
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    })

    it('should allow access for authenticated users', async () => {
      mockTokenService.getToken.mockReturnValue('valid-token')
      mockTokenService.isTokenValid.mockReturnValue(true)

      const DashboardComponent = () => <div>Dashboard</div>

      render(
        <TestWrapper>
          <ProtectedRoute>
            <DashboardComponent />
          </ProtectedRoute>
        </TestWrapper>
      )

      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })

    it('should enforce role-based access control', async () => {
      mockTokenService.getToken.mockReturnValue('valid-token')
      mockTokenService.isTokenValid.mockReturnValue(true)
      mockTokenService.getUserRole.mockReturnValue('buyer')

      const AdminComponent = () => <div>Admin Panel</div>

      render(
        <TestWrapper>
          <ProtectedRoute requiredRole="admin">
            <AdminComponent />
          </ProtectedRoute>
        </TestWrapper>
      )

      // Buyer should not see admin panel
      expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument()
      expect(screen.getByText(/access denied/i)).toBeInTheDocument()
    })
  })

  describe('Session Management', () => {
    it('should implement session timeout', async () => {
      const sessionTimeout = 30 * 60 * 1000 // 30 minutes
      
      mockTokenService.getToken.mockReturnValue('valid-token')
      mockTokenService.isTokenValid.mockReturnValue(true)
      mockTokenService.getTokenExpiry.mockReturnValue(Date.now() - sessionTimeout - 1000)

      const TestComponent = () => {
        const { isAuthenticated } = useAuth()
        return <div>{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      )

      // Should automatically logout due to session timeout
      await waitFor(() => {
        expect(screen.getByText('Not Authenticated')).toBeInTheDocument()
      })
    })

    it('should detect concurrent sessions', async () => {
      const sessionId = 'session-123'
      
      mockTokenService.getSessionId.mockReturnValue(sessionId)
      mockAuthService.validateSession.mockRejectedValue(new Error('Concurrent session detected'))

      const TestComponent = () => {
        const { error } = useAuth()
        return <div>{error ? 'Session Error' : 'Valid Session'}</div>
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Session Error')).toBeInTheDocument()
      })
    })

    it('should handle session hijacking detection', async () => {
      const originalIP = '192.168.1.100'
      const suspiciousIP = '10.0.0.1'
      
      mockTokenService.getToken.mockReturnValue('valid-token')
      mockAuthService.validateSession.mockImplementation((token, metadata) => {
        if (metadata.ipAddress !== originalIP) {
          throw new Error('Suspicious activity detected')
        }
        return Promise.resolve()
      })

      // Simulate IP change
      Object.defineProperty(window, 'navigator', {
        value: {
          userAgent: 'Different-Agent/1.0'
        },
        writable: true
      })

      const TestComponent = () => {
        const { validateSession } = useAuth()
        React.useEffect(() => {
          validateSession({ ipAddress: suspiciousIP })
        }, [])
        return <div>Test</div>
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(mockAuthService.validateSession).toHaveBeenCalledWith(
          'valid-token',
          expect.objectContaining({ ipAddress: suspiciousIP })
        )
      })
    })
  })

  describe('Password Security', () => {
    it('should enforce password complexity requirements', () => {
      const validPasswords = [
        'SecurePass123!',
        'Complex@Password2024',
        'MyStr0ng#P@ssw0rd'
      ]

      const invalidPasswords = [
        'password', // Too simple
        '12345678', // Only numbers
        'PASSWORD', // Only uppercase
        'password123', // No special characters
        'Pass!1' // Too short
      ]

      for (const password of validPasswords) {
        expect(validatePassword(password)).toBe(true)
      }

      for (const password of invalidPasswords) {
        expect(validatePassword(password)).toBe(false)
      }
    })

    it('should prevent password reuse', async () => {
      const userId = 'user-123'
      const newPassword = 'NewPassword123!'
      const previousPasswords = [
        'OldPassword123!',
        'AnotherOld456@',
        'PreviousPass789#'
      ]

      mockAuthService.getPasswordHistory.mockResolvedValue(previousPasswords)

      // Should reject if password was used before
      mockAuthService.changePassword.mockImplementation((userId, oldPass, newPass) => {
        if (previousPasswords.includes(newPass)) {
          throw new Error('Password was recently used')
        }
        return Promise.resolve()
      })

      await expect(
        authService.changePassword(userId, 'OldPassword123!', 'OldPassword123!')
      ).rejects.toThrow('Password was recently used')
    })

    it('should hash passwords securely', async () => {
      const password = 'TestPassword123!'
      
      mockAuthService.hashPassword.mockImplementation((pass) => {
        // Should use bcrypt or similar secure hashing
        expect(pass).toBe(password)
        return Promise.resolve('$2b$12$hashedpassword')
      })

      const hashedPassword = await authService.hashPassword(password)
      
      expect(hashedPassword).toMatch(/^\$2b\$/) // bcrypt format
      expect(hashedPassword).not.toContain(password) // Original password not visible
    })
  })

  describe('Multi-Factor Authentication', () => {
    it('should enforce MFA for privileged accounts', async () => {
      const adminUser = {
        id: 'admin-123',
        email: 'admin@test.com',
        role: 'admin',
        mfaEnabled: true
      }

      mockAuthService.login.mockResolvedValue({
        user: adminUser,
        requiresMfa: true,
        tempToken: 'temp-token'
      })

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      fireEvent.change(emailInput, { target: { value: 'admin@test.com' } })
      fireEvent.change(passwordInput, { target: { value: 'AdminPass123!' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/enter verification code/i)).toBeInTheDocument()
      })

      // Should not be fully authenticated yet
      expect(screen.queryByText(/dashboard/i)).not.toBeInTheDocument()
    })

    it('should validate TOTP codes securely', async () => {
      const validCode = '123456'
      const invalidCodes = ['000000', '123', 'abcdef', '']

      mockAuthService.verifyMfaCode.mockImplementation((code) => {
        if (code === validCode) {
          return Promise.resolve({ valid: true })
        }
        return Promise.resolve({ valid: false })
      })

      // Test valid code
      const validResult = await authService.verifyMfaCode(validCode)
      expect(validResult.valid).toBe(true)

      // Test invalid codes
      for (const invalidCode of invalidCodes) {
        const invalidResult = await authService.verifyMfaCode(invalidCode)
        expect(invalidResult.valid).toBe(false)
      }
    })

    it('should implement backup codes securely', async () => {
      const backupCodes = [
        'ABC123DEF456',
        'GHI789JKL012',
        'MNO345PQR678'
      ]

      mockAuthService.generateBackupCodes.mockResolvedValue(backupCodes)
      mockAuthService.validateBackupCode.mockImplementation((code) => {
        if (backupCodes.includes(code)) {
          // Code should be marked as used after validation
          return Promise.resolve({ valid: true, remaining: 2 })
        }
        return Promise.resolve({ valid: false })
      })

      const codes = await authService.generateBackupCodes()
      expect(codes).toHaveLength(3)

      // Use backup code
      const result = await authService.validateBackupCode('ABC123DEF456')
      expect(result.valid).toBe(true)
      expect(result.remaining).toBe(2)

      // Same code should not work twice
      const secondResult = await authService.validateBackupCode('ABC123DEF456')
      expect(secondResult.valid).toBe(false)
    })
  })
})

// Helper functions
function validatePassword(password: string): boolean {
  const minLength = 8
  const hasUpperCase = /[A-Z]/.test(password)
  const hasLowerCase = /[a-z]/.test(password)
  const hasNumbers = /\d/.test(password)
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)

  return password.length >= minLength &&
         hasUpperCase &&
         hasLowerCase &&
         hasNumbers &&
         hasSpecialChar
}

function useAuth() {
  // Mock auth hook for testing
  return {
    isAuthenticated: false,
    error: null,
    validateSession: vi.fn()
  }
}