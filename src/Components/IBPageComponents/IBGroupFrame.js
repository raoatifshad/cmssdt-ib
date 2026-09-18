import React, { PureComponent } from 'react';
import Commits from "./Commits";
import StatusLabels from "./StatusLabels";
import ComparisonTable from "./ComparisonTable";
import { Card } from "react-bootstrap";
import { checkIfCommitsAreEmpty, checkIfTableIsEmpty } from "../../Utils/processing";
import { FaEye, FaEyeSlash, FaCopy  } from 'react-icons/fa';
import { GoGitPullRequest } from "react-icons/go";

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

class IBGroupFrame extends PureComponent {
    state = {
        showPullRequests: this.props.showPullRequests || false,
        copiedText: null
    };

    copyToClipboard = (e, text) => {
        e.preventDefault();
        e.stopPropagation();

        copyText(text);
        
        this.setState({ copiedText: text });

        setTimeout(() => {
            this.setState({ copiedText: null });
        }, 1500);
    };

    componentDidUpdate(prevProps) {
        if (prevProps.showPullRequests !== this.props.showPullRequests) {
            this.setState({
                showPullRequests: this.props.showPullRequests
            });
        }
    }

    togglePullRequests = (e) => {
        e.stopPropagation();
        this.setState((prev) => ({
            showPullRequests: !prev.showPullRequests
        }));
    };

    getIbGroupType(IBGroup) {
        const firstIbFromList = IBGroup[0];
        const { isIB, next_ib } = firstIbFromList;

        if (isIB === true) return 'IB';
        if (isIB === false && next_ib === true) return 'nextIB';
        return 'fullBuild';
    }

    render() {
        const { IBGroup, releaseQue, isCollapsed, onToggleCollapse } = this.props;
        const { showPullRequests } = this.state;

        const firstIbFromList = IBGroup[0];
        if (!firstIbFromList) {
            return <div><h1>Error: IB group is empty</h1></div>;
        }

        let statusLabels = null;
        let comparisonTable = null;
        let commitPanelProps = {};
        let panelHeader = null;
        let showOnlyIbTag = false;

        const ibGroupType = this.getIbGroupType(IBGroup);
        const isNextIB = ibGroupType === 'nextIB';

        const ibTagDropdown = StatusLabels.renderIBTag(IBGroup, ibGroupType);

        switch (ibGroupType) {
            case 'IB': {
                const isIBGroupTableEmpty = checkIfTableIsEmpty({
                    fieldsToCheck: ['builds', 'utests', 'relvals', 'addons', 'dupDict'],
                    IBGroup
                });

                const isCommitsEmpty = checkIfCommitsAreEmpty({
                    IBGroup
                });

                if (isCommitsEmpty && isIBGroupTableEmpty) {
                    return null;
                }

                panelHeader = firstIbFromList.release_name;

                if (!isIBGroupTableEmpty) {
                    comparisonTable = (
                        <ComparisonTable
                            data={IBGroup}
                            releaseQue={releaseQue}
                            highlightTarget={this.props.highlightTarget}
                        />
                    );
                }

                commitPanelProps = {
                    defaultExpanded: true
                };
                break;
            }

            case 'nextIB':
                showOnlyIbTag = true;
                panelHeader = 'nextIB';
                break;

            case 'fullBuild':
                showOnlyIbTag = true;
                panelHeader = firstIbFromList.release_name;
                break;

            default:
                console.error("wrong case: " + ibGroupType);
        }

        statusLabels = (
            <StatusLabels
                IBGroup={IBGroup}
                ibGroupType={ibGroupType}
                showOnlyIbTag={showOnlyIbTag}
            />
        );

        const cardStyle = isNextIB
            ? {
                  border: '1px solid #93c5fd',
                  boxShadow: '0 6px 18px rgba(37, 99, 235, 0.12)',
                  background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)'
              }
            : {};

