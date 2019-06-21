@terminal
@https://github.com/DonJayamanne/pyvscSmokeTesting/terminal
Feature: Terminal
    Background: Activted Extension
        Given the python extension has been activated

    @smoke
    Scenario: Execute File in Terminal
        Given the file "run in terminal.py" is open
        And a file named "log.log" does not exist
        When I select the command "Python: Run Python File in Terminal"
        Then a file named "log.log" will be created

    Scenario: Execute Selection in Terminal
        Given the file "run selection in terminal.py" is open
        And a file named "log1.log" does not exist
        And a file named "log2.log" does not exist
        When I go to line 1
        And I select the command "Python: Run Selection/Line in Python Terminal"
        Then a file named "log1.log" will be created
        When I go to line 2
        And I select the command "Python: Run Selection/Line in Python Terminal"
        Then a file named "log2.log" will be created

    Scenario: Execute Selection in Terminal using shift+enter
        Given the file "run selection in terminal.py" is open
        And a file named "log1.log" does not exist
        And a file named "log2.log" does not exist
        When I go to line 1
        And I press shift+enter
        Then a file named "log1.log" will be created
        When I go to line 2
        And I press shift+enter
        Then a file named "log2.log" will be created
