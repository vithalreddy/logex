import url from 'node:url';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import { promisify } from 'node:util';

import { isValidTimestamp, sendStdResponse } from './utils.js';
import { LOG_FILE_LINE_MAX_LENGTH, LOG_FILE_PATH } from './conf.js';

const fsRead = promisify(fs.read);

/**
 * Large File
 * Each line is fairly short (up to 256 bytes) and starts with a timestamp followed by some text.
 * Logs in time-range
 * Timestamps are unique, and that the log is in ascending order of timestamp.
 * Hint: fs.read() allows you to read from a particular position in the file.
 */

export class LogFileReader {
  static #fileStats = null;

  async getFileStats() {
    if (LogFileReader.#fileStats) return LogFileReader.#fileStats;
    const fileStats = await fsp.stat(LOG_FILE_PATH);
    LogFileReader.#fileStats = { size: fileStats.size };
    return LogFileReader.#fileStats;
  }

  async findLogPosition(fd, buffer, targetTimestamp) {
    if (!targetTimestamp) return 0;

    const fileStats = await this.getFileStats();

    let low = 0;
    let high = fileStats.size - 1;

    while (low <= high) {
      const mid = low + Math.floor((high - low) / 2);

      let lineStart = mid;
      //   console.log({ lineStart, mid, fileStats, low, high });
      while (lineStart > 0) {
        await fsRead(fd, buffer, 0, 1, lineStart - 1);
        // console.log('lineStart', lineStart, buffer.toString('utf8', 0, 1));
        if (buffer.toString('utf8', 0, 1) === '\n') break;
        lineStart--;
      }

      const { bytesRead } = await fsRead(
        fd,
        buffer,
        0,
        LOG_FILE_LINE_MAX_LENGTH,
        lineStart,
      );
      const line = buffer.toString('utf8', 0, bytesRead).split('\n')[0];
      const timestamp = line.split(' ')[0];

      if (timestamp < targetTimestamp) {
        low = mid + 1;
      } else if (timestamp > targetTimestamp) {
        high = mid - 1;
      } else {
        return lineStart;
      }
    }

    return null;
  }

  async readRows(
    fd,
    buffer,
    {
      startPosition,
      endTime,
      page = 1,
      pageSize = 100,
      skipPagination = false,
      streamRows,
      httpRes,
    } = {},
  ) {
    let currentPosition = startPosition;
    let result = [];
    let linesToSkip = 0;
    let linesToRead = Number.MAX_SAFE_INTEGER;

    if (!skipPagination) {
      linesToSkip = (page - 1) * pageSize;
      linesToRead = pageSize;
    }

    while (linesToRead > 0) {
      const { bytesRead } = await fsRead(
        fd,
        buffer,
        0,
        LOG_FILE_LINE_MAX_LENGTH,
        currentPosition,
      );

      if (bytesRead === 0) break; // EOF, End of file

      const chunk = buffer.toString('utf8', 0, bytesRead);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line) continue; // Skip empty lines

        if (endTime) {
          const timestamp = line.split(' ')[0];
          if (timestamp > endTime) return result.join('');
        }

        if (linesToSkip > 0) {
          linesToSkip--;
        } else if (linesToRead > 0) {
          if (streamRows) {
            httpRes.write(line + '\n');
          } else result.push(line + '\n');
          linesToRead--;
        } else {
          if (streamRows) {
            httpRes.end();
          }
          return result.join('');
        }
      }

      currentPosition += bytesRead;
    }

    return result.join('');
  }

  async query({
    startTime,
    endTime,
    page,
    pageSize,
    skipPagination,
    streamRows,
    httpRes,
  } = {}) {
    const fd = fs.openSync(LOG_FILE_PATH, 'r'); //file desc
    let buffer = Buffer.alloc(LOG_FILE_LINE_MAX_LENGTH);

    try {
      const startPosition = await this.findLogPosition(fd, buffer, startTime);

      if (startPosition === null) {
        return 'No Results found.';
      } else {
        return await this.readRows(fd, buffer, {
          startPosition,
          endTime,
          page,
          pageSize,
          skipPagination,
          streamRows,
          httpRes,
        });
      }
    } catch (error) {
      console.log({ error });
      return { error: 'Something went wrong, please try again', status: 500 };
    } finally {
      buffer = null;
      if (fd) fs.closeSync(fd);
    }
  }
}

export async function logsFileRouteHandler(req, res) {
  const { query } = url.parse(req.url, true);
  let {
    startTime,
    endTime,
    page = 1,
    pageSize = 100,
    skipPagination = false,
    streamRows = false,
  } = query;

  page = Number(page);
  pageSize = Number(pageSize);
  skipPagination = Boolean(skipPagination);
  streamRows = Boolean(streamRows);

  if (isNaN(page) || page < 1)
    return sendStdResponse(res, 'page number should be greater than 0', 400);

  if (isNaN(page) || pageSize > 500)
    return sendStdResponse(res, 'pageSize should be less than 500', 400);

  if (startTime && !isValidTimestamp(startTime))
    return sendStdResponse(
      res,
      'Invalid startTime format, Please use YYYY-MM-DDTHH:mm:ss.SSSZ format',
      400,
    );

  if (endTime && !isValidTimestamp(endTime))
    return sendStdResponse(
      res,
      'Invalid endTime format, Please use YYYY-MM-DDTHH:mm:ss.SSSZ format',
      400,
    );

  const result = await new LogFileReader().query({
    startTime,
    endTime,
    page,
    pageSize,
    skipPagination,
    streamRows,
    httpRes: streamRows === true ? res : null,
  });

  if (streamRows && !result.error) return;

  if (result.error)
    return sendStdResponse(res, result.error, result?.status || 500);

  sendStdResponse(res, result, 200, true);
}
