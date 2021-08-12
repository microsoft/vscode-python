// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { instance, mock } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';
import { IMultiStepInput, IMultiStepInputFactory } from '../../../../client/common/utils/multiStepInput';
import { PythonDebugConfigurationService } from '../../../../client/debugger/extension/configuration/debugConfigurationService';
import { DebugConfigurationProviderFactory } from '../../../../client/debugger/extension/configuration/providers/providerFactory';
import { IDebugConfigurationResolver } from '../../../../client/debugger/extension/configuration/types';
import { DebugConfigurationState } from '../../../../client/debugger/extension/types';
import { AttachRequestArguments, LaunchRequestArguments } from '../../../../client/debugger/types';

suite('Debugging - Configuration Service', () => {
    let attachResolver: typemoq.IMock<IDebugConfigurationResolver<AttachRequestArguments>>;
    let launchResolver: typemoq.IMock<IDebugConfigurationResolver<LaunchRequestArguments>>;
    let configService: TestPythonDebugConfigurationService;
    let multiStepFactory: typemoq.IMock<IMultiStepInputFactory>;
    let providerFactory: DebugConfigurationProviderFactory;

    class TestPythonDebugConfigurationService extends PythonDebugConfigurationService {
        public async pickDebugConfiguration(
            input: IMultiStepInput<DebugConfigurationState>,
            state: DebugConfigurationState,
        ) {
            return super.pickDebugConfiguration(input, state);
        }
    }
    setup(() => {
        attachResolver = typemoq.Mock.ofType<IDebugConfigurationResolver<AttachRequestArguments>>();
        launchResolver = typemoq.Mock.ofType<IDebugConfigurationResolver<LaunchRequestArguments>>();
        multiStepFactory = typemoq.Mock.ofType<IMultiStepInputFactory>();
        providerFactory = mock(DebugConfigurationProviderFactory);
        configService = new TestPythonDebugConfigurationService(
            attachResolver.object,
            launchResolver.object,
            instance(providerFactory),
            multiStepFactory.object,
        );
    });
    test('Should use attach resolver when passing attach config', async () => {
        const config = ({
            request: 'attach',
        } as any) as AttachRequestArguments;
        const folder = { name: '1', index: 0, uri: Uri.parse('1234') };
        const expectedConfig = { yay: 1 };

        attachResolver
            .setup((a) =>
                a.resolveDebugConfiguration(typemoq.It.isValue(folder), typemoq.It.isValue(config), typemoq.It.isAny()),
            )
            .returns(() => Promise.resolve(expectedConfig as any))
            .verifiable(typemoq.Times.once());
        launchResolver
            .setup((a) => a.resolveDebugConfiguration(typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny()))
            .verifiable(typemoq.Times.never());

        const resolvedConfig = await configService.resolveDebugConfiguration(folder, config as any);

        expect(resolvedConfig).to.deep.equal(expectedConfig);
        attachResolver.verifyAll();
        launchResolver.verifyAll();
    });
    [{ request: 'launch' }, { request: undefined }].forEach((config) => {
        test(`Should use launch resolver when passing launch config with request=${config.request}`, async () => {
            const folder = { name: '1', index: 0, uri: Uri.parse('1234') };
            const expectedConfig = { yay: 1 };

            launchResolver
                .setup((a) =>
                    a.resolveDebugConfiguration(
                        typemoq.It.isValue(folder),
                        typemoq.It.isValue((config as any) as LaunchRequestArguments),
                        typemoq.It.isAny(),
                    ),
                )
                .returns(() => Promise.resolve(expectedConfig as any))
                .verifiable(typemoq.Times.once());
            attachResolver
                .setup((a) => a.resolveDebugConfiguration(typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny()))
                .verifiable(typemoq.Times.never());

            const resolvedConfig = await configService.resolveDebugConfiguration(folder, config as any);

            expect(resolvedConfig).to.deep.equal(expectedConfig);
            attachResolver.verifyAll();
            launchResolver.verifyAll();
        });
    });
    test('Picker should be displayed', async () => {
        const state = ({ configs: [], folder: {}, token: undefined } as any) as DebugConfigurationState;
        const multiStepInput = typemoq.Mock.ofType<IMultiStepInput<DebugConfigurationState>>();
        multiStepInput
            .setup((i) => i.showQuickPick(typemoq.It.isAny()))
            .returns(() => Promise.resolve(undefined as any))
            .verifiable(typemoq.Times.once());

        await configService.pickDebugConfiguration(multiStepInput.object, state);

        multiStepInput.verifyAll();
    });
    test('Existing Configuration items must be removed before displaying picker', async () => {
        const state = ({ configs: [1, 2, 3], folder: {}, token: undefined } as any) as DebugConfigurationState;
        const multiStepInput = typemoq.Mock.ofType<IMultiStepInput<DebugConfigurationState>>();
        multiStepInput
            .setup((i) => i.showQuickPick(typemoq.It.isAny()))
            .returns(() => Promise.resolve(undefined as any))
            .verifiable(typemoq.Times.once());

        await configService.pickDebugConfiguration(multiStepInput.object, state);

        multiStepInput.verifyAll();
        expect(Object.keys(state.config)).to.be.lengthOf(0);
    });
    test('Ensure generated config is returned', async () => {
        const expectedConfig = { yes: 'Updated' };
        const multiStepInput = {
            run: (_: any, state: any) => {
                Object.assign(state.config, expectedConfig);
                return Promise.resolve();
            },
        };
        multiStepFactory
            .setup((f) => f.create())
            .returns(() => multiStepInput as any)
            .verifiable(typemoq.Times.once());
        configService.pickDebugConfiguration = (_, state) => {
            Object.assign(state.config, expectedConfig);
            return Promise.resolve();
        };
        const config = await configService.provideDebugConfigurations!({} as any);

        multiStepFactory.verifyAll();
        expect(config).to.deep.equal([expectedConfig]);
    });
    test('Ensure `undefined` is returned if QuickPick is cancelled', async () => {
        const multiStepInput = {
            run: () => Promise.resolve(),
        };
        const folder = { name: '1', index: 0, uri: Uri.parse('1234') };
        multiStepFactory
            .setup((f) => f.create())
            .returns(() => multiStepInput as any)
            .verifiable(typemoq.Times.once());
        const config = await configService.resolveDebugConfiguration(folder, {} as any);

        multiStepFactory.verifyAll();

        expect(config).to.equal(undefined, `Config should be undefined`);
    });
    test('Use cached debug configuration', async () => {
        const folder = { name: '1', index: 0, uri: Uri.parse('1234') };
        const expectedConfig = {
            name: 'File',
            type: 'python',
            request: 'launch',
            program: '${file}',
            console: 'integratedTerminal',
        };
        const multiStepInput = {
            run: (_: any, state: any) => {
                Object.assign(state.config, expectedConfig);
                return Promise.resolve();
            },
        };
        multiStepFactory
            .setup((f) => f.create())
            .returns(() => multiStepInput as any)
            .verifiable(typemoq.Times.once()); // this should be called only once.

        launchResolver
            .setup((a) => a.resolveDebugConfiguration(typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => Promise.resolve(expectedConfig as any))
            .verifiable(typemoq.Times.exactly(2)); // this should be called twice with the same config.

        await configService.resolveDebugConfiguration(folder, {} as any);
        await configService.resolveDebugConfiguration(folder, {} as any);

        multiStepFactory.verifyAll();
        launchResolver.verifyAll();
    });
});
