import * as assert from 'assert';
import { expect } from 'chai';
import * as fsapi from 'fs-extra';
import * as path from 'path';
import * as sinon from 'sinon';
import * as util from 'util';
import * as platform from '../../../../client/common/utils/platform';
import * as externalDependencies from '../../../../client/pythonEnvironments/common/externalDependencies';
import * as windowsUtils from '../../../../client/pythonEnvironments/common/windowsUtils';
import {
    AnacondaDisplayName,
    Conda,
    CondaInfo,
} from '../../../../client/pythonEnvironments/discovery/locators/services/conda';
import {
    getDisplayName,
    parseCondaEnvFileContents,
} from '../../../../client/pythonEnvironments/discovery/locators/services/condaHelper';

// tslint:disable-next-line:max-func-body-length
suite('Interpreters display name from Conda Environments', () => {
    test('Must return default display name for invalid Conda Info', () => {
        assert.equal(getDisplayName(), AnacondaDisplayName, 'Incorrect display name');
        assert.equal(getDisplayName({}), AnacondaDisplayName, 'Incorrect display name');
    });
    test('Must return at least Python Version', () => {
        const info: CondaInfo = {
            python_version: '3.6.1.final.10',
        };
        const displayName = getDisplayName(info);
        assert.equal(displayName, AnacondaDisplayName, 'Incorrect display name');
    });
    test('Must return info without first part if not a python version', () => {
        const info: CondaInfo = {
            'sys.version':
                '3.6.1 |Anaconda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]',
        };
        const displayName = getDisplayName(info);
        assert.equal(displayName, 'Anaconda 4.4.0 (64-bit)', 'Incorrect display name');
    });
    test("Must return info without prefixing with word 'Python'", () => {
        const info: CondaInfo = {
            python_version: '3.6.1.final.10',
            'sys.version':
                '3.6.1 |Anaconda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]',
        };
        const displayName = getDisplayName(info);
        assert.equal(displayName, 'Anaconda 4.4.0 (64-bit)', 'Incorrect display name');
    });
    test('Must include Ananconda name if Company name not found', () => {
        const info: CondaInfo = {
            python_version: '3.6.1.final.10',
            'sys.version': '3.6.1 |4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]',
        };
        const displayName = getDisplayName(info);
        assert.equal(displayName, `4.4.0 (64-bit) : ${AnacondaDisplayName}`, 'Incorrect display name');
    });
    test('Parse conda environments', () => {
        // tslint:disable-next-line:no-multiline-string
        const environments = `
# conda environments:
#
base                  *  /Users/donjayamanne/anaconda3
                      *  /Users/donjayamanne/anaconda3
one                      /Users/donjayamanne/anaconda3/envs/one
 one                      /Users/donjayamanne/anaconda3/envs/ one
one two                  /Users/donjayamanne/anaconda3/envs/one two
three                    /Users/donjayamanne/anaconda3/envs/three
                         /Users/donjayamanne/anaconda3/envs/four
                         /Users/donjayamanne/anaconda3/envs/five six
aaaa_bbbb_cccc_dddd_eeee_ffff_gggg     /Users/donjayamanne/anaconda3/envs/aaaa_bbbb_cccc_dddd_eeee_ffff_gggg
aaaa_bbbb_cccc_dddd_eeee_ffff_gggg  *  /Users/donjayamanne/anaconda3/envs/aaaa_bbbb_cccc_dddd_eeee_ffff_gggg
with*star                /Users/donjayamanne/anaconda3/envs/with*star
with*one*two*three*four*five*six*seven*     /Users/donjayamanne/anaconda3/envs/with*one*two*three*four*five*six*seven*
with*one*two*three*four*five*six*seven*  *  /Users/donjayamanne/anaconda3/envs/with*one*two*three*four*five*six*seven*
                         /Users/donjayamanne/anaconda3/envs/seven `; // note the space after seven

        const expectedList = [
            { name: 'base', path: '/Users/donjayamanne/anaconda3', isActive: true },
            { name: '', path: '/Users/donjayamanne/anaconda3', isActive: true },
            { name: 'one', path: '/Users/donjayamanne/anaconda3/envs/one', isActive: false },
            { name: ' one', path: '/Users/donjayamanne/anaconda3/envs/ one', isActive: false },
            { name: 'one two', path: '/Users/donjayamanne/anaconda3/envs/one two', isActive: false },
            { name: 'three', path: '/Users/donjayamanne/anaconda3/envs/three', isActive: false },
            { name: '', path: '/Users/donjayamanne/anaconda3/envs/four', isActive: false },
            { name: '', path: '/Users/donjayamanne/anaconda3/envs/five six', isActive: false },
            {
                name: 'aaaa_bbbb_cccc_dddd_eeee_ffff_gggg',
                path: '/Users/donjayamanne/anaconda3/envs/aaaa_bbbb_cccc_dddd_eeee_ffff_gggg',
                isActive: false,
            },
            {
                name: 'aaaa_bbbb_cccc_dddd_eeee_ffff_gggg',
                path: '/Users/donjayamanne/anaconda3/envs/aaaa_bbbb_cccc_dddd_eeee_ffff_gggg',
                isActive: true,
            },
            { name: 'with*star', path: '/Users/donjayamanne/anaconda3/envs/with*star', isActive: false },
            {
                name: 'with*one*two*three*four*five*six*seven*',
                path: '/Users/donjayamanne/anaconda3/envs/with*one*two*three*four*five*six*seven*',
                isActive: false,
            },
            {
                name: 'with*one*two*three*four*five*six*seven*',
                path: '/Users/donjayamanne/anaconda3/envs/with*one*two*three*four*five*six*seven*',
                isActive: true,
            },
            { name: '', path: '/Users/donjayamanne/anaconda3/envs/seven ', isActive: false },
        ];

        const list = parseCondaEnvFileContents(environments);
        expect(list).deep.equal(expectedList);
    });
});

