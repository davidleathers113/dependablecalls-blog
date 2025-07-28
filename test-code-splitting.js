#!/usr/bin/env node

/**
 * Code Splitting & Loading Performance Test
 * 
 * Tests the lazy loading implementation, chunk loading patterns,
 * and validates the optimization strategies in the DCE website.
 */

import fs from 'fs';
import path from 'path';

console.log('📦 Code Splitting & Loading Performance Test\n');

// Helper function to analyze lazy imports in a file
function analyzeLazyImports(filePath, fileName) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Find all React.lazy imports
    const lazyImportRegex = /React\.lazy\(\(\) =>\s*import\((.*?)\)/g;
    const lazyImports = [];
    let match;
    
    while ((match = lazyImportRegex.exec(content)) !== null) {
      const importStatement = match[1];
      
      // Extract webpack magic comments
      const webpackChunkName = importStatement.match(/webpackChunkName:\s*["']([^"']+)["']/);
      const webpackPrefetch = importStatement.includes('webpackPrefetch: true');
      const webpackPreload = importStatement.includes('webpackPreload: true');
      
      // Extract import path
      const pathMatch = importStatement.match(/['"]([^'"]+)['"]/)
      const importPath = pathMatch ? pathMatch[1] : 'unknown';
      
      lazyImports.push({
        chunkName: webpackChunkName ? webpackChunkName[1] : 'unnamed',
        prefetch: webpackPrefetch,
        preload: webpackPreload,
        path: importPath,
        fullMatch: match[0]
      });
    }
    
    // Find Suspense boundaries
    const suspenseCount = (content.match(/<Suspense/g) || []).length;
    
    return {
      file: fileName,
      size: (content.length / 1024).toFixed(2) + 'KB',
      lazyImports,
      suspenseCount,
      totalImports: lazyImports.length
    };
    
  } catch (error) {
    return {
      file: fileName,
      error: 'Could not analyze file'
    };
  }
}

// Analyze the main App.tsx file
console.log('1. Analyzing Main Application File');
console.log('==================================');

const appAnalysis = analyzeLazyImports('src/App.tsx', 'App.tsx');

if (appAnalysis.error) {
  console.log(`❌ ${appAnalysis.error}`);
} else {
  console.log(`📁 File: ${appAnalysis.file} (${appAnalysis.size})`);
  console.log(`📦 Lazy imports: ${appAnalysis.totalImports}`);
  console.log(`🔄 Suspense boundaries: ${appAnalysis.suspenseCount}`);
  
  console.log('\n2. Lazy Loading Strategy Analysis');
  console.log('=================================');
  
  // Categorize imports by loading strategy
  const preloadComponents = appAnalysis.lazyImports.filter(imp => imp.preload);
  const prefetchComponents = appAnalysis.lazyImports.filter(imp => imp.prefetch);
  const standardComponents = appAnalysis.lazyImports.filter(imp => !imp.preload && !imp.prefetch);
  
  console.log(`⚡ Preload (critical): ${preloadComponents.length} components`);
  preloadComponents.forEach(comp => {
    console.log(`   - ${comp.chunkName}: ${comp.path}`);
  });
  
  console.log(`🔮 Prefetch (likely needed): ${prefetchComponents.length} components`);  
  prefetchComponents.forEach(comp => {
    console.log(`   - ${comp.chunkName}: ${comp.path}`);
  });
  
  console.log(`📦 Standard (on-demand): ${standardComponents.length} components`);
  
  // Analyze chunk naming strategy
  console.log('\n3. Chunk Naming Strategy');
  console.log('========================');
  
  const chunkCategories = {};
  appAnalysis.lazyImports.forEach(imp => {
    const category = imp.chunkName.split('-')[0];
    if (!chunkCategories[category]) {
      chunkCategories[category] = [];
    }
    chunkCategories[category].push(imp.chunkName);
  });
  
  Object.entries(chunkCategories).forEach(([category, chunks]) => {
    console.log(`📂 ${category}: ${chunks.length} chunks`);
    chunks.forEach(chunk => console.log(`   - ${chunk}`));
  });
}

