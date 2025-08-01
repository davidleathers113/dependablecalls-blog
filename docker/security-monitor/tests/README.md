# Container Security Monitor Test Suite

This directory contains a comprehensive test suite for the Container Security Monitor, targeting 85% code coverage with a focus on security, reliability, and fault tolerance.

## Test Structure

```
tests/
├── conftest.py              # Shared pytest fixtures and configuration
├── test_models.py           # Pydantic model validation tests
├── test_security.py         # Security-focused tests (HMAC, auth, etc.)
├── test_async_docker.py     # Async Docker client tests
├── test_fault_injection.py  # Fault injection and error handling
├── test_runner.py           # Test execution script
├── integration/             # Integration tests
│   ├── __init__.py
│   └── test_end_to_end.py   # End-to-end workflow tests
├── unit/                    # Unit tests (if needed)
│   └── __init__.py
└── fixtures/                # Test data fixtures
```

## Test Categories

### 1. Model Validation Tests (`test_models.py`)
- Pydantic model construction and validation
- Field validation and constraints
- Security event escalation logic
- Configuration validation
- Input sanitization and malicious data filtering

### 2. Security Tests (`test_security.py`)
- HMAC signature verification and timing attack resistance
- Webhook authentication and authorization
- Input sanitization and injection prevention
- Access control and permission checking
- Secret handling and encryption
- Security auditing and logging

### 3. Async Docker Tests (`test_async_docker.py`)
- Async Docker client operations
- Connection handling and resource management
- Circuit breaker integration
- Performance monitoring
- Concurrent request handling
- Error recovery mechanisms

### 4. Fault Injection Tests (`test_fault_injection.py`)
- Network failure scenarios
- Resource exhaustion conditions
- Docker daemon failures
- Race condition handling
- Data corruption scenarios
- Circuit breaker behavior

### 5. Integration Tests (`integration/test_end_to_end.py`)
- Complete monitoring workflows
- Security event detection and alerting
- Configuration hot-reload
- System resilience and recovery
- Performance under load

## Running Tests

### Quick Start
```bash
# Install test dependencies
pip install -r requirements-test.txt

# Check test environment
python tests/test_runner.py check

# Run all tests with coverage
python tests/test_runner.py full

# Run specific test categories
python tests/test_runner.py unit
python tests/test_runner.py security
python tests/test_runner.py fault-injection
```

### Using pytest directly
```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=container_monitor --cov-report=html

# Run specific test files
pytest tests/test_security.py -v

# Run tests with specific markers
pytest -m "security and not slow"

# Run tests in parallel
pytest -n auto
```

### Test Markers

Tests are marked with the following categories:
- `unit`: Fast, isolated unit tests
- `integration`: Integration tests requiring setup
- `e2e`: End-to-end tests (slowest)
- `security`: Security-focused tests
- `fault_injection`: Fault injection scenarios
- `performance`: Performance tests
- `slow`: Slow-running tests

## Coverage Targets

- **Overall Coverage**: 85% minimum
- **Security Components**: 95% minimum
- **Model Validation**: 90% minimum
- **Async Operations**: 80% minimum
- **Fault Handling**: 85% minimum

## Test Fixtures

### Core Fixtures (`conftest.py`)
- `test_config`: Mock configuration for tests
- `mock_docker_client`: Mock Docker client with realistic responses
- `security_event_factory`: Factory for creating test security events
- `sample_webhook_payload`: Sample webhook data
- `fault_injection_scenarios`: Predefined fault scenarios
- `mock_hmac_validator`: HMAC validation mocking
- `secure_test_data`: Security test data generation

### Async Fixtures
- `mock_docker_session`: Mock aiohttp session for Docker API
- `mock_alert_sender`: Mock alert delivery system
- `mock_async_context`: Async context manager for testing

## Security Test Focus Areas

### 1. Input Validation
- Container name sanitization
- Path traversal prevention
- Command injection prevention
- Unicode normalization
- Null byte injection prevention

### 2. Authentication & Authorization
- HMAC signature verification
- Timing attack resistance
- Token validation
- Permission-based access control
- Rate limiting

### 3. Encryption & Secrets
- Secret encryption at rest
- Secret redaction in logs
- Environment variable protection
- Webhook payload encryption

### 4. Security Misconfiguration Detection
- Privileged container detection
- Root user detection
- Docker socket mount detection
- Host network mode detection
- Insecure port exposure

## Fault Injection Scenarios

### Network Failures
- Docker daemon connection timeout
- Network partition recovery
- DNS resolution failure
- Webhook delivery failure with retry

### Resource Exhaustion
- Memory pressure handling
- CPU spike handling
- Disk space exhaustion
- File descriptor exhaustion
- Concurrent request limiting

### Docker Daemon Failures
- Docker daemon crash
- Docker daemon restart recovery
- API version mismatch
- Container disappears during scan
- Permission denied scenarios

### Race Conditions
- Concurrent container modifications
- Alert deduplication races
- Configuration reload races
- Shutdown during active scan

## Performance Testing

Performance tests verify:
- High container count handling (100+ containers)
- Memory usage under sustained load
- Concurrent operation safety
- Response time requirements
- Resource leak prevention

## Best Practices

### Writing Tests
1. Use descriptive test names that explain the scenario
2. Follow AAA pattern (Arrange, Act, Assert)
3. Use appropriate fixtures to reduce code duplication
4. Mock external dependencies consistently
5. Test both success and failure paths
6. Include edge cases and boundary conditions

### Security Testing
1. Test with malicious inputs
2. Verify proper input sanitization
3. Check for timing attack vulnerabilities
4. Validate authentication and authorization
5. Test secret handling and encryption
6. Verify security auditing

### Async Testing
1. Use `pytest_asyncio.fixture` for async fixtures
2. Properly handle async context managers
3. Test concurrent operations
4. Verify resource cleanup
5. Handle timeout scenarios

## Continuous Integration

The test suite is designed to run in CI/CD pipelines with:
- Parallel test execution support
- JUnit XML output for CI integration
- HTML coverage reports
- Performance benchmarking
- Security scan integration

## Troubleshooting

### Common Issues
1. **Import Errors**: Ensure `PYTHONPATH` includes the project root
2. **Async Test Failures**: Check for proper `await` usage and cleanup
3. **Docker Test Failures**: Ensure Docker daemon is accessible (if using real Docker)
4. **Coverage Issues**: Check for uncovered exception handlers and edge cases

### Debug Mode
```bash
# Run tests with debug output
pytest --log-cli-level=DEBUG -s

# Run single test with full traceback
pytest tests/test_security.py::TestHMACVerification::test_valid_hmac_signature -vvv

# Debug with pdb
pytest --pdb tests/test_models.py::TestSecurityEvent::test_severity_escalation
```

## Contributing

When adding new tests:
1. Follow existing naming conventions
2. Add appropriate markers
3. Update this README if adding new test categories
4. Ensure tests are deterministic and can run in any order
5. Add docstrings explaining test purpose and scenarios