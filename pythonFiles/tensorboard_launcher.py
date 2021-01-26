import time
import sys
from tensorboard import default
from tensorboard import program


def main(logdir):
    tb = program.TensorBoard(
        default.get_plugins(),
        program.get_default_assets_zip_provider(),
    )
    tb.configure(bind_all=False, logdir=logdir)
    url = tb.launch()
    sys.stdout.write("TensorBoard started at %s\n" % (url))
    sys.stdout.flush()
    while True:
        try:
            time.sleep(60)
        except KeyboardInterrupt:
            break
    sys.stdout.write("TensorBoard is shutting down")
    sys.stdout.flush()


if __name__ == "__main__":
    if len(sys.argv) == 2:
        logdir = str(sys.argv[1])
        sys.stdout.write("Starting TensorBoard with logdir %s" % (logdir))
        main(logdir)
