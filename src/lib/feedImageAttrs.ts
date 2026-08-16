/** Shared <img> loading attrs for feed / card photos. */

export type FeedImageAttrs = {
  loading: 'eager' | 'lazy';
  fetchPriority: 'high' | 'auto';
  decoding: 'async';
  referrerPolicy: 'no-referrer';
};

/** Above-the-fold cards use eager + high; everything else stays lazy. */
export function feedImageAttrs(priority: boolean): FeedImageAttrs {
  return {
    loading: priority ? 'eager' : 'lazy',
    fetchPriority: priority ? 'high' : 'auto',
    decoding: 'async',
    referrerPolicy: 'no-referrer',
  };
}
