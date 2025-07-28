# Security Testing Framework - Quick Reference

## 🚀 Quick Start

```bash
# Run all security tests
npm run security:full

# Generate security report
node scripts/security/generate-security-report.js

# Check security gates
node scripts/security/security-gate-evaluator.js
```

## 📊 Key Commands

### Security Testing
| Command | Description |
|---------|-------------|
| `npm run security:test` | Run security unit tests |
| `npm run security:audit` | Dependency security audit |
| `npm run security:scan` | Full security scan (SAST + deps) |
| `npm run security:full` | Complete security testing suite |

### OWASP ZAP Scanning
| Command | Description |
|---------|-------------|
| `node scripts/security/run-zap-scan.js --scanType quick` | Quick DAST scan (10 min) |
| `node scripts/security/run-zap-scan.js --scanType standard` | Standard DAST scan (30 min) |
| `node scripts/security/run-zap-scan.js --scanType comprehensive` | Full DAST scan (60+ min) |

### Regression Testing
| Command | Description |
|---------|-------------|
| `node scripts/security/security-regression-test.js` | Run regression analysis |
| `node scripts/security/generate-security-baseline.js` | Create new security baseline |

### Reporting & Monitoring
| Command | Description |
|---------|-------------|
| `node scripts/security/generate-security-report.js` | Generate comprehensive report |
| `node scripts/security/update-security-monitoring.js` | Update monitoring dashboard |

## 🚪 Security Gates

| Gate | Threshold | Blocking | Environment Override |
|------|-----------|----------|---------------------|
| **Critical Vulnerabilities** | 0 | ✅ Yes | Production: 0, Dev: Non-blocking |
| **High Vulnerabilities** | ≤5 | ✅ Yes | Production: 0, Dev: ≤10 |
| **Medium Vulnerabilities** | ≤20 | ❌ No | Production: ≤5 |
| **Test Coverage** | ≥80% | ✅ Yes | All environments |
| **Security Regressions** | 0 | ✅ Yes | All environments |
| **PCI Compliance** | ≥90 | ✅ Yes | Production only |

## 🔍 Security Test Coverage

### ✅ Enabled Tests
- **SAST (CodeQL):** Static code analysis with custom DCE queries
- **DAST (OWASP ZAP):** Dynamic application security testing
- **Dependency Audit:** npm audit + Snyk scanning
- **Container Security:** Trivy vulnerability scanning
- **Unit Security Tests:** Custom security test suites
- **Regression Testing:** Automated regression detection

### 📈 Coverage Score Calculation
```
Coverage = (Available Tests / Total Tests) × 100%
Total Tests: 6 (SAST, DAST, Deps, Container, Unit, Regression)
Target: ≥80% (5/6 tests minimum)
```

## 🚨 Alert Severity Levels

| Severity | Response Time | Action Required |
|----------|---------------|-----------------|
| **Critical** | Immediate | Block deployment, fix immediately |
| **High** | 24-48 hours | High priority remediation |
| **Medium** | 1-2 weeks | Planned remediation |
| **Low** | 1 month | Backlog remediation |

## 📋 Vulnerability Categories

### Payment Security (PCI DSS)
- Payment amount manipulation
- Stripe key exposure
- Transaction integrity
- Card data protection

### Authentication & Authorization
- Password security
- JWT validation
- Session management
- Role-based access
- MFA implementation

### Input Validation
- XSS prevention
- SQL injection prevention
- Command injection prevention
- File upload security

### API Security
- Rate limiting
- CORS configuration
- Input validation
- Authentication bypass

## 📊 Security Score Breakdown

```
Base Score: 100 points

Deductions:
- Critical vulnerabilities: -20 points each
- High vulnerabilities: -10 points each
- Medium vulnerabilities: -5 points each
- Security regressions: -15 points each
- Security gate failures: -25 points
- Low test coverage: -0.5 points per % below 80%

Score Interpretation:
90-100: Excellent (✅ Deploy approved)
75-89:  Good (⚠️ Monitor closely)
60-74:  Moderate (⚠️ Action needed)
40-59:  Poor (🚫 Fix required)
0-39:   Critical (🚫 Deployment blocked)
```

## 🔧 Configuration Files

| File | Purpose |
|------|---------|
| `.github/workflows/security-pipeline.yml` | CI/CD security pipeline |
| `.github/codeql/codeql-config.yml` | CodeQL SAST configuration |
| `tests/security/zap-config.conf` | OWASP ZAP DAST configuration |
| `tests/security/security-config.js` | General security test config |
| `security-baseline/security-baseline.json` | Security regression baseline |

## 🎯 OWASP Top 10 Coverage

| OWASP Category | Tests |
|----------------|-------|
| **A01: Broken Access Control** | DAST, Custom CodeQL queries |
| **A02: Cryptographic Failures** | SAST, Code review |
| **A03: Injection** | DAST, SAST, Unit tests |
| **A04: Insecure Design** | Manual review, Business logic tests |
| **A05: Security Misconfiguration** | DAST, Container scan |
| **A06: Vulnerable Components** | Dependency audit, Snyk |
| **A07: Authentication Failures** | DAST, Custom queries, Unit tests |
| **A08: Data Integrity Failures** | SAST, Supply chain security |
| **A09: Logging/Monitoring Failures** | Manual review, Monitoring tests |
| **A10: SSRF** | DAST, Custom CodeQL queries |

## 🚨 Common Issues & Solutions

### OWASP ZAP Scan Failures
```bash
# Check application is running
curl http://localhost:5173

# Verify ZAP can access application
docker run --rm --network host owasp/zap2docker-stable:latest \
  zap-baseline.py -t http://localhost:5173
```

### Security Gate Failures
```bash
# Check gate results
cat security-gate-result.json | jq '.violations'

# View detailed security report
open security-report/security-report-latest.html
```

### Regression Test Issues
```bash
# Reset security baseline
node scripts/security/generate-security-baseline.js --reset

# Run with verbose output
node scripts/security/security-regression-test.js --verbose
```

### Missing Dependencies
```bash
# Install security testing dependencies
npm install --save-dev @owasp/nodejs-owasp-zap snyk

# Update security tools
npm update snyk @cyclonedx/cyclonedx-npm
```

## 📈 CI/CD Integration

### GitHub Actions Triggers
- **Pull Requests:** Automated security validation
- **Main Branch:** Full security testing + deployment gates
- **Daily Schedule:** Comprehensive security scan (2 AM UTC)
- **Manual Dispatch:** On-demand security testing

### Environment Variables
```bash
SECURITY_THRESHOLD_HIGH=0
SECURITY_THRESHOLD_MEDIUM=5
SNYK_TOKEN=your-snyk-token
SECURITY_MONITORING_WEBHOOK=your-webhook-url
```

### Workflow Outputs
- Security test results artifacts
- HTML/JSON/Markdown reports
- SARIF files for GitHub Security tab
- PR comment summaries

## 🔗 Quick Links

- **Security Dashboard:** `security-report/security-report-latest.html`
- **Gate Results:** `security-gate-result.json`
- **Monitoring Status:** `security-monitoring/latest-security-status.json`
- **Baseline:** `security-baseline/security-baseline.json`
- **CI Pipeline:** `.github/workflows/security-pipeline.yml`

## 📞 Support

For security testing issues:
1. Check this quick reference
2. Review detailed documentation: `docs/security/SECURITY_TESTING_FRAMEWORK.md`
3. Examine security test logs in CI/CD pipeline
4. Create issue with security test results attached

---
*Last updated: Phase 4.11 Implementation*