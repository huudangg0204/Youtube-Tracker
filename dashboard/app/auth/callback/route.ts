import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  
  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }
  
  const host = request.headers.get('host') || requestUrl.host
  const protocol = request.headers.get('x-forwarded-proto') || requestUrl.protocol
  const baseUrl = `${protocol.replace(':', '')}://${host}`
  
  return NextResponse.redirect(`${baseUrl}/dashboard`)
}
