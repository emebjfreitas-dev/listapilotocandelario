import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { X } from 'lucide-react';
import { ModalPortal } from './ui/ModalPortal';
import { SFSymbol } from './ui/SFSymbol';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { triggerMenuHaptic } from '../utils/haptics';

export const PWAInstallButton: React.FC<{ variant?: 'header' | 'menu' }> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  useModalScrollLock(showIOSGuide);

  // Se já estiver rodando instalado como PWA, oculta o botão
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await install();
    } finally {
      setIsInstalling(false);
    }
  };

  // Botão em menu lateral ou dropdown do perfil
  if (variant === 'menu') {
    if (isInstallable) {
      return (
        <button
          type="button"
          onClick={() => {
            triggerMenuHaptic('light');
            void handleInstallClick();
          }}
          disabled={isInstalling}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer text-left active:scale-[0.98]"
        >
          <SFSymbol name="download" filled size={18} className="text-[#0071E3]" />
          <span>Instalar Aplicativo (PWA)</span>
        </button>
      );
    }

    if (isIOS) {
      return (
        <>
          <button
            type="button"
            onClick={() => {
              triggerMenuHaptic('light');
              setShowIOSGuide(true);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer text-left active:scale-[0.98]"
          >
            <SFSymbol name="smartphone" filled size={18} className="text-[#0071E3]" />
            <span>Instalar no iPhone / iPad</span>
          </button>

          {showIOSGuide && (
            <ModalPortal onClose={() => setShowIOSGuide(false)}>
              <div
                className="fixed inset-0 z-[130] overflow-hidden flex items-center justify-center bg-black/35 backdrop-blur-sm p-4 animate-backdrop-in"
                onClick={() => setShowIOSGuide(false)}
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Instalar no iPhone ou iPad"
                  className="w-full max-w-sm rounded-3xl bg-white border border-black/[0.08] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.18)] space-y-4 animate-apple-pop"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-2">
                      <SFSymbol name="smartphone" filled size={20} className="text-[#0071E3]" />
                      <h3 className="text-sm font-semibold text-[#1D1D1F]">Instalar no iPhone / iPad</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowIOSGuide(false)}
                      className="p-1.5 rounded-full bg-[#F5F5F7] text-[#424245] hover:bg-[#E8E8ED] hover:text-[#1D1D1F] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2 text-xs text-[#424245] leading-relaxed">
                    <p className="flex items-start gap-2">
                      <span className="font-bold text-[#0071E3] shrink-0">1.</span>
                      <span>No navegador <strong>Safari</strong>, toque no botão <strong>Compartilhar</strong> (ícone de quadrado com seta para cima).</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="font-bold text-[#0071E3] shrink-0">2.</span>
                      <span>Role para baixo e selecione <strong>&ldquo;Adicionar à Tela de Início&rdquo;</strong>.</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="font-bold text-[#0071E3] shrink-0">3.</span>
                      <span>Toque em <strong>&ldquo;Adicionar&rdquo;</strong> no canto superior direito para fixar o ícone oficial.</span>
                    </p>
                    <p className="rounded-xl bg-[#F5F5F7] border border-black/[0.05] px-3 py-2 text-[11px] text-[#424245]">
                      Dica: caso o modo Tela de Início do iOS restrinja a janela de login Google no seu aparelho, acesse o portal diretamente pelo navegador Safari.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowIOSGuide(false)}
                    className="w-full py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Entendi
                  </button>
                </div>
              </div>
            </ModalPortal>
          )}
        </>
      );
    }

    return null;
  }

  // Botão no Header
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => {
          triggerMenuHaptic('light');
          void handleInstallClick();
        }}
        disabled={isInstalling}
        title="Instalar Lista Piloto como aplicativo no seu dispositivo"
        className="h-9 px-3 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] border border-black/[0.06] text-[#1D1D1F] font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-95"
      >
        <SFSymbol name="download" size={17} weight={480} className="text-[#0071E3]" />
        <span className="hidden xl:inline">Instalar App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            triggerMenuHaptic('light');
            setShowIOSGuide(true);
          }}
          title="Instalar no iPhone / iPad"
          className="h-9 px-3 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] border border-black/[0.06] text-[#1D1D1F] font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-95"
        >
          <SFSymbol name="smartphone" size={17} weight={460} className="text-[#0071E3]" />
          <span className="hidden xl:inline">Instalar iOS</span>
        </button>

        {showIOSGuide && (
          <ModalPortal onClose={() => setShowIOSGuide(false)}>
            <div
              className="fixed inset-0 z-[130] overflow-hidden flex items-center justify-center bg-black/35 backdrop-blur-sm p-4 animate-backdrop-in"
              onClick={() => setShowIOSGuide(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Instalar no iPhone ou iPad"
                className="w-full max-w-sm rounded-3xl bg-white border border-black/[0.08] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.18)] space-y-4 text-left animate-apple-pop"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-2">
                    <SFSymbol name="smartphone" filled size={20} className="text-[#0071E3]" />
                    <h3 className="text-sm font-semibold text-[#1D1D1F]">Instalar no iPhone / iPad</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowIOSGuide(false)}
                    className="p-1.5 rounded-full bg-[#F5F5F7] text-[#424245] hover:bg-[#E8E8ED] hover:text-[#1D1D1F] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2 text-xs text-[#424245] leading-relaxed">
                  <p className="flex items-start gap-2">
                    <span className="font-bold text-[#0071E3] shrink-0">1.</span>
                    <span>No <strong>Safari</strong>, toque no ícone <strong>Compartilhar</strong> (quadrado com seta para cima).</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="font-bold text-[#0071E3] shrink-0">2.</span>
                    <span>Role as opções e toque em <strong>&ldquo;Adicionar à Tela de Início&rdquo;</strong>.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="font-bold text-[#0071E3] shrink-0">3.</span>
                    <span>Confirme tocando em <strong>&ldquo;Adicionar&rdquo;</strong> para abrir em tela cheia como aplicativo.</span>
                  </p>
                  <p className="rounded-xl bg-[#F5F5F7] border border-black/[0.05] px-3 py-2 text-[11px] text-[#424245]">
                    Dica: caso o modo Tela de Início do iOS restrinja a janela de login Google no seu aparelho, acesse o portal diretamente pelo navegador Safari.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="w-full py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Entendi
                </button>
              </div>
            </div>
          </ModalPortal>
        )}
      </>
    );
  }

  return null;
};
