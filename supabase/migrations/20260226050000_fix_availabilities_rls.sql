-- Fix RLS policy for availabilities so managers can view them even if they are not approved for the specific role
DROP POLICY IF EXISTS "Managers can view availabilities" ON public.availabilities;

CREATE POLICY "Managers can view availabilities" ON public.availabilities FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.role_id = availabilities.role_id 
          AND ur.user_id = auth.uid() 
          AND ur.is_manager = TRUE 
          AND ur.status = 'approved'
    )
    OR 
    EXISTS (
        SELECT 1 FROM public.roles r
        JOIN public.workspace_members wm ON r.workspace_id = wm.workspace_id
        WHERE r.id = availabilities.role_id 
          AND wm.user_id = auth.uid()
          AND wm.role IN ('manager', 'MANAGER')
    )
);
