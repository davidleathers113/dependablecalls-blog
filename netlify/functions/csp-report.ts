/**
 * Advanced CSP v3 Violation Reporting Endpoint
 * 
 * Enhanced violation monitoring with alerting, analytics, and 
 * automated threat detection for CSP strict-dynamic compliance.
 */

import type { Context } from '@netlify/functions'

// CSP v2 format (deprecated but still used by some browsers)
interface CSPViolationReport {
  'csp-report': {
    'document-uri': string
    referrer: string
    'violated-directive': string
    'effective-directive': string
    'original-policy': string
    disposition: string
    'blocked-uri': string
    'line-number': number
    'column-number': number
    'source-file': string
    'status-code': number
    'script-sample': string
  }
}

// CSP v3 format with report-to API
interface CSPViolationReportV3 {
  age: number
  body: {
    blockedURL: string
    disposition: string
    documentURL: string
    effectiveDirective: string
    lineNumber: number
    columnNumber: number
    originalPolicy: string
    referrer: string
    sample: string
    sourceFile: string
    statusCode: number
    violatedDirective: string
  }
  type: 'csp-violation'
  url: string
  user_agent: string
}

type CSPReport = CSPViolationReport | CSPViolationReportV3[]

// Threat detection patterns
interface ThreatPattern {
  name: string
  pattern: string | RegExp
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  description: string
}

