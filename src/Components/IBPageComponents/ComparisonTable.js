import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { OverlayTrigger, Table, Tooltip } from "react-bootstrap";
import {
  checkLabelType,
  getAllActiveArchitecturesFromIBGroupByFlavor,
  getDisplayName,
  getInfoFromRelease,
  valueInTheList
} from '../../Utils/processing';
import _ from 'underscore';
import { config, showLabelConfig } from '../../config';
import { useShowArch } from "../../context/ShowArchContext";
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaQuestionCircle,
  FaInfoCircle,
  FaCheck,
  FaTimes,
  FaPlay,
  FaCodeBranch,
  FaTag,
  FaWrench,
  FaTools,
  FaVial,
  FaPlus,
  FaClipboardList,
  FaLayerGroup,
  FaCubes,
  FaCopy
} from 'react-icons/fa';

const { tooltipDelayInMs, urls } = config;

const THEME = {
  primary: '#64748b',
  primaryLight: '#94a3b8',
  primaryDark: '#475569',
  secondary: '#64748b',
  success: '#5EB85E',
  successLight: '#79C779',
  successDark: '#3E9A3E',
  warning: '#f59e0b',
  warningLight: '#fbbf24',
  warningDark: '#d97706',
  danger: '#ef4444',
  dangerLight: '#f87171',
  dangerDark: '#dc2626',
  info: '#3b82f6',
  infoLight: '#60a5fa',
  infoDark: '#2563eb',
  dark: '#1e293b',
  light: '#f8fafc',
  border: '#e2e8f0',
  borderDark: '#cbd5e1',
  hover: '#f1f5f9',
  text: {
    primary: '#0f172a',
    secondary: '#475569',
    muted: '#64748b',
    light: '#f8fafc'
  }
};

const sphereStyles = {
  sphere: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '30px',
    height: '30px',
    borderRadius: '50%',
    padding: '0 7px',
    color: 'white',
    fontSize: '0.78rem',
    fontWeight: 700,
    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.2)',
    position: 'relative',
  },
  sphereSuccess: {
    background: `radial-gradient(circle at 30% 25%, ${THEME.successLight} 0%, ${THEME.success} 50%, ${THEME.successDark} 90%)`,
    boxShadow: '0 4px 10px -2px rgba(16, 185, 129, 0.4), inset 0 -3px 0 rgba(0,0,0,0.2)',
  },
  sphereDanger: {
    background: `radial-gradient(circle at 30% 25%, ${THEME.dangerLight} 0%, ${THEME.danger} 50%, ${THEME.dangerDark} 90%)`,
    boxShadow: '0 4px 10px -2px rgba(239, 68, 68, 0.4), inset 0 -3px 0 rgba(0,0,0,0.2)',
  },
  sphereWarning: {
    background: `radial-gradient(circle at 30% 25%, ${THEME.warningLight} 0%, ${THEME.warning} 50%, ${THEME.warningDark} 90%)`,
    boxShadow: '0 4px 10px -2px rgba(245, 158, 11, 0.4), inset 0 -3px 0 rgba(0,0,0,0.2)',
  },
  sphereSecondary: {
    background: `radial-gradient(circle at 30% 25%, #9ca3af 0%, ${THEME.secondary} 50%, #4b5563 90%)`,
    boxShadow: '0 4px 10px -2px rgba(100, 116, 139, 0.4), inset 0 -3px 0 rgba(0,0,0,0.2)',
  },
  sphereInfo: {
    background: `radial-gradient(circle at 30% 25%, ${THEME.infoLight} 0%, ${THEME.info} 50%, ${THEME.infoDark} 90%)`,
    boxShadow: '0 4px 10px -2px rgba(59, 130, 246, 0.4), inset 0 -3px 0 rgba(0,0,0,0.2)',
  },
  sphereHover: {
    transform: 'translateY(-2px) scale(1.06)',
  },
  sphereGlow: {
    position: 'absolute',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    borderRadius: '50%',
    background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 60%)',
    pointerEvents: 'none',
  },
  sphereReflection: {
    position: 'absolute',
    top: '10%',
    left: '10%',
    width: '30%',
    height: '30%',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 80%)',
    pointerEvents: 'none',
  }
};

const FLAVOR_CARDS = Array.from({ length: 6 }).map(() => ({
  bg: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
  text: '#ffffff',
  border: '#334155',
  shadow: '0 2px 4px -2px rgba(0,0,0,0.1)'
}));

const statusStyles = {
  success: {
    sphereStyle: sphereStyles.sphereSuccess,
    sphereIcon: <FaCheck size={12} />,
    description: 'All tests passed successfully',
  },
  danger: {
    sphereStyle: sphereStyles.sphereDanger,
    sphereIcon: <FaTimes size={12} />,
    description: 'Build or tests failed',
  },
  warning: {
    sphereStyle: sphereStyles.sphereWarning,
    sphereIcon: <FaExclamationTriangle size={12} />,
    description: 'Warnings detected',
  },
  secondary: {
    sphereStyle: sphereStyles.sphereSecondary,
    sphereIcon: <FaQuestionCircle size={12} />,
    description: 'Status unknown',
  },
  info: {
    sphereStyle: sphereStyles.sphereInfo,
    sphereIcon: <FaPlay size={12} />,
    description: 'Tests in progress',
  }
};

const rowLabelConfig = {
  builds: { text: 'Builds', icon: <FaCubes size={12} /> },
  utests: { text: 'Unit', icon: <FaVial size={12} /> },
  relvals: { text: 'RelVal', icon: <FaLayerGroup size={12} /> },
  addons: { text: 'AddOn', icon: <FaPlus size={12} /> },
  dupDict: { text: 'Q/A', icon: <FaClipboardList size={12} /> }
};

