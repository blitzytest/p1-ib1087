#!/usr/bin/env bash

# Mint Clone Logging Infrastructure Deployment Script
# Version: 1.0.0
# Purpose: Deploy ELK Stack with high availability and security features

set -euo pipefail

# Global Variables
NAMESPACE="logging"
ELASTICSEARCH_VERSION="8.0.0"
FLUENTD_VERSION="3.1.0"
KIBANA_VERSION="8.0.0"
RETENTION_DAYS="365"
MIN_MASTER_NODES="2"
REPLICA_COUNT="3"

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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check required tools
    command -v kubectl >/dev/null 2>&1 || { log_error "kubectl is required but not installed."; exit 1; }
    command -v helm >/dev/null 2>&1 || { log_error "helm is required but not installed."; exit 1; }
    
    # Check versions
    KUBECTL_VERSION=$(kubectl version --client -o json | jq -r '.clientVersion.major + "." + .clientVersion.minor' 2>/dev/null)
    HELM_VERSION=$(helm version --template="{{ .Version }}" | cut -d "." -f1,2 | tr -d "v")
    
    if [[ "${KUBECTL_VERSION}" < "1.25" ]]; then
        log_error "kubectl version must be >= 1.25. Found: ${KUBECTL_VERSION}"
        exit 1
    fi
    
    if [[ "${HELM_VERSION}" < "3.0" ]]; then
        log_error "helm version must be >= 3.0. Found: ${HELM_VERSION}"
        exit 1
    }
    
    # Check cluster access
    if ! kubectl auth can-i create namespace --all-namespaces >/dev/null 2>&1; then
        log_error "Insufficient cluster permissions"
        exit 1
    }
    
    log_info "Prerequisites check passed"
    return 0
}

# Create and configure namespace
create_namespace() {
    log_info "Creating logging namespace..."
    
    if ! kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1; then
        kubectl create namespace "${NAMESPACE}"
        
        # Apply resource quota
        cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ResourceQuota
metadata:
  name: logging-quota
  namespace: ${NAMESPACE}
spec:
  hard:
    requests.cpu: "8"
    requests.memory: "16Gi"
    limits.cpu: "16"
    limits.memory: "32Gi"
    persistentvolumeclaims: "10"
EOF
        
        # Apply network policy
        cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: logging-network-policy
  namespace: ${NAMESPACE}
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
    - namespaceSelector:
        matchLabels:
          name: kube-system
EOF
    fi
    
    log_info "Namespace ${NAMESPACE} configured successfully"
    return 0
}

# Deploy Elasticsearch
deploy_elasticsearch() {
    log_info "Deploying Elasticsearch..."
    
    # Add Elastic Helm repo if not exists
    helm repo list | grep -q "elastic" || helm repo add elastic https://helm.elastic.co
    helm repo update
    
    # Generate secure passwords
    ELASTIC_PASSWORD=$(openssl rand -base64 32)
    
    # Create Elasticsearch secrets
    kubectl -n "${NAMESPACE}" create secret generic elasticsearch-credentials \
        --from-literal=username=elastic \
        --from-literal=password="${ELASTIC_PASSWORD}" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy Elasticsearch with custom values
    helm upgrade --install elasticsearch elastic/elasticsearch \
        --namespace "${NAMESPACE}" \
        --version "${ELASTICSEARCH_VERSION}" \
        --values infrastructure/k8s/logging/elasticsearch-values.yaml \
        --set clusterName=mint-clone-logging \
        --set replicas="${REPLICA_COUNT}" \
        --set minimumMasterNodes="${MIN_MASTER_NODES}" \
        --wait
    
    log_info "Elasticsearch deployed successfully"
    return 0
}

# Deploy Fluentd
deploy_fluentd() {
    log_info "Deploying Fluentd..."
    
    helm repo list | grep -q "fluent" || helm repo add fluent https://fluent.github.io/helm-charts
    helm repo update
    
    helm upgrade --install fluentd fluent/fluentd \
        --namespace "${NAMESPACE}" \
        --version "${FLUENTD_VERSION}" \
        --values infrastructure/k8s/logging/fluentd-values.yaml \
        --set elasticsearch.host=elasticsearch-master \
        --set elasticsearch.port=9200 \
        --wait
    
    log_info "Fluentd deployed successfully"
    return 0
}

# Deploy Kibana
deploy_kibana() {
    log_info "Deploying Kibana..."
    
    helm upgrade --install kibana elastic/kibana \
        --namespace "${NAMESPACE}" \
        --version "${KIBANA_VERSION}" \
        --values infrastructure/k8s/logging/kibana-values.yaml \
        --set elasticsearchHosts="http://elasticsearch-master:9200" \
        --wait
    
    log_info "Kibana deployed successfully"
    return 0
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check Elasticsearch cluster health
    local retries=0
    local max_retries=30
    local elasticsearch_status=""
    
    while [[ $retries -lt $max_retries ]]; do
        elasticsearch_status=$(kubectl -n "${NAMESPACE}" exec -it elasticsearch-master-0 -- \
            curl -s -k -u "elastic:${ELASTIC_PASSWORD}" \
            https://localhost:9200/_cluster/health | jq -r .status)
        
        if [[ "${elasticsearch_status}" == "green" ]]; then
            break
        fi
        
        retries=$((retries + 1))
        sleep 10
    done
    
    if [[ "${elasticsearch_status}" != "green" ]]; then
        log_error "Elasticsearch cluster is not healthy"
        return 1
    fi
    
    # Verify Fluentd pods
    if ! kubectl -n "${NAMESPACE}" wait --for=condition=ready pod -l app=fluentd --timeout=300s; then
        log_error "Fluentd pods are not ready"
        return 1
    fi
    
    # Verify Kibana
    if ! kubectl -n "${NAMESPACE}" wait --for=condition=ready pod -l app=kibana --timeout=300s; then
        log_error "Kibana pods are not ready"
        return 1
    }
    
    log_info "Deployment verification completed successfully"
    return 0
}

# Main deployment function
main() {
    log_info "Starting logging infrastructure deployment..."
    
    check_prerequisites || exit 1
    create_namespace || exit 1
    deploy_elasticsearch || exit 1
    deploy_fluentd || exit 1
    deploy_kibana || exit 1
    verify_deployment || exit 1
    
    log_info "Logging infrastructure deployment completed successfully"
    
    # Print access information
    echo -e "\n${GREEN}=== Access Information ===${NC}"
    echo "Kibana URL: https://kibana.mint-clone.internal"
    echo "Elasticsearch URL: https://elasticsearch-master:9200"
    echo "Elastic Username: elastic"
    echo "Elastic Password: ${ELASTIC_PASSWORD}"
}

# Execute main function
main "$@"