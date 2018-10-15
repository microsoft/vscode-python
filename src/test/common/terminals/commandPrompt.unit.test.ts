// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget } from 'vscode';
import { getCommandPromptLocation, useCommandPromptAsDefaultShell } from '../../../client/common/terminal/commandPrompt';
import { IConfigurationService, ICurrentProcess } from '../../../client/common/types';

suite('Terminal Command Prompt', () => {
    let currentProc: TypeMoq.IMock<ICurrentProcess>;
    let configService: TypeMoq.IMock<IConfigurationService>;

    setup(() => {
        currentProc = TypeMoq.Mock.ofType<ICurrentProcess>();
        configService = TypeMoq.Mock.ofType<IConfigurationService>();
    });

    test('Getting Path Command Prompt executable (32 bit)', async () => {
        const env = { PROCESSOR_ARCHITEW6432: '', windir: 'windir' };
        currentProc.setup(p => p.env)
            .returns(() => env)
            .verifiable(TypeMoq.Times.once());

        const cmdPath = getCommandPromptLocation(currentProc.object);

        expect(cmdPath).to.be.deep.equal(path.join('windir', 'System32', 'cmd.exe'));
        currentProc.verifyAll();
    });
    test('Getting Path Command Prompt executable (64 bit)', async () => {
        const env = { windir: 'windir' };
        currentProc.setup(p => p.env)
            .returns(() => env)
            .verifiable(TypeMoq.Times.once());

        const cmdPath = getCommandPromptLocation(currentProc.object);

        expect(cmdPath).to.be.deep.equal(path.join('windir', 'Sysnative', 'cmd.exe'));
        currentProc.verifyAll();
    });
    test('Use command prompt as default shell', async () => {
        const env = { windir: 'windir' };
        currentProc.setup(p => p.env)
            .returns(() => env)
            .verifiable(TypeMoq.Times.once());
        const cmdPromptPath = path.join('windir', 'Sysnative', 'cmd.exe');
        configService
            .setup(c => c.updateSettingAsync(TypeMoq.It.isValue('terminal.integrated.shell.windows'),
                TypeMoq.It.isValue(cmdPromptPath), TypeMoq.It.isValue(undefined),
                TypeMoq.It.isValue(ConfigurationTarget.Global)))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());

        await useCommandPromptAsDefaultShell(currentProc.object, configService.object);
        configService.verifyAll();
        currentProc.verifyAll();
    });
});
