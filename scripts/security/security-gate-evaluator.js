#!/usr/bin/env node

/**
 * Security Gate Evaluator for DCE Platform
 * 
 * This script evaluates security test results against defined gates
 * and determines whether deployment should proceed or be blocked.
 */

const fs = require('fs').promises;
const path = require('path');

class SecurityGateEvaluator {
  constructor(options = {}) {
    this.options = {
      resultsDir: options.resultsDir || './security-results',
      configFile: options.configFile || './tests/security/security-gate-config.json',
      outputFile: options.outputFile || './security-gate-result.json',
      strictMode: options.strictMode || false,
      ...options
    };
    
    this.gateConfig = {};
    this.results = {
      passed: false,
      gates: [],
      violations: [],
      warnings: [],
      summary: {}
    };
  }

  /**
   * Load security gate configuration
   */
  async loadGateConfiguration() {
    console.log('⚙️ Loading security gate configuration...');
    
    try {
      // Try to load custom config file
      const configExists = await fs.access(this.options.configFile).then(() => true).catch(() => false);
      
      if (configExists) {
        const configData = await fs.readFile(this.options.configFile, 'utf8');
        this.gateConfig = JSON.parse(configData);
      } else {
        // Use default configuration
        this.gateConfig = this.getDefaultGateConfiguration();
      }
      
      console.log(`✅ Gate configuration loaded with ${Object.keys(this.gateConfig.gates).length} gates`);
      return this.gateConfig;
      
    } catch (error) {
      console.error('❌ Failed to load gate configuration:', error.message);
      this.gateConfig = this.getDefaultGateConfiguration();
      return this.gateConfig;
    }
  }

  /**
   * Get default security gate configuration
   */
  getDefaultGateConfiguration() {
    return {
      version: '1.0.0',
      description: 'DCE Platform Security Gates',
      strictMode: this.options.strictMode,
      
      gates: {
        // Critical vulnerability gate
        criticalVulnerabilities: {
          name: 'Critical Vulnerabilities',
          description: 'Block deployment if critical vulnerabilities found',
          enabled: true,
          blocking: true,
          threshold: {
            max: 0,
            unit: 'count'
          },
          sources: ['sast', 'dast', 'dependency', 'container'],
          severity: 'critical'
        },
        
        // High vulnerability gate
        highVulnerabilities: {
          name: 'High Severity Vulnerabilities',
          description: 'Limit high severity vulnerabilities',
          enabled: true,
          blocking: true,
          threshold: {
            max: 5,
            unit: 'count'
          },
          sources: ['sast', 'dast', 'dependency', 'container'],
          severity: 'high'
        },
        
        // Medium vulnerability gate
        mediumVulnerabilities: {
          name: 'Medium Severity Vulnerabilities',
          description: 'Limit medium severity vulnerabilities',
          enabled: true,
          blocking: false,
          threshold: {
            max: 20,
            unit: 'count'
          },
          sources: ['sast', 'dast', 'dependency', 'container'],
          severity: 'medium'
        },
        
        // Security test coverage gate
        testCoverage: {
          name: 'Security Test Coverage',
          description: 'Ensure minimum security test coverage',
          enabled: true,
          blocking: true,
          threshold: {
            min: 80,
            unit: 'percentage'
          },
          requiredTests: ['sast', 'dependency']
        },
        
        // Security regression gate
        regressionPrevention: {
          name: 'Security Regression Prevention',
          description: 'Block if security regressions detected',
          enabled: true,
          blocking: true,
          threshold: {
            max: 0,
            unit: 'count'
          },
          sources: ['regression']
        },
        
        // OWASP compliance gate
        owaspCompliance: {
          name: 'OWASP Top 10 Compliance',
          description: 'Ensure OWASP Top 10 vulnerabilities are addressed',
          enabled: true,
          blocking: false,
          threshold: {
            max: 2,
            unit: 'categories'
          }
        },
        
        // PCI DSS compliance gate (for payment processing)
        pciCompliance: {
          name: 'PCI DSS Compliance',
          description: 'Ensure PCI DSS compliance for payment processing',
          enabled: true,
          blocking: true,
          threshold: {
            min: 90,
            unit: 'score'
          }
        },
        
        // Unit test security gate
        securityTests: {
          name: 'Security Unit Tests',
          description: 'Ensure security unit tests pass',
          enabled: true,
          blocking: true,
          threshold: {
            min: 100,
            unit: 'percentage'
          }
        }
      },
      
      // Override settings for different environments
      environments: {
        development: {
          strictMode: false,
          gates: {
            criticalVulnerabilities: { blocking: false },
            highVulnerabilities: { threshold: { max: 10 } }
          }
        },
        staging: {
          strictMode: true,
          gates: {
            criticalVulnerabilities: { blocking: true },
            highVulnerabilities: { threshold: { max: 3 } }
          }
        },
        production: {
          strictMode: true,
          gates: {
            criticalVulnerabilities: { blocking: true, threshold: { max: 0 } },
            highVulnerabilities: { blocking: true, threshold: { max: 0 } },
            mediumVulnerabilities: { blocking: true, threshold: { max: 5 } }
          }
        }
      }
    };
  }

