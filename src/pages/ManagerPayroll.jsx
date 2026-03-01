import React, { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { ManagerHeader } from '../components/ManagerHeader'
import { supabase } from '../lib/supabase'
import { formatLocalDate } from '../utils/timeFormat'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const getDurationHours = (start, end) => {
    if (!start || !end) return 0;
    // Handle both "HH:MM", "HH:MM:SS" and full ISO timestamps
    const parse = (t) => {
        // If it contains a date portion (space or T), treat as full datetime
        if (t.includes(' ') || t.includes('T')) {
            const ms = Date.parse(t.replace(' ', 'T'));
            if (!isNaN(ms)) return ms / (1000 * 3600); // hours since epoch
            return 0;
        }
        // Plain time "HH:MM" or "HH:MM:SS"
        const parts = t.split(':').map(Number);
        return parts[0] + (parts[1] || 0) / 60;
    };
    const s = parse(start), e = parse(end);
    if (isNaN(s) || isNaN(e)) return 0;
    let diff = e - s;
    // For plain times only: handle overnight
    if (!start.includes(' ') && !start.includes('T') && diff < 0) diff += 24;
    return Math.round(Math.abs(diff) * 10) / 10;
};

const formatVND = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

const getPeriodDates = (period) => {
    const now = new Date();
    const todayStr = formatLocalDate(now);
    if (period === 'week') {
        const day = now.getDay();
        const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
        return { start: formatLocalDate(mon), end: todayStr };
    }
    if (period === 'month') {
        return { start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, end: todayStr };
    }
    if (period === '6months') {
        const s = new Date(now); s.setMonth(now.getMonth() - 5); s.setDate(1);
        return { start: formatLocalDate(s), end: todayStr };
    }
    return { start: '2000-01-01', end: todayStr };
};

export function ManagerPayroll() {
    const { workspaceId } = useParams();
    const [period, setPeriod] = useState('month');
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [sortKey, setSortKey] = useState('totalPay');
    const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
    const exportMenuRef = useRef(null);
    const sortMenuRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [payrollData, setPayrollData] = useState([]);
    const [summary, setSummary] = useState({ totalPay: 0, totalHours: 0, totalShifts: 0, totalEmployees: 0 });

    // Close dropdowns on outside click
    useEffect(() => {
        const handler = (e) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) setIsExportMenuOpen(false);
            if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) setIsSortMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const fetchPayroll = async (p) => {
        if (!workspaceId) return;
        setLoading(true);

        const { start, end } = getPeriodDates(p);

        const { data: assignments, error } = await supabase
            .from('shift_assignments')
            .select(`
                id, user_id,
                shifts!inner (
                    id, date, name, start_time, end_time, workspace_id,
                    roles ( id, name, hourly_wage )
                )
            `)
            .eq('shifts.workspace_id', workspaceId)
            .gte('shifts.date', start)
            .lte('shifts.date', end)
            .lt('shifts.date', formatLocalDate(new Date()));

        if (error) { console.error(error); setLoading(false); return; }

        // Fetch profiles
        const userIds = [...new Set((assignments || []).map(a => a.user_id))];
        let profileMap = {};
        if (userIds.length > 0) {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .in('id', userIds);
            (profiles || []).forEach(p => { profileMap[p.id] = p; });
        }

        // Aggregate per employee
        const empMap = new Map();
        let sumPay = 0, sumHrs = 0, sumShifts = 0;

        (assignments || []).forEach(item => {
            const shift = item.shifts;
            const roleData = Array.isArray(shift.roles) ? shift.roles[0] : shift.roles;
            const rate = roleData?.hourly_wage || 50000;
            const hrs = getDurationHours(shift.start_time, shift.end_time);
            const pay = hrs * rate;

            sumPay += pay; sumHrs += hrs; sumShifts++;

            const uid = item.user_id;
            if (!empMap.has(uid)) {
                const prof = profileMap[uid] || {};
                empMap.set(uid, {
                    id: uid,
                    name: prof.full_name || 'Unknown',
                    avatar_url: prof.avatar_url,
                    shifts: 0,
                    totalHours: 0,
                    totalPay: 0,
                    roleName: roleData?.name || '',
                    rate,
                });
            }
            const emp = empMap.get(uid);
            emp.shifts++;
            emp.totalHours += hrs;
            emp.totalPay += pay;
        });

        const arr = Array.from(empMap.values());
        setSummary({ totalPay: sumPay, totalHours: sumHrs, totalShifts: sumShifts, totalEmployees: arr.length });
        setPayrollData(arr);
        setLoading(false);
    };

    useEffect(() => { fetchPayroll(period); }, [workspaceId, period]);

    // Sorted data
    const sorted = [...payrollData].sort((a, b) => {
        if (sortKey === 'name') return a.name.localeCompare(b.name);
        if (sortKey === 'hours') return b.totalHours - a.totalHours;
        if (sortKey === 'shifts') return b.shifts - a.shifts;
        return b.totalPay - a.totalPay;
    });

    // Export Excel for a period
    const exportExcel = async (p, label) => {
        const { start, end } = getPeriodDates(p);
        const todayStr = formatLocalDate(new Date());
        const { data } = await supabase
            .from('shift_assignments')
            .select(`id, user_id, shifts!inner (id, date, name, start_time, end_time, workspace_id, roles (id, name, hourly_wage))`)
            .eq('shifts.workspace_id', workspaceId)
            .gte('shifts.date', start)
            .lte('shifts.date', end)
            .lt('shifts.date', todayStr);

        if (!data) return;

        const uids = [...new Set(data.map(a => a.user_id))];
        let pm = {};
        if (uids.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', uids);
            (profiles || []).forEach(p2 => { pm[p2.id] = p2; });
        }

        const rows = data.map(item => {
            const s = item.shifts;
            const role = Array.isArray(s.roles) ? s.roles[0] : s.roles;
            const hrs = getDurationHours(s.start_time, s.end_time);
            const rate = role?.hourly_wage || 50000;
            return {
                'Employee': pm[item.user_id]?.full_name || 'Unknown',
                'Shift': s.name,
                'Role': role?.name || '',
                'Date': s.date,
                'Duration (hrs)': hrs,
                'Rate / hr (VND)': rate,
                'Earnings (VND)': hrs * rate,
            };
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 18 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, label);
        XLSX.writeFile(wb, `payroll_${label}.xlsx`);
        setIsExportMenuOpen(false);
    };

    const PERIOD_LABELS = { week: 'This Week', month: 'This Month', '6months': 'Last 6 Months' };

    return (
        <div className="bg-[#f5f8f7] dark:bg-[#0f231c] font-display text-[#0c1d17] dark:text-white min-h-screen flex flex-col">
            <ManagerHeader />
            <main className="flex-1 px-4 py-8 md:px-8 lg:px-16">
                <div className="mx-auto max-w-[1200px] space-y-8">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-text-primary-light to-[#45a17f] dark:from-white dark:to-primary bg-clip-text text-transparent">Payroll Overview</h1>
                            <p className="mt-1 text-gray-500 dark:text-gray-400 font-medium">Review completed shift earnings per employee</p>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Period selector */}
                            <div className="flex bg-white dark:bg-[#152e26] border border-gray-200 dark:border-[#2a4e43] rounded-xl p-1 gap-1 shadow-sm">
                                {['week', 'month', '6months'].map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setPeriod(p)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${period === p ? 'bg-emerald-600 text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'}`}
                                    >
                                        {PERIOD_LABELS[p]}
                                    </button>
                                ))}
                            </div>

                            {/* Export */}
                            <div className="relative" ref={exportMenuRef}>
                                <button
                                    onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                                    className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-[#2a4e43] bg-white dark:bg-[#152e26] px-4 py-2 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-[#1e3a32] transition-colors shadow-sm"
                                >
                                    <span className="material-symbols-outlined text-[18px]">download</span>
                                    Export Excel
                                    <span className="material-symbols-outlined text-[16px]">expand_more</span>
                                </button>
                                {isExportMenuOpen && (
                                    <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-[#152e26] rounded-xl shadow-xl border border-gray-100 dark:border-[#1e3a32] py-2 z-30">
                                        <p className="px-4 py-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">Export range</p>
                                        {[
                                            { key: 'week', label: 'This Week', icon: 'date_range', color: 'text-emerald-600' },
                                            { key: 'month', label: 'This Month', icon: 'calendar_month', color: 'text-blue-500' },
                                            { key: '6months', label: 'Last 6 Months', icon: 'history', color: 'text-purple-500' },
                                        ].map(opt => (
                                            <button
                                                key={opt.key}
                                                onClick={() => exportExcel(opt.key, opt.label.replace(/\s+/g, '_'))}
                                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-[#1e3a32] transition-colors flex items-center gap-2"
                                            >
                                                <span className={`material-symbols-outlined text-[16px] ${opt.color}`}>{opt.icon}</span>
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: 'Total Payroll', value: loading ? '...' : formatVND(summary.totalPay), icon: 'payments', bg: 'from-emerald-500 to-teal-600', white: true },
                            { label: 'Employees Paid', value: loading ? '...' : `${summary.totalEmployees}`, icon: 'group', bg: 'bg-white dark:bg-[#152e26]', white: false },
                            { label: 'Shifts Completed', value: loading ? '...' : `${summary.totalShifts}`, icon: 'work_history', bg: 'bg-white dark:bg-[#152e26]', white: false },
                            { label: 'Hours Worked', value: loading ? '...' : `${Math.round(summary.totalHours * 10) / 10}h`, icon: 'schedule', bg: 'bg-white dark:bg-[#152e26]', white: false },
                        ].map((card, i) => (
                            <div key={i} className={`rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-[#1e3a32] ${card.white ? `bg-gradient-to-br ${card.bg} text-white` : card.bg}`}>
                                <div className={`size-9 rounded-full flex items-center justify-center mb-3 ${card.white ? 'bg-white/20' : 'bg-emerald-50 dark:bg-[#1e3a32] text-emerald-700 dark:text-emerald-400'}`}>
                                    <span className="material-symbols-outlined text-[18px]">{card.icon}</span>
                                </div>
                                <p className={`text-xs font-semibold mb-1 ${card.white ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>{card.label}</p>
                                <p className={`text-xl font-black ${card.white ? '' : 'text-[#0c1d17] dark:text-white'}`}>{card.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Employee Breakdown Table */}
                    <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-[#1e3a32] bg-white dark:bg-[#152e26] shadow-sm">
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1e3a32] px-6 py-4">
                            <h3 className="font-bold text-[#0c1d17] dark:text-white">Employee Breakdown</h3>
                            <div className="relative" ref={sortMenuRef}>
                                <button
                                    onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#2a4e43] text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#1e3a32] transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[16px]">sort</span>
                                    Sort
                                </button>
                                {isSortMenuOpen && (
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#152e26] rounded-xl shadow-lg border border-gray-100 dark:border-[#1e3a32] py-2 z-20">
                                        {[
                                            { key: 'totalPay', label: 'By Total Pay', icon: 'payments' },
                                            { key: 'hours', label: 'By Hours', icon: 'schedule' },
                                            { key: 'shifts', label: 'By Shifts', icon: 'work_history' },
                                            { key: 'name', label: 'By Name', icon: 'badge' },
                                        ].map(opt => (
                                            <button
                                                key={opt.key}
                                                onClick={() => { setSortKey(opt.key); setIsSortMenuOpen(false); }}
                                                className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-[#1e3a32] transition-colors ${sortKey === opt.key ? 'text-emerald-600 font-bold' : ''}`}
                                            >
                                                <span className="material-symbols-outlined text-[16px] text-gray-400">{opt.icon}</span>
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[700px] text-left">
                                <thead className="bg-gray-50/70 dark:bg-[#1e3a32]/50 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                    <tr>
                                        <th className="px-6 py-3 font-bold">Employee</th>
                                        <th className="px-6 py-3 font-bold text-center">Shifts</th>
                                        <th className="px-6 py-3 font-bold text-center">Hours</th>
                                        <th className="px-6 py-3 font-bold">Rate / hr</th>
                                        <th className="px-6 py-3 font-bold text-right">Total Pay</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-[#1e3a32]">
                                    {loading ? (
                                        <tr><td colSpan="5" className="py-16 text-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto" />
                                        </td></tr>
                                    ) : sorted.length === 0 ? (
                                        <tr><td colSpan="5" className="py-16 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-[#1e3a32] flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-2xl text-gray-400">receipt_long</span>
                                                </div>
                                                <p className="text-gray-500 dark:text-gray-400 font-medium">No completed shifts for this period</p>
                                            </div>
                                        </td></tr>
                                    ) : sorted.map(emp => (
                                        <tr key={emp.id} className="hover:bg-emerald-50/30 dark:hover:bg-[#1a362e] transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                                                        {emp.avatar_url
                                                            ? <img alt={emp.name} className="h-full w-full object-cover" src={emp.avatar_url} />
                                                            : <span className="font-bold text-gray-500 dark:text-gray-300">{emp.name.charAt(0).toUpperCase()}</span>
                                                        }
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold capitalize">{emp.name}</p>
                                                        <p className="text-xs text-gray-400 font-mono">#{emp.id.substring(0, 8)}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center rounded-lg bg-emerald-50 dark:bg-[#1e3a32] px-2.5 py-1 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                                                    {emp.shifts}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center font-medium">
                                                {Math.round(emp.totalHours * 10) / 10}h
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                                {formatVND(emp.rate)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="font-black text-emerald-700 dark:text-emerald-400">{formatVND(emp.totalPay)}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                {!loading && sorted.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gray-50 dark:bg-[#1e3a32] border-t-2 border-gray-200 dark:border-[#2a4e43]">
                                            <td className="px-6 py-4 text-sm font-black uppercase text-gray-500 dark:text-gray-400">Total ({sorted.length} employees)</td>
                                            <td className="px-6 py-4 text-center font-black">{summary.totalShifts}</td>
                                            <td className="px-6 py-4 text-center font-black">{Math.round(summary.totalHours * 10) / 10}h</td>
                                            <td className="px-6 py-4"></td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="inline-flex items-center font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg">
                                                    {formatVND(summary.totalPay)}
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
