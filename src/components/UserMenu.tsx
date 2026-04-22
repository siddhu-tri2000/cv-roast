"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
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
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:border-neutral-500"
        >
          <span>👤</span>
          <span>Sign in</span>
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
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-neutral-300 bg-white py-1 pl-1 pr-3 text-sm font-medium text-neutral-700 transition hover:border-neutral-500"
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="h-7 w-7 rounded-full" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-700 text-xs font-bold text-white">
            {initial}
          </span>
        )}
        <span className="max-w-[120px] truncate hidden sm:inline">{name}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
            <div className="border-b border-neutral-100 px-4 py-3">
              <div className="truncate text-sm font-semibold text-neutral-900">{name}</div>
              {user.email && (
                <div className="truncate text-xs text-neutral-500">{user.email}</div>
              )}
            </div>
            <a
              href="/history"
              className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              📜 My search history
            </a>
            <button
              onClick={signOut}
              className="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50"
            >
              ↪︎ Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
