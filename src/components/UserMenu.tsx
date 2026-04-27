"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { UserRound, History, LogOut } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import AuthModal from "@/components/AuthModal";

export default function UserMenu() {
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    const supabase = getBrowserSupabase();
    await supabase.auth.signOut();
    setOpen(false);
  }

  if (!user) {
    return (
      <>
        <button
          onClick={() => setAuthOpen(true)}
          aria-label="Sign in"
          className="ml-1 inline-flex items-center gap-1.5 rounded-md border border-white/[0.12] bg-white/[0.05] px-2.5 py-1.5 text-[13px] font-medium text-white/85 shadow-sm transition hover:border-white/20 hover:bg-white/[0.08] sm:px-3"
        >
          <UserRound className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sign in</span>
        </button>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </>
    );
  }

  const name =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    "Account";
  const avatar = user.user_metadata?.avatar_url as string | undefined;
  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <div className="relative ml-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.03] py-1 pl-1 pr-3 text-[13px] font-medium text-white/85 transition hover:border-white/20 hover:bg-white/[0.06]"
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="h-6 w-6 rounded-full" />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#6E7BFF] text-[11px] font-bold text-white">
            {initial}
          </span>
        )}
        <span className="hidden max-w-[120px] truncate sm:inline">{name}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-xl border border-white/[0.08] bg-[#111216] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]">
            <div className="border-b border-white/[0.06] px-4 py-3">
              <div className="truncate text-[13px] font-semibold text-white">{name}</div>
              {user.email && (
                <div className="truncate text-[11px] text-white/50">{user.email}</div>
              )}
            </div>
            <a
              href="/history"
              className="flex items-center gap-2 px-4 py-2 text-[13px] text-white/80 transition hover:bg-white/[0.04] hover:text-white"
            >
              <History className="h-3.5 w-3.5" />
              My search history
            </a>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] text-rose-300 transition hover:bg-rose-500/10"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
