# 📊 Monitoring Stack Branch

> **Production-ready monitoring with Prometheus, Grafana, and AlertManager**

## 📍 Branch Purpose

Standalone monitoring stack for any infrastructure. Deploy on Docker, Kubernetes, or bare-metal.

---

## 🎯 Quick Start

### For Kubernetes

```bash
git clone -b monitoring-stack https://github.com/edcet/homelab-deploy.git
cd homelab-deploy
kubectl apply -k kustomize/olares/monitoring
```

### For Docker Compose

```bash
# Coming soon - Docker Compose version
# See docker-deploy branch for gateway monitoring
```

---

## 📁 Repository Structure

```
monitoring-stack/
├── kustomize/olares/monitoring/
│   ├── kustomization.yaml
│   ├── prometheus/
│   ├── grafana/
│   └── alertmanager/
└── README.md
```

---

## 🛠️ Stack Components

- **Prometheus** - Metrics collection
- **Grafana** - Dashboards and visualization
- **AlertManager** - Alert routing (ntfy, Pushover, email)
- **Node Exporter** - Host metrics
- **kube-state-metrics** - K8s metrics (if on K8s)

---

## ⚙️ Configuration

### Alert Destinations

Configure AlertManager for ntfy or Pushover:

```yaml
# alertmanager.yml
receivers:
  - name: 'ntfy'
    webhook_configs:
      - url: 'https://ntfy.sh/your-topic'
  - name: 'pushover'
    pushover_configs:
      - user_key: 'your-user-key'
        token: 'your-app-token'
```

---

## 🔗 Integration

Combine with other deployment branches:

- **[docker-deploy](../../tree/docker-deploy)** - Monitor Docker containers
- **[k8s-deploy](../../tree/k8s-deploy)** - Monitor K8s clusters
- **[pulumi-deploy](../../tree/pulumi-deploy)** - Monitor provisioned VMs

---

## 🔄 Branch Navigation

| Branch | Purpose |
|--------|----------|
| **[main](../../tree/main)** | Active development |
| **[docker-deploy](../../tree/docker-deploy)** | Docker Compose |
| **[k8s-deploy](../../tree/k8s-deploy)** | Kubernetes |
| **[pulumi-deploy](../../tree/pulumi-deploy)** | Pulumi IaC |
| **monitoring-stack** | ➡️ You are here |

---

## ✅ Checklist

- [ ] Deploy Prometheus
- [ ] Configure Grafana dashboards
- [ ] Set up AlertManager routing
- [ ] Configure scrape targets
- [ ] Test alerting

---

## 📝 License

MIT - Free for personal homelab use.
