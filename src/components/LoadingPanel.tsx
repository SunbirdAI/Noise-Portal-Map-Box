interface LoadingPanelProps {
  title?: string;
  body?: string;
}

export default function LoadingPanel({
  title = 'Loading sensor network',
  body = 'Fetching the latest readings from the noise sensor API.',
}: LoadingPanelProps) {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-soft">
        <div className="mx-auto mb-4 size-10 animate-spin rounded-full border-4 border-slate-200 border-t-lagoon" />
        <h1 className="text-xl font-extrabold text-slate-950">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
      </div>
    </section>
  );
}
