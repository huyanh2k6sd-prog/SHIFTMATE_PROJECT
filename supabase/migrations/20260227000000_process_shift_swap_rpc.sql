-- RPC: process_shift_swap
-- Handles both swap and absence coverage acceptance atomically.
-- Uses FOR UPDATE row lock to prevent concurrent accepts.
CREATE OR REPLACE FUNCTION process_shift_swap(p_request_id uuid, p_acceptor_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_req RECORD;
    v_acceptor_name text;
    v_requester_name text;
    v_shift_x_name text;
    v_shift_x_date date;
    v_shift_y_name text;
    v_shift_y_date date;
    v_workspace_id uuid;
    v_all_req_ids uuid[];
BEGIN
    -- 1. Get the shift request details and lock the row to prevent concurrent accepts
    SELECT * INTO v_req 
    FROM shift_requests 
    WHERE id = p_request_id
    FOR UPDATE;

    IF v_req IS NULL OR v_req.status = 'completed' THEN
        RETURN FALSE;
    END IF;

    -- Prevent requester from accepting their own swap request
    IF v_req.type = 'swap' AND v_req.requester_id = p_acceptor_id THEN
        RETURN FALSE;
    END IF;

    -- 2. Mark this request as completed
    UPDATE shift_requests 
    SET status = 'completed', accepted_by_user_id = p_acceptor_id 
    WHERE id = p_request_id;

    IF v_req.type = 'swap' THEN
        -- Find related requests (other offers for the same original shift from the same requester)
        SELECT array_agg(id) INTO v_all_req_ids 
        FROM shift_requests 
        WHERE shift_id = v_req.shift_id 
          AND requester_id = v_req.requester_id 
          AND type = 'swap' 
          AND id != p_request_id;

        IF v_all_req_ids IS NOT NULL THEN
            UPDATE shift_requests 
            SET status = 'completed', accepted_by_user_id = p_acceptor_id 
            WHERE id = ANY(v_all_req_ids);
            
            v_all_req_ids := array_append(v_all_req_ids, p_request_id);
        ELSE
            v_all_req_ids := ARRAY[p_request_id];
        END IF;

        -- Swap assignments
        DELETE FROM shift_assignments WHERE shift_id = v_req.shift_id AND user_id = v_req.requester_id;
        INSERT INTO shift_assignments (shift_id, user_id) VALUES (v_req.shift_id, p_acceptor_id);

        IF v_req.offered_shift_id IS NOT NULL THEN
            DELETE FROM shift_assignments WHERE shift_id = v_req.offered_shift_id AND user_id = p_acceptor_id;
            INSERT INTO shift_assignments (shift_id, user_id) VALUES (v_req.offered_shift_id, v_req.requester_id);
        END IF;

        -- Get user profiles and shift info for notifications
        SELECT full_name INTO v_acceptor_name FROM profiles WHERE id = p_acceptor_id;
        SELECT full_name INTO v_requester_name FROM profiles WHERE id = v_req.requester_id;
        v_acceptor_name := COALESCE(v_acceptor_name, 'A colleague');
        v_requester_name := COALESCE(v_requester_name, 'An employee');

        SELECT name, date, workspace_id INTO v_shift_x_name, v_shift_x_date, v_workspace_id FROM shifts WHERE id = v_req.shift_id;
        v_shift_x_name := COALESCE(v_shift_x_name, 'a shift');

        IF v_req.offered_shift_id IS NOT NULL THEN
            SELECT name, date INTO v_shift_y_name, v_shift_y_date FROM shifts WHERE id = v_req.offered_shift_id;
            v_shift_y_name := COALESCE(v_shift_y_name, 'a shift');
        END IF;

        -- Notify requester of success
        INSERT INTO notifications (user_id, type, title, message, reference_id, is_read)
        VALUES (
            v_req.requester_id, 'system', 'Shift Swap Successful! 🎉', 
            v_acceptor_name || ' accepted your swap. You now have "' || v_shift_y_name || '" (' || COALESCE(v_shift_y_date::text, '') || '). ' || v_acceptor_name || ' now has "' || v_shift_x_name || '" (' || COALESCE(v_shift_x_date::text, '') || ').',
            p_request_id, false
        );

        -- Update OTHER candidate notifications to mark them invalid
        UPDATE notifications 
        SET is_read = true, message = 'This shift was swapped by ' || v_acceptor_name || '. Request is no longer valid.' 
        WHERE reference_id = ANY(v_all_req_ids) 
          AND type = 'swap_request'
          AND user_id != p_acceptor_id;

    ELSIF v_req.type = 'absence' THEN
        -- Add acceptor's assignment (requester's assignment was already removed by manager)
        INSERT INTO shift_assignments (shift_id, user_id) VALUES (v_req.shift_id, p_acceptor_id);

        SELECT full_name INTO v_acceptor_name FROM profiles WHERE id = p_acceptor_id;
        SELECT full_name INTO v_requester_name FROM profiles WHERE id = v_req.requester_id;
        v_acceptor_name := COALESCE(v_acceptor_name, 'Someone');
        v_requester_name := COALESCE(v_requester_name, 'An employee');

        SELECT name, date, workspace_id INTO v_shift_x_name, v_shift_x_date, v_workspace_id FROM shifts WHERE id = v_req.shift_id;

        INSERT INTO notifications (user_id, type, title, message, reference_id, is_read)
        VALUES (
            v_req.requester_id, 'system', 'Absence Covered! 🎉', 
            'Your absence for "' || COALESCE(v_shift_x_name, 'your shift') || '" has been covered by ' || v_acceptor_name || '.',
            p_request_id, false
        );

        UPDATE notifications 
        SET is_read = true, message = 'This shift was already covered. Request is no longer valid.' 
        WHERE reference_id = p_request_id 
          AND type = 'absence_request'
          AND user_id != p_acceptor_id;
    END IF;

    -- Notify managers
    IF v_workspace_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, title, message, reference_id, is_read)
        SELECT user_id, 'system', 
               CASE WHEN v_req.type = 'swap' THEN 'Shift Swap Completed ✅' ELSE 'Absence Covered ✅' END,
               CASE WHEN v_req.type = 'swap' THEN
                   v_requester_name || ' and ' || v_acceptor_name || ' completed a shift swap: "' || v_shift_x_name || '" (' || COALESCE(v_shift_x_date::text, '') || ') ↔ "' || COALESCE(v_shift_y_name, 'a shift') || '" (' || COALESCE(v_shift_y_date::text, '') || ').'
               ELSE
                   v_acceptor_name || ' covered ' || v_requester_name || '''s absence for "' || COALESCE(v_shift_x_name, 'a shift') || '" (' || COALESCE(v_shift_x_date::text, '') || ').'
               END,
               p_request_id, false
        FROM workspace_members
        WHERE workspace_id = v_workspace_id AND role IN ('manager', 'MANAGER');
    END IF;

    RETURN TRUE;
END;
$$;
