import * as pulumi from "@pulumi/pulumi";
import * as proxmox from "@pulumi/proxmox";
import * as path from "path";
import { join } from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Proxmox provider
const proxmoxConfig = new pulumi.Config("proxmox");
const proxmoxProvider = new proxmox.Provider("proxmox", {
    endpoint: proxmoxConfig.require("endpoint"),
    username: proxmoxConfig.require("username"),
    password: proxmoxConfig.requireSecret("password"),
    insecure: proxmoxConfig.getBoolean("insecure") || true,
});

// VM Node and storage configuration
const nodeName = proxmoxConfig.get("node") || "r240";
const storagePool = "local-zfs"; // ZFS pool for VM disks
const bridge = "vmbr0"; // Main network bridge
const template = "local:snippets/debian-12-cloudinit-template.qcow2"; // Assumes Debian cloud image

// Tailscale configuration
const tailscaleConfig = new pulumi.Config("tailscale");
const tailscaleAuthKey = tailscaleConfig.requireSecret("authKey");

// SSH key configuration (optional)
const sshConfig = new pulumi.Config("ssh");
const sshPublicKey = sshConfig.get("publicKey") || ""; // Base64 encoded public key

// VM Configuration
const vmsConfig = new pulumi.Config("vms");

// Static MAC addresses for predictable networking
const macAddresses = {
    gw: "52:54:00:10:00:01",
    olares: "52:54:00:10:00:02",
    cosmos: "52:54:00:10:00:03",
    ynh: "52:54:00:10:00:04"
};

// Common cloud-init template
const commonCloudInit = new proxmox.CloudInitTemplate("common-cloud-init", {
    nodeName: nodeName,
    template: new pulumi.asset.FileAsset(join(__dirname, "../cloud-init/user-data-common.yaml")),
    storagePool: storagePool,
}, { provider: proxmoxProvider });

// Gateway VM (gw-01) - Networking and service discovery
const gwCloudInit = new proxmox.CloudInitTemplate("gw-cloud-init", {
    nodeName: nodeName,
    template: new pulumi.asset.FileAsset(join(__dirname, "../cloud-init/user-data-gw.yaml")),
    storagePool: storagePool,
}, { provider: proxmoxProvider });

const gwVm = new proxmox.VM("gw-01", {
    provider: proxmoxProvider,
    nodeName: nodeName,
    vmId: 100,
    name: "gw-01",
    description: "Gateway VM - Networking, Cloudflared tunnels, Service discovery, Homepage dashboard",
    
    // CPU and memory
    cpu: {
        cores: vmsConfig.requireNumber("gw:cpu"),
        type: "host",
        sockets: 1,
        flags: "pcid,pcie,hypervisor",
    },
    memory: {
        dedicated: vmsConfig.requireNumber("gw:memory"),
    },
    
    // Disk configuration
    disk: [{
        datastoreId: storagePool,
        fileFormat: "qcow2",
        size: pulumi.interpolate`${vmsConfig.requireNumber("gw:diskSize")}G`,
        type: "scsi",
        interface: "virtio-scsi-pci",
        iothread: true,
        discard: "on",
        ssd: true,
        cache: "writeback",
        storage: storagePool,
    }],
    
    // Network configuration
    networkDevice: [{
        model: "virtio",
        bridge: bridge,
        macAddress: macAddresses.gw,
        firewall: true,
        vlanId: 0,
    }],
    
    // OS and boot configuration
    osType: "cloud-init",
    scsihw: "virtio-scsi-pci",
    bootDisk: storagePool,
    bootOrder: "scsi0;net0;ide2;ide0;ide1",
    
    // QEMU agent
    agent: [{
        enabled: true,
        trimClonedDisks: true,
        hotplug: "network-disks",
    }],
    
    // Cloud-init initialization
    initialization: [{
        ipConfig0: "ip=dhcp",
        userAccount: {
            username: "ubuntu",
            uid: 1000,
            password: "$6$rounds=4096$j9K.4k7v2H$6J9k4k7v2H6J9k4k7v2H6J9k4k7v2H6J9k4k7v2H6J", // ubuntu (base64 encoded)
            keys: sshPublicKey ? [sshPublicKey] : [],
        },
        userDataFileId: gwCloudInit.id,
        userDataReplaceVar: {
            TAILSCALE_AUTHKEY: tailscaleAuthKey,
            CLOUDFLARE_ACCOUNT_ID: "your-cloudflare-account-id",
            CLOUDFLARE_TUNNEL_ID: "your-tunnel-id",
            CLOUDFLARE_TUNNEL_SECRET: "your-tunnel-secret",
            DOMAIN: "rns.lol",
        },
    }],
    
    // VM settings
    tags: "homelab,gateway,networking,cloudflared",
    onBoot: true,
    startupOrder: 1,
    hotplug: "network,disk,usb,memory",
    freezeCpuAtStartup: false,
    
    // Display settings
    vga: "std",
    vgaSpice: false,
    vgaQxl: false,
    
}, { provider: proxmoxProvider });

// Olares VM (olares-01) - k3s orchestration and GitOps
const olaresCloudInit = new proxmox.CloudInitTemplate("olares-cloud-init", {
    nodeName: nodeName,
    template: new pulumi.asset.FileAsset(join(__dirname, "../cloud-init/user-data-olares.yaml")),
    storagePool: storagePool,
}, { provider: proxmoxProvider });

const olaresVm = new proxmox.VM("olares-01", {
    provider: proxmoxProvider,
    nodeName: nodeName,
    vmId: 101,
    name: "olares-01",
    description: "Olares VM - Single-node k3s cluster, Kustomize GitOps, Prometheus monitoring",
    
    // CPU and memory
    cpu: {
        cores: vmsConfig.requireNumber("olares:cpu"),
        type: "host",
        sockets: 1,
        flags: "pcid,pcie,hypervisor",
    },
    memory: {
        dedicated: vmsConfig.requireNumber("olares:memory"),
    },
    
    // Disk configuration
    disk: [{
        datastoreId: storagePool,
        fileFormat: "qcow2",
        size: pulumi.interpolate`${vmsConfig.requireNumber("olares:diskSize")}G`,
        type: "scsi",
        interface: "virtio-scsi-pci",
        iothread: true,
        discard: "on",
        ssd: true,
        cache: "writeback",
        storage: storagePool,
    }],
    
    // IDE disk for Olares ISO attachment
    cdrom: [{
        ide: "ide2",
        iso: "local:iso/olares-1.0.0.iso", // Olares ISO path in Proxmox storage
        storage: "local",
        interface: "ide",
        boot: false,
    }],
    
    // Network configuration
    networkDevice: [{
        model: "virtio",
        bridge: bridge,
        macAddress: macAddresses.olares,
        firewall: true,
        vlanId: 0,
    }],
    
    // OS and boot configuration
    osType: "cloud-init",
    scsihw: "virtio-scsi-pci",
    bootDisk: storagePool,
    bootOrder: "ide2;scsi0;net0;ide0;ide1", // Boot from ISO first, then disk
    
    // QEMU agent
    agent: [{
        enabled: true,
        trimClonedDisks: true,
        hotplug: "network-disks",
    }],
    
    // Cloud-init initialization
    initialization: [{
        ipConfig0: "ip=dhcp",
        userAccount: {
            username: "ubuntu",
            uid: 1000,
            password: "$6$rounds=4096$j9K.4k7v2H$6J9k4k7v2H6J9k4k7v2H6J9k4k7v2H6J9k4k7v2H6J",
            keys: sshPublicKey ? [sshPublicKey] : [],
        },
        userDataFileId: olaresCloudInit.id,
        userDataReplaceVar: {
            TAILSCALE_AUTHKEY: tailscaleAuthKey,
        },
    }],
    
    // VM settings
    tags: "homelab,olares,kubernetes,k3s,gitops,monitoring",
    onBoot: true,
    startupOrder: 2,
    hotplug: "network,disk,usb,memory",
    freezeCpuAtStartup: false,
    
    // Display settings
    vga: "std",
    vgaSpice: false,
    vgaQxl: false,
    
}, { provider: proxmoxProvider });

// Cosmos VM (cosmos-01) - Application hosting and media
const cosmosCloudInit = new proxmox.CloudInitTemplate("cosmos-cloud-init", {
    nodeName: nodeName,
    template: new pulumi.asset.FileAsset(join(__dirname, "../cloud-init/user-data-cosmos.yaml")),
    storagePool: storagePool,
}, { provider: proxmoxProvider });

const cosmosVm = new proxmox.VM("cosmos-01", {
    provider: proxmoxProvider,
    nodeName: nodeName,
    vmId: 102,
    name: "cosmos-01",
    description: "Cosmos VM - CasaOS app store, Podman containers, Media server (Plex/Jellyfin), Glance dashboard",
    
    // CPU and memory
    cpu: {
        cores: vmsConfig.requireNumber("cosmos:cpu"),
        type: "host",
        sockets: 1,
        flags: "pcid,pcie,hypervisor",
    },
    memory: {
        dedicated: vmsConfig.requireNumber("cosmos:memory"),
    },
    
    // Disk configuration - larger for media storage
    disk: [{
        datastoreId: storagePool,
        fileFormat: "qcow2",
        size: pulumi.interpolate`${vmsConfig.requireNumber("cosmos:diskSize")}G`,
        type: "scsi",
        interface: "virtio-scsi-pci",
        iothread: true,
        discard: "on",
        ssd: false, // Media storage, can use spinning disk
        cache: "writeback",
        storage: storagePool,
        aio: "io_uring", // Better for media I/O
    }],
    
    // Network configuration
    networkDevice: [{
        model: "virtio",
        bridge: bridge,
        macAddress: macAddresses.cosmos,
        firewall: true,
        vlanId: 0,
    }],
    
    // OS and boot configuration
    osType: "cloud-init",
    scsihw: "virtio-scsi-pci",
    bootDisk: storagePool,
    bootOrder: "scsi0;net0;ide2;ide0;ide1",
    
    // QEMU agent
    agent: [{
        enabled: true,
        trimClonedDisks: true,
        hotplug: "network-disks",
    }],
    
    // Cloud-init initialization
    initialization: [{
        ipConfig0: "ip=dhcp",
        userAccount: {
            username: "ubuntu",
            uid: 1000,
            password: "$6$rounds=4096$j9K.4k7v2H$6J9k4k7v2H6J9k4k7v2H6J9k4k7v2H6J9k4k7v2H6J",
            keys: sshPublicKey ? [sshPublicKey] : [],
        },
        userDataFileId: cosmosCloudInit.id,
        userDataReplaceVar: {
            TAILSCALE_AUTHKEY: tailscaleAuthKey,
        },
    }],
    
    // VM settings
    tags: "homelab,cosmos,applications,media,casaos,podman",
    onBoot: true,
    startupOrder: 3,
    hotplug: "network,disk,usb,memory",
    freezeCpuAtStartup: false,
    
    // Display settings
    vga: "std",
    vgaSpice: false,
    vgaQxl: false,
    
}, { provider: proxmoxProvider });

// YunoHost VM (ynh-01) - Self-hosted services
const ynhCloudInit = new proxmox.CloudInitTemplate("ynh-cloud-init", {
    nodeName: nodeName,
    template: new pulumi.asset.FileAsset(join(__dirname, "../cloud-init/user-data-ynh.yaml")),
    storagePool: storagePool,
}, { provider: proxmoxProvider });

