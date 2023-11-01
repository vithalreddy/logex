export function sendStdResponse(res, data, status = 200, raw = false) {
  if (raw) {
    res.writeHead(status, { 'Content-Type': 'text/plain' });
    res.end(data);
  } else {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data }));
  }
}

export function isValidTimestamp(timestamp) {
  const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  return timestampRegex.test(timestamp);
}
