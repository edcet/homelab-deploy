# Homelab Deployment Run Order

This guide outlines the step-by-step execution order for deploying the homelab infrastructure using the generated declarative assets. Assume Proxmox is running and accessible, with secrets configured (TS_AUTHKEY, CF_TOKEN, etc.) in Pulumi config or environment.

## Prerequisites
- Proxmox VE installed and accessible at https://p24.local:8006.
- Olares ISO uploaded to Proxmox storage (local:iso/olares-1.0.0.iso).
- Git repository with homelab-deploy/ pushed to GitHub.
- Secrets set in GitHub repo (PROXMOX_*, TAILSCALE_AUTHKEY, CF_TOKEN, SSH keys).
- Local machine with Pulumi, kubectl, and kustomize installed.

## Step 1: Deploy Infrastructure with Pulumi
Run Pulumi to create VMs on Proxmox with cloud-init configurations.

```bash
cd homelab-deploy/pulumi
pulumi up --stack dev --yes
```

- This creates 4 VMs: gw-01, olares-01, cosmos-01, ynh-01.
- Attaches Olares ISO to olares-01 for boot.
- VMs boot with Tailscale, Podman, Cloudflared pre-installed via cloud-init.
- Verify: `pulumi stack output` for VM IDs/IPs.

## Step 2: Boot and Initial VM Setup
- VMs boot automatically (onBoot: true).
- SSH into each VM via Tailscale IP (e.g., `ssh ubuntu@100.x.x.x`).
- On gw-01:
  ```bash
  sudo systemctl enable --now podman tailscaled cloudflared
  tailscale up --authkey=$TS_AUTHKEY --advertise-exit-node
  cloudflared tunnel run --token=$CF_TOKEN
  ```
- On olares-01: Boot from ISO, install Olares/k3s, detach ISO after.
- On cosmos-01: `sudo systemctl enable --now casaos`.
- On ynh-01: Run YunoHost installer if needed (`curl https://install.yunohost.org | bash`).
- Tailnet: curl-chimera.ts.net

## Step 3: Deploy Gateway Services (Podman-Compose)
On gw-01:

```bash
cd /opt/homelab/gateway
podman network create homelab
podman-compose -f compose/compose.yaml up -d
sudo systemctl enable --now watcher.service
```

- Deploys Traefik, Homepage, Glance, CasaOS, Dokploy, Mongo.
- Watcher monitors events, updates Cloudflare/Traefik.
- Verify: `podman ps`, access http://homepage.rns.lol.

## Step 4: Deploy Monitoring on Olares (Kustomize)
On olares-01 (after k3s/Olares installed):

```bash
cd /opt/olares/monitoring
kustomize build . | kubectl apply -f -
kubectl rollout status deployment/prometheus-operator -n monitoring
```

- Applies Prometheus Operator with single-node patches (replicas=1, no taints, local etcd).
- Grafana dashboard with datasources.
- Verify: `kubectl get pods -n monitoring`, Grafana at http://grafana.olares.rns.lol:3000.

## Step 5: GitOps Workflow Trigger
Push to main branch in GitHub repo to trigger workflow:
- Deploys Pulumi infra.
- SSH deploys to gw-01 (compose, scripts, systemd).
- Applies Kustomize to olares-01.

## Step 6: Run Maintenance Health Checks
On any VM (or cron on gw-01):

```bash
cd /opt/homelab/maintenance
./health.sh
sudo crontab -e  # Add: 0 */6 * * * /opt/homelab/maintenance/health.sh
```

- Checks VMs, services, storage, k3s, containers.
- Alerts via ntfy/email if issues.

## Step 7: Verification and Ongoing
- Access services via Tailscale or Cloudflare tunnels.
- Monitor: Grafana dashboards, ntfy alerts.
- Update: Push changes to GitHub, workflow redeploys.
- Backup: Pulumi stack export, VM snapshots in Proxmox.

## Troubleshooting
- Pulumi errors: Check secrets, Proxmox API access.
- Podman issues: `podman logs <container>`.
- k3s: `kubectl get nodes`, check Olares logs.
- Connectivity: Tailscale status, firewall rules.

All files created and syntax validated. Deployment ready.