// Analyze Vite configuration for bundle splitting
console.log('\n4. Bundle Splitting Configuration');
console.log('==================================');

try {
  const viteConfig = fs.readFileSync('vite.config.ts', 'utf8');
  
  if (viteConfig.includes('manualChunks')) {
    console.log('✅ Manual chunking configured');
    
    // Extract manual chunks configuration
    const manualChunksMatch = viteConfig.match(/manualChunks:\s*{([^}]+)}/s);
    if (manualChunksMatch) {
      const chunksContent = manualChunksMatch[1];
      const chunkEntries = chunksContent.match(/'([^']+)':\s*\[[^\]]+\]/g) || [];
      
      console.log(`📊 Configured chunks: ${chunkEntries.length}`);
      chunkEntries.forEach(entry => {
        const chunkName = entry.match(/'([^']+)':/)[1];
        const dependencies = entry.match(/\[([^\]]+)\]/)[1];
        const depCount = dependencies.split(',').length;
        console.log(`   - ${chunkName}: ${depCount} dependencies`);
      });
    }
  } else {
    console.log('⚠️ Manual chunking not configured');
  }
  
  // Check for compression
  if (viteConfig.includes('viteCompression')) {
    console.log('✅ Compression enabled');
  } else {
    console.log('❌ Compression not enabled');
  }
  
  // Check for bundle analyzer
  if (viteConfig.includes('visualizer')) {
    console.log('✅ Bundle analyzer configured');
  } else {
    console.log('❌ Bundle analyzer not configured'); 
  }
  
} catch (error) {
  console.log('❌ Could not analyze Vite configuration');
}

// Analyze package.json for size limits
console.log('\n5. Bundle Size Monitoring');
console.log('=========================');

try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const sizeLimits = packageJson['size-limit'];
  
  if (sizeLimits && Array.isArray(sizeLimits)) {
    console.log(`📏 Size limit rules: ${sizeLimits.length}`);
    
    // Categorize by limit size
    const limits = {
      small: sizeLimits.filter(l => parseInt(l.limit) <= 50),
      medium: sizeLimits.filter(l => parseInt(l.limit) > 50 && parseInt(l.limit) <= 150),
      large: sizeLimits.filter(l => parseInt(l.limit) > 150)
    };
    
    console.log(`   - Small chunks (≤50KB): ${limits.small.length}`);
    console.log(`   - Medium chunks (51-150KB): ${limits.medium.length}`);
    console.log(`   - Large chunks (>150KB): ${limits.large.length}`);
    
    // Find the most critical limits
    const criticalLimits = sizeLimits.filter(l => 
      l.name.includes('Initial load') || 
      l.name.includes('Main app') ||
      l.name.includes('Total')
    );
    
    console.log('\n📊 Critical Performance Budgets:');
    criticalLimits.forEach(limit => {
      console.log(`   - ${limit.name}: ${limit.limit}`);
    });
    
  } else {
    console.log('❌ No size limits configured');
  }
  
} catch (error) {
  console.log('❌ Could not analyze package.json');
}

// Performance optimization analysis
console.log('\n6. Loading Performance Optimization');
console.log('===================================');

const optimizationChecks = [
  {
    name: 'Route-based splitting',
    check: appAnalysis.lazyImports?.some(imp => imp.path.includes('/pages/')),
    description: 'Each route loads only necessary code'
  },
  {
    name: 'Feature-based splitting',
    check: appAnalysis.lazyImports?.some(imp => imp.path.includes('/settings/')),
    description: 'Features split into separate chunks'
  },
  {
    name: 'Critical path preloading',
    check: appAnalysis.lazyImports?.some(imp => imp.preload),
    description: 'Critical components preloaded'
  },
  {
    name: 'Strategic prefetching',
    check: appAnalysis.lazyImports?.some(imp => imp.prefetch),
    description: 'Likely-needed components prefetched'
  },
  {
    name: 'Proper fallback UI',
    check: appAnalysis.suspenseCount > 0,
    description: 'Loading states configured'
  }
];

