#!/usr/bin/env python3
"""
Comprehensive Validation Runner

Executes the complete validation test suite to assess deployment readiness
of the modular Container Security Monitor.

This script orchestrates all validation tests and generates a comprehensive
report suitable for production deployment decisions.
"""

import sys
import subprocess
import time
import json
import os
import argparse
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional
import psutil

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ValidationRunner:
    """Comprehensive validation test runner."""
    
    def __init__(self, output_dir: str = "validation_reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        self.test_results = {}
        self.performance_metrics = {}
        self.start_time = None
        self.end_time = None
        
    def run_validation_suite(self, 
                           include_slow: bool = False,
                           include_production: bool = False,
                           parallel: bool = True) -> Dict[str, Any]:
        """Run the complete validation test suite."""
        
        logger.info("Starting comprehensive validation test suite")
        self.start_time = datetime.now(timezone.utc)
        
        # Define test categories
        test_categories = {
            'functional_parity': {
                'file': 'test_functional_parity.py',
                'description': 'Functional parity validation between monolith and modular systems',
                'critical': True,
                'estimated_time': 300  # 5 minutes
            },
            'performance_benchmarks': {
                'file': 'test_performance_benchmarks.py',
                'description': 'Performance benchmarking and optimization validation',
                'critical': True,
                'estimated_time': 600,  # 10 minutes
                'markers': ['performance']
            },
            'side_by_side': {
                'file': 'test_side_by_side.py',
                'description': 'Side-by-side comparison framework',
                'critical': True,
                'estimated_time': 240  # 4 minutes
            },
            'production_simulation': {
                'file': 'test_production_simulation.py',
                'description': 'Production environment simulation',
                'critical': False,
                'estimated_time': 1800,  # 30 minutes
                'markers': ['production', 'slow'],
                'skip_unless': include_production
            }
        }
        
        # System information
        system_info = self._collect_system_info()
        logger.info(f"System info: {system_info['python_version']}, "
                   f"{system_info['cpu_count']} CPUs, "
                   f"{system_info['memory_gb']:.1f}GB RAM")
        
        # Run each test category
        for category, config in test_categories.items():
            if config.get('skip_unless', True) is False:
                logger.info(f"Skipping {category} (not requested)")
                continue
                
            logger.info(f"Running {category}: {config['description']}")
            
            result = self._run_test_category(
                category=category,
                config=config,
                parallel=parallel
            )
            
            self.test_results[category] = result
            
            # Early exit on critical failures
            if config.get('critical', False) and not result['success']:
                logger.error(f"Critical test category {category} failed - stopping validation")
                break
                
            # Brief pause between categories
            time.sleep(2)
        
        self.end_time = datetime.now(timezone.utc)
        
        # Generate comprehensive report
        validation_report = self._generate_validation_report()
        
        # Save report
        report_file = self.output_dir / f"validation_report_{int(time.time())}.json"
        with open(report_file, 'w') as f:
            json.dump(validation_report, f, indent=2, default=str)
        
        logger.info(f"Validation report saved to: {report_file}")
        
        return validation_report
    
    def _collect_system_info(self) -> Dict[str, Any]:
        """Collect system information for validation context."""
        return {
            'python_version': sys.version,
            'platform': sys.platform,
            'cpu_count': psutil.cpu_count(),
            'memory_gb': psutil.virtual_memory().total / (1024**3),
            'disk_space_gb': psutil.disk_usage('.').free / (1024**3),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    
    def _run_test_category(self, category: str, config: Dict, parallel: bool) -> Dict[str, Any]:
        """Run a specific test category."""
        test_file = Path(__file__).parent / config['file']
        
        if not test_file.exists():
            return {
                'success': False,
                'error': f"Test file not found: {test_file}",
                'duration': 0,
                'tests_run': 0,
                'tests_passed': 0,
                'tests_failed': 0
            }
        
        # Build pytest command
        cmd = [
            'python', '-m', 'pytest',
            str(test_file),
            '-v',
            '--tb=short',
            '--junit-xml', str(self.output_dir / f"{category}_results.xml"),
            '--json-report', '--json-report-file', str(self.output_dir / f"{category}_report.json")
        ]
        
        # Add markers if specified
        markers = config.get('markers', [])
        if markers:
            cmd.extend(['-m', ' and '.join(markers)])
        
        # Add parallel execution if requested
        if parallel and psutil.cpu_count() > 2:
            cmd.extend(['-n', 'auto'])
        
        # Add coverage if available
        try:
            subprocess.run(['python', '-c', 'import pytest_cov'], 
                         check=True, capture_output=True)
            cmd.extend([
                '--cov=container_monitor',
                '--cov-report=term-missing',
                '--cov-report', f'html:{self.output_dir}/{category}_coverage'
            ])
        except subprocess.CalledProcessError:
            logger.warning("pytest-cov not available, skipping coverage")
        
        # Run tests
        logger.info(f"Executing: {' '.join(cmd)}")
        start_time = time.time()
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=config.get('estimated_time', 600) * 2  # 2x estimated time
            )
            
            duration = time.time() - start_time
            
            # Parse results
            test_result = self._parse_test_results(category, result, duration)
            
            logger.info(f"{category} completed in {duration:.1f}s: "
                       f"{test_result['tests_passed']}/{test_result['tests_run']} passed")
            
            return test_result
            
        except subprocess.TimeoutExpired as e:
            duration = time.time() - start_time
            logger.error(f"{category} timed out after {duration:.1f}s")
            
            return {
                'success': False,
                'error': f"Test timeout after {duration:.1f}s",
                'duration': duration,
                'tests_run': 0,
                'tests_passed': 0,
                'tests_failed': 0,
                'stdout': '',
                'stderr': f"Timeout after {duration:.1f}s"
            }
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"{category} failed with exception: {e}")
            
            return {
                'success': False,
                'error': str(e),
                'duration': duration,
                'tests_run': 0,
                'tests_passed': 0,
                'tests_failed': 0,
                'stdout': '',
                'stderr': str(e)
            }
    
    def _parse_test_results(self, category: str, result: subprocess.CompletedProcess, duration: float) -> Dict[str, Any]:
        """Parse test results from pytest output."""
        
        # Try to load JSON report if available
        json_report_file = self.output_dir / f"{category}_report.json"
        json_data = None
        
        if json_report_file.exists():
            try:
                with open(json_report_file, 'r') as f:
                    json_data = json.load(f)
            except Exception as e:
                logger.warning(f"Failed to parse JSON report for {category}: {e}")
        
        # Extract basic information
        if json_data:
            summary = json_data.get('summary', {})
            tests_run = summary.get('total', 0)
            tests_passed = summary.get('passed', 0)
            tests_failed = summary.get('failed', 0)
            tests_skipped = summary.get('skipped', 0)
            success = result.returncode == 0 and tests_failed == 0
        else:
            # Parse from stdout as fallback
            stdout = result.stdout
            tests_run = stdout.count('PASSED') + stdout.count('FAILED') + stdout.count('SKIPPED')
            tests_passed = stdout.count('PASSED')
            tests_failed = stdout.count('FAILED')
            tests_skipped = stdout.count('SKIPPED')
            success = result.returncode == 0
        
        return {
            'success': success,
            'duration': duration,
            'tests_run': tests_run,
            'tests_passed': tests_passed,
            'tests_failed': tests_failed,
            'tests_skipped': tests_skipped,
            'return_code': result.returncode,
            'stdout': result.stdout,
            'stderr': result.stderr,
            'json_data': json_data
        }
    
    def _generate_validation_report(self) -> Dict[str, Any]:
        """Generate comprehensive validation report."""
        
        total_duration = (self.end_time - self.start_time).total_seconds()
        
        # Calculate overall statistics
        total_tests = sum(r.get('tests_run', 0) for r in self.test_results.values())
        total_passed = sum(r.get('tests_passed', 0) for r in self.test_results.values())
        total_failed = sum(r.get('tests_failed', 0) for r in self.test_results.values())
        total_skipped = sum(r.get('tests_skipped', 0) for r in self.test_results.values())
        
        # Determine overall status
        critical_failures = sum(
            1 for category, result in self.test_results.items()
            if not result.get('success', False) and self._is_critical_category(category)
        )
        
        overall_success = critical_failures == 0 and total_failed == 0
        
        # Extract performance metrics
        performance_summary = self._extract_performance_metrics()
        
        # Generate recommendations
        recommendations = self._generate_recommendations()
        
        # Deployment readiness assessment
        deployment_readiness = self._assess_deployment_readiness()
        
        return {
            'validation_summary': {
                'overall_status': 'PASS' if overall_success else 'FAIL',
                'start_time': self.start_time.isoformat(),
                'end_time': self.end_time.isoformat(),
                'total_duration_seconds': total_duration,
                'total_tests': total_tests,
                'tests_passed': total_passed,
                'tests_failed': total_failed,
                'tests_skipped': total_skipped,
                'success_rate': (total_passed / total_tests * 100) if total_tests > 0 else 0,
                'critical_failures': critical_failures
            },
            'test_results': self.test_results,
            'performance_metrics': performance_summary,
            'deployment_readiness': deployment_readiness,
            'recommendations': recommendations,
            'system_info': self._collect_system_info()
        }
    
    def _is_critical_category(self, category: str) -> bool:
        """Check if a test category is critical for deployment."""
        critical_categories = ['functional_parity', 'performance_benchmarks', 'side_by_side']
        return category in critical_categories
    
    def _extract_performance_metrics(self) -> Dict[str, Any]:
        """Extract performance metrics from test results."""
        metrics = {}
        
        # Extract from performance benchmarks
        perf_results = self.test_results.get('performance_benchmarks', {})
        if perf_results.get('json_data'):
            # Would extract actual performance data from test outputs
            pass
        
        # Extract from side-by-side comparison
        comparison_results = self.test_results.get('side_by_side', {})
        if comparison_results.get('json_data'):
            # Would extract comparison metrics
            pass
        
        # For now, provide template structure
        metrics = {
            'cpu_usage_improvement': None,  # Would be extracted from actual test data
            'memory_usage_improvement': None,
            'response_time_improvement': None,
            'throughput_improvement': None,
            'container_handling_capacity': None,
            'alert_delivery_latency': None
        }
        
        return metrics
    
    def _generate_recommendations(self) -> List[str]:
        """Generate recommendations based on test results."""
        recommendations = []
        
        # Check for failures
        failed_categories = [
            category for category, result in self.test_results.items()
            if not result.get('success', False)
        ]
        
        if failed_categories:
            recommendations.append(
                f"❌ Address failures in: {', '.join(failed_categories)}"
            )
        
        # Performance recommendations
        perf_result = self.test_results.get('performance_benchmarks', {})
        if not perf_result.get('success', False):
            recommendations.append(
                "⚠️ Performance benchmarks failed - review CPU and memory usage"
            )
        
        # Functional parity recommendations
        parity_result = self.test_results.get('functional_parity', {})
        if not parity_result.get('success', False):
            recommendations.append(
                "⚠️ Functional parity issues detected - review event generation consistency"
            )
        
        # General recommendations
        if not failed_categories:
            recommendations.extend([
                "✅ All critical tests passed - system ready for deployment",
                "🔄 Consider running extended production simulation tests",
                "📊 Monitor performance metrics closely during initial deployment",
                "🔒 Verify security configurations in production environment",
                "📋 Prepare rollback plan in case of issues"
            ])
        
        return recommendations
    
    def _assess_deployment_readiness(self) -> Dict[str, Any]:
        """Assess overall deployment readiness."""
        
        # Critical test categories that must pass
        critical_categories = ['functional_parity', 'performance_benchmarks', 'side_by_side']
        
        critical_passed = all(
            self.test_results.get(category, {}).get('success', False)
            for category in critical_categories
        )
        
        # Calculate readiness score
        total_categories = len(self.test_results)
        passed_categories = sum(
            1 for result in self.test_results.values()
            if result.get('success', False)
        )
        
        readiness_score = (passed_categories / total_categories * 100) if total_categories > 0 else 0
        
        # Determine deployment recommendation
        if critical_passed and readiness_score >= 80:
            deployment_recommendation = "GO"
            risk_level = "LOW"
        elif critical_passed and readiness_score >= 60:
            deployment_recommendation = "GO_WITH_CAUTION"
            risk_level = "MEDIUM"
        else:
            deployment_recommendation = "NO_GO"
            risk_level = "HIGH"
        
        return {
            'deployment_recommendation': deployment_recommendation,
            'risk_level': risk_level,
            'readiness_score': readiness_score,
            'critical_tests_passed': critical_passed,
            'categories_passed': passed_categories,
            'total_categories': total_categories,
            'summary': self._get_deployment_summary(deployment_recommendation, risk_level)
        }
    
    def _get_deployment_summary(self, recommendation: str, risk_level: str) -> str:
        """Get deployment summary message."""
        summaries = {
            'GO': "✅ System is ready for production deployment. All critical tests passed.",
            'GO_WITH_CAUTION': "⚠️ System can be deployed with careful monitoring. Some non-critical issues detected.",
            'NO_GO': "❌ System is NOT ready for production deployment. Critical issues must be resolved."
        }
        
        return summaries.get(recommendation, "Unknown deployment status")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Run comprehensive validation test suite"
    )
    
    parser.add_argument(
        '--output-dir', '-o',
        default='validation_reports',
        help='Output directory for reports (default: validation_reports)'
    )
    
    parser.add_argument(
        '--include-slow',
        action='store_true',
        help='Include slow tests (extends runtime significantly)'
    )
    
    parser.add_argument(
        '--include-production',
        action='store_true',
        help='Include production simulation tests (very slow)'
    )
    
    parser.add_argument(
        '--no-parallel',
        action='store_true',
        help='Disable parallel test execution'
    )
    
    parser.add_argument(
        '--quiet', '-q',
        action='store_true',
        help='Reduce output verbosity'
    )
    
    args = parser.parse_args()
    
    if args.quiet:
        logging.getLogger().setLevel(logging.WARNING)
    
    # Create validation runner
    runner = ValidationRunner(output_dir=args.output_dir)
    
    try:
        # Run validation suite
        report = runner.run_validation_suite(
            include_slow=args.include_slow,
            include_production=args.include_production,
            parallel=not args.no_parallel
        )
        
        # Print summary
        print("\n" + "="*60)
        print("VALIDATION SUMMARY")
        print("="*60)
        
        summary = report['validation_summary']
        print(f"Overall Status: {summary['overall_status']}")
        print(f"Tests Run: {summary['total_tests']}")
        print(f"Tests Passed: {summary['tests_passed']}")
        print(f"Tests Failed: {summary['tests_failed']}")
        print(f"Success Rate: {summary['success_rate']:.1f}%")
        print(f"Duration: {summary['total_duration_seconds']:.1f}s")
        
        # Deployment readiness
        readiness = report['deployment_readiness']
        print(f"\nDeployment Recommendation: {readiness['deployment_recommendation']}")
        print(f"Risk Level: {readiness['risk_level']}")
        print(f"Readiness Score: {readiness['readiness_score']:.1f}%")
        print(f"Summary: {readiness['summary']}")
        
        # Recommendations
        if report['recommendations']:
            print(f"\nRecommendations:")
            for rec in report['recommendations']:
                print(f"  {rec}")
        
        # Exit code based on results
        if summary['overall_status'] == 'PASS':
            print(f"\n✅ Validation completed successfully!")
            sys.exit(0)
        else:
            print(f"\n❌ Validation failed!")
            sys.exit(1)
            
    except KeyboardInterrupt:
        logger.info("Validation interrupted by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"Validation failed with error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()