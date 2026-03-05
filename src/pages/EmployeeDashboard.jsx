import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { EmployeeHeader } from '../components/EmployeeHeader'
import { SwapShiftModal } from '../components/SwapShiftModal'
import { ReportAbsenceModal } from '../components/ReportAbsenceModal'
import { useAuth } from '../components/AuthContext'
import { supabase } from '../lib/supabase'
import { formatLocalDate, formatTime, getDurationHours, getVietnamTime, parseVietnamDateTime, getVietnamDateStr } from '../utils/timeFormat'

// Helper to format date
const formatDate = (dateString) => {
    const d = new Date(dateString + 'T12:00:00'); // noon to avoid timezone shifts
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return {
        day: days[d.getDay()],
        date: d.getDate(),
        month: months[d.getMonth()],
        year: d.getFullYear(),
        shortDate: `${months[d.getMonth()]} ${d.getDate()}`
    };
};


export function EmployeeDashboard() {
    const { workspaceId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [assignedShifts, setAssignedShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totalHours, setTotalHours] = useState(0);

    const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
    const [selectedSwapShift, setSelectedSwapShift] = useState(null);
    const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
    const [selectedAbsenceShift, setSelectedAbsenceShift] = useState(null);

    useEffect(() => {
        if (!user || !workspaceId) return;

        const fetchMyShifts = async () => {
            setLoading(true);

            // Fetch assigned shifts joined with shifts and roles
            const { data, error } = await supabase
                .from('shift_assignments')
                .select(`
                    id,
                    is_manual_override,
                    shifts!inner (
                        id,
                        name,
                        date,
                        start_time,
                        end_time,
                        roles!inner (
                            id,
                            workspace_id,
                            name,
                            icon,
                            color_theme,
                            min_hours_per_week,
                            max_hours_per_week
                        )
                    )
                `)
                .eq('user_id', user.id)
                .eq('shifts.roles.workspace_id', workspaceId)
                .gte('shifts.date', getVietnamDateStr()) // Fetch from today (Vietnam Date)
                .order('shifts(date)', { ascending: true })
                .order('shifts(start_time)', { ascending: true })
            if (data) {
                const formattedShifts = data.map(item => {
                    const shift = item.shifts;
                    return {
                        assignment_id: item.id,
                        ...shift,
                        role: shift.roles
                    }
                }).sort((a, b) => {
                    const dateA = parseVietnamDateTime(a.date, a.start_time) || 0;
                    const dateB = parseVietnamDateTime(b.date, b.start_time) || 0;
                    return dateA - dateB;
                });

                const now = getVietnamTime();
                const todayStr = getVietnamDateStr();

                const filteredShifts = formattedShifts.filter(s => {
                    if (!s.date) return false;

                    // Always show future dates
                    if (s.date > todayStr) return true;

                    // For today or past dates (though query limits to today+):
                    // Only show if the end time (absolute Vietnam time) hasn't passed yet
                    const shiftEnd = parseVietnamDateTime(s.date, s.end_time || '23:59:59');
                    return shiftEnd && now <= shiftEnd;
                });

                setAssignedShifts(filteredShifts);

                // Calculate total hours from filtered (upcoming only) shifts
                let hours = 0;
                filteredShifts.forEach(s => {
                    hours += getDurationHours(s.start_time, s.end_time);
                });
                setTotalHours(Math.round(hours * 100) / 100);
            } else if (error) {
                console.error("Error fetching employee shifts:", error);
            }

            setLoading(false);
        };

        fetchMyShifts();
        // Listen for custom refresh events from notification actions (same-client)
        const handleRefresh = () => fetchMyShifts();
        window.addEventListener('shiftmate:refresh', handleRefresh);

        // Setup subscription
        const userShiftsChannel = supabase.channel('my_shifts_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'shift_assignments',
                filter: `user_id=eq.${user.id}`
            }, fetchMyShifts)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'shifts',
                filter: `workspace_id=eq.${workspaceId}`
            }, fetchMyShifts)
            .subscribe();

        return () => {
            window.removeEventListener('shiftmate:refresh', handleRefresh);
            supabase.removeChannel(userShiftsChannel);
        };
    }, [user, workspaceId]);

    const handleOpenSwapModal = (shift) => {
        setSelectedSwapShift({
            id: shift.id,
            name: shift.name,
            day: formatDate(shift.date).day,
            date: formatDate(shift.date).date,
            time: `${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}`,
            duration: `${getDurationHours(shift.start_time, shift.end_time)}h`,
            role_id: shift.role.id,
            originalDateStr: shift.date
        });
        setIsSwapModalOpen(true);
    };

    const handleOpenAbsenceModal = (shift) => {
        setSelectedAbsenceShift({
            id: shift.id,
            name: shift.name,
            day: formatDate(shift.date).day,
            date: formatDate(shift.date).date,
            time: `${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}`,
            duration: `${getDurationHours(shift.start_time, shift.end_time)}h`,
            role_id: shift.role.id,
            originalDateStr: shift.date
        });
        setIsAbsenceModalOpen(true);
    };

    return (
        <div style={{
            '--color-primary': '#99ffda',
            '--color-primary-dark': '#66ccaa',
            '--color-background-light': '#f5f8f7',
            '--color-background-dark': '#0f231c',
            '--color-surface-light': '#ffffff',
            '--color-surface-dark': '#1a332a',
            '--color-text-main': '#0c1d17',
            '--color-text-secondary': '#45a17f',
        }} className="bg-background-light text-text-main font-display min-h-screen flex flex-col antialiased relative">
            <EmployeeHeader />
            <main className="flex-1 flex justify-center w-full px-4 py-8 lg:px-8">
                <div className="w-full max-w-[1280px] flex flex-col gap-8">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="flex flex-col gap-1">
                            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-text-primary-light to-[#45a17f] dark:from-white dark:to-primary bg-clip-text text-transparent">My Schedule</h1>
                            <p className="text-text-secondary font-medium">Upcoming Shifts</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => navigate(`/employee/availability/${workspaceId}`)}
                                className="bg-primary hover:bg-primary-dark text-emerald-950 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:shadow transition-all flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[20px]">edit_calendar</span>
                                Set Availability
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-4 flex flex-col gap-6">
                            <div className="relative overflow-hidden bg-white rounded-2xl shadow-sm border border-[#e6f4ef] p-6">
                                {/* Decorative circles */}
                                <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-primary/10 pointer-events-none" />
                                <div className="absolute -bottom-8 -left-6 w-36 h-36 rounded-full bg-primary/5 pointer-events-none" />

                                <div className="relative flex items-center gap-4">
                                    {/* Avatar with ring */}
                                    <div className="shrink-0 p-[3px] rounded-full bg-gradient-to-br from-teal-400 to-emerald-600">
                                        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center font-black text-2xl text-primary-dark overflow-hidden">
                                            {user?.user_metadata?.avatar_url ? (
                                                <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                            ) : (
                                                (user?.user_metadata?.full_name || 'U')[0].toUpperCase()
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1 min-w-0">
                                        <p className="text-xs font-semibold text-text-secondary uppercase tracking-widest">Welcome back</p>
                                        <h2 className="text-xl font-black leading-tight text-text-main truncate">{user?.user_metadata?.full_name || 'Employee'}</h2>
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-primary/20 text-primary-dark px-2 py-0.5 rounded-full w-fit">
                                            <span className="material-symbols-outlined text-[13px]">badge</span>
                                            Employee
                                        </span>
                                    </div>
                                </div>

                                <div className="relative mt-4 pt-4 border-t border-[#e6f4ef] flex items-center gap-2 text-sm text-text-secondary">
                                    <span className="material-symbols-outlined text-[16px]">bolt</span>
                                    Ready for next shift!
                                </div>
                            </div>


                            <div className="relative overflow-hidden bg-gradient-to-br from-teal-500 to-emerald-700 rounded-2xl shadow-md p-6 text-white">
                                {/* Decorative background circles */}
                                <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />
                                <div className="absolute -bottom-6 -left-4 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />

                                <div className="relative flex items-center gap-2 mb-5">
                                    <span className="material-symbols-outlined text-white/80 text-[20px]">upcoming</span>
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-white/80">Upcoming Shifts</h4>
                                </div>

                                <div className="relative flex items-end justify-between gap-4">
                                    <div className="flex flex-col gap-1">
                                        <p className="text-4xl font-black leading-none">{totalHours}<span className="text-xl font-bold text-white/70 ml-1">hrs</span></p>
                                        <p className="text-xs text-white/70 font-medium flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                                            Total Hours
                                        </p>
                                    </div>
                                    <div className="w-[1px] h-10 bg-white/20" />
                                    <div className="flex flex-col gap-1">
                                        <p className="text-4xl font-black leading-none">{assignedShifts.length}</p>
                                        <p className="text-xs text-white/70 font-medium flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">event</span>
                                            Shifts
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-8 flex flex-col gap-4">
                            <h2 className="text-xl font-bold text-text-main mb-2">Upcoming Shifts</h2>
                            {loading ? (
                                <div className="flex justify-center items-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-dark"></div>
                                </div>
                            ) : assignedShifts.length === 0 ? (
                                <div className="bg-surface-light rounded-2xl p-12 border border-[#e6f4ef] flex flex-col items-center justify-center text-center">
                                    <div className="w-16 h-16 bg-background-light rounded-full flex items-center justify-center mb-4">
                                        <span className="material-symbols-outlined text-3xl text-text-secondary">free_cancellation</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-text-main mb-2">No Upcoming Shifts</h3>
                                    <p className="text-text-secondary max-w-sm">You are not currently assigned to any upcoming shifts in this workspace.</p>
                                </div>
                            ) : (
                                assignedShifts.map((shift, idx) => {
                                    const dateInfo = formatDate(shift.date);
                                    const duration = getDurationHours(shift.start_time, shift.end_time);

                                    // Highlight if it's today
                                    const isToday = shift.date === formatLocalDate(new Date());

                                    return (
                                        <div key={shift.assignment_id} className={`group bg-surface-light rounded-2xl p-5 border ${isToday ? 'border-primary shadow-sm' : 'border-[#e6f4ef]'} hover:border-primary/50 hover:shadow-md transition-all duration-300 relative overflow-hidden`}>
                                            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isToday ? 'bg-primary' : 'bg-gray-300 group-hover:bg-primary/50 transition-colors'}`}></div>
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="flex items-start gap-4">
                                                    <div className={`rounded-xl p-3 flex flex-col items-center justify-center min-w-[70px] ${isToday ? 'bg-[#e6f4ef] text-primary-dark' : 'bg-background-light'}`}>
                                                        <span className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-primary-dark' : 'text-text-secondary'}`}>{isToday ? 'Today' : dateInfo.day}</span>
                                                        <span className="text-2xl font-bold text-text-main">{dateInfo.date}</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className="material-symbols-outlined text-[16px] text-text-secondary">{shift.role.icon || 'work'}</span>
                                                            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">{shift.role.name}</span>
                                                        </div>
                                                        <h3 className="text-lg font-bold text-text-main">{shift.name}</h3>
                                                        <div className="flex items-center gap-2 text-text-secondary text-sm mt-1">
                                                            <span className="material-symbols-outlined text-[18px]">schedule</span>
                                                            <span>{formatTime(shift.start_time)} - {formatTime(shift.end_time)}</span>
                                                            <span className="w-1 h-1 bg-gray-300 rounded-full mx-1"></span>
                                                            <span className="text-text-main/60">{duration}h</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 mt-2 md:mt-0 pl-[86px] md:pl-0">
                                                    <button
                                                        onClick={() => handleOpenSwapModal(shift)}
                                                        className="px-4 py-2 rounded-lg text-sm font-semibold text-text-main bg-background-light hover:bg-[#e6f4ef] transition-colors"
                                                    >
                                                        Request Swap
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenAbsenceModal(shift)}
                                                        className="px-4 py-2 rounded-lg text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer relative z-10"
                                                    >
                                                        Report Absence
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </main>

            <SwapShiftModal
                isOpen={isSwapModalOpen}
                currentShift={selectedSwapShift}
                workspaceId={workspaceId}
                onClose={() => { setIsSwapModalOpen(false); setSelectedSwapShift(null); }}
            />
            <ReportAbsenceModal
                isOpen={isAbsenceModalOpen}
                currentShift={selectedAbsenceShift}
                workspaceId={workspaceId}
                onClose={() => { setIsAbsenceModalOpen(false); setSelectedAbsenceShift(null); }}
            />
        </div>
    )
}
