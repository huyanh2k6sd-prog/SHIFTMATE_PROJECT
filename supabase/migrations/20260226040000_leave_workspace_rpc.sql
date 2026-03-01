-- =====================================================
-- RPC: leave_workspace_completely
-- Fully wipes a user's data (shifts, availabilities, user_roles)
-- when they leave a workspace, leaving no lingering data.
-- =====================================================

CREATE OR REPLACE FUNCTION public.leave_workspace_completely(p_workspace_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 1. Delete user_roles
    DELETE FROM public.user_roles 
    WHERE user_id = v_user_id 
    AND role_id IN (SELECT id FROM public.roles WHERE workspace_id = p_workspace_id);

    -- 2. Delete availabilities
    DELETE FROM public.availabilities 
    WHERE user_id = v_user_id 
    AND role_id IN (SELECT id FROM public.roles WHERE workspace_id = p_workspace_id);

    -- 3. Delete assigned_shifts
    DELETE FROM public.assigned_shifts 
    WHERE user_id = v_user_id 
    AND shift_id IN (
        SELECT s.id FROM public.shifts s 
        JOIN public.roles r ON s.role_id = r.id 
        WHERE r.workspace_id = p_workspace_id
    );

    -- 4. Delete shift_requests (swap/absence requests made by the user)
    DELETE FROM public.shift_requests 
    WHERE requester_id = v_user_id 
    AND shift_id IN (
        SELECT s.id FROM public.shifts s 
        JOIN public.roles r ON s.role_id = r.id 
        WHERE r.workspace_id = p_workspace_id
    );

    -- 5. Reset shift requests where the user had accepted to cover a shift
    UPDATE public.shift_requests 
    SET accepted_by_user_id = NULL, status = 'pending_manager'
    WHERE accepted_by_user_id = v_user_id 
    AND shift_id IN (
        SELECT s.id FROM public.shifts s 
        JOIN public.roles r ON s.role_id = r.id 
        WHERE r.workspace_id = p_workspace_id
    );

    -- 6. Delete workspace_members
    DELETE FROM public.workspace_members 
    WHERE user_id = v_user_id 
    AND workspace_id = p_workspace_id;
END;
$$;
