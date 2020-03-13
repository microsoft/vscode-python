import { ChildProcess } from 'child_process';
import { InterpreterUri } from '../../common/installer/types';
import { IDisposable } from '../../common/types';
// import { Resource } from '../../common/types';
import { PythonInterpreter } from '../../interpreter/contracts';

interface IKernelLauncher {
    launch(interpreterUri: InterpreterUri): Promise<IKernelProcess>;
}

interface IKernelConnection {
    version: number;
    iopub_port: number;
    shell_port: number;
    stdin_port: number;
    control_port: number;
    signature_scheme: 'hmac-sha256';
    hb_port: number;
    ip: string;
    key: string;
    transport: 'tcp' | 'ipc';
}

interface IKernelProcess extends IDisposable {
    process: ChildProcess;
    connection: IKernelConnection;
}

class KernelProcess implements IKernelProcess {
    private _process?: ChildProcess;
    private _connection?: IKernelConnection;
    private interpreter: InterpreterUri;
    public get process(): ChildProcess {
        return this._process!;
    }
    public get connection(): IKernelConnection {
        return this._connection!;
    }

    constructor(interpreter: InterpreterUri) {
        this.interpreter = interpreter;
    }

    public async launch(): Promise<void> {
        if (this.isPythonInterpreter(this.interpreter)) {
            // spawn process with a python interpreter
            // this._process = ;
        } else {
            // spawn process with a resource (uri)
            // this._process = ;
        }
        return Promise.resolve();
    }

    public dispose() {
        this._process?.kill();
    }

    private isPythonInterpreter(toBeDetermined: InterpreterUri): toBeDetermined is PythonInterpreter {
        if ((toBeDetermined as PythonInterpreter).type) {
            return true;
        }
        return false;
    }
}

class KernelLauncher implements IKernelLauncher {
    public async launch(interpreterUri: InterpreterUri): Promise<IKernelProcess> {
        const kernel = new KernelProcess(interpreterUri);
        await kernel.launch();
        return kernel;
    }
}
