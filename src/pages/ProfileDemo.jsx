import React, { useState } from 'react'
import { UserProfileModal } from '../components/UserProfileModal'

export function ProfileDemo() {
    const [isOpen, setIsOpen] = useState(true)

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen p-8 flex flex-col items-center justify-center">
            <h1 className="text-2xl font-bold mb-4">Profile Demo Page</h1>
            <button
                onClick={() => setIsOpen(true)}
                className="px-4 py-2 bg-primary rounded-lg text-neutral-900 font-bold"
            >
                Open Profile Modal
            </button>

            <UserProfileModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </div>
    )
}
