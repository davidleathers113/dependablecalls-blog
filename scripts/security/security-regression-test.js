#!/usr/bin/env node

/**
 * Security Regression Testing Framework for DCE Platform
 * 
 * This script automatically detects and prevents security regressions
 * by comparing current security test results against established baselines.
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

class SecurityRegressionTester {
  constructor(options = {}) {
    this.options = {
      baselineDir: options.baselineDir || './security-baseline',
      currentResultsDir: options.currentResultsDir || './security-results',
      outputDir: options.outputDir || './tests/security',
      toleranceLevel: options.toleranceLevel || 'strict', // strict, moderate, lenient
      ...options
    };
    
    this.regressions = [];
    this.improvements = [];
    this.newVulnerabilities = [];
    this.fixedVulnerabilities = [];
  }

  /**
   * Load security baseline data
   */
  async loadBaseline() {
    console.log('📊 Loading security baseline...');
    
    try {
      const baselinePath = path.join(this.options.baselineDir, 'security-baseline.json');
      const baselineExists = await fs.access(baselinePath).then(() => true).catch(() => false);
      
      if (!baselineExists) {
        console.log('ℹ️ No security baseline found. This will be the first baseline.');
        return null;
      }
      
      const baselineData = await fs.readFile(baselinePath, 'utf8');
      const baseline = JSON.parse(baselineData);
      
      console.log(`✅ Baseline loaded: ${baseline.vulnerabilities.length} vulnerabilities`);
      return baseline;
      
    } catch (error) {
      console.error('❌ Failed to load baseline:', error.message);
      throw error;
    }
  }

  /**
   * Run current security tests and collect results
   */
  async runCurrentSecurityTests() {
    console.log('🔍 Running current security tests...');
    
    try {
      const results = {
        timestamp: new Date().toISOString(),
        vulnerabilities: [],
        testResults: {},
        codeAnalysis: {},
        dependencyAudit: {}
      };

      // Run unit security tests
      console.log('   Running unit security tests...');
      try {
        const unitTestOutput = execSync('npm run test -- tests/security/ --reporter=json', 
          { encoding: 'utf8', stdio: 'pipe' });
        results.testResults.unit = JSON.parse(unitTestOutput);
      } catch (error) {
        console.error('   Unit tests failed:', error.message);
        results.testResults.unit = { failed: true, error: error.message };
      }

      // Run dependency audit
      console.log('   Running dependency audit...');
      try {
        const auditOutput = execSync('npm audit --json', 
          { encoding: 'utf8', stdio: 'pipe' });
        results.dependencyAudit = JSON.parse(auditOutput);
      } catch (error) {
        // npm audit returns non-zero exit code when vulnerabilities found
        const auditData = error.stdout ? JSON.parse(error.stdout) : {};
        results.dependencyAudit = auditData;
      }

      // Run static analysis
      console.log('   Running static code analysis...');
      try {
        const eslintOutput = execSync('npx eslint src/ --format=json --ext .ts,.tsx', 
          { encoding: 'utf8', stdio: 'pipe' });
        results.codeAnalysis.eslint = JSON.parse(eslintOutput);
      } catch (error) {
        const eslintData = error.stdout ? JSON.parse(error.stdout) : [];
        results.codeAnalysis.eslint = eslintData;
      }

      // Extract vulnerability data
      results.vulnerabilities = await this.extractVulnerabilities(results);
      
      console.log(`✅ Current tests completed: ${results.vulnerabilities.length} vulnerabilities found`);
      return results;
      
    } catch (error) {
      console.error('❌ Failed to run current security tests:', error.message);
      throw error;
    }
  }

  /**
   * Extract and normalize vulnerability data from test results
   */
  async extractVulnerabilities(results) {
    const vulnerabilities = [];
    
    // Extract from dependency audit
    if (results.dependencyAudit.vulnerabilities) {
      for (const [name, vuln] of Object.entries(results.dependencyAudit.vulnerabilities)) {
        vulnerabilities.push({
          id: this.generateVulnId('dependency', name, vuln.title),
          type: 'dependency',
          severity: vuln.severity,
          title: vuln.title,
          description: vuln.overview,
          source: name,
          cwe: vuln.cwe,
          cvss: vuln.cvss,
          references: vuln.references || []
        });
      }
    }

    // Extract from ESLint security rules
    if (results.codeAnalysis.eslint) {
      for (const file of results.codeAnalysis.eslint) {
        for (const message of file.messages) {
          if (message.ruleId && message.ruleId.includes('security')) {
            vulnerabilities.push({
              id: this.generateVulnId('static-analysis', file.filePath, message.ruleId),
              type: 'static-analysis',
              severity: this.mapSeverity(message.severity),
              title: message.message,
              description: `Security rule violation: ${message.ruleId}`,
              source: file.filePath,
              line: message.line,
              column: message.column,
              ruleId: message.ruleId
            });
          }
        }
      }
    }

    // Load OWASP ZAP results if available
    try {
      const zapResultsPath = path.join(this.options.currentResultsDir, 'zap-results.json');
      const zapData = await fs.readFile(zapResultsPath, 'utf8');
      const zapResults = JSON.parse(zapData);
      
      if (zapResults.alerts) {
        for (const alert of zapResults.alerts) {
          vulnerabilities.push({
            id: this.generateVulnId('dast', alert.name, alert.url),
            type: 'dast',
            severity: alert.risk.toLowerCase(),
            title: alert.name,
            description: alert.description,
            source: alert.url,
            solution: alert.solution,
            reference: alert.reference,
            cweId: alert.cweid,
            wascId: alert.wascid,
            instances: alert.instances?.length || 1
          });
        }
      }
    } catch (error) {
      console.log('   No OWASP ZAP results found');
    }

    return vulnerabilities;
  }

  /**
   * Generate unique vulnerability ID
   */
  generateVulnId(type, source, identifier) {
    const data = `${type}-${source}-${identifier}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Map severity levels to standard format
   */
  mapSeverity(severity) {
    const severityMap = {
      1: 'low',
      2: 'medium',
      3: 'high',
      4: 'critical',
      'warning': 'medium',
      'error': 'high',
      'off': 'info'
    };
    
    return severityMap[severity] || 'medium';
  }

  /**
   * Compare current results against baseline
   */
  async compareWithBaseline(baseline, current) {
    console.log('🔍 Comparing against baseline...');
    
    if (!baseline) {
      console.log('ℹ️ No baseline available for comparison');
      return {
        isFirstRun: true,
        regressions: [],
        improvements: [],
        newVulnerabilities: current.vulnerabilities,
        fixedVulnerabilities: []
      };
    }

    const baselineVulns = new Map(baseline.vulnerabilities.map(v => [v.id, v]));
    const currentVulns = new Map(current.vulnerabilities.map(v => [v.id, v]));

    // Find regressions (new vulnerabilities)
    for (const [id, vuln] of currentVulns) {
      if (!baselineVulns.has(id)) {
        this.newVulnerabilities.push(vuln);
        
        // Check if this represents a regression
        if (this.isRegression(vuln, baseline)) {
          this.regressions.push({
            vulnerability: vuln,
            reason: 'New vulnerability introduced',
            impact: this.assessImpact(vuln)
          });
        }
      }
    }

    // Find improvements (fixed vulnerabilities)
    for (const [id, vuln] of baselineVulns) {
      if (!currentVulns.has(id)) {
        this.fixedVulnerabilities.push(vuln);
        this.improvements.push({
          vulnerability: vuln,
          reason: 'Vulnerability fixed',
          impact: 'positive'
        });
      }
    }

    // Find severity changes
    for (const [id, currentVuln] of currentVulns) {
      const baselineVuln = baselineVulns.get(id);
      if (baselineVuln && baselineVuln.severity !== currentVuln.severity) {
        const severityOrder = ['info', 'low', 'medium', 'high', 'critical'];
        const baselineIndex = severityOrder.indexOf(baselineVuln.severity);
        const currentIndex = severityOrder.indexOf(currentVuln.severity);
        
        if (currentIndex > baselineIndex) {
          this.regressions.push({
            vulnerability: currentVuln,
            reason: `Severity increased from ${baselineVuln.severity} to ${currentVuln.severity}`,
            impact: 'severity-increase'
          });
        } else if (currentIndex < baselineIndex) {
          this.improvements.push({
            vulnerability: currentVuln,
            reason: `Severity decreased from ${baselineVuln.severity} to ${currentVuln.severity}`,
            impact: 'severity-decrease'
          });
        }
      }
    }

    console.log(`   New vulnerabilities: ${this.newVulnerabilities.length}`);
    console.log(`   Fixed vulnerabilities: ${this.fixedVulnerabilities.length}`);
    console.log(`   Regressions: ${this.regressions.length}`);
    console.log(`   Improvements: ${this.improvements.length}`);

    return {
      isFirstRun: false,
      regressions: this.regressions,
      improvements: this.improvements,
      newVulnerabilities: this.newVulnerabilities,
      fixedVulnerabilities: this.fixedVulnerabilities
    };
  }

  /**
   * Determine if a vulnerability represents a regression
   */
  isRegression(vulnerability, baseline) {
    // High and critical severities are always regressions
    if (['high', 'critical'].includes(vulnerability.severity)) {
      return true;
    }

    // Check against tolerance level
    switch (this.options.toleranceLevel) {
      case 'strict':
        return ['medium', 'high', 'critical'].includes(vulnerability.severity);
      case 'moderate':
        return ['high', 'critical'].includes(vulnerability.severity);
      case 'lenient':
        return vulnerability.severity === 'critical';
      default:
        return false;
    }
  }

  /**
   * Assess the impact of a vulnerability
   */
  assessImpact(vulnerability) {
    const impactMap = {
      'critical': 'blocker',
      'high': 'major',
      'medium': 'minor',
      'low': 'trivial',
      'info': 'trivial'
    };
    
    return impactMap[vulnerability.severity] || 'minor';
  }

  /**
   * Generate regression test report
   */
  async generateRegressionReport(comparison, current) {
    console.log('📊 Generating regression test report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        isFirstRun: comparison.isFirstRun,
        totalVulnerabilities: current.vulnerabilities.length,
        regressionCount: comparison.regressions.length,
        improvementCount: comparison.improvements.length,
        newVulnerabilityCount: comparison.newVulnerabilities.length,
        fixedVulnerabilityCount: comparison.fixedVulnerabilities.length,
        passed: comparison.regressions.length === 0
      },
      regressions: comparison.regressions,
      improvements: comparison.improvements,
      newVulnerabilities: comparison.newVulnerabilities,
      fixedVulnerabilities: comparison.fixedVulnerabilities,
      toleranceLevel: this.options.toleranceLevel,
      recommendations: this.generateRecommendations(comparison)
    };

    // Save detailed report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(this.options.outputDir, `security-regression-report-${timestamp}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Generate human-readable summary
    const summaryPath = path.join(this.options.outputDir, `security-regression-summary-${timestamp}.md`);
    const summary = this.generateMarkdownSummary(report);
    await fs.writeFile(summaryPath, summary);

    console.log(`✅ Regression report generated:`);
    console.log(`   Detailed Report: ${reportPath}`);
    console.log(`   Summary: ${summaryPath}`);

    return {
      detailedReport: reportPath,
      summary: summaryPath,
      passed: report.summary.passed,
      report
    };
  }

  /**
   * Generate recommendations based on regression analysis
   */
  generateRecommendations(comparison) {
    const recommendations = [];

    if (comparison.regressions.length > 0) {
      recommendations.push({
        type: 'critical',
        message: `${comparison.regressions.length} security regression(s) detected`,
        action: 'Review and fix regressions before deployment'
      });

      const criticalRegressions = comparison.regressions.filter(r => 
        r.vulnerability.severity === 'critical'
      );
      
      if (criticalRegressions.length > 0) {
        recommendations.push({
          type: 'blocker',
          message: `${criticalRegressions.length} critical security regression(s)`,
          action: 'BLOCK DEPLOYMENT - Fix critical issues immediately'
        });
      }
    }

    if (comparison.improvements.length > 0) {
      recommendations.push({
        type: 'positive',
        message: `${comparison.improvements.length} security improvement(s) detected`,
        action: 'Great work! Continue following secure coding practices'
      });
    }

    if (comparison.newVulnerabilities.length > 0) {
      recommendations.push({
        type: 'warning',
        message: `${comparison.newVulnerabilities.length} new vulnerability(-ies) found`,
        action: 'Review new vulnerabilities and assess risk'
      });
    }

    if (comparison.regressions.length === 0 && comparison.newVulnerabilities.length === 0) {
      recommendations.push({
        type: 'success',
        message: 'No security regressions detected',
        action: 'Security posture maintained - good to proceed'
      });
    }

    return recommendations;
  }

  /**
   * Generate markdown summary report
   */
  generateMarkdownSummary(report) {
    let summary = `# Security Regression Test Report\n\n`;
    summary += `**Generated:** ${report.timestamp}\n`;
    summary += `**Tolerance Level:** ${report.toleranceLevel}\n\n`;

    // Overall status
    const status = report.summary.passed ? '✅ PASSED' : '❌ FAILED';
    summary += `## Overall Status: ${status}\n\n`;

    // Summary statistics
    summary += `## Summary\n\n`;
    summary += `- **Total Vulnerabilities:** ${report.summary.totalVulnerabilities}\n`;
    summary += `- **Regressions:** ${report.summary.regressionCount}\n`;
    summary += `- **Improvements:** ${report.summary.improvementCount}\n`;
    summary += `- **New Vulnerabilities:** ${report.summary.newVulnerabilityCount}\n`;
    summary += `- **Fixed Vulnerabilities:** ${report.summary.fixedVulnerabilityCount}\n\n`;

    // Regressions
    if (report.regressions.length > 0) {
      summary += `## 🚨 Security Regressions (${report.regressions.length})\n\n`;
      for (const regression of report.regressions) {
        summary += `### ${regression.vulnerability.title}\n`;
        summary += `- **Severity:** ${regression.vulnerability.severity.toUpperCase()}\n`;
        summary += `- **Type:** ${regression.vulnerability.type}\n`;
        summary += `- **Reason:** ${regression.reason}\n`;
        summary += `- **Impact:** ${regression.impact}\n`;
        if (regression.vulnerability.source) {
          summary += `- **Source:** ${regression.vulnerability.source}\n`;
        }
        summary += `\n`;
      }
    }

    // Improvements
    if (report.improvements.length > 0) {
      summary += `## ✅ Security Improvements (${report.improvements.length})\n\n`;
      for (const improvement of report.improvements) {
        summary += `### ${improvement.vulnerability.title}\n`;
        summary += `- **Severity:** ${improvement.vulnerability.severity.toUpperCase()}\n`;
        summary += `- **Reason:** ${improvement.reason}\n\n`;
      }
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      summary += `## 📋 Recommendations\n\n`;
      for (const rec of report.recommendations) {
        const icon = {
          'critical': '🚨',
          'blocker': '🛑',
          'warning': '⚠️',
          'positive': '✅',
          'success': '🎉'
        }[rec.type] || 'ℹ️';
        
        summary += `${icon} **${rec.message}**\n`;
        summary += `   ${rec.action}\n\n`;
      }
    }

    return summary;
  }

  /**
   * Run complete regression test
   */
  async runRegressionTest() {
    try {
      console.log('🔒 Starting Security Regression Test...');
      
      // Load baseline
      const baseline = await this.loadBaseline();
      
      // Run current tests
      const current = await this.runCurrentSecurityTests();
      
      // Compare with baseline
      const comparison = await this.compareWithBaseline(baseline, current);
      
      // Generate report
      const report = await this.generateRegressionReport(comparison, current);
      
      console.log(`🎉 Security regression test completed!`);
      console.log(`   Status: ${report.passed ? 'PASSED' : 'FAILED'}`);
      
      return report;
      
    } catch (error) {
      console.error('❌ Security regression test failed:', error.message);
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
    options[key] = value;
  }

  const tester = new SecurityRegressionTester(options);
  
  try {
    const result = await tester.runRegressionTest();
    
    // Exit with error code if regressions found
    if (!result.passed) {
      console.error('❌ Security regressions detected');
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Regression test failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { SecurityRegressionTester };