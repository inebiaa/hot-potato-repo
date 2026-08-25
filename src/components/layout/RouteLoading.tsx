import PageBack from './PageBack';
import { LoadingSpinner } from '../ui';
import { routePageShellClass, type RoutePageWidth } from './routePageShell';

type RouteLoadingProps = {
  width?: RoutePageWidth;
};

/** Standard route loading: Back + centered spinner. */
export default function RouteLoading({ width = 'narrow' }: RouteLoadingProps) {
  return (
    <div className={routePageShellClass(width)}>
      <PageBack className="mb-6" />
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    </div>
  );
}