console.log('Optimization Strategy Validation:');
optimizationChecks.forEach(check => {
  const status = check.check ? '✅' : '❌';
  console.log(`   ${status} ${check.name}: ${check.description}`);
});

// Loading performance recommendations
console.log('\n7. Loading Performance Recommendations');
console.log('=====================================');

const recommendations = [];

if (!appAnalysis.lazyImports?.some(imp => imp.preload)) {
  recommendations.push('Add preload hints for critical routes (login, dashboard)');
}

const prefetchRatio = appAnalysis.lazyImports?.filter(imp => imp.prefetch).length / appAnalysis.totalImports;
if (prefetchRatio < 0.3) {
  recommendations.push('Consider adding more prefetch hints for commonly accessed routes');
}

if (appAnalysis.suspenseCount < appAnalysis.totalImports) {
  recommendations.push('Ensure all lazy components have Suspense boundaries');
}

try {
  const viteConfig = fs.readFileSync('vite.config.ts', 'utf8');
  if (!viteConfig.includes('viteCompression')) {
    recommendations.push('Enable compression for smaller bundle sizes');
  }
} catch (error) {
  // Config file not accessible
}

if (recommendations.length > 0) {
  console.log('💡 Suggested Improvements:');
  recommendations.forEach((rec, index) => {
    console.log(`   ${index + 1}. ${rec}`);
  });
} else {
  console.log('🎉 All loading performance optimizations implemented!');
}

// Network loading simulation
console.log('\n8. Network Loading Simulation');
console.log('=============================');

const simulateChunkLoading = (chunks, connectionSpeed) => {
  const speeds = {
    '3G': { bandwidth: 0.4, latency: 400 }, // 400 Kbps, 400ms latency
    '4G': { bandwidth: 10, latency: 100 },   // 10 Mbps, 100ms latency
    'WiFi': { bandwidth: 50, latency: 20 }   // 50 Mbps, 20ms latency
  };
  
  const speed = speeds[connectionSpeed];
  const averageChunkSize = 50; // KB
  
  const downloadTime = (averageChunkSize * 8) / (speed.bandwidth * 1024); // Convert to seconds
  const totalTime = speed.latency / 1000 + downloadTime; // Add latency
  
  return {
    connectionSpeed,
    chunksToLoad: chunks,
    estimatedTime: (totalTime * chunks).toFixed(2) + 's',
    parallelTime: (speed.latency / 1000 + downloadTime).toFixed(2) + 's'
  };
};

// Simulate loading for different routes
const routeSimulations = [
  { route: 'Home page', chunks: 1 },
  { route: 'Dashboard', chunks: 3 },
  { route: 'Settings page', chunks: 2 },
  { route: 'Complex workflow', chunks: 5 }
];

console.log('Loading time estimations:');
['3G', '4G', 'WiFi'].forEach(connection => {
  console.log(`\n📶 ${connection} Network:`);
  routeSimulations.forEach(route => {
    const simulation = simulateChunkLoading(route.chunks, connection);
    console.log(`   ${route.route}: ${simulation.estimatedTime} (parallel: ${simulation.parallelTime})`);
  });
});

// Final assessment
console.log('\n9. Code Splitting Assessment');
console.log('============================');

const totalScore = optimizationChecks.filter(check => check.check).length;
const maxScore = optimizationChecks.length;
const percentage = Math.round((totalScore / maxScore) * 100);

console.log(`🏆 Code Splitting Score: ${totalScore}/${maxScore} (${percentage}%)`);

if (percentage >= 90) {
  console.log('🎉 Excellent code splitting implementation!');
  console.log('✅ Ready for production deployment');
} else if (percentage >= 70) {
  console.log('👍 Good code splitting setup');
  console.log('⚠️ Consider addressing missing optimizations');
} else {
  console.log('⚠️ Code splitting needs improvement');
  console.log('❌ Review implementation before production');
}

console.log('\n✅ Code splitting analysis complete!\n');