// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import '../../../../common/extensions';
import { PythonEnvKind } from '../../info';
import { BasicEnvInfo, IPythonEnvsIterator } from '../../locator';
import { Conda, CondaEnvInfo, getCondaEnvironmentsTxt } from '../../../common/environmentManagers/conda';
import { traceError, traceInfo, traceVerbose } from '../../../../logging';
import { FSWatchingLocator } from './fsWatchingLocator';
// import * as fsextra from 'fs-extra';
import { pathExists } from 'fs-extra';
import * as crypto from 'crypto';


import { exec } from 'child_process';
import ContextManager from '../composite/envsCollectionService';
import { PySparkParam } from '../../../../browser/extension';

function exportCondaEnv(name: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(`conda env export -n ${name}`, (error, stdout, stderr) => {
            if (error) {
                reject(`Error exporting environment: ${stderr}`);
                return;
            }
            resolve(stdout);
        });
    });
}

function getMd5Hash(value: string): string {
    return crypto.createHash('md5').update(value).digest('hex');
}

function preprocessAndHashDependencies(value: string): string {
    // 将输入字符串按行分割
    const lines = value.split('\n');

    // 找到 `dependencies:` 的起始行
    const dependenciesStartIndex = lines.findIndex(line => line.trim() === 'dependencies:');

    // 找到 `dependencies:` 之后的 `prefix:` 行，表示 dependencies 结束
    const prefixStartIndex = lines.findIndex(line => line.trim().startsWith('prefix:'));

    // 提取 dependencies 部分的内容（跳过 `dependencies:` 行）
    const dependencies = lines.slice(dependenciesStartIndex + 1, prefixStartIndex).map(line => line.trim());

    // 去除空行
    const filteredDependencies = dependencies.filter(line => line !== '');

    // 对 dependencies 内容进行排序
    const sortedDependencies = filteredDependencies.sort();

    // 将排序后的 dependencies 内容组合成一个字符串
    const processedDependencies = sortedDependencies.join('\n');

    // 生成并返回 MD5 哈希
    return getMd5Hash(processedDependencies);
}

async function compareDetails(storeDetail: string, detail: string | undefined): Promise<boolean> {
    if (!detail) {
        return false;
    }
    try {
        const storeDetailHash = preprocessAndHashDependencies(storeDetail);
        const detailHash = preprocessAndHashDependencies(detail);
    
        return storeDetailHash === detailHash;
    } catch (error) {
        traceError('Error comparing details:', error);
        return false; // 出现异常时返回 false
    }
}

interface PySparkEnvironmentMeta {
    id: number;
    proId: number;
    name: string;
    hdfsPath: string;
    detail: string;
    description: string | null;
    createBy: string;
    createTime: string;
    level: number;
}

