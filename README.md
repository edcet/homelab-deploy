# 💻 Pulumi Infrastructure as Code Branch

> **Production-ready Pulumi TypeScript for full infrastructure provisioning and automation**

## 📍 Branch Purpose

This branch contains **Pulumi Infrastructure as Code (IaC)** for provisioning complete homelab infrastructure. Perfect for:
- Proxmox VM provisioning
- Cloud infrastructure (AWS, Azure, GCP)
- Network configuration automation
- Cloud-init bootstrapping
- Multi-platform IaC with TypeScript

---

## 🎯 Quick Start

### Prerequisites
- Pulumi CLI installed (`npm install -g pulumi` or via package manager)
- Node.js 18+ and npm
- Proxmox API access (or cloud provider credentials)
- GitHub token for Pulumi state backend (or use Pulumi Cloud)

### Initialize Pulumi Stack

```bash
# Clone this branch
git clone -b pulumi-deploy https://github.com/edcet/homelab-deploy.git
cd homelab-deploy

# Install dependencies
npm install

# Login to Pulumi (local backend or cloud)
pulumi login file://./state  # Local state
# OR
pulumi login  # Pulumi Cloud

# Initialize stack
pulumi stack init dev
```

### Configure Secrets

```bash
# Set Proxmox endpoint and credentials
pulumi config set proxmox:endpoint https://proxmox.example.com:8006
pulumi config set --secret proxmox:username root@pam
pulumi config set --secret proxmox:password your_password

# Set cloud-init configuration
pulumi config set tailscale:authkey tskey-auth-xxx --secret
pulumi config set cloudflare:apiToken your_cf_token --secret
```

### Deploy Infrastructure

```bash
# Preview changes
pulumi preview

# Apply changes
pulumi up

# Review resources
pulumi stack output

# Destroy when needed
pulumi destroy
```

---

## 📁 Repository Structure (Pulumi Branch)

```
pulumi-deploy/
├── pulumi/
│   ├── Pulumi.yaml               # Pulumi project definition
│   ├── index.ts                  # Main Pulumi program
│   ├── Pulumi.dev.yaml           # Dev stack config
│   ├── Pulumi.prod.yaml          # Prod stack config
│   └── resources/
│       ├── vms.ts                # VM definitions
│       ├── network.ts            # Network config
│       └── storage.ts            # Storage config
├── cloud-init/                   # Cloud-init templates
│   ├── user-data-gw.yaml
│   ├── user-data-olares.yaml
│   └── user-data-common.yaml
├── package.json                  # Node dependencies
├── tsconfig.json                 # TypeScript config
└── README.md                     # This file
```

---

## 🛠️ Infrastructure Components

### Proxmox VMs (`pulumi/resources/vms.ts`)

**Provisioned VMs:**
- **gw-01** - Gateway (2 vCPU, 4GB RAM, 50GB disk)
- **olares-01** - K3s orchestration (4 vCPU, 8GB RAM, 100GB disk)
- **cosmos-01** - App hosting (4 vCPU, 8GB RAM, 200GB disk)
- **ynh-01** - YunoHost services (4 vCPU, 8GB RAM, 300GB disk)

**Features:**
- Automated cloud-init bootstrapping
- Network interface configuration
- Storage pool allocation
- Resource tagging and metadata

### Network Configuration

- VLANs and bridge interfaces
- Tailscale mesh networking
- Cloudflare tunnel setup
- DNS configuration
- Firewall rules

### Cloud-Init Integration

Automated bootstrapping includes:
- User creation and SSH keys
- Package installation
- Service configuration
- Tailscale join
- Docker/Podman setup

---

## ⚙️ Configuration

### Stack Configuration

Create stack-specific configs:

```yaml
# Pulumi.dev.yaml
config:
  proxmox:endpoint: https://proxmox-dev.local:8006
  homelab:vmPrefix: dev-
  homelab:cpuOvercommit: 2
```

```yaml
# Pulumi.prod.yaml
config:
  proxmox:endpoint: https://proxmox-prod.local:8006
  homelab:vmPrefix: prod-
  homelab:cpuOvercommit: 1.5
```

### Environment Variables

```bash
export PULUMI_CONFIG_PASSPHRASE="your-secure-passphrase"
export PROXMOX_VE_ENDPOINT="https://proxmox.local:8006"
export PROXMOX_VE_INSECURE=true  # For self-signed certs
```

### Secrets Management

```bash
# Encrypt sensitive values
pulumi config set --secret db:password secure_password

# Reference in code
const dbPassword = config.requireSecret("db:password");
```

---

## 🔗 Integration with Other Branches

### Provision Infrastructure, Deploy Services

1. Use **pulumi-deploy** to provision VMs
2. Switch to **docker-deploy** for container services
3. Switch to **k8s-deploy** for K8s workloads
4. Add **monitoring-stack** for observability

### GitOps Workflow

```bash
# 1. Provision infrastructure
git checkout pulumi-deploy
pulumi up

# 2. Configure VMs
ssh user@vm-ip

# 3. Deploy services
git checkout docker-deploy
# OR
git checkout k8s-deploy
```

---

## 🐛 Troubleshooting

### Pulumi State Issues

```bash
# Refresh state
pulumi refresh

# Export state
pulumi stack export > state-backup.json

# Import state
pulumi stack import < state-backup.json

# Cancel stuck update
pulumi cancel
```

### Preview Changes

```bash
# Dry-run before applying
pulumi preview --diff

# Show detailed output
pulumi up --show-config --show-replacement-steps
```

### Debug Mode

```bash
# Verbose logging
pulumi up --logtostderr -v=9 2> pulumi.log

# Check Pulumi logs
cat pulumi.log | grep -i error
```

### Common Issues

**State Lock:**
```bash
# Force unlock (use carefully)
pulumi cancel
```

**Provider Plugin Errors:**
```bash
# Reinstall plugins
pulumi plugin install resource proxmox v0.0.1
```

**TypeScript Compilation:**
```bash
# Check for errors
npm run build
tsc --noEmit
```

---

## 📖 Additional Resources

- **Pulumi Docs**: https://www.pulumi.com/docs/
- **Proxmox Provider**: https://www.pulumi.com/registry/packages/proxmoxve/
- **TypeScript Guide**: https://www.pulumi.com/docs/languages-sdks/typescript/
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
| **[k8s-deploy](../../tree/k8s-deploy)** | Kubernetes + Kustomize |
| **[monitoring-stack](../../tree/monitoring-stack)** | Standalone monitoring |
| **pulumi-deploy** | ➡️ You are here |

---

## ✅ Production Checklist

- [ ] Install Pulumi CLI and Node.js
- [ ] Configure cloud/Proxmox credentials
- [ ] Initialize Pulumi stack (dev/staging/prod)
- [ ] Set all required config values
- [ ] Encrypt sensitive secrets
- [ ] Run `pulumi preview` to validate
- [ ] Test in dev environment first
- [ ] Document custom resource configurations
- [ ] Set up Pulumi state backend (file:// or cloud)
- [ ] Configure CI/CD for automated deployments

---

## 📊 Pulumi Best Practices

1. **Stack Organization** - Separate stacks for dev/staging/prod
2. **Config Management** - Use stack configs, not hardcoded values
3. **Secret Encryption** - Always use `--secret` flag
4. **Resource Naming** - Use consistent naming conventions
5. **State Backups** - Regular `pulumi stack export` backups
6. **Preview First** - Always run `pulumi preview` before `up`
7. **Dependency Management** - Explicit resource dependencies
8. **Modular Code** - Separate concerns into modules

---

## 📝 License

MIT - Free for personal homelab use.
