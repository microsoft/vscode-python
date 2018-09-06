// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as TypeMoq from 'typemoq';
import { Disposable, WorkspaceConfiguration } from 'vscode';
import {
    IApplicationShell, ICommandManager, IWorkspaceService
} from '../../client/common/application/types';
import {
    FeatureDeprecationManager
} from '../../client/common/featureDeprecationManager';
import {
    IPersistentState, IPersistentStateFactory
} from '../../client/common/types';

suite('Feature Deprecation Manager Tests', () => {
    test('Ensure deprecated command Build_Workspace_Symbols registers its popup', () => {
        const persistentState: TypeMoq.IMock<IPersistentStateFactory> = TypeMoq.Mock.ofType<IPersistentStateFactory>();
        const persistentBool: TypeMoq.IMock<IPersistentState<boolean>> = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        persistentBool.setup(a => a.value).returns(() => true);
        persistentBool.setup(a => a.updateValue(TypeMoq.It.isValue(false)))
            .returns(() => Promise.resolve());
        persistentState.setup(
            a => a.createGlobalPersistentState(
                TypeMoq.It.isValue('SHOW_DEPRECATED_FEATURE_PROMPT_BUILD_WORKSPACE_SYMBOLS'),
                TypeMoq.It.isValue(true)
            ))
            .returns(() => persistentBool.object)
            .verifiable(TypeMoq.Times.once());
        const popupMgr: TypeMoq.IMock<IApplicationShell> = TypeMoq.Mock.ofType<IApplicationShell>();
        popupMgr.setup(
            p => p.showInformationMessage(
                TypeMoq.It.isAnyString(),
                TypeMoq.It.isAnyString(),
                TypeMoq.It.isAnyString()
            ))
            .returns((val) => new Promise<string>((resolve, reject) => { resolve('Learn More'); }));
        const cmdDisposable: TypeMoq.IMock<Disposable> = TypeMoq.Mock.ofType<Disposable>();
        const cmdManager: TypeMoq.IMock<ICommandManager> = TypeMoq.Mock.ofType<ICommandManager>();
        cmdManager.setup(
            c => c.registerCommand(
                TypeMoq.It.isValue('python.buildWorkspaceSymbols'),
                TypeMoq.It.isAny(),
                TypeMoq.It.isAny()
            ))
            .returns(() => cmdDisposable.object)
            .verifiable(TypeMoq.Times.atLeastOnce());
        const workspaceConfig: TypeMoq.IMock<WorkspaceConfiguration> = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        workspaceConfig.setup(ws => ws.has(TypeMoq.It.isAnyString()))
            .returns(() => false)
            .verifiable(TypeMoq.Times.atLeastOnce());
        const workspace: TypeMoq.IMock<IWorkspaceService> = TypeMoq.Mock.ofType<IWorkspaceService>();
        workspace.setup(
            w => w.getConfiguration(
                TypeMoq.It.isValue('python'),
                TypeMoq.It.isAny()
            ))
            .returns(() => workspaceConfig.object);
        const featureDepMgr: FeatureDeprecationManager = new FeatureDeprecationManager(
            persistentState.object,
            cmdManager.object,
            workspace.object,
            popupMgr.object);

        featureDepMgr.initialize();
    });
});
