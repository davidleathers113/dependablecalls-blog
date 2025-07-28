# DCE Platform Security Testing Framework

## Overview

The DCE Platform Security Testing Framework provides comprehensive security validation through automated testing, continuous monitoring, and deployment gates. This framework ensures the security posture of the platform through multiple layers of security testing integrated into the CI/CD pipeline.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Security Testing Framework                   │
├─────────────────────────────────────────────────────────────────┤
│  CI/CD Pipeline                                                 │
│  ├── Pre-commit Security Validation                             │
│  ├── Static Analysis (SAST) - CodeQL                           │
│  ├── Dynamic Analysis (DAST) - OWASP ZAP                       │
│  ├── Dependency Security Audit                                 │
│  ├── Container Security Scanning                               │
│  ├── Security Unit Tests                                       │
│  ├── Security Regression Testing                               │
│  └── Security Gate Evaluation                                  │
├─────────────────────────────────────────────────────────────────┤
│  Reporting & Monitoring                                         │
│  ├── Comprehensive Security Reports                            │
│  ├── Security Metrics Dashboard                                │
│  ├── Continuous Monitoring                                     │
│  ├── Alert Management                                          │
│  └── Compliance Tracking                                       │
├─────────────────────────────────────────────────────────────────┤
│  Security Gates                                                 │
│  ├── Critical Vulnerability Gate (0 allowed)                   │
│  ├── High Severity Gate (≤5 allowed)                          │
│  ├── Test Coverage Gate (≥80% required)                       │
│  ├── Regression Prevention Gate                                │
│  └── Compliance Gates (OWASP, PCI DSS)                        │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. CI/CD Security Pipeline

**Location:** `.github/workflows/security-pipeline.yml`

The automated security pipeline runs on:
- All pull requests
- Main branch pushes
- Daily scheduled scans
- Manual workflow dispatch

**Key Features:**
- Parallel execution of security tests
- Environment-specific configurations
- Automated security gate evaluation
- Comprehensive reporting
- Integration with GitHub Security tab

### 2. Static Application Security Testing (SAST)

**Tool:** GitHub CodeQL  
**Configuration:** `.github/codeql/codeql-config.yml`  
**Custom Queries:** `.github/codeql/custom-queries/`

**Capabilities:**
- Custom security queries for DCE-specific patterns
- Payment security vulnerability detection
- Authentication/authorization issue detection
- Comprehensive code analysis across TypeScript/JavaScript

**Custom Query Examples:**
```typescript
// Payment amount manipulation detection
class PaymentAmountManipulation extends DataFlow::Node {
  PaymentAmountManipulation() {
    exists(DataFlow::PropWrite write |
      write.getPropertyName() = "amount" and
      write.getRhs() = this and
      exists(BinaryExpr binExpr |
        binExpr = this.asExpr() and
        binExpr.getOperator() instanceof ArithmeticBinaryExpr
      )
    )
  }
}
```

### 3. Dynamic Application Security Testing (DAST)

**Tool:** OWASP ZAP  
**Configuration:** `tests/security/zap-config.conf`  
**Script:** `scripts/security/run-zap-scan.js`

**Scan Types:**
- **Quick:** Light scan for fast feedback (1-10 minutes)
- **Standard:** Comprehensive scan for regular CI (30 minutes)  
- **Comprehensive:** Deep scan for scheduled runs (60+ minutes)

**Authentication Support:**
- Form-based authentication
- Multiple user roles (buyer, supplier, network, admin)
- Session management
- Context-aware scanning

### 4. Security Regression Testing

**Script:** `scripts/security/security-regression-test.js`  
**Baseline:** `scripts/security/generate-security-baseline.js`

**Features:**
- Automatic baseline generation
- Regression detection across all security tools
- Configurable tolerance levels
- Historical comparison
- Trend analysis

**Tolerance Levels:**
- **Strict:** Any new medium+ vulnerability is a regression
- **Moderate:** Only high+ vulnerabilities are regressions
- **Lenient:** Only critical vulnerabilities are regressions

