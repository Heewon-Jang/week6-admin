"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; heading?: never } | { heading: string; href?: never; label?: never };

const LINKS: NavItem[] = [
  { href: "/", label: "📊 Dashboard" },
  { href: "/users", label: "👥 Users" },
  { href: "/media", label: "🖼️ AI Media" },
  { href: "/votes", label: "🗳️ Votes & Ratings" },
  { heading: "Prompts" },
  { href: "/data/prompt-chains", label: "⛓️ Prompt chains" },
  { href: "/data/prompt-chain-steps", label: "🪜 Chain steps" },
  { href: "/data/prompt-chain-mix", label: "🎚️ Chain mix" },
  { href: "/data/terms", label: "📖 Terms" },
  { href: "/data/generation-examples", label: "💡 Examples" },
  { heading: "Observability" },
  { href: "/data/generation-requests", label: "📨 Generation requests" },
  { href: "/data/llm-responses", label: "💬 LLM responses" },
  { heading: "LLMs" },
  { href: "/data/llm-models", label: "🤖 Models" },
  { href: "/data/llm-providers", label: "🏢 Providers" },
  { heading: "Access" },
  { href: "/data/signup-domains", label: "🌐 Signup domains" },
  { href: "/data/whitelisted-emails", label: "✉️ Whitelisted emails" },
];

export default function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {LINKS.map(({ href, label, heading }) => {
        if (heading) {
          return (
            <p
              key={heading}
              className="hidden px-3 pt-3 text-[10px] font-semibold tracking-wider text-gray-400 uppercase md:block"
            >
              {heading}
            </p>
          );
        }
        if (!href) return null;
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-lg px-3 py-2 text-sm whitespace-nowrap ${
              active
                ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                : "hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
