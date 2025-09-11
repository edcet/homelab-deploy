#!/bin/bash
# Homelab Health Check Script
# Checks VM status, service health, and sends alerts if issues found

set -euo pipefail

# Configuration
LOG_FILE="/var/log/homelab-health.log"
NTFY_TOPIC="${NTFY_TOPIC:-homelab}"
NTFY_SERVER="${NTFY_SERVER:-http://ntfy.sh}"
EMAIL_TO="${EMAIL_TO:-admin@homelab.local}"
VM_HOSTS=("gw-01.homelab.local" "olares-01.homelab.local" "cosmos-01.homelab.local" "ynh-01.homelab.local")
SERVICES=("podman" "tailscaled" "cloudflared" "nginx" "k3s" "casaos")

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

send_alert() {
    local title="$1"
    local message="$2"
    curl -s -d "$message" "${NTFY_SERVER}/${NTFY_TOPIC}" -H "Title: $title" || echo "Alert sent: $title - $message"
    echo "$title: $message" | mail -s "$title" "$EMAIL_TO" || true
}

check_vm() {
    local host="$1"
    local status
    if ping -c 1 -W 5 "$host" >/dev/null 2>&1; then
        status="UP"
        log "VM $host: $status"
    else
        status="DOWN"
        log "VM $host: $status"
        send_alert "Homelab VM Down" "VM $host is unreachable"
    fi
    echo "$status"
}

check_service() {
    local service="$1"
    local status
    if systemctl is-active --quiet "$service" 2>/dev/null; then
        status="OK"
        log "Service $service: $status"
    else
        status="FAILED"
        log "Service $service: $status"
        send_alert "Homelab Service Failed" "Service $service is not running"
    fi
    echo "$status"
}

check_storage() {
    local path="$1"
    local threshold="$2"
    local usage
    usage=$(df "$path" | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$usage" -gt "$threshold" ]; then
        log "Storage $path: $usage% used (WARNING: >$threshold%)"
        send_alert "Homelab Storage Warning" "Storage $path is $usage% full"
        echo "WARNING"
    else
        log "Storage $path: $usage% used (OK)"
        echo "OK"
    fi
}

check_k3s() {
    if kubectl get nodes >/dev/null 2>&1; then
        local nodes_ready
        nodes_ready=$(kubectl get nodes -o jsonpath='{.items[*].status.conditions[?(@.type=="Ready")].status}' | tr ' ' '\n' | grep -c True)
        if [ "$nodes_ready" -gt 0 ]; then
            log "k3s: $nodes_ready nodes ready (OK)"
            echo "OK"
        else
            log "k3s: No ready nodes (FAILED)"
            send_alert "k3s Cluster Issue" "No ready nodes in k3s cluster"
            echo "FAILED"
        fi
    else
        log "k3s: kubectl not available (FAILED)"
        send_alert "k3s Not Available" "kubectl command failed"
        echo "FAILED"
    fi
}

main() {
    log "Starting homelab health check..."

    local issues=0

    # Check VMs
    log "--- VM Status ---"
    for vm in "${VM_HOSTS[@]}"; do
        check_vm "$vm" || ((issues++))
    done

    # Check services (run on current host or via SSH to gw-01)
    log "--- Service Status ---"
    for service in "${SERVICES[@]}"; do
        check_service "$service" || ((issues++))
    done

    # Check k3s (if on olares)
    if hostname | grep -q olares; then
        check_k3s || ((issues++))
    fi

    # Check storage
    log "--- Storage Status ---"
    check_storage "/" 90 || ((issues++))
    check_storage "/opt/media" 85 || ((issues++))

    # Check Podman containers
    log "--- Container Status ---"
    if podman ps --format json | jq -e '.[]' >/dev/null 2>&1; then
        local healthy_containers
        healthy_containers=$(podman ps --filter health=healthy --format count)
        local total_containers
        total_containers=$(podman ps --format count)
        if [ "$healthy_containers" -eq "$total_containers" ]; then
            log "Containers: $healthy_containers healthy (OK)"
        else
            log "Containers: $healthy_containers/$total_containers healthy (WARNING)"
            send_alert "Container Health Warning" "$healthy_containers/$total_containers containers healthy"
            ((issues++))
        fi
    fi

    # Summary
    if [ "$issues" -eq 0 ]; then
        log "Homelab health check: ALL OK"
        curl -s -d "✅ Homelab healthy - no issues detected" "${NTFY_SERVER}/${NTFY_TOPIC}" -H "Title: Homelab Health OK"
    else
        log "Homelab health check: $issues issues found"
        send_alert "Homelab Health Alert" "$issues issues detected in health check"
    fi

    log "Health check complete"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi