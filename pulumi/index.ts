import * as pulumi from "@pulumi/pulumi";
import * as proxmox from "@pulumi/proxmox";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Pulumi Neo-style: stricter config, secrets, and safer defaults
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cfg = new pulumi.Config();
const env = pulumi.getStack();

// Namespaces
const pmx = new pulumi.Config("proxmox");
const vms = new pulumi.Config("vms");
const ssh = new pulumi.Config("ssh");
const tailscale = new pulumi.Config("tailscale");

// Provider with zero-trust leaning defaults and explicit secrets
const proxmoxProvider = new proxmox.Provider("proxmox", {
  endpoint: pmx.require("endpoint"),
  username: pmx.require("username"),
  password: pmx.requireSecret("password"),
  insecure: pmx.getBoolean("insecure") ?? false,
});

// Shared infra parameters (typed, validated)
const nodeName = pmx.get("node") ?? "r240";
const storagePool = cfg.get("storagePool") ?? "local-zfs";
const bridge = cfg.get("bridge") ?? "vmbr0";

// Optional SSH key for cloud-init user
const sshPublicKey = ssh.get("publicKey") ?? "";

// Secrets and dynamic values
const tailscaleAuthKey = tailscale.requireSecret("authKey");

// User provided capacities (assert types)
const sz = (k: string) => vms.requireNumber(k);

// Deterministic MACs per-VM but allow override via config
const mac = (name: string, def: string) => cfg.get(`mac:${name}`) ?? def;
const macAddresses = {
  gw: mac("gw", "52:54:00:10:00:01"),
  olares: mac("olares", "52:54:00:10:00:02"),
  cosmos: mac("cosmos", "52:54:00:10:00:03"),
  ynh: mac("ynh", "52:54:00:10:00:04"),
};

// Cloud-init templates (allow per-stack overrides)
function cloudInit(name: string, relPath: string) {
  const override = cfg.get(`cloudInit:${name}`);
  return new proxmox.CloudInitTemplate(name, {
    nodeName,
    template: new pulumi.asset.FileAsset(
      override ?? join(__dirname, relPath)
    ),
    storagePool,
  }, { provider: proxmoxProvider });
}

const ciCommon = cloudInit("common", "../cloud-init/user-data-common.yaml");
const ciGw = cloudInit("gw", "../cloud-init/user-data-gw.yaml");
const ciOlares = cloudInit("olares", "../cloud-init/user-data-olares.yaml");
const ciCosmos = cloudInit("cosmos", "../cloud-init/user-data-cosmos.yaml");
const ciYnh = cloudInit("ynh", "../cloud-init/user-data-ynh.yaml");

// Helper to build a VM with opinionated sane defaults
type DiskOpts = { sizeG: number; ssd?: boolean; aio?: string };
function makeVM(name: string, id: number, cpuKey: string, memKey: string, diskKey: string, opts?: DiskOpts, init?: proxmox.types.input.VMInitializationArgs, cdrom?: proxmox.types.input.VMCdromArgs[]) {
  const sizeG = sz(diskKey);
  const vm = new proxmox.VM(name, {
    provider: proxmoxProvider,
    nodeName,
    vmId: id,
    name,
    description: cfg.get(`desc:${name}`) ?? name,

    cpu: {
      cores: sz(cpuKey),
      type: "host",
      sockets: 1,
      flags: "pcid,pcie,hypervisor",
    },
    memory: { dedicated: sz(memKey) },

    disk: [{
      datastoreId: storagePool,
      fileFormat: "qcow2",
      size: pulumi.interpolate`${sizeG}G`,
      type: "scsi",
      interface: "virtio-scsi-pci",
      iothread: true,
      discard: "on",
      ssd: opts?.ssd ?? true,
      cache: "writeback",
      storage: storagePool,
      ...(opts?.aio ? { aio: opts.aio } : {}),
    }],

    networkDevice: [{
      model: "virtio",
      bridge,
      macAddress: (macAddresses as any)[name.split("-")[0]],
      firewall: true,
      vlanId: cfg.getNumber(`vlan:${name}`) ?? 0,
    }],

    osType: "cloud-init",
    scsihw: "virtio-scsi-pci",
    bootDisk: storagePool,
    bootOrder: cfg.get(`bootOrder:${name}`) ?? "scsi0;net0;ide2;ide0;ide1",

    agent: [{
      enabled: true,
      trimClonedDisks: true,
      hotplug: "network-disks",
    }],

    initialization: [init ?? {
      ipConfig0: cfg.get(`ip:${name}`) ?? "ip=dhcp",
      userAccount: {
        username: cfg.get("user:name") ?? "ubuntu",
        uid: cfg.getNumber("user:uid") ?? 1000,
        // Encourage SSH-only by default; password optional via config
        ...(cfg.get("user:passwordHash") ? { password: cfg.get("user:passwordHash")! } : {}),
        keys: sshPublicKey ? [sshPublicKey] : [],
      },
    }],

    tags: cfg.get(`tags:${name}`) ?? "homelab",
    onBoot: true,
    startupOrder: cfg.getNumber(`startup:${name}`) ?? 1,
    hotplug: "network,disk,usb,memory",
    freezeCpuAtStartup: false,

    vga: "std",
    vgaSpice: false,
    vgaQxl: false,

    ...(cdrom ? { cdrom } : {}),
  }, { provider: proxmoxProvider });

  return vm;
}

