import { VaultfireAttestation } from '@/lib/vaultfire';
import { Shield, ShieldAlert, ShieldCheck, CheckCircle } from 'lucide-react';

interface VerificationBadgeProps {
  attestation: VaultfireAttestation;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function VerificationBadge({ attestation, size = 'md', showLabel = true }: VerificationBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2',
  };

  const iconSizes = {
    sm: 12,
    md: 16,
    lg: 20,
  };

  const getColor = () => {
    if (attestation.score >= 80) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
    if (attestation.score >= 60) return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
    if (attestation.score >= 40) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
    return 'bg-red-500/20 text-red-400 border-red-500/50';
  };

  const getIcon = () => {
    const iconSize = iconSizes[size];
    if (attestation.verified && attestation.score >= 80) {
      return <ShieldCheck size={iconSize} />;
    }
    if (attestation.verified) {
      return <CheckCircle size={iconSize} />;
    }
    if (attestation.score >= 40) {
      return <Shield size={iconSize} />;
    }
    return <ShieldAlert size={iconSize} />;
  };

  const getLabel = () => {
    if (attestation.verified && attestation.score >= 80) return 'Highly Trusted';
    if (attestation.verified && attestation.score >= 60) return 'Trusted';
    if (attestation.verified) return 'Verified';
    if (attestation.score >= 40) return 'Unverified';
    return 'Low Trust';
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border ${getColor()} ${
        sizeClasses[size]
      } font-medium`}
    >
      {getIcon()}
      {showLabel && <span>{getLabel()}</span>}
      <span className="opacity-70">({attestation.score})</span>
    </div>
  );
}