suite('Conda binary is located correctly', () => {
    // getOSType() is stubbed to return this.
    let osType: platform.OSType;

    // getUserHomeDir() is stubbed to return this.
    let homeDir: string | undefined;

    // getRegistryInterpreters() is stubbed to return this.
    let registryInterpreters: windowsUtils.IRegistryInterpreterData[];

    // readdir() and readFile() are stubbed to present a dummy file system based on this
    // object graph. Keys are filenames. For each key, if the corresponding value is an
    // object, it's considered a subdirectory, otherwise it's a file with that value as
    // its contents.
    type Directory = { [fileName: string]: string | Directory };
    let files: Directory;

    function getFile(filePath: string) {
        const segments = filePath.split(/[\\/]/);
        let dir: Directory | string = files;
        let currentPath = '';
        for (const fileName of segments) {
            if (typeof dir !== 'object') {
                throw new Error(`${currentPath} is not a directory`);
            }
            if (fileName === '') {
                continue;
            }
            dir = dir[fileName];
            currentPath = `${currentPath}/${fileName}`;
        }
        return dir;
    }

    // exec("command") is stubbed such that if either getFile(`${entry}/command`) or
    // getFile(`${entry}/command.exe`) returns a non-empty string, it succeeds with
    // that string as stdout. Otherwise, the exec stub throws. Empty strings can be
    // used to simulate files that are present but not executable.
    let execPath: string[];

    async function expectConda(expectedPath: string) {
        const expectedInfo = JSON.parse(getFile(expectedPath) as string);

        const conda = await Conda.locate();
        expect(conda).to.not.equal(undefined, 'conda should not be missing');

        const info = await conda!.getInfo();
        expect(info).to.deep.equal(expectedInfo);
    }

    function condaInfo(condaVersion: string): CondaInfo {
        return {
            conda_version: condaVersion,
            python_version: '3.9.0',
            'sys.version': '3.9.0',
            'sys.prefix': '/some/env',
            default_prefix: '/conda/base',
            envs: [],
        };
    }

    setup(() => {
        osType = platform.OSType.Unknown;
        homeDir = undefined;
        execPath = [];
        files = {};
        registryInterpreters = [];

        sinon.stub(windowsUtils, 'getRegistryInterpreters').callsFake(async () => registryInterpreters);

        sinon.stub(platform, 'getOSType').callsFake(() => osType);

        sinon.stub(platform, 'getUserHomeDir').callsFake(() => homeDir);

        sinon.stub(fsapi, 'readdir').callsFake(
            async (filePath: string | Buffer) => {
                if (typeof filePath !== 'string') {
                    throw new Error(`expected filePath to be string, got ${typeof filePath}`);
                }
                return Object.keys(getFile(filePath));
            }
        );

        // tslint:disable-next-line: no-any
        sinon.stub(fsapi, 'readFile' as any).callsFake(
            async (filePath: string | Buffer | number, encoding: string) => {
                if (typeof filePath !== 'string') {
                    throw new Error(`expected filePath to be string, got ${typeof filePath}`);
                } else if (encoding !== 'utf8') {
                    throw new Error(`Unsupported encoding ${encoding}`);
                }

                const contents = getFile(filePath);
                if (typeof contents !== 'string') {
                    throw new Error(`${filePath} is not a file`);
                }

                return contents;
            }
        );

        sinon.stub(externalDependencies, 'exec').callsFake(
            async (command: string, args: string[]) => {
                for (const prefix of ['', ...execPath]) {
                    const contents = getFile(path.join(prefix, command));
                    if (typeof contents !== 'string' || !contents) {
                        continue;
                    }
                    if (args[0] !== 'info' || args[1] !== '--json') {
                        throw new Error(`Invalid arguments: ${util.inspect(args)}`);
                    }
                    return { stdout: contents };
                }
                throw new Error(`${command} is missing or is not executable`);
            },
        );
    });

    teardown(() => {
        sinon.restore();
    });

    test('Must not find conda if it is missing', async () => {
        const conda = await Conda.locate();
        expect(conda).to.equal(undefined, 'conda should be missing');
    });

    test('Must find conda on PATH, and prefer it', async () => {
        osType = platform.OSType.Linux;
        execPath = ['/bin'];

        files = {
            bin: {
                conda: JSON.stringify(condaInfo('4.8.0')),
            },
            opt: {
                anaconda: {
                    bin: {
                        conda: JSON.stringify(condaInfo('4.8.1')),
                    },
                },
            },
        };

        await expectConda('/bin/conda');
    });

    suite('Must find conda in well-known locations', () => {
        for (const condaDirName of ['Anaconda', 'anaconda', 'Miniconda', 'miniconda']) {
            for (const prefix of ['/usr/share', '/usr/local/share', '/opt', '/home/user', '/home/user/opt']) {
                const condaPath = `${prefix}/${condaDirName}`;

                test(`Must find conda in ${condaPath}`, async () => {
                    osType = platform.OSType.Linux;
                    homeDir = '/home/user';

                    files = {
                        home: {
                            user: {
                                opt: {},
                            },
                        },
                        opt: {},
                        usr: {
                            share: {
                                doc: {},
                            },
                            local: {
                                share: {
                                    doc: {},
                                },
                            },
                        },
                    };

                    const prefixDir = getFile(prefix) as Directory;
                    prefixDir[condaDirName] = {
                        bin: {
                            conda: JSON.stringify(condaInfo('4.8.0')),
                        },
                    };

                    await expectConda(`${condaPath}/bin/conda`);
                });
            }

            // Drive letters are intentionally unusual to ascertain that locator doesn't hardcode paths.
            for (const prefix of ['D:\\ProgramData', 'E:\\Users\\user', 'F:\\Users\\user\\AppData\\Local\\Continuum']) {
                const condaPath = `${prefix}\\${condaDirName}`;

                test(`Must find conda in ${condaPath}`, async () => {
                    osType = platform.OSType.Windows;
                    homeDir = 'E:\\Users\\user';

                    sinon.stub(platform, 'getEnvironmentVariable')
                        .withArgs('PROGRAMDATA').returns('D:\\ProgramData')
                        .withArgs('LOCALAPPDATA')
                        .returns('F:\\Users\\user\\AppData\\Local');

                    files = {
                        'C:': {},
                        'D:': {
                            ProgramData: {},
                        },
                        'E:': {
                            Users: {
                                user: {},
                            },
                        },
                        'F:': {
                            Users: {
                                user: {
                                    AppData: {
                                        Local: {
                                            Continuum: {},
                                        },
                                    },
                                },
                            },
                        },
                    };

                    const prefixDir = getFile(prefix) as Directory;
                    prefixDir[condaDirName] = {
                        Scripts: {
                            'conda.exe': JSON.stringify(condaInfo('4.8.0')),
                        },
                    };

                    await expectConda(`${condaPath}\\Scripts\\conda.exe`);
                });
            }
        }
    });

    suite('Must find conda in environments.txt', () => {
        test(`Must find conda in environments.txt on Unix`, async () => {
            osType = platform.OSType.Linux;
            homeDir = '/home/user';

            files = {
                home: {
                    user: {
                        '.conda': {
                            'environments.txt': [
                                '',
                                '/missing',  // stale entries shouldn't break things
                                '',
                                '# comment',
                                '',
                                '  /present  ',  // whitespace should be ignored
                                '',
                            ].join('\n')
                        },
                    },
                },
                present: {
                    bin: {
                        conda: JSON.stringify(condaInfo('4.8.0')),
                    }
                },
            };

            await expectConda('/present/bin/conda');
        });

        test(`Must find conda in environments.txt on Windows`, async () => {
            osType = platform.OSType.Windows;
            homeDir = 'D:\\Users\\user';

            files = {
                'D:' : {
                    Users: {
                        user: {
                            '.conda': {
                                'environments.txt': [
                                    '',
                                    'C:\\Missing',  // stale entries shouldn't break things
                                    '',
                                    '# comment',
                                    '',
                                    '  E:\\Present  ',  // whitespace should be ignored
                                    '',
                                ].join('\r\n')
                            },
                        },
                    }
                },
                'E:': {
                    Present: {
                        Scripts: {
                            'conda.exe': JSON.stringify(condaInfo('4.8.0'))
                        }
                    }
                }
            };

            await expectConda('E:\\Present\\Scripts\\conda.exe');
        });
    });

    test('Must find conda in the registry', async () => {
        osType = platform.OSType.Windows;

        registryInterpreters = [
            {
                interpreterPath: 'C:\\Python2\\python.exe',
            },
            {
                interpreterPath: 'C:\\Anaconda2\\python.exe',
                distroOrgName: 'ContinuumAnalytics',
            },
            {
                interpreterPath: 'C:\\Python3\\python.exe',
                distroOrgName: 'PythonCore',
            },
            {
                interpreterPath: 'C:\\Anaconda3\\python.exe',
                distroOrgName: 'ContinuumAnalytics',
            },
        ];

        files = {
            'C:': {
                Python3: {
                    // Shouldn't be located because it's not a well-known conda path,
                    // and it's listed under PythonCore in the registry.
                    Scripts: {
                        'conda.exe': JSON.stringify(condaInfo('4.8.0'))
                    }
                },
                Anaconda2: {
                    // Shouldn't be located because it can't handle "conda info --json".
                    Scripts: {
                        'conda.exe': ''
                    }
                },
                Anaconda3: {
                    Scripts: {
                        'conda.exe': JSON.stringify(condaInfo('4.8.1'))
                    }
                },
            },
        };

        await expectConda('C:\\Anaconda3\\Scripts\\conda.exe');
    });
});

