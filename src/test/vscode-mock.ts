// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-invalid-this no-require-imports no-var-requires no-any

import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
const Module = require('module');

type VSCode = typeof vscode;

const mockedVSCode: Partial<VSCode> = {};
const mockedVSCodeNamespaces: { [P in keyof VSCode]?: TypeMoq.IMock<VSCode[P]> } = {};
const originalLoad = Module._load;

function generateMock<K extends keyof VSCode>(name: K): void {
    const mockedObj = TypeMoq.Mock.ofType<VSCode[K]>();
    mockedVSCode[name] = mockedObj.object;
    mockedVSCodeNamespaces[name] = mockedObj as any;
}

export function initialize() {
    generateMock('workspace');
    generateMock('window');
    generateMock('commands');
    generateMock('languages');
    generateMock('env');
    generateMock('debug');
    generateMock('extensions');
    generateMock('scm');

    Module._load = function (request, parent) {
        if (request === 'vscode') {
            return mockedVSCode;
        }
        return originalLoad.apply(this, arguments);
    };
}

/**
 * Gets the mocked VS Code namespaces/classes.
 * For VS Code namespaces, always return pre-mocked objects, else create a new mock object.
 * @export
 * @template K
 * @param {K} name
 * @returns {TypeMoq.IMock<VSCode[K]>}
 */
export function mock<K extends keyof VSCode>(name: K): TypeMoq.IMock<VSCode[K]> {
    if (mockedVSCodeNamespaces[name] === undefined) {
        return TypeMoq.Mock.ofType<VSCode[K]>();
    }
    // When re-using, always reset (other tests could have used this same instance).
    const mockObj = mockedVSCodeNamespaces[name]!;
    mockObj.reset();
    return mockObj as any as TypeMoq.IMock<VSCode[K]>;
}

// This is one of the very few classes that we need in our unit tests.
// It is constructed in a number of places, and this is required for verification.
// Using mocked objects for verfications does not work in typemoq.
export class Uri implements vscode.Uri {
    private constructor(public readonly scheme: string, public readonly authority: string,
        public readonly path: string, public readonly query: string,
        public readonly fragment: string, public readonly fsPath) {

    }
    public static file(path: string): Uri {
        return new Uri('file', '', path, '', '', path);
    }
    public static parse(value: string): Uri {
        return new Uri('http', '', value, '', '', value);
    }
    public with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): vscode.Uri {
        throw new Error('Not implemented');
    }
    public toString(skipEncoding?: boolean): string {
        return this.fsPath;
    }
    public toJSON(): any {
        return this.fsPath;
    }
}

mockedVSCode.Uri = Uri as any;
// tslint:disable-next-line:no-function-expression
mockedVSCode.EventEmitter = function () { return TypeMoq.Mock.ofType<vscode.EventEmitter<any>>(); } as any;
mockedVSCode.StatusBarAlignment = TypeMoq.Mock.ofType<vscode.StatusBarAlignment>().object as any;
