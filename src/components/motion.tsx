"use client";

import { useRef, type ComponentPropsWithoutRef, type ElementType, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Motion for the public pages. Everything here is decoration: content is fully visible without
// JavaScript, and nothing moves for people who ask their device for reduced motion.

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type RevealProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

/**
 * Its direct children rise into place, a beat apart, the first time they scroll into view.
 * Children already on screen when the page loads are left alone, so nothing flickers.
 */
export function Reveal<T extends ElementType = "div">({ as, children, className, ...rest }: RevealProps<T>) {
  const Tag = (as ?? "div") as ElementType;
  const ref = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      if (reduced() || !ref.current) return;
      const below = (Array.from(ref.current.children) as HTMLElement[]).filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.9);
      if (!below.length) return;
      gsap.set(below, { autoAlpha: 0, y: 32 });
      ScrollTrigger.batch(below, {
        start: "top 90%",
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            autoAlpha: 1,
            y: 0,
            duration: 0.75,
            ease: "power3.out",
            stagger: 0.09,
            overwrite: true,
          }),
      });
    },
    { scope: ref },
  );
  return (
    <Tag ref={ref} className={className} {...rest}>
      {children}
    </Tag>
  );
}

/**
 * The hero's specialist packs drift against the pointer, nearer ones further, like boxes on a
 * counter. Desktop with a mouse only. Children mark their depth with data-depth (0 to 1).
 */
export function PointerDepth({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const root = ref.current;
      const area = root?.closest("section");
      if (!root || !area || reduced() || !window.matchMedia("(pointer: fine)").matches) return;
      const layers = (Array.from(root.querySelectorAll("[data-depth]")) as HTMLElement[]).map((el) => {
        const depth = Number(el.dataset.depth) || 0.5;
        return {
          depth,
          x: gsap.quickTo(el, "x", { duration: 0.9, ease: "power3.out" }),
          y: gsap.quickTo(el, "y", { duration: 0.9, ease: "power3.out" }),
          r: gsap.quickTo(el, "rotation", {
            duration: 1.2,
            ease: "power3.out",
          }),
        };
      });
      const move = (e: PointerEvent) => {
        const b = area.getBoundingClientRect();
        const dx = (e.clientX - b.left) / b.width - 0.5;
        const dy = (e.clientY - b.top) / b.height - 0.5;
        for (const l of layers) {
          l.x(dx * 28 * l.depth);
          l.y(dy * 20 * l.depth);
          l.r(dx * 3 * l.depth);
        }
      };
      const leave = () => layers.forEach((l) => (l.x(0), l.y(0), l.r(0)));
      area.addEventListener("pointermove", move);
      area.addEventListener("pointerleave", leave);
      return () => {
        area.removeEventListener("pointermove", move);
        area.removeEventListener("pointerleave", leave);
      };
    },
    { scope: ref },
  );
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/**
 * A line under the four loop steps that fills as you scroll through them: checkup, prescription,
 * you fix it, re-check. Desktop only, where the steps sit in one row.
 */
export function LoopProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const fill = ref.current?.firstElementChild;
      const steps = ref.current?.parentElement;
      if (!fill || !steps || reduced()) return;
      gsap.fromTo(
        fill,
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          scrollTrigger: {
            trigger: steps,
            start: "top 75%",
            end: "bottom 55%",
            scrub: 0.6,
          },
        },
      );
    },
    { scope: ref },
  );
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-x-6 -bottom-5 hidden h-1.5 overflow-hidden rounded-full bg-line lg:block">
      <div className="h-full origin-left rounded-full bg-scrub" />
    </div>
  );
}
