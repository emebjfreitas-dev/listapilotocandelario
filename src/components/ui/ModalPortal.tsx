import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  children: React.ReactNode;
  onClose?: () => void;
}

const escapeCloseStack: Array<React.RefObject<(() => void) | undefined>> = [];

/**
 * Renderiza overlays e modais diretamente em document.body, evitando que
 * containers animados (transform / will-change) ou com overflow aprisionem
 * elementos position: fixed atrás de Header/BottomNav ou desalinhados no scroll.
 * Quando `onClose` é informado, mantém pilha LIFO para que a tecla Esc feche
 * exclusivamente o modal mais superficial ativo.
 */
export const ModalPortal: React.FC<ModalPortalProps> = ({ children, onClose }) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const hasOnClose = Boolean(onClose);

  useEffect(() => {
    if (!hasOnClose) return;

    escapeCloseStack.push(onCloseRef);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const topRef = escapeCloseStack[escapeCloseStack.length - 1];
      if (topRef === onCloseRef && topRef.current) {
        e.preventDefault();
        e.stopImmediatePropagation();
        topRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      const idx = escapeCloseStack.lastIndexOf(onCloseRef);
      if (idx !== -1) {
        escapeCloseStack.splice(idx, 1);
      }
    };
  }, [hasOnClose]);

  if (typeof document === 'undefined' || !document.body) {
    return null;
  }
  return createPortal(children, document.body);
};
