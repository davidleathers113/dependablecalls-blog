#!/usr/bin/env node

/**
 * Security Monitoring Update Script for DCE Platform
 * 
 * This script updates security monitoring systems with latest
 * security test results and vulnerability status.
 */

const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const axios = require('axios');

class SecurityMonitoringUpdater {
  constructor(options = {}) {
    this.options = {
      resultsDir: options.resultsDir || './security-results',
      webhookUrl: options.webhookUrl || process.env.SECURITY_MONITORING_WEBHOOK,
      alertThresholds: {
        critical: 0,
        high: 5,
        medium: 20,
        regression: 0
      },
      ...options
    };
    
    this.monitoringData = {
      timestamp: new Date().toISOString(),
      vulnerabilities: [],
      metrics: {},
      alerts: [],
      trends: {}
    };
  }

  /**
   * Collect latest security data
   */
  async collectSecurityData() {
    console.log('📊 Collecting security monitoring data...');
    
    try {
      // Load comprehensive security report
      const reportFiles = await fs.readdir(this.options.resultsDir);
      const latestReport = reportFiles
        .filter(file => file.startsWith('security-report-') && file.endsWith('.json'))
        .sort()
        .pop();
      
      if (latestReport) {
        const reportPath = path.join(this.options.resultsDir, latestReport);
        const reportData = await fs.readFile(reportPath, 'utf8');
        const report = JSON.parse(reportData);
        
        this.monitoringData.vulnerabilities = report.vulnerabilities || [];
        this.monitoringData.metrics = report.metrics || {};
      }
      
      // Load gate evaluation results
      const gateFile = path.join(this.options.resultsDir, 'security-gate-result.json');
      const gateExists = await fs.access(gateFile).then(() => true).catch(() => false);
      
      if (gateExists) {
        const gateData = await fs.readFile(gateFile, 'utf8');
        const gateResults = JSON.parse(gateData);
        this.monitoringData.gateResults = gateResults;
      }
      
      // Load regression test results
      const regressionFiles = await fs.readdir(this.options.resultsDir);
      const latestRegression = regressionFiles
        .filter(file => file.startsWith('security-regression-report-') && file.endsWith('.json'))
        .sort()
        .pop();
      
      if (latestRegression) {
        const regressionPath = path.join(this.options.resultsDir, latestRegression);
        const regressionData = await fs.readFile(regressionPath, 'utf8');
        const regression = JSON.parse(regressionData);
        this.monitoringData.regression = regression;
      }
      
      // Generate alerts based on thresholds
      this.generateSecurityAlerts();
      
      console.log(`✅ Security data collected: ${this.monitoringData.vulnerabilities.length} vulnerabilities`);
      return this.monitoringData;
      
    } catch (error) {
      console.error('❌ Failed to collect security data:', error.message);
      throw error;
    }
  }

  /**
   * Generate security alerts based on thresholds
   */
  generateSecurityAlerts() {
    const alerts = [];
    
    // Count vulnerabilities by severity
    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };
    
    for (const vuln of this.monitoringData.vulnerabilities) {
      severityCounts[vuln.severity] = (severityCounts[vuln.severity] || 0) + 1;
    }
    
    // Check thresholds
    for (const [severity, count] of Object.entries(severityCounts)) {
      const threshold = this.options.alertThresholds[severity];
      if (threshold !== undefined && count > threshold) {
        alerts.push({
          id: `threshold-${severity}-${Date.now()}`,
          type: 'threshold_exceeded',
          severity: severity === 'critical' ? 'critical' : 'high',
          title: `${severity.toUpperCase()} Vulnerability Threshold Exceeded`,
          message: `Found ${count} ${severity} vulnerabilities (threshold: ${threshold})`,
          count: count,
          threshold: threshold,
          timestamp: new Date().toISOString(),
          action: 'immediate' // critical issues need immediate action
        });
      }
    }
    
    // Check for new regressions
    if (this.monitoringData.regression && this.monitoringData.regression.regressions) {
      const regressionCount = this.monitoringData.regression.regressions.length;
      if (regressionCount > this.options.alertThresholds.regression) {
        alerts.push({
          id: `regression-${Date.now()}`,
          type: 'security_regression',
          severity: 'critical',
          title: 'Security Regression Detected',
          message: `${regressionCount} security regression(s) detected`,
          count: regressionCount,
          timestamp: new Date().toISOString(),
          action: 'immediate'
        });
      }
    }
    
