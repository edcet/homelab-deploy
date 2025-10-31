# 🐳 Docker Compose Deployment Branch

> **Production-ready Docker Compose and Podman deployments for bare-metal and VM infrastructure**

## 📍 Branch Purpose

This branch contains **pure Docker Compose / Podman** deployment configurations for homelab services **without Kubernetes orchestration**. Perfect for:
- Bare-metal servers
- Virtual machines (Proxmox, ESXi, etc.)
- Single-node deployments
- Systemd-managed container services
- Rootless Podman deployments

---

## 🎯 Quick Start

### Prerequisites
- Docker or Podman installed
- Docker Compose or podman-compose
- systemd (for service management)
- Basic networking configuration

### Deploy Gateway Services

```bash
# Clone this branch
git clone -b docker-deploy https://github.com/edcet/homelab-deploy.git
cd homelab-deploy/gateway

# Copy and configure environment
cp .env.template .env
# Edit .env with your configuration

# Deploy with Docker Compose
docker-compose -f compose/compose.yaml up -d

# OR with Podman
podman-compose -f compose/compose.yaml up -d
```

### Enable systemd Auto-Start

```bash
# Install systemd service
sudo cp gateway/systemd/watcher.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now watcher.service

# Check status
sudo systemctl status watcher.service
```

---

## 📁 Repository Structure (Docker Branch)

```
docker-deploy/
├── gateway/                     # Gateway services
│   ├── compose/
│   │   ├── compose.yaml         # Main compose file
│   │   └── *.yml                # Host-specific overrides
│   ├── scripts/
│   │   └── watcher.py           # Service monitoring
│   ├── systemd/
│   │   └── watcher.service      # systemd unit
│   └── README.md                # Gateway docs
├── maintenance/                # Health checks & scripts
│   └── health.sh
└── README.md                   # This file
```

---

## 🛠️ Available Services

### Gateway Stack (`gateway/compose/`)

The gateway compose stack includes:
- **Traefik** - Reverse proxy with automatic HTTPS
- **Cloudflared** - Cloudflare Tunnel client
- **Service Discovery** - Dynamic service registration
- **Monitoring Exporters** - Metrics for Prometheus

### Host-Specific Configurations

- `compose.yaml` - Base configuration
- `podman-compose.yml` - General Podman deployment
- `podman-compose-gerbil.yml` - Host "gerbil" specific
- `podman-compose-pangolin.yml` - Host "pangolin" specific

---

## ⚙️ Configuration

### Environment Variables

Create `.env` file in `gateway/` directory:

```bash
# Network
TRAEFIK_DOMAIN=example.com
CLOUDFLARE_API_TOKEN=your_token_here

# Tailscale
TAILSCALE_AUTHKEY=tskey-auth-xxx

# Monitoring
PROMETHEUS_ENDPOINT=http://monitoring:9090
```

### Systemd Integration

The `watcher.service` provides:
- Automatic service restart on failure
- Log management via journald
- Clean shutdown/startup sequencing
- Health check monitoring

---

## 🔗 Integration with Other Branches

### Combine with Monitoring Stack

Add monitoring to Docker deployments:

```bash
# From monitoring-stack branch
git checkout monitoring-stack -- kustomize/olares/monitoring

# Adapt K8s manifests to Docker Compose or deploy separately
```

### Migrate to Kubernetes

Ready to scale? See **[k8s-deploy](../../tree/k8s-deploy)** branch for Kubernetes manifests.

### Full IaC Provisioning

Want to provision VMs with Pulumi? See **[pulumi-deploy](../../tree/pulumi-deploy)** branch.

---

## 🐛 Troubleshooting

### Check Container Status

```bash
docker-compose ps
# OR
podman-compose ps
```

### View Logs

```bash
docker-compose logs -f
# OR
podman-compose logs -f

# systemd service logs
journalctl -u watcher.service -f
```

### Restart Services

```bash
docker-compose restart
# OR
sudo systemctl restart watcher.service
```

### Health Checks

```bash
# Run health check script
bash maintenance/health.sh
```

---

## 📖 Additional Resources

- **Gateway README**: [gateway/README.md](gateway/README.md)
- **Main Branch**: [../../tree/main](../../tree/main) - Full repository overview
- **Issue Tracker**: [../../issues](../../issues)
- **Restructuring Plan**: [Issue #2](../../issues/2)

---

## 🔄 Branch Navigation

Switch to other deployment patterns:

| Branch | Purpose |
|--------|----------|
| **[main](../../tree/main)** | Active development & integration |
| **[k8s-deploy](../../tree/k8s-deploy)** | Kubernetes + Kustomize |
| **[pulumi-deploy](../../tree/pulumi-deploy)** | Pulumi IaC provisioning |
| **[monitoring-stack](../../tree/monitoring-stack)** | Standalone monitoring |
| **docker-deploy** | ➡️ You are here |

---

## ✅ Production Checklist

- [ ] Copy and configure `.env` file
- [ ] Update domain names and API tokens
- [ ] Test compose deployment: `docker-compose up`
- [ ] Install systemd service for auto-restart
- [ ] Configure firewall rules
- [ ] Set up log rotation
- [ ] Add health check monitoring
- [ ] Document backup procedures

---

## 📝 License

MIT - Free for personal homelab use.
