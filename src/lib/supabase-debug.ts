/**
 * Debug utilities for monitoring Supabase client instances
 * Only active in development mode
 */

interface ClientInstanceInfo {
  id: number
  timestamp: string
  stackTrace?: string
  url: string
}

class SupabaseDebugger {
  private static instances: ClientInstanceInfo[] = []
  private static warningThreshold = 1
  private static isEnabled = import.meta.env.MODE === 'development'

  /**
   * Log a new client instance creation
   */
  static logInstance(url: string): void {
    if (!this.isEnabled) return

    const instanceInfo: ClientInstanceInfo = {
      id: this.instances.length + 1,
      timestamp: new Date().toISOString(),
      url,
      stackTrace: new Error().stack?.split('\n').slice(2, 7).join('\n'),
    }

    this.instances.push(instanceInfo)

    // Log to console with color coding
    const isWarning = this.instances.length > this.warningThreshold
    const logStyle = isWarning 
      ? 'background: #ff6b6b; color: white; padding: 2px 4px; border-radius: 3px;'
      : 'background: #4ecdc4; color: white; padding: 2px 4px; border-radius: 3px;'

    console.group(
      `%c[SupabaseDebug] Client Instance #${instanceInfo.id}`,
      logStyle
    )
    console.log('Timestamp:', instanceInfo.timestamp)
    console.log('URL:', instanceInfo.url)
    if (instanceInfo.stackTrace) {
      console.log('Stack trace:')
      console.log(instanceInfo.stackTrace)
    }
    console.groupEnd()

    // Show warning if multiple instances detected
    if (isWarning) {
      console.warn(
        `⚠️ [SupabaseDebug] Multiple Supabase client instances detected (${this.instances.length})!`,
        '\nThis may cause "Multiple GoTrueClient instances" warnings.',
        '\nInstances:', this.instances
      )
    }
  }

  /**
   * Get all recorded instances
   */
  static getInstances(): ClientInstanceInfo[] {
    return [...this.instances]
  }

  /**
   * Clear recorded instances (for testing)
   */
  static clearInstances(): void {
    if (!this.isEnabled) return
    this.instances = []
    console.log('[SupabaseDebug] Instance history cleared')
  }

  /**
   * Get instance count
   */
  static getInstanceCount(): number {
    return this.instances.length
  }

  /**
   * Check if multiple instances have been created
   */
  static hasMultipleInstances(): boolean {
    return this.instances.length > this.warningThreshold
  }

  /**
   * Generate a report of all instances
   */
  static generateReport(): string {
    if (!this.isEnabled) return 'Debugging disabled in production'

    const report = [
      '=== Supabase Client Instance Report ===',
      `Total instances created: ${this.instances.length}`,
      `Multiple instances warning: ${this.hasMultipleInstances() ? 'YES ⚠️' : 'NO ✅'}`,
      '',
      'Instance Details:',
      ...this.instances.map(inst => 
        `  #${inst.id} - ${inst.timestamp} - ${inst.url}`
      ),
    ].join('\n')

    return report
  }

  /**
   * Monitor GoTrueClient warnings in console
   */
  static monitorConsoleWarnings(): void {
    if (!this.isEnabled || typeof window === 'undefined') return

    const originalWarn = console.warn
    console.warn = function(...args: unknown[]) {
      const message = args[0]?.toString() || ''
      
      // Check for GoTrueClient warning
      if (message.includes('Multiple GoTrueClient instances')) {
        console.group(
          '%c[SupabaseDebug] GoTrueClient Warning Intercepted',
          'background: #ff6b6b; color: white; padding: 2px 4px; border-radius: 3px;'
        )
        console.log('Current instance count:', SupabaseDebugger.getInstanceCount())
        console.log('Instance report:')
        console.log(SupabaseDebugger.generateReport())
        console.groupEnd()
      }

      // Call original console.warn
      originalWarn.apply(console, args)
    }
  }
}

// Auto-enable console monitoring in development
if (import.meta.env.MODE === 'development' && typeof window !== 'undefined') {
  SupabaseDebugger.monitorConsoleWarnings()
  
  // Expose debugger to window for manual inspection
  interface WindowWithSupabaseDebugger extends Window {
    __supabaseDebugger: {
      getInstances: () => ClientInstanceInfo[]
      getInstanceCount: () => number
      generateReport: () => string
      clearInstances: () => void
    }
  }

  (window as unknown as WindowWithSupabaseDebugger).__supabaseDebugger = {
    getInstances: () => SupabaseDebugger.getInstances(),
    getInstanceCount: () => SupabaseDebugger.getInstanceCount(),
    generateReport: () => {
      const report = SupabaseDebugger.generateReport()
      console.log(report)
      return report
    },
    clearInstances: () => SupabaseDebugger.clearInstances(),
  }

  console.log(
    '%c[SupabaseDebug] Debugger enabled',
    'background: #4ecdc4; color: white; padding: 2px 4px; border-radius: 3px;',
    '\nAccess via: window.__supabaseDebugger'
  )
}

export { SupabaseDebugger }
export type { ClientInstanceInfo }