// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import * as typemoq from 'typemoq';
import { Memento } from 'vscode';
import {
    IApplicationEnvironment,
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    IWebPanelProvider,
    IWorkspaceService
} from '../../client/common/application/types';
import { IFileSystem } from '../../client/common/platform/types';
import { StartPage } from '../../client/common/startPage/startPage';
import { IStartPage } from '../../client/common/startPage/types';
import { IConfigurationService, IExperimentService, IExtensionContext } from '../../client/common/types';
import { ICodeCssGenerator, INotebookEditorProvider, IThemeFinder } from '../../client/datascience/types';
import { MockPythonSettings } from '../datascience/mockPythonSettings';
import { MockAutoSelectionService } from '../mocks/autoSelector';

suite('StartPage tests', () => {
    let startPage: IStartPage;
    let provider: typemoq.IMock<IWebPanelProvider>;
    let cssGenerator: typemoq.IMock<ICodeCssGenerator>;
    let themeFinder: typemoq.IMock<IThemeFinder>;
    let configuration: typemoq.IMock<IConfigurationService>;
    let workspaceService: typemoq.IMock<IWorkspaceService>;
    let file: typemoq.IMock<IFileSystem>;
    let notebookEditorProvider: typemoq.IMock<INotebookEditorProvider>;
    let commandManager: typemoq.IMock<ICommandManager>;
    let documentManager: typemoq.IMock<IDocumentManager>;
    let appShell: typemoq.IMock<IApplicationShell>;
    let context: typemoq.IMock<IExtensionContext>;
    let appEnvironment: typemoq.IMock<IApplicationEnvironment>;
    let memento: typemoq.IMock<Memento>;
    let experiment: typemoq.IMock<IExperimentService>;
    const dummySettings = new MockPythonSettings(undefined, new MockAutoSelectionService());

    const releaseNotes1 = `# Changelog

## 2020.5.1 (19 May 2020)

### Fixes

1. Do not execute shebang as an interpreter until user has clicked on the codelens enclosing the shebang.
    ([#11687](https://github.com/Microsoft/vscode-python/issues/11687))

### Thanks

Thanks to the following projects which we fully rely on to provide some of
our features:

-   [debugpy](https://pypi.org/project/debugpy/)
-   [isort](https://pypi.org/project/isort/)
-   [jedi](https://pypi.org/project/jedi/)
    and [parso](https://pypi.org/project/parso/)
-   [Microsoft Python Language Server](https://github.com/microsoft/python-language-server)
-   [ptvsd](https://pypi.org/project/ptvsd/)
-   [exuberant ctags](http://ctags.sourceforge.net/) (user-installed)
-   [rope](https://pypi.org/project/rope/) (user-installed)

Also thanks to the various projects we provide integrations with which help
make this extension useful:

-   Debugging support:
    [Django](https://pypi.org/project/Django/),
    [Flask](https://pypi.org/project/Flask/),
    [gevent](https://pypi.org/project/gevent/),
    [Jinja](https://pypi.org/project/Jinja/),
    [Pyramid](https://pypi.org/project/pyramid/),
    [PySpark](https://pypi.org/project/pyspark/),
    [Scrapy](https://pypi.org/project/Scrapy/),
    [Watson](https://pypi.org/project/Watson/)
-   Formatting:
    [autopep8](https://pypi.org/project/autopep8/),
    [black](https://pypi.org/project/black/),
    [yapf](https://pypi.org/project/yapf/)
-   Interpreter support:
    [conda](https://conda.io/),
    [direnv](https://direnv.net/),
    [pipenv](https://pypi.org/project/pipenv/),
    [pyenv](https://github.com/pyenv/pyenv),
    [venv](https://docs.python.org/3/library/venv.html#module-venv),
    [virtualenv](https://pypi.org/project/virtualenv/)
-   Linting:
    [bandit](https://pypi.org/project/bandit/),
    [flake8](https://pypi.org/project/flake8/),
    [mypy](https://pypi.org/project/mypy/),
    [prospector](https://pypi.org/project/prospector/),
    [pylint](https://pypi.org/project/pylint/),
    [pydocstyle](https://pypi.org/project/pydocstyle/),
    [pylama](https://pypi.org/project/pylama/)
-   Testing:
    [nose](https://pypi.org/project/nose/),
    [pytest](https://pypi.org/project/pytest/),
    [unittest](https://docs.python.org/3/library/unittest.html#module-unittest)

And finally thanks to the [Python](https://www.python.org/) development team and
community for creating a fantastic programming language and community to be a
part of!

## 2020.5.0 (12 May 2020)

### Enhancements

1. Added ability to manually enter a path to interpreter in the select interpreter dropdown.
    ([#216](https://github.com/Microsoft/vscode-python/issues/216))
1. Add status bar item with icon when installing Insiders/Stable build.
    (thanks to [ErwanDL](https://github.com/ErwanDL/))
    ([#10495](https://github.com/Microsoft/vscode-python/issues/10495))
1. Support for language servers that don't allow incremental document updates inside of notebooks and the interactive window.
    ([#10818](https://github.com/Microsoft/vscode-python/issues/10818))
1. Add telemetry for "Python is not installed" prompt.
    ([#10885](https://github.com/Microsoft/vscode-python/issues/10885))
1. Add basic liveshare support for raw kernels.
    ([#10988](https://github.com/Microsoft/vscode-python/issues/10988))
1. Do a one-off transfer of existing values for 'python.pythonPath' setting to new Interpreter storage if in DeprecatePythonPath experiment.
    ([#11052](https://github.com/Microsoft/vscode-python/issues/11052))
1. Ensure the language server can query pythonPath when in the Deprecate PythonPath experiment.
    ([#11083](https://github.com/Microsoft/vscode-python/issues/11083))
1. Added prompt asking users to delete 'python.pythonPath' key from their workspace settings when in Deprecate PythonPath experiment.
    ([#11108](https://github.com/Microsoft/vscode-python/issues/11108))
1. Added 'getDebuggerPackagePath' extension API to get the debugger package path.
    ([#11236](https://github.com/Microsoft/vscode-python/issues/11236))
1. Expose currently selected interpreter path using API.
    ([#11294](https://github.com/Microsoft/vscode-python/issues/11294))
1. Show a prompt asking user to upgrade Code runner to new version to keep using it when in Deprecate PythonPath experiment.
    ([#11327](https://github.com/Microsoft/vscode-python/issues/11327))
1. Rename string '' which is used in 'launch.json' to refer to interpreter path set in settings, to.
    ([#11446](https://github.com/Microsoft/vscode-python/issues/11446))

### Fixes

1. Added 'Enable Scrolling For Cell Outputs' setting. Works together with the 'Max Output Size' setting.
    ([#9801](https://github.com/Microsoft/vscode-python/issues/9801))
1. Fix ctrl+enter on markdown cells. Now they render.
    ([#10006](https://github.com/Microsoft/vscode-python/issues/10006))`;

    const filteredReleaseNotes1 = [
        'Added ability to manually enter a path to interpreter in the select interpreter dropdown.',
        'Add status bar item with icon when installing Insiders/Stable build.',
        "Support for language servers that don't allow incremental document updates inside of notebooks and the interactive window.",
        'Add telemetry for "Python is not installed" prompt.',
        'Add basic liveshare support for raw kernels.'
    ];

    const releaseNotes2 = `# Changelog

## 2020.5.1 (19 May 2020)

### Enhancements

1. Enhancement 1
    ([#216](https://github.com/Microsoft/vscode-python/issues/216))
1. Enhancement 2
    ([#10495](https://github.com/Microsoft/vscode-python/issues/10495))
1. Enhancement 3
    ([#10818](https://github.com/Microsoft/vscode-python/issues/10818))

### Fixes

1. Do not execute shebang as an interpreter until user has clicked on the codelens enclosing the shebang.
    ([#11687](https://github.com/Microsoft/vscode-python/issues/11687))

### Thanks

Thanks to the following projects which we fully rely on to provide some of
our features:

-   [debugpy](https://pypi.org/project/debugpy/)
-   [isort](https://pypi.org/project/isort/)
-   [jedi](https://pypi.org/project/jedi/)
    and [parso](https://pypi.org/project/parso/)
-   [Microsoft Python Language Server](https://github.com/microsoft/python-language-server)
-   [ptvsd](https://pypi.org/project/ptvsd/)
-   [exuberant ctags](http://ctags.sourceforge.net/) (user-installed)
-   [rope](https://pypi.org/project/rope/) (user-installed)

Also thanks to the various projects we provide integrations with which help
make this extension useful:

-   Debugging support:
    [Django](https://pypi.org/project/Django/),
    [Flask](https://pypi.org/project/Flask/),
    [gevent](https://pypi.org/project/gevent/),
    [Jinja](https://pypi.org/project/Jinja/),
    [Pyramid](https://pypi.org/project/pyramid/),
    [PySpark](https://pypi.org/project/pyspark/),
    [Scrapy](https://pypi.org/project/Scrapy/),
    [Watson](https://pypi.org/project/Watson/)
-   Formatting:
    [autopep8](https://pypi.org/project/autopep8/),
    [black](https://pypi.org/project/black/),
    [yapf](https://pypi.org/project/yapf/)
-   Interpreter support:
    [conda](https://conda.io/),
    [direnv](https://direnv.net/),
    [pipenv](https://pypi.org/project/pipenv/),
    [pyenv](https://github.com/pyenv/pyenv),
    [venv](https://docs.python.org/3/library/venv.html#module-venv),
    [virtualenv](https://pypi.org/project/virtualenv/)
-   Linting:
    [bandit](https://pypi.org/project/bandit/),
    [flake8](https://pypi.org/project/flake8/),
    [mypy](https://pypi.org/project/mypy/),
    [prospector](https://pypi.org/project/prospector/),
    [pylint](https://pypi.org/project/pylint/),
    [pydocstyle](https://pypi.org/project/pydocstyle/),
    [pylama](https://pypi.org/project/pylama/)
-   Testing:
    [nose](https://pypi.org/project/nose/),
    [pytest](https://pypi.org/project/pytest/),
    [unittest](https://docs.python.org/3/library/unittest.html#module-unittest)

And finally thanks to the [Python](https://www.python.org/) development team and
community for creating a fantastic programming language and community to be a
part of!

## 2020.5.0 (12 May 2020)

### Enhancements

1. Added ability to manually enter a path to interpreter in the select interpreter dropdown.
    ([#216](https://github.com/Microsoft/vscode-python/issues/216))
1. Add status bar item with icon when installing Insiders/Stable build.
    (thanks to [ErwanDL](https://github.com/ErwanDL/))
    ([#10495](https://github.com/Microsoft/vscode-python/issues/10495))
1. Support for language servers that don't allow incremental document updates inside of notebooks and the interactive window.
    ([#10818](https://github.com/Microsoft/vscode-python/issues/10818))
1. Add telemetry for "Python is not installed" prompt.
    ([#10885](https://github.com/Microsoft/vscode-python/issues/10885))
1. Add basic liveshare support for raw kernels.
    ([#10988](https://github.com/Microsoft/vscode-python/issues/10988))
1. Do a one-off transfer of existing values for 'python.pythonPath' setting to new Interpreter storage if in DeprecatePythonPath experiment.
    ([#11052](https://github.com/Microsoft/vscode-python/issues/11052))
1. Ensure the language server can query pythonPath when in the Deprecate PythonPath experiment.
    ([#11083](https://github.com/Microsoft/vscode-python/issues/11083))
1. Added prompt asking users to delete 'python.pythonPath' key from their workspace settings when in Deprecate PythonPath experiment.
    ([#11108](https://github.com/Microsoft/vscode-python/issues/11108))
1. Added 'getDebuggerPackagePath' extension API to get the debugger package path.
    ([#11236](https://github.com/Microsoft/vscode-python/issues/11236))
1. Expose currently selected interpreter path using API.
    ([#11294](https://github.com/Microsoft/vscode-python/issues/11294))
1. Show a prompt asking user to upgrade Code runner to new version to keep using it when in Deprecate PythonPath experiment.
    ([#11327](https://github.com/Microsoft/vscode-python/issues/11327))
1. Rename string '' which is used in 'launch.json' to refer to interpreter path set in settings, to.
    ([#11446](https://github.com/Microsoft/vscode-python/issues/11446))

### Fixes

1. Added 'Enable Scrolling For Cell Outputs' setting. Works together with the 'Max Output Size' setting.
    ([#9801](https://github.com/Microsoft/vscode-python/issues/9801))
1. Fix ctrl+enter on markdown cells. Now they render.
    ([#10006](https://github.com/Microsoft/vscode-python/issues/10006))`;

    const filteredReleaseNotes2 = ['Enhancement 1', 'Enhancement 2', 'Enhancement 3'];

    const releaseNotes3 = `# Changelog

## 2020.5.0 (12 May 2020)

### Enhancements

1. Added ability to manually enter a path to interpreter in the select interpreter dropdown.
    ([#216](https://github.com/Microsoft/vscode-python/issues/216))
1. Add status bar item with icon when installing Insiders/Stable build.
    (thanks to [ErwanDL](https://github.com/ErwanDL/))
    ([#10495](https://github.com/Microsoft/vscode-python/issues/10495))
1. Support for language servers that don't allow incremental document updates inside of notebooks and the interactive window.
    ([#10818](https://github.com/Microsoft/vscode-python/issues/10818))
1. Add telemetry for "Python is not installed" prompt.
    ([#10885](https://github.com/Microsoft/vscode-python/issues/10885))
1. Add basic liveshare support for raw kernels.
    ([#10988](https://github.com/Microsoft/vscode-python/issues/10988))
1. Do a one-off transfer of existing values for 'python.pythonPath' setting to new Interpreter storage if in DeprecatePythonPath experiment.
    ([#11052](https://github.com/Microsoft/vscode-python/issues/11052))
1. Ensure the language server can query pythonPath when in the Deprecate PythonPath experiment.
    ([#11083](https://github.com/Microsoft/vscode-python/issues/11083))
1. Added prompt asking users to delete 'python.pythonPath' key from their workspace settings when in Deprecate PythonPath experiment.
    ([#11108](https://github.com/Microsoft/vscode-python/issues/11108))
1. Added 'getDebuggerPackagePath' extension API to get the debugger package path.
    ([#11236](https://github.com/Microsoft/vscode-python/issues/11236))
1. Expose currently selected interpreter path using API.
    ([#11294](https://github.com/Microsoft/vscode-python/issues/11294))
1. Show a prompt asking user to upgrade Code runner to new version to keep using it when in Deprecate PythonPath experiment.
    ([#11327](https://github.com/Microsoft/vscode-python/issues/11327))
1. Rename string '' which is used in 'launch.json' to refer to interpreter path set in settings, to.
    ([#11446](https://github.com/Microsoft/vscode-python/issues/11446))

### Fixes

1. Added 'Enable Scrolling For Cell Outputs' setting. Works together with the 'Max Output Size' setting.
    ([#9801](https://github.com/Microsoft/vscode-python/issues/9801))
1. Fix ctrl+enter on markdown cells. Now they render.
    ([#10006](https://github.com/Microsoft/vscode-python/issues/10006))`;

    function setupVersions(savedVersion: string, actualVersion: string) {
        context.setup((c) => c.globalState).returns(() => memento.object);
        memento.setup((m) => m.get(typemoq.It.isAnyString())).returns(() => savedVersion);
        memento
            .setup((m) => m.update(typemoq.It.isAnyString(), typemoq.It.isAnyString()))
            .returns(() => Promise.resolve());
        const packageJson = {
            version: actualVersion
        };
        appEnvironment.setup((ae) => ae.packageJson).returns(() => packageJson);
    }

    function reset() {
        context.reset();
        memento.reset();
        appEnvironment.reset();
    }

    setup(async () => {
        provider = typemoq.Mock.ofType<IWebPanelProvider>();
        cssGenerator = typemoq.Mock.ofType<ICodeCssGenerator>();
        themeFinder = typemoq.Mock.ofType<IThemeFinder>();
        configuration = typemoq.Mock.ofType<IConfigurationService>();
        workspaceService = typemoq.Mock.ofType<IWorkspaceService>();
        file = typemoq.Mock.ofType<IFileSystem>();
        notebookEditorProvider = typemoq.Mock.ofType<INotebookEditorProvider>();
        commandManager = typemoq.Mock.ofType<ICommandManager>();
        documentManager = typemoq.Mock.ofType<IDocumentManager>();
        appShell = typemoq.Mock.ofType<IApplicationShell>();
        context = typemoq.Mock.ofType<IExtensionContext>();
        appEnvironment = typemoq.Mock.ofType<IApplicationEnvironment>();
        memento = typemoq.Mock.ofType<Memento>();
        experiment = typemoq.Mock.ofType<IExperimentService>();

        configuration.setup((cs) => cs.getSettings(undefined)).returns(() => dummySettings);

        startPage = new StartPage(
            provider.object,
            cssGenerator.object,
            themeFinder.object,
            configuration.object,
            workspaceService.object,
            file.object,
            notebookEditorProvider.object,
            commandManager.object,
            documentManager.object,
            appShell.object,
            context.object,
            appEnvironment.object,
            experiment.object
        );
    });

    test('Release notes', async () => {
        // There was a point release without new enhancements
        file.setup((fs) => fs.readFile(typemoq.It.isAnyString())).returns(() => Promise.resolve(releaseNotes1));
        const test1 = await startPage.handleReleaseNotesRequest();
        assert.deepEqual(test1, filteredReleaseNotes1, 'The release notes are not being filtered correctly.');

        // There was a point release with 3 new enhancements
        file.setup((fs) => fs.readFile(typemoq.It.isAnyString())).returns(() => Promise.resolve(releaseNotes2));
        const test2 = await startPage.handleReleaseNotesRequest();
        assert.deepEqual(test2, filteredReleaseNotes2, 'The release notes are not being filtered correctly.');

        // Regular release
        file.setup((fs) => fs.readFile(typemoq.It.isAnyString())).returns(() => Promise.resolve(releaseNotes3));
        const test3 = await startPage.handleReleaseNotesRequest();
        assert.deepEqual(test3, filteredReleaseNotes1, 'The release notes are not being filtered correctly.');
    });

    test('Check extension version', async () => {
        let savedVersion: string;
        let actualVersion: string;

        // Version has not changed
        savedVersion = '2020.6.0-dev';
        actualVersion = '2020.6.0-dev';
        setupVersions(savedVersion, actualVersion);

        const test1 = await startPage.extensionVersionChanged();
        assert.equal(test1, false, 'The version is the same, start page should not open.');
        reset();

        // actual version is older
        savedVersion = '2020.6.0-dev';
        actualVersion = '2020.5.0-dev';
        setupVersions(savedVersion, actualVersion);

        const test2 = await startPage.extensionVersionChanged();
        assert.equal(test2, false, 'The actual version is older, start page should not open.');
        reset();

        // actual version is newer
        savedVersion = '2020.6.0-dev';
        actualVersion = '2020.6.1';
        setupVersions(savedVersion, actualVersion);

        const test3 = await startPage.extensionVersionChanged();
        assert.equal(test3, true, 'The actual version is newer, start page should open.');
        reset();
    });
});
