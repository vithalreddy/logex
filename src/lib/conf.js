import process from 'node:process';

function getOrDefualt(key, _default) {
  return process.env[key] ?? _default;
}

export const HTTP_HOST = getOrDefualt('HOST', '0.0.0.0');
export const HTTP_PORT = parseInt(getOrDefualt('PORT', 5000));

export const LOG_FILE_PATH = getOrDefualt('LOG_FILE_PATH', 'data/log_file.txt');
export const LOG_FILE_LINE_MAX_LENGTH = parseInt(
  getOrDefualt('LOG_FILE_LINE_MAX_LENGTH', '256'),
);
