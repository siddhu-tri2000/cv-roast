import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const sp = await searchParams;
  const token = (sp.token ?? "").trim();
  let status: "missing" | "ok" | "notfound" | "error" = "missing";
  let email = "";

  if (token.length > 0 && token.length < 200) {
    try {
      const admin = getAdminSupabase();
      const { data, error } = await admin
        .from("email_subscriptions")
        .update({ paused: true })
        .eq("unsub_token", token)
        .select("email")
        .maybeSingle();
      if (error) status = "error";
      else if (!data) status = "notfound";
      else {
        status = "ok";
        email = (data as { email: string }).email;
      }
    } catch {
      status = "error";
    }
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-12 text-center">
      {status === "ok" && (
        <>
          <div className="text-5xl">✅</div>
          <h1 className="mt-4 text-2xl font-extrabold text-neutral-900">You&apos;re unsubscribed</h1>
          <p className="mt-2 text-neutral-600">
            We won&apos;t send weekly digests to <strong>{email}</strong> anymore.
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            You can re-subscribe anytime from{" "}
            <a href="/journey" className="text-indigo-700 underline">your journey page</a>.
          </p>
        </>
      )}
      {status === "missing" && (
        <>
          <div className="text-5xl">🤔</div>
          <h1 className="mt-4 text-2xl font-extrabold text-neutral-900">Missing token</h1>
          <p className="mt-2 text-neutral-600">Use the unsubscribe link from your email.</p>
        </>
      )}
      {status === "notfound" && (
        <>
          <div className="text-5xl">🤷</div>
          <h1 className="mt-4 text-2xl font-extrabold text-neutral-900">Already gone</h1>
          <p className="mt-2 text-neutral-600">
            We couldn&apos;t find a subscription with that token. You may have already unsubscribed.
          </p>
        </>
      )}
      {status === "error" && (
        <>
          <div className="text-5xl">⚠️</div>
          <h1 className="mt-4 text-2xl font-extrabold text-neutral-900">Something went wrong</h1>
          <p className="mt-2 text-neutral-600">Please try the link again, or reply to the email and we&apos;ll remove you manually.</p>
        </>
      )}
      <a
        href="/"
        className="mt-6 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800"
      >
        Back to CareerCompass
      </a>
    </main>
  );
}
