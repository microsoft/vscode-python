// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

/* eslint-disable react/sort-comp */

import * as React from 'react';
import '../../client/common/extensions';
import { SharedMessages } from '../../client/common/startPage/messages';
import { ISettingPackage, IStartPageMapping, StartPageMessages } from '../../client/common/startPage/types';
import { Image, ImageName } from '../react-common/image';
import { getLocString, storeLocStrings } from '../react-common/locReactSide';
import { IMessageHandler, PostOffice } from '../react-common/postOffice';
import './startPage.css';

export interface IStartPageProps {
    skipDefault?: boolean;
    baseTheme: string;
    testMode?: boolean;
}

type StartPageWindowType = typeof window & {
    openBlankNotebook(): void;
    createPythonFile(): void;
    openFileBrowser(): void;
    openFolder(): void;
    openWorkspace(): void;
    openCommandPalette(): void;
    openCommandPaletteWithSelection(): void;
    openSampleNotebook(): void;
};

// Front end of the Python extension start page.
// In general it consists of its render method and methods that send and receive messages.
export class StartPage extends React.Component<IStartPageProps> implements IMessageHandler {
    private releaseNotes: ISettingPackage = {
        showAgainSetting: false,
    };

    private postOffice: PostOffice = new PostOffice();

    public componentWillMount(): void {
        // Add ourselves as a handler for the post office
        this.postOffice.addHandler(this);

        // Tell the start page code we have started.
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.Started);

