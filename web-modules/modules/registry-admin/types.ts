export interface RegistryModuleSummary {
  name: string;
  version: string;
  apiVersion: number;
  manifest: string;
  integrity: string;
  css: string[];
  enabled: boolean;
}

export interface UploadResult {
  module: RegistryModuleSummary;
}
