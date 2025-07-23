import React, { useState, useEffect, useCallback } from 'react'
import { XMarkIcon, FunnelIcon } from '@heroicons/react/24/outline'
import type { LogEntry, LogLevel } from '../../lib/logger'

interface LogViewerProps {
  isOpen: boolean
  onClose: () => void
}

export const LogViewer: React.FC<LogViewerProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState<LogLevel | 'all'>('all')
  const [search, setSearch] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)

  // Intercept console methods in development
  useEffect(() => {
    if (!import.meta.env.DEV) return

    const originalMethods = {
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error,
    }

    const interceptLog = (level: LogLevel, args: unknown[]) => {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message: args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '),
      }
      
      setLogs(prev => [...prev.slice(-200), entry]) // Keep last 200 logs
    }

    console.debug = (...args) => {
      originalMethods.debug(...args)
      interceptLog('debug', args)
    }
    
    console.info = (...args) => {
      originalMethods.info(...args)
      interceptLog('info', args)
    }
    
    console.warn = (...args) => {
      originalMethods.warn(...args)
      interceptLog('warn', args)
    }
    
    console.error = (...args) => {
      originalMethods.error(...args)
      interceptLog('error', args)
    }

    return () => {
      // Restore original methods
      Object.assign(console, originalMethods)
    }
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && isOpen) {
      const logContainer = document.getElementById('log-container')
      if (logContainer) {
        logContainer.scrollTop = logContainer.scrollHeight
      }
    }
  }, [logs, autoScroll, isOpen])

  const filteredLogs = logs.filter(log => {
    if (filter !== 'all' && log.level !== filter) return false
    if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const clearLogs = useCallback(() => {
    setLogs([])
  }, [])

  const exportLogs = useCallback(() => {
    const data = JSON.stringify(filteredLogs, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs-${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [filteredLogs])

  const getLogColor = (level: LogLevel) => {
    switch (level) {
      case 'debug': return 'text-gray-500'
      case 'info': return 'text-blue-600'
      case 'warn': return 'text-yellow-600'
      case 'error': return 'text-red-600'
      case 'fatal': return 'text-red-800 font-bold'
      default: return 'text-gray-600'
    }
  }

  if (!isOpen || !import.meta.env.DEV) return null

  return (
    <div className="fixed bottom-0 right-0 w-full md:w-1/2 lg:w-1/3 h-96 bg-gray-900 text-white shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold">Dev Console</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{filteredLogs.length} logs</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-700">
        <div className="flex items-center gap-1 flex-1">
          <FunnelIcon className="h-4 w-4 text-gray-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as LogLevel | 'all')}
            className="bg-gray-800 text-sm px-2 py-1 rounded"
          >
            <option value="all">All</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
            <option value="fatal">Fatal</option>
          </select>
        </div>
        
        <input
          type="text"
          placeholder="Search logs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-gray-800 text-sm px-2 py-1 rounded flex-1"
        />
        
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="rounded"
          />
          Auto-scroll
        </label>
        
        <button
          onClick={clearLogs}
          className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded"
        >
          Clear
        </button>
        
        <button
          onClick={exportLogs}
          className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded"
        >
          Export
        </button>
      </div>

      {/* Logs */}
      <div
        id="log-container"
        className="flex-1 overflow-y-auto p-2 font-mono text-xs"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            No logs to display
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div
              key={index}
              className="py-1 px-2 hover:bg-gray-800 border-b border-gray-800"
            >
              <div className="flex items-start gap-2">
                <span className="text-gray-500 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={`uppercase ${getLogColor(log.level)}`}>
                  [{log.level}]
                </span>
                <pre className="flex-1 whitespace-pre-wrap break-all">
                  {log.message}
                </pre>
              </div>
              {log.context && (
                <details className="ml-16 mt-1">
                  <summary className="cursor-pointer text-gray-500 text-xs">
                    Context
                  </summary>
                  <pre className="text-xs text-gray-400 mt-1">
                    {JSON.stringify(log.context, null, 2)}
                  </pre>
                </details>
              )}
              {log.error && (
                <details className="ml-16 mt-1">
                  <summary className="cursor-pointer text-red-400 text-xs">
                    Error Details
                  </summary>
                  <pre className="text-xs text-red-300 mt-1">
                    {log.stack || JSON.stringify(log.error, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-gray-700 text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <span>Debug: {logs.filter(l => l.level === 'debug').length}</span>
          <span className="text-blue-400">Info: {logs.filter(l => l.level === 'info').length}</span>
          <span className="text-yellow-400">Warn: {logs.filter(l => l.level === 'warn').length}</span>
          <span className="text-red-400">Error: {logs.filter(l => l.level === 'error').length}</span>
        </div>
        <span>
          {new Date().toLocaleTimeString()}
        </span>
      </div>
    </div>
  )
}

// Development toolbar to toggle log viewer
export const DevToolbar: React.FC = () => {
  const [showLogs, setShowLogs] = useState(false)
  
  if (!import.meta.env.DEV) return null
  
  return (
    <>
      <button
        onClick={() => setShowLogs(!showLogs)}
        className="fixed bottom-4 right-4 p-3 bg-gray-900 text-white rounded-full shadow-lg hover:bg-gray-800 z-40"
        title="Toggle dev console"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      </button>
      <LogViewer isOpen={showLogs} onClose={() => setShowLogs(false)} />
    </>
  )
}