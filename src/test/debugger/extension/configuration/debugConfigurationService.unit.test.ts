// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as typemoq from 'typemoq';
import { DebugConfiguration, Uri } from 'vscode';
import { IMultiStepInputFactory, MultiStepInput } from '../../../../client/common/utils/multiStepInput';
import { PythonDebugConfigurationService } from '../../../../client/debugger/extension/configuration/debugConfigurationService';
import { IDebugConfigurationResolver } from '../../../../client/debugger/extension/configuration/types';
import { DebugConfigurationState } from '../../../../client/debugger/extension/types';
import { AttachRequestArguments, LaunchRequestArguments } from '../../../../client/debugger/types';

suite('Debugging - Configuration Service', () => {
    let attachResolver: typemoq.IMock<IDebugConfigurationResolver<AttachRequestArguments>>;
    let launchResolver: typemoq.IMock<IDebugConfigurationResolver<LaunchRequestArguments>>;
    let configService: TestPythonDebugConfigurationService;
    let multiStepFactory: typemoq.IMock<IMultiStepInputFactory>;

    class TestPythonDebugConfigurationService extends PythonDebugConfigurationService {
        public static async pickDebugConfiguration(
            input: MultiStepInput<DebugConfigurationState>,
            state: DebugConfigurationState,
        ) {
            return PythonDebugConfigurationService.pickDebugConfiguration(input, state);
        }
    }
    setup(() => {
        attachResolver = typemoq.Mock.ofType<IDebugConfigurationResolver<AttachRequestArguments>>();
        launchResolver = typemoq.Mock.ofType<IDebugConfigurationResolver<LaunchRequestArguments>>();
        multiStepFactory = typemoq.Mock.ofType<IMultiStepInputFactory>();

        configService = new TestPythonDebugConfigurationService(
            attachResolver.object,
            launchResolver.object,
            multiStepFactory.object,
        );
    });
    test('Should use attach resolver when passing attach config', async () => {
        const config = ({
            request: 'attach',
        } as DebugConfiguration) as AttachRequestArguments;
        const folder = { name: '1', index: 0, uri: Uri.parse('1234') };
        const expectedConfig = { yay: 1 };

        attachResolver
            .setup((a) =>
                a.resolveDebugConfiguration(typemoq.It.isValue(folder), typemoq.It.isValue(config), typemoq.It.isAny()),
            )
            .returns(() => Promise.resolve((expectedConfig as unknown) as AttachRequestArguments))
            .verifiable(typemoq.Times.once());
        launchResolver
            .setup((a) => a.resolveDebugConfiguration(typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny()))
            .verifiable(typemoq.Times.never());

        const resolvedConfig = await configService.resolveDebugConfiguration(folder, config as DebugConfiguration);

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
                        typemoq.It.isValue((config as DebugConfiguration) as LaunchRequestArguments),
                        typemoq.It.isAny(),
                    ),
                )
                .returns(() => Promise.resolve((expectedConfig as unknown) as LaunchRequestArguments))
                .verifiable(typemoq.Times.once());
            attachResolver
                .setup((a) => a.resolveDebugConfiguration(typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny()))
                .verifiable(typemoq.Times.never());

            const resolvedConfig = await configService.resolveDebugConfiguration(folder, config as DebugConfiguration);

            expect(resolvedConfig).to.deep.equal(expectedConfig);
            attachResolver.verifyAll();
            launchResolver.verifyAll();
        });
    });
    test('Picker should be displayed', async () => {
        const state = ({ configs: [], folder: {}, token: undefined } as unknown) as DebugConfigurationState;
        const multiStepInput = typemoq.Mock.ofType<MultiStepInput<DebugConfigurationState>>();
        multiStepInput
            .setup((i) => i.showQuickPick(typemoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(typemoq.Times.once());

        await TestPythonDebugConfigurationService.pickDebugConfiguration(multiStepInput.object, state);

        multiStepInput.verifyAll();
    });
    test('Existing Configuration items must be removed before displaying picker', async () => {
        const state = ({ configs: [1, 2, 3], folder: {}, token: undefined } as unknown) as DebugConfigurationState;
        const multiStepInput = typemoq.Mock.ofType<MultiStepInput<DebugConfigurationState>>();
        multiStepInput
            .setup((i) => i.showQuickPick(typemoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(typemoq.Times.once());

        await TestPythonDebugConfigurationService.pickDebugConfiguration(multiStepInput.object, state);

        multiStepInput.verifyAll();
        expect(Object.keys(state.config)).to.be.lengthOf(0);
    });
    test('Ensure generated config is returned', async () => {
        const expectedConfig = { yes: 'Updated' };
        const multiStepInput = {
            run: (_: unknown, state: DebugConfiguration) => {
                Object.assign(state.config, expectedConfig);
                return Promise.resolve();
            },
        };
        multiStepFactory
            .setup((f) => f.create())
            .returns(() => multiStepInput as MultiStepInput<unknown>)
            .verifiable(typemoq.Times.once());
        TestPythonDebugConfigurationService.pickDebugConfiguration = (_, state) => {
            Object.assign(state.config, expectedConfig);
            return Promise.resolve();
        };
        const config = await configService.provideDebugConfigurations!(({} as unknown) as undefined);

        multiStepFactory.verifyAll();
        expect(config).to.deep.equal([expectedConfig]);
    });
    test('Ensure `undefined` is returned if QuickPick is cancelled', async () => {
        const multiStepInput = {
            run: (_: unknown, _state: DebugConfiguration) => Promise.resolve(),
        };
        const folder = { name: '1', index: 0, uri: Uri.parse('1234') };
        multiStepFactory
            .setup((f) => f.create())
            .returns(() => multiStepInput as MultiStepInput<unknown>)
            .verifiable(typemoq.Times.once());
        const config = await configService.resolveDebugConfiguration(folder, {} as DebugConfiguration);

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
            run: (_: unknown, state: DebugConfiguration) => {
                Object.assign(state.config, expectedConfig);
                return Promise.resolve();
            },
        };
        multiStepFactory
            .setup((f) => f.create())
            .returns(() => multiStepInput as MultiStepInput<unknown>)
            .verifiable(typemoq.Times.once()); // this should be called only once.

        launchResolver
            .setup((a) => a.resolveDebugConfiguration(typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => Promise.resolve(expectedConfig as LaunchRequestArguments))
            .verifiable(typemoq.Times.exactly(2)); // this should be called twice with the same config.

        await configService.resolveDebugConfiguration(folder, {} as DebugConfiguration);
        await configService.resolveDebugConfiguration(folder, {} as DebugConfiguration);

        multiStepFactory.verifyAll();
        launchResolver.verifyAll();
    });
});
