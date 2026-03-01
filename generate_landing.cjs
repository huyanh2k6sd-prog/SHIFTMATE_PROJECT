const fs = require('fs');

const htmlPath = 'C:/Users/huyan/Downloads/intrôcde.html';
const outPath = 'C:/Users/huyan/.gemini/antigravity/scratch/shiftmate/src/pages/LandingPage.jsx';

const html = fs.readFileSync(htmlPath, 'utf8');

// Extract body inner HTML and styles
const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
let innerHTML = bodyMatch ? bodyMatch[1] : html;

// Inject the style tag from head
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
if (styleMatch) {
    innerHTML = `<style>${styleMatch[1]}</style>` + innerHTML;
}

// Remove script tags to avoid issues with dangerouslySetInnerHTML
innerHTML = innerHTML.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

const jsx = `import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const rawHTML = \`${innerHTML.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;

export default function LandingPage() {
    const navigate = useNavigate();
    const containerRef = useRef(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

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
                                    'hero-pattern': \`linear-gradient(to right bottom, rgba(10, 25, 41, 0.9), rgba(10, 25, 41, 0.7)), url('https://images.unsplash.com/photo-1554118811-1e0d58224f24?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')\`,
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
            
            const scrollPercentage = (scrollPos / (documentHeight - windowHeight)) * 100;
            if (progressBar) progressBar.style.width = scrollPercentage + '%';
            
            const solutionsTop = solutionsSection ? solutionsSection.offsetTop - 300 : windowHeight;
            const featuresTop = featuresSection ? featuresSection.offsetTop - 300 : windowHeight * 2;
            const contactTop = contactSection ? contactSection.offsetTop - 500 : windowHeight * 3;
            
            if (scrollPos >= contactTop) {
                if (progressLabel) progressLabel.textContent = 'Contact us';
                setActiveNav(navContact);
            } else if (scrollPos >= featuresTop) {
                if (progressLabel) progressLabel.textContent = 'Features';
                setActiveNav(navFeatures);
            } else if (scrollPos >= solutionsTop) {
                if (progressLabel) progressLabel.textContent = 'Solutions';
                setActiveNav(navSolutions);
            } else {
                if (progressLabel) progressLabel.textContent = ''; 
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
                    window.scrollTo({top: 0, behavior: 'smooth'});
                    return;
                }
                const target = container.querySelector(id);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            };
        });

        return () => {
            window.removeEventListener('scroll', handleScroll);
            buttons.forEach(btn => btn.onclick = null);
        };
    }, [navigate]);

    return (
        <div ref={containerRef} dangerouslySetInnerHTML={{ __html: rawHTML }} className="bg-slate-50 font-display text-slate-900 antialiased selection:bg-primary selection:text-deep-blue" />
    );
}
`;

fs.writeFileSync(outPath, jsx, 'utf8');
console.log('Successfully wrote LandingPage.jsx');
