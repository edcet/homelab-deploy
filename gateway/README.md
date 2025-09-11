# Gateway VM Configuration (gw-01)

## Overview
The gateway VM serves as the central networking and service orchestration hub for the homelab, providing:

- **Cloudflared tunnels** - Public HTTPS exposure with automatic subdomain management
- **Homepage dashboard** - Unified service catalog and monitoring overview
- **ntfy server** - Push notification server with iOS integration
- **Traefik reverse proxy** - Automatic service discovery and internal routing
- **Service discovery watcher** - Monitors containers and updates configurations
- **Central logging and monitoring** - Aggregates metrics from all VMs

## Architecture Role
- **Primary ingress point** for both internal (Tailscale) and external (Cloudflare) traffic
- **Service registry** that automatically discovers and exposes new applications
- **Notification hub** for system alerts and user notifications
- **iOS-friendly interface** with PWA support and push notifications

## Directory Structure
```
gateway/
├── README.md                    # This file - deployment guide
├── docker-compose.yml           # Main services orchestration
├── .env.template                # Environment variables (copy to .env)
├── configs/                     # Service-specific configurations
│   ├── cloudflared/             # Tunnel credentials and routing
│   │   ├── config.yml
│   │   └── homelab-gateway.json
│   ├── homepage/                # Dashboard configuration
│   │   └── config.yml
│   ├── ntfy/                    # Notification server config
│   │   └── server.yml
│   ├── traefik/                 # Reverse proxy configuration
│   │   ├── traefik.yml
│   │   └── dynamic.yml
│   └── discovery/               # Service discovery scripts
│       ├── watcher.py
│       └── requirements.txt
├── volumes/                     # Persistent data (created automatically)
│   ├── cloudflared/
│   ├── homepage/
│   ├── ntfy/
│   └── traefik/
└── scripts/                     # Management utilities
    ├── setup.sh                 # Initial setup
    ├── update.sh                # Service updates
    └── backup.sh                # Configuration backup
```

## Prerequisites
- **Domain**: Configure DNS with Cloudflare (A record to your public IP)
- **Cloudflare Tunnel**: Create tunnel in Cloudflare dashboard, note credentials
- **Tailscale**: All VMs must be connected to the same tailnet
- **SSH Access**: Key-based authentication to gw-01 VM
- **Storage**: At least 50GB allocated for gateway services and logs

## Environment Variables (.env)
Copy `.env.template` to `.env` and configure:

```bash
# Domain and networking
DOMAIN=yourdomain.com
TAILNET=your.tailnet.ts.net

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_TUNNEL_ID=your-tunnel-id
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token

# ntfy (push notifications)
NTFY_USER_KEY=your-pushover-user-key
NTFY_APP_TOKEN=your-pushover-app-token
NTFY_ADMIN_PASSWORD=your-ntfy-admin-password

# Traefik (reverse proxy)
TRAEFIK_ADMIN_USER=admin
TRAEFIK_ADMIN_PASSWORD=SecurePass123!

# Timezone
TZ=America/Chicago

# Logging
LOG_LEVEL=INFO
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5
```

## Deployment Steps

### 1. Initial Setup
```bash
cd /opt/gateway
cp .env.template .env
chmod 600 .env
nano .env  # Configure your settings
```

### 2. Start Services
```bash
# Pull and start all services
docker compose pull
docker compose up -d

# Verify services
docker compose ps
docker compose logs

# Check health
curl -f http://localhost:3000/health || echo "Homepage starting..."
curl -f http://localhost:8080/version || echo "ntfy starting..."
curl -f http://localhost:8080/ping || echo "Traefik starting..."
```

### 3. Configure Cloudflared
```bash
# Login to Cloudflare (one-time)
cloudflared tunnel login

# Create tunnel (if not done in dashboard)
cloudflared tunnel create homelab-gateway

# Route DNS
cloudflared tunnel route dns homelab-gateway yourdomain.com

# Verify tunnel
cloudflared tunnel info homelab-gateway
```

