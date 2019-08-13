// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { LanguageServerOutputChannel } from '../../../client/activation/languageServer/outputChannel';
import { IApplicationShell } from '../../../client/common/application/types';
import { IOutputChannel } from '../../../client/common/types';
import { OutputChannelNames } from '../../../client/common/utils/localize';

suite('Language Server Output Channel', () => {
    let appShell: TypeMoq.IMock<IApplicationShell>;
    let languageServerOutputChannel: LanguageServerOutputChannel;
    let output: IOutputChannel;
    setup(() => {
        appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        output = TypeMoq.Mock.ofType<IOutputChannel>().object;
        languageServerOutputChannel = new LanguageServerOutputChannel(appShell.object);
    });

    test('Create output channel if one does not exist before and return it', async () => {
        appShell
            .setup(a => a.createOutputChannel(OutputChannelNames.languageServer()))
            .returns(() => output)
            .verifiable(TypeMoq.Times.once());
        const channel = languageServerOutputChannel.channel;
        appShell.verifyAll();
        expect(channel).to.not.equal(undefined, 'Channel should not be undefined');
    });

    test('Do not create output channel if one already exists', async () => {
        languageServerOutputChannel.output = output;
        appShell
            .setup(a => a.createOutputChannel(TypeMoq.It.isAny()))
            .returns(() => output)
            .verifiable(TypeMoq.Times.never());
        const channel = languageServerOutputChannel.channel;
        appShell.verifyAll();
        expect(channel).to.not.equal(undefined, 'Channel should not be undefined');
    });
});
