// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as sinon from 'sinon';
import { Uri, WorkspaceFolder } from 'vscode';
import { resolveFilePath } from '../../client/chat/utils';
import * as workspaceApis from '../../client/common/vscodeApis/workspaceApis';

suite('Chat Utils - resolveFilePath()', () => {
    let getWorkspaceFoldersStub: sinon.SinonStub;

    setup(() => {
        getWorkspaceFoldersStub = sinon.stub(workspaceApis, 'getWorkspaceFolders');
        getWorkspaceFoldersStub.returns([]);
    });

    teardown(() => {
        sinon.restore();
    });

    suite('When filepath is undefined or empty', () => {
        test('Should return first workspace folder URI when workspace folders exist', () => {
            const expectedUri = Uri.file('/test/workspace');
            const mockFolder: WorkspaceFolder = {
                uri: expectedUri,
                name: 'test',
                index: 0,
            };
            getWorkspaceFoldersStub.returns([mockFolder]);

            const result = resolveFilePath(undefined);

            expect(result?.toString()).to.equal(expectedUri.toString());
        });

        test('Should return first folder when multiple workspace folders exist', () => {
            const firstUri = Uri.file('/first/workspace');
            const secondUri = Uri.file('/second/workspace');
            const mockFolders: WorkspaceFolder[] = [
                { uri: firstUri, name: 'first', index: 0 },
                { uri: secondUri, name: 'second', index: 1 },
            ];
            getWorkspaceFoldersStub.returns(mockFolders);

            const result = resolveFilePath(undefined);

            expect(result?.toString()).to.equal(firstUri.toString());
        });

        test('Should return undefined when no workspace folders exist', () => {
            getWorkspaceFoldersStub.returns(undefined);

            const result = resolveFilePath(undefined);

            expect(result).to.be.undefined;
        });

        test('Should return undefined when workspace folders is empty array', () => {
            getWorkspaceFoldersStub.returns([]);

            const result = resolveFilePath(undefined);

            expect(result).to.be.undefined;
        });

        test('Should return undefined for empty string when no workspace folders', () => {
            getWorkspaceFoldersStub.returns(undefined);

            const result = resolveFilePath('');

            expect(result).to.be.undefined;
        });
    });

    suite('Windows file paths', () => {
        test('Should handle Windows path with lowercase drive letter', () => {
            const filepath = 'c:\\GIT\\tests\\simple-python-app';

            const result = resolveFilePath(filepath);

            expect(result).to.not.be.undefined;
            expect(result?.scheme).to.equal('file');
            // Uri.file normalizes drive letters to lowercase
            expect(result?.fsPath.toLowerCase()).to.include('git');
        });

        test('Should handle Windows path with uppercase drive letter', () => {
            const filepath = 'C:\\Users\\test\\project';

            const result = resolveFilePath(filepath);

            expect(result).to.not.be.undefined;
            expect(result?.scheme).to.equal('file');
            expect(result?.fsPath.toLowerCase()).to.include('users');
        });

        test('Should handle Windows path with forward slashes', () => {
            const filepath = 'C:/Users/test/project';

            const result = resolveFilePath(filepath);

            expect(result).to.not.be.undefined;
            expect(result?.scheme).to.equal('file');
        });
    });

    suite('Unix file paths', () => {
        test('Should handle Unix absolute path', () => {
            const filepath = '/home/user/projects/myapp';

            const result = resolveFilePath(filepath);

            expect(result).to.not.be.undefined;
            expect(result?.scheme).to.equal('file');
            expect(result?.path).to.include('/home/user/projects/myapp');
        });

        test('Should handle Unix root path', () => {
            const filepath = '/';

            const result = resolveFilePath(filepath);

            expect(result).to.not.be.undefined;
            expect(result?.scheme).to.equal('file');
        });
    });

    suite('Relative paths', () => {
        test('Should handle relative path with dot prefix', () => {
            const filepath = './src/main.py';

            const result = resolveFilePath(filepath);

            expect(result).to.not.be.undefined;
            expect(result?.scheme).to.equal('file');
        });

        test('Should handle relative path without prefix', () => {
            const filepath = 'src/main.py';

            const result = resolveFilePath(filepath);

            expect(result).to.not.be.undefined;
            expect(result?.scheme).to.equal('file');
        });

        test('Should handle parent directory reference', () => {
            const filepath = '../other-project/file.py';

            const result = resolveFilePath(filepath);

            expect(result).to.not.be.undefined;
            expect(result?.scheme).to.equal('file');
        });
    });

    suite('URI schemes', () => {
        test('Should handle file:// URI scheme', () => {
            const filepath = 'file:///home/user/test.py';

            const result = resolveFilePath(filepath);

            expect(result).to.not.be.undefined;
            expect(result?.scheme).to.equal('file');
            expect(result?.path).to.include('/home/user/test.py');
        });

        test('Should handle vscode-notebook:// URI scheme', () => {
            const filepath = 'vscode-notebook://jupyter/notebook.ipynb';

            const result = resolveFilePath(filepath);

            expect(result).to.not.be.undefined;
            expect(result?.scheme).to.equal('vscode-notebook');
        });

        test('Should handle untitled: URI scheme without double slash as file path', () => {
            const filepath = 'untitled:Untitled-1';

            const result = resolveFilePath(filepath);

            expect(result).to.not.be.undefined;
            // untitled: doesn't have ://, so it will be treated as a file path
            expect(result?.scheme).to.equal('file');
        });

        test('Should handle https:// URI scheme', () => {
            const filepath = 'https://example.com/path';

            const result = resolveFilePath(filepath);

            expect(result).to.not.be.undefined;
            expect(result?.scheme).to.equal('https');
        });

        test('Should handle vscode-vfs:// URI scheme', () => {
            const filepath = 'vscode-vfs://github/microsoft/vscode/file.ts';

            const result = resolveFilePath(filepath);

            expect(result).to.not.be.undefined;
            expect(result?.scheme).to.equal('vscode-vfs');
        });
    });

    suite('Edge cases', () => {
        test('Should handle path with spaces', () => {
            const filepath = '/home/user/my project/file.py';

            const result = resolveFilePath(filepath);

            expect(result).to.not.be.undefined;
            expect(result?.scheme).to.equal('file');
        });

        test('Should handle path with special characters', () => {
            const filepath = '/home/user/project-name_v2/file.py';

            const result = resolveFilePath(filepath);

            expect(result).to.not.be.undefined;
            expect(result?.scheme).to.equal('file');
        });

        test('Should not treat Windows drive letter colon as URI scheme', () => {
            // Windows path should not be confused with a URI scheme
            const filepath = 'd:\\projects\\test';

            const result = resolveFilePath(filepath);

            expect(result).to.not.be.undefined;
            expect(result?.scheme).to.equal('file');
        });

        test('Should not treat single colon as URI scheme', () => {
            // A path with a colon but not :// should be treated as a file
            const filepath = 'c:somepath';

            const result = resolveFilePath(filepath);

            expect(result).to.not.be.undefined;
            expect(result?.scheme).to.equal('file');
        });
    });
});
