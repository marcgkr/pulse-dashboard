import { cx } from "../ui";

/** The tiny "Rx" tag printed on every specialist box. */
export function RxTag({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center rounded-full px-2 font-display text-[12px] font-extrabold italic leading-none tracking-tight",
        light ? "bg-white text-ink" : "bg-ink text-white",
        className,
      )}
      aria-hidden
    >
      Rx
    </span>
  );
}
