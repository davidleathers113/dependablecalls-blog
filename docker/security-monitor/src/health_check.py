#!/usr/bin/env python3

"""
Security Monitor Health Check
============================

Health check script for the container security monitor.
Verifies that all monitoring components are functioning correctly.
"""

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import docker
import psutil


def check_docker_connection() -> bool:
    """Check Docker daemon connection"""
    try:
        client = docker.from_env()
        client.ping()
        return True
    except Exception as e:
        print(f"Docker connection failed: {e}")
        return False


def check_monitoring_process() -> bool:
    """Check if monitoring process is running"""
    try:
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            if 'security_monitor.py' in ' '.join(proc.info['cmdline'] or []):
                return True
        print("Security monitor process not found")
        return False
    except Exception as e:
        print(f"Process check failed: {e}")
        return False


def check_report_generation() -> bool:
    """Check if reports are being generated"""
    try:
        reports_dir = Path("/app/reports")
        if not reports_dir.exists():
            print("Reports directory not found")
            return False
        
        # Check for recent reports (within last hour)
        recent_reports = []
        current_time = time.time()
        
        for report_file in reports_dir.glob("security_report_*.json"):
            if current_time - report_file.stat().st_mtime < 3600:  # 1 hour
                recent_reports.append(report_file)
        
        if not recent_reports:
            print("No recent security reports found")
            return False
        
        # Validate latest report
        latest_report = max(recent_reports, key=lambda x: x.stat().st_mtime)
        
        with open(latest_report, 'r') as f:
            report_data = json.load(f)
        
        required_fields = ['timestamp', 'summary', 'containers']
        for field in required_fields:
            if field not in report_data:
                print(f"Report missing required field: {field}")
                return False
        
        return True
        
    except Exception as e:
        print(f"Report check failed: {e}")
        return False


def check_system_resources() -> bool:
    """Check system resource usage"""
    try:
        # Check CPU usage
        cpu_percent = psutil.cpu_percent(interval=1)
        if cpu_percent > 90:
            print(f"High CPU usage: {cpu_percent}%")
            return False
        
        # Check memory usage
        memory = psutil.virtual_memory()
        if memory.percent > 90:
            print(f"High memory usage: {memory.percent}%")
            return False
        
        # Check disk space
        disk = psutil.disk_usage('/')
        if disk.percent > 90:
            print(f"High disk usage: {disk.percent}%")
            return False
        
        return True
        
    except Exception as e:
        print(f"Resource check failed: {e}")
        return False


def check_log_files() -> bool:
    """Check if log files are being written"""
    try:
        logs_dir = Path("/app/logs")
        if not logs_dir.exists():
            # Logs directory may not exist yet, which is OK
            return True
        
        # Check for recent log activity
        current_time = time.time()
        
        for log_file in logs_dir.glob("*.log"):
            if current_time - log_file.stat().st_mtime < 300:  # 5 minutes
                return True
        
        # No recent log activity might indicate an issue
        print("No recent log activity detected")
        return False
        
    except Exception as e:
        print(f"Log check failed: {e}")
        return False


def main():
    """Run all health checks"""
    checks = [
        ("Docker Connection", check_docker_connection),
        ("Monitoring Process", check_monitoring_process),
        ("Report Generation", check_report_generation),
        ("System Resources", check_system_resources),
        ("Log Files", check_log_files)
    ]
    
    all_passed = True
    results = {}
    
    print(f"Security Monitor Health Check - {datetime.now(timezone.utc).isoformat()}")
    print("=" * 60)
    
    for check_name, check_func in checks:
        try:
            result = check_func()
            status = "PASS" if result else "FAIL"
            results[check_name] = result
            
            print(f"{check_name:.<30} {status}")
            
            if not result:
                all_passed = False
                
        except Exception as e:
            print(f"{check_name:.<30} ERROR: {e}")
            results[check_name] = False
            all_passed = False
    
    print("=" * 60)
    
    if all_passed:
        print("✅ All health checks passed")
        exit_code = 0
    else:
        print("❌ Some health checks failed")
        exit_code = 1
    
    # Save health check results
    try:
        health_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "overall_status": "healthy" if all_passed else "unhealthy",
            "checks": {name: "pass" if result else "fail" for name, result in results.items()}
        }
        
        health_file = Path("/app/reports/health_check.json")
        health_file.parent.mkdir(exist_ok=True)
        
        with open(health_file, 'w') as f:
            json.dump(health_data, f, indent=2)
            
    except Exception as e:
        print(f"Warning: Could not save health check results: {e}")
    
    sys.exit(exit_code)


if __name__ == "__main__":
    main()