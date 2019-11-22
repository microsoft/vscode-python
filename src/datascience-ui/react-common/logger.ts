// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { isTestExecution } from '../../client/common/constants';

const enableLogger = !isTestExecution() || process.env.VSC_PYTHON_FORCE_LOGGING || process.env.VSC_PYTHON_LOG_FILE;

export function logMessage(message: string) {
    // Might want to post this back to the other side too. This was
    // put here to prevent having to disable the console log warning

    if (enableLogger) {
        console.error('hello');
        // tslint:disable-next-line: no-console
        console.log(message);
    }
}
