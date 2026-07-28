import React from 'react';
import { createPortal } from 'react-dom';

interface ViewportModalProps {
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
  panelClassName?: string;
}

export default function ViewportModal({
  children,
  onClose,
  className = '',
  panelClassName = '',
}: ViewportModalProps) {
  return createPortal(
    <div
      className={`fixed top-0 left-0 w-screen h-screen bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-[9999] p-4 transition-opacity duration-200 ${className}`}
      style={{ width: '100vw', height: '100vh' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`animate-scale-in ${panelClassName}`}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
