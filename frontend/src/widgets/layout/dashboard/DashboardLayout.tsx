/**
 * @file DashboardLayout.tsx
 * @description Main authenticated shell for the dashboard experience.
 */

import React, { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Briefcase,
  Calendar,
  CalendarCheck,
  FileText,
  FolderOpen,
  Headphones,
  LayoutDashboard,
  LogOut,
  Menu,
  Music,
  Settings,
  Users,
  Wrench,
  X,
} from "lucide-react";

import { useAuth } from "../../../app/providers/AuthProvider";

interface AuthUser {
  id?: string | number;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_admin?: boolean;
  artist_profile_id?: string | number;
  voice_type_display?: string;
}

interface NavLinkItem {
  to: string;
  labelKey: string;
  icon: React.ReactNode;
}

interface NavGroup {
  labelKey: string;
  links: NavLinkItem[];
}

const APP_VERSION = "1.0";

const adminNavGroups: NavGroup[] = [
  {
    labelKey: "dashboard.layout.groups.overview",
    links: [
      {
        to: "/panel",
        icon: <LayoutDashboard size={18} aria-hidden="true" />,
        labelKey: "dashboard.layout.links.admin_dashboard",
      },
    ],
  },
  {
    labelKey: "dashboard.layout.groups.production",
    links: [
      {
        to: "/panel/project-management",
        icon: <Briefcase size={18} aria-hidden="true" />,
        labelKey: "dashboard.layout.links.projects",
      },
      {
        to: "/panel/rehearsals",
        icon: <CalendarCheck size={18} aria-hidden="true" />,
        labelKey: "dashboard.layout.links.attendance",
      },
    ],
  },
  {
    labelKey: "dashboard.layout.groups.data_admin",
    links: [
      {
        to: "/panel/artists",
        icon: <Users size={18} aria-hidden="true" />,
        labelKey: "dashboard.layout.links.artists",
      },
      {
        to: "/panel/crew",
        icon: <Wrench size={18} aria-hidden="true" />,
        labelKey: "dashboard.layout.links.crew",
      },
      {
        to: "/panel/contracts",
        icon: <FileText size={18} aria-hidden="true" />,
        labelKey: "dashboard.layout.links.contracts",
      },
      {
        to: "/panel/archive-management",
        icon: <Music size={18} aria-hidden="true" />,
        labelKey: "dashboard.layout.links.archive",
      },
    ],
  },
  {
    labelKey: "dashboard.layout.groups.artist_zone",
    links: [
      {
        to: "/panel/schedule",
        icon: <Calendar size={18} aria-hidden="true" />,
        labelKey: "dashboard.layout.links.schedule",
      },
      {
        to: "/panel/materials",
        icon: <Headphones size={18} aria-hidden="true" />,
        labelKey: "dashboard.layout.links.materials",
      },
      {
        to: "/panel/resources",
        icon: <FolderOpen size={18} aria-hidden="true" />,
        labelKey: "dashboard.layout.links.resources",
      },
    ],
  },
];

const artistNavGroups: NavGroup[] = [
  {
    labelKey: "dashboard.layout.groups.overview",
    links: [
      {
        to: "/panel",
        icon: <LayoutDashboard size={18} aria-hidden="true" />,
        labelKey: "dashboard.layout.links.artist_dashboard",
      },
    ],
  },
  {
    labelKey: "dashboard.layout.groups.my_zone",
    links: [
      {
        to: "/panel/schedule",
        icon: <Calendar size={18} aria-hidden="true" />,
        labelKey: "dashboard.layout.links.schedule",
      },
      {
        to: "/panel/materials",
        icon: <Headphones size={18} aria-hidden="true" />,
        labelKey: "dashboard.layout.links.materials",
      },
      {
        to: "/panel/resources",
        icon: <FolderOpen size={18} aria-hidden="true" />,
        labelKey: "dashboard.layout.links.resources",
      },
    ],
  },
];

function BrandMark(): React.JSX.Element {
  return (
    <h2
      className="text-3xl font-medium text-stone-900 tracking-tight"
      style={{ fontFamily: "'Cormorant', serif" }}
    >
      Voct<span className="italic text-[#002395]">Manager</span>
    </h2>
  );
}

