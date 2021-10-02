import { injectable } from 'inversify';
import { Hover, languages, TextDocument, Position } from 'vscode';
import { IExtensionSingleActivationService } from '../types';

@injectable()
export class RequirementsTxtLinkActivator implements IExtensionSingleActivationService {
    // eslint-disable-next-line class-methods-use-this
    public async activate(): Promise<void> {
        languages.registerHoverProvider(
            {
                pattern:
                    '{**/requirements.txt,**/*-requirements.txt,**/requirements-*.txt,**/requirements.in,**/*-requirements.in,**/requirements-*.in,**/constraints.txt,**/*-constraints.txt,**/constraints-*.txt}',
            },
            {
                provideHover(document: TextDocument, position: Position) {
                    // https://packaging.python.org/specifications/core-metadata/#name
                    const packageRegex = /^([A-Z0-9]|[A-Z0-9][A-Z0-9._-]*[A-Z0-9])/i;

                    const row = document.lineAt(position.line).text;
                    const projectName = row.match(packageRegex);

                    if (projectName) {
                        return new Hover(`https://pypi.org/project/${projectName[1]}/`);
                    }
                    return null;
                },
            },
        );
    }
}
