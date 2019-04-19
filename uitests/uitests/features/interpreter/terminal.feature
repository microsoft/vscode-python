@terminal
Feature: Terminal
    @mac
    Scenario: Select an invalid interpreter
        When I reload VSC
        And I select the default mac Interpreter
        Then a message with the text "You have selected the macOS system install of Python, which is not recommended for use with the Python extension. Some functionality will be limited, please select a different interpreter." is displayed
        And take a screenshot
    @smoke
    Scenario: Execute File in Terminal
        Given a file named "run_in_terminal.py" is created with the following contents
            """
            open("log.log", "w").write("Hello World")
            """
        And the file "run_in_terminal.py" is open
        And a file named "log.log" does not exist
        When I select the command "Python: Run Python File in Terminal"
        Then a file named "log.log" is created
        And take a screenshot

    Scenario: Execute Selection in Terminal
        Given a file named "run_in_terminal.py" is created with the following contents
            """
            open("log.log", "w").write("Hello World")
            open("log.log", "w").write("Bye")
            """
        And the file "run_in_terminal.py" is open
        And a file named "log.log" does not exist
        When I go to line 1
        And I select the command "Python: Run Selection/Line in Python Terminal"
        Then a file named "log.log" is created
        And the file "log.log" contains the value "Hello World"
        And take a screenshot
        When I go to line 2
        And I select the command "Python: Run Selection/Line in Python Terminal"
        Then a file named "log.log" is created
        And the file "log.log" contains the value "Bye"
        And take a screenshot
