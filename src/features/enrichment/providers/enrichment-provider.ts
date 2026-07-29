export type EnrichmentPreview = {
  companyId: string;
  provider: string;
  changes: Array<{
    field: string;
    currentValue: string | null;
    proposedValue: string;
    source: string;
  }>;
};

export interface EnrichmentProvider {
  readonly name: string;
  isConfigured(): boolean;
  preview(companyIds: string[]): Promise<EnrichmentPreview[]>;
}

export function getEnrichmentProvider(): EnrichmentProvider | null {
  return null;
}
