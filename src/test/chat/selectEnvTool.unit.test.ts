// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { CancellationTokenSource } from 'vscode';
import { SelectPythonEnvTool } from '../../client/chat/selectEnvTool';

suite('Select Python Environment Tool', () => {
    test('Does not request confirmation before showing the environment picker', async () => {
        const tool = Object.create(SelectPythonEnvTool.prototype) as SelectPythonEnvTool;
        const tokenSource = new CancellationTokenSource();

        try {
            const result = await tool.prepareInvocation(
                { input: { resourcePath: '/workspace' } },
                tokenSource.token,
            );

            expect(result.confirmationMessages).to.be.undefined;
        } finally {
            tokenSource.dispose();
        }
    });
});
