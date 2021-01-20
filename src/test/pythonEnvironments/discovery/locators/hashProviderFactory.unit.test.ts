// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { ConfigurationService } from '../../../../client/common/configuration/service';
import { IConfigurationService } from '../../../../client/common/types';
import { IComponentAdapter } from '../../../../client/interpreter/contracts';
import { IInterpreterHashProvider } from '../../../../client/interpreter/locators/types';
import { InterpreterHashProvider } from '../../../../client/pythonEnvironments/discovery/locators/services/hashProvider';
import { InterpeterHashProviderFactory } from '../../../../client/pythonEnvironments/discovery/locators/services/hashProviderFactory';
import { WindowsStoreInterpreter } from '../../../../client/pythonEnvironments/discovery/locators/services/windowsStoreInterpreter';

use(chaiAsPromised);

suite('Interpreters - Interpreter Hash Provider Factory', () => {
    let configService: IConfigurationService;
    let windowsStoreInterpreter: WindowsStoreInterpreter;
    let standardHashProvider: IInterpreterHashProvider;
    let factory: InterpeterHashProviderFactory;
    let pyenvs: IComponentAdapter;
    setup(() => {
        configService = mock(ConfigurationService);
        windowsStoreInterpreter = mock(WindowsStoreInterpreter);
        standardHashProvider = mock(InterpreterHashProvider);
        pyenvs = mock<IComponentAdapter>();
        const windowsStoreInstance = instance(windowsStoreInterpreter);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (windowsStoreInstance as any).then = undefined;
        factory = new InterpeterHashProviderFactory(
            instance(configService),
            windowsStoreInstance,
            instance(standardHashProvider),
            instance(pyenvs),
        );
    });
    test('When provided python path is not a Windows store interpreter return standard hash provider', async () => {
        const pythonPath = 'NonWindowsInterpreterPath';
        when(pyenvs.isWindowsStoreInterpreter(pythonPath)).thenResolve(false);

        const provider = await factory.create({ pythonPath });

        expect(provider).to.deep.equal(instance(standardHashProvider));
        verify(pyenvs.isWindowsStoreInterpreter(pythonPath)).once();
    });
    test('When provided python path is a Windows store interpreter return Windows store hash provider', async () => {
        const pythonPath = 'NonWindowsInterpreterPath';
        when(pyenvs.isWindowsStoreInterpreter(pythonPath)).thenResolve(true);

        const provider = await factory.create({ pythonPath });

        expect(provider).to.deep.equal(instance(windowsStoreInterpreter));
        verify(pyenvs.isWindowsStoreInterpreter(pythonPath)).once();
    });
    test('When provided resource resolves to a python path that is not a Windows store interpreter return standard hash provider', async () => {
        const pythonPath = 'NonWindowsInterpreterPath';
        const resource = Uri.file('1');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        when(configService.getSettings(resource)).thenReturn({ pythonPath } as any);
        when(pyenvs.isWindowsStoreInterpreter(pythonPath)).thenResolve(false);

        const provider = await factory.create({ resource });

        expect(provider).to.deep.equal(instance(standardHashProvider));
        verify(pyenvs.isWindowsStoreInterpreter(pythonPath)).once();
    });
    test('When provided resource resolves to a python path that is a Windows store interpreter return windows store hash provider', async () => {
        const pythonPath = 'NonWindowsInterpreterPath';
        const resource = Uri.file('1');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        when(configService.getSettings(resource)).thenReturn({ pythonPath } as any);
        when(pyenvs.isWindowsStoreInterpreter(pythonPath)).thenResolve(true);

        const provider = await factory.create({ resource });

        expect(provider).to.deep.equal(instance(windowsStoreInterpreter));
        verify(pyenvs.isWindowsStoreInterpreter(pythonPath)).once();
    });
});