### 5. Security Gates

**Evaluator:** `scripts/security/security-gate-evaluator.js`

**Default Gates:**

| Gate | Threshold | Blocking | Description |
|------|-----------|----------|-------------|
| Critical Vulnerabilities | 0 | Yes | No critical vulnerabilities allowed |
| High Vulnerabilities | ≤5 | Yes | Maximum 5 high severity vulnerabilities |
| Medium Vulnerabilities | ≤20 | No* | Maximum 20 medium severity vulnerabilities |
| Test Coverage | ≥80% | Yes | Minimum security test coverage |
| Regression Prevention | 0 | Yes | No security regressions allowed |
| OWASP Compliance | ≤2 categories | No | OWASP Top 10 compliance |
| PCI Compliance | ≥90 score | Yes | PCI DSS compliance for payments |

*\* Blocking in production environment*

### 6. Comprehensive Reporting

**Generator:** `scripts/security/generate-security-report.js`

**Report Formats:**
- **HTML:** Interactive dashboard with charts and metrics
- **JSON:** Machine-readable format for integrations
- **Markdown:** Human-readable summary for PR comments

**Report Sections:**
- Executive summary with key metrics
- Vulnerability breakdown by severity/type/source
- Security test coverage analysis
- Compliance status (OWASP, PCI DSS)
- Recommendations and action items
- Historical trends and comparisons

### 7. Continuous Security Monitoring

**Updater:** `scripts/security/update-security-monitoring.js`

**Monitoring Features:**
- Real-time security posture tracking
- Automated alert generation
- Security score calculation
- Trend analysis
- Integration with monitoring systems

**Security Score Calculation:**
```javascript
// Base score: 100
// Deductions:
// - Critical vulnerabilities: -20 points each
// - High vulnerabilities: -10 points each  
// - Medium vulnerabilities: -5 points each
// - Security regressions: -15 points each
// - Gate failures: -25 points
// - Low test coverage: -0.5 points per % below 80%
```

## Security Test Scope

### Authentication & Authorization
- Multi-factor authentication (MFA) implementation
- Session management and timeout
- Role-based access controls (RBAC)
- Password security and brute force protection
- JWT token validation
- OAuth/OpenID Connect flows

### Input Validation & Output Encoding
- Cross-site scripting (XSS) prevention
- SQL injection prevention
- Command injection prevention
- Path traversal prevention
- File upload security
- Input sanitization and validation

### API Security
- Rate limiting implementation
- CORS configuration
- API authentication and authorization
- Request/response validation
- HTTP method restrictions
- API versioning security

### Payment Security (PCI DSS)
- Stripe integration security
- Payment data protection
- Transaction integrity
- Fraud prevention
- Secure payment processing
- PCI DSS compliance validation

### Business Logic Security
- Call tracking integrity
- Commission calculation security
- Campaign data protection
- Real-time data security
- Audit trail implementation

### Infrastructure Security
- Container security scanning
- Dependency vulnerability management
- Secrets management
- Network security
- Database security
- Encryption implementation

## Usage Guide

### Running Security Tests Locally

```bash
# Install dependencies
npm install

# Run all security tests
npm run security:full

# Run specific test types
npm run security:test     # Unit security tests
npm run security:audit    # Dependency audit
npm run security:scan     # SAST + dependency scan

# Run OWASP ZAP scan
node scripts/security/run-zap-scan.js --scanType standard

# Generate security report
node scripts/security/generate-security-report.js

# Run regression test
node scripts/security/security-regression-test.js

# Evaluate security gates
node scripts/security/security-gate-evaluator.js
```

### Configuring Security Gates

Create or modify `tests/security/security-gate-config.json`:

```json
{
  "gates": {
    "criticalVulnerabilities": {
      "enabled": true,
      "blocking": true,
      "threshold": { "max": 0 }
    },
    "testCoverage": {
      "enabled": true,
      "blocking": true,
      "threshold": { "min": 80 },
      "requiredTests": ["sast", "dependency"]
    }
  },
  "environments": {
    "production": {
      "strictMode": true,
      "gates": {
        "highVulnerabilities": { "threshold": { "max": 0 } }
      }
    }
  }
}
```

