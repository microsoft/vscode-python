// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

//tslint:disable:no-require-imports no-require-imports no-var-requires no-any no-unnecessary-class max-func-body-length match-default-export-name

import { expect } from 'chai';
import * as path from 'path';
import rewiremock from 'rewiremock';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';
import { LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';
import {
    DotNetDownloadedLanguageClientFactory,
    DotNetLanguageClientFactory,
    DotNetSimpleLanguageClientFactory
} from '../../../client/activation/languageServer/languageClientFactory';
import { DotNetLanguageServerFolderService } from '../../../client/activation/languageServer/languageServerFolderService';
import { PlatformData } from '../../../client/activation/languageServer/platformData';
import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { EXTENSION_ROOT_DIR } from '../../../client/common/constants';
import { IConfigurationService, IPythonSettings } from '../../../client/common/types';
import { EnvironmentVariablesProvider } from '../../../client/common/variables/environmentVariablesProvider';
import { EnvironmentActivationService } from '../../../client/interpreter/activation/service';

const dotNetCommand = 'dotnet';
const languageClientName = 'Python Tools';

suite('Language Server - LanguageClient Factory', () => {
    let configurationService: IConfigurationService;
    let settings: IPythonSettings;
    setup(() => {
        configurationService = mock(ConfigurationService);
        settings = mock(PythonSettings);
        when(configurationService.getSettings(anything())).thenReturn(instance(settings));
    });
    teardown(() => {
        rewiremock.disable();
    });

    test('Download factory is used when required to download the LS', async () => {
        const downloadFactory = mock(DotNetDownloadedLanguageClientFactory);
        const simpleFactory = mock(DotNetSimpleLanguageClientFactory);
        const envVarProvider = mock(EnvironmentVariablesProvider);
        const activationService = mock(EnvironmentActivationService);
        const factory = new DotNetLanguageClientFactory(
            instance(configurationService),
            instance(envVarProvider),
            instance(activationService),
            undefined as any,
            undefined as any,
            instance(downloadFactory),
            instance(simpleFactory)
        );
        const uri = Uri.file(__filename);
        const options = typemoq.Mock.ofType<LanguageClientOptions>().object;
        const env = { FOO: 'bar' };
        when(settings.downloadLanguageServer).thenReturn(true);
        when(envVarProvider.getEnvironmentVariables(uri)).thenReturn(Promise.resolve(env));
        when(activationService.getActivatedEnvironmentVariables(uri)).thenReturn();

        await factory.createLanguageClient(uri, undefined, options);

        verify(configurationService.getSettings(uri)).once();
        verify(downloadFactory.createLanguageClient(uri, undefined, options, env)).once();
        verify(simpleFactory.createLanguageClient(uri, undefined, options, env)).never();
    });
    test('Simple factory is used when not required to download the LS', async () => {
        const downloadFactory = mock(DotNetDownloadedLanguageClientFactory);
        const simpleFactory = mock(DotNetSimpleLanguageClientFactory);
        const envVarProvider = mock(EnvironmentVariablesProvider);
        const activationService = mock(EnvironmentActivationService);
        const factory = new DotNetLanguageClientFactory(
            instance(configurationService),
            instance(envVarProvider),
            instance(activationService),
            undefined as any,
            undefined as any,
            instance(downloadFactory),
            instance(simpleFactory)
        );
        const uri = Uri.file(__filename);
        const options = typemoq.Mock.ofType<LanguageClientOptions>().object;
        const env = { FOO: 'bar' };
        when(settings.downloadLanguageServer).thenReturn(false);
        when(envVarProvider.getEnvironmentVariables(uri)).thenReturn(Promise.resolve(env));
        when(activationService.getActivatedEnvironmentVariables(uri)).thenReturn();

        await factory.createLanguageClient(uri, undefined, options);

        verify(configurationService.getSettings(uri)).once();
        verify(downloadFactory.createLanguageClient(uri, undefined, options, env)).never();
        verify(simpleFactory.createLanguageClient(uri, undefined, options, env)).once();
    });
    test('Download factory will make use of the language server folder name and client will be created', async () => {
        const platformData = mock(PlatformData);
        const lsFolderService = mock(DotNetLanguageServerFolderService);
        const factory = new DotNetDownloadedLanguageClientFactory(instance(platformData), instance(lsFolderService));
        const uri = Uri.file(__filename);
        const options = typemoq.Mock.ofType<LanguageClientOptions>().object;
        const languageServerFolder = 'some folder name';
        const engineDllName = 'xyz.dll';
        when(lsFolderService.getLanguageServerFolderName(anything())).thenResolve(languageServerFolder);
        when(platformData.engineExecutableName).thenReturn(engineDllName);

        const serverModule = path.join(EXTENSION_ROOT_DIR, languageServerFolder, engineDllName);
        const expectedServerOptions = {
            run: { command: serverModule, args: [], options: { stdio: 'pipe', env: { FOO: 'bar' } } },
            debug: { command: serverModule, args: ['--debug'], options: { stdio: 'pipe', env: { FOO: 'bar' } } }
        };
        rewiremock.enable();

        class MockClass {
            constructor(
                language: string,
                name: string,
                serverOptions: ServerOptions,
                clientOptions: LanguageClientOptions
            ) {
                expect(language).to.be.equal('python');
                expect(name).to.be.equal(languageClientName);
                expect(clientOptions).to.be.deep.equal(options);
                expect(serverOptions).to.be.deep.equal(expectedServerOptions);
            }
        }
        rewiremock('vscode-languageclient/node').with({ LanguageClient: MockClass });

        const client = await factory.createLanguageClient(uri, undefined, options, { FOO: 'bar' });

        verify(lsFolderService.getLanguageServerFolderName(anything())).once();
        verify(platformData.engineExecutableName).atLeast(1);
        verify(platformData.engineDllName).never();
        verify(platformData.platformName).never();
        expect(client).to.be.instanceOf(MockClass);
    });
    test('Simple factory will make use of the language server folder name and client will be created', async () => {
        const platformData = mock(PlatformData);
        const lsFolderService = mock(DotNetLanguageServerFolderService);
        const factory = new DotNetSimpleLanguageClientFactory(instance(platformData), instance(lsFolderService));
        const uri = Uri.file(__filename);
        const options = typemoq.Mock.ofType<LanguageClientOptions>().object;
        const languageServerFolder = 'some folder name';
        const engineDllName = 'xyz.dll';
        when(lsFolderService.getLanguageServerFolderName(anything())).thenResolve(languageServerFolder);
        when(platformData.engineDllName).thenReturn(engineDllName);

        const serverModule = path.join(EXTENSION_ROOT_DIR, languageServerFolder, engineDllName);
        const expectedServerOptions = {
            run: { command: dotNetCommand, args: [serverModule], options: { stdio: 'pipe', env: { FOO: 'bar' } } },
            debug: {
                command: dotNetCommand,
                args: [serverModule, '--debug'],
                options: { stdio: 'pipe', env: { FOO: 'bar' } }
            }
        };
        rewiremock.enable();

        class MockClass {
            constructor(
                language: string,
                name: string,
                serverOptions: ServerOptions,
                clientOptions: LanguageClientOptions
            ) {
                expect(language).to.be.equal('python');
                expect(name).to.be.equal(languageClientName);
                expect(clientOptions).to.be.deep.equal(options);
                expect(serverOptions).to.be.deep.equal(expectedServerOptions);
            }
        }
        rewiremock('vscode-languageclient/node').with({ LanguageClient: MockClass });

        const client = await factory.createLanguageClient(uri, undefined, options, { FOO: 'bar' });

        verify(lsFolderService.getLanguageServerFolderName(anything())).once();
        verify(platformData.engineExecutableName).never();
        verify(platformData.engineDllName).once();
        verify(platformData.platformName).never();
        expect(client).to.be.instanceOf(MockClass);
    });
});
