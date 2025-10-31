# ☸️ Kubernetes Deployment Branch

> **Production-ready Kubernetes manifests with Kustomize for GitOps workflows**

## 📍 Branch Purpose

This branch contains **Kubernetes manifests and Kustomize configurations** for deploying homelab services on existing Kubernetes clusters. Perfect for:
- K3s clusters (single or multi-node)
- K8s clusters (vanilla Kubernetes)
- Talos Linux clusters
- GitOps workflows (ArgoCD, Flux CD)
- Declarative cluster state management

---

## 🎯 Quick Start

### Prerequisites
- Kubernetes cluster (K3s, K8s, Talos, etc.)
- kubectl configured
- kustomize (or kubectl with built-in kustomize)
- Optional: ArgoCD or Flux CD for GitOps

### Deploy Monitoring Stack

```bash
# Clone this branch
git clone -b k8s-deploy https://github.com/edcet/homelab-deploy.git
cd homelab-deploy

# Deploy with kustomize
kubectl apply -k kustomize/olares/monitoring

# OR with kubectl kustomize
kubectl kustomize kustomize/olares/monitoring | kubectl apply -f -

# Check deployment
kubectl get pods -n monitoring
kubectl get svc -n monitoring
```

### Deploy with ArgoCD (GitOps)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: monitoring-stack
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/edcet/homelab-deploy.git
    targetRevision: k8s-deploy
    path: kustomize/olares/monitoring
  destination:
    server: https://kubernetes.default.svc
    namespace: monitoring
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

---

## 📁 Repository Structure (K8s Branch)

```
k8s-deploy/
├── kustomize/
│   └── olares/
│       └── monitoring/               # Monitoring stack
│           ├── kustomization.yaml       # Kustomize manifest
│           ├── prometheus.yaml          # Prometheus config
│           ├── grafana.yaml             # Grafana dashboard
│           └── alertmanager.yaml        # Alert routing
└── README.md                       # This file
```

---

## 🛠️ Available Manifests

### Monitoring Stack (`kustomize/olares/monitoring/`)

**Components:**
- **Prometheus** - Metrics collection and storage
- **Grafana** - Visualization and dashboards
- **AlertManager** - Alert routing (ntfy, Pushover)
- **Node Exporter** - Host metrics
- **kube-state-metrics** - Kubernetes metrics

**Features:**
- Pre-configured Grafana dashboards
- Alert rules for common issues
- PersistentVolumeClaim for data retention
- Ingress configurations for external access
- ServiceMonitor for automatic scraping

---

## ⚙️ Configuration

### Kustomize Overlays

Create environment-specific overlays:

```bash
kustomize/
├── base/              # Base manifests
└── overlays/
    ├── dev/           # Development cluster
    ├── staging/       # Staging cluster
    └── production/    # Production cluster
```

### Customize with Kustomize

```yaml
# kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base/monitoring

namespace: monitoring-prod

patchesStrategicMerge:
  - replica-count.yaml
  - storage-class.yaml

configMapGenerator:
  - name: monitoring-config
    literals:
      - PROMETHEUS_RETENTION=30d
      - GRAFANA_DOMAIN=grafana.example.com
```

### Secrets Management

```bash
# Create secrets using kubectl
kubectl create secret generic grafana-admin \
  --from-literal=username=admin \
  --from-literal=password=securepassword \
  -n monitoring

# OR use sealed-secrets, SOPS, or external-secrets
```

---

## 🔗 Integration with Other Branches

### Add Docker Services to K8s

Migrate from Docker Compose (**[docker-deploy](../../tree/docker-deploy)**) to K8s:

```bash
# Use kompose to convert compose to K8s manifests
kompose convert -f ../docker-deploy/gateway/compose/compose.yaml
```

### Infrastructure Provisioning

Provision K8s cluster with Pulumi (**[pulumi-deploy](../../tree/pulumi-deploy)**), then deploy with these manifests.

### Standalone Monitoring

See **[monitoring-stack](../../tree/monitoring-stack)** branch for expanded monitoring configurations.

---

## 🐛 Troubleshooting

### Check Pod Status

```bash
# List all pods
kubectl get pods -A

# Describe pod for details
kubectl describe pod <pod-name> -n <namespace>

# Check logs
kubectl logs <pod-name> -n <namespace> -f
```

### Validate Manifests

```bash
# Dry-run to validate
kubectl apply -k kustomize/olares/monitoring --dry-run=client

# Validate with kubeval
kubeval kustomize/olares/monitoring/*.yaml
```

### Common Issues

**ImagePullBackOff:**
```bash
# Check image pull secrets
kubectl get secrets -n <namespace>
kubectl describe pod <pod-name> -n <namespace>
```

**CrashLoopBackOff:**
```bash
# Check logs and resource limits
kubectl logs <pod-name> -n <namespace> --previous
kubectl top pods -n <namespace>
```

**PVC Pending:**
```bash
# Check storage class and provisioner
kubectl get sc
kubectl get pvc -A
kubectl describe pvc <pvc-name> -n <namespace>
```

---

## 📖 Additional Resources

- **Kustomize Docs**: https://kustomize.io/
- **ArgoCD Guide**: https://argo-cd.readthedocs.io/
- **Flux CD Guide**: https://fluxcd.io/docs/
- **Main Branch**: [../../tree/main](../../tree/main)
- **Issue Tracker**: [../../issues](../../issues)
- **Restructuring Plan**: [Issue #2](../../issues/2)

---

## 🔄 Branch Navigation

Switch to other deployment patterns:

| Branch | Purpose |
|--------|----------|
| **[main](../../tree/main)** | Active development & integration |
| **[docker-deploy](../../tree/docker-deploy)** | Docker Compose + Podman |
| **[pulumi-deploy](../../tree/pulumi-deploy)** | Pulumi IaC provisioning |
| **[monitoring-stack](../../tree/monitoring-stack)** | Standalone monitoring |
| **k8s-deploy** | ➡️ You are here |

---

## ✅ Production Checklist

- [ ] Configure kubectl context to target cluster
- [ ] Create required namespaces
- [ ] Set up RBAC policies and service accounts
- [ ] Configure storage classes and PVCs
- [ ] Create secrets for sensitive data
- [ ] Validate manifests with dry-run
- [ ] Set resource limits and requests
- [ ] Configure Ingress and TLS certificates
- [ ] Set up monitoring and alerting
- [ ] Document backup and disaster recovery procedures

---

## 🔐 GitOps Best Practices

1. **Never apply manually** - Always commit changes to Git first
2. **Use overlays** - Separate configs for dev/staging/prod
3. **Seal secrets** - Never commit plaintext secrets
4. **Version control** - Tag releases for rollback capability
5. **Auto-sync carefully** - Enable on stable environments only
6. **Monitor drift** - Alert on out-of-sync resources

---

## 📝 License

MIT - Free for personal homelab use.
