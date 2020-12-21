// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import { SemVer } from 'semver';
import { anything, instance, mock, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { IFileSystem, IPlatformService } from '../../../../client/common/platform/types';
import { getNamesAndValues } from '../../../../client/common/utils/enum';
import { Architecture } from '../../../../client/common/utils/platform';
import { IInterpreterHelper, IInterpreterLocatorHelper } from '../../../../client/interpreter/contracts';
import { IPipEnvServiceHelper } from '../../../../client/interpreter/locators/types';
import { IServiceContainer } from '../../../../client/ioc/types';
import { InterpreterLocatorHelper } from '../../../../client/pythonEnvironments/discovery/locators/helpers';
import { PipEnvServiceHelper } from '../../../../client/pythonEnvironments/discovery/locators/services/pipEnvServiceHelper';
import { EnvironmentType, PythonEnvironment } from '../../../../client/pythonEnvironments/info';

enum OS {
    Windows = 'Windows',
    Linux = 'Linux',
    Mac = 'Mac',
}

suite('Interpreters - Locators Helper', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let platform: TypeMoq.IMock<IPlatformService>;
    let helper: IInterpreterLocatorHelper;
    let fs: TypeMoq.IMock<IFileSystem>;
    let pipEnvHelper: IPipEnvServiceHelper;
    let interpreterServiceHelper: TypeMoq.IMock<IInterpreterHelper>;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        platform = TypeMoq.Mock.ofType<IPlatformService>();
        fs = TypeMoq.Mock.ofType<IFileSystem>();
        pipEnvHelper = mock(PipEnvServiceHelper);
        interpreterServiceHelper = TypeMoq.Mock.ofType<IInterpreterHelper>();
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IPlatformService))).returns(() => platform.object);
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IFileSystem))).returns(() => fs.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IInterpreterHelper)))
            .returns(() => interpreterServiceHelper.object);

        helper = new InterpreterLocatorHelper(fs.object, instance(pipEnvHelper));
    });
    test('Ensure default Mac interpreter is not excluded from the list of interpreters', async () => {
        platform.setup((p) => p.isWindows).returns(() => false);
        platform.setup((p) => p.isLinux).returns(() => false);
        platform
            .setup((p) => p.isMac)
            .returns(() => true)
            .verifiable(TypeMoq.Times.never());
        fs.setup((f) => f.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => false)
            .verifiable(TypeMoq.Times.atLeastOnce());

        const interpreters: PythonEnvironment[] = [];
        ['conda', 'virtualenv', 'mac', 'pyenv'].forEach((name) => {
            const interpreter = {
                architecture: Architecture.Unknown,
                displayName: name,
                path: path.join('users', 'python', 'bin', name),
                sysPrefix: name,
                sysVersion: name,
                envType: EnvironmentType.Unknown,
                version: new SemVer('0.0.0-alpha'),
            };
            interpreters.push(interpreter);

            // Treat 'mac' as as mac interpreter.
            interpreterServiceHelper
                .setup((i) => i.isMacDefaultPythonPath(TypeMoq.It.isValue(interpreter.path)))
                .returns(() => Promise.resolve(name === 'mac'))
                .verifiable(TypeMoq.Times.never());
        });

        const expectedInterpreters = interpreters.slice(0);
        when(pipEnvHelper.getPipEnvInfo(anything())).thenResolve();

        const items = await helper.mergeInterpreters(interpreters);

        interpreterServiceHelper.verifyAll();
        platform.verifyAll();
        fs.verifyAll();
        expect(items).to.be.lengthOf(4);
        expect(items).to.be.deep.equal(expectedInterpreters);
    });
    getNamesAndValues<OS>(OS).forEach((os) => {
        test(`Ensure duplicates are removed (same version and same interpreter directory on ${os.name})`, async () => {
            interpreterServiceHelper
                .setup((i) => i.isMacDefaultPythonPath(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(false));
            platform.setup((p) => p.isWindows).returns(() => os.value === OS.Windows);
            platform.setup((p) => p.isLinux).returns(() => os.value === OS.Linux);
            platform.setup((p) => p.isMac).returns(() => os.value === OS.Mac);
            fs.setup((f) => f.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns((a, b) => a === b)
                .verifiable(TypeMoq.Times.atLeastOnce());

            const interpreters: PythonEnvironment[] = [];
            const expectedInterpreters: PythonEnvironment[] = [];
            // Unique python paths and versions.
            ['3.6', '3.6', '2.7', '2.7'].forEach((name, index) => {
                const interpreter = {
                    architecture: Architecture.Unknown,
                    displayName: name,
                    path: path.join('users', `python${name}${index}`, 'bin', name + index.toString()),
                    sysPrefix: name,
                    sysVersion: name,
                    envType: EnvironmentType.Unknown,
                    version: new SemVer(`3.${parseInt(name.substr(-1), 10)}.0-final`),
                };
                interpreters.push(interpreter);
                expectedInterpreters.push(interpreter);
            });
            // Same versions, but different executables.
            ['3.6', '3.6', '3.7', '3.7'].forEach((name, index) => {
                const interpreter = {
                    architecture: Architecture.Unknown,
                    displayName: name,
                    path: path.join('users', 'python', 'bin', 'python.exe'),
                    sysPrefix: name,
                    sysVersion: name,
                    envType: EnvironmentType.Unknown,
                    version: new SemVer(`3.${parseInt(name.substr(-1), 10)}.0-final`),
                };

                const duplicateInterpreter = {
                    architecture: Architecture.Unknown,
                    displayName: name,
                    path: path.join('users', 'python', 'bin', `python${name}.exe`),
                    sysPrefix: name,
                    sysVersion: name,
                    envType: EnvironmentType.Unknown,
                    version: new SemVer(interpreter.version.raw),
                };

                interpreters.push(interpreter);
                interpreters.push(duplicateInterpreter);
                if (index % 2 === 1) {
                    expectedInterpreters.push(interpreter);
                }
            });

            when(pipEnvHelper.getPipEnvInfo(anything())).thenResolve();
            const items = await helper.mergeInterpreters(interpreters);

            interpreterServiceHelper.verifyAll();
            platform.verifyAll();
            fs.verifyAll();
            expect(items).to.be.lengthOf(expectedInterpreters.length);
            expect(items).to.be.deep.equal(expectedInterpreters);
        });
    });
    getNamesAndValues<OS>(OS).forEach((os) => {
        test(`Ensure interpreter types are identified from other locators (${os.name})`, async () => {
            interpreterServiceHelper
                .setup((i) => i.isMacDefaultPythonPath(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(false));
            platform.setup((p) => p.isWindows).returns(() => os.value === OS.Windows);
            platform.setup((p) => p.isLinux).returns(() => os.value === OS.Linux);
            platform.setup((p) => p.isMac).returns(() => os.value === OS.Mac);
            fs.setup((f) => f.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns((a, b) => a === b && a === path.join('users', 'python', 'bin'))
                .verifiable(TypeMoq.Times.atLeastOnce());

            const interpreters: PythonEnvironment[] = [];
            const expectedInterpreters: PythonEnvironment[] = [];
            ['3.6', '3.6'].forEach((name, index) => {
                // Ensure the type in the first item is 'Unknown',
                // and type in second item is known (e.g. Conda).
                const type = index === 0 ? EnvironmentType.Unknown : EnvironmentType.Pipenv;
                const interpreter = {
                    architecture: Architecture.Unknown,
                    displayName: name,
                    path: path.join('users', 'python', 'bin', 'python.exe'),
                    sysPrefix: name,
                    sysVersion: name,
                    envType: type,
                    version: new SemVer(`3.${parseInt(name.substr(-1), 10)}.0-final`),
                };
                interpreters.push(interpreter);

                if (index === 1) {
                    expectedInterpreters.push(interpreter);
                }
            });

            when(pipEnvHelper.getPipEnvInfo(anything())).thenResolve();
            const items = await helper.mergeInterpreters(interpreters);

            interpreterServiceHelper.verifyAll();
            platform.verifyAll();
            fs.verifyAll();
            expect(items).to.be.lengthOf(1);
            expect(items).to.be.deep.equal(expectedInterpreters);
        });
    });
});