async function fetchEnvironments(): Promise<PySparkEnvironmentMeta[]> {
    try {
        // 获取存储的 PySparkParam 对象
        const pySparkParam = ContextManager.getInstance().getContext().globalState.get<PySparkParam>('pyspark.paramRegister.copy');

        let proId = "0";
        // 检查是否成功获取到数据
        if (pySparkParam) {
            // 通过属性名获取 projectId 和 projectCode
            const { projectId } = pySparkParam;
            const { projectCode } = pySparkParam;

            console.log(`Project ID: ${projectId}`);
            console.log(`Project Code: ${projectCode}`);

            if (projectId) {
                proId = projectId;
            }
        } else {
            console.log('No PySparkParam found in global state.');
        }
        
        const response = await fetch(`${ContextManager.getInstance().getContext().globalState.get<string>('gateway.addr')}/env/pyspark/list?proId=${proId}`, {
            method: 'GET',
            headers: {
                Cookie: 'token=2345fc15-fe44-4e3b-afbc-24688c2f5f70;userId=idegw',
                'content-type': 'application/json',
                operator: 'hu.tan@msxf.com',
            },
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const environments: PySparkEnvironmentMeta[] = await response.json();
        return environments;
    } catch (error) {
        console.error('Error fetching environments:', error);
        traceError(`Error fetching environments: ${error}`)
        return []; // 返回空数组作为错误处理
    }
}

// 检查并处理环境
function checkAndReplaceEnv(envs: CondaEnvInfo[], expectedBasicEnv: CondaEnvInfo): boolean {
    for (let i = 0; i < envs.length; i++) {
        const env = envs[i];
        // 如果找到一个匹配的 prefix 或 name
        if (env.prefix === expectedBasicEnv.prefix || env.name === expectedBasicEnv.name) {
            envs[i].level = expectedBasicEnv.level;
            // 如果 status 也匹配，什么都不做，返回 true
            if (env.status === expectedBasicEnv.status || expectedBasicEnv.status === 0) {
                return true;
            } else {
                // 如果 status 不匹配，用 expectedBasicEnv 替换当前的 env，然后返回 true
                envs[i] = expectedBasicEnv;
                return true;
            }
        }
    }
    // 如果没有找到匹配的 prefix 或 name，返回 false
    return false;
}

export class CondaEnvironmentLocator extends FSWatchingLocator {
    public readonly providerId: string = 'conda-envs';

    public constructor() {
        super(
            () => getCondaEnvironmentsTxt(),
            async () => PythonEnvKind.Conda,
            { isFile: true },
        );
    }

    // eslint-disable-next-line class-methods-use-this
    public async *doIterEnvs(): IPythonEnvsIterator<BasicEnvInfo> {
        
        // // 测试用：获取存储的 PySparkParam 对象
        // const pySparkParam = ContextManager.getInstance().getContext().globalState.get<PySparkParam>('pyspark.paramRegister.copy');

        // // 检查是否成功获取到数据
        // if (pySparkParam) {
        //     // 通过属性名获取 projectId 和 projectCode
        //     const { projectId } = pySparkParam;
        //     const { projectCode } = pySparkParam;

        //     console.log(`Project ID: ${projectId}`);
        //     console.log(`Project Code: ${projectCode}`);
        // } else {
        //     console.log('No PySparkParam found in global state.');
        // }

        const conda = await Conda.getConda();
        if (conda === undefined) {
            traceVerbose(`Couldn't locate the conda binary.`);
            return;
        }
        traceVerbose(`Searching for conda environments using ${conda.command}`);

        // ----------------------------part.1 本地conda的环境------------
        const envs = await conda.getEnvList();
        const condaInfo = await conda.getInfo();
        const firstEnvDir = condaInfo.envs_dirs && condaInfo.envs_dirs.length > 0 ? condaInfo.envs_dirs[0] : undefined;

        // ----------------------------part.2 项目空间拉取的环境------------
        if (firstEnvDir) {
            try {
                // 请求 gateway 接口，根据项目 id 查询该环境 list
                const environments = await fetchEnvironments();
                // const environments: PySparkEnvironmentMeta[] = [
                //     {
                //         id: 1,
                //         proId: 101,
                //         name: "python3.9",
                //         hdfsPath: "/user/hadoop/spark_env1",
                //         detail: "Configuration details for Spark Environment 1",
                //         description: "This is the first Spark environment setup.",
                //         createBy: "admin",
                //         createTime: "2024-08-01 12:00:00",
                //         level: 0
                //     },
                //     {
                //         id: 2,
                //         proId: 102,
                //         name: "Spark Environment 2",
                //         hdfsPath: "/user/hadoop/spark_env2",
                //         detail: "Configuration details for Spark Environment 2",
                //         description: "This is the second Spark environment setup.",
                //         createBy: "user1",
                //         createTime: "2024-08-15 08:30:00",
                //         level: 1
                //     },
                //     {
                //         id: 3,
                //         proId: 103,
                //         name: "Spark Environment 3",
                //         hdfsPath: "/user/hadoop/spark_env3",
                //         detail: "Configuration details for Spark Environment 3",
                //         description: null,  // No description provided
                //         createBy: "admin",
                //         createTime: "2024-08-22 17:45:00",
                //         level: 1
                //     }
                // ];
                // 使用 for...of 循环替代 forEach，以确保异步操作按顺序执行
                for (const environment of environments) {
                    // console.log(`python env: ${JSON.stringify(environment)}`)
                    const prefix = `${firstEnvDir}/${environment.name}`;

                    const expectedBasicEnv: CondaEnvInfo = {
                        prefix: `${prefix}`, // 动态生成 prefix
                        name: `${environment.name}`, // 动态生成 name
                        status: 0,
                        detail: environment.detail,
                        level: environment.level
                    };

                    // 创建目录，本地目录存在则表示该环境也存在，不做拉取
                    if (await pathExists(prefix)) {
                        // 请求 gateway 接口，查询该环境是否与项目空间同步
                        try {
                            let isSync = false;

                            await exportCondaEnv(environment.name)
                                .then(async (output) => {
                                    traceInfo('Exported environment:');
                                    traceInfo(output);
                                    isSync = await compareDetails(
                                        environment.detail,
                                        output,
                                    );
                                    traceError(`aaaaa: ${isSync}`)
                                })
                                .catch((error) => {
                                    console.error(error);
                                });

                            traceInfo(`Comparison result:, ${isSync}`);
                            if (isSync) {
                                expectedBasicEnv.status = 2;
                            }
                        } catch (error) {
                            traceInfo(`Error during comparison:, ${error}`);
                        }
                    } else {
                        // await fsextra.mkdirp(prefix);
                    }

                    // 检查是否已经存在相同 prefix 或 name 的环境
                    // const exists = envs.some(
                    //     (env) => (env.prefix === expectedBasicEnv.prefix || env.name === expectedBasicEnv.name) && env.status === expectedBasicEnv.status,
                    // );

                    const exists = checkAndReplaceEnv(envs, expectedBasicEnv)

                    // 如果不存在，则将 expectedBasicEnv 添加到 envs 数组中
                    if (!exists) {
                        envs.push(expectedBasicEnv);
                    }
                }
            } catch (error) {
                console.error('Error fetching environments:', error);
                traceError(`Error fetching environments:, ${error}`);
                // 可以在这里进行错误处理，例如记录日志、发送通知等
            }
        } else {
            console.log('envs_dirs 不存在或为空');
            traceError(`envs_dirs 不存在或为空`)
        }

        // 继续处理本地 conda 环境
        for (const env of envs) {
            try {
                traceVerbose(`Looking into conda env for executable: ${JSON.stringify(env)}`);
                const executablePath = await conda.getInterpreterPathForEnvironment(env);
                traceVerbose(`Found conda executable: ${executablePath}`);
                yield { 
                    kind: PythonEnvKind.Conda, 
                    executablePath, 
                    envPath: env.prefix,
                    status: env.status ?? 1,
                    detail: env.detail,
                    level: env.level ?? 1,
                };
            } catch (ex) {
                console.error(`Failed to process conda env: ${JSON.stringify(env)}`, ex);
            }
        }
        traceVerbose(`Finished searching for conda environments`);
    }
}
