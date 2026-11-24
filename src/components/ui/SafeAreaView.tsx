import React from 'react';

export type SafeAreaEdge = 'top' | 'bottom' | 'left' | 'right';

export interface SafeAreaViewProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'div' | 'main' | 'section';
  edges?: SafeAreaEdge[];
  baseTopCss?: string;
  baseBottomCss?: string;
  children: React.ReactNode;
}

/**
 * Garante espaçamento seguro contra a barra de gestos (Home Indicator) e entalhes do iOS/Android
 * utilizando `env(safe-area-inset-*)` combinado opcionalmente com paddings base responsivos.
 */
export const SafeAreaView: React.FC<SafeAreaViewProps> = ({
  as = 'div',
  edges = ['bottom'],
  baseTopCss,
  baseBottomCss,
  style,
  children,
  ...rest
}) => {
  const Component = as;
  const computedStyle: React.CSSProperties = { ...style };

  if (edges.includes('top')) {
    computedStyle.paddingTop = baseTopCss
      ? `calc(${baseTopCss} + env(safe-area-inset-top, 0px))`
      : 'env(safe-area-inset-top, 0px)';
  }

  if (edges.includes('bottom')) {
    computedStyle.paddingBottom = baseBottomCss
      ? `calc(${baseBottomCss} + env(safe-area-inset-bottom, 0px))`
      : 'env(safe-area-inset-bottom, 0px)';
  }

  if (edges.includes('left')) {
    computedStyle.paddingLeft = 'env(safe-area-inset-left, 0px)';
  }

  if (edges.includes('right')) {
    computedStyle.paddingRight = 'env(safe-area-inset-right, 0px)';
  }

  return (
    <Component style={computedStyle} {...rest}>
      {children}
    </Component>
  );
};
