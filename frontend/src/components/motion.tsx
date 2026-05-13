/**
 * Reusable Motion Components and Animation Variants
 * Using motion/react (framer-motion v11+)
 */

import { motion, AnimatePresence, type Variants } from 'motion/react'

// Common animation variants
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4 } }
}

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
}

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
}

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5 } }
}

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5 } }
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4 } }
}

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  }
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
}

export const slideIn: Variants = {
  hidden: { x: '-100%' },
  visible: { x: 0, transition: { type: 'spring', damping: 25, stiffness: 200 } },
  exit: { x: '-100%', transition: { duration: 0.3 } }
}

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    transition: { type: 'spring', damping: 20, stiffness: 300 } 
  },
  exit: { opacity: 0, scale: 0.8, transition: { duration: 0.2 } }
}

export const modalOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.2 } }
}

export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { type: 'spring', damping: 25, stiffness: 300 } 
  },
  exit: { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.2 } }
}

// Hover animations for interactive elements
export const hoverScale = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: { type: 'spring', stiffness: 400, damping: 17 }
}

export const hoverLift = {
  whileHover: { y: -4, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.2)' },
  transition: { type: 'spring', stiffness: 400, damping: 17 }
}

export const hoverGlow = {
  whileHover: { boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)' },
  transition: { duration: 0.3 }
}

// Page transition wrapper component
interface PageTransitionProps {
  children: React.ReactNode
  className?: string
}

export const PageTransition: React.FC<PageTransitionProps> = ({ children, className = '' }) => (
  <motion.div
    initial="hidden"
    animate="visible"
    exit="hidden"
    variants={fadeIn}
    className={className}
  >
    {children}
  </motion.div>
)

// Staggered list component
interface StaggerListProps {
  children: React.ReactNode
  className?: string
  delay?: number
}

export const StaggerList: React.FC<StaggerListProps> = ({ children, className = '', delay = 0.1 }) => (
  <motion.div
    initial="hidden"
    animate="visible"
    variants={{
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: { staggerChildren: delay, delayChildren: 0.1 }
      }
    }}
    className={className}
  >
    {children}
  </motion.div>
)

// Animated card component
interface AnimatedCardProps {
  children: React.ReactNode
  className?: string
  delay?: number
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({ children, className = '', delay = 0 }) => (
  <motion.div
    variants={staggerItem}
    initial="hidden"
    animate="visible"
    whileHover={{ y: -4, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.15)' }}
    transition={{ delay, duration: 0.4 }}
    className={className}
  >
    {children}
  </motion.div>
)

// Export motion components for direct use
export { motion, AnimatePresence }
