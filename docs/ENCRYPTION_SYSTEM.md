# Field-Level Encryption System Documentation

## Overview

The DCE (Dependable Calls Exchange) platform implements a comprehensive field-level encryption system to protect sensitive PII (Personally Identifiable Information) data. This system provides:

- **AES-256-GCM encryption** for all sensitive data fields
- **Automatic key rotation** every 90 days (configurable)
- **Transparent encryption/decryption** for database operations
- **GDPR/CCPA compliance** features including right to erasure and data portability
- **Performance optimization** with caching and batching
- **Comprehensive audit logging** for compliance and security monitoring

## Architecture

### Core Components

1. **EncryptionService** - Main service for field encryption/decryption
2. **KeyManager** - Handles encryption key generation, rotation, and storage
3. **EncryptedDatabase** - Transparent database wrapper for encrypted operations
4. **GDPRComplianceService** - Implements data subject rights and compliance
5. **PerformanceOptimization** - Caching and batching for improved performance
6. **AuditLogger** - Comprehensive logging for security and compliance

### Data Classification

| Classification | Description | Example Fields | Encryption Type |
|----------------|-------------|----------------|-----------------|
| `public` | No encryption needed | `created_at`, `status` | None |
| `internal` | Standard encryption | `first_name`, `last_name` | AES-256-GCM |
| `sensitive` | Enhanced encryption with audit | `email`, `phone` | AES-256-GCM + Search Hash |
| `restricted` | Maximum security | `tax_id`, `recording_url` | AES-256-GCM + Access Control |

## Protected Data Fields

### Users Table
- **email** (sensitive, searchable) - Email addresses for login
- **phone** (sensitive, searchable) - Phone numbers for call routing
- **first_name** (internal) - User first names
- **last_name** (internal) - User last names

### Suppliers/Buyers Tables
- **tax_id** (restricted, searchable) - Tax identification numbers
- **verification_data** (restricted) - Identity verification documents

### Campaigns Table
- **targeting_criteria** (sensitive) - Audience targeting data

### Calls Table
- **caller_number** (restricted, searchable) - Caller phone numbers
- **destination_number** (restricted, searchable) - Destination phone numbers
- **recording_url** (restricted) - Call recording file URLs
- **transcription** (restricted) - Call transcription text

## Installation and Setup

### 1. Environment Variables

Add the following to your `.env` file:

```bash
# Encryption Configuration
VITE_ENCRYPTION_MASTER_KEY=your-32-character-encryption-key-here
VITE_KEY_ROTATION_WEBHOOK_URL=https://your-app.com/api/key-rotation
VITE_AUDIT_LOG_WEBHOOK_URL=https://your-app.com/api/audit-webhook
VITE_COMPLIANCE_NOTIFICATION_EMAIL=compliance@your-company.com
```

### 2. Database Migration

Run the encryption system database migration:

```bash
# Apply the encryption system schema
npx supabase db push

# Or manually apply the migration file
psql -f supabase/migrations/007_field_level_encryption.sql
```

### 3. Initialize the System

In your application startup code:

```typescript
import { initializeEncryption } from './lib/encryption'

// Initialize during app startup
await initializeEncryption()
```

### 4. Integration with Application

Replace direct database calls with encrypted operations:

```typescript
import { encryptedDb, createEncryptionContext } from './lib/encryption'

// Create encryption context
const context = createEncryptionContext(
  userId,
  'write',
  'User registration',
  { ip: req.ip, userAgent: req.headers['user-agent'] }
)

// Use encrypted database operations
const { data, error } = await encryptedDb.insert('users', {
  email: 'user@example.com',
  phone: '+1234567890',
  first_name: 'John',
  last_name: 'Doe'
}, context)
```

## Usage Examples

### Basic Encryption/Decryption

```typescript
import { encryptionService, createEncryptionContext } from './lib/encryption'

const context = createEncryptionContext(
  'user-123',
  'write',
  'Store user phone number'
)

// Encrypt a phone number
const encrypted = await encryptionService.encryptField(
  'users',
  'phone',
  '+1234567890',
  context
)

// Decrypt the phone number
const decrypted = await encryptionService.decryptField(
  'users',
  'phone',
  encrypted,
  { ...context, operation: 'read' }
)
```

### Searching Encrypted Data

```typescript
// Generate search hash for encrypted search
const searchHash = await encryptionService.generateFieldSearchHash(
  'users',
  'email',
  'user@example.com',
  context
)

// Query using the encrypted database wrapper
const users = await encryptedDb
  .from('users', context)
  .eq('email', 'user@example.com') // Automatically uses search hash
  .execute()
```

### Batch Operations

