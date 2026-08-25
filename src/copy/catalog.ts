/**
 * App copy catalog (defaults). Overrides live in Settings → Copy (`copy_overrides`).
 * Add keys here, then render with `useT()` / `t(key)`.
 */

export type CopyGroup = 'home' | 'search' | 'nav' | 'event' | 'form' | 'empty' | 'modals' | 'auth' | 'settings';

export type CopyKey =
  | 'home.title'
  | 'home.subtitleSignedIn'
  | 'home.subtitleSignedOut'
  | 'home.loadErrorTitle'
  | 'home.loadErrorRetry'
  | 'home.loadErrorDismiss'
  | 'auth.prompt.leaveReview'
  | 'search.placeholder'
  | 'nav.home'
  | 'nav.stats'
  | 'nav.profile'
  | 'nav.add'
  | 'nav.signIn'
  | 'nav.signOut'
  | 'nav.signOutConfirmTitle'
  | 'nav.signOutConfirmBody'
  | 'nav.signOutConfirmCancel'
  | 'nav.signOutConfirmAction'
  | 'settings.title'
  | 'settings.signInToOpen'
  | 'event.starring'
  | 'event.specialGuests'
  | 'event.specialGuest'
  | 'event.producedBy'
  | 'event.hairMakeup'
  | 'event.genre'
  | 'event.collection'
  | 'event.likedListName'
  | 'event.likedListNameForUser'
  | 'event.ratedListName'
  | 'event.ratedListNameForUser'
  | 'event.saveToLiked'
  | 'event.removeFromLiked'
  | 'event.removeFromList'
  | 'event.addToList'
  | 'event.addedToList'
  | 'event.noLists'
  | 'event.newList'
  | 'event.createList'
  | 'event.listPrivate'
  | 'event.copyListLink'
  | 'event.listLinkCopied'
  | 'event.makeListPublic'
  | 'event.makeListPrivate'
  | 'event.editList'
  | 'event.deleteList'
  | 'event.addShow'
  | 'profile.yourLibrary'
  | 'profile.library'
  | 'profile.notFound'
  | 'profile.signInToView'
  | 'auth.prompt.saveShow'
  | 'auth.prompt.addToList'
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
  | 'form.hairMakeup'
  | 'form.hairMakeup.placeholder'
  | 'form.genre'
  | 'form.genre.placeholder.fashion'
  | 'form.genre.placeholder.music'
  | 'form.collection'
  | 'form.collection.placeholder.fashion'
  | 'form.collection.placeholder.music'
  | 'form.showPhoto'
  | 'form.profilePicture'
  | 'form.profilePictureRemove'
  | 'form.profileCover'
  | 'form.profileCoverRemove'
  | 'form.listCover'
  | 'form.listCoverRemove'
  | 'form.imageUrl'
  | 'form.imageUrl.placeholder'
  | 'form.imageUploading'
  | 'form.imageUploadSignIn'
  | 'empty.noShows.title'
  | 'empty.noShows.body'
  | 'empty.noShows.cta'
  | 'empty.noMatch.title'
  | 'empty.noMatch.body'
  | 'empty.noMatch.cta'
  | 'modals.backToShows'
  | 'nav.back'
  | 'nav.backToLibrary';

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
  'home.loadErrorTitle': {
    default: 'Could not load events',
    label: 'Home load error title',
    group: 'home',
  },
  'home.loadErrorRetry': {
    default: 'Retry',
    label: 'Home load error retry',
    group: 'home',
  },
  'home.loadErrorDismiss': {
    default: 'Dismiss',
    label: 'Home load error dismiss',
    group: 'home',
  },
  'settings.title': {
    default: 'Settings',
    label: 'Settings page title',
    group: 'settings',
  },
  'settings.signInToOpen': {
    default: 'Sign in to open settings.',
    label: 'Settings sign-in gate',
    group: 'settings',
  },
  'auth.prompt.leaveReview': {
    default: 'Sign in to leave a review',
    label: 'Auth prompt: leave a review',
    group: 'auth',
  },
  'search.placeholder': {
    default: 'Search shows, designers, artists...',
    label: 'Search placeholder',
    group: 'search',

  },
  'nav.home': { default: 'Home', label: 'Nav: Home', group: 'nav' },
  'nav.stats': { default: 'Stats', label: 'Nav: Stats', group: 'nav' },
  'nav.profile': { default: 'Profile', label: 'Nav: Profile', group: 'nav' },
  'nav.add': { default: 'Add', label: 'Nav: Add', group: 'nav' },
  'nav.signIn': { default: 'Sign in', label: 'Nav: Sign in', group: 'nav' },
  'nav.signOut': { default: 'Sign out', label: 'Nav: Sign out', group: 'nav' },
  'nav.signOutConfirmTitle': {
    default: 'Sign out?',
    label: 'Nav: Sign out confirm title',
    group: 'nav',
  },
  'nav.signOutConfirmBody': {
    default: 'Are you sure you want to sign out?',
    label: 'Nav: Sign out confirm body',
    group: 'nav',
  },
  'nav.signOutConfirmCancel': {
    default: 'Cancel',
    label: 'Nav: Sign out confirm cancel',
    group: 'nav',
  },
  'nav.signOutConfirmAction': {
    default: 'Sign out',
    label: 'Nav: Sign out confirm action',
    group: 'nav',
  },
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
  'event.likedListName': {
    default: 'My Liked Events',
    label: 'Liked list name',
    group: 'event',
  },
  'event.likedListNameForUser': {
    default: "{name}'s Liked Events",
    label: 'Public liked list name',
    group: 'event',
  },
  'event.ratedListName': {
    default: 'My Reviews',
    label: 'Ratings list name',
    group: 'event',
  },
  'event.ratedListNameForUser': {
    default: "{name}'s Reviews",
    label: 'Public ratings list name',
    group: 'event',
  },
  'profile.yourLibrary': {
    default: 'Your Library',
    label: 'Profile library heading',
    group: 'nav',
  },
  'profile.library': {
    default: 'Library',
    label: 'Public profile library heading',
    group: 'nav',
  },
  'profile.notFound': {
    default: 'Profile not found',
    label: 'Public profile not found',
    group: 'nav',
  },
  'profile.signInToView': {
    default: 'Sign in to view your profile.',
    label: 'Profile sign-in required',
    group: 'nav',
  },
  'event.saveToLiked': {
    default: 'Save',
    label: 'Save to Liked',
    group: 'event',
  },
  'event.removeFromLiked': {
    default: 'Saved',
    label: 'Remove from Liked (saved state)',
    group: 'event',
  },
  'event.removeFromList': {
    default: 'Remove from list',
    label: 'Remove from list',
    group: 'event',
  },
  'event.addToList': {
    default: 'Add to list',
    label: 'Add to list',
    group: 'event',
  },
  'event.addedToList': {
    default: 'Added',
    label: 'Added to list confirmation',
    group: 'event',
  },
  'event.noLists': {
    default: 'No lists yet',
    label: 'No lists empty state',
    group: 'event',
  },
  'event.newList': {
    default: 'New list',
    label: 'New list',
    group: 'event',
  },
  'event.createList': {
    default: 'Create list',
    label: 'Create list',
    group: 'event',
  },
  'event.listPrivate': {
    default: 'Private',
    label: 'List private toggle',
    group: 'event',
  },
  'event.copyListLink': {
    default: 'Copy link',
    label: 'Copy shared list link',
    group: 'event',
  },
  'event.listLinkCopied': {
    default: 'Copied',
    label: 'List link copied',
    group: 'event',
  },
  'event.makeListPublic': {
    default: 'Make public',
    label: 'Make list public',
    group: 'event',
  },
  'event.makeListPrivate': {
    default: 'Make private',
    label: 'Make list private',
    group: 'event',
  },
  'event.editList': {
    default: 'Edit details',
    label: 'Edit list name and description',
    group: 'event',
  },
  'event.deleteList': {
    default: 'Delete list',
    label: 'Delete list',
    group: 'event',
  },
  'event.addShow': {
    default: 'Add show',
    label: 'Add show to list',
    group: 'event',
  },
  'auth.prompt.saveShow': {
    default: 'Sign in to save shows',
    label: 'Auth prompt: save show',
    group: 'auth',
  },
  'auth.prompt.addToList': {
    default: 'Sign in to add shows to a list',
    label: 'Auth prompt: add to list',
    group: 'auth',
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
  'form.showPhoto': { default: 'Show photo', label: 'Form: Show photo', group: 'form' },
  'form.profilePicture': { default: 'Profile picture', label: 'Form: Profile picture', group: 'form' },
  'form.profilePictureRemove': { default: 'Remove', label: 'Form: Remove profile picture', group: 'form' },
  'form.profileCover': { default: 'Cover image', label: 'Form: Profile cover image', group: 'form' },
  'form.profileCoverRemove': { default: 'Remove', label: 'Form: Remove profile cover', group: 'form' },
  'form.listCover': { default: 'Cover image', label: 'Form: List cover image', group: 'form' },
  'form.listCoverRemove': { default: 'Remove', label: 'Form: Remove list cover', group: 'form' },
  'form.imageUrl': { default: 'Or image URL', label: 'Form: Image URL', group: 'form' },
  'form.imageUrl.placeholder': {
    default: 'https://…',
    label: 'Form: Image URL placeholder',
    group: 'form',
  },
  'form.imageUploading': {
    default: 'Uploading…',
    label: 'Form: Image uploading',
    group: 'form',
  },
  'form.imageUploadSignIn': {
    default: 'Sign in to upload a photo.',
    label: 'Form: Image upload sign-in',
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
  'nav.back': {
    default: 'Back',
    label: 'Back button',
    group: 'nav',
  },
  'nav.backToLibrary': {
    default: 'Back to library',
    label: 'Back to library button',
    group: 'nav',
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
  settings: 'Settings',
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
  'form.hairMakeup.placeholder',
  'form.genre.placeholder.fashion',
  'form.genre.placeholder.music',
  'form.collection.placeholder.fashion',
  'form.collection.placeholder.music',
  'form.imageUrl.placeholder',
];
