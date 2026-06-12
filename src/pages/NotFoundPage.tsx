import { Home, MapPinned } from 'lucide-react';
import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';

export default function NotFoundPage() {
  const routeError = useRouteError();
  const title = isRouteErrorResponse(routeError) ? `${routeError.status} ${routeError.statusText}` : 'Page not found';

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <section className="w-full rounded-lg border border-slate-200 bg-white p-8 text-center shadow-soft">
        <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-slate-900 text-white">
          <MapPinned size={24} aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-3xl font-black text-slate-950">{title}</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600">
          The requested noise dashboard page does not exist or could not be loaded.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          <Home size={16} aria-hidden="true" />
          Open dashboard
        </Link>
      </section>
    </div>
  );
}
