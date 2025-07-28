#!/usr/bin/env node

/**
 * DCE Website Performance Validation Script
 * 
 * This script analyzes the Phase 3 performance optimizations
 * and generates a comprehensive performance validation report.
 */

import fs from 'fs';
import path from 'path';

console.log('🚀 DCE Website Phase 3 Performance Validation\n');

// Helper functions
function analyzeFile(filePath, description) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const size = content.length;
    console.log(`✅ ${description}: ${(size / 1024).toFixed(2)}KB`);
    return { exists: true, size, content };
  } catch (error) {
    console.log(`❌ ${description}: File not found`);
    return { exists: false, size: 0, content: '' };
  }
}

function countOccurrences(content, pattern) {
  const matches = content.match(new RegExp(pattern, 'g'));
  return matches ? matches.length : 0;
}

// 1. APM System Analysis
console.log('📊 1. APM System Analysis');
console.log('============================');

const apmFile = analyzeFile('src/lib/apm.ts', 'APM Core System');
if (apmFile.exists) {
  console.log(`   - Web Vitals observers: ${countOccurrences(apmFile.content, 'PerformanceObserver')}`);
  console.log(`   - Tracking functions: ${countOccurrences(apmFile.content, 'function track')}`);
  console.log(`   - Memory monitoring: ${apmFile.content.includes('measureUserAgentSpecificMemory') ? '✅ Modern API' : '⚠️ Legacy only'}`);
  console.log(`   - Bundle size tracking: ${apmFile.content.includes('trackBundleSize') ? '✅ Implemented' : '❌ Missing'}`);
}

// 2. Error Tracking System Analysis
console.log('\n🐛 2. Error Tracking System Analysis');
console.log('=====================================');

const errorTrackingFile = analyzeFile('src/lib/error-tracking/index.ts', 'Error Tracking System');
if (errorTrackingFile.exists) {
  console.log(`   - Breadcrumb management: ${errorTrackingFile.content.includes('addBreadcrumb') ? '✅ Implemented' : '❌ Missing'}`);
  console.log(`   - Context setting: ${errorTrackingFile.content.includes('setContext') ? '✅ Implemented' : '❌ Missing'}`);
  console.log(`   - Performance integration: ${errorTrackingFile.content.includes('performanceTracker') ? '✅ Integrated' : '❌ Separate'}`);
  console.log(`   - Lightweight design: ${(errorTrackingFile.size / 1024).toFixed(2)}KB (Target: <20KB)`);
} else {
  console.log('   ⚠️ Custom error tracking not found, checking Sentry integration...');
  const monitoringFile = analyzeFile('src/lib/monitoring.ts', 'Sentry Monitoring');
  if (monitoringFile.exists) {
    console.log(`   - Sentry integration: ✅ ${(monitoringFile.size / 1024).toFixed(2)}KB`);
    console.log(`   - Custom context: ${monitoringFile.content.includes('setContext') ? '✅' : '❌'}`);
    console.log(`   - Performance tracking: ${monitoringFile.content.includes('browserTracingIntegration') ? '✅' : '❌'}`);
  }
}

// 3. Code Splitting Analysis
console.log('\n📦 3. Code Splitting Analysis');
console.log('==============================');

const appFile = analyzeFile('src/App.tsx', 'Main App Component');
if (appFile.exists) {
  const lazyImports = countOccurrences(appFile.content, 'React\\.lazy');
  const suspenseComponents = countOccurrences(appFile.content, '<Suspense');
  const webpackComments = countOccurrences(appFile.content, 'webpackChunkName');
  
  console.log(`   - Lazy imports: ${lazyImports} components`);
  console.log(`   - Suspense boundaries: ${suspenseComponents}`);
  console.log(`   - Webpack chunk names: ${webpackComments}`);
  console.log(`   - Prefetch hints: ${countOccurrences(appFile.content, 'webpackPrefetch')}`);
  console.log(`   - Preload hints: ${countOccurrences(appFile.content, 'webpackPreload')}`);
}

