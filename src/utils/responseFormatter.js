// Standard API response formatter
const formatResponse = (success, data = null, message = null, error = null, pagination = null) => {
  const response = {
    success,
    timestamp: new Date().toISOString()
  };

  if (data !== null) response.data = data;
  if (message !== null) response.message = message;
  if (error !== null) response.error = error;
  if (pagination !== null) response.pagination = pagination;

  return response;
};

// Success response helper
const successResponse = (data, message = null, pagination = null) => {
  return formatResponse(true, data, message, null, pagination);
};

// Error response helper
const errorResponse = (error, message = null) => {
  return formatResponse(false, null, message, error);
};

// Paginated response helper
const paginatedResponse = (data, pagination, message = null) => {
  return formatResponse(true, data, message, null, pagination);
};

module.exports = {
  formatResponse,
  successResponse,
  errorResponse,
  paginatedResponse
};
