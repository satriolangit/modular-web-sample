import { fireEvent, render, screen, within } from '@testing-library/react';
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
import { createRegistryAdminService, resolveActionError } from '../services/service.registryAdmin';

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

describe('resolveActionError', () => {
  it('memprioritaskan detail error dari server', () => {
    expect(
      resolveActionError({
        response: { data: { error: 'Token admin tidak valid.' } },
        message: 'Request failed with status code 401',
      }),
    ).toBe('Token admin tidak valid.');
  });

  it('fallback ke message error', () => {
    expect(resolveActionError(new Error('Network Error'))).toBe('Network Error');
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
  it('render baris + aksi toggle/delete dengan konfirmasi', () => {
    const onToggle = vi.fn();
    const onDelete = vi.fn();
    render(<ModuleTable modules={[moduleSummary]} onToggle={onToggle} onDelete={onDelete} />);

    expect(screen.getByText('demo-module')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'actions.disable' }));
    expect(onToggle).toHaveBeenCalledWith('demo-module', false);
    fireEvent.click(screen.getByRole('button', { name: 'actions.delete' }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'actions.delete' }),
    );
    expect(onDelete).toHaveBeenCalledWith('demo-module');
  });

  it('menonaktifkan aksi saat sibuk', () => {
    render(
      <ModuleTable modules={[moduleSummary]} onToggle={() => {}} onDelete={() => {}} busy />,
    );
    expect(screen.getByRole('button', { name: 'actions.disable' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'actions.delete' })).toBeDisabled();
  });

  it('empty state saat kosong', () => {
    render(<ModuleTable modules={[]} onToggle={() => {}} onDelete={() => {}} />);
    expect(screen.getByText('table.empty')).toBeInTheDocument();
  });
});
