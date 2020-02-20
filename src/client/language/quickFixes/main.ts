// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { CodeActionKind, DocumentFilter, languages } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { QuickFixLaunchJson } from './fixLaunchJson';

@injectable()
export class QuickFixService implements IExtensionSingleActivationService {
    public async activate(): Promise<void> {
        const documentSelector: DocumentFilter = {
            scheme: 'file',
            language: 'jsonc',
            pattern: '**/launch.json'
        };
        languages.registerCodeActionsProvider(documentSelector, new QuickFixLaunchJson(), {
            providedCodeActionKinds: [CodeActionKind.QuickFix]
        });
    }
}
