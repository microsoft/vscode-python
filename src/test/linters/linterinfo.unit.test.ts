// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as sinon from 'sinon';
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
            languageServer: LanguageServerType.Jedi,
        } as any);

        expect(linterInfo.isEnabled()).to.be.false;
    });
    test('Test disabled when Jedi is enabled and Pylint is explicitly disabled', async () => {
        const linterInfo = new PylintLinterInfo(instance(config), instance(workspace), []);

        when(config.getSettings(anything())).thenReturn({
            linting: { pylintEnabled: false },
            languageServer: LanguageServerType.Jedi,
        } as any);

        expect(linterInfo.isEnabled()).to.be.false;
    });
    test('Test enabled when Jedi is enabled and Pylint is explicitly enabled', async () => {
        const linterInfo = new PylintLinterInfo(instance(config), instance(workspace), []);

        when(config.getSettings(anything())).thenReturn({
            linting: { pylintEnabled: true },
            languageServer: LanguageServerType.Jedi,
        } as any);

        expect(linterInfo.isEnabled()).to.be.true;
    });
    test('Test disabled when using language server and Pylint is not configured', async () => {
        const linterInfo = new PylintLinterInfo(instance(config), instance(workspace), []);

        when(config.getSettings(anything())).thenReturn({
            linting: { pylintEnabled: true },
            languageServer: LanguageServerType.Microsoft,
        } as any);

        const pythonConfig = {
            inspect: () => {},
        };
        when(workspace.getConfiguration('python', anything())).thenReturn(pythonConfig as any);

        expect(linterInfo.isEnabled()).to.be.false;
    });
    test('Should inspect the value of linting.pylintEnabled when using language server', async () => {
        const linterInfo = new PylintLinterInfo(instance(config), instance(workspace), []);
        const inspectStub = sinon.stub();
        const pythonConfig = {
            inspect: inspectStub,
        };

        when(config.getSettings(anything())).thenReturn({
            linting: { pylintEnabled: true },
            languageServer: LanguageServerType.Microsoft,
        } as any);
        when(workspace.getConfiguration('python', anything())).thenReturn(pythonConfig as any);

        expect(linterInfo.isEnabled()).to.be.false;
        expect(inspectStub.calledOnceWith('linting.pylintEnabled')).to.be.true;
    });
    const testsForisEnabled = [
        {
            testName: 'When workspaceFolder setting is provided',
            inspection: { workspaceFolderValue: true },
        },
        {
            testName: 'When workspace setting is provided',
            inspection: { workspaceValue: true },
        },
        {
            testName: 'When global setting is provided',
            inspection: { globalValue: true },
        },
    ];

    suite('Test is enabled when using Language Server and Pylint is configured', () => {
        testsForisEnabled.forEach((testParams) => {
            test(testParams.testName, async () => {
                const config = mock(ConfigurationService);
                const workspaceService = mock(WorkspaceService);
                const linterInfo = new PylintLinterInfo(instance(config), instance(workspaceService), []);

                const pythonConfig = {
                    inspect: () => testParams.inspection,
                };
                when(config.getSettings(anything())).thenReturn({
                    linting: { pylintEnabled: true },
                    languageServer: LanguageServerType.Microsoft,
                } as any);
                when(workspaceService.getConfiguration('python', anything())).thenReturn(pythonConfig as any);

                expect(linterInfo.isEnabled()).to.be.true;
            });
        });
    });
});
