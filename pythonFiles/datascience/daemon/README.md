# Sample usage in node.js

```javascript
const cp  = require('child_process');
const rpc = require('vscode-jsonrpc');
const env = {
    PYTHONUNBUFFERED: '1',
    PYTHONPATH: '<extension dir>/pythonFiles:<extension dir>/pythonFiles/lib/python'
}
const childProcess = cp.spawn('<fully qualifieid python path>', ['-m', 'datascience.daemon', '-v', '--log-file=log.log'], {env});
const connection = rpc.createMessageConnection(new rpc.StreamMessageReader(childProcess.stdout),new rpc.StreamMessageWriter(childProcess.stdin));

connection.onClose(() => console.error('Closed'));
connection.onError(ex => console.error(ex));
connection.onDispose(() => console.error('disposed'));
connection.onNotification((e, data) => console.log(`Notification from daemon, such as stdout/stderr, ${JSON.stringify(data)}`);
connection.onUnhandledNotification(e => console.error(e));

// Start
connection.listen();

const pingRequest = new rpc.RequestType('ping');
connection.sendRequest(pingRequest, {data: 'one₹😄'})
	.then(response => console.log(`Pong received ${JSON.stringify(response)}`),	ex => console.error(ex));
```
