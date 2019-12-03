# @test
# @https://github.com/DonJayamanne/pyvscSmokeTesting.git
# Feature: Test Explorer Running icons and stop running
#     Scenario: When running tests, the nodes will have the progress icon and clicking stop will stop running (unitest)
#         Given the workspace setting "python.testing.pytestEnabled" is disabled
#         And the workspace setting "python.testing.unittestEnabled" is enabled
#         And the workspace setting "python.testing.nosetestsEnabled" is disabled
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         And the file "tests/test_running_delay" has the following content
#             """
#             10
#             """
#         When I select the command "Python: Run All Tests"
#         And I wait for 1 second
#         Then all of the test tree nodes have a progress icon
#         And the stop icon is visible in the toolbar
#         When I stop running tests
#         Then the stop icon is not visible in the toolbar

#     Scenario: When running tests, the nodes will have the progress icon and clicking stop will stop running (pytest)
#         Given the package "pytest" is installed
#         And the workspace setting "python.testing.pytestEnabled" is enabled
#         And the workspace setting "python.testing.unittestEnabled" is disabled
#         And the workspace setting "python.testing.nosetestsEnabled" is disabled
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         And the file "tests/test_running_delay" has the following content
#             """
#             10
#             """
#         When I select the command "Python: Run All Tests"
#         And I wait for 1 second
#         Then all of the test tree nodes have a progress icon
#         And the stop icon is visible in the toolbar
#         When I stop running tests
#         Then the stop icon is not visible in the toolbar

#     Scenario: When running tests, the nodes will have the progress icon and clicking stop will stop running (nose)
#         Given the package "nose" is installed
#         And the workspace setting "python.testing.pytestEnabled" is enabled
#         And the workspace setting "python.testing.unittestEnabled" is disabled
#         And the workspace setting "python.testing.nosetestsEnabled" is disabled
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         And the file "tests/test_running_delay" has the following content
#             """
#             10
#             """
#         When I select the command "Python: Run All Tests"
#         And I wait for 1 second
#         Then all of the test tree nodes have a progress icon
#         And the stop icon is visible in the toolbar
#         When I stop running tests
#         Then the stop icon is not visible in the toolbar
