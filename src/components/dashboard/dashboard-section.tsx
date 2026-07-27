interface DashboardSectionProps {
  title: string;
  children: React.ReactNode;
}

export function DashboardSection({
  title,
  children,
}: DashboardSectionProps) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">
        {title}
      </h2>

      {children}
    </section>
  );
}
