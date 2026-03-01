import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import landingLogo from '../assets/logo.jpg';

const rawHTML = `<style>
        .glass-panel {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
        }
        .glass-card {
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.5);
        }
        .text-glow {
            text-shadow: 0 0 20px rgba(51, 224, 165, 0.3);
        }
        .calendar-scroll::-webkit-scrollbar {
            height: 6px;
            width: 6px;
        }
        .calendar-scroll::-webkit-scrollbar-track {
            background: rgba(255,255,255,0.05);
        }
        .calendar-scroll::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.2);
            border-radius: 3px;
        }
        .progress-container {
            position: fixed;
            top: 0;
            z-index: 60;
            width: 100%;
            height: 4px;
            background: #e2e8f0;
        }
        .progress-bar {
            height: 100%;
            background: #33E0A5;
            width: 0%;
            transition: width 0.3s ease-out;
        }
        .section-label {
            position: absolute;
            top: 6px;
            right: 0;
            transform: translateX(50%);
            background: #0A1929;
            color: #33E0A5;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            white-space: nowrap;
        }
        html {
            scroll-behavior: smooth;
        }
        @keyframes fadeUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .animate-fade-up {
            animation: fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            opacity: 0;}.animate-fade-up.delay-200 {
            animation-delay: 0.2s;
        }
    </style>
<div class="relative flex min-h-screen w-full flex-col overflow-x-hidden">
<div class="progress-container shadow-md" id="progressContainer">
<div class="progress-bar relative" id="progressBar">
<div class="section-label" id="progressLabel"></div>
</div>
</div>
<header class="fixed top-[4px] w-full z-50 flex items-center justify-between bg-deep-blue/90 backdrop-blur-md px-6 py-4 lg:px-20 shadow-lg">
<div class="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" id="logo-redirect-home">
<h2 class="text-2xl font-black tracking-tight text-white">Shift<span class="text-primary">Mate</span></h2>
</div>
<nav class="hidden md:flex flex-1 justify-center gap-8">
<a class="text-primary font-bold hover:text-primary text-sm transition-all" href="#" id="nav-home">Home</a>
<a class="text-slate-300 font-medium hover:text-primary text-sm transition-all" href="#solutions" id="nav-solutions">Solutions</a>
<a class="text-slate-300 font-medium hover:text-primary text-sm transition-all" href="#features" id="nav-features">Features</a>
<a class="text-slate-300 font-medium hover:text-primary text-sm transition-all" href="#contact" id="nav-contact">Contact us</a>
</nav>
<div class="flex gap-4">
<button class="hidden sm:flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white hover:text-primary transition-colors">
                    Sign In
                </button>
<button class="flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-bold text-deep-blue shadow-[0_0_20px_rgba(51,224,165,0.3)] hover:brightness-110 hover:shadow-[0_0_30px_rgba(51,224,165,0.5)] transition-all transform hover:-translate-y-0.5">
                    Sign Up
                </button>
</div>
</header>
<main class="flex-grow pt-[80px]">
<section class="relative px-6 py-20 lg:px-20 lg:py-32 overflow-hidden bg-deep-blue bg-hero-pattern bg-cover bg-fixed bg-center" id="home">
<div class="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] -mr-40 -mt-40 pointer-events-none"></div>
<div class="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[100px] -ml-20 -mb-20 pointer-events-none"></div>
<div class="container mx-auto relative z-10">
<div class="grid gap-16 lg:grid-cols-2 lg:items-center">
<div class="flex flex-col gap-8 lg:items-start items-center text-center lg:text-left">
<div class="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-primary shadow-[0_0_10px_rgba(51,224,165,0.2)] backdrop-blur-sm self-center lg:self-start">
<span class="relative flex h-2 w-2">
<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
<span class="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
</span>
                                Intelligent Scheduling
                            </div>
<div class="w-full text-center">
<h1 class="text-6xl font-black leading-tight tracking-tight text-white sm:text-7xl lg:text-8xl w-full text-center pb-2">
                                    Shift<span class="text-primary">Mate</span>
                                </h1>
<h2 class="text-xl sm:text-2xl font-bold w-full text-center mt-2">
<span class="text-primary text-glow">Smart Shift</span>
<span class="text-white"> - Smooth Operations</span>
</h2>
</div>
<p class="max-w-xl text-lg text-slate-300 leading-relaxed font-light mx-auto text-center">
                                A smart scheduling platform engineered for cafes and restaurants. Transform chaos into calculated efficiency with AI-driven rosters.
                            </p>
<div class="flex flex-col sm:flex-row gap-4 mt-2 justify-center w-full">
<button class="h-14 px-8 rounded-lg bg-primary text-deep-blue font-bold text-lg shadow-[0_4px_14px_0_rgba(51,224,165,0.39)] hover:shadow-[0_6px_20px_rgba(51,224,165,0.23)] hover:-translate-y-1 transition-all">
                                    Get Started here
                                </button>
</div>
</div>
<div class="relative lg:h-[640px] w-full flex items-center justify-center perspective-[2000px]">
<div class="relative z-20 w-full max-w-4xl rounded-3xl glass-panel p-6 shadow-2xl transform rotate-y-[-8deg] rotate-x-[4deg] border border-white/20">
<div class="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
<div class="flex items-center gap-3">
<div class="w-3 h-3 rounded-full bg-red-500"></div>
<div class="w-3 h-3 rounded-full bg-yellow-500"></div>
<div class="w-3 h-3 rounded-full bg-green-500"></div>
</div>
<div class="flex items-center gap-2 text-white/80 font-semibold">
<button class="p-1 hover:bg-white/10 rounded active:scale-95 transition-all"><span class="material-symbols-outlined text-white/60 text-sm">chevron_left</span></button>
<div class="text-sm uppercase tracking-widest px-2">Oct 16 - Oct 22, 2023</div>
<button class="p-1 hover:bg-white/10 rounded active:scale-95 transition-all"><span class="material-symbols-outlined text-white/60 text-sm">chevron_right</span></button>
</div>
<div class="flex gap-2">
<span class="px-3 py-1.5 rounded-lg bg-white/5 shadow text-xs font-bold text-white">Availability</span>
<span class="px-3 py-1.5 rounded-lg bg-primary text-deep-blue text-xs font-black shadow-[0_0_15px_rgba(51,224,165,0.4)]">Assignment</span>
</div>
</div>
<div class="flex flex-row overflow-x-auto calendar-scroll rounded-xl border border-white/10 bg-black/10">
    <div class="flex-1 min-w-[120px] border-r border-white/10 flex flex-col bg-white/[0.02]">
        <div class="p-3 text-center border-b border-white/10 bg-white/5">
            <p class="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Mon</p>
            <div class="w-7 h-7 rounded-full flex items-center justify-center mx-auto text-sm font-bold text-deep-blue bg-primary shadow-[0_0_10px_rgba(51,224,165,0.5)]">16</div>
        </div>
        <div class="flex-1 p-2.5 flex flex-col gap-2.5 h-[340px] overflow-y-auto calendar-scroll">
            <div class="p-3 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between min-h-[100px] w-full">
                <div class="flex justify-between items-start mb-1">
                    <span class="font-bold text-sm text-white line-clamp-1" title="Opening">Opening</span>
                    <span class="material-symbols-outlined bg-green-500/20 rounded-full text-green-400 text-[14px] p-0.5" style="font-variation-settings: 'wght' 700">check</span>
                </div>
                <div class="text-[10px] text-primary/80 mb-2">06:00 AM - 12:00 PM</div>
                <div class="flex items-center justify-between mt-auto">
                    <span class="bg-white/10 px-2 py-0.5 rounded text-[10px] font-semibold text-primary/70">6.0h</span>
                    <span class="text-[10px] font-bold text-primary">2/2 assigned</span>
                </div>
            </div>
            <div class="p-3 rounded-xl bg-red-900/20 border border-red-500/30 hover:bg-red-900/30 hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between min-h-[100px] w-full">
                <div class="flex justify-between items-start mb-1">
                    <span class="font-bold text-sm text-white line-clamp-1" title="Afternoon">Afternoon</span>
                    <span class="material-symbols-outlined text-red-400 text-[16px]">warning</span>
                </div>
                <div class="text-[10px] text-white/50 mb-2">12:00 PM - 06:00 PM</div>
                <div class="flex items-center justify-between mt-auto">
                    <span class="bg-white/10 px-2 py-0.5 rounded text-[10px] font-semibold text-white/70">6.0h</span>
                    <span class="text-[10px] font-bold text-red-400">1/3 assigned</span>
                </div>
            </div>
        </div>
    </div>
    <div class="flex-1 min-w-[120px] border-r border-white/10 flex flex-col bg-white/[0.02]">
        <div class="p-3 text-center border-b border-white/10 bg-white/5">
            <p class="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Tue</p>
            <div class="w-7 h-7 rounded-full flex items-center justify-center mx-auto text-sm font-bold text-white">17</div>
        </div>
        <div class="flex-1 p-2.5 flex flex-col gap-2.5 h-[340px] overflow-y-auto calendar-scroll">
            <div class="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:shadow-lg hover:border-white/20 transition-all cursor-pointer flex flex-col justify-between min-h-[100px] w-full">
                <div class="flex justify-between items-start mb-1">
                    <span class="font-bold text-sm text-white line-clamp-1" title="Kitchen Prep">Kitchen Prep</span>
                    <span class="material-symbols-outlined bg-green-500/20 rounded-full text-green-400 text-[14px] p-0.5" style="font-variation-settings: 'wght' 700">check</span>
                </div>
                <div class="text-[10px] text-white/50 mb-2">07:00 AM - 03:00 PM</div>
                <div class="flex items-center justify-between mt-auto">
                    <span class="bg-white/10 px-2 py-0.5 rounded text-[10px] font-semibold text-white/70">8.0h</span>
                    <span class="text-[10px] font-bold text-primary">4/4 assigned</span>
                </div>
            </div>
        </div>
    </div>
    <div class="flex-1 min-w-[120px] border-r border-white/10 flex flex-col bg-white/[0.02]">
        <div class="p-3 text-center border-b border-white/10 bg-white/5">
            <p class="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Wed</p>
            <div class="w-7 h-7 rounded-full flex items-center justify-center mx-auto text-sm font-bold text-white">18</div>
        </div>
        <div class="flex-1 p-2.5 flex flex-col gap-2.5 h-[340px] overflow-y-auto calendar-scroll">
            <div class="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:shadow-lg hover:border-white/20 transition-all cursor-pointer flex flex-col justify-between min-h-[100px] w-full">
                <div class="flex justify-between items-start mb-1">
                    <span class="font-bold text-sm text-white line-clamp-1" title="Manager Shift">Manager Shift</span>
                    <span class="material-symbols-outlined bg-green-500/20 rounded-full text-green-400 text-[14px] p-0.5" style="font-variation-settings: 'wght' 700">check</span>
                </div>
                <div class="text-[10px] text-white/50 mb-2">08:00 AM - 04:00 PM</div>
                <div class="flex items-center justify-between mt-auto">
                    <span class="bg-white/10 px-2 py-0.5 rounded text-[10px] font-semibold text-white/70">8.0h</span>
                    <span class="text-[10px] font-bold text-primary">1/1 assigned</span>
                </div>
            </div>
            <div class="p-3 rounded-xl border-2 border-dashed border-white/20 hover:border-white/40 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[100px] w-full group opacity-60">
                <span class="material-symbols-outlined text-white/40 text-[24px] group-hover:scale-110 group-hover:text-white/60 transition-all">add_circle</span>
                <span class="text-[10px] text-white/40 mt-1 font-semibold group-hover:text-white/60 transition-colors">Add Shift</span>
            </div>
        </div>
    </div>
    <div class="flex-1 min-w-[120px] border-r border-white/10 flex flex-col bg-white/[0.02]">
        <div class="p-3 text-center border-b border-white/10 bg-white/5">
            <p class="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Thu</p>
            <div class="w-7 h-7 rounded-full flex items-center justify-center mx-auto text-sm font-bold text-white">19</div>
        </div>
        <div class="flex-1 p-2.5 flex flex-col gap-2.5 h-[340px] overflow-y-auto calendar-scroll">
            <div class="p-3 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between min-h-[100px] w-full">
                <div class="flex justify-between items-start mb-1">
                    <span class="font-bold text-sm text-white line-clamp-1" title="Opening">Opening</span>
                    <span class="material-symbols-outlined bg-green-500/20 rounded-full text-green-400 text-[14px] p-0.5" style="font-variation-settings: 'wght' 700">check</span>
                </div>
                <div class="text-[10px] text-primary/80 mb-2">06:00 AM - 12:00 PM</div>
                <div class="flex items-center justify-between mt-auto">
                    <span class="bg-white/10 px-2 py-0.5 rounded text-[10px] font-semibold text-primary/70">6.0h</span>
                    <span class="text-[10px] font-bold text-primary">2/2 assigned</span>
                </div>
            </div>
        </div>
    </div>
    <div class="flex-1 min-w-[120px] border-r border-white/10 flex flex-col bg-white/[0.02]">
        <div class="p-3 text-center border-b border-white/10 bg-white/5">
            <p class="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Fri</p>
            <div class="w-7 h-7 rounded-full flex items-center justify-center mx-auto text-sm font-bold text-white">20</div>
        </div>
        <div class="flex-1 p-2.5 flex flex-col gap-2.5 h-[340px] overflow-y-auto calendar-scroll">
            <div class="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:shadow-lg hover:border-white/20 transition-all cursor-pointer flex flex-col justify-between min-h-[100px] w-full">
                <div class="flex justify-between items-start mb-1">
                    <span class="font-bold text-sm text-white line-clamp-1" title="Event Night">Event Night</span>
                    <span class="material-symbols-outlined text-red-400 text-[16px]">warning</span>
                </div>
                <div class="text-[10px] text-white/50 mb-2">05:00 PM - 12:00 AM</div>
                <div class="flex items-center justify-between mt-auto">
                    <span class="bg-white/10 px-2 py-0.5 rounded text-[10px] font-semibold text-white/70">7.0h</span>
                    <span class="text-[10px] font-bold text-orange-400">6/8 assigned</span>
                </div>
            </div>
        </div>
    </div>
    <div class="flex-1 min-w-[120px] border-r border-white/10 flex flex-col bg-white/[0.02]">
        <div class="p-3 text-center border-b border-white/10 bg-white/5">
            <p class="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Sat</p>
            <div class="w-7 h-7 rounded-full flex items-center justify-center mx-auto text-sm font-bold text-white">21</div>
        </div>
        <div class="flex-1 p-2.5 flex flex-col gap-2.5 h-[340px] overflow-y-auto calendar-scroll">
            <div class="p-3 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between min-h-[100px] w-full">
                <div class="flex justify-between items-start mb-1">
                    <span class="font-bold text-sm text-white line-clamp-1" title="Weekend Rush">Weekend Rush</span>
                    <span class="material-symbols-outlined bg-green-500/20 rounded-full text-green-400 text-[14px] p-0.5" style="font-variation-settings: 'wght' 700">check</span>
                </div>
                <div class="text-[10px] text-primary/80 mb-2">10:00 AM - 08:00 PM</div>
                <div class="flex items-center justify-between mt-auto">
                    <span class="bg-white/10 px-2 py-0.5 rounded text-[10px] font-semibold text-primary/70">10.0h</span>
                    <span class="text-[10px] font-bold text-primary">5/5 assigned</span>
                </div>
            </div>
        </div>
    </div>
    <div class="flex-1 min-w-[120px] flex flex-col bg-white/[0.02]">
        <div class="p-3 text-center border-b border-white/10 bg-white/5">
            <p class="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Sun</p>
            <div class="w-7 h-7 rounded-full flex items-center justify-center mx-auto text-sm font-bold text-white">22</div>
        </div>
        <div class="flex-1 p-2.5 flex flex-col gap-2.5 h-[340px] overflow-y-auto calendar-scroll">
            <div class="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:shadow-lg hover:border-white/20 transition-all cursor-pointer flex flex-col justify-between min-h-[100px] w-full">
                <div class="flex justify-between items-start mb-1">
                    <span class="font-bold text-sm text-white line-clamp-1" title="Morning Shift">Morning Shift</span>
                    <span class="material-symbols-outlined bg-green-500/20 rounded-full text-green-400 text-[14px] p-0.5" style="font-variation-settings: 'wght' 700">check</span>
                </div>
                <div class="text-[10px] text-white/50 mb-2">06:00 AM - 02:00 PM</div>
                <div class="flex items-center justify-between mt-auto">
                    <span class="bg-white/10 px-2 py-0.5 rounded text-[10px] font-semibold text-white/70">8.0h</span>
                    <span class="text-[10px] font-bold text-primary">3/3 assigned</span>
                </div>
            </div>
        </div>
    </div>
</div>
<div class="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/50">
<div>Total Hours: <span class="text-white font-mono">342h</span></div>
<div class="flex items-center gap-2">
<span class="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span> Budget On Track
                                    </div>
</div>
<div class="absolute -bottom-6 -right-6 bg-primary text-deep-blue p-4 rounded-2xl shadow-xl flex items-center justify-center transform hover:scale-110 transition-transform cursor-pointer z-30">
<span class="material-symbols-outlined text-2xl font-bold">add</span>
</div>
</div>
<div class="absolute z-10 top-10 right-10 w-64 h-64 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full blur-[80px] opacity-40 animate-pulse"></div>
<div class="absolute z-0 bottom-0 left-10 w-72 h-72 bg-gradient-to-tr from-primary to-emerald-400 rounded-full blur-[80px] opacity-30"></div>
<div class="absolute z-30 -left-12 bottom-20 bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-2xl shadow-2xl animate-[bounce_3s_infinite]">
<div class="flex items-center gap-3">
<div class="bg-green-500/20 p-2 rounded-lg text-green-400">
<span class="material-symbols-outlined">trending_up</span>
</div>
<div>
<div class="text-xs text-white/60 uppercase font-bold tracking-wider">Efficiency</div>
</div>
</div>
</div>
</div>
</div>
</div>
</section>
<section class="bg-white relative py-20 px-6 lg:px-20 overflow-hidden" id="solutions">
<div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>
<div class="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-b from-primary/5 to-transparent rounded-full blur-3xl -mr-40 -mt-40 pointer-events-none"></div>
<div class="container mx-auto relative z-10">
<div class="text-center mb-16">
<h2 class="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">Why ShiftMate exists</h2>
</div>
<div class="grid md:grid-cols-2 gap-8 lg:gap-16 items-stretch">
<div class="bg-red-50 rounded-3xl p-8 border border-red-100 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 animate-fade-up">
<div class="inline-block px-3 py-1 bg-red-100 text-red-600 text-xs font-bold uppercase rounded mb-6 tracking-wide border border-red-200">The Old Way</div>
<h3 class="text-2xl font-bold text-slate-800 mb-8 flex items-center gap-3">
<span class="material-symbols-outlined text-red-500">warning</span>
                                Chaos &amp; Spreadsheets
                            </h3>
<ul class="space-y-6">
<li class="flex items-start gap-4 group">
<div class="mt-1 flex-shrink-0 size-8 flex items-center justify-center rounded-full bg-red-100 text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors border border-red-200">
<span class="material-symbols-outlined text-lg">close</span>
</div>
<div>
<h4 class="font-bold text-slate-800 text-lg">Endless Phone Tags</h4>
<p class="text-slate-500 text-sm mt-1">Calling staff to cover shifts last minute is a nightmare.</p>
</div>
</li>
<li class="flex items-start gap-4 group">
<div class="mt-1 flex-shrink-0 size-8 flex items-center justify-center rounded-full bg-red-100 text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors border border-red-200">
<span class="material-symbols-outlined text-lg">close</span>
</div>
<div>
<h4 class="font-bold text-slate-800 text-lg">Payroll Errors</h4>
<p class="text-slate-500 text-sm mt-1">Manual data entry leads to mistakes and unhappy staff.</p>
</div>
</li>
<li class="flex items-start gap-4 group">
<div class="mt-1 flex-shrink-0 size-8 flex items-center justify-center rounded-full bg-red-100 text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors border border-red-200">
<span class="material-symbols-outlined text-lg">close</span>
</div>
<div>
<h4 class="font-bold text-slate-800 text-lg">Burnt Out Managers</h4>
<p class="text-slate-500 text-sm mt-1">Spending 10+ hours a week just on scheduling.</p>
</div>
</li>
</ul>
</div>
<div class="bg-gradient-to-br from-primary/5 to-emerald-500/5 rounded-3xl p-8 border border-primary/20 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 relative overflow-hidden transform bg-white animate-fade-up delay-200">
<div class="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
<div class="inline-block px-3 py-1 bg-primary/20 text-primary-dark text-xs font-bold uppercase rounded mb-6 tracking-wide border border-primary/30">The ShiftMate Way</div>
<h3 class="text-2xl font-bold text-slate-900 mb-8 flex items-center gap-3">
<span class="material-symbols-outlined text-primary-dark">auto_awesome</span>
                                Order &amp; Automation
                            </h3>
<ul class="space-y-6 relative z-10">
<li class="flex items-start gap-4 group">
<div class="mt-1 flex-shrink-0 size-8 flex items-center justify-center rounded-full bg-primary text-deep-blue shadow-md">
<span class="material-symbols-outlined text-lg font-bold">check</span>
</div>
<div>
<h4 class="font-bold text-slate-900 text-lg">Instant Replacements</h4>
<p class="text-slate-600 text-sm mt-1">Find available staff instantly with AI-powered suggestions.</p>
</div>
</li>
<li class="flex items-start gap-4 group">
<div class="mt-1 flex-shrink-0 size-8 flex items-center justify-center rounded-full bg-primary text-deep-blue shadow-md">
<span class="material-symbols-outlined text-lg font-bold">check</span>
</div>
<div>
<h4 class="font-bold text-slate-900 text-lg">Seamless Sync</h4>
<p class="text-slate-600 text-sm mt-1">Timesheets sync directly to payroll. Zero manual entry.</p>
</div>
</li>
<li class="flex items-start gap-4 group">
<div class="mt-1 flex-shrink-0 size-8 flex items-center justify-center rounded-full bg-primary text-deep-blue shadow-md">
<span class="material-symbols-outlined text-lg font-bold">check</span>
</div>
<div>
<h4 class="font-bold text-slate-900 text-lg">Reclaim Your Time</h4>
<p class="text-slate-600 text-sm mt-1">Create optimized schedules in minutes, not days.</p>
</div>
</li>
</ul>
</div>
</div>
</div>
</section>
<section class="py-24 px-6 lg:px-20 bg-deep-blue relative overflow-hidden" id="features">
<div class="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
<div class="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
<div class="container mx-auto relative z-10">
<div class="text-center max-w-3xl mx-auto mb-16">
<h2 class="text-3xl font-black text-white sm:text-5xl mb-6">Everything you need to <br/><span class="text-primary block mt-2">scale operations</span></h2>
<p class="text-lg text-slate-400">Robust tools designed for the dynamic needs of modern hospitality businesses.</p>
</div>
<div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
<div class="group relative flex flex-col rounded-2xl bg-white p-6 transition-all hover:-translate-y-2 hover:shadow-[0_10px_40px_rgba(255,255,255,0.1)] overflow-hidden">
<div class="aspect-video w-full overflow-hidden rounded-lg bg-slate-100 mb-6 relative group-hover:ring-2 group-hover:ring-primary/50 transition-all">
<div class="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuCBSj4ouW6vsE_fiGTMTvMnPmpXkl1yiK9sE5mXNmuANCTkizhuv__h0K-rsFCYEP418X9ZdnnjZjWFjLzggPSRVsoNT8h7WZCX2EYs3P5-U3hNi4XyIaYyqUTtf1jNC5v_1A22uZo5fJNIZ_OnEH-UrdNI55pHbhKIdniKcN__xVrHhaQHdQx55SC3KQNtAyT-KWF8opjBpCJnwy5mOE06-uEy1HxplIttkIvCJZ7rChLAeP1O0vpp77ML3VqMAu9w4je_gTDYNFw')"></div>
</div>
<h3 class="text-xl font-bold text-deep-blue mb-2 text-center">Automated Scheduling</h3>
<p class="text-sm text-slate-600 leading-relaxed text-center">AI-driven roster generation that respects staff availability, skills, and labor laws instantly.</p>
</div>
<div class="group relative flex flex-col rounded-2xl bg-white p-6 transition-all hover:-translate-y-2 hover:shadow-[0_10px_40px_rgba(255,255,255,0.1)] overflow-hidden">
<div class="aspect-video w-full overflow-hidden rounded-lg bg-slate-100 mb-6 relative group-hover:ring-2 group-hover:ring-primary/50 transition-all">
<div class="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuC8FhOsptwJcpeLTsWl__UacXLSLhS6RNUvvcpSWSAFef981iXYOC0itFwO7_9KJv1bYNqT7pKukDf6iLReC2GlZP5JfYjhni2NFa2r-bcI_j3KQ7KkPjh2l0mcNCghidWaD-bsYGgLubMa5ZZhTBM_MOzh0oNSE3XjNl9dv_rVxHPcxQndWBMEl4zg6jboxFb4HWy-xECrM7JuTyleC-AKEa9fOSE2Qn9ascP8VZwxpKCG_xjFHgvAQ25vglde9fqKlJ2OavcsI6U')"></div>
</div>
<h3 class="text-xl font-bold text-deep-blue mb-2 text-center">Real-Time Availability</h3>
<p class="text-sm text-slate-600 leading-relaxed text-center">Live updates on who can work. Approve time-off and handle last-minute changes effortlessly.</p>
</div>
<div class="group relative flex flex-col rounded-2xl bg-white p-6 transition-all hover:-translate-y-2 hover:shadow-[0_10px_40px_rgba(255,255,255,0.1)] overflow-hidden">
<div class="aspect-video w-full overflow-hidden rounded-lg bg-slate-100 mb-6 relative group-hover:ring-2 group-hover:ring-primary/50 transition-all">
<div class="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuDIfGvyfM7RoxtCYmIntjmajVv9iFTlFKHipZEKAN24tE3Xa0mp-Yne93Mi0WOeRakvADf1KaPeQ42j9tPQAIjkO-U8sqqF2hCft-p9zm0gNGsFss2HwXPqQD1PMSHy5KPosjnT4zlVpmNXS-MH8HUr3mUcNbA2iHT0jB5rNCqm2uk8Uy3Od4PUorT8SXZeDSPzGxrR21s4f5sx3Qt-gfRDJTADGAjo9at4iP6grjqwORCSvGlpNXW4W1uCMZHDgpbLeF0vagH32Qc')"></div>
</div>
<h3 class="text-xl font-bold text-deep-blue mb-2 text-center">Shift Swaps</h3>
<p class="text-sm text-slate-600 leading-relaxed text-center">Empower staff to trade shifts via the mobile app with one-click manager approval flows.</p>
</div>
<div class="group relative flex flex-col rounded-2xl bg-white p-6 transition-all hover:-translate-y-2 hover:shadow-[0_10px_40px_rgba(255,255,255,0.1)] overflow-hidden">
<div class="aspect-video w-full overflow-hidden rounded-lg bg-slate-100 mb-6 relative group-hover:ring-2 group-hover:ring-primary/50 transition-all">
<div class="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuAbzD8Udgg2G6F-C813-i6A11PzOxMBJKfluHkUyKHdsYqbARuTBH6IkjT-6fxXXfnjrfGj6WEVFdNECHt0OIQFUDpofXKrUpq4ddM1-WqPP2BJGh9Up16sqGlK6rphYzCWiMcx5OA1jOxP7xvUJsiZNsXJ63wbVEar3vffuRkUHsJAfAjSlzOvEq65FR--uOX4-HgtWn-eC_4o24U5EWdNlbxjPqJtIcg7wLRSh_kA2qxRVP8igSTWOkfQIBzk4L5LlL8xhqwIENA')"></div>
</div>
<h3 class="text-xl font-bold text-deep-blue mb-2 text-center">Payroll Tracking</h3>
<p class="text-sm text-slate-600 leading-relaxed text-center">Automatic hour tracking and overtime calculations exported directly to your payroll provider.</p>
</div>
</div>
</div>
</section>
<section class="py-24 px-6 lg:px-20 bg-slate-50 border-t border-slate-200">
<div class="container mx-auto">
<div class="relative overflow-hidden rounded-3xl bg-deep-blue px-6 py-16 md:py-20 text-center shadow-2xl">
<div class="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-[100px] -mr-20 -mt-20"></div>
<div class="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/30 rounded-full blur-[100px] -ml-20 -mb-20"></div>
<div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
<div class="relative z-10">
<h2 class="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">Ready to streamline your shifts?</h2>
<p class="text-slate-300 text-lg max-w-2xl mx-auto mb-10">
                                Join us right now to help you save time and keep your business <br class="hidden sm:block"/>
<span class="inline-block sm:inline">running</span><br class="sm:hidden"/> <span class="inline-block sm:inline">smoothly</span>
</p>
<div class="flex flex-col gap-2 justify-center items-center">
<button class="h-14 px-10 rounded-lg bg-primary text-deep-blue font-bold text-lg hover:brightness-110 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/30 transition-all w-full sm:w-auto">
                                    Try Now
                                </button>
<span class="text-white/60 text-xs font-medium mt-1">No credit card required</span>
</div>
</div>
</div>
</div>
</section>
</main>
<footer class="bg-white border-t border-slate-200" id="contact">
<div class="py-16 px-6 lg:px-20 border-b border-slate-100">
<div class="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
<div class="space-y-6">
<div class="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" id="logo-redirect-home">
<h3 class="text-xl font-bold text-slate-900">Shift<span class="text-primary">Mate</span></h3>
</div>
<div class="space-y-1">
<p class="text-slate-600 font-bold">Smart Shift. Smooth Operations</p>
<p class="text-slate-500">Designing the future of hospitality work</p>
</div>
</div>
<div class="space-y-6">
<h4 class="text-lg font-bold text-deep-blue">Product</h4>
<ul class="space-y-4">
<li><a class="text-slate-500 hover:text-primary transition-colors" href="#solutions">Solutions</a></li>
<li><a class="text-slate-500 hover:text-primary transition-colors" href="#features">Features</a></li>
</ul>
</div>
<div class="space-y-6">
<h4 class="text-lg font-bold text-deep-blue">Contact us</h4>
<ul class="space-y-4 text-slate-500">
<li class="flex items-center gap-2">
<span class="font-semibold">📧 Email:</span> support@shiftmate.com
                            </li>
<li class="flex items-center gap-2">
<span class="font-semibold">📞 Phone:</span> +84 353636592
                            </li>
<li class="flex items-center gap-2">
<span class="font-semibold">🌐 Website:</span> https://shiftmate.vercel.app/
                            </li>
</ul>
</div>
</div>
</div>
<div class="py-8 px-6 lg:px-20 bg-slate-50">
<div class="container mx-auto">
<div class="flex flex-col md:flex-row justify-between items-center gap-6">
<div class="text-sm text-slate-500 font-medium">
                            © 2026 ShiftMate Inc. All rights reserved
                        </div>
<div class="flex gap-6">
<a class="text-slate-400 hover:text-deep-blue transition-colors p-2 hover:bg-slate-200 rounded-full" href="#">
<span class="sr-only">Twitter</span>
<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"></path></svg>
</a>
<a class="text-slate-400 hover:text-deep-blue transition-colors p-2 hover:bg-slate-200 rounded-full" href="#">
<span class="sr-only">GitHub</span>
<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" fill-rule="evenodd"></path></svg>
</a>
</div>
</div>
</div>
</div>
</footer>
<button class="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-deep-blue text-white shadow-lg transition-all duration-300 hover:bg-primary hover:text-deep-blue hover:shadow-[0_0_20px_rgba(51,224,165,0.6)] group" onclick="window.scrollTo({top: 0, behavior: 'smooth'})">
<span class="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">arrow_upward</span>
</button>
</div>

`;

