// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as React from 'react';

// tslint:disable:no-any
interface IVariableExplorerRowProps {
    renderBaseRow(props: any): JSX.Element;
}

export const VariableExplorerRowRenderer: React.SFC<IVariableExplorerRowProps & any> = (props) => {
    return <div role="row">{props.renderBaseRow(props)}</div>;
};
