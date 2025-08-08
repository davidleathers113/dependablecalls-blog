#!/usr/bin/env node

/**
 * Performance monitoring script for DCE Platform
 * Analyzes bundle sizes, performance metrics, and generates reports
 */

const fs = require('fs').promises
const path = require('path')
const { execSync } = require('child_process')

// Performance thresholds
const THRESHOLDS = {
  bundleSize: {
    'index': 100 * 1024, // 100KB
    'react-core': 150 * 1024, // 150KB
    'supabase': 120 * 1024, // 120KB
    'vendor': 100 * 1024, // 100KB
  },
  lighthouse: {
    performance: 90,
    accessibility: 95,
    bestPractices: 90,
    seo: 95,
    pwa: 85
  }
}

async function analyzeBundleSize() {
  console.log('📦 Analyzing bundle sizes...\n')
  
  try {
    const distPath = path.join(process.cwd(), 'dist')
    const statsExist = await fs.access(path.join(distPath, 'stats.html')).then(() => true).catch(() => false)
    
    if (!statsExist) {
      console.log('Building project for analysis...')
      execSync('npm run build', { stdio: 'inherit' })
    }
    
    // Get bundle files
    const jsDir = path.join(distPath, 'assets', 'js')
    const files = await fs.readdir(jsDir)
    
    const bundles = []
    
    for (const file of files) {
      const filePath = path.join(jsDir, file)
      const stats = await fs.stat(filePath)
      const size = stats.size
      const gzipSize = getGzipSize(filePath)
      
      // Extract bundle name from filename
      const bundleName = file.split('-')[0] || 'unknown'
      const threshold = THRESHOLDS.bundleSize[bundleName] || 50 * 1024
      
      bundles.push({
        name: file,
        bundleName,
        size,
        gzipSize,
        threshold,
        overThreshold: gzipSize > threshold
      })
    }
    
    // Sort by size
    bundles.sort((a, b) => b.gzipSize - a.gzipSize)
    
    console.log('Bundle Analysis:')
    console.log('═'.repeat(80))
    
    let totalSize = 0
    let totalGzipSize = 0
    let issues = 0
    
    bundles.forEach(bundle => {
      totalSize += bundle.size
      totalGzipSize += bundle.gzipSize
      
      const status = bundle.overThreshold ? '❌' : '✅'
      const sizeMB = (bundle.size / 1024).toFixed(1)
      const gzipKB = (bundle.gzipSize / 1024).toFixed(1)
      const thresholdKB = (bundle.threshold / 1024).toFixed(1)
      
      console.log(`${status} ${bundle.name}`)
      console.log(`   Size: ${sizeMB}KB (${gzipKB}KB gzipped) | Threshold: ${thresholdKB}KB`)
      
      if (bundle.overThreshold) {
        issues++
        const excess = ((bundle.gzipSize - bundle.threshold) / 1024).toFixed(1)
        console.log(`   ⚠️  Over threshold by ${excess}KB`)
      }
      
      console.log()
    })
    
    console.log('Summary:')
    console.log(`📊 Total size: ${(totalSize / 1024).toFixed(1)}KB (${(totalGzipSize / 1024).toFixed(1)}KB gzipped)`)
    console.log(`⚠️  Issues found: ${issues}`)
    
    return { bundles, totalSize, totalGzipSize, issues }
    
  } catch (error) {
    console.error('Error analyzing bundle size:', error.message)
    return null
  }
}

function getGzipSize(filePath) {
  try {
    // Use gzip to get compressed size
    const result = execSync(`gzip -c "${filePath}" | wc -c`, { encoding: 'utf8' })
    return parseInt(result.trim())
  } catch (error) {
    // Fallback to approximate gzip size (usually ~30% of original)
    const stats = require('fs').statSync(filePath)
    return Math.floor(stats.size * 0.3)
  }
}

async function runLighthouseAudit() {
  console.log('\n🚢 Running Lighthouse audit...\n')
  
  try {
    // Start preview server
    console.log('Starting preview server...')
    const serverProcess = require('child_process').spawn('npm', ['run', 'preview'], {
      detached: true,
      stdio: 'pipe'
    })
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Run Lighthouse
    const lighthouseCmd = `npx lighthouse http://localhost:4173 --output json --quiet --chrome-flags="--headless --no-sandbox"`
    const result = execSync(lighthouseCmd, { encoding: 'utf8' })
    const report = JSON.parse(result)
    
    // Kill preview server
    process.kill(-serverProcess.pid, 'SIGTERM')
    
    // Analyze results
    const categories = report.categories
    const scores = {
      performance: Math.round(categories.performance.score * 100),
      accessibility: Math.round(categories.accessibility.score * 100),
      bestPractices: Math.round(categories['best-practices'].score * 100),
      seo: Math.round(categories.seo.score * 100),
      pwa: Math.round(categories.pwa.score * 100)
    }
    
    console.log('Lighthouse Scores:')
    console.log('═'.repeat(50))
    
    Object.entries(scores).forEach(([category, score]) => {
      const threshold = THRESHOLDS.lighthouse[category]
      const status = score >= threshold ? '✅' : '❌'
      const categoryName = category.charAt(0).toUpperCase() + category.slice(1).replace(/([A-Z])/g, ' $1')
      
      console.log(`${status} ${categoryName}: ${score}/100 (threshold: ${threshold})`)
    })
    
    // Core Web Vitals
    const audits = report.audits
    console.log('\nCore Web Vitals:')
    console.log('─'.repeat(30))
    
    const coreVitals = {
      'Largest Contentful Paint': audits['largest-contentful-paint'],
      'First Input Delay': audits['max-potential-fid'],
      'Cumulative Layout Shift': audits['cumulative-layout-shift']
    }
    
    Object.entries(coreVitals).forEach(([name, audit]) => {
      if (audit) {
        const score = audit.score >= 0.9 ? '✅' : audit.score >= 0.5 ? '⚠️' : '❌'
        console.log(`${score} ${name}: ${audit.displayValue}`)
      }
    })
    
    return { scores, report }
    
  } catch (error) {
    console.error('Error running Lighthouse audit:', error.message)
    return null
  }
}

