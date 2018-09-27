// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ConfigurationTarget, WorkspaceConfiguration } from 'vscode';

export class ScopedPythonPathUpdater {

    private scopeField: string;
    constructor(
        private cfgTarget: ConfigurationTarget,
        private getConfig: () => WorkspaceConfiguration,
        private adjustValue?: (string) => string
    ) {
        switch (this.cfgTarget) {
            case ConfigurationTarget.Workspace:
                this.scopeField = 'workspaceValue';
                break;
            case ConfigurationTarget.WorkspaceFolder:
                this.scopeField = 'workspaceFolderValue';
                break;
            case ConfigurationTarget.Global:
                this.scopeField = 'globalValue';
                break;
            default:
                throw Error('unsupported configuration target');
        }
    }

    public async updatePythonPath(pythonPath: string): Promise<void> {
        const pythonConfig = this.getConfig();

        const existing = pythonConfig.inspect<string>('pythonPath');
        if (existing && existing[this.scopeField] === pythonPath) {
            return;
        }

        if (this.adjustValue) {
            pythonPath = this.adjustValue(pythonPath);
        }

        await pythonConfig.update('pythonPath', pythonPath, this.cfgTarget);
    }
}
