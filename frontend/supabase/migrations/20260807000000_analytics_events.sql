-- Analytics events table: tracks landing page views and canvas interactions
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type  text        NOT NULL CHECK (event_type IN ('view', 'open_canvas')),
  referrer    text,
  source      text        NOT NULL DEFAULT 'direct',
  created_at  timestamptz DEFAULT now() NOT NULL
);

-- Only allow public (anon) to INSERT — raw rows with referrer URLs are not exposed publicly
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_events"
  ON public.analytics_events
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Expose a stripped-down view for anon reads (no referrer column — it may contain sensitive URL data)
CREATE OR REPLACE VIEW public.analytics_events_public
  WITH (security_invoker = false)
AS
  SELECT id, event_type, source, created_at
  FROM public.analytics_events;

-- Grant anon SELECT on the view only, not the raw table
GRANT SELECT ON public.analytics_events_public TO anon;

-- Index for fast time-range aggregation
CREATE INDEX analytics_events_created_at_idx ON public.analytics_events (created_at DESC);
CREATE INDEX analytics_events_type_idx       ON public.analytics_events (event_type);
CREATE INDEX analytics_events_source_idx     ON public.analytics_events (source);
