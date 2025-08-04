/**
 * Performance Monitoring & State Debugging Examples
 * Phase 2.4 - Practical usage examples for React components
 */

import React, { useEffect, useState } from 'react'
import { 
  usePerformanceMonitor,
  useStateDebugger,
  useMetricsCollector,
  useDeveloperTools 
} from './index'
import { useMonitoringIntegration } from '../utils/monitoringIntegration'

// ==================== Performance Monitoring Example ====================

export const PerformanceMonitorExample: React.FC = () => {
  const [metrics, setMetrics] = useState(null)
  const [report, setReport] = useState(null)
  const performanceMonitor = usePerformanceMonitor()

  useEffect(() => {
    // Subscribe to performance updates
    const unsubscribe = usePerformanceMonitor.subscribe(
      (state) => state.metrics,
      (newMetrics) => setMetrics(newMetrics)
    )

    return unsubscribe
  }, [])

  const handleGenerateReport = async () => {
    const newReport = await performanceMonitor.generateReport()
    setReport(newReport)
  }

  const handleStartProfiling = () => {
    performanceMonitor.startProfiling(10000) // 10 second profile
  }

  if (!metrics) return <div>Loading performance metrics...</div>

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Performance Monitor</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded">
          <h3 className="font-semibold">Store Updates</h3>
          <p>{metrics.storeUpdateFrequency.toFixed(2)} updates/sec</p>
        </div>
        
        <div className="bg-green-50 p-4 rounded">
          <h3 className="font-semibold">Memory Usage</h3>
          <p>{(metrics.memoryUsage / 1024 / 1024).toFixed(2)} MB</p>
        </div>
        
        <div className="bg-yellow-50 p-4 rounded">
          <h3 className="font-semibold">Re-renders</h3>
          <p>{metrics.reRenderCount}</p>
        </div>
        
        <div className="bg-purple-50 p-4 rounded">
          <h3 className="font-semibold">Selector Time</h3>
          <p>{metrics.selectorComputationTime.toFixed(2)}ms</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={handleGenerateReport}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Generate Report
        </button>
        
        <button
          onClick={handleStartProfiling}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Start Profiling
        </button>
      </div>

      {report && (
        <div className="bg-gray-50 p-4 rounded">
          <h3 className="font-semibold mb-2">Performance Report</h3>
          <p><strong>Score:</strong> {report.summary.overallScore}/100</p>
          <p><strong>Bottlenecks:</strong> {report.summary.bottlenecks.join(', ')}</p>
          <p><strong>Warnings:</strong> {report.summary.warnings.join(', ')}</p>
        </div>
      )}
    </div>
  )
}

// ==================== State Debugging Example ====================

