/**
 * App copy catalog (defaults). Overrides live in Settings → Copy (`copy_overrides`).
 * Add keys here, then render with `useT()` / `t(key)`.
 */

export type CopyGroup = 'home' | 'search' | 'nav' | 'event' | 'form' | 'empty' | 'modals' | 'auth';

export type CopyKey =
  | 'home.title'
  | 'home.subtitleSignedIn'
  | 'home.subtitleSignedOut'
  | 'auth.prompt.leaveReview'
  | 'search.placeholder'
  | 'nav.home'
  | 'nav.stats'
  | 'nav.profile'
  | 'nav.add'
  | 'event.starring'
  | 'event.specialGuests'
  | 'event.specialGuest'
  | 'event.producedBy'
  | 'event.featuredModels'
  | 'event.hairMakeup'
  | 'event.genre'
  | 'event.collection'
  | 'form.createTitle'
  | 'form.editTitle'
  | 'form.showName'
  | 'form.showType'
  | 'form.date'
  | 'form.city'
  | 'form.city.placeholder'
  | 'form.venue'
  | 'form.venue.placeholder.fashion'
  | 'form.venue.placeholder.music'
  | 'form.starring.placeholder.fashion'
  | 'form.starring.placeholder.music'
  | 'form.specialGuests.placeholder'
  | 'form.producedBy'
  | 'form.producedBy.placeholder.fashion'
  | 'form.producedBy.placeholder.music'
  | 'form.featuredModels'
  | 'form.featuredModels.placeholder'
  | 'form.hairMakeup'
  | 'form.hairMakeup.placeholder'
  | 'form.genre'
  | 'form.genre.placeholder.fashion'
  | 'form.genre.placeholder.music'
  | 'form.collection'
  | 'form.collection.placeholder.fashion'
  | 'form.collection.placeholder.music'
  | 'empty.noShows.title'
  | 'empty.noShows.body'
  | 'empty.noShows.cta'
  | 'empty.noMatch.title'
  | 'empty.noMatch.body'
  | 'empty.noMatch.cta'
  | 'modals.backToShows';

export type CopyEntry = {
  default: string;
  /** Short label in Settings → Copy */
  label: string;
  group: CopyGroup;
};

