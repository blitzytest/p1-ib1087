#!/usr/bin/env bash

# Mint Clone Kubernetes Cluster Initialization Script
# Version: 1.0.0
# This script initializes and configures a production-grade Kubernetes cluster
# with advanced security, monitoring, and high availability features.

set -euo pipefail

# Default values for required environment variables
: "${CLUSTER_NAME:?Must set CLUSTER_NAME}"
: "${AWS_REGION:?Must set AWS_REGION}"
: "${ENVIRONMENT:?Must set ENVIRONMENT}"
: "${ACM_CERTIFICATE_ARN:?Must set ACM_CERTIFICATE_ARN}"
: "${NODE_INSTANCE_TYPE:=t3.large}"
: "${MIN_NODES:=2}"
: "${MAX_NODES:=5}"
: "${DOMAIN_NAME:?Must set DOMAIN_NAME}"
: "${ALERTMANAGER_CONFIG:?Must set ALERTMANAGER_CONFIG}"
: "${BACKUP_BUCKET:?Must set BACKUP_BUCKET}"

# Constants
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELM_TIMEOUT="600s"
MONITORING_NAMESPACE="monitoring"
CERT_MANAGER_NAMESPACE="cert-manager"
INGRESS_NAMESPACE="ingress-nginx"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check required tools
    local required_tools=("kubectl" "helm" "aws")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool $tool is not installed"
            return 1
        fi
    done

    # Check kubectl version
    local kubectl_version
    kubectl_version=$(kubectl version --client -o json | jq -r '.clientVersion.gitVersion')
    if [[ ! "$kubectl_version" =~ v1\.2[5-9]\. ]]; then
        log_error "kubectl version must be >= 1.25.0"
        return 1
    fi

    # Check helm version
    local helm_version
    helm_version=$(helm version --template='{{.Version}}')
    if [[ ! "$helm_version" =~ v3\.1[1-9]\. ]]; then
        log_error "helm version must be >= 3.11.0"
        return 1
    }

    # Check AWS CLI configuration
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS CLI is not properly configured"
        return 1
    }

    # Verify cluster access
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot access Kubernetes cluster"
        return 1
    }

    log_info "All prerequisites checked successfully"
    return 0
}

# Function to create and configure namespaces
create_namespaces() {
    log_info "Creating namespaces..."

    local namespaces=("$MONITORING_NAMESPACE" "$CERT_MANAGER_NAMESPACE" "$INGRESS_NAMESPACE")
    
    for ns in "${namespaces[@]}"; do
        if ! kubectl get namespace "$ns" &> /dev/null; then
            kubectl create namespace "$ns"
            
            # Apply resource quotas
            kubectl apply -f - <<EOF
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-resources
  namespace: $ns
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
  name: default-deny
  namespace: $ns
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
EOF
        fi
    done

    log_info "Namespaces created and configured successfully"
}

# Function to install and configure cert-manager
install_cert_manager() {
    log_info "Installing cert-manager..."

    # Add jetstack helm repository
    helm repo add jetstack https://charts.jetstack.io
    helm repo update

    # Install cert-manager with custom values
    helm upgrade --install cert-manager jetstack/cert-manager \
        --namespace "$CERT_MANAGER_NAMESPACE" \
        --version v1.12.0 \
        --values "$SCRIPT_DIR/../k8s/cert-manager/cert-manager-values.yaml" \
        --timeout "$HELM_TIMEOUT" \
        --wait

    # Wait for cert-manager to be ready
    kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n "$CERT_MANAGER_NAMESPACE"

    log_info "cert-manager installed successfully"
}

# Function to install and configure ingress controller
install_ingress_controller() {
    log_info "Installing NGINX ingress controller..."

    # Add ingress-nginx repository
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo update

    # Install ingress-nginx with custom values
    helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
        --namespace "$INGRESS_NAMESPACE" \
        --values "$SCRIPT_DIR/../k8s/ingress/nginx-values.yaml" \
        --set controller.service.annotations."service\.beta\.kubernetes\.io/aws-load-balancer-ssl-cert"="$ACM_CERTIFICATE_ARN" \
        --timeout "$HELM_TIMEOUT" \
        --wait

    # Wait for ingress controller to be ready
    kubectl wait --for=condition=available --timeout=300s deployment/ingress-nginx-controller -n "$INGRESS_NAMESPACE"

    log_info "NGINX ingress controller installed successfully"
}

# Function to setup monitoring stack
setup_monitoring() {
    log_info "Setting up monitoring stack..."

    # Add prometheus-community repository
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update

    # Install prometheus-operator with custom values
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace "$MONITORING_NAMESPACE" \
        --values "$SCRIPT_DIR/../k8s/monitoring/prometheus-values.yaml" \
        --set alertmanager.config="$ALERTMANAGER_CONFIG" \
        --timeout "$HELM_TIMEOUT" \
        --wait

    # Wait for monitoring components to be ready
    local components=("prometheus-operator" "prometheus" "alertmanager" "grafana")
    for component in "${components[@]}"; do
        kubectl wait --for=condition=available --timeout=300s deployment/"$component" -n "$MONITORING_NAMESPACE"
    done

    log_info "Monitoring stack setup completed"
}

# Function to verify installation
verify_installation() {
    log_info "Verifying installation..."

    local verification_failed=0

    # Check pod status across namespaces
    local namespaces=("$MONITORING_NAMESPACE" "$CERT_MANAGER_NAMESPACE" "$INGRESS_NAMESPACE")
    for ns in "${namespaces[@]}"; do
        if ! kubectl get pods -n "$ns" | grep -q "Running"; then
            log_error "Pods in namespace $ns are not running properly"
            verification_failed=1
        fi
    done

    # Verify cert-manager functionality
    if ! kubectl get clusterissuers | grep -q "letsencrypt-prod"; then
        log_error "ClusterIssuer not configured properly"
        verification_failed=1
    fi

    # Verify ingress controller
    if ! kubectl get svc -n "$INGRESS_NAMESPACE" ingress-nginx-controller | grep -q "LoadBalancer"; then
        log_error "Ingress controller service not configured properly"
        verification_failed=1
    fi

    # Verify monitoring stack
    if ! kubectl get servicemonitors -n "$MONITORING_NAMESPACE" | grep -q "prometheus"; then
        log_error "ServiceMonitors not configured properly"
        verification_failed=1
    fi

    if [ $verification_failed -eq 0 ]; then
        log_info "Installation verified successfully"
        return 0
    else
        log_error "Installation verification failed"
        return 1
    fi
}

# Cleanup function
cleanup() {
    log_info "Performing cleanup..."
    
    # Remove temporary files if any
    rm -f /tmp/mint-cluster-*

    # Reset any failed installations if needed
    if [ "$1" -ne 0 ]; then
        log_warn "Installation failed, cleaning up resources..."
        helm uninstall prometheus -n "$MONITORING_NAMESPACE" || true
        helm uninstall cert-manager -n "$CERT_MANAGER_NAMESPACE" || true
        helm uninstall ingress-nginx -n "$INGRESS_NAMESPACE" || true
    fi
}

# Main function
main() {
    # Set up trap for cleanup
    trap 'cleanup $?' EXIT

    log_info "Starting cluster initialization for $CLUSTER_NAME in $AWS_REGION"

    # Execute initialization steps
    check_prerequisites || exit 1
    create_namespaces || exit 1
    install_cert_manager || exit 1
    install_ingress_controller || exit 1
    setup_monitoring || exit 1
    verify_installation || exit 1

    log_info "Cluster initialization completed successfully"
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi