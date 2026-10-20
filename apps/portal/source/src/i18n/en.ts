/**
 * The portal's English copy lives in one typed catalogue so labels can be
 * translated or moved to Tolgee without changing page components.
 */
export const en = {
  common: {
    add: 'Add',
    cancel: 'Cancel',
    edit: 'Edit',
    save: 'Save',
    refresh: 'Refresh',
    downloadTemplate: 'Download Excel template',
    importWorkbook: 'Import workbook',
    noRecords: 'No records yet',
  },
  academics: {
    title: 'Academics',
    yearTab: 'Academic years',
    classesTab: 'Classes',
    sectionsTab: 'Sections',
    importTab: 'Bulk import',
    className: 'Class name',
    classCode: 'Class code',
    sectionName: 'Section name',
  },
  subjects: {
    title: 'Subjects and teacher assignments',
    subjectsTab: 'Subjects',
    assignmentsTab: 'Teacher assignment',
  },
  import: {
    title: 'Import school records from Excel',
    description: 'Upload one workbook, review every row, then save only validated records. Existing records are matched by their stable code or contact value.',
    sheets: 'Supported sheets: classes, sections, teachers, students and parents.',
    noData: 'Add at least one supported sheet with rows before importing.',
    validationFailed: 'Review the highlighted rows before saving.',
    complete: 'Import finished. Rows with errors were skipped and can be corrected in Excel.',
  },
} as const;

export type TranslationKey = typeof en;
export const t = <K extends keyof typeof en>(group: K, key: keyof typeof en[K]): string => String(en[group][key]);
