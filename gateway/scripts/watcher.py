#!/usr/bin/env python3
"""
Podman event watcher for homelab services.
Listens to Podman events, updates Cloudflare tunnels/DNS based on labels,
and reloads Traefik configuration.
"""

import json
import os
import subprocess
import sys
import time
import requests
from typing import Dict, Any

# Environment variables (placeholders)
CF_TOKEN = os.getenv('CF_TOKEN', 'your-cloudflare-api-token')
TRAEFIK_URL = os.getenv('TRAEFIK_URL', 'http://localhost:8080/api/http/services')
DOMAIN = os.getenv('DOMAIN', 'rns.lol')
TS_AUTHKEY = os.getenv('TS_AUTHKEY', 'your-tailscale-authkey')

# Cloudflare API base
CF_API = 'https://api.cloudflare.com/client/v4'
HEADERS = {
    'Authorization': f'Bearer {CF_TOKEN}',
    'Content-Type': 'application/json'
}

def get_container_labels(container_id: str) -> Dict[str, str]:
    """Inspect container and return labels."""
    try:
        result = subprocess.run(
            ['podman', 'inspect', container_id],
            capture_output=True,
            text=True,
            check=True
        )
        data = json.loads(result.stdout)[0]
        return data['Config']['Labels']
    except (subprocess.CalledProcessError, json.JSONDecodeError, KeyError):
        return {}

def update_cloudflare_tunnel(service_name: str, labels: Dict[str, str], action: str = 'up') -> None:
    """Update Cloudflare tunnel for service."""
    # Placeholder: Update tunnel config or DNS
    tunnel_id = os.getenv('CF_TUNNEL_ID', 'your-tunnel-id')
    zone_id = os.getenv('CF_ZONE_ID', '4c6e224b45c0a417d2654a388973c3ad')
    
    if 'io.cloudflared.tunnel' in labels:
        tunnel_name = labels['io.cloudflared.tunnel']
        # Extract port from labels, e.g., traefik.http.services.{}.loadbalancer.server.port
        port = '80'  # Default
        for k in labels:
            if k.endswith('loadbalancer.server.port'):
                port = labels[k]
                break
        # Example: Create/update public hostname
        payload = {
            'tunnel_id': tunnel_id,
            'public_hostname': {
                'hostname': f'{service_name}.{DOMAIN}',
                'service': f'http://localhost:{port}'
            }
        }
        endpoint = f'/zones/{zone_id}/tunnels/{tunnel_id}/public-hostnames'
        if action == 'up':
            response = requests.post(f'{CF_API}{endpoint}', headers=HEADERS, json=payload)
        else:
            response = requests.delete(f'{CF_API}{endpoint}/{tunnel_name}')
        if response.status_code not in (200, 204):
            print(f"Cloudflare update failed: {response.text}", file=sys.stderr)

def reload_traefik() -> None:
    """Reload Traefik configuration."""
    try:
        # Trigger dynamic config reload via API
        response = requests.post(f'{TRAEFIK_URL}/reload')
        if response.status_code != 200:
            print(f"Traefik reload failed: {response.text}", file=sys.stderr)
    except requests.RequestException as e:
        print(f"Error reloading Traefik: {e}", file=sys.stderr)

def handle_event(event: Dict[str, Any]) -> None:
    """Handle Podman event."""
    if event.get('Type') != 'container':
        return
    
    status = event['Status']
    if status not in ('start', 'stop', 'die'):
        return
    
    container_id = event['Actor']['ID'][:12]
    labels = get_container_labels(container_id)
    
    if not labels:
        return
    
    # Simplify service_name extraction
    service_name = container_id  # Fallback
    for k in labels:
        if k.startswith('traefik.http.routers.') and '.rule' in k:
            rule = labels[k]
            if 'Host(`' in rule:
                service_name = rule.split('Host(`')[1].split(')')[0].split('.')[0]
                break
    
    if status in ('start', 'die'):
        action = 'up' if status == 'start' else 'down'
        update_cloudflare_tunnel(service_name, labels, action)
        
        # Tailscale integration placeholder
        if 'io.tailscale.service' in labels:
            # e.g., tailscale up --authkey=${TS_AUTHKEY} --advertise-tags=tag:homelab
            print(f"Tailscale update for {service_name}")
    
    reload_traefik()

def main():
    """Main event listener loop."""
    print("Starting Podman event watcher...")
    process = subprocess.Popen(
        ['podman', 'events', '--format', 'json'],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
        universal_newlines=True
    )
    
    if process.stdout is None:
        print("Failed to capture Podman events output", file=sys.stderr)
        sys.exit(1)
    
    for line in process.stdout:
        if line.strip():
            try:
                event = json.loads(line.strip())
                handle_event(event)
            except json.JSONDecodeError:
                continue
    
    process.wait()

if __name__ == '__main__':
    main()