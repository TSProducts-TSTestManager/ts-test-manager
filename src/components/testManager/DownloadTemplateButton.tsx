import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import { downloadTestCaseTemplate, TemplateFormat } from '../../utils/testCaseUploadFormat';

interface DownloadTemplateButtonProps {
    /** Visual weight. Use 'primary' to feature it next to a primary action. */
    variant?: 'primary' | 'subtle';
    className?: string;
    label?: string;
}

const OPTIONS: { format: TemplateFormat; label: string; icon: React.FC<{ className?: string }> }[] = [
    { format: 'csv', label: 'CSV (.csv)', icon: FileText },
    { format: 'xlsx', label: 'Excel (.xlsx)', icon: FileSpreadsheet },
];

const MENU_WIDTH = 200;
const MENU_GAP = 6;

/**
 * Split button that downloads the canonical test-case template in either CSV
 * or XLSX. Both files carry the same nine columns, so the choice is purely
 * about which tool the user prefers to fill in.
 *
 * The menu is rendered in a document-level portal at a fixed position. It has
 * to be: the toolbar is a sticky bar inside scroll containers, and an
 * absolutely-positioned dropdown inside it gets clipped by their overflow.
 */
const DownloadTemplateButton: React.FC<DownloadTemplateButtonProps> = ({
    variant = 'subtle',
    className = '',
    label = 'Download template',
}) => {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const anchorRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const base =
        variant === 'primary'
            ? 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-gray-900/40';

    // Anchor the menu to the button, flipping above it when there is not enough
    // room below, and clamping horizontally so it never leaves the viewport.
    const reposition = useCallback(() => {
        const anchor = anchorRef.current;
        if (!anchor) return;
        const rect = anchor.getBoundingClientRect();
        const menuHeight = 8 + OPTIONS.length * 36 + 8;
        const spaceBelow = window.innerHeight - rect.bottom;

        const openUpward = spaceBelow < menuHeight + MENU_GAP && rect.top > spaceBelow;
        const top = openUpward
            ? Math.max(MENU_GAP, rect.top - menuHeight - MENU_GAP)
            : rect.bottom + MENU_GAP;

        const preferredLeft = rect.right - MENU_WIDTH;
        const left = Math.max(
            MENU_GAP,
            Math.min(preferredLeft, window.innerWidth - MENU_WIDTH - MENU_GAP)
        );

        setPosition({ top, left });
    }, []);

    useEffect(() => {
        if (!open) {
            setPosition(null);
            return;
        }
        reposition();

        // Keep the menu glued to the button while the page scrolls or resizes.
        window.addEventListener('scroll', reposition, true);
        window.addEventListener('resize', reposition);
        return () => {
            window.removeEventListener('scroll', reposition, true);
            window.removeEventListener('resize', reposition);
        };
    }, [open, reposition]);

    // Close on outside click or Escape.
    useEffect(() => {
        if (!open) return;
        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (anchorRef.current?.contains(target) || menuRef.current?.contains(target)) {
                return;
            }
            setOpen(false);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    return (
        <div className={`relative inline-block ${className}`} ref={anchorRef}>
            <div className="inline-flex">
                <button
                    onClick={() => downloadTestCaseTemplate('csv')}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-l-lg transition-colors ${base}`}
                    title="Download the CSV template (one example row included)"
                >
                    <Download className="h-3.5 w-3.5" />
                    {label}
                </button>
                <button
                    onClick={() => setOpen((prev) => !prev)}
                    className={`inline-flex items-center px-1.5 py-2 rounded-r-l border-l border-inherit transition-colors ${base}`}
                    aria-label="Choose template format"
                    aria-expanded={open}
                    aria-haspopup="menu"
                >
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {open &&
                position &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="menu"
                        style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
                        className="fixed z-[100] bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-1 animate-[scaleIn_0.1s_ease-out]"
                    >
                        <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            Choose format
                        </div>
                        {OPTIONS.map((option) => (
                            <button
                                key={option.format}
                                role="menuitem"
                                onClick={() => {
                                    downloadTestCaseTemplate(option.format);
                                    setOpen(false);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                            >
                                <option.icon className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                                {option.label}
                            </button>
                        ))}
                    </div>,
                    document.body
                )}
        </div>
    );
};

export default DownloadTemplateButton;
