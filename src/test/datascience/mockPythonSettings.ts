import { IWorkspaceService } from '../../client/common/application/types';
import { PythonSettings } from '../../client/common/configSettings';
import { IExperimentsManager, IInterpreterPathService, Resource } from '../../client/common/types';
import {
    IInterpreterAutoSeletionProxyService,
    IInterpreterSecurityService
} from '../../client/interpreter/autoSelection/types';

export class MockPythonSettings extends PythonSettings {
    constructor(
        workspaceFolder: Resource,
        interpreterAutoSelectionService: IInterpreterAutoSeletionProxyService,
        workspace?: IWorkspaceService,
        experimentsManager?: IExperimentsManager,
        interpreterPathService?: IInterpreterPathService,
        interpreterSecurityService?: IInterpreterSecurityService
    ) {
        super(
            workspaceFolder,
            interpreterAutoSelectionService,
            workspace,
            experimentsManager,
            interpreterPathService,
            interpreterSecurityService
        );
    }

    public fireChangeEvent() {
        this.changed.fire();
    }

    protected getPythonExecutable(v: string) {
        // Don't validate python paths during tests. On windows this can take 4 or 5 seconds
        // and slow down every test
        return v;
    }
}
