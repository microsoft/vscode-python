import os
import time
import sys
import tensorboard


def main(logdir):
    tb = tensorboard.program.TensorBoard()
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
