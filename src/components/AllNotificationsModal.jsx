import React from 'react'
import { createPortal } from 'react-dom'

function formatTimeAgo(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

function getNotificationIcon(type) {
    switch (type) {
        case 'role_request': return { icon: 'person_add', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', badge: 'REQUEST', badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };
        case 'swap_request': return { icon: 'swap_horiz', color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400', badge: 'SWAP', badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };
        case 'absence_request': return { icon: 'event_busy', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400', badge: 'ABSENCE', badgeColor: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
        case 'assignment_alert': return { icon: 'assignment_ind', color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400', badge: 'ASSIGNMENT', badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' };
        case 'swap_accepted': return { icon: 'check_circle', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400', badge: 'APPROVED', badgeColor: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
        case 'system': return { icon: 'settings', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', badge: 'SYSTEM', badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
        default: return { icon: 'notifications', color: 'bg-primary/20 text-primary-dark dark:text-primary', badge: 'INFO', badgeColor: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300' };
    }
}

export function AllNotificationsModal({ isOpen, onClose, unreadCount = 0, onMarkAllRead, onClearRead, notifications = [], onAccept, onReject, processingNotifId, onNotificationClick }) {
    if (!isOpen) return null

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-neutral-900/60 dark:bg-black/80 backdrop-blur-sm">
            <div className="bg-white dark:bg-neutral-800 w-full max-w-3xl rounded-[16px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ring-1 ring-white/10">
                <div className="flex items-center justify-between p-6 border-b border-neutral-100 dark:border-neutral-700 bg-white dark:bg-neutral-800">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white">All Notifications</h2>
                        {unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        {unreadCount > 0 && (
                            <button onClick={onMarkAllRead} className="text-sm font-semibold text-primary-dark dark:text-primary hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors">
                                Mark all as read
                            </button>
                        )}
                        {notifications.some(n => n.is_read) && (
                            <button onClick={onClearRead} className="text-sm font-semibold text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors flex items-center gap-1">
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                                Clear read
                            </button>
                        )}
                        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-white transition-colors p-1">
                            <span className="material-symbols-outlined text-2xl">close</span>
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 bg-neutral-50/30 dark:bg-neutral-900/20">
                    {notifications.length === 0 ? (
                        <div className="p-12 flex flex-col items-center text-center gap-3">
                            <div className="size-16 rounded-full bg-neutral-100 dark:bg-neutral-700/50 flex items-center justify-center text-neutral-400">
                                <span className="material-symbols-outlined text-3xl">notifications_off</span>
                            </div>
                            <div className="flex flex-col">
                                <p className="text-base font-bold text-neutral-900 dark:text-white">No notifications yet</p>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">When you get updates, they'll appear here.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 flex flex-col gap-3">
                            {notifications.map(notif => {
                                const style = getNotificationIcon(notif.type);
                                const isRoleRequest = notif.type === 'role_request' && !notif._handled && !notif.message?.includes('✅') && !notif.message?.includes('❌');
                                const isSwapOrAbsenceAction = (notif.type === 'swap_request' || notif.type === 'absence_request') && notif.reference_id;
                                const isHandledAction = notif._handled || notif.message?.includes('✅') || notif.message?.includes('❌') || notif.message?.includes('no longer valid');
                                const isProcessing = processingNotifId === notif.id;

                                return (
                                    <div
                                        key={notif.id}
                                        onClick={() => {
                                            if (!isRoleRequest) {
                                                onNotificationClick?.(notif);
                                                if (notif.action_url) onClose();
                                            }
                                        }}
                                        className={`bg-white dark:bg-neutral-800/80 p-4 rounded-xl border border-neutral-100 dark:border-neutral-700/50 hover:border-primary/30 dark:hover:border-primary/30 transition-all shadow-sm ${!notif.is_read ? 'ring-1 ring-primary/20' : ''} ${!isRoleRequest && notif.action_url ? 'cursor-pointer' : ''}`}
                                    >
                                        <div className="flex gap-4">
                                            <div className="relative">
                                                <div className={`size-12 rounded-full flex items-center justify-center shrink-0 ${style.color}`}>
                                                    <span className="material-symbols-outlined text-2xl">{style.icon}</span>
                                                </div>
                                                {!notif.is_read && (
                                                    <div className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-primary-dark dark:bg-primary ring-2 ring-white dark:ring-neutral-800"></div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-1">
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <p className={`text-base ${!notif.is_read ? 'font-bold text-neutral-900 dark:text-white' : 'font-semibold text-neutral-800 dark:text-neutral-200'}`}>
                                                                {notif.title}
                                                            </p>
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${style.badgeColor} tracking-wide`}>
                                                                {style.badge}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs font-medium text-neutral-400 whitespace-nowrap ml-4">{formatTimeAgo(notif.created_at)}</span>
                                                </div>
                                                <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed">
                                                    {notif.message}
                                                </p>

                                                {/* Accept/Reject buttons for role requests */}
                                                {isRoleRequest && (
                                                    <div className="flex gap-3 mt-3">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onAccept?.(notif); }}
                                                            disabled={isProcessing}
                                                            className="px-5 py-2 bg-primary hover:bg-primary-dark text-neutral-900 text-sm font-bold rounded-lg transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {isProcessing ? (
                                                                <span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>
                                                            ) : (
                                                                <span className="material-symbols-outlined text-lg">check</span>
                                                            )}
                                                            Accept
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onReject?.(notif); }}
                                                            disabled={isProcessing}
                                                            className="px-5 py-2 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-600 dark:text-neutral-300 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <span className="material-symbols-outlined text-lg">close</span>
                                                            Reject
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Accept/Reject buttons for swap/absence requests */}
                                                {isSwapOrAbsenceAction && (
                                                    <div className="flex gap-3 mt-3">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onAccept?.(notif); }}
                                                            disabled={isProcessing || isHandledAction}
                                                            className={`px-5 py-2 ${isProcessing || isHandledAction ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500' : 'bg-emerald-500 hover:bg-emerald-600 text-white'} text-sm font-bold rounded-lg transition-colors shadow-sm flex items-center gap-2 disabled:cursor-not-allowed`}
                                                        >
                                                            {isProcessing ? (
                                                                <span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>
                                                            ) : (
                                                                <span className="material-symbols-outlined text-lg">check</span>
                                                            )}
                                                            {notif.type === 'swap_request' ? (notif._swapOfferCount > 1 ? 'Select Swap Shift' : 'Accept') : 'Accept'}
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onReject?.(notif); }}
                                                            disabled={isProcessing || isHandledAction}
                                                            className={`px-5 py-2 ${isProcessing || isHandledAction ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 opacity-70' : 'bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-600 dark:text-neutral-300'} text-sm font-bold rounded-lg transition-colors flex items-center gap-2 disabled:cursor-not-allowed`}
                                                        >
                                                            <span className="material-symbols-outlined text-lg">close</span>
                                                            Reject
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    )
}
