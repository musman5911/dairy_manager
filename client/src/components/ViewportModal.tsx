import React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { modalSpring } from '../motion';

interface ViewportModalProps {
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
  panelClassName?: string;
  /** Nested popup (opened from within another popup): darker backdrop + accent ring so stacking is obvious. */
  nested?: boolean;
}

/**
 * Animated modal shell — spec §5.
 * Wrap the callsite in <AnimatePresence> so the modal animates out on close:
 *   <AnimatePresence>{open && <MyPopup ... />}</AnimatePresence>
 */
export default function ViewportModal({
  children,
  onClose,
  className = '',
  panelClassName = '',
  nested = false,
}: ViewportModalProps) {
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className={`modal-overlay fixed top-0 left-0 w-screen flex items-center justify-center z-[9999] p-4 backdrop-blur-sm ${
        nested ? 'bg-black/60' : 'bg-black/50'
      } ${className}`}
      style={{ width: '100vw' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 2 }}
        transition={modalSpring}
        className={`${nested ? 'ring-2 ring-teal-500/40 rounded-xl' : ''} ${panelClassName}`}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>,
    document.body
  );
}