        // Bind some functions to the window, as we need them to be accessible with clean HTML to use translations
        (window as StartPageWindowType).openBlankNotebook = this.openBlankNotebook.bind(this);
        (window as StartPageWindowType).createPythonFile = this.createPythonFile.bind(this);
        (window as StartPageWindowType).openFileBrowser = this.openFileBrowser.bind(this);
        (window as StartPageWindowType).openFolder = this.openFolder.bind(this);
        (window as StartPageWindowType).openWorkspace = this.openWorkspace.bind(this);
        (window as StartPageWindowType).openCommandPalette = this.openCommandPalette.bind(this);
        (window as StartPageWindowType).openCommandPaletteWithSelection = this.openCommandPaletteWithSelection.bind(
            this,
        );
        (window as StartPageWindowType).openSampleNotebook = this.openSampleNotebook.bind(this);
    }

    public componentDidMount(): void {
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.RequestShowAgainSetting);
    }

    public render(): React.ReactNode {
        const { baseTheme } = this.props;

        return (
            <div className="main-page">
                <div className="title-row">
                    <div className="title-icon">
                        <Image baseTheme={baseTheme} class="image-button-image" image={ImageName.PythonColor} />
                    </div>
                    <div className="title">{getLocString('StartPage.pythonExtensionTitle', 'Python Extension')}</div>
                </div>
                <div className="row">
                    <div
                        className="icon"
                        onClick={this.openBlankNotebook}
                        onKeyPress={this.openBlankNotebook}
                        role="button"
                        tabIndex={0}
                    >
                        <Image
                            baseTheme={baseTheme ?? 'vscode-dark'}
                            class="image-button-image"
                            image={ImageName.Notebook}
                        />
                    </div>
                    <div className="block">
                        <div
                            className="text"
                            onClick={this.openBlankNotebook}
                            onKeyPress={this.openBlankNotebook}
                            role="button"
                            tabIndex={0}
                        >
                            {getLocString('StartPage.createJupyterNotebook', 'Create a Jupyter Notebook')}
                        </div>
                        {this.renderNotebookDescription()}
                    </div>
                </div>
                <div className="row">
                    <div
                        className="icon"
                        role="button"
                        onClick={this.createPythonFile}
                        onKeyPress={this.createPythonFile}
                        tabIndex={0}
                    >
                        <Image
                            baseTheme={baseTheme ?? 'vscode-dark'}
                            class="image-button-image"
                            image={ImageName.Python}
                        />
                    </div>
                    <div className="block">
                        <div
                            className="text"
                            role="button"
                            onClick={this.createPythonFile}
                            onKeyPress={this.createPythonFile}
                            tabIndex={0}
                        >
                            {getLocString('StartPage.createAPythonFile', 'Create a Python File')}
                        </div>
                        {this.renderPythonFileDescription()}
                    </div>
                </div>
                <div className="row">
                    <div
                        className="icon"
                        role="button"
                        onClick={this.openFolder}
                        onKeyPress={this.openFolder}
                        tabIndex={0}
                    >
                        <Image
                            baseTheme={baseTheme ?? 'vscode-dark'}
                            class="image-button-image"
                            image={ImageName.OpenFolder}
                        />
                    </div>
                    <div className="block">
                        <div
                            className="text"
                            role="button"
                            onClick={this.openFolder}
                            onKeyPress={this.openFolder}
                            tabIndex={0}
                        >
                            {getLocString('StartPage.openFolder', 'Open a Folder or Workspace')}
                        </div>
                        {this.renderFolderDescription()}
                    </div>
                </div>
                <div className="row">
                    <div
                        className="icon"
                        role="button"
                        onClick={this.openInteractiveWindow}
                        onKeyPress={this.openInteractiveWindow}
                        tabIndex={0}
                    >
                        <Image
                            baseTheme={baseTheme ?? 'vscode-dark'}
                            class="image-button-image"
                            image={ImageName.Interactive}
                        />
                    </div>
                    <div className="block">
                        <div
                            className="text"
                            role="button"
                            onClick={this.openInteractiveWindow}
                            onKeyPress={this.openInteractiveWindow}
                            tabIndex={0}
                        >
                            {getLocString(
                                'StartPage.openInteractiveWindow',
                                'Use the Interactive Window to develop Python Scripts',
                            )}
                        </div>
                        {this.renderInteractiveWindowDescription()}
                    </div>
                </div>
                <div className="releaseNotesRow">
                    {this.renderReleaseNotesLink()}
                    {this.renderTutorialAndDoc()}
                    {this.renderMailingList()}
                </div>
                <div className="block">
                    <input
                        type="checkbox"
                        aria-checked={!this.releaseNotes.showAgainSetting}
                        className="checkbox"
                        onClick={this.updateSettings}
                    />
                </div>
                <div className="block">
                    <p>{getLocString('StartPage.dontShowAgain', "Don't show this page again")}</p>
                </div>
            </div>
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
    public handleMessage = (msg: string, payload?: any): boolean => {
        switch (msg) {
            case StartPageMessages.SendSetting:
                this.releaseNotes.showAgainSetting = payload.showAgainSetting;
                this.setState({});
                break;

            case SharedMessages.LocInit:
                {
                    // Initialize localization.
                    const locJSON = JSON.parse(payload);
                    storeLocStrings(locJSON);
                }
                break;

            default:
                break;
        }

        return false;
    };

    public openFileBrowser(): void {
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.OpenFileBrowser);
    }

    public openFolder = (): void => {
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.OpenFolder);
    };

    public openWorkspace(): void {
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.OpenWorkspace);
    }

    // eslint-disable-next-line class-methods-use-this
    private renderNotebookDescription(): JSX.Element {
        return (
            <div
                className="paragraph list"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{
                    __html: getLocString(
                        'StartPage.notebookDescription',
                        '- Run "<div class="link italics" role="button" onclick={0}>Create New Blank Notebook</div>" in the Command Palette (<div class="italics">Shift + Command + P</div>)<br />- Explore our <div class="link" role="button" onclick={1}>sample notebook</div> to learn about notebook features',
                    ).format('openCommandPaletteWithSelection()', 'openSampleNotebook()'),
                }}
            />
        );
    }

    // eslint-disable-next-line class-methods-use-this
    private renderPythonFileDescription(): JSX.Element {
        return (
            <div
                className="paragraph list"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{
                    __html: getLocString(
                        'StartPage.pythonFileDescription',
                        '- Create a <div class="link" role="button" onclick={0}>new file</div> with a .py extension',
                    ).format('createPythonFile()'),
                }}
            />
        );
    }

    // eslint-disable-next-line class-methods-use-this
    private renderInteractiveWindowDescription(): JSX.Element {
        return (
            <div
                className="paragraph list"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{
                    __html: getLocString(
                        'StartPage.interactiveWindowDesc',
                        '- You can create cells on a Python file by typing "#%%". Make sure you have the Jupyter extension installed. <br /> - Use "<div class="italics">Shift + Enter</div> " to run a cell, the output will be shown in the interactive window',
                    ),
                }}
            />
        );
    }

    // eslint-disable-next-line class-methods-use-this
    private renderFolderDescription(): JSX.Element {
        return (
            <div
                className="paragraph list"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{
                    __html: getLocString(
                        'StartPage.folderDesc',
                        '- Open a <div class="link" role="button" onclick={0}>Folder</div><br /> - Open a <div class="link" role="button" onclick={1}>Workspace</div>',
                    ).format('openFolder()', 'openWorkspace()'),
                }}
            />
        );
    }

    // eslint-disable-next-line class-methods-use-this
    private renderReleaseNotesLink(): JSX.Element {
        return (
            <div
                className="paragraph"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{
                    __html: getLocString(
                        'StartPage.releaseNotes',
                        'Take a look at our <a class="link" href={0}>Release Notes</a> to learn more about the latest features.',
                    ).format('https://aka.ms/AA8dxtb'),
                }}
            />
        );
    }

    // eslint-disable-next-line class-methods-use-this
    private renderTutorialAndDoc(): JSX.Element {
        return (
            <div
                className="paragraph"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{
                    __html: getLocString(
                        'StartPage.tutorialAndDoc',
                        'Explore more features in our <a class="link" href={0}>Tutorials</a> or check <a class="link" href={1}>Documentation</a> for tips and troubleshooting.',
                    ).format('https://aka.ms/AA8dqti', 'https://aka.ms/AA8dxwy'),
                }}
            />
        );
    }

    // eslint-disable-next-line class-methods-use-this
    private renderMailingList(): JSX.Element {
        return (
            <div
                className="paragraph"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{
                    __html: getLocString(
                        'StartPage.mailingList',
                        '<a class="link" href={0}>Sign up</a> for tips and tutorials through our mailing list.',
                    ).format('https://aka.ms/AAbopxr'),
                }}
            />
        );
    }

    private openBlankNotebook = (): void => {
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.OpenBlankNotebook);
    };

    private createPythonFile = (): void => {
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.OpenBlankPythonFile);
    };

    private openCommandPalette = (): void => {
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.OpenCommandPalette);
    };

    private openCommandPaletteWithSelection = (): void => {
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.OpenCommandPaletteWithOpenNBSelected);
    };

    private openSampleNotebook = (): void => {
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.OpenSampleNotebook);
    };

    private openInteractiveWindow = (): void => {
        this.postOffice.sendMessage<IStartPageMapping>(StartPageMessages.OpenInteractiveWindow);
    };

    private updateSettings = (): void => {
        this.releaseNotes.showAgainSetting = !this.releaseNotes.showAgainSetting;
        this.postOffice.sendMessage<IStartPageMapping>(
            StartPageMessages.UpdateSettings,
            this.releaseNotes.showAgainSetting,
        );
    };
}