### Creating Security Baseline

```bash
# Generate initial baseline
node scripts/security/generate-security-baseline.js

# Generate baseline with approved exceptions
node scripts/security/generate-security-baseline.js \
  --approvedVulnerabilities vuln-id-1,vuln-id-2
```

### Interpreting Security Reports

**Security Score Interpretation:**
- **90-100:** Excellent security posture
- **75-89:** Good security posture, minor issues
- **60-74:** Moderate security posture, attention needed
- **40-59:** Poor security posture, immediate action required
- **0-39:** Critical security posture, deployment blocked

**Vulnerability Priority:**
1. **Critical:** Immediate remediation required, deployment blocked
2. **High:** Remediation within 24-48 hours
3. **Medium:** Remediation within 1-2 weeks
4. **Low:** Remediation within 1 month

### Troubleshooting

**Common Issues:**

1. **OWASP ZAP Scan Failures**
   ```bash
   # Check if application is running
   curl http://localhost:5173
   
   # Verify ZAP configuration
   cat tests/security/zap-config.conf
   
   # Run with debug logging
   node scripts/security/run-zap-scan.js --debug true
   ```

2. **Security Gate Failures**
   ```bash
   # Check gate evaluation results
   cat security-gate-result.json
   
   # Review security report
   cat security-report/security-report-latest.html
   
   # Check regression analysis
   node scripts/security/security-regression-test.js --verbose
   ```

3. **Missing Test Coverage**
   ```bash
   # Check available security tools
   npm run security:scan
   
   # Verify tool configurations
   ls -la tests/security/
   
   # Update security baseline
   node scripts/security/generate-security-baseline.js
   ```

## Integration Guide

### GitHub Actions Integration

The security pipeline is automatically triggered on:
- Pull requests to main/develop branches
- Pushes to main/develop branches  
- Daily scheduled runs (2 AM UTC)
- Manual workflow dispatch

**Environment Variables:**
```yaml
env:
  SECURITY_THRESHOLD_HIGH: 0
  SECURITY_THRESHOLD_MEDIUM: 5
  SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
  SECURITY_MONITORING_WEBHOOK: ${{ secrets.SECURITY_MONITORING_WEBHOOK }}
```

### Monitoring System Integration

```javascript
// Example webhook payload structure
{
  "source": "dce-security-testing",
  "timestamp": "2024-01-15T10:30:00Z",
  "summary": {
    "totalVulnerabilities": 12,
    "criticalVulnerabilities": 0,
    "securityScore": 85.5,
    "gatesPassed": true
  },
  "alerts": [
    {
      "severity": "medium",
      "title": "Medium Vulnerability Threshold Exceeded",
      "message": "Found 8 medium vulnerabilities (threshold: 5)"
    }
  ]
}
```

### Notification Integration

The framework supports integration with:
- **Slack:** Webhook notifications for security events
- **Email:** SMTP integration for critical alerts
- **PagerDuty:** Incident creation for critical vulnerabilities
- **Teams:** Microsoft Teams notifications
- **Custom Webhooks:** Generic webhook support

## Best Practices

### Development Workflow

1. **Pre-commit:** Run local security checks before committing
2. **PR Creation:** Security tests run automatically
3. **Code Review:** Include security review in PR process
4. **Merge:** Automated security gates prevent insecure deployments
5. **Monitoring:** Continuous security monitoring post-deployment

### Security Testing Strategy

1. **Shift Left:** Run security tests early in development
2. **Layered Defense:** Multiple security testing tools and techniques
3. **Continuous Testing:** Regular automated security validation
4. **Risk-Based:** Focus on high-impact vulnerabilities first
5. **Compliance Driven:** Align with OWASP, PCI DSS standards

### Vulnerability Management

