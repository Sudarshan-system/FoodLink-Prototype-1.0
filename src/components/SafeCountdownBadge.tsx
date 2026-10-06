import React, { useState, useEffect } from 'react';
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const DEFAULT_SAFE_HOURS = 2; // Configurable constant: 2 hours safe window

interface SafeCountdownBadgeProps {
  listingId?: string;
  safeUntilMillis?: number;
  safeUntil?: any;
  createdAt?: any;
  status?: string;
  className?: string;
  onExpired?: (listingId: string) => void;
  compact?: boolean;
}

export function getSafeUntilMillis(
  safeUntilMillis?: number,
  safeUntil?: any,
  createdAt?: any
): number {
  if (typeof safeUntilMillis === 'number' && safeUntilMillis > 0) {
    return safeUntilMillis;
  }
  if (safeUntil) {
    if (typeof safeUntil.toMillis === 'function') {
      return safeUntil.toMillis();
    }
    if (safeUntil instanceof Date) {
      return safeUntil.getTime();
    }
    if (typeof safeUntil === 'number') {
      return safeUntil;
    }
    const parsed = new Date(safeUntil).getTime();
    if (!isNaN(parsed)) return parsed;
  }
  if (createdAt) {
    const createdMillis =
      typeof createdAt.toMillis === 'function'
        ? createdAt.toMillis()
        : createdAt instanceof Date
        ? createdAt.getTime()
        : typeof createdAt === 'number'
        ? createdAt
        : Date.now();
    return createdMillis + DEFAULT_SAFE_HOURS * 60 * 60 * 1000;
  }
  return Date.now() + DEFAULT_SAFE_HOURS * 60 * 60 * 1000;
}

export const SafeCountdownBadge: React.FC<SafeCountdownBadgeProps> = ({
  listingId,
  safeUntilMillis,
  safeUntil,
  createdAt,
  status = 'available',
  className = '',
  onExpired,
  compact = false,
}) => {
  const [now, setNow] = useState<number>(Date.now());
  const [hasTriggeredExpire, setHasTriggeredExpire] = useState<boolean>(false);

  const targetMillis = getSafeUntilMillis(safeUntilMillis, safeUntil, createdAt);

  useEffect(() => {
    // Tick every 1 second for live countdown
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const remaining = targetMillis - now;
  const isExpired = remaining <= 0 || status === 'expired';

  // Automatically delete the listing from Firestore once expiry timer expires
  useEffect(() => {
    if (isExpired && !hasTriggeredExpire && listingId && status === 'available') {
      setHasTriggeredExpire(true);
      if (onExpired) {
        onExpired(listingId);
      }
      // Auto-delete the listing document from Firestore when expiry timer ends
      deleteDoc(doc(db, 'listings', listingId)).catch((err) => {
        console.warn('Could not auto-delete expired listing from Firestore, fallback to expired status:', err);
        updateDoc(doc(db, 'listings', listingId), {
          status: 'expired',
          expiredAt: serverTimestamp(),
        }).catch(() => {});
      });
    }
  }, [isExpired, hasTriggeredExpire, listingId, status, onExpired]);

  if (isExpired) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#ffdad6] text-[#93000a] border border-[#ffb4ab] ${className}`}
        title="Food donation has passed its safe consumption window"
      >
        <span className="material-symbols-outlined text-[14px]">timer_off</span>
        <span>Expired</span>
      </span>
    );
  }

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

  let formattedTime = '';
  if (hours > 0) {
    formattedTime = `${hours}h ${minutes}m`;
  } else {
    formattedTime = `${minutes}m ${seconds}s`;
  }

  // Color gradient based on urgency
  let styleClasses =
    'bg-[#D1FAE5] text-[#059669] border-[#A7F3D0] dark:bg-[#059669]/20 dark:text-[#6EE7B7] dark:border-[#047857]';
  if (hours === 0 && minutes < 30) {
    styleClasses =
      'bg-[#FFDAD6] text-[#BA1A1A] border-[#FFB4AB] dark:bg-[#93000A]/20 dark:text-[#FFB4AB] dark:border-[#93000A] animate-pulse';
  } else if (hours === 0) {
    styleClasses =
      'bg-[#D1FAE5] text-[#92400E] border-[#FDE68A] dark:bg-[#450A0A] dark:text-[#FB7185] dark:border-[#855B14]';
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-colors ${styleClasses} ${className}`}
      title={`Listing creation + ${DEFAULT_SAFE_HOURS}h safe consumption window`}
    >
      <span className="material-symbols-outlined text-[13px]">timer</span>
      <span>Safe for: {formattedTime}</span>
    </span>
  );
};
