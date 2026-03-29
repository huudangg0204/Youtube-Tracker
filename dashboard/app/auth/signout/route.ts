import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  
  const requestUrl = new URL(request.url)
  const host = request.headers.get('host') || requestUrl.host
  const protocol = request.headers.get('x-forwarded-proto') || requestUrl.protocol
  const baseUrl = `${protocol.replace(':', '')}://${host}`
  
  const url = new URL('/login', baseUrl)
  return NextResponse.redirect(url, { status: 302 })
}
