import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import Icon from '../ui/Icon';

// Shown instead of a blank screen when a page crashes or the URL doesn't exist.
export default function RouteError({ notFound: isNotFound = false }: { notFound?: boolean }) {
  const error = useRouteError();
  const notFound = isNotFound || (isRouteErrorResponse(error) && error.status === 404);

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 rounded-full bg-surface-muted p-3 text-muted"><Icon name={notFound ? 'search' : 'alert'} /></div>
      <h1 className="text-xl font-semibold">{notFound ? 'Page not found' : 'Something went wrong'}</h1>
      <p className="mt-2 max-w-md text-sm text-muted">
        {notFound
          ? "There's nothing at this address."
          : error instanceof Error ? error.message : 'An unexpected error stopped this page from loading.'}
      </p>
      <Link to="/" className="mt-6 text-sm font-medium text-accent hover:underline">Back to the overview</Link>
    </div>
  );
}
