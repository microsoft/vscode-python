import * as React from 'react';
import { IFont } from './mainState';

interface ITrustMessageProps {
    isNotebookTrusted: boolean;
    font: IFont;
}

export class TrustMessage extends React.Component<ITrustMessageProps> {
    public render() {
        const text = this.props.isNotebookTrusted ? 'Trusted' : 'Not Trusted';
        const textSize = text.length;
        const dynamicFont: React.CSSProperties = {
            fontSize: 'var(--vscode-font-size)', // Use the same font and size as the menu
            fontFamily: 'var(--vscode-font-family)',
            maxWidth: this.getMaxWidth(textSize + 5), // plus 5 for the line and margins,
            color: this.props.isNotebookTrusted ? undefined : 'red'
        };
        const trustTextWidth: React.CSSProperties = {
            maxWidth: this.getMaxWidth(textSize)
        };

        return (
            <div className="kernel-status" style={dynamicFont}>
                <div className="kernel-status-section kernel-status-server" style={trustTextWidth} role="button">
                    <div className="kernel-status-text">{text}</div>
                </div>
                <div className="kernel-status-divider" />
            </div>
        );
    }
    private getMaxWidth(charLength: number): string {
        // This comes from a linear regression
        const width = 0.57674 * charLength + 1.70473;
        const unit = 'em';
        return Math.round(width).toString() + unit;
    }
}
