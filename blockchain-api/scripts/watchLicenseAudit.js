const fs = require('fs');
const path = require('path');
const util = require('util');

const LOG_DIR = path.resolve(
  __dirname,
  '../logs/license-audit'
);

/* ANSI COLORS */
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m'
};

function pad(value) {
  return String(value)
    .padStart(2, '0');
}

function currentDate() {
  const d = new Date();

  return (
    `${d.getFullYear()}-` +
    `${pad(d.getMonth() + 1)}-` +
    `${pad(d.getDate())}`
  );
}

const args =
  process.argv.slice(2);

const errorsOnly =
  args.includes('--errors');

const search =
  args
    .filter(
      value =>
        value !== '--errors'
    )
    .join(' ')
    .toLowerCase();

function statusColor(record) {

  if (
    record.status === 'SUCCESS'
  ) {
    return C.brightGreen;
  }

  if (
    record.status === 'FAILED' ||
    record.level === 'WARN'
  ) {
    return C.brightYellow;
  }

  if (
    record.status === 'ERROR' ||
    record.level === 'ERROR'
  ) {
    return C.brightRed;
  }

  return C.white;
}

function eventColor(event) {

  if (
    event.includes('WALLET')
  ) {
    return C.brightMagenta;
  }

  if (
    event.includes('LOGIN')
  ) {
    return C.brightCyan;
  }

  if (
    event.includes('RECOVERY')
  ) {
    return C.brightBlue;
  }

  if (
    event.includes('PASSWORD')
  ) {
    return C.brightYellow;
  }

  if (
    event === 'HTTP_REQUEST'
  ) {
    return C.cyan;
  }

  if (
    event.includes('BLOCKCHAIN')
  ) {
    return C.green;
  }

  return C.white;
}

function render(record) {

  if (errorsOnly) {
    if (
      record.status !== 'FAILED' &&
      record.status !== 'ERROR' &&
      record.level !== 'ERROR' &&
      record.level !== 'WARN'
    ) {
      return;
    }
  }

  if (search) {
    const raw =
      JSON.stringify(record)
        .toLowerCase();

    if (!raw.includes(search)) {
      return;
    }
  }

  const sColor =
    statusColor(record);

  const eColor =
    eventColor(
      String(record.event || '')
    );

  let symbol = '●';

  if (
    record.status === 'SUCCESS'
  ) {
    symbol = '✔';
  }

  if (
    record.status === 'FAILED'
  ) {
    symbol = '⚠';
  }

  if (
    record.status === 'ERROR'
  ) {
    symbol = '✖';
  }

  console.log(
    '\n' +
    C.dim +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' +
    C.reset
  );

  console.log(
    `${C.bold}${record.timestamp}${C.reset}  ` +
    `${sColor}${symbol} ${record.status}${C.reset}  ` +
    `${eColor}${C.bold}${record.event}${C.reset}`
  );

  const details = {
    ...record
  };

  delete details.timestamp;
  delete details.level;
  delete details.event;
  delete details.status;

  console.log(
    util.inspect(
      details,
      {
        colors: true,
        depth: null,
        compact: false,
        breakLength: 130
      }
    )
  );
}

let currentFile = null;
let offset = 0;
let remainder = '';
let firstRead = true;

function poll() {

  const nextFile =
    path.join(
      LOG_DIR,
      `blockchain-license-${currentDate()}.log`
    );

  if (
    currentFile !== nextFile
  ) {
    currentFile = nextFile;
    offset = 0;
    remainder = '';
    firstRead = true;

    console.clear();

    console.log(
      `${C.brightCyan}${C.bold}` +
      '╔══════════════════════════════════════════════════════════════╗\n' +
      '║          BLOCKCHAIN LICENSE LIVE AUDIT MONITOR             ║\n' +
      '╚══════════════════════════════════════════════════════════════╝' +
      `${C.reset}`
    );

    console.log(
      `${C.dim}File: ${currentFile}${C.reset}`
    );

    console.log(
      `${C.dim}Ctrl+C to stop monitoring${C.reset}`
    );
  }

  if (
    !fs.existsSync(currentFile)
  ) {
    return;
  }

  const stat =
    fs.statSync(currentFile);

  if (
    firstRead &&
    stat.size > 200000
  ) {
    offset =
      stat.size - 200000;
  }

  firstRead = false;

  if (
    stat.size < offset
  ) {
    offset = 0;
  }

  if (
    stat.size === offset
  ) {
    return;
  }

  const length =
    stat.size - offset;

  const buffer =
    Buffer.alloc(length);

  const fd =
    fs.openSync(
      currentFile,
      'r'
    );

  fs.readSync(
    fd,
    buffer,
    0,
    length,
    offset
  );

  fs.closeSync(fd);

  offset =
    stat.size;

  const text =
    remainder +
    buffer.toString('utf8');

  const lines =
    text.split('\n');

  remainder =
    lines.pop() || '';

  for (const line of lines) {

    if (!line.trim()) {
      continue;
    }

    try {
      render(
        JSON.parse(line)
      );
    } catch {
      console.log(
        `${C.red}${line}${C.reset}`
      );
    }
  }
}

setInterval(
  poll,
  400
);

poll();
