// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-require-imports no-var-requires max-func-body-length no-unnecessary-override no-invalid-template-strings no-any

import { expect } from 'chai';
import * as path from 'path';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { Uri, WorkspaceConfiguration } from 'vscode';
import { PythonSettings } from '../../../client/common/configSettings';
import { noop } from '../../../client/common/utils/misc';
import { MockAutoSelectionService } from '../../mocks/autoSelector';
const untildify = require('untildify');

suite('Python Settings - pythonPath', () => {
    class CustomPythonSettings extends PythonSettings {
        public update(settings: WorkspaceConfiguration) {
            return super.update(settings);
        }
        protected getPythonExecutable(pythonPath: string) {
            return pythonPath;
        }
        protected initialize() {
            noop();
        }
    }
    let configSettings: CustomPythonSettings;
    let pythonSettings: typemoq.IMock<WorkspaceConfiguration>;
    setup(() => {
        pythonSettings = typemoq.Mock.ofType<WorkspaceConfiguration>();
    });
    teardown(() => {
        if (configSettings) {
            configSettings.dispose();
        }
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
    test("If we don't have a custom python path and we do have an auto selected interpreter, then use it", () => {
        const pythonPath = path.join(__dirname, 'this is a python path that was auto selected');
        const interpreter: any = { path: pythonPath };
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
        verify(selectionService.getAutoSelectedInterpreter(workspaceFolderUri)).once();
    });
});
