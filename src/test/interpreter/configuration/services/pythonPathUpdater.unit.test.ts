// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, WorkspaceConfiguration } from 'vscode';
import {
    ScopedPythonPathUpdater
} from '../../../../client/interpreter/configuration/services/pythonPathUpdater';

// tslint:disable:max-func-body-length

suite('ScopedPythonPathUpdater', () => {
    const cfgTarget = ConfigurationTarget.Global;
    let getConfig: TypeMoq.IMock<() => WorkspaceConfiguration>;
    let config: TypeMoq.IMock<WorkspaceConfiguration>;

    setup(() => {
        // tslint:disable-next-line:no-object-literal-type-assertion
        getConfig = TypeMoq.Mock.ofInstance(() => { return {} as WorkspaceConfiguration; });
        config = TypeMoq.Mock.ofType<WorkspaceConfiguration>(undefined, TypeMoq.MockBehavior.Strict);

        getConfig.setup(f => f())
            .returns(() => config.object);
    });

    test('not set at all', async () => {
        const python = path.sep + path.join('bin', 'python3');
        config.setup(c => c.inspect<string>('pythonPath'))
            .returns(() => undefined);
        config.setup(c => c.update('pythonPath', python, cfgTarget))
            .returns(() => Promise.resolve());

        const updater = new ScopedPythonPathUpdater(
            cfgTarget,
            getConfig.object
        );
        await updater.updatePythonPath(python);

        getConfig.verifyAll();
        config.verifyAll();
    });

    test('not set on any scope', async () => {
        const python = path.sep + path.join('bin', 'python3');
        config.setup(c => c.inspect<string>('pythonPath'))
            .returns(() => ({
                key: 'python.pythonPath',
                globalValue: undefined
            }));
        config.setup(c => c.update('pythonPath', python, cfgTarget))
            .returns(() => Promise.resolve());

        const updater = new ScopedPythonPathUpdater(
            cfgTarget,
            getConfig.object
        );
        await updater.updatePythonPath(python);

        getConfig.verifyAll();
        config.verifyAll();
    });

    test('only set on other scopes', async () => {
        const python = path.sep + path.join('bin', 'python3');
        config.setup(c => c.inspect<string>('pythonPath'))
            .returns(() => ({
                key: 'python.pythonPath',
                defaultValue: python,
                globalValue: undefined,
                workspaceValue: python,
                workspaceFolderValue: python
            }));
        config.setup(c => c.update('pythonPath', python, cfgTarget))
            .returns(() => Promise.resolve());

        const updater = new ScopedPythonPathUpdater(
            cfgTarget,
            getConfig.object
        );
        await updater.updatePythonPath(python);

        getConfig.verifyAll();
        config.verifyAll();
    });

    test('not changed', async () => {
        const python = path.sep + path.join('bin', 'python3');
        config.setup(c => c.inspect<string>('pythonPath'))
            .returns(() => ({
                key: 'python.pythonPath',
                globalValue: python
            }));

        const updater = new ScopedPythonPathUpdater(
            cfgTarget,
            getConfig.object
        );
        await updater.updatePythonPath(python);

        getConfig.verifyAll();
        config.verifyAll();
    });
});
