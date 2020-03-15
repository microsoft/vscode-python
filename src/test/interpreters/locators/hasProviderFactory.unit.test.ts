// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-classes-per-file max-func-body-length

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { IConfigurationService } from '../../../client/common/types';
import { InterpreterHashProvider } from '../../../client/interpreter/locators/services/hashProvider';
import { InterpeterHashProviderFactory } from '../../../client/interpreter/locators/services/hashProviderFactory';
import { WindowsStoreInterpreter } from '../../../client/interpreter/locators/services/windowsStoreInterpreter';
import { IInterpreterHashProvider } from '../../../client/interpreter/locators/types';

use(chaiAsPromised);

suite('Interpretersx - Interpreter Hash Provider Factory', () => {
    let configService: IConfigurationService;
    let windowsStoreInterpreter: WindowsStoreInterpreter;
    let standardHashProvider: IInterpreterHashProvider;
    let factory: InterpeterHashProviderFactory;
    setup(() => {
        configService = mock(ConfigurationService);
        windowsStoreInterpreter = mock(WindowsStoreInterpreter);
        standardHashProvider = mock(InterpreterHashProvider);
        const windowsStoreInstance = instance(windowsStoreInterpreter);
        (windowsStoreInstance as any).then = undefined;
        factory = new InterpeterHashProviderFactory(
            instance(configService),
            windowsStoreInstance,
            windowsStoreInstance,
            instance(standardHashProvider)
        );
    });
    test('When provided python path is not a window store interpreter return standard hash provider', async () => {
        const pythonPath = 'NonWindowsInterpreterPath';
        when(windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath)).thenReturn(false);

        const provider = await factory.create({ pythonPath });

        expect(provider).to.deep.equal(instance(standardHashProvider));
        verify(windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath)).once();
    });
    test('When provided python path is a windows store interpreter return windows store hash provider', async () => {
        const pythonPath = 'NonWindowsInterpreterPath';
        when(windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath)).thenReturn(true);

        const provider = await factory.create({ pythonPath });

        expect(provider).to.deep.equal(instance(windowsStoreInterpreter));
        verify(windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath)).once();
    });
    test('When provided resource resolves to a python path that is not a window store interpreter return standard hash provider', async () => {
        const pythonPath = 'NonWindowsInterpreterPath';
        const resource = Uri.file('1');
        when(configService.getSettings(resource)).thenReturn({ pythonPath } as any);
        when(windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath)).thenReturn(false);

        const provider = await factory.create({ resource });

        expect(provider).to.deep.equal(instance(standardHashProvider));
        verify(windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath)).once();
    });
    test('When provided resource resolves to a python path that is a windows store interpreter return windows store hash provider', async () => {
        const pythonPath = 'NonWindowsInterpreterPath';
        const resource = Uri.file('1');
        when(configService.getSettings(resource)).thenReturn({ pythonPath } as any);
        when(windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath)).thenReturn(true);

        const provider = await factory.create({ resource });

        expect(provider).to.deep.equal(instance(windowsStoreInterpreter));
        verify(windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath)).once();
    });
});
