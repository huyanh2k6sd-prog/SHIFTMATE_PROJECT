-- =====================================================
-- FIX: Allow users to delete their own roles and workspace memberships
-- This enables the "Leave Workspace" feature to work correctly 
-- and allows users to re-join and request access again.
-- =====================================================

-- Allow users to delete their own role requests/assignments
CREATE POLICY "Users can delete own user_roles" ON public.user_roles 
    FOR DELETE USING (auth.uid() = user_id);

-- Allow users to delete their own workspace membership
CREATE POLICY "Users can delete own workspace_members" ON public.workspace_members 
    FOR DELETE USING (auth.uid() = user_id);
