import React, { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { EmployeeHeader } from '../components/EmployeeHeader'
import { useAuth } from '../components/AuthContext'
import { supabase } from '../lib/supabase'
import { getDurationHours, formatDurationStr, formatLocalDate } from '../utils/timeFormat'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatDate = (dateString) => {
    const d = new Date(dateString);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return {
        dayName: days[d.getDay()],
        dateStr: `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
    };
};

const formatVND = (amount) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export function EmployeeEarnings() {
    const { user } = useAuth();
    const { workspaceId } = useParams();

    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);
    const [viewAllShifts, setViewAllShifts] = useState(false);
    const downloadRef = useRef(null);

    const [pastShifts, setPastShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ totalEarnings: 0, shiftsCompleted: 0, totalHours: 0 });

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (downloadRef.current && !downloadRef.current.contains(e.target))
                setIsDownloadOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Fetch earnings data when month/year changes
    useEffect(() => {
        if (!user) return;

        const fetchEarnings = async () => {
            setLoading(true);

            // Build date range for selected month
            const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
            const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${lastDay}`;
            const todayStr = formatLocalDate(new Date());

            const { data, error } = await supabase
                .from('shift_assignments')
                .select(`
                    id,
                    shifts!inner (
                        id,
                        name,
                        date,
                        start_time,
                        end_time,
                        workspace_id,
                        roles (
                            name,
                            color_theme,
                            hourly_wage
                        )
                    )
                `)
                .eq('user_id', user.id)
                .gte('shifts.date', startDate)
                .lte('shifts.date', endDate)
                .lt('shifts.date', todayStr); // Only completed shifts

            if (error) {
                console.error('Error fetching earnings:', error);
                setLoading(false);
                return;
            }

            // Filter to workspace if provided
            const filtered = (data || []).filter(item => {
                if (!workspaceId) return true;
                return item.shifts?.workspace_id === workspaceId;
            });

            let totalH = 0;
            let totalE = 0;

            const formatted = filtered.map(item => {
                const shift = item.shifts;
                const durationHours = getDurationHours(shift.start_time, shift.end_time);
                const roleData = Array.isArray(shift.roles) ? shift.roles[0] : shift.roles;
                const hourlyRate = roleData?.hourly_wage || 50000;
                const shiftEarnings = durationHours * hourlyRate;

                totalH += durationHours;
                totalE += shiftEarnings;

                return {
                    id: item.id,
                    dateDisplay: formatDate(shift.date).dateStr,
                    dayName: formatDate(shift.date).dayName,
                    date: shift.date,
                    name: shift.name,
                    roleName: roleData?.name || 'Shift',
                    colorTheme: roleData?.color_theme || '#3b82f6',
                    durationStr: formatDurationStr(shift.start_time, shift.end_time),
                    durationHours,
                    earnings: shiftEarnings,
                    earningsDisplay: formatVND(shiftEarnings),
                    hourlyRate,
                };
            }).sort((a, b) => new Date(b.date) - new Date(a.date));

            setPastShifts(formatted);
            setStats({ totalEarnings: totalE, shiftsCompleted: formatted.length, totalHours: totalH });
            setLoading(false);
        };

        fetchEarnings();
    }, [user, workspaceId, selectedMonth, selectedYear]);

    // Range-based Excel Export
    const exportToExcel = async (startDate, endDate, label) => {
        const todayStr = formatLocalDate(new Date());

        const { data, error } = await supabase
            .from('shift_assignments')
            .select(`
                id,
                shifts!inner (
                    id, name, date, start_time, end_time, workspace_id,
                    roles ( name, color_theme, hourly_wage )
                )
            `)
            .eq('user_id', user.id)
            .gte('shifts.date', startDate)
            .lte('shifts.date', endDate)
            .lt('shifts.date', todayStr);

        if (error || !data) { alert('Export failed'); return; }

        const filtered = workspaceId
            ? data.filter(item => item.shifts?.workspace_id === workspaceId)
            : data;

        let totalH = 0, totalE = 0;
        const rows = filtered.map(item => {
            const s = item.shifts;
            const roleData = Array.isArray(s.roles) ? s.roles[0] : s.roles;
            const hours = getDurationHours(s.start_time, s.end_time);
            const rate = roleData?.hourly_wage || 50000;
            const earn = hours * rate;
            totalH += hours; totalE += earn;
            return {
                'Date': formatDate(s.date).dateStr,
                'Day': formatDate(s.date).dayName,
                'Shift': s.name,
                'Role': roleData?.name || 'Shift',
                'Duration (hrs)': hours,
                'Rate / hr (VND)': rate,
                'Earnings (VND)': earn,
            };
        }).sort((a, b) => new Date(b.Date) - new Date(a.Date));

        rows.push({
            'Date': 'TOTAL', 'Day': '', 'Shift': '', 'Role': '',
            'Duration (hrs)': totalH, 'Rate / hr (VND)': '',
            'Earnings (VND)': totalE,
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 18 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, label);
        XLSX.writeFile(wb, `earnings_${label.replace(/\s+/g, '_')}.xlsx`);
        setIsDownloadOpen(false);
    };

    const handleExportThisWeek = () => {
        const d = new Date();
        const day = d.getDay();
        const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
        const fmt = (dt) => formatLocalDate(dt);
        exportToExcel(fmt(mon), fmt(sun), 'This_Week');
    };

    const handleExportThisMonth = () => {
        const d = new Date();
        const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${last}`;
        exportToExcel(start, end, `${MONTHS[d.getMonth()]}_${d.getFullYear()}`);
    };

    const handleExport6Months = () => {
        const end = new Date();
        const start = new Date(end);
        start.setMonth(end.getMonth() - 5);
        start.setDate(1);
        const fmt = (dt) => formatLocalDate(dt);
        exportToExcel(fmt(start), fmt(end), 'Last_6_Months');
    };

    const displayShifts = viewAllShifts ? pastShifts : pastShifts.slice(0, 6);

    // Month navigation
    const goToPrevMonth = () => {
        if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); }
        else setSelectedMonth(m => m - 1);
    };
    const goToNextMonth = () => {
        const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
        if (isCurrentMonth) return;
        if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); }
        else setSelectedMonth(m => m + 1);
    };
    const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();

    return (
        <div className="bg-background-light text-text-main font-display antialiased min-h-screen flex flex-col relative">
            <EmployeeHeader />
            <main className="flex-1 flex justify-center w-full px-4 py-8 lg:px-8">
                <div className="w-full max-w-[1280px] flex flex-col gap-8 mb-10">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-text-primary-light to-[#45a17f] dark:from-white dark:to-primary bg-clip-text text-transparent mb-1">Earnings</h1>
                            <p className="text-text-secondary font-medium">Your completed shift earnings</p>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Month selector */}
                            <div className="flex items-center gap-2 bg-white border border-[#e6f4ef] rounded-xl px-3 py-2 shadow-sm">
                                <button onClick={goToPrevMonth} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                                    <span className="material-symbols-outlined text-[18px] text-text-secondary">chevron_left</span>
                                </button>
                                <span className="text-sm font-bold text-text-main min-w-[110px] text-center">
                                    {MONTHS[selectedMonth]} {selectedYear}
                                </span>
                                <button
                                    onClick={goToNextMonth}
                                    disabled={isCurrentMonth}
                                    className="p-1 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30"
                                >
                                    <span className="material-symbols-outlined text-[18px] text-text-secondary">chevron_right</span>
                                </button>
                            </div>

                            {/* Download Dropdown */}
                            <div className="relative" ref={downloadRef}>
                                <button
                                    onClick={() => setIsDownloadOpen(!isDownloadOpen)}
                                    className="px-4 py-2 rounded-xl bg-white border border-[#e6f4ef] hover:bg-gray-50 text-text-main text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
                                >
                                    <span className="material-symbols-outlined text-[18px]">download</span>
                                    Export Excel
                                    <span className="material-symbols-outlined text-[16px]">expand_more</span>
                                </button>
                                {isDownloadOpen && (
                                    <div className="absolute top-full right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-[#e6f4ef] py-2 z-50">
                                        <p className="px-4 py-1.5 text-xs font-bold text-text-secondary uppercase tracking-wider">Export range</p>
                                        <button
                                            onClick={handleExportThisWeek}
                                            className="w-full text-left px-4 py-2.5 text-sm text-text-main hover:bg-gray-50 transition-colors flex items-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-[16px] text-emerald-600">date_range</span>
                                            This Week
                                        </button>
                                        <button
                                            onClick={handleExportThisMonth}
                                            className="w-full text-left px-4 py-2.5 text-sm text-text-main hover:bg-gray-50 transition-colors flex items-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-[16px] text-blue-500">calendar_month</span>
                                            This Month
                                        </button>
                                        <button
                                            onClick={handleExport6Months}
                                            className="w-full text-left px-4 py-2.5 text-sm text-text-main hover:bg-gray-50 transition-colors flex items-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-[16px] text-purple-500">history</span>
                                            Last 6 Months
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {/* Total Earnings */}
                        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
                            <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />
                            <div className="relative">
                                <div className="size-10 rounded-full bg-white/20 flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-[20px]">payments</span>
                                </div>
                                <p className="text-white/80 text-sm font-medium mb-1">Total Earnings</p>
                                <h3 className="text-2xl font-black leading-tight">
                                    {loading ? '...' : formatVND(stats.totalEarnings)}
                                </h3>
                            </div>
                        </div>

                        {/* Completed Shifts */}
                        <div className="bg-white rounded-2xl p-6 border border-[#e6f4ef] shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                            <div className="absolute right-0 top-0 w-32 h-32 bg-blue-50/50 rounded-full -mr-10 -mt-10 blur-xl group-hover:bg-blue-50 transition-all pointer-events-none" />
                            <div className="relative">
                                <div className="size-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-4">
                                    <span className="material-symbols-outlined text-[20px]">work_history</span>
                                </div>
                                <p className="text-text-secondary text-sm font-medium mb-1">Completed Shifts</p>
                                <h3 className="text-text-main text-2xl font-black">
                                    {loading ? '...' : `${stats.shiftsCompleted}`}
                                    <span className="text-base font-semibold text-text-secondary ml-1">shifts</span>
                                </h3>
                            </div>
                        </div>

                        {/* Total Hours */}
                        <div className="bg-white rounded-2xl p-6 border border-[#e6f4ef] shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                            <div className="absolute right-0 top-0 w-32 h-32 bg-sky-50/50 rounded-full -mr-10 -mt-10 blur-xl group-hover:bg-sky-50 transition-all pointer-events-none" />
                            <div className="relative">
                                <div className="size-10 rounded-full bg-sky-50 flex items-center justify-center text-sky-600 mb-4">
                                    <span className="material-symbols-outlined text-[20px]">schedule</span>
                                </div>
                                <p className="text-text-secondary text-sm font-medium mb-1">Hours Worked</p>
                                <h3 className="text-text-main text-2xl font-black">
                                    {loading ? '...' : `${stats.totalHours}`}
                                    <span className="text-base font-semibold text-text-secondary ml-1">hrs</span>
                                </h3>
                            </div>
                        </div>
                    </div>

                    {/* Shift History Table */}
                    <div className="bg-white border border-[#e6f4ef] rounded-2xl overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-[#e6f4ef] flex justify-between items-center">
                            <h2 className="text-text-main text-lg font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined text-text-secondary">history</span>
                                Shift History — {MONTHS[selectedMonth]} {selectedYear}
                            </h2>
                            {pastShifts.length > 6 && (
                                <button
                                    onClick={() => setViewAllShifts(!viewAllShifts)}
                                    className="text-primary-dark text-sm font-bold hover:underline"
                                >
                                    {viewAllShifts ? 'Show Less' : `View All (${pastShifts.length})`}
                                </button>
                            )}
                        </div>

                        <div className={`overflow-x-auto overflow-y-auto transition-all duration-300 ${viewAllShifts ? 'max-h-[900px]' : 'max-h-[400px]'}`}>
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-10 bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-xs font-bold text-text-secondary uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-3 text-xs font-bold text-text-secondary uppercase tracking-wider">Shift</th>
                                        <th className="px-6 py-3 text-xs font-bold text-text-secondary uppercase tracking-wider">Duration</th>
                                        <th className="px-6 py-3 text-xs font-bold text-text-secondary uppercase tracking-wider">Rate / hr</th>
                                        <th className="px-6 py-3 text-xs font-bold text-text-secondary uppercase tracking-wider">Earnings</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#e6f4ef]">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-12 text-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-dark mx-auto"></div>
                                            </td>
                                        </tr>
                                    ) : pastShifts.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-16 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-2xl text-gray-400">receipt_long</span>
                                                    </div>
                                                    <p className="text-text-secondary font-medium">No completed shifts for {MONTHS[selectedMonth]} {selectedYear}</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        displayShifts.map(shift => (
                                            <tr key={shift.id} className="hover:bg-primary/5 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="text-text-main font-bold">{shift.dateDisplay}</span>
                                                        <span className="text-text-secondary text-xs">{shift.dayName}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: shift.colorTheme }}></span>
                                                        <div>
                                                            <p className="text-text-main font-semibold">{shift.name}</p>
                                                            <p className="text-text-secondary text-xs">{shift.roleName}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-text-secondary font-medium">{shift.durationStr}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-text-secondary font-medium">{formatVND(shift.hourlyRate)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg text-sm">
                                                        {shift.earningsDisplay}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                {pastShifts.length > 0 && !loading && (
                                    <tfoot>
                                        <tr className="bg-gray-50 border-t-2 border-[#e6f4ef]">
                                            <td colSpan="4" className="px-6 py-4 text-sm font-bold text-text-secondary uppercase tracking-wider">Total</td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1 font-black text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-lg">
                                                    {formatVND(stats.totalEarnings)}
                                                </span>
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
