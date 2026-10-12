export const ok = (res, data, statusCode = 200) =>
  res.status(statusCode).json({ success: true, data });

export const created = (res, data) => ok(res, data, 201);

export const fail = (res, statusCode, message, details = undefined) =>
  res.status(statusCode).json({ success: false, message, ...(details ? { details } : {}) });
