import type { ReactNode } from "react";
import type { MediaTileStyles } from "../_styles";
import { cn } from "../../../lib/utils";
export type MediaTileData = {
  description: string;
  description2: string;
  height: string;
  viewBox: string;
  width: string;
  icon: ReactNode;
};
/** A media tile. */
export default function MediaTile({ d, styles }: { d: MediaTileData; styles: MediaTileStyles }) {
  return (
    <div className="flex relative py-4 px-5 rounded-[16.8px] items-center flex-1 gap-3 bg-surface-3 h-[5.4375rem]">
      <div className={cn("w-65.5 h-full block absolute top-0 left-0 min-w-0 p-px rounded-[16.8px] pointer-events-none 2xl:w-105.5", styles.className)} style={{ backgroundImage: "linear-gradient(var(--clr-16) 0%, var(--clr-17) 100%)", maskImage: "linear-gradient(var(--surface) 0px, var(--surface) 0px), linear-gradient(var(--surface) 0px, var(--surface) 0px)" }} />
      <div className="flex flex-col justify-center flex-1">
        <p className="block text-color-001 text-sm leading-5 whitespace-nowrap text-nowrap">
          {d.description}
        </p>
        <p className="block text-surface text-2xl font-bold leading-8 whitespace-nowrap text-nowrap">
          {d.description2}
        </p>
      </div>
      <svg className={cn("w-auto block overflow-hidden align-middle", styles.className2)} data-component="image" fill="none" height={d.height} viewBox={d.viewBox} width={d.width} xmlns="http://www.w3.org/2000/svg">{d.icon}</svg>
    </div>
  );
}
