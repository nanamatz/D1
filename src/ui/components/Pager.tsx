import { useI18n } from '../i18n';

export function Pager({
  page,
  pages,
  onPage,
  hideTotal = false,
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
  hideTotal?: boolean;
}) {
  const { t } = useI18n();
  if (pages <= 1) return null;
  const move = (delta: number) => onPage((page + delta + pages) % pages);
  return (
    <div className="pager">
      <button className="car-arrow" aria-label={t('stats.previousPage')} onClick={() => move(-1)}>
        ‹
      </button>
      <span className="pager-label">
        {hideTotal
          ? t('collection.pageUnknown', { n: page + 1 })
          : t('collection.page', { n: page + 1, m: pages })}
      </span>
      <button className="car-arrow" aria-label={t('stats.nextPage')} onClick={() => move(1)}>
        ›
      </button>
    </div>
  );
}
