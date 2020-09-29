// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-any

import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { IPlatformService } from '../../../../client/common/platform/types';
import { ICurrentProcess, IPathUtils } from '../../../../client/common/types';
import { IKnownSearchPathsForInterpreters } from '../../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../../client/ioc/types';
import { KnownSearchPathsForInterpreters } from '../../../../client/pythonEnvironments/discovery/locators/services/KnownPathsService';

suite('Interpreters Known Paths', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let currentProcess: TypeMoq.IMock<ICurrentProcess>;
    let platformService: TypeMoq.IMock<IPlatformService>;
    let pathUtils: TypeMoq.IMock<IPathUtils>;
    let knownSearchPaths: IKnownSearchPathsForInterpreters;

    setup(async () => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        currentProcess = TypeMoq.Mock.ofType<ICurrentProcess>();
        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        pathUtils = TypeMoq.Mock.ofType<IPathUtils>();
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(ICurrentProcess), TypeMoq.It.isAny()))
            .returns(() => currentProcess.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IPlatformService), TypeMoq.It.isAny()))
            .returns(() => platformService.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IPathUtils), TypeMoq.It.isAny()))
            .returns(() => pathUtils.object);

        knownSearchPaths = new KnownSearchPathsForInterpreters(serviceContainer.object);
    });

    test('Ensure known list of paths are returned', async () => {
        const pathDelimiter = 'X';
        const pathsInPATHVar = [path.join('a', 'b', 'c'), '', path.join('1', '2'), '3'];
        pathUtils.setup((p) => p.delimiter).returns(() => pathDelimiter);
        platformService.setup((p) => p.isWindows).returns(() => true);
        platformService.setup((p) => p.pathVariableName).returns(() => 'PATH');
        currentProcess
            .setup((p) => p.env)
            .returns(() => ({ PATH: pathsInPATHVar.join(pathDelimiter) }));

        const expectedPaths = [...pathsInPATHVar].filter((item) => item.length > 0);

        const paths = knownSearchPaths.getSearchPaths();

        expect(paths).to.deep.equal(expectedPaths);
    });

    test('Ensure known list of paths are returned on non-windows', async () => {
        const homeDir = '/users/peter Smith';
        const pathDelimiter = 'X';
        pathUtils.setup((p) => p.delimiter).returns(() => pathDelimiter);
        pathUtils.setup((p) => p.home).returns(() => homeDir);
        platformService.setup((p) => p.isWindows).returns(() => false);
        platformService.setup((p) => p.pathVariableName).returns(() => 'PATH');
        currentProcess
            .setup((p) => p.env)
            .returns(() => ({ PATH: '' }));

        const expectedPaths: string[] = [];
        ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin', '/usr/local/sbin'].forEach((p) => {
            expectedPaths.push(p);
            expectedPaths.push(path.join(homeDir, p));
        });

        expectedPaths.push(path.join(homeDir, 'anaconda', 'bin'));
        expectedPaths.push(path.join(homeDir, 'python', 'bin'));

        const paths = knownSearchPaths.getSearchPaths();

        expect(paths).to.deep.equal(expectedPaths);
    });

    test('Ensure PATH variable and known list of paths are merged on non-windows', async () => {
        const homeDir = '/users/peter Smith';
        const pathDelimiter = 'X';
        const pathsInPATHVar = [path.join('a', 'b', 'c'), '', path.join('1', '2'), '3'];
        pathUtils.setup((p) => p.delimiter).returns(() => pathDelimiter);
        pathUtils.setup((p) => p.home).returns(() => homeDir);
        platformService.setup((p) => p.isWindows).returns(() => false);
        platformService.setup((p) => p.pathVariableName).returns(() => 'PATH');
        currentProcess
            .setup((p) => p.env)
            .returns(() => ({ PATH: pathsInPATHVar.join(pathDelimiter) }));

        const expectedPaths = [...pathsInPATHVar].filter((item) => item.length > 0);
        ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin', '/usr/local/sbin'].forEach((p) => {
            expectedPaths.push(p);
            expectedPaths.push(path.join(homeDir, p));
        });

        expectedPaths.push(path.join(homeDir, 'anaconda', 'bin'));
        expectedPaths.push(path.join(homeDir, 'python', 'bin'));

        const paths = knownSearchPaths.getSearchPaths();

        expect(paths).to.deep.equal(expectedPaths);
    });
});
