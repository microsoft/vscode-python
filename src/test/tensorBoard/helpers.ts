import * as TypeMoq from 'typemoq';
import { IApplicationShell, ICommandManager } from '../../client/common/application/types';
import { IExperimentService, IPersistentStateFactory } from '../../client/common/types';
import { TensorBoardPrompt } from '../../client/tensorBoard/tensorBoardPrompt';
import { MockState } from '../interpreters/mocks';

export function createTensorBoardPromptWithMocks(): TensorBoardPrompt {
    const appShell = TypeMoq.Mock.ofType<IApplicationShell>();
    const commandManager = TypeMoq.Mock.ofType<ICommandManager>();
    const persistentStateFactory = TypeMoq.Mock.ofType<IPersistentStateFactory>();
    const expService = TypeMoq.Mock.ofType<IExperimentService>();
    const persistentState = new MockState(true);
    persistentStateFactory
        .setup((factory) => {
            factory.createWorkspacePersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny());
        })
        .returns(() => persistentState);
    return new TensorBoardPrompt(
        appShell.object,
        commandManager.object,
        persistentStateFactory.object,
        expService.object,
    );
}
