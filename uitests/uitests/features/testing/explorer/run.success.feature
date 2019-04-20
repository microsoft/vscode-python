@test
@git://github.com/DonJayamanne/pyvscSmokeTesting.git
Feature: Test Explorer Discovering icons and stop discovery

    Scenario: When running tests, the nodes will have the progress icon and when completed will have a success status (unitest)
        Given the workspace setting "python.testing.pyTestEnabled" is disabled
        And the workspace setting "python.testing.unittestEnabled" is enabled
        And the workspace setting "python.testing.nosetestsEnabled" is disabled
        And a file named "tests/test_running_delay" is created with the following contents
            """
            5
            """
        When I reload VSC
        When I select the command "Python: Discover Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        Then there are 14 nodes in the tree
        And 14 nodes have a status of "Unknown"
        When I run the test node number 5
        And I wait for 1 seconds
        Then the stop icon is visible in the toolbar
        And the node number 5 has a status of "Progress"
        And 1 node has a status of "Progress"
        When I wait for tests to complete running
        Then the node number 1 has a status of "Success"
        And the node number 2 has a status of "Success"
        And the node number 5 has a status of "Success"
        And 11 nodes have a status of "Unknown"


    Scenario: When running tests, the nodes will have the progress icon and when completed will have a success status (pytest)
        Given the package "pytest" is installed
        And the workspace setting "python.testing.pyTestEnabled" is enabled
        And the workspace setting "python.testing.unittestEnabled" is disabled
        And the workspace setting "python.testing.nosetestsEnabled" is disabled
        And a file named "tests/test_running_delay" is created with the following contents
            """
            5
            """
        When I reload VSC
        When I select the command "Python: Discover Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        Then there are 14 nodes in the tree
        And 14 nodes have a status of "Unknown"
        When I run the test node number 4
        And I wait for 1 seconds
        Then the stop icon is visible in the toolbar
        And the node number 4 has a status of "Progress"
        And 1 node has a status of "Progress"
        When I wait for tests to complete running
        Then the node number 1 has a status of "Success"
        And the node number 2 has a status of "Success"
        And the node number 3 has a status of "Success"
        And the node number 4 has a status of "Success"
        And 11 nodes have a status of "Unknown"

    Scenario: When running tests, the nodes will have the progress icon and when completed will have a success status (nose)
        Given the package "nose" is installed
        And the workspace setting "python.testing.pyTestEnabled" is disabled
        And the workspace setting "python.testing.unittestEnabled" is disabled
        And the workspace setting "python.testing.nosetestsEnabled" is enabled
        And a file named "tests/test_running_delay" is created with the following contents
            """
            5
            """
        When I reload VSC
        When I select the command "Python: Discover Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        Then there are 14 nodes in the tree
        And 14 nodes have a status of "Unknown"
        When I run the test node number 5
        And I wait for 1 seconds
        Then the stop icon is visible in the toolbar
        And the node number 5 has a status of "Progress"
        And 1 node has a status of "Progress"
        When I wait for tests to complete running
        Then the node number 1 has a status of "Success"
        And the node number 2 has a status of "Success"
        And the node number 5 has a status of "Success"
        And 11 nodes have a status of "Unknown"


    Scenario: When running tests, the nodes will have the progress icon and when completed will have a error status (unitest)
        Given the workspace setting "python.testing.pyTestEnabled" is disabled
        And the workspace setting "python.testing.unittestEnabled" is enabled
        And the workspace setting "python.testing.nosetestsEnabled" is disabled
        And a file named "tests/test_running_delay" is created with the following contents
            """
            5
            """
        And a file named "tests/data.json" is created with the following contents
            """
            [1,2,-1,4,5,6]
            """
        When I reload VSC
        When I select the command "Python: Discover Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        Then there are 14 nodes in the tree
        And 14 nodes have a status of "Unknown"
        When I run the test node number 4
        And I wait for 1 seconds
        Then the stop icon is visible in the toolbar
        And the node number 4 has a status of "Progress"
        And 1 node has a status of "Progress"
        When I wait for tests to complete running
        Then the node number 1 has a status of "Fail"
        And the node number 2 has a status of "Fail"
        And the node number 4 has a status of "Fail"
        And 11 nodes have a status of "Unknown"

    Scenario: When running tests, the nodes will have the progress icon and when completed will have a error status (pytest)
        Given the package "pytest" is installed
        And the workspace setting "python.testing.pyTestEnabled" is enabled
        And the workspace setting "python.testing.unittestEnabled" is disabled
        And the workspace setting "python.testing.nosetestsEnabled" is disabled
        And a file named "tests/test_running_delay" is created with the following contents
            """
            5
            """
        And a file named "tests/data.json" is created with the following contents
            """
            [1,2,-1,4,5,6]
            """
        When I reload VSC
        When I select the command "Python: Discover Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        Then there are 15 nodes in the tree
        And 15 nodes have a status of "Unknown"
        When I run the test node number 5
        And I wait for 1 seconds
        Then the stop icon is visible in the toolbar
        And the node number 5 has a status of "Progress"
        And 1 node has a status of "Progress"
        When I wait for tests to complete running
        Then the node number 1 has a status of "Fail"
        And the node number 2 has a status of "Fail"
        And the node number 3 has a status of "Fail"
        And the node number 5 has a status of "Fail"
        And 11 nodes have a status of "Unknown"

    Scenario: When running tests, the nodes will have the progress icon and when completed will have a error status (nose)
        Given the package "nose" is installed
        And the workspace setting "python.testing.pyTestEnabled" is disabled
        And the workspace setting "python.testing.unittestEnabled" is disabled
        And the workspace setting "python.testing.nosetestsEnabled" is enabled
        And a file named "tests/test_running_delay" is created with the following contents
            """
            5
            """
        And a file named "tests/data.json" is created with the following contents
            """
            [1,2,-1,4,5,6]
            """
        When I reload VSC
        When I select the command "Python: Discover Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        Then there are 14 nodes in the tree
        And 14 nodes have a status of "Unknown"
        When I run the test node number 4
        And I wait for 1 seconds
        Then the stop icon is visible in the toolbar
        And the node number 5 has a status of "Progress"
        And 1 node has a status of "Progress"
        When I wait for tests to complete running
        Then the node number 1 has a status of "Fail"
        And the node number 2 has a status of "Fail"
        And the node number 3 has a status of "Fail"
        And 11 nodes have a status of "Unknown"

    Scenario: When running tests, the nodes will have the progress icon and when stopped will have an unknown status (unitest)
        Given the workspace setting "python.testing.pyTestEnabled" is disabled
        And the workspace setting "python.testing.unittestEnabled" is enabled
        And the workspace setting "python.testing.nosetestsEnabled" is disabled
        When I reload VSC
        When I select the command "Python: Run All Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        Then there are 14 nodes in the tree
        And 14 nodes have a status of "Success"
        When the file "tests/test_running_delay" has the following content
            """
            5
            """
        And I run the test node number 5
        And I wait for 1 second
        Then the stop icon is visible in the toolbar
        And the node number 5 has a status of "Progress"
        And 1 node has a status of "Progress"
        When I stop running tests
        Then the node number 1 has a status of "Success"
        And the node number 2 has a status of "Success"
        And the node number 5 has a status of "Success"
        And 11 nodes have a status of "Unknown"

    Scenario: When running tests, the nodes will have the progress icon and when stopped will have an unknown status (pytest)
        Given the package "pytest" is installed
        And the workspace setting "python.testing.pyTestEnabled" is enabled
        And the workspace setting "python.testing.unittestEnabled" is disabled
        And the workspace setting "python.testing.nosetestsEnabled" is disabled
        When I reload VSC
        When I select the command "Python: Run All Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        Then there are 15 nodes in the tree
        And 15 nodes have a status of "Success"
        When the file "tests/test_running_delay" has the following content
            """
            5
            """
        And I run the test node number 5
        And I wait for 1 second
        Then the stop icon is visible in the toolbar
        And the node number 5 has a status of "Progress"
        And 1 node has a status of "Progress"
        When I stop running tests
        Then the node number 1 has a status of "Success"
        And the node number 2 has a status of "Success"
        And the node number 3 has a status of "Success"
        And the node number 5 has a status of "Success"
        And 11 nodes have a status of "Unknown"

    Scenario: When running tests, the nodes will have the progress icon and when stopped will have an unknown status (nose)
        Given the package "nose" is installed
        And the workspace setting "python.testing.pyTestEnabled" is disabled
        And the workspace setting "python.testing.unittestEnabled" is disabled
        And the workspace setting "python.testing.nosetestsEnabled" is enabled
        When I reload VSC
        When I select the command "Python: Run All Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        Then there are 14 nodes in the tree
        And 14 nodes have a status of "Success"
        When the file "tests/test_running_delay" has the following content
            """
            5
            """
        And I run the test node number 5
        And I wait for 1 second
        Then the stop icon is visible in the toolbar
        And the node number 5 has a status of "Progress"
        And 1 node has a status of "Progress"
        When I stop running tests
        Then the node number 1 has a status of "Success"
        And the node number 2 has a status of "Success"
        And the node number 5 has a status of "Unknown"
        And 11 nodes have a status of "Success"
