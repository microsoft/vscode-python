// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as vscode from 'vscode';

import { UseCustomEditorApi } from '../constants';
import { noop } from '../utils/misc';
import { CustomEditorProvider, ICommandManager, ICustomEditorService } from './types';

@injectable()
export class CustomEditorService implements ICustomEditorService {
    constructor(
        @inject(ICommandManager) private commandManager: ICommandManager,
        @inject(UseCustomEditorApi) private readonly useCustomEditorApi: boolean
    ) {}

    public registerCustomEditorProvider(
        viewType: string,
        provider: CustomEditorProvider,
        options?: vscode.WebviewPanelOptions
    ): vscode.Disposable {
        if (this.useCustomEditorApi) {
            // tslint:disable-next-line: no-any
            return (vscode.window as any).registerCustomEditorProvider(viewType, provider, options);
        } else {
            return { dispose: noop };
        }
    }

    public async openEditor(file: vscode.Uri): Promise<void> {
        if (this.useCustomEditorApi) {
            await this.commandManager.executeCommand('vscode.open', file);
        }
    }
}
