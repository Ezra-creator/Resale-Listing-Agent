export type ConditionGrade = "New with tags" | "Like new" | "Good" | "Fair" | "Worn";

export type StepStatus = "pending" | "active" | "done";

export interface AgentStep {
  id: string;
  label: string;
  subtext?: string;
  status: StepStatus;
}

export interface UploadedPhoto {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  size: number;
}

export interface PlatformListing {
  title: string;
  description: string;
  category_suggestion?: string;
  suggested_price: number;
}

export interface PlatformListingsMap {
  ebay: PlatformListing;
  poshmark: PlatformListing;
  facebook_marketplace: PlatformListing;
}

export interface ResaleReport {
  item_type: string;
  brand: string | null;
  condition_grade: ConditionGrade;
  price_range: {
    low: number;
    high: number;
    suggested: number;
  };
  title: string;
  description: string;
  category: string;
  tags: string[];
  flaws_to_disclose: string[];
  platform_listings: PlatformListingsMap;
}
