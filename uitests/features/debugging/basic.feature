@debugging
Feature: Debugging
    Scenario: Debugging a python file without creating a launch configuration (with delays in user code)
            """
            Ensure we can debug a python file (the code in the python file is slow).
            I.e. it will not run to completion immediately.
            """
        Given the file ".vscode/launch.json" does not exist
        And a file named "simple sample.py" is created with the following content
            """
            # Add a minor delay for tests to confirm debugger has started
            import time


            time.sleep(2)
            print("Hello World")
            open("log.log", "w").write("Hello")
            """
        When I wait for the Python extension to activate
        When I open the file "simple sample.py"
        When I select the command "Debug: Start Debugging"
        Then the Python Debug Configuration picker is displayed
        When I select the debug configuration "Python File"
        # This is when VSC displays the toolbar, (but actual debugger may not have started just yet).
        Then the debugger starts
        # Starting the debugger takes a while, (open terminal, activate it, etc)
        And the debugger will stop within 20 seconds
        And a file named "log.log" will be created

    Scenario: Confirm Run without debugging without creating a launch configuration works
            """
            Ensure we can run a python file without debugging.
            I.e. it will not run to completion immediately.

            In the past when the debugger would run to completion quicly, the debugger wouldn't work correctly.
            Here, we need to ensure that no notifications/messages are displayed at the end of the debug session.
            (in the past VSC would display error messages).
            """
        Given the file ".vscode/launch.json" does not exist
        And a file named "simple sample.py" is created with the following content
            """
            print("Hello World")
            open("log.log", "w").write("Hello")
            """
        When I wait for the Python extension to activate
        # For for some time for all messages to be displayed, then hide all of them.
        Then wait for 10 seconds
        And select the command "Notifications: Clear All Notifications"
        When I open the file "simple sample.py"
        And I select the command "Debug: Start Without Debugging"
        # This is when VSC displays the toolbar, (but actual debugger may not have started just yet).
        Then the debugger starts
        # Starting the debugger takes a while, (open terminal, activate it, etc)
        And the debugger will stop within 5 seconds
        And a file named "log.log" will be created
        And take a screenshot
        And no error notifications are displayed

    @smoke
    Scenario: Debugging a python file without creating a launch configuration (hello world)
            """
            In the past when the debugger would run to completion quicly, the debugger wouldn't work correctly.
            Here, we need to ensure that no notifications/messages are displayed at the end of the debug session.
            (in the past VSC would display error messages).
            """
        Given the file ".vscode/launch.json" does not exist
        And a file named "simple sample.py" is created with the following content
            """
            print("Hello World")
            open("log.log", "w").write("Hello")
            """
        When I wait for the Python extension to activate
        # For for some time for all messages to be displayed, then hide all of them.
        Then wait for 10 seconds
        And select the command "Notifications: Clear All Notifications"
        When I open the file "simple sample.py"
        And I select the command "Debug: Start Debugging"
        Then the Python Debug Configuration picker is displayed
        When I select the debug configuration "Python File"
        # This is when VSC displays the toolbar, (but actual debugger may not have started just yet).
        Then the debugger starts
        # Starting the debugger takes a while, (open terminal, activate it, etc)
        And the debugger will stop within 20 seconds
        And a file named "log.log" will be created
        Then take a screenshot
        And no error notifications are displayed
