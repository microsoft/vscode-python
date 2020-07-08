// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as React from 'react';
import { getLocString } from '../react-common/locReactSide';
import { getMaxWidth } from './utils';

interface ITrustMessageProps {
    shouldShowTrustMessage: boolean;
    isNotebookTrusted?: boolean;
    launchNotebookTrustPrompt?(): void; // Native editor-specific
}

export class TrustMessage extends React.PureComponent<ITrustMessageProps> {
    public render() {
        const text = this.props.isNotebookTrusted
            ? getLocString('DataScience.notebookIsTrusted', 'Trusted')
            : getLocString('DataScience.notebookIsNotTrusted', 'Not Trusted');
        const textSize = text.length;
        const maxWidth: React.CSSProperties = {
            maxWidth: getMaxWidth(textSize + 5) // plus 5 for the line and margins,
        };
        const dynamicStyle: React.CSSProperties = {
            maxWidth: getMaxWidth(textSize),
            color: this.props.isNotebookTrusted ? undefined : 'var(--vscode-editorError-foreground)',
            cursor: this.props.isNotebookTrusted ? undefined : 'pointer'
        };

        return (
            <div className="kernel-status" style={maxWidth}>
                <button
                    type="button"
                    disabled={this.props.isNotebookTrusted}
                    aria-disabled={this.props.isNotebookTrusted}
                    className={`jupyter-info-section${
                        this.props.isNotebookTrusted ? '' : ' jupyter-info-section-hoverable'
                    }`} // Disable animation on hover for already-trusted notebooks
                    style={dynamicStyle}
                    onClick={this.props.launchNotebookTrustPrompt}
                >
                    <div className="kernel-status-text">{text}</div>
                </button>
                <div className="kernel-status-divider" />
            </div>
        );
    }
}
