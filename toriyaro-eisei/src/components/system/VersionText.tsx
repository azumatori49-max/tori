import type { FC } from 'react';
import { BUILD_TIME } from '../../lib/buildInfo';

/** 版表示。画面に固定せず、ページの流れの中（ログイン画面・管理画面の最下部）に小さく置く */
export const VersionText: FC<{ className?: string }> = ({ className = '' }) => (
  <p className={`select-none text-center font-mono text-xs text-text-muted ${className}`}>
    v {BUILD_TIME}
  </p>
);