// 4. Vite Configuration Analysis
console.log('\n⚙️ 4. Build Configuration Analysis');
console.log('===================================');

const viteConfig = analyzeFile('vite.config.ts', 'Vite Configuration');
if (viteConfig.exists) {
  console.log(`   - Manual chunks: ${viteConfig.content.includes('manualChunks') ? '✅ Implemented' : '❌ Missing'}`);
  console.log(`   - Bundle analyzer: ${viteConfig.content.includes('visualizer') ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   - Compression: ${viteConfig.content.includes('viteCompression') ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   - Tree shaking: ${viteConfig.content.includes('treeshake') ? '✅ Configured' : '⚠️ Default'}`);
  console.log(`   - Source maps: ${viteConfig.content.includes('sourcemap: true') ? '✅ Enabled' : '❌ Disabled'}`);
}

// 5. Package.json Size Limits Analysis
console.log('\n📏 5. Bundle Size Limits Analysis');
console.log('==================================');

const packageFile = analyzeFile('package.json', 'Package Configuration');
if (packageFile.exists) {
  try {
    const packageData = JSON.parse(packageFile.content);
    const sizeLimits = packageData['size-limit'];
    
    if (sizeLimits && Array.isArray(sizeLimits)) {
      console.log(`   - Size limit rules: ${sizeLimits.length}`);
      sizeLimits.forEach((limit, index) => {
        console.log(`   - ${limit.name}: ${limit.limit} (${limit.gzip ? 'gzipped' : 'uncompressed'})`);
      });
    } else {
      console.log('   ❌ No size limits configured');
    }
  } catch (error) {
    console.log('   ❌ Invalid package.json format');
  }
}

// 6. Performance Hooks Analysis
console.log('\n🎣 6. Performance Hooks Analysis');
console.log('=================================');

const hooksDir = 'src/hooks';
try {
  const hookFiles = fs.readdirSync(hooksDir).filter(file => file.endsWith('.ts') || file.endsWith('.tsx'));
  console.log(`   - Total hooks: ${hookFiles.length}`);
  
  hookFiles.forEach(file => {
    const hookPath = path.join(hooksDir, file);
    const hookContent = fs.readFileSync(hookPath, 'utf8');
    
    if (file.includes('useReducedMotion')) {
      console.log(`   - ${file}: ✅ Accessibility optimization`);
    }
    if (file.includes('useDebounce')) {
      console.log(`   - ${file}: ✅ Performance optimization`);
    }
    if (file.includes('useLoadingState')) {
      console.log(`   - ${file}: ✅ Loading state management`);
    }
  });
} catch (error) {
  console.log('   ❌ Hooks directory not accessible');
}

// 7. Web Vitals Implementation Check
console.log('\n🎯 7. Web Vitals Implementation');
console.log('================================');

if (apmFile.exists) {
  const webVitalsMetrics = [
    'LCP', // Largest Contentful Paint
    'FID', // First Input Delay
    'CLS', // Cumulative Layout Shift
    'FCP', // First Contentful Paint
    'TTFB', // Time to First Byte
    'INP'  // Interaction to Next Paint
  ];
  
  webVitalsMetrics.forEach(metric => {
    const implemented = apmFile.content.includes(metric);
    console.log(`   - ${metric}: ${implemented ? '✅ Tracked' : '❌ Missing'}`);
  });
  
  const observerTypes = ['largest-contentful-paint', 'first-input', 'layout-shift', 'paint'];
  console.log(`   - Performance observers: ${observerTypes.filter(type => apmFile.content.includes(type)).length}/${observerTypes.length}`);
}

// 8. Memory Management Analysis
console.log('\n🧠 8. Memory Management Analysis');
console.log('=================================');

