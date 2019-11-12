// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:chai-vague-errors no-unused-expression max-func-body-length no-any

import { expect } from 'chai';
import { anything, instance, mock, when } from 'ts-mockito';
import { WorkspaceService } from '../../client/common/application/workspace';
import { ConfigurationService } from '../../client/common/configuration/service';
import { PylintLinterInfo } from '../../client/linters/linterInfo';

suite('Linter Info - Pylint', () => {
    test('Test disabled when Pylint is explicitly disabled', async () => {
        const config = mock(ConfigurationService);
        const workspaceService = mock(WorkspaceService);
        const linterInfo = new PylintLinterInfo(instance(config), instance(workspaceService), []);

        when(config.getSettings(anything())).thenReturn({ linting: { pylintEnabled: false } } as any);

        expect(linterInfo.isEnabled()).to.be.false;
    });
    test('Test disabled when Jedi is enabled and Pylint is explicitly disabled', async () => {
        const config = mock(ConfigurationService);
        const workspaceService = mock(WorkspaceService);
        const linterInfo = new PylintLinterInfo(instance(config), instance(workspaceService), []);

        when(config.getSettings(anything())).thenReturn({ linting: { pylintEnabled: false }, jediEnabled: true } as any);

        expect(linterInfo.isEnabled()).to.be.false;
    });
    test('Test enabled when Jedi is enabled and Pylint is explicitly enabled', async () => {
        const config = mock(ConfigurationService);
        const workspaceService = mock(WorkspaceService);
        const linterInfo = new PylintLinterInfo(instance(config), instance(workspaceService), []);

        when(config.getSettings(anything())).thenReturn({ linting: { pylintEnabled: true }, jediEnabled: true } as any);

        expect(linterInfo.isEnabled()).to.be.true;
    });
    test('Test disabled when using Language Server and Pylint is not configured', async () => {
        const config = mock(ConfigurationService);
        const workspaceService = mock(WorkspaceService);
        const linterInfo = new PylintLinterInfo(instance(config), instance(workspaceService), []);

        const inspection = {};
        const pythonConfig = {
            inspect: () => inspection
        };
        when(config.getSettings(anything())).thenReturn({ linting: { pylintEnabled: true }, jediEnabled: false } as any);
        when(workspaceService.getConfiguration('python', anything())).thenReturn(pythonConfig as any);

        expect(linterInfo.isEnabled()).to.be.false;
    });
    const testsForisEnabled = [
        {
            testName: 'When workspaceFolder setting is provided',
            inspection: { workspaceFolderValue: true }
        },
        {
            testName: 'When workspace setting is provided',
            inspection: { workspaceValue: true }
        },
        {
            testName: 'When global setting is provided',
            inspection: { globalValue: true }
        }
    ];

    suite('Test is enabled when using Language Server and Pylint is configured', () => {
        testsForisEnabled.forEach(testParams => {
            test(testParams.testName, async () => {
                const config = mock(ConfigurationService);
                const workspaceService = mock(WorkspaceService);
                const linterInfo = new PylintLinterInfo(instance(config), instance(workspaceService), []);

                const pythonConfig = {
                    inspect: () => testParams.inspection
                };
                when(config.getSettings(anything())).thenReturn({ linting: { pylintEnabled: true }, jediEnabled: false } as any);
                when(workspaceService.getConfiguration('python', anything())).thenReturn(pythonConfig as any);

                expect(linterInfo.isEnabled()).to.be.true;
            });
        });
    });
});
