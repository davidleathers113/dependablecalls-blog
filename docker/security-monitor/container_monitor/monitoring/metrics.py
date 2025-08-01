"""
Prometheus metrics collection for container security monitoring.

Provides comprehensive observability with:
- Container event metrics
- Vulnerability scan tracking  
- Alert response time measurements
- Performance monitoring
- OpenTelemetry integration
"""

import time
import asyncio
from typing import Dict, Any, Optional, Set, List
from contextlib import contextmanager
from datetime import datetime, timezone
from collections import defaultdict, deque

import structlog
from prometheus_client import (
    Counter, Histogram, Gauge, Info, Enum,
    CollectorRegistry, generate_latest, CONTENT_TYPE_LATEST,
    start_http_server, push_to_gateway
)
from prometheus_client.openmetrics.exposition import CONTENT_TYPE_LATEST as OPENMETRICS_CONTENT_TYPE

# OpenTelemetry imports (optional, graceful degradation if not available)
try:
    from opentelemetry import trace, metrics as otel_metrics
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.sdk.metrics import MeterProvider
    from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
    from opentelemetry.instrumentation.aiohttp_client import AioHttpClientInstrumentor
    from opentelemetry.instrumentation.psutil import PsutilInstrumentor
    OTEL_AVAILABLE = True
except ImportError:
    OTEL_AVAILABLE = False

logger = structlog.get_logger(__name__)


class OpenTelemetryIntegration:
    """
    OpenTelemetry integration for distributed tracing and metrics.
    
    Provides:
    - Distributed tracing for security event processing
    - OTLP metric export alongside Prometheus
    - Automatic instrumentation of HTTP clients and system resources
    """
    
    def __init__(self, service_name: str = "container-security-monitor",
                 service_version: str = "2.0.0",
                 otlp_endpoint: Optional[str] = None):
        """
        Initialize OpenTelemetry integration.
        
        Args:
            service_name: Name of the service for telemetry
            service_version: Version of the service
            otlp_endpoint: OTLP collector endpoint (e.g., "http://jaeger:14250")
        """
        self.service_name = service_name
        self.service_version = service_version
        self.otlp_endpoint = otlp_endpoint
        self.tracer = None
        self.meter = None
        self.initialized = False
        
        if OTEL_AVAILABLE:
            self._setup_telemetry()
        else:
            logger.warning("OpenTelemetry not available, distributed tracing disabled")
    
    def _setup_telemetry(self):
        """Setup OpenTelemetry tracing and metrics."""
        try:
            # Setup tracing
            trace.set_tracer_provider(TracerProvider(
                resource=self._create_resource()
            ))
            
            if self.otlp_endpoint:
                # Setup OTLP exporter for traces
                otlp_exporter = OTLPSpanExporter(
                    endpoint=self.otlp_endpoint,
                    insecure=True  # Use TLS in production
                )
                span_processor = BatchSpanProcessor(otlp_exporter)
                trace.get_tracer_provider().add_span_processor(span_processor)
            
            self.tracer = trace.get_tracer(self.service_name, self.service_version)
            
            # Setup metrics
            if self.otlp_endpoint:
                metric_exporter = OTLPMetricExporter(
                    endpoint=self.otlp_endpoint,
                    insecure=True
                )
                metric_reader = PeriodicExportingMetricReader(
                    exporter=metric_exporter,
                    export_interval_millis=10000  # 10 seconds
                )
                otel_metrics.set_meter_provider(MeterProvider(
                    resource=self._create_resource(),
                    metric_readers=[metric_reader]
                ))
            
            self.meter = otel_metrics.get_meter(self.service_name, self.service_version)
            
            # Auto-instrument common libraries
            AioHttpClientInstrumentor().instrument()
            PsutilInstrumentor().instrument()
            
            self.initialized = True
            logger.info("OpenTelemetry initialized",
                       service=self.service_name,
                       version=self.service_version,
                       endpoint=self.otlp_endpoint)
            
        except Exception as e:
            logger.error("Failed to initialize OpenTelemetry", error=str(e))
            self.initialized = False
    
    def _create_resource(self):
        """Create OpenTelemetry resource with service information."""
        from opentelemetry.sdk.resources import Resource
        return Resource.create({
            "service.name": self.service_name,
            "service.version": self.service_version,
            "service.instance.id": f"{self.service_name}-{int(time.time())}"
        })
    
    def start_span(self, name: str, **kwargs):
        """
        Create a new tracing span.
        
        Args:
            name: Span name
            **kwargs: Additional span attributes
            
        Returns:
            Span context manager or no-op context manager
        """
        if self.tracer:
            return self.tracer.start_as_current_span(name, attributes=kwargs)
        else:
            # Return a no-op context manager
            from contextlib import nullcontext
            return nullcontext()
    
    def record_otel_metric(self, name: str, value: float, 
                          metric_type: str = "counter", **labels):
        """
        Record a metric via OpenTelemetry.
        
        Args:
            name: Metric name
            value: Metric value
            metric_type: Type of metric (counter, gauge, histogram)
            **labels: Metric labels
        """
        if not self.meter:
            return
        
        try:
            if metric_type == "counter":
                counter = self.meter.create_counter(name)
                counter.add(value, labels)
            elif metric_type == "gauge":
                gauge = self.meter.create_gauge(name)
                gauge.set(value, labels)
            elif metric_type == "histogram":
                histogram = self.meter.create_histogram(name)
                histogram.record(value, labels)
        except Exception as e:
            logger.debug("Failed to record OpenTelemetry metric", 
                        name=name, error=str(e))


