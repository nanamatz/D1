import { useState } from 'react';
import { challengeDef, isChallengeId } from '../../engine/challenges';
import { JOKER_REGISTRY } from '../../engine/jokers';
import { POUCH_IDS } from '../../engine/pouches';
import { RECORD_IDS } from '../../engine/records';
import type { PouchId, RecordId, VoucherId } from '../../engine/types';
import { VOUCHER_REGISTRY } from '../../engine/vouchers';
import { jokerDescKey, voucherDescKey } from '../descriptions';
import { jokerArt } from '../jokerArt';
import { mascotVariantArt } from '../mascots';
import { pouchArt } from '../pouchArt';
import { recordArt } from '../recordArt';
import { UNLOCKS } from '../unlocks';
import type { UnlockNotice } from '../unlockRecap';
import { voucherArt } from '../voucherArt';
import { useI18n } from '../i18n';
import type { UseGame } from '../useGame';
import { Tooltip } from './Tooltip';
import { UiIcon } from './UiIcon';
import { VoucherCard } from './VoucherCard';
import { WooDakMascot } from './WooDakMascot';
import { Pager } from './Pager';

interface Props {
  g: UseGame;
  notices: readonly UnlockNotice[];
}

const CARDS_PER_PAGE = 3;

function paletteBodyKey(id: string): string {
  const def = UNLOCKS.find((unlock) => unlock.id === id);
  if (!def) return '';
  if (def.effect.kind === 'color') return `unlock.body.${def.effect.group}`;
  if (def.effect.kind === 'audio') {
    return def.effect.bus === 'music' ? 'unlock.body.music' : 'unlock.body.sound';
  }
  return mascotVariantArt(def.effect.variant) ? 'unlock.body.mascotReady' : 'unlock.body.mascot';
}

export function UnlockRecap({ g, notices }: Props) {
  const { t, lang } = useI18n();
  const [page, setPage] = useState(0);
  const cards = notices.flatMap((notice) => {
    if (notice.category === 'palette') {
      const def = UNLOCKS.find((unlock) => unlock.id === notice.id);
      if (!def) return [];
      const art = def.effect.kind === 'mascot' ? mascotVariantArt(def.effect.variant) : null;
      return [{
        key: `palette:${def.id}`,
        title: def.effect.kind === 'mascot' ? t(`mascot.${def.effect.variant}`) : def.word,
        body: t(paletteBodyKey(def.id)),
        visual: art ? <img className="unlock-recap-mascot" src={art} alt="" /> : (
          <span className={[
            'unlock-recap-swatch',
            def.effect.kind === 'color' ? `sw-${def.effect.group}` : '',
          ].filter(Boolean).join(' ')}>
            {def.effect.kind === 'audio' && (
              <UiIcon name={def.effect.bus === 'music' ? 'music' : 'speaker'} />
            )}
          </span>
        ),
      }];
    }
    if (notice.category === 'emoji') {
      const def = JOKER_REGISTRY.get(notice.id);
      const art = jokerArt(notice.id);
      if (!def || !art) return [];
      return [{
        key: `emoji:${def.id}`,
        title: lang === 'ko' ? def.nameKo : def.nameEn,
        body: t(jokerDescKey(def.id)),
        visual: <img className="unlock-recap-joker" src={art} alt="" />,
      }];
    }
    if (notice.category === 'voucher') {
      const id = notice.id as VoucherId;
      const def = VOUCHER_REGISTRY.get(id);
      if (!def || def.tier !== 'upgrade') return [];
      const name = lang === 'ko' ? def.nameKo : def.nameEn;
      return [{
        key: `voucher:${id}`,
        title: name,
        body: t(voucherDescKey(id)),
        visual: <VoucherCard name={name} artSrc={voucherArt(id)} />,
      }];
    }
    if (notice.category === 'pouch') {
      const id = notice.id as PouchId;
      if (!POUCH_IDS.includes(id) || id === 'yellow') return [];
      return [{
        key: `pouch:${id}`,
        title: t(`pouch.${id}.name`),
        body: t(`pouch.${id}.desc`),
        visual: <img className="unlock-recap-object" src={pouchArt(id)} alt="" />,
      }];
    }
    if (notice.category === 'record') {
      const id = notice.id as RecordId;
      const pouchId = notice.contextId;
      if (!RECORD_IDS.includes(id) || id === 'whiteLp' || !pouchId || !POUCH_IDS.includes(pouchId)) {
        return [];
      }
      return [{
        key: `record:${pouchId}:${id}`,
        title: t(`record.${id}.name`),
        body: `${t(`record.${id}.desc`)}\n${t('unlockRecap.recordContext', {
          pouch: t(`pouch.${pouchId}.name`),
        })}\n${t(`pouch.${pouchId}.desc`)}`,
        visual: (
          <span className="unlock-recap-pair">
            <img src={recordArt(id)} alt="" />
            <img src={pouchArt(pouchId)} alt="" />
          </span>
        ),
      }];
    }
    if (notice.category !== 'challenge' || !isChallengeId(notice.id) || notice.id === 'redPen') {
      return [];
    }
    const def = challengeDef(notice.id);
    return [{
      key: `challenge:${def.id}`,
      title: t(`challenge.${def.id}.name`),
      body: [
        t(`challenge.${def.id}.desc`),
        `${t(`pouch.${def.pouchId}.name`)}: ${t(`pouch.${def.pouchId}.desc`)}`,
        `${t(`record.${def.recordId}.name`)}: ${t(`record.${def.recordId}.desc`)}`,
      ].join('\n'),
      visual: (
        <span className="unlock-recap-pair">
          <img src={pouchArt(def.pouchId)} alt="" />
          <img src={recordArt(def.recordId)} alt="" />
        </span>
      ),
    }];
  });

  if (cards.length === 0) return null;
  const pages = Math.ceil(cards.length / CARDS_PER_PAGE);
  const visiblePage = Math.min(page, pages - 1);
  const visibleCards = cards.slice(
    visiblePage * CARDS_PER_PAGE,
    (visiblePage + 1) * CARDS_PER_PAGE,
  );
  return (
    <div className="overlay gameover-overlay unlock-recap-overlay">
      <WooDakMascot
        stats={g.state.stats}
        won={g.state.gameover?.won === true || g.state.gameover?.endlessComplete === true}
        unlocked={cards.length}
      />
      <div className="overlay-card unlock-recap" role="dialog" aria-modal aria-labelledby="unlock-recap-title">
        <div id="unlock-recap-title" className="go-title">{t('unlockRecap.title')}</div>
        <p>{t('unlockRecap.body')}</p>
        <div className="unlock-recap-grid">
          {visibleCards.map((card) => (
            <Tooltip key={card.key} title={card.title} body={card.body} touchPin>
              <div className="unlock-recap-card" tabIndex={0} aria-label={card.title}>
                <span className="unlock-recap-visual">{card.visual}</span>
                <strong>{card.title}</strong>
              </div>
            </Tooltip>
          ))}
        </div>
        <div className="unlock-recap-pager-slot">
          <Pager page={visiblePage} pages={pages} onPage={setPage} />
        </div>
        <button className="btn gold" onClick={g.acknowledgeUnlocks} autoFocus>
          {t('unlockRecap.confirm')}
        </button>
      </div>
    </div>
  );
}
