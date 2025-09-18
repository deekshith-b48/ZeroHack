'use client';

import React, { memo } from 'react';
import { motion } from 'framer-motion';

interface StatusCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: string;
  positive?: boolean;
  className?: string;
}

export const MemoizedStatusCard = memo<StatusCardProps>(({
  title,
  value,
  icon,
  change,
  positive,
  className = ''
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`bg-zinc-800 rounded-lg p-4 border border-zinc-800 shadow-lg ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-zinc-400">{title}</div>
        <div className="text-zinc-500">{icon}</div>
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
      {change && (
        <div className={`text-xs mt-1 flex items-center ${
          positive ? 'text-green-500' : 'text-red-500'
        }`}>
          <span className="mr-1">{positive ? '↑' : '↓'}</span>
          {change}
        </div>
      )}
    </motion.div>
  );
});

MemoizedStatusCard.displayName = 'MemoizedStatusCard';
