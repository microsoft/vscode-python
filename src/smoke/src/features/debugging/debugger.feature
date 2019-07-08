# Feature: Debugger
#      @debug @WorkspaceFolder:/Users/donjayamanne/Desktop/Development/PythonStuff/smoke_tests/env_0-virtualenv
#      Scenario: Debug Python File with launch.json
#         Given the file "main.py" is open
#         When stopOnEntry is false in launch.json
#         When I add a breakpoint to line 6
#         When I select the command "View: Toggle Integrated Terminal"
#         When I press "F5"
#         Then debugger starts
#         Then take a screenshot
#         When I open the debug console
#         Then the text "Application launched successfully" is displayed in the debug console
#         Then take a screenshot
#         Then number of variables in variable window is 1
#         When I select the command "Debug: Step Over"
#         Then stack frame for file "main.py" is displayed
#         When I select the command "Debug: Step Over"
#         Then stack frame for file "main.py" and line 6 is displayed
#         When I select the command "Debug: Step Over"
#         Then stack frame for file "main.py" and line 5 is displayed
#         When I select the command "Debug: Step Over"
#         When I select the command "Debug: Step Into"
#         Then stack frame for file "wow.py" and line 7 is displayed
#         When I select the command "Debug: Continue"
#         Then debugger stops

#      @debug @WorkspaceFolder:/Users/donjayamanne/Desktop/Development/PythonStuff/smoke_tests/env_0-virtualenv
#      Scenario: Debug Python File without launch.json
#         Given the file "main.py" is open
#         Given the file ".vscode/launch.json" does not exist
#         When I add a breakpoint to line 6
#         When I select the command "View: Toggle Integrated Terminal"
#         When I press "F5"
#         Then debugger starts
#         Then take a screenshot
#         When I open the debug console
#         Then the text "Application launched successfully" is displayed in the debug console
#         Then take a screenshot
#         Then number of variables in variable window is 1
#         When I select the command "Debug: Step Over"
#         Then stack frame for file "main.py" is displayed
#         When I select the command "Debug: Step Over"
#         Then stack frame for file "main.py" and line 6 is displayed
#         When I select the command "Debug: Step Over"
#         Then stack frame for file "main.py" and line 5 is displayed
#         When I select the command "Debug: Step Over"
#         When I select the command "Debug: Step Into"
#         Then stack frame for file "wow.py" and line 7 is displayed
#         When I select the command "Debug: Continue"
#         Then debugger stops

#      @debug @WorkspaceFolder:/Users/donjayamanne/Desktop/Development/PythonStuff/smoke_tests/env_0-virtualenv
#      Scenario: Debug Python File and stop on entry
#         Given the file "debugAndStopOnEntry.py" is open
#         When stopOnEntry is true in launch.json
#         When I open the file "debugAndStopOnEntry.py"
#         When I press "F5"
#         Then debugger starts
#         Then take a screenshot
#         Then stack frame for file "debugAndStopOnEntry.py" and line 3 is displayed
#         When I select the command "Debug: Continue"
#         Then debugger stops

#      @debug @WorkspaceFolder:/Users/donjayamanne/Desktop/Development/PythonStuff/smoke_tests/env_0-virtualenv
#      Scenario: Debug Python File without breakpoints
#         Given the file "debugWithoutBreakpoints.py" is open
#         When I press "F5"
#         Then debugger starts
#         Then take a screenshot
#         Then debugger stops
#         When I select the command "View: Debug Console"
#         Then the text "Debugging completed" is displayed in the debug console
#         Then take a screenshot

#      @debug @WorkspaceFolder:/Users/donjayamanne/Desktop/Development/PythonStuff/smoke_tests/env_0-virtualenv
#      Scenario: Run Python File without debugging
#         Given the file "runWithoutDebugging.py" is open
#         When I select the command "Debug: Start Without Debugging"
#         Then debugger stops
#         When I select the command "View: Debug Console"
#         Then the text "Ran without debugging" is displayed in the debug console
#         Then take a screenshot

#      @debug @WorkspaceFolder:/Users/donjayamanne/Desktop/Development/vscode/smokeTests/debugSimple
#      Scenario: Run Python File without debugging
#         Given the file "runWithoutDebugging.py" is open
#         When I select the command "Debug: Start Without Debugging"
#         Then debugger stops
#         When I select the command "View: Debug Console"
#         Then the text "Ran without debugging and no launch.json" is displayed in the debug console
#         Then take a screenshot
