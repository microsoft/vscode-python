/**
 * ESLint Configuration for VS Code Python Extension
 * This file configures linting rules for the TypeScript/JavaScript codebase.
 * It uses the new flat config format introduced in ESLint 8.21.0
 */

// Import essential ESLint plugins and configurations
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import noOnlyTests from 'eslint-plugin-no-only-tests';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import js from '@eslint/js';
import noBadGdprCommentPlugin from './.eslintplugin/no-bad-gdpr-comment.js';

export default [
    {
        ignores: ['**/node_modules/**', '**/out/**'],
    },
    // Base configuration for all files
    {
        ignores: [
            '**/node_modules/**',
            '**/out/**',
            'src/test/analysisEngineTest.ts',
            'src/test/ciConstants.ts',
            'src/test/common.ts',
            'src/test/constants.ts',
            'src/test/core.ts',
            'src/test/extension-version.functional.test.ts',
            'src/test/fixtures.ts',
            'src/test/index.ts',
            'src/test/initialize.ts',
            'src/test/mockClasses.ts',
            'src/test/performanceTest.ts',
            'src/test/proc.ts',
            'src/test/smokeTest.ts',
            'src/test/standardTest.ts',
            'src/test/startupTelemetry.unit.test.ts',
            'src/test/testBootstrap.ts',
            'src/test/testLogger.ts',
            'src/test/testRunner.ts',
            'src/test/textUtils.ts',
            'src/test/unittests.ts',
            'src/test/vscode-mock.ts',
            'src/test/interpreters/mocks.ts',
            'src/test/interpreters/virtualEnvs/condaInheritEnvPrompt.unit.test.ts',
            'src/test/interpreters/pythonPathUpdaterFactory.unit.test.ts',
            'src/test/interpreters/activation/service.unit.test.ts',
            'src/test/interpreters/helpers.unit.test.ts',
            'src/test/interpreters/display.unit.test.ts',
            'src/test/terminals/codeExecution/terminalCodeExec.unit.test.ts',
            'src/test/terminals/codeExecution/codeExecutionManager.unit.test.ts',
            'src/test/terminals/codeExecution/djangoShellCodeExect.unit.test.ts',
            'src/test/activation/activeResource.unit.test.ts',
            'src/test/activation/extensionSurvey.unit.test.ts',
            'src/test/utils/fs.ts',
            'src/test/api.functional.test.ts',
            'src/test/testing/common/debugLauncher.unit.test.ts',
            'src/test/testing/common/services/configSettingService.unit.test.ts',
            'src/test/common/exitCIAfterTestReporter.ts',
            'src/test/common/terminals/activator/index.unit.test.ts',
            'src/test/common/terminals/activator/base.unit.test.ts',
            'src/test/common/terminals/shellDetector.unit.test.ts',
            'src/test/common/terminals/service.unit.test.ts',
            'src/test/common/terminals/helper.unit.test.ts',
            'src/test/common/terminals/activation.unit.test.ts',
            'src/test/common/terminals/shellDetectors/shellDetectors.unit.test.ts',
            'src/test/common/terminals/environmentActivationProviders/terminalActivation.testvirtualenvs.ts',
            'src/test/common/socketStream.test.ts',
            'src/test/common/configSettings.test.ts',
            'src/test/common/experiments/telemetry.unit.test.ts',
            'src/test/common/platform/filesystem.unit.test.ts',
            'src/test/common/platform/errors.unit.test.ts',
            'src/test/common/platform/utils.ts',
            'src/test/common/platform/fs-temp.unit.test.ts',
            'src/test/common/platform/fs-temp.functional.test.ts',
            'src/test/common/platform/filesystem.functional.test.ts',
            'src/test/common/platform/filesystem.test.ts',
            'src/test/common/utils/cacheUtils.unit.test.ts',
            'src/test/common/utils/decorators.unit.test.ts',
            'src/test/common/utils/version.unit.test.ts',
            'src/test/common/configSettings/configSettings.unit.test.ts',
            'src/test/common/serviceRegistry.unit.test.ts',
            'src/test/common/extensions.unit.test.ts',
            'src/test/common/variables/envVarsService.unit.test.ts',
            'src/test/common/helpers.test.ts',
            'src/test/common/application/commands/reloadCommand.unit.test.ts',
            'src/test/common/installer/channelManager.unit.test.ts',
            'src/test/common/installer/pipInstaller.unit.test.ts',
            'src/test/common/installer/pipEnvInstaller.unit.test.ts',
            'src/test/common/socketCallbackHandler.test.ts',
            'src/test/common/process/decoder.test.ts',
            'src/test/common/process/processFactory.unit.test.ts',
            'src/test/common/process/pythonToolService.unit.test.ts',
            'src/test/common/process/proc.observable.test.ts',
            'src/test/common/process/logger.unit.test.ts',
            'src/test/common/process/proc.exec.test.ts',
            'src/test/common/process/pythonProcess.unit.test.ts',
            'src/test/common/process/proc.unit.test.ts',
            'src/test/common/interpreterPathService.unit.test.ts',
            'src/test/debugger/extension/adapter/adapter.test.ts',
            'src/test/debugger/extension/adapter/outdatedDebuggerPrompt.unit.test.ts',
            'src/test/debugger/extension/adapter/factory.unit.test.ts',
            'src/test/debugger/extension/adapter/logging.unit.test.ts',
            'src/test/debugger/extension/hooks/childProcessAttachHandler.unit.test.ts',
            'src/test/debugger/extension/hooks/childProcessAttachService.unit.test.ts',
            'src/test/debugger/utils.ts',
            'src/test/debugger/envVars.test.ts',
            'src/test/telemetry/index.unit.test.ts',
            'src/test/telemetry/envFileTelemetry.unit.test.ts',
            'src/test/application/diagnostics/checks/macPythonInterpreter.unit.test.ts',
            'src/test/application/diagnostics/checks/pythonInterpreter.unit.test.ts',
            'src/test/application/diagnostics/checks/powerShellActivation.unit.test.ts',
            'src/test/application/diagnostics/checks/envPathVariable.unit.test.ts',
            'src/test/application/diagnostics/applicationDiagnostics.unit.test.ts',
            'src/test/application/diagnostics/promptHandler.unit.test.ts',
            'src/test/application/diagnostics/commands/ignore.unit.test.ts',
            'src/test/performance/load.perf.test.ts',
            'src/client/interpreter/configuration/interpreterSelector/commands/base.ts',
            'src/client/interpreter/configuration/interpreterSelector/commands/resetInterpreter.ts',
            'src/client/interpreter/configuration/pythonPathUpdaterServiceFactory.ts',
            'src/client/interpreter/configuration/services/globalUpdaterService.ts',
            'src/client/interpreter/configuration/services/workspaceUpdaterService.ts',
            'src/client/interpreter/configuration/services/workspaceFolderUpdaterService.ts',
            'src/client/interpreter/helpers.ts',
            'src/client/interpreter/virtualEnvs/condaInheritEnvPrompt.ts',
            'src/client/interpreter/display/index.ts',
            'src/client/extension.ts',
            'src/client/startupTelemetry.ts',
            'src/client/terminals/codeExecution/terminalCodeExecution.ts',
            'src/client/terminals/codeExecution/codeExecutionManager.ts',
            'src/client/terminals/codeExecution/djangoContext.ts',
            'src/client/activation/commands.ts',
            'src/client/activation/progress.ts',
            'src/client/activation/extensionSurvey.ts',
            'src/client/activation/common/analysisOptions.ts',
            'src/client/activation/languageClientMiddleware.ts',
            'src/client/testing/serviceRegistry.ts',
            'src/client/testing/main.ts',
            'src/client/testing/configurationFactory.ts',
            'src/client/testing/common/constants.ts',
            'src/client/testing/common/testUtils.ts',
            'src/client/common/helpers.ts',
            'src/client/common/net/browser.ts',
            'src/client/common/net/socket/socketCallbackHandler.ts',
            'src/client/common/net/socket/socketServer.ts',
            'src/client/common/net/socket/SocketStream.ts',
            'src/client/common/contextKey.ts',
            'src/client/common/experiments/telemetry.ts',
            'src/client/common/platform/serviceRegistry.ts',
            'src/client/common/platform/errors.ts',
            'src/client/common/platform/fs-temp.ts',
            'src/client/common/platform/fs-paths.ts',
            'src/client/common/platform/registry.ts',
            'src/client/common/platform/pathUtils.ts',
            'src/client/common/persistentState.ts',
            'src/client/common/terminal/activator/base.ts',
            'src/client/common/terminal/activator/powershellFailedHandler.ts',
            'src/client/common/terminal/activator/index.ts',
            'src/client/common/terminal/helper.ts',
            'src/client/common/terminal/syncTerminalService.ts',
            'src/client/common/terminal/factory.ts',
            'src/client/common/terminal/commandPrompt.ts',
            'src/client/common/terminal/service.ts',
            'src/client/common/terminal/shellDetector.ts',
            'src/client/common/terminal/shellDetectors/userEnvironmentShellDetector.ts',
            'src/client/common/terminal/shellDetectors/vscEnvironmentShellDetector.ts',
            'src/client/common/terminal/shellDetectors/terminalNameShellDetector.ts',
            'src/client/common/terminal/shellDetectors/settingsShellDetector.ts',
            'src/client/common/terminal/shellDetectors/baseShellDetector.ts',
            'src/client/common/utils/decorators.ts',
            'src/client/common/utils/enum.ts',
            'src/client/common/utils/platform.ts',
            'src/client/common/utils/stopWatch.ts',
            'src/client/common/utils/random.ts',
            'src/client/common/utils/sysTypes.ts',
            'src/client/common/utils/misc.ts',
            'src/client/common/utils/cacheUtils.ts',
            'src/client/common/utils/workerPool.ts',
            'src/client/common/extensions.ts',
            'src/client/common/variables/serviceRegistry.ts',
            'src/client/common/variables/environment.ts',
            'src/client/common/variables/types.ts',
            'src/client/common/variables/systemVariables.ts',
            'src/client/common/cancellation.ts',
            'src/client/common/interpreterPathService.ts',
            'src/client/common/application/applicationShell.ts',
            'src/client/common/application/languageService.ts',
            'src/client/common/application/clipboard.ts',
            'src/client/common/application/workspace.ts',
            'src/client/common/application/debugSessionTelemetry.ts',
            'src/client/common/application/documentManager.ts',
            'src/client/common/application/debugService.ts',
            'src/client/common/application/commands/reloadCommand.ts',
            'src/client/common/application/terminalManager.ts',
            'src/client/common/application/applicationEnvironment.ts',
            'src/client/common/errors/errorUtils.ts',
            'src/client/common/installer/serviceRegistry.ts',
            'src/client/common/installer/channelManager.ts',
            'src/client/common/installer/moduleInstaller.ts',
            'src/client/common/installer/types.ts',
            'src/client/common/installer/pipEnvInstaller.ts',
            'src/client/common/installer/productService.ts',
            'src/client/common/installer/pipInstaller.ts',
            'src/client/common/installer/productPath.ts',
            'src/client/common/process/currentProcess.ts',
            'src/client/common/process/processFactory.ts',
            'src/client/common/process/serviceRegistry.ts',
            'src/client/common/process/pythonToolService.ts',
            'src/client/common/process/internal/python.ts',
            'src/client/common/process/internal/scripts/testing_tools.ts',
            'src/client/common/process/types.ts',
            'src/client/common/process/logger.ts',
            'src/client/common/process/pythonProcess.ts',
            'src/client/common/process/pythonEnvironment.ts',
            'src/client/common/process/decoder.ts',
            'src/client/debugger/extension/adapter/remoteLaunchers.ts',
            'src/client/debugger/extension/adapter/outdatedDebuggerPrompt.ts',
            'src/client/debugger/extension/adapter/factory.ts',
            'src/client/debugger/extension/adapter/activator.ts',
            'src/client/debugger/extension/adapter/logging.ts',
            'src/client/debugger/extension/hooks/eventHandlerDispatcher.ts',
            'src/client/debugger/extension/hooks/childProcessAttachService.ts',
            'src/client/debugger/extension/attachQuickPick/wmicProcessParser.ts',
            'src/client/debugger/extension/attachQuickPick/factory.ts',
            'src/client/debugger/extension/attachQuickPick/psProcessParser.ts',
            'src/client/debugger/extension/attachQuickPick/picker.ts',
            'src/client/application/serviceRegistry.ts',
            'src/client/application/diagnostics/base.ts',
            'src/client/application/diagnostics/applicationDiagnostics.ts',
            'src/client/application/diagnostics/filter.ts',
            'src/client/application/diagnostics/promptHandler.ts',
            'src/client/application/diagnostics/commands/base.ts',
            'src/client/application/diagnostics/commands/ignore.ts',
            'src/client/application/diagnostics/commands/factory.ts',
            'src/client/application/diagnostics/commands/execVSCCommand.ts',
            'src/client/application/diagnostics/commands/launchBrowser.ts',
        ],
        linterOptions: {
            reportUnusedDisableDirectives: 'off',
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-undef': 'off',
        },
    },
    // TypeScript-specific configuration
    {
        files: ['**/*.ts', '**/*.tsx', '**/*.js', 'src', 'pythonExtensionApi/src'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
            },
            globals: {
                ...(js.configs.recommended.languageOptions?.globals || {}),
                mocha: true,
                require: 'readonly',
                process: 'readonly',
                exports: 'readonly',
                module: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearTimeout: 'readonly',
                clearInterval: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
            'no-only-tests': noOnlyTests,
            import: importPlugin,
            prettier: prettier,
            'no-bad-gdpr-comment': noBadGdprCommentPlugin,
        },
        settings: {
            'import/resolver': {
                node: {
                    extensions: ['.js', '.ts'],
                },
            },
        },
        rules: {
            'no-bad-gdpr-comment/no-bad-gdpr-comment': 'error',
            // Base configurations
            ...tseslint.configs.recommended.rules,
            ...prettier.rules,

            // TypeScript-specific rules
            '@typescript-eslint/ban-ts-comment': [
                'error',
                {
                    'ts-ignore': 'allow-with-description',
                },
            ],
            '@typescript-eslint/ban-types': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-empty-interface': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-namespace': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-loss-of-precision': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    varsIgnorePattern: '^_',
                    argsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-var-requires': 'off',
            '@typescript-eslint/no-use-before-define': [
                'error',
                {
                    functions: false,
                },
            ],

            // Import rules
            'import/extensions': 'off',
            'import/namespace': 'off',
            'import/no-extraneous-dependencies': 'off',
            'import/no-unresolved': 'off',
            'import/prefer-default-export': 'off',

            // Testing rules
            'no-only-tests/no-only-tests': [
                'error',
                {
                    block: ['test', 'suite'],
                    focus: ['only'],
                },
            ],

            // Code style rules
            'linebreak-style': 'off',
            'no-bitwise': 'off',
            'no-console': 'off',
            'no-underscore-dangle': 'off',
            'operator-assignment': 'off',
            'func-names': 'off',

            // Error handling and control flow
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-async-promise-executor': 'off',
            'no-await-in-loop': 'off',
            'no-unreachable': 'off',
            'no-void': 'off',

            // Duplicates and overrides (TypeScript handles these)
            'no-dupe-class-members': 'off',
            'no-redeclare': 'off',
            'no-undef': 'off',

            // Miscellaneous rules
            'no-control-regex': 'off',
            'no-extend-native': 'off',
            'no-inner-declarations': 'off',
            'no-multi-str': 'off',
            'no-param-reassign': 'off',
            'no-prototype-builtins': 'off',
            'no-empty-function': 'off',
            'no-template-curly-in-string': 'off',
            'no-useless-escape': 'off',
            'no-extra-parentheses': 'off',
            'no-extra-paren': 'off',
            '@typescript-eslint/no-extra-parens': 'off',
            strict: 'off',

            // Restricted syntax
            'no-restricted-syntax': [
                'error',
                {
                    selector: 'ForInStatement',
                    message:
                        'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
                },
                {
                    selector: 'LabeledStatement',
                    message:
                        'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
                },
                {
                    selector: 'WithStatement',
                    message:
                        '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
                },
            ],
        },
    },
];
