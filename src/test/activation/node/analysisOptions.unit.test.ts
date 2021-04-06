// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { expect } from 'chai';
import * as typemoq from 'typemoq';
import { WorkspaceFolder } from 'vscode';
import { DocumentFilter } from 'vscode-languageclient/node';

import { NodeLanguageServerAnalysisOptions } from '../../../client/activation/node/analysisOptions';
import { ILanguageServerOutputChannel } from '../../../client/activation/types';
import { PYTHON } from '../../../client/common/constants';
import { IOutputChannel } from '../../../client/common/types';

suite('Pylance Language Server - Analysis Options', () => {
    class TestClass extends NodeLanguageServerAnalysisOptions {
        public getWorkspaceFolder(): WorkspaceFolder | undefined {
            return super.getWorkspaceFolder();
        }

        public getDocumentFilters(workspaceFolder?: WorkspaceFolder): DocumentFilter[] {
            return super.getDocumentFilters(workspaceFolder);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        public async getInitializationOptions(): Promise<any> {
            return super.getInitializationOptions();
        }
    }

    let analysisOptions: TestClass;
    let outputChannel: IOutputChannel;
    let lsOutputChannel: typemoq.IMock<ILanguageServerOutputChannel>;

    setup(() => {
        outputChannel = typemoq.Mock.ofType<IOutputChannel>().object;
        lsOutputChannel = typemoq.Mock.ofType<ILanguageServerOutputChannel>();
        lsOutputChannel.setup((l) => l.channel).returns(() => outputChannel);
        analysisOptions = new TestClass(lsOutputChannel.object);
    });

    test('Workspace folder is undefined', () => {
        const workspaceFolder = analysisOptions.getWorkspaceFolder();
        expect(workspaceFolder).to.be.equal(undefined);
    });

    test('Document filter matches all python', () => {
        const filter = analysisOptions.getDocumentFilters();
        expect(filter).to.be.equal(PYTHON);
    });

    test('Initialization options include experimentation capability', async () => {
        const options = await analysisOptions.getInitializationOptions();
        expect(options?.experimentationSupport).to.be.equal(true);
    });
});