// GW
const gw = makeVM(
  "gw-01", 100, "gw:cpu", "gw:memory", "gw:diskSize",
  { ssd: true },
  {
    ipConfig0: cfg.get("ip:gw-01") ?? "ip=dhcp",
    userAccount: {
      username: cfg.get("user:name") ?? "ubuntu",
      uid: cfg.getNumber("user:uid") ?? 1000,
      keys: sshPublicKey ? [sshPublicKey] : [],
    },
    userDataFileId: ciGw.id,
    userDataReplaceVar: {
      TAILSCALE_AUTHKEY: tailscaleAuthKey,
      CLOUDFLARE_ACCOUNT_ID: pulumi.secret(cfg.get("cloudflare:accountId") ?? ""),
      CLOUDFLARE_TUNNEL_ID: pulumi.secret(cfg.get("cloudflare:tunnelId") ?? ""),
      CLOUDFLARE_TUNNEL_SECRET: pulumi.secret(cfg.get("cloudflare:tunnelSecret") ?? ""),
      DOMAIN: cfg.get("domain") ?? "example.lan",
    },
  }
);

// Olares (with optional ISO first boot)
const olares = makeVM(
  "olares-01", 101, "olares:cpu", "olares:memory", "olares:diskSize",
  { ssd: true },
  {
    ipConfig0: cfg.get("ip:olares-01") ?? "ip=dhcp",
    userAccount: { username: cfg.get("user:name") ?? "ubuntu", uid: cfg.getNumber("user:uid") ?? 1000, keys: sshPublicKey ? [sshPublicKey] : [] },
    userDataFileId: ciOlares.id,
    userDataReplaceVar: { TAILSCALE_AUTHKEY: tailscaleAuthKey },
  },
  cfg.get("olares:iso") ? [{ ide: "ide2", iso: cfg.require("olares:iso"), storage: cfg.get("olares:isoStorage") ?? "local", interface: "ide", boot: true }] : undefined
);

// Cosmos (media server)
const cosmos = makeVM(
  "cosmos-01", 102, "cosmos:cpu", "cosmos:memory", "cosmos:diskSize",
  { ssd: cfg.getBoolean("cosmos:ssd") ?? false, aio: "io_uring" },
  {
    ipConfig0: cfg.get("ip:cosmos-01") ?? "ip=dhcp",
    userAccount: { username: cfg.get("user:name") ?? "ubuntu", uid: cfg.getNumber("user:uid") ?? 1000, keys: sshPublicKey ? [sshPublicKey] : [] },
    userDataFileId: ciCosmos.id,
    userDataReplaceVar: { TAILSCALE_AUTHKEY: tailscaleAuthKey },
  }
);

// YunoHost
const ynh = makeVM(
  "ynh-01", 103, "ynh:cpu", "ynh:memory", "ynh:diskSize",
  { ssd: true },
  {
    ipConfig0: cfg.get("ip:ynh-01") ?? "ip=dhcp",
    userAccount: { username: cfg.get("user:name") ?? "ubuntu", uid: cfg.getNumber("user:uid") ?? 1000, keys: sshPublicKey ? [sshPublicKey] : [] },
    userDataFileId: ciYnh.id,
    userDataReplaceVar: { TAILSCALE_AUTHKEY: tailscaleAuthKey },
  }
);

// Minimal deny-by-default host firewall with Tailscale allow
const rules: proxmox.types.input.FirewallRuleArgs[] = [
  { action: "ACCEPT", direction: "in", source: "0.0.0.0/0", dest: "0.0.0.0/0", proto: "tcp", dport: "22", comment: "SSH" },
  { action: "ACCEPT", direction: "in", source: "0.0.0.0/0", dest: "0.0.0.0/0", proto: "tcp", dport: "80,443", comment: "Web" },
  { action: "ACCEPT", direction: "in", source: "100.64.0.0/10", dest: "0.0.0.0/0", proto: "any", comment: "Tailscale" },
  { action: "DROP", direction: "in", source: "0.0.0.0/0", dest: "0.0.0.0/0", proto: "any", comment: "Default drop" },
];

const firewall = new proxmox.Firewall("homelab-firewall", { nodeName, rules, enabled: true }, { provider: proxmoxProvider });

// Rich exports for CI and dashboards
export const vmIds = { gw: gw.id, olares: olares.id, cosmos: cosmos.id, ynh: ynh.id };
export const vmNames = { gw: gw.name, olares: olares.name, cosmos: cosmos.name, ynh: ynh.name };
export const tailscaleAuthKeySecret = tailscaleAuthKey;
export const totalVCPU = pulumi.all([
  vms.requireNumber("gw:cpu"), vms.requireNumber("olares:cpu"), vms.requireNumber("cosmos:cpu"), vms.requireNumber("ynh:cpu")
]).apply(([gw, ol, cs, yn]) => gw + ol + cs + yn);
export const totalMemoryGB = pulumi.all([
  vms.requireNumber("gw:memory"), vms.requireNumber("olares:memory"), vms.requireNumber("cosmos:memory"), vms.requireNumber("ynh:memory")
]).apply(([gw, ol, cs, yn]) => (gw + ol + cs + yn) / 1024);
export const totalStorageGB = pulumi.all([
  vms.requireNumber("gw:diskSize"), vms.requireNumber("olares:diskSize"), vms.requireNumber("cosmos:diskSize"), vms.requireNumber("ynh:diskSize")
]).apply(([gw, ol, cs, yn]) => gw + ol + cs + yn);
export const clusterStatus = pulumi.output(`Homelab infra ready on ${env} using ${nodeName}/${storagePool}`);
