// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as React from 'react';
import { getLocString } from '../react-common/locReactSide';

interface ITrimmedOutputMessage {
    openSettings(setting?: string): void;
}

export class TrimmedOutputMessage extends React.PureComponent<ITrimmedOutputMessage> {
    constructor(props: ITrimmedOutputMessage) {
        super(props);
    }

    public render() {
        const newLine = '\n...\n';
        return (
            <a
                onClick={this.changeTextOutputLimit}
                role="button"
                className="image-button-image outputTrimmedSettingsLink"
            >
                {getLocString(
                    'DataScience.trimmedOutput',
                    'Output was trimmed for performance reasons.\nTo see the full output set the setting "python.dataScience.textOutputLimit" to 0.'
                ) + newLine}
            </a>
        );
    }
    private changeTextOutputLimit = () => {
        this.props.openSettings('python.dataScience.textOutputLimit');
    };
}
