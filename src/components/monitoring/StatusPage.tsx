import React, { useState, useEffect } from 'react'
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/solid'
import { healthChecker, type HealthCheckResult } from '../../lib/health-check'
import { apm } from '../../lib/apm'

interface ServiceStatus {
  name: string
  status: 'operational' | 'degraded' | 'down'
  lastChecked: string
  responseTime?: number
  uptime?: number
}

export const StatusPage: React.FC = () => {
  const [healthData, setHealthData] = useState<HealthCheckResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [services, setServices] = useState<ServiceStatus[]>([])
  const [incidents, setIncidents] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    checkHealth()
    const interval = setInterval(checkHealth, 30000) // Refresh every 30 seconds
    
    return () => clearInterval(interval)
  }, [])

  const checkHealth = async () => {
    setRefreshing(true)
    
    try {
      const result = await healthChecker.performHealthCheck()
      setHealthData(result)
      
      // Convert health checks to service status
      const serviceStatuses: ServiceStatus[] = [
        {
          name: 'Web Application',
          status: result.checks.api?.status === 'pass' ? 'operational' : 'down',
          lastChecked: result.timestamp,
          responseTime: result.checks.api?.duration,
          uptime: 99.9, // This would come from a real monitoring service
        },
        {
          name: 'Database (Supabase)',
          status: result.checks.supabase?.status === 'pass' ? 'operational' : 'down',
          lastChecked: result.timestamp,
          responseTime: result.checks.supabase?.duration,
          uptime: 99.95,
        },
        {
          name: 'Payment Processing (Stripe)',
          status: result.checks.stripe?.status === 'pass' ? 'operational' : 'degraded',
          lastChecked: result.timestamp,
          uptime: 100,
        },
        {
          name: 'Error Tracking (Sentry)',
          status: result.checks.sentry?.status === 'pass' ? 'operational' : 'degraded',
          lastChecked: result.timestamp,
          uptime: 99.99,
        },
      ]
      
      setServices(serviceStatuses)
      
      // Track metrics
      apm.trackMetric('health-check.duration', result.overall.duration)
      apm.trackMetric('health-check.failed', result.overall.failed)
      
    } catch (error) {
      console.error('Failed to check health:', error)
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }

  const getOverallStatus = () => {
    if (!healthData) return 'unknown'
    return healthData.status
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
      case 'healthy':
      case 'pass':
        return 'text-green-500'
      case 'degraded':
        return 'text-yellow-500'
      case 'down':
      case 'unhealthy':
      case 'fail':
        return 'text-red-500'
      default:
        return 'text-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
      case 'healthy':
      case 'pass':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'degraded':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
      case 'down':
      case 'unhealthy':
      case 'fail':
        return <XCircleIcon className="h-5 w-5 text-red-500" />
      default:
        return <ExclamationTriangleIcon className="h-5 w-5 text-gray-500" />
    }
  }

  const formatResponseTime = (ms?: number) => {
    if (!ms) return 'N/A'
    if (ms < 1000) return `${Math.round(ms)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Checking system status...</p>
        </div>
      </div>
    )
  }

  const overallStatus = getOverallStatus()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className={`${
        overallStatus === 'healthy' ? 'bg-green-500' :
        overallStatus === 'degraded' ? 'bg-yellow-500' :
        'bg-red-500'
      } text-white`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">System Status</h1>
              <p className="mt-2 text-white/90">
                {overallStatus === 'healthy' && 'All systems operational'}
                {overallStatus === 'degraded' && 'Experiencing minor issues'}
                {overallStatus === 'unhealthy' && 'Major outage in progress'}
              </p>
            </div>
            <button
              onClick={checkHealth}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Current Status */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Current Status</h2>
          <div className="space-y-4">
            {services.map((service) => (
              <div key={service.name} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  {getStatusIcon(service.status)}
                  <div>
                    <h3 className="font-medium">{service.name}</h3>
                    <p className="text-sm text-gray-500">
                      Last checked: {new Date(service.lastChecked).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-medium ${getStatusColor(service.status)}`}>
                    {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                  </p>
                  {service.responseTime && (
                    <p className="text-sm text-gray-500">
                      Response time: {formatResponseTime(service.responseTime)}
                    </p>
                  )}
                  {service.uptime && (
                    <p className="text-sm text-gray-500">
                      Uptime: {service.uptime}%
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Metrics */}
        {healthData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Checks</h3>
              <p className="mt-2 text-3xl font-semibold">
                {healthData.overall.healthy + healthData.overall.failed}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {healthData.overall.healthy} passing, {healthData.overall.failed} failing
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Check Duration</h3>
              <p className="mt-2 text-3xl font-semibold">
                {formatResponseTime(healthData.overall.duration)}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Time to complete all checks
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Overall Health</h3>
              <div className="mt-2 flex items-center gap-2">
                {getStatusIcon(overallStatus)}
                <p className={`text-3xl font-semibold ${getStatusColor(overallStatus)}`}>
                  {Math.round((healthData.overall.healthy / (healthData.overall.healthy + healthData.overall.failed)) * 100)}%
                </p>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                System health score
              </p>
            </div>
          </div>
        )}

        {/* Recent Incidents */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Incidents</h2>
          {incidents.length === 0 ? (
            <p className="text-gray-500">No recent incidents to report.</p>
          ) : (
            <div className="space-y-4">
              {incidents.map((incident, index) => (
                <div key={index} className="border-l-4 border-yellow-400 pl-4 py-2">
                  <h3 className="font-medium">{incident.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{incident.description}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(incident.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Technical Details */}
        {import.meta.env.DEV && healthData && (
          <details className="mt-8">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
              Technical Details
            </summary>
            <pre className="mt-4 p-4 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto text-xs">
              {JSON.stringify(healthData, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}