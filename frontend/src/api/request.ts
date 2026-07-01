import http from './http';
import type { ApiResponse } from '../types/request';

export function get<T>(url: string, config?: ApiResponse) {
  return http.get<T>(url, config).then((res) => res.data);
}
export function post<T>(url: string, data?: unknown, config?: ApiResponse) {
  return http.post<T>(url, data, config).then((res) => res.data);
}
export function patch<T>(url: string, data?: unknown, config?: ApiResponse) {
  return http.patch<T>(url, data, config).then((res) => res.data);
}
export function del<T>(url: string, config?: ApiResponse) {
  return http.delete<T>(url, config).then((res) => res.data);
}