export const StateDebuggerExample: React.FC = () => {
  const [snapshots, setSnapshots] = useState([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const stateDebugger = useStateDebugger()

  useEffect(() => {
    const unsubscribe = useStateDebugger.subscribe(
      (state) => ({
        snapshots: state.history.snapshots,
        currentIndex: state.history.currentIndex,
      }),
      ({ snapshots, currentIndex }) => {
        setSnapshots(snapshots)
        setCurrentIndex(currentIndex)
      }
    )

    return unsubscribe
  }, [])

  const handleTimeTravel = (index: number) => {
    stateDebugger.travelToIndex(index)
  }

  const handleStepBack = () => {
    stateDebugger.stepBackward()
  }

  const handleStepForward = () => {
    stateDebugger.stepForward()
  }

  const handleAnalyzeMemory = () => {
    const leaks = stateDebugger.findStateLeaks()
    const growth = stateDebugger.analyzeStateGrowth()
    
    console.log('Memory Analysis:')
    console.log('Potential leaks:', leaks)
    console.log('State growth:', growth)
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">State Debugger</h2>
      
      <div className="flex gap-2 mb-4">
        <button
          onClick={handleStepBack}
          disabled={currentIndex <= 0}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
        >
          ← Step Back
        </button>
        
        <button
          onClick={handleStepForward}
          disabled={currentIndex >= snapshots.length - 1}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
        >
          Step Forward →
        </button>
        
        <button
          onClick={handleAnalyzeMemory}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Analyze Memory
        </button>
      </div>

      <div className="bg-gray-50 p-4 rounded max-h-64 overflow-y-auto">
        <h3 className="font-semibold mb-2">State History</h3>
        {snapshots.length === 0 ? (
          <p>No state snapshots available</p>
        ) : (
          <div className="space-y-1">
            {snapshots.slice(-10).map((snapshotId, index) => {
              const actualIndex = snapshots.length - 10 + index
              const isActive = actualIndex === currentIndex
              
              return (
                <button
                  key={snapshotId}
                  onClick={() => handleTimeTravel(actualIndex)}
                  className={`block w-full text-left px-2 py-1 rounded text-sm ${
                    isActive ? 'bg-blue-100 border border-blue-300' : 'hover:bg-gray-100'
                  }`}
                >
                  #{actualIndex}: {snapshotId.substring(0, 20)}...
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== Metrics Collection Example ====================

export const MetricsCollectionExample: React.FC = () => {
  const [summary, setSummary] = useState(null)
  const metricsCollector = useMetricsCollector()
  const monitoring = useMonitoringIntegration('metrics-example')

  useEffect(() => {
    // Update summary every 5 seconds
    const interval = setInterval(() => {
      const newSummary = metricsCollector.getMetricsSummary()
      setSummary(newSummary)
    }, 5000)

    return () => clearInterval(interval)
  }, [metricsCollector])

  const handleTrackInteraction = (type: string) => {
    if (monitoring) {
      monitoring.recordInteraction(type, 'example-component')
    }
  }

  const handleExportMetrics = () => {
    const data = metricsCollector.exportMetrics()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `metrics-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!summary) return <div>Loading metrics...</div>

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Metrics Collection</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded">
          <h3 className="font-semibold">User Interactions</h3>
          <p>Total: {summary.userInteractions.totalInteractions}</p>
          <p>Bounce Rate: {(summary.userInteractions.bounceRate * 100).toFixed(1)}%</p>
        </div>
        
        <div className="bg-green-50 p-4 rounded">
          <h3 className="font-semibold">API Performance</h3>
          <p>Total Calls: {summary.apiPerformance.totalCalls}</p>
          <p>Avg Response: {summary.apiPerformance.averageResponseTime.toFixed(0)}ms</p>
          <p>Error Rate: {(summary.apiPerformance.errorRate * 100).toFixed(2)}%</p>
        </div>
        
        <div className="bg-yellow-50 p-4 rounded">
          <h3 className="font-semibold">Performance</h3>
          <p>Avg Load Time: {summary.performance.averageLoadTime.toFixed(0)}ms</p>
          <p>Memory Usage: {(summary.performance.memoryUsage / 1024 / 1024).toFixed(2)}MB</p>
        </div>
        
        <div className="bg-red-50 p-4 rounded">
          <h3 className="font-semibold">Errors</h3>
          <p>Total: {summary.errors.total}</p>
          <p>Types: {Object.keys(summary.errors.byType).join(', ')}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => handleTrackInteraction('click')}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Track Click
        </button>
        
        <button
          onClick={() => handleTrackInteraction('navigation')}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Track Navigation
        </button>
        
        <button
          onClick={handleExportMetrics}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          Export Metrics
        </button>
      </div>
    </div>
  )
}

// ==================== Developer Tools Example ====================

export const DeveloperToolsExample: React.FC = () => {
  const [commands, setCommands] = useState([])
  const [commandHistory, setCommandHistory] = useState([])
  const [selectedCommand, setSelectedCommand] = useState('')
  const developerTools = useDeveloperTools()

  useEffect(() => {
    const unsubscribe = useDeveloperTools.subscribe(
      (state) => ({
        commands: Array.from(state.commands.values()),
        history: state.commandHistory,
      }),
      ({ commands, history }) => {
        setCommands(commands)
        setCommandHistory(history)
      }
    )

    return unsubscribe
  }, [])

  const handleExecuteCommand = async () => {
    if (!selectedCommand) return
    
    try {
      const result = await developerTools.executeCommand(selectedCommand)
      console.log('Command result:', result)
    } catch (error) {
      console.error('Command failed:', error)
    }
  }

  const handleQuickCommand = async (commandName: string) => {
    try {
      const result = await developerTools.executeCommand(commandName)
      console.log(`${commandName} result:`, result)
    } catch (error) {
      console.error(`${commandName} failed:`, error)
    }
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Developer Tools</h2>
      
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Execute Command:</label>
        <div className="flex gap-2">
          <select
            value={selectedCommand}
            onChange={(e) => setSelectedCommand(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a command...</option>
            {commands.map((cmd) => (
              <option key={cmd.name} value={cmd.name}>
                {cmd.name} - {cmd.description}
              </option>
            ))}
          </select>
          
          <button
            onClick={handleExecuteCommand}
            disabled={!selectedCommand}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Execute
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <h3 className="font-semibold mb-2">Quick Commands</h3>
          <div className="space-y-2">
            <button
              onClick={() => handleQuickCommand('state')}
              className="block w-full px-3 py-2 bg-gray-100 text-left rounded hover:bg-gray-200"
            >
              Show State
            </button>
            <button
              onClick={() => handleQuickCommand('performance')}
              className="block w-full px-3 py-2 bg-gray-100 text-left rounded hover:bg-gray-200"
            >
              Show Performance
            </button>
            <button
              onClick={() => handleQuickCommand('memory')}
              className="block w-full px-3 py-2 bg-gray-100 text-left rounded hover:bg-gray-200"
            >
              Analyze Memory
            </button>
            <button
              onClick={() => handleQuickCommand('report')}
              className="block w-full px-3 py-2 bg-gray-100 text-left rounded hover:bg-gray-200"
            >
              Generate Report
            </button>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Command History</h3>
          <div className="bg-gray-50 p-3 rounded max-h-40 overflow-y-auto">
            {commandHistory.length === 0 ? (
              <p className="text-gray-500 text-sm">No commands executed yet</p>
            ) : (
              <div className="space-y-1">
                {commandHistory.slice(-10).map((cmd, index) => (
                  <div key={index} className="text-sm font-mono">
                    {cmd}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded">
        <h3 className="font-semibold mb-2">Console Access</h3>
        <p className="text-sm text-gray-700 mb-2">
          Open browser console and use these commands:
        </p>
        <div className="bg-white p-2 rounded font-mono text-sm">
          <div>__dce.help() - Show all commands</div>
          <div>__dce.state() - Inspect state</div>
          <div>__dce.perf() - Performance metrics</div>
          <div>__dce.memory() - Memory analysis</div>
          <div>__dce.profile(5000) - Start profiling</div>
        </div>
      </div>
    </div>
  )
}

// ==================== Combined Dashboard Example ====================

export const MonitoringDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('performance')

  const tabs = [
    { id: 'performance', label: 'Performance', component: PerformanceMonitorExample },
    { id: 'debugging', label: 'State Debugger', component: StateDebuggerExample },
    { id: 'metrics', label: 'Metrics', component: MetricsCollectionExample },
    { id: 'tools', label: 'Developer Tools', component: DeveloperToolsExample },
  ]

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || PerformanceMonitorExample

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">DCE Monitoring Dashboard</h1>
        
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
          
          <div className="p-6">
            <ActiveComponent />
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h2 className="font-semibold text-yellow-800 mb-2">Development Mode Only</h2>
          <p className="text-yellow-700 text-sm">
            This monitoring dashboard is only available in development mode. 
            In production, monitoring runs with minimal overhead and sampling.
          </p>
        </div>
      </div>
    </div>
  )
}

// ==================== Export Index ====================

export {
  PerformanceMonitorExample,
  StateDebuggerExample,
  MetricsCollectionExample,
  DeveloperToolsExample,
  MonitoringDashboard,
}