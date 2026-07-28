export type ImportCompanyData = {
  cnpj: string;
  corporateName: string;
  tradeName: string;
  segment: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  website: string;
};

export type ImportRowStatus =
  | "new_company"
  | "existing_new_link"
  | "already_in_base"
  | "invalid"
  | "duplicate_file"
  | "conflict";

export type ImportPreviewRow = {
  rowNumber: number;
  data: ImportCompanyData;
  status: ImportRowStatus;
  detail: string;
  eligible: boolean;
  conflicts: string[];
};

export type ImportSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  emptyRowsIgnored: number;
  eligibleRows: number;
  newCompanies: number;
  existingCompanies: number;
  alreadyInBase: number;
  conflicts: number;
};

export type ImportAnalysis = {
  fileName: string;
  delimiter: "," | ";";
  base: {
    id: string;
    name: string;
  };
  summary: ImportSummary;
  rows: ImportPreviewRow[];
};

export type ImportResult = {
  base: {
    id: string;
    name: string;
  };
  companiesCreated: number;
  existingCompaniesReused: number;
  linksCreated: number;
  alreadyInBase: number;
  invalidIgnored: number;
  duplicatesIgnored: number;
  emptyRowsIgnored: number;
  conflictsPreserved: number;
  failures: number;
};

export type ImportActionInput = {
  baseId: string;
  fileName: string;
  csvText: string;
};