```typescript
// Encrypt multiple fields at once
const userData = {
  email: 'user@example.com',
  phone: '+1234567890',
  first_name: 'John',
  last_name: 'Doe',
  created_at: new Date().toISOString() // Not encrypted
}

const encrypted = await encryptionService.encryptFields('users', userData, context)
const decrypted = await encryptionService.decryptFields('users', encrypted, readContext)
```

## GDPR Compliance

### Data Subject Access Request

```typescript
import { gdprService } from './lib/encryption'

// Handle user's request to access their data
const dataExport = await gdprService.handleAccessRequest(
  'user-123',
  'admin-456',
  'Article 15 - Right of access'
)

console.log('Exported data:', dataExport.encryptedFields)
```

### Right to Erasure

```typescript
// Handle user's request to delete their data
const erasureResult = await gdprService.handleErasureRequest(
  'user-123',
  'admin-456',
  'User requested account deletion',
  'Article 17 - Right to erasure'
)

console.log('Erasure result:', erasureResult)
```

### Data Portability

```typescript
// Export user data in structured format
const portabilityExport = await gdprService.handlePortabilityRequest(
  'user-123',
  'admin-456',
  'json' // or 'csv', 'xml'
)
```

## Key Management

### Automatic Key Rotation

Keys are automatically rotated every 90 days (configurable). Monitor rotation status:

```typescript
import { encryptionService } from './lib/encryption'

// Check if keys need rotation
const health = await encryptionService.getHealthStatus()
if (health.keyNeedsRotation) {
  console.log('Key rotation needed for:', health.currentKeyId)
}

// Force key rotation
await encryptionService.rotateAllKeys()
```

### Manual Key Operations

```typescript
import { keyManager } from './lib/encryption'

// Generate new key
const newKey = await keyManager.generateKey('data')

// Check if key should be rotated
const shouldRotate = keyManager.shouldRotateKey(currentKey)

// Deactivate compromised key
await keyManager.deactivateKey('compromised-key-id', 'Security incident')
```

## Data Migration

### Migrating Existing Data

```typescript
import { migrationManager } from './lib/encryption'

// Migrate all tables
const results = await migrationManager.migrateAllTables({
  dryRun: false,
  batchSize: 100,
  skipBackup: false
})

// Migrate specific table
const tableResult = await migrationManager.migrateTable('users', {
  dryRun: false,
  batchSize: 50
})

// Verify migration
const verification = await migrationManager.verifyMigration('users')
console.log('Migration verification:', verification)
```

### CLI Migration Commands

```bash
# Run migration with dry run
npm run migrate:encryption -- --dry-run --tables=users,suppliers

# Run actual migration
npm run migrate:encryption -- --batch-size=50

# Verify migration results
npm run verify:encryption -- --table=users
```

## Performance Monitoring

### Check System Health

```typescript
import { checkEncryptionHealth, getEncryptionMetrics } from './lib/encryption'

// Health check
const health = await checkEncryptionHealth()
console.log('System health:', health.status)

// Performance metrics
const metrics = await getEncryptionMetrics()
console.log('Average encryption time:', metrics.performance.averageDuration, 'ms')
console.log('Cache hit rate:', metrics.performance.cacheHitRate * 100, '%')
```

### Performance Optimization

The system includes several performance optimizations:

1. **LRU Cache** - Caches encrypted values to avoid re-encryption
2. **Batch Processing** - Groups multiple operations for efficiency
3. **Connection Pooling** - Optimizes database connections
4. **Async Operations** - Non-blocking encryption operations

```typescript
import { performanceMonitor, encryptionCache } from './lib/encryption'

// Get cache statistics
const cacheStats = encryptionCache.getStats()
console.log('Cache hit rate:', cacheStats.hitRate)

// Get performance statistics
const perfStats = performanceMonitor.getStats()
console.log('Average encryption time:', perfStats.overall.averageDuration, 'ms')
```

## Security Best Practices

### 1. Key Management
- Store master keys in secure key management systems (AWS KMS, HashiCorp Vault)
- Rotate keys regularly (default: 90 days)
- Use different keys for different data types
- Monitor key usage and access

### 2. Access Control
- Implement proper authentication and authorization
- Use principle of least privilege
- Audit all access to encrypted data
- Implement IP whitelisting for admin operations

### 3. Monitoring and Alerting
- Monitor failed decryption attempts
- Alert on unusual access patterns
- Track key rotation status
- Monitor system performance metrics

### 4. Compliance
- Regular compliance audits
- Document data processing activities
- Implement data retention policies
- Provide data subject rights mechanisms

## Troubleshooting

### Common Issues

