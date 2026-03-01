-- Fix notification RLS policy to allow cross-user notification inserts
-- (e.g., employee notifies manager, manager notifies employee back)

-- Drop the existing overly restrictive policy
DROP POLICY IF EXISTS "Users can manage own notifications" ON public.notifications;

-- Users can READ/UPDATE/DELETE only their own notifications
CREATE POLICY "Users can read own notifications" ON public.notifications 
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications 
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications" ON public.notifications 
    FOR DELETE USING (auth.uid() = user_id);

-- Any authenticated user can INSERT notifications for any user
-- (This allows employees to notify managers and vice versa)
CREATE POLICY "Authenticated users can insert notifications" ON public.notifications 
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Add role_approved and role_rejected to notification_type enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'role_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'role_rejected';
