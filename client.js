const cp  = require('child_process');
const rpc = require('vscode-jsonrpc');

const env = {
    PYTHONUNBUFFERED: '1',
    PYTHONPATH: '/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/pythonFiles:/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/pythonFiles/lib/python:/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/pythonFiles/lib/python2x'
}
let childProcess = cp.spawn('/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/.venv/bin/python', ['-m', 'datascience.daemon', '--daemon-module=datascience.jupyter_daemon', '-v', '--log-file=/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/h.log'], {env});
// let childProcess = cp.spawn('/usr/bin/python', ['-m', 'datascience.daemon', '--daemon-module=datascience.jupyter_daemon'], {env});
// let childProcess = cp.spawn('/usr/bin/python', ['-m', 'datascience.daemon'], {env});
childProcess.stdout.on('data', d => console.log(d.toString()));
childProcess.stderr.on('data', d => console.error(d.toString()));
childProcess.on('error', d => console.error(d.toString()));

// Use stdin and stdout for communication:
let connection = rpc.createMessageConnection(
	new rpc.StreamMessageReader(childProcess.stdout),
	new rpc.StreamMessageWriter(childProcess.stdin),

);

let notification = new rpc.NotificationType('initialize');

connection.onClose(() => console.error('Closed'));
connection.onError(ex => console.error(ex));
connection.onDispose(() => console.error('disposed'));
connection.onNotification((e, data) => {
	if (e === 'output'){
		if (data.category === 'stdout'){
			console.info(`stdout: ${data.output}`);
		} else {
			console.error(`stderror: ${data.output}`);
		}
    } else {
        console.error(`Unhandled Notification ${e}`);
    }
});
connection.onUnhandledNotification(e => {
	console.error(e);
});

connection.listen();

// connection.sendRequest(notification)
// 	.then(response => {
// 		console.log(response);
// 	},
// 	ex => {
// 		console.error(ex);
// 	});

// const moduleRequest = new rpc.NotificationType('does_module_exist')
// connection.sendRequest(moduleRequest, {module_name: 'one₹😄'})
// 	.then(response => {
// 		console.log(`Does module exist ${JSON.stringify(response)}`);
// 	},
// 	ex => {
// 		console.error(ex);
// 	});

// connection.sendRequest(new rpc.NotificationType('get_interpreter_information'))
// 	.then(response => {
// 		console.log(response);
// 	},
// 	ex => {
// 		console.error(ex);
// 	});

// connection.sendRequest(new rpc.NotificationType('get_executable'))
// 	.then(response => {
// 		console.log(response);
// 	},
// 	ex => {
// 		console.error(ex);
// 	});

connection.sendRequest(new rpc.NotificationType('exec_file_observable'), {file_name:'/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/pythonFiles/interpreterInfo.py', args:[]})
	.then(response => {
        console.log('exec');
		console.log(response);
	}, ()=> {});
connection.dispose();
// connection.sendRequest(new rpc.NotificationType('exec_module'), {module_name: 'pip', args:['--version']})
// 	.then(response => {
//         console.log('exec_module');
// 		console.log(response);
// 	},
// 	ex => {
// 		console.error(ex);
// 	});
// connection.sendRequest(new rpc.NotificationType('exec_module'), {module_name: 'jupyter', args:['--version']})
// 	.then(response => {
//         console.log(`exec_module jupyter ${JSON.stringify(response)}`);
// 	},
// 	ex => {
// 		console.error(ex);
// 	});
// connection.sendRequest(new rpc.NotificationType('exec_module'), {module_name: 'jupyter', args:['notebook', '--version']})
// 	.then(response => {
//         console.log(`exec_module jupyter ${JSON.stringify(response)}`);
// 	},
// 	ex => {
// 		console.error(ex);
// 	});

// connection.sendRequest(new rpc.NotificationType('exec_module'), {module_name: 'jupyter234', args:['ipykernel', '-2-version']})
// 	.then(response => {
//         console.log(`exec_module jupyter111 ${JSON.stringify(response)}`);
// 	},
// 	ex => {
// 		console.error(ex);
// 	});

// function noop(){}
// setTimeout(()=> {
//     connection.sendRequest(new rpc.NotificationType('exit')).then(noop, noop);
//     connection.dispose();
// }, 5000)
// const helloRequest = new rpc.NotificationType('hello')
// connection.sendRequest(helloRequest, {rootUri: 'Hello-one₹😄'})
// 	.then(response => {
// 		console.log(response);
// 	},
// 	ex => {
// 		console.error(ex);
// 	});
// // connection.dispose()
