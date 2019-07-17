# @terminal
# Feature: Environment Files
#     Background: Activted Extension
#         Given the Python extension has been activated
#         Given a file named ".env" is created with the following content
#         """
#         MY_FILE_NAME=log1.log
#         """
#         Given a file named ".env2" is created with the following content
#         """
#         MY_FILE_NAME=log2.log
#         """
#         Given a file named "simple sample.py" is created with the following content
#         """
#         import os
#         file_name = os.environ.get("MY_FILE_NAME", "other.log")
#         with open(file_name, "w") as fp:
#             fp.write("Hello")
#         """
#         And a file named "log1.log" does not exist
#         And a file named "log2.log" does not exist

#     Scenario: Environment variable defined in default environment file is used by debugger
#         Given a file named ".vscode/launch.json" is created with the following content
#             """
#             {
#                 "version": "0.2.0",
#                 "configurations": [
#                     {
#                         "name": "Python: Current File",
#                         "type": "python",
#                         "request": "launch",
#                         "program": "${workspaceFolder}/simple sample.py",
#                         "console": "integratedTerminal"
#                     }
#                 ]
#             }
#             """
#         When I open the file "simple sample.py"
#         And I select the command "Debug: Start Debugging"
#         Then the debugger starts
#         And the debugger stops
#         And a file named "log1.log" will be created

#     Scenario: Environment variable defined in envFile of launch.json is used by debugger
#         Given a file named ".vscode/launch.json" is created with the following content
#             """
#             {
#                 "version": "0.2.0",
#                 "configurations": [
#                     {
#                         "name": "Python: Current File",
#                         "type": "python",
#                         "request": "launch",
#                         "program": "${workspaceFolder}/simple sample.py",
#                         "console": "integratedTerminal",
#                         "envFile": "${workspaceFolder}/.env2"
#                     }
#                 ]
#             }
#             """
#         When I open the file "simple sample.py"
#         And I select the command "Debug: Start Debugging"
#         Then the debugger starts
#         And the debugger stops
#         And a file named "log2.log" will be created

#     Scenario: Environment variable defined in envFile of settings.json is used by debugger
#         Given the workspace setting "python.envFile" has the value "${workspaceFolder}/.env2"
#         Given a file named ".vscode/launch.json" is created with the following content
#             """
#             {
#                 "version": "0.2.0",
#                 "configurations": [
#                     {
#                         "name": "Python: Current File",
#                         "type": "python",
#                         "request": "launch",
#                         "program": "${workspaceFolder}/simple sample.py",
#                         "console": "integratedTerminal"
#                     }
#                 ]
#             }
#             """
#         When I open the file "simple sample.py"
#         And I select the command "Debug: Start Debugging"
#         Then the debugger starts
#         And the debugger stops
#         And a file named "log2.log" will be created
