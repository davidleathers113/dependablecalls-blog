import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuthStore } from '../../store/authStore'
import { useCsrfForm } from '../../hooks/useCsrf'
import { usePageTitle } from '../../hooks/usePageTitle'
import { magicLinkRegisterSchema, type MagicLinkRegisterData } from '../../lib/validation'

export default function RegisterPage() {
  usePageTitle('Register')
  const location = useLocation()
  const { signInWithMagicLink } = useAuthStore()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const { submitWithCsrf } = useCsrfForm<MagicLinkRegisterData>()

  // Get selected plan from location state
  const selectedPlan = location.state?.selectedPlan

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<MagicLinkRegisterData>({
    resolver: zodResolver(magicLinkRegisterSchema),
    defaultValues: {
      role: 'supplier',
    },
  })

  const userType = watch('role')
  const email = watch('email')

  const onSubmit = submitWithCsrf(async (data) => {
    setError('')
    setLoading(true)

    try {
      // SECURITY FIX: Store non-sensitive registration data only
      // CSRF tokens and auth data are handled server-side via httpOnly cookies
      localStorage.setItem('pendingRegistration', JSON.stringify({
        userType: data.role,
        selectedPlan,
        timestamp: Date.now(),
        // SECURITY: CSRF token removed - handled server-side
      }))
      
      await signInWithMagicLink(data.email)
      setEmailSent(true)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send verification email'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  })

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Check your email
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              We've sent a verification link to <strong>{email}</strong>
            </p>
            <p className="mt-2 text-center text-sm text-gray-600">
              Click the link to verify your email and complete registration.
            </p>
          </div>
          
          <div className="mt-6 space-y-3">
            <button
              onClick={() => {
                setEmailSent(false)
                setError('')
              }}
              className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 min-h-[44px]"
            >
              Try a different email
            </button>
            
            <div className="text-center">
              <Link to="/login" className="text-sm font-medium text-primary-600 hover:text-primary-500 py-2 px-3 -mx-3 inline-block min-h-[44px]">
                Already have an account? Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          {selectedPlan && (
            <div className="mt-2 text-center">
              <span className="text-sm text-gray-600">Selected plan: </span>
              <span className="text-sm font-medium text-primary-600 capitalize">
                {selectedPlan}
              </span>
            </div>
          )}
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500 py-2 px-3 -mx-3 inline-block min-h-[44px]">
              sign in to existing account
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {/* Account Type Selection */}
          <div>
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 mb-2">I am a...</legend>
            <div className="grid grid-cols-3 gap-3">
              <label className="relative">
                <input
                  {...register('role')}
                  type="radio"
                  value="supplier"
                  className="sr-only"
                />
                <div
                  className={`border rounded-lg p-4 cursor-pointer text-center ${
                    userType === 'supplier'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300'
                  }`}
                >
                  <span className="block font-medium">Supplier</span>
                  <span className="block text-sm mt-1 text-gray-500">I have traffic to send</span>
                </div>
              </label>
              <label className="relative">
                <input {...register('role')} type="radio" value="buyer" className="sr-only" />
                <div
                  className={`border rounded-lg p-4 cursor-pointer text-center ${
                    userType === 'buyer'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300'
                  }`}
                >
                  <span className="block font-medium">Buyer</span>
                  <span className="block text-sm mt-1 text-gray-500">I need quality calls</span>
                </div>
              </label>
              <label className="relative">
                <input {...register('role')} type="radio" value="network" className="sr-only" />
                <div
                  className={`border rounded-lg p-4 cursor-pointer text-center ${
                    userType === 'network'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300'
                  }`}
                >
                  <span className="block font-medium">Network</span>
                  <span className="block text-sm mt-1 text-gray-500">I buy and sell calls</span>
                </div>
              </label>
            </div>
            </fieldset>
          </div>
          {errors.role && (
            <p id="usertype-error" className="mt-1 text-sm text-red-600" role="alert">{errors.role.message}</p>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                {...register('email')}
                id="email"
                type="email"
                autoComplete="email"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Enter your email"
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
              {errors.email && <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">{errors.email.message}</p>}
            </div>
          </div>

          <div className="flex items-start">
            <input
              {...register('acceptTerms')}
              id="acceptTerms"
              type="checkbox"
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              aria-describedby={errors.acceptTerms ? 'terms-error' : undefined}
            />
            <label htmlFor="acceptTerms" className="ml-2 block text-sm text-gray-900">
              I agree to the{' '}
              <Link to="/terms" className="text-primary-600 hover:text-primary-500 py-2 px-3 -mx-3 inline-block min-h-[44px]">
                Terms and Conditions
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-primary-600 hover:text-primary-500 py-2 px-3 -mx-3 inline-block min-h-[44px]">
                Privacy Policy
              </Link>
            </label>
          </div>
          {errors.acceptTerms && (
            <p id="terms-error" className="mt-1 text-sm text-red-600" role="alert">{errors.acceptTerms.message}</p>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              {loading ? 'Sending verification email...' : 'Send verification email'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