class SecurityMetrics:
    """
    Comprehensive Prometheus metrics for container security monitoring.
    
    Tracks:
    - Container events and anomalies
    - Vulnerability scan results
    - Alert delivery performance
    - System resource usage
    - Security policy violations
    """
    
    def __init__(self, registry: Optional[CollectorRegistry] = None,
                 enable_otel: bool = True, otlp_endpoint: Optional[str] = None):
        """
        Initialize metrics collectors.
        
        Args:
            registry: Custom Prometheus registry (uses default if None)
            enable_otel: Enable OpenTelemetry integration
            otlp_endpoint: OTLP collector endpoint for OpenTelemetry
        """
        self.registry = registry or CollectorRegistry()
        self._start_time = time.time()
        self._last_scrape = time.time()
        
        # Performance tracking
        self._response_times: deque = deque(maxlen=1000)
        self._active_operations: Dict[str, float] = {}
        
        # OpenTelemetry integration
        self.otel = None
        if enable_otel and OTEL_AVAILABLE:
            self.otel = OpenTelemetryIntegration(
                otlp_endpoint=otlp_endpoint
            )
        
        # Initialize all metrics
        self._init_container_metrics()
        self._init_security_metrics()
        self._init_performance_metrics()
        self._init_system_metrics()
        
        logger.info("Prometheus metrics initialized", 
                   registry_id=id(self.registry),
                   otel_enabled=self.otel is not None)
    
    def _init_container_metrics(self):
        """Initialize container-related metrics."""
        # Container events counter
        self.container_events_total = Counter(
            'container_events_total',
            'Total number of container events processed',
            ['event_type', 'container_name', 'severity'],
            registry=self.registry
        )
        
        # Container state tracking
        self.containers_monitored = Gauge(
            'containers_monitored_total',
            'Total number of containers currently being monitored',
            registry=self.registry
        )
        
        # Container anomalies
        self.container_anomalies_total = Counter(
            'container_anomalies_total', 
            'Total number of container anomalies detected',
            ['anomaly_type', 'container_name', 'severity'],
            registry=self.registry
        )
        
        # Container resource violations
        self.resource_violations_total = Counter(
            'container_resource_violations_total',
            'Total resource limit violations detected',
            ['resource_type', 'container_name', 'violation_type'],
            registry=self.registry
        )
    
    def _init_security_metrics(self):
        """Initialize security-focused metrics."""
        # Vulnerability scans
        self.vulnerability_scans_total = Counter(
            'vulnerability_scans_total',
            'Total number of vulnerability scans performed',
            ['scan_type', 'result', 'severity'],
            registry=self.registry
        )
        
        # Security policy violations
        self.policy_violations_total = Counter(
            'security_policy_violations_total',
            'Total security policy violations detected',
            ['policy_type', 'violation_severity', 'container_name'],
            registry=self.registry
        )
        
        # Privileged container tracking
        self.privileged_containers = Gauge(
            'privileged_containers_total',
            'Number of privileged containers currently running',
            registry=self.registry
        )
        
        # Network security events
        self.network_events_total = Counter(
            'network_security_events_total',
            'Total network security events detected',
            ['event_type', 'source_type', 'severity'],
            registry=self.registry
        )
        
        # File system security events
        self.filesystem_events_total = Counter(
            'filesystem_security_events_total',
            'Total filesystem security events detected',
            ['event_type', 'path_type', 'operation'],
            registry=self.registry
        )
    
    def _init_performance_metrics(self):
        """Initialize performance and alerting metrics."""
        # Alert response times
        self.alert_response_time_seconds = Histogram(
            'alert_response_time_seconds',
            'Time taken to process and send alerts',
            ['alert_type', 'delivery_method'],
            buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
            registry=self.registry
        )
        
        # Alert delivery success/failure
        self.alerts_sent_total = Counter(
            'alerts_sent_total',
            'Total alerts sent by delivery method',
            ['delivery_method', 'status'],
            registry=self.registry
        )
        
        # Processing latency
        self.event_processing_duration_seconds = Histogram(
            'event_processing_duration_seconds',
            'Time taken to process security events',
            ['event_type', 'processor'],
            buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0],
            registry=self.registry
        )
        
        # Queue depths
        self.processing_queue_size = Gauge(
            'processing_queue_size',
            'Current size of event processing queue',
            ['queue_type'],
            registry=self.registry
        )
    
    def _init_system_metrics(self):
        """Initialize system and operational metrics."""
        # System info
        self.monitor_info = Info(
            'container_monitor_info',
            'Container monitor version and build information',
            registry=self.registry
        )
        
        # Monitor uptime
        self.monitor_uptime_seconds = Gauge(
            'monitor_uptime_seconds',
            'Container monitor uptime in seconds',
            registry=self.registry
        )
        
        # Error rates
        self.errors_total = Counter(
            'monitor_errors_total',
            'Total errors encountered by component',
            ['component', 'error_type'],
            registry=self.registry
        )
        
        # Resource usage
        self.memory_usage_bytes = Gauge(
            'monitor_memory_usage_bytes',
            'Memory usage by component',
            ['component'],
            registry=self.registry
        )
        
        self.cpu_usage_percent = Gauge(
            'monitor_cpu_usage_percent',
            'CPU usage percentage by component',
            ['component'],
            registry=self.registry
        )
    
    def record_container_event(self, event_type: str, container_name: str, 
                             severity: str = "info") -> None:
        """
        Record a container event.
        
        Args:
            event_type: Type of container event
            container_name: Name of the container
            severity: Event severity level
        """
        # Record Prometheus metric
        self.container_events_total.labels(
            event_type=event_type,
            container_name=container_name,
            severity=severity
        ).inc()
        
        # Record OpenTelemetry metric if available
        if self.otel:
            with self.otel.start_span("container_event_recorded",
                                    event_type=event_type,
                                    container_name=container_name,
                                    severity=severity):
                self.otel.record_otel_metric(
                    "container_events_total",
                    1.0,
                    "counter",
                    event_type=event_type,
                    container_name=container_name,
                    severity=severity
                )
        
        logger.debug("Container event recorded",
                    event_type=event_type,
                    container=container_name,
                    severity=severity)
    
    def record_vulnerability_scan(self, scan_type: str, result: str, 
                                severity: str = "unknown") -> None:
        """
        Record a vulnerability scan result.
        
        Args:
            scan_type: Type of vulnerability scan
            result: Scan result (clean, vulnerable, error)
            severity: Vulnerability severity if found
        """
        self.vulnerability_scans_total.labels(
            scan_type=scan_type,
            result=result,
            severity=severity
        ).inc()
        
        logger.debug("Vulnerability scan recorded",
                    scan_type=scan_type,
                    result=result,
                    severity=severity)
    
    @contextmanager
    def time_alert_response(self, alert_type: str, delivery_method: str = "webhook"):
        """
        Context manager to time alert response duration.
        
        Args:
            alert_type: Type of alert being sent
            delivery_method: Method used to deliver alert
        """
        start_time = time.time()
        operation_id = f"{alert_type}_{delivery_method}_{start_time}"
        self._active_operations[operation_id] = start_time
        
        try:
            yield
            # Success case
            duration = time.time() - start_time
            self.alert_response_time_seconds.labels(
                alert_type=alert_type,
                delivery_method=delivery_method
            ).observe(duration)
            
            self.alerts_sent_total.labels(
                delivery_method=delivery_method,
                status="success"
            ).inc()
            
            self._response_times.append(duration)
            
        except Exception as e:
            # Failure case
            duration = time.time() - start_time
            self.alert_response_time_seconds.labels(
                alert_type=alert_type,
                delivery_method=delivery_method
            ).observe(duration)
            
            self.alerts_sent_total.labels(
                delivery_method=delivery_method,
                status="failed"
            ).inc()
            
            logger.error("Alert delivery failed",
                        alert_type=alert_type,
                        delivery_method=delivery_method,
                        duration=duration,
                        error=str(e))
            raise
        finally:
            self._active_operations.pop(operation_id, None)
    
    @contextmanager
    def time_event_processing(self, event_type: str, processor: str):
        """
        Context manager to time event processing duration.
        
        Args:
            event_type: Type of event being processed
            processor: Name of the processor component
        """
        start_time = time.time()
        try:
            yield
        finally:
            duration = time.time() - start_time
            self.event_processing_duration_seconds.labels(
                event_type=event_type,
                processor=processor
            ).observe(duration)
    
    def record_anomaly(self, anomaly_type: str, container_name: str,
                      severity: str = "medium") -> None:
        """Record a container anomaly detection."""
        self.container_anomalies_total.labels(
            anomaly_type=anomaly_type,
            container_name=container_name,
            severity=severity
        ).inc()
    
    def record_policy_violation(self, policy_type: str, container_name: str,
                              severity: str = "medium") -> None:
        """Record a security policy violation."""
        self.policy_violations_total.labels(
            policy_type=policy_type,
            violation_severity=severity,
            container_name=container_name
        ).inc()
    
    def record_network_event(self, event_type: str, source_type: str,
                           severity: str = "info") -> None:
        """Record a network security event."""
        self.network_events_total.labels(
            event_type=event_type,
            source_type=source_type,
            severity=severity
        ).inc()
    
    def record_filesystem_event(self, event_type: str, path_type: str,
                               operation: str) -> None:
        """Record a filesystem security event."""
        self.filesystem_events_total.labels(
            event_type=event_type,
            path_type=path_type,
            operation=operation
        ).inc()
    
    def record_error(self, component: str, error_type: str) -> None:
        """Record an error by component."""
        self.errors_total.labels(
            component=component,
            error_type=error_type
        ).inc()
    
    def update_container_count(self, count: int) -> None:
        """Update the count of monitored containers."""
        self.containers_monitored.set(count)
    
    def update_privileged_count(self, count: int) -> None:
        """Update the count of privileged containers."""
        self.privileged_containers.set(count)
    
    def update_queue_size(self, queue_type: str, size: int) -> None:
        """Update processing queue size."""
        self.processing_queue_size.labels(queue_type=queue_type).set(size)
    
    def update_resource_usage(self, component: str, memory_bytes: float,
                            cpu_percent: float) -> None:
        """Update resource usage metrics."""
        self.memory_usage_bytes.labels(component=component).set(memory_bytes)
        self.cpu_usage_percent.labels(component=component).set(cpu_percent)
    
    def update_monitor_info(self, version: str, build_time: str,
                          commit_hash: str = "unknown") -> None:
        """Update monitor information."""
        self.monitor_info.info({
            'version': version,
            'build_time': build_time,
            'commit_hash': commit_hash,
            'python_version': f"{__import__('sys').version_info.major}.{__import__('sys').version_info.minor}"
        })
    
    def update_uptime(self) -> None:
        """Update monitor uptime."""
        uptime = time.time() - self._start_time
        self.monitor_uptime_seconds.set(uptime)
    
    def get_metrics_summary(self) -> Dict[str, Any]:
        """
        Get a summary of current metrics.
        
        Returns:
            Dictionary with metrics summary
        """
        current_time = time.time()
        scrape_interval = current_time - self._last_scrape
        self._last_scrape = current_time
        
        return {
            'uptime_seconds': current_time - self._start_time,
            'scrape_interval_seconds': scrape_interval,
            'active_operations': len(self._active_operations),
            'avg_response_time': (
                sum(self._response_times) / len(self._response_times)
                if self._response_times else 0
            ),
            'response_time_samples': len(self._response_times)
        }
    
    def export_metrics(self, openmetrics_format: bool = False) -> tuple[str, str]:
        """
        Export metrics in Prometheus format.
        
        Args:
            openmetrics_format: Use OpenMetrics format instead of Prometheus
            
        Returns:
            Tuple of (metrics_data, content_type)
        """
        # Update uptime before export
        self.update_uptime()
        
        # Generate metrics
        metrics_data = generate_latest(self.registry)
        
        content_type = (
            OPENMETRICS_CONTENT_TYPE if openmetrics_format 
            else CONTENT_TYPE_LATEST
        )
        
        return metrics_data.decode('utf-8'), content_type


