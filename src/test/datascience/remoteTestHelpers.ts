import { traceInfo } from '../../client/common/logger';
import { IPythonExecutionFactory, IPythonExecutionService, Output } from '../../client/common/process/types';
import { IDisposableRegistry } from '../../client/common/types';
import { createDeferred, sleep } from '../../client/common/utils/async';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { getIPConnectionInfo } from './jupyterHelpers';

export async function createPythonService(
    ioc: DataScienceIocContainer,
    versionRequirement?: number
): Promise<IPythonExecutionService | undefined> {
    if (!ioc.mockJupyter) {
        const python = await ioc.getJupyterCapableInterpreter();
        const pythonFactory = ioc.get<IPythonExecutionFactory>(IPythonExecutionFactory);

        if (python && python.version?.major && (!versionRequirement || python.version?.major > versionRequirement)) {
            return pythonFactory.createActivatedEnvironment({
                resource: undefined,
                interpreter: python,
                allowEnvironmentFetchExceptions: true,
                bypassCondaExecution: true
            });
        }
    }
}

export async function startRemoteServer(
    ioc: DataScienceIocContainer,
    pythonService: IPythonExecutionService,
    args: string[]
): Promise<string> {
    const connectionFound = createDeferred();
    const exeResult = pythonService.execObservable(args, {
        throwOnStdErr: false
    });
    ioc.get<IDisposableRegistry>(IDisposableRegistry).push(exeResult);
    exeResult.out.subscribe(
        (output: Output<string>) => {
            traceInfo(`Remote server output: ${output.out}`);
            const connectionURL = getIPConnectionInfo(output.out);
            if (connectionURL) {
                connectionFound.resolve(connectionURL);
            }
        },
        (e) => {
            traceInfo(`Remote server error: ${e}`);
            connectionFound.reject(e);
        }
    );

    traceInfo('Connecting to remote server');
    const connString = await connectionFound.promise;
    const uri = connString as string;

    // Wait another 3 seconds to give notebook time to be ready. Not sure
    // how else to know when it's okay to connect to. Mac on azure seems
    // to connect too fast and then is unable to actually communicate.
    await sleep(3000);

    return uri;
}
