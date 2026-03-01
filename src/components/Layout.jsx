import React from 'react'
import { Header } from './Header'

export function Layout({ children }) {
    return (
        <div className="min-h-screen flex flex-col bg-background-light dark:bg-background-dark font-display text-neutral-800 dark:text-neutral-100">
            <Header />
            <main className="flex-1 flex justify-center w-full px-4 sm:px-6 py-8 lg:py-12">
                <div className="flex flex-col w-full max-w-[960px] gap-10">
                    {children}
                </div>
            </main>
        </div>
    )
}
