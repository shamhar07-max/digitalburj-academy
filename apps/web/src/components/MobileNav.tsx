"use client";
import { useState } from "react";
import Link from "next/link";

export function MobileNav({ role }: { role?: string }) {
  const [open, setOpen] = useState(false);
  const staff = role === "teacher" || role === "admin";
  const links: [string, string][] = [
    ["/courses", "Courses"],
    ["/missions", "Missions"],
    ["/talent", "Talent"],
    ["/jobs", "Jobs"],
    ["/passport", "Passport"],
    ["/dashboard", "Dashboard"],
    ["/evidence", "Evidence"],
  ];
  if (role === "client" || staff || role === "admin") links.push(["/projects", "Projects"]);
  if (staff) links.push(["/teacher", "Review queue"]);
  if (role === "admin") links.push(["/admin", "Admin"]);
  return (
    <div className="md:hidden">
      <button onClick={() => setOpen((v) => !v)} aria-label="Menu" aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-hair text-xl font-bold">
        {open ? "×" : "≡"}
      </button>
      {open && (
        <nav aria-label="Mobile" className="absolute inset-x-0 top-16 z-50 border-b border-hair bg-lab px-6 py-4 shadow-lg">
          {links.map(([href, label]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className="block rounded-lg px-2 py-2.5 text-base font-bold text-ink-soft hover:text-ink">
              {label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