export default function LandingPage() {
    const navigate = useNavigate();
    const containerRef = useRef(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Record initial head state to clean up exactly what we add
        const initialHeadElements = Array.from(document.head.children);

        // Make buttons navigate to /auth
        const buttons = container.querySelectorAll('button, a[href="#"]');
        buttons.forEach(btn => {
            const text = btn.textContent.toLowerCase();
            if (text.includes('sign in') || text.includes('đăng nhập')) {
                btn.onclick = (e) => {
                    e.preventDefault();
                    navigate('/auth', { state: { mode: 'signin' } });
                };
            } else if (text.includes('sign up') || text.includes('đăng ký') || text.includes('get started') || text.includes('bắt đầu')) {
                btn.onclick = (e) => {
                    e.preventDefault();
                    navigate('/auth', { state: { mode: 'signup' } });
                };
            }
        });

        // Add tailwind CDN script since the original relied on it for custom config
        if (!document.getElementById('tailwind-cdn')) {
            const script = document.createElement('script');
            script.id = 'tailwind-cdn';
            script.src = 'https://cdn.tailwindcss.com?plugins=forms,container-queries';
            script.onload = () => {
                if (window.tailwind) {
                    window.tailwind.config = {
                        darkMode: 'class',
                        theme: {
                            extend: {
                                colors: {
                                    primary: '#33E0A5',
                                    'primary-dark': '#0B8C65',
                                    'deep-blue': '#0A1929',
                                    'deep-blue-light': '#132F4C',
                                    'accent-mint': '#C7F9E8',
                                    'glass-white': 'rgba(255, 255, 255, 0.1)',
                                    'glass-border': 'rgba(255, 255, 255, 0.2)',
                                },
                                fontFamily: {
                                    display: ['Work Sans', 'sans-serif'],
                                },
                                backgroundImage: {
                                    'hero-pattern': `linear-gradient(to right bottom, rgba(10, 25, 41, 0.9), rgba(10, 25, 41, 0.7)), url('https://images.unsplash.com/photo-1554118811-1e0d58224f24?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')`,
                                }
                            }
                        }
                    };
                }
            };
            document.head.appendChild(script);
        }

        // Add google fonts
        if (!document.getElementById('google-fonts')) {
            const link = document.createElement('link');
            link.id = 'google-fonts';
            link.href = 'https://fonts.googleapis.com/css2?family=Work+Sans:wght@300;400;500;600;700;900&display=swap';
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }

        // Add material icons
        if (!document.getElementById('material-icons')) {
            const link = document.createElement('link');
            link.id = 'material-icons';
            link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap';
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }

        // Re-implement the scrolling script from original HTML
        const progressBar = container.querySelector('#progressBar');
        const progressLabel = container.querySelector('#progressLabel');
        const solutionsSection = container.querySelector('#solutions');
        const featuresSection = container.querySelector('#features');
        const contactSection = container.querySelector('#contact');

        const navHome = container.querySelector('#nav-home');
        const navSolutions = container.querySelector('#nav-solutions');
        const navFeatures = container.querySelector('#nav-features');
        const navContact = container.querySelector('#nav-contact');

        const resetNavStyles = () => {
            [navHome, navSolutions, navFeatures, navContact].forEach(link => {
                if (link) {
                    link.classList.remove('text-primary', 'font-bold');
                    link.classList.add('text-slate-300', 'font-medium');
                }
            });
        };

        const setActiveNav = (activeLink) => {
            resetNavStyles();
            if (activeLink) {
                activeLink.classList.remove('text-slate-300', 'font-medium');
                activeLink.classList.add('text-primary', 'font-bold');
            }
        };

        const handleScroll = () => {
            const scrollPos = window.scrollY;
            const windowHeight = window.innerHeight;
            const documentHeight = document.body.scrollHeight;

            const totalScroll = documentHeight - windowHeight;
            const scrollPercent = (scrollPos / (totalScroll || 1)) * 100;

            if (progressBar) progressBar.style.width = scrollPercent + '%';

            if (contactSection && scrollPos >= contactSection.offsetTop - 200) {
                if (progressLabel) progressLabel.textContent = 'Contact';
                setActiveNav(navContact);
            } else if (featuresSection && scrollPos >= featuresSection.offsetTop - 200) {
                if (progressLabel) progressLabel.textContent = 'Features';
                setActiveNav(navFeatures);
            } else if (solutionsSection && scrollPos >= solutionsSection.offsetTop - 200) {
                if (progressLabel) progressLabel.textContent = 'Solutions';
                setActiveNav(navSolutions);
            } else {
                if (progressLabel) progressLabel.textContent = 'Home';
                setActiveNav(navHome);
            }

            const revealElements = container.querySelectorAll('.animate-fade-up');
            revealElements.forEach(el => {
                const rect = el.getBoundingClientRect();
                const isVisible = (rect.top <= window.innerHeight * 0.85);
                if (isVisible) {
                    el.style.animationPlayState = 'running';
                    el.style.opacity = '1';
                }
            });
        };

        window.addEventListener('scroll', handleScroll);
        setActiveNav(navHome);

        const initialRevealElements = container.querySelectorAll('.animate-fade-up');
        initialRevealElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.top <= window.innerHeight * 0.85) {
                el.style.opacity = '1';
            }
        });

        // Smooth scrolling for Anchor tags
        const anchors = container.querySelectorAll('a[href^="#"]');
        anchors.forEach(a => {
            a.onclick = (e) => {
                // Let valid sections scroll
                const id = a.getAttribute('href');
                if (id === '#') {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    return;
                }
                const target = container.querySelector(id);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            };
        });
        // Logo redirect logic
        const logo = document.getElementById('logo-redirect-home');
        if (logo) {
            logo.addEventListener('click', async () => {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    navigate('/workspace');
                } else {
                    navigate('/');
                }
            });
        }

        return () => {
            window.removeEventListener('scroll', handleScroll);
            buttons.forEach(btn => btn.onclick = null);

            // Aggressive Cleanup: Remove any head elements added while this component was mounted
            const currentHeadElements = Array.from(document.head.children);
            currentHeadElements.forEach(el => {
                if (!initialHeadElements.includes(el)) {
                    el.remove();
                }
            });

            // Clean up custom tailwind styles that don't have standard IDs
            document.querySelectorAll('style[data-tailwindcss]').forEach(el => el.remove());
            const tailwindStyle = document.getElementById('tailwindcss-stylesheet');
            if (tailwindStyle) tailwindStyle.remove();

            // Clear the tailwind global object if it exists
            if (window.tailwind) {
                delete window.tailwind;
            }
        };
    }, [navigate]);

    return (
        <div ref={containerRef} dangerouslySetInnerHTML={{ __html: rawHTML }} className="bg-slate-50 font-display text-slate-900 antialiased selection:bg-primary selection:text-deep-blue" />
    );
}
