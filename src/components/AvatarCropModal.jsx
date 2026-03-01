import React, { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'

export function AvatarCropModal({ isOpen, onClose, imageSrc, onCrop }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
    const [imgLoaded, setImgLoaded] = useState(false);
    const imgRef = useRef(null);

    const CROP_SIZE = 240; // size of the crop circle in pixels

    // Load image when source changes
    useEffect(() => {
        if (!imageSrc) return;
        const img = new Image();
        img.onload = () => {
            imgRef.current = img;
            setImgSize({ w: img.width, h: img.height });
            // Fit image so the shorter side fills the crop area
            const fitScale = CROP_SIZE / Math.min(img.width, img.height);
            setScale(fitScale);
            setOffset({ x: 0, y: 0 });
            setImgLoaded(true);
        };
        img.src = imageSrc;
    }, [imageSrc]);

    const handleMouseDown = (e) => {
        e.preventDefault();
        setDragging(true);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    };

    const handleMouseMove = useCallback((e) => {
        if (!dragging) return;
        setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }, [dragging, dragStart]);

    const handleMouseUp = useCallback(() => {
        setDragging(false);
    }, []);

    // Touch support
    const handleTouchStart = (e) => {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        setDragging(true);
        setDragStart({ x: t.clientX - offset.x, y: t.clientY - offset.y });
    };

    const handleTouchMove = useCallback((e) => {
        if (!dragging || e.touches.length !== 1) return;
        const t = e.touches[0];
        setOffset({ x: t.clientX - dragStart.x, y: t.clientY - dragStart.y });
    }, [dragging, dragStart]);

    const handleTouchEnd = useCallback(() => {
        setDragging(false);
    }, []);

    useEffect(() => {
        if (dragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('touchmove', handleTouchMove);
            window.addEventListener('touchend', handleTouchEnd);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [dragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

    const handleCrop = () => {
        if (!imgRef.current) return;

        const canvas = document.createElement('canvas');
        const outputSize = 256; // output resolution
        canvas.width = outputSize;
        canvas.height = outputSize;
        const ctx = canvas.getContext('2d');

        // Calculate what portion of the original image is in the crop circle
        const imgW = imgSize.w * scale;
        const imgH = imgSize.h * scale;
        const imgX = (CROP_SIZE - imgW) / 2 + offset.x;
        const imgY = (CROP_SIZE - imgH) / 2 + offset.y;

        // The crop area is centered in the container (0,0 to CROP_SIZE,CROP_SIZE)
        // Map crop area back to original image coordinates
        const srcX = (0 - imgX) / scale;
        const srcY = (0 - imgY) / scale;
        const srcW = CROP_SIZE / scale;
        const srcH = CROP_SIZE / scale;

        // Clip to circular shape
        ctx.beginPath();
        ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(imgRef.current, srcX, srcY, srcW, srcH, 0, 0, outputSize, outputSize);

        canvas.toBlob((blob) => {
            if (blob) {
                onCrop(blob);
            }
        }, 'image/png', 0.95);
    };

    const minScale = imgSize.w && imgSize.h
        ? CROP_SIZE / Math.max(imgSize.w, imgSize.h) * 0.5
        : 0.1;
    const maxScale = imgSize.w && imgSize.h
        ? CROP_SIZE / Math.min(imgSize.w, imgSize.h) * 3
        : 5;

    if (!isOpen || !imageSrc) return null;

    return createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-neutral-800 shadow-2xl overflow-hidden ring-1 ring-neutral-200 dark:ring-neutral-700">
                {/* Header */}
                <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-700 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-neutral-800 dark:text-white">Crop Avatar</h3>
                    <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors">
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>

                {/* Crop Area */}
                <div className="px-6 py-6 flex flex-col items-center gap-5">
                    <div
                        ref={containerRef}
                        className="relative overflow-hidden rounded-full cursor-grab active:cursor-grabbing select-none"
                        style={{
                            width: CROP_SIZE,
                            height: CROP_SIZE,
                            backgroundColor: 'black'
                        }}
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleTouchStart}
                    >
                        {imgLoaded && (
                            <img
                                src={imageSrc}
                                alt="Crop preview"
                                draggable={false}
                                style={{
                                    position: 'absolute',
                                    width: imgSize.w * scale,
                                    height: imgSize.h * scale,
                                    left: (CROP_SIZE - imgSize.w * scale) / 2 + offset.x,
                                    top: (CROP_SIZE - imgSize.h * scale) / 2 + offset.y,
                                    userSelect: 'none',
                                    pointerEvents: 'none',
                                }}
                            />
                        )}
                        {/* Circular overlay ring */}
                        <div
                            className="absolute inset-0 rounded-full pointer-events-none"
                            style={{
                                border: '3px solid rgba(153, 255, 218, 0.6)',
                            }}
                        />
                    </div>

                    {/* Zoom slider */}
                    <div className="w-full flex items-center gap-3 px-2">
                        <span className="material-symbols-outlined text-lg text-neutral-400">zoom_out</span>
                        <input
                            type="range"
                            min={minScale * 100}
                            max={maxScale * 100}
                            value={scale * 100}
                            onChange={(e) => setScale(Number(e.target.value) / 100)}
                            className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-600 rounded-full appearance-none cursor-pointer accent-primary"
                        />
                        <span className="material-symbols-outlined text-lg text-neutral-400">zoom_in</span>
                    </div>

                    <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center -mt-2">
                        Drag to reposition • Use slider to zoom
                    </p>
                </div>

                {/* Actions */}
                <div className="px-6 pb-6 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-300 font-bold text-sm transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCrop}
                        className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary-dark hover:text-white text-neutral-900 font-bold text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-lg">check</span>
                        Apply
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
