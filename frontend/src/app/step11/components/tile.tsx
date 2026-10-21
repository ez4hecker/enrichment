import type { TileStyles } from "../_styles";
import { cn } from "../../../lib/utils";
export type TileData = {
  ariarowindex: string;
  text: string;
  text2: string;
  text3: string;
  text4: string;
};
/** A content tile. */
export default function Tile({ d, styles }: { d: TileData; styles: TileStyles }) {
  return (
    <div className={cn("hidden md:max-lg:w-607.5 md:max-lg:h-11 md:max-lg:border-b md:max-lg:border-solid md:max-lg:border-b-border md:max-lg:block md:max-lg:absolute md:max-lg:text-muted-foreground md:max-lg:whitespace-nowrap md:max-lg:text-nowrap md:max-lg:bg-surface 2xl:w-607.5 2xl:h-11 2xl:border-b 2xl:border-solid 2xl:border-b-border 2xl:block 2xl:absolute 2xl:text-muted-foreground 2xl:whitespace-nowrap 2xl:text-nowrap 2xl:bg-surface", styles.className)} aria-rowindex={d.ariarowindex} aria-selected="false" role="row">
      <div className="hidden md:max-lg:w-50 md:max-lg:h-full md:max-lg:border md:max-lg:border-solid md:max-lg:border-t-clr-4 md:max-lg:border-r-border md:max-lg:border-b-clr-4 md:max-lg:border-l-clr-4 md:max-lg:flex md:max-lg:absolute md:max-lg:top-0 md:max-lg:px-[0.9375rem] md:max-lg:items-center md:max-lg:grow md:max-lg:overflow-hidden md:max-lg:leading-[2.4375rem] 2xl:w-50 2xl:h-full 2xl:border 2xl:border-solid 2xl:border-t-clr-4 2xl:border-r-border 2xl:border-b-clr-4 2xl:border-l-clr-4 2xl:flex 2xl:absolute 2xl:top-0 2xl:px-[0.9375rem] 2xl:items-center 2xl:grow 2xl:overflow-hidden 2xl:leading-[2.4375rem]" aria-colindex="2" role="gridcell">
        <span className="hidden md:max-lg:block md:max-lg:leading-5 2xl:block 2xl:leading-5">
          {d.text}
        </span>
      </div>
      <div className="hidden md:max-lg:w-50 md:max-lg:h-full md:max-lg:border md:max-lg:border-solid md:max-lg:border-t-clr-4 md:max-lg:border-r-border md:max-lg:border-b-clr-4 md:max-lg:border-l-clr-4 md:max-lg:flex md:max-lg:absolute md:max-lg:top-0 md:max-lg:left-50 md:max-lg:px-[0.9375rem] md:max-lg:items-center md:max-lg:grow md:max-lg:overflow-hidden md:max-lg:leading-[2.4375rem] 2xl:w-50 2xl:h-full 2xl:border 2xl:border-solid 2xl:border-t-clr-4 2xl:border-r-border 2xl:border-b-clr-4 2xl:border-l-clr-4 2xl:flex 2xl:absolute 2xl:top-0 2xl:left-50 2xl:px-[0.9375rem] 2xl:items-center 2xl:grow 2xl:overflow-hidden 2xl:leading-[2.4375rem]" aria-colindex="3" role="gridcell">
        <span className="hidden md:max-lg:block md:max-lg:leading-5 2xl:block 2xl:leading-5">
          {d.text2}
        </span>
      </div>
      <div className="hidden md:max-lg:w-50 md:max-lg:h-full md:max-lg:border md:max-lg:border-solid md:max-lg:border-t-clr-4 md:max-lg:border-r-border md:max-lg:border-b-clr-4 md:max-lg:border-l-clr-4 md:max-lg:flex md:max-lg:absolute md:max-lg:top-0 md:max-lg:left-100 md:max-lg:px-[0.9375rem] md:max-lg:items-center md:max-lg:grow md:max-lg:overflow-hidden md:max-lg:leading-[2.4375rem] 2xl:w-50 2xl:h-full 2xl:border 2xl:border-solid 2xl:border-t-clr-4 2xl:border-r-border 2xl:border-b-clr-4 2xl:border-l-clr-4 2xl:flex 2xl:absolute 2xl:top-0 2xl:left-100 2xl:px-[0.9375rem] 2xl:items-center 2xl:grow 2xl:overflow-hidden 2xl:leading-[2.4375rem]" aria-colindex="4" role="gridcell">
        <span className="hidden md:max-lg:block md:max-lg:leading-5 2xl:block 2xl:leading-5">
          {d.text3}
        </span>
      </div>
      <div className="hidden 2xl:w-50 2xl:h-full 2xl:border 2xl:border-solid 2xl:border-t-clr-4 2xl:border-r-border 2xl:border-b-clr-4 2xl:border-l-clr-4 2xl:flex 2xl:absolute 2xl:top-0 2xl:left-150 2xl:px-[0.9375rem] 2xl:items-center 2xl:grow 2xl:overflow-hidden 2xl:leading-[2.4375rem]" aria-colindex="5" role="gridcell">
        <span className="hidden md:max-lg:block md:max-lg:leading-5 2xl:block 2xl:leading-5">
          {d.text4}
        </span>
      </div>
    </div>
  );
}