class MetricsServer:
    """
    HTTP server for serving Prometheus metrics.
    
    Provides /metrics endpoint for Prometheus scraping.
    """
    
    def __init__(self, metrics: SecurityMetrics, port: int = 8000,
                 host: str = "0.0.0.0"):
        """
        Initialize metrics server.
        
        Args:
            metrics: SecurityMetrics instance
            port: HTTP server port
            host: HTTP server host
        """
        self.metrics = metrics
        self.port = port
        self.host = host
        self._server = None
        
    def start(self) -> None:
        """Start the metrics HTTP server."""
        try:
            self._server = start_http_server(
                port=self.port,
                addr=self.host,
                registry=self.metrics.registry
            )
            logger.info("Metrics server started",
                       host=self.host,
                       port=self.port)
        except Exception as e:
            logger.error("Failed to start metrics server",
                        host=self.host,
                        port=self.port,
                        error=str(e))
            raise
    
    def stop(self) -> None:
        """Stop the metrics HTTP server."""
        if self._server:
            self._server.shutdown()
            logger.info("Metrics server stopped")


class MetricsPusher:
    """
    Push gateway integration for metrics delivery.
    
    Useful for batch jobs or when pull-based metrics aren't suitable.
    """
    
    def __init__(self, metrics: SecurityMetrics, gateway_url: str,
                 job_name: str = "container-monitor"):
        """
        Initialize metrics pusher.
        
        Args:
            metrics: SecurityMetrics instance
            gateway_url: Prometheus push gateway URL
            job_name: Job name for grouping metrics
        """
        self.metrics = metrics
        self.gateway_url = gateway_url
        self.job_name = job_name
        
    def push_metrics(self, additional_labels: Optional[Dict[str, str]] = None) -> bool:
        """
        Push metrics to the gateway.
        
        Args:
            additional_labels: Optional additional labels for the metrics
            
        Returns:
            True if push succeeded
        """
        try:
            # Update uptime before push
            self.metrics.update_uptime()
            
            # Push to gateway
            push_to_gateway(
                gateway=self.gateway_url,
                job=self.job_name,
                registry=self.metrics.registry,
                grouping_key=additional_labels or {}
            )
            
            logger.info("Metrics pushed to gateway",
                       gateway=self.gateway_url,
                       job=self.job_name)
            return True
            
        except Exception as e:
            logger.error("Failed to push metrics",
                        gateway=self.gateway_url,
                        error=str(e))
            return False


