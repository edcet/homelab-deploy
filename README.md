# VM-Centric Homelab Deployment on Proxmox 9

## 🚀 Deployment Options & Branch Navigation

This repository supports multiple deployment patterns through dedicated branches. Choose the approach that best fits your infrastructure:

| Branch | Stack | Use Case | Quick Start |
|--------|-------|----------|-------------|
| **[docker-deploy](../../tree/docker-deploy)** | Docker Compose + Podman + systemd | Bare-metal/VM container deployments without orchestration | Deploy gateway services, standalone apps |
| **[k8s-deploy](../../tree/k8s-deploy)** | Kubernetes + Kustomize + GitOps | Existing K8s/K3s/Talos clusters | Declarative K8s manifests for cluster deployment |
| **[pulumi-deploy](../../tree/pulumi-deploy)** | Pulumi TypeScript IaC | Full infrastructure provisioning (VMs, networks, cloud-init) | Complete homelab from code |
| **[monitoring-stack](../../tree/monitoring-stack)** | Prometheus + Grafana + AlertManager | Standalone monitoring/observability | Add monitoring to any deployment |
| **[main](../../tree/main)** | Integrated development | Active development, testing, integration | Current branch (you are here) |

### Branch-Specific Documentation

Each deployment branch contains:
- ✅ **Branch-specific README** with focused quick start guide
- ✅ **Production-ready configuration** for that deployment pattern
- ✅ **Prerequisites and dependencies** clearly documented
- ✅ **Deployment commands** and troubleshooting
- ✅ **Cross-branch integration guides** where applicable

### Deployment Pattern Selection Guide

**Choose `docker-deploy` if:**
- Running on bare-metal or VMs without Kubernetes
- Want simple Docker Compose deployments
- Need systemd integration for auto-restart
- Prefer Podman for rootless containers

**Choose `k8s-deploy` if:**
- Already have a Kubernetes cluster (K3s, K8s, Talos, etc.)
- Want GitOps-ready manifests
- Need declarative cluster state management
- Prefer Kustomize for configuration

**Choose `pulumi-deploy` if:**
- Need full infrastructure automation
- Want TypeScript-based IaC
- Provisioning VMs on Proxmox/cloud providers
- Require cloud-init bootstrapping

**Choose `monitoring-stack` if:**
- Adding observability to existing infrastructure
- Want standalone Prometheus + Grafana
- Need alerting via ntfy/Pushover
- Independent from other deployments

---

## Overview (Main Branch)

Implementation of the finalized architecture for a single-node Proxmox 9 homelab on Dell R240 (38GB RAM, 18TB ZFS, BOSS S1 SSD). Features:
- 4 isolated VMs: gw-01 (gateway), olares-01 (k3s orchestration), cosmos-01 (app hosting), ynh-01 (YunoHost services)
- Pure single-node k3s in olares-01 (no multi-cluster/Flux)
- Podman containers across VMs with dynamic service discovery
- Tailscale mesh networking with MagicDNS
- Cloudflared tunnels for public exposure with automator
- iOS-friendly GitOps via Kustomize
- Monitoring with Prometheus + ntfy/Pushover alerts
- Declarative infrastructure via Pulumi

## Project Structure
```
homelab-deploy/
├── README.md                    # This file
├── pulumi/                      # Infrastructure as Code
│   ├── Pulumi.yaml
│   ├── index.ts
│   └── proxmox-vms/
│       ├── index.ts             # VM definitions (gw-01, olares-01, etc.)
│       └── cloud-init/          # Bootstrapping templates
├── gateway/                     # gw-01 configuration
│   ├── compose.yaml             # Docker Compose for gateway services
│   ├── .env.template
│   └── systemd/                 # Systemd service files
├── olares/                      # olares-01 k3s manifests
│   ├── kustomization.yaml
│   └── monitoring/              # Prometheus + ntfy
├── cloud-init/                  # Shared cloud-init templates
│   ├── user-data-gw.yaml
│   ├── user-data-olares.yaml
│   └── user-data-common.yaml
└── .github/workflows/           # CI/CD pipelines
    ├── pulumi-infra.yml
    └── gateway-deploy.yml
```

## Prerequisites
- Proxmox VE 9.x installed on R240 (BOSS S1 SSD, ZFS pool configured)
- Pulumi CLI installed (`npm install -g pulumi`)
- Tailscale auth key (ephemeral for initial join)
- Cloudflare API token for DNS/tunnels
- GitHub repo with secrets configured (PROXMOX_ENDPOINT, TAILSCALE_AUTHKEY, etc.)

## Quick Start
1. `cd homelab-deploy && pulumi stack init dev`
2. `pulumi up` - Creates VMs with cloud-init bootstrapping
3. Configure GitHub secrets and push workflows
4. Access services via Tailscale MagicDNS or Cloudflared subdomains

## VM Specifications
| VM | vCPU | RAM | Storage | Role |
|----|------|-----|---------|------|
| gw-01 | 2 | 4GB | 50GB | Networking gateway, Cloudflared, service discovery |
| olares-01 | 4 | 8GB | 100GB | Single-node k3s, Kustomize GitOps, Prometheus |
| cosmos-01 | 4 | 8GB | 200GB | Podman/CasaOS, Cosmos Cloud, media apps |
| ynh-01 | 4 | 8GB | 300GB | YunoHost, Nextcloud, Homepage dashboard |

Total allocation: 14 vCPU, 28GB RAM (leaves headroom on 38GB total).

## Contributing & Development

See [Issue #2](../../issues/2) for the comprehensive repository restructuring plan, including:
- Cross-branch synchronization strategy
- Migration guides between deployment patterns
- Future enhancements (Terraform modules, Helm charts, Ansible playbooks)
- Backup/restore procedures per deployment type

## License
MIT - Free for personal homelab use.
