import {
  CopyIcon,
  FlameIcon,
  GaugeIcon,
  InboxIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  MailIcon,
  MegaphoneIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldBanIcon,
  UploadIcon,
  UsersIcon,
  UsersRoundIcon,
} from "lucide-react";
import type { Role } from "@/lib/api/client";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
  /** Roles that see this item. Omitted means everyone. */
  roles?: Role[];
  /** Build-order milestone (plan section 24) for pages not built yet. */
  milestone?: number;
};

export type NavGroup = { label: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/", icon: LayoutDashboardIcon, description: "Today at a glance." },
    ],
  },
  {
    label: "Leads",
    items: [
      {
        title: "Import",
        href: "/leads/import",
        icon: UploadIcon,
        description: "Upload a CSV of leads and match its columns.",
      },
      {
        title: "Groups",
        href: "/leads/groups",
        icon: UsersRoundIcon,
        description: "Lead groups and the people in them.",
      },
      {
        title: "Duplicates",
        href: "/leads/duplicates",
        icon: CopyIcon,
        description: "Review leads that match people already in the system.",
        milestone: 5,
      },
    ],
  },
  {
    label: "Outreach",
    items: [
      {
        title: "Campaigns",
        href: "/campaigns",
        icon: MegaphoneIcon,
        description: "Build campaigns, start them and follow their progress.",
      },
      {
        title: "Replies",
        href: "/replies",
        icon: InboxIcon,
        description: "Replies detected across all campaigns.",
        milestone: 8,
      },
    ],
  },
  {
    label: "Sending",
    items: [
      {
        title: "Mailboxes",
        href: "/mailboxes",
        icon: MailIcon,
        description: "The fastnexa.com mailboxes campaigns send from.",
      },
      {
        title: "Warm-up",
        href: "/warmup",
        icon: FlameIcon,
        description: "Warm-up status and helper accounts.",
        milestone: 9,
      },
      {
        title: "Deliverability",
        href: "/deliverability",
        icon: GaugeIcon,
        description: "Health checks, alerts, server logs and placement tests.",
        milestone: 10,
      },
      {
        title: "Do not contact",
        href: "/dnc",
        icon: ShieldBanIcon,
        description: "People and domains that must never be emailed.",
      },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        title: "Activity log",
        href: "/logs",
        icon: ScrollTextIcon,
        description: "Every change, who made it and what it changed.",
      },
      {
        title: "Users",
        href: "/users",
        icon: UsersIcon,
        description: "Invite people and manage their roles and access.",
        roles: ["ADMIN"],
      },
      {
        title: "Settings",
        href: "/settings",
        icon: SettingsIcon,
        description: "The footer added to every email.",
      },
    ],
  },
];

const ALL_ITEMS = NAV.flatMap((g) => g.items);

export function navForRole(role: Role): NavGroup[] {
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || i.roles.includes(role)) })).filter(
    (g) => g.items.length > 0,
  );
}

export function navItem(href: string): NavItem {
  const item = ALL_ITEMS.find((i) => i.href === href);
  if (!item) throw new Error(`No nav item for ${href}`);
  return item;
}

/** The nav item a pathname belongs to (longest matching prefix). */
export function activeNavItem(pathname: string): NavItem | undefined {
  return ALL_ITEMS.filter((i) => (i.href === "/" ? pathname === "/" : pathname === i.href || pathname.startsWith(`${i.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
