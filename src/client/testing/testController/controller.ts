// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TestController } from 'vscode';
/* eslint-disable */

// This is a place holder for a controller
export class PythonTestController implements TestController<any> {
    public createWorkspaceTestRoot() {
        return undefined;
    }

    public createDocumentTestRoot() {
        return undefined;
    }

    public runTests() {}
}
