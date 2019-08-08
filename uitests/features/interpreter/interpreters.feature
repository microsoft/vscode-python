# Feature: Interpreters
#      @WorkspaceFolder:/Users/donjayamanne/Desktop/Development/PythonStuff/smoke_tests/env_0-virtualenv
#     Scenario: Validate selection of interpreter
#         Given some random interpreter is selected
#         When I select a python interpreter
#         Then interpreter informantion in status bar has refreshed

#     @WorkspaceFolder:/Users/donjayamanne/Desktop/Development/PythonStuff/smoke_tests/env_0-virtualenv
#     Scenario: Validate selection of interpreter when nothing was selected
#         Given there is no python path in settings.json
#         When I select a python interpreter
#         Then interpreter informantion in status bar has refreshed

#     # @pipenv
#     # Scenario: Auto select existing pipenv
#     #     Given the setting 'python.pythonPath' does not exist
#     #     When I reload vscode
#     #     Then settings.json will automatically be updated with pythonPath
#     #     Then the selected interpreter contains the name 'pipenv'
