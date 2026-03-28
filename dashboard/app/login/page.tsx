"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    
    if (error) {
      setError(error.message);
    } else {
      router.push("/dashboard");
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 relative overflow-hidden">
      {/* Overlay background pattern / effect */}
      <div className="absolute inset-0 bg-black/20" />
      
      <Card className="w-[400px] z-10 bg-white/95 backdrop-blur-md shadow-2xl border-white/20 border relative rounded-2xl overflow-hidden">
        <CardHeader className="text-center pb-2 pt-8">
          <CardTitle className="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome Back</CardTitle>
          <p className="text-sm text-slate-600 font-medium mt-1">Sign in to your Youtube Tracker Dashboard</p>
        </CardHeader>
        <CardContent className="p-8 pt-6">
          <form onSubmit={handleEmailLogin} className="space-y-5">
            <div className="space-y-2 text-left">
              <Label htmlFor="email" className="text-slate-900 font-bold">Email Address</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="you@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-slate-300 text-slate-900 bg-white placeholder:text-slate-400 focus-visible:ring-indigo-500 h-10 shadow-sm"
              />
            </div>
            <div className="space-y-2 text-left">
              <Label htmlFor="password" className="text-slate-900 font-bold">Password</Label>
              <Input 
                id="password" 
                type="password" 
                value={password}
                placeholder="••••••••"
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-slate-300 text-slate-900 bg-white placeholder:text-slate-400 focus-visible:ring-indigo-500 h-10 shadow-sm"
              />
            </div>
            {error && <p className="text-red-600 bg-red-50 p-3 rounded-lg text-sm font-semibold border border-red-200">{error}</p>}
            <Button type="submit" className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base shadow-md transition-all" disabled={loading}>
              {loading ? "Signing in..." : "Sign In with Email"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-[1px] flex-1 bg-slate-200"></div>
            <span className="text-xs text-slate-500 font-black tracking-widest uppercase">Or continue with</span>
            <div className="h-[1px] flex-1 bg-slate-200"></div>
          </div>

          <Button 
            type="button" 
            className="w-full h-11 bg-white text-slate-800 border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 font-bold shadow-sm transition-all"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
