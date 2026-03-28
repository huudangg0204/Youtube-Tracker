import axios from 'axios'
import { createClient } from './supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

export const api = axios.create({
  baseURL: API_URL,
})

// Add an interceptor to insert the Supabase JWT token
api.interceptors.request.use(async (config) => {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  
  return config
}, (error) => {
  return Promise.reject(error)
})

export const fetchHistory = async () => {
  try {
    const res = await api.get('/history')
    return res.data
  } catch (error: any) {
    if (error.response?.data?.message) {
      console.error("[Backend /history Error]:", error.response.data.message);
      throw new Error(error.response.data.message);
    }
    throw error;
  }
}

export const fetchStats = async () => {
  try {
    const res = await api.get('/stats')
    return res.data
  } catch (error: any) {
    if (error.response?.data?.message) {
      console.error("[Backend /stats Error]:", error.response.data.message);
      throw new Error(error.response.data.message);
    }
    throw error;
  }
}

export const fetchDailyHistory = async (date: string) => {
  try {
    const res = await api.get(`/history/daily?date=${date}`)
    return res.data
  } catch (error: any) {
    if (error.response?.data?.message) {
      console.error("[Backend /history/daily Error]:", error.response.data.message);
      throw new Error(error.response.data.message);
    }
    throw error;
  }
}

export const fetchRecommend = async () => {
  try {
    const res = await api.get('/recommend')
    return res.data
  } catch (error: any) {
    if (error.response?.data?.message) {
      console.error("[Backend /recommend Error]:", error.response.data.message);
      throw new Error(error.response.data.message);
    }
    throw error;
  }
}
