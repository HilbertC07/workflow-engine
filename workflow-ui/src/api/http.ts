import axios from 'axios'
import { ElMessage } from 'element-plus'
import type { R } from '@/types/workflow'

/**
 * axios 封装：统一解 R<T>。
 * code === 0 时直接返回 data；code !== 0 时 ElMessage.error(msg) 并 reject。
 */
/**
 * 后端地址。
 * 前端是独立 Vite 工程（5173），后端 Spring Boot（8080），两边不同源。
 * 后端已通过 config/CorsConfig 放行 http://localhost:5173，所以这里直连绝对地址。
 * 部署到别的环境时只改这一处即可。
 */
const API_BASE_URL = 'http://localhost:8080'

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

http.interceptors.response.use(
  (resp) => {
    const r = resp.data as R<unknown>
    if (r && typeof r === 'object' && 'code' in r) {
      if (r.code !== 0) {
        ElMessage.error(r.msg || '操作失败')
        return Promise.reject(new Error(r.msg || '操作失败'))
      }
      return r.data as never
    }
    return resp.data
  },
  (error) => {
    const msg = error?.response?.data?.msg || error?.message || '网络请求失败'
    ElMessage.error(msg)
    return Promise.reject(error)
  },
)

export default http
