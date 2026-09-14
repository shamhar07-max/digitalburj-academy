import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import Link from "next/link";
import { MobileNav } from "@/components/MobileNav";

// Same variable names as the main site (kept so existing CSS is untouched).
const sora = IBM_Plex_Sans({ variable: "--font-sora", subsets: ["latin"], weight: ["500", "600", "700"], display: "swap" });
const plexsans = IBM_Plex_Sans({ variable: "--font-plexsans", subsets: ["latin"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], display: "swap" });
const plexmono = IBM_Plex_Mono({ variable: "--font-plexmono", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Digital Burj Academy", template: "%s — DB Academy" },
  description: "Learn by building. Missions, submissions, review, evidence.",
  icons: { icon: "/brand/db-icon.svg" },
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://digitalburj.com";

async function TopBar() {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  const staff = user?.role === "teacher" || user?.role === "admin";
  return (
    <header className="sticky top-0 z-50 border-b border-hair bg-lab/95 backdrop-blur">
      <div className="container-db flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="DigitalBurj Academy home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/platform/brand/db-lockup.svg" alt="DigitalBurj Academy" width={400} height={120} className="h-10 w-auto sm:h-11" decoding="async" />
          <span className="text-xs font-semibold text-ink-faint">Academy</span>
        </Link>
        <nav className="hidden items-center gap-5 text-sm font-semibold text-ink-soft md:flex">
          <Link href="/courses" className="hover:text-ink">Courses</Link>
          <Link href="/missions" className="hover:text-ink">Missions</Link>
          <Link href="/talent" className="hover:text-ink">Talent</Link>
          <Link href="/jobs" className="hover:text-ink">Jobs</Link>
          {user && (user.role === "client" || staff || user.role === "admin") && (
            <Link href="/projects" className="hover:text-ink">Projects</Link>
          )}
          <Link href="/passport" className="hover:text-ink">Passport</Link>
          <Link href="/dashboard" className="hover:text-ink">Dashboard</Link>
          <Link href="/evidence" className="hover:text-ink">Evidence</Link>
          {staff && (
            <Link href="/teacher" className="hover:text-ink">Review queue</Link>
          )}
          {user?.role === "admin" && <Link href="/admin" className="hover:text-ink">Admin</Link>}
          <a href={SITE_URL} className="hover:text-ink" title="DigitalBurj main site">Site ↗</a>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <MobileNav role={user?.role} />
          {user ? (
            <>
              <span className="hidden text-xs text-ink-faint sm:inline">{user.name} · {user.role}</span>
              <form action="/platform/api/auth/session" method="post">
                <button formAction="/platform/api/auth/session" className="rounded-lg border border-hair bg-panel px-3 py-1.5 text-xs font-bold hover:border-cobalt" formMethod="post">Log out</button>
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
          <div className="container-db flex flex-col gap-2 text-xs text-ink-faint sm:flex-row sm:justify-between">
            <span>© 2026 Digital Burj Academy, Dubai, UAE</span>
            {process.env.ALLOW_DEMO_SEED === "1" && (
              <span>demo logins: student / teacher / admin @digitalburj.com · demo1234</span>
            )}
          </div>
        </footer>
      </body>
    </html>
  );
}