    // Check gate failures
    if (this.monitoringData.gateResults && !this.monitoringData.gateResults.passed) {
      alerts.push({
        id: `gate-failure-${Date.now()}`,
        type: 'security_gate_failure',
        severity: 'critical',
        title: 'Security Gate Failure',
        message: `${this.monitoringData.gateResults.summary.blockingViolations} blocking security gate violations`,
        violations: this.monitoringData.gateResults.violations,
        timestamp: new Date().toISOString(),
        action: 'immediate'
      });
    }
    
    // Check test coverage
    if (this.monitoringData.metrics.coverage && this.monitoringData.metrics.coverage.coverageScore < 80) {
      alerts.push({
        id: `coverage-low-${Date.now()}`,
        type: 'low_test_coverage',
        severity: 'medium',
        title: 'Low Security Test Coverage',
        message: `Security test coverage is ${this.monitoringData.metrics.coverage.coverageScore.toFixed(1)}% (minimum: 80%)`,
        coverage: this.monitoringData.metrics.coverage.coverageScore,
        timestamp: new Date().toISOString(),
        action: 'plan'
      });
    }
    
    this.monitoringData.alerts = alerts;
    
    console.log(`   Generated ${alerts.length} security alerts`);
  }

  /**
   * Prepare monitoring payload
   */
  prepareMonitoringPayload() {
    const payload = {
      source: 'dce-security-testing',
      timestamp: this.monitoringData.timestamp,
      environment: process.env.NODE_ENV || 'development',
      version: this.getProjectVersion(),
      gitCommit: this.getGitCommit(),
      
      // Summary metrics
      summary: {
        totalVulnerabilities: this.monitoringData.vulnerabilities.length,
        criticalVulnerabilities: this.monitoringData.vulnerabilities.filter(v => v.severity === 'critical').length,
        highVulnerabilities: this.monitoringData.vulnerabilities.filter(v => v.severity === 'high').length,
        mediumVulnerabilities: this.monitoringData.vulnerabilities.filter(v => v.severity === 'medium').length,
        lowVulnerabilities: this.monitoringData.vulnerabilities.filter(v => v.severity === 'low').length,
        
        testCoverage: this.monitoringData.metrics.coverage?.coverageScore || 0,
        gatesPassed: this.monitoringData.gateResults?.passed || false,
        regressionCount: this.monitoringData.regression?.regressions?.length || 0,
        
        alertCount: this.monitoringData.alerts.length,
        criticalAlerts: this.monitoringData.alerts.filter(a => a.severity === 'critical').length
      },
      
      // Active alerts
      alerts: this.monitoringData.alerts,
      
      // Vulnerability breakdown
      vulnerabilityBreakdown: {
        bySeverity: this.getVulnerabilityBreakdown('severity'),
        byType: this.getVulnerabilityBreakdown('type'),
        bySource: this.getVulnerabilityBreakdown('source')
      },
      
      // Security posture score
      securityScore: this.calculateSecurityScore(),
      
      // Trends (if historical data available)
      trends: this.calculateTrends(),
      
      // Compliance status
      compliance: {
        securityGates: this.monitoringData.gateResults?.passed || false,
        owaspTop10: this.monitoringData.metrics.compliance?.owaspTop10?.coveragePercentage || 0,
        pciDss: this.monitoringData.metrics.compliance?.pciDss?.overallScore || 0
      }
    };
    
    return payload;
  }

  /**
   * Get project version
   */
  getProjectVersion() {
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      const packageData = require(packagePath);
      return packageData.version || '0.0.0';
    } catch (error) {
      return '0.0.0';
    }
  }

  /**
   * Get git commit hash
   */
  getGitCommit() {
    try {
      const { execSync } = require('child_process');
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Get vulnerability breakdown
   */
  getVulnerabilityBreakdown(field) {
    const breakdown = {};
    
    for (const vuln of this.monitoringData.vulnerabilities) {
      const key = vuln[field] || 'unknown';
      breakdown[key] = (breakdown[key] || 0) + 1;
    }
    
    return breakdown;
  }

  /**
   * Calculate overall security score
   */
  calculateSecurityScore() {
    let score = 100; // Start with perfect score
    
    // Deduct points for vulnerabilities
    const criticalCount = this.monitoringData.vulnerabilities.filter(v => v.severity === 'critical').length;
    const highCount = this.monitoringData.vulnerabilities.filter(v => v.severity === 'high').length;
    const mediumCount = this.monitoringData.vulnerabilities.filter(v => v.severity === 'medium').length;
    
    score -= criticalCount * 20; // 20 points per critical
    score -= highCount * 10;     // 10 points per high
    score -= mediumCount * 5;    // 5 points per medium
    
    // Deduct points for regressions
    const regressionCount = this.monitoringData.regression?.regressions?.length || 0;
    score -= regressionCount * 15; // 15 points per regression
    
    // Deduct points for gate failures
    if (this.monitoringData.gateResults && !this.monitoringData.gateResults.passed) {
      score -= 25; // 25 points for gate failure
    }
    
    // Adjust for test coverage
    const coverage = this.monitoringData.metrics.coverage?.coverageScore || 0;
    if (coverage < 80) {
      score -= (80 - coverage) * 0.5; // 0.5 points per percentage below 80%
    }
    
    return Math.max(0, score); // Don't go below 0
  }

  /**
   * Calculate security trends
   */
  calculateTrends() {
    // This would require historical data - for now return placeholder
    return {
      vulnerabilityTrend: 'stable', // increasing, decreasing, stable
      securityScoreTrend: 'stable',
      alertFrequency: 'low', // low, medium, high
      
      // These would be calculated from historical data
      weeklyChange: {
        vulnerabilities: 0,
        securityScore: 0,
        alerts: 0
      }
    };
  }

  /**
   * Send update to monitoring webhook
   */
  async sendWebhookUpdate(payload) {
    if (!this.options.webhookUrl) {
      console.log('ℹ️ No webhook URL configured - skipping webhook update');
      return null;
    }
    
    console.log('📡 Sending update to monitoring webhook...');
    
    try {
      const response = await axios.post(this.options.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DCE-Security-Monitor/1.0'
        },
        timeout: 30000
      });
      
      console.log(`✅ Webhook update sent successfully (status: ${response.status})`);
      return response.data;
      
    } catch (error) {
      console.error('❌ Failed to send webhook update:', error.message);
      
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      
      throw error;
    }
  }

  /**
   * Save monitoring data locally
   */
  async saveMonitoringData(payload) {
    console.log('💾 Saving monitoring data locally...');
    
    try {
      // Ensure monitoring directory exists
      const monitoringDir = path.join(process.cwd(), 'security-monitoring');
      await fs.mkdir(monitoringDir, { recursive: true });
      
      // Save current monitoring data
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const monitoringFile = path.join(monitoringDir, `security-monitoring-${timestamp}.json`);
      await fs.writeFile(monitoringFile, JSON.stringify(payload, null, 2));
      
      // Save latest snapshot
      const latestFile = path.join(monitoringDir, 'latest-security-status.json');
      await fs.writeFile(latestFile, JSON.stringify(payload, null, 2));
      
      // Generate monitoring summary
      const summaryFile = path.join(monitoringDir, 'monitoring-summary.md');
      const summary = this.generateMonitoringSummary(payload);
      await fs.writeFile(summaryFile, summary);
      
      console.log(`✅ Monitoring data saved:`);
      console.log(`   Full Data: ${monitoringFile}`);
      console.log(`   Latest: ${latestFile}`);
      console.log(`   Summary: ${summaryFile}`);
      
      return {
        monitoringFile,
        latestFile,
        summaryFile
      };
      
    } catch (error) {
      console.error('❌ Failed to save monitoring data:', error.message);
      throw error;
    }
  }

  /**
   * Generate monitoring summary
   */
  generateMonitoringSummary(payload) {
    let summary = `# Security Monitoring Status\n\n`;
    summary += `**Last Updated:** ${payload.timestamp}\n`;
    summary += `**Environment:** ${payload.environment}\n`;
    summary += `**Version:** ${payload.version}\n`;
    summary += `**Security Score:** ${payload.securityScore.toFixed(1)}/100\n\n`;

    // Overall status
    const status = payload.summary.criticalAlerts > 0 ? '🚨 CRITICAL' : 
                  payload.summary.alertCount > 0 ? '⚠️ WARNING' : '✅ HEALTHY';
    summary += `## Overall Status: ${status}\n\n`;

    // Key metrics
    summary += `## Key Metrics\n\n`;
    summary += `- **Total Vulnerabilities:** ${payload.summary.totalVulnerabilities}\n`;
    summary += `- **Critical:** ${payload.summary.criticalVulnerabilities}\n`;
    summary += `- **High:** ${payload.summary.highVulnerabilities}\n`;
    summary += `- **Medium:** ${payload.summary.mediumVulnerabilities}\n`;
    summary += `- **Low:** ${payload.summary.lowVulnerabilities}\n`;
    summary += `- **Test Coverage:** ${payload.summary.testCoverage.toFixed(1)}%\n`;
    summary += `- **Security Gates:** ${payload.summary.gatesPassed ? '✅ PASSED' : '❌ FAILED'}\n`;
    summary += `- **Regressions:** ${payload.summary.regressionCount}\n\n`;

    // Active alerts
    if (payload.alerts.length > 0) {
      summary += `## 🚨 Active Alerts (${payload.alerts.length})\n\n`;
      for (const alert of payload.alerts) {
        const icon = alert.severity === 'critical' ? '🚨' : '⚠️';
        summary += `${icon} **${alert.title}**\n`;
        summary += `   ${alert.message}\n`;
        summary += `   *Action Required: ${alert.action}*\n\n`;
      }
    }

    // Compliance status
    summary += `## Compliance Status\n\n`;
    summary += `- **Security Gates:** ${payload.compliance.securityGates ? '✅ PASSED' : '❌ FAILED'}\n`;
    summary += `- **OWASP Top 10:** ${payload.compliance.owaspTop10.toFixed(1)}% coverage\n`;
    summary += `- **PCI DSS:** ${payload.compliance.pciDss}/100\n\n`;

    // Vulnerability breakdown
    summary += `## Vulnerability Breakdown\n\n`;
    summary += `### By Type\n`;
    for (const [type, count] of Object.entries(payload.vulnerabilityBreakdown.byType)) {
      summary += `- **${type}:** ${count}\n`;
    }
    summary += `\n### By Source\n`;
    for (const [source, count] of Object.entries(payload.vulnerabilityBreakdown.bySource)) {
      summary += `- **${source}:** ${count}\n`;
    }

    summary += `\n---\n`;
    summary += `*Generated by DCE Security Monitoring System*\n`;

    return summary;
  }

  /**
   * Send critical alerts to notification channels
   */
  async sendCriticalAlerts(payload) {
    const criticalAlerts = payload.alerts.filter(alert => alert.severity === 'critical');
    
    if (criticalAlerts.length === 0) {
      console.log('ℹ️ No critical alerts to send');
      return;
    }
    
    console.log(`🚨 Sending ${criticalAlerts.length} critical alert(s)...`);
    
    // This would integrate with notification systems like Slack, PagerDuty, email, etc.
    for (const alert of criticalAlerts) {
      console.log(`   ${alert.title}: ${alert.message}`);
      
      // TODO: Implement actual notification sending
      // - Slack webhook
      // - PagerDuty integration
      // - Email notifications
      // - SMS alerts for critical issues
    }
  }

  /**
   * Update security monitoring
   */
  async updateMonitoring() {
    try {
      console.log('🔒 Updating Security Monitoring...');
      
      // Collect security data
      await this.collectSecurityData();
      
      // Prepare monitoring payload
      const payload = this.prepareMonitoringPayload();
      
      // Save data locally
      const savedFiles = await this.saveMonitoringData(payload);
      
      // Send webhook update
      let webhookResponse = null;
      try {
        webhookResponse = await this.sendWebhookUpdate(payload);
      } catch (error) {
        console.log('⚠️ Webhook update failed, continuing with local monitoring');
      }
      
      // Send critical alerts
      await this.sendCriticalAlerts(payload);
      
      console.log(`🎉 Security monitoring updated successfully!`);
      console.log(`   Security Score: ${payload.securityScore.toFixed(1)}/100`);
      console.log(`   Active Alerts: ${payload.alerts.length}`);
      console.log(`   Critical Alerts: ${payload.summary.criticalAlerts}`);
      
      return {
        payload,
        savedFiles,
        webhookResponse,
        success: true
      };
      
    } catch (error) {
      console.error('❌ Security monitoring update failed:', error.message);
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

  const updater = new SecurityMonitoringUpdater(options);
  
  try {
    const result = await updater.updateMonitoring();
    
    // Exit with warning if critical alerts
    if (result.payload.summary.criticalAlerts > 0) {
      console.log('⚠️ Critical security alerts detected');
      process.exit(2); // Warning exit code
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Monitoring update failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { SecurityMonitoringUpdater };