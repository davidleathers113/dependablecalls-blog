#!/usr/bin/env node

/**
 * Comprehensive Security Report Generator for DCE Platform
 * 
 * This script aggregates security test results from multiple sources
 * and generates comprehensive reports with metrics and visualizations.
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class SecurityReportGenerator {
  constructor(options = {}) {
    this.options = {
      inputDir: options.inputDir || './security-results',
      outputDir: options.outputDir || './security-report',
      includeCharts: options.includeCharts || true,
      format: options.format || 'all', // html, json, markdown, all
      ...options
    };
    
    this.reportData = {
      summary: {},
      vulnerabilities: [],
      trends: {},
      compliance: {},
      recommendations: []
    };
  }

  /**
   * Collect security data from all sources
   */
  async collectSecurityData() {
    console.log('📊 Collecting security data from all sources...');
    
    const data = {
      timestamp: new Date().toISOString(),
      sources: {},
      aggregated: {
        vulnerabilities: [],
        testResults: {},
        metrics: {}
      }
    };

    try {
      // Load SAST results (CodeQL)
      data.sources.sast = await this.loadSASTResults();
      
      // Load DAST results (OWASP ZAP)
      data.sources.dast = await this.loadDASTResults();
      
      // Load dependency audit results
      data.sources.dependencies = await this.loadDependencyResults();
      
      // Load unit test results
      data.sources.unitTests = await this.loadUnitTestResults();
      
      // Load regression test results
      data.sources.regressionTests = await this.loadRegressionResults();
      
      // Load container security results
      data.sources.containers = await this.loadContainerResults();
      
      // Aggregate all vulnerabilities
      data.aggregated.vulnerabilities = await this.aggregateVulnerabilities(data.sources);
      
      // Calculate metrics
      data.aggregated.metrics = await this.calculateMetrics(data);
      
      console.log(`✅ Data collection completed: ${data.aggregated.vulnerabilities.length} vulnerabilities found`);
      return data;
      
    } catch (error) {
      console.error('❌ Data collection failed:', error.message);
      throw error;
    }
  }

  /**
   * Load SAST (Static Analysis) results
   */
  async loadSASTResults() {
    console.log('   Loading SAST results...');
    
    try {
      // Try to load CodeQL results
      const codeqlPath = path.join(this.options.inputDir, 'codeql-results.json');
      const codeqlExists = await fs.access(codeqlPath).then(() => true).catch(() => false);
      
      if (codeqlExists) {
        const codeqlData = await fs.readFile(codeqlPath, 'utf8');
        return { codeql: JSON.parse(codeqlData) };
      }
      
      return { available: false };
    } catch (error) {
      console.log('   ⚠️ SAST results not available');
      return { error: error.message };
    }
  }

  /**
   * Load DAST (Dynamic Analysis) results
   */
  async loadDASTResults() {
    console.log('   Loading DAST results...');
    
    try {
      // Look for OWASP ZAP results
      const zapFiles = await fs.readdir(this.options.inputDir);
      const zapFile = zapFiles.find(file => file.startsWith('zap-') && file.endsWith('.json'));
      
      if (zapFile) {
        const zapPath = path.join(this.options.inputDir, zapFile);
        const zapData = await fs.readFile(zapPath, 'utf8');
        return { zap: JSON.parse(zapData) };
      }
      
      return { available: false };
    } catch (error) {
      console.log('   ⚠️ DAST results not available');
      return { error: error.message };
    }
  }

  /**
   * Load dependency audit results
   */
  async loadDependencyResults() {
    console.log('   Loading dependency audit results...');
    
    try {
      const results = {};
      
      // Load npm audit results
      const npmAuditPath = path.join(this.options.inputDir, 'npm-audit-results.json');
      const npmExists = await fs.access(npmAuditPath).then(() => true).catch(() => false);
      
      if (npmExists) {
        const npmData = await fs.readFile(npmAuditPath, 'utf8');
        results.npm = JSON.parse(npmData);
      }
      
      // Load Snyk results
      const snykPath = path.join(this.options.inputDir, 'snyk-results.json');
      const snykExists = await fs.access(snykPath).then(() => true).catch(() => false);
      
      if (snykExists) {
        const snykData = await fs.readFile(snykPath, 'utf8');
        results.snyk = JSON.parse(snykData);
      }
      
      return results;
    } catch (error) {
      console.log('   ⚠️ Dependency results not available');
      return { error: error.message };
    }
  }

  /**
   * Load unit test results
   */
  async loadUnitTestResults() {
    console.log('   Loading unit test results...');
    
    try {
      const testResultsPath = path.join(this.options.inputDir, 'security-test-results.json');
      const testExists = await fs.access(testResultsPath).then(() => true).catch(() => false);
      
      if (testExists) {
        const testData = await fs.readFile(testResultsPath, 'utf8');
        return JSON.parse(testData);
      }
      
      return { available: false };
    } catch (error) {
      console.log('   ⚠️ Unit test results not available');
      return { error: error.message };
    }
  }

  /**
   * Load regression test results
   */
  async loadRegressionResults() {
    console.log('   Loading regression test results...');
    
    try {
      const regressionFiles = await fs.readdir(this.options.inputDir);
      const regressionFile = regressionFiles.find(file => 
        file.startsWith('security-regression-report-') && file.endsWith('.json')
      );
      
      if (regressionFile) {
        const regressionPath = path.join(this.options.inputDir, regressionFile);
        const regressionData = await fs.readFile(regressionPath, 'utf8');
        return JSON.parse(regressionData);
      }
      
      return { available: false };
    } catch (error) {
      console.log('   ⚠️ Regression test results not available');
      return { error: error.message };
    }
  }

  /**
   * Load container security results
   */
  async loadContainerResults() {
    console.log('   Loading container security results...');
    
    try {
      const containerPath = path.join(this.options.inputDir, 'trivy-results.json');
      const containerExists = await fs.access(containerPath).then(() => true).catch(() => false);
      
      if (containerExists) {
        const containerData = await fs.readFile(containerPath, 'utf8');
        return JSON.parse(containerData);
      }
      
      return { available: false };
    } catch (error) {
      console.log('   ⚠️ Container security results not available');
      return { error: error.message };
    }
  }

  /**
   * Aggregate vulnerabilities from all sources
   */
  async aggregateVulnerabilities(sources) {
    const vulnerabilities = [];
    
    // Process DAST vulnerabilities (OWASP ZAP)
    if (sources.dast && sources.dast.zap && sources.dast.zap.alerts) {
      for (const alert of sources.dast.zap.alerts) {
        vulnerabilities.push({
          id: this.generateVulnId('dast', alert.name, alert.url),
          source: 'OWASP ZAP',
          type: 'dast',
          severity: this.normalizeSeverity(alert.risk),
          title: alert.name,
          description: alert.description,
          location: alert.url,
          solution: alert.solution,
          reference: alert.reference,
          cweId: alert.cweid,
          wascId: alert.wascid,
          confidence: alert.confidence,
          instances: alert.instances?.length || 1
        });
      }
    }

    // Process dependency vulnerabilities
    if (sources.dependencies) {
      // npm audit vulnerabilities
      if (sources.dependencies.npm && sources.dependencies.npm.vulnerabilities) {
        for (const [name, vuln] of Object.entries(sources.dependencies.npm.vulnerabilities)) {
          vulnerabilities.push({
            id: this.generateVulnId('dependency', name, vuln.title),
            source: 'npm audit',
            type: 'dependency',
            severity: this.normalizeSeverity(vuln.severity),
            title: vuln.title,
            description: vuln.overview,
            location: name,
            cwe: vuln.cwe,
            cvss: vuln.cvss,
            patchedVersions: vuln.patched_versions,
            vulnerableVersions: vuln.vulnerable_versions
          });
        }
      }
      
      // Snyk vulnerabilities
      if (sources.dependencies.snyk && sources.dependencies.snyk.vulnerabilities) {
        for (const vuln of sources.dependencies.snyk.vulnerabilities) {
          vulnerabilities.push({
            id: this.generateVulnId('snyk', vuln.packageName, vuln.title),
            source: 'Snyk',
            type: 'dependency',
            severity: this.normalizeSeverity(vuln.severity),
            title: vuln.title,
            description: vuln.description,
            location: vuln.packageName,
            identifiers: vuln.identifiers,
            references: vuln.references
          });
        }
      }
    }

    // Process container vulnerabilities
    if (sources.containers && sources.containers.Results) {
      for (const result of sources.containers.Results) {
        if (result.Vulnerabilities) {
          for (const vuln of result.Vulnerabilities) {
            vulnerabilities.push({
              id: this.generateVulnId('container', result.Target, vuln.VulnerabilityID),
              source: 'Trivy',
              type: 'container',
              severity: this.normalizeSeverity(vuln.Severity),
              title: vuln.Title || vuln.VulnerabilityID,
              description: vuln.Description,
              location: result.Target,
              cve: vuln.VulnerabilityID,
              references: vuln.References
            });
          }
        }
      }
    }

    // Process regression test findings
    if (sources.regressionTests && sources.regressionTests.regressions) {
      for (const regression of sources.regressionTests.regressions) {
        vulnerabilities.push({
          id: regression.vulnerability.id,
          source: 'Regression Test',
          type: 'regression',
          severity: regression.vulnerability.severity,
          title: `Regression: ${regression.vulnerability.title}`,
          description: regression.reason,
          location: regression.vulnerability.source,
          impact: regression.impact
        });
      }
    }

    return this.deduplicateVulnerabilities(vulnerabilities);
  }

  /**
   * Generate unique vulnerability ID
   */
  generateVulnId(type, source, identifier) {
    const data = `${type}-${source}-${identifier}`;
    return crypto.createHash('md5').update(data).digest('hex').substring(0, 12);
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
      'informational': 'low',
      'negligible': 'low'
    };
    
    return severityMap[severity.toLowerCase()] || 'medium';
  }

  /**
   * Remove duplicate vulnerabilities
   */
  deduplicateVulnerabilities(vulnerabilities) {
    const seen = new Map();
    const deduplicated = [];
    
    for (const vuln of vulnerabilities) {
      const key = `${vuln.title}-${vuln.location}`;
      
      if (!seen.has(key)) {
        seen.set(key, vuln);
        deduplicated.push(vuln);
      } else {
        // Merge sources for duplicates
        const existing = seen.get(key);
        existing.sources = existing.sources || [existing.source];
        if (!existing.sources.includes(vuln.source)) {
          existing.sources.push(vuln.source);
        }
      }
    }
    
    return deduplicated;
  }

  /**
   * Calculate security metrics
   */
  async calculateMetrics(data) {
    const metrics = {
      overview: {},
      trends: {},
      coverage: {},
      performance: {},
      compliance: {}
    };

    const vulns = data.aggregated.vulnerabilities;
    
    // Overview metrics
    metrics.overview = {
      totalVulnerabilities: vulns.length,
      criticalCount: vulns.filter(v => v.severity === 'critical').length,
      highCount: vulns.filter(v => v.severity === 'high').length,
      mediumCount: vulns.filter(v => v.severity === 'medium').length,
      lowCount: vulns.filter(v => v.severity === 'low').length,
      
      sourceBreakdown: {
        dast: vulns.filter(v => v.type === 'dast').length,
        sast: vulns.filter(v => v.type === 'sast').length,
        dependency: vulns.filter(v => v.type === 'dependency').length,
        container: vulns.filter(v => v.type === 'container').length,
        regression: vulns.filter(v => v.type === 'regression').length
      }
    };

    // Security test coverage
    metrics.coverage = {
      sastEnabled: !!data.sources.sast && !data.sources.sast.error,
      dastEnabled: !!data.sources.dast && !data.sources.dast.error,
      dependencyAuditEnabled: !!data.sources.dependencies && Object.keys(data.sources.dependencies).length > 0,
      containerScanEnabled: !!data.sources.containers && !data.sources.containers.error,
      regressionTestingEnabled: !!data.sources.regressionTests && !data.sources.regressionTests.error,
      
      coverageScore: this.calculateCoverageScore(data.sources)
    };

    // Compliance metrics
    metrics.compliance = {
      owaspTop10: await this.assessOWASPCompliance(vulns),
      pciDss: await this.assessPCICompliance(vulns),
      securityThresholds: this.assessSecurityThresholds(vulns)
    };

    // Performance metrics
    metrics.performance = {
      scanDuration: this.calculateScanDuration(data.sources),
      falsePositiveRate: this.estimateFalsePositiveRate(vulns),
      meanTimeToRemediation: this.calculateMTTR(vulns)
    };

    return metrics;
  }

  /**
   * Calculate security test coverage score
   */
  calculateCoverageScore(sources) {
    let score = 0;
    const maxScore = 5;
    
    if (sources.sast && !sources.sast.error) score++;
    if (sources.dast && !sources.dast.error) score++;
    if (sources.dependencies && Object.keys(sources.dependencies).length > 0) score++;
    if (sources.containers && !sources.containers.error) score++;
    if (sources.regressionTests && !sources.regressionTests.error) score++;
    
    return (score / maxScore) * 100;
  }

  /**
   * Assess OWASP Top 10 compliance
   */
  async assessOWASPCompliance(vulnerabilities) {
    const owaspCategories = {
      'A01:2021-Broken Access Control': 0,
      'A02:2021-Cryptographic Failures': 0,
      'A03:2021-Injection': 0,
      'A04:2021-Insecure Design': 0,
      'A05:2021-Security Misconfiguration': 0,
      'A06:2021-Vulnerable and Outdated Components': 0,
      'A07:2021-Identification and Authentication Failures': 0,
      'A08:2021-Software and Data Integrity Failures': 0,
      'A09:2021-Security Logging and Monitoring Failures': 0,
      'A10:2021-Server-Side Request Forgery': 0
    };

    // Map vulnerabilities to OWASP categories
    for (const vuln of vulnerabilities) {
      if (vuln.cweId) {
        const owaspCategory = this.mapCWEToOWASP(vuln.cweId);
        if (owaspCategory && owaspCategories[owaspCategory] !== undefined) {
          owaspCategories[owaspCategory]++;
        }
      }
    }

    return {
      categories: owaspCategories,
      totalCovered: Object.values(owaspCategories).filter(count => count === 0).length,
      coveragePercentage: (Object.values(owaspCategories).filter(count => count === 0).length / 10) * 100
    };
  }

  /**
   * Map CWE to OWASP Top 10 categories
   */
  mapCWEToOWASP(cweId) {
    const cweToOwasp = {
      // A01: Broken Access Control
      22: 'A01:2021-Broken Access Control',
      285: 'A01:2021-Broken Access Control',
      287: 'A01:2021-Broken Access Control',
      
      // A02: Cryptographic Failures
      327: 'A02:2021-Cryptographic Failures',
      328: 'A02:2021-Cryptographic Failures',
      
      // A03: Injection
      79: 'A03:2021-Injection',
      89: 'A03:2021-Injection',
      
      // A05: Security Misconfiguration
      16: 'A05:2021-Security Misconfiguration',
      
      // A06: Vulnerable and Outdated Components
      // (handled by dependency vulnerabilities)
      
      // A10: Server-Side Request Forgery
      918: 'A10:2021-Server-Side Request Forgery'
    };

    return cweToOwasp[parseInt(cweId)] || null;
  }

  /**
   * Assess PCI DSS compliance
   */
  async assessPCICompliance(vulnerabilities) {
    const pciRequirements = {
      'Secure Network': 0,
      'Protect Cardholder Data': 0,
      'Maintain Vulnerability Management': 0,
      'Implement Strong Access Control': 0,
      'Regularly Monitor Networks': 0,
      'Maintain Information Security Policy': 0
    };

    // Simple assessment based on vulnerability types
    const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical').length;
    const authVulns = vulnerabilities.filter(v => 
      v.title.toLowerCase().includes('auth') || 
      v.title.toLowerCase().includes('password')
    ).length;

    return {
      requirements: pciRequirements,
      criticalIssues: criticalVulns,
      authenticationIssues: authVulns,
      overallScore: criticalVulns === 0 && authVulns === 0 ? 100 : Math.max(0, 100 - (criticalVulns * 20) - (authVulns * 10))
    };
  }

  /**
   * Assess security thresholds
   */
  assessSecurityThresholds(vulnerabilities) {
    const thresholds = {
      critical: { limit: 0, current: 0 },
      high: { limit: 5, current: 0 },
      medium: { limit: 20, current: 0 },
      low: { limit: 50, current: 0 }
    };

    for (const vuln of vulnerabilities) {
      if (thresholds[vuln.severity]) {
        thresholds[vuln.severity].current++;
      }
    }

    const passed = Object.values(thresholds).every(t => t.current <= t.limit);

    return {
      thresholds,
      passed,
      violations: Object.entries(thresholds)
        .filter(([_, t]) => t.current > t.limit)
        .map(([severity, t]) => ({
          severity,
          current: t.current,
          limit: t.limit,
          excess: t.current - t.limit
        }))
    };
  }

  /**
   * Calculate scan duration
   */
  calculateScanDuration(sources) {
    // This would need to be implemented based on actual scan timing data
    return {
      estimated: true,
      sast: 300, // 5 minutes
      dast: 1800, // 30 minutes  
      dependencies: 60, // 1 minute
      containers: 120, // 2 minutes
      total: 2280 // 38 minutes
    };
  }

  /**
   * Estimate false positive rate
   */
  estimateFalsePositiveRate(vulnerabilities) {
    // This would need historical data for accurate calculation
    return {
      estimated: true,
      rate: 0.15, // 15% estimated
      total: vulnerabilities.length,
      estimatedFalsePositives: Math.round(vulnerabilities.length * 0.15)
    };
  }

  /**
   * Calculate Mean Time To Remediation
   */
  calculateMTTR(vulnerabilities) {
    // This would need historical remediation data
    return {
      estimated: true,
      critical: 1, // 1 day
      high: 7, // 1 week
      medium: 30, // 1 month
      low: 90 // 3 months
    };
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(data, metrics) {
    const recommendations = [];
    
    // Critical vulnerabilities
    if (metrics.overview.criticalCount > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'Vulnerabilities',
        title: 'Address Critical Vulnerabilities',
        description: `${metrics.overview.criticalCount} critical vulnerabilities found that require immediate attention.`,
        action: 'Fix critical vulnerabilities before deployment',
        impact: 'High security risk - potential for system compromise'
      });
    }

    // Security threshold violations
    if (!metrics.compliance.securityThresholds.passed) {
      for (const violation of metrics.compliance.securityThresholds.violations) {
        recommendations.push({
          priority: violation.severity === 'critical' ? 'critical' : 'high',
          category: 'Thresholds',
          title: `${violation.severity.toUpperCase()} Threshold Exceeded`,
          description: `Found ${violation.current} ${violation.severity} vulnerabilities (limit: ${violation.limit})`,
          action: `Reduce ${violation.severity} vulnerabilities by ${violation.excess}`,
          impact: 'Security policy violation'
        });
      }
    }

    // Coverage improvements
    if (metrics.coverage.coverageScore < 100) {
      const missing = [];
      if (!metrics.coverage.sastEnabled) missing.push('SAST');
      if (!metrics.coverage.dastEnabled) missing.push('DAST');
      if (!metrics.coverage.dependencyAuditEnabled) missing.push('Dependency Audit');
      if (!metrics.coverage.containerScanEnabled) missing.push('Container Scan');
      if (!metrics.coverage.regressionTestingEnabled) missing.push('Regression Testing');
      
      if (missing.length > 0) {
        recommendations.push({
          priority: 'medium',
          category: 'Coverage',
          title: 'Improve Security Test Coverage',
          description: `Missing security testing tools: ${missing.join(', ')}`,
          action: `Implement ${missing.join(', ')} to achieve comprehensive coverage`,
          impact: 'May miss security vulnerabilities'
        });
      }
    }

    // Dependency vulnerabilities
    const dependencyVulns = data.aggregated.vulnerabilities.filter(v => v.type === 'dependency').length;
    if (dependencyVulns > 10) {
      recommendations.push({
        priority: 'medium',
        category: 'Dependencies',
        title: 'Update Vulnerable Dependencies',
        description: `${dependencyVulns} dependency vulnerabilities found`,
        action: 'Update packages to latest secure versions',
        impact: 'Third-party security risks'
      });
    }

    // Positive feedback
    if (metrics.overview.criticalCount === 0 && metrics.overview.highCount === 0) {
      recommendations.push({
        priority: 'info',
        category: 'Security',
        title: 'Good Security Posture',
        description: 'No critical or high-severity vulnerabilities detected',
        action: 'Continue following secure development practices',
        impact: 'Maintaining secure application'
      });
    }

    return recommendations;
  }

  /**
   * Generate HTML report
   */
  async generateHTMLReport(data, metrics, recommendations) {
    console.log('📄 Generating HTML report...');
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DCE Platform - Security Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; border-radius: 8px; margin-bottom: 2rem; }
        .header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
        .header p { font-size: 1.1rem; opacity: 0.9; }
        .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .card { background: white; border-radius: 8px; padding: 1.5rem; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border-left: 4px solid #667eea; }
        .card h3 { color: #667eea; margin-bottom: 0.5rem; }
        .card .number { font-size: 2rem; font-weight: bold; color: #333; }
        .severity-critical { border-left-color: #dc3545; }
        .severity-high { border-left-color: #fd7e14; }
        .severity-medium { border-left-color: #ffc107; }
        .severity-low { border-left-color: #28a745; }
        .section { background: white; border-radius: 8px; padding: 2rem; margin-bottom: 2rem; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .section h2 { color: #333; margin-bottom: 1rem; border-bottom: 2px solid #667eea; padding-bottom: 0.5rem; }
        .vuln-list { list-style: none; }
        .vuln-item { background: #f8f9fa; margin: 0.5rem 0; padding: 1rem; border-radius: 4px; border-left: 4px solid #dee2e6; }
        .vuln-item.critical { border-left-color: #dc3545; background-color: #f8d7da; }
        .vuln-item.high { border-left-color: #fd7e14; background-color: #fff3cd; }
        .vuln-item.medium { border-left-color: #ffc107; background-color: #fff3cd; }
        .vuln-item.low { border-left-color: #28a745; background-color: #d1edda; }
        .vuln-title { font-weight: bold; color: #333; }
        .vuln-meta { font-size: 0.9rem; color: #666; margin-top: 0.5rem; }
        .recommendations { background: #f8f9fa; border-radius: 8px; padding: 1.5rem; }
        .recommendation { margin: 1rem 0; padding: 1rem; border-radius: 4px; }
        .recommendation.critical { background: #f8d7da; border-left: 4px solid #dc3545; }
        .recommendation.high { background: #fff3cd; border-left: 4px solid #fd7e14; }
        .recommendation.medium { background: #d4edda; border-left: 4px solid #28a745; }
        .recommendation.info { background: #d1ecf1; border-left: 4px solid #17a2b8; }
        .chart-placeholder { background: #f8f9fa; border: 2px dashed #dee2e6; padding: 2rem; text-align: center; color: #666; border-radius: 4px; }
        .timestamp { color: #666; font-size: 0.9rem; }
        .badge { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; }
        .badge.critical { background: #dc3545; color: white; }
        .badge.high { background: #fd7e14; color: white; }
        .badge.medium { background: #ffc107; color: black; }
        .badge.low { background: #28a745; color: white; }
        .progress { background: #e9ecef; border-radius: 4px; height: 20px; overflow: hidden; }
        .progress-bar { background: #28a745; height: 100%; text-align: center; line-height: 20px; color: white; font-size: 0.8rem; }
        .table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
        .table th, .table td { padding: 0.8rem; text-align: left; border-bottom: 1px solid #dee2e6; }
        .table th { background: #f8f9fa; font-weight: bold; }
        .footer { text-align: center; color: #666; margin-top: 2rem; padding-top: 2rem; border-top: 1px solid #dee2e6; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 DCE Platform Security Report</h1>
            <p>Comprehensive security analysis and vulnerability assessment</p>
            <p class="timestamp">Generated: ${data.timestamp}</p>
        </div>

        <!-- Summary Cards -->
        <div class="summary-cards">
            <div class="card">
                <h3>Total Vulnerabilities</h3>
                <div class="number">${metrics.overview.totalVulnerabilities}</div>
            </div>
            <div class="card severity-critical">
                <h3>Critical</h3>
                <div class="number">${metrics.overview.criticalCount}</div>
            </div>
            <div class="card severity-high">
                <h3>High</h3>
                <div class="number">${metrics.overview.highCount}</div>
            </div>
            <div class="card severity-medium">
                <h3>Medium</h3>
                <div class="number">${metrics.overview.mediumCount}</div>
            </div>
            <div class="card severity-low">
                <h3>Low</h3>
                <div class="number">${metrics.overview.lowCount}</div>
            </div>
            <div class="card">
                <h3>Test Coverage</h3>
                <div class="number">${Math.round(metrics.coverage.coverageScore)}%</div>
                <div class="progress">
                    <div class="progress-bar" style="width: ${metrics.coverage.coverageScore}%">${Math.round(metrics.coverage.coverageScore)}%</div>
                </div>
            </div>
        </div>

        <!-- Security Recommendations -->
        <div class="section">
            <h2>🎯 Security Recommendations</h2>
            <div class="recommendations">
                ${recommendations.map(rec => `
                    <div class="recommendation ${rec.priority}">
                        <strong>${rec.title}</strong>
                        <p>${rec.description}</p>
                        <p><strong>Action:</strong> ${rec.action}</p>
                        <p><strong>Impact:</strong> ${rec.impact}</p>
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- Vulnerability Breakdown -->
        <div class="section">
            <h2>🚨 Top Vulnerabilities</h2>
            <ul class="vuln-list">
                ${data.aggregated.vulnerabilities
                  .filter(v => ['critical', 'high'].includes(v.severity))
                  .slice(0, 10)
                  .map(vuln => `
                    <li class="vuln-item ${vuln.severity}">
                        <div class="vuln-title">${vuln.title} <span class="badge ${vuln.severity}">${vuln.severity}</span></div>
                        <div class="vuln-meta">
                            <strong>Source:</strong> ${vuln.source} | 
                            <strong>Type:</strong> ${vuln.type} | 
                            <strong>Location:</strong> ${vuln.location}
                        </div>
                        <p>${vuln.description}</p>
                    </li>
                `).join('')}
            </ul>
        </div>

        <!-- Coverage Analysis -->
        <div class="section">
            <h2>📊 Security Test Coverage</h2>
            <table class="table">
                <thead>
                    <tr>
                        <th>Test Type</th>
                        <th>Status</th>
                        <th>Vulnerabilities Found</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Static Analysis (SAST)</td>
                        <td>${metrics.coverage.sastEnabled ? '✅ Enabled' : '❌ Disabled'}</td>
                        <td>${metrics.overview.sourceBreakdown.sast}</td>
                    </tr>
                    <tr>
                        <td>Dynamic Analysis (DAST)</td>
                        <td>${metrics.coverage.dastEnabled ? '✅ Enabled' : '❌ Disabled'}</td>
                        <td>${metrics.overview.sourceBreakdown.dast}</td>
                    </tr>
                    <tr>
                        <td>Dependency Audit</td>
                        <td>${metrics.coverage.dependencyAuditEnabled ? '✅ Enabled' : '❌ Disabled'}</td>
                        <td>${metrics.overview.sourceBreakdown.dependency}</td>
                    </tr>
                    <tr>
                        <td>Container Scan</td>
                        <td>${metrics.coverage.containerScanEnabled ? '✅ Enabled' : '❌ Disabled'}</td>
                        <td>${metrics.overview.sourceBreakdown.container}</td>
                    </tr>
                    <tr>
                        <td>Regression Testing</td>
                        <td>${metrics.coverage.regressionTestingEnabled ? '✅ Enabled' : '❌ Disabled'}</td>
                        <td>${metrics.overview.sourceBreakdown.regression}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Compliance Status -->
        <div class="section">
            <h2>✅ Compliance Status</h2>
            <h3>Security Thresholds</h3>
            <p><strong>Status:</strong> ${metrics.compliance.securityThresholds.passed ? '✅ PASSED' : '❌ FAILED'}</p>
            
            <h3>OWASP Top 10 Coverage</h3>
            <p><strong>Coverage:</strong> ${metrics.compliance.owaspTop10.coveragePercentage.toFixed(1)}%</p>
            
            <h3>PCI DSS Assessment</h3>
            <p><strong>Score:</strong> ${metrics.compliance.pciDss.overallScore}/100</p>
        </div>

        <div class="footer">
            <p>Generated by DCE Security Testing Framework | ${new Date().toLocaleDateString()}</p>
        </div>
    </div>
</body>
</html>`;

    return html;
  }

  /**
   * Generate JSON report
   */
  async generateJSONReport(data, metrics, recommendations) {
    console.log('📋 Generating JSON report...');
    
    return {
      metadata: {
        generated: data.timestamp,
        format: 'json',
        version: '1.0.0'
      },
      summary: metrics.overview,
      vulnerabilities: data.aggregated.vulnerabilities,
      metrics: metrics,
      recommendations: recommendations,
      sources: Object.keys(data.sources).filter(key => 
        data.sources[key] && !data.sources[key].error && data.sources[key].available !== false
      ),
      compliance: metrics.compliance
    };
  }

  /**
   * Generate Markdown report
   */
  async generateMarkdownReport(data, metrics, recommendations) {
    console.log('📝 Generating Markdown report...');
    
    let markdown = `# 🔒 DCE Platform Security Report\n\n`;
    markdown += `**Generated:** ${data.timestamp}\n\n`;

    // Executive Summary
    markdown += `## Executive Summary\n\n`;
    markdown += `This security report provides a comprehensive analysis of the DCE Platform's security posture. `;
    markdown += `A total of **${metrics.overview.totalVulnerabilities} vulnerabilities** were identified across multiple security testing tools.\n\n`;

    // Summary Table
    markdown += `| Severity | Count |\n`;
    markdown += `|----------|-------|\n`;
    markdown += `| Critical | ${metrics.overview.criticalCount} |\n`;
    markdown += `| High     | ${metrics.overview.highCount} |\n`;
    markdown += `| Medium   | ${metrics.overview.mediumCount} |\n`;
    markdown += `| Low      | ${metrics.overview.lowCount} |\n\n`;

    // Security Test Coverage
    markdown += `## 📊 Security Test Coverage\n\n`;
    markdown += `**Overall Coverage Score:** ${Math.round(metrics.coverage.coverageScore)}%\n\n`;
    markdown += `| Test Type | Status | Vulnerabilities |\n`;
    markdown += `|-----------|--------|----------------|\n`;
    markdown += `| SAST | ${metrics.coverage.sastEnabled ? '✅' : '❌'} | ${metrics.overview.sourceBreakdown.sast} |\n`;
    markdown += `| DAST | ${metrics.coverage.dastEnabled ? '✅' : '❌'} | ${metrics.overview.sourceBreakdown.dast} |\n`;
    markdown += `| Dependency Audit | ${metrics.coverage.dependencyAuditEnabled ? '✅' : '❌'} | ${metrics.overview.sourceBreakdown.dependency} |\n`;
    markdown += `| Container Scan | ${metrics.coverage.containerScanEnabled ? '✅' : '❌'} | ${metrics.overview.sourceBreakdown.container} |\n`;
    markdown += `| Regression Testing | ${metrics.coverage.regressionTestingEnabled ? '✅' : '❌'} | ${metrics.overview.sourceBreakdown.regression} |\n\n`;

    // Top Vulnerabilities
    const topVulns = data.aggregated.vulnerabilities
      .filter(v => ['critical', 'high'].includes(v.severity))
      .slice(0, 10);
    
    if (topVulns.length > 0) {
      markdown += `## 🚨 Top Vulnerabilities\n\n`;
      for (const vuln of topVulns) {
        markdown += `### ${vuln.title}\n`;
        markdown += `- **Severity:** ${vuln.severity.toUpperCase()}\n`;
        markdown += `- **Source:** ${vuln.source}\n`;
        markdown += `- **Type:** ${vuln.type}\n`;
        markdown += `- **Location:** ${vuln.location}\n`;
        markdown += `- **Description:** ${vuln.description}\n\n`;
      }
    }

    // Recommendations
    if (recommendations.length > 0) {
      markdown += `## 🎯 Recommendations\n\n`;
      for (const rec of recommendations) {
        const icon = {
          'critical': '🚨',
          'high': '⚠️',
          'medium': '⚡',
          'low': 'ℹ️',
          'info': '💡'
        }[rec.priority] || 'ℹ️';
        
        markdown += `${icon} **${rec.title}**\n`;
        markdown += `${rec.description}\n`;
        markdown += `**Action:** ${rec.action}\n`;
        markdown += `**Impact:** ${rec.impact}\n\n`;
      }
    }

    // Compliance Status
    markdown += `## ✅ Compliance Status\n\n`;
    markdown += `### Security Thresholds\n`;
    markdown += `**Status:** ${metrics.compliance.securityThresholds.passed ? '✅ PASSED' : '❌ FAILED'}\n\n`;
    
    if (!metrics.compliance.securityThresholds.passed) {
      markdown += `**Violations:**\n`;
      for (const violation of metrics.compliance.securityThresholds.violations) {
        markdown += `- ${violation.severity.toUpperCase()}: ${violation.current}/${violation.limit} (${violation.excess} over limit)\n`;
      }
      markdown += `\n`;
    }

    markdown += `### OWASP Top 10 Coverage\n`;
    markdown += `**Coverage:** ${metrics.compliance.owaspTop10.coveragePercentage.toFixed(1)}%\n\n`;

    markdown += `### PCI DSS Assessment\n`;
    markdown += `**Score:** ${metrics.compliance.pciDss.overallScore}/100\n\n`;

    markdown += `---\n`;
    markdown += `*Report generated by DCE Security Testing Framework*\n`;

    return markdown;
  }

  /**
   * Save reports to files
   */
  async saveReports(htmlReport, jsonReport, markdownReport) {
    console.log('💾 Saving reports...');
    
    // Ensure output directory exists
    await fs.mkdir(this.options.outputDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const files = {};
    
    // Save HTML report
    if (this.options.format === 'all' || this.options.format === 'html') {
      const htmlPath = path.join(this.options.outputDir, `security-report-${timestamp}.html`);
      await fs.writeFile(htmlPath, htmlReport);
      files.html = htmlPath;
    }
    
    // Save JSON report
    if (this.options.format === 'all' || this.options.format === 'json') {
      const jsonPath = path.join(this.options.outputDir, `security-report-${timestamp}.json`);
      await fs.writeFile(jsonPath, JSON.stringify(jsonReport, null, 2));
      files.json = jsonPath;
    }
    
    // Save Markdown report
    if (this.options.format === 'all' || this.options.format === 'markdown') {
      const markdownPath = path.join(this.options.outputDir, `security-report-${timestamp}.md`);
      await fs.writeFile(markdownPath, markdownReport);
      files.markdown = markdownPath;
    }
    
    // Save summary for PR comments
    const summaryPath = path.join(this.options.outputDir, 'summary.md');
    const summary = markdownReport.split('## 📊 Security Test Coverage')[0];
    await fs.writeFile(summaryPath, summary);
    files.summary = summaryPath;
    
    console.log(`✅ Reports saved:`);
    Object.entries(files).forEach(([format, path]) => {
      console.log(`   ${format.toUpperCase()}: ${path}`);
    });
    
    return files;
  }

  /**
   * Generate comprehensive security report
   */
  async generateReport() {
    try {
      console.log('🔒 Generating Comprehensive Security Report...');
      
      // Collect all security data
      const data = await this.collectSecurityData();
      
      // Calculate metrics
      const metrics = await this.calculateMetrics(data);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(data, metrics);
      
      // Generate reports in different formats
      const htmlReport = await this.generateHTMLReport(data, metrics, recommendations);
      const jsonReport = await this.generateJSONReport(data, metrics, recommendations);
      const markdownReport = await this.generateMarkdownReport(data, metrics, recommendations);
      
      // Save reports
      const files = await this.saveReports(htmlReport, jsonReport, markdownReport);
      
      console.log(`🎉 Security report generated successfully!`);
      console.log(`   Total Vulnerabilities: ${metrics.overview.totalVulnerabilities}`);
      console.log(`   Critical: ${metrics.overview.criticalCount}`);
      console.log(`   High: ${metrics.overview.highCount}`);
      console.log(`   Coverage Score: ${Math.round(metrics.coverage.coverageScore)}%`);
      
      return {
        files,
        data,
        metrics,
        recommendations,
        summary: {
          totalVulnerabilities: metrics.overview.totalVulnerabilities,
          critical: metrics.overview.criticalCount,
          high: metrics.overview.highCount,
          coverageScore: Math.round(metrics.coverage.coverageScore),
          thresholdsPassed: metrics.compliance.securityThresholds.passed
        }
      };
      
    } catch (error) {
      console.error('❌ Report generation failed:', error.message);
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

  const generator = new SecurityReportGenerator(options);
  
  try {
    const result = await generator.generateReport();
    
    // Exit with error if critical vulnerabilities found
    if (result.summary.critical > 0) {
      console.error('❌ Critical vulnerabilities found');
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Report generation failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { SecurityReportGenerator };