const checkIfItIsAPatch = (current_tag, architecture, tagName) => {
  const intendedTagName1 = `IB/${current_tag}/${architecture}`;
  const intendedTagName2 = `ERR/${current_tag}/${architecture}`;
  return tagName !== intendedTagName1 && tagName !== intendedTagName2;
};

const removeKeysFromDetails = (details, keysToRemove = []) => {
  if (!details || typeof details !== 'object') return details;
  const filtered = { ...details };
  keysToRemove.forEach((key) => {
    delete filtered[key];
  });
  return filtered;
};

const formatFlavorLabel = (value) => getDisplayName(value).replace(/_X$/, '');

function makeSafeId(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '-');
}

function renderStickyRowLabel(typeKey, color = THEME.text.primary) {
  const cfg = rowLabelConfig[typeKey];
  if (!cfg) return null;

  return (
    <>
      <span className="type-label-desktop">{cfg.text}</span>
      <span className="type-label-mobile" style={{ color }} title={cfg.text}>
        {cfg.icon}
      </span>
    </>
  );
}

const ArchTooltip = ({ cmsdistTag, isPatch, baseTag }) => (
  <div className="text-start p-3" style={{ minWidth: '280px' }}>
    <div className="d-flex align-items-center border-bottom pb-2 mb-2">
      <FaCodeBranch className="text-primary me-2" size={16} />
      <span className="fw-semibold">CMSDist Tag Information</span>
    </div>

    <div className="mb-3">
      <div className="d-flex align-items-center mb-1">
        <FaTag className="text-secondary me-2" size={12} />
        <span className="text-muted small fw-semibold">Current Tag:</span>
      </div>
      <code className="bg-light p-2 rounded d-block small" style={{ fontFamily: 'monospace' }}>
        {cmsdistTag || 'N/A'}
      </code>
    </div>

    {isPatch ? (
      <div className="mb-2">
        <div className="d-flex align-items-center mb-1">
          <FaExclamationTriangle className="text-warning me-2" size={12} />
          <span className="text-muted small fw-semibold">Patch Build:</span>
        </div>
        <div className="bg-warning bg-opacity-10 p-2 rounded small">
          Using same cmsdist tag as <code className="bg-light px-1 rounded">{baseTag}</code>
        </div>
      </div>
    ) : (
      <div className="mb-2">
        <div className="d-flex align-items-center mb-1">
          <FaCheckCircle className="text-success me-2" size={12} />
          <span className="text-muted small fw-semibold">Full Build:</span>
        </div>
        <div className="bg-success bg-opacity-10 p-2 rounded small">
          Using a dedicated cmsdist tag for this build
        </div>
      </div>
    )}
  </div>
);

