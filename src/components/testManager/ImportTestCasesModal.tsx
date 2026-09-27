import React, { useState } from 'react';
import { X, Upload, FileUp, AlertCircle, CheckCircle2, AlertTriangle, Download, Info, Server, RefreshCw } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { CustomFieldDefinition, Priority, Status, TestType } from '../../types/testManager';
import { BulkImportWithSuiteResult } from '../../types/api/testManager.api';
import { TEST_CASE_UPLOAD_COLUMNS, findUploadColumn } from '../../utils/testCaseUploadFormat';
import DownloadTemplateButton from './DownloadTemplateButton';

interface ImportTestCasesModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Creates one case per call so the upload can report progress row by row. */
    onCreateCase: (payload: UploadCasePayload) => Promise<{ skipped: boolean }>;
    /** Called once after the last row, so the page can reload suites + cases. */
    onUploadComplete?: () => Promise<void> | void;
    /**
     * Ask the server how many test cases the current view holds right now.
     * Used by the Refresh button to confirm what actually landed.
     */
    onCheckServerStatus?: () => Promise<{ total: number }>;
    customFieldDefinitions: CustomFieldDefinition[];
    projectMembers: Array<{ id: string; name: string; active?: boolean }>;
    availableSuites: Array<{ id: string; name: string }>;
    defaultSuiteId?: string; // Current suite selected in UI as fallback
}

/** One spreadsheet row, already normalised into API field names. */
export interface UploadCasePayload {
    suiteId?: string;
    suiteName?: string;
    createSuiteIfMissing?: boolean;
    title: string;
    area?: string;
    testDescription?: string;
    testStep?: string;
    expectedResult?: string;
    priority?: string;
    status?: string;
    testType?: string;
    comments?: string;
    customFields?: Record<string, string>;
    skipIfDuplicate?: boolean;
}

interface ColumnMapping {
    csvColumn: string;
    testCaseField: string;
    customFieldId?: string;
}

interface ParsedRow {
    [key: string]: string;
}

interface ValidationError {
    row: number;
    field: string;
    message: string;
}

