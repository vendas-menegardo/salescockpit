export interface Base {
  id: string;
  name: string;
  description?: string;

  segment: string;
  state?: string;
  city?: string;

  companiesCount: number;

  createdAt: Date;
  updatedAt: Date;
}
