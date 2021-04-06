// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaisAsPromised from 'chai-as-promised';
import { anything, capture, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { TestFileCodeNavigator } from '../../../client/testing/navigation/fileNavigator';
import { TestNavigatorHelper } from '../../../client/testing/navigation/helper';
import { ITestNavigatorHelper } from '../../../client/testing/navigation/types';

use(chaisAsPromised);

suite('Unit Tests - Navigation File', () => {
    let navigator: TestFileCodeNavigator;
    let helper: ITestNavigatorHelper;
    setup(() => {
        helper = mock(TestNavigatorHelper);
        navigator = new TestFileCodeNavigator(instance(helper));
    });
    test('Ensure file is opened', async () => {
        const filePath = Uri.file('some file Path');
        when(helper.openFile(anything())).thenResolve();

        await navigator.navigateTo(filePath, { fullPath: filePath.fsPath } as any, false);

        verify(helper.openFile(anything())).once();
        expect(capture(helper.openFile).first()[0]!.fsPath).to.equal(filePath.fsPath);
    });
    test('Ensure errors are swallowed', async () => {
        const filePath = Uri.file('some file Path');
        when(helper.openFile(anything())).thenReject(new Error('kaboom'));

        await navigator.navigateTo(filePath, { fullPath: filePath.fsPath } as any, false);

        verify(helper.openFile(anything())).once();
        expect(capture(helper.openFile).first()[0]!.fsPath).to.equal(filePath.fsPath);
    });
});
