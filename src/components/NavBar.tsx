"use client";

import Link from "next/link";
import { Compass, Map, Wrench, Ghost, Mountain } from "lucide-react";
import UserMenu from "@/components/UserMenu";

interface NavBarProps {
  extra?: React.ReactNode;
}

export default function NavBar({ extra }: NavBarProps) {
  return (
    <nav className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#08090A]/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-[15px] font-semibold tracking-tight text-white"
        >
          <Compass className="h-5 w-5" strokeWidth={2} />
          CareerCompass
        </Link>
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <NavLink href="/map" Icon={Map} label="Career Map" />
          <NavLink href="/studio" Icon={Wrench} label="Resume Studio" />
          <NavLink href="/ghost-buster" Icon={Ghost} label="JD Ghost Buster" />
          <NavLink href="/journey" Icon={Mountain} label="Career Journey" />
          {extra}
          <UserMenu />
        </div>
      </div>
    </nav>
  );
}

function NavLink({
  href,
  Icon,
  label,
}: {
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-semibold text-white/90 transition hover:bg-white/[0.05] hover:text-white sm:px-2.5"
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden md:inline">{label}</span>
    </Link>
  );
}