### 4. Initial Configuration
```bash
# Configure Homepage services
nano configs/homepage/config.yml

# Configure ntfy users
docker compose exec ntfy ntfy user add admin --password your-ntfy-password

# Configure Traefik dashboard access
# Access at http://traefik.yourdomain.com (admin/SecurePass123!)
```

### 5. Service Discovery
The discovery watcher automatically:
- Scans Docker containers every 30 seconds
- Updates Cloudflared ingress rules for `cf.expose=true` labels
- Regenerates Homepage configuration from `homepage.*` labels
- Restarts Traefik when routing changes
- Logs all discovery events to `/var/log/discovery.log`

## Service Configuration

### Cloudflared Tunnels
- **Public domain**: `*.yourdomain.com`
- **Automatic routing**: Based on container labels
- **Health checks**: Built-in service monitoring
- **Metrics**: Exposed on port 8081

### Homepage Dashboard
- **Port**: 3000 (internal), `homepage.yourdomain.com` (external)
- **Auto-discovery**: Reads Docker labels for services
- **PWA support**: iOS/Android home screen installation
- **Widgets**: System resources, Uptime Kuma, custom APIs

### ntfy Notifications
- **Port**: 8080 (internal), `ntfy.yourdomain.com` (external)
- **Topics**: `homelab`, `homelab-critical`, `homelab-warning`
- **iOS integration**: Pushover app subscription
- **Webhooks**: Prometheus Alertmanager integration
- **Authentication**: Admin user with topic access control

### Traefik Reverse Proxy
- **Port**: 80/443 (external), 8080 (dashboard)
- **Auto-discovery**: Docker provider with label-based routing
- **TLS**: Automatic Let's Encrypt certificates
- **Middleware**: Rate limiting, authentication, compression

## iOS Integration

### 1. Push Notifications (ntfy + Pushover)
```
1. Install Pushover app from App Store
2. Create account and note User Key
3. Create "Homelab Alerts" application, note API Token
4. Subscribe to ntfy topics in Pushover:
   - homelab-critical (high priority)
   - homelab-warning (medium priority)
   - homelab (general notifications)
5. Update .env with your keys
6. Restart ntfy: docker compose restart ntfy
```

### 2. Progressive Web Apps (PWA)
- **Homepage**: Add to home screen from Safari (Share → Add to Home Screen)
- **Traefik Dashboard**: Monitor services from iPhone
- **ntfy Web**: Subscribe to topics from mobile browser

### 3. Native App Integration
- **Tailscale**: VPN connection for internal access
- **Files app**: Nextcloud WebDAV for document access
- **Mail app**: IMAP/SMTP configuration for email
- **Calendar/Contacts**: Nextcloud CalDAV/CardDAV sync

## Automatic Service Discovery

Containers with these labels are automatically exposed:

```yaml
labels:
  cf.expose: "true"                           # Cloudflared tunnel
  homepage.group: "Media"                     # Dashboard category  
  homepage.name: "Plex"                       # Display name
  homepage.icon: "plex.png"                   # Icon file
  homepage.href: "http://plex.local:32400"    # Internal URL
  homepage.description: "Media streaming"     # Description
  traefik.enable: "true"                      # Traefik routing
  traefik.http.routers.plex.rule: "Host(`plex.local`)"  # Routing rule
```

## Health Monitoring

### Built-in Health Checks
- **Cloudflared**: `cloudflared tunnel info`
- **Homepage**: `curl http://localhost:3000/health`
- **ntfy**: `curl http://localhost:8080/version`  
- **Traefik**: `curl http://localhost:8080/ping`

### Prometheus Metrics
All services expose metrics on standard ports:
- Cloudflared: `:8081/metrics`
- Traefik: `:8082/metrics` 
- ntfy: `:9180/metrics`
- Homepage: `:3000/metrics`

## Backup and Recovery

