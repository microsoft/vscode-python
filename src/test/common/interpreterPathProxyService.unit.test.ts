// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Uri, WorkspaceConfiguration } from 'vscode';
import * as TypeMoq from 'typemoq';
import { expect } from 'chai';
import { InterpreterPathProxyService } from '../../client/common/interpreterPathProxyService';
import { IExperimentService, IInterpreterPathProxyService, IInterpreterPathService } from '../../client/common/types';
import { IWorkspaceService } from '../../client/common/application/types';
import { DeprecatePythonPath } from '../../client/common/experiments/groups';

suite('Interpreter Path Proxy Service', async () => {
    let interpreterPathProxyService: IInterpreterPathProxyService;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let experiments: TypeMoq.IMock<IExperimentService>;
    let interpreterPathService: TypeMoq.IMock<IInterpreterPathService>;
    const resource = Uri.parse('a');
    const interpreterPath = 'path/to/interpreter';
    setup(() => {
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        experiments = TypeMoq.Mock.ofType<IExperimentService>();
        interpreterPathService = TypeMoq.Mock.ofType<IInterpreterPathService>();
        workspaceService
            .setup((w) => w.getWorkspaceFolder(resource))
            .returns(() => ({
                uri: resource,
                name: 'Workspacefolder',
                index: 0,
            }));
        interpreterPathProxyService = new InterpreterPathProxyService(
            interpreterPathService.object,
            experiments.object,
            workspaceService.object,
        );
    });

    test('When in experiment, use interpreter path service to get setting value', () => {
        experiments.setup((e) => e.inExperimentSync(DeprecatePythonPath.experiment)).returns(() => true);
        interpreterPathService.setup((i) => i.get(resource)).returns(() => interpreterPath);
        const value = interpreterPathProxyService.get(resource);
        expect(value).to.equal(interpreterPath);
    });

    test('When not in experiment, use workspace service to get setting value', () => {
        experiments.setup((e) => e.inExperimentSync(DeprecatePythonPath.experiment)).returns(() => false);
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        workspaceService.setup((i) => i.getConfiguration('python', resource)).returns(() => workspaceConfig.object);
        workspaceConfig.setup((w) => w.get('pythonPath')).returns(() => interpreterPath);
        const value = interpreterPathProxyService.get(resource);
        expect(value).to.equal(interpreterPath);
    });
});