export const COPY_CATALOG: Record<CopyKey, CopyEntry> = {
  'home.title': {
    default: 'Shows',
    label: 'Home title',
    group: 'home',
  },
  'home.subtitleSignedIn': {
    default: 'Discover, rate, and review fashion and music shows from around the world',
    label: 'Home subtitle (signed in)',
    group: 'home',
  },
  'home.subtitleSignedOut': {
    default: 'Sign in to rate shows and add your own!',
    label: 'Home subtitle (signed out)',
    group: 'home',
  },
  'auth.prompt.leaveReview': {
    default: 'Sign in to leave a review',
    label: 'Auth prompt: leave a review',
    group: 'auth',
  },
  'search.placeholder': {
    default: 'Search shows, designers, artists, models...',
    label: 'Search placeholder',
    group: 'search',

  },
  'nav.home': { default: 'Home', label: 'Nav: Home', group: 'nav' },
  'nav.stats': { default: 'Stats', label: 'Nav: Stats', group: 'nav' },
  'nav.profile': { default: 'Profile', label: 'Nav: Profile', group: 'nav' },
  'nav.add': { default: 'Add', label: 'Nav: Add', group: 'nav' },
  'event.starring': {
    default: 'Starring',
    label: 'Card: Starring',
    group: 'event',

  },
  'event.specialGuests': {
    default: 'Special Guests',
    label: 'Card: Special Guests',
    group: 'event',
  },
  'event.specialGuest': {
    default: 'Special Guest',
    label: 'Card: Special Guest (singular)',
    group: 'event',
  },
  'event.producedBy': {
    default: 'Produced By',
    label: 'Card: Produced By',
    group: 'event',
  },
  'event.featuredModels': {
    default: 'Featured Models',
    label: 'Card: Featured Models',
    group: 'event',
  },
  'event.hairMakeup': {
    default: 'Hair & Makeup',
    label: 'Card: Hair & Makeup',
    group: 'event',
  },
  'event.genre': {
    default: 'Genre',
    label: 'Card/form: Genre',
    group: 'event',
  },
  'event.collection': {
    default: 'Collection',
    label: 'Card/form: Collection',
    group: 'event',
  },
  'form.createTitle': {
    default: 'Create New Show',
    label: 'Create modal title',
    group: 'form',
  },
  'form.editTitle': {
    default: 'Edit Show',
    label: 'Edit modal title',
    group: 'form',
  },
  'form.showName': { default: 'Show Name', label: 'Form: Show name', group: 'form' },
  'form.showType': { default: 'Show type', label: 'Form: Show type', group: 'form' },
  'form.date': { default: 'Date', label: 'Form: Date', group: 'form' },
  'form.city': { default: 'City', label: 'Form: City', group: 'form' },
  'form.city.placeholder': {
    default: 'e.g., Denver, CO',
    label: 'Form: City placeholder',
    group: 'form',
  },
  'form.venue': { default: 'Venue', label: 'Form: Venue', group: 'form' },
  'form.venue.placeholder.fashion': {
    default: 'e.g., Grand Palais, Fashion Week',
    label: 'Form: Venue placeholder (fashion)',
    group: 'form',
  },
  'form.venue.placeholder.music': {
    default: 'e.g., Madison Square Garden, The Fillmore',
    label: 'Form: Venue placeholder (music)',
    group: 'form',
  },
  'form.starring.placeholder.fashion': {
    default: 'e.g., Valentino, Gucci, Alexander McQueen',
    label: 'Form: Starring placeholder (fashion)',
    group: 'form',
  },
  'form.starring.placeholder.music': {
    default: 'e.g., Artist Name, Band Name',
    label: 'Form: Starring placeholder (music)',
    group: 'form',
  },
  'form.specialGuests.placeholder': {
    default: 'e.g., Opening act, Special guest',
    label: 'Form: Special guests placeholder',
    group: 'form',
  },
  'form.producedBy': { default: 'Produced By', label: 'Form: Produced By', group: 'form' },
  'form.producedBy.placeholder.fashion': {
    default: 'e.g., Fashion Production Co, Designer Studios',
    label: 'Form: Produced By placeholder (fashion)',
    group: 'form',
  },
  'form.producedBy.placeholder.music': {
    default: 'e.g., Live Nation, Local promoter',
    label: 'Form: Produced By placeholder (music)',
    group: 'form',
  },
  'form.featuredModels': {
    default: 'Featured Models',
    label: 'Form: Featured Models',
    group: 'form',
  },
  'form.featuredModels.placeholder': {
    default: 'e.g., Gigi Hadid, Bella Hadid, Karlie Kloss',
    label: 'Form: Featured Models placeholder',
    group: 'form',
  },
  'form.hairMakeup': { default: 'Hair & Makeup', label: 'Form: Hair & Makeup', group: 'form' },
  'form.hairMakeup.placeholder': {
    default: 'e.g., James Boehmer, Pat McGrath',
    label: 'Form: Hair & Makeup placeholder',
    group: 'form',
  },
  'form.genre': { default: 'Genre', label: 'Form: Genre', group: 'form' },
  'form.genre.placeholder.fashion': {
    default: 'e.g., Spring 2024, Couture, Limited Edition',
    label: 'Form: Genre placeholder (fashion)',
    group: 'form',
  },
  'form.genre.placeholder.music': {
    default: 'e.g., Indie, Jazz, Electronic',
    label: 'Form: Genre placeholder (music)',
    group: 'form',
  },
  'form.collection': { default: 'Collection', label: 'Form: Collection', group: 'form' },
  'form.collection.placeholder.fashion': {
    default: 'e.g., Award Winning, Sustainable Fashion, NYFW Fall 2024',
    label: 'Form: Collection placeholder (fashion)',
    group: 'form',
  },
  'form.collection.placeholder.music': {
    default: 'e.g., World Tour, Live Album, Residencies',
    label: 'Form: Collection placeholder (music)',
    group: 'form',
  },
  'empty.noShows.title': {
    default: 'No shows yet',
    label: 'Empty: no shows title',
    group: 'empty',
  },
  'empty.noShows.body': {
    default: 'Be the first to add a show!',
    label: 'Empty: no shows body',
    group: 'empty',
  },
  'empty.noShows.cta': {
    default: 'Add Show',
    label: 'Empty: no shows button',
    group: 'empty',
  },
  'empty.noMatch.title': {
    default: 'No shows match your search',
    label: 'Empty: no match title',
    group: 'empty',
  },
  'empty.noMatch.body': {
    default: 'Try adjusting your filters or search terms',
    label: 'Empty: no match body',
    group: 'empty',
  },
  'empty.noMatch.cta': {
    default: 'Clear Filters',
    label: 'Empty: no match button',
    group: 'empty',
  },
  'modals.backToShows': {
    default: 'Back to shows',
    label: 'Back to shows link',
    group: 'modals',
  },
};

export const COPY_GROUP_LABELS: Record<CopyGroup, string> = {
  home: 'Home',
  search: 'Search',
  nav: 'Navigation',
  event: 'Event cards',
  form: 'Add / Edit forms',
  empty: 'Empty states',
  modals: 'Other',
  auth: 'Auth',
};

/**
 * Keys editable in Settings → Copy.
 * Only example / placeholder copy — not basic nav, labels, or CTAs.
 * Singular/plural label pairs stay code-only (not listed here).
 */
export const COPY_SETTINGS_KEYS: CopyKey[] = [
  'search.placeholder',
  'form.city.placeholder',
  'form.venue.placeholder.fashion',
  'form.venue.placeholder.music',
  'form.starring.placeholder.fashion',
  'form.starring.placeholder.music',
  'form.specialGuests.placeholder',
  'form.producedBy.placeholder.fashion',
  'form.producedBy.placeholder.music',
  'form.featuredModels.placeholder',
  'form.hairMakeup.placeholder',
  'form.genre.placeholder.fashion',
  'form.genre.placeholder.music',
  'form.collection.placeholder.fashion',
  'form.collection.placeholder.music',
];
