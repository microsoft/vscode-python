import { Architecture } from '../../common/utils/platform';
import { shellExecute } from '../common/externalDependencies';
import { buildPythonExecInfo } from '../exec';
import { getInterpreterInfo } from './interpreter';
import { PythonVersion } from './pythonVersion';
import { IWorkerPool, QueuePosition, WorkerPool } from './workerPool';

export enum InterpreterType {
    unknown,
    cpython
}

export enum EnvironmentType {
    Unknown,
    Conda,
    Poetry,
    PyEnv,
    PipEnv,
    WindowsStore,
    VEnv,
    VirtualEnvWrapper,
    VirtualEnv,
    Global,
    System
}

export interface IEnvironmentInfo {
    interpreterPath: string;
    interpreterType: InterpreterType;
    environmentType: EnvironmentType;
    architecture: Architecture;
    version?: PythonVersion;
}

class EnvironmentInfo implements IEnvironmentInfo {
    public constructor(
        public interpreterPath: string,
        public interpreterType: InterpreterType,
        public environmentType: EnvironmentType,
        public architecture: Architecture,
        public version?: PythonVersion
    ) {}
}

export enum EnvironmentInfoServiceQueuePriority {
    Default,
    High
}

export interface IEnvironmentInfoService {
    getEnvironmentInfo(
        interpreterPath: string,
        priority: EnvironmentInfoServiceQueuePriority
    ): Promise<IEnvironmentInfo | undefined>;
}

export class EnvironmentInfoService implements IEnvironmentInfoService {
    public constructor(private readonly workerPool?: IWorkerPool<string, IEnvironmentInfo | undefined>) {
        if (!this.workerPool) {
            this.workerPool = new WorkerPool<string, IEnvironmentInfo | undefined>(async (interpreterPath: string) => {
                const interpreterInfo = await getInterpreterInfo(buildPythonExecInfo(interpreterPath), shellExecute);
                if (interpreterInfo && interpreterInfo.version) {
                    return new EnvironmentInfo(
                        interpreterPath,
                        InterpreterType.cpython,
                        EnvironmentType.Unknown, // This will be handled later
                        interpreterInfo.architecture,
                        {
                            raw: interpreterInfo.version.raw,
                            major: interpreterInfo.version.major,
                            minor: interpreterInfo.version.minor,
                            patch: interpreterInfo.version.patch,
                            build: interpreterInfo.version.build,
                            prerelease: interpreterInfo.version.prerelease
                        }
                    );
                }
                return undefined;
            });
        }
    }

    public async getEnvironmentInfo(
        interpreterPath: string,
        priority: EnvironmentInfoServiceQueuePriority = EnvironmentInfoServiceQueuePriority.Default
    ): Promise<IEnvironmentInfo | undefined> {
        if (priority === EnvironmentInfoServiceQueuePriority.High) {
            return this.workerPool?.addToQueue(interpreterPath, QueuePosition.Front);
        }
        return this.workerPool?.addToQueue(interpreterPath, QueuePosition.Back);
    }
}
