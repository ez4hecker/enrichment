import type { TextLinkStyles } from "../_styles";
import { cn } from "../../../lib/utils";
export type TextLinkData = {
  ariaselected: string;
  label: string;
};
/** A text link. */
export default function TextLink({ d, styles }: { d: TextLinkData; styles: TextLinkStyles }) {
  return (
    <button className={cn("h-14 min-h-12 flex relative min-w-22.5 max-w-90 max-h-14 py-4 px-6 flex-col justify-center items-center shrink-0 overflow-hidden align-middle text-sm leading-[1.125rem] text-center whitespace-normal cursor-pointer", styles.className)} data-component="button" aria-selected={d.ariaselected} role="tab" type="button">
      {d.label}
    </button>
  );
}
