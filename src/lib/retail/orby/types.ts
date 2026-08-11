export interface OrbyEvidence {
  id: string;
  source: "retail_analytics_snapshot" | "retail_customer_summaries" | "retail_supplier_summaries";
  label: string;
  value: string | number;
  unit?: string;
  as_of: string;
  period?: { from: string; to: string };
}

export interface OrbyGrounding {
  intent: string;
  evidence: OrbyEvidence[];
  fallbackAnswer: string;
}
