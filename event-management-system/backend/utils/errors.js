const DUPLICATE_KEY_CODE = 11000;

// Turns a low-level driver/Mongoose error into a client-safe status + message.
// Returns null when the error is not something we can describe to the caller.
function describeError(err) {
  if (!err) return null;
  if (err.name === 'CastError') {
    return { status: 400, message: err.path === '_id' ? 'That id is not valid.' : `The value provided for "${err.path}" is not valid.` };
  }
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors || {}).map((item) => item.message).filter(Boolean).join(' ');
    return { status: 400, message: details || 'The submitted data is invalid.' };
  }
  if (err.code === DUPLICATE_KEY_CODE) {
    return { status: 409, message: 'That record already exists.' };
  }
  return null;
}

function isDuplicateKeyError(err) {
  return !!err && err.code === DUPLICATE_KEY_CODE;
}

function logError(context, err) {
  console.error(`[${context}]`, err instanceof Error ? err.stack || err.message : err);
}

// Single exit point for failed requests: the error always reaches the server
// log, and the client gets a stable message instead of internal details.
function sendError(res, context, err, message, status = 500) {
  const described = describeError(err);
  const responseStatus = described ? described.status : status;

  if (responseStatus >= 500) {
    logError(context, err);
  } else {
    console.warn(`[${context}] ${responseStatus}:`, err instanceof Error ? err.message : err);
  }

  if (res.headersSent) return;
  res.status(responseStatus).json({ message: described ? described.message : message });
}

module.exports = { describeError, isDuplicateKeyError, logError, sendError };
