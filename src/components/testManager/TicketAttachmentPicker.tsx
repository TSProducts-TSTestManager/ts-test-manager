import React, { useEffect, useRef, useState } from 'react';
import { FileText, Image as ImageIcon, Paperclip, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { TicketAttachment } from '../../types/testManager';

export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const MAX_ATTACHMENT_COUNT = 5;

const ACCEPTED_TYPES = ['image/', 'application/pdf', 'text/', 'application/zip', 'application/x-zip-compressed', 'application/gzip'];
const ACCEPTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.txt', '.log', '.csv', '.json', '.xml', '.pdf', '.zip'];

interface TicketAttachmentPickerProps {
    attachments: TicketAttachment[];
    onChange: (attachments: TicketAttachment[]) => void;
    disabled?: boolean;
}

/** True when the paste event originated inside a text field / rich editor. */
const isEditableTarget = (target: EventTarget | null): boolean => {
    const el = target as HTMLElement | null;
    if (!el || typeof el.tagName !== 'string') return false;
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || el.isContentEditable === true;
};

const formatFileSize = (bytes: number): string => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const isAcceptedFile = (file: File): boolean => {
    const name = file.name.toLowerCase();
    if (ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) return true;
    return ACCEPTED_TYPES.some((type) => file.type.startsWith(type));
};

const readFileAsDataUrl = (file: File): Promise<TicketAttachment> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
            resolve({
                url: String(reader.result || ''),
                filename: file.name,
                fileSize: file.size,
                contentType: file.type || 'application/octet-stream',
            });
        reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
        reader.readAsDataURL(file);
    });

/**
 * Pick files (browse / drag-and-drop / paste a screenshot) that will be handed
 * to the ticket's JIRA bug on save. TSTestManager keeps no copy of the bytes,
 * so nothing is uploaded to a TSM bucket here — the payload only travels with
 * the create/update request.
 */
const TicketAttachmentPicker: React.FC<TicketAttachmentPickerProps> = ({ attachments, onChange, disabled = false }) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const attachmentsRef = useRef<TicketAttachment[]>(attachments);
    const [isDragging, setIsDragging] = useState(false);
    attachmentsRef.current = attachments;

    const addFiles = async (files: File[]) => {
        if (disabled || files.length === 0) return;
        const current = attachmentsRef.current;
        const available = MAX_ATTACHMENT_COUNT - current.length;
        if (available <= 0) {
            toast.error(`You can attach up to ${MAX_ATTACHMENT_COUNT} files`);
            return;
        }

        const accepted: TicketAttachment[] = [];
        for (const file of files) {
            if (accepted.length >= available) {
                toast.error(`Only ${MAX_ATTACHMENT_COUNT} attachments per ticket — extra files were skipped`);
                break;
            }
            if (!isAcceptedFile(file)) {
                toast.error(`${file.name}: file type is not supported`);
                continue;
            }
            if (file.size > MAX_ATTACHMENT_BYTES) {
                toast.error(`${file.name}: larger than ${formatFileSize(MAX_ATTACHMENT_BYTES)}`);
                continue;
            }
            try {
                accepted.push(await readFileAsDataUrl(file));
            } catch {
                toast.error(`Failed to read ${file.name}`);
            }
        }

        if (accepted.length > 0) {
            attachmentsRef.current = [...attachmentsRef.current, ...accepted];
            onChange(attachmentsRef.current);
        }
    };

    // Paste a screenshot from the clipboard (anywhere outside a text field).
    useEffect(() => {
        if (disabled) return;
        const handlePaste = (e: ClipboardEvent) => {
            if (isEditableTarget(e.target)) return;
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of Array.from(items)) {
                if (!item.type.startsWith('image/')) continue;
                const file = item.getAsFile();
                if (file) {
                    e.preventDefault();
                    void addFiles([file]);
                }
                return;
            }
        };
        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [disabled]);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (disabled) return;
        const files = Array.from(e.dataTransfer.files || []);
        void addFiles(files);
    };

    const removeAttachment = (index: number) => {
        onChange(attachments.filter((_, i) => i !== index));
    };

    return (
        <div className="mb-5">
            <label className="block text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
                Attachments
            </label>
            <div
                onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`rounded-lg border border-dashed p-3 transition-colors ${isDragging
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50'}`}
            >
                {attachments.length > 0 && (
                    <ul className="mb-3 space-y-2">
                        {attachments.map((att, idx) => (
                            <li
                                key={`${att.filename}-${idx}`}
                                className="flex items-center gap-3 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5"
                            >
                                {att.contentType.startsWith('image/') && att.url ? (
                                    <img src={att.url} alt="" className="h-9 w-9 rounded object-cover flex-shrink-0" />
                                ) : (
                                    <span className="h-9 w-9 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                                        <FileText size={16} className="text-gray-500 dark:text-gray-400" />
                                    </span>
                                )}
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-xs font-medium text-gray-800 dark:text-gray-200" title={att.filename}>
                                        {att.filename}
                                    </span>
                                    <span className="block text-[11px] text-gray-400 dark:text-gray-500">{formatFileSize(att.fileSize)}</span>
                                </span>
                                {!disabled && (
                                    <button
                                        type="button"
                                        onClick={() => removeAttachment(idx)}
                                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500"
                                        title="Remove attachment"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        disabled={disabled || attachments.length >= MAX_ATTACHMENT_COUNT}
                        onClick={() => inputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Paperclip size={13} />
                        Add files
                    </button>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">
                        Drag &amp; drop, or paste a screenshot ({attachments.length}/{MAX_ATTACHMENT_COUNT})
                    </span>
                </div>

                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        void addFiles(files);
                        e.target.value = '';
                    }}
                />
            </div>
            <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                <ImageIcon size={12} className="flex-shrink-0" />
                Files are sent to the linked JIRA bug when the ticket is saved — TSTestManager keeps no copy.
            </p>
        </div>
    );
};

export default TicketAttachmentPicker;
