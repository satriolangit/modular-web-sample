import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

vi.mock('@arsi/container', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

import { ModuleStatusBadge } from '../components/ModuleStatusBadge';
import { ModuleTable } from '../components/ModuleTable';
import { TokenBar } from '../components/TokenBar';
import { UploadCard } from '../components/UploadCard';
import { createRegistryAdminService } from '../services/service.registryAdmin';

const moduleSummary = {
  name: 'demo-module',
  version: '1.0.0',
  apiVersion: 1,
  manifest: 'http://localhost:4310/modules/demo-module/1.0.0/mf-manifest.json',
  integrity: 'sha384-x',
  css: [],
  enabled: true,
};

describe('createRegistryAdminService', () => {
  it('memanggil endpoint yang benar', async () => {
    const api = {
      get: vi.fn(async () => ({ data: { modules: [moduleSummary] } })),
      post: vi.fn(async () => ({ data: { module: moduleSummary } })),
      patch: vi.fn(async () => ({ data: { module: { ...moduleSummary, enabled: false } } })),
      delete: vi.fn(async () => ({ data: undefined })),
    };
    const service = createRegistryAdminService(api as never);

    await expect(service.list()).resolves.toEqual([moduleSummary]);
    await service.upload(new File(['x'], 'demo.zip'));
    await service.setEnabled('demo-module', false);
    await service.remove('demo-module');

    expect(api.get).toHaveBeenCalledWith('/api/modules');
    expect(api.post).toHaveBeenCalledWith('/api/modules', expect.any(FormData));
    expect(api.patch).toHaveBeenCalledWith('/api/modules/demo-module', { enabled: false });
    expect(api.delete).toHaveBeenCalledWith('/api/modules/demo-module');
  });
});

describe('ModuleStatusBadge', () => {
  it('menampilkan status', () => {
    render(<ModuleStatusBadge enabled />);
    expect(screen.getByText('table.enabled')).toBeInTheDocument();
  });
});

describe('TokenBar', () => {
  it('menyimpan token via callback', () => {
    const onSave = vi.fn();
    render(<TokenBar token="" onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('token.label'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'token.save' }));
    expect(onSave).toHaveBeenCalledWith('secret');
  });
});

describe('UploadCard', () => {
  it('mengirim file yang dipilih', () => {
    const onUpload = vi.fn();
    render(<UploadCard onUpload={onUpload} />);
    const file = new File(['zip'], 'demo.zip', { type: 'application/zip' });
    fireEvent.change(screen.getByLabelText('upload.title'), { target: { files: [file] } });
    expect(onUpload).toHaveBeenCalledWith(file);
  });
});

describe('ModuleTable', () => {
  it('render baris + aksi toggle/delete', () => {
    const onToggle = vi.fn();
    const onDelete = vi.fn();
    render(<ModuleTable modules={[moduleSummary]} onToggle={onToggle} onDelete={onDelete} />);

    expect(screen.getByText('demo-module')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'actions.disable' }));
    expect(onToggle).toHaveBeenCalledWith('demo-module', false);
    fireEvent.click(screen.getByRole('button', { name: 'actions.delete' }));
    expect(onDelete).toHaveBeenCalledWith('demo-module');
  });

  it('empty state saat kosong', () => {
    render(<ModuleTable modules={[]} onToggle={() => {}} onDelete={() => {}} />);
    expect(screen.getByText('table.empty')).toBeInTheDocument();
  });
});
