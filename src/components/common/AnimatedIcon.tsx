import React from 'react';
import { motion } from 'motion/react';
import { LucideIcon } from 'lucide-react';

interface AnimatedIconProps {
  icon: LucideIcon;
  className?: string;
  isActive?: boolean;
  animateOnHover?: boolean;
  float?: boolean;
  glowColor?: string;
  badgeCount?: number;
}

export const AnimatedIcon: React.FC<AnimatedIconProps> = ({
  icon: Icon,
  className = 'w-5 h-5',
  isActive = false,
  animateOnHover = true,
  float = false,
  glowColor,
  badgeCount,
}) => {
  return (
    <motion.div
      whileHover={
        animateOnHover
          ? { scale: 1.12, rotate: -4 }
          : undefined
      }
      whileTap={{ scale: 0.88, rotate: -6 }}
      animate={
        float
          ? { y: [0, -3, 0] }
          : isActive
          ? { scale: 1.12, rotate: -4 }
          : { scale: 1, rotate: 0, y: 0 }
      }
      transition={
        float
          ? { y: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' } }
          : { type: 'spring', stiffness: 400, damping: 22 }
      }
      className="relative flex items-center justify-center inline-flex select-none"
    >
      {/* Background radial glow when active or glowColor specified */}
      {(isActive || glowColor) && (
        <motion.span
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.9, 1.1, 0.9] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-full blur-md -z-10"
          style={{
            backgroundColor: glowColor || 'var(--primary-red)',
          }}
        />
      )}

      <Icon className={`${className} transition-colors duration-200`} />

      {/* Optional Animated Badge Counter */}
      {badgeCount !== undefined && badgeCount > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500 }}
          className="absolute -top-1.5 -right-2 px-1.5 py-0.2 rounded-full bg-[var(--primary-red)] text-white font-heading text-[9px] font-bold retro-border-sm retro-shadow-sm flex items-center justify-center leading-none"
        >
          {badgeCount > 99 ? '99+' : badgeCount}
        </motion.span>
      )}
    </motion.div>
  );
};
