#!/bin/bash

# Deploy Monitoring Stack Script v1.0.0
# Deploys and configures Prometheus, Grafana, and AlertManager for the Mint Clone application
# Required versions:
# - helm v3.11+
# - kubectl v1.25+
# - kube-prometheus-stack v45.7.1

set -euo pipefail

# Global variables
readonly MONITORING_NAMESPACE="monitoring"
readonly HELM_TIMEOUT="600s"
readonly HELM_RELEASE_NAME="mint-monitoring"
readonly RETRY_ATTEMPTS=3
readonly HEALTH_CHECK_INTERVAL="10s"
readonly ROLLBACK_TIMEOUT="300s"

# Logging functions
log_info() {
    echo "[INFO] $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

log_warning() {
    echo "[WARN] $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Error handling
handle_error() {
    local exit_code=$?
    log_error "An error occurred on line $1"
    cleanup
    exit $exit_code
}

trap 'handle_error $LINENO' ERR

# Cleanup function
cleanup() {
    log_info "Performing cleanup..."
    if [[ -n "${TEMP_DIR:-}" ]]; then
        rm -rf "$TEMP_DIR"
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        return 1
    fi
    
    # Check helm
    if ! command -v helm &> /dev/null; then
        log_error "helm is not installed"
        return 1
    fi
    
    # Check cluster access
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Unable to access Kubernetes cluster"
        return 1
    }
    
    # Verify helm repos
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    
    return 0
}

# Create and configure monitoring namespace
create_namespace() {
    log_info "Creating monitoring namespace..."
    
    if ! kubectl get namespace "$MONITORING_NAMESPACE" &> /dev/null; then
        kubectl create namespace "$MONITORING_NAMESPACE"
    fi
    
    # Apply resource quotas
    kubectl apply -f - <<EOF
apiVersion: v1
kind: ResourceQuota
metadata:
  name: monitoring-quota
  namespace: $MONITORING_NAMESPACE
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
EOF
    
    # Apply network policies
    kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: monitoring-network-policy
  namespace: $MONITORING_NAMESPACE
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: default
  egress:
  - to:
    - namespaceSelector: {}
EOF
}

# Deploy monitoring stack
deploy_monitoring_stack() {
    log_info "Deploying monitoring stack..."
    
    # Add required labels to namespace
    kubectl label namespace "$MONITORING_NAMESPACE" \
        monitoring=enabled \
        prometheus=enabled \
        --overwrite
    
    # Deploy prometheus-operator stack
    helm upgrade --install "$HELM_RELEASE_NAME" prometheus-community/kube-prometheus-stack \
        --namespace "$MONITORING_NAMESPACE" \
        --timeout "$HELM_TIMEOUT" \
        --values infrastructure/k8s/monitoring/prometheus-values.yaml \
        --values infrastructure/k8s/monitoring/grafana-values.yaml \
        --values infrastructure/k8s/monitoring/alertmanager-values.yaml \
        --set prometheus.prometheusSpec.retention=15d \
        --set prometheus.prometheusSpec.replicaCount=2 \
        --wait
}

# Configure alerting
configure_alerting() {
    log_info "Configuring alerting rules and notification channels..."
    
    # Apply custom alert rules
    kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: mint-clone-alerts
  namespace: $MONITORING_NAMESPACE
spec:
  groups:
  - name: mint-clone.rules
    rules:
    - alert: HighResponseTime
      expr: rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m]) > 0.5
      for: 5m
      labels:
        severity: warning
      annotations:
        description: "High response time detected"
        summary: "Service response time is above threshold"
    - alert: HighErrorRate
      expr: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.05
      for: 5m
      labels:
        severity: critical
      annotations:
        description: "High error rate detected"
        summary: "Service error rate is above threshold"
EOF
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    local retry=0
    while [ $retry -lt $RETRY_ATTEMPTS ]; do
        if kubectl get pods -n "$MONITORING_NAMESPACE" | grep -q "Running"; then
            # Check Prometheus endpoint
            if kubectl port-forward -n "$MONITORING_NAMESPACE" svc/prometheus-operated 9090:9090 &>/dev/null & then
                sleep 5
                if curl -s http://localhost:9090/-/healthy &>/dev/null; then
                    log_info "Prometheus is healthy"
                    pkill -f "port-forward.*9090:9090"
                    return 0
                fi
            fi
        fi
        
        log_warning "Verification attempt $((retry + 1)) failed, retrying..."
        sleep "$HEALTH_CHECK_INTERVAL"
        ((retry++))
    done
    
    log_error "Deployment verification failed after $RETRY_ATTEMPTS attempts"
    return 1
}

# Main deployment function
main() {
    log_info "Starting monitoring stack deployment..."
    
    if ! check_prerequisites; then
        log_error "Prerequisites check failed"
        exit 1
    fi
    
    create_namespace
    deploy_monitoring_stack
    configure_alerting
    
    if ! verify_deployment; then
        log_error "Deployment verification failed"
        exit 1
    fi
    
    log_info "Monitoring stack deployment completed successfully"
}

# Execute main function
main "$@"