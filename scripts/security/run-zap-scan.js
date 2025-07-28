#!/usr/bin/env node

/**
 * OWASP ZAP Security Scanning Script for DCE Platform
 * 
 * This script orchestrates comprehensive security testing using OWASP ZAP
 * with DCE-specific configurations and authentication handling.
 */

const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

class ZAPSecurityScanner {
  constructor(options = {}) {
    this.options = {
      zapPort: options.zapPort || 8080,
      targetUrl: options.targetUrl || 'http://localhost:5173',
      apiUrl: options.apiUrl || 'http://localhost:3000',
      scanType: options.scanType || 'standard',
      outputDir: options.outputDir || './tests/security',
      timeout: options.timeout || 3600000, // 1 hour
      ...options
    };
    
    this.zapApiUrl = `http://localhost:${this.options.zapPort}`;
    this.scanResults = {};
    this.vulnerabilities = [];
  }

  /**
   * Start OWASP ZAP daemon
   */
  async startZAP() {
    console.log('🚀 Starting OWASP ZAP daemon...');
    
    return new Promise((resolve, reject) => {
      const zapProcess = spawn('zap.sh', [
        '-daemon',
        '-port', this.options.zapPort.toString(),
        '-config', 'api.addrs.addr.name=.*',
        '-config', 'api.addrs.addr.regex=true',
        '-config', 'api.key=dce-security-test-key'
      ], {
        stdio: 'pipe',
        detached: false
      });

      zapProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`ZAP stdout: ${output}`);
        if (output.includes('ZAP is now listening')) {
          resolve(zapProcess);
        }
      });

      zapProcess.stderr.on('data', (data) => {
        console.log(`ZAP stderr: ${data}`);
      });

      zapProcess.on('error', reject);
      