### Configuration Backup
```bash
# Daily automated backup
docker compose exec traefik tar czf /backup/traefik-config.tar.gz /data
docker compose exec ntfy tar czf /backup/ntfy-config.tar.gz /etc/ntfy
tar czf /backup/gateway-config.tar.gz configs/ docker-compose.yml .env

# Store offsite via rsync or S3
rsync -avz /backup/ user@backup-server:/homelab/gateway/
```

### Disaster Recovery
1. Restore VM from Proxmox backup
2. Reinstall Docker: `curl -fsSL get.docker.com | sh`
3. Restore configuration: `tar xzf gateway-config.tar.gz -C /opt/gateway`
4. Recreate Cloudflare tunnel: `cloudflared tunnel create homelab-gateway`
5. Restart services: `docker compose up -d`
6. Verify: `./scripts/health-check.sh`

## Troubleshooting

### Common Issues

**Cloudflared tunnel not connecting:**
```bash
# Check tunnel status
cloudflared tunnel info homelab-gateway

# Verify credentials
cat /opt/gateway/configs/cloudflared/homelab-gateway.json

# Check logs
docker compose logs cloudflared

# Re-authenticate
cloudflared tunnel login
```

**Homepage not showing services:**
```bash
# Check discovery watcher
docker compose logs discovery

# Verify Docker socket access
docker compose exec homepage ls -la /var/run/docker.sock

# Check configuration
cat configs/homepage/config.yml | jq .
```

**ntfy notifications not arriving:**
```bash
# Check ntfy logs
docker compose logs ntfy

# Test webhook
curl -X POST -d "Test message" http://localhost:8080/homelab

# Verify Pushover config
docker compose exec ntfy cat /etc/ntfy/server.yml | grep pushover

# Test Pushover directly
curl -F "token=YOUR_TOKEN" -F "user=YOUR_USER" -F "title=Test" -F "message=Hello" https://api.pushover.net/1/messages.json
```

**Traefik not routing:**
```bash
# Check dashboard
curl http://localhost:8080/api/http/routers

# Verify Docker provider
docker compose logs traefik | grep docker

# Check labels on containers
docker inspect <container> | jq '.[0].Config.Labels'
```

### Log Locations
- **Docker logs**: `docker compose logs -f <service>`
- **System logs**: `journalctl -u docker -f`
- **Discovery logs**: `/var/log/discovery.log`
- **Cloudflared logs**: `docker compose logs cloudflared`
- **Traefik access logs**: `/opt/gateway/volumes/traefik/access.log`

## Security Considerations

### Network Security
- **Tailscale ACLs**: Restrict access by tags (gateway, admin, media)
- **Cloudflare WAF**: Enable security rules for public endpoints
- **Traefik middleware**: Rate limiting, IP whitelisting for admin interfaces
- **UFW firewall**: Only expose necessary ports (22, 80, 443, Tailscale)

### Service Security
- **ntfy authentication**: Topic-based access control
- **Homepage**: No sensitive data, read-only interface
- **Traefik dashboard**: Basic auth with strong password
- **Container isolation**: Separate networks for different service groups
- **Resource limits**: CPU/memory limits in docker-compose.yml

### Secrets Management
- **Environment files**: `.env` with 600 permissions
- **Docker secrets**: Use Docker secrets for sensitive data
- **Cloudflare credentials**: Encrypted tunnel JSON files
- **SSL certificates**: Automatic via Cloudflare/Let's Encrypt

## Performance Tuning

### Docker Configuration
- **Storage driver**: overlay2 (default, good for SSD)
- **Logging**: JSON-file with rotation (10MB × 5 files)
- **Resource limits**: CPU/memory limits per container
- **Network**: macvlan or bridge with proper MTU

### System Tuning
- **Swap**: 2GB swap file for memory pressure
- **File descriptors**: Increased limits (65536)
- **Network buffers**: Optimized for high traffic
- **I/O scheduler**: deadline or mq-deadline for SSD

## Monitoring and Alerts

