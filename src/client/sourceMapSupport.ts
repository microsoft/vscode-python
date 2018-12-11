// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { WorkspaceConfiguration } from 'vscode';
type VSCode = typeof import('vscode');

// tslint:disable:no-require-imports
const setting = 'sourceMapsEnabled';

export class SourceMapSupport {
    private readonly config: WorkspaceConfiguration;
    constructor(private readonly vscode: VSCode) {
        this.config = this.vscode.workspace.getConfiguration('python.diagnostics', undefined);
    }
    public async initialize(): Promise<void> {
        if (!this.enabled) {
            return;
        }
        this.initializeSourceMaps();
        const localize = require('./common/utils/localize') as typeof import('./common/utils/localize');
        const disable = localize.Diagnostics.disableSourceMaps();
        const selection = await this.vscode.window.showWarningMessage(localize.Diagnostics.warnSourceMaps(), disable);
        if (selection === disable) {
            await this.disable();
        }
    }
    public get enabled(): boolean {
        return this.config.get<boolean>(setting, false);
    }
    public async disable(): Promise<void> {
        await this.config.update(setting, false, this.vscode.ConfigurationTarget.Global);
    }
    protected initializeSourceMaps() {
        require('./node_modules/source-map-support').install();
    }
}
// tslint:disable-next-line:no-default-export
export default function initialize(vscode: VSCode) {
    new SourceMapSupport(vscode).initialize().catch(ex => {
        console.error('Failed to initialize source map support in extension');
    });
}
