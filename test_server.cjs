const { spawn } = require('child_process');
const child = spawn('npm', ['run', 'dev'], { cwd: '/app/applet' });
child.stdout.on('data', data => console.log(data.toString()));
child.stderr.on('data', data => console.error(data.toString()));
setTimeout(() => child.kill(), 10000);
