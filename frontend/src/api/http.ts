import axios from 'axios';
import { message } from 'antd';
import type { ApiResponse } from '../types/storyDemo';

const http = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

http.interceptors.response.use(
  (response) => {
    const res = response.data as ApiResponse;
    if (res.code !== 0) {
      message.error(res.msg || '请求失败');
      return Promise.reject(new Error(res.msg));
    }
    return response;
  },
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const msg =
        (error.response?.data as ApiResponse | undefined)?.msg ||
        error.message ||
        '网络错误';
      message.error(msg);
    } else {
      message.error('未知错误');
    }
    return Promise.reject(error);
  },
);

export default http;
