import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { SettingsLayout } from '../../components/settings/SettingsLayout'

export default function SettingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  
  useEffect(() => {
    // Redirect to profile settings if no specific section is selected
    if (location.pathname === '/app/settings' || location.pathname === '/app/settings/') {
      navigate('/app/settings/profile', { replace: true })
    }
  }, [location.pathname, navigate])
  
  return <SettingsLayout />
}