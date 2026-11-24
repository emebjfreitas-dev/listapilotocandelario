import React from 'react';

export interface SFSymbolProps {
  name: string;
  filled?: boolean;
  size?: number;
  weight?: number;
  className?: string;
  label?: string;
}

/**
 * Renders a rounded Material Symbol configured with SF Symbols optical weight,
 * size, and filled/outlined active state toggling.
 */
export const SFSymbol: React.FC<SFSymbolProps> = ({
  name,
  filled = false,
  size = 20,
  weight,
  className = '',
  label,
}) => {
  const effectiveWeight = weight ?? (filled ? 520 : 420);
  const opticalSize = Math.min(48, Math.max(20, Math.round(size)));

  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`material-symbols-rounded inline-flex items-center justify-center select-none shrink-0 leading-none transition-all duration-150 ${className}`}
      style={{
        fontSize: `${size}px`,
        width: `${size}px`,
        height: `${size}px`,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${effectiveWeight}, 'GRAD' 0, 'opsz' ${opticalSize}`,
      }}
    >
      {name}
    </span>
  );
};
