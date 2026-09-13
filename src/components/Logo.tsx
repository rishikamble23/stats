import Link from "next/link";

export function Logo({ href = "/", size = "md" }: { href?: string; size?: "sm" | "md" | "lg" }) {
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg";
  return (
    <Link href={href} className={`inline-flex items-center gap-2 font-extrabold tracking-tight text-ink ${text}`}>
      <span className="grid size-7 place-items-center rounded-[10px] bg-ink text-sm text-white shadow-[0_4px_12px_-4px_rgba(0,0,0,0.5)]">✦</span>
      howitsgoing
    </Link>
  );
}
