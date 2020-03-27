// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as vscodeTypes from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IDisposableRegistry } from '../../common/types';
import { LaunchJsonCodeActionProvider } from './launchJsonCodeActionProvider';

@injectable()
export class CodeActionProviderService implements IExtensionSingleActivationService {
    constructor(@inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry) {}
    public async activate(): Promise<void> {
        // tslint:disable-next-line:no-require-imports
        const vscode = require('vscode') as typeof vscodeTypes;
        const documentSelector: vscodeTypes.DocumentFilter = {
            scheme: 'file',
            language: 'jsonc',
            pattern: '**/launch.json',
        };
        this.disposableRegistry.push(
            vscode.languages.registerCodeActionsProvider(documentSelector, new LaunchJsonCodeActionProvider(), {
                providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
            })
        );
    }
}
