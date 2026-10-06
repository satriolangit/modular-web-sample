import type { AxiosInstance } from 'axios';

import type { RegistryModuleSummary, UploadResult } from '../types';

export function createRegistryAdminService(api: AxiosInstance) {
  return {
    async list(): Promise<RegistryModuleSummary[]> {
      const response = await api.get<{ modules: RegistryModuleSummary[] }>('/api/modules');
      return response.data.modules;
    },
    async upload(file: File): Promise<UploadResult> {
      const form = new FormData();
      form.append('file', file);
      const response = await api.post<UploadResult>('/api/modules', form);
      return response.data;
    },
    async setEnabled(name: string, enabled: boolean): Promise<RegistryModuleSummary> {
      const response = await api.patch<{ module: RegistryModuleSummary }>(`/api/modules/${name}`, {
        enabled,
      });
      return response.data.module;
    },
    async remove(name: string): Promise<void> {
      await api.delete(`/api/modules/${name}`);
    },
  };
}