const ImportTestCasesModal: React.FC<ImportTestCasesModalProps> = ({
    isOpen,
    onClose,
    onCreateCase,
    onUploadComplete,
    onCheckServerStatus,
    customFieldDefinitions,
    projectMembers,
    availableSuites,
    defaultSuiteId,
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [csvData, setCsvData] = useState<ParsedRow[]>([]);
    const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
    const [skipDuplicates, setSkipDuplicates] = useState(true);
    const [createMissingSuites, setCreateMissingSuites] = useState(true);
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<BulkImportWithSuiteResult | null>(null);
    /**
     * Live one-by-one upload tally. `uploaded` counts rows the server has
     * finished with, so the number on screen always matches what is in the DB.
     */
    const [uploadProgress, setUploadProgress] = useState<{
        uploaded: number;
        total: number;
        created: number;
        skipped: number;
        failed: number;
    } | null>(null);
    /** Title of the row currently being sent, for the "in flight" hint. */
    const [currentRowLabel, setCurrentRowLabel] = useState<string | null>(null);
    /** Latest server-confirmed counts, shown next to the local upload tally. */
    const [serverStatus, setServerStatus] = useState<{
        total: number;
        checkedAt: Date;
    } | null>(null);
    const [isCheckingServer, setIsCheckingServer] = useState(false);

    /**
     * Pull the authoritative count from the server and reconcile it with what
     * this upload claims it created. The local numbers come from responses we
     * already handled; the server total is the tie-breaker when something was
     * changed by someone else in the meantime.
     */
    const refreshServerStatus = async () => {
        if (!onCheckServerStatus) return;
        setIsCheckingServer(true);
        try {
            const { total } = await onCheckServerStatus();
            setServerStatus({ total, checkedAt: new Date() });
        } catch (error) {
            console.error('Failed to check server status:', error);
        } finally {
            setIsCheckingServer(false);
        }
    };

    // Step 1: File upload, Step 2: Column mapping, Step 3: Validation preview, Step 4: Results
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

    // Available test case fields for mapping
    const testCaseFields = [
        { value: '', label: '-- Do not import --' },
        { value: 'title', label: 'Title (Required)' },
        { value: 'suiteName', label: 'Test Suite' },
        { value: 'area', label: 'Area' },
        { value: 'testDescription', label: 'Test Description' },
        { value: 'testStep', label: 'Test Step' },
        { value: 'expectedResult', label: 'Expected Result' },
        { value: 'priority', label: 'Priority' },
        { value: 'status', label: 'Status' },
        { value: 'testType', label: 'Test Type' },
        { value: 'assignedTesterName', label: 'Assigned Tester (Name)' },
        { value: 'stepsContent', label: 'Steps Content' },
        { value: 'comments', label: 'Comments' },
    ];

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            parseCSV(selectedFile);
        }
    };

    const parseCSV = (file: File) => {
        const isSpreadsheet = /\.xlsx?$/i.test(file.name);

        // Papa handles delimited text; XLSX has to be flattened to CSV first.
        const finish = (text: string) => {
            const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
            const matrix = parsed.data as string[][];
            if (matrix.length === 0) {
                setCsvData([]);
                setColumnMappings([]);
                setStep(2);
                return;
            }
            const headers = (matrix[0] || []).map((h) => String(h ?? '').trim());
            const dataRows = matrix.slice(1);
            const data: ParsedRow[] = dataRows.map((cells) =>
                headers.reduce<ParsedRow>((acc, header, index) => {
                    if (header) acc[header] = String(cells[index] ?? '');
                    return acc;
                }, {})
            );

            setCsvData(data);
            setColumnMappings(autoDetectMappings(headers));
            setStep(2);
        };

        if (isSpreadsheet) {
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const workbook = XLSX.read(new Uint8Array(reader.result as ArrayBuffer), {
                        type: 'array',
                    });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    if (!sheet) {
                        setCsvData([]);
                        setStep(2);
                        return;
                    }
                    finish(XLSX.utils.sheet_to_csv(sheet));
                } catch (error) {
                    alert(`Error reading the workbook: ${(error as Error).message}`);
                }
            };
            reader.onerror = () => alert('Error reading the file');
            reader.readAsArrayBuffer(file);
            return;
        }

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const headers = results.meta.fields || [];
                const data = results.data as ParsedRow[];

                setCsvData(data);

                // Auto-detect column mappings
                const mappings = autoDetectMappings(headers);
                setColumnMappings(mappings);

                setStep(2);
            },
            error: (error) => {
                alert(`Error parsing CSV: ${(error as Error).message}`);
            },
        });
    };

    // Header name patterns for auto-detection. The canonical format is the
    // source of truth; the extra lists cover columns outside the template.
    const SUITE_HEADERS = ['suite', 'test suite', 'testsuite', 'suite name', 'suitename'];
    const TITLE_HEADERS = ['title', 'test case', 'name'];
    const AREA_HEADERS = ['area', 'category'];
    const TESTER_HEADERS = ['assigned tester', 'tester', 'assignedtester'];
    const DESCRIPTION_HEADERS = ['description', 'test description', 'testdescription'];
    const STEPS_HEADERS = ['steps', 'steps content', 'stepscontent'];
    const EXPECTED_HEADERS = ['expected result', 'expectedresult', 'expected'];
    const COMMENTS_HEADERS = ['comments', 'notes'];
    const TEST_TYPE_HEADERS = ['test type', 'testtype', 'type'];

    const normalizeImportedStatus = (value: string): Status | '' => {        const trimmedValue = value.trim();
        if (!trimmedValue) return '';

        const normalizedValue = trimmedValue.toLowerCase();

        // Map old status values to new ones
        if (normalizedValue === 'pass' || normalizedValue === 'passed') return Status.Ready;
        if (normalizedValue === 'fail' || normalizedValue === 'failed') return Status.Ready;
        if (normalizedValue === 'ready for testing' || normalizedValue === 'ready') return Status.Ready;
        if (normalizedValue === 'in progress') return Status.InReview;
        if (normalizedValue === 'blocked' || normalizedValue === 'retest' || normalizedValue === 'pass - fixed' || normalizedValue === 'passfixed') return Status.Ready;
        // "Skipped", "out of scope", and "archived" used to land on the old
        // Archived status. Archiving is now a separate action that an import
        // cannot perform, so these fall back to Draft: the row arrives as
        // visible work the user can review and archive deliberately.
        if (normalizedValue === 'skipped' || normalizedValue === 'out of scope' || normalizedValue === 'outofscope') return Status.Draft;
        if (normalizedValue === 'draft') return Status.Draft;
        if (normalizedValue === 'in review' || normalizedValue === 'inreview') return Status.InReview;
        if (normalizedValue === 'updated') return Status.Updated;
        if (normalizedValue === 'archived') return Status.Draft;

        // If it's already a valid new status, return it
        if (Object.values(Status).includes(trimmedValue as Status)) {
            return trimmedValue as Status;
        }

        // Default to Ready for unrecognized values
        return Status.Ready;
    };

    const normalizeImportedTestType = (value: string): TestType | '' => {
        const normalized = value.trim().toLowerCase();
        if (!normalized) return '';
        return (
            Object.values(TestType).find((t) => t.toLowerCase() === normalized) ?? ''
        );
    };

    const autoDetectMappings = (headers: string[]): ColumnMapping[] => {
        return headers.map((header) => {
            // The canonical upload format wins, so the template round-trips
            // without the user touching a single dropdown.
            const canonical = findUploadColumn(header);
            if (canonical) {
                return { csvColumn: header, testCaseField: canonical.key };
            }

            const lowerHeader = header.toLowerCase().trim();

            // Try to match default fields
            let testCaseField = '';
            if (TITLE_HEADERS.includes(lowerHeader)) {
                testCaseField = 'title';
            } else if (SUITE_HEADERS.includes(lowerHeader)) {
                testCaseField = 'suiteName';
            } else if (lowerHeader === 'priority') {
                testCaseField = 'priority';
            } else if (lowerHeader === 'status') {
                testCaseField = 'status';
            } else if (AREA_HEADERS.includes(lowerHeader)) {
                testCaseField = 'area';
            } else if (TESTER_HEADERS.includes(lowerHeader)) {
                testCaseField = 'assignedTesterName';
            } else if (DESCRIPTION_HEADERS.includes(lowerHeader)) {
                testCaseField = 'testDescription';
            } else if (STEPS_HEADERS.includes(lowerHeader)) {
                testCaseField = 'testStep';
            } else if (EXPECTED_HEADERS.includes(lowerHeader)) {
                testCaseField = 'expectedResult';
            } else if (TEST_TYPE_HEADERS.includes(lowerHeader)) {
                testCaseField = 'testType';
            } else if (COMMENTS_HEADERS.includes(lowerHeader)) {
                testCaseField = 'comments';
            } else {
                // Try to match custom fields
                const matchedCustomField = customFieldDefinitions.find(
                    (cf) =>
                        !cf.deleted &&
                        (cf.label.toLowerCase() === lowerHeader || cf.key?.toLowerCase() === lowerHeader)
                );

                if (matchedCustomField) {
                    return {
                        csvColumn: header,
                        testCaseField: 'customField',
                        customFieldId: matchedCustomField.id,
                    };
                }
            }

            return {
                csvColumn: header,
                testCaseField,
            };
        });
    };

    const handleMappingChange = (csvColumn: string, newMapping: string) => {
        setColumnMappings((prev) =>
            prev.map((mapping) => {
                if (mapping.csvColumn === csvColumn) {
                    // Check if it's a custom field
                    const customField = customFieldDefinitions.find(
                        (cf) => `custom_${cf.id}` === newMapping
                    );

                    if (customField) {
                        return {
                            csvColumn,
                            testCaseField: 'customField',
                            customFieldId: customField.id,
                        };
                    }

                    return {
                        csvColumn,
                        testCaseField: newMapping,
                    };
                }
                return mapping;
            })
        );
    };

    const getDuplicateMappings = (): string[] => {
        const mappedFields: { [key: string]: number } = {};
        const duplicates: string[] = [];

        columnMappings.forEach((mapping) => {
            // Skip unmapped columns
            if (!mapping.testCaseField || mapping.testCaseField === '') {
                return;
            }

            // Create a unique key for the mapping
            const key =
                mapping.testCaseField === 'customField' && mapping.customFieldId
                    ? `custom_${mapping.customFieldId}`
                    : mapping.testCaseField;

            mappedFields[key] = (mappedFields[key] || 0) + 1;

            // Add to duplicates if this is the second occurrence
            if (mappedFields[key] === 2) {
                // Find the field label
                if (mapping.testCaseField === 'customField' && mapping.customFieldId) {
                    const customField = customFieldDefinitions.find(
                        (cf) => cf.id === mapping.customFieldId
                    );
                    duplicates.push(customField?.label || 'Unknown Custom Field');
                } else {
                    const field = testCaseFields.find((f) => f.value === mapping.testCaseField);
                    duplicates.push(field?.label || mapping.testCaseField);
                }
            }
        });

        return duplicates;
    };

    const validateData = (): boolean => {
        const errors: ValidationError[] = [];

        // Check for duplicate mappings
        const duplicates = getDuplicateMappings();
        if (duplicates.length > 0) {
            alert(
                `Cannot proceed: The following fields are mapped multiple times:\n\n${duplicates.join(', ')}\n\nEach field can only be mapped once.`
            );
            return false;
        }

        // Check if title is mapped
        const titleMapping = columnMappings.find((m) => m.testCaseField === 'title');
        if (!titleMapping) {
            alert('Title field must be mapped to proceed with import');
            return false;
        }

        // Validate each row
        csvData.forEach((row, index) => {
            const rowNum = index + 1;

            // Check title
            const title = row[titleMapping.csvColumn]?.trim();
            if (!title) {
                errors.push({
                    row: rowNum,
                    field: 'Title',
                    message: 'Title is required',
                });
            }

            // Validate priority if mapped
            const priorityMapping = columnMappings.find((m) => m.testCaseField === 'priority');
            if (priorityMapping) {
                const priority = row[priorityMapping.csvColumn]?.trim();
                if (priority && !Object.values(Priority).includes(priority as Priority)) {
                    errors.push({
                        row: rowNum,
                        field: 'Priority',
                        message: `Invalid priority: "${priority}". Must be one of: ${Object.values(Priority).join(', ')}`,
                    });
                }
            }

            // Validate status if mapped
            const statusMapping = columnMappings.find((m) => m.testCaseField === 'status');
            if (statusMapping) {
                const status = row[statusMapping.csvColumn]?.trim();
                const normalizedStatus = normalizeImportedStatus(status || '');
                if (normalizedStatus && !Object.values(Status).includes(normalizedStatus)) {
                    errors.push({
                        row: rowNum,
                        field: 'Status',
                        message: `Invalid status: "${status}". Must be one of: ${Object.values(Status).join(', ')}`,
                    });
                }
            }

            // Validate test type if mapped
            const testTypeMapping = columnMappings.find((m) => m.testCaseField === 'testType');
            if (testTypeMapping) {
                const rawTestType = row[testTypeMapping.csvColumn]?.trim() || '';
                if (rawTestType && !normalizeImportedTestType(rawTestType)) {
                    errors.push({
                        row: rowNum,
                        field: 'Test Type',
                        message: `Invalid test type: "${rawTestType}". Must be one of: ${Object.values(TestType).join(', ')}`,
                    });
                }
            }

            // Validate custom field dropdowns
            columnMappings.forEach((mapping) => {
                if (mapping.customFieldId) {
                    const customField = customFieldDefinitions.find((cf) => cf.id === mapping.customFieldId);
                    if (customField?.type === 'dropdown' && customField.options) {
                        const value = row[mapping.csvColumn]?.trim();
                        if (value) {
                            const validOptions = customField.options.map((opt) => opt.label);
                            if (!validOptions.includes(value)) {
                                errors.push({
                                    row: rowNum,
                                    field: customField.label,
                                    message: `Invalid value: "${value}". Must be one of: ${validOptions.join(', ')}`,
                                });
                            }
                        }
                    }
                }
            });
        });

        setValidationErrors(errors);
        setStep(3);
        return true;
    };

    // Rich text fields that should have line breaks converted to HTML
    const RICH_TEXT_FIELDS = new Set(['stepsContent', 'testDescription', 'expectedResult', 'comments']);

    /**
     * Convert plain text (possibly with \n line breaks from CSV) to TipTap-compatible HTML.
     * Each non-empty line becomes a <p> element; blank lines become <p><br></p>.
     * If the value is already HTML (starts with a tag), it is returned as-is.
     */
    const plainTextToHtml = (text: string): string => {
        if (!text) return '';
        // If already HTML, skip conversion
        if (/^\s*<[a-zA-Z]/.test(text)) return text;
        const lines = text.split(/\r?\n/);
        return lines
            .map((line) => (line.trim() === '' ? '<p><br></p>' : `<p>${line}</p>`))
            .join('');
    };

    const transformData = (): UploadCasePayload[] => {
        return csvData.map((row) => {
            const testCase: UploadCasePayload & { assignedTesterName?: string; assignedTesterId?: string; [key: string]: unknown } = {
                title: '',
            };

            const customFields: Record<string, string> = {};

            columnMappings.forEach((mapping) => {
                const value = row[mapping.csvColumn]?.trim() || '';

                if (mapping.testCaseField === 'customField' && mapping.customFieldId) {
                    customFields[mapping.customFieldId] = value;
                } else if (mapping.testCaseField && mapping.testCaseField !== '') {
                    if (mapping.testCaseField === 'priority') {
                        testCase.priority = value as Priority;
                    } else if (mapping.testCaseField === 'status') {
                        const normalizedStatus = normalizeImportedStatus(value);
                        if (normalizedStatus) {
                            testCase.status = normalizedStatus;
                        }
                    } else if (mapping.testCaseField === 'assignedTesterName') {
                        // Store name temporarily for lookup
                        testCase.assignedTesterName = value;
                    } else if (mapping.testCaseField === 'suiteName') {
                        // Store suite name for the backend to resolve
                        testCase.suiteName = value;
                    } else if (RICH_TEXT_FIELDS.has(mapping.testCaseField)) {
                        // Convert plain-text newlines to HTML so they render correctly
                        // in the TipTap rich text editor
                        testCase[mapping.testCaseField] = plainTextToHtml(value);
                    } else {
                        testCase[mapping.testCaseField] = value;
                    }
                }
            });

            // Convert tester name to ID if provided
            if (testCase.assignedTesterName) {
                const testerName = testCase.assignedTesterName.toLowerCase();
                const matchedMember = projectMembers.find(
                    (member) => member.active !== false && member.name.toLowerCase() === testerName
                );
                if (matchedMember) {
                    testCase.assignedTesterId = matchedMember.id;
                }
                delete testCase.assignedTesterName;
            }

            if (Object.keys(customFields).length > 0) {
                testCase.customFields = customFields;
            }

            return testCase as UploadCasePayload;
        });
    };

    /**
     * Upload every row, one request per row, in file order.
     *
     * Sequential rather than parallel on purpose: the counter the user watches
     * has to equal what is committed, and a shared suite being created on the
     * first row must exist before the second row joins it. A failing row is
     * recorded and the upload continues, so one bad line cannot abandon the rest.
     */
    const handleImport = async () => {
        const payloads = transformData();
        setImporting(true);
        setImportResult(null);
        setUploadProgress({ uploaded: 0, total: payloads.length, created: 0, skipped: 0, failed: 0 });
        setCurrentRowLabel(null);

        const combined: BulkImportWithSuiteResult = {
            created: 0,
            skipped: 0,
            failed: 0,
            errors: [],
            duplicates: [],
            suitesCreated: [],
            suiteStats: {},
        };
        const seenSuiteNames = new Set<string>();
        const seenInFile = new Set<string>();

        let uploaded = 0;
        let created = 0;
        let skipped = 0;
        let failed = 0;

        for (let i = 0; i < payloads.length; i++) {
            const payload = payloads[i];
            const rowNumber = i + 1;

            // A repeated suite+title inside the same file is a duplicate even
            // before the server sees it, so skip it without a request.
            const suiteKey = (payload.suiteName || payload.suiteId || '').trim().toLowerCase();
            const dedupeKey = `${suiteKey}::${payload.title.trim().toLowerCase()}`;
            if (seenInFile.has(dedupeKey)) {
                skipped++;
                combined.skipped++;
                combined.duplicates!.push(payload.title);
                seenSuiteNames.add(payload.suiteName || '');
                uploaded++;
                setUploadProgress({ uploaded, total: payloads.length, created, skipped, failed });
                continue;
            }
            seenInFile.add(dedupeKey);

            setCurrentRowLabel(`Row ${rowNumber}: ${payload.title}`);

            try {
                const result = await onCreateCase({
                    ...payload,
                    createSuiteIfMissing: createMissingSuites,
                    skipIfDuplicate: skipDuplicates,
                });

                if (payload.suiteName) {
                    seenSuiteNames.add(payload.suiteName);
                }

                if (result.skipped) {
                    skipped++;
                    combined.skipped++;
                    combined.duplicates!.push(payload.title);
                } else {
                    created++;
                    combined.created++;
                }
            } catch (error: unknown) {
                failed++;
                combined.failed++;
                combined.errors.push({
                    index: rowNumber,
                    title: payload.title,
                    message: (error as Error)?.message || 'Failed to create test case',
                });
            }

            uploaded++;
            setUploadProgress({ uploaded, total: payloads.length, created, skipped, failed });
        }

        setCurrentRowLabel(null);

        // Let the page reconcile its lists (new suites, new cases) exactly once.
        try {
            await onUploadComplete?.();
        } catch (error) {
            console.error('Failed to refresh after upload:', error);
        }

        // Only report suites the upload actually had to create, which the
        // single-case endpoint does not tell us; surface the distinct names it
        // resolved instead.
        combined.suitesCreated = createMissingSuites
            ? Array.from(seenSuiteNames).filter((name) =>
                  !availableSuites.some((s) => s.name.toLowerCase() === name.toLowerCase())
              )
            : [];

        setImportResult(combined);
        setStep(4);
        setImporting(false);
    };


    const handleReset = () => {
        setFile(null);
        setCsvData([]);
        setColumnMappings([]);
        setValidationErrors([]);
        setImportResult(null);
        setUploadProgress(null);
        setCurrentRowLabel(null);
        setServerStatus(null);
        setCreateMissingSuites(true);
        setStep(1);
    };

    const handleClose = () => {
        handleReset();
        onClose();
    };

    const downloadErrorReport = () => {
        if (!importResult) return;

        const errorRows = importResult.errors.map((error) => ({
            Row: error.index,
            Title: error.title || 'N/A',
            Error: error.message,
        }));

        const csv = Papa.unparse(errorRows);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `import-errors-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!isOpen) return null;

    const validCount = csvData.length - validationErrors.length;
    const duplicateMappings = step === 2 ? getDuplicateMappings() : [];
    const hasDuplicateMappings = duplicateMappings.length > 0;
    const importPct = importing && uploadProgress && uploadProgress.total > 0
        ? Math.round((uploadProgress.uploaded / uploadProgress.total) * 100)
        : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
            <div
                className="absolute inset-0 bg-white/40 dark:bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={handleClose}
            />

            <div
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl border border-gray-200 dark:border-gray-700 overflow-hidden transform transition-all scale-100 relative"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Upload className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            Import Test Cases
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {step === 1 && 'Upload a CSV file to import test cases'}
                            {step === 2 && `Map columns from your CSV (${csvData.length} rows detected)`}
                            {step === 3 && 'Review validation results before importing'}
                            {step === 4 && 'Import completed'}
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {/* Step 1: File Upload */}
                    {step === 1 && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-full max-w-md">
                                <label
                                    htmlFor="csv-upload"
                                    className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-xl cursor-pointer bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                >
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <FileUp className="h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
                                        <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
                                            <span className="font-semibold">Click to upload</span> or drag and drop
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">CSV or XLSX files only</p>
                                        {file && (
                                            <p className="mt-4 text-sm text-blue-600 dark:text-blue-400 font-medium">{file.name}</p>
                                        )}
                                    </div>
                                    <input
                                        id="csv-upload"
                                        type="file"
                                        accept=".csv,.xlsx,.xls"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                </label>

                                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <p className="text-sm text-blue-900 dark:text-blue-300 font-medium">
                                            Expected columns
                                        </p>
                                        <DownloadTemplateButton className="flex-shrink-0" />
                                    </div>
                                    <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-0.5">
                                        {TEST_CASE_UPLOAD_COLUMNS.map((column) => (
                                            <li key={column.key} className="flex items-start gap-1.5">
                                                <span className="font-medium">{column.header}</span>
                                                {column.key === 'suiteName' ? (
                                                    <span className="opacity-70">— created on first use, then reused</span>
                                                ) : column.required ? (
                                                    <span className="text-red-600 dark:text-red-400 font-medium">required</span>
                                                ) : (
                                                    <span className="opacity-60">optional</span>
                                                )}
                                                {column.hint && <span className="opacity-70">— {column.hint}</span>}
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800 space-y-0.5 text-xs text-blue-800 dark:text-blue-300">
                                        <p><span className="font-medium">Priority:</span> {Object.values(Priority).join(', ')}</p>
                                        <p><span className="font-medium">Status:</span> {Object.values(Status).join(', ')}</p>
                                        <p><span className="font-medium">Test Type:</span> {Object.values(TestType).join(', ')}</p>
                                        <p className="opacity-70">Rows are uploaded one at a time, so a failure on one row does not stop the rest.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Column Mapping */}
                    {step === 2 && (
                        <div>
                            <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-yellow-900 dark:text-yellow-300">
                                    <p className="font-medium mb-1">Map your CSV columns to test case fields</p>
                                    <p className="text-yellow-800 dark:text-yellow-400">
                                        Title field is required. All other fields are optional. Unmapped columns will be ignored.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3 mb-4">
                                {columnMappings.map((mapping, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                                    >
                                        <div className="flex-1">
                                            <label className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                                CSV Column
                                            </label>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                                                {mapping.csvColumn}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                Preview: {csvData[0]?.[mapping.csvColumn]?.substring(0, 50)}
                                                {(csvData[0]?.[mapping.csvColumn]?.length || 0) > 50 ? '...' : ''}
                                            </p>
                                        </div>

                                        <div className="flex-1">
                                            <label className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                                Maps to
                                            </label>
                                            <select
                                                value={
                                                    mapping.customFieldId
                                                        ? `custom_${mapping.customFieldId}`
                                                        : mapping.testCaseField
                                                }
                                                onChange={(e) =>
                                                    handleMappingChange(mapping.csvColumn, e.target.value)
                                                }
                                                className="mt-1 w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                                            >
                                                {testCaseFields.map((field) => (
                                                    <option key={field.value} value={field.value}>
                                                        {field.label}
                                                    </option>
                                                ))}
                                                {customFieldDefinitions.filter((cf) => !cf.deleted).length > 0 && (
                                                    <optgroup label="Custom Fields">
                                                        {customFieldDefinitions
                                                            .filter((cf) => !cf.deleted)
                                                            .map((cf) => (
                                                                <option key={cf.id} value={`custom_${cf.id}`}>
                                                                    {cf.label} ({cf.type})
                                                                </option>
                                                            ))}
                                                    </optgroup>
                                                )}
                                            </select>
                                        </div>
                                    </div>
                                ))}
                            {/* Duplicate Mapping Warning */}
                            {hasDuplicateMappings && (
                                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-900/50 flex items-start gap-3">
                                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm text-red-900 dark:text-red-300">
                                        <p className="font-medium mb-1">Duplicate mappings detected</p>
                                        <p className="text-red-800 dark:text-red-400">
                                            The following fields are mapped multiple times: {duplicateMappings.join(', ')}
                                        </p>
                                        <p className="text-red-700 dark:text-red-400 mt-1">
                                            Each field can only be mapped once. Please adjust your mappings to proceed.
                                        </p>
                                    </div>
                                </div>
                            )}

                            </div>

                            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <input
                                    type="checkbox"
                                    id="skip-duplicates"
                                    checked={skipDuplicates}
                                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:bg-gray-700"
                                />
                                <label htmlFor="skip-duplicates" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                                    <span className="font-medium">Skip duplicate titles</span>
                                    <span className="text-gray-500 dark:text-gray-400 ml-2">
                                        (Test cases with the same title in their target suite will be skipped)
                                    </span>
                                </label>
                            </div>

                            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg mt-3">
                                <input
                                    type="checkbox"
                                    id="create-missing-suites"
                                    checked={createMissingSuites}
                                    onChange={(e) => setCreateMissingSuites(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:bg-gray-700"
                                />
                                <label htmlFor="create-missing-suites" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                                    <span className="font-medium">Create missing test suites</span>
                                    <span className="text-gray-500 dark:text-gray-400 ml-2">
                                        (If a test suite name doesn't exist, create it automatically)
                                    </span>
                                </label>
                            </div>

                            {/* Suite mapping info */}
                            {columnMappings.some(m => m.testCaseField === 'suiteName') && (
                                <div className="flex items-start gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg mt-3">
                                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm text-blue-800 dark:text-blue-200">
                                        <span className="font-medium">Test Suite column mapped:</span> Test cases will be imported into their specified suites.
                                        {defaultSuiteId && availableSuites.length > 0 && (
                                            <span className="block text-blue-600 dark:text-blue-300 mt-1">
                                                Test cases without a suite name will use the currently selected suite as fallback.
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {!columnMappings.some(m => m.testCaseField === 'suiteName') && defaultSuiteId && (
                                <div className="flex items-start gap-2 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg mt-3">
                                    <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm text-amber-800 dark:text-amber-200">
                                        <span className="font-medium">No Test Suite column mapped:</span> All test cases will be imported into the currently selected suite.
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Validation Preview */}
                    {step === 3 && (
                        <div>
                            {/* Summary Stats */}
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                        <span className="text-sm font-medium text-green-900 dark:text-green-300">Valid</span>
                                    </div>
                                    <p className="text-2xl font-bold text-green-700 dark:text-green-400 mt-2">{validCount}</p>
                                </div>

                                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                        <span className="text-sm font-medium text-red-900 dark:text-red-300">Errors</span>
                                    </div>
                                    <p className="text-2xl font-bold text-red-700 dark:text-red-400 mt-2">
                                        {validationErrors.length}
                                    </p>
                                </div>

                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <FileUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                        <span className="text-sm font-medium text-blue-900 dark:text-blue-300">Total</span>
                                    </div>
                                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-2">{csvData.length}</p>
                                </div>
                            </div>

                            {/* Validation Errors */}
                            {validationErrors.length > 0 && (
                                <div className="mb-6">
                                    <div className="flex items-center gap-2 mb-3">
                                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                        <h3 className="text-sm font-semibold text-red-900 dark:text-red-300">Validation Errors</h3>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                                        <table className="w-full text-sm">
                                            <thead className="text-xs uppercase text-red-900 dark:text-red-300 border-b border-red-200 dark:border-red-900/50">
                                                <tr>
                                                    <th className="text-left py-2 px-3">Row</th>
                                                    <th className="text-left py-2 px-3">Field</th>
                                                    <th className="text-left py-2 px-3">Error</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-red-800 dark:text-red-300">
                                                {validationErrors.slice(0, 50).map((error, index) => (
                                                    <tr key={index} className="border-b border-red-100 dark:border-red-900/50">
                                                        <td className="py-2 px-3">{error.row}</td>
                                                        <td className="py-2 px-3 font-medium">{error.field}</td>
                                                        <td className="py-2 px-3">{error.message}</td>
                                                    </tr>
                                                ))}
                                                {validationErrors.length > 50 && (
                                                    <tr>
                                                        <td colSpan={3} className="py-2 px-3 text-center italic">
                                                            ... and {validationErrors.length - 50} more errors
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p className="text-xs text-red-700 dark:text-red-400 mt-2">
                                        Rows with errors will not be imported. You can proceed to import valid rows only.
                                    </p>
                                </div>
                            )}

                            {validationErrors.length === 0 && (
                                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center gap-3">
                                    <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                                    <div>
                                        <p className="text-sm font-medium text-green-900 dark:text-green-300">All rows are valid!</p>
                                        <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                                            {validCount} test case{validCount !== 1 ? 's' : ''} ready to import
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 4: Results */}
                    {step === 4 && importResult && (
                        <div>
                            {/* Server status bar: what the local tally says vs what
                                the server actually holds right now. */}
                            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Server className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                                        {serverStatus ? (
                                            <span className="text-gray-700 dark:text-gray-300">
                                                Server reports{' '}
                                                <span className="font-semibold">{serverStatus.total}</span>{' '}
                                                test case{serverStatus.total === 1 ? '' : 's'} in this view
                                                <span className="text-xs text-gray-400 dark:text-gray-500 ml-1.5">
                                                    as of {serverStatus.checkedAt.toLocaleTimeString()}
                                                </span>
                                            </span>
                                        ) : (
                                            <span className="text-gray-500 dark:text-gray-400">
                                                Not synced with the server yet
                                            </span>
                                        )}
                                    </div>
                                    {onCheckServerStatus && (
                                        <button
                                            onClick={refreshServerStatus}
                                            disabled={isCheckingServer}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-shrink-0"
                                        >
                                            <RefreshCw
                                                className={`h-3.5 w-3.5 ${isCheckingServer ? 'animate-spin' : ''}`}
                                            />
                                            {isCheckingServer ? 'Checking...' : 'Refresh status'}
                                        </button>
                                    )}
                                </div>

                                {serverStatus && (
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        {serverStatus.total === importResult.created
                                            ? 'Matches the number this upload created.'
                                            : `This upload created ${importResult.created}; the view holds ${serverStatus.total} in total.`}
                                    </p>
                                )}
                            </div>

                            {/* Summary Stats */}
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                        <span className="text-sm font-medium text-green-900 dark:text-green-300">Created</span>
                                    </div>
                                    <p className="text-2xl font-bold text-green-700 dark:text-green-400 mt-2">{importResult.created}</p>
                                </div>

                                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                                        <span className="text-sm font-medium text-yellow-900 dark:text-yellow-300">Skipped</span>
                                    </div>
                                    <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mt-2">{importResult.skipped}</p>
                                </div>

                                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                        <span className="text-sm font-medium text-red-900 dark:text-red-300">Failed</span>
                                    </div>
                                    <p className="text-2xl font-bold text-red-700 dark:text-red-400 mt-2">{importResult.failed}</p>
                                </div>
                            </div>

                            {/* Duplicates */}
                            {importResult.skipped > 0 && importResult.duplicates && importResult.duplicates.length > 0 && (
                                <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                                        <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-300">Skipped Duplicates</h3>
                                    </div>
                                    <div className="max-h-32 overflow-y-auto">
                                        <ul className="text-sm text-yellow-800 dark:text-yellow-300 space-y-1">
                                            {importResult.duplicates.slice(0, 10).map((title, index) => (
                                                <li key={index}>• {title}</li>
                                            ))}
                                            {importResult.duplicates.length > 10 && (
                                                <li className="italic">
                                                    ... and {importResult.duplicates.length - 10} more
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {/* Errors */}
                            {importResult.failed > 0 && importResult.errors.length > 0 && (
                                <div className="mb-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                            <h3 className="text-sm font-semibold text-red-900 dark:text-red-300">Import Errors</h3>
                                        </div>
                                        <button
                                            onClick={downloadErrorReport}
                                            className="text-xs text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                                        >
                                            <Download className="h-3 w-3" />
                                            Download Error Report
                                        </button>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                                        <table className="w-full text-sm">
                                            <thead className="text-xs uppercase text-red-900 dark:text-red-300 border-b border-red-200 dark:border-red-900/50">
                                                <tr>
                                                    <th className="text-left py-2 px-3">Row</th>
                                                    <th className="text-left py-2 px-3">Title</th>
                                                    <th className="text-left py-2 px-3">Error</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-red-800 dark:text-red-300">
                                                {importResult.errors.slice(0, 20).map((error, index) => (
                                                    <tr key={index} className="border-b border-red-100 dark:border-red-900/50">
                                                        <td className="py-2 px-3">{error.index}</td>
                                                        <td className="py-2 px-3">{error.title || 'N/A'}</td>
                                                        <td className="py-2 px-3">{error.message}</td>
                                                    </tr>
                                                ))}
                                                {importResult.errors.length > 20 && (
                                                    <tr>
                                                        <td colSpan={3} className="py-2 px-3 text-center italic">
                                                            ... and {importResult.errors.length - 20} more errors
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Success Message */}
                            {importResult.created > 0 && importResult.failed === 0 && (
                                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center gap-3">
                                    <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                                    <div>
                                        <p className="text-sm font-medium text-green-900 dark:text-green-300">Import completed successfully!</p>
                                        <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                                            {importResult.created} test case{importResult.created !== 1 ? 's' : ''} imported
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Suites Created */}
                            {importResult.suitesCreated && importResult.suitesCreated.length > 0 && (
                                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                                            Test Suites Created ({importResult.suitesCreated.length})
                                        </h3>
                                    </div>
                                    <div className="max-h-32 overflow-y-auto">
                                        <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                                            {importResult.suitesCreated.map((suiteName, index) => (
                                                <li key={index}>• {suiteName}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        {step === 2 && (
                            <span>
                                {csvData.length} row{csvData.length !== 1 ? 's' : ''} will be imported
                            </span>
                        )}
                        {step === 3 && (
                            <span className="flex flex-col items-end gap-1">
                                {importing && uploadProgress ? (
                                    <>
                                        <span className="flex items-center gap-2">
                                            <span className="text-blue-600 dark:text-blue-400 font-medium">
                                                Uploaded {uploadProgress.uploaded} of {uploadProgress.total}
                                            </span>
                                            <span className="inline-block w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <span
                                                    className="block h-2 bg-blue-500 rounded-full transition-all duration-300"
                                                    style={{ width: `${importPct}%` }}
                                                />
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {importPct}%
                                            </span>
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            {uploadProgress.created} created
                                            {uploadProgress.skipped > 0 && ` · ${uploadProgress.skipped} skipped`}
                                            {uploadProgress.failed > 0 && ` · ${uploadProgress.failed} failed`}
                                        </span>
                                        {currentRowLabel && (
                                            <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-xs" title={currentRowLabel}>
                                                {currentRowLabel}
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <>{validCount} valid, {validationErrors.length} errors</>
                                )}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {step < 4 && (
                            <button
                                onClick={handleClose}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                        )}

                        {step === 2 && (
                            <>
                                <button
                                    onClick={handleReset}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={() => validateData()}
                                    disabled={hasDuplicateMappings}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                                    title={hasDuplicateMappings ? 'Fix duplicate mappings to proceed' : ''}
                                >
                                    Next: Validate
                                </button>
                            </>
                        )}

                        {step === 3 && (
                            <>
                                <button
                                    onClick={() => setStep(2)}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={importing || validCount === 0}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                >
                                    {importing ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                            {uploadProgress
                                                ? `Uploading ${uploadProgress.uploaded} / ${uploadProgress.total}…`
                                                : 'Uploading...'}
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="h-4 w-4" />
                                            Upload {validCount > 0 && `${validCount} test case${validCount === 1 ? '' : 's'}`}
                                        </>
                                    )}
                                </button>
                            </>
                        )}

                        {step === 4 && (
                            <button
                                onClick={handleClose}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                            >
                                Done
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImportTestCasesModal;
