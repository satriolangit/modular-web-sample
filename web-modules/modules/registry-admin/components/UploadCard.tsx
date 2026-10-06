import { useRef, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@arsi/shared';
import { useTranslation } from '@arsi/container';

export function UploadCard({
  onUpload,
  busy = false,
}: {
  onUpload: (file: File) => Promise<void> | void;
  busy?: boolean;
}) {
  const { t } = useTranslation('registry-admin');
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File | undefined) => {
    if (file) void onUpload(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('upload.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            handleFile(event.dataTransfer.files[0]);
          }}
          className={`flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground ${
            dragging ? 'border-primary bg-accent' : 'border-border'
          }`}
        >
          <p>{t('upload.hint')}</p>
          <input
            ref={inputRef}
            aria-label={t('upload.title')}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
          <Button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
            {t('upload.button')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
