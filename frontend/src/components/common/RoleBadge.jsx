import React from 'react';
import { Shield, Award, Briefcase, GraduationCap } from 'lucide-react';
import { ROLE_CONFIGS } from './roleConfig.js';

const ICONS = {
  Shield,
  Award,
  Briefcase,
  GraduationCap
};

export default function RoleBadge({ role, departmentCode, showIcon = true, size = 'sm', className = '' }) {
  const normalizedRole = String(role || 'faculty').toLowerCase();
  const config = ROLE_CONFIGS[normalizedRole] || ROLE_CONFIGS.faculty;
  const Icon = ICONS[config.iconName] || Briefcase;

  const sizeClasses = size === 'xs'
    ? 'text-[10px] px-2 py-0.5 gap-1'
    : size === 'lg'
    ? 'text-sm px-3.5 py-1.5 gap-2'
    : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-bold uppercase tracking-wider rounded-xl border transition-colors shadow-2xs ${sizeClasses} ${config.className} ${className}`}
      data-testid={`role-badge-${normalizedRole}`}
    >
      {showIcon && <Icon className={size === 'xs' ? 'h-3 w-3' : size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'} />}
      <span>{config.label}</span>
      {departmentCode && (
        <span className="opacity-75 font-semibold">({departmentCode})</span>
      )}
    </span>
  );
}

export { ROLE_CONFIGS };
