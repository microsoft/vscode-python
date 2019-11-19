// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
// import { isTestExecution } from '../../client/common/constants';

// // The logs generated here are super massive, hence CI logs are unsable, Azure Pipelines don't even display the test results, just one line in the log stating that it has failed.
// const enableLogger = !process.env.VSCODE_PYTHON_ROLLING && (!isTestExecution() || process.env.VSC_PYTHON_FORCE_LOGGING || process.env.VSC_PYTHON_LOG_FILE);

export function logMessage(_message: string) {
    // // Might want to post this back to the other side too. This was
    // // put here to prevent having to disable the console log warning

    // if (enableLogger) {
    //     // tslint:disable-next-line: no-console
    //     console.log(message);
    // }
}
