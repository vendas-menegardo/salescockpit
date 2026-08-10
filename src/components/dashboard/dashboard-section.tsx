interface DashboardSectionProps {
  title: string;
  children: React.ReactNode;
}

export function DashboardSection({
  title,
  children,
}: DashboardSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="border-l-2 border-blue-600 pl-3 text-base font-bold text-zinc-900">
        {title}
      </h2>

      {children}
    </section>
  );
}
