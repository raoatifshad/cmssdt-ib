import React, { useMemo, useState, forwardRef } from "react";
import { RiShareForwardLine } from "react-icons/ri";
import {
  Navbar,
  Nav,
  Dropdown,
  Button,
  Modal,
  Popover,
  OverlayTrigger,
  Container
} from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { useLocation } from "react-router-dom";
import {
  BsQuestionCircle,
  BsExclamationCircle,
  BsList,
  BsArrowRepeat,
  BsFilter,
  BsGithub,
  BsBox,
  BsCalendarEvent,
  BsChevronUp,
  BsChevronDown,
  BsEyeFill
} from "react-icons/bs";

import {
  FaCodeBranch,
  FaCode,
  FaCubes,
  FaTools,
  FaWrench,
  FaVial,
  FaLayerGroup,
  FaPlus,
  FaClipboardList,
  FaCheck,
  FaTimes,
  FaArrowUp,
  FaArrowDown,
  FaThumbtack,
  FaMinus,
  FaCopy
} from "react-icons/fa";
import { GoGitPullRequest } from "react-icons/go";

import { config } from "../config";
import { getComReleaseFromQue } from "../Utils/processing";

const { urls } = config;

const THEME = {
  primary: "#2563eb",
  primaryLight: "#3b82f6",
  border: "#e2e8f0",
  hover: "#f1f5f9",
  pageBg: "#f5f7fb",
  text: {
    primary: "#0f172a",
    secondary: "#475569",
    muted: "#64748b"
  }
};

const NAV_THEME = {
  navbarBg: "rgba(15, 23, 42, 0.92)",
  navbarBorder: "rgba(148,163,184,0.25)",
  navbarText: "#f8fafc",
  navbarTextMuted: "rgba(248,250,252,0.78)",
  pillHoverBg: "rgba(59,130,246,0.18)",
  dropdownBg: "#0b1220",
  dropdownBorder: "rgba(148,163,184,0.22)",
  dropdownItemHover: "rgba(255,255,255,0.06)",
  filtersBtnBg: THEME.primary,
  filtersBtnText: "#ffffff",
  iconBtnBorder: "rgba(148,163,184,0.45)",
  brandChipGradient: `linear-gradient(135deg, ${THEME.primary} 0%, ${THEME.primaryLight} 100%)`
};

const PillDropdownToggle = forwardRef(({ children, onClick, active }, ref) => (
  <a
    href="#"
    ref={ref}
    onClick={(e) => {
      e.preventDefault();
      onClick?.(e);
    }}
    className={`nav-link navpill d-inline-flex align-items-center ${active ? "active" : ""}`}
  >
    {children}
    <span className="ms-2 navpill-caret">▾</span>
  </a>
));
PillDropdownToggle.displayName = "PillDropdownToggle";

const getReleaseIcon = () => {
  return <FaCodeBranch className="me-2" style={{ color: "#ffffff" }} />;
};

const popoverHelp = (
  <Popover id="popover-help" className="border-0 shadow">
    <Popover.Header as="h3" className="bg-light border-0">
      <BsQuestionCircle className="text-primary me-2" />
      Need Help?
    </Popover.Header>
    <Popover.Body>
      <p className="mb-2">Click for detailed explanations of all status indicators.</p>
      <small className="text-muted">
        Keyboard shortcut: <kbd className="bg-light border px-2 py-1 rounded">?</kbd>
      </small>
    </Popover.Body>
  </Popover>
);

const popoverIssues = (
  <Popover id="popover-issues" className="border-0 shadow">
    <Popover.Header as="h3" className="bg-light border-0">
      <BsExclamationCircle className="text-danger me-2" />
      Report an Issue
    </Popover.Header>
    <Popover.Body>
      <p className="mb-0">Select where you'd like to report the problem:</p>
    </Popover.Body>
  </Popover>
);