export default function DashboardLayout(): React.JSX.Element {
  const { t } = useTranslation();
  const { user, logout } = useAuth() as {
    user: AuthUser | null;
    logout: () => void;
  };
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAdmin = user?.is_admin;
  const navGroups = isAdmin ? adminNavGroups : artistNavGroups;
  const userFullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
  const userRoleLabel = isAdmin
    ? t("dashboard.layout.roles.admin")
    : user?.voice_type_display || t("dashboard.layout.roles.artist");
  const mobileRoleLabel = isAdmin
    ? t("dashboard.layout.roles.management")
    : t("dashboard.layout.roles.artist");

  useEffect(() => {
    document.body.classList.add("admin-mode");
    document.body.style.backgroundColor = "#f4f2ee";

    return () => {
      document.body.classList.remove("admin-mode");
      document.body.style.backgroundColor = "";
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  const NavItem = ({ to, icon, labelKey }: NavLinkItem) => (
    <NavLink
      to={to}
      end={to === "/panel"}
      onClick={() => setIsMobileMenuOpen(false)}
      className={({ isActive }) =>
        [
          "group flex items-center gap-3 rounded-2xl border px-4 py-3 text-xs font-bold tracking-wide transition-all duration-300",
          isActive
            ? "border-[#001766]/20 bg-[linear-gradient(135deg,#002395_0%,#0f4bd8_100%)] text-white shadow-[0_16px_34px_rgba(0,35,149,0.28)]"
            : "border-transparent bg-white/55 text-stone-500 hover:border-stone-200/70 hover:bg-white hover:text-stone-900 hover:shadow-[0_10px_24px_rgba(28,25,23,0.08)]",
        ].join(" ")
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={[
              "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
              isActive ? "bg-white/15" : "bg-black/5 group-hover:bg-stone-100/90",
            ].join(" ")}
          >
            {icon}
          </span>
          <span>{t(labelKey)}</span>
        </>
      )}
    </NavLink>
  );

  const UserAvatar = () => {
    const initials =
      `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`.toUpperCase() ||
      "U";

    return (
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-sm font-bold text-[#002395] shadow-sm">
        {initials}
      </div>
    );
  };

  return (
    <div className="relative flex min-h-screen bg-[#f4f2ee] font-sans">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-12rem] top-[-8rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(15,75,216,0.10),rgba(15,75,216,0))]" />
        <div className="absolute bottom-[-18rem] right-[-10rem] h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(217,119,6,0.10),rgba(217,119,6,0))]" />
      </div>

      <aside className="fixed bottom-4 left-4 top-4 z-20 hidden w-[288px] overflow-hidden rounded-[2rem] border border-white/80 bg-white/72 shadow-[0_8px_30px_rgba(0,0,0,0.04)] shadow-[inset_0_1px_0_rgba(255,255,255,1)] backdrop-blur-2xl md:flex md:flex-col">
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(0,35,149,0.14),rgba(0,35,149,0))]" />
        <div className="absolute right-[-4rem] top-20 h-36 w-36 rounded-full bg-[radial-gradient(circle_at_center,rgba(15,75,216,0.12),rgba(15,75,216,0))]" />

        <div className="relative z-10 flex-shrink-0 p-7 pb-5">
          <BrandMark />
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-stone-200/70 bg-white/85 px-3 py-1.5 shadow-sm">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(34,197,94,0.75)]" />
            <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-stone-500">
              {isAdmin
                ? t("dashboard.layout.brand_badge_admin")
                : t("dashboard.layout.brand_badge_artist")}
            </p>
          </div>
        </div>

        <nav
          className="relative z-10 flex-1 overflow-y-auto px-5 py-2 [scrollbar-width:'none'] [&::-webkit-scrollbar]:hidden"
          style={{
            maskImage:
              "linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)",
          }}
        >
          <div className="space-y-6 py-4">
            {navGroups.map((group) => (
              <div key={group.labelKey}>
                <p className="mb-3 border-b border-stone-100/80 px-4 pb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-stone-400">
                  {t(group.labelKey)}
                </p>
                <div className="space-y-1.5">
                  {group.links.map((link) => (
                    <NavItem key={link.to} {...link} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="relative z-10 flex flex-shrink-0 flex-col gap-3 border-t border-white/60 bg-stone-50/55 p-5">
          <div className="flex items-center justify-between rounded-[1.35rem] border border-stone-200/70 bg-white/90 p-3 shadow-sm">
            <div className="flex min-w-0 items-center gap-3 overflow-hidden">
              <UserAvatar />
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-stone-800">
                  {userFullName || user?.username}
                </p>
                <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-[0.18em] text-stone-400">
                  {userRoleLabel}
                </p>
              </div>
            </div>
            <Link
              to="/panel"
              className="rounded-xl border border-stone-200/80 bg-stone-50 p-2 text-stone-400 transition-colors hover:border-blue-100 hover:bg-blue-50 hover:text-[#002395]"
              title={t("dashboard.layout.profile_settings")}
            >
              <Settings size={16} aria-hidden="true" />
            </Link>
          </div>

          <button
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-transparent px-4 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-600 active:scale-95"
          >
            <LogOut size={16} aria-hidden="true" />
            {t("dashboard.layout.logout")}
          </button>

          <div className="pt-1 text-center">
            <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-stone-400 opacity-70">
              {t("dashboard.layout.footer_version", { version: APP_VERSION })}
            </span>
          </div>
        </div>
      </aside>

      <header className="fixed top-0 z-50 flex w-full items-center justify-between border-b border-stone-200/60 bg-white/80 px-5 py-4 shadow-sm backdrop-blur-2xl md:hidden">
        <BrandMark />
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="rounded-2xl border border-stone-200/80 bg-white p-2.5 text-stone-600 shadow-sm transition-colors hover:bg-stone-100 active:scale-95"
          aria-label={t("dashboard.layout.mobile_nav_title")}
        >
          <Menu size={20} aria-hidden="true" />
        </button>
      </header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 z-40 bg-stone-900/25 backdrop-blur-sm md:hidden"
              aria-hidden="true"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed bottom-0 right-0 top-0 z-50 flex w-4/5 max-w-sm flex-col border-l border-white/60 bg-[#f4f2ee] shadow-2xl md:hidden"
            >
              <div className="relative flex flex-shrink-0 items-center justify-between border-b border-stone-200/60 bg-white/84 p-5 backdrop-blur-xl">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#002395]">
                    {t("dashboard.layout.mobile_nav_title")}
                  </span>
                  <div className="mt-2">
                    <BrandMark />
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-2xl border border-stone-200 bg-white p-2 text-stone-400 shadow-sm transition-all hover:text-stone-900 active:scale-95"
                  aria-label={t("common.actions.cancel")}
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              <nav className="flex-1 space-y-6 overflow-y-auto px-5 py-6">
                {navGroups.map((group) => (
                  <div key={group.labelKey}>
                    <p className="mb-3 border-b border-stone-200/70 px-4 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">
                      {t(group.labelKey)}
                    </p>
                    <div className="space-y-1.5">
                      {group.links.map((link) => (
                        <NavItem key={link.to} {...link} />
                      ))}
                    </div>
                  </div>
                ))}
              </nav>

              <div className="flex flex-shrink-0 flex-col gap-3 border-t border-stone-200/60 bg-white/84 p-5 backdrop-blur-xl">
                <div className="flex items-center gap-3 rounded-[1.35rem] border border-stone-200/70 bg-white p-3 shadow-sm">
                  <UserAvatar />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-stone-800">
                      {userFullName || user?.username}
                    </p>
                    <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400">
                      {mobileRoleLabel}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/panel"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-600 transition-colors hover:border-blue-100 hover:bg-blue-50 hover:text-[#002395]"
                  >
                    <Settings size={15} aria-hidden="true" />
                    {t("dashboard.layout.profile_settings")}
                  </Link>
                  <button
                    onClick={logout}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-red-600 transition-colors hover:bg-red-100 active:scale-95"
                  >
                    <LogOut size={15} aria-hidden="true" />
                    {t("dashboard.layout.logout")}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="min-w-0 flex-1 px-4 pb-12 pt-24 transition-all sm:px-6 md:pl-[328px] md:pr-8 md:pt-8 lg:pr-12">
        <div className="mx-auto h-full w-full max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