const mainFile = analyzeFile('src/main.tsx', 'Main Entry Point');
if (mainFile.exists) {
  console.log(`   - Memory tracking: ${mainFile.content.includes('trackMemoryUsage') ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   - Cleanup handlers: ${mainFile.content.includes('removeEventListener') ? '✅ Implemented' : '❌ Missing'}`);
  console.log(`   - HMR cleanup: ${mainFile.content.includes('import.meta.hot') ? '✅ Configured' : '❌ Missing'}`);
  console.log(`   - Interval cleanup: ${mainFile.content.includes('clearInterval') ? '✅ Implemented' : '❌ Missing'}`);
}

// 9. Performance Metrics Summary
console.log('\n📈 9. Performance Optimization Summary');
console.log('======================================');

let score = 0;
let maxScore = 0;

const checks = [
  { name: 'APM System', implemented: apmFile.exists, weight: 10 },
  { name: 'Error Tracking', implemented: errorTrackingFile.exists || fs.existsSync('src/lib/monitoring.ts'), weight: 8 },
  { name: 'Code Splitting', implemented: appFile.exists && appFile.content.includes('React.lazy'), weight: 10 },
  { name: 'Bundle Analysis', implemented: viteConfig.exists && viteConfig.content.includes('visualizer'), weight: 6 },
  { name: 'Size Limits', implemented: packageFile.exists && packageFile.content.includes('size-limit'), weight: 6 },
  { name: 'Web Vitals', implemented: apmFile.exists && apmFile.content.includes('LCP'), weight: 8 },
  { name: 'Memory Management', implemented: mainFile.exists && mainFile.content.includes('trackMemoryUsage'), weight: 7 },
  { name: 'Compression', implemented: viteConfig.exists && viteConfig.content.includes('viteCompression'), weight: 5 }
];

checks.forEach(check => {
  maxScore += check.weight;
  if (check.implemented) {
    score += check.weight;
    console.log(`   ✅ ${check.name}: ${check.weight}/${check.weight} points`);
  } else {
    console.log(`   ❌ ${check.name}: 0/${check.weight} points`);
  }
});

const percentage = Math.round((score / maxScore) * 100);
console.log(`\n🏆 Overall Performance Score: ${score}/${maxScore} (${percentage}%)`);

// 10. Recommendations
console.log('\n💡 10. Recommendations for Production');
console.log('=====================================');

if (percentage >= 90) {
  console.log('   🎉 Excellent! Ready for production deployment.');
} else if (percentage >= 70) {
  console.log('   👍 Good performance setup. Consider addressing missing items.');
} else {
  console.log('   ⚠️ Performance optimizations need attention before production.');
}

const recommendations = [];

if (!apmFile.exists) {
  recommendations.push('Implement comprehensive APM system for performance monitoring');
}

if (!viteConfig.content.includes('manualChunks')) {
  recommendations.push('Configure manual chunk splitting for better caching');
}

if (!packageFile.content.includes('size-limit')) {
  recommendations.push('Set up bundle size limits with size-limit package');
}

if (!mainFile.content.includes('trackMemoryUsage')) {
  recommendations.push('Enable memory usage tracking for production monitoring');
}

if (recommendations.length > 0) {
  console.log('\n📋 Priority Actions:');
  recommendations.forEach((rec, index) => {
    console.log(`   ${index + 1}. ${rec}`);
  });
}

// 11. Performance Testing Command Suggestions
console.log('\n🧪 11. Suggested Performance Testing Commands');
console.log('=============================================');

console.log('   Development Testing:');
console.log('   npm run dev                    # Start dev server');
console.log('   npm run build                  # Build for production');
console.log('   npm run size                   # Check bundle sizes');
console.log('   npm run analyze                # Bundle analysis');
console.log('');
console.log('   Browser Testing:');
console.log('   - Open DevTools → Network tab');
console.log('   - Enable "Slow 3G" throttling');
console.log('   - Check Performance tab for Web Vitals');
console.log('   - Use Lighthouse audit');
console.log('');
console.log('   Production Testing:');
console.log('   - Test with React DevTools Profiler');
console.log('   - Monitor real user metrics');
console.log('   - Set up performance budgets');

console.log('\n✨ Performance validation complete!\n');