1. **Triage:** Classify vulnerabilities by severity and exploitability
2. **Prioritize:** Address critical and high-severity issues first
3. **Track:** Monitor remediation progress and timelines
4. **Verify:** Confirm fixes through re-testing
5. **Document:** Maintain security incident records

## Compliance & Standards

### OWASP Top 10 2021

The framework tests for all OWASP Top 10 categories:

1. **A01:2021 – Broken Access Control**
   - Authorization bypass testing
   - Privilege escalation detection
   - IDOR (Insecure Direct Object Reference) testing

2. **A02:2021 – Cryptographic Failures**
   - Encryption implementation review
   - Key management validation
   - Data protection verification

3. **A03:2021 – Injection**
   - SQL injection testing
   - NoSQL injection testing  
   - Command injection testing
   - XSS testing

4. **A04:2021 – Insecure Design**
   - Threat modeling validation
   - Security design review
   - Business logic testing

5. **A05:2021 – Security Misconfiguration**
   - Default configuration review
   - Security headers validation
   - Permission and access control review

6. **A06:2021 – Vulnerable and Outdated Components**
   - Dependency vulnerability scanning
   - Version management validation
   - License compliance checking

7. **A07:2021 – Identification and Authentication Failures**
   - Authentication mechanism testing
   - Session management validation
   - MFA implementation review

8. **A08:2021 – Software and Data Integrity Failures**
   - Code integrity validation
   - Supply chain security
   - Update mechanism security

9. **A09:2021 – Security Logging and Monitoring Failures**
   - Logging implementation review
   - Monitoring capability validation
   - Incident response validation

10. **A10:2021 – Server-Side Request Forgery (SSRF)**
    - SSRF vulnerability testing
    - URL validation review
    - Network security boundary testing

### PCI DSS Compliance

For payment processing security:

1. **Build and Maintain Secure Networks**
   - Network security validation
   - Firewall configuration review

2. **Protect Cardholder Data**
   - Data encryption validation
   - Data storage security review

3. **Maintain Vulnerability Management Program**
   - Regular vulnerability scanning
   - Patch management validation

4. **Implement Strong Access Control Measures**
   - Access control validation
   - User authentication review

5. **Regularly Monitor and Test Networks**
   - Continuous monitoring implementation
   - Regular security testing

6. **Maintain Information Security Policy**
   - Security policy compliance
   - Security awareness validation

## Metrics & KPIs

### Security Metrics

- **Vulnerability Density:** Vulnerabilities per 1000 lines of code
- **Time to Remediation:** Average time to fix vulnerabilities
- **Security Test Coverage:** Percentage of code covered by security tests
- **False Positive Rate:** Percentage of false positive security findings
- **Security Gate Pass Rate:** Percentage of deployments passing security gates

### Compliance Metrics

- **OWASP Top 10 Coverage:** Percentage of OWASP categories tested
- **PCI DSS Score:** Overall PCI DSS compliance score
- **Security Policy Compliance:** Adherence to security policies
- **Audit Findings:** Number of security audit findings

### Operational Metrics

- **Security Incident Response Time:** Time to respond to security incidents
- **Security Training Completion:** Team security training completion rate
- **Security Tool Availability:** Uptime of security testing tools
- **Alert Response Time:** Time to respond to security alerts

## Conclusion

The DCE Platform Security Testing Framework provides comprehensive security validation through automated testing, continuous monitoring, and deployment gates. By integrating multiple security testing tools and techniques into the CI/CD pipeline, the framework ensures that security is built into the development process from the start.

The framework's layered approach, combining SAST, DAST, dependency scanning, container security, and regression testing, provides thorough coverage of potential security vulnerabilities. The automated security gates prevent insecure code from reaching production, while continuous monitoring ensures ongoing security posture visibility.

Regular updates to the framework, incorporation of new security testing tools, and alignment with evolving security standards ensure that the DCE Platform maintains a strong security posture in the face of emerging threats.

For questions or support, please refer to the security team documentation or create an issue in the project repository.