const THREAT_PATTERNS: ThreatPattern[] = [
  {
    name: 'XSS_ATTEMPT',
    pattern: /(?:javascript:|data:text\/html|vbscript:|onload=|onerror=)/i,
    severity: 'CRITICAL',
    description: 'Potential XSS injection attempt'
  },
  {
    name: 'INLINE_SCRIPT_INJECTION',
    pattern: /(?:eval\(|Function\(|setTimeout\(.*string|setInterval\(.*string)/i,
    severity: 'HIGH',
    description: 'Inline script injection attempt'
  },
  {
    name: 'FRAME_HIJACKING',
    pattern: /(?:top\.location|parent\.location|window\.open)/i,
    severity: 'HIGH',
    description: 'Potential frame hijacking attempt'
  },
  {
    name: 'DATA_EXFILTRATION',
    pattern: /(?:fetch\(|XMLHttpRequest|navigator\.sendBeacon)/i,
    severity: 'MEDIUM',
    description: 'Potential data exfiltration attempt'
  },
  {
    name: 'CRYPTO_MINING',
    pattern: /(?:coinhive|cryptoloot|crypto-loot|coin-hive)/i,
    severity: 'HIGH',
    description: 'Cryptocurrency mining script detected'
  }
]

// Rate limiting storage (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; timestamp: number }>()
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const RATE_LIMIT_MAX = 10 // Max 10 reports per minute per IP

/**
 * Normalize CSP report format (handle both v2 and v3)
 */
function normalizeCSPReport(report: CSPReport): Record<string, unknown> {
  if (Array.isArray(report)) {
    // CSP v3 format
    const v3Report = report[0];
    if (v3Report && v3Report.type === 'csp-violation') {
      return {
        'document-uri': v3Report.body.documentURL,
        'violated-directive': v3Report.body.violatedDirective,
        'effective-directive': v3Report.body.effectiveDirective,
        'blocked-uri': v3Report.body.blockedURL,
        'source-file': v3Report.body.sourceFile,
        'line-number': v3Report.body.lineNumber,
        'column-number': v3Report.body.columnNumber,
        'script-sample': v3Report.body.sample,
        'original-policy': v3Report.body.originalPolicy,
        referrer: v3Report.body.referrer,
        disposition: v3Report.body.disposition
      };
    }
  }
  
  // CSP v2 format
  return (report as CSPViolationReport)['csp-report'];
}

/**
 * Detect potential security threats
 */
function detectThreats(violation: Record<string, unknown>): { threats: ThreatPattern[]; severity: string } {
  const detectedThreats: ThreatPattern[] = [];
  const searchText = [
    violation['blocked-uri'],
    violation['script-sample'],
    violation['source-file']
  ].filter(Boolean).join(' ');
  
  for (const pattern of THREAT_PATTERNS) {
    if (typeof pattern.pattern === 'string') {
      if (searchText.includes(pattern.pattern)) {
        detectedThreats.push(pattern);
      }
    } else {
      if (pattern.pattern.test(searchText)) {
        detectedThreats.push(pattern);
      }
    }
  }
  
  // Determine overall severity
  const severityLevels = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  const maxSeverity = detectedThreats.reduce((max, threat) => {
    return severityLevels[threat.severity] > severityLevels[max] ? threat.severity : max;
  }, 'LOW');
  
  return { threats: detectedThreats, severity: maxSeverity };
}

/**
 * Rate limiting check
 */
function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const key = `csp_${ip}`;
  const current = rateLimitStore.get(key);
  
  if (!current || (now - current.timestamp) > RATE_LIMIT_WINDOW) {
    // Reset or create new entry
    rateLimitStore.set(key, { count: 1, timestamp: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  
  if (current.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }
  
  // Increment count
  current.count++;
  rateLimitStore.set(key, current);
  
  return { allowed: true, remaining: RATE_LIMIT_MAX - current.count };
}

/**
 * Enhanced CSP violation processing
 */
function processCSPReport(report: CSPReport, userAgent: string, ip: string) {
  const violation = normalizeCSPReport(report);
  
  // Enhanced false positive filtering
  const ignoredPatterns = [
    /^(?:browser|moz|chrome|safari|edge)-extension:/,
    /^data:text\/css/,
    /^blob:/,
    /^about:/,
    /^webpack-internal:/,
    /^chrome-devtools:/,
    /^devtools:/,
    // Common legitimate browser behaviors
    /^https:\/\/.*\.google\.com\/.*analytics/,
    /^https:\/\/.*\.facebook\.com\/.*pixel/,
    /^https:\/\/.*\.doubleclick\.net/gi
  ];
  
  const blockedUri = violation['blocked-uri'] || '';
  const shouldIgnore = ignoredPatterns.some(pattern => pattern.test(blockedUri));
  
  if (shouldIgnore) {
    return { action: 'ignored', reason: 'Known false positive', severity: 'LOW' };
  }
  
  // Threat detection
  const threatAnalysis = detectThreats(violation);
  
  // Security relevance assessment
  const highRiskDirectives = [
    'script-src', 'script-src-elem', 'script-src-attr',
    'object-src', 'frame-src', 'base-uri',
    'require-trusted-types-for'
  ];
  
  const isHighRisk = highRiskDirectives.some(directive =>
    violation['violated-directive']?.includes(directive)
  );
  
  // Calculate final severity
  let finalSeverity = threatAnalysis.severity;
  if (isHighRisk && finalSeverity === 'LOW') {
    finalSeverity = 'MEDIUM';
  }
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    version: Array.isArray(report) ? 'v3' : 'v2',
    documentUri: violation['document-uri'],
    violatedDirective: violation['violated-directive'],
    effectiveDirective: violation['effective-directive'],
    blockedUri: violation['blocked-uri'],
    sourceFile: violation['source-file'],
    lineNumber: violation['line-number'],
    columnNumber: violation['column-number'],
    scriptSample: violation['script-sample'],
    userAgent: userAgent.substring(0, 200), // Truncate for storage
    ip: ip.replace(/:\d+$/, ''), // Remove port for privacy
    isHighRisk,
    threats: threatAnalysis.threats,
    severity: finalSeverity,
    disposition: violation.disposition || 'enforce'
  };
  
  // Enhanced logging based on severity
  if (finalSeverity === 'CRITICAL' || finalSeverity === 'HIGH') {
    console.error('🚨 HIGH SEVERITY CSP Violation:', JSON.stringify(logEntry, null, 2));
    // In production: trigger immediate alert
  } else if (finalSeverity === 'MEDIUM') {
    console.warn('⚠️ MEDIUM SEVERITY CSP Violation:', JSON.stringify(logEntry, null, 2));
  } else {
    console.log('📊 CSP Violation:', JSON.stringify(logEntry, null, 2));
  }
  
  return { 
    action: 'processed', 
    severity: finalSeverity,
    threats: threatAnalysis.threats.length,
    highRisk: isHighRisk
  };
}

/**
 * Netlify Function: CSP Report Handler
 */
export default async (request: Request, context: Context) => {
  const startTime = Date.now();
  
  // Only accept POST requests
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405,
      headers: { 'Allow': 'POST' }
    })
  }
  
  // Get client information early for rate limiting
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const ip = context.ip || 'unknown'
  
  // Rate limiting check
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({
      status: 'rate_limited',
      message: 'Too many reports from this IP'
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(Date.now() + RATE_LIMIT_WINDOW).toISOString()
      }
    })
  }
  
  // Validate Content-Type (support both v2 and v3 formats)
  const contentType = request.headers.get('content-type') || ''
  const validContentTypes = [
    'application/csp-report',
    'application/json',
    'application/reports+json' // CSP v3 format
  ]
  
  if (!validContentTypes.some(type => contentType.includes(type))) {
    return new Response('Invalid content type', { 
      status: 400,
      headers: {
        'X-RateLimit-Remaining': rateLimit.remaining.toString()
      }
    })
  }
  
  try {
    // Parse report (handle both CSP v2 and v3 formats)
    const report = await request.json() as CSPReport
    
    // Validate report structure
    let isValidReport = false
    if (Array.isArray(report)) {
      // CSP v3 format
      isValidReport = report.length > 0 && report[0].type === 'csp-violation'
    } else if (report && (report as CSPViolationReport)['csp-report']) {
      // CSP v2 format
      isValidReport = true
    }
    
    if (!isValidReport) {
      return new Response('Invalid CSP report format', { 
        status: 400,
        headers: {
          'X-RateLimit-Remaining': rateLimit.remaining.toString()
        }
      })
    }
    
    // Process the violation with enhanced analysis
    const result = processCSPReport(report, userAgent, ip)
    
    const processingTime = Date.now() - startTime;
    
    // Response varies based on severity
    const responseData = {
      status: 'received',
      action: result.action,
      severity: result.severity,
      threats: result.threats,
      highRisk: result.highRisk,
      timestamp: new Date().toISOString(),
      processingTime: `${processingTime}ms`
    }
    
    const statusCode = result.severity === 'CRITICAL' ? 202 : 200 // 202 for critical (accepted for processing)
    
    return new Response(JSON.stringify(responseData), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-Processing-Time': `${processingTime}ms`,
        'X-CSP-Version': Array.isArray(report) ? 'v3' : 'v2'
      }
    })
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Error processing CSP report:', error)
    
    return new Response(JSON.stringify({
      status: 'error',
      message: 'Failed to process report',
      timestamp: new Date().toISOString(),
      processingTime: `${processingTime}ms`
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-Processing-Time': `${processingTime}ms`
      }
    })
  }
}