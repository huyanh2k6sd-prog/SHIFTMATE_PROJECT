-- =====================================================
-- ShiftMate Database Schema
-- Migration: 001_initial_schema
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS (public profile, linked to Supabase auth)
-- =====================================================
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL CHECK (char_length(username) > 5),
    phone_number TEXT NOT NULL CHECK (phone_number ~ '^0[0-9]{9}$'),
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- WORKSPACES
-- =====================================================
CREATE TABLE public.workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ROLES (Role Rooms inside a Workspace)
-- =====================================================
CREATE TABLE public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT DEFAULT 'work',
    color_theme TEXT DEFAULT 'teal',
    hourly_wage NUMERIC DEFAULT 0,
    min_hours_per_week INTEGER DEFAULT 0,
    max_hours_per_week INTEGER DEFAULT 40,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- USER_ROLES (Junction: Users <-> Roles)
-- =====================================================
CREATE TYPE user_role_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    status user_role_status DEFAULT 'pending',
    is_manager BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, role_id)
);

-- =====================================================
-- SHIFTS
-- =====================================================
CREATE TABLE public.shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    required_staff INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ASSIGNED_SHIFTS (Which user is assigned to which shift)
-- =====================================================
CREATE TABLE public.assigned_shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    is_manual_override BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (shift_id, user_id)
);

-- =====================================================
-- AVAILABILITIES (When employees are available to work)
-- =====================================================
CREATE TABLE public.availabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================
CREATE TYPE notification_type AS ENUM (
    'role_request', 'swap_request', 'absence_request',
    'assignment_alert', 'system', 'swap_accepted',
    'absence_accepted', 'absence_rejected', 'swap_completed'
);

CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    action_url TEXT,
    reference_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SHIFT_REQUESTS (Swap & Absence requests)
-- =====================================================
CREATE TYPE shift_request_type AS ENUM ('swap', 'absence');
CREATE TYPE shift_request_status AS ENUM (
    'pending_manager', 'pending_staff', 'approved', 'rejected', 'completed'
);

CREATE TABLE public.shift_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type shift_request_type NOT NULL,
    shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    offered_shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
    reason TEXT,
    status shift_request_status DEFAULT 'pending_manager',
    approved_by_manager BOOLEAN DEFAULT FALSE,
    accepted_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assigned_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_requests ENABLE ROW LEVEL SECURITY;

-- USERS: Users can read/update their own profile
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- WORKSPACES: Owner can do anything, members can view
CREATE POLICY "Workspace owners can manage workspace" ON public.workspaces FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Workspace members can view workspace" ON public.workspaces FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE r.workspace_id = workspaces.id AND ur.user_id = auth.uid() AND ur.status = 'approved'
    )
);

-- ROLES: Managers can manage, members can view
CREATE POLICY "Managers can manage roles" ON public.roles FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.role_id = roles.id AND ur.user_id = auth.uid() AND ur.is_manager = TRUE AND ur.status = 'approved'
    )
    OR EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = roles.workspace_id AND w.manager_id = auth.uid()
    )
);
CREATE POLICY "Members can view roles" ON public.roles FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.role_id = roles.id AND ur.user_id = auth.uid()
    )
);

-- USER_ROLES: Users can see/request their own, managers can see all in their role
CREATE POLICY "Users can see own user_roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can request to join a role" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Managers can manage user_roles" ON public.user_roles FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.role_id = user_roles.role_id AND ur.user_id = auth.uid() AND ur.is_manager = TRUE AND ur.status = 'approved'
    )
    OR EXISTS (
        SELECT 1 FROM public.roles r
        JOIN public.workspaces w ON w.id = r.workspace_id
        WHERE r.id = user_roles.role_id AND w.manager_id = auth.uid()
    )
);

-- SHIFTS: Managers can manage, members can view
CREATE POLICY "Members can view shifts" ON public.shifts FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.role_id = shifts.role_id AND ur.user_id = auth.uid() AND ur.status = 'approved'
    )
    OR EXISTS (
        SELECT 1 FROM public.roles r
        JOIN public.workspaces w ON w.id = r.workspace_id
        WHERE r.id = shifts.role_id AND w.manager_id = auth.uid()
    )
);
CREATE POLICY "Managers can manage shifts" ON public.shifts FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.role_id = shifts.role_id AND ur.user_id = auth.uid() AND ur.is_manager = TRUE AND ur.status = 'approved'
    )
    OR EXISTS (
        SELECT 1 FROM public.roles r
        JOIN public.workspaces w ON w.id = r.workspace_id
        WHERE r.id = shifts.role_id AND w.manager_id = auth.uid()
    )
);

-- ASSIGNED_SHIFTS: Members can view, Managers can insert/delete
CREATE POLICY "Members can view assigned shifts" ON public.assigned_shifts FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.shifts s
        JOIN public.user_roles ur ON ur.role_id = s.role_id
        WHERE s.id = assigned_shifts.shift_id AND ur.user_id = auth.uid() AND ur.status = 'approved'
    )
    OR EXISTS (
        SELECT 1 FROM public.shifts s
        JOIN public.roles r ON r.id = s.role_id
        JOIN public.workspaces w ON w.id = r.workspace_id
        WHERE s.id = assigned_shifts.shift_id AND w.manager_id = auth.uid()
    )
);
CREATE POLICY "Managers can manage assigned shifts" ON public.assigned_shifts FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.shifts s
        JOIN public.user_roles ur ON ur.role_id = s.role_id
        WHERE s.id = assigned_shifts.shift_id AND ur.user_id = auth.uid() AND ur.is_manager = TRUE
    )
    OR EXISTS (
        SELECT 1 FROM public.shifts s
        JOIN public.roles r ON r.id = s.role_id
        JOIN public.workspaces w ON w.id = r.workspace_id
        WHERE s.id = assigned_shifts.shift_id AND w.manager_id = auth.uid()
    )
);

-- AVAILABILITIES: Users can manage their own
CREATE POLICY "Users can manage own availabilities" ON public.availabilities FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Managers can view availabilities" ON public.availabilities FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.role_id = availabilities.role_id AND ur.user_id = auth.uid() AND ur.is_manager = TRUE AND ur.status = 'approved'
    )
);

-- NOTIFICATIONS: Users can only read/update their own
CREATE POLICY "Users can manage own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);

-- SHIFT_REQUESTS: Members can view/create, managers can update
CREATE POLICY "Members can view shift requests" ON public.shift_requests FOR SELECT USING (
    auth.uid() = requester_id OR auth.uid() = accepted_by_user_id OR
    EXISTS (
        SELECT 1 FROM public.shifts s
        JOIN public.user_roles ur ON ur.role_id = s.role_id
        WHERE s.id = shift_requests.shift_id AND ur.user_id = auth.uid() AND ur.status = 'approved'
    )
);
CREATE POLICY "Members can create shift requests" ON public.shift_requests FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Managers can update shift requests" ON public.shift_requests FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.shifts s
        JOIN public.user_roles ur ON ur.role_id = s.role_id
        WHERE s.id = shift_requests.shift_id AND ur.user_id = auth.uid() AND ur.is_manager = TRUE
    )
);

-- =====================================================
-- REALTIME: Enable Realtime for essential tables
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.shifts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assigned_shifts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.availabilities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_requests;

-- =====================================================
-- FUNCTION: Auto-create user profile on signup
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- FUNCTION: Generate short Room ID for Workspaces
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_room_id()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    result TEXT := 'WS-';
    i INTEGER;
BEGIN
    FOR i IN 1..4 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    result := result || '-';
    FOR i IN 1..3 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;
