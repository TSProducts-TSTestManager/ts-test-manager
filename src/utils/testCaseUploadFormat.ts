/**
 * The canonical Test Case upload format.
 *
 * The spreadsheet template, the CSV column auto-detection, and the external API
 * documentation all read from this one list, so the three can never drift
 * apart. Column order is the order they appear in the downloaded template.
 */
import * as XLSX from 'xlsx';

export type UploadFieldKey =
    | 'suiteName'
    | 'title'
    | 'area'
    | 'testDescription'
    | 'testStep'
    | 'expectedResult'
    | 'priority'
    | 'status'
    | 'testType';

/** Spreadsheet formats the template can be downloaded in. */
export type TemplateFormat = 'csv' | 'xlsx';

export interface UploadColumn {
    /** Header text written into the template. */
    header: string;
    /** Field key sent to the API. */
    key: UploadFieldKey;
    required: boolean;
    /** Extra header spellings recognised when auto-mapping a user's file. */
    aliases: string[];
    hint?: string;
}

export const TEST_CASE_UPLOAD_COLUMNS: UploadColumn[] = [
    {
        header: 'Suite Name',
        key: 'suiteName',
        required: true,
        aliases: ['suite', 'test suite', 'testsuite', 'suitename'],
        hint: 'Matched case-insensitively. Created automatically if it does not exist.',
    },
    {
        header: 'Title',
        key: 'title',
        required: true,
        aliases: ['test case', 'name', 'testcase'],
    },
    {
        header: 'Area',
        key: 'area',
        required: false,
        aliases: ['page / area', 'page/area', 'category', 'module'],
    },
    {
        header: 'Test Description',
        key: 'testDescription',
        required: false,
        aliases: ['description', 'testdescription'],
    },
    {
        header: 'Test Step',
        key: 'testStep',
        required: false,
        aliases: ['test step', 'teststep', 'step', 'steps', 'steps content', 'stepscontent'],
        hint: 'One step per line. Line breaks are preserved.',
    },
    {
        header: 'Expected Result',
        key: 'expectedResult',
        required: false,
        aliases: ['expectedresult', 'expected'],
    },
    {
        header: 'Priority',
        key: 'priority',
        required: false,
        aliases: [],
    },
    {
        header: 'Status',
        key: 'status',
        required: false,
        aliases: [],
    },
    {
        header: 'Test Type',
        key: 'testType',
        required: false,
        aliases: ['testtype', 'type'],
    },
];

/** Header row of the downloadable template, in canonical order. */
export const TEST_CASE_UPLOAD_HEADERS = TEST_CASE_UPLOAD_COLUMNS.map((c) => c.header);

/** A single filled-in example row so the expected value formats are obvious. */
export const TEST_CASE_UPLOAD_SAMPLE_ROW: Record<string, string> = {
    'Suite Name': 'Authentication',
    Title: 'Login with a valid email and password',
    Area: 'Login Page',
    'Test Description': 'Confirms a registered user can sign in.',
    'Test Step': 'Open the login page\nEnter a registered email and password\nClick Sign in',
    'Expected Result': 'User is taken to the dashboard.',
    Priority: 'High',
    Status: 'Ready',
    'Test Type': 'Positive',
};

/**
 * Look up the canonical column for a spreadsheet header.
 * Falls back to a loose comparison so "test_step", "TestStep", and
 * "test step" all resolve to the same field.
 */
export const findUploadColumn = (header: string): UploadColumn | undefined => {
    const normalized = header.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
    return TEST_CASE_UPLOAD_COLUMNS.find(
        (column) =>
            column.header.toLowerCase() === normalized ||
            column.aliases.some((alias) => alias.toLowerCase() === normalized)
    );
};

/** Trigger a browser download for a generated file. */
const saveBlob = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/** Serialise the header row plus the worked example row as CSV. */
export const buildTemplateCsv = (): string => {
    const escapeCell = (value: string) =>
        /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    const headerLine = TEST_CASE_UPLOAD_HEADERS.map(escapeCell).join(',');
    const sampleLine = TEST_CASE_UPLOAD_HEADERS.map(
        (header) => escapeCell(TEST_CASE_UPLOAD_SAMPLE_ROW[header] ?? '')
    ).join(',');
    return `${headerLine}\r\n${sampleLine}\r\n`;
};

/**
 * Build the template as an XLSX workbook.
 *
 * Two sheets: `Test Cases` holds the fillable grid, `Instructions` documents
 * each column and its allowed values so the file is self-explanatory after it
 * leaves the app. Column widths are set so the step column is readable.
 */
export const buildTemplateXlsx = (): Blob => {
    const grid = XLSX.utils.aoa_to_sheet([
        TEST_CASE_UPLOAD_HEADERS,
        TEST_CASE_UPLOAD_HEADERS.map((header) => TEST_CASE_UPLOAD_SAMPLE_ROW[header] ?? ''),
    ]);
    grid['!cols'] = TEST_CASE_UPLOAD_COLUMNS.map((column) => ({
        wch: column.key === 'testStep' || column.key === 'testDescription' ? 42 : 20,
    }));

    const instructionRows: string[][] = [
        ['Column', 'Required', 'Accepted values', 'Notes'],
        ...TEST_CASE_UPLOAD_COLUMNS.map((column) => [
            column.header,
            column.required ? 'Yes' : 'No',
            column.key === 'priority'
                ? 'Low | Medium | High | Critical'
                : column.key === 'status'
                  ? 'Draft | In Review | Ready | Updated'
                  : column.key === 'testType'
                    ? 'Positive | Negative | UI | Performance | Other'
                    : 'Free text',
            column.hint ?? '',
        ]),
        ['', '', '', ''],
        ['Upload behaviour', '', '', ''],
        ['Rows are uploaded one at a time.', '', '', 'A failure on one row does not stop the rest.'],
        ['Suite Name is matched case-insensitively.', '', '', 'Created on first use, then reused — never duplicated.'],
        ['Test Step: one step per line.', '', '', 'Line breaks are preserved.'],
        ['Delete the sample row before uploading.', '', '', 'The second row is an example.'],
    ];
    const instructions = XLSX.utils.aoa_to_sheet(instructionRows);
    instructions['!cols'] = [{ wch: 32 }, { wch: 10 }, { wch: 36 }, { wch: 60 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, grid, 'Test Cases');
    XLSX.utils.book_append_sheet(workbook, instructions, 'Instructions');

    const out = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    return new Blob([out], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
};

/** Download the fillable template in the requested format. */
export const downloadTestCaseTemplate = (format: TemplateFormat): void => {
    if (format === 'xlsx') {
        saveBlob(buildTemplateXlsx(), 'test-case-upload-template.xlsx');
        return;
    }
    const blob = new Blob([buildTemplateCsv()], { type: 'text/csv;charset=utf-8;' });
    saveBlob(blob, 'test-case-upload-template.csv');
};
