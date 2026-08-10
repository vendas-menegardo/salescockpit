type CompanyName = {
  corporateName: string;
  tradeName?: string | null;
};

export function getCompanyDisplayName(company: CompanyName) {
  return company.tradeName?.trim() || company.corporateName.trim();
}

export function getCompanySecondaryName(company: CompanyName) {
  const tradeName = company.tradeName?.trim();
  return tradeName ? company.corporateName.trim() : null;
}