const StatusTooltip = ({ status, value, details, type }) => {
  const style = statusStyles[status] || statusStyles.secondary;

  const formatValue = (val) => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val);
      } catch {
        return '[Complex Data]';
      }
    }
    return String(val);
  };

  return (
    <div className="text-start p-3" style={{ minWidth: '250px' }}>
      <div className="d-flex align-items-center border-bottom pb-2 mb-2">
        <div style={{ ...sphereStyles.sphere, ...style.sphereStyle, width: '24px', height: '24px' }}>
          {style.sphereIcon}
        </div>
        <span className="fw-semibold ms-2">{type || 'Status'} Information</span>
      </div>

      <div className="mb-2">
        <div className="d-flex align-items-center mb-1">
          <FaInfoCircle className="text-info me-2" size={12} />
          <span className="text-muted small fw-semibold">Current Status:</span>
        </div>
        <div className="d-flex align-items-center mt-1">
          <div
            style={{
              ...sphereStyles.sphere,
              ...style.sphereStyle,
              width: '28px',
              height: '28px',
              marginRight: '8px'
            }}
          >
            {style.sphereIcon}
          </div>
          <span className="small">{style.description}</span>
        </div>
      </div>

      {details && Object.keys(details).length > 0 && (
        <div className="mb-2">
          <div className="d-flex align-items-center mb-1">
            <span className="text-muted small fw-semibold">Details:</span>
          </div>
          <div className="bg-light p-2 rounded small">
            {Object.entries(details).map(([key, val]) => {
              if (val && typeof val === 'object' && Object.keys(val).length === 0) return null;
              return (
                <div key={key} className="d-flex justify-content-between mb-1">
                  <span className="text-muted">{key}:</span>
                  <span className="fw-semibold ms-2" style={{ wordBreak: 'break-word', maxWidth: '150px' }}>
                    {formatValue(val)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

function renderTooltip(cellContent, tooltipContent, tooltipId = 'tooltip-status') {
  return (
    <OverlayTrigger
      placement="top"
      overlay={<Tooltip id={tooltipId} className="custom-tooltip p-0">{tooltipContent}</Tooltip>}
      delay={tooltipDelayInMs}
    >
      <span className="d-inline-block">{cellContent}</span>
    </OverlayTrigger>
  );
}

function renderSphere({ status = "secondary", value, icon, link, tooltipContent, details, type, tooltipId } = {}) {
  const style = statusStyles[status] || statusStyles.secondary;
  const displayValue = value !== undefined ? value : '';

  if (displayValue === 0 || displayValue === '') return null;

  const hasNumericValue =
    typeof displayValue === 'number' ||
    (typeof displayValue === 'string' && /\d/.test(displayValue));

  const resolvedIcon = hasNumericValue
    ? null
    : (icon === null ? null : (icon || style.sphereIcon));

  const sphereContent = (
    <div
      className={`enhanced-sphere ${status === 'success' ? 'sphere-success' : ''}`}
      style={{
        ...sphereStyles.sphere,
        ...style.sphereStyle,
        minWidth: String(displayValue).length > 2 ? '36px' : '30px',
        width: 'auto',
        borderRadius: '50%',
      }}
      onMouseEnter={(e) => {
        Object.assign(e.currentTarget.style, sphereStyles.sphereHover);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0) scale(1)';
      }}
    >
      <div style={sphereStyles.sphereGlow} />
      <div style={sphereStyles.sphereReflection} />
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center' }}>
        {resolvedIcon}
        <span className={resolvedIcon ? 'ms-1' : ''}>{displayValue}</span>
      </div>
    </div>
  );

  const enhancedTooltip = tooltipContent || (
    <StatusTooltip
      status={status}
      value={displayValue}
      details={details ? { ...details } : {}}
      type={type}
    />
  );

  const wrappedContent = link ? (
    <a href={link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
      {sphereContent}
    </a>
  ) : sphereContent;

  return renderTooltip(
    wrappedContent,
    enhancedTooltip,
    tooltipId || `tooltip-${makeSafeId(type)}-${makeSafeId(displayValue)}`
  );
}

const getBuildOrUnitUrl = ({ file, arch, ibName, urlParameter = '' }) => {
  if (!file) return undefined;
  if (file === 'not-ready') return urls.scramDetailUrl + arch + ";" + ibName;
  const linkParts = file.split('/').slice(4, 9);
  return urls.buildOrUnitTestUrl + linkParts.join('/') + urlParameter;
};

const getRelValUrl = ({ file, arch, ibName, selectedStatus }) => {
  if (!file) return undefined;
  if (file === 'not-ready') return urls.relVals + arch + ';' + ibName;
  const [, que, flavor, date] = getInfoFromRelease(ibName);
  return urls.newRelValsSpecific(que, date, flavor, arch, selectedStatus);
};

const getOtherTestUrl = ({ file }) => {
  const linkParts = file.split('/').slice(4, 9);
  return urls.showAddOnLogsUrls + linkParts.join('/') + '/addOnTests/';
};

const statusIcons = {
  success: <FaCheck className="me-1" size={10} />,
  danger: <FaTimes className="me-1" size={10} />,
  warning: null,
  secondary: <FaQuestionCircle className="me-1" size={10} />,
  info: <FaPlay className="me-1" size={10} />
};

const copyText = (text) => {
  if (!text) return;

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(textArea);
  }
};

// Accent for the one column a shifter jumped to from a chat mention (see ChatWidget.js's
// click delegation). Deliberately THEME.info's blue rather than a severity color (danger/
// warning/success already mean something specific everywhere else on this page) or plain
// grey (THEME.secondary/THEME.primaryLight - the same grey this table already falls back to
// for any arch-part token it has no color for, e.g. "aarch64"/"gcc15" - reusing it for
// "selected" made a real selection visually indistinguishable from an unrelated existing
// arch cell, per the design review screenshot). Blue instead ties into the same "this is the
// active thing" language the release-cycle pill in Navigation.js already uses.
const HIGHLIGHT_ACCENT = '#2563eb';
const HIGHLIGHT_BG = 'rgba(37, 99, 235, 0.14)';
const HIGHLIGHT_GLOW = `0 0 0 3px rgba(37, 99, 235, 0.25), 0 4px 10px -2px rgba(37, 99, 235, 0.45)`;

const ComparisonTable = ({ data = [], releaseQue, highlightTarget = null }) => {
  const [copiedText, setCopiedText] = useState(null);
  const { getActiveArchsForQue = () => [], getColorsSchemeForQue = () => ({}) } = useShowArch();

  const handleCopy = (e, text) => {
    e.preventDefault();
    e.stopPropagation();

    copyText(text);
    setCopiedText(text);

    setTimeout(() => {
      setCopiedText(null);
    }, 1500);
  };

  const activeArchs = getActiveArchsForQue(releaseQue);
  const archColorScheme = getColorsSchemeForQue(releaseQue);

  const { que, date } = useMemo(() => {
    if (data[0]) {
      const [, q, , d] = getInfoFromRelease(data[0].release_name);
      return { que: q, date: d };
    }
    return {};
  }, [data]);

  const archsByIb = useMemo(
    () => getAllActiveArchitecturesFromIBGroupByFlavor(data, activeArchs),
    [data, activeArchs]
  );

  // Resolves a chat-originated highlight request (que/date/flavor/arch - see ChatWidget.js)
  // against THIS table's own release+date. `item.flavor` (from getAllActiveArchitecturesFrom
  // IBGroupByFlavor) is the full "<que>_<flavor>" release-queue string (e.g.
  // "CMSSW_20_1_ASAN_X"), exactly what `${que}_${highlightTarget.flavor}` reconstructs since
  // highlightTarget.flavor is the same internal flavor token getInfoFromRelease returns (e.g.
  // "ASAN_X", or "X" for primary) - so no separate lookup table is needed to bridge the two.
  const highlightMatch = useMemo(() => {
    if (!highlightTarget || highlightTarget.que !== que || highlightTarget.date !== date) return null;
    return { flavorKey: `${que}_${highlightTarget.flavor}`, arch: highlightTarget.arch };
  }, [highlightTarget, que, date]);

  // This table can be wider than the viewport (a flavor group per column-group, several
  // architectures each) with its own horizontal scroll (Card.Body's overflowX: 'auto' in
  // IBGroupFrame.js) - vertically scrolling the right date-block into view (IBGroups.js's
  // existing scrollToGroup) says nothing about whether the matched column is scrolled into
  // view horizontally, so that's handled here instead, local to the one table that has it.
  const highlightedColRef = useRef(null);
  useEffect(() => {
    if (highlightMatch && highlightedColRef.current) {
      highlightedColRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [highlightMatch]);

  // One entry per real column this table renders, in the exact order the header rows and
  // every body row (renderRowCells, plus the hand-rolled builds row) all iterate archsByIb -
  // needed to paint the WHOLE matched column, header down through every metric row, via a
  // <colgroup> rather than threading the highlight through renderCell/renderRowCells/
  // showGeneralResults/showRelValsResults (many call sites, none of which set a `<td>`
  // background of their own - confirmed by reading renderCell - so a <col> background paints
  // straight through to every cell in that column for free, header-only highlighting alone
  // was too easy to miss in a wide table with a dozen+ flavor groups).
  const flattenedColumns = useMemo(
    () => archsByIb.flatMap((item, pos) => (item.archs || []).map((arch) => ({ pos, arch, flavor: item.flavor }))),
    [archsByIb]
  );

  // Moved in from module scope (was a plain top-level function) so it can close over
  // highlightMatch/archsByIb - the one thing every body cell in this table renders through
  // (every renderRowCells branch, showGeneralResults, showRelValsResults, and the hand-rolled
  // builds row all end here), so it's the one place that can paint the matched column's cells
  // without threading highlight state through each of those call sites individually. `key` is
  // always `${resultType}-${pos}-${arch}[-suffix]` (confirmed by reading every call site) -
  // arch strings use underscores, never hyphens, so splitting on "-" reliably recovers pos/
  // arch.
  //
  // The column edges are drawn with inset box-shadows, not a real `border` - every cell in
  // this table already carries a stylesheet `!important` border (see the <style> block below:
  // `.table > :not(caption) > * > * { border: 1px solid ... !important }`), and an
  // `!important` author rule always beats a plain inline style, inline or not, regardless of
  // specificity - a plain inline `borderLeft`/`borderRight` here would just silently lose. A
  // box-shadow is an unrelated property that rule never touches, so it always shows.
  // Also brightens the row-to-row divider (inset top/bottom) - the existing `!important`
  // border is a light grey, and light grey on top of a light blue tint has too little
  // contrast to still read as a row boundary, which is what made a highlighted column look
  // like one solid block instead of 5 separate rows.
  const renderCell = (cellInfo, key) => {
    const [, posStr, archStr] = key.split('-');
    const pos = Number(posStr);
    const isHighlighted =
      !!highlightMatch && archsByIb[pos]?.flavor === highlightMatch.flavorKey && archStr === highlightMatch.arch;

    return (
      <td
        key={key}
        className="align-middle p-1"
        style={{
          textAlign: 'center',
          verticalAlign: 'middle',
          backgroundColor: isHighlighted ? HIGHLIGHT_BG : undefined,
          boxShadow: isHighlighted
            ? `inset 3px 0 0 0 ${HIGHLIGHT_ACCENT}, inset -3px 0 0 0 ${HIGHLIGHT_ACCENT}, inset 0 1px 0 0 rgba(255,255,255,0.9), inset 0 -1px 0 0 rgba(255,255,255,0.9)`
            : undefined
        }}
      >
        {cellInfo}
      </td>
    );
  };

  const renderRowCells = ({ resultType, ifWarning, ifError, ifFailed, ifPassed, ifUnknown }) => {
    return data.map((ib, pos) => {
      const el = archsByIb[pos];

      return (el?.archs || []).map((arch) => {
        const cellKey = `${resultType}-${pos}-${arch}`;
        const results = _.findWhere(ib[resultType] || [], { arch });

        if (!results) return renderCell(<span className="text-muted">—</span>, `${cellKey}-missing`);

        if (_.isEmpty(results)) {
          return renderCell(
            renderSphere({
              status: 'secondary',
              icon: <FaQuestionCircle />,
              value: '?',
              type: resultType,
              details: { status: 'No data available' },
              tooltipId: `${cellKey}-tooltip-empty`
            }) || <span className="text-muted">—</span>,
            `${cellKey}-empty`
          );
        }

        switch (results.passed) {
          case true:
          case "passed":
            return ifPassed
              ? ifPassed(results, ib.release_name, cellKey)
              : renderCell(
                  renderSphere({
                    status: 'success',
                    icon: <FaCheck />,
                    value: results.details?.num_passed || '✓',
                    type: resultType,
                    details: results.details,
                    tooltipId: `${cellKey}-tooltip-passed`
                  }) || <span className="text-muted">—</span>,
                  `${cellKey}-passed`
                );

          case false:
          case "error":
            return ifError
              ? ifError(results, ib.release_name, cellKey)
              : renderCell(
                  renderSphere({
                    status: 'danger',
                    icon: <FaTimes />,
                    value: results.details?.num_errors || '✗',
                    type: resultType,
                    details: results.details,
                    tooltipId: `${cellKey}-tooltip-error`
                  }) || <span className="text-muted">—</span>,
                  `${cellKey}-error`
                );

          case "failed":
            return ifFailed
              ? ifFailed(results, ib.release_name, cellKey)
              : renderCell(
                  renderSphere({
                    status: 'danger',
                    icon: <FaTimes />,
                    value: results.details?.num_fails || '!',
                    type: resultType,
                    details: results.details,
                    tooltipId: `${cellKey}-tooltip-failed`
                  }) || <span className="text-muted">—</span>,
                  `${cellKey}-failed`
                );

          case "warning":
            return ifWarning
              ? ifWarning(results, ib.release_name, cellKey)
              : renderCell(
                  renderSphere({
                    status: 'warning',
                    icon: null,
                    value: results.details?.num_warnings || '⚠',
                    type: resultType,
                    details: results.details,
                    tooltipId: `${cellKey}-tooltip-warning`
                  }) || <span className="text-muted">—</span>,
                  `${cellKey}-warning`
                );

          case "unknown":
            return ifUnknown
              ? ifUnknown(arch, ib, cellKey)
              : renderCell(
                  renderSphere({
                    status: 'secondary',
                    icon: <FaQuestionCircle />,
                    value: ' ',
                    type: resultType,
                    details: { status: 'Unknown' },
                    tooltipId: `${cellKey}-tooltip-unknown`
                  }) || <span className="text-muted">—</span>,
                  `${cellKey}-unknown`
                );

          default:
            return renderCell(<span className="text-muted">—</span>, `${cellKey}-default`);
        }
      });
    });
  };

  const showGeneralResults = (
    labelConfigArray = [],
    getUrl,
    urlParameter = '',
    tooltipOptions = {}
  ) => (result, ib, cellKey = `${result?.arch || 'arch'}-${ib || 'ib'}`) => {
    const { details, done } = result;
    if (!details) return renderCell(<span className="text-muted">—</span>, `${cellKey}-no-details`);

    const resultKeys = Object.keys(details);
    let labelConfig = { value: 0, colorType: 'secondary' };

    for (let el of labelConfigArray) {
      el.groupFields.forEach((predicate) => {
        if (typeof predicate === "function") {
          resultKeys.forEach((key) => {
            if (predicate(key)) labelConfig.value += details[key] * 1;
          });
        } else {
          if (valueInTheList(resultKeys, predicate)) labelConfig.value += details[predicate] * 1;
        }
      });
      if (labelConfig.value > 0) {
        labelConfig.colorType = el.color;
        break;
      }
    }

    if (labelConfig.value === 0) return renderCell(<span className="text-muted">—</span>, `${cellKey}-zero`);
    if (done === false) labelConfig.value = `${labelConfig.value}*`;

    const status = labelConfig.colorType === 'danger'
      ? 'danger'
      : labelConfig.colorType === 'warning'
        ? 'warning'
        : labelConfig.colorType === 'success'
          ? 'success'
          : 'secondary';

    let resultType = 'Build';
    if (getUrl === getOtherTestUrl) resultType = 'Other Tests';

    const tooltipDetails = tooltipOptions.hideFile
      ? removeKeysFromDetails(details, ['file'])
      : details;

    const cell = renderSphere({
      status,
      icon: statusIcons[status],
      value: labelConfig.value,
      details: tooltipDetails,
      type: resultType,
      link: getUrl({ file: result.file, arch: result.arch, ibName: ib, urlParameter }),
      tooltipId: `${cellKey}-tooltip-general`
    });

    return renderCell(cell || <span className="text-muted">—</span>, `${cellKey}-general`);
  };

  const showRelValsResults = (labelConfigArray = [], getUrl) => (result, ib, cellKey = `${result?.arch || 'arch'}-${ib || 'ib'}`) => {
    const { details, done } = result;
    const labelConfig = checkLabelType(labelConfigArray, details) || {
      value: 0,
      colorType: "secondary"
    };

    if (labelConfig.value === 0) return renderCell(<span className="text-muted">—</span>, `${cellKey}-zero`);
    if (done === false) labelConfig.value += '*';

    let selectedStatus = '';
    switch (labelConfig.colorType) {
      case "danger":
        selectedStatus = "&selectedStatus=failed";
        break;
      case "warning":
        selectedStatus = "&selectedFlavors=X&selectedStatus=failed&selectedStatus=known_failed";
        break;
      case "success":
        selectedStatus = "&selectedFlavors=X&selectedStatus=failed&selectedStatus=known_failed&selectedStatus=passed";
        break;
      default:
        break;
    }

    const status = labelConfig.colorType === 'danger'
      ? 'danger'
      : labelConfig.colorType === 'warning'
        ? 'warning'
        : labelConfig.colorType === 'success'
          ? 'success'
          : 'secondary';

    const cell = renderSphere({
      status,
      icon: statusIcons[status],
      value: labelConfig.value,
      details,
      type: 'RelVal',
      link: getUrl({ file: result.file, arch: result.arch, ibName: ib, selectedStatus }),
      tooltipId: `${cellKey}-tooltip-relval`
    });

    return renderCell(cell || <span className="text-muted">—</span>, `${cellKey}-relval`);
  };

  const shouldShowRow = (resultType) => {
    return data.reduce((sum, ib, pos) => {
      const el = archsByIb[pos] || {};
      const count = (el.archs || [])
        .map((arch) => (_.findWhere(ib[resultType] || [], { arch }) ? 1 : 0))
        .reduce((a, b) => a + b, 0);
      return sum + count;
    }, 0) > 0;
  };

  return (
    <div className="container-fluid px-0">
      <div className="ib-table-frame">
        <div
          className="table-responsive ib-table-responsive"
          style={{
            borderRadius: '8px',
            border: `1px solid ${THEME.borderDark}`,
            overflowX: 'auto',
            overflowY: 'hidden',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <style>
            {`
              .table {
                border-collapse: collapse !important;
                width: 100% !important;
                table-layout: auto !important;
              }

              .table > :not(caption) > * > * {
                padding: 0.30rem 0.18rem !important;
                border: 1px solid ${THEME.borderDark} !important;
              }

              .table thead th {
                border: 1px solid ${THEME.borderDark} !important;
                vertical-align: middle;
              }

              .table tbody tr:hover {
                background-color: ${THEME.hover};
              }

              .name-column {
                position: sticky;
                left: 0;
                background-color: ${THEME.light};
                z-index: 10;
                border-right: 2px solid ${THEME.borderDark} !important;
                font-weight: 700;
                width: 78px;
                min-width: 78px;
                text-align: center;
              }

              .type-label-mobile,
              .type-header-mobile {
                display: none;
              }

              .type-label-desktop,
              .type-header-desktop {
                display: inline-flex;
                align-items: center;
                justify-content: center;
              }

              .table thead tr:first-child th {
                background: ${THEME.light};
                border-bottom: 2px solid ${THEME.primary} !important;
              }

              .table thead tr:last-child th {
                background: ${THEME.light};
              }

              .custom-tooltip .tooltip-inner {
                background-color: white;
                color: ${THEME.text.primary};
                border: 1px solid ${THEME.border};
                box-shadow: 0 10px 25px -5px rgba(0,0,0,0.2);
                max-width: 350px;
                border-radius: 12px;
                padding: 0;
                opacity: 1 !important;
              }

              .custom-tooltip {
                opacity: 1 !important;
              }

              .custom-tooltip .tooltip-arrow::before {
                border-top-color: white !important;
              }

              .arch-stack-item {
                padding: 5px 10px;
                color: white;
                font-size: 0.85rem;
                font-weight: 800;
                text-align: center;
                border-bottom: 1px solid rgba(255,255,255,0.2);
                white-space: nowrap;
                line-height: 1.1;
              }

              .arch-stack-item:last-child {
                border-bottom: none;
              }

              .sphere-success svg {
                color: #ffffff !important;
                fill: #ffffff !important;
              }

              .enhanced-sphere svg {
                fill: currentColor;
              }

              .flavor-card-wrapper {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
              }

              .flavor-copy-button {
                opacity: 0;
                border: none;
                background: transparent;
                color: #475569;
                padding: 0;
                display: inline-flex;
                align-items: center;
                cursor: pointer;
              }

              .flavor-card-wrapper:hover .flavor-copy-button {
                opacity: 1;
              }

              .ib-highlight-col {
                animation: ib-highlight-pulse 1.4s ease-out 1;
              }

              @keyframes ib-highlight-pulse {
                0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.55); }
                70% { box-shadow: 0 0 0 12px rgba(37, 99, 235, 0); }
                100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
              }

              @media (max-width: 768px) {
                .name-column {
                  width: 42px !important;
                  min-width: 42px !important;
                  padding: 0.2rem 0.1rem !important;
                }

                .type-label-desktop,
                .type-header-desktop {
                  display: none !important;
                }

                .type-label-mobile,
                .type-header-mobile {
                  display: inline-flex !important;
                  align-items: center;
                  justify-content: center;
                }

                .name-column svg {
                  font-size: 0.9rem;
                }

                .arch-stack-item {
                  padding: 4px 6px;
                  font-size: 0.78rem;
                }
              }
            `}
          </style>

          <Table
            striped={false}
            bordered
            hover
            className="mb-0 align-middle"
            style={{ fontSize: '0.78rem' }}
          >
            <colgroup>
              <col />
              {flattenedColumns.map(({ pos, arch, flavor }) => (
                <col
                  key={`col-${pos}-${arch}`}
                  style={{
                    backgroundColor:
                      highlightMatch && flavor === highlightMatch.flavorKey && arch === highlightMatch.arch
                        ? HIGHLIGHT_BG
                        : undefined
                  }}
                />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="name-column" rowSpan={2} style={{ verticalAlign: 'middle' }}>
                  <div className="d-flex align-items-center justify-content-center h-100">
                    <span className="type-header-desktop fw-bold text-uppercase" style={{ fontSize: '0.8rem' }}>
                      Type
                    </span>
                    <span className="type-header-mobile fw-bold text-uppercase" style={{ fontSize: '0.7rem' }} />
                  </div>
                </th>

                {archsByIb.map((item, pos) => {
                  if (!item.archs?.length) return null;

                  const flavorLabel = formatFlavorLabel(item.flavor);
                  const releaseNameToCopy = item.current_tag || data[pos]?.release_name || '';

                  const flavorLink = releaseNameToCopy
                    ? `https://github.com/cms-sw/cmssw/tree/${releaseNameToCopy}`
                    : null;

                  const isFlavorHighlighted =
                    !!highlightMatch && item.flavor === highlightMatch.flavorKey && item.archs.includes(highlightMatch.arch);

                  // Every flavor badge otherwise renders identically (FLAVOR_CARDS[0], the
                  // same slate gradient for all of them - there's only one entry in that
                  // array). The matched one gets recolored blue instead of just the
                  // underline below - the underline alone reads as "look further down", the
                  // badge itself changing color is what actually catches the eye scanning a
                  // row of a dozen identical grey pills.
                  const flavorCardStyle = {
                    background: isFlavorHighlighted ? `linear-gradient(135deg, #3b82f6 0%, ${HIGHLIGHT_ACCENT} 100%)` : FLAVOR_CARDS[0].bg,
                    color: FLAVOR_CARDS[0].text,
                    padding: '4px 8px',
                    borderRadius: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    margin: '0 auto',
                    cursor: flavorLink ? 'pointer' : 'default',
                    boxShadow: isFlavorHighlighted ? HIGHLIGHT_GLOW : undefined
                  };

                  return (
                    <th
                      key={`flavor-${pos}-${item.flavor}`}
                      colSpan={item.archs.length}
                      style={{
                        textAlign: 'center',
                        padding: '6px 2px',
                        backgroundColor: THEME.light,
                        // An inset shadow, not a real border - the stylesheet below has its
                        // own `!important` bottom-border rule on every cell in this header
                        // row (`.table thead tr:first-child th`), which would otherwise win
                        // over a plain inline border. Kept as a thin underline rather than a
                        // full fill: this spans the WHOLE flavor group (colSpan), and a solid
                        // fill here reads as "the entire group is selected", when really only
                        // one architecture within it is - see the arch-level `<th>` below for
                        // the actual, precise highlight.
                        boxShadow: isFlavorHighlighted ? `inset 0 -4px 0 0 ${HIGHLIGHT_ACCENT}` : undefined
                      }}
                    >
                      <div className="flavor-card-wrapper">
                        {flavorLink ? (
                          <a
                            href={flavorLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ textDecoration: 'none', display: 'inline-block' }}
                            title={`Open ${releaseNameToCopy}`}
                          >
                            <div className="flavor-card" style={flavorCardStyle}>
                              {flavorLabel}
                            </div>
                          </a>
                        ) : (
                          <div className="flavor-card" style={flavorCardStyle} title={flavorLabel}>
                            {flavorLabel}
                          </div>
                        )}

                        {releaseNameToCopy && (
                          <button
                            type="button"
                            className="flavor-copy-button"
                            title={copiedText === releaseNameToCopy ? 'Copied!' : `Copy ${releaseNameToCopy}`}
                            aria-label={copiedText === releaseNameToCopy ? 'Copied!' : `Copy ${releaseNameToCopy}`}
                            onClick={(e) => handleCopy(e, releaseNameToCopy)}
                          >
                            {copiedText === releaseNameToCopy ? <FaCheck size={11} /> : <FaCopy size={11} />}
                          </button>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>

              <tr>
                {archsByIb.map((item, pos) => (item.archs || []).map((arch) => {
                  let link = null;
                  let isPatch = false;
                  let baseTag = '';

                  const { cmsdistTags, current_tag } = item;
                  const cmsdistTag = cmsdistTags?.[arch];

                  if (cmsdistTag && cmsdistTag !== "Not Found") {
                    link = urls.commits + cmsdistTag;
                    isPatch = checkIfItIsAPatch(current_tag, arch, cmsdistTag);
                    if (isPatch) {
                      baseTag = cmsdistTag.replace('IB/', '').replace(`/${arch}`, '');
                    }
                  }

                  const archParts = arch.split("_");

                  const buildTypePrefixIcon = cmsdistTag && cmsdistTag !== "Not Found"
                    ? (
                        isPatch
                          ? <FaTools size={15} style={{ color: '#facc15', marginRight: '6px' }} />
                          : <FaWrench size={15} style={{ marginRight: '6px' }} />
                      )
                    : null;

                  const archStack = (
                    <div className="arch-stack">
                      {archParts.map((str, idx) => {
                        const backgroundColor = archColorScheme[str] || THEME.secondary;
                        const isFirstRow = idx === 0;

                        return (
                          <div key={`${arch}-${str}-${idx}`} className="arch-stack-item" style={{ backgroundColor }}>
                            <strong
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {isFirstRow && buildTypePrefixIcon}
                              {str}
                            </strong>
                          </div>
                        );
                      })}
                    </div>
                  );

                  const cellContent = link ? (
                    <OverlayTrigger
                      placement="top"
                      overlay={
                        <Tooltip id={`arch-tooltip-${pos}-${makeSafeId(arch)}`} className="custom-tooltip">
                          <ArchTooltip cmsdistTag={cmsdistTag} isPatch={isPatch} baseTag={baseTag} />
                        </Tooltip>
                      }
                      delay={tooltipDelayInMs}
                    >
                      <a href={link} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                        {archStack}
                      </a>
                    </OverlayTrigger>
                  ) : (
                    <div>{archStack}</div>
                  );

                  const isArchHighlighted = !!highlightMatch && item.flavor === highlightMatch.flavorKey && arch === highlightMatch.arch;

                  return (
                    <th
                      key={`arch-${pos}-${arch}`}
                      ref={isArchHighlighted ? highlightedColRef : undefined}
                      className={isArchHighlighted ? 'ib-highlight-col' : undefined}
                      style={{
                        padding: '3px 2px',
                        backgroundColor: isArchHighlighted ? HIGHLIGHT_BG : THEME.light,
                        // Not a `border` - every cell here already carries a stylesheet
                        // `!important` border (see the shared <style> block below), which
                        // always beats a plain inline border regardless of specificity. The
                        // glow's `0 0 0 3px` ring is what actually reads as this cell's outline.
                        boxShadow: isArchHighlighted ? HIGHLIGHT_GLOW : undefined,
                        minWidth: '72px'
                      }}
                    >
                      {cellContent}
                    </th>
                  );
                }))}
              </tr>
            </thead>

            <tbody>
              {shouldShowRow("builds") && (
                <tr>
                  <td className="name-column fw-semibold">
                    {renderStickyRowLabel('builds')}
                  </td>
                  {data.map((ib, pos) => {
                    const el = archsByIb[pos];

                    return (el?.archs || []).map((arch) => {
                      const cellKey = `builds-${pos}-${arch}`;
                      const results = _.findWhere(ib.builds || [], { arch });

                      if (!results) return renderCell(<span className="text-muted">—</span>, `${cellKey}-missing`);

                      if (_.isEmpty(results)) {
                        return renderCell(
                          renderSphere({
                            status: 'secondary',
                            icon: <FaQuestionCircle />,
                            value: '?',
                            type: 'Builds',
                            details: { status: 'No data available' },
                            link: getBuildOrUnitUrl({
                              file: results.file,
                              arch: results.arch,
                              ibName: ib.release_name
                            }),
                            tooltipId: `${cellKey}-tooltip-empty`
                          }) || <span className="text-muted">—</span>,
                          `${cellKey}-empty`
                        );
                      }

                      switch (results.passed) {
                        case true:
                        case "passed":
                          return renderCell(
                            renderSphere({
                              status: 'success',
                              icon: <FaCheck />,
                              value: ' ',
                              type: 'Builds',
                              details: {},
                              link: getBuildOrUnitUrl({
                                file: results.file,
                                arch: results.arch,
                                ibName: ib.release_name
                              }),
                              tooltipId: `${cellKey}-tooltip-passed`
                            }),
                            `${cellKey}-passed`
                          );

                        case false:
                        case "error":
                        case "failed":
                        case "warning":
                          return showGeneralResults([
                            { groupFields: [(key) => key.includes("Error")], color: "danger" },
                            { groupFields: ["compWarning"], color: "warning" }
                          ], getBuildOrUnitUrl)(results, ib.release_name, cellKey);

                        default:
                          return renderCell(<span className="text-muted">—</span>, `${cellKey}-default`);
                      }
                    });
                  })}
                </tr>
              )}

              {shouldShowRow("utests") && (
                <tr>
                  <td className="name-column fw-semibold">
                    {renderStickyRowLabel('utests')}
                  </td>
                  {renderRowCells({
                    resultType: 'utests',
                    ifPassed: (details, ibName, cellKey) => renderCell(renderSphere({
                      status: 'success',
                      icon: <FaCheck />,
                      value: details.details?.num_passed || ' ',
                      type: 'Unit Tests',
                      details: {},
                      link: getBuildOrUnitUrl({
                        file: details.file,
                        arch: details.arch,
                        ibName,
                        urlParameter: '?utests'
                      }),
                      tooltipId: `${cellKey}-tooltip-passed`
                    }), `${cellKey}-passed`),
                    ifError: showGeneralResults([{ groupFields: ["num_errors"], color: "danger" }], getBuildOrUnitUrl, '?utests'),
                    ifFailed: showGeneralResults([{ groupFields: ["num_fails"], color: "danger" }], getBuildOrUnitUrl, '?utests'),
                    ifWarning: showGeneralResults([{ groupFields: ["num_warnings"], color: "warning" }], getBuildOrUnitUrl, '?utests')
                  })}
                </tr>
              )}

              {shouldShowRow("relvals") && (
                <tr>
                  <td className="name-column fw-semibold">
                    <a
                      href={urls.newRelVals(que, date)}
                      className="text-decoration-none d-flex align-items-center justify-content-center"
                      style={{ color: THEME.text.primary, height: '100%' }}
                      title="RelVal"
                    >
                      <span className="type-label-desktop">RelVal</span>
                      <span className="type-label-mobile">
                        <FaLayerGroup size={12} />
                      </span>
                    </a>
                  </td>
                  {renderRowCells({
                    resultType: 'relvals',
                    ifPassed: showRelValsResults(showLabelConfig.relvals || [], getRelValUrl),
                    ifError: showRelValsResults(showLabelConfig.relvals || [], getRelValUrl),
                    ifFailed: showRelValsResults(showLabelConfig.relvals || [], getRelValUrl),
                    ifWarning: showRelValsResults(showLabelConfig.relvals || [], getRelValUrl)
                  })}
                </tr>
              )}

              {shouldShowRow("addons") && (
                <tr>
                  <td className="name-column fw-semibold">
                    {renderStickyRowLabel('addons')}
                  </td>
                  {renderRowCells({
                    resultType: 'addons',
                    ifPassed: (details, ibName, cellKey) => renderCell(renderSphere({
                      status: 'success',
                      icon: <FaCheck />,
                      value: ' ',
                      type: 'Other Tests',
                      details: removeKeysFromDetails(details, ['file']),
                      link: getOtherTestUrl({ file: details.file, arch: details.arch, ibName }),
                      tooltipId: `${cellKey}-tooltip-passed`
                    }), `${cellKey}-passed`),
                    ifError: (details, ibName, cellKey) => renderCell(renderSphere({
                      status: 'danger',
                      icon: <FaTimes />,
                      value: ' ',
                      type: 'Other Tests',
                      details: removeKeysFromDetails(details, ['file']),
                      link: getOtherTestUrl({ file: details.file, arch: details.arch, ibName }),
                      tooltipId: `${cellKey}-tooltip-error`
                    }), `${cellKey}-error`),
                    ifFailed: showGeneralResults(showLabelConfig.addons || [], getOtherTestUrl, '', { hideFile: true }),
                    ifWarning: showGeneralResults(showLabelConfig.addons || [], getOtherTestUrl, '', { hideFile: true })
                  })}
                </tr>
              )}

              {shouldShowRow("dupDict") && (
                <tr>
                  <td className="name-column fw-semibold">
                    {renderStickyRowLabel('dupDict')}
                  </td>
                  {renderRowCells({
                    resultType: 'dupDict',
                    ifPassed: (details, ibName, cellKey) => renderCell(renderSphere({
                      status: 'success',
                      icon: <FaCheck />,
                      value: ' ',
                      type: 'Q/A',
                      details: { status: 'No duplicates found' },
                      link: urls.q_a(details.arch, ibName),
                      tooltipId: `${cellKey}-tooltip-passed`
                    }), `${cellKey}-passed`),
                    ifError: (details, ibName, cellKey) => renderCell(renderSphere({
                      status: 'danger',
                      icon: <FaTimes />,
                      value: ' ',
                      type: 'Q/A',
                      details: { status: 'Duplicate found' },
                      link: urls.q_a(details.arch, ibName),
                      tooltipId: `${cellKey}-tooltip-error`
                    }), `${cellKey}-error`),
                    ifFailed: showGeneralResults(showLabelConfig.dupDict || [], urls.q_a),
                    ifWarning: showGeneralResults(showLabelConfig.dupDict || [], urls.q_a)
                  })}
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </div>
    </div>
  );
};

ComparisonTable.propTypes = {
  data: PropTypes.array.isRequired,
  releaseQue: PropTypes.string.isRequired,
  highlightTarget: PropTypes.shape({
    que: PropTypes.string,
    date: PropTypes.string,
    flavor: PropTypes.string,
    arch: PropTypes.string
  })
};

export default ComparisonTable;