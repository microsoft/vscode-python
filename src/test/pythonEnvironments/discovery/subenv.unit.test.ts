// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import * as sut from '../../../client/pythonEnvironments/discovery/subenv';
import { EnvironmentType } from '../../../client/pythonEnvironments/info';

suite('getName()', () => {
    // We will pull tests over from src/test/interpreters/virtualEnvs/index.unit.test.ts at some point.
});

suite('getType()', () => {
    interface IFinders {
        venv(python: string): Promise<EnvironmentType | undefined>;
        pyenv(python: string): Promise<EnvironmentType | undefined>;
        pipenv(python: string): Promise<EnvironmentType | undefined>;
        virtualenv(python: string): Promise<EnvironmentType | undefined>;
    }
    let finders: TypeMoq.IMock<IFinders>;
    setup(() => {
        finders = TypeMoq.Mock.ofType<IFinders>(undefined, TypeMoq.MockBehavior.Strict);
    });
    function verifyAll() {
        finders.verifyAll();
    }

    test('detects the first type', async () => {
        const python = 'x/y/z/bin/python';
        finders
            .setup((f) => f.venv(python))
            // found
            .returns(() => Promise.resolve(EnvironmentType.Venv));

        const result = await sut.getType(python, [
            (p: string) => finders.object.venv(p),
            (p: string) => finders.object.pyenv(p),
            (p: string) => finders.object.pipenv(p),
            (p: string) => finders.object.virtualenv(p)
        ]);

        expect(result).to.equal(EnvironmentType.Venv, 'broken');
        verifyAll();
    });

    test('detects the second type', async () => {
        const python = 'x/y/z/bin/python';
        finders
            .setup((f) => f.venv(python))
            // not found
            .returns(() => Promise.resolve(undefined));
        finders
            .setup((f) => f.pyenv(python))
            // found
            .returns(() => Promise.resolve(EnvironmentType.Pyenv));

        const result = await sut.getType(python, [
            (p: string) => finders.object.venv(p),
            (p: string) => finders.object.pyenv(p),
            (p: string) => finders.object.pipenv(p),
            (p: string) => finders.object.virtualenv(p)
        ]);

        expect(result).to.equal(EnvironmentType.Pyenv, 'broken');
        verifyAll();
    });

    test('does not detect the type', async () => {
        const python = 'x/y/z/bin/python';
        finders
            .setup((f) => f.venv(python))
            // not found
            .returns(() => Promise.resolve(undefined));
        finders
            .setup((f) => f.pyenv(python))
            // not found
            .returns(() => Promise.resolve(undefined));
        finders
            .setup((f) => f.pipenv(python))
            // not found
            .returns(() => Promise.resolve(undefined));
        finders
            .setup((f) => f.virtualenv(python))
            // not found
            .returns(() => Promise.resolve(undefined));

        const result = await sut.getType(python, [
            (p: string) => finders.object.venv(p),
            (p: string) => finders.object.pyenv(p),
            (p: string) => finders.object.pipenv(p),
            (p: string) => finders.object.virtualenv(p)
        ]);

        expect(result).to.equal(undefined, 'broken');
        verifyAll();
    });
});

suite('getNameFinders()', () => {
    // We will pull tests over from src/test/interpreters/virtualEnvs/index.unit.test.ts at some point.
});

suite('getTypeFinders()', () => {
    // We will pull tests over from src/test/interpreters/virtualEnvs/index.unit.test.ts at some point.
});

suite('getVenvTypeFinder()', () => {
    // We will pull tests over from src/test/interpreters/virtualEnvs/index.unit.test.ts at some point.
});

suite('getVirtualenvTypeFinder()', () => {
    // We will pull tests over from src/test/interpreters/virtualEnvs/index.unit.test.ts at some point.
});

suite('getPipenvTypeFinder()', () => {
    // We will pull tests over from src/test/interpreters/virtualEnvs/index.unit.test.ts at some point.
});
