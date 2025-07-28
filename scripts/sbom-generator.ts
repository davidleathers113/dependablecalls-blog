#!/usr/bin/env tsx

/**
 * Software Bill of Materials (SBOM) Generator
 * 
 * Generates comprehensive SBOMs in multiple formats:
 * - CycloneDX (JSON/XML)
 * - SPDX (JSON/RDF) 
 * - SARIF for security analysis
 * - Custom DCE format for internal tracking
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

interface ComponentInfo {
  name: string;
  version: string;
  type: 'library' | 'framework' | 'application' | 'container' | 'file';
  scope: 'required' | 'optional' | 'excluded';
  author?: string;
  description?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  licenseText?: string;
  copyright?: string;
  purl?: string; // Package URL
  cpe?: string; // Common Platform Enumeration
  swid?: string; // Software Identification Tag
  hashes?: {
    md5?: string;
    sha1?: string;
    sha256?: string;
    sha512?: string;
  };
  externalReferences?: Array<{
    type: string;
    url: string;
    comment?: string;
  }>;
  vulnerabilities?: Array<{
    id: string;
    source: string;
    severity: string;
    cvss?: number;
    description?: string;
    recommendation?: string;
  }>;
  dependencies?: string[];
  modified?: boolean;
  publishedDate?: string;
  supplier?: {
    name: string;
    contact?: string;
    url?: string;
  };
}

interface SBOMMetadata {
  timestamp: string;
  toolName: string;
  toolVersion: string;
  component: {
    name: string;
    version: string;
    type: string;
  };
  serialNumber: string;
  licenses?: string[];
  properties?: Record<string, string>;
}

interface DCESBOMFormat {
  bomFormat: 'DCE-SBOM';
  specVersion: '1.0';
  serialNumber: string;
  version: number;
  metadata: SBOMMetadata;
  components: ComponentInfo[];
  dependencies: Array<{
    ref: string;
    dependsOn: string[];
  }>;
  vulnerabilities: Array<{
    bomRef: string;
    id: string;
    source: string;
    ratings: Array<{
      source: string;
      score: number;
      severity: string;
      method: string;
    }>;
    description: string;
    recommendation?: string;
    advisories?: Array<{
      id: string;
      title: string;
      url: string;
    }>;
  }>;
  externalReferences: Array<{
    type: string;
    url: string;
    comment?: string;
  }>;
  properties: Record<string, string>;
}

class SBOMGenerator {
  private packageJson: any;
  private packageLock: any;
  private outputDir: string;
  private metadata: SBOMMetadata;

  constructor() {
    this.outputDir = join(process.cwd(), 'sbom');
    this.packageJson = this.loadPackageJson();
    this.packageLock = this.loadPackageLock();
    this.metadata = this.generateMetadata();
    
    // Ensure output directory exists
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }

  private loadPackageJson(): any {
    try {
      return JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    } catch (error) {
      console.error('Failed to load package.json:', error);
      process.exit(1);
    }
  }

  private loadPackageLock(): any {
    try {
      return JSON.parse(readFileSync(join(process.cwd(), 'package-lock.json'), 'utf8'));
    } catch (error) {
      console.error('Failed to load package-lock.json:', error);
      process.exit(1);
    }
  }

  private generateMetadata(): SBOMMetadata {
    const timestamp = new Date().toISOString();
    const serialNumber = `urn:uuid:${this.generateUUID()}`;

    return {
      timestamp,
      toolName: 'DCE-SBOM-Generator',
      toolVersion: '1.0.0',
      component: {
        name: this.packageJson.name,
        version: this.packageJson.version,
        type: 'application'
      },
      serialNumber,
      properties: {
        'dce:scan-type': 'automated',
        'dce:environment': process.env.NODE_ENV || 'development',
        'dce:git-commit': this.getGitCommit(),
        'dce:build-timestamp': timestamp
      }
    };
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private getGitCommit(): string {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  async generateAllFormats(): Promise<void> {
    console.log('🔍 Generating comprehensive SBOM...\n');

    const components = await this.extractComponents();
    const vulnerabilities = await this.scanVulnerabilities(components);

    // Generate different SBOM formats
    await this.generateCycloneDX(components, vulnerabilities);
    await this.generateSPDX(components);
    await this.generateDCEFormat(components, vulnerabilities);
    await this.generateSARIF(vulnerabilities);
    await this.generateSummaryReport(components, vulnerabilities);

    console.log('\n✅ SBOM generation complete!');
    console.log(`📁 Output directory: ${this.outputDir}`);
  }

  private async extractComponents(): Promise<ComponentInfo[]> {
    console.log('📦 Extracting component information...');

    const components: ComponentInfo[] = [];
    const packages = this.packageLock.packages || {};

    // Add main application component
    components.push({
      name: this.packageJson.name,
      version: this.packageJson.version,
      type: 'application',
      scope: 'required',
      description: this.packageJson.description,
      homepage: this.packageJson.homepage,
      repository: this.packageJson.repository?.url,
      license: this.packageJson.license,
      author: this.packageJson.author
    });

    // Process all dependencies
    for (const [packagePath, packageInfo] of Object.entries(packages) as [string, any][]) {
      if (!packagePath || packagePath === '') continue;

      const componentName = packagePath.replace(/^(node_modules\/)+/, '');
      if (componentName.includes('/')) {
        // Skip nested dependencies for now, focus on direct ones
        continue;
      }

      const component = await this.createComponentInfo(componentName, packageInfo);
      if (component) {
        components.push(component);
      }
    }

    console.log(`  ✅ Extracted ${components.length} components`);
    return components;
  }

  private async createComponentInfo(name: string, packageInfo: any): Promise<ComponentInfo | null> {
    try {
      // Get detailed package information from npm registry
      let registryInfo: any = {};
      try {
        const registryData = execSync(`npm view ${name} --json`, { encoding: 'utf8' });
        registryInfo = JSON.parse(registryData);
      } catch {
        // Continue with available information
      }

      const component: ComponentInfo = {
        name,
        version: packageInfo.version,
        type: 'library',
        scope: this.packageJson.dependencies?.[name] ? 'required' : 'optional',
        description: registryInfo.description,
        homepage: registryInfo.homepage,
        repository: registryInfo.repository?.url,
        license: registryInfo.license,
        author: registryInfo.author?.name || registryInfo.maintainers?.[0]?.name,
        purl: `pkg:npm/${name}@${packageInfo.version}`,
        publishedDate: registryInfo.time?.[packageInfo.version],
        supplier: registryInfo.maintainers?.[0] ? {
          name: registryInfo.maintainers[0].name,
          contact: registryInfo.maintainers[0].email
        } : undefined
      };

      // Add hash information if available
      if (packageInfo.integrity) {
        component.hashes = this.parseIntegrity(packageInfo.integrity);
      }

      // Add external references
      component.externalReferences = [];
      if (registryInfo.homepage) {
        component.externalReferences.push({
          type: 'website',
          url: registryInfo.homepage
        });
      }
      if (registryInfo.repository?.url) {
        component.externalReferences.push({
          type: 'vcs',
          url: registryInfo.repository.url
        });
      }
      if (registryInfo.bugs?.url) {
        component.externalReferences.push({
          type: 'issue-tracker',
          url: registryInfo.bugs.url
        });
      }

      return component;
    } catch (error) {
      console.warn(`  ⚠️  Could not process component ${name}: ${error}`);
      return null;
    }
  }

  private parseIntegrity(integrity: string): { [key: string]: string } {
    const hashes: { [key: string]: string } = {};
    
    if (integrity.startsWith('sha1-')) {
      hashes.sha1 = integrity.substring(5);
    } else if (integrity.startsWith('sha256-')) {
      hashes.sha256 = integrity.substring(7);
    } else if (integrity.startsWith('sha512-')) {
      hashes.sha512 = integrity.substring(7);
    }
    
    return hashes;
  }

  private async scanVulnerabilities(components: ComponentInfo[]): Promise<any[]> {
    console.log('🔍 Scanning for vulnerabilities...');

    const vulnerabilities: any[] = [];

    try {
      // Run npm audit
      const auditOutput = execSync('npm audit --json', { encoding: 'utf8' });
      const auditResults = JSON.parse(auditOutput);

      if (auditResults.vulnerabilities) {
        for (const [packageName, vulnInfo] of Object.entries(auditResults.vulnerabilities) as [string, any][]) {
          vulnerabilities.push({
            bomRef: `pkg:npm/${packageName}`,
            id: vulnInfo.via?.[0]?.source || 'NPM-AUDIT',
            source: 'npm-audit',
            ratings: [{
              source: 'npm',
              severity: vulnInfo.severity,
              score: this.severityToScore(vulnInfo.severity),
              method: 'CVSSv3'
            }],
            description: vulnInfo.via?.[0]?.title || 'Security vulnerability detected',
            recommendation: vulnInfo.fixAvailable ? `Update to ${vulnInfo.fixAvailable.name}@${vulnInfo.fixAvailable.version}` : 'Review and patch manually'
          });
        }
      }
    } catch (error) {
      console.warn('  ⚠️  npm audit failed, continuing without vulnerability data');
    }

    // Add Snyk vulnerabilities if available
    try {
      if (process.env.SNYK_TOKEN) {
        execSync('npm install -g snyk@latest', { stdio: 'pipe' });
        execSync(`snyk auth ${process.env.SNYK_TOKEN}`, { stdio: 'pipe' });
        
        const snykOutput = execSync('snyk test --json', { encoding: 'utf8' });
        const snykResults = JSON.parse(snykOutput);

        if (snykResults.vulnerabilities) {
          snykResults.vulnerabilities.forEach((vuln: any) => {
            vulnerabilities.push({
              bomRef: `pkg:npm/${vuln.packageName}@${vuln.version}`,
              id: vuln.id,
              source: 'snyk',
              ratings: [{
                source: 'snyk',
                severity: vuln.severity,
                score: vuln.cvssScore || this.severityToScore(vuln.severity),
                method: 'CVSSv3'
              }],
              description: vuln.title,
              recommendation: vuln.upgradePath?.join(' -> ') || 'Review Snyk recommendations',
              advisories: vuln.identifiers?.CVE ? vuln.identifiers.CVE.map((cve: string) => ({
                id: cve,
                title: `CVE Reference: ${cve}`,
                url: `https://cve.mitre.org/cgi-bin/cvename.cgi?name=${cve}`
              })) : undefined
            });
          });
        }
      }
    } catch (error) {
      console.warn('  ⚠️  Snyk scan failed, continuing with npm audit data only');
    }

    console.log(`  ✅ Found ${vulnerabilities.length} vulnerabilities`);
    return vulnerabilities;
  }

  private severityToScore(severity: string): number {
    const scores: { [key: string]: number } = {
      'critical': 9.0,
      'high': 7.0,
      'medium': 5.0,
      'moderate': 5.0,
      'low': 3.0,
      'info': 1.0
    };
    return scores[severity.toLowerCase()] || 0.0;
  }

  private async generateCycloneDX(components: ComponentInfo[], vulnerabilities: any[]): Promise<void> {
    console.log('📄 Generating CycloneDX SBOM...');

    try {
      // Use official CycloneDX generator
      execSync('npx @cyclonedx/cyclonedx-npm --output ./sbom/cyclonedx.json --output-format json', { stdio: 'pipe' });
      execSync('npx @cyclonedx/cyclonedx-npm --output ./sbom/cyclonedx.xml --output-format xml', { stdio: 'pipe' });
      
      console.log('  ✅ CycloneDX SBOM generated (JSON and XML)');
    } catch (error) {
      console.warn('  ⚠️  CycloneDX generation failed, creating basic version');
      
      // Create basic CycloneDX format
      const cycloneDX = {
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        serialNumber: this.metadata.serialNumber,
        version: 1,
        metadata: {
          timestamp: this.metadata.timestamp,
          tools: [{
            vendor: 'DCE',
            name: this.metadata.toolName,
            version: this.metadata.toolVersion
          }],
          component: {
            type: 'application',
            name: this.packageJson.name,
            version: this.packageJson.version
          }
        },
        components: components.map(comp => ({
          type: comp.type,
          name: comp.name,
          version: comp.version,
          scope: comp.scope,
          description: comp.description,
          licenses: comp.license ? [{ license: { name: comp.license } }] : undefined,
          purl: comp.purl,
          externalReferences: comp.externalReferences
        })),
        vulnerabilities: vulnerabilities.map(vuln => ({
          id: vuln.id,
          source: { name: vuln.source },
          ratings: vuln.ratings,
          description: vuln.description,
          recommendation: vuln.recommendation,
          affects: [{ ref: vuln.bomRef }]
        }))
      };

      writeFileSync(join(this.outputDir, 'cyclonedx.json'), JSON.stringify(cycloneDX, null, 2));
      console.log('  ✅ Basic CycloneDX SBOM generated');
    }
  }

  private async generateSPDX(components: ComponentInfo[]): Promise<void> {
    console.log('📄 Generating SPDX SBOM...');

    const spdx = {
      spdxVersion: 'SPDX-2.3',
      dataLicense: 'CC0-1.0',
      SPDXID: 'SPDXRef-DOCUMENT',
      name: `${this.packageJson.name}-${this.packageJson.version}`,
      documentNamespace: `${this.metadata.serialNumber}`,
      creationInfo: {
        created: this.metadata.timestamp,
        creators: [`Tool: ${this.metadata.toolName}-${this.metadata.toolVersion}`]
      },
      packages: components.map((comp, index) => ({
        SPDXID: `SPDXRef-Package-${index}`,
        name: comp.name,
        versionInfo: comp.version,
        downloadLocation: comp.repository || 'NOASSERTION',
        filesAnalyzed: false,
        licenseConcluded: comp.license || 'NOASSERTION',
        licenseDeclared: comp.license || 'NOASSERTION',
        copyrightText: comp.copyright || 'NOASSERTION',
        supplier: comp.supplier ? `Person: ${comp.supplier.name}` : 'NOASSERTION',
        homepage: comp.homepage || 'NOASSERTION',
        description: comp.description || '',
        externalRefs: comp.externalReferences?.map(ref => ({
          referenceCategory: 'PACKAGE-MANAGER',
          referenceType: 'purl',
          referenceLocator: comp.purl
        })) || []
      })),
      relationships: components.slice(1).map((comp, index) => ({
        spdxElementId: 'SPDXRef-Package-0',
        relationshipType: 'DEPENDS_ON',
        relatedSpdxElement: `SPDXRef-Package-${index + 1}`
      }))
    };

    writeFileSync(join(this.outputDir, 'spdx.json'), JSON.stringify(spdx, null, 2));
    console.log('  ✅ SPDX SBOM generated');
  }

  private async generateDCEFormat(components: ComponentInfo[], vulnerabilities: any[]): Promise<void> {
    console.log('📄 Generating DCE Custom SBOM...');

    const dceSBOM: DCESBOMFormat = {
      bomFormat: 'DCE-SBOM',
      specVersion: '1.0',
      serialNumber: this.metadata.serialNumber,
      version: 1,
      metadata: this.metadata,
      components,
      dependencies: this.extractDependencyGraph(components),
      vulnerabilities,
      externalReferences: [
        {
          type: 'repository',
          url: this.packageJson.repository?.url || '',
          comment: 'Source code repository'
        },
        {
          type: 'website',
          url: this.packageJson.homepage || '',
          comment: 'Project homepage'
        }
      ],
      properties: {
        'dce:total-components': components.length.toString(),
        'dce:total-vulnerabilities': vulnerabilities.length.toString(),
        'dce:security-risk-score': this.calculateSecurityRiskScore(vulnerabilities).toString(),
        'dce:license-compliance': this.checkLicenseCompliance(components).toString(),
        'dce:supply-chain-risk': this.calculateSupplyChainRisk(components).toString()
      }
    };

    writeFileSync(join(this.outputDir, 'dce-sbom.json'), JSON.stringify(dceSBOM, null, 2));
    console.log('  ✅ DCE Custom SBOM generated');
  }

  private extractDependencyGraph(components: ComponentInfo[]): Array<{ ref: string; dependsOn: string[] }> {
    // Simplified dependency graph - in a real implementation,
    // this would parse the full dependency tree
    return components.map(comp => ({
      ref: comp.purl || comp.name,
      dependsOn: comp.dependencies || []
    }));
  }

  private calculateSecurityRiskScore(vulnerabilities: any[]): number {
    if (vulnerabilities.length === 0) return 0;

    const totalScore = vulnerabilities.reduce((sum, vuln) => {
      const rating = vuln.ratings?.[0];
      return sum + (rating?.score || 0);
    }, 0);

    return Math.round((totalScore / vulnerabilities.length) * 10) / 10;
  }

  private checkLicenseCompliance(components: ComponentInfo[]): boolean {
    const allowedLicenses = ['MIT', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause'];
    return components.every(comp => !comp.license || allowedLicenses.includes(comp.license));
  }

  private calculateSupplyChainRisk(components: ComponentInfo[]): number {
    let riskScore = 0;
    
    components.forEach(comp => {
      // Add risk for packages without repository info
      if (!comp.repository) riskScore += 1;
      
      // Add risk for packages with install scripts
      if (comp.name && this.packageLock.packages?.[`node_modules/${comp.name}`]?.hasInstallScript) {
        riskScore += 2;
      }
      
      // Add risk for recently published packages
      if (comp.publishedDate) {
        const publishDate = new Date(comp.publishedDate);
        const daysSincePublish = (Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSincePublish < 30) riskScore += 1;
      }
    });

    return Math.min(riskScore, 100);
  }

  private async generateSARIF(vulnerabilities: any[]): Promise<void> {
    console.log('📄 Generating SARIF security report...');

    const sarif = {
      version: '2.1.0',
      $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
      runs: [{
        tool: {
          driver: {
            name: this.metadata.toolName,
            version: this.metadata.toolVersion,
            informationUri: 'https://dependablecalls.com/security',
            rules: vulnerabilities.map((vuln, index) => ({
              id: vuln.id,
              shortDescription: { text: vuln.description },
              fullDescription: { text: vuln.description },
              properties: {
                'security-severity': vuln.ratings?.[0]?.severity || 'unknown'
              }
            }))
          }
        },
        results: vulnerabilities.map(vuln => ({
          ruleId: vuln.id,
          message: { text: vuln.description },
          level: this.severityToSarifLevel(vuln.ratings?.[0]?.severity),
          locations: [{
            physicalLocation: {
              artifactLocation: {
                uri: 'package.json'
              },
              region: {
                startLine: 1,
                startColumn: 1
              }
            }
          }],
          properties: {
            'bomRef': vuln.bomRef,
            'source': vuln.source,
            'recommendation': vuln.recommendation
          }
        }))
      }]
    };

    writeFileSync(join(this.outputDir, 'security.sarif'), JSON.stringify(sarif, null, 2));
    console.log('  ✅ SARIF security report generated');
  }

  private severityToSarifLevel(severity: string): string {
    const levels: { [key: string]: string } = {
      'critical': 'error',
      'high': 'error',
      'medium': 'warning',
      'moderate': 'warning',
      'low': 'note',
      'info': 'note'
    };
    return levels[severity?.toLowerCase()] || 'note';
  }

  private async generateSummaryReport(components: ComponentInfo[], vulnerabilities: any[]): Promise<void> {
    console.log('📄 Generating summary report...');

    const report = `# Software Bill of Materials (SBOM) Report

## Project Information
- **Name:** ${this.packageJson.name}
- **Version:** ${this.packageJson.version}
- **Generated:** ${this.metadata.timestamp}
- **Tool:** ${this.metadata.toolName} v${this.metadata.toolVersion}

## Component Summary
- **Total Components:** ${components.length}
- **Application Components:** ${components.filter(c => c.type === 'application').length}
- **Library Components:** ${components.filter(c => c.type === 'library').length}
- **Required Dependencies:** ${components.filter(c => c.scope === 'required').length}
- **Optional Dependencies:** ${components.filter(c => c.scope === 'optional').length}

## Security Summary
- **Total Vulnerabilities:** ${vulnerabilities.length}
- **Critical:** ${vulnerabilities.filter(v => v.ratings?.[0]?.severity === 'critical').length}
- **High:** ${vulnerabilities.filter(v => v.ratings?.[0]?.severity === 'high').length}
- **Medium:** ${vulnerabilities.filter(v => v.ratings?.[0]?.severity === 'medium').length}
- **Low:** ${vulnerabilities.filter(v => v.ratings?.[0]?.severity === 'low').length}

## License Summary
${this.generateLicenseSummary(components)}

## Generated Files
- \`cyclonedx.json\` - CycloneDX format SBOM (JSON)
- \`cyclonedx.xml\` - CycloneDX format SBOM (XML)
- \`spdx.json\` - SPDX format SBOM
- \`dce-sbom.json\` - DCE custom format SBOM
- \`security.sarif\` - SARIF security analysis
- \`summary.md\` - This summary report

## Recommendations
${this.generateRecommendations(components, vulnerabilities).map(rec => `- ${rec}`).join('\n')}

---
*Generated by DCE SBOM Generator*
`;

    writeFileSync(join(this.outputDir, 'summary.md'), report);
    console.log('  ✅ Summary report generated');
  }

  private generateLicenseSummary(components: ComponentInfo[]): string {
    const licenseCounts: { [key: string]: number } = {};
    
    components.forEach(comp => {
      const license = comp.license || 'Unknown';
      licenseCounts[license] = (licenseCounts[license] || 0) + 1;
    });

    return Object.entries(licenseCounts)
      .sort(([,a], [,b]) => b - a)
      .map(([license, count]) => `- **${license}:** ${count} components`)
      .join('\n');
  }

  private generateRecommendations(components: ComponentInfo[], vulnerabilities: any[]): string[] {
    const recommendations: string[] = [];

    if (vulnerabilities.length > 0) {
      recommendations.push('Address security vulnerabilities, prioritizing critical and high severity issues');
      recommendations.push('Enable automated vulnerability monitoring and alerts');
    }

    const unknownLicenses = components.filter(c => !c.license || c.license === 'Unknown').length;
    if (unknownLicenses > 0) {
      recommendations.push(`Review ${unknownLicenses} components with unknown licenses`);
    }

    const oldComponents = components.filter(c => {
      if (!c.publishedDate) return false;
      const publishDate = new Date(c.publishedDate);
      const monthsSincePublish = (Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      return monthsSincePublish > 24; // Older than 2 years
    }).length;

    if (oldComponents > 0) {
      recommendations.push(`Consider updating ${oldComponents} components that haven't been updated in over 2 years`);
    }

    recommendations.push('Regularly regenerate SBOM to track changes');
    recommendations.push('Integrate SBOM generation into CI/CD pipeline');
    recommendations.push('Share SBOM with security team and stakeholders');

    return recommendations;
  }
}

// Main execution
async function main() {
  try {
    const generator = new SBOMGenerator();
    await generator.generateAllFormats();
    
    console.log('\n🎉 SBOM generation completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ SBOM generation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { SBOMGenerator };