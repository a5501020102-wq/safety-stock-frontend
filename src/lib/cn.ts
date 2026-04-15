/**
 * Minimal className joiner — equivalent to the popular `clsx` pattern
 * without adding a dependency for a one-liner. Skips falsy values so
 * conditional classes can be written inline.
 *
 *   cn("a", cond && "b", undefined, "c") // -> "a b c"  or "a c" if !cond
 */
export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const walk = (value: ClassValue) => {
    if (!value && value !== 0) return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    out.push(String(value));
  };
  inputs.forEach(walk);
  return out.join(" ").trim();
}
