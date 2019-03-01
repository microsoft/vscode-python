import json


def report_discovered(tests, debug=False,
               _send=print):
    """Serialize the discovered tests and write to stdout."""
    data = [{
            'id': test.id,
            'name': test.name,
            'testroot': test.path.root,
            'relfile': test.path.relfile,
            'lineno': test.lineno,
            'testfunc': test.path.func,
            'subtest': test.path.sub or None,
            'markers': test.markers or None,
            } for test in tests]
    kwargs = {}
    if debug:
        # human-formatted
        kwargs = dict(
            sort_keys=True,
            indent=4,
            separators=(',', ': '),
            )
    serialized = json.dumps(data, **kwargs)
    _send(serialized)