        const headerStyle = {
            background: 'linear-gradient(90deg, #dbeafe 0%, #eff6ff 100%)',
            borderBottom: '1px solid #bfdbfe',
            color: '#1d4ed8',
            display: 'flex',
            justifyContent: isNextIB ? 'center' : 'space-between',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            cursor: 'pointer',
            userSelect: 'none',
            padding: '0.55rem 0.9rem'
        };

        const prButtonStyle = {
            border: '1px solid #bfdbfe',
            background: showPullRequests ? '#2563eb' : '#ffffff',
            color: showPullRequests ? '#ffffff' : '#1d4ed8',
            borderRadius: '999px',
            width: '28px',
            height: '28px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0
        };

        const copyButtonStyle = {
            border: '1px solid #bfdbfe',
            background: '#ffffff',
            color: '#1d4ed8',
            borderRadius: '999px',
            width: '26px',
            height: '26px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0
        };
        return (
            <Card className="mb-3" style={cardStyle}>
                <Card.Header
                    style={headerStyle}
                    onClick={onToggleCollapse}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onToggleCollapse();
                        }
                    }}
                    role="button"
                    tabIndex={0}
                    title={isCollapsed ? `Show ${panelHeader}` : `Hide ${panelHeader}`}
                >
                    {isNextIB ? (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px',
                                    flexWrap: 'wrap',
                                    width: '100%'
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={this.togglePullRequests}
                                    title={showPullRequests ? "Hide Pull Requests" : "Show Pull Requests"}
                                    aria-label={showPullRequests ? "Hide Pull Requests" : "Show Pull Requests"}
                                    aria-pressed={showPullRequests}
                                    style={prButtonStyle}
                                >
                                    <GoGitPullRequest size={16} />
                                </button>

                                <strong>{panelHeader}</strong>
                
                                <span
                                    style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        padding: '3px 10px',
                                        borderRadius: '999px',
                                        background: '#2563eb',
                                        color: '#ffffff'
                                    }}
                                >
                                    Upcoming
                                </span>

                                <div
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                >
                                    {ibTagDropdown}
                                </div>
                            </div>
                        ) : (
                        <>
                            <div
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    minWidth: 0
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={this.togglePullRequests}
                                    title={showPullRequests ? "Hide Pull Requests" : "Show Pull Requests"}
                                    aria-label={showPullRequests ? "Hide Pull Requests" : "Show Pull Requests"}
                                    aria-pressed={showPullRequests}
                                    style={prButtonStyle}
                                >
                                    <GoGitPullRequest size={16} />
                                </button>

                                <strong>{panelHeader}</strong>
                                 <button
                                    type="button"
                                    onClick={(e) => this.copyToClipboard(e, panelHeader)}
                                    title={`Copy ${panelHeader}`}
                                    aria-label={`Copy ${panelHeader}`}
                                    style={copyButtonStyle}
                                >
                                    {this.state.copiedText === panelHeader ? (
                                        <span style={{ fontSize: '12px' }}>✓</span>
                                    ) : (
                                        <FaCopy size={12} />
                                    )}
                                </button>
                            </div>

                            <span
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#1d4ed8',
                                    fontSize: '0.95rem',
                                    marginLeft: 'auto'
                                }}
                            >
                                {isCollapsed ? <FaEyeSlash /> : <FaEye />}
                            </span>
                        </>
                    )}
                </Card.Header>

                {!isCollapsed && (
                    <Card.Body style={{ padding: "0.25rem 0.5rem 0.5rem 0.5rem", overflowX: "auto" }}>
                        {statusLabels}
                        {comparisonTable}

                        {showPullRequests && (
                            <Commits
                                commitPanelProps={{
                                    ...commitPanelProps,
                                    defaultExpanded: true
                                }}
                                data={IBGroup}
                                expandAllCommits={true}
                                targetPrNumber={this.props.targetPrNumber}
                            />
                        )}
                    </Card.Body>
                )}
            </Card>
        );
    }
}

IBGroupFrame.defaultProps = {
    showPullRequests: false
};

export default IBGroupFrame;