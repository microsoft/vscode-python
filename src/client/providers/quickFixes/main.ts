// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import * as vscodeTypes from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { QuickFixLaunchJson } from './fixLaunchJson';

@injectable()
export class QuickFixService implements IExtensionSingleActivationService {
    public async activate(): Promise<void> {
        // tslint:disable-next-line:no-require-imports
        const vscode = require('vscode') as typeof vscodeTypes;
        const documentSelector: vscodeTypes.DocumentFilter = {
            scheme: 'file',
            language: 'jsonc',
            pattern: '**/launch.json'
        };
        vscode.languages.registerCodeActionsProvider(documentSelector, new QuickFixLaunchJson(), {
            providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
        });
    }
}
