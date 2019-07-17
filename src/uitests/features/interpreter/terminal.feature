@terminal
Feature: Terminal
    Background: Activted Extension
        Then take a screenshot
        Given the Python extension has been activated
        Then take a screenshot

    @smoke
    Scenario: Execute File in Terminal
        # Use folders and paths with spaces.
        Given a file named "run in terminal.py" is created with the following content
            """
            open('log.log', 'w').write('Hello World')
            """
        And a file named "log.log" does not exist
        Then take a screenshot
        When I open the file "run in terminal.py"
        Then take a screenshot
        Then wait for 1 second
        When I select the command "Python: Run Python File in Terminal"
        Then take a screenshot
        # Wait for some time, as it could take a while for terminal to get activated.
        # Slow on windows.
        Then a file named "log.log" is created within 30 seconds

    Scenario: Execute File within a sub directory in Terminal
        # Use folders and paths with spaces.
        Given a file named "hello word/run in terminal.py" is created with the following content
            """
            open('log.log', 'w').write('Hello World')
            """
        And a file named "hello word/log.log" does not exist
        When I open the file "run in terminal.py"
        And I select the command "Python: Run Python File in Terminal"
        # Wait for some time, as it could take a while for terminal to get activated.
        # Slow on windows.
        Then a file named "log.log" is created within 20 seconds

    Scenario: Execute Selection in Terminal
        # Use folders and paths with spaces.
        Given a file named "run in terminal.py" is created with the following content
            """
            open('log1.log', 'w').write('Hello World')
            open('log2.log', 'w').write('Hello World')
            """
        And a file named "log1.log" does not exist
        And a file named "log2.log" does not exist
        When I open the file "run in terminal.py"
        And I go to line 1
        And I select the command "Python: Run Selection/Line in Python Terminal"
        Then a file named "log1.log" is created within 20 seconds
        And take a screenshot
        When I go to line 2
        And I select the command "Python: Run Selection/Line in Python Terminal"
        # Wait for some time, as it could take a while for terminal to get activated.
        # Slow on windows.
        Then a file named "log2.log" is created within 20 seconds
