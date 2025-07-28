import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { from, getSession } from '@/lib/supabase-optimized'
import { useAuthStore } from '../../store/authStore'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const { setUser, setSession, setUserType } = useAuthStore()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the hash fragments from the URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        if (!accessToken || !refreshToken) {
          // Check if we have a session from server-side redirect
          const { data: { session }, error: sessionError } = await getSession()
          
          if (sessionError || !session) {
            throw new Error('No authentication tokens found')
          }
        }

        // Get the current session
        const { data: { session }, error: sessionError } = await getSession()
        
        if (sessionError || !session) {
          throw sessionError || new Error('Failed to establish session')
        }

        // Set the session
        setSession(session)

        // Check if this is a new registration
        const pendingRegistration = localStorage.getItem('pendingRegistration')
        
        if (pendingRegistration) {
          // SECURITY: Only extract non-sensitive registration data
          const { userType: pendingUserType } = JSON.parse(pendingRegistration)
          // const { selectedPlan } = JSON.parse(pendingRegistration) // TODO: Use when implementing plan selection
          
          // Create the user profile based on their type
          if (pendingUserType === 'supplier') {
            await from('suppliers').insert({
              user_id: session.user.id,
              company_name: 'To be updated', // Required field
              status: 'pending',
            })
          } else if (pendingUserType === 'buyer') {
            await from('buyers').insert({
              user_id: session.user.id,
              company_name: 'To be updated', // Required field
              status: 'pending',
            })
          } else if (pendingUserType === 'network') {
            // Network users are handled differently
            // For now, we'll just set the user type
            console.log('Network user registration:', session.user.id)
          }
          
          // Clean up
          localStorage.removeItem('pendingRegistration')
          setUserType(pendingUserType)
        } else {
          // Existing user login - determine user type
          const [supplierCheck, buyerCheck, adminCheck] = await Promise.all([
            from('suppliers').select('*').eq('user_id', session.user.id).single(),
            from('buyers').select('*').eq('user_id', session.user.id).single(),
            from('admins').select('*').eq('user_id', session.user.id).single(),
          ])

          let userType: 'supplier' | 'buyer' | 'admin' | 'network' | null = null
          if (adminCheck.data) {
            userType = 'admin'
          } else if (false) { // networkCheck removed
            userType = 'network'
          } else if (buyerCheck.data) {
            userType = 'buyer'
          } else if (supplierCheck.data) {
            userType = 'supplier'
          }
          
          setUserType(userType)
        }

        // Navigate to dashboard
        navigate('/app/dashboard')
      } catch (err) {
        console.error('Auth callback error:', err)
        setError(err instanceof Error ? err.message : 'Authentication failed')
        
        // Redirect to login after a delay
        setTimeout(() => {
          navigate('/login')
        }, 3000)
      }
    }

    handleAuthCallback()
  }, [navigate, setUser, setSession, setUserType])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Authentication Failed
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">{error}</p>
            <p className="mt-2 text-center text-sm text-gray-600">
              Redirecting to login page...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">Verifying your authentication...</p>
      </div>
    </div>
  )
}