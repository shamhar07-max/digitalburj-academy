import type { Metadata } from "next";
import { Sora, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import Link from "next/link";

const sora = Sora({ variable: "--font-sora", subsets: ["latin"], weight: ["600", "700", "800"], display: "swap" });
const plexsans = IBM_Plex_Sans({ variable: "--font-plexsans", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const plexmono = IBM_Plex_Mono({ variable: "--font-plexmono", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Digital Burj Academy", template: "%s — DB Academy" },
  description: "Learn by building. Missions, submissions, review, evidence.",
};

async function TopBar() {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  return (
    <header className="sticky top-0 z-50 border-b border-hair bg-lab/90 backdrop-blur">
      <div className="container-db flex h-16 items-center justify-between gap-4">
        <Link href="/" className="font-display text-lg font-extrabold tracking-tight">
          DIGITAL<span className="text-cobalt">BURJ</span> <span className="font-mono-d ml-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint">Academy</span>
        </Link>
        <nav className="hidden items-center gap-5 text-sm font-semibold text-ink-soft md:flex">
          <Link href="/courses" className="hover:text-ink">Courses</Link>
          <Link href="/missions" className="hover:text-ink">Missions</Link>
          <Link href="/dashboard" className="hover:text-ink">Dashboard</Link>
          <Link href="/evidence" className="hover:text-ink">Evidence</Link>
          {user && (user.role === "teacher" || user.role === "admin") && (
            <Link href="/teacher" className="hover:text-ink">Review queue</Link>
          )}
          {user?.role === "admin" && <Link href="/admin" className="hover:text-ink">Admin</Link>}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <span className="font-mono-d hidden text-xs text-ink-faint sm:inline">{user.name} · {user.role}</span>
              <form action="/api/auth/session" method="post">
                <button formAction="/api/auth/session" className="rounded-lg border border-hair bg-panel px-3 py-1.5 text-xs font-bold hover:border-cobalt" formMethod="post">Log out</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="font-semibold text-ink-soft hover:text-ink">Log in</Link>
              <Link href="/register" className="rounded-lg bg-cobalt px-4 py-2 font-bold text-white hover:opacity-90">Join</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${plexsans.variable} ${plexmono.variable}`}>
      <body className="flex min-h-screen flex-col" style={{ fontFamily: "var(--font-plexsans)" }}>
        <TopBar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-hair py-8">
          <div className="container-db font-mono-d flex flex-col gap-2 text-xs text-ink-faint sm:flex-row sm:justify-between">
            <span>© 2026 DIGITAL BURJ ACADEMY · LEARN → BUILD → VERIFY</span>
            <span>demo logins: student / teacher / admin @digitalburj.com · demo1234</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
