import React from 'react';
import { Building2, Folder, User } from 'lucide-react';
import {
    REPORT_AUTHOR_LABEL,
    REPORT_CLIENT_LABEL,
    REPORT_PROJECT_LABEL,
    formatAuthor,
} from '../../utils/reportMeta';

interface ReportIdentityBarProps {
    clientName?: string;
    projectName?: string;
    /** Who generated/opened the report — usually the signed-in user */
    authorName?: string;
    authorEmail?: string;
    /** Additional context rendered after the identity (e.g. run count) */
    children?: React.ReactNode;
    className?: string;
}

/**
 * Compact tabular identity strip shown at the top of every report:
 * client, project, and who generated it (name + email).
 */
const ReportIdentityBar: React.FC<ReportIdentityBarProps> = ({
    clientName,
    projectName,
    authorName,
    authorEmail,
    children,
    className = '',
}) => {
    const author = formatAuthor({ name: authorName, email: authorEmail });

    if (!clientName && !projectName && !author && !children) return null;

    return (
        <div
            className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400 ${className}`}
        >
            {clientName && (
                <span className="inline-flex items-center gap-1.5 min-w-0">
                    <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-gray-400 dark:text-gray-500">
                        {REPORT_CLIENT_LABEL}:
                    </span>
                    <span className="font-medium text-gray-700 dark:text-gray-200 truncate">
                        {clientName}
                    </span>
                </span>
            )}
            {projectName && (
                <span className="inline-flex items-center gap-1.5 min-w-0">
                    <Folder className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-gray-400 dark:text-gray-500">
                        {REPORT_PROJECT_LABEL}:
                    </span>
                    <span className="font-medium text-gray-700 dark:text-gray-200 truncate">
                        {projectName}
                    </span>
                </span>
            )}
            {author && (
                <span className="inline-flex items-center gap-1.5 min-w-0">
                    <User className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-gray-400 dark:text-gray-500">
                        {REPORT_AUTHOR_LABEL}:
                    </span>
                    <span
                        className="font-medium text-gray-700 dark:text-gray-200 truncate"
                        title={authorEmail || authorName}
                    >
                        {author}
                    </span>
                </span>
            )}
            {children}
        </div>
    );
};

export default ReportIdentityBar;
