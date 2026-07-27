interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({
  title,
  description,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center">
      <h3 className="text-lg font-semibold text-zinc-900">
        {title}
      </h3>

      <p className="mt-2 max-w-md text-sm text-zinc-500">
        {description}
      </p>
    </div>
  );
}
