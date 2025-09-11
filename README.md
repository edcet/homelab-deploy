# VM-Centric Homelab Deployment on Proxmox 9

## Overview
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

## License
MIT - Free for personal homelab use.