suite('Conda env list is parsed correctly', () => {
    const condaInfo = {
        conda_version: '4.8.0',
        python_version: '3.9.0',
        'sys.version': '3.9.0',
        'sys.prefix': '/some/env',
        root_prefix: '/home/user/miniconda3',
        default_prefix: '/home/user/miniconda3/envs/env1',
        envs_dirs: [
            '/home/user/miniconda3/envs',
            '/home/user/.conda/envs',
        ],
        envs: [
            '/home/user/miniconda3',
            '/home/user/miniconda3/envs/env1',
            '/home/user/miniconda3/envs/env2',
            '/home/user/miniconda3/envs/dir/env3',
            '/home/user/.conda/envs/env4',
            '/home/user/.conda/envs/env5',
            '/env6',
        ]
    };

    setup(() => {
        sinon.stub(externalDependencies, 'exec').callsFake(
            async (command: string, args: string[]) => {
                if (command !== 'conda') {
                    throw new Error(`Unknown command: ${util.inspect(command)}`);
                } else if (args[0] !== 'info' || args[1] !== '--json') {
                    throw new Error(`Invalid arguments: ${util.inspect(args)}`);
                }
                return { stdout: JSON.stringify(condaInfo) };
            },
        );
    });

    teardown(() => {
        sinon.restore();
    });

    test('Must compute conda environment name from prefix', async () => {
        const conda = new Conda("conda");
        const envs = await conda.getEnvList();
        expect(envs).to.have.deep.members([
            {
                prefix: '/home/user/miniconda3',
                name: 'base'
            },
            {
                prefix: '/home/user/miniconda3/envs/env1',
                name: 'env1'
            },
            {
                prefix: '/home/user/miniconda3/envs/env2',
                name: 'env2'
            },
            {
                prefix: '/home/user/miniconda3/envs/dir/env3',
                name: undefined  // because it's not directly under envs_dirs
            },
            {
                prefix: '/home/user/.conda/envs/env4',
                name: 'env4'
            },
            {
                prefix: '/home/user/.conda/envs/env5',
                name: 'env5'
            },
            {
                prefix: '/env6',
                name: undefined  // because it's not directly under envs_dirs
            },
        ]);

    });
});

