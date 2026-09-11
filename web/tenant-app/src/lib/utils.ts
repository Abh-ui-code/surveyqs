import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, resolving Tailwind conflicts (twMerge)
 * on top of conditional composition (clsx). Used by every component. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
