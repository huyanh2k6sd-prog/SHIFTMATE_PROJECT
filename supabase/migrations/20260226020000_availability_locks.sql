-- =====================================================
-- AVAILABILITY LOCKS (Track 5-day cooldown per week)
-- =====================================================
CREATE TABLE public.availability_locks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    locked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, week_start_date)
);

ALTER TABLE public.availability_locks ENABLE ROW LEVEL SECURITY;

-- USERS: Can insert/update their own locks
CREATE POLICY "Users can manage own availability locks" ON public.availability_locks FOR ALL USING (auth.uid() = user_id);

-- MANAGERS: Can view employee locks to understand why they can't change schedules
CREATE POLICY "Managers can view availability locks" ON public.availability_locks FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.is_manager = TRUE AND ur.status = 'approved'
    )
    OR EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.owner_id = auth.uid()
    )
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.availability_locks;
