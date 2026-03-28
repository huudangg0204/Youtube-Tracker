import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { createClient } from '@/lib/supabase/client'

export const useSocket = (userId?: string) => {
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    if (!userId) return

    let socketInstance: Socket | null = null;

    const initSocket = async () => {
      // Lấy Token JWT từ Supabase Client để vượt qua Middleware của Backend
      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token

      if (!token) return

      const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
      socketInstance = io(socketUrl, {
        transports: ['websocket'],
        auth: { token }
      })

      socketInstance.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message)
      })

      setSocket(socketInstance)
    }

    initSocket()

    return () => {
      if (socketInstance) {
        socketInstance.disconnect()
      }
    }
  }, [userId])

  return socket
}
