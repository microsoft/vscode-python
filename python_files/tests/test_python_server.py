# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

"""Tests for python_server.py, specifically EOF handling to prevent infinite loops."""

import io
from unittest import mock

import pytest


class TestGetHeaders:
    """Tests for the get_headers function."""

    def test_get_headers_normal(self):
        """Test get_headers with valid headers."""
        # Arrange: Import the module
        import python_server

        # Create a mock stdin with valid headers
        mock_input = b"Content-Length: 100\r\nContent-Type: application/json\r\n\r\n"
        mock_stdin = io.BytesIO(mock_input)

        # Act
        with mock.patch.object(python_server, "STDIN", mock.Mock(buffer=mock_stdin)):
            headers = python_server.get_headers()

        # Assert
        assert headers == {"Content-Length": "100", "Content-Type": "application/json"}

    def test_get_headers_eof_raises_error(self):
        """Test that get_headers raises EOFError when stdin is closed (EOF)."""
        # Arrange: Import the module
        import python_server

        # Create a mock stdin that returns empty bytes (EOF)
        mock_stdin = io.BytesIO(b"")

        # Act & Assert
        with mock.patch.object(python_server, "STDIN", mock.Mock(buffer=mock_stdin)), pytest.raises(
            EOFError, match="EOF reached while reading headers"
        ):
            python_server.get_headers()

    def test_get_headers_eof_mid_headers_raises_error(self):
        """Test that get_headers raises EOFError when EOF occurs mid-headers."""
        # Arrange: Import the module
        import python_server

        # Create a mock stdin with partial headers then EOF
        mock_input = b"Content-Length: 100\r\n"  # No terminating empty line
        mock_stdin = io.BytesIO(mock_input)

        # Act & Assert
        with mock.patch.object(python_server, "STDIN", mock.Mock(buffer=mock_stdin)), pytest.raises(
            EOFError, match="EOF reached while reading headers"
        ):
            python_server.get_headers()

    def test_get_headers_empty_line_terminates(self):
        """Test that an empty line (not EOF) properly terminates header reading."""
        # Arrange: Import the module
        import python_server

        # Create a mock stdin with headers followed by empty line
        mock_input = b"Content-Length: 50\r\n\r\nsome body content"
        mock_stdin = io.BytesIO(mock_input)

        # Act
        with mock.patch.object(python_server, "STDIN", mock.Mock(buffer=mock_stdin)):
            headers = python_server.get_headers()

        # Assert
        assert headers == {"Content-Length": "50"}


class TestEOFHandling:
    """Tests for EOF handling in various functions that use get_headers."""

    def test_custom_input_exits_on_eof(self):
        """Test that custom_input exits gracefully on EOF."""
        # Arrange: Import the module
        import python_server

        # Create a mock stdin that returns empty bytes (EOF)
        mock_stdin = io.BytesIO(b"")
        mock_stdout = io.BytesIO()

        # Act & Assert
        with mock.patch.object(
            python_server, "STDIN", mock.Mock(buffer=mock_stdin)
        ), mock.patch.object(python_server, "STDOUT", mock.Mock(buffer=mock_stdout)), pytest.raises(
            SystemExit
        ) as exc_info:
            python_server.custom_input("prompt> ")

        # Should exit with code 0 (graceful exit)
        assert exc_info.value.code == 0

    def test_handle_response_exits_on_eof(self):
        """Test that handle_response exits gracefully on EOF."""
        # Arrange: Import the module
        import python_server

        # Create a mock stdin that returns empty bytes (EOF)
        mock_stdin = io.BytesIO(b"")

        # Act & Assert
        with mock.patch.object(python_server, "STDIN", mock.Mock(buffer=mock_stdin)), pytest.raises(
            SystemExit
        ) as exc_info:
            python_server.handle_response("test-request-id")

        # Should exit with code 0 (graceful exit)
        assert exc_info.value.code == 0


class TestMainLoopEOFHandling:
    """Tests that simulate the main loop EOF scenario."""

    def test_main_loop_exits_on_eof(self):
        """Test that the main loop pattern exits gracefully on EOF.

        This test verifies the fix for GitHub issue #25620 where the server
        would spin at 100% CPU instead of exiting when VS Code closes.
        """
        # Arrange: Import the module
        import python_server

        # Create a mock stdin that returns empty bytes (EOF)
        mock_stdin = io.BytesIO(b"")

        # Simulate what happens in the main loop
        with mock.patch.object(python_server, "STDIN", mock.Mock(buffer=mock_stdin)):
            try:
                python_server.get_headers()
                # If we get here without raising EOFError, the fix isn't working
                pytest.fail("Expected EOFError to be raised on EOF")
            except EOFError:
                # This is the expected behavior - the fix is working
                pass

    def test_readline_eof_vs_empty_line(self):
        """Test that we correctly distinguish between EOF and empty line.

        EOF: readline() returns b'' (empty bytes)
        Empty line: readline() returns b'\\r\\n' or b'\\n' (newline bytes)
        """
        # Test EOF case
        eof_stream = io.BytesIO(b"")
        result = eof_stream.readline()
        assert result == b"", "EOF should return empty bytes"

        # Test empty line case
        empty_line_stream = io.BytesIO(b"\r\n")
        result = empty_line_stream.readline()
        assert result == b"\r\n", "Empty line should return newline bytes"

        # Test empty line with just newline
        empty_line_stream2 = io.BytesIO(b"\n")
        result = empty_line_stream2.readline()
        assert result == b"\n", "Empty line should return newline bytes"
