import type { ReactNode } from 'react';
import PageBack from './PageBack';
import { routePageShellClass, type RoutePageWidth } from './routePageShell';

type RouteMessageProps = {
  width?: RoutePageWidth;
  children: ReactNode;
};

/** Standard route empty/error gate: Back + centered message. */
export default function RouteMessage({ width = 'narrow', children }: RouteMessageProps) {
  return (
    <div className={routePageShellClass(width)}>
      <PageBack className="mb-6" />
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">{children}</div>
      </div>
    </div>
  );
}
