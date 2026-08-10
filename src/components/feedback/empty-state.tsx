interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({
  title,
  description,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <h3 className="text-lg font-semibold text-zinc-900">
        {title}
      </h3>

      <p className="mt-2 max-w-md text-sm text-zinc-500">
        {description}
      </p>
    </div>
  );
}
