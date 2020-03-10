/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * This is the place for API experiments and proposals.
 * These API are NOT stable and subject to change. They are only available in the Insiders
 * distribution and CANNOT be used in published extensions.
 *
 * To test these API in local environment:
 * - Use Insiders release of VS Code.
 * - Add `"enableProposedApi": true` to your package.json.
 * - Copy this file to your project.
 */

declare module 'vscode' {


	/**
	 * Defines the editing functionality of a webview editor. This allows the webview editor to hook into standard
	 * editor events such as `undo` or `save`.
	 *
	 * @param EditType Type of edits. Edit objects must be json serializable.
	 */
	interface WebviewCustomEditorEditingDelegate<EditType> {
		/**
		 * Save a resource.
		 *
		 * @param resource Resource being saved.
		 *
		 * @return Thenable signaling that the save has completed.
		 */
		save(resource: Uri): Thenable<void>;

		/**
		 * Save an existing resource at a new path.
		 *
		 * @param resource Resource being saved.
		 * @param targetResource Location to save to.
		 *
		 * @return Thenable signaling that the save has completed.
		 */
		saveAs(resource: Uri, targetResource: Uri): Thenable<void>;

		/**
		 * Event triggered by extensions to signal to VS Code that an edit has occurred.
		 */
		readonly onEdit: Event<{ readonly resource: Uri, readonly edit: EditType }>;

		/**
		 * Apply a set of edits.
		 *
		 * Note that is not invoked when `onEdit` is called as `onEdit` implies also updating the view to reflect the edit.
		 *
		 * @param resource Resource being edited.
		 * @param edit Array of edits. Sorted from oldest to most recent.
		 *
		 * @return Thenable signaling that the change has completed.
		 */
		applyEdits(resource: Uri, edits: readonly EditType[]): Thenable<void>;

		/**
		 * Undo a set of edits.
		 *
		 * This is triggered when a user undoes an edit or when revert is called on a file.
		 *
		 * @param resource Resource being edited.
		 * @param edit Array of edits. Sorted from most recent to oldest.
		 *
		 * @return Thenable signaling that the change has completed.
		 */
		undoEdits(resource: Uri, edits: readonly EditType[]): Thenable<void>;
	}

	export interface WebviewCustomEditorProvider {
		/**
		 * Resolve a webview editor for a given resource.
		 *
		 * To resolve a webview editor, a provider must fill in its initial html content and hook up all
		 * the event listeners it is interested it. The provider should also take ownership of the passed in `WebviewPanel`.
		 *
		 * @param resource Resource being resolved.
		 * @param webview Webview being resolved. The provider should take ownership of this webview.
		 *
		 * @return Thenable indicating that the webview editor has been resolved.
		 */
		resolveWebviewEditor(
			resource: Uri,
			webview: WebviewPanel,
		): Thenable<void>;

		/**
		 * Controls the editing functionality of a webview editor. This allows the webview editor to hook into standard
		 * editor events such as `undo` or `save`.
		 *
		 * WebviewEditors that do not have `editingCapability` are considered to be readonly. Users can still interact
		 * with readonly editors, but these editors will not integrate with VS Code's standard editor functionality.
		 */
		readonly editingDelegate?: WebviewCustomEditorEditingDelegate<unknown>;
	}

	namespace window {
		/**
		 * Register a new provider for webview editors of a given type.
		 *
		 * @param viewType  Type of the webview editor provider.
		 * @param provider Resolves webview editors.
		 * @param options Content settings for a webview panels the provider is given.
		 *
		 * @return Disposable that unregisters the `WebviewCustomEditorProvider`.
		 */
		export function registerWebviewCustomEditorProvider(
			viewType: string,
			provider: WebviewCustomEditorProvider,
			options?: WebviewPanelOptions,
		): Disposable;
	}
}
