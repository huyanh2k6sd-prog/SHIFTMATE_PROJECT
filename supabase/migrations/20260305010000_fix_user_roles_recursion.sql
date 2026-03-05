-- Create a security-definer function to check role-level manager status
-- This avoids infinite recursion in RLS policies by bypassing policy checks for the subquery
CREATE OR REPLACE FUNCTION public.is_role_manager(p_role_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE role_id = p_role_id 
          AND user_id = p_user_id 
          AND is_manager = true 
          AND status = 'approved'
    );
END;
$$;

-- Drop the problematic recursive policies
DROP POLICY IF EXISTS "Managers can manage user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Workspace managers can manage user_roles" ON public.user_roles;

-- Create a consolidated, safe management policy
CREATE POLICY "Managers can manage user_roles" ON public.user_roles
AS PERMISSIVE FOR ALL
TO authenticated
USING (
    is_workspace_admin((SELECT workspace_id FROM public.roles WHERE id = role_id), auth.uid())
    OR
    is_role_manager(role_id, auth.uid())
);
