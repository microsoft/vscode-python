// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { expect } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { PlatformService } from '../../../../client/common/platform/platformService';
import { IPlatformService } from '../../../../client/common/platform/types';
import { ProcessService } from '../../../../client/common/process/proc';
import { ProcessServiceFactory } from '../../../../client/common/process/processFactory';
import { IProcessService, IProcessServiceFactory } from '../../../../client/common/process/types';
import { OSType } from '../../../../client/common/utils/platform';
import { AttachProcessProvider } from '../../../../client/debugger/extension/attachQuickPick/provider';
import { PsProcessParser } from '../../../../client/debugger/extension/attachQuickPick/psProcessParser';
import { IAttachItem } from '../../../../client/debugger/extension/attachQuickPick/types';
import { WmicProcessParser } from '../../../../client/debugger/extension/attachQuickPick/wmicProcessParser';

// tslint:disable-next-line: max-func-body-length
suite('Attach to process - process provider', () => {
    let platformService: IPlatformService;
    let processService: IProcessService;
    let processServiceFactory: IProcessServiceFactory;

    let provider: AttachProcessProvider;

    const psOutput = `
    aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n\
    1 launchd                                            launchd\n\
   41 syslogd                                            syslogd\n\
  146 kextd                                              kextd\n\
31896 python                                             python script.py\n\
`;

    const windowsOutput = `
CommandLine=\r\n\
Name=System\r\n\
ProcessId=4\r\n\
\r\n\
\r\n\
CommandLine=\r\n\
Name=svchost.exe\r\n\
ProcessId=5372\r\n\
\r\n\
\r\n\
CommandLine=sihost.exe\r\n\
Name=sihost.exe\r\n\
ProcessId=5728\r\n\
\r\n\
\r\n\
CommandLine=C:\\WINDOWS\\system32\\svchost.exe -k UnistackSvcGroup -s CDPUserSvc\r\n\
Name=svchost.exe\r\n\
ProcessId=5912\r\n\
\r\n\
\r\n\
CommandLine=C:\\Users\\Contoso\\AppData\\Local\\Programs\\Python\\Python37\\python.exe c:/Users/Contoso/Documents/hello_world.py\r\n\
Name=python.exe\r\n\
ProcessId=6028\r\n\
`;

    setup(() => {
        platformService = mock(PlatformService);
        processService = mock(ProcessService);
        when(processService.exec(WmicProcessParser.wmicCommand.command, anything(), anything())).thenResolve({ stdout: windowsOutput });
        when(processService.exec(PsProcessParser.psLinuxCommand.command, anything(), anything())).thenResolve({ stdout: psOutput });
        when(processService.exec(PsProcessParser.psDarwinCommand.command, anything(), anything())).thenResolve({ stdout: psOutput });
        processServiceFactory = mock(ProcessServiceFactory);
        when(processServiceFactory.create()).thenResolve(instance(processService));

        provider = new AttachProcessProvider(instance(platformService), instance(processServiceFactory));
    });

    test('The Linux process list command should be called if the platform is Linux', async () => {
        when(platformService.isMac).thenReturn(false);
        when(platformService.isLinux).thenReturn(true);
        const expectedOutput: IAttachItem[] = [
            {
                label: 'launchd',
                description: '1',
                detail: 'launchd',
                id: '1'
            },
            {
                label: 'syslogd',
                description: '41',
                detail: 'syslogd',
                id: '41'
            },
            {
                label: 'kextd',
                description: '146',
                detail: 'kextd',
                id: '146'
            },
            {
                label: 'python',
                description: '31896',
                detail: 'python script.py',
                id: '31896'
            }
        ];

        const attachItems = await provider._getInternalProcessEntries();

        verify(processService.exec(PsProcessParser.psLinuxCommand.command, PsProcessParser.psLinuxCommand.args, anything())).once();
        assert.deepEqual(attachItems, expectedOutput);
    });

    test('The macOS process list command should be called if the platform is macOS', async () => {
        when(platformService.isMac).thenReturn(true);
        const expectedOutput: IAttachItem[] = [
            {
                label: 'launchd',
                description: '1',
                detail: 'launchd',
                id: '1'
            },
            {
                label: 'syslogd',
                description: '41',
                detail: 'syslogd',
                id: '41'
            },
            {
                label: 'kextd',
                description: '146',
                detail: 'kextd',
                id: '146'
            },
            {
                label: 'python',
                description: '31896',
                detail: 'python script.py',
                id: '31896'
            }
        ];

        const attachItems = await provider._getInternalProcessEntries();

        verify(processService.exec(PsProcessParser.psDarwinCommand.command, PsProcessParser.psDarwinCommand.args, anything())).once();
        assert.deepEqual(attachItems, expectedOutput);
    });

    test('The Windows process list command should be called if the platform is Windows', async () => {
        when(platformService.isMac).thenReturn(false);
        when(platformService.isLinux).thenReturn(false);
        when(platformService.isWindows).thenReturn(true);
        const expectedOutput: IAttachItem[] = [
            {
                label: 'System',
                description: '4',
                detail: '',
                id: '4'
            },
            {
                label: 'svchost.exe',
                description: '5372',
                detail: '',
                id: '5372'
            },
            {
                label: 'sihost.exe',
                description: '5728',
                detail: 'sihost.exe',
                id: '5728'
            },
            {
                label: 'svchost.exe',
                description: '5912',
                detail: 'C:\\WINDOWS\\system32\\svchost.exe -k UnistackSvcGroup -s CDPUserSvc',
                id: '5912'
            },
            {
                label: 'python.exe',
                description: '6028',
                detail: 'C:\\Users\\Contoso\\AppData\\Local\\Programs\\Python\\Python37\\python.exe c:/Users/Contoso/Documents/hello_world.py',
                id: '6028'
            }
        ];

        const attachItems = await provider._getInternalProcessEntries();

        verify(processService.exec(WmicProcessParser.wmicCommand.command, WmicProcessParser.wmicCommand.args, anything())).once();
        assert.deepEqual(attachItems, expectedOutput);
    });

    test('An error should be thrown if the platform is neither Linux, macOS or Windows', async () => {
        when(platformService.isMac).thenReturn(false);
        when(platformService.isLinux).thenReturn(false);
        when(platformService.isWindows).thenReturn(false);
        when(platformService.osType).thenReturn(OSType.Unknown);

        const promise = provider._getInternalProcessEntries();

        await expect(promise).to.eventually.be.rejectedWith(`Operating system '${OSType.Unknown}' not supported.`);
    });

    test('Items returned by getAttachItems should be sorted alphabetically on Linux', async () => {
        when(platformService.isMac).thenReturn(false);
        when(platformService.isLinux).thenReturn(true);
        const expectedOutput: IAttachItem[] = [
            {
                label: 'kextd',
                description: '146',
                detail: 'kextd',
                id: '146'
            },
            {
                label: 'launchd',
                description: '1',
                detail: 'launchd',
                id: '1'
            },
            {
                label: 'python',
                description: '31896',
                detail: 'python script.py',
                id: '31896'
            },
            {
                label: 'syslogd',
                description: '41',
                detail: 'syslogd',
                id: '41'
            }
        ];

        const output = await provider.getAttachItems();

        assert.deepEqual(output, expectedOutput);
    });

    test('Items returned by getAttachItems should be sorted alphabetically on macOS', async () => {
        when(platformService.isMac).thenReturn(true);
        const expectedOutput: IAttachItem[] = [
            {
                label: 'kextd',
                description: '146',
                detail: 'kextd',
                id: '146'
            },
            {
                label: 'launchd',
                description: '1',
                detail: 'launchd',
                id: '1'
            },
            {
                label: 'python',
                description: '31896',
                detail: 'python script.py',
                id: '31896'
            },
            {
                label: 'syslogd',
                description: '41',
                detail: 'syslogd',
                id: '41'
            }
        ];

        const output = await provider.getAttachItems();

        assert.deepEqual(output, expectedOutput);
    });

    test('Items returned by getAttachItems should be sorted alphabetically on Windows', async () => {
        when(platformService.isMac).thenReturn(false);
        when(platformService.isLinux).thenReturn(false);
        when(platformService.isWindows).thenReturn(true);
        const expectedOutput: IAttachItem[] = [
            {
                label: 'python.exe',
                description: '6028',
                detail: 'C:\\Users\\Contoso\\AppData\\Local\\Programs\\Python\\Python37\\python.exe c:/Users/Contoso/Documents/hello_world.py',
                id: '6028'
            },
            {
                label: 'sihost.exe',
                description: '5728',
                detail: 'sihost.exe',
                id: '5728'
            },
            {
                label: 'svchost.exe',
                description: '5372',
                detail: '',
                id: '5372'
            },
            {
                label: 'svchost.exe',
                description: '5912',
                detail: 'C:\\WINDOWS\\system32\\svchost.exe -k UnistackSvcGroup -s CDPUserSvc',
                id: '5912'
            },

            {
                label: 'System',
                description: '4',
                detail: '',
                id: '4'
            }
        ];

        const output = await provider.getAttachItems();

        assert.deepEqual(output, expectedOutput);
    });
});
