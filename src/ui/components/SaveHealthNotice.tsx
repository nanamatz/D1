import { useSyncExternalStore } from 'react';
import { useI18n } from '../i18n';
import { storageHealthSnapshot, subscribeStorageHealth } from '../storage';

export function SaveHealthNotice() {
  const failure = useSyncExternalStore(
    subscribeStorageHealth,
    storageHealthSnapshot,
    storageHealthSnapshot,
  );
  const { t } = useI18n();
  if (!failure) return null;

  return (
    <div className="save-health-notice" role="alert" aria-live="assertive">
      <strong>{t('system.saveErrorTitle')}</strong>
      <span>{t('system.saveErrorBody')}</span>
    </div>
  );
}
