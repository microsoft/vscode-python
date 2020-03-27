// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Disposable, Uri } from 'vscode';
import {
    IActiveResourceService,
    ICommandManager,
    IDocumentManager,
    IWorkspaceService,
} from '../../client/common/application/types';
import { Commands } from '../../client/common/constants';
import { IServiceContainer } from '../../client/ioc/types';
import { ReplProvider } from '../../client/providers/replProvider';
import { ICodeExecutionService } from '../../client/terminals/types';

// tslint:disable-next-line:max-func-body-length
suite('REPL Provider', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let commandManager: TypeMoq.IMock<ICommandManager>;
    let workspace: TypeMoq.IMock<IWorkspaceService>;
    let codeExecutionService: TypeMoq.IMock<ICodeExecutionService>;
    let documentManager: TypeMoq.IMock<IDocumentManager>;
    let activeResourceService: TypeMoq.IMock<IActiveResourceService>;
    let replProvider: ReplProvider;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        commandManager = TypeMoq.Mock.ofType<ICommandManager>();
        workspace = TypeMoq.Mock.ofType<IWorkspaceService>();
        codeExecutionService = TypeMoq.Mock.ofType<ICodeExecutionService>();
        documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
        activeResourceService = TypeMoq.Mock.ofType<IActiveResourceService>();
        serviceContainer.setup((c) => c.get(ICommandManager)).returns(() => commandManager.object);
        serviceContainer.setup((c) => c.get(IWorkspaceService)).returns(() => workspace.object);
        serviceContainer
            .setup((c) => c.get(ICodeExecutionService, TypeMoq.It.isValue('repl')))
            .returns(() => codeExecutionService.object);
        serviceContainer.setup((c) => c.get(IDocumentManager)).returns(() => documentManager.object);
        serviceContainer.setup((c) => c.get(IActiveResourceService)).returns(() => activeResourceService.object);
    });
    teardown(() => {
        try {
            replProvider.dispose();
            // tslint:disable-next-line:no-empty
        } catch {}
    });

    test('Ensure command is registered', () => {
        replProvider = new ReplProvider(serviceContainer.object);
        commandManager.verify(
            (c) => c.registerCommand(TypeMoq.It.isValue(Commands.Start_REPL), TypeMoq.It.isAny(), TypeMoq.It.isAny()),
            TypeMoq.Times.once()
        );
    });

    test('Ensure command handler is disposed', () => {
        const disposable = TypeMoq.Mock.ofType<Disposable>();
        commandManager
            .setup((c) =>
                c.registerCommand(TypeMoq.It.isValue(Commands.Start_REPL), TypeMoq.It.isAny(), TypeMoq.It.isAny())
            )
            .returns(() => disposable.object);

        replProvider = new ReplProvider(serviceContainer.object);
        replProvider.dispose();

        disposable.verify((d) => d.dispose(), TypeMoq.Times.once());
    });

    test('Ensure execution is carried smoothly in the handler if there are no errors', () => {
        const resource = Uri.parse('a');
        const disposable = TypeMoq.Mock.ofType<Disposable>();
        let commandHandler: undefined | (() => void);
        commandManager
            .setup((c) =>
                c.registerCommand(TypeMoq.It.isValue(Commands.Start_REPL), TypeMoq.It.isAny(), TypeMoq.It.isAny())
            )
            .returns((_cmd, callback) => {
                commandHandler = callback;
                return disposable.object;
            });
        activeResourceService
            .setup((a) => a.getActiveResource())
            .returns(() => resource)
            .verifiable(TypeMoq.Times.once());

        replProvider = new ReplProvider(serviceContainer.object);
        expect(commandHandler).not.to.be.equal(undefined, 'Handler not set');
        commandHandler!.call(replProvider);

        serviceContainer.verify(
            (c) => c.get(TypeMoq.It.isValue(ICodeExecutionService), TypeMoq.It.isValue('repl')),
            TypeMoq.Times.once()
        );
        codeExecutionService.verify((c) => c.initializeRepl(TypeMoq.It.isValue(resource)), TypeMoq.Times.once());
    });
});
