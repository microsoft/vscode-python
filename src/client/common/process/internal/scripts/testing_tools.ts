// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { _SCRIPTS_DIR } from './index';

const SCRIPTS_DIR = path.join(_SCRIPTS_DIR, 'testing_tools');

//============================
// run_adapter.py

type TestNode = {
    id: string;
    name: string;
    parentid: string;
};
type TestParent = TestNode & {
    kind: 'folder' | 'file' | 'suite' | 'function';
};
type TestFSNode = TestParent & {
    kind: 'folder' | 'file';
    relpath: string;
};

export type TestFolder = TestFSNode & {
    kind: 'folder';
};
export type TestFile = TestFSNode & {
    kind: 'file';
};
export type TestSuite = TestParent & {
    kind: 'suite';
};
// function-as-a-container is for parameterized ("sub") tests.
export type TestFunction = TestParent & {
    kind: 'function';
};
export type Test = TestNode & {
    source: string;
};
export type DiscoveredTests = {
    rootid: string;
    root: string;
    parents: TestParent[];
    tests: Test[];
};

export function run_adapter(adapterArgs: string[]): [string[], (out: string) => DiscoveredTests[]] {
    const script = path.join(SCRIPTS_DIR, 'run_adapter.py');
    const args = [script, ...adapterArgs];

    function parse(out: string): DiscoveredTests[] {
        return JSON.parse(out);
    }

    return [args, parse];
}
