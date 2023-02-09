// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as vscodeTypes from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { Commands } from '../../common/constants';
import { IDisposableRegistry } from '../../common/types';
import { executeCommand, registerCommand } from '../../common/vscodeApis/commandApis';
import { isExtensionEnabled } from '../../common/vscodeApis/extensionsApi';
import { IServiceContainer } from '../../ioc/types';
import { traceLog } from '../../logging';
import { getOrCreateISortPrompt, ISORT_EXTENSION } from './isortPrompt';
import { LaunchJsonCodeActionProvider } from './launchJsonCodeActionProvider';

@injectable()
export class CodeActionProviderService implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: false, virtualWorkspace: false };

    constructor(
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
    ) {}

    public async activate(): Promise<void> {
        // eslint-disable-next-line global-require
        const vscode = require('vscode') as typeof vscodeTypes;
        const documentSelector: vscodeTypes.DocumentFilter = {
            scheme: 'file',
            language: 'jsonc',
            pattern: '**/launch.json',
        };
        this.disposableRegistry.push(
            vscode.languages.registerCodeActionsProvider(documentSelector, new LaunchJsonCodeActionProvider(), {
                providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
            }),
        );
        this.disposableRegistry.push(
            registerCommand(Commands.Sort_Imports, async () => {
                const prompt = getOrCreateISortPrompt(this.serviceContainer);
                await prompt.showPrompt();
                if (!isExtensionEnabled(ISORT_EXTENSION)) {
                    traceLog(
                        'Sort Imports: Please install and enable `ms-python.isort` extension to use this feature.',
                    );
                    return;
                }

                executeCommand('editor.action.organizeImports');
            }),
        );
    }
}
