import type { DittoNodeMetaMap } from "../ditto-meta";
import type { MediaTile2Styles } from "../_styles";
import { cn } from "../../../lib/utils";
export type MediaTile2Data = {
  ariacolindex: string;
  kind?: string;
  text: string;
  kind2?: string;
  id: string;
  kind3?: string;
};
/** A media tile. */
export default function MediaTile2({ d, meta, styles }: { d: MediaTile2Data; meta: DittoNodeMetaMap; styles: MediaTile2Styles }) {
  return (
    <div data-ditto-id={meta[0]?.anchor} className={cn("after:content-[''] after:block after:absolute after:inset-y-0 after:right-0 after:left-[12.4375rem] after:z-1 after:w-px after:h-11", styles.className)} aria-colindex={d.ariacolindex} aria-sort="none" role="columnheader">
      <div className={cn("after:content-[''] after:block after:absolute after:inset-y-[0.9625rem] after:right-1 after:left-0.5 after:z-1 after:w-0.5 after:h-[0.825rem] after:bg-border", styles.className2)} aria-hidden="false" role="presentation" />
      <div className={styles.className3} role="presentation">
        <div className={cn("h-full w-full", styles.className4)}>
          <div className={styles.className5}>
            <svg className={cn("h-5 w-5", styles.className6)} data-component={d.kind} fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg" color="currentColor">
              <path d="M6.99892 9.5C6.75828 7.50503 7.91475 7.09687 11.9989 7M11.9989 7C16.1223 7.10058 17.3402 7.59829 16.9989 9.5M11.9989 7V17M9.99892 17H13.9989" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3.89124 3.89124C2.5 5.28249 2.5 7.52166 2.5 12C2.5 16.4783 2.5 18.7175 3.89124 20.1088C5.28249 21.5 7.52166 21.5 12 21.5C16.4783 21.5 18.7175 21.5 20.1088 20.1088C21.5 18.7175 21.5 16.4783 21.5 12C21.5 7.52166 21.5 5.28249 20.1088 3.89124C18.7175 2.5 16.4783 2.5 12 2.5C7.52166 2.5 5.28249 2.5 3.89124 3.89124Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className={styles.className7}>
              {d.text}
            </span>
          </div>
          <button data-ditto-id={meta[7]?.anchor} className={styles.className8} data-component={d.kind2} aria-expanded="false" aria-haspopup="true" id={d.id} type="button">
            <svg className={styles.className9} data-component={d.kind3} fill="none" height="20" viewBox="0 0 21 20" width="21" xmlns="http://www.w3.org/2000/svg">
              <path d="M10.5084 9.46094H10.5169" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10.4998 15.1714H10.5084" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10.5164 3.75H10.525" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
