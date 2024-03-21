import os
import sys

# Add the lib path to our sys path so jedi_language_server can find its references
EXTENSION_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(EXTENSION_ROOT, "python_files", "lib", "jedilsp"))


from jedi_language_server.cli import cli  # noqa: E402

sys.exit(cli())
