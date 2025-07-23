import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '../../store/authStore'

// Validation schema using Zod (NO REGEX)
const loginFormSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().optional().default(false),
})

type LoginFormData = z.infer<typeof loginFormSchema>

interface LoginFormProps {
  onSuccess?: (user: unknown) => void
  onError?: (error: string) => void
  showRememberMe?: boolean
  showForgotPassword?: boolean
  className?: string
  disabled?: boolean
}

export function LoginForm({
  onSuccess,
  onError,
  showRememberMe = true,
  showForgotPassword = true,
  className = '',
  disabled = false,
}: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { signIn } = useAuthStore()

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setError: setFormError,
    reset,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  })

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  const onSubmit = async (data: LoginFormData) => {
    if (disabled || isSubmitting) return

    try {
      setIsSubmitting(true)

      // Use the auth store to sign in
      const user = await signIn(data.email, data.password)

      // Handle remember me functionality
      if (data.rememberMe) {
        localStorage.setItem('dce_remember_me', 'true')
      } else {
        localStorage.removeItem('dce_remember_me')
      }

      // Call success callback if provided
      if (onSuccess) {
        onSuccess(user)
      }

      // Reset form on success
      reset()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed. Please try again.'

      // Handle specific authentication errors
      if (errorMessage.includes('Invalid login credentials')) {
        setFormError('email', {
          type: 'manual',
          message: 'Invalid email or password',
        })
        setFormError('password', {
          type: 'manual',
          message: 'Invalid email or password',
        })
      } else if (errorMessage.includes('Email not confirmed')) {
        setFormError('email', {
          type: 'manual',
          message: 'Please check your email and confirm your account',
        })
      } else if (errorMessage.includes('Too many requests')) {
        setFormError('email', {
          type: 'manual',
          message: 'Too many attempts. Please wait and try again',
        })
      } else {
        // General error handling
        if (onError) {
          onError(errorMessage)
        } else {
          setFormError('email', {
            type: 'manual',
            message: errorMessage,
          })
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormDisabled = disabled || isSubmitting

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={`space-y-6 ${className}`} noValidate>
      {/* Email Field */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          Email Address
        </label>
        <input
          {...register('email')}
          type="email"
          id="email"
          autoComplete="email"
          spellCheck="false"
          className={`
            w-full px-4 py-3 border rounded-lg shadow-sm 
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-50 disabled:cursor-not-allowed
            ${
              errors.email
                ? 'border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 bg-white hover:border-gray-400'
            }
          `}
          placeholder="Enter your email address"
          disabled={isFormDisabled}
          aria-invalid={errors.email ? 'true' : 'false'}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <p id="email-error" className="mt-2 text-sm text-red-600" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Password Field */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
          Password
        </label>
        <div className="relative">
          <input
            {...register('password')}
            type={showPassword ? 'text' : 'password'}
            id="password"
            autoComplete="current-password"
            className={`
              w-full px-4 py-3 pr-12 border rounded-lg shadow-sm 
              transition-colors duration-200
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              disabled:bg-gray-50 disabled:cursor-not-allowed
              ${
                errors.password
                  ? 'border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 bg-white hover:border-gray-400'
              }
            `}
            placeholder="Enter your password"
            disabled={isFormDisabled}
            aria-invalid={errors.password ? 'true' : 'false'}
            aria-describedby={errors.password ? 'password-error' : undefined}
          />
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className={`
              absolute inset-y-0 right-0 pr-4 flex items-center
              transition-colors duration-200
              ${
                isFormDisabled
                  ? 'cursor-not-allowed text-gray-300'
                  : 'cursor-pointer text-gray-400 hover:text-gray-600'
              }
            `}
            disabled={isFormDisabled}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" className="mt-2 text-sm text-red-600" role="alert">
            {errors.password.message}
          </p>
        )}
      </div>

      {/* Remember Me & Forgot Password */}
      {(showRememberMe || showForgotPassword) && (
        <div className="flex items-center justify-between">
          {showRememberMe && (
            <div className="flex items-center">
              <input
                {...register('rememberMe')}
                id="remember-me"
                type="checkbox"
                className={`
                  h-4 w-4 text-blue-600 border-gray-300 rounded
                  focus:ring-blue-500 focus:ring-2
                  disabled:cursor-not-allowed disabled:opacity-50
                `}
                disabled={isFormDisabled}
              />
              <label
                htmlFor="remember-me"
                className={`
                  ml-2 block text-sm 
                  ${isFormDisabled ? 'text-gray-400' : 'text-gray-700'}
                `}
              >
                Remember me
              </label>
            </div>
          )}

          {showForgotPassword && (
            <div className={showRememberMe ? '' : 'ml-auto'}>
              <button
                type="button"
                className={`
                  text-sm font-medium transition-colors duration-200
                  ${
                    isFormDisabled
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-blue-600 hover:text-blue-500 hover:underline'
                  }
                `}
                disabled={isFormDisabled}
                onClick={() => {
                  // This would typically navigate to forgot password page
                  // For now, we'll just log it
                  console.log('Navigate to forgot password')
                }}
              >
                Forgot your password?
              </button>
            </div>
          )}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isFormDisabled || !isValid}
        className={`
          w-full flex justify-center items-center py-3 px-4 
          border border-transparent rounded-lg shadow-sm 
          text-sm font-medium text-white
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
          ${
            isFormDisabled || !isValid
              ? 'bg-gray-400 cursor-not-allowed opacity-60'
              : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
          }
        `}
        aria-describedby={isSubmitting ? 'submitting-status' : undefined}
      >
        {isSubmitting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            <span id="submitting-status">Signing in...</span>
          </>
        ) : (
          'Sign In'
        )}
      </button>

      {/* Development Demo Credentials */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs font-medium text-yellow-800 mb-2">
            Demo Credentials (Development Only):
          </p>
          <div className="space-y-1 text-xs text-yellow-700">
            <p>
              <strong>Supplier:</strong> supplier@demo.com / password123
            </p>
            <p>
              <strong>Buyer:</strong> buyer@demo.com / password123
            </p>
            <p>
              <strong>Admin:</strong> admin@demo.com / password123
            </p>
          </div>
        </div>
      )}
    </form>
  )
}

export default LoginForm
