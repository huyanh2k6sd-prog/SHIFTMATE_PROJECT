import React, { useState } from 'react'
import { ShiftOptionsMenu } from './ShiftOptionsMenu'
import { getDurationHours, formatTime } from '../utils/timeFormat'

// Helper to get day name from date string
const getDayKey = (dateString) => {
    const d = new Date(dateString);
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    return days[d.getDay()];
};

// Helper to get date number
const getDateNumber = (dateString) => {
    const d = new Date(dateString);
    return d.getDate();
};

export function ManagerAssignmentGrid({ shifts = [], activeRole, weekDays = [], onOpenAssignedStaffModal, onOpenEditModal, onOpenDeleteModal }) {
    const [activeMenuId, setActiveMenuId] = useState(null);

    const toggleMenu = (e, id) => {
        e.stopPropagation();
        setActiveMenuId(activeMenuId === id ? null : id);
    };

    const handleAction = (action, shiftData) => {
        setActiveMenuId(null);
        if (action === 'assigned_staff') onOpenAssignedStaffModal(shiftData);
        if (action === 'edit') onOpenEditModal(shiftData);
        if (action === 'delete') onOpenDeleteModal(shiftData);
    };

    if (!activeRole) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-64 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl w-full m-4">
                <div className="bg-gray-100 dark:bg-white/5 p-4 rounded-full mb-4">
                    <span className="material-symbols-outlined text-4xl text-gray-400 dark:text-gray-500">work_off</span>
                </div>
                <h3 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">No Role Selected</h3>
                <p className="text-text-secondary-light dark:text-text-secondary-dark max-w-md mx-auto">
                    Please select a role from the sidebar or create a new role to manage shifts and assignments.
                </p>
            </div>
        );
    }

    // Group shifts by fullDate
    const shiftsByDate = {};
    weekDays.forEach(day => { shiftsByDate[day.fullDate] = []; });
    shifts.forEach(shift => {
        if (shiftsByDate[shift.date]) {
            shiftsByDate[shift.date].push(shift);
        }
    });

    const daysConfig = weekDays;

    return (
        <div className="min-w-[1000px] h-full flex flex-row">
            {daysConfig.map((day) => (
                <div key={day.key} className="flex-1 min-w-[140px] border-r border-gray-100 dark:border-white/5 flex flex-col">
                    <div className="p-4 text-center border-b border-gray-100 dark:border-white/5 bg-background-light/30 dark:bg-background-dark/30">
                        <p className="text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider mb-1">{day.label}</p>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-lg font-bold ${day.isToday
                            ? 'bg-primary text-text-primary-light shadow-sm'
                            : 'text-text-primary-light dark:text-text-primary-dark'
                            }`}>
                            {day.dateNum}
                        </div>
                    </div>
                    <div className="flex-1 p-3 flex flex-col gap-3">
                        {(shiftsByDate[day.fullDate] || []).map(shift => {
                            const assignedCount = shift.assigned_count || 0;
                            const isFullyAssigned = assignedCount >= shift.required_staff;
                            const duration = getDurationHours(shift.start_time, shift.end_time);

                            // Transform shift data to match modal expectations
                            const modalShiftData = {
                                id: shift.id,
                                name: shift.name,
                                date: shift.date,
                                startTime: formatTime(shift.start_time),
                                endTime: formatTime(shift.end_time),
                                requiredStaff: shift.required_staff,
                                role_id: shift.role_id,
                                group_id: shift.group_id,
                                assignedStaff: assignedCount
                            };

                            return (
                                <div key={shift.id} className="relative">
                                    <div
                                        onClick={(e) => toggleMenu(e, shift.id)}
                                        className={`p-3 rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer group min-h-[100px] flex flex-col justify-between w-full ${isFullyAssigned
                                            ? 'bg-shift-green-bg dark:bg-surface-dark border-green-200 dark:border-green-900/30'
                                            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-sm text-text-primary-light dark:text-text-primary-dark line-clamp-1" title={shift.name}>{shift.name}</span>
                                            {isFullyAssigned ? (
                                                <span className="material-symbols-outlined bg-[#064e3b] rounded-full text-white text-[16px] p-0.5" style={{ fontVariationSettings: "'wght' 700" }}>check</span>
                                            ) : (
                                                <span className="material-symbols-outlined text-red-500 dark:text-red-400 text-[16px]">warning</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark mb-2">
                                            {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                                        </div>
                                        <div className="flex items-center justify-between mt-auto">
                                            <span className="bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded text-[10px] font-semibold text-text-secondary-light dark:text-text-secondary-dark">{duration.toFixed(1)}h</span>
                                            <span className={`text-[10px] font-bold ${isFullyAssigned
                                                ? 'text-shift-green-text dark:text-mint-green'
                                                : 'text-red-600 dark:text-red-400'
                                                }`}>
                                                {assignedCount}/{shift.required_staff} assigned
                                            </span>
                                        </div>
                                    </div>
                                    {activeMenuId === shift.id && (
                                        <ShiftOptionsMenu
                                            mode="assignment"
                                            onClose={() => setActiveMenuId(null)}
                                            onAssignedStaff={() => handleAction('assigned_staff', modalShiftData)}
                                            onEdit={() => handleAction('edit', modalShiftData)}
                                            onDelete={() => handleAction('delete', modalShiftData)}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
