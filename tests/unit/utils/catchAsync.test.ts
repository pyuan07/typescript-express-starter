import { Request, Response, NextFunction } from 'express';
import catchAsync from '../../../src/utils/catchAsync';

describe('catchAsync', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {};
    mockRes = {};
    mockNext = jest.fn();
  });

  test('should call the async function and not call next on success', async () => {
    const asyncFn = jest.fn().mockResolvedValue(undefined);
    const wrappedFn = catchAsync(asyncFn);

    await wrappedFn(mockReq as Request, mockRes as Response, mockNext);

    expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('should call next with error when async function rejects', async () => {
    const error = new Error('Test error');
    const asyncFn = jest.fn().mockRejectedValue(error);
    const wrappedFn = catchAsync(asyncFn);

    await wrappedFn(mockReq as Request, mockRes as Response, mockNext);

    expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(error);
  });

  test('should call next with error when async function throws', async () => {
    const error = new Error('Thrown error');
    const asyncFn = jest.fn().mockImplementation(async () => {
      throw error;
    });
    const wrappedFn = catchAsync(asyncFn);

    await wrappedFn(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });
});
