import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Retraso en ms antes de disparar la entrada (para escalonar hermanos). */
  delay?: number;
  /** Elemento HTML a renderizar. Por defecto un div. */
  as?: keyof JSX.IntrinsicElements;
  /** Si true, la entrada se dispara al montar sin esperar el scroll (contenido above-the-fold). */
  immediate?: boolean;
}

/**
 * Envuelve contenido para revelarlo con una entrada suave la primera vez que
 * entra en viewport. Sin dependencias externas: usa IntersectionObserver y las
 * utilidades .reveal-init / .is-visible de index.css. Respeta prefers-reduced-motion
 * (en ese caso el CSS deja el contenido visible de una).
 */
export function Reveal({
  delay = 0,
  as = "div",
  immediate = false,
  className,
  style,
  children,
  ...rest
}: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(immediate);

  useEffect(() => {
    if (immediate) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [immediate]);

  const Tag = as as "div";

  return (
    <Tag
      ref={ref}
      className={cn("reveal-init", visible && "is-visible", className)}
      style={{ animationDelay: delay ? `${delay}ms` : undefined, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
