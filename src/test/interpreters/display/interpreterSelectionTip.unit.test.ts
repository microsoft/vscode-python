// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anything, instance, mock, verify, when } from 'ts-mockito';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { IApplicationShell } from '../../../client/common/application/types';
import { PersistentState, PersistentStateFactory } from '../../../client/common/persistentState';
import { IPersistentState } from '../../../client/common/types';
import { Common, Interpreters } from '../../../client/common/utils/localize';
import { InterpreterSelectionTip } from '../../../client/interpreter/display/interpreterSelectionTip';

// tslint:disable:no-any
suite('Interpreters - Interpreter Selection Tip', () => {
    let selectionTip: InterpreterSelectionTip;
    let appShell: IApplicationShell;
    let storage: IPersistentState<boolean>;
    setup(() => {
        const factory = mock(PersistentStateFactory);
        storage = mock(PersistentState);
        appShell = mock(ApplicationShell);

        when(factory.createGlobalPersistentState('InterpreterSelectionTip', false)).thenReturn(instance(storage));

        selectionTip = new InterpreterSelectionTip(instance(appShell), instance(factory));
    });
    test('Do not show tip', async () => {
        when(storage.value).thenReturn(true);

        await selectionTip.activate();

        verify(appShell.showInformationMessage(anything(), anything())).never();
    });
    test('Show tip and do not track it', async () => {
        when(storage.value).thenReturn(false);
        when(appShell.showInformationMessage(Interpreters.selectInterpreterTip(), Common.gotIt())).thenResolve();

        await selectionTip.activate();

        verify(appShell.showInformationMessage(Interpreters.selectInterpreterTip(), Common.gotIt())).once();
        verify(storage.updateValue(true)).never();
    });
    test('Show tip and track it', async () => {
        when(storage.value).thenReturn(false);
        when(appShell.showInformationMessage(Interpreters.selectInterpreterTip(), Common.gotIt())).thenResolve(
            Common.gotIt() as any
        );

        await selectionTip.activate();

        verify(appShell.showInformationMessage(Interpreters.selectInterpreterTip(), Common.gotIt())).once();
        verify(storage.updateValue(true)).once();
    });
});
