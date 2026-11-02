import { BadgeCheck, Briefcase, Bug, Cable, ChartColumn, Cloud, ClipboardList, CodeXml, Database, FolderOpen, GitBranch, HardHat, Headset, Kanban, Layers, Megaphone, Network, PenTool, Server, ShieldCheck, Smartphone, SquareTerminal, Users, Wrench, Zap, type LucideIcon } from "lucide-react";
import { roleArt } from "@/lib/role-art";

const ICONS: Record<string, LucideIcon> = {
  code: CodeXml, server: Server, layers: Layers, branch: GitBranch, phone: Smartphone, bug: Bug, pen: PenTool, chart: ChartColumn, database: Database, shield: ShieldCheck,
  headset: Headset, terminal: SquareTerminal, cloud: Cloud, clipboard: ClipboardList, kanban: Kanban, network: Network, hardhat: HardHat, briefcase: Briefcase,
  megaphone: Megaphone, people: Users, wrench: Wrench, cable: Cable, zap: Zap, badge: BadgeCheck, folder: FolderOpen,
};

// The picture for a position: a colored banner with a large, matching icon. Drawn here, so it is light, sharp on every screen,
// the same in print, and free of any license. The text alternative says what the picture is.
export function RoleArt({ title, className = "h-40" }: { title: string; className?: string }) {
  const a = roleArt(title);
  const Icon = ICONS[a.icon] ?? Briefcase;
  return (
    <div role="img" aria-label={`${title}: ${a.caption}`} className={`relative isolate overflow-hidden ${className}`} style={{ background: `linear-gradient(135deg, ${a.from}, ${a.to})` }}>
      <svg aria-hidden className="absolute inset-0 h-full w-full opacity-[0.16]" xmlns="http://www.w3.org/2000/svg">
        <defs><pattern id={`dots-${a.icon}`} width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="white" /></pattern></defs>
        <rect width="100%" height="100%" fill={`url(#dots-${a.icon})`} />
      </svg>
      <span aria-hidden className="absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/15" />
      <span aria-hidden className="absolute -bottom-14 -left-8 h-40 w-40 rounded-full bg-black/10" />
      <span aria-hidden className="absolute bottom-6 right-5 h-14 w-14 rounded-full border-2 border-white/30" />
      <div className="relative flex h-full items-center gap-4 px-6">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-white/20 shadow-lg ring-1 ring-white/40 backdrop-blur-sm">
          <Icon className="h-11 w-11 text-white drop-shadow" strokeWidth={1.6} />
        </span>
        <span className="min-w-0 text-sm font-semibold leading-snug text-white/95 drop-shadow-sm">{a.caption}</span>
      </div>
    </div>
  );
}
