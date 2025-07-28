#!/usr/bin/env tsx

/**
 * Supply Chain Security Verification Script
 * 
 * This script performs comprehensive supply chain security checks including:
 * - Package integrity verification
 * - Malicious package detection
 * - Typosquatting analysis
 * - Dependency provenance tracking
 * - License compliance verification
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';

interface PackageInfo {
  name: string;
  version: string;
  integrity?: string;
  resolved?: string;
  hasInstallScript?: boolean;
  scripts?: Record<string, string>;
  maintainers?: Array<{ name: string; email: string }>;
  repository?: { type: string; url: string };
  license?: string;
  publishedDate?: string;
}

interface SecurityReport {
  timestamp: string;
  totalPackages: number;
  suspiciousPackages: PackageInfo[];
  integrityIssues: string[];
  licenseConflicts: string[];
  typosquattingRisks: string[];
  recommendations: string[];
  riskScore: number;
}

class SupplyChainSecurityChecker {
  private packageLock: any;
  private packageJson: any;
  private report: SecurityReport;
  
  constructor() {
    this.packageLock = this.loadPackageLock();
    this.packageJson = this.loadPackageJson();
    this.report = {
      timestamp: new Date().toISOString(),
      totalPackages: 0,
      suspiciousPackages: [],
      integrityIssues: [],
      licenseConflicts: [],
      typosquattingRisks: [],
      recommendations: [],
      riskScore: 0
    };
  }

  private loadPackageLock(): any {
    try {
      const lockPath = join(process.cwd(), 'package-lock.json');
      return JSON.parse(readFileSync(lockPath, 'utf8'));
    } catch (error) {
      console.error('Failed to load package-lock.json:', error);
      process.exit(1);
    }
  }

  private loadPackageJson(): any {
    try {
      const packagePath = join(process.cwd(), 'package.json');
      return JSON.parse(readFileSync(packagePath, 'utf8'));
    } catch (error) {
      console.error('Failed to load package.json:', error);
      process.exit(1);
    }
  }

  async runSecurityChecks(): Promise<SecurityReport> {
    console.log('🔍 Starting supply chain security verification...\n');

    // Get total package count
    this.report.totalPackages = Object.keys(this.packageLock.packages || {}).length;
    console.log(`📦 Analyzing ${this.report.totalPackages} packages\n`);

    // Run all security checks
    await this.checkPackageIntegrity();
    await this.detectSuspiciousPackages();
    await this.checkTyposquatting();
    await this.verifyLicenseCompliance();
    await this.analyzePackageProvenance();
    
    // Calculate risk score
    this.calculateRiskScore();
    
    // Generate recommendations
    this.generateRecommendations();
    
    return this.report;
  }

  private async checkPackageIntegrity(): Promise<void> {
    console.log('🔐 Checking package integrity...');

    try {
      // Verify npm signatures
      const auditSignatures = execSync('npm audit signatures --json', { encoding: 'utf8' });
      const signatureResults = JSON.parse(auditSignatures);
      
      if (signatureResults.invalid && signatureResults.invalid.length > 0) {
        this.report.integrityIssues.push(`Invalid signatures found for ${signatureResults.invalid.length} packages`);
        signatureResults.invalid.forEach((pkg: any) => {
          console.log(`  ⚠️  Invalid signature: ${pkg.name}@${pkg.version}`);
        });
      }
    } catch (error) {
      this.report.integrityIssues.push('Unable to verify package signatures');
      console.log('  ⚠️  Could not verify package signatures');
    }

    // Check for packages with modified checksums
    const packages = this.packageLock.packages || {};
    let integrityIssues = 0;

    Object.entries(packages).forEach(([path, info]: [string, any]) => {
      if (path && info.integrity) {
        // In a real implementation, you would verify the integrity hash
        // against the actual package content
        if (!info.resolved) {
          this.report.integrityIssues.push(`Missing resolved URL for ${path}`);
          integrityIssues++;
        }
      }
    });

    console.log(`  ✅ Integrity check complete (${integrityIssues} issues found)\n`);
  }

  private async detectSuspiciousPackages(): Promise<void> {
    console.log('🕵️  Detecting suspicious packages...');

    const packages = this.packageLock.packages || {};
    let suspiciousCount = 0;

    Object.entries(packages).forEach(([path, info]: [string, any]) => {
      if (!path || path === '') return;

      const packageName = path.replace(/^(node_modules\/)+/, '');
      const packageInfo: PackageInfo = {
        name: packageName,
        version: info.version,
        hasInstallScript: info.hasInstallScript,
        scripts: info.scripts
      };

      // Check for install scripts (potential security risk)
      if (info.hasInstallScript) {
        console.log(`  ⚠️  Install script detected: ${packageName}@${info.version}`);
        this.report.suspiciousPackages.push(packageInfo);
        suspiciousCount++;
      }

      // Check for suspicious script content
      if (info.scripts) {
        const dangerousCommands = ['eval', 'curl', 'wget', 'rm -rf', 'sudo', 'chmod +x'];
        Object.entries(info.scripts).forEach(([scriptName, command]: [string, any]) => {
          if (typeof command === 'string' && dangerousCommands.some(cmd => command.includes(cmd))) {
            console.log(`  🚨 Dangerous script in ${packageName}: ${scriptName}: ${command}`);
            this.report.suspiciousPackages.push({
              ...packageInfo,
              scripts: { [scriptName]: command }
            });
            suspiciousCount++;
          }
        });
      }
    });

    console.log(`  ✅ Suspicious package check complete (${suspiciousCount} flagged)\n`);
  }

  private async checkTyposquatting(): Promise<void> {
    console.log('🎯 Checking for typosquatting risks...');

    const popularPackages = [
      'react', 'react-dom', 'react-router-dom', 'react-hook-form',
      'axios', 'lodash', 'moment', 'express', 'typescript',
      'vite', 'webpack', 'babel', 'eslint', 'prettier',
      'stripe', 'supabase', 'zustand', 'tailwindcss'
    ];

    const allDependencies = {
      ...this.packageJson.dependencies,
      ...this.packageJson.devDependencies
    };

    let typosquattingRisks = 0;

    Object.keys(allDependencies).forEach(packageName => {
      popularPackages.forEach(popularPkg => {
        // Check for common typosquatting patterns
        if (packageName !== popularPkg && this.isTyposquattingRisk(packageName, popularPkg)) {
          const risk = `Potential typosquatting: "${packageName}" vs "${popularPkg}"`;
          console.log(`  ⚠️  ${risk}`);
          this.report.typosquattingRisks.push(risk);
          typosquattingRisks++;
        }
      });
    });

    console.log(`  ✅ Typosquatting check complete (${typosquattingRisks} risks found)\n`);
  }

  private isTyposquattingRisk(packageName: string, popularPackage: string): boolean {
    const name = packageName.toLowerCase();
    const popular = popularPackage.toLowerCase();
    
    // Check for character substitution
    if (this.levenshteinDistance(name, popular) === 1) return true;
    
    // Check for character addition/removal
    if (Math.abs(name.length - popular.length) === 1 && name.includes(popular.slice(0, -1))) return true;
    
    // Check for common substitutions
    const commonSubs = [
      ['0', 'o'], ['1', 'l'], ['1', 'i'], ['3', 'e'], ['5', 's'],
      ['-', '_'], ['a', '@'], ['e', '3'], ['i', '1'], ['o', '0']
    ];
    
    for (const [char1, char2] of commonSubs) {
      const substituted = popular.replace(new RegExp(char1, 'g'), char2);
      if (name === substituted) return true;
    }
    
    return false;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  private async verifyLicenseCompliance(): Promise<void> {
    console.log('📜 Verifying license compliance...');

    try {
      const licenseCheck = execSync('npx license-checker --json', { encoding: 'utf8' });
      const licenses = JSON.parse(licenseCheck);

      const disallowedLicenses = ['GPL-2.0', 'GPL-3.0', 'AGPL-1.0', 'AGPL-3.0', 'LGPL-2.0', 'LGPL-2.1', 'LGPL-3.0'];
      let conflictCount = 0;

      Object.entries(licenses).forEach(([packageName, info]: [string, any]) => {
        if (info.licenses) {
          const license = Array.isArray(info.licenses) ? info.licenses.join(', ') : info.licenses;
          if (disallowedLicenses.some(disallowed => license.includes(disallowed))) {
            const conflict = `License conflict: ${packageName} uses ${license}`;
            console.log(`  ⚠️  ${conflict}`);
            this.report.licenseConflicts.push(conflict);
            conflictCount++;
          }
        }
      });

      console.log(`  ✅ License compliance check complete (${conflictCount} conflicts found)\n`);
    } catch (error) {
      console.log('  ⚠️  Could not verify license compliance\n');
      this.report.licenseConflicts.push('Unable to verify license compliance');
    }
  }

  private async analyzePackageProvenance(): Promise<void> {
    console.log('🔍 Analyzing package provenance...');

    const directDependencies = Object.keys(this.packageJson.dependencies || {});
    let provenanceIssues = 0;

    for (const packageName of directDependencies.slice(0, 10)) { // Limit to first 10 for demo
      try {
        const packageInfo = execSync(`npm view ${packageName} --json`, { encoding: 'utf8' });
        const info = JSON.parse(packageInfo);

        // Check package age and maintainer count
        const publishedDate = new Date(info.time?.created || info.time?.modified);
        const daysSincePublish = (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSincePublish < 30) {
          console.log(`  ⚠️  Recent package: ${packageName} published ${Math.floor(daysSincePublish)} days ago`);
          provenanceIssues++;
        }

        if (!info.maintainers || info.maintainers.length === 0) {
          console.log(`  ⚠️  No maintainers: ${packageName}`);
          provenanceIssues++;
        }

        // Check for repository information
        if (!info.repository) {
          console.log(`  ⚠️  No repository info: ${packageName}`);
          provenanceIssues++;
        }

      } catch (error) {
        console.log(`  ⚠️  Could not analyze ${packageName}`);
        provenanceIssues++;
      }
    }

    console.log(`  ✅ Provenance analysis complete (${provenanceIssues} issues found)\n`);
  }

  private calculateRiskScore(): void {
    let score = 0;

    // Weight different risk factors
    score += this.report.suspiciousPackages.length * 10;
    score += this.report.integrityIssues.length * 8;
    score += this.report.typosquattingRisks.length * 6;
    score += this.report.licenseConflicts.length * 4;

    // Normalize to 0-100 scale
    this.report.riskScore = Math.min(score, 100);
  }

  private generateRecommendations(): void {
    const recommendations = [];

    if (this.report.suspiciousPackages.length > 0) {
      recommendations.push('Review packages with install scripts and remove unnecessary ones');
      recommendations.push('Consider using .npmrc to disable install scripts globally');
    }

    if (this.report.integrityIssues.length > 0) {
      recommendations.push('Investigate packages with integrity issues');
      recommendations.push('Enable npm signature verification in CI/CD');
    }

    if (this.report.typosquattingRisks.length > 0) {
      recommendations.push('Review flagged packages for typosquatting');
      recommendations.push('Use exact version pinning for critical dependencies');
    }

    if (this.report.licenseConflicts.length > 0) {
      recommendations.push('Resolve license conflicts or replace conflicting packages');
      recommendations.push('Implement automated license scanning in CI/CD');
    }

    recommendations.push('Run supply chain security checks regularly');
    recommendations.push('Enable dependency update automation with security testing');
    recommendations.push('Monitor security advisories for your dependencies');

    this.report.recommendations = recommendations;
  }

  saveReport(): void {
    const reportPath = join(process.cwd(), 'supply-chain-security-report.json');
    writeFileSync(reportPath, JSON.stringify(this.report, null, 2));
    console.log(`📊 Security report saved to: ${reportPath}`);
  }

  printSummary(): void {
    console.log('\n🔒 SUPPLY CHAIN SECURITY SUMMARY');
    console.log('=====================================');
    console.log(`📦 Total packages analyzed: ${this.report.totalPackages}`);
    console.log(`🚨 Suspicious packages: ${this.report.suspiciousPackages.length}`);
    console.log(`🔐 Integrity issues: ${this.report.integrityIssues.length}`);
    console.log(`🎯 Typosquatting risks: ${this.report.typosquattingRisks.length}`);
    console.log(`📜 License conflicts: ${this.report.licenseConflicts.length}`);
    console.log(`⚠️  Overall risk score: ${this.report.riskScore}/100`);
    
    if (this.report.riskScore > 50) {
      console.log('\n🚨 HIGH RISK: Immediate action required!');
    } else if (this.report.riskScore > 20) {
      console.log('\n⚠️  MODERATE RISK: Review and address issues');
    } else {
      console.log('\n✅ LOW RISK: Good supply chain security posture');
    }

    if (this.report.recommendations.length > 0) {
      console.log('\n📋 RECOMMENDATIONS:');
      this.report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }
  }
}

// Main execution
async function main() {
  try {
    const checker = new SupplyChainSecurityChecker();
    await checker.runSecurityChecks();
    checker.saveReport();
    checker.printSummary();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Supply chain security check failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { SupplyChainSecurityChecker };