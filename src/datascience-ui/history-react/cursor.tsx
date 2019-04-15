// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as React from 'react';
import './cursor.css';

export interface ICursorProps {
    codeInFocus: boolean;
    hidden: boolean;
    left: number;
    top: number;
    bottom: number;
    text: string;
    cursorType: string;
}

export class Cursor extends React.Component<ICursorProps> {

    constructor(props: ICursorProps) {
        super(props);
    }

    public render() {
        const style : React.CSSProperties = this.props.bottom > 0 ? {
            left : `${this.props.left}px`,
            top: `${this.props.top}px`,
            height: `${this.props.bottom - this.props.top}px`
        } : {
            left : `${this.props.left}px`,
            top: `${this.props.top}px`
        };

        if (this.props.hidden) {
            return null;
        } else if (this.props.codeInFocus) {
            return this.renderInFocus(style);
        } else {
            return this.renderOutOfFocus(style);
        }
    }

    private getRenderText() : string {
        // Verify that we have some non-whitespace letter. slice(0,1) is legal on empty string
        let renderText = this.props.text.slice(0, 1).trim();
        if (renderText.length === 0) {
            renderText = 'A';
        }

        return renderText;
    }

    private renderInFocus = (style: React.CSSProperties) => {
        const cursorClass = `cursor-top cursor-${this.props.cursorType}-overlay`;
        const textClass = this.props.cursorType !== 'block' || this.props.text.slice(0, 1).trim().length === 0 ? 'cursor-measure' : 'cursor-text';
        return <div className={cursorClass} style={style}><div className={textClass}>{this.getRenderText()}</div></div>;
    }

    private renderOutOfFocus = (style: React.CSSProperties) => {
        const cursorClass = `cursor-top cursor-${this.props.cursorType}`;
        return <div className={cursorClass} style={style}><div className='cursor-measure'>{this.getRenderText()}</div></div>;
    }
}
