// Per-instance Ditto metadata. Validation-only node ids stay in .clone/generated.
export type DittoNodeMeta = { anchor?: string };
export type DittoNodeMetaMap = Record<number, DittoNodeMeta | undefined>;

export const MediaTile2_meta: DittoNodeMetaMap[] = [
    { 0: { anchor: "style-3" }, 7: { anchor: "menu-trigger-1" } },
    { 0: { anchor: "style-4" } },
    { 0: { anchor: "style-5" } },
    { 0: { anchor: "style-6" } },
    { 0: { anchor: "style-7" } },
    { 0: { anchor: "style-8" } },
    { 0: { anchor: "style-9" } }
];
