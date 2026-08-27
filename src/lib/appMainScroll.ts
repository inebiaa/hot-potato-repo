/** App scroll container (`<main>` in AppLayout). Shared for scroll-to-top and scroll lock. */
let mainScrollEl: HTMLElement | null = null;

export function setAppMainScrollElement(el: HTMLElement | null) {
  mainScrollEl = el;
}

export function getAppMainScrollElement(): HTMLElement | null {
  return mainScrollEl;
}

export function scrollAppMainToTop() {
  mainScrollEl?.scrollTo({ top: 0 });
}
