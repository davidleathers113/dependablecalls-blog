#!/usr/bin/env python3
"""
Test runner script for container security monitor tests.

Provides different test execution modes:
- Unit tests only
- Integration tests only
- Security-focused tests
- Full test suite
- Performance tests
- Fault injection tests
"""

import sys
import subprocess
import argparse
from pathlib import Path
import os


class TestRunner:
    """Test runner for container security monitor."""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.parent
        self.test_dir = self.project_root / "tests"
        
    def run_unit_tests(self, coverage=True, verbose=True):
        """Run unit tests only."""
        cmd = [
            "python", "-m", "pytest",
            str(self.test_dir / "test_models.py"),
            "-m", "not integration and not e2e",
            "--tb=short"
        ]
        
        if coverage:
            cmd.extend([
                "--cov=container_monitor",
                "--cov-report=term-missing"
            ])
            
        if verbose:
            cmd.append("-v")
            
        return self._run_command(cmd)
        
    def run_integration_tests(self, verbose=True):
        """Run integration tests."""
        cmd = [
            "python", "-m", "pytest",
            str(self.test_dir / "integration/"),
            "-m", "integration or e2e",
            "--tb=short"
        ]
        
        if verbose:
            cmd.append("-v")
            
        return self._run_command(cmd)
        
    def run_security_tests(self, verbose=True):
        """Run security-focused tests."""
        cmd = [
            "python", "-m", "pytest",
            str(self.test_dir / "test_security.py"),
            "-m", "security",
            "--tb=short"
        ]
        
        if verbose:
            cmd.append("-v")
            
        return self._run_command(cmd)
        
    def run_fault_injection_tests(self, verbose=True):
        """Run fault injection tests."""
        cmd = [
            "python", "-m", "pytest",
            str(self.test_dir / "test_fault_injection.py"),
            "-m", "fault_injection",
            "--tb=short"
        ]
        
        if verbose:
            cmd.append("-v")
            
        return self._run_command(cmd)
        
    def run_async_tests(self, verbose=True):
        """Run async Docker client tests."""
        cmd = [
            "python", "-m", "pytest",
            str(self.test_dir / "test_async_docker.py"),
            "--tb=short"
        ]
        
        if verbose:
            cmd.append("-v")
            
        return self._run_command(cmd)
        
    def run_performance_tests(self, verbose=True):
        """Run performance tests."""
        cmd = [
            "python", "-m", "pytest",
            str(self.test_dir),
            "-m", "performance",
            "--tb=short",
            "--durations=0"  # Show all durations
        ]
        
        if verbose:
            cmd.append("-v")
            
        return self._run_command(cmd)
        
    def run_full_suite(self, coverage=True, html_report=False):
        """Run full test suite with coverage."""
        cmd = [
            "python", "-m", "pytest",
            str(self.test_dir),
            "--tb=short",
            "-v"
        ]
        
        if coverage:
            cmd.extend([
                "--cov=container_monitor",
                "--cov-report=term-missing",
                "--cov-fail-under=85"
            ])
            
            if html_report:
                cmd.append("--cov-report=html:htmlcov")
                
        return self._run_command(cmd)
        
    def run_smoke_tests(self):
        """Run quick smoke tests."""
        cmd = [
            "python", "-m", "pytest",
            str(self.test_dir / "test_models.py"),
            "--tb=short",
            "-v",
            "--maxfail=5"  # Stop after 5 failures
        ]
        
        return self._run_command(cmd)
        
    def run_with_markers(self, markers, verbose=True):
        """Run tests with specific markers."""
        cmd = [
            "python", "-m", "pytest",
            str(self.test_dir),
            "-m", markers,
            "--tb=short"
        ]
        
        if verbose:
            cmd.append("-v")
            
        return self._run_command(cmd)
        
    def check_test_environment(self):
        """Check if test environment is properly set up."""
        print("Checking test environment...")
        
        # Check Python version
        python_version = sys.version_info
        if python_version < (3, 8):
            print(f"❌ Python {python_version.major}.{python_version.minor} is too old. Need 3.8+")
            return False
            
        print(f"✅ Python {python_version.major}.{python_version.minor}.{python_version.micro}")
        
        # Check required packages
        required_packages = [
            "pytest",
            "pytest-asyncio", 
            "pytest-cov",
            "docker",
            "aiohttp",
            "pydantic",
            "faker"
        ]
        
        missing_packages = []
        for package in required_packages:
            try:
                __import__(package.replace("-", "_"))
                print(f"✅ {package}")
            except ImportError:
                print(f"❌ {package} (missing)")
                missing_packages.append(package)
                
        if missing_packages:
            print(f"\nInstall missing packages: pip install {' '.join(missing_packages)}")
            return False
            
        # Check test directory structure
        required_dirs = [
            self.test_dir,
            self.test_dir / "integration",
            self.test_dir / "unit"
        ]
        
        for test_dir in required_dirs:
            if test_dir.exists():
                print(f"✅ {test_dir}")
            else:
                print(f"❌ {test_dir} (missing)")
                return False
                
        print("\n✅ Test environment is ready!")
        return True
        
    def _run_command(self, cmd):
        """Run command and return result."""
        print(f"Running: {' '.join(cmd)}")
        print("-" * 60)
        
        try:
            result = subprocess.run(
                cmd,
                cwd=self.project_root,
                capture_output=False,
                text=True
            )
            return result.returncode == 0
        except Exception as e:
            print(f"Error running tests: {e}")
            return False


def main():
    """Main test runner entry point."""
    parser = argparse.ArgumentParser(
        description="Test runner for container security monitor"
    )
    
    parser.add_argument(
        "mode",
        choices=[
            "unit", "integration", "security", "fault-injection", 
            "async", "performance", "full", "smoke", "check"
        ],
        help="Test mode to run"
    )
    
    parser.add_argument(
        "--no-coverage",
        action="store_true",
        help="Disable coverage reporting"
    )
    
    parser.add_argument(
        "--html-report",
        action="store_true", 
        help="Generate HTML coverage report"
    )
    
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Reduce verbosity"
    )
    
    parser.add_argument(
        "--markers",
        help="Run tests with specific markers (e.g., 'security and not slow')"
    )
    
    args = parser.parse_args()
    
    runner = TestRunner()
    
    # Check environment first
    if args.mode == "check":
        success = runner.check_test_environment()
        sys.exit(0 if success else 1)
        
    if not runner.check_test_environment():
        print("❌ Test environment check failed")
        sys.exit(1)
        
    verbose = not args.quiet
    coverage = not args.no_coverage
    
    # Run selected test mode
    if args.mode == "unit":
        success = runner.run_unit_tests(coverage=coverage, verbose=verbose)
    elif args.mode == "integration":
        success = runner.run_integration_tests(verbose=verbose)
    elif args.mode == "security":
        success = runner.run_security_tests(verbose=verbose)
    elif args.mode == "fault-injection":
        success = runner.run_fault_injection_tests(verbose=verbose)
    elif args.mode == "async":
        success = runner.run_async_tests(verbose=verbose)
    elif args.mode == "performance":
        success = runner.run_performance_tests(verbose=verbose)
    elif args.mode == "full":
        success = runner.run_full_suite(coverage=coverage, html_report=args.html_report)
    elif args.mode == "smoke":
        success = runner.run_smoke_tests()
    elif args.markers:
        success = runner.run_with_markers(args.markers, verbose=verbose)
    else:
        print(f"Unknown mode: {args.mode}")
        sys.exit(1)
        
    if success:
        print("\n✅ Tests completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Tests failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()