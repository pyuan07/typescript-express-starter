import httpStatus from 'http-status';
import { Request, Response } from 'express';
// Removed pick import - using destructuring instead
import ApiError from '../utils/ApiError';
import catchAsync from '../utils/catchAsync';
import { userService } from '../services';

interface QueryParams {
  [key: string]: unknown;
  sortBy?: string;
  limit?: string;
  page?: string;
}

const createUser = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.createUser(req.body);
  res.status(httpStatus.CREATED).send(user);
});

const getUsers = catchAsync(async (req: Request, res: Response) => {
  // Modern approach: direct destructuring - cleaner and more performant
  const { name, role } = req.query;
  const filter = { name, role } as Record<string, string | undefined>;

  const { sortBy, limit, page } = req.query as QueryParams;
  // Filter out undefined values for strict TypeScript compliance
  const options: { sortBy?: string; limit?: string; page?: string } = {};
  if (sortBy !== undefined) options.sortBy = sortBy;
  if (limit !== undefined) options.limit = limit;
  if (page !== undefined) options.page = page;

  const result = await userService.queryUsers(filter, options);
  res.send(result);
});

const getUser = catchAsync(async (req: Request, res: Response) => {
  if (!req.params.userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User ID is required');
  }
  const user = await userService.getUserById(req.params.userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  res.send(user);
});

const updateUser = catchAsync(async (req: Request, res: Response) => {
  if (!req.params.userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User ID is required');
  }
  const user = await userService.updateUserById(req.params.userId, req.body);
  res.send(user);
});

const deleteUser = catchAsync(async (req: Request, res: Response) => {
  if (!req.params.userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User ID is required');
  }
  await userService.deleteUserById(req.params.userId);
  res.status(httpStatus.NO_CONTENT).send();
});

export { createUser, getUsers, getUser, updateUser, deleteUser };
