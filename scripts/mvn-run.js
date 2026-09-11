const { spawn, spawnSync } = require('child_process');
const path = require('path');

const JAVA_HOME = 'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.20.101-hotspot';
const MVN = 'C:\\apache-maven-3.9.16\\bin\\mvn.cmd';
const CWD = 'C:\\dev\\workflow-engine';

const env = { ...process.env, JAVA_HOME, PATH: `${JAVA_HOME}\\bin;C:\\apache-maven-3.9.16\\bin;${process.env.PATH}` };

const mode = process.argv[2] || 'version';
const args = process.argv.slice(3);

if (mode === 'version') {
  const r = spawnSync(MVN, ['-v'], { encoding: 'utf8', env, cwd: CWD, shell: true });
  console.log('exit=' + r.status);
  console.log(r.stdout || '');
  console.log(r.stderr || '');
  process.exit(r.status ?? 1);
}

// 启动 spring-boot:run，输出写到日志文件
const fs = require('fs');
const logPath = path.join(__dirname, 'spring-boot-run.log');
const log = fs.createWriteStream(logPath, { flags: 'w' });
const child = spawn(MVN, args.length ? args : ['-B', 'spring-boot:run'], {
  env, cwd: CWD, shell: true, detached: true, stdio: ['ignore', 'pipe', 'pipe']
});
child.stdout.on('data', d => { process.stdout.write(d); log.write(d); });
child.stderr.on('data', d => { process.stderr.write(d); log.write(d); });
child.on('exit', c => { log.end('\nEXIT ' + c); process.exit(c ?? 0); });