### Built-in Monitoring
- **Traefik metrics**: `/metrics` endpoint
- **ntfy metrics**: Prometheus exporter
- **Docker stats**: Integrated with Homepage
- **System metrics**: Node Exporter (port 9100)

### iOS Alerts Configuration
1. **Critical alerts** (high priority):
   - Cloudflared tunnel down
   - Traefik unavailable  
   - High CPU/memory usage
   - Docker daemon failure

2. **Warning alerts** (medium priority):
   - Service discovery issues
   - Certificate expiration
   - Log rotation failures
   - Network connectivity

3. **Info alerts** (low priority):
   - New service discovered
   - Configuration updates
   - Backup completion
   - System maintenance

## Integration with Other VMs

### olares-01 (k3s)
- **Monitoring**: Prometheus scrapes gateway metrics
- **Service discovery**: k3s services appear in Homepage
- **Networking**: Traefik routes to k3s ingress controller

### cosmos-01 (Media)
- **Media proxy**: Traefik routes to Plex/Jellyfin
- **Glance integration**: Media library in Homepage
- **Storage**: Shared media volumes accessible via NFS

### ynh-01 (YunoHost)
- **SSO integration**: YunoHost SSO via Traefik middleware
- **Application routing**: YunoHost apps exposed via gateway
- **Mail relay**: Postfix routes through gateway

## Development and Testing

### Local Testing
```bash
# Test compose file
docker compose config

# Dry run deployment
docker compose up --dry-run

# Test specific service
docker compose up homepage

# Health check all services
./scripts/health-check.sh
```

### Staging Environment
1. Create separate Cloudflare tunnel for staging
2. Use `staging.yourdomain.com` subdomain
3. Deploy with `docker compose --profile staging up -d`
4. Test integrations before production

## Upgrade Process

### Minor Updates (container images)
```bash
cd /opt/gateway
docker compose pull
docker compose up -d
docker system prune -f
```

### Major Updates (configuration changes)
1. **Backup**: `./scripts/backup.sh`
2. **Review changes**: `git diff` in repository
3. **Update compose**: `docker compose up -d --force-recreate`
4. **Verify**: `./scripts/health-check.sh`
5. **Monitor**: Watch logs for 24 hours

### Cloudflare Tunnel Updates
```bash
# Update tunnel credentials
cloudflared tunnel update homelab-gateway

# Re-route DNS if needed
cloudflared tunnel route dns homelab-gateway yourdomain.com

# Verify connectivity
cloudflared tunnel info homelab-gateway
```

## Contribution Guidelines

### Adding New Services
1. **Docker Compose**: Add service to `docker-compose.yml`
2. **Labels**: Include discovery labels (`cf.expose`, `homepage.*`)
3. **Configuration**: Add to `configs/` directory if needed
4. **Volumes**: Persistent data in `volumes/` 
5. **Health checks**: Include healthcheck in service definition
6. **Test**: `docker compose up <service>` and verify

### Service Discovery Labels
```yaml
services:
  myapp:
    image: myapp:latest
    labels:
      - "cf.expose=true"                    # Enable Cloudflare tunnel
      - "homepage.group=Applications"        # Dashboard category
      - "homepage.name=MyApp"                # Display name
      - "homepage.icon=myapp.png"            # 64x64 PNG icon
      - "homepage.href=http://myapp.local"   # Internal access URL
      - "homepage.description=My application" # Tooltip text
      - "traefik.enable=true"                # Enable Traefik routing
      - "traefik.http.routers.myapp.rule=Host(`myapp.local`)"  # Routing rule
```

## License
MIT License - Free for personal and homelab use.

## Support
- **Issues**: Create GitHub issues for bugs/feature requests
- **Community**: Tailscale, Cloudflare, and Docker communities
- **Documentation**: Official docs for each service
- **Troubleshooting**: Check logs and health endpoints first

---
*Deployed: {{ date }} | Version: 1.0.0 | Author: Homelab Automation*