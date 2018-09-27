// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, WorkspaceConfiguration } from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { GlobalPythonPathUpdaterService } from '../../../client/interpreter/configuration/services/globalUpdaterService';

// tslint:disable:no-invalid-template-strings max-func-body-length

suite('GlobalPythonPathUpdaterService', () => {
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let workspaceConfig: TypeMoq.IMock<WorkspaceConfiguration>;

    setup(() => {
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>(undefined, TypeMoq.MockBehavior.Strict);
        workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>(undefined, TypeMoq.MockBehavior.Strict);

        workspaceService.setup(w => w.getConfiguration(TypeMoq.It.isValue('python'))).returns(() => workspaceConfig.object);
    });

    test('Python Path should not be updated when current pythonPath is the same', async () => {
        const pythonPath = `xGlobalPythonPath${new Date().getMilliseconds()}`;
        workspaceConfig.setup(w => w.inspect(TypeMoq.It.isValue('pythonPath')))
            .returns(() => ({
                key: 'python.pythonPath',
                globalValue: pythonPath
            }));

        const updater = new GlobalPythonPathUpdaterService(workspaceService.object);
        await updater.updatePythonPath(pythonPath);

        workspaceService.verifyAll();
        workspaceConfig.verifyAll();
    });

    test('Python Path should be updated when current pythonPath is different', async () => {
        const pythonPath = `xGlobalPythonPath${new Date().getMilliseconds()}`;
        workspaceConfig.setup(w => w.inspect(TypeMoq.It.isValue('pythonPath')))
            .returns(() => undefined);
        workspaceConfig.setup(w => w.update('pythonPath', pythonPath, ConfigurationTarget.Global))
            .returns(() => Promise.resolve());

        const updater = new GlobalPythonPathUpdaterService(workspaceService.object);
        await updater.updatePythonPath(pythonPath);

        workspaceService.verifyAll();
        workspaceConfig.verifyAll();
    });
});