# Global metrics instance for easy access
_global_metrics: Optional[SecurityMetrics] = None


def get_metrics() -> SecurityMetrics:
    """Get the global metrics instance."""
    global _global_metrics
    if _global_metrics is None:
        _global_metrics = SecurityMetrics()
    return _global_metrics


def initialize_metrics(version: str = "2.0.0", 
                      build_time: Optional[str] = None,
                      enable_otel: bool = True,
                      otlp_endpoint: Optional[str] = None) -> SecurityMetrics:
    """
    Initialize global metrics instance.
    
    Args:
        version: Monitor version
        build_time: Build timestamp
        enable_otel: Enable OpenTelemetry integration
        otlp_endpoint: OTLP collector endpoint
        
    Returns:
        Initialized SecurityMetrics instance
    """
    global _global_metrics
    _global_metrics = SecurityMetrics(
        enable_otel=enable_otel,
        otlp_endpoint=otlp_endpoint
    )
    
    if build_time is None:
        build_time = datetime.now(timezone.utc).isoformat()
    
    _global_metrics.update_monitor_info(version, build_time)
    
    logger.info("Global metrics initialized",
               version=version,
               build_time=build_time,
               otel_enabled=enable_otel and OTEL_AVAILABLE,
               otlp_endpoint=otlp_endpoint)
    
    return _global_metrics


