@debugging
Feature: Debugging
    Scenario: Debugging a python file without creating a launch configuration (with delays)
        Given the file ".vscode/launch.json" does not exist
        And a file named "simple sample.py" is created with the following contents
            """
            # Add a minor delay for tests to confirm debugger has started
            import time


            time.sleep(2)
            print("Hello World")
            open("log.log", "w").write("Hello")
            """
        When I wait for the Python extension to activate
        And I open the file "simple sample.py"
        And I select the command "Debug: Start Debugging"
        Then the Python Debug Configuration picker is displayed
        When I select the debug configuration "Python File"
        Then the debugger starts
        And the debugger will stop within 5 seconds
        And a file named "log.log" will be created

    Scenario: Debugging a python file without creating a launch configuration (hello world)
        Given the file ".vscode/launch.json" does not exist
        And a file named "simple sample.py" is created with the following contents
            """
            print("Hello World")
            open("log.log", "w").write("Hello")
            """
        When I wait for the Python extension to activate
        And I open the file "simple sample.py"
        And I select the command "Debug: Start Debugging"
        Then the Python Debug Configuration picker is displayed
        When I select the debug configuration "Python File"
        Then the debugger will stop within 5 seconds
        And a file named "log.log" will be created within 5 seconds