const ynhVm = new proxmox.VM("ynh-01", {
    provider: proxmoxProvider,
    nodeName: nodeName,
    vmId: 103,
    name: "ynh-01",
    description: "YunoHost VM - Self-hosted services platform, Nextcloud, SSO, Web applications",
    
    // CPU and memory
    cpu: {
        cores: vmsConfig.requireNumber("ynh:cpu"),
        type: "host",
        sockets: 1,
        flags: "pcid,pcie,hypervisor",
    },
    memory: {
        dedicated: vmsConfig.requireNumber("ynh:memory"),
    },
    
    // Disk configuration - largest for user data and apps
    disk: [{
        datastoreId: storagePool,
        fileFormat: "qcow2",
        size: pulumi.interpolate`${vmsConfig.requireNumber("ynh:diskSize")}G`,
        type: "scsi",
        interface: "virtio-scsi-pci",
        iothread: true,
        discard: "on",
        ssd: true,
        cache: "writeback",
        storage: storagePool,
    }],
    
    // Network configuration
    networkDevice: [{
        model: "virtio",
        bridge: bridge,
        macAddress: macAddresses.ynh,
        firewall: true,
        vlanId: 0,
    }],
    
    // OS and boot configuration
    osType: "cloud-init",
    scsihw: "virtio-scsi-pci",
    bootDisk: storagePool,
    bootOrder: "scsi0;net0;ide2;ide0;ide1",
    
    // QEMU agent
    agent: [{
        enabled: true,
        trimClonedDisks: true,
        hotplug: "network-disks",
    }],
    
    // Cloud-init initialization
    initialization: [{
        ipConfig0: "ip=dhcp",
        userAccount: {
            username: "ubuntu",
            uid: 1000,
            password: "$6$rounds=4096$j9K.4k7v2H$6J9k4k7v2H6J9k4k7v2H6J9k4k7v2H6J9k4k7v2H6J",
            keys: sshPublicKey ? [sshPublicKey] : [],
        },
        userDataFileId: ynhCloudInit.id,
        userDataReplaceVar: {
            TAILSCALE_AUTHKEY: tailscaleAuthKey,
        },
    }],
    
    // VM settings
    tags: "homelab,yunohost,selfhosted,nextcloud,sso,mail",
    onBoot: true,
    startupOrder: 4,
    hotplug: "network,disk,usb,memory",
    freezeCpuAtStartup: false,
    
    // Display settings
    vga: "std",
    vgaSpice: false,
    vgaQxl: false,
    
}, { provider: proxmoxProvider });

// Network configuration - Proxmox firewall rules
const homelabFirewall = new proxmox.Firewall("homelab-firewall", {
    provider: proxmoxProvider,
    nodeName: nodeName,
    rules: [
        {
            action: "ACCEPT",
            direction: "in",
            source: "0.0.0.0/0",
            dest: "0.0.0.0/0",
            proto: "tcp",
            dport: "22",
            comment: "SSH access",
        },
        {
            action: "ACCEPT",
            direction: "in",
            source: "0.0.0.0/0",
            dest: "0.0.0.0/0",
            proto: "tcp",
            dport: "80,443",
            comment: "Web access",
        },
        {
            action: "ACCEPT",
            direction: "in",
            source: "100.64.0.0/10", // Tailscale CGNAT range
            dest: "0.0.0.0/0",
            proto: "any",
            comment: "Tailscale access",
        },
        {
            action: "DROP",
            direction: "in",
            source: "0.0.0.0/0",
            dest: "0.0.0.0/0",
            proto: "any",
            comment: "Default drop rule",
        },
    ],
    enabled: true,
}, { provider: proxmoxProvider });

// Exports for easy access and integration
export const vmIds = {
    gw: gwVm.id,
    olares: olaresVm.id,
    cosmos: cosmosVm.id,
    ynh: ynhVm.id,
};

export const vmNames = {
    gw: gwVm.name,
    olares: olaresVm.name,
    cosmos: cosmosVm.name,
    ynh: ynhVm.name,
};

export const tailscaleAuthKeySecret = tailscaleAuthKey;

export const totalVCPU = pulumi.all([
    vmsConfig.requireNumber("gw:cpu"),
    vmsConfig.requireNumber("olares:cpu"),
    vmsConfig.requireNumber("cosmos:cpu"),
    vmsConfig.requireNumber("ynh:cpu"),
]).apply(([gw, olares, cosmos, ynh]) => gw + olares + cosmos + ynh);

export const totalMemoryGB = pulumi.all([
    vmsConfig.requireNumber("gw:memory"),
    vmsConfig.requireNumber("olares:memory"),
    vmsConfig.requireNumber("cosmos:memory"),
    vmsConfig.requireNumber("ynh:memory"),
]).apply(([gw, olares, cosmos, ynh]) => (gw + olares + cosmos + ynh) / 1024);

export const totalStorageGB = pulumi.all([
    vmsConfig.requireNumber("gw:diskSize"),
    vmsConfig.requireNumber("olares:diskSize"),
    vmsConfig.requireNumber("cosmos:diskSize"),
    vmsConfig.requireNumber("ynh:diskSize"),
]).apply(([gw, olares, cosmos, ynh]) => gw + olares + cosmos + ynh);

export const clusterStatus = pulumi.output("Homelab cluster infrastructure deployed successfully");