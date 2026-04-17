-- Unified Database Schema Initialization for YouTube Tracker
-- Run this script in the Supabase SQL Editor to set up all required tables.
-- The track_metadata table is optimized for Last.fm & ReccoBeats integration.

-- ==========================================
-- 1. VIDEOS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.videos (
    video_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT,
    category_id TEXT,
    category_name TEXT,
    duration_iso TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS Policies for videos
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert to videos"
ON public.videos FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public select videos"
ON public.videos FOR SELECT TO public USING (true);

-- ==========================================
-- 2. TRACK METADATA TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.track_metadata (
    video_id TEXT PRIMARY KEY REFERENCES public.videos(video_id),

    -- Enriched data
    artist_name TEXT,           
    album_name TEXT,            
    genres JSONB DEFAULT '[]',  
    mood TEXT,                  
    language TEXT,              
    audio_features JSONB DEFAULT NULL,

    -- Quality tracking
    match_confidence FLOAT,    
    matched_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

COMMENT ON COLUMN public.track_metadata.audio_features IS
  'Raw audio features từ ReccoBeats: {valence, energy, danceability, acousticness, instrumentalness, speechiness, liveness, loudness, tempo, key, mode}';

-- RLS Policies for track_metadata
ALTER TABLE public.track_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert to track_metadata"
ON public.track_metadata FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public select track_metadata"
ON public.track_metadata FOR SELECT TO public USING (true);

CREATE POLICY "Allow public update track_metadata"
ON public.track_metadata FOR UPDATE TO public USING (true);

-- ==========================================
-- 3. WEEKLY INSIGHTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.weekly_insights (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    week_start DATE NOT NULL,       
    week_end DATE NOT NULL,         
    summary_json JSONB NOT NULL,    
    wrapped_text TEXT NOT NULL,      
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),

    UNIQUE(user_id, week_start)     
);

-- RLS Policies for weekly_insights
ALTER TABLE public.weekly_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert to weekly_insights"
ON public.weekly_insights FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public select weekly_insights"
ON public.weekly_insights FOR SELECT TO public USING (true);
