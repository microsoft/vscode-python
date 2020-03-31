// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { DataScienceIocContainer } from './dataScienceIocContainer';

export function addMockData(
    ioc: DataScienceIocContainer,
    code: string,
    result: string | number | undefined | string[],
    mimeType?: string | string[],
    cellType?: string
) {
    if (ioc.mockJupyter) {
        if (cellType && cellType === 'error') {
            ioc.mockJupyter.addError(code, result ? result.toString() : '');
        } else {
            if (result) {
                ioc.mockJupyter.addCell(code, result, mimeType);
            } else {
                ioc.mockJupyter.addCell(code);
            }
        }
    }
}
