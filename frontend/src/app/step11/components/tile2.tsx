import type { Tile2Styles } from "../_styles";
import { cn } from "../../../lib/utils";
export type Tile2Data = {
  ariacolindex: string;
  text: string;
};
/** A content tile. */
export default function Tile2({ d, styles }: { d: Tile2Data; styles: Tile2Styles }) {
  return (
    <div className={cn("hidden 2xl:w-50 2xl:h-full 2xl:border 2xl:border-solid 2xl:border-t-clr-4 2xl:border-r-border 2xl:border-b-clr-4 2xl:border-l-clr-4 2xl:flex 2xl:absolute 2xl:top-0 2xl:px-[0.9375rem] 2xl:items-center 2xl:grow 2xl:overflow-hidden 2xl:leading-[2.4375rem]", styles.className)} aria-colindex={d.ariacolindex} role="gridcell">
      <span className="hidden 2xl:block 2xl:leading-5">
        {d.text}
      </span>
    </div>
  );
}
