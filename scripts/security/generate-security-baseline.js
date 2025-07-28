#!/usr/bin/env node

/**
 * Security Baseline Generator for DCE Platform
 * 
 * This script generates a security baseline from current test results
 * to be used for future regression testing.
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

class SecurityBaselineGenerator {
  constructor(options = {}) {
    this.options = {
      outputDir: options.outputDir || './security-baseline',
      includeAllFindings: options.includeAllFindings || false,
      approvedVulnerabilities: options.approvedVulnerabilities || [],
      ...options
    };
  }

  /**
   * Run comprehensive security analysis
   */
  async runSecurityAnalysis() {
    console.log('🔍 Running comprehensive security analysis...');
    
    const analysis = {
      timestamp: new Date().toISOString(),
      version: this.getProjectVersion(),
      gitCommit: this.getGitCommit(),
      vulnerabilities: [],
      testResults: {},
      codeAnalysis: {},
      dependencyAudit: {},
      configuration: {
        toleranceLevel: 'strict',
        approvedExceptions: this.options.approvedVulnerabilities
      }
    };

    try {
      // Run security unit tests
      console.log('   Running security unit tests...');
      analysis.testResults = await this.runSecurityTests();

      // Run dependency audit
      console.log('   Running dependency security audit...');
      analysis.dependencyAudit = await this.runDependencyAudit();

      // Run static code analysis
      console.log('   Running static code analysis...');
      analysis.codeAnalysis = await this.runStaticAnalysis();

      // Run OWASP ZAP scan if available
      console.log('   Running OWASP ZAP scan...');
      analysis.zapResults = await this.runZAPScan();

      // Extract and normalize vulnerabilities
      analysis.vulnerabilities = await this.extractVulnerabilities(analysis);

      console.log(`✅ Security analysis completed: ${analysis.vulnerabilities.length} vulnerabilities found`);
      return analysis;

    } catch (error) {
      console.error('❌ Security analysis failed:', error.message);
      throw error;
    }
  }

  /**
   * Get project version from package.json
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
   * Get current git commit hash
   */
  getGitCommit() {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Run security unit tests
   */
  async runSecurityTests() {
    const results = {};
    
    try {
      // Run security-specific tests
      const testOutput = execSync('npm run test -- tests/security/ --reporter=json --coverage', 
        { encoding: 'utf8', stdio: 'pipe' });
      results.security = JSON.parse(testOutput);
      
      // Run auth security tests
      const authTestOutput = execSync('npm run test -- src/lib/security/ --reporter=json', 
        { encoding: 'utf8', stdio: 'pipe' });
      results.auth = JSON.parse(authTestOutput);
      
      console.log('   ✅ Security tests completed');
    } catch (error) {
      console.log('   ⚠️ Some security tests failed');
      results.error = error.message;
      // Continue with baseline generation even if tests fail
    }
    
    return results;
  }

  /**
   * Run dependency security audit
   */
  async runDependencyAudit() {
    const results = {};
    
    try {
      // npm audit
      const auditOutput = execSync('npm audit --json', 
        { encoding: 'utf8', stdio: 'pipe' });
      results.npm = JSON.parse(auditOutput);
    } catch (error) {
      // npm audit returns non-zero exit code when vulnerabilities found
      const auditData = error.stdout ? JSON.parse(error.stdout) : {};
      results.npm = auditData;
    }

    try {
      // Snyk scan
      const snykOutput = execSync('npx snyk test --json', 
        { encoding: 'utf8', stdio: 'pipe' });
      results.snyk = JSON.parse(snykOutput);
    } catch (error) {
      console.log('   ⚠️ Snyk scan failed or not configured');
      results.snyk = { error: 'Scan failed or not configured' };
    }

    try {
      // Generate SBOM
      execSync('npm run security:sbom', { stdio: 'pipe' });
      const sbomPath = path.join(process.cwd(), 'sbom.json');
      const sbomData = await fs.readFile(sbomPath, 'utf8');
      results.sbom = JSON.parse(sbomData);
    } catch (error) {
      console.log('   ⚠️ SBOM generation failed');
    }

    console.log('   ✅ Dependency audit completed');
    return results;
  }

  /**
   * Run static code analysis
   */
  async runStaticAnalysis() {
    const results = {};
    
    try {
      // ESLint with security rules
      const eslintOutput = execSync('npx eslint src/ tests/ --format=json --ext .ts,.tsx', 
        { encoding: 'utf8', stdio: 'pipe' });
      results.eslint = JSON.parse(eslintOutput);
    } catch (error) {
      const eslintData = error.stdout ? JSON.parse(error.stdout) : [];
      results.eslint = eslintData;
    }

    try {
      // TypeScript compiler checks
      execSync('npx tsc --noEmit --strict', { stdio: 'pipe' });
      results.typescript = { passed: true };
    } catch (error) {
      results.typescript = { 
        passed: false, 
        errors: error.message.split('\n').filter(line => line.trim()) 
      };
    }

    console.log('   ✅ Static analysis completed');
    return results;
  }

  /**
   * Run OWASP ZAP scan
   */
  async runZAPScan() {
    try {
      // Check if ZAP scan script exists
      const zapScriptPath = path.join(__dirname, 'run-zap-scan.js');
      await fs.access(zapScriptPath);
      
      // Run quick ZAP scan for baseline
      const zapOutput = execSync('node scripts/security/run-zap-scan.js --scanType quick', 
        { encoding: 'utf8', stdio: 'pipe' });
      
      // Try to load ZAP results
      const zapResultsPath = path.join(process.cwd(), 'tests/security/zap-security-report-latest.json');
      const zapData = await fs.readFile(zapResultsPath, 'utf8');
      
      console.log('   ✅ OWASP ZAP scan completed');
      return JSON.parse(zapData);
      
    } catch (error) {
      console.log('   ⚠️ OWASP ZAP scan not available or failed');
      return { error: 'ZAP scan not available' };
    }
  }

  /**
   * Extract and normalize vulnerabilities from all sources
   */
  async extractVulnerabilities(analysis) {
    const vulnerabilities = [];
    
    // Extract from dependency audit
    if (analysis.dependencyAudit.npm && analysis.dependencyAudit.npm.vulnerabilities) {
      for (const [name, vuln] of Object.entries(analysis.dependencyAudit.npm.vulnerabilities)) {
        const vulnId = this.generateVulnId('dependency', name, vuln.title || vuln.name);
        
        vulnerabilities.push({
          id: vulnId,
          type: 'dependency',
          severity: this.normalizeSeverity(vuln.severity),
          title: vuln.title || vuln.name,
          description: vuln.overview || vuln.description,
          source: name,
          cwe: vuln.cwe,
          cvss: vuln.cvss,
          references: vuln.references || [],
          patchedVersions: vuln.patched_versions,
          vulnerableVersions: vuln.vulnerable_versions,
          approved: this.isApprovedVulnerability(vulnId),
          firstSeen: new Date().toISOString()
        });
      }
    }

    // Extract from Snyk results
    if (analysis.dependencyAudit.snyk && analysis.dependencyAudit.snyk.vulnerabilities) {
      for (const vuln of analysis.dependencyAudit.snyk.vulnerabilities) {
        const vulnId = this.generateVulnId('snyk', vuln.packageName, vuln.title);
        
        vulnerabilities.push({
          id: vulnId,
          type: 'dependency',
          severity: this.normalizeSeverity(vuln.severity),
          title: vuln.title,
          description: vuln.description,
          source: vuln.packageName,
          identifiers: vuln.identifiers,
          references: vuln.references || [],
          approved: this.isApprovedVulnerability(vulnId),
          firstSeen: new Date().toISOString()
        });
      }
    }

    // Extract from ESLint security rules
    if (analysis.codeAnalysis.eslint) {
      for (const file of analysis.codeAnalysis.eslint) {
        for (const message of file.messages) {
          if (message.ruleId && (
            message.ruleId.includes('security') || 
            message.ruleId.includes('@typescript-eslint') ||
            message.severity === 2 // Error level
          )) {
            const vulnId = this.generateVulnId('static-analysis', file.filePath, message.ruleId);
            
            vulnerabilities.push({
              id: vulnId,
              type: 'static-analysis',
              severity: this.mapESLintSeverity(message.severity),
              title: message.message,
              description: `Code quality/security issue: ${message.ruleId}`,
              source: file.filePath,
              line: message.line,
              column: message.column,
              ruleId: message.ruleId,
              approved: this.isApprovedVulnerability(vulnId),
              firstSeen: new Date().toISOString()
            });
          }
        }
      }
    }

    // Extract from OWASP ZAP results
    if (analysis.zapResults && analysis.zapResults.alerts) {
      for (const alert of analysis.zapResults.alerts) {
        const vulnId = this.generateVulnId('dast', alert.name, alert.url);
        
        vulnerabilities.push({
          id: vulnId,
          type: 'dast',
          severity: this.normalizeSeverity(alert.risk),
          title: alert.name,
          description: alert.description,
          source: alert.url,
          solution: alert.solution,
          reference: alert.reference,
          cweId: alert.cweid,
          wascId: alert.wascid,
          instances: alert.instances?.length || 1,
          approved: this.isApprovedVulnerability(vulnId),
          firstSeen: new Date().toISOString()
        });
      }
    }

    // Remove duplicates and sort by severity
    const uniqueVulnerabilities = this.deduplicateVulnerabilities(vulnerabilities);
    return this.sortVulnerabilitiesBySeverity(uniqueVulnerabilities);
  }

  /**
   * Generate unique vulnerability ID
   */
  generateVulnId(type, source, identifier) {
    const data = `${type}-${source}-${identifier}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Normalize severity to standard levels
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
   * Map ESLint severity to standard levels
   */
  mapESLintSeverity(severity) {
    const severityMap = {
      1: 'low',    // Warning
      2: 'medium'  // Error
    };
    
    return severityMap[severity] || 'low';
  }

  /**
   * Check if vulnerability is in approved exceptions list
   */
  isApprovedVulnerability(vulnId) {
    return this.options.approvedVulnerabilities.includes(vulnId);
  }

  /**
   * Remove duplicate vulnerabilities
   */
  deduplicateVulnerabilities(vulnerabilities) {
    const seen = new Set();
    return vulnerabilities.filter(vuln => {
      if (seen.has(vuln.id)) {
        return false;
      }
      seen.add(vuln.id);
      return true;
    });
  }

  /**
   * Sort vulnerabilities by severity
   */
  sortVulnerabilitiesBySeverity(vulnerabilities) {
    const severityOrder = ['critical', 'high', 'medium', 'low'];
    
    return vulnerabilities.sort((a, b) => {
      const aIndex = severityOrder.indexOf(a.severity);
      const bIndex = severityOrder.indexOf(b.severity);
      return aIndex - bIndex;
    });
  }

  /**
   * Generate baseline metadata
   */
  generateBaselineMetadata(analysis) {
    const severityCount = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    const typeCount = {
      dependency: 0,
      'static-analysis': 0,
      dast: 0
    };

    for (const vuln of analysis.vulnerabilities) {
      severityCount[vuln.severity] = (severityCount[vuln.severity] || 0) + 1;
      typeCount[vuln.type] = (typeCount[vuln.type] || 0) + 1;
    }

    return {
      generatedAt: analysis.timestamp,
      projectVersion: analysis.version,
      gitCommit: analysis.gitCommit,
      totalVulnerabilities: analysis.vulnerabilities.length,
      approvedExceptions: this.options.approvedVulnerabilities.length,
      severityBreakdown: severityCount,
      typeBreakdown: typeCount,
      configuration: analysis.configuration,
      tools: {
        npm: !!analysis.dependencyAudit.npm,
        snyk: !!analysis.dependencyAudit.snyk && !analysis.dependencyAudit.snyk.error,
        eslint: !!analysis.codeAnalysis.eslint,
        typescript: !!analysis.codeAnalysis.typescript,
        zap: !!analysis.zapResults && !analysis.zapResults.error
      }
    };
  }

  /**
   * Save baseline to files
   */
  async saveBaseline(analysis) {
    console.log('💾 Saving security baseline...');
    
    // Ensure output directory exists
    await fs.mkdir(this.options.outputDir, { recursive: true });
    
    const baseline = {
      metadata: this.generateBaselineMetadata(analysis),
      vulnerabilities: analysis.vulnerabilities,
      fullAnalysis: this.options.includeAllFindings ? analysis : undefined
    };

    // Save main baseline file
    const baselinePath = path.join(this.options.outputDir, 'security-baseline.json');
    await fs.writeFile(baselinePath, JSON.stringify(baseline, null, 2));

    // Save human-readable summary
    const summaryPath = path.join(this.options.outputDir, 'security-baseline-summary.md');
    const summary = this.generateBaselineSummary(baseline);
    await fs.writeFile(summaryPath, summary);

    // Save vulnerability details
    const vulnPath = path.join(this.options.outputDir, 'vulnerability-details.json');
    await fs.writeFile(vulnPath, JSON.stringify(analysis.vulnerabilities, null, 2));

    console.log(`✅ Baseline saved:`);
    console.log(`   Main Baseline: ${baselinePath}`);
    console.log(`   Summary: ${summaryPath}`);
    console.log(`   Vulnerability Details: ${vulnPath}`);

    return {
      baselinePath,
      summaryPath, 
      vulnPath,
      baseline
    };
  }

  /**
   * Generate human-readable baseline summary
   */
  generateBaselineSummary(baseline) {
    let summary = `# Security Baseline Summary\n\n`;
    summary += `**Generated:** ${baseline.metadata.generatedAt}\n`;
    summary += `**Project Version:** ${baseline.metadata.projectVersion}\n`;
    summary += `**Git Commit:** ${baseline.metadata.gitCommit}\n\n`;

    summary += `## Overview\n\n`;
    summary += `- **Total Vulnerabilities:** ${baseline.metadata.totalVulnerabilities}\n`;
    summary += `- **Approved Exceptions:** ${baseline.metadata.approvedExceptions}\n\n`;

    summary += `## Severity Breakdown\n\n`;
    for (const [severity, count] of Object.entries(baseline.metadata.severityBreakdown)) {
      if (count > 0) {
        const emoji = {
          critical: '🚨',
          high: '⚠️',
          medium: '⚡',
          low: 'ℹ️'
        }[severity] || 'ℹ️';
        summary += `- ${emoji} **${severity.toUpperCase()}:** ${count}\n`;
      }
    }

    summary += `\n## Vulnerability Types\n\n`;
    for (const [type, count] of Object.entries(baseline.metadata.typeBreakdown)) {
      if (count > 0) {
        const description = {
          'dependency': 'Dependency vulnerabilities',
          'static-analysis': 'Static code analysis findings',
          'dast': 'Dynamic application security testing findings'
        }[type] || type;
        summary += `- **${description}:** ${count}\n`;
      }
    }

    summary += `\n## Tools Used\n\n`;
    for (const [tool, enabled] of Object.entries(baseline.metadata.tools)) {
      const status = enabled ? '✅' : '❌';
      summary += `- ${status} ${tool.toUpperCase()}\n`;
    }

    if (baseline.vulnerabilities.length > 0) {
      summary += `\n## Top Vulnerabilities\n\n`;
      const topVulns = baseline.vulnerabilities
        .filter(v => ['critical', 'high'].includes(v.severity))
        .slice(0, 10);
      
      for (const vuln of topVulns) {
        summary += `### ${vuln.title}\n`;
        summary += `- **Severity:** ${vuln.severity.toUpperCase()}\n`;
        summary += `- **Type:** ${vuln.type}\n`;
        summary += `- **Source:** ${vuln.source}\n`;
        if (vuln.approved) {
          summary += `- **Status:** ✅ Approved Exception\n`;
        }
        summary += `\n`;
      }
    }

    summary += `\n---\n`;
    summary += `*This baseline will be used for security regression testing.*\n`;

    return summary;
  }

  /**
   * Generate security baseline
   */
  async generateBaseline() {
    try {
      console.log('🔒 Generating Security Baseline for DCE Platform...');
      
      // Run comprehensive security analysis
      const analysis = await this.runSecurityAnalysis();
      
      // Save baseline
      const result = await this.saveBaseline(analysis);
      
      console.log(`🎉 Security baseline generated successfully!`);
      console.log(`   Vulnerabilities: ${analysis.vulnerabilities.length}`);
      console.log(`   Critical: ${analysis.vulnerabilities.filter(v => v.severity === 'critical').length}`);
      console.log(`   High: ${analysis.vulnerabilities.filter(v => v.severity === 'high').length}`);
      console.log(`   Medium: ${analysis.vulnerabilities.filter(v => v.severity === 'medium').length}`);
      console.log(`   Low: ${analysis.vulnerabilities.filter(v => v.severity === 'low').length}`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Baseline generation failed:', error.message);
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
    
    if (key === 'includeAllFindings') {
      options[key] = value === 'true';
    } else if (key === 'approvedVulnerabilities') {
      options[key] = value ? value.split(',') : [];
    } else {
      options[key] = value;
    }
  }

  const generator = new SecurityBaselineGenerator(options);
  
  try {
    await generator.generateBaseline();
    process.exit(0);
  } catch (error) {
    console.error('❌ Baseline generation failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { SecurityBaselineGenerator };