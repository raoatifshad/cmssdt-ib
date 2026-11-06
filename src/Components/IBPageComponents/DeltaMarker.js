import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import { config } from '../../config';
import { getMultipleFiles } from '../../Utils/ajax';
import { compareNames, getNameFileUrl, getResultNames } from './ibDelta';

const MAX_NAMES = 5;
const MUTED = '#64748b';

// Darker than the sphere colors so this small text stays readable on white.
const TONE_COLORS = {
  bad: '#b91c1c',
  good: '#15803d',
  caution: '#b45309',
  neutral: MUTED
};

const NameGroup = ({ title, color, names }) => {
  if (names.length === 0) return null;
  return (
    <div className="mt-1">
      <div className="fw-semibold" style={{ color }}>{title}</div>
      {names.slice(0, MAX_NAMES).map((item) => <div key={item.key}>{item.label}</div>)}
      {names.length > MAX_NAMES && <div style={{ color: MUTED }}>+{names.length - MAX_NAMES} more</div>}
    </div>
  );
};

// Mounted only while the tooltip is open, so the data files load on hover.
const DeltaNames = ({ delta, resultType, arch, currentIb, previousIb, popper }) => {
  const [names, setNames] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const sides = [
      { ib: currentIb, count: delta.currentCount },
      { ib: previousIb, count: delta.previousCount }
    ];
    // A side with a count of 0 has no names, so its file isn't needed.
    const needed = sides.filter((side) => side.count > 0);

    getMultipleFiles({ fileUrlList: needed.map((side) => getNameFileUrl(resultType, side.ib, arch)) })
      .then((responses) => {
        if (cancelled) return;
        const read = needed.map((side, i) => {
          const result = getResultNames(resultType, delta.nameKind, responses[i]?.data);
          return result && result.count === side.count ? result.names : null;
        });
        if (read.includes(null)) {
          setFailed(true);
          return;
        }
        const namesFor = (side) => (side.count > 0 ? read[needed.indexOf(side)] : []);
        setNames(compareNames(namesFor(sides[0]), namesFor(sides[1])));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [delta, resultType, arch, currentIb, previousIb]);

  useEffect(() => {
    popper?.scheduleUpdate?.();
  }, [names, failed, popper]);

  if (failed) return <div className="mt-1" style={{ color: MUTED }}>Names not available</div>;
  if (!names) return <div className="mt-1" style={{ color: MUTED }}>Loading names…</div>;
  return (
    <>
      <NameGroup title="New" color={TONE_COLORS.bad} names={names.added} />
      <NameGroup title="Fixed" color={TONE_COLORS.good} names={names.removed} />
      <NameGroup title="Still failing" color={MUTED} names={names.kept} />
    </>
  );
};

const DeltaMarker = ({ delta, resultType, arch, currentIb, previousIb, tooltipId }) => (
  <div style={{ marginTop: '2px', lineHeight: 1 }}>
    <OverlayTrigger
      placement="top"
      delay={config.tooltipDelayInMs}
      overlay={(overlayProps) => (
        <Tooltip {...overlayProps} id={tooltipId} className="custom-tooltip p-0">
          <div className="text-start p-2 small" style={{ overflowWrap: 'anywhere' }}>
            <div className="fw-semibold">{delta.change}</div>
            <div style={{ color: MUTED }}>vs {delta.previousName}</div>
            {!delta.isPreviousIb && <div style={{ color: MUTED }}>No results in the IBs in between</div>}
            {delta.nameKind ? (
              <DeltaNames
                delta={delta}
                resultType={resultType}
                arch={arch}
                currentIb={currentIb}
                previousIb={previousIb}
                popper={overlayProps.popper}
              />
            ) : (
              <div className="mt-1" style={{ color: MUTED }}>Open the cell for names</div>
            )}
          </div>
        </Tooltip>
      )}
    >
      <span
        className="d-inline-block"
        aria-label={`${delta.change}, compared with ${delta.previousName}`}
        style={{ color: TONE_COLORS[delta.tone], fontSize: '0.72rem', fontWeight: 700, cursor: 'help', whiteSpace: 'nowrap' }}
      >
        {delta.label}
      </span>
    </OverlayTrigger>
  </div>
);

DeltaMarker.propTypes = {
  delta: PropTypes.object.isRequired,
  resultType: PropTypes.string.isRequired,
  arch: PropTypes.string.isRequired,
  currentIb: PropTypes.object.isRequired,
  previousIb: PropTypes.object.isRequired,
  tooltipId: PropTypes.string.isRequired
};

export default DeltaMarker;
