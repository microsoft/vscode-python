// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { LanguageServerExtension } from '../../../client/activation/languageServer/languageServerExtension';
import { CommandManager } from '../../../client/common/application/commandManager';
import { ICommandManager } from '../../../client/common/application/types';
import { IDisposable } from '../../../client/common/types';

use(chaiAsPromised);

// tslint:disable:max-func-body-length no-any chai-vague-errors no-unused-expression

const loadExtensionCommand = 'python._loadLanguageServerExtension';

suite('Language Server - Language Server Extension', () => {
    class LanguageServerExtensionTest extends LanguageServerExtension {
        // tslint:disable-next-line:no-unnecessary-override
        public async register(): Promise<void> {
            return super.register();
        }
        public clearLoadExtensionArgs() {
            super.loadExtensionArgs = undefined;
        }
    }
    let extension: LanguageServerExtensionTest;
    let cmdManager: ICommandManager;
    let commandRegistrationDisposable: typemoq.IMock<IDisposable>;
    setup(() => {
        cmdManager = mock(CommandManager);
        commandRegistrationDisposable = typemoq.Mock.ofType<IDisposable>();
        extension = new LanguageServerExtensionTest(instance(cmdManager));
        extension.clearLoadExtensionArgs();
    });
    test('Must register command handler', async () => {
        when(cmdManager.registerCommand(loadExtensionCommand, anything())).thenReturn(
            commandRegistrationDisposable.object,
        );
        await extension.register();
        verify(cmdManager.registerCommand(loadExtensionCommand, anything())).once();
        extension.dispose();
        commandRegistrationDisposable.verify((d) => d.dispose(), typemoq.Times.once());
    });
});
