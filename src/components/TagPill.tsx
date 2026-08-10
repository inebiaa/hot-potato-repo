import {
  forwardRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import { cn } from '../lib/utils';
import { tagPillShellClass } from './tagPillShell';

type TagPillBaseProps = {
  children?: ReactNode;
  /** Optional leading control (icon, grip) — sits inside the same shell */
  leading?: ReactNode;
  /** Optional trailing control (remove X) — sits inside the same shell, not its own pill */
  trailing?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

type TagPillAsSpan = TagPillBaseProps &
  Omit<HTMLAttributes<HTMLSpanElement>, 'children' | 'className' | 'style'> & {
    as?: 'span';
  };

type TagPillAsButton = TagPillBaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className' | 'style'> & {
    as: 'button';
  };

export type TagPillProps = TagPillAsSpan | TagPillAsButton;

/**
 * Single tag pill shell used on event cards and in TagInput.
 * Size/shape come only from `tagPillShellClass` — do not override padding/text size.
 */
const TagPill = forwardRef<HTMLSpanElement | HTMLButtonElement, TagPillProps>(
  function TagPill({ children, leading, trailing, className, style, as = 'span', ...rest }, ref) {
    const classes = cn(tagPillShellClass, className);

    if (as === 'button') {
      const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>;
      return (
        <button
          ref={ref as Ref<HTMLButtonElement>}
          type={buttonProps.type ?? 'button'}
          data-tag-pill
          className={classes}
          style={style}
          {...buttonProps}
        >
          {leading}
          {children}
          {trailing}
        </button>
      );
    }

    const spanProps = rest as HTMLAttributes<HTMLSpanElement>;
    return (
      <span ref={ref as Ref<HTMLSpanElement>} data-tag-pill className={classes} style={style} {...spanProps}>
        {leading}
        {children}
        {trailing}
      </span>
    );
  },
);

export default TagPill;
