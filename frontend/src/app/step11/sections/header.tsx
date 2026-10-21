import Icon7 from "../svgs/svg-icon7";
import TextLink, { type TextLinkData } from "../components/text-link";
import Illustration from "../svgs/svg-illustration";
import { TextLink_styles } from "../_styles";
const TextLink_data: TextLinkData[] = [
    { ariaselected: "true", label: "Contacts" },
    { ariaselected: "false", label: "Sequencer" },
    { ariaselected: "false", label: "Logs" },
    { ariaselected: "false", label: "Settings" }
];
/** Page header. */
export default function Header({ textLinkData = TextLink_data } = {}) {
  return (
    <header className="flex relative z-10 px-7 justify-between items-center shrink-0 [grid-column-start:topbar] [grid-column-end:topbar] [grid-row-start:topbar] [grid-row-end:topbar] shadow-[var(--clr-3)_0px_2px_16px_0px] mx-auto h-14 w-full max-w-full">
      <button className="flex max-w-100 items-center gap-2 text-center cursor-pointer h-9" data-component="button">
        <Icon7 />
        <span className="block overflow-hidden font-semibold whitespace-nowrap text-nowrap">
          example
        </span>
      </button>
      <div className="w-[25.9375rem] h-full min-h-12 flex absolute top-0 left-[clamp(152px,_50%,_calc(100%_-_152px))] min-w-0 overflow-hidden font-semibold transform-[matrix(1,0,0,1,-207.461,0)]">
        <div className="block relative grow overflow-hidden whitespace-nowrap text-nowrap">
          <div className="flex justify-center" role="tablist">
            {textLinkData.map((d, i) => <TextLink key={i} d={d} styles={TextLink_styles[i]} />)}
          </div>
          <span className="w-[6.6625rem] h-0.5 block absolute bottom-0 bg-foreground" />
        </div>
      </div>
      <div className="flex justify-end items-center w-[18.75rem] max-md:w-[199.55px]">
        <div className="flex items-center gap-3">
          <Illustration />
          <span className="block text-muted-foreground text-sm font-medium leading-5">
            Campaign is in draft
          </span>
          <span className="w-9 h-5 flex relative z-0 shrink-0 overflow-hidden align-middle">
            <span className="w-5 h-full flex absolute top-0 z-1 min-w-0 p-0.5 rounded-[50%] justify-center items-center align-middle text-surface cursor-pointer hover:bg-clr-22">
              <span className="w-4 h-4 block rounded-[50%] bg-surface shadow-[var(--clr-7)_0px_2px_1px_-1px,var(--clr-8)_0px_1px_1px_0px,var(--clr-9)_0px_1px_3px_0px]" />
            </span>
            <span className="w-full block -z-1 rounded-[60px] bg-clr-10" />
          </span>
        </div>
      </div>
    </header>
  );
}
