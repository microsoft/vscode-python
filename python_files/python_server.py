from typing import Dict, List, Optional, Union
import sys
import json
import contextlib
import io
import traceback
import uuid
import ast

STDIN = sys.stdin
STDOUT = sys.stdout
STDERR = sys.stderr
USER_GLOBALS = {}


def send_message(msg: str):
    length_msg = len(msg)
    STDOUT.buffer.write(f"Content-Length: {length_msg}\r\n\r\n{msg}".encode(encoding="utf-8"))
    STDOUT.buffer.flush()


def print_log(msg: str):
    send_message(json.dumps({"jsonrpc": "2.0", "method": "log", "params": msg}))


def send_response(response: str, response_id: int):
    send_message(json.dumps({"jsonrpc": "2.0", "id": response_id, "result": response}))


def send_request(params: Optional[Union[List, Dict]] = None):
    request_id = uuid.uuid4().hex
    if params is None:
        send_message(json.dumps({"jsonrpc": "2.0", "id": request_id, "method": "input"}))
    else:
        send_message(
            json.dumps({"jsonrpc": "2.0", "id": request_id, "method": "input", "params": params})
        )
    return request_id


original_input = input


def custom_input(prompt=""):
    try:
        send_request({"prompt": prompt})
        headers = get_headers()
        content_length = int(headers.get("Content-Length", 0))

        if content_length:
            message_text = STDIN.read(content_length)
            message_json = json.loads(message_text)
            our_user_input = message_json["result"]["userInput"]
            return our_user_input
    except Exception:
        print_log(traceback.format_exc())


# Set input to our custom input
USER_GLOBALS["input"] = custom_input
input = custom_input


def handle_response(request_id):
    while not STDIN.closed:
        try:
            headers = get_headers()
            content_length = int(headers.get("Content-Length", 0))

            if content_length:
                message_text = STDIN.read(content_length)
                message_json = json.loads(message_text)
                our_user_input = message_json["result"]["userInput"]
                if message_json["id"] == request_id:
                    send_response(our_user_input, message_json["id"])
                elif message_json["method"] == "exit":
                    sys.exit(0)

        except Exception:
            print_log(traceback.format_exc())


def exec_function(user_input):
    try:
        compile(user_input, "<stdin>", "eval")
    except SyntaxError:
        return exec
    return eval


def check_valid_command(request):
    try:
        user_input = request["params"]
        ast.parse(user_input[0])
        send_response("True", request["id"])
    except SyntaxError:
        send_response("False", request["id"])


def execute(request, user_globals):
    str_output = CustomIO("<stdout>", encoding="utf-8")
    str_error = CustomIO("<stderr>", encoding="utf-8")

    with redirect_io("stdout", str_output):
        with redirect_io("stderr", str_error):
            str_input = CustomIO("<stdin>", encoding="utf-8", newline="\n")
            with redirect_io("stdin", str_input):
                exec_user_input(request["params"], user_globals)
    send_response(str_output.get_value(), request["id"])


def exec_user_input(user_input, user_globals):
    user_input = user_input[0] if isinstance(user_input, list) else user_input

    try:
        callable = exec_function(user_input)
        retval = callable(user_input, user_globals)
        if retval is not None:
            print(retval)
    except KeyboardInterrupt:
        print(traceback.format_exc())
    except Exception:
        print(traceback.format_exc())


class CustomIO(io.TextIOWrapper):
    """Custom stream object to replace stdio."""

    def __init__(self, name, encoding="utf-8", newline=None):
        self._buffer = io.BytesIO()
        self._custom_name = name
        super().__init__(self._buffer, encoding=encoding, newline=newline)

    def close(self):
        """Provide this close method which is used by some tools."""
        # This is intentionally empty.

    def get_value(self) -> str:
        """Returns value from the buffer as string."""
        self.seek(0)
        return self.read()


@contextlib.contextmanager
def redirect_io(stream: str, new_stream):
    """Redirect stdio streams to a custom stream."""
    old_stream = getattr(sys, stream)
    setattr(sys, stream, new_stream)
    yield
    setattr(sys, stream, old_stream)


def get_headers():
    headers = {}
    while line := STDIN.readline().strip():
        name, value = line.split(":", 1)
        headers[name] = value.strip()
    return headers


if __name__ == "__main__":
    while not STDIN.closed:
        try:
            headers = get_headers()
            content_length = int(headers.get("Content-Length", 0))

            if content_length:
                request_text = STDIN.read(content_length)
                request_json = json.loads(request_text)
                if request_json["method"] == "execute":
                    execute(request_json, USER_GLOBALS)
                if request_json["method"] == "check_valid_command":
                    check_valid_command(request_json)
                elif request_json["method"] == "exit":
                    sys.exit(0)

        except Exception:
            print_log(traceback.format_exc())