      // Timeout after 60 seconds
      setTimeout(() => {
        reject(new Error('ZAP startup timeout'));
      }, 60000);
    });
  }

  /**
   * Configure ZAP with DCE-specific settings
   */
  async configureZAP() {
    console.log('⚙️ Configuring OWASP ZAP for DCE platform...');
    
    const zapApi = axios.create({
      baseURL: this.zapApiUrl,
      timeout: 30000
    });

    try {
      // Create context for DCE application
      await zapApi.get('/JSON/context/action/newContext/', {
        params: {
          apikey: 'dce-security-test-key',
          contextName: 'DCE-Security-Context'
        }
      });

      // Include URLs in context
      const includeUrls = [
        this.options.targetUrl + '.*',
        this.options.apiUrl + '/api.*'
      ];

      for (const url of includeUrls) {
        await zapApi.get('/JSON/context/action/includeInContext/', {
          params: {
            apikey: 'dce-security-test-key',
            contextName: 'DCE-Security-Context',
            regex: url
          }
        });
      }

      // Exclude static resources
      const excludeUrls = [
        '.*\\.css',
        '.*\\.js',
        '.*\\.png',
        '.*\\.jpg',
        '.*\\.gif',
        '.*\\.svg',
        '.*/static/.*',
        '.*/assets/.*'
      ];

      for (const url of excludeUrls) {
        await zapApi.get('/JSON/context/action/excludeFromContext/', {
          params: {
            apikey: 'dce-security-test-key',
            contextName: 'DCE-Security-Context',
            regex: url
          }
        });
      }

      // Configure authentication
      await this.configureAuthentication(zapApi);
      
      console.log('✅ ZAP configuration completed');
    } catch (error) {
      console.error('❌ ZAP configuration failed:', error.message);
      throw error;
    }
  }

  /**
   * Configure authentication for different user roles
   */
  async configureAuthentication(zapApi) {
    console.log('🔐 Configuring authentication...');

    // Set authentication method to form-based
    await zapApi.get('/JSON/authentication/action/setAuthenticationMethod/', {
      params: {
        apikey: 'dce-security-test-key',
        contextId: '0',
        authMethodName: 'formBasedAuthentication',
        authMethodConfigParams: 'loginUrl=' + this.options.targetUrl + '/login&loginRequestData=email%3D%7B%25username%25%7D%26password%3D%7B%25password%25%7D'
      }
    });

    // Set logged in/out indicators
    await zapApi.get('/JSON/authentication/action/setLoggedInIndicator/', {
      params: {
        apikey: 'dce-security-test-key',
        contextId: '0',
        loggedInIndicatorRegex: '\\Q"authenticated"\\E.*\\Qtrue\\E'
      }
    });

    await zapApi.get('/JSON/authentication/action/setLoggedOutIndicator/', {
      params: {
        apikey: 'dce-security-test-key',
        contextId: '0',  
        loggedOutIndicatorRegex: '\\Q"authenticated"\\E.*\\Qfalse\\E'
      }
    });

    // Create test users for different roles
    const testUsers = [
      {
        name: 'buyer-user',
        credentials: 'security.test.buyer@example.com:SecureTestPass123!'
      },
      {
        name: 'supplier-user', 
        credentials: 'security.test.supplier@example.com:SecureTestPass123!'
      },
      {
        name: 'network-user',
        credentials: 'security.test.network@example.com:SecureTestPass123!'
      },
      {
        name: 'admin-user',
        credentials: 'security.test.admin@example.com:SecureTestPass123!'
      }
    ];

    for (const user of testUsers) {
      await zapApi.get('/JSON/users/action/newUser/', {
        params: {
          apikey: 'dce-security-test-key',
          contextId: '0',
          name: user.name
        }
      });

      await zapApi.get('/JSON/users/action/setUserCredentials/', {
        params: {
          apikey: 'dce-security-test-key',
          contextId: '0',
          userId: user.name,
          credentials: user.credentials
        }
      });

      await zapApi.get('/JSON/users/action/setUserEnabled/', {
        params: {
          apikey: 'dce-security-test-key',
          contextId: '0',
          userId: user.name,
          enabled: 'true'
        }
      });
    }
  }

  /**
   * Run spider scan
   */
  async runSpiderScan() {
    console.log('🕷️ Running spider scan...');
    
    const zapApi = axios.create({
      baseURL: this.zapApiUrl,
      timeout: 30000
    });

    try {
      // Start spider scan
      const spiderResponse = await zapApi.get('/JSON/spider/action/scan/', {
        params: {
          apikey: 'dce-security-test-key',
          url: this.options.targetUrl,
          maxChildren: '20',
          recurse: 'true',
          contextName: 'DCE-Security-Context'
        }
      });

      const scanId = spiderResponse.data.scan;
      console.log(`Spider scan started with ID: ${scanId}`);

      // Wait for spider scan to complete
      let progress = 0;
      while (progress < 100) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const statusResponse = await zapApi.get('/JSON/spider/view/status/', {
          params: {
            apikey: 'dce-security-test-key',
            scanId: scanId
          }
        });

        progress = parseInt(statusResponse.data.status);
        console.log(`Spider scan progress: ${progress}%`);
      }

      // Get spider results
      const resultsResponse = await zapApi.get('/JSON/spider/view/results/', {
        params: {
          apikey: 'dce-security-test-key',
          scanId: scanId
        }
      });

      this.scanResults.spider = resultsResponse.data;
      console.log(`✅ Spider scan completed. Found ${resultsResponse.data.results.length} URLs`);
      
    } catch (error) {
      console.error('❌ Spider scan failed:', error.message);
      throw error;
    }
  }

  /**
   * Run active security scan
   */
  async runActiveScan() {
    console.log('🔍 Running active security scan...');
    
    const zapApi = axios.create({
      baseURL: this.zapApiUrl,
      timeout: 30000
    });

    try {
      // Configure scan policy based on scan type
      const scanPolicy = this.getScanPolicy();
      
      // Start active scan
      const scanResponse = await zapApi.get('/JSON/ascan/action/scan/', {
        params: {
          apikey: 'dce-security-test-key',
          url: this.options.targetUrl,
          recurse: 'true',
          inScopeOnly: 'true',
          scanPolicyName: scanPolicy,
          method: 'POST',
          postData: ''
        }
      });

      const scanId = scanResponse.data.scan;
      console.log(`Active scan started with ID: ${scanId}`);

      // Wait for active scan to complete
      let progress = 0;
      while (progress < 100) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        const statusResponse = await zapApi.get('/JSON/ascan/view/status/', {
          params: {
            apikey: 'dce-security-test-key',
            scanId: scanId
          }
        });

        progress = parseInt(statusResponse.data.status);
        console.log(`Active scan progress: ${progress}%`);
      }

      console.log('✅ Active scan completed');
      
    } catch (error) {
      console.error('❌ Active scan failed:', error.message);
      throw error;
    }
  }

  /**
   * Get scan policy based on scan type
   */
  getScanPolicy() {
    const policies = {
      quick: 'Light',
      standard: 'Medium',
      comprehensive: 'High'
    };
    
    return policies[this.options.scanType] || 'Medium';
  }

  /**
   * Generate comprehensive security report
   */
  async generateReport() {
    console.log('📊 Generating security report...');
    
    const zapApi = axios.create({
      baseURL: this.zapApiUrl,
      timeout: 30000
    });

    try {
      // Get alerts (vulnerabilities)
      const alertsResponse = await zapApi.get('/JSON/core/view/alerts/', {
        params: {
          apikey: 'dce-security-test-key',
          baseurl: this.options.targetUrl
        }
      });

      this.vulnerabilities = alertsResponse.data.alerts;

      // Generate HTML report
      const htmlReportResponse = await zapApi.get('/OTHER/core/other/htmlreport/', {
        params: {
          apikey: 'dce-security-test-key'
        }
      });

      // Generate JSON report
      const jsonReportResponse = await zapApi.get('/JSON/core/view/alerts/', {
        params: {
          apikey: 'dce-security-test-key'
        }
      });

      // Save reports
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const htmlReportPath = path.join(this.options.outputDir, `zap-security-report-${timestamp}.html`);
      const jsonReportPath = path.join(this.options.outputDir, `zap-security-report-${timestamp}.json`);

      await fs.writeFile(htmlReportPath, htmlReportResponse.data);
      await fs.writeFile(jsonReportPath, JSON.stringify(jsonReportResponse.data, null, 2));

      // Generate summary report
      const summary = await this.generateSummaryReport();
      const summaryPath = path.join(this.options.outputDir, `zap-security-summary-${timestamp}.json`);
      await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

      console.log(`✅ Reports generated:`);
      console.log(`   HTML Report: ${htmlReportPath}`);
      console.log(`   JSON Report: ${jsonReportPath}`);
      console.log(`   Summary: ${summaryPath}`);

      return {
        htmlReport: htmlReportPath,
        jsonReport: jsonReportPath,
        summary: summaryPath,
        vulnerabilities: this.vulnerabilities
      };

    } catch (error) {
      console.error('❌ Report generation failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate security summary report
   */
  async generateSummaryReport() {
    const summary = {
      timestamp: new Date().toISOString(),
      scanType: this.options.scanType,
      targetUrl: this.options.targetUrl,
      totalVulnerabilities: this.vulnerabilities.length,
      severityBreakdown: {
        high: 0,
        medium: 0,
        low: 0,
        informational: 0
      },
      categories: {},
      passedThresholds: false,
      recommendations: []
    };

    // Analyze vulnerabilities
    for (const vuln of this.vulnerabilities) {
      const risk = vuln.risk.toLowerCase();
      if (summary.severityBreakdown[risk] !== undefined) {
        summary.severityBreakdown[risk]++;
      }

      const category = vuln.alert || 'Unknown';
      summary.categories[category] = (summary.categories[category] || 0) + 1;
    }

    // Check against security thresholds
    summary.passedThresholds = 
      summary.severityBreakdown.high <= 0 &&
      summary.severityBreakdown.medium <= 5 &&
      summary.severityBreakdown.low <= 20;

    // Generate recommendations
    if (summary.severityBreakdown.high > 0) {
      summary.recommendations.push('CRITICAL: Address all high-severity vulnerabilities immediately');
    }
    
    if (summary.severityBreakdown.medium > 5) {
      summary.recommendations.push('WARNING: Medium-severity vulnerabilities exceed threshold (5)');
    }
    
    if (summary.severityBreakdown.low > 20) {
      summary.recommendations.push('INFO: Low-severity vulnerabilities exceed threshold (20)');
    }

    if (summary.passedThresholds) {
      summary.recommendations.push('✅ All security thresholds passed');
    }

    return summary;
  }

  /**
   * Stop ZAP daemon
   */
  async stopZAP() {
    console.log('🛑 Stopping OWASP ZAP daemon...');
    
    try {
      const zapApi = axios.create({
        baseURL: this.zapApiUrl,
        timeout: 10000
      });

      await zapApi.get('/JSON/core/action/shutdown/', {
        params: {
          apikey: 'dce-security-test-key'
        }
      });

      console.log('✅ ZAP daemon stopped');
    } catch (error) {
      console.log('ℹ️ ZAP daemon may have already stopped');
    }
  }

  /**
   * Run complete security scan
   */
  async runSecurityScan() {
    let zapProcess;
    
    try {
      console.log('🔒 Starting DCE Platform Security Scan...');
      console.log(`   Scan Type: ${this.options.scanType}`);
      console.log(`   Target URL: ${this.options.targetUrl}`);
      console.log(`   Output Directory: ${this.options.outputDir}`);

      // Start ZAP
      zapProcess = await this.startZAP();
      
      // Wait for ZAP to be ready
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Configure ZAP
      await this.configureZAP();
      
      // Run spider scan
      await this.runSpiderScan();
      
      // Run active scan
      await this.runActiveScan();
      
      // Generate reports
      const reports = await this.generateReport();
      
      console.log('🎉 Security scan completed successfully!');
      return reports;
      
    } catch (error) {
      console.error('❌ Security scan failed:', error.message);
      throw error;
    } finally {
      // Always try to stop ZAP
      await this.stopZAP();
      
      if (zapProcess) {
        zapProcess.kill();
      }
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

  const scanner = new ZAPSecurityScanner(options);
  
  try {
    const results = await scanner.runSecurityScan();
    
    // Exit with error if security thresholds not met
    if (!results.summary.passedThresholds) {
      console.error('❌ Security scan failed - thresholds not met');
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Security scan failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { ZAPSecurityScanner };