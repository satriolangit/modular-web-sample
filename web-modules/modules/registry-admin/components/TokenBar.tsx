import { useState } from 'react';
import { Button, Input, Label } from '@arsi/shared';
import { useTranslation } from '@arsi/container';

export function TokenBar({ token, onSave }: { token: string; onSave: (token: string) => void }) {
  const { t } = useTranslation('registry-admin');
  const [value, setValue] = useState(token);

  return (
    <div className="flex items-end gap-2">
      <div className="space-y-1.5">
        <Label htmlFor="registry-admin-token">{t('token.label')}</Label>
        <Input
          id="registry-admin-token"
          type="password"
          placeholder={t('token.placeholder')}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
      <Button type="button" onClick={() => onSave(value)}>
        {t('token.save')}
      </Button>
    </div>
  );
}
