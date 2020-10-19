// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-any

import { inject, injectable } from 'inversify';
import { commands, Disposable, TextEditor, TextEditorEdit } from 'vscode';
import { ICommandNameArgumentTypeMapping } from './commands';
import { ICommandManager, IJupyterExtensionDependencyManager } from './types';

@injectable()
export class CommandManager implements ICommandManager {
    constructor(
        @inject(IJupyterExtensionDependencyManager)
        private jupyterExtensionDependencyManager: IJupyterExtensionDependencyManager
    ) {}

    /**
     * Registers a command that can be invoked via a keyboard shortcut,
     * a menu item, an action, or directly.
     *
     * Registering a command with an existing command identifier twice
     * will cause an error.
     *
     * @param command A unique identifier for the command.
     * @param callback A command handler function.
     * @param thisArg The `this` context used when invoking the handler function.
     * @return Disposable which unregisters this command on disposal.
     */
    public registerCommand<
        E extends keyof ICommandNameArgumentTypeMapping,
        U extends ICommandNameArgumentTypeMapping[E]
    >(command: E, callback: (...args: U) => any, thisArg?: any): Disposable {
        return commands.registerCommand(command, callback as any, thisArg);
    }

    /**
     * Registers a text editor command that can be invoked via a keyboard shortcut,
     * a menu item, an action, or directly.
     *
     * Text editor commands are different from ordinary [commands](#commands.registerCommand) as
     * they only execute when there is an active editor when the command is called. Also, the
     * command handler of an editor command has access to the active editor and to an
     * [edit](#TextEditorEdit)-builder.
     *
     * @param command A unique identifier for the command.
     * @param callback A command handler function with access to an [editor](#TextEditor) and an [edit](#TextEditorEdit).
     * @param thisArg The `this` context used when invoking the handler function.
     * @return Disposable which unregisters this command on disposal.
     */
    public registerTextEditorCommand(
        command: string,
        callback: (textEditor: TextEditor, edit: TextEditorEdit, ...args: any[]) => void,
        thisArg?: any
    ): Disposable {
        return commands.registerTextEditorCommand(command, callback, thisArg);
    }

    /**
     * Executes the command denoted by the given command identifier.
     *
     * * *Note 1:* When executing an editor command not all types are allowed to
     * be passed as arguments. Allowed are the primitive types `string`, `boolean`,
     * `number`, `undefined`, and `null`, as well as [`Position`](#Position), [`Range`](#Range), [`Uri`](#Uri) and [`Location`](#Location).
     * * *Note 2:* There are no restrictions when executing commands that have been contributed
     * by extensions.
     *
     * @param command Identifier of the command to execute.
     * @param rest Parameters passed to the command function.
     * @return A thenable that resolves to the returned value of the given command. `undefined` when
     * the command handler function doesn't return anything.
     */
    public executeCommand<
        T,
        E extends keyof ICommandNameArgumentTypeMapping,
        U extends ICommandNameArgumentTypeMapping[E]
    >(command: E, ...rest: U): Thenable<T | undefined> {
        if (command.includes('jupyter') && !this.jupyterExtensionDependencyManager.isJupyterExtensionInstalled) {
            return this.jupyterExtensionDependencyManager.installJupyterExtension();
        } else {
            return commands.executeCommand<T>(command, ...rest);
        }
    }

    /**
     * Retrieve the list of all available commands. Commands starting an underscore are
     * treated as internal commands.
     *
     * @param filterInternal Set `true` to not see internal commands (starting with an underscore)
     * @return Thenable that resolves to a list of command ids.
     */
    public getCommands(filterInternal?: boolean): Thenable<string[]> {
        return commands.getCommands(filterInternal);
    }
}
