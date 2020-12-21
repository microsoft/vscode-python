// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { CancellationToken, SymbolInformation, TextDocument, TextEditor, Uri } from 'vscode';
import { IDisposable } from '../../common/types';
import { TestFile, TestFunction, TestSuite } from '../common/types';

export const ITestCodeNavigatorCommandHandler = Symbol('ITestCodeNavigatorCommandHandler');
export interface ITestCodeNavigatorCommandHandler extends IDisposable {
    register(): void;
}
export type NavigableItem = TestFile | TestFunction | TestSuite;
export enum NavigableItemType {
    testFile = 'testFile',
    testFunction = 'testFunction',
    testSuite = 'testSuite',
}

export const ITestCodeNavigator = Symbol('ITestCodeNavigator');
export interface ITestCodeNavigator {
    navigateTo(resource: Uri, item: NavigableItem, focus: boolean): Promise<void>;
}

export const ITestNavigatorHelper = Symbol('ITestNavigatorHelper');
export interface ITestNavigatorHelper {
    openFile(file?: Uri): Promise<[TextDocument, TextEditor]>;
    findSymbol(
        doc: TextDocument,
        predicate: SymbolSearch,
        token: CancellationToken,
    ): Promise<SymbolInformation | undefined>;
}
export type SymbolSearch = (item: SymbolInformation) => boolean;

export const ITestExplorerCommandHandler = Symbol('ITestExplorerCommandHandler');
export interface ITestExplorerCommandHandler extends IDisposable {
    register(): void;
}
