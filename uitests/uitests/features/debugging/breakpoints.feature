@debugging
Feature: Debugging
    @smoke
    Scenario: Debugging a python file with breakpoints
        Given a file named ".vscode/launch.json" is created with the following contents
            """
            {
                "version": "0.2.0",
                "configurations": [
                    {
                        "name": "Python: Current File",
                        "type": "python",
                        "request": "launch",
                        "program": "${workspaceFolder}/simple sample.py",
                        "console": "integratedTerminal"
                    }
                ]
            }
            """
        And a file named "simple sample.py" is created with the following contents
            """
            open("log.log", "w").write("Hello")
            """
        When I wait for the Python extension to activate
        And I open the file "simple sample.py"
        And I add a breakpoint to line 1 in "simple sample.py"
        And I select the command "View: Close All Editors"
        And I select the command "Debug: Start Debugging"
        Then the debugger starts
        And the debugger pauses
        And the file "simple sample.py" is opened
        And the cursor is on line 1
        And the current stack frame is at line 1 in "simple sample.py"
        When I select the command "Debug: Continue"
        Then the debugger stops

    Scenario: Debugging a python file without breakpoints
        Given a file named ".vscode/launch.json" is created with the following contents
            """
            {
                "version": "0.2.0",
                "configurations": [
                    {
                        "name": "Python: Current File",
                        "type": "python",
                        "request": "launch",
                        "program": "${workspaceFolder}/simple sample.py",
                        "console": "integratedTerminal",
                        "stopOnEntry": true
                    }
                ]
            }
            """
        And a file named "simple sample.py" is created with the following contents
            """
            open("log.log", "w").write("Hello")
            """
        When I wait for the Python extension to activate
        And I select the command "Debug: Start Debugging"
        Then the debugger starts
        And the debugger pauses
        And the file "simple sample.py" is opened
        And the cursor is on line 1
        And the current stack frame is at line 1 in "simple sample.py"
        When I select the command "Debug: Continue"
        Then the debugger stops