const guideSphereStyles = {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "34px",
    height: "34px",
    borderRadius: "50%",
    padding: "0 8px",
    color: "#fff",
    fontSize: "0.82rem",
    fontWeight: 700,
    textShadow: "0 1px 2px rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.18)",
    position: "relative",
    boxSizing: "border-box"
  },
  success: {
    background: "radial-gradient(circle at 30% 25%, #79C779 0%, #5EB85E 50%, #3E9A3E 90%)",
    boxShadow: "0 4px 10px -2px rgba(16, 185, 129, 0.35), inset 0 -3px 0 rgba(0,0,0,0.18)"
  },
  danger: {
    background: "radial-gradient(circle at 30% 25%, #f87171 0%, #ef4444 50%, #dc2626 90%)",
    boxShadow: "0 4px 10px -2px rgba(239, 68, 68, 0.35), inset 0 -3px 0 rgba(0,0,0,0.18)"
  },
  warning: {
    background: "radial-gradient(circle at 30% 25%, #fbbf24 0%, #f59e0b 50%, #d97706 90%)",
    boxShadow: "0 4px 10px -2px rgba(245, 158, 11, 0.35), inset 0 -3px 0 rgba(0,0,0,0.18)"
  }
};

const GuideSphere = ({ variant = "success", children }) => (
  <span
   style={{ 
      ...guideSphereStyles.base,
      ...guideSphereStyles[variant] }}>
    {children}
  </span>
);

const GuideCard = ({ icon, title, text }) => (
  <div
    className="d-flex align-items-start p-3 rounded-3 h-100"
    style={{ border: "1px solid #e2e8f0", background: "#ffffff" }}
  >
    <span
      className="me-3 d-inline-flex align-items-center justify-content-center rounded-3"
      style={{
        width: 44,
        height: 44,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        color: "#475569",
        flexShrink: 0
      }}
    >
      {icon}
    </span>
    <div>
      <div className="fw-semibold mb-1">{title}</div>
      <small className="text-muted">{text}</small>
    </div>
  </div>
);

const FloatingControlBadge = ({
  children,
  bg = "#ffffff",
  color = "#334155",
  border = "#cbd5e1",
  size = 44,
  rounded = "50%",
  className = ""
}) => (
  <span
    className={`d-inline-flex align-items-center justify-content-center position-relative ${className}`}
    style={{
      width: size,
      height: size,
      borderRadius: rounded,
      background: bg,
      color,
      border: `1px solid ${border}`,
      boxShadow: "0 6px 14px rgba(15, 23, 42, 0.12)",
      flexShrink: 0
    }}
  >
    {children}
  </span>
);

const FloatingControlCard = ({ icon, title, text }) => (
  <div
    className="d-flex align-items-start p-3 rounded-3 h-100"
    style={{ border: "1px solid #e2e8f0", background: "#ffffff" }}
  >
    <span className="me-3" style={{ flexShrink: 0 }}>
      {icon}
    </span>
    <div>
      <div className="fw-semibold mb-1">{title}</div>
      <small className="text-muted">{text}</small>
    </div>
  </div>
);