async function analyzePerformanceMetrics() {
  console.log('\n⚡ Analyzing performance metrics...\n')
  
  try {
    // Read performance data from build
    const buildStatsPath = path.join(process.cwd(), 'dist', 'stats.html')
    
    if (await fs.access(buildStatsPath).then(() => true).catch(() => false)) {
      console.log('✅ Bundle analyzer stats available at dist/stats.html')
    }
    
    // Check for source maps
    const distPath = path.join(process.cwd(), 'dist')
    const files = await fs.readdir(path.join(distPath, 'assets', 'js'))
    const hasSourceMaps = files.some(file => file.endsWith('.map'))
    
    console.log(`📍 Source maps: ${hasSourceMaps ? '✅ Generated' : '❌ Missing'}`)
    
    // Check for compression
    const htmlPath = path.join(distPath, 'index.html')
    const htmlContent = await fs.readFile(htmlPath, 'utf8')
    const hasPreload = htmlContent.includes('rel="preload"')
    const hasPrefetch = htmlContent.includes('rel="prefetch"')
    
    console.log(`🚀 Resource hints:`)
    console.log(`   Preload: ${hasPreload ? '✅' : '❌'}`)
    console.log(`   Prefetch: ${hasPrefetch ? '✅' : '❌'}`)
    
    return {
      hasSourceMaps,
      hasPreload,
      hasPrefetch
    }
    
  } catch (error) {
    console.error('Error analyzing performance metrics:', error.message)
    return null
  }
}

async function generateReport() {
  console.log('📊 Generating Performance Report')
  console.log('═'.repeat(50))
  console.log(`Timestamp: ${new Date().toISOString()}`)
  console.log(`Node.js: ${process.version}`)
  console.log(`Platform: ${process.platform}`)
  console.log('')
  
  const results = {}
  
  // Bundle analysis
  results.bundles = await analyzeBundleSize()
  
  // Performance metrics
  results.metrics = await analyzePerformanceMetrics()
  
  // Lighthouse audit (optional - can be slow)
  if (process.argv.includes('--lighthouse')) {
    results.lighthouse = await runLighthouseAudit()
  } else {
    console.log('\n💡 Tip: Add --lighthouse flag for full Lighthouse audit')
  }
  
  // Generate recommendations
  console.log('\n🎯 Recommendations:')
  console.log('═'.repeat(30))
  
  if (results.bundles?.issues > 0) {
    console.log('❌ Bundle size issues found:')
    console.log('   - Consider code splitting for large bundles')
    console.log('   - Use dynamic imports for non-critical code')
    console.log('   - Remove unused dependencies')
  }
  
  if (!results.metrics?.hasSourceMaps) {
    console.log('❌ Source maps missing - enable for better debugging')
  }
  
  if (!results.metrics?.hasPreload) {
    console.log('⚠️  Consider adding resource preload hints for critical assets')
  }
  
  if (results.lighthouse?.scores?.performance < THRESHOLDS.lighthouse.performance) {
    console.log('⚠️  Lighthouse performance score below threshold')
    console.log('   - Optimize images and assets')
    console.log('   - Implement lazy loading')
    console.log('   - Reduce JavaScript execution time')
  }
  
  // Save report
  const reportPath = path.join(process.cwd(), 'performance-report.json')
  await fs.writeFile(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    ...results
  }, null, 2))
  
  console.log(`\n📄 Full report saved to: ${reportPath}`)
  
  // Exit with error code if issues found
  const hasIssues = results.bundles?.issues > 0 || 
                   (results.lighthouse?.scores?.performance || 100) < THRESHOLDS.lighthouse.performance
  
  if (hasIssues && process.argv.includes('--strict')) {
    console.log('\n❌ Performance issues found - exiting with error code')
    process.exit(1)
  }
  
  console.log('\n✅ Performance analysis complete!')
}

// Main execution
if (require.main === module) {
  generateReport().catch(error => {
    console.error('Performance monitoring failed:', error)
    process.exit(1)
  })
}

module.exports = {
  analyzeBundleSize,
  runLighthouseAudit,
  analyzePerformanceMetrics,
  generateReport
}