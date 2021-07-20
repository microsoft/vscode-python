// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { Uri, WorkspaceConfiguration } from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { PythonSettings } from '../../../client/common/configSettings';
import { DeprecatePythonPath } from '../../../client/common/experiments/groups';
import { IExperimentService, IInterpreterPathService } from '../../../client/common/types';
import { noop } from '../../../client/common/utils/misc';
import { PythonEnvironment } from '../../../client/pythonEnvironments/info';
import * as EnvFileTelemetry from '../../../client/telemetry/envFileTelemetry';
import { MockAutoSelectionService } from '../../mocks/autoSelector';

const untildify = require('untildify');

suite('Python Settings - pythonPath', () => {
    class CustomPythonSettings extends PythonSettings {
        public update(settings: WorkspaceConfiguration) {
            return super.update(settings);
        }

        // eslint-disable-next-line class-methods-use-this
        protected getPythonExecutable(pythonPath: string) {
            return pythonPath;
        }

        // eslint-disable-next-line class-methods-use-this
        public initialize() {
            noop();
        }
    }
    let configSettings: CustomPythonSettings;
    let workspaceService: typemoq.IMock<IWorkspaceService>;
    let experimentsManager: typemoq.IMock<IExperimentService>;
    let interpreterPathService: typemoq.IMock<IInterpreterPathService>;
    let pythonSettings: typemoq.IMock<WorkspaceConfiguration>;
    setup(() => {
        pythonSettings = typemoq.Mock.ofType<WorkspaceConfiguration>();
        sinon.stub(EnvFileTelemetry, 'sendSettingTelemetry').returns();
        interpreterPathService = typemoq.Mock.ofType<IInterpreterPathService>();
        experimentsManager = typemoq.Mock.ofType<IExperimentService>();
        workspaceService = typemoq.Mock.ofType<IWorkspaceService>();
        pythonSettings.setup((p) => p.get(typemoq.It.isValue('defaultInterpreterPath'))).returns(() => 'python');
        pythonSettings.setup((p) => p.get('logging')).returns(() => ({ level: 'error' }));
    });
    teardown(() => {
        if (configSettings) {
            configSettings.dispose();
        }
        sinon.restore();
    });

    test('Python Path from settings.json is used', () => {
        configSettings = new CustomPythonSettings(undefined, new MockAutoSelectionService());
        const pythonPath = 'This is the python Path';
        pythonSettings
            .setup((p) => p.get(typemoq.It.isValue('pythonPath')))
            .returns(() => pythonPath)
            .verifiable(typemoq.Times.atLeast(1));
        configSettings.update(pythonSettings.object);

        expect(configSettings.pythonPath).to.be.equal(pythonPath);
    });
    test("Python Path from settings.json is used and relative path starting with '~' will be resolved from home directory", () => {
        configSettings = new CustomPythonSettings(undefined, new MockAutoSelectionService());
        const pythonPath = `~${path.sep}This is the python Path`;
        pythonSettings
            .setup((p) => p.get(typemoq.It.isValue('pythonPath')))
            .returns(() => pythonPath)
            .verifiable(typemoq.Times.atLeast(1));
        configSettings.update(pythonSettings.object);

        expect(configSettings.pythonPath).to.be.equal(untildify(pythonPath));
    });
    test("Python Path from settings.json is used and relative path starting with '.' will be resolved from workspace folder", () => {
        const workspaceFolderUri = Uri.file(__dirname);
        configSettings = new CustomPythonSettings(workspaceFolderUri, new MockAutoSelectionService());
        const pythonPath = `.${path.sep}This is the python Path`;
        pythonSettings
            .setup((p) => p.get(typemoq.It.isValue('pythonPath')))
            .returns(() => pythonPath)
            .verifiable(typemoq.Times.atLeast(1));

        configSettings.update(pythonSettings.object);

        expect(configSettings.pythonPath).to.be.equal(path.resolve(workspaceFolderUri.fsPath, pythonPath));
    });
    test('Python Path from settings.json is used and ${workspacecFolder} value will be resolved from workspace folder', () => {
        const workspaceFolderUri = Uri.file(__dirname);
        configSettings = new CustomPythonSettings(workspaceFolderUri, new MockAutoSelectionService());
        const workspaceFolderToken = '${workspaceFolder}';
        const pythonPath = `${workspaceFolderToken}${path.sep}This is the python Path`;
        pythonSettings
            .setup((p) => p.get(typemoq.It.isValue('pythonPath')))
            .returns(() => pythonPath)
            .verifiable(typemoq.Times.atLeast(1));
        configSettings.update(pythonSettings.object);

        expect(configSettings.pythonPath).to.be.equal(path.join(workspaceFolderUri.fsPath, 'This is the python Path'));
    });
    test("If we don't have a custom python path and no auto selected interpreters, then use default", () => {
        const workspaceFolderUri = Uri.file(__dirname);
        const selectionService = mock(MockAutoSelectionService);
        configSettings = new CustomPythonSettings(workspaceFolderUri, instance(selectionService));
        const pythonPath = 'python';
        pythonSettings
            .setup((p) => p.get(typemoq.It.isValue('pythonPath')))
            .returns(() => pythonPath)
            .verifiable(typemoq.Times.atLeast(1));
        configSettings.update(pythonSettings.object);

        expect(configSettings.pythonPath).to.be.equal('python');
    });
    test("If a workspace is opened and if we don't have a custom python path but we do have an auto selected interpreter, then use it", () => {
        const pythonPath = path.join(__dirname, 'this is a python path that was auto selected');
        const interpreter = { path: pythonPath } as PythonEnvironment;
        const workspaceFolderUri = Uri.file(__dirname);
        const selectionService = mock(MockAutoSelectionService);
        when(selectionService.getAutoSelectedInterpreter(workspaceFolderUri)).thenReturn(interpreter);
        when(selectionService.setWorkspaceInterpreter(workspaceFolderUri, anything())).thenResolve();
        configSettings = new CustomPythonSettings(workspaceFolderUri, instance(selectionService));
        pythonSettings
            .setup((p) => p.get(typemoq.It.isValue('pythonPath')))
            .returns(() => 'python')
            .verifiable(typemoq.Times.atLeast(1));
        configSettings.update(pythonSettings.object);

        expect(configSettings.pythonPath).to.be.equal(pythonPath);
        verify(selectionService.setWorkspaceInterpreter(workspaceFolderUri, interpreter)).once(); // Verify we set the autoselected interpreter
    });
    test("If no workspace is opened and we don't have a custom python path but we do have an auto selected interpreter, then use it", () => {
        const pythonPath = path.join(__dirname, 'this is a python path that was auto selected');
        const interpreter = { path: pythonPath } as PythonEnvironment;
        const workspaceFolderUri = Uri.file(__dirname);
        const selectionService = mock(MockAutoSelectionService);
        when(selectionService.getAutoSelectedInterpreter(workspaceFolderUri)).thenReturn(interpreter);
        when(selectionService.setWorkspaceInterpreter(workspaceFolderUri, anything())).thenResolve();
        configSettings = new CustomPythonSettings(workspaceFolderUri, instance(selectionService));
        pythonSettings
            .setup((p) => p.get(typemoq.It.isValue('pythonPath')))
            .returns(() => 'python')
            .verifiable(typemoq.Times.atLeast(1));
        configSettings.update(pythonSettings.object);

        expect(configSettings.pythonPath).to.be.equal(pythonPath);
    });
    test("If we don't have a custom default python path and we do have an auto selected interpreter, then use it", () => {
        const pythonPath = path.join(__dirname, 'this is a python path that was auto selected');
        const interpreter = { path: pythonPath } as PythonEnvironment;
        const workspaceFolderUri = Uri.file(__dirname);
        const selectionService = mock(MockAutoSelectionService);
        when(selectionService.getAutoSelectedInterpreter(workspaceFolderUri)).thenReturn(interpreter);
        configSettings = new CustomPythonSettings(workspaceFolderUri, instance(selectionService));
        pythonSettings.setup((p) => p.get(typemoq.It.isValue('pythonPath'))).returns(() => 'custom');
        pythonSettings.setup((p) => p.get(typemoq.It.isValue('defaultInterpreterPath'))).returns(() => 'python');
        configSettings.update(pythonSettings.object);

        expect(configSettings.defaultInterpreterPath).to.be.equal(pythonPath);
    });
    test("If user is in Deprecate Python Path experiment and we don't have a custom python path, get the autoselected interpreter and use it if it's safe", () => {
        const resource = Uri.parse('a');
        const pythonPath = path.join(__dirname, 'this is a python path that was auto selected');
        const interpreter = { path: pythonPath } as PythonEnvironment;
        const selectionService = mock(MockAutoSelectionService);
        when(selectionService.getAutoSelectedInterpreter(resource)).thenReturn(interpreter);
        when(selectionService.setWorkspaceInterpreter(resource, anything())).thenResolve();
        configSettings = new CustomPythonSettings(
            resource,
            instance(selectionService),
            workspaceService.object,
            experimentsManager.object,
            interpreterPathService.object,
        );
        experimentsManager
            .setup((e) => e.inExperimentSync(DeprecatePythonPath.experiment))
            .returns(() => true)
            .verifiable(typemoq.Times.once());
        interpreterPathService.setup((i) => i.get(resource)).returns(() => 'python');
        configSettings.update(pythonSettings.object);

        expect(configSettings.pythonPath).to.be.equal(pythonPath);
        experimentsManager.verifyAll();
        interpreterPathService.verifyAll();
        pythonSettings.verifyAll();
    });
    test('If user is in Deprecate Python Path experiment, use the new API to fetch Python Path', () => {
        const resource = Uri.parse('a');
        configSettings = new CustomPythonSettings(
            resource,
            new MockAutoSelectionService(),
            workspaceService.object,
            experimentsManager.object,
            interpreterPathService.object,
        );
        const pythonPath = 'This is the new API python Path';
        pythonSettings.setup((p) => p.get(typemoq.It.isValue('pythonPath'))).verifiable(typemoq.Times.never());
        experimentsManager
            .setup((e) => e.inExperimentSync(DeprecatePythonPath.experiment))
            .returns(() => true)
            .verifiable(typemoq.Times.once());
        interpreterPathService
            .setup((i) => i.get(resource))
            .returns(() => pythonPath)
            .verifiable(typemoq.Times.once());
        configSettings.update(pythonSettings.object);

        expect(configSettings.pythonPath).to.be.equal(pythonPath);
        experimentsManager.verifyAll();
        interpreterPathService.verifyAll();
        pythonSettings.verifyAll();
    });
    test('If user is not in Deprecate Python Path experiment, use the settings to fetch Python Path', () => {
        const resource = Uri.parse('a');
        configSettings = new CustomPythonSettings(
            resource,
            new MockAutoSelectionService(),
            workspaceService.object,
            experimentsManager.object,
            interpreterPathService.object,
        );
        const pythonPath = 'This is the settings python Path';
        pythonSettings
            .setup((p) => p.get(typemoq.It.isValue('pythonPath')))
            .returns(() => pythonPath)
            .verifiable(typemoq.Times.atLeastOnce());
        experimentsManager
            .setup((e) => e.inExperimentSync(DeprecatePythonPath.experiment))
            .returns(() => false)
            .verifiable(typemoq.Times.once());
        interpreterPathService.setup((i) => i.get(resource)).verifiable(typemoq.Times.never());
        configSettings.update(pythonSettings.object);

        expect(configSettings.pythonPath).to.be.equal(pythonPath);
        experimentsManager.verifyAll();
        interpreterPathService.verifyAll();
        pythonSettings.verifyAll();
    });
});
