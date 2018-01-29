// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { Pylint } from '../../client/linters/pylint';

suite('Linting - Pylintrc search', () => {
    const basePath = '/user/a/b/c/d';
    const file = path.join(basePath, 'file.py');
    const pylintrc = 'pylintrc';
    const dotPylintrc = '.pylintrc';

    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let platformService: TypeMoq.IMock<IPlatformService>;

    setup(() => {
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        platformService = TypeMoq.Mock.ofType<IPlatformService>();
    });

    test('pylintrc in the file folder', async () => {
        fileSystem.setup(x => x.fileExistsAsync(path.join(basePath, pylintrc))).returns(() => Promise.resolve(true));
        let result = await Pylint.hasConfigurationFile(fileSystem.object, file, platformService.object);
        expect(result).to.be.equal(true, `'${pylintrc}' not detected in the file folder.`);

        fileSystem.setup(x => x.fileExistsAsync(path.join(basePath, dotPylintrc))).returns(() => Promise.resolve(true));
        result = await Pylint.hasConfigurationFile(fileSystem.object, file, platformService.object);
        expect(result).to.be.equal(true, `'${dotPylintrc}' not detected in the file folder.`);
    });
    test('pylintrc up the module tree', async () => {
        const module1 = path.join('/user/a/b/c/d', '__init__.py');
        const module2 = path.join('/user/a/b/c', '__init__.py');
        const module3 = path.join('/user/a/b', '__init__.py');
        const rc = path.join('/user/a/b/c', pylintrc);

        fileSystem.setup(x => x.fileExistsAsync(module1)).returns(() => Promise.resolve(true));
        fileSystem.setup(x => x.fileExistsAsync(module2)).returns(() => Promise.resolve(true));
        fileSystem.setup(x => x.fileExistsAsync(module3)).returns(() => Promise.resolve(true));
        fileSystem.setup(x => x.fileExistsAsync(rc)).returns(() => Promise.resolve(true));

        const result = await Pylint.hasConfigurationFile(fileSystem.object, file, platformService.object);
        expect(result).to.be.equal(true, `'${pylintrc}' not detected in the module tree.`);
    });
    test('.pylintrc up the module tree', async () => {
        // Don't use path.join since it will use / on Travis and Mac
        const module1 = path.join('/user/a/b/c/d', '__init__.py');
        const module2 = path.join('/user/a/b/c', '__init__.py');
        const module3 = path.join('/user/a/b', '__init__.py');
        const rc = path.join('/user/a/b/c', pylintrc);

        fileSystem.setup(x => x.fileExistsAsync(module1)).returns(() => Promise.resolve(true));
        fileSystem.setup(x => x.fileExistsAsync(module2)).returns(() => Promise.resolve(true));
        fileSystem.setup(x => x.fileExistsAsync(module3)).returns(() => Promise.resolve(true));
        fileSystem.setup(x => x.fileExistsAsync(rc)).returns(() => Promise.resolve(true));

        const result = await Pylint.hasConfigurationFile(fileSystem.object, file, platformService.object);
        expect(result).to.be.equal(true, `'${dotPylintrc}' not detected in the module tree.`);
    });
    test('.pylintrc up the ~ folder', async () => {
        const home = path.resolve('~');
        const rc = path.join(home, dotPylintrc);
        fileSystem.setup(x => x.fileExistsAsync(rc)).returns(() => Promise.resolve(true));

        const result = await Pylint.hasConfigurationFile(fileSystem.object, file, platformService.object);
        expect(result).to.be.equal(true, `'${dotPylintrc}' not detected in the ~ folder.`);
    });
    test('pylintrc up the ~/.config folder', async () => {
        const home = path.resolve('~');
        const rc = path.join(home, '.config', pylintrc);
        fileSystem.setup(x => x.fileExistsAsync(rc)).returns(() => Promise.resolve(true));

        const result = await Pylint.hasConfigurationFile(fileSystem.object, file, platformService.object);
        expect(result).to.be.equal(true, `'${pylintrc}' not detected in the  ~/.config folder.`);
    });
    test('pylintrc in the /etc folder', async () => {
        platformService.setup(x => x.isWindows).returns(() => false);
        const rc = path.join('/etc', pylintrc);
        fileSystem.setup(x => x.fileExistsAsync(rc)).returns(() => Promise.resolve(true));

        const result = await Pylint.hasConfigurationFile(fileSystem.object, file, platformService.object);
        expect(result).to.be.equal(true, `'${pylintrc}' not detected in the /etc folder.`);
    });
});
