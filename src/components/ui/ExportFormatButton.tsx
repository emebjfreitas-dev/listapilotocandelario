import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  FileType2,
  Loader2,
  Table2,
} from 'lucide-react';
import { UniversalExportFormat } from '../../utils/universalExport';

export interface ExportFormatButtonProps {
  onExport: (format: UniversalExportFormat) => Promise<void> | void;
  label?: string;
  title?: string;
  variant?: 'primary' | 'secondary' | 'compact' | 'dark';
  includeCsv?: boolean;
  includeClassicXls?: boolean;
  disabled?: boolean;
  className?: string;
  align?: 'left' | 'right';
}

interface FormatOption {
  format: UniversalExportFormat;
  title: string;
  subtitle: string;
  badge: string;
  badgeBg: string;
  badgeText: string;
  icon: React.ReactNode;
}

export const ExportFormatButton: React.FC<ExportFormatButtonProps> = ({
  onExport,
  label = 'Baixar',
  title = 'Exportar em Word, Excel ou PDF',
  variant = 'secondary',
  includeCsv = false,
  includeClassicXls = true,
  disabled = false,
  className = '',
  align = 'right',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingFormat, setLoadingFormat] = useState<UniversalExportFormat | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 248,
  });

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const options: FormatOption[] = [
    {
      format: 'docx',
      title: 'Word (.docx)',
      subtitle: 'Documento editável formatado',
      badge: 'DOCX',
      badgeBg: 'bg-[#0071E3]/10',
      badgeText: 'text-[#0071E3]',
      icon: <FileType2 className="w-4 h-4 text-[#0071E3]" />,
    },
    {
      format: 'xlsx',
      title: 'Excel (.xlsx)',
      subtitle: 'Planilha moderna com abas',
      badge: 'XLSX',
      badgeBg: 'bg-[#EAF7EE]',
      badgeText: 'text-[#1B873F]',
      icon: <FileSpreadsheet className="w-4 h-4 text-[#1B873F]" />,
    },
    ...(includeClassicXls
      ? [
          {
            format: 'xls' as const,
            title: 'Excel Clássico (.xls)',
            subtitle: 'Compatível com SED e legado',
            badge: 'XLS',
            badgeBg: 'bg-[#EAF7EE]',
            badgeText: 'text-[#1B873F]',
            icon: <Table2 className="w-4 h-4 text-[#1B873F]" />,
          },
        ]
      : []),
    {
      format: 'pdf',
      title: 'PDF (.pdf)',
      subtitle: 'Documento pronto para impressão',
      badge: 'PDF',
      badgeBg: 'bg-[#FFEBEB]',
      badgeText: 'text-[#D70015]',
      icon: <FileText className="w-4 h-4 text-[#D70015]" />,
    },
    ...(includeCsv
      ? [
          {
            format: 'csv' as const,
            title: 'CSV (.csv)',
            subtitle: 'Texto separado por ponto e vírgula',
            badge: 'CSV',
            badgeBg: 'bg-[#F5F5F7]',
            badgeText: 'text-[#424245]',
            icon: <Download className="w-4 h-4 text-[#424245]" />,
          },
        ]
      : []),
  ];

  const updateMenuPosition = () => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 258;
    const estimatedHeight = options.length * 54 + 28;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = align === 'right' ? rect.right - menuWidth : rect.left;
    if (left + menuWidth > vw - 12) left = vw - menuWidth - 12;
    if (left < 12) left = 12;

    let top = rect.bottom + 6;
    if (top + estimatedHeight > vh - 14 && rect.top - estimatedHeight - 6 > 12) {
      top = rect.top - estimatedHeight - 6;
    }

    setCoords({ top, left, width: menuWidth });
  };

  useEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (
        target &&
        !buttonRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleScrollOrResize = () => {
      updateMenuPosition();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
    };
  }, [isOpen, align, options.length]);

  const handleSelectFormat = async (format: UniversalExportFormat) => {
    if (loadingFormat) return;
    setLoadingFormat(format);
    setIsOpen(false);
    try {
      await onExport(format);
    } finally {
      setLoadingFormat(null);
    }
  };

  const variantClasses =
    variant === 'primary'
      ? 'min-h-[38px] px-4 py-2 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-xs sm:text-[13px]'
      : variant === 'dark'
      ? 'min-h-[38px] px-4 py-2 rounded-full bg-[#1D1D1F] hover:bg-[#424245] text-white font-semibold text-xs sm:text-[13px]'
      : variant === 'compact'
      ? 'min-h-[36px] py-1.5 px-3 rounded-full bg-white hover:bg-[#F5F5F7] border border-black/[0.08] text-[#1D1D1F] font-semibold text-[12.5px]'
      : 'min-h-[38px] px-4 py-2 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] border border-black/[0.06] text-[#1D1D1F] font-semibold text-xs sm:text-[13px]';

  const isBusy = loadingFormat !== null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled || isBusy}
        title={title}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled && !isBusy) {
            setIsOpen((prev) => !prev);
          }
        }}
        className={`inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors duration-150 whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${variantClasses} ${className}`}
      >
        {isBusy ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          <Download className="w-4 h-4 shrink-0" />
        )}
        <span>{isBusy ? `Gerando .${loadingFormat}...` : label}</span>
        {!isBusy && (
          <ChevronDown
            className={`w-3.5 h-3.5 opacity-80 shrink-0 transition-transform duration-150 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Escolher formato de download"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 160,
            }}
            className="rounded-2xl bg-white/95 backdrop-blur-2xl border border-black/[0.08] p-1.5 shadow-[0_18px_42px_rgba(0,0,0,0.14)] animate-apple-pop"
          >
            <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#86868B]">
              Baixar relatório em
            </div>
            <div className="space-y-0.5">
              {options.map((opt) => (
                <button
                  key={opt.format}
                  type="button"
                  role="menuitem"
                  onClick={() => void handleSelectFormat(opt.format)}
                  className="w-full px-2.5 py-2 rounded-xl hover:bg-[#F5F5F7] text-left flex items-center justify-between gap-2.5 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-lg bg-[#F5F5F7] flex items-center justify-center shrink-0">
                      {opt.icon}
                    </span>
                    <div className="min-w-0">
                      <span className="block text-[12.5px] font-semibold text-[#1D1D1F] leading-tight">
                        {opt.title}
                      </span>
                      <span className="block text-[11px] text-[#86868B] leading-tight mt-0.5 truncate">
                        {opt.subtitle}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide shrink-0 ${opt.badgeBg} ${opt.badgeText}`}
                  >
                    {opt.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
