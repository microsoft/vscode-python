# @terminal @terminal.venv @python3
# @https://github.com/DonJayamanne/vscode-python-uitests/terminal/execution
# Feature: Terminal (venv)
#     Scenario: Interpreter display name contains the name of the venv folder
#         Given a venv with the name "venv 1" is created
#         When In Mac, I update the workspace setting "python.pythonPath" with the value "venv 1/bin/python"
#         When In Linux, I update the workspace setting "python.pythonPath" with the value "venv 1/bin/python"
#         When In Windows, I update the workspace setting "python.pythonPath" with the value "venv 1/Scripts/python.exe"
#         Then the python interpreter displayed in the the status bar contains the value "venv 1" in the display name

#     @preserve.workspace
#     Scenario: Venv is auto selected
#         Given the workspace setting "python.pythonPath" does not exist
#         And the user setting "python.pythonPath" does not exist
#         Then the python interpreter displayed in the the status bar does not contain the value "venv 1" in the display name
#         When I reload VSC
#         Then the python interpreter displayed in the the status bar contains the value "venv 1" in the display name

#     @preserve.workspace
#     Scenario: Venv is not auto selected (if we already have a local interpreter selected)
#         Given a generic Python Interpreter is selected
#         And the user setting "python.pythonPath" does not exist
#         Then the python interpreter displayed in the the status bar does not contain the value "venv 1" in the display name
#         When I reload VSC
#         Then the python interpreter displayed in the the status bar does not contain the value "venv 1" in the display name

#     @preserve.workspace
#     Scenario: Venv is not auto selected (if we have a global interpreter selected)
#         Given the workspace setting "python.pythonPath" does not exist
#         And the user setting "python.pythonPath" exists
#         Then the python interpreter displayed in the the status bar does not contain the value "venv 1" in the display name
#         When I reload VSC
#         Then the python interpreter displayed in the the status bar does not contain the value "venv 1" in the display name

#     @preserve.workspace
#     Scenario: Environment is not activated in the Terminal
#         When In Mac, I update the workspace setting "python.pythonPath" with the value "venv 1/bin/python"
#         When In Linux, I update the workspace setting "python.pythonPath" with the value "venv 1/bin/python"
#         When In Windows, I update the workspace setting "python.pythonPath" with the value "venv 1/Scripts/python.exe"
#         Given the file "write_pyPath_in_log.py" is open
#         And a file named "log.log" does not exist
#         And the workspace setting "python.terminal.activateEnvironment" is disabled
#         And a terminal is opened
#         When I send the command "python write_pyPath_in_log.py" to the terminal
#         Then a file named "log.log" is created
#         And open the file "log.log"
#         And the file "log.log" does not contain the value "env 1"
#         And take a screenshot

#     @preserve.workspace
#     Scenario: Environment is activated in the Terminal
#         When In Mac, I update the workspace setting "python.pythonPath" with the value "venv 1/bin/python"
#         When In Linux, I update the workspace setting "python.pythonPath" with the value "venv 1/bin/python"
#         When In Windows, I update the workspace setting "python.pythonPath" with the value "venv 1/Scripts/python.exe"
#         Given the file "write_pyPath_in_log.py" is open
#         And a file named "log.log" does not exist
#         And the workspace setting "python.terminal.activateEnvironment" is enabled
#         And a terminal is opened
#         When I send the command "python write_pyPath_in_log.py" to the terminal
#         Then a file named "log.log" is created
#         And open the file "log.log"
#         And the file "log.log" contains the value "env 1"
#         And take a screenshot
