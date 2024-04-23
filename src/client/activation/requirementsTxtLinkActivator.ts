import { injectable } from 'inversify';
import { Hover, languages, TextDocument, Position } from 'vscode';
import { IExtensionSingleActivationService } from './types';

@injectable()
export class RequirementsTxtLinkActivator implements IExtensionSingleActivationService {
    // eslint-disable-next-line class-methods-use-this
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: true, virtualWorkspace: true };
    public async activate(): Promise<void> {
        languages.registerHoverProvider(
            [{ pattern: '**/*requirement*.txt' },{ pattern: '**/requirements/*.txt' }],
            {
                provideHover(document: TextDocument, position: Position) {
                    // Regex to allow to find every possible pypi package (base regex from https://peps.python.org/pep-0508/#names)
                    const regex = /^([A-Z0-9]|[A-Z0-9][A-Z0-9._-]*)($|=| |;|\[)/i
                    const row = document.lineAt(position.line).text;
                    const projectName = row.match(regex);
                    return(projectName) ? new Hover(`https://pypi.org/project/${projectName[1]}/`) : null
                },
            },
        );
    }
}

