export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  msg: string;
}

export function successResponse<T>(data: T, msg = 'success'): ApiResponse<T> {
  return { code: 0, data, msg };
}

export function errorResponse(msg: string, code = 1): ApiResponse<null> {
  return { code, data: null, msg };
}
