import { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { MusicIcon } from 'lucide-react'
import SyncToken from '@/components/SyncToken'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <SyncToken token={session.access_token} />
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <MusicIcon className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Youtube Tracker</h1>
        </div>
        
        <div className="flex items-center gap-6">
          <span className="text-sm font-medium text-slate-600">{session.user.email}</span>
          <form action="/auth/signout" method="post">
            <Button type="submit" className="bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm rounded-full px-5">
              Sign Out
            </Button>
          </form>
        </div>
      </nav>
      
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 animate-in fade-in duration-500">
        {children}
      </main>
    </div>
  )
}