if __name__ == "__main__":
    # Example usage and testing
    import psutil
    import random
    
    # Initialize metrics
    metrics = initialize_metrics("2.0.0-dev")
    
    # Simulate some metrics
    for i in range(10):
        # Container events
        metrics.record_container_event("created", f"container-{i}", "info")
        metrics.record_container_event("started", f"container-{i}", "info")
        
        # Vulnerability scans
        result = random.choice(["clean", "vulnerable", "error"])
        severity = random.choice(["low", "medium", "high"]) if result == "vulnerable" else "none"
        metrics.record_vulnerability_scan("image_scan", result, severity)
        
        # Alert timing
        with metrics.time_alert_response("security_violation", "webhook"):
            time.sleep(random.uniform(0.01, 0.1))  # Simulate processing time
    
    # Update system metrics
    process = psutil.Process()
    memory_info = process.memory_info()
    metrics.update_resource_usage("monitor", memory_info.rss, process.cpu_percent())
    metrics.update_container_count(25)
    metrics.update_privileged_count(3)
    
    # Export metrics
    metrics_data, content_type = metrics.export_metrics()
    print(f"Content-Type: {content_type}")
    print(f"Metrics exported: {len(metrics_data)} bytes")
    print("\nSample metrics:")
    print(metrics_data[:500] + "..." if len(metrics_data) > 500 else metrics_data)