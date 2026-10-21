import DittoMotion from "./ditto/DittoMotion";
import DropdownMenu from "./ditto/DropdownMenu";
import Header from "./sections/header";
import AnalyticsSection from "./sections/analytics-section";
import ContactsSection from "./sections/contacts-section";
import HeroSection from "./sections/hero-section";
import Icon from "./svgs/svg-icon";
import Icon2 from "./svgs/svg-icon2";
import Logo, { type LogoData } from "./components/logo";
import Icon3 from "./svgs/svg-icon3";
import Icon4 from "./svgs/svg-icon4";
import Icon5 from "./svgs/svg-icon5";
import Icon6 from "./svgs/svg-icon6";
import { Logo_styles } from "./_styles";

const Logo_data: LogoData[] = [
    { ariaLabel: "Unibox", href: "/unibox", label: "Unibox", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", icon: <>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </> },
    { ariaLabel: "Lead Finder", href: "/search/people", label: "Lead Finder", focusable: "false", icon: <>
          <path d="M15 7.5C15 4.73858 12.7614 2.5 10 2.5C7.23858 2.5 5 4.73858 5 7.5C5 10.2614 7.23858 12.5 10 12.5C12.7614 12.5 15 10.2614 15 7.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 21.5L19.5 20M20 17.5C20 15.8431 18.6569 14.5 17 14.5C15.3431 14.5 14 15.8431 14 17.5C14 19.1569 15.3431 20.5 17 20.5C18.6569 20.5 20 19.1569 20 17.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 19.5C3 15.634 6.13401 12.5 10 12.5C11.0736 12.5 12.0907 12.7417 13 13.1736" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </> },
    { ariaLabel: "Templates", href: "/templates", label: "Templates", focusable: "false", icon: <>
          <g opacity="0.9">
            <path d="M15.7358 2C17.0095 2 18.034 1.99857 18.8433 2.09863C19.6706 2.20095 20.3754 2.41933 20.9585 2.93066C21.0815 3.03853 21.1973 3.15436 21.3052 3.27734C21.8165 3.86044 22.0349 4.56514 22.1372 5.39258C22.2373 6.20191 22.2358 7.22632 22.2358 8.5V15.7217C22.2358 17.1146 22.2368 18.2348 22.1187 19.1133C21.9976 20.0133 21.7391 20.7712 21.1372 21.373C20.5353 21.9749 19.7775 22.2335 18.8774 22.3545C17.999 22.4726 16.8787 22.4717 15.4858 22.4717H8.51416C7.1212 22.4717 6.00108 22.4726 5.12256 22.3545C4.22251 22.2335 3.46469 21.9749 2.86279 21.373C2.26089 20.7711 2.00139 20.0134 1.88037 19.1133C1.76226 18.2348 1.76416 17.1146 1.76416 15.7217V8.5C1.76416 7.22631 1.76273 6.20192 1.86279 5.39258C1.9651 4.56512 2.18346 3.86045 2.69482 3.27734C2.8027 3.15435 2.91851 3.03854 3.0415 2.93066C3.62461 2.4193 4.32928 2.20094 5.15674 2.09863C5.96608 1.99857 6.99047 2 8.26416 2H15.7358ZM9.74951 20.9717H15.4858C16.921 20.9717 17.922 20.9697 18.6772 20.8682C19.411 20.7695 19.7999 20.5893 20.0767 20.3125C20.3534 20.0357 20.5337 19.6469 20.6323 18.9131C20.7338 18.1578 20.7358 17.1568 20.7358 15.7217V9.25H9.74951V20.9717ZM3.26416 15.7217C3.26416 17.1569 3.26615 18.1578 3.36768 18.9131C3.46633 19.6469 3.64658 20.0357 3.92334 20.3125C4.20009 20.5892 4.58909 20.7695 5.32275 20.8682C6.03074 20.9633 6.95458 20.9702 8.24951 20.9707V9.25H3.26416V15.7217ZM8.24951 3.5C6.945 3.50001 6.03366 3.50119 5.34033 3.58691C4.66274 3.67073 4.29653 3.82552 4.03076 4.05859C3.95695 4.12332 3.88749 4.19279 3.82275 4.2666C3.58968 4.53237 3.43489 4.89858 3.35107 5.57617C3.28245 6.13114 3.26927 6.82594 3.26611 7.75H8.24951V3.5ZM9.74951 7.75H20.7339C20.7307 6.82594 20.7166 6.13114 20.6479 5.57617C20.5641 4.89871 20.4103 4.53235 20.1772 4.2666C20.1125 4.19283 20.043 4.1233 19.9692 4.05859C19.7034 3.82548 19.3365 3.67072 18.6587 3.58691C17.9629 3.50092 17.0478 3.5 15.7358 3.5H9.74951V7.75Z" fill="currentColor" />
          </g>
          </> },
    { ariaLabel: "Engagement", href: "/engagement", label: "Engagement", focusable: "false", icon: <>
          <path d="M13.5 5.5V2M13.5 12V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.5 22C19.5 22 21 17.49 21 12C21 6.50998 19.5 2 13.5 2C7.49993 2 6 6.50996 6 12C6 17.49 7.49993 22 13.5 22Z" stroke="currentColor" strokeWidth="1.5" />
          <path d="M15 7C15 6.53406 15 6.30109 14.9239 6.11732C14.8224 5.87229 14.6277 5.67761 14.3827 5.57612C14.1989 5.5 13.9659 5.5 13.5 5.5C13.0341 5.5 12.8011 5.5 12.6173 5.57612C12.3723 5.67761 12.1776 5.87229 12.0761 6.11732C12 6.30109 12 6.53406 12 7V7.5C12 7.96594 12 8.19891 12.0761 8.38268C12.1776 8.62771 12.3723 8.82239 12.6173 8.92388C12.8011 9 13.0341 9 13.5 9C13.9659 9 14.1989 9 14.3827 8.92388C14.6277 8.82239 14.8224 8.62771 14.9239 8.38268C15 8.19891 15 7.96594 15 7.5V7Z" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6 12H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 3.16746L4.61888 2M4.02867 5.56746L3 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </> },
    { ariaLabel: "Automation", href: "/automations", label: "Automation", focusable: "false", icon: <>
          <path d="M17.25 3V4.33957M17.25 4.33957C17.9156 4.33957 18.5182 4.60934 18.9545 5.04551M17.25 4.33957C16.5844 4.33957 15.9818 4.60934 15.5455 5.04551M18.9545 5.04551C19.3908 5.48177 19.6607 6.08451 19.6607 6.75028M18.9545 5.04551L19.9017 4.09835M15.5455 5.04551C15.1092 5.48177 14.8393 6.08451 14.8393 6.75028M15.5455 5.04551L14.5984 4.09835M17.25 9.161V10.5M17.25 9.161C17.9158 9.161 18.5185 8.89111 18.9548 8.45477M17.25 9.161C16.5842 9.161 15.9815 8.89111 15.5452 8.45477M18.9548 8.45477C19.3909 8.01853 19.6607 7.41591 19.6607 6.75028M18.9548 8.45477L19.9017 9.40165M15.5452 8.45477C15.1091 8.01853 14.8393 7.41591 14.8393 6.75028M15.5452 8.45477L14.5984 9.40165M21 6.75L19.6607 6.75028M14.8393 6.75028L13.5 6.75" stroke="#64686C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.6903 19.4567C13.5 18.9973 13.5 18.4149 13.5 17.25C13.5 16.0851 13.5 15.5027 13.6903 15.0433C13.944 14.4307 14.4307 13.944 15.0433 13.6903C15.5027 13.5 16.0851 13.5 17.25 13.5C18.4149 13.5 18.9973 13.5 19.4567 13.6903C20.0693 13.944 20.556 14.4307 20.8097 15.0433C21 15.5027 21 16.0851 21 17.25C21 18.4149 21 18.9973 20.8097 19.4567C20.556 20.0693 20.0693 20.556 19.4567 20.8097C18.9973 21 18.4149 21 17.25 21C16.0851 21 15.5027 21 15.0433 20.8097C14.4307 20.556 13.944 20.0693 13.6903 19.4567Z" stroke="#64686C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3.1903 19.4567C3 18.9973 3 18.4149 3 17.25C3 16.0851 3 15.5027 3.1903 15.0433C3.44404 14.4307 3.93072 13.944 4.54329 13.6903C5.00272 13.5 5.58515 13.5 6.75 13.5C7.91485 13.5 8.49728 13.5 8.95671 13.6903C9.56928 13.944 10.056 14.4307 10.3097 15.0433C10.5 15.5027 10.5 16.0851 10.5 17.25C10.5 18.4149 10.5 18.9973 10.3097 19.4567C10.056 20.0693 9.56928 20.556 8.95671 20.8097C8.49728 21 7.91485 21 6.75 21C5.58515 21 5.00272 21 4.54329 20.8097C3.93072 20.556 3.44404 20.0693 3.1903 19.4567Z" stroke="#64686C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3.1903 8.95671C3 8.49728 3 7.91485 3 6.75C3 5.58515 3 5.00272 3.1903 4.54329C3.44404 3.93072 3.93072 3.44404 4.54329 3.1903C5.00272 3 5.58515 3 6.75 3C7.91485 3 8.49728 3 8.95671 3.1903C9.56928 3.44404 10.056 3.93072 10.3097 4.54329C10.5 5.00272 10.5 5.58515 10.5 6.75C10.5 7.91485 10.5 8.49728 10.3097 8.95671C10.056 9.56928 9.56928 10.056 8.95671 10.3097C8.49728 10.5 7.91485 10.5 6.75 10.5C5.58515 10.5 5.00272 10.5 4.54329 10.3097C3.93072 10.056 3.44404 9.56928 3.1903 8.95671Z" stroke="#64686C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </> }
];

export default function Page() {
  return (
    <>
      <div className="block" id="cello-widget-app">
        <div className="box-content block" />
        <div className="box-content inline text-clr-0 [font-family:'Times_New_Roman'] leading-4.5">
          <div className="block text-clr-1 [font-family:Lato,_sans-serif] text-xs leading-[1.0625rem] max-md:leading-3.5" />
        </div>
      </div>
      <div className="block">
        {" "}
        <div className="block" />
        {" "}
      </div>
      <div className="h-200 grid flex-1 [grid-template-areas:'banner_banner_banner_banner'_'sidebar_topbar_topbar_topbar'_'sidebar_leftpanel_content_rightpanel'] grid-cols-[56px_auto_1fr_auto] max-md:h-203 md:max-lg:h-256 2xl:h-270">
        <div className="border-r border-solid border-r-clr-2 flex py-[0.5625rem] rounded-tl-lg rounded-bl-lg flex-col items-center [grid-column-start:sidebar] [grid-column-end:sidebar] [grid-row-start:sidebar] [grid-row-end:sidebar] overflow-hidden bg-background shadow-[var(--clr-3)_2px_0px_16px_0px]">
          <a className="h-7.5 flex mt-1.5 mb-3 shrink-0 cursor-pointer" data-component="link" href="/">
            <Icon />
          </a>
          <nav className="w-full flex py-[0.1875rem] flex-col items-center flex-1 overflow-x-hidden overflow-y-auto" data-component="nav">
            <div className="flex relative items-center" aria-label="Campaigns">
              <div className="w-[0.1875rem] h-8 block absolute -left-2 min-w-0 rounded-tr-xs rounded-br-xs bg-foreground" />
              <a className="w-10 h-10 flex relative rounded-lg justify-center items-center cursor-pointer hover:bg-clr-21 focus:bg-clr-24" data-component="link" href="/" title="Campaigns">
                <Icon2 />
              </a>
            </div>
            {Logo_data.map((d, i) => <Logo key={i} d={d} styles={Logo_styles[i]} />)}
          </nav>
          <div className="w-full flex pt-[0.1875rem] pb-1.5 flex-col items-center shrink-0">
            <button className="h-9.5 flex justify-center items-center text-center cursor-pointer" data-component="button" aria-expanded="false" id="react-aria1059032613-_r_7_" type="button">
              <Icon3 />
            </button>
            <div className="flex mt-3 justify-center items-center cursor-pointer">
              <Icon4 />
            </div>
            <button className="border border-solid border-clr-4 flex min-w-0 mt-3 rounded-[12.8px] justify-center items-center text-center cursor-pointer h-10 w-10" data-component="button" aria-expanded="false" id="react-aria1059032613-_r_b_" type="button">
              <Icon5 />
            </button>
            <div className="flex relative mt-3 items-center" aria-label="Settings">
              <a className="w-10 h-10 flex relative rounded-lg justify-center items-center text-muted-foreground cursor-pointer hover:bg-clr-21 hover:text-foreground hover:[text-decoration-color:var(--foreground)] focus:bg-clr-25" data-component="link" href="/settings" title="Settings">
                <Icon6 />
              </a>
            </div>
            <hr className="w-8 h-0.5 border-b-2 border-solid border-b-border block mt-3 shrink-0 overflow-hidden" />
            <button className="h-7 flex relative mt-3 justify-center items-center align-middle text-center cursor-pointer" data-component="button" type="button">
              <div className="w-7 h-7 border border-solid border-border grid rounded-[10.8px] content-center text-clr-5 [font-family:Inter,_sans-serif] font-medium uppercase bg-clr-6 grid-cols-[minmax(0,_1fr)]">
                a
              </div>
            </button>
          </div>
        </div>
        <Header />
        <main className="block [grid-column-start:content] [grid-column-end:content] [grid-row-start:content] [grid-row-end:content] overflow-x-hidden overflow-y-auto">
          <div className="flex flex-col h-full">
            <AnalyticsSection />
            <ContactsSection />
          </div>
        </main>
      </div>
      <div className="block" id="fb-messenger-root">
        <div className="block" id="featurebase-messenger-container" />
        <div className="w-320 h-37.5 block fixed top-0 left-0 z-2147482000 invisible opacity-0 transform-[matrix(1,0,0,1,0,-150)] pointer-events-none max-md:w-90 md:max-lg:w-192 2xl:w-480" id="featurebase-banner-frame-wrapper">
          <HeroSection />
        </div>
      </div>
      <DittoMotion spec={{"waapi":[],"rotators":[],"reveals":[{"anchor":"motion-1","opacity":"0","transform":"none","transition":"0.1s cubic-bezier(0.4, 0, 0.2, 1)"}],"marquees":[]}} />
      <DropdownMenu menus={[{"trigger":"menu-trigger-1","hoverOpen":false,"gap":0,"align":"left","html":"<iframe style=\"position:absolute;margin:0;display:block;box-sizing:border-box;width:1256px;height:800px;min-width:auto;max-width:none;min-height:auto;padding-top:0px;padding-right:0px;padding-bottom:0px;padding-left:0px;border-top-width:0px;border-right-width:0px;border-bottom-width:0px;border-left-width:0px;border-top-style:none;border-right-style:none;border-bottom-style:none;border-left-style:none;border-top-color:rgb(12, 14, 15);border-right-color:rgb(12, 14, 15);border-bottom-color:rgb(12, 14, 15);border-left-color:rgb(12, 14, 15);border-top-left-radius:12px;border-top-right-radius:12px;border-bottom-right-radius:12px;border-bottom-left-radius:12px;background-color:rgba(0, 0, 0, 0);color:rgb(12, 14, 15);box-shadow:rgba(0, 0, 0, 0.16) 0px 5px 40px 0px;opacity:1;font-family:&quot;Rethink Sans&quot;, Inter;font-size:16px;font-weight:400;font-style:normal;line-height:24px;letter-spacing:normal;text-align:start;text-transform:none;text-decoration-line:none;white-space:normal;flex-direction:row;flex-wrap:nowrap;justify-content:normal;align-items:normal;gap:normal;row-gap:normal;column-gap:normal;grid-template-columns:none;grid-template-rows:none;list-style-type:disc;vertical-align:middle;object-fit:fill;cursor:auto;overflow:clip\"></iframe>"}]} />
    </>
  );
}
