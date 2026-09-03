import { cn } from "@/lib/utils";

/**
 * Avatar inisial bersama — pola visual "rujukan" dari halaman Data Pembayaran:
 * lingkaran berwarna stabil per seed (nomor kamar / nama) + inisial nama.
 * Dipakai konsisten di semua halaman (desktop & mobile).
 */

const AVATAR_COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-fuchsia-500",
];

export function initialsOf(name: string): string {
  return (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function avatarColorFor(seed?: number | string | null): string {
  if (seed === undefined || seed === null) return AVATAR_COLORS[0];
  let n: number;
  if (typeof seed === "number") {
    n = seed;
  } else {
    n = [...String(seed)].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  }
  // Nomor kamar 1 => warna pertama (indeks 0)
  const idx = (((Math.abs(n) - 1) % AVATAR_COLORS.length) + AVATAR_COLORS.length) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

interface InitialsAvatarProps {
  name: string;
  /** seed warna: nomor kamar utk penghuni, bisa juga nama/hash lainnya */
  seed?: number | string | null;
  className?: string;
}

export function InitialsAvatar({ name, seed, className }: InitialsAvatarProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-full flex items-center justify-center text-white font-bold shrink-0 select-none",
        avatarColorFor(seed),
        className || "h-9 w-9 text-xs"
      )}
    >
      {initialsOf(name)}
    </div>
  );
}
