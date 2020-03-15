// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { SemVer } from 'semver';
import * as TypeMoq from 'typemoq';
import { IFileSystem } from '../../../client/common/platform/types';
import { PythonExecutionService } from '../../../client/common/process/pythonProcess';
import { IProcessService, StdErrError } from '../../../client/common/process/types';
import { Architecture } from '../../../client/common/utils/platform';
import { IServiceContainer } from '../../../client/ioc/types';
import { noop } from '../../core';

use(chaiAsPromised);

// tslint:disable-next-line: max-func-body-length
suite('PythonExecutionService', () => {
    let processService: TypeMoq.IMock<IProcessService>;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let executionService: PythonExecutionService;
    const pythonPath = 'path/to/python';

    setup(() => {
        processService = TypeMoq.Mock.ofType<IProcessService>(undefined, TypeMoq.MockBehavior.Strict);
        const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>(undefined, TypeMoq.MockBehavior.Strict);
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>(undefined, TypeMoq.MockBehavior.Strict);

        serviceContainer.setup(s => s.get<IFileSystem>(IFileSystem)).returns(() => fileSystem.object);

        executionService = new PythonExecutionService(serviceContainer.object, processService.object, pythonPath);
    });

    test('getInterpreterInformation should return an object if the python path is valid', async () => {
        const json = {
            versionInfo: [3, 7, 5, 'candidate'],
            sysPrefix: '/path/of/sysprefix/versions/3.7.5rc1',
            version: '3.7.5rc1 (default, Oct 18 2019, 14:48:48) \n[Clang 11.0.0 (clang-1100.0.33.8)]',
            is64Bit: true
        };

        processService
            .setup(p => p.shellExec(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: JSON.stringify(json) }));

        const result = await executionService.getInterpreterInformation();
        const expectedResult = {
            architecture: Architecture.x64,
            path: pythonPath,
            version: new SemVer('3.7.5-candidate'),
            sysPrefix: json.sysPrefix,
            sysVersion: undefined
        };

        expect(result).to.deep.equal(expectedResult, 'Incorrect value returned by getInterpreterInformation().');
    });

    test('getInterpreterInformation should return an object if the version info contains less than 4 items', async () => {
        const json = {
            versionInfo: [3, 7, 5],
            sysPrefix: '/path/of/sysprefix/versions/3.7.5rc1',
            version: '3.7.5rc1 (default, Oct 18 2019, 14:48:48) \n[Clang 11.0.0 (clang-1100.0.33.8)]',
            is64Bit: true
        };

        processService
            .setup(p => p.shellExec(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: JSON.stringify(json) }));

        const result = await executionService.getInterpreterInformation();
        const expectedResult = {
            architecture: Architecture.x64,
            path: pythonPath,
            version: new SemVer('3.7.5'),
            sysPrefix: json.sysPrefix,
            sysVersion: undefined
        };

        expect(result).to.deep.equal(
            expectedResult,
            'Incorrect value returned by getInterpreterInformation() with truncated versionInfo.'
        );
    });

    test('getInterpreterInformation should return an object with the architecture value set to x86 if json.is64bit is not 64bit', async () => {
        const json = {
            versionInfo: [3, 7, 5, 'candidate'],
            sysPrefix: '/path/of/sysprefix/versions/3.7.5rc1',
            version: '3.7.5rc1 (default, Oct 18 2019, 14:48:48) \n[Clang 11.0.0 (clang-1100.0.33.8)]',
            is64Bit: false
        };

        processService
            .setup(p => p.shellExec(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: JSON.stringify(json) }));

        const result = await executionService.getInterpreterInformation();
        const expectedResult = {
            architecture: Architecture.x86,
            path: pythonPath,
            version: new SemVer('3.7.5-candidate'),
            sysPrefix: json.sysPrefix,
            sysVersion: undefined
        };

        expect(result).to.deep.equal(
            expectedResult,
            'Incorrect value returned by getInterpreterInformation() for x86b architecture.'
        );
    });

    test('getInterpreterInformation should error out if interpreterInfo.py times out', async () => {
        processService
            .setup(p => p.shellExec(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            // tslint:disable-next-line: no-any
            .returns(() => Promise.resolve(undefined as any));

        const result = await executionService.getInterpreterInformation();

        expect(result).to.equal(
            undefined,
            'getInterpreterInfo() should return undefined because interpreterInfo timed out.'
        );
    });

    test('getInterpreterInformation should return undefined if the json value returned by interpreterInfo.py is not valid', async () => {
        processService
            .setup(p => p.shellExec(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: 'bad json' }));

        const result = await executionService.getInterpreterInformation();

        expect(result).to.equal(undefined, 'getInterpreterInfo() should return undefined because of bad json.');
    });

    test('getExecutablePath should return pythonPath if pythonPath is a file', async () => {
        fileSystem.setup(f => f.fileExists(pythonPath)).returns(() => Promise.resolve(true));

        const result = await executionService.getExecutablePath();

        expect(result).to.equal(pythonPath, "getExecutablePath() sbould return pythonPath if it's a file");
    });

    test('getExecutablePath should not return pythonPath if pythonPath is not a file', async () => {
        const executablePath = 'path/to/dummy/executable';
        fileSystem.setup(f => f.fileExists(pythonPath)).returns(() => Promise.resolve(false));
        processService
            .setup(p => p.exec(pythonPath, ['-c', 'import sys;print(sys.executable)'], { throwOnStdErr: true }))
            .returns(() => Promise.resolve({ stdout: executablePath }));

        const result = await executionService.getExecutablePath();

        expect(result).to.equal(executablePath, "getExecutablePath() sbould not return pythonPath if it's not a file");
    });

    test('getExecutablePath should throw if the result of exec() writes to stderr', async () => {
        const stderr = 'bar';
        fileSystem.setup(f => f.fileExists(pythonPath)).returns(() => Promise.resolve(false));
        processService
            .setup(p => p.exec(pythonPath, ['-c', 'import sys;print(sys.executable)'], { throwOnStdErr: true }))
            .returns(() => Promise.reject(new StdErrError(stderr)));

        const result = executionService.getExecutablePath();

        expect(result).to.eventually.be.rejectedWith(stderr);
    });

    test('isModuleInstalled should call processService.exec()', async () => {
        const moduleName = 'foo';
        processService
            .setup(p => p.exec(pythonPath, ['-c', `import ${moduleName}`], { throwOnStdErr: true }))
            .returns(() => Promise.resolve({ stdout: '' }));

        await executionService.isModuleInstalled(moduleName);

        processService.verify(
            async p => p.exec(pythonPath, ['-c', `import ${moduleName}`], { throwOnStdErr: true }),
            TypeMoq.Times.once()
        );
    });

    test('isModuleInstalled should return true when processService.exec() succeeds', async () => {
        const moduleName = 'foo';
        processService
            .setup(p => p.exec(pythonPath, ['-c', `import ${moduleName}`], { throwOnStdErr: true }))
            .returns(() => Promise.resolve({ stdout: '' }));

        const result = await executionService.isModuleInstalled(moduleName);

        expect(result).to.equal(true, 'isModuleInstalled() should return true if the module exists');
    });

    test('isModuleInstalled should return false when processService.exec() throws', async () => {
        const moduleName = 'foo';
        processService
            .setup(p => p.exec(pythonPath, ['-c', `import ${moduleName}`], { throwOnStdErr: true }))
            .returns(() => Promise.reject(new StdErrError('bar')));

        const result = await executionService.isModuleInstalled(moduleName);

        expect(result).to.equal(false, 'isModuleInstalled() should return false if the module does not exist');
    });

    test('execObservable should call processService.execObservable', () => {
        const args = ['-a', 'b', '-c'];
        const options = {};
        const observable = {
            proc: undefined,
            // tslint:disable-next-line: no-any
            out: {} as any,
            dispose: () => {
                noop();
            }
        };
        processService.setup(p => p.execObservable(pythonPath, args, options)).returns(() => observable);

        const result = executionService.execObservable(args, options);

        processService.verify(p => p.execObservable(pythonPath, args, options), TypeMoq.Times.once());
        expect(result).to.be.equal(observable, 'execObservable should return an observable');
    });

    test('execModuleObservable should call processService.execObservable with the -m argument', () => {
        const args = ['-a', 'b', '-c'];
        const moduleName = 'foo';
        const expectedArgs = ['-m', moduleName, ...args];
        const options = {};
        const observable = {
            proc: undefined,
            // tslint:disable-next-line: no-any
            out: {} as any,
            dispose: () => {
                noop();
            }
        };
        processService.setup(p => p.execObservable(pythonPath, expectedArgs, options)).returns(() => observable);

        const result = executionService.execModuleObservable(moduleName, args, options);

        processService.verify(p => p.execObservable(pythonPath, expectedArgs, options), TypeMoq.Times.once());
        expect(result).to.be.equal(observable, 'execModuleObservable should return an observable');
    });

    test('exec should call processService.exec', async () => {
        const args = ['-a', 'b', '-c'];
        const options = {};
        const stdout = 'foo';
        processService.setup(p => p.exec(pythonPath, args, options)).returns(() => Promise.resolve({ stdout }));

        const result = await executionService.exec(args, options);

        processService.verify(p => p.exec(pythonPath, args, options), TypeMoq.Times.once());
        expect(result.stdout).to.be.equal(stdout, 'exec should return the content of stdout');
    });

    test('execModule should call processService.exec with the -m argument', async () => {
        const args = ['-a', 'b', '-c'];
        const moduleName = 'foo';
        const expectedArgs = ['-m', moduleName, ...args];
        const options = {};
        const stdout = 'bar';
        processService.setup(p => p.exec(pythonPath, expectedArgs, options)).returns(() => Promise.resolve({ stdout }));

        const result = await executionService.execModule(moduleName, args, options);

        processService.verify(p => p.exec(pythonPath, expectedArgs, options), TypeMoq.Times.once());
        expect(result.stdout).to.be.equal(stdout, 'exec should return the content of stdout');
    });

    test('execModule should throw an error if the module is not installed', async () => {
        const args = ['-a', 'b', '-c'];
        const moduleName = 'foo';
        const expectedArgs = ['-m', moduleName, ...args];
        const options = {};
        processService
            .setup(p => p.exec(pythonPath, expectedArgs, options))
            .returns(() => Promise.resolve({ stdout: 'bar', stderr: `Error: No module named ${moduleName}` }));
        processService
            .setup(p => p.exec(pythonPath, ['-c', `import ${moduleName}`], { throwOnStdErr: true }))
            .returns(() => Promise.reject(new StdErrError('not installed')));

        const result = executionService.execModule(moduleName, args, options);

        expect(result).to.eventually.be.rejectedWith(`Module '${moduleName}' not installed`);
    });

    test('getExecutionInfo should return pythonPath and the execution arguments as is', () => {
        const args = ['-a', 'b', '-c'];

        const result = executionService.getExecutionInfo(args);

        expect(result).to.deep.equal(
            { command: pythonPath, args },
            'getExecutionInfo should return pythonPath and the command and execution arguments as is'
        );
    });
});
