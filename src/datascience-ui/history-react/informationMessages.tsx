// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './informationMessages.css';

import * as React from 'react';

// tslint:disable-next-line:match-default-export-name import-name
interface IInformationMessagesProps
{
    messages: string[];
    type: 'execute' | 'preview';
}

export class InformationMessages extends React.Component<IInformationMessagesProps> {
    constructor(prop: IInformationMessagesProps) {
        super(prop);
    }

    public render() {
        const output = this.props.messages.join('\n');
        const wrapperClassName = this.props.type === 'preview' ? 'messages-wrapper messages-wrapper-preview' : 'messages-wrapper';
        const outerClassName = this.props.type === 'preview' ? 'messages-outer messages-outer-preview' : 'messages-outer';

        return (
            <div className={wrapperClassName}>
                <div className={outerClassName}>
                    <div className='messages-result-container'>
                        <pre><span>{output}</span></pre>
                    </div>
                </div>
            </div>
        );
    }
}
