import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { feedImageAttrs } from '../lib/feedImageAttrs';

type RemoteImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string;
  /** Eager-load + high fetch priority for the LCP / overlay photo. */
  priority?: boolean;
};

/**
 * Remote photos: lazy by default, no Referer (hotlink hosts), hide on error
 * instead of a broken-image icon.
 */
export default function RemoteImg({
  src,
  priority = false,
  onError,
  alt = '',
  ...rest
}: RemoteImgProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) return null;

  const loadingAttrs = feedImageAttrs(priority);

  return (
    <img
      {...rest}
      src={src}
      alt={alt}
      loading={rest.loading ?? loadingAttrs.loading}
      fetchPriority={rest.fetchPriority ?? loadingAttrs.fetchPriority}
      decoding={rest.decoding ?? loadingAttrs.decoding}
      referrerPolicy={rest.referrerPolicy ?? loadingAttrs.referrerPolicy}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
