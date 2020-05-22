// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:chai-vague-errors no-unused-expression max-func-body-length no-any

import { expect } from 'chai';
import { anything, instance, mock, when } from 'ts-mockito';
import { LanguageServerType } from '../../client/activation/types';
import { WorkspaceService } from '../../client/common/application/workspace';
import { ConfigurationService } from '../../client/common/configuration/service';
import { PylintLinterInfo } from '../../client/linters/linterInfo';

suite('Linter Info - Pylint', () => {
    const workspace = mock(WorkspaceService);
    const config = mock(ConfigurationService);

    test('Test disabled when Pylint is explicitly disabled', async () => {
        const linterInfo = new PylintLinterInfo(instance(config), instance(workspace), []);

        when(config.getSettings(anything())).thenReturn({
            linting: { pylintEnabled: false },
            languageServer: LanguageServerType.Jedi
        } as any);

        expect(linterInfo.isEnabled()).to.be.false;
    });
    test('Test disabled when Jedi is enabled and Pylint is explicitly disabled', async () => {
        const linterInfo = new PylintLinterInfo(instance(config), instance(workspace), []);

        when(config.getSettings(anything())).thenReturn({
            linting: { pylintEnabled: false },
            languageServer: LanguageServerType.Jedi
        } as any);

        expect(linterInfo.isEnabled()).to.be.false;
    });
    test('Test enabled when Jedi is enabled and Pylint is explicitly enabled', async () => {
        const linterInfo = new PylintLinterInfo(instance(config), instance(workspace), []);

        when(config.getSettings(anything())).thenReturn({
            linting: { pylintEnabled: true },
            languageServer: LanguageServerType.Jedi
        } as any);

        expect(linterInfo.isEnabled()).to.be.true;
    });
    test('Test disabled when using Language Server and Pylint is not configured', async () => {
        const linterInfo = new PylintLinterInfo(instance(config), instance(workspace), []);

        when(config.getSettings(anything())).thenReturn({
            linting: { pylintEnabled: true },
            languageServer: LanguageServerType.Microsoft
        } as any);

        const pythonConfig = {
            // tslint:disable-next-line:no-empty
            inspect: () => {}
        };
        when(workspace.getConfiguration('python', anything())).thenReturn(pythonConfig as any);

        expect(linterInfo.isEnabled()).to.be.false;
    });
});
