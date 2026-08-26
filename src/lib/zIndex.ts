/** Layer order for overlays and menus. Raise here, not with one-off z-[…] in components. */
export const Z = {
 header: 40,
 overlay: 60,
 overlayElevated: 75,
 menuBackdrop: 80,
 menu: 90,
 sheet: 100,
 sheetStacked: 110,
} as const;
