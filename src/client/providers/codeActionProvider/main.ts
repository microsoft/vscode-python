// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { languages, DocumentFilter, CodeActionKind } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IDisposableRegistry } from '../../common/types';
import { LaunchJsonCodeActionProvider } from './launchJsonCodeActionProvider';

@injectable()
export class CodeActionProviderService implements IExtensionSingleActivationService {
    constructor(@inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry) {}
    public async activate(): Promise<void> {
        const documentSelector: DocumentFilter = {
            scheme: 'file',
            language: 'jsonc',
            pattern: '**/launch.json',
        };
        this.disposableRegistry.push(
            languages.registerCodeActionsProvider(documentSelector, new LaunchJsonCodeActionProvider(), {
                providedCodeActionKinds: [CodeActionKind.QuickFix],
            }),
        );
    }
}
