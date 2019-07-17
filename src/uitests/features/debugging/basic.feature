@debugging
Feature: Debugging
    Scenario: Debugging a python file without creating a launch configuration (with delays in user code)
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
        And I open the file "simple sample.py"
        And I select the command "Debug: Start Debugging"
        Then the Python Debug Configuration picker is displayed
        When I select the debug configuration "Python File"
        # This is when VSC displays the toolbar, (but actual debugger may not have started just yet).
        Then the debugger starts
        # Starting the debugger takes a while, (open terminal, activate it, etc)
        And the debugger will stop within 20 seconds
        And a file named "log.log" will be created

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
        Then take a screenshot
        # For for some time for all messages to be displayed, then hide all of them.
        Then wait for 10 seconds
        Then take a screenshot
        And select the command "Notifications: Clear All Notifications"
        Then take a screenshot
        When I open the file "simple sample.py"
        Then take a screenshot
        And I select the command "Debug: Start Debugging"
        Then take a screenshot
        Then the Python Debug Configuration picker is displayed
        Then take a screenshot
        When I select the debug configuration "Python File"
        Then take a screenshot
        # This is when VSC displays the toolbar, (but actual debugger may not have started just yet).
        Then the debugger starts
        Then take a screenshot
        # Starting the debugger takes a while, (open terminal, activate it, etc)
        And the debugger will stop within 20 seconds
        Then take a screenshot
        And a file named "log.log" will be created
        Then take a screenshot
        And there are no notifications
        Then take a screenshot