const Navigation = ({ toLinks, flaworControl, archControl, showAllPullRequests = false, onToggleAllPullRequests }) => {
  const location = useLocation();

  const [showHelpModal, setShowHelpModal] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const handleClose = () => setShowHelpModal(false);
  const handleShow = () => setShowHelpModal(true);
  const handleNavbarToggle = () => setExpanded((v) => !v);
  const handleNavbarClose = () => setExpanded(false);
  const toggleFilters = () => setShowFilters((v) => !v);

  const { importantNavLinks, olderMenuItems, isOlderActive } = useMemo(() => {
    let important = [];
    let older = [];
    let olderPaths = [];

    if (toLinks?.length) {
      const reversed = [...toLinks].reverse();

      const mapped = reversed.map((item) => {
        const rel = getComReleaseFromQue(item);
        const path = `/ib/${item}`;
        return { item, rel, path };
      });

      const top3 = mapped.slice(0, 3);
      const rest = mapped.slice(3);

      important = top3.map(({ item, rel, path }) => (
        <LinkContainer key={item} to={path} onClick={handleNavbarClose}>
          <Nav.Link className="navpill d-flex align-items-center">
            {getReleaseIcon(rel)}
            <span className="fw-medium">{rel}</span>
          </Nav.Link>
        </LinkContainer>
      ));

      olderPaths = rest.map(({ path }) => path);

      older = rest.map(({ item, rel, path }) => (
        <LinkContainer key={item} to={path} onClick={handleNavbarClose}>
          <Dropdown.Item className="d-flex align-items-center dropdown-item-pro">
            {getReleaseIcon(rel)}
            <span className="fw-medium">{rel}</span>
          </Dropdown.Item>
        </LinkContainer>
      ));
    }

    return {
      importantNavLinks: important,
      olderMenuItems: older,
      isOlderActive: olderPaths.includes(location.pathname)
    };
  }, [toLinks, location.pathname]);

  const spacerHeight = showFilters ? 145 : 70;

  return (
    <>
      <style>{`
        #navigation .nav-link.active.navpill,
        #navigation .navpill.active {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff !important;
          border-radius: 12px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
          transform: translateY(-1px);
        }

        body { background: ${THEME.pageBg}; }

        #navigation.navbar {
          color: ${NAV_THEME.navbarText};
        }

        #navigation .navbar-brand,
        #navigation .navbar-nav .nav-link,
        #navigation .dropdown-toggle,
        #navigation .nav-link,
        #navigation .navbar-toggler {
          color: ${NAV_THEME.navbarText} !important;
        }

        #navigation .text-muted,
        #navigation .small,
        #navigation .nav-link .text-muted {
          color: ${NAV_THEME.navbarTextMuted} !important;
        }

        .navpill {
          border-radius: 12px;
          padding: 0.5rem 0.9rem !important;
          margin: 0 2px;
          color: ${NAV_THEME.navbarText} !important;
          text-decoration: none !important;
          line-height: 1.1;
          transition: all 0.2s ease;
        }

        .navpill:hover, .navpill:focus {
          background: ${NAV_THEME.pillHoverBg};
          color: ${NAV_THEME.navbarText} !important;
        }

        .navpill:focus-visible {
          outline: 2px solid rgba(59,130,246,0.55);
          outline-offset: 2px;
        }

        .navpill-caret {
          opacity: 0.85;
          font-size: 0.9em;
          color: ${NAV_THEME.navbarTextMuted};
        }

        .icon-btn {
          border-radius: 999px !important;
          display: inline-flex !important;
          align-items: center;
          justify-content: center;
        }

        .btn-pill { border-radius: 999px !important; }

        .dropdown-menu-pro {
          background: ${NAV_THEME.dropdownBg} !important;
          border: 1px solid ${NAV_THEME.dropdownBorder} !important;
          color: ${NAV_THEME.navbarText} !important;
        }

        .dropdown-menu-pro .dropdown-item-pro,
        .dropdown-menu-pro .dropdown-item {
          color: ${NAV_THEME.navbarText} !important;
          border-radius: 10px;
          margin: 2px 8px;
          padding: 0.55rem 0.75rem;
        }

        .dropdown-menu-pro .dropdown-item-pro:hover,
        .dropdown-menu-pro .dropdown-item-pro:focus,
        .dropdown-menu-pro .dropdown-item:hover,
        .dropdown-menu-pro .dropdown-item:focus {
          background: ${NAV_THEME.dropdownItemHover} !important;
          color: ${NAV_THEME.navbarText} !important;
        }

        .dropdown-menu-pro .dropdown-item.active,
        .dropdown-menu-pro .dropdown-item:active {
          background: rgba(59,130,246,0.35) !important;
          color: ${NAV_THEME.navbarText} !important;
        }

        .guide-clickable-icon {
          cursor: pointer;
          transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
        }

        .guide-clickable-icon:active {
          transform: scale(0.9);
          box-shadow: 0 0 0 8px rgba(37, 99, 235, 0.14), 0 6px 14px rgba(15, 23, 42, 0.12) !important;
        }

        .guide-clickable-icon:hover {
          background: #f8fafc !important;
        }
      `}</style>

      <Navbar
        expand="lg"
        fixed="top"
        id="navigation"
        expanded={expanded}
        onToggle={handleNavbarToggle}
        className="py-2 nav-shell"
        style={{
          backgroundColor: NAV_THEME.navbarBg,
          backdropFilter: "blur(10px)",
          borderBottom: `1px solid ${NAV_THEME.navbarBorder}`,
          zIndex: 1030
        }}
      >
        <Container fluid className="px-3 px-md-4">
          <Navbar.Brand className="d-flex align-items-center">
            <div
              style={{
                padding: "4px 4px",
                borderRadius: "8px",
                marginRight: "8px",
                marginLeft: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <img
                src="CMS_logo-round.png"
                alt="CMS Offline & Computing"
                style={{
                  height: "36px",
                  width: "auto",
                  marginRight: "10px",
                  objectFit: "contain",
                  transform: "scale(1.4)"
                }}
              />
            </div>

            <span
              className="fw-bold"
              style={{ fontSize: "1.15rem", letterSpacing: 0.2, color: "#fff" }}
            >
              CMSSW IB Page
            </span>
          </Navbar.Brand>

          <Navbar.Toggle aria-controls="basic-navbar-nav" className="border-0">
            <BsList size={24} />
          </Navbar.Toggle>

          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="mx-auto gap-lg-1 align-items-lg-center">
              {importantNavLinks}

              {olderMenuItems.length > 0 && (
                <Dropdown as={Nav.Item}>
                  <Dropdown.Toggle
                    as={PillDropdownToggle}
                    id="nav-dropdown-older"
                    active={isOlderActive}
                  >
                    <span className="d-inline-flex align-items-center">
                      <BsCalendarEvent className="me-2" />
                      <span className="fw-medium">Older</span>
                    </span>
                  </Dropdown.Toggle>

                  <Dropdown.Menu className="dropdown-menu-pro shadow border-0 py-2" style={{ minWidth: 260 }}>
                    {olderMenuItems}
                  </Dropdown.Menu>
                </Dropdown>
              )}

              <Nav.Link
                href="https://monit-grafana.cern.ch/d/000000530/cms-monitoring-project?viewPanel=60&orgId=11"
                target="_blank"
                rel="noopener noreferrer"
                className="navpill d-flex align-items-center"
                onClick={handleNavbarClose}
              >
                <FaCode className="me-2" />
                <span className="fw-medium">IB Profiling Results</span>
              </Nav.Link>

              <LinkContainer to="/shift" onClick={handleNavbarClose}>
                <Nav.Link className="navpill d-flex align-items-center">
                  <FaClipboardList className="me-2" />
                  <span className="fw-medium">Shift Console</span>
                </Nav.Link>
              </LinkContainer>
            </Nav>

            <div className="d-flex align-items-center gap-2 ms-lg-2">
              <Button
                size="sm"
                onClick={onToggleAllPullRequests}
                className="icon-btn"
                title={showAllPullRequests ? "Hide PRs for all releases" : "Show PRs for all releases"}
                aria-label={showAllPullRequests ? "Hide PRs for all releases" : "Show PRs for all releases"}
                style={{
                  width: 38,
                  height: 38,
                  background: showAllPullRequests ? "#2563eb" : "transparent",
                  color: "#ffffff",
                  borderColor: showAllPullRequests ? "#2563eb" : NAV_THEME.iconBtnBorder,
                  position: "relative"
                }}
                variant="outline-secondary"
              >
                <GoGitPullRequest size={18} />
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: showAllPullRequests ? "#ef4444" : "#22c55e",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  {showAllPullRequests ? <FaMinus size={7} /> : <FaPlus size={7} />}
                </span>
              </Button>

              <Button
                size="sm"
                onClick={toggleFilters}
                className="d-flex align-items-center gap-2 px-3 btn-pill"
                style={{
                  height: 38,
                  backgroundColor: showFilters ? NAV_THEME.filtersBtnBg : "transparent",
                  color: showFilters ? NAV_THEME.filtersBtnText : NAV_THEME.navbarText,
                  borderColor: showFilters ? "transparent" : NAV_THEME.iconBtnBorder
                }}
              >
                <BsFilter size={16} />
                <span className="fw-medium">Filters</span>
                {showFilters ? <BsChevronUp size={14} /> : <BsChevronDown size={14} />}
              </Button>

              <OverlayTrigger placement="bottom" overlay={popoverHelp}>
                <Button
                  onClick={handleShow}
                  size="sm"
                  className="icon-btn"
                  style={{
                    width: 38,
                    height: 38,
                    color: NAV_THEME.navbarText,
                    borderColor: NAV_THEME.iconBtnBorder,
                    background: "transparent"
                  }}
                  variant="outline-secondary"
                >
                  <BsQuestionCircle size={18} />
                </Button>
              </OverlayTrigger>

              <Dropdown align="end">
                <OverlayTrigger placement="bottom" overlay={popoverIssues}>
                  <Dropdown.Toggle
                    size="sm"
                    className="icon-btn"
                    style={{
                      width: 38,
                      height: 38,
                      background: "transparent"
                    }}
                    variant="outline-danger"
                    id="issues-dropdown"
                  >
                    <BsExclamationCircle size={18} />
                  </Dropdown.Toggle>
                </OverlayTrigger>

                <Dropdown.Menu className="shadow border-0 py-2 dropdown-menu-pro" style={{ minWidth: 240 }}>
                  {urls.issues?.map((el) => (
                    <Dropdown.Item
                      key={el.url}
                      href={el.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="d-flex align-items-center dropdown-item-pro"
                    >
                      <BsGithub className="me-3" size={18} />
                      <span className="flex-grow-1 fw-medium">{el.name}</span>
                      <BsBox style={{ color: NAV_THEME.navbarTextMuted }} size={12} />
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <div
        style={{
          position: "fixed",
          top: 70,
          left: 0,
          right: 0,
          zIndex: 1020,
          pointerEvents: "none",
          transition: "all 0.25s ease",
          transform: showFilters ? "translateY(0)" : "translateY(-110%)",
          opacity: showFilters ? 1 : 0
        }}
      >
        <Container fluid className="px-3 px-md-4">
          <div
            className="bg-white rounded-3 shadow-sm mx-auto"
            style={{
              maxWidth: 1600,
              pointerEvents: "auto",
              border: `1px solid ${THEME.border}`,
              overflow: "hidden"
            }}
          >
            <div className="px-3 py-3 px-md-4">
              <div className="d-flex flex-column gap-3">
                <div className="d-flex flex-column flex-lg-row gap-2 gap-lg-3 align-items-lg-center">
                  <div className="d-flex align-items-center gap-2">
                    <div
                      className="d-flex align-items-center justify-content-center"
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: THEME.hover,
                        border: `1px solid ${THEME.border}`,
                        color: THEME.primary
                      }}
                    >
                      <BsFilter size={18} />
                    </div>
                    <div>
                      <div className="fw-semibold" style={{ color: THEME.text.primary, lineHeight: 1.1 }}>
                        Filters
                      </div>
                    </div>
                  </div>

                  <div className="flex-grow-1">{flaworControl}</div>
                </div>

                <div className="d-flex flex-column flex-lg-row gap-2 gap-lg-3 align-items-lg-center">
                  <div className="fw-semibold" style={{ minWidth: 130, color: THEME.text.secondary }}>
                    Architectures
                  </div>
                  <div className="flex-grow-1">{archControl}</div>
                </div>
              </div>
            </div>

            <div
              style={{
                height: 3,
                background: `linear-gradient(90deg, ${THEME.primary} 0%, ${THEME.primaryLight} 55%, transparent 100%)`,
                opacity: 0.22
              }}
            />
          </div>
        </Container>
      </div>

      <div style={{ height: spacerHeight, transition: "height 0.25s ease" }} />

      <Modal show={showHelpModal} onHide={handleClose} centered size="lg" className="help-modal">
        <Modal.Header closeButton className="bg-light border-0">
          <Modal.Title className="d-flex align-items-center">
            <div
              className="text-white p-2 rounded-3 me-3"
              style={{ background: `linear-gradient(135deg, ${THEME.primary} 0%, ${THEME.primaryLight} 100%)` }}
            >
              <BsQuestionCircle size={24} />
            </div>
            <div>
              <h5 className="mb-0">Dashboard Guide</h5>
              <small className="text-muted">Understanding the status indicators</small>
            </div>
          </Modal.Title>
        </Modal.Header>

        <Modal.Body className="px-4 py-4">
          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <div
                className="d-flex align-items-start p-3 rounded-3 h-100"
                style={{ border: "1px solid #e2e8f0", background: "#ffffff" }}
              >
                <span
                  className="me-3 d-inline-flex align-items-center justify-content-center rounded-3"
                  style={{
                    width: 44,
                    height: 44,
                    background: "#5EB85E",
                    border: "1px solid #3E9A3E",
                    color: "#ffffff",
                    flexShrink: 0
                  }}
                >
                  <FaWrench size={16} />
                </span>
                <div>
                  <div className="fw-semibold mb-1">Full Build</div>
                  <small className="text-muted">Complete build of the release.</small>
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div
                className="d-flex align-items-start p-3 rounded-3 h-100"
                style={{ border: "1px solid #e2e8f0", background: "#ffffff" }}
              >
                <span
                  className="me-3 d-inline-flex align-items-center justify-content-center rounded-3"
                  style={{
                    width: 44,
                    height: 44,
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    color: "#facc15",
                    flexShrink: 0
                  }}
                >
                  <FaTools size={18} />
                </span>
                <div>
                  <div className="fw-semibold mb-1">Patch Release</div>
                  <small className="text-muted">Patch release.</small>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <div className="fw-semibold mb-3" style={{ color: THEME.text.primary, fontSize: "1rem" }}>
              Page Controls
            </div>

            <div className="row g-3">
              <div className="col-md-6">
                <FloatingControlCard
                  icon={
                    <FloatingControlBadge bg="#ffffff" color="#334155" border="#cbd5e1" className="guide-clickable-icon">
                      <GoGitPullRequest size={20} />
                      <span
                        style={{
                          position: "absolute",
                          top: 3,
                          right: 3,
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: "#22c55e",
                          color: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 9,
                          boxShadow: "0 2px 6px rgba(0,0,0,0.18)"
                        }}
                      >
                        <FaPlus size={8} />
                      </span>
                    </FloatingControlBadge>
                  }
                  title="Expand all commits & PRs"
                  text="Open or collapse all commits & pull request sections at once. Your last choice is saved in this browser and restored the next time you open the page."
                />
              </div>

              <div className="col-md-6">
                <FloatingControlCard
                  icon={
                    <FloatingControlBadge bg="#ffffff" color="#334155" border="#cbd5e1" className="guide-clickable-icon">
                      <FaArrowUp size={13} />
                    </FloatingControlBadge>
                  }
                  title="Go to top"
                  text="Scroll quickly to the top of the page."
                />
              </div>

              <div className="col-md-6">
                <FloatingControlCard
                  icon={
                    <FloatingControlBadge bg="#ffffff" color="#334155" border="#cbd5e1" className="guide-clickable-icon">
                      <FaArrowDown size={13} />
                    </FloatingControlBadge>
                  }
                  title="Go to bottom"
                  text="Scroll quickly to the bottom of the page."
                />
              </div>

              <div className="col-md-6">
                <FloatingControlCard
                  icon={
                    <span
                      className="d-inline-flex align-items-center justify-content-center guide-clickable-icon"
                      style={{
                        width: 44,
                        height: 52,
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.98)",
                        color: "#334155",
                        border: "1px solid #cbd5e1",
                        boxShadow: "0 6px 14px rgba(15, 23, 42, 0.12)",
                        flexShrink: 0
                      }}
                    >
                      <FaThumbtack size={13} />
                    </span>
                  }
                  title="Jump to release"
                  text="Open the release navigator and jump directly to a release section."
                />
              </div>

              <div className="col-md-6">
                <FloatingControlCard
                  icon={
                    <FloatingControlBadge bg="#ffffff" color="#2563eb" border="#dbeafe" className="guide-clickable-icon">
                      <BsEyeFill size={18} />
                    </FloatingControlBadge>
                  }
                  title="Show / hide one IB"
                  text="The blue eye icon on each release row shows or hides the IB details for that specific release."
                />
              </div>

              <div className="col-md-6">
  <FloatingControlCard
    icon={
      <FloatingControlBadge
        bg="#ffffff"
        color="#334155"
        border="#cbd5e1"
        className="guide-clickable-icon"
      >
        <BsEyeFill size={18} />
      </FloatingControlBadge>
    }
    title="Show / hide all IBs"
    text="The floating eye control shows or hides all IB sections on the page."
  />
</div>

              <div className="col-md-6">
                <FloatingControlCard
                  icon={
                    <FloatingControlBadge bg="#ffffff" color="#2563eb" border="#dbeafe" size={34} className="guide-clickable-icon">
                      <GoGitPullRequest size={16} />
                    </FloatingControlBadge>
                  }
                  title="Show / hide PRs for one IB"
                  text="The Git pull request icon before each release name shows or hides the commits and pull requests for that IB."
                />
              </div>

              <div className="col-md-6">
                <FloatingControlCard
                  icon={
                    <FloatingControlBadge
                      bg="#eef4ff"
                      color="#2563eb"
                      border="#c7d2fe"
                      size={34}
                      rounded="8px"
                      className="guide-clickable-icon"
                    >
                      <FaCopy size={15} />
                    </FloatingControlBadge>
                  }
                  title="Copy IB name"
                  text="The copy icon after a release name copies the full IB name, for example CMSSW_17_0_X_2026-05-06-1100."
                />
              </div>

              <div className="col-md-6">
                <FloatingControlCard
                  icon={
                    <FloatingControlBadge
                      bg="#ffffff"
                      color="#111827"
                      border="#e2e8f0"
                      size={24}
                      rounded="6px"
                      className="guide-clickable-icon"
                    >
                      <FaCopy size={12} />
                    </FloatingControlBadge>
                  }
                  title="Copy flavor"
                  text="The small copy icon in the flavor header copies the selected flavor name."
                />
              </div>
              <div className="col-md-6">
                <FloatingControlCard
                  icon={
                    <FloatingControlBadge
                      bg="#0ea5e9"
                      color="#ffffff"
                      border="#bae6fd"
                      size={34}
                      className="guide-clickable-icon"
                    >
                      <RiShareForwardLine size={16} />
                    </FloatingControlBadge>
                  }
                  title="Forward Port"
                  text="Indicates forwad ported pull request."
                />
              </div>
            </div>
          </div>

          <div className="mb-4">
            <div className="fw-semibold mb-3" style={{ color: THEME.text.primary, fontSize: "1rem" }}>
              Status Indicators
            </div>

            <div className="row g-3">
              <div className="col-md-6">
                <div
                  className="d-flex align-items-start p-3 rounded-3 h-100"
                  style={{ border: "1px solid #e2e8f0", background: "#ffffff" }}
                >
                  <span className="me-3" style={{ flexShrink: 0 }}>
                    <GuideSphere variant="success">
                      <FaCheck size={12} />
                    </GuideSphere>
                  </span>
                  <div>
                    <div className="fw-semibold mb-1">Passed</div>
                    <small className="text-muted">Passed result shown with a green sphere and tick.</small>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div
                  className="d-flex align-items-start p-3 rounded-3 h-100"
                  style={{ border: "1px solid #e2e8f0", background: "#ffffff" }}
                >
                  <span className="me-3" style={{ flexShrink: 0 }}>
                    <GuideSphere variant="danger">
                      <FaTimes size={12} />
                    </GuideSphere>
                  </span>
                  <div>
                    <div className="fw-semibold mb-1">Error</div>
                    <small className="text-muted">Failed result shown with a red sphere and cross.</small>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div
                  className="d-flex align-items-start p-3 rounded-3 h-100"
                  style={{ border: "1px solid #e2e8f0", background: "#ffffff" }}
                >
                  <span className="me-3" style={{ flexShrink: 0 }}>
                    <GuideSphere variant="warning">14</GuideSphere>
                  </span>
                  <div>
                    <div className="fw-semibold mb-1">Warning Count</div>
                    <small className="text-muted">Yellow sphere with a number indicates warnings or known failed items.</small>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div
                  className="d-flex align-items-start p-3 rounded-3 h-100"
                  style={{ border: "1px solid #e2e8f0", background: "#ffffff" }}
                >
                  <span className="me-3" style={{ flexShrink: 0 }}>
                    <GuideSphere variant="success">4779</GuideSphere>
                  </span>
                  <div>
                    <div className="fw-semibold mb-1">Passed Count</div>
                    <small className="text-muted">Green sphere with a number indicates successful counted results.</small>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div
                  className="d-flex align-items-start p-3 rounded-3 h-100"
                  style={{ border: "1px solid #e2e8f0", background: "#ffffff" }}
                >
                  <span className="me-3" style={{ flexShrink: 0 }}>
                    <GuideSphere variant="danger">512</GuideSphere>
                  </span>
                  <div>
                    <div className="fw-semibold mb-1">Error Count</div>
                    <small className="text-muted">Red sphere with a number indicates failing counted results.</small>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <GuideCard
                  icon={<BsArrowRepeat size={18} />}
                  title="In Progress"
                  text="The check is still running or results are not ready yet."
                />
              </div>

              <div className="col-md-6">
                <GuideCard
                  icon={<BsList size={18} />}
                  title="Available / Ready"
                  text="The item is available to open, inspect, or navigate."
                />
              </div>

              <div className="col-md-6">
                <GuideCard
                  icon={<BsFilter size={18} />}
                  title="Filters"
                  text="Use the Filters button to show or hide architecture and flavor filters."
                />
              </div>
            </div>
          </div>

          <div>
            <div className="fw-semibold mb-3" style={{ color: THEME.text.primary, fontSize: "1rem" }}>
              Row Icons
            </div>

            <div
              className="p-3 rounded-3"
              style={{ border: "1px solid #e2e8f0", background: "#ffffff" }}
            >
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="d-flex align-items-start">
                    <span className="me-3 mt-1" style={{ color: "#64748b" }}>
                      <FaCubes size={15} />
                    </span>
                    <div>
                      <div className="fw-semibold mb-1">Builds</div>
                      <small className="text-muted">Compilation and build status of the release.</small>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="d-flex align-items-start">
                    <span className="me-3 mt-1" style={{ color: "#64748b" }}>
                      <FaVial size={15} />
                    </span>
                    <div>
                      <div className="fw-semibold mb-1">Unit</div>
                      <small className="text-muted">Automated unit test results.</small>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="d-flex align-items-start">
                    <span className="me-3 mt-1" style={{ color: "#64748b" }}>
                      <FaLayerGroup size={15} />
                    </span>
                    <div>
                      <div className="fw-semibold mb-1">RelVal</div>
                      <small className="text-muted">Validation workflows and comparison results.</small>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="d-flex align-items-start">
                    <span className="me-3 mt-1" style={{ color: "#64748b" }}>
                      <FaPlus size={15} />
                    </span>
                    <div>
                      <div className="fw-semibold mb-1">AddOn</div>
                      <small className="text-muted">Additional checks and special tests.</small>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="d-flex align-items-start">
                    <span className="me-3 mt-1" style={{ color: "#64748b" }}>
                      <FaClipboardList size={15} />
                    </span>
                    <div>
                      <div className="fw-semibold mb-1">Q/A</div>
                      <small className="text-muted">Quality checks and detailed report links.</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer className="border-0 bg-light">
          <Button variant="primary" onClick={handleClose} className="px-4">
            Got it
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default Navigation;