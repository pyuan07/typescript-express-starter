import { z } from 'zod';
import { password, email } from './custom.validation';

const register = {
  body: z.object({
    email: email,
    password: password,
    name: z.string().min(1, 'name is required'),
  }),
};

const login = {
  body: z.object({
    email: z.string().min(1, 'email is required'),
    password: z.string().min(1, 'password is required'),
  }),
};

const logout = {
  body: z.object({
    refreshToken: z.string().min(1, 'refreshToken is required'),
  }),
};

const refreshTokens = {
  body: z.object({
    refreshToken: z.string().min(1, 'refreshToken is required'),
  }),
};

const forgotPassword = {
  body: z.object({
    email: email,
  }),
};

const resetPassword = {
  query: z.object({
    token: z.string().min(1, 'token is required'),
  }),
  body: z.object({
    password: password,
  }),
};

const verifyEmail = {
  query: z.object({
    token: z.string().min(1, 'token is required'),
  }),
};

export { register, login, logout, refreshTokens, forgotPassword, resetPassword, verifyEmail };
