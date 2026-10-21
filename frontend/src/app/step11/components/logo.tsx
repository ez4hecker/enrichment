import type { ReactNode } from "react";
import type { LogoStyles } from "../_styles";
import { cn } from "../../../lib/utils";
export type LogoData = {
  ariaLabel: string;
  href: string;
  label: string;
  stroke?: string;
  strokeWidth?: string;
  strokeLinecap?: string;
  strokeLinejoin?: string;
  icon: ReactNode;
  focusable?: string;
};
/** A logo. */
export default function Logo({ d, styles }: { d: LogoData; styles: LogoStyles }) {
  return (
    <div className="flex relative mt-[0.5625rem] items-center" aria-label={d.ariaLabel}>
      <a className={cn("w-10 h-10 flex relative rounded-lg justify-center items-center text-muted-foreground cursor-pointer hover:bg-clr-21 hover:text-foreground hover:[text-decoration-color:var(--foreground)]", styles.className)} data-component="link" href={d.href} title={d.label}>
        <svg className={cn("w-auto h-6 block overflow-hidden align-middle text-muted focus:[outline-style:auto] focus:outline-[5px]", styles.className2)} data-component="icon" aria-hidden="true" fill="none" height="24" stroke={d.stroke} viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg" strokeWidth={d.strokeWidth} strokeLinecap={d.strokeLinecap} strokeLinejoin={d.strokeLinejoin} focusable={d.focusable}>{d.icon}</svg>
      </a>
    </div>
  );
}
