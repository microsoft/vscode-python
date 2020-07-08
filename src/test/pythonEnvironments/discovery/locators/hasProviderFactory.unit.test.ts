// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-classes-per-file max-func-body-length

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { instance, mock } from 'ts-mockito';
import { IInterpreterHashProvider } from '../../../../client/interpreter/locators/types';
import { InterpreterHashProvider } from '../../../../client/pythonEnvironments/discovery/locators/services/hashProvider';
import { InterpeterHashProviderFactory } from '../../../../client/pythonEnvironments/discovery/locators/services/hashProviderFactory';
import { WindowsStoreInterpreter } from '../../../../client/pythonEnvironments/discovery/locators/services/windowsStoreInterpreter';

use(chaiAsPromised);

suite('Interpreters - Interpreter Hash Provider Factory', () => {
    let windowsStoreInterpreter: IInterpreterHashProvider;
    let standardHashProvider: IInterpreterHashProvider;
    let factory: InterpeterHashProviderFactory;
    const storePythonPath =
        'C:\\Users\\SomeUser\\AppData\\Local\\Microsoft\\WindowsApps\\PythonSoftwareFoundation.Python.3.8\\python.exe';
    const nonStorePythonPath = 'C:\\Python.3.8\\python.exe';
    setup(() => {
        windowsStoreInterpreter = mock(WindowsStoreInterpreter);
        standardHashProvider = mock(InterpreterHashProvider);
        const windowsStoreProviderInstance = instance(windowsStoreInterpreter);
        const standardHashProviderInstance = instance(standardHashProvider);
        (windowsStoreProviderInstance as any).then = undefined;
        (standardHashProviderInstance as any).tenn = undefined;
        factory = new InterpeterHashProviderFactory(windowsStoreProviderInstance, standardHashProviderInstance);
    });
    test('When provided python path is not a window store interpreter return standard hash provider', async () => {
        const provider = await factory.create(nonStorePythonPath);
        expect(provider).to.deep.equal(instance(standardHashProvider));
    });
    test('When provided python path is a windows store interpreter return windows store hash provider', async () => {
        const provider = await factory.create(storePythonPath);
        expect(provider).to.deep.equal(instance(windowsStoreInterpreter));
    });
});
