import ApiError from '../../../src/utils/ApiError';
import httpStatus from 'http-status';

describe('ApiError', () => {
  test('should create an ApiError with message and status code', () => {
    const statusCode = httpStatus.BAD_REQUEST;
    const message = 'Bad request error';
    const apiError = new ApiError(statusCode, message);

    expect(apiError.statusCode).toBe(statusCode);
    expect(apiError.message).toBe(message);
    expect(apiError.isOperational).toBe(true);
    expect(apiError).toBeInstanceOf(Error);
  });

  test('should create an ApiError with default isOperational as true', () => {
    const apiError = new ApiError(httpStatus.NOT_FOUND, 'Not found');

    expect(apiError.isOperational).toBe(true);
  });

  test('should create an ApiError with custom isOperational value', () => {
    const apiError = new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Server error', false);

    expect(apiError.isOperational).toBe(false);
  });

  test('should have proper error stack trace', () => {
    const apiError = new ApiError(httpStatus.BAD_REQUEST, 'Test error');

    expect(apiError.stack).toBeDefined();
  });
});
