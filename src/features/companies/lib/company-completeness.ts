type CompanyCompletenessInput = {
  corporateName?: string | null;
  cnpj?: string | null;
  segment?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  contactCount?: number;
};

export function calculateCompanyCompleteness(
  company: CompanyCompletenessInput
) {
  const checks = [
    Boolean(company.corporateName),
    Boolean(company.cnpj),
    Boolean(company.segment),
    Boolean(company.city && company.state),
    Boolean(company.phone || company.contactCount),
    Boolean(company.email),
    Boolean(company.website),
  ];
  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}
