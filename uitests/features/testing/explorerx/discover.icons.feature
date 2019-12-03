# @test
# @https://github.com/DonJayamanne/pyvscSmokeTesting.git
# Feature: Test Explorer Discovering icons and stop discovery

#     Scenario: When discovering tests, the nodes will have the progress icon and clicking stop will stop discovery (unitest)
#         Given the workspace setting "python.testing.pytestEnabled" is disabled
#         And the workspace setting "python.testing.unittestEnabled" is enabled
#         And the workspace setting "python.testing.nosetestsEnabled" is disabled
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         Then there are 14 nodes in the test explorer
#         # Now, add a delay for the discovery of the tests
#         Given a file named "tests/test_discovery_delay" is created with the following content
#             """
#             10
#             """
#         When I select the command "Python: Discover Tests"
#         And I wait for 1 second
#         Then all of the test tree nodes have a progress icon
#         And the stop icon is visible in the toolbar
#         When I stop discovering tests
#         Then the stop icon is not visible in the toolbar

#     Scenario: When discovering tests, the nodes will have the progress icon and clicking stop will stop discovery (pytest)
#         Given the package "pytest" is installed
#         And the workspace setting "python.testing.pytestEnabled" is enabled
#         And the workspace setting "python.testing.unittestEnabled" is disabled
#         And the workspace setting "python.testing.nosetestsEnabled" is disabled
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         Then there are 15 nodes in the test explorer
#         # Now, add a delay for the discovery of the tests
#         Given a file named "tests/test_discovery_delay" is created with the following content
#             """
#             10
#             """
#         When I select the command "Python: Discover Tests"
#         And I wait for 1 second
#         Then all of the test tree nodes have a progress icon
#         And the stop icon is visible in the toolbar
#         When I stop discovering tests
#         Then the stop icon is not visible in the toolbar

#     Scenario: When discovering tests, the nodes will have the progress icon and clicking stop will stop discovery (nose)
#         Given the package "nose" is installed
#         And the workspace setting "python.testing.pytestEnabled" is enabled
#         And the workspace setting "python.testing.unittestEnabled" is disabled
#         And the workspace setting "python.testing.nosetestsEnabled" is disabled
#         When I reload VSC
#         When I select the command "Python: Discover Tests"
#         Then the test explorer icon will be visible
#         When I select the command "View: Show Test"
#         And I expand all of the nodes in the test explorer
#         Then there are 15 nodes in the test explorer
#         # Now, add a delay for the discovery of the tests
#         Given a file named "tests/test_discovery_delay" is created with the following content
#             """
#             10
#             """
#         When I select the command "Python: Discover Tests"
#         And I wait for 1 second
#         Then all of the test tree nodes have a progress icon
#         And the stop icon is visible in the toolbar
#         When I stop discovering tests
#         Then the stop icon is not visible in the toolbar
