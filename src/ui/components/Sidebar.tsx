import type { BlindState, RunState } from '../../engine/types';
import type { StagePreview } from '../game';

interface Props {
  run: RunState;
  blind: BlindState;
  preview: StagePreview | null;
  projectedBreakdown: string;
}

function Dots({ total, filled, blue = false }: { total: number; filled: number; blue?: boolean }) {
  return (
    <div className="dots">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={['dot', blue && 'blue', i < filled && 'on'].filter(Boolean).join(' ')} />
      ))}
    </div>
  );
}

const KIND_LABEL = { small: 'SMALL BLIND', big: 'BIG BLIND', boss: 'BOSS BLIND' } as const;

/** Left rail: blind badge, round score, projected, resource dots, gold/ante. */
export function Sidebar({ run, blind, preview, projectedBreakdown }: Props) {
  const beaten = blind.projectedScore >= blind.target;
  const phasesLeft = blind.phasesTotal - blind.phasesUsed;
  // Round-score box previews the staged word's chips × suit multiplier.
  const chips = preview ? preview.chips : 0;
  const mult = preview ? preview.suitMult : 1;

  return (
    <aside className="sidebar">
      <div className="blind-badge">
        <div className="kind">{KIND_LABEL[blind.kind]}</div>
        {blind.bossId && <div className="boss">{blind.bossId}</div>}
        <div className="tlabel">target</div>
        <div className="target">{blind.target}</div>
      </div>

      <div className="panel">
        <div className="label">Staged word</div>
        <div className="scorebox">
          <span className="box c">{chips}</span>
          <span className="x">×</span>
          <span className="box m">{mult}</span>
        </div>
        <div className="label" style={{ marginTop: 10 }}>
          Committed
        </div>
        <div className="committed">{Math.round(blind.committedScore)}</div>

        <div className={['projected', beaten && 'beaten'].filter(Boolean).join(' ')}>
          <div className="label">Projected</div>
          <div className="num">{Math.round(blind.projectedScore)}</div>
          {beaten && <span className="beat">target beaten — cash out open</span>}
          <div className="breakdown">{projectedBreakdown}</div>
        </div>
      </div>

      <div className="panel">
        <div className="label">Phases</div>
        <Dots total={blind.phasesTotal} filled={phasesLeft} />
        <div className="label" style={{ marginTop: 10 }}>
          Exchanges
        </div>
        <Dots total={run.baseExchanges} filled={blind.exchangesLeft} blue />
        <div className="row">
          <span className="money">${run.gold}</span>
          <span className="ante">ANTE {run.ante}/8</span>
        </div>
      </div>
    </aside>
  );
}