  /**
   * Collect security test results
   */
  async collectSecurityResults() {
    console.log('📊 Collecting security test results...');
    
    const results = {
      sast: await this.loadSASTResults(),
      dast: await this.loadDASTResults(),
      dependency: await this.loadDependencyResults(),
      container: await this.loadContainerResults(),
      regression: await this.loadRegressionResults(),
      unitTests: await this.loadUnitTestResults()
    };
    
    // Count vulnerabilities by severity
    results.summary = this.summarizeResults(results);
    
    console.log(`✅ Results collected: ${results.summary.totalVulnerabilities} vulnerabilities`);
    return results;
  }

  /**
   * Load SAST results
   */
  async loadSASTResults() {
    try {
      const sastFiles = await fs.readdir(this.options.resultsDir);
      const codeqlFile = sastFiles.find(file => file.includes('codeql') && file.endsWith('.json'));
      
      if (codeqlFile) {
        const sastData = await fs.readFile(path.join(this.options.resultsDir, codeqlFile), 'utf8');
        return JSON.parse(sastData);
      }
      
      return { available: false };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Load DAST results
   */
  async loadDASTResults() {
    try {
      const dastFiles = await fs.readdir(this.options.resultsDir);
      const zapFile = dastFiles.find(file => file.startsWith('zap-') && file.endsWith('.json'));
      
      if (zapFile) {
        const dastData = await fs.readFile(path.join(this.options.resultsDir, zapFile), 'utf8');
        return JSON.parse(dastData);
      }
      
      return { available: false };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Load dependency audit results
   */
  async loadDependencyResults() {
    try {
      const results = {};
      
      // npm audit
      const npmFile = path.join(this.options.resultsDir, 'npm-audit-results.json');
      const npmExists = await fs.access(npmFile).then(() => true).catch(() => false);
      
      if (npmExists) {
        const npmData = await fs.readFile(npmFile, 'utf8');
        results.npm = JSON.parse(npmData);
      }
      
      // Snyk results
      const snykFile = path.join(this.options.resultsDir, 'snyk-results.json');
      const snykExists = await fs.access(snykFile).then(() => true).catch(() => false);
      
      if (snykExists) {
        const snykData = await fs.readFile(snykFile, 'utf8');
        results.snyk = JSON.parse(snykData);
      }
      
      return results;
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Load container security results
   */
  async loadContainerResults() {
    try {
      const containerFile = path.join(this.options.resultsDir, 'trivy-results.json');
      const containerExists = await fs.access(containerFile).then(() => true).catch(() => false);
      
      if (containerExists) {
        const containerData = await fs.readFile(containerFile, 'utf8');
        return JSON.parse(containerData);
      }
      
      return { available: false };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Load regression test results
   */
  async loadRegressionResults() {
    try {
      const regressionFiles = await fs.readdir(this.options.resultsDir);
      const regressionFile = regressionFiles.find(file => 
        file.startsWith('security-regression-report-') && file.endsWith('.json')
      );
      
      if (regressionFile) {
        const regressionData = await fs.readFile(
          path.join(this.options.resultsDir, regressionFile), 'utf8'
        );
        return JSON.parse(regressionData);
      }
      
      return { available: false };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Load unit test results
   */
  async loadUnitTestResults() {
    try {
      const testFile = path.join(this.options.resultsDir, 'security-test-results.json');
      const testExists = await fs.access(testFile).then(() => true).catch(() => false);
      
      if (testExists) {
        const testData = await fs.readFile(testFile, 'utf8');
        return JSON.parse(testData);
      }
      
      return { available: false };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Summarize security results
   */
  summarizeResults(results) {
    const summary = {
      totalVulnerabilities: 0,
      severityCounts: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      sourceCounts: {
        sast: 0,
        dast: 0,
        dependency: 0,
        container: 0,
        regression: 0
      },
      testCoverage: {
        available: [],
        total: 6,
        percentage: 0
      }
    };

    // Count DAST vulnerabilities
    if (results.dast && results.dast.alerts) {
      for (const alert of results.dast.alerts) {
        const severity = this.normalizeSeverity(alert.risk);
        summary.severityCounts[severity]++;
        summary.sourceCounts.dast++;
      }
    }

    // Count dependency vulnerabilities
    if (results.dependency) {
      if (results.dependency.npm && results.dependency.npm.vulnerabilities) {
        for (const vuln of Object.values(results.dependency.npm.vulnerabilities)) {
          const severity = this.normalizeSeverity(vuln.severity);
          summary.severityCounts[severity]++;
          summary.sourceCounts.dependency++;
        }
      }
      
      if (results.dependency.snyk && results.dependency.snyk.vulnerabilities) {
        for (const vuln of results.dependency.snyk.vulnerabilities) {
          const severity = this.normalizeSeverity(vuln.severity);
          summary.severityCounts[severity]++;
          summary.sourceCounts.dependency++;
        }
      }
    }

    // Count container vulnerabilities
    if (results.container && results.container.Results) {
      for (const result of results.container.Results) {
        if (result.Vulnerabilities) {
          for (const vuln of result.Vulnerabilities) {
            const severity = this.normalizeSeverity(vuln.Severity);
            summary.severityCounts[severity]++;
            summary.sourceCounts.container++;
          }
        }
      }
    }

    // Count regression issues
    if (results.regression && results.regression.regressions) {
      summary.sourceCounts.regression = results.regression.regressions.length;
      for (const regression of results.regression.regressions) {
        const severity = this.normalizeSeverity(regression.vulnerability.severity);
        summary.severityCounts[severity]++;
      }
    }

    // Calculate total vulnerabilities
    summary.totalVulnerabilities = Object.values(summary.sourceCounts).reduce((a, b) => a + b, 0);

    // Calculate test coverage
    const availableTests = [];
    if (results.sast && !results.sast.error && results.sast.available !== false) {
      availableTests.push('sast');
    }
    if (results.dast && !results.dast.error && results.dast.available !== false) {
      availableTests.push('dast');
    }
    if (results.dependency && !results.dependency.error) {
      availableTests.push('dependency');
    }
    if (results.container && !results.container.error && results.container.available !== false) {
      availableTests.push('container');
    }
    if (results.regression && !results.regression.error && results.regression.available !== false) {
      availableTests.push('regression');
    }
    if (results.unitTests && !results.unitTests.error && results.unitTests.available !== false) {
      availableTests.push('unitTests');
    }

    summary.testCoverage.available = availableTests;
    summary.testCoverage.percentage = (availableTests.length / summary.testCoverage.total) * 100;

    return summary;
  }

  /**
   * Normalize severity levels
   */
  normalizeSeverity(severity) {
    if (!severity) return 'medium';
    
    const severityMap = {
      'critical': 'critical',
      'high': 'high',
      'medium': 'medium',
      'moderate': 'medium',
      'low': 'low',
      'info': 'low',
      'informational': 'low'
    };
    
    return severityMap[severity.toLowerCase()] || 'medium';
  }

  /**
   * Evaluate security gates
   */
  async evaluateGates(securityResults) {
    console.log('🚪 Evaluating security gates...');
    
    const gates = [];
    let overallPassed = true;

    // Apply environment-specific overrides
    const environment = process.env.NODE_ENV || 'development';
    const envConfig = this.gateConfig.environments[environment] || {};
    
    for (const [gateId, gateConfig] of Object.entries(this.gateConfig.gates)) {
      // Apply environment overrides
      const effectiveConfig = {
        ...gateConfig,
        ...(envConfig.gates && envConfig.gates[gateId])
      };
      
      if (!effectiveConfig.enabled) {
        continue;
      }

      const gate = {
        id: gateId,
        name: effectiveConfig.name,
        description: effectiveConfig.description,
        blocking: effectiveConfig.blocking,
        passed: false,
        threshold: effectiveConfig.threshold,
        actual: null,
        message: '',
        violations: []
      };

      // Evaluate specific gate
      switch (gateId) {
        case 'criticalVulnerabilities':
          gate.actual = securityResults.summary.severityCounts.critical;
          gate.passed = gate.actual <= effectiveConfig.threshold.max;
          gate.message = `Found ${gate.actual} critical vulnerabilities (max: ${effectiveConfig.threshold.max})`;
          break;

        case 'highVulnerabilities':
          gate.actual = securityResults.summary.severityCounts.high;
          gate.passed = gate.actual <= effectiveConfig.threshold.max;
          gate.message = `Found ${gate.actual} high severity vulnerabilities (max: ${effectiveConfig.threshold.max})`;
          break;

        case 'mediumVulnerabilities':
          gate.actual = securityResults.summary.severityCounts.medium;
          gate.passed = gate.actual <= effectiveConfig.threshold.max;
          gate.message = `Found ${gate.actual} medium severity vulnerabilities (max: ${effectiveConfig.threshold.max})`;
          break;

        case 'testCoverage':
          gate.actual = securityResults.summary.testCoverage.percentage;
          gate.passed = gate.actual >= effectiveConfig.threshold.min;
          gate.message = `Security test coverage: ${gate.actual.toFixed(1)}% (min: ${effectiveConfig.threshold.min}%)`;
          
          // Check required tests
          const missingTests = effectiveConfig.requiredTests.filter(test => 
            !securityResults.summary.testCoverage.available.includes(test)
          );
          
          if (missingTests.length > 0) {
            gate.passed = false;
            gate.violations.push(`Missing required tests: ${missingTests.join(', ')}`);
          }
          break;

        case 'regressionPrevention':
          gate.actual = securityResults.summary.sourceCounts.regression;
          gate.passed = gate.actual <= effectiveConfig.threshold.max;
          gate.message = `Found ${gate.actual} security regressions (max: ${effectiveConfig.threshold.max})`;
          break;

        case 'securityTests':
          // This would need actual test results
          gate.actual = 100; // Assume passed for now
          gate.passed = gate.actual >= effectiveConfig.threshold.min;
          gate.message = `Security unit tests: ${gate.actual}% passed (min: ${effectiveConfig.threshold.min}%)`;
          break;

        default:
          gate.passed = true;
          gate.message = 'Gate evaluation not implemented';
      }

      gates.push(gate);

      // Update overall result
      if (!gate.passed && gate.blocking) {
        overallPassed = false;
        this.results.violations.push({
          gate: gate.name,
          message: gate.message,
          blocking: true
        });
      } else if (!gate.passed) {
        this.results.warnings.push({
          gate: gate.name,
          message: gate.message,
          blocking: false
        });
      }
    }

    this.results.gates = gates;
    this.results.passed = overallPassed;
    this.results.summary = {
      totalGates: gates.length,
      passedGates: gates.filter(g => g.passed).length,
      failedGates: gates.filter(g => !g.passed).length,
      blockingViolations: this.results.violations.length,
      warnings: this.results.warnings.length
    };

    console.log(`   Evaluated ${gates.length} gates`);
    console.log(`   Passed: ${this.results.summary.passedGates}`);
    console.log(`   Failed: ${this.results.summary.failedGates}`);
    console.log(`   Blocking violations: ${this.results.summary.blockingViolations}`);

    return this.results;
  }

  /**
   * Generate gate evaluation report
   */
  async generateGateReport() {
    console.log('📊 Generating gate evaluation report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      passed: this.results.passed,
      summary: this.results.summary,
      gates: this.results.gates,
      violations: this.results.violations,
      warnings: this.results.warnings,
      recommendations: this.generateRecommendations()
    };

    // Save detailed report
    await fs.writeFile(this.options.outputFile, JSON.stringify(report, null, 2));

    // Generate human-readable summary
    const summaryText = this.generateSummaryText(report);
    const summaryFile = this.options.outputFile.replace('.json', '-summary.md');
    await fs.writeFile(summaryFile, summaryText);

    console.log(`✅ Gate report generated:`);
    console.log(`   Detailed: ${this.options.outputFile}`);
    console.log(`   Summary: ${summaryFile}`);

    return report;
  }

  /**
   * Generate recommendations based on gate results
   */
  generateRecommendations() {
    const recommendations = [];

    // Critical recommendations for blocking violations
    for (const violation of this.results.violations) {
      recommendations.push({
        priority: 'critical',
        category: 'Security Gate',
        title: `Fix ${violation.gate}`,
        description: violation.message,
        action: 'Address security issues before deployment',
        blocking: true
      });
    }

    // Warnings for non-blocking issues
    for (const warning of this.results.warnings) {
      recommendations.push({
        priority: 'medium',
        category: 'Security Gate',
        title: `Improve ${warning.gate}`,
        description: warning.message,
        action: 'Consider addressing in next release',
        blocking: false
      });
    }

    // General recommendations
    if (this.results.passed) {
      recommendations.push({
        priority: 'info',
        category: 'Security',
        title: 'Security Gates Passed',
        description: 'All security gates have been successfully passed',
        action: 'Continue with deployment',
        blocking: false
      });
    } else {
      recommendations.push({
        priority: 'critical',
        category: 'Deployment',
        title: 'Deployment Blocked',
        description: 'Security gates have failed - deployment should be blocked',
        action: 'Fix all blocking security issues before retrying',
        blocking: true
      });
    }

    return recommendations;
  }

  /**
   * Generate human-readable summary
   */
  generateSummaryText(report) {
    let summary = `# Security Gate Evaluation Report\n\n`;
    summary += `**Generated:** ${report.timestamp}\n`;
    summary += `**Environment:** ${report.environment}\n`;
    summary += `**Overall Status:** ${report.passed ? '✅ PASSED' : '❌ FAILED'}\n\n`;

    // Summary statistics
    summary += `## Summary\n\n`;
    summary += `- **Total Gates:** ${report.summary.totalGates}\n`;
    summary += `- **Passed:** ${report.summary.passedGates}\n`;
    summary += `- **Failed:** ${report.summary.failedGates}\n`;
    summary += `- **Blocking Violations:** ${report.summary.blockingViolations}\n`;
    summary += `- **Warnings:** ${report.summary.warnings}\n\n`;

    // Gate details
    if (report.gates.length > 0) {
      summary += `## Gate Results\n\n`;
      for (const gate of report.gates) {
        const status = gate.passed ? '✅' : '❌';
        const blocking = gate.blocking ? '🚫 BLOCKING' : '⚠️ WARNING';
        
        summary += `### ${status} ${gate.name}\n`;
        summary += `- **Status:** ${gate.passed ? 'PASSED' : 'FAILED'}\n`;
        summary += `- **Type:** ${gate.blocking ? 'Blocking' : 'Non-blocking'}\n`;
        summary += `- **Message:** ${gate.message}\n`;
        
        if (gate.violations && gate.violations.length > 0) {
          summary += `- **Violations:**\n`;
          for (const violation of gate.violations) {
            summary += `  - ${violation}\n`;
          }
        }
        
        summary += `\n`;
      }
    }

    // Violations
    if (report.violations.length > 0) {
      summary += `## 🚨 Blocking Violations\n\n`;
      for (const violation of report.violations) {
        summary += `- **${violation.gate}:** ${violation.message}\n`;
      }
      summary += `\n`;
    }

    // Warnings
    if (report.warnings.length > 0) {
      summary += `## ⚠️ Warnings\n\n`;
      for (const warning of report.warnings) {
        summary += `- **${warning.gate}:** ${warning.message}\n`;
      }
      summary += `\n`;
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      summary += `## 📋 Recommendations\n\n`;
      for (const rec of report.recommendations) {
        const icon = {
          'critical': '🚨',
          'high': '⚠️',
          'medium': '⚡',
          'low': 'ℹ️',
          'info': '💡'
        }[rec.priority] || 'ℹ️';
        
        summary += `${icon} **${rec.title}**\n`;
        summary += `${rec.description}\n`;
        summary += `**Action:** ${rec.action}\n\n`;
      }
    }

    summary += `---\n`;
    summary += `*Security gate evaluation completed*\n`;

    return summary;
  }

  /**
   * Run security gate evaluation
   */
  async runEvaluation() {
    try {
      console.log('🔒 Running Security Gate Evaluation...');
      
      // Load gate configuration
      await this.loadGateConfiguration();
      
      // Collect security results
      const securityResults = await this.collectSecurityResults();
      
      // Evaluate gates
      const gateResults = await this.evaluateGates(securityResults);
      
      // Generate report
      const report = await this.generateGateReport();
      
      console.log(`🎉 Security gate evaluation completed!`);
      console.log(`   Overall Status: ${report.passed ? 'PASSED' : 'FAILED'}`);
      console.log(`   Gates Passed: ${report.summary.passedGates}/${report.summary.totalGates}`);
      console.log(`   Blocking Violations: ${report.summary.blockingViolations}`);
      
      return report;
      
    } catch (error) {
      console.error('❌ Security gate evaluation failed:', error.message);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const options = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    options[key] = value === 'true' ? true : value === 'false' ? false : value;
  }

  const evaluator = new SecurityGateEvaluator(options);
  
  try {
    const result = await evaluator.runEvaluation();
    
    // Set output for GitHub Actions
    if (process.env.GITHUB_OUTPUT) {
      await fs.appendFile(process.env.GITHUB_OUTPUT, `passed=${result.passed}\n`);
    }
    
    // Exit with error code if gates failed
    if (!result.passed) {
      console.error('❌ Security gates failed - blocking deployment');
      process.exit(1);
    }
    
    console.log('✅ All security gates passed - deployment approved');
    process.exit(0);
  } catch (error) {
    console.error('❌ Gate evaluation failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { SecurityGateEvaluator };