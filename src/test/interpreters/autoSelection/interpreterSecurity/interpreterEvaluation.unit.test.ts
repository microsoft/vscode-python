// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as Typemoq from 'typemoq';
import { Uri } from 'vscode';
import { IApplicationShell } from '../../../../client/common/application/types';
import { IBrowserService, IPersistentState, IPersistentStateFactory } from '../../../../client/common/types';
import { Common, InteractiveShiftEnterBanner, Interpreters } from '../../../../client/common/utils/localize';
import { unsafeInterpreterPromptKey } from '../../../../client/interpreter/autoSelection/constants';
import { InterpreterEvaluation } from '../../../../client/interpreter/autoSelection/interpreterSecurity/interpreterEvaluation';
import { IInterpreterSecurityStorage } from '../../../../client/interpreter/autoSelection/types';
import { IInterpreterHelper } from '../../../../client/interpreter/contracts';

const prompts = [
    InteractiveShiftEnterBanner.bannerLabelYes(),
    InteractiveShiftEnterBanner.bannerLabelNo(),
    Common.learnMore(),
    Common.doNotShowAgain()
];

suite('Interpreter Evaluation', () => {
    const resource = Uri.parse('a');
    let persistentStateFactory: Typemoq.IMock<IPersistentStateFactory>;
    let applicationShell: Typemoq.IMock<IApplicationShell>;
    let browserService: Typemoq.IMock<IBrowserService>;
    let interpreterHelper: Typemoq.IMock<IInterpreterHelper>;
    let interpreterSecurityStorage: Typemoq.IMock<IInterpreterSecurityStorage>;
    let unsafeInterpreterPromptEnabled: Typemoq.IMock<IPersistentState<boolean>>;
    let areInterpretersInWorkspaceSafe: Typemoq.IMock<IPersistentState<boolean | undefined>>;
    let interpreterEvaluation: InterpreterEvaluation;
    setup(() => {
        persistentStateFactory = Typemoq.Mock.ofType<IPersistentStateFactory>();
        applicationShell = Typemoq.Mock.ofType<IApplicationShell>();
        browserService = Typemoq.Mock.ofType<IBrowserService>();
        interpreterHelper = Typemoq.Mock.ofType<IInterpreterHelper>();
        interpreterSecurityStorage = Typemoq.Mock.ofType<IInterpreterSecurityStorage>();
        unsafeInterpreterPromptEnabled = Typemoq.Mock.ofType<IPersistentState<boolean>>();
        areInterpretersInWorkspaceSafe = Typemoq.Mock.ofType<IPersistentState<boolean | undefined>>();
        interpreterSecurityStorage.setup(i => i.getKeyForWorkspace(resource)).returns(() => resource.fsPath);
        persistentStateFactory
            .setup(i => i.createGlobalPersistentState<boolean | undefined>(resource.fsPath, undefined))
            .returns(() => areInterpretersInWorkspaceSafe.object);
        persistentStateFactory
            .setup(p => p.createGlobalPersistentState(unsafeInterpreterPromptKey, true))
            .returns(() => unsafeInterpreterPromptEnabled.object);
        interpreterEvaluation = new InterpreterEvaluation(
            persistentStateFactory.object,
            applicationShell.object,
            browserService.object,
            interpreterHelper.object,
            interpreterSecurityStorage.object
        );
    });

    suite('Method evaluateIfInterpreterIsSafe()', () => {
        test('If no workspaces are opened, return true', async () => {
            // tslint:disable-next-line: no-any
            const interpreter = { path: 'interpreterPath' } as any;
            interpreterHelper.setup(i => i.getActiveWorkspaceUri(resource)).returns(() => undefined);
            const isSafe = await interpreterEvaluation.evaluateIfInterpreterIsSafe(interpreter, resource);
            expect(isSafe).to.equal(true, 'Should be true');
        });

        test('If method inferValueFromStorage() returns a defined value, return the value', async () => {
            // tslint:disable-next-line: no-any
            const interpreter = { path: 'interpreterPath' } as any;
            interpreterHelper
                .setup(i => i.getActiveWorkspaceUri(resource))
                .returns(
                    () =>
                        ({
                            folderUri: resource
                            // tslint:disable-next-line: no-any
                        } as any)
                );
            // tslint:disable-next-line: no-any
            interpreterEvaluation.inferValueUsingStorage = () => 'storageValue' as any;
            const isSafe = await interpreterEvaluation.evaluateIfInterpreterIsSafe(interpreter, resource);
            expect(isSafe).to.equal('storageValue');
        });

        test('If method inferValueFromStorage() returns a undefined value, infer the value using the prompt and return it', async () => {
            // tslint:disable-next-line: no-any
            const interpreter = { path: 'interpreterPath' } as any;
            interpreterHelper
                .setup(i => i.getActiveWorkspaceUri(resource))
                .returns(
                    () =>
                        ({
                            folderUri: resource
                            // tslint:disable-next-line: no-any
                        } as any)
                );
            interpreterEvaluation.inferValueUsingStorage = () => undefined;
            // tslint:disable-next-line: no-any
            interpreterEvaluation._inferValueUsingPrompt = () => 'promptValue' as any;
            const isSafe = await interpreterEvaluation.evaluateIfInterpreterIsSafe(interpreter, resource);
            expect(isSafe).to.equal('promptValue');
        });
    });

    suite('Method inferValueUsingStorage()', () => {
        test('If no workspaces are opened, return true', async () => {
            // tslint:disable-next-line: no-any
            const interpreter = { path: 'interpreterPath' } as any;
            interpreterHelper.setup(i => i.getActiveWorkspaceUri(resource)).returns(() => undefined);
            const isSafe = interpreterEvaluation.inferValueUsingStorage(interpreter, resource);
            expect(isSafe).to.equal(true, 'Should be true');
        });

        test('If interpreter is stored outside the workspace, return true', async () => {
            // tslint:disable-next-line: no-any
            const interpreter = { path: 'interpreterPath' } as any;
            interpreterHelper
                .setup(i => i.getActiveWorkspaceUri(resource))
                .returns(
                    () =>
                        ({
                            folderUri: resource
                            // tslint:disable-next-line: no-any
                        } as any)
                );
            const isSafe = interpreterEvaluation.inferValueUsingStorage(interpreter, resource);
            expect(isSafe).to.equal(true, 'Should be true');
        });

        test('If interpreter is stored in the workspace but method _areInterpretersInWorkspaceSafe() returns a defined value, return the value', async () => {
            // tslint:disable-next-line: no-any
            const interpreter = { path: `${resource.fsPath}/interpreterPath` } as any;
            interpreterHelper
                .setup(i => i.getActiveWorkspaceUri(resource))
                .returns(
                    () =>
                        ({
                            folderUri: resource
                            // tslint:disable-next-line: no-any
                        } as any)
                );
            // tslint:disable-next-line: no-any
            interpreterEvaluation._areInterpretersInWorkspaceSafe = () => 'areInterpretersInWorkspaceSafeValue' as any;
            const isSafe = interpreterEvaluation.inferValueUsingStorage(interpreter, resource);
            expect(isSafe).to.equal('areInterpretersInWorkspaceSafeValue');
        });

        test('If prompt has been disabled, return true', async () => {
            // tslint:disable-next-line: no-any
            const interpreter = { path: `${resource.fsPath}/interpreterPath` } as any;
            interpreterHelper
                .setup(i => i.getActiveWorkspaceUri(resource))
                .returns(
                    () =>
                        ({
                            folderUri: resource
                            // tslint:disable-next-line: no-any
                        } as any)
                );
            unsafeInterpreterPromptEnabled.setup(s => s.value).returns(() => false);
            interpreterEvaluation._areInterpretersInWorkspaceSafe = () => undefined;
            const isSafe = interpreterEvaluation.inferValueUsingStorage(interpreter, resource);
            expect(isSafe).to.equal(true, 'Should be true');
        });

        test('Otherwise return `undefined`', async () => {
            // tslint:disable-next-line: no-any
            const interpreter = { path: `${resource.fsPath}/interpreterPath` } as any;
            interpreterHelper
                .setup(i => i.getActiveWorkspaceUri(resource))
                .returns(
                    () =>
                        ({
                            folderUri: resource
                            // tslint:disable-next-line: no-any
                        } as any)
                );
            unsafeInterpreterPromptEnabled.setup(s => s.value).returns(() => true);
            interpreterEvaluation._areInterpretersInWorkspaceSafe = () => undefined;
            const isSafe = interpreterEvaluation.inferValueUsingStorage(interpreter, resource);
            expect(isSafe).to.equal(undefined, 'Should be undefined');
        });
    });

    suite('Method _areInterpretersInWorkspaceSafe()', () => {
        test('If areInterpretersInWorkspaceSafe storage carries a defined value, return it', () => {
            interpreterSecurityStorage.setup(i => i.getKeyForWorkspace(resource)).returns(() => resource.fsPath);
            areInterpretersInWorkspaceSafe
                .setup(i => i.value)
                // tslint:disable-next-line: no-any
                .returns(() => 'areInterpretersInWorkspaceSafeValue' as any);
            const isSafe = interpreterEvaluation._areInterpretersInWorkspaceSafe(resource);
            expect(isSafe).to.equal('areInterpretersInWorkspaceSafeValue');
        });

        test('If areInterpretersInWorkspaceSafe storage is set to `undefined`, return `undefined`', () => {
            interpreterSecurityStorage.setup(i => i.getKeyForWorkspace(resource)).returns(() => resource.fsPath);
            areInterpretersInWorkspaceSafe.setup(i => i.value).returns(() => undefined);
            const isSafe = interpreterEvaluation._areInterpretersInWorkspaceSafe(resource);
            expect(isSafe).to.equal(undefined, 'Should be undefined');
        });
    });

    suite('Method _inferValueUsingPrompt()', () => {
        test('If `Learn more` is selected, launch URL & keep showing the prompt again until user clicks some other option', async () => {
            let promptDisplayCount = 0;
            // Select `Learn more` 2 times, then select something else the 3rd time.
            const showInformationMessage = () => {
                promptDisplayCount += 1;
                return Promise.resolve(promptDisplayCount < 3 ? Common.learnMore() : 'Some other option');
            };
            applicationShell
                .setup(a => a.showInformationMessage(Interpreters.unsafeInterpreterMessage(), ...prompts))
                .returns(showInformationMessage)
                .verifiable(Typemoq.Times.exactly(3));
            browserService
                .setup(b => b.launch('https://aka.ms/AA7jfor'))
                .returns(() => undefined)
                .verifiable(Typemoq.Times.exactly(2));

            await interpreterEvaluation._inferValueUsingPrompt(resource);

            applicationShell.verifyAll();
            browserService.verifyAll();
        });

        test('If `No` is selected, update the areInterpretersInWorkspaceSafe storage to unsafe and return false', async () => {
            applicationShell
                .setup(a => a.showInformationMessage(Interpreters.unsafeInterpreterMessage(), ...prompts))
                .returns(() => Promise.resolve(InteractiveShiftEnterBanner.bannerLabelNo()))
                .verifiable(Typemoq.Times.once());
            areInterpretersInWorkspaceSafe
                .setup(i => i.updateValue(false))
                .returns(() => Promise.resolve(undefined))
                .verifiable(Typemoq.Times.once());

            const result = await interpreterEvaluation._inferValueUsingPrompt(resource);
            expect(result).to.equal(false, 'Should be false');

            applicationShell.verifyAll();
            areInterpretersInWorkspaceSafe.verifyAll();
        });

        test('If `Yes` is selected, update the areInterpretersInWorkspaceSafe storage to safe and return true', async () => {
            applicationShell
                .setup(a => a.showInformationMessage(Interpreters.unsafeInterpreterMessage(), ...prompts))
                .returns(() => Promise.resolve(InteractiveShiftEnterBanner.bannerLabelYes()))
                .verifiable(Typemoq.Times.once());
            areInterpretersInWorkspaceSafe
                .setup(i => i.updateValue(true))
                .returns(() => Promise.resolve(undefined))
                .verifiable(Typemoq.Times.once());

            const result = await interpreterEvaluation._inferValueUsingPrompt(resource);
            expect(result).to.equal(true, 'Should be true');

            applicationShell.verifyAll();
            areInterpretersInWorkspaceSafe.verifyAll();
        });

        test('If no selection is made, update the areInterpretersInWorkspaceSafe storage to unsafe and return false', async () => {
            applicationShell
                .setup(a => a.showInformationMessage(Interpreters.unsafeInterpreterMessage(), ...prompts))
                .returns(() => Promise.resolve(undefined))
                .verifiable(Typemoq.Times.once());
            areInterpretersInWorkspaceSafe
                .setup(i => i.updateValue(false))
                .returns(() => Promise.resolve(undefined))
                .verifiable(Typemoq.Times.once());

            const result = await interpreterEvaluation._inferValueUsingPrompt(resource);
            expect(result).to.equal(false, 'Should be false');

            applicationShell.verifyAll();
            areInterpretersInWorkspaceSafe.verifyAll();
        });
    });
});
