import Icon9 from "../svgs/svg-icon9";
import Icon10 from "../svgs/svg-icon10";
import Icon11 from "../svgs/svg-icon11";
import Icon12 from "../svgs/svg-icon12";
import Icon13 from "../svgs/svg-icon13";
import Icon14 from "../svgs/svg-icon14";
import Icon15 from "../svgs/svg-icon15";
import MediaTile2, { type MediaTile2Data } from "../components/media-tile2";
import Icon16 from "../svgs/svg-icon16";
import Icon17 from "../svgs/svg-icon17";
import Icon18 from "../svgs/svg-icon18";
import MediaTile3, { type MediaTile3Data } from "../components/media-tile3";
import Tile, { type TileData } from "../components/tile";
import Tile2, { type Tile2Data } from "../components/tile2";
import Icon19 from "../svgs/svg-icon19";
import Icon20 from "../svgs/svg-icon20";
import { MediaTile2_meta } from "../ditto-meta";
import { MediaTile2_styles, MediaTile3_styles, Tile_styles, Tile2_styles } from "../_styles";
const MediaTile2_data: MediaTile2Data[] = [
    { ariacolindex: "2", kind: "icon", text: "First name", kind2: "button", id: "react-aria1059032613-_r_18_", kind3: "icon" },
    { ariacolindex: "3", kind: "icon", text: "Last name", kind2: "button", id: "react-aria1059032613-_r_1c_", kind3: "icon" },
    { ariacolindex: "4", kind: "icon", text: "Company name", kind2: "button", id: "react-aria1059032613-_r_36_", kind3: "icon" },
    { ariacolindex: "5", kind: "icon", text: "Email address", kind2: "button", id: "react-aria1059032613-_r_3a_", kind3: "icon" },
    { ariacolindex: "6", text: "Phone number", id: "react-aria1059032613-_r_3e_" },
    { ariacolindex: "7", text: "Employees", id: "react-aria1059032613-_r_3i_" },
    { ariacolindex: "8", text: "Industry", id: "react-aria1059032613-_r_3m_" }
];
const MediaTile3_data: MediaTile3Data[] = [
    { ariarowindex: "2", text: "Kirk", text2: "H", text3: "Merchants Fleet", text4: "kirkhoffman@merchantsfleet.com", text5: "+1 855-969-9450", text6: "630", text7: "financial services,logistics & supply chain,automotive", href: "http://www.linkedin.com/in/kirk-h-40800277", label: "linkedin.com/in/kirk-h-40800277", href2: "http://www.merchantsfleet.com/", label2: "merchantsfleet.com" },
    { ariarowindex: "3", text: "Elena", text2: "Gomez", text3: "Toast", text4: "e.gomez@smartsheet.com", text5: "+1 617-297-1005", text6: "5700", text7: "information technology & services,computer software,financial services", href: "http://www.linkedin.com/in/elena-gomez-56b47a", label: "linkedin.com/in/elena-gomez-56b47a", href2: "http://www.toasttab.com/", label2: "toasttab.com" },
    { ariarowindex: "4", text: "Roman", text2: "Altshuler", text3: "Slice Merchant Services", text4: "roman@startslice.com", text5: "+1 844-367-7542", text6: "210", text7: "financial services,information technology & services", href: "http://www.linkedin.com/in/roman-altshuler-291299375", label: "linkedin.com/in/roman-altshuler-291299375", href2: "http://www.startslice.com/", label2: "startslice.com" },
    { ariarowindex: "5", text: "Tisha", text2: "Reagan", text3: "CLA (CliftonLarsonAllen)", text4: "tisha.reagan@claconnect.com", text5: "+1 888-529-2648", text6: "9000", text7: "accounting,management consulting,financial services", href: "http://www.linkedin.com/in/tisha-reagan-3977952b7", label: "linkedin.com/in/tisha-reagan-3977952b7", href2: "http://www.claconnect.com/", label2: "claconnect.com" },
    { ariarowindex: "6", text: "Ray", text2: "Leonzi", text3: "Ion Bank", text4: "rleonzi@ionbank.com", text5: "+1 203-729-4442", text6: "360", text7: "banking,financial services", href: "http://www.linkedin.com/in/ray-leonzi-jr-88401a62", label: "linkedin.com/in/ray-leonzi-jr-88401a62", href2: "http://www.ionbank.com/", label2: "ionbank.com" },
    { ariarowindex: "7", text: "Brett", text2: "Walden", text3: "Reinsurance Group of America, Incorporated", text4: "bwalden@rgare.com", text5: "+1 636-736-7000", text6: "4100", text7: "insurance,financial services", href: "http://www.linkedin.com/in/brett-walden-10a1a018", label: "linkedin.com/in/brett-walden-10a1a018", href2: "http://www.rgare.com/", label2: "rgare.com" },
    { ariarowindex: "8", text: "Venkat", text2: "Krishnamoorthy", text3: "Hamilton", text4: "venkat.krishnamoorthy@hamiltongroup.com", text5: "+1 441-405-5200", text6: "600", text7: "insurance", href: "http://www.linkedin.com/in/venkatkrish123", label: "linkedin.com/in/venkatkrish123", href2: "http://www.hamiltongroup.com/", label2: "hamiltongroup.com" },
    { ariarowindex: "9", text: "Shilpa", text2: "Kumar", text3: "Citizens", text4: "shilpa.kumar@citizensbank.com", text5: "+1 800-922-9999", text6: "18000", text7: "banking,investment management,financial services", href: "http://www.linkedin.com/in/shilpa-kumar", label: "linkedin.com/in/shilpa-kumar", href2: "http://www.citizensbank.com/", label2: "citizensbank.com" },
    { ariarowindex: "10", text: "Cynthia", text2: "Cheung", text3: "Bank of America Merrill Lynch", text4: "cynthia.cheung@bofa.com", text5: "+1 704-386-8486", text6: "213000", text7: "financial services,investment banking,banking", href: "http://www.linkedin.com/in/cynthiagcheung", label: "linkedin.com/in/cynthiagcheung", href2: "http://www.bofa.com/", label2: "bofa.com" },
    { ariarowindex: "11", text: "Kathleen", text2: "Taylor", text3: "Gold.com", text4: "ktaylor@amark.com", text5: "+1 844-455-4653", text6: "490", text7: "financial services,retail,wholesale,logistics & supply chain", href: "http://www.linkedin.com/in/kathleensimpsontaylor", label: "linkedin.com/in/kathleensimpsontaylor", href2: "http://www.gold.com/", label2: "gold.com" },
    { ariarowindex: "12", text: "Mandy", text2: "C", text3: "Sentara Health", text4: "mandy.c@sentara.com", text5: "+1 757-455-7788", text6: "34000", text7: "hospital & health care,insurance,health, wellness & fitness", href: "http://www.linkedin.com/in/mandy-c-b700a26", label: "linkedin.com/in/mandy-c-b700a26", href2: "http://www.sentara.com/", label2: "sentara.com" },
    { ariarowindex: "13", text: "Julien", text2: "Bellec", text3: "CIC", text4: "julien.bellec@cic.fr", text5: "+33 800 16 81 68", text6: "21000", text7: "banking,capital markets,investment management", href: "http://www.linkedin.com/in/julien-bellec-b546ab372", label: "linkedin.com/in/julien-bellec-b546ab372", href2: "http://www.cic.fr/", label2: "cic.fr" },
    { ariarowindex: "14", text: "Cody", text2: "Ernst", text3: "Cherry Bekaert", text4: "cody.t.ernst@ey.com", text5: "+1 919-782-1040", text6: "3300", text7: "accounting,management consulting,financial services", href: "http://www.linkedin.com/in/cody-ernst", label: "linkedin.com/in/cody-ernst", href2: "https://cbh.com/", label2: "cbh.com" },
    { ariarowindex: "15", text: "Brad", text2: "Cunningham", text3: "Paysign, Inc.", text4: "bcunningham@paysign.com", text5: "+1 702-453-2221", text6: "230", text7: "financial services", href: "http://www.linkedin.com/in/bradleycunningham", label: "linkedin.com/in/bradleycunningham", href2: "http://www.paysign.com/", label2: "paysign.com" },
    { ariarowindex: "16", text: "Andre", text2: "Mancl", text3: "Nium", text4: "andre.mancl@nium.com", text5: "+65 3158 0618", text6: "1100", text7: "financial services,information technology & services", href: "http://www.linkedin.com/in/mancl", label: "linkedin.com/in/mancl", href2: "http://www.nium.com/", label2: "nium.com" },
    { ariarowindex: "17", text: "Robert", text2: "O'Connell", text3: "StoneX Group Inc.", text4: "robert.oconnell@stonex.com", text5: "+1 212-485-3500", text6: "4800", text7: "financial services,capital markets,investment management", href: "http://www.linkedin.com/in/robert-o-connell-8a052813", label: "linkedin.com/in/robert-o-connell-8a052813", href2: "http://www.stonex.com/", label2: "stonex.com" },
    { ariarowindex: "18", text: "Elisabeth", text2: "Sandersfeld", text3: "Merchants Bonding Company", text4: "elisabeth.sandersfeld@merchantsbonding.com", text5: "+1 800-678-8171", text6: "270", text7: "insurance", href: "http://www.linkedin.com/in/elisabeth-sandersfeld", label: "linkedin.com/in/elisabeth-sandersfeld", href2: "http://www.merchantsbonding.com/", label2: "merchantsbonding.com" },
    { ariarowindex: "19", text: "Stefano", text2: "Martini", text3: "Barnum Financial Group", text4: "stefano.martini@barnumfinancialgroup.com", text5: "+1 203-513-6000", text6: "730", text7: "financial services,investment management,insurance", href: "http://www.linkedin.com/in/stefano-martini-078a39318", label: "linkedin.com/in/stefano-martini-078a39318", href2: "http://www.barnumfinancialgroup.com/", label2: "barnumfinancialgroup.com" }
];
const Tile_data: TileData[] = [
    { ariarowindex: "20", text: "Davit", text2: "Aghazaryan", text3: "Cigna Healthcare", text4: "davit.aghazaryan@cigna.com" },
    { ariarowindex: "21", text: "Roy", text2: "Gelerman", text3: "Hantz Group", text4: "roy.gelerman@hantzgroup.com" },
    { ariarowindex: "22", text: "Eric", text2: "Pretzlaff", text3: "PrimeLending, A PlainsCapital Company", text4: "eric.pretzlaff@primelending.com" },
    { ariarowindex: "23", text: "Ramiro", text2: "Fernandez", text3: "PIMCO", text4: "ramiro.fernandez@pimco.com" },
    { ariarowindex: "24", text: "John", text2: "Wilkinson", text3: "J.P. Morgan", text4: "john.wilkinson@jpmorgan.com" }
];
const Tile2_data: Tile2Data[] = [
    { ariacolindex: "2", text: "Mike" },
    { ariacolindex: "3", text: "Dea" },
    { ariacolindex: "4", text: "Equity Trust Company" },
    { ariacolindex: "5", text: "mike.dea@trustetc.com" },
    { ariacolindex: "6", text: "+1 855-265-4472" },
    { ariacolindex: "7", text: "500" },
    { ariacolindex: "8", text: "financial services,investment management" }
];
/** Contacts section. */
export default function ContactsSection({ mediaTile2Data = MediaTile2_data, mediaTile3Data = MediaTile3_data, tileData = Tile_data, tile2Data = Tile2_data } = {}) {
  return (
    <div className="w-306 flex min-w-0 pt-3 px-16 flex-col flex-1 overflow-hidden bg-background max-md:w-76 md:max-lg:w-178 2xl:w-466">
      <div className="w-274 block shrink-0 max-md:w-44 md:max-lg:w-146 2xl:w-434">
        <div className="flex mb-4 justify-between items-center">
          <div className="flex items-center gap-2">
            <h2 className="block text-xl font-semibold leading-7" data-component="heading">
              Contacts
            </h2>
            <span className="border border-solid border-surface-2 flex py-2 px-3 rounded-[18px] justify-center items-center font-semibold leading-5 bg-clr-18 h-9">
              99
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-11 h-11 border border-solid border-surface-2 flex rounded-[12.8px] justify-center items-center shrink-0 gap-1.5 text-sm font-semibold leading-3.5 text-center bg-surface shadow-[var(--clr-4)_0px_0px_0px_0px,var(--clr-4)_0px_0px_0px_0px,var(--clr-4)_0px_0px_0px_0px,var(--clr-4)_0px_0px_0px_0px,var(--clr-4)_0px_0px_0px_0px] cursor-pointer" data-component="button" id="react-aria1059032613-_r_j_" type="button">
              <Icon9 />
            </button>
            <div className="block relative">
              <div className="block relative">
                <div className="block relative z-10">
                  <button className="w-11 h-11 border border-solid border-surface-2 inline-flex rounded-[12.8px] justify-center items-center shrink-0 gap-1.5 text-sm font-semibold leading-3.5 text-center bg-surface shadow-[var(--clr-4)_0px_0px_0px_0px,var(--clr-4)_0px_0px_0px_0px,var(--clr-4)_0px_0px_0px_0px,var(--clr-4)_0px_0px_0px_0px,var(--clr-4)_0px_0px_0px_0px] cursor-pointer" data-component="button" id="react-aria1059032613-_r_l_" type="button">
                    <Icon10 />
                  </button>
                </div>
                <div className="border border-solid border-surface-2 flex absolute top-0 left-0 opacity-0 px-3 rounded-[16.8px] items-center bg-surface pointer-events-none h-11 w-11">
                  <div className="flex mr-2 justify-center items-center pointer-events-none">
                    <Icon11 dittoId={"motion-1"} />
                  </div>
                  <input className="w-58 h-6 block grow overflow-clip cursor-text pointer-events-none" data-ditto-id="style-input" data-component="input" placeholder="Search..." type="text" defaultValue="" />
                </div>
              </div>
            </div>
            <button className="w-11 h-11 border border-solid border-surface-2 flex rounded-[12.8px] justify-center items-center shrink-0 gap-1.5 text-sm font-semibold leading-3.5 text-center bg-surface shadow-[var(--clr-4)_0px_0px_0px_0px,var(--clr-4)_0px_0px_0px_0px,var(--clr-4)_0px_0px_0px_0px,var(--clr-4)_0px_0px_0px_0px,var(--clr-4)_0px_0px_0px_0px] cursor-pointer" data-component="button" aria-expanded="false" id="react-aria1059032613-_r_o_" type="button">
              <Icon12 />
            </button>
            <button className="w-11 h-11 border border-solid border-surface-2 flex rounded-[12.8px] justify-center items-center shrink-0 gap-1.5 text-sm font-semibold leading-3.5 text-center bg-surface shadow-[var(--clr-4)_0px_0px_0px_0px,var(--clr-4)_0px_0px_0px_0px,var(--clr-4)_0px_0px_0px_0px,var(--clr-4)_0px_0px_0px_0px,var(--clr-4)_0px_0px_0px_0px] cursor-pointer" data-component="button" aria-expanded="false" id="react-aria1059032613-_r_s_" type="button">
              <Icon13 />
            </button>
            <button className="flex relative py-2.5 px-5 rounded-[12.8px] justify-center items-center text-surface font-semibold text-center bg-foreground cursor-pointer" data-component="button" id="react-aria1059032613-_r_v_" type="button">
              <Icon14 />
              Data studio
            </button>
            <button className="h-10 flex relative p-2 rounded-[50%] justify-center items-center shrink-0 align-middle text-clr-19 text-[1.5rem] text-center cursor-pointer hover:bg-clr-22" data-component="button" aria-label="Table menu" type="button">
              <Icon15 />
            </button>
          </div>
        </div>
      </div>
      <div className="h-98 border border-solid border-border flex flex-col flex-1 overflow-hidden max-md:h-95 md:max-lg:h-154 2xl:h-168">
        <div className="h-full block flex-1 overflow-hidden">
          <div className="h-full block">
            <div className="w-px h-px block absolute z-9999 overflow-hidden whitespace-nowrap text-nowrap" aria-atomic="true" aria-live="polite" aria-relevant="additions text" />
            <div className="h-full flex relative rounded-lg flex-col overflow-hidden [font-family:'Rethink_Sans'] text-sm leading-4.5 bg-surface cursor-default" role="presentation">
              <div className="flex" role="presentation" />
              <div className="h-full flex grow" role="presentation">
                <div className="flex relative flex-col grow overflow-hidden" aria-colcount="14" aria-rowcount="100" role="grid">
                  <div className="h-[2.8125rem] min-h-[2.8125rem] border-b border-solid border-b-border flex overflow-hidden font-medium whitespace-nowrap text-nowrap bg-surface" role="presentation">
                    <div className="w-12.5 border-r border-solid border-r-border block relative min-w-12.5 max-w-12.5 overflow-hidden" aria-hidden="false" role="rowgroup">
                      <div className="w-12.5 h-full block absolute top-0" aria-rowindex="1" role="row">
                        <div className="w-12.5 h-full flex absolute top-0 px-4 items-center gap-3 overflow-hidden after:content-[''] after:block after:absolute after:inset-y-0 after:right-0 after:left-[3.0625rem] after:z-1 after:w-px after:h-11" data-ditto-id="style-div" aria-colindex="1" role="columnheader">
                          <div className="flex relative z-1 items-center" role="presentation">
                            {" "}
                            <div className="basis-full shrink-0 h-4 border border-solid border-clr-20 flex relative z-1 rounded-sm items-center bg-surface after:content-[''] after:block after:absolute after:inset-0 after:w-3.5 after:h-3.5" role="presentation">
                              {" "}
                            </div>
                            {" "}
                          </div>
                          <div className="w-0 h-11 flex relative z-1 items-center" role="presentation">
                            <div className="w-0 h-11 flex relative z-1 flex-row-reverse justify-between items-center" role="presentation">
                              <div className="w-0 h-11 flex relative z-1 py-[0.3125rem] items-center self-stretch grow overflow-hidden" role="presentation">
                                {" "}
                              </div>
                              {" "}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="block relative min-w-0 grow overflow-x-auto overflow-y-hidden" role="rowgroup">
                      <div className="w-[152.8125rem] h-full block relative" role="presentation">
                        <div className="w-607.5 h-full block absolute top-0" aria-rowindex="1" role="row">
                          {mediaTile2Data.map((d, i) => <MediaTile2 key={i} d={d} meta={MediaTile2_meta[i]} styles={MediaTile2_styles[i]} />)}
                          <div className="w-50 h-full flex absolute top-0 left-200 items-center gap-3 overflow-hidden max-lg:hidden 2xl:left-350 after:content-[''] after:block after:absolute after:inset-y-0 after:right-0 after:left-[12.4375rem] after:z-1 after:w-px after:h-11 max-lg:after:hidden" data-ditto-id="style-div-2" aria-colindex="6" aria-sort="none" role="columnheader">
                            <div className="w-2 h-full flex absolute top-0 -right-[0.1875rem] z-2 min-w-0 items-center [cursor:ew-resize] max-lg:hidden after:content-[''] after:block after:absolute after:inset-y-[0.9625rem] after:right-1 after:left-0.5 after:z-1 after:w-0.5 after:h-[0.825rem] after:bg-border max-lg:after:hidden" aria-hidden="false" role="presentation" />
                            <div className="w-full h-full flex relative z-1 items-center max-lg:hidden" role="presentation">
                              <div className="flex relative z-1 pl-3 items-center gap-2 cursor-grab h-full w-full max-lg:hidden">
                                <div className="w-[9.4375rem] flex relative z-1 min-w-0 items-center flex-1 gap-2 max-lg:hidden">
                                  <Icon16 />
                                  <span className="block relative z-1 overflow-hidden max-lg:hidden">
                                    Phone number
                                  </span>
                                </div>
                                <button className="hidden 2xl:flex 2xl:relative 2xl:z-1 2xl:p-1 2xl:rounded-full 2xl:justify-center 2xl:items-center 2xl:shrink-0 2xl:text-center 2xl:cursor-pointer" aria-expanded="false" aria-haspopup="true" id="react-aria1059032613-_r_bp_" type="button">
                                  <Icon17 />
                                </button>
                                <button className="flex relative z-1 p-1 rounded-full justify-center items-center shrink-0 text-center cursor-pointer max-lg:hidden 2xl:hidden" data-component="button" aria-expanded="false" aria-haspopup="true" id="react-aria1059032613-_r_3e_" type="button">
                                  <Icon18 />
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="w-50 h-full flex absolute top-0 left-250 items-center gap-3 overflow-hidden max-lg:hidden 2xl:left-400 after:content-[''] after:block after:absolute after:inset-y-0 after:right-0 after:left-[12.4375rem] after:z-1 after:w-px after:h-11 max-lg:after:hidden" data-ditto-id="style-div-3" aria-colindex="7" aria-sort="none" role="columnheader">
                            <div className="w-full h-full flex relative z-1 items-center max-lg:hidden" role="presentation">
                              <div className="flex relative z-1 pl-3 items-center gap-2 cursor-grab h-full w-full max-lg:hidden">
                                <div className="w-[9.4375rem] flex relative z-1 min-w-0 items-center flex-1 gap-2 max-lg:hidden">
                                  <Icon16 />
                                  <span className="block relative z-1 overflow-hidden max-lg:hidden">
                                    Employees
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex relative grow bg-surface" role="presentation">
                    <div className="w-[98.5%] flex relative min-w-0 grow overflow-x-hidden overflow-y-auto max-md:w-[91.5%] md:max-lg:w-[97.5%] 2xl:w-[99%]" role="presentation">
                      <div className="w-12.5 h-1089 block relative min-w-12.5 max-w-12.5" aria-hidden="false" role="rowgroup">
                        <div className="w-12.5 h-11 border-b border-solid border-b-border block absolute text-muted-foreground whitespace-nowrap text-nowrap bg-surface" aria-rowindex="2" aria-selected="false" role="row">
                          <div className="w-12.5 h-full border border-solid border-t-clr-4 border-r-border border-b-clr-4 border-l-clr-4 block absolute top-0 px-[0.9375rem] leading-[2.4375rem]" aria-colindex="1" role="gridcell">
                            <div className="flex items-center" role="presentation">
                              <div className="h-[2.4375rem] flex mr-3 items-center" role="presentation">
                                <div className="flex items-center" role="presentation">
                                  {" "}
                                  <div className="basis-full shrink-0 h-4 border border-solid border-clr-20 flex relative rounded-sm items-center leading-4.5 bg-surface after:content-[''] after:block after:absolute after:inset-0 after:w-3.5 after:h-3.5" role="presentation">
                                    {" "}
                                  </div>
                                  {" "}
                                </div>
                                {" "}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="w-12.5 h-11 border-b border-solid border-b-border block absolute text-muted-foreground whitespace-nowrap text-nowrap bg-surface transform-[matrix(1,0,0,1,0,44)]" aria-rowindex="3" aria-selected="false" role="row">
                          <div className="w-12.5 h-full border border-solid border-t-clr-4 border-r-border border-b-clr-4 border-l-clr-4 block absolute top-0 px-[0.9375rem] leading-[2.4375rem]" aria-colindex="1" role="gridcell">
                            <div className="flex items-center" role="presentation">
                              <div className="h-[2.4375rem] flex mr-3 items-center" role="presentation">
                                <div className="flex items-center" role="presentation">
                                  {" "}
                                  <div className="basis-full shrink-0 h-4 border border-solid border-clr-20 flex relative rounded-sm items-center leading-4.5 bg-surface after:content-[''] after:block after:absolute after:inset-0 after:w-3.5 after:h-3.5" role="presentation">
                                    {" "}
                                  </div>
                                  {" "}
                                </div>
                                {" "}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="w-12.5 h-11 border-b border-solid border-b-border block absolute text-muted-foreground whitespace-nowrap text-nowrap bg-surface transform-[matrix(1,0,0,1,0,88)]" aria-rowindex="4" aria-selected="false" role="row">
                          <div className="w-12.5 h-full border border-solid border-t-clr-4 border-r-border border-b-clr-4 border-l-clr-4 block absolute top-0 px-[0.9375rem] leading-[2.4375rem]" aria-colindex="1" role="gridcell">
                            <div className="flex items-center" role="presentation">
                              <div className="h-[2.4375rem] flex mr-3 items-center" role="presentation">
                                <div className="flex items-center" role="presentation">
                                  {" "}
                                  <div className="basis-full shrink-0 h-4 border border-solid border-clr-20 flex relative rounded-sm items-center leading-4.5 bg-surface after:content-[''] after:block after:absolute after:inset-0 after:w-3.5 after:h-3.5" role="presentation">
                                    {" "}
                                  </div>
                                  {" "}
                                </div>
                                {" "}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="w-12.5 h-11 border-b border-solid border-b-border block absolute text-muted-foreground whitespace-nowrap text-nowrap bg-surface transform-[matrix(1,0,0,1,0,132)]" aria-rowindex="5" aria-selected="false" role="row">
                          <div className="w-12.5 h-full border border-solid border-t-clr-4 border-r-border border-b-clr-4 border-l-clr-4 block absolute top-0 px-[0.9375rem] leading-[2.4375rem]" aria-colindex="1" role="gridcell">
                            <div className="flex items-center" role="presentation">
                              <div className="h-[2.4375rem] flex mr-3 items-center" role="presentation">
                                <div className="flex items-center" role="presentation">
                                  {" "}
                                  <div className="basis-full shrink-0 h-4 border border-solid border-clr-20 flex relative rounded-sm items-center leading-4.5 bg-surface after:content-[''] after:block after:absolute after:inset-0 after:w-3.5 after:h-3.5" role="presentation">
                                    {" "}
                                  </div>
                                  {" "}
                                </div>
                                {" "}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="w-12.5 h-11 border-b border-solid border-b-border block absolute text-muted-foreground whitespace-nowrap text-nowrap bg-surface transform-[matrix(1,0,0,1,0,176)]" aria-rowindex="6" aria-selected="false" role="row">
                          <div className="w-12.5 h-full border border-solid border-t-clr-4 border-r-border border-b-clr-4 border-l-clr-4 block absolute top-0 px-[0.9375rem] leading-[2.4375rem]" aria-colindex="1" role="gridcell">
                            <div className="flex items-center" role="presentation">
                              <div className="h-[2.4375rem] flex mr-3 items-center" role="presentation">
                                <div className="flex items-center" role="presentation">
                                  {" "}
                                  <div className="basis-full shrink-0 h-4 border border-solid border-clr-20 flex relative rounded-sm items-center leading-4.5 bg-surface after:content-[''] after:block after:absolute after:inset-0 after:w-3.5 after:h-3.5" role="presentation">
                                    {" "}
                                  </div>
                                  {" "}
                                </div>
                                {" "}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="w-12.5 h-11 border-b border-solid border-b-border block absolute text-muted-foreground whitespace-nowrap text-nowrap bg-surface transform-[matrix(1,0,0,1,0,220)]" aria-rowindex="7" aria-selected="false" role="row">
                          <div className="w-12.5 h-full border border-solid border-t-clr-4 border-r-border border-b-clr-4 border-l-clr-4 block absolute top-0 px-[0.9375rem] leading-[2.4375rem]" aria-colindex="1" role="gridcell">
                            <div className="flex items-center" role="presentation">
                              <div className="h-[2.4375rem] flex mr-3 items-center" role="presentation">
                                <div className="flex items-center" role="presentation">
                                  {" "}
                                  <div className="basis-full shrink-0 h-4 border border-solid border-clr-20 flex relative rounded-sm items-center leading-4.5 bg-surface after:content-[''] after:block after:absolute after:inset-0 after:w-3.5 after:h-3.5" role="presentation">
                                    {" "}
                                  </div>
                                  {" "}
                                </div>
                                {" "}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="w-12.5 h-11 border-b border-solid border-b-border block absolute text-muted-foreground whitespace-nowrap text-nowrap bg-surface transform-[matrix(1,0,0,1,0,264)]" aria-rowindex="8" aria-selected="false" role="row">
                          <div className="w-12.5 h-full border border-solid border-t-clr-4 border-r-border border-b-clr-4 border-l-clr-4 block absolute top-0 px-[0.9375rem] leading-[2.4375rem]" aria-colindex="1" role="gridcell">
                            <div className="flex items-center" role="presentation">
                              <div className="h-[2.4375rem] flex mr-3 items-center" role="presentation">
                                <div className="flex items-center" role="presentation">
                                  {" "}
                                  <div className="basis-full shrink-0 h-4 border border-solid border-clr-20 flex relative rounded-sm items-center leading-4.5 bg-surface after:content-[''] after:block after:absolute after:inset-0 after:w-3.5 after:h-3.5" role="presentation">
                                    {" "}
                                  </div>
                                  {" "}
                                </div>
                                {" "}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="w-12.5 h-11 border-b border-solid border-b-border block absolute text-muted-foreground whitespace-nowrap text-nowrap bg-surface transform-[matrix(1,0,0,1,0,308)]" aria-rowindex="9" aria-selected="false" role="row">
                          <div className="w-12.5 h-full border border-solid border-t-clr-4 border-r-border border-b-clr-4 border-l-clr-4 block absolute top-0 px-[0.9375rem] leading-[2.4375rem]" aria-colindex="1" role="gridcell">
                            <div className="flex items-center" role="presentation">
                              <div className="h-[2.4375rem] flex mr-3 items-center" role="presentation">
                                <div className="flex items-center" role="presentation">
                                  {" "}
                                  <div className="basis-full shrink-0 h-4 border border-solid border-clr-20 flex relative rounded-sm items-center leading-4.5 bg-surface after:content-[''] after:block after:absolute after:inset-0 after:w-3.5 after:h-3.5" role="presentation">
                                    {" "}
                                  </div>
                                  {" "}
                                </div>
                                {" "}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="w-12.5 h-11 border-b border-solid border-b-border block absolute text-muted-foreground whitespace-nowrap text-nowrap bg-surface transform-[matrix(1,0,0,1,0,352)]" aria-rowindex="10" aria-selected="false" role="row">
                          <div className="w-12.5 h-full border border-solid border-t-clr-4 border-r-border border-b-clr-4 border-l-clr-4 block absolute top-0 px-[0.9375rem] leading-[2.4375rem]" aria-colindex="1" role="gridcell">
                            <div className="flex items-center" role="presentation">
                              <div className="h-[2.4375rem] flex mr-3 items-center" role="presentation">
                                <div className="flex items-center" role="presentation">
                                  {" "}
                                  <div className="basis-full shrink-0 h-4 border border-solid border-clr-20 flex relative rounded-sm items-center leading-4.5 bg-surface after:content-[''] after:block after:absolute after:inset-0 after:w-3.5 after:h-3.5" role="presentation">
                                    {" "}
                                  </div>
                                  {" "}
                                </div>
                                {" "}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="w-12.5 h-11 border-b border-solid border-b-border block absolute text-muted-foreground whitespace-nowrap text-nowrap bg-surface transform-[matrix(1,0,0,1,0,396)]" aria-rowindex="11" aria-selected="false" role="row">
                          <div className="w-12.5 h-full border border-solid border-t-clr-4 border-r-border border-b-clr-4 border-l-clr-4 block absolute top-0 px-[0.9375rem] leading-[2.4375rem]" aria-colindex="1" role="gridcell">
                            <div className="flex items-center" role="presentation">
                              <div className="h-[2.4375rem] flex mr-3 items-center" role="presentation">
                                <div className="flex items-center" role="presentation">
                                  {" "}
                                  <div className="basis-full shrink-0 h-4 border border-solid border-clr-20 flex relative rounded-sm items-center leading-4.5 bg-surface after:content-[''] after:block after:absolute after:inset-0 after:w-3.5 after:h-3.5" role="presentation">
                                    {" "}
                                  </div>
                                  {" "}
                                </div>
                                {" "}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="w-12.5 h-11 border-b border-solid border-b-border block absolute text-muted-foreground whitespace-nowrap text-nowrap bg-surface transform-[matrix(1,0,0,1,0,440)]" aria-rowindex="12" aria-selected="false" role="row">
                          <div className="w-12.5 h-full border border-solid border-t-clr-4 border-r-border border-b-clr-4 border-l-clr-4 block absolute top-0 px-[0.9375rem] leading-[2.4375rem]" aria-colindex="1" role="gridcell">
                            <div className="flex items-center" role="presentation">
                              <div className="h-[2.4375rem] flex mr-3 items-center" role="presentation">
                                <div className="flex items-center" role="presentation">
                                  {" "}
                                  <div className="basis-full shrink-0 h-4 border border-solid border-clr-20 flex relative rounded-sm items-center leading-4.5 bg-surface after:content-[''] after:block after:absolute after:inset-0 after:w-3.5 after:h-3.5" role="presentation">
                                    {" "}
                                  </div>
                                  {" "}
                                </div>
                                {" "}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="w-12.5 h-11 border-b border-solid border-b-border block absolute text-muted-foreground whitespace-nowrap text-nowrap bg-surface transform-[matrix(1,0,0,1,0,484)]" aria-rowindex="13" aria-selected="false" role="row">
                          <div className="w-12.5 h-full border border-solid border-t-clr-4 border-r-border border-b-clr-4 border-l-clr-4 block absolute top-0 px-[0.9375rem] leading-[2.4375rem]" aria-colindex="1" role="gridcell">
                            <div className="flex items-center" role="presentation">
                              <div className="h-[2.4375rem] flex mr-3 items-center" role="presentation">
                                <div className="flex items-center" role="presentation">
                                  {" "}
                                  <div className="basis-full shrink-0 h-4 border border-solid border-clr-20 flex relative rounded-sm items-center leading-4.5 bg-surface after:content-[''] after:block after:absolute after:inset-0 after:w-3.5 after:h-3.5" role="presentation">
                                    {" "}
                                  </div>
                                  {" "}
                                </div>
                                {" "}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="w-12.5 h-11 border-b border-solid border-b-border block absolute text-muted-foreground whitespace-nowrap text-nowrap bg-surface transform-[matrix(1,0,0,1,0,528)]" aria-rowindex="14" aria-selected="false" role="row">
                          <div className="w-12.5 h-full border border-solid border-t-clr-4 border-r-border border-b-clr-4 border-l-clr-4 block absolute top-0 px-[0.9375rem] leading-[2.4375rem]" aria-colindex="1" role="gridcell">
                            <div className="flex items-center" role="presentation">
                              <div className="h-[2.4375rem] flex mr-3 items-center" role="presentation">
                                <div className="flex items-center" role="presentation">
                                  {" "}
                                  <div className="basis-full shrink-0 h-4 border border-solid border-clr-20 flex relative rounded-sm items-center leading-4.5 bg-surface after:content-[''] after:block after:absolute after:inset-0 after:w-3.5 after:h-3.5" role="presentation">
                                    {" "}
                                  </div>
                                  {" "}
                                </div>
                                {" "}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="w-12.5 h-11 border-b border-solid border-b-border block absolute text-muted-foreground whitespace-nowrap text-nowrap bg-surface transform-[matrix(1,0,0,1,0,572)]" aria-rowindex="15" aria-selected="false" role="row">
                          <div className="w-12.5 h-full border border-solid border-t-clr-4 border-r-border border-b-clr-4 border-l-clr-4 block absolute top-0 px-[0.9375rem] leading-[2.4375rem]" aria-colindex="1" role="gridcell">
                            <div className="flex items-center" role="presentation">
                              <div className="h-[2.4375rem] flex mr-3 items-center" role="presentation">
                                <div className="flex items-center" role="presentation">
                                  {" "}
                                  <div className="basis-full shrink-0 h-4 border border-solid border-clr-20 flex relative rounded-sm items-center leading-4.5 bg-surface after:content-[''] after:block after:absolute after:inset-0 after:w-3.5 after:h-3.5" role="presentation">
                                    {" "}
                                  </div>
                                  {" "}
                                </div>
                                {" "}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="w-12.5 h-11 border-b border-solid border-b-border block absolute text-muted-foreground whitespace-nowrap text-nowrap bg-surface transform-[matrix(1,0,0,1,0,616)]" aria-rowindex="16" aria-selected="false" role="row">
                          <div className="w-12.5 h-full border border-solid border-t-clr-4 border-r-border border-b-clr-4 border-l-clr-4 block absolute top-0 px-[0.9375rem] leading-[2.4375rem]" aria-colindex="1" role="gridcell">
                            <div className="flex items-center" role="presentation">
                              <div className="h-[2.4375rem] flex mr-3 items-center" role="presentation">
                                <div className="flex items-center" role="presentation">
                                  {" "}
                                  <div className="basis-full shrink-0 h-4 border border-solid border-clr-20 flex relative rounded-sm items-center leading-4.5 bg-surface after:content-[''] after:block after:absolute after:inset-0 after:w-3.5 after:h-3.5" role="presentation">
                                    {" "}
                                  </div>
                                  {" "}
                                </div>
                                {" "}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="w-12.5 h-11 border-b border-solid border-b-border block absolute text-muted-foreground whitespace-nowrap text-nowrap bg-surface transform-[matrix(1,0,0,1,0,660)]" aria-rowindex="17" aria-selected="false" role="row">
                          <div className="w-12.5 h-full border border-solid border-t-clr-4 border-r-border border-b-clr-4 border-l-clr-4 block absolute top-0 px-[0.9375rem] leading-[2.4375rem]" aria-colindex="1" role="gridcell">
                            <div className="flex items-center" role="presentation">
                              <div className="h-[2.4375rem] flex mr-3 items-center" role="presentation">
                                <div className="flex items-center" role="presentation">
                                  {" "}
                                  <div className="basis-full shrink-0 h-4 border border-solid border-clr-20 flex relative rounded-sm items-center leading-4.5 bg-surface after:content-[''] after:block after:absolute after:inset-0 after:w-3.5 after:h-3.5" role="presentation">
                                    {" "}
                                  </div>
                                  {" "}
                                </div>
                                {" "}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="w-12.5 h-11 border-b border-solid border-b-border block absolute text-muted-foreground whitespace-nowrap text-nowrap bg-surface transform-[matrix(1,0,0,1,0,704)]" aria-rowindex="18" aria-selected="false" role="row">
                          <div className="w-12.5 h-full border border-solid border-t-clr-4 border-r-border border-b-clr-4 border-l-clr-4 block absolute top-0 px-[0.9375rem] leading-[2.4375rem]" aria-colindex="1" role="gridcell">
                            <div className="flex items-center" role="presentation">
                              <div className="h-[2.4375rem] flex mr-3 items-center" role="presentation">
                                <div className="flex items-center" role="presentation">
                                  {" "}
                                  <div className="basis-full shrink-0 h-4 border border-solid border-clr-20 flex relative rounded-sm items-center leading-4.5 bg-surface after:content-[''] after:block after:absolute after:inset-0 after:w-3.5 after:h-3.5" role="presentation">
                                    {" "}
                                  </div>
                                  {" "}
                                </div>
                                {" "}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="w-12.5 h-11 border-b border-solid border-b-border block absolute text-muted-foreground whitespace-nowrap text-nowrap bg-surface transform-[matrix(1,0,0,1,0,748)]" aria-rowindex="19" aria-selected="false" role="row">
                          <div className="w-12.5 h-full border border-solid border-t-clr-4 border-r-border border-b-clr-4 border-l-clr-4 block absolute top-0 px-[0.9375rem] leading-[2.4375rem]" aria-colindex="1" role="gridcell">
                            <div className="flex items-center" role="presentation">
                              <div className="h-[2.4375rem] flex mr-3 items-center" role="presentation">
                                <div className="flex items-center" role="presentation">
                                  {" "}
                                  <div className="basis-full shrink-0 h-4 border border-solid border-clr-20 flex relative rounded-sm items-center leading-4.5 bg-surface after:content-[''] after:block after:absolute after:inset-0 after:w-3.5 after:h-3.5" role="presentation">
                                    {" "}
                                  </div>
                                  {" "}
                                </div>
                                {" "}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="hidden md:max-lg:w-12.5 md:max-lg:h-11 md:max-lg:border-b md:max-lg:border-solid md:max-lg:border-b-border md:max-lg:block md:max-lg:absolute md:max-lg:text-muted-foreground md:max-lg:whitespace-nowrap md:max-lg:text-nowrap md:max-lg:bg-surface md:max-lg:transform-[matrix(1,0,0,1,0,792)] 2xl:w-12.5 2xl:h-11 2xl:border-b 2xl:border-solid 2xl:border-b-border 2xl:block 2xl:absolute 2xl:text-muted-foreground 2xl:whitespace-nowrap 2xl:text-nowrap 2xl:bg-surface 2xl:transform-[matrix(1,0,0,1,0,792)]" aria-rowindex="20" aria-selected="false" role="row">
                          <div className="hidden md:max-lg:w-12.5 md:max-lg:h-full md:max-lg:border md:max-lg:border-solid md:max-lg:border-t-clr-4 md:max-lg:border-r-border md:max-lg:border-b-clr-4 md:max-lg:border-l-clr-4 md:max-lg:block md:max-lg:absolute md:max-lg:top-0 md:max-lg:px-[0.9375rem] md:max-lg:leading-[2.4375rem] 2xl:w-12.5 2xl:h-full 2xl:border 2xl:border-solid 2xl:border-t-clr-4 2xl:border-r-border 2xl:border-b-clr-4 2xl:border-l-clr-4 2xl:block 2xl:absolute 2xl:top-0 2xl:px-[0.9375rem] 2xl:leading-[2.4375rem]" aria-colindex="1" role="gridcell">
                            <div className="hidden md:max-lg:flex md:max-lg:items-center 2xl:flex 2xl:items-center" role="presentation">
                              <div className="hidden md:max-lg:h-[2.4375rem] md:max-lg:flex md:max-lg:mr-3 md:max-lg:items-center 2xl:h-[2.4375rem] 2xl:flex 2xl:mr-3 2xl:items-center" role="presentation">
                                <div className="hidden md:max-lg:flex md:max-lg:items-center 2xl:flex 2xl:items-center" role="presentation">
                                  {" "}
                                  <div className="hidden md:max-lg:basis-full md:max-lg:shrink-0 md:max-lg:h-4 md:max-lg:border md:max-lg:border-solid md:max-lg:border-clr-20 md:max-lg:flex md:max-lg:relative md:max-lg:rounded-sm md:max-lg:items-center md:max-lg:leading-4.5 md:max-lg:bg-surface 2xl:basis-full 2xl:shrink-0 2xl:h-4 2xl:border 2xl:border-solid 2xl:border-clr-20 2xl:flex 2xl:relative 2xl:rounded-sm 2xl:items-center 2xl:leading-4.5 2xl:bg-surface after:content-[''] after:block after:absolute after:inset-0 after:w-3.5 after:h-3.5 max-md:after:hidden" role="presentation">
                                    {" "}
                                  </div>
                                  {" "}
                                </div>
                                {" "}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="hidden md:max-lg:w-12.5 md:max-lg:h-11 md:max-lg:border-b md:max-lg:border-solid md:max-lg:border-b-border md:max-lg:block md:max-lg:absolute md:max-lg:text-muted-foreground md:max-lg:whitespace-nowrap md:max-lg:text-nowrap md:max-lg:bg-surface md:max-lg:transform-[matrix(1,0,0,1,0,836)] 2xl:w-12.5 2xl:h-11 2xl:border-b 2xl:border-solid 2xl:border-b-border 2xl:block 2xl:absolute 2xl:text-muted-foreground 2xl:whitespace-nowrap 2xl:text-nowrap 2xl:bg-surface 2xl:transform-[matrix(1,0,0,1,0,836)]" aria-rowindex="21" aria-selected="false" role="row">
                          <div className="hidden md:max-lg:w-12.5 md:max-lg:h-full md:max-lg:border md:max-lg:border-solid md:max-lg:border-t-clr-4 md:max-lg:border-r-border md:max-lg:border-b-clr-4 md:max-lg:border-l-clr-4 md:max-lg:block md:max-lg:absolute md:max-lg:top-0 md:max-lg:px-[0.9375rem] md:max-lg:leading-[2.4375rem] 2xl:w-12.5 2xl:h-full 2xl:border 2xl:border-solid 2xl:border-t-clr-4 2xl:border-r-border 2xl:border-b-clr-4 2xl:border-l-clr-4 2xl:block 2xl:absolute 2xl:top-0 2xl:px-[0.9375rem] 2xl:leading-[2.4375rem]" aria-colindex="1" role="gridcell">
                            <div className="hidden md:max-lg:flex md:max-lg:items-center 2xl:flex 2xl:items-center" role="presentation">
                              <div className="hidden md:max-lg:h-[2.4375rem] md:max-lg:flex md:max-lg:mr-3 md:max-lg:items-center 2xl:h-[2.4375rem] 2xl:flex 2xl:mr-3 2xl:items-center" role="presentation">
                                <div className="hidden md:max-lg:flex md:max-lg:items-center 2xl:flex 2xl:items-center" role="presentation">
                                  {" "}
                                  <div className="hidden md:max-lg:basis-full md:max-lg:shrink-0 md:max-lg:h-4 md:max-lg:border md:max-lg:border-solid md:max-lg:border-clr-20 md:max-lg:flex md:max-lg:relative md:max-lg:rounded-sm md:max-lg:items-center md:max-lg:leading-4.5 md:max-lg:bg-surface 2xl:basis-full 2xl:shrink-0 2xl:h-4 2xl:border 2xl:border-solid 2xl:border-clr-20 2xl:flex 2xl:relative 2xl:rounded-sm 2xl:items-center 2xl:leading-4.5 2xl:bg-surface after:content-[''] after:block after:absolute after:inset-0 after:w-3.5 after:h-3.5 max-md:after:hidden" role="presentation">
                                    {" "}
                                  </div>
                                  {" "}
                                </div>
                                {" "}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="hidden md:max-lg:w-12.5 md:max-lg:h-11 md:max-lg:border-b md:max-lg:border-solid md:max-lg:border-b-border md:max-lg:block md:max-lg:absolute md:max-lg:text-muted-foreground md:max-lg:whitespace-nowrap md:max-lg:text-nowrap md:max-lg:bg-surface md:max-lg:transform-[matrix(1,0,0,1,0,880)] 2xl:w-12.5 2xl:h-11 2xl:border-b 2xl:border-solid 2xl:border-b-border 2xl:block 2xl:absolute 2xl:text-muted-foreground 2xl:whitespace-nowrap 2xl:text-nowrap 2xl:bg-surface 2xl:transform-[matrix(1,0,0,1,0,880)]" aria-rowindex="22" aria-selected="false" role="row">
                          <div className="hidden md:max-lg:w-12.5 md:max-lg:h-full md:max-lg:border md:max-lg:border-solid md:max-lg:border-t-clr-4 md:max-lg:border-r-border md:max-lg:border-b-clr-4 md:max-lg:border-l-clr-4 md:max-lg:block md:max-lg:absolute md:max-lg:top-0 md:max-lg:px-[0.9375rem] md:max-lg:leading-[2.4375rem] 2xl:w-12.5 2xl:h-full 2xl:border 2xl:border-solid 2xl:border-t-clr-4 2xl:border-r-border 2xl:border-b-clr-4 2xl:border-l-clr-4 2xl:block 2xl:absolute 2xl:top-0 2xl:px-[0.9375rem] 2xl:leading-[2.4375rem]" aria-colindex="1" role="gridcell">
                            <div className="hidden md:max-lg:flex md:max-lg:items-center 2xl:flex 2xl:items-center" role="presentation">
                              <div className="hidden md:max-lg:h-[2.4375rem] md:max-lg:flex md:max-lg:mr-3 md:max-lg:items-center 2xl:h-[2.4375rem] 2xl:flex 2xl:mr-3 2xl:items-center" role="presentation">
                                <div className="hidden md:max-lg:flex md:max-lg:items-center 2xl:flex 2xl:items-center" role="presentation">
                                  {" "}
                                  <div className="hidden md:max-lg:basis-full md:max-lg:shrink-0 md:max-lg:h-4 md:max-lg:border md:max-lg:border-solid md:max-lg:border-clr-20 md:max-lg:flex md:max-lg:relative md:max-lg:rounded-sm md:max-lg:items-center md:max-lg:leading-4.5 md:max-lg:bg-surface 2xl:basis-full 2xl:shrink-0 2xl:h-4 2xl:border 2xl:border-solid 2xl:border-clr-20 2xl:flex 2xl:relative 2xl:rounded-sm 2xl:items-center 2xl:leading-4.5 2xl:bg-surface after:content-[''] after:block after:absolute after:inset-0 after:w-3.5 after:h-3.5 max-md:after:hidden" role="presentation">
                                    {" "}
                                  </div>
                                  {" "}
                                </div>
                                {" "}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="hidden md:max-lg:w-12.5 md:max-lg:h-11 md:max-lg:border-b md:max-lg:border-solid md:max-lg:border-b-border md:max-lg:block md:max-lg:absolute md:max-lg:text-muted-foreground md:max-lg:whitespace-nowrap md:max-lg:text-nowrap md:max-lg:bg-surface md:max-lg:transform-[matrix(1,0,0,1,0,924)] 2xl:w-12.5 2xl:h-11 2xl:border-b 2xl:border-solid 2xl:border-b-border 2xl:block 2xl:absolute 2xl:text-muted-foreground 2xl:whitespace-nowrap 2xl:text-nowrap 2xl:bg-surface 2xl:transform-[matrix(1,0,0,1,0,924)]" aria-rowindex="23" aria-selected="false" role="row">
                          <div className="hidden md:max-lg:w-12.5 md:max-lg:h-full md:max-lg:border md:max-lg:border-solid md:max-lg:border-t-clr-4 md:max-lg:border-r-border md:max-lg:border-b-clr-4 md:max-lg:border-l-clr-4 md:max-lg:block md:max-lg:absolute md:max-lg:top-0 md:max-lg:px-[0.9375rem] md:max-lg:leading-[2.4375rem] 2xl:w-12.5 2xl:h-full 2xl:border 2xl:border-solid 2xl:border-t-clr-4 2xl:border-r-border 2xl:border-b-clr-4 2xl:border-l-clr-4 2xl:block 2xl:absolute 2xl:top-0 2xl:px-[0.9375rem] 2xl:leading-[2.4375rem]" aria-colindex="1" role="gridcell">
                            <div className="hidden md:max-lg:flex md:max-lg:items-center 2xl:flex 2xl:items-center" role="presentation">
                              <div className="hidden md:max-lg:h-[2.4375rem] md:max-lg:flex md:max-lg:mr-3 md:max-lg:items-center 2xl:h-[2.4375rem] 2xl:flex 2xl:mr-3 2xl:items-center" role="presentation">
                                <div className="hidden md:max-lg:flex md:max-lg:items-center 2xl:flex 2xl:items-center" role="presentation">
                                  {" "}
                                  <div className="hidden md:max-lg:basis-full md:max-lg:shrink-0 md:max-lg:h-4 md:max-lg:border md:max-lg:border-solid md:max-lg:border-clr-20 md:max-lg:flex md:max-lg:relative md:max-lg:rounded-sm md:max-lg:items-center md:max-lg:leading-4.5 md:max-lg:bg-surface 2xl:basis-full 2xl:shrink-0 2xl:h-4 2xl:border 2xl:border-solid 2xl:border-clr-20 2xl:flex 2xl:relative 2xl:rounded-sm 2xl:items-center 2xl:leading-4.5 2xl:bg-surface after:content-[''] after:block after:absolute after:inset-0 after:w-3.5 after:h-3.5 max-md:after:hidden" role="presentation">
                                    {" "}
                                  </div>
                                  {" "}
                                </div>
                                {" "}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="hidden md:max-lg:w-12.5 md:max-lg:h-11 md:max-lg:border-b md:max-lg:border-solid md:max-lg:border-b-border md:max-lg:block md:max-lg:absolute md:max-lg:text-muted-foreground md:max-lg:whitespace-nowrap md:max-lg:text-nowrap md:max-lg:bg-surface md:max-lg:transform-[matrix(1,0,0,1,0,968)] 2xl:w-12.5 2xl:h-11 2xl:border-b 2xl:border-solid 2xl:border-b-border 2xl:block 2xl:absolute 2xl:text-muted-foreground 2xl:whitespace-nowrap 2xl:text-nowrap 2xl:bg-surface 2xl:transform-[matrix(1,0,0,1,0,968)]" aria-rowindex="24" aria-selected="false" role="row">
                          <div className="hidden md:max-lg:w-12.5 md:max-lg:h-full md:max-lg:border md:max-lg:border-solid md:max-lg:border-t-clr-4 md:max-lg:border-r-border md:max-lg:border-b-clr-4 md:max-lg:border-l-clr-4 md:max-lg:block md:max-lg:absolute md:max-lg:top-0 md:max-lg:px-[0.9375rem] md:max-lg:leading-[2.4375rem] 2xl:w-12.5 2xl:h-full 2xl:border 2xl:border-solid 2xl:border-t-clr-4 2xl:border-r-border 2xl:border-b-clr-4 2xl:border-l-clr-4 2xl:block 2xl:absolute 2xl:top-0 2xl:px-[0.9375rem] 2xl:leading-[2.4375rem]" aria-colindex="1" role="gridcell">
                            <div className="hidden md:max-lg:flex md:max-lg:items-center 2xl:flex 2xl:items-center" role="presentation">
                              <div className="hidden md:max-lg:h-[2.4375rem] md:max-lg:flex md:max-lg:mr-3 md:max-lg:items-center 2xl:h-[2.4375rem] 2xl:flex 2xl:mr-3 2xl:items-center" role="presentation">
                                <div className="hidden md:max-lg:flex md:max-lg:items-center 2xl:flex 2xl:items-center" role="presentation">
                                  {" "}
                                  <div className="hidden md:max-lg:basis-full md:max-lg:shrink-0 md:max-lg:h-4 md:max-lg:border md:max-lg:border-solid md:max-lg:border-clr-20 md:max-lg:flex md:max-lg:relative md:max-lg:rounded-sm md:max-lg:items-center md:max-lg:leading-4.5 md:max-lg:bg-surface 2xl:basis-full 2xl:shrink-0 2xl:h-4 2xl:border 2xl:border-solid 2xl:border-clr-20 2xl:flex 2xl:relative 2xl:rounded-sm 2xl:items-center 2xl:leading-4.5 2xl:bg-surface after:content-[''] after:block after:absolute after:inset-0 after:w-3.5 after:h-3.5 max-md:after:hidden" role="presentation">
                                    {" "}
                                  </div>
                                  {" "}
                                </div>
                                {" "}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="hidden 2xl:w-12.5 2xl:h-11 2xl:border-b 2xl:border-solid 2xl:border-b-border 2xl:block 2xl:absolute 2xl:text-muted-foreground 2xl:whitespace-nowrap 2xl:text-nowrap 2xl:bg-surface 2xl:transform-[matrix(1,0,0,1,0,1012)]" aria-rowindex="25" aria-selected="false" role="row">
                          <div className="hidden 2xl:w-12.5 2xl:h-full 2xl:border 2xl:border-solid 2xl:border-t-clr-4 2xl:border-r-border 2xl:border-b-clr-4 2xl:border-l-clr-4 2xl:block 2xl:absolute 2xl:top-0 2xl:px-[0.9375rem] 2xl:leading-[2.4375rem]" aria-colindex="1" role="gridcell">
                            <div className="hidden 2xl:flex 2xl:items-center" role="presentation">
                              <div className="hidden 2xl:h-[2.4375rem] 2xl:flex 2xl:mr-3 2xl:items-center" role="presentation">
                                <div className="hidden 2xl:flex 2xl:items-center" role="presentation">
                                  {" "}
                                  <div className="hidden 2xl:basis-full 2xl:shrink-0 2xl:h-4 2xl:border 2xl:border-solid 2xl:border-clr-20 2xl:flex 2xl:relative 2xl:rounded-sm 2xl:items-center 2xl:leading-4.5 2xl:bg-surface after:content-[''] after:block after:absolute after:inset-0 after:w-3.5 after:h-3.5 max-lg:after:hidden" role="presentation">
                                    {" "}
                                  </div>
                                  {" "}
                                </div>
                                {" "}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="h-1089 min-h-full block relative min-w-0 grow overflow-x-auto overflow-y-hidden" role="rowgroup">
                        <div className="w-607.5 h-1089 block relative" role="presentation">
                          {mediaTile3Data.map((d, i) => <MediaTile3 key={i} d={d} styles={MediaTile3_styles[i]} />)}
                          {tileData.map((d, i) => <Tile key={i} d={d} styles={Tile_styles[i]} />)}
                          <div className="hidden 2xl:w-607.5 2xl:h-11 2xl:border-b 2xl:border-solid 2xl:border-b-border 2xl:block 2xl:absolute 2xl:text-muted-foreground 2xl:whitespace-nowrap 2xl:text-nowrap 2xl:bg-surface 2xl:transform-[matrix(1,0,0,1,0,1012)]" aria-rowindex="25" aria-selected="false" role="row">
                            {tile2Data.map((d, i) => <Tile2 key={i} d={d} styles={Tile2_styles[i]} />)}
                            <div className="hidden 2xl:w-50 2xl:h-full 2xl:border 2xl:border-solid 2xl:border-t-clr-4 2xl:border-r-border 2xl:border-b-clr-4 2xl:border-l-clr-4 2xl:flex 2xl:absolute 2xl:top-0 2xl:left-350 2xl:px-[0.9375rem] 2xl:items-center 2xl:grow 2xl:overflow-hidden 2xl:leading-[2.4375rem]" aria-colindex="9" role="gridcell">
                              <a className="hidden 2xl:flex 2xl:items-center 2xl:gap-1 2xl:leading-5 2xl:cursor-pointer" href="http://www.linkedin.com/in/mike-dea-1a14904" rel="noreferrer" target="_blank">
                                <Icon19 />
                                <span className="hidden 2xl:block 2xl:overflow-hidden">
                                  linkedin.com/in/mike-dea-1a14904
                                </span>
                              </a>
                            </div>
                            <div className="hidden 2xl:w-50 2xl:h-full 2xl:border 2xl:border-solid 2xl:border-t-clr-4 2xl:border-r-border 2xl:border-b-clr-4 2xl:border-l-clr-4 2xl:flex 2xl:absolute 2xl:top-0 2xl:left-400 2xl:px-[0.9375rem] 2xl:items-center 2xl:grow 2xl:overflow-hidden 2xl:leading-[2.4375rem]" aria-colindex="10" role="gridcell">
                              <a className="hidden 2xl:flex 2xl:items-center 2xl:gap-1 2xl:leading-5 2xl:cursor-pointer" href="http://www.trustetc.com/" rel="noreferrer" target="_blank">
                                <Icon19 />
                                <span className="hidden 2xl:block 2xl:overflow-hidden">
                                  trustetc.com
                                </span>
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="h-1089 block absolute inset-x-0 min-w-0 pointer-events-none" role="rowgroup" />
                    </div>
                    <div className="w-[0.9375rem] flex relative min-w-[0.9375rem] max-w-[0.9375rem]" aria-hidden="true">
                      <div className="w-[0.9375rem] block relative min-w-[0.9375rem] max-w-[0.9375rem] grow overflow-x-hidden overflow-y-scroll">
                        <div className="w-[0.9375rem] h-1089 block relative min-w-[0.9375rem] max-w-[0.9375rem]" />
                        {" "}
                      </div>
                      {" "}
                    </div>
                  </div>
                  <div className="h-0 flex absolute top-[2.8125rem] right-[0.9375rem] left-0 z-1 min-w-0 overflow-hidden bg-surface" role="presentation">
                    <div className="w-12.5 block relative min-w-12.5 max-w-12.5 overflow-hidden" aria-hidden="false" role="rowgroup" />
                    <div className="block relative min-w-0 grow overflow-x-auto overflow-y-hidden" role="rowgroup">
                      <div className="w-607.5 min-h-px block relative whitespace-nowrap text-nowrap" role="presentation" />
                    </div>
                    <div className="h-0 block absolute inset-x-0 min-w-0 overflow-hidden pointer-events-none" role="rowgroup" />
                  </div>
                  <div className="h-[0.9375rem] min-h-[0.9375rem] flex relative min-w-0 max-h-[0.9375rem]" aria-hidden="true">
                    <div className="w-12.5 border-r border-solid border-r-border block min-w-12.5 max-w-12.5 overflow-x-scroll overflow-y-auto" />
                    {" "}
                    <div className="h-[0.9375rem] min-h-[0.9375rem] block relative min-w-0 max-h-[0.9375rem] grow overflow-x-scroll overflow-y-hidden">
                      <div className="w-607.5 h-[0.9375rem] min-h-[0.9375rem] block relative max-h-[0.9375rem]" />
                      {" "}
                    </div>
                    {" "}
                    <div className="w-[0.9375rem] block min-w-[0.9375rem] max-w-[0.9375rem] overflow-x-hidden overflow-y-auto" />
                    {" "}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="h-11 border border-solid border-surface-2 flex mb-4 py-1.5 pr-4 pl-6 rounded-br-lg rounded-bl-lg justify-between items-center shrink-0 bg-surface">
        <button className="w-[9.65rem] h-9 flex relative min-w-16 py-2.5 px-5 rounded-lg justify-center items-center align-middle font-semibold text-center cursor-pointer max-md:w-[7.175rem] hover:bg-clr-23 focus:bg-clr-26" data-component="button" type="button">
          <span className="flex mr-2 -ml-1">
            <Icon20 />
          </span>
          Add contact
        </button>
        <div className="flex items-center gap-2">
          <p className="block text-muted">
            99
          </p>
        </div>
      </div>
    </div>
  );
}