#### 1. Decryption Failures
```typescript
// Check if field is actually encrypted
const status = encryptionService.getFieldEncryptionStatus('users', 'phone')
console.log('Field encryption status:', status)

// Verify key exists
const key = await keyManager.getKey(encryptedField.keyId)
if (!key) {
  console.error('Encryption key not found:', encryptedField.keyId)
}
```

#### 2. Performance Issues
```typescript
// Check cache performance
const cacheStats = encryptionCache.getStats()
if (cacheStats.hitRate < 0.5) {
  console.warn('Low cache hit rate:', cacheStats.hitRate)
}

// Monitor encryption times
const metrics = performanceMonitor.getStats()
if (metrics.overall.averageDuration > 100) {
  console.warn('High encryption latency:', metrics.overall.averageDuration, 'ms')
}
```

#### 3. Key Rotation Issues
```typescript
// Check rotation status
const rotationStatus = await keyManager.getRotationStatus('rotation-id')
if (rotationStatus?.status === 'failed') {
  console.error('Key rotation failed:', rotationStatus.error)
}
```

### Debug Mode

Enable debug logging:

```typescript
// Set debug mode in config
const config = getEncryptionConfig()
config.compliance.enableAuditLogging = true

// Check system status
const testResult = await testEncryption()
console.log('Encryption test passed:', testResult)
```

## Monitoring and Alerts

### Key Metrics to Monitor

1. **Encryption Performance**
   - Average encryption/decryption time
   - Cache hit rate
   - Failed operations rate

2. **Key Management**
   - Key rotation status
   - Number of active keys
   - Key age and expiration

3. **Compliance**
   - Data subject requests
   - Audit log completeness
   - Access patterns

### Recommended Alerts

- High encryption latency (>100ms)
- Low cache hit rate (<50%)
- Failed key rotation
- Multiple decryption failures
- Unusual access patterns
- GDPR request backlog

### Sample Monitoring Dashboard

```typescript
// Example monitoring endpoint
app.get('/api/encryption/health', async (req, res) => {
  const health = await checkEncryptionHealth()
  const metrics = await getEncryptionMetrics()
  
  res.json({
    status: health.status,
    keyManagement: metrics.keyManagement,
    performance: metrics.performance,
    compliance: metrics.compliance,
    lastCheck: new Date().toISOString()
  })
})
```

## API Reference

### Core Services

- `EncryptionService` - Main encryption/decryption service
- `KeyManager` - Key lifecycle management
- `EncryptedDatabase` - Transparent database operations
- `GDPRComplianceService` - GDPR compliance features
- `EncryptionAuditLogger` - Security and compliance logging

### Configuration

- `getEncryptionConfig()` - Get current encryption configuration
- `validateEncryptionEnvironment()` - Validate environment setup
- `isFieldEncrypted(table, field)` - Check if field is encrypted
- `isFieldSearchable(table, field)` - Check if field supports search

### Utilities

- `createEncryptionContext()` - Create operation context
- `initializeEncryption()` - Initialize system
- `checkEncryptionHealth()` - System health check
- `testEncryption()` - Run encryption test

## Compliance and Legal

### GDPR Compliance

The system implements all required GDPR data subject rights:

- **Right of Access** (Article 15) - Export user's encrypted data
- **Right to Rectification** (Article 16) - Update encrypted data
- **Right to Erasure** (Article 17) - Securely delete/anonymize data
- **Right to Data Portability** (Article 20) - Export data in structured format
- **Right to Restriction** (Article 18) - Limit data processing

### Audit Requirements

All encryption operations are logged with:
- User ID and operation type
- Timestamp and duration
- Data accessed (table/field)
- Business justification
- Client IP and user agent
- Success/failure status

### Data Retention

- Encryption audit logs: 7 years (configurable)
- Data access logs: 7 years (configurable)  
- Compliance logs: 7 years (required)
- Security incidents: 7 years (required)

## Support and Maintenance

### Regular Maintenance Tasks

1. **Weekly**
   - Monitor key rotation status
   - Check system health metrics
   - Review security incident logs

2. **Monthly**
   - Analyze performance trends
   - Review compliance reports
   - Update security policies

3. **Quarterly**
   - Security audit
   - Key rotation verification
   - Compliance assessment

### Getting Help

For technical support:
1. Check system health with `checkEncryptionHealth()`
2. Review audit logs for error patterns
3. Test encryption with `testEncryption()`
4. Check performance metrics
5. Review configuration settings

For compliance questions:
1. Generate compliance reports
2. Review data subject request logs
3. Check audit log completeness
4. Verify data retention policies

---

**Security Notice**: This encryption system handles sensitive data. Always follow security best practices, maintain proper access controls, and regularly monitor system health and compliance status.