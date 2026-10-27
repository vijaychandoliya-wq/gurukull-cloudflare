import axios from 'axios';

export const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL ||
  ((import.meta as any).env?.DEV ? 'http://localhost:8000' : '');

if (!(import.meta as any).env?.DEV && API_BASE_URL && !/^https:\/\//i.test(API_BASE_URL)) {
  throw new Error('Production API configuration requires HTTPS.');
}


export const TOKEN_KEY = 'gurukul_token';
export const SCHOOL_CODE_KEY = 'gurukul_school_code';

export function clearPortalSession() {
  for (const key of [TOKEN_KEY, SCHOOL_CODE_KEY, 'gurukul_user', 'gurukul_school']) {
    localStorage.removeItem(key);
  }
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  const schoolCode = localStorage.getItem(SCHOOL_CODE_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // The backend resolves the tenant from this header. It is deliberately NOT
  // defaulted to a demo school: sending a wrong code now returns 404 rather
  // than silently serving another school's data, and a missing code should
  // surface as a login problem rather than a plausible-looking wrong tenant.
  if (schoolCode) {
    config.headers['x-school-code'] = schoolCode;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      clearPortalSession();
      window.location.assign('/login');
    }
    return Promise.reject(error);
  }
);

/**
 * Endpoint map for the admin portal.
 *
 * In the legacy app these URLs arrived as a server-injected `data.links`
 * object. A standalone SPA has no server render step, so the same contract is
 * declared here and passed to the ported page components unchanged — which is
 * what lets those pages be lifted across with minimal edits.
 */
export const API = {
  portalLogin: '/api/portal/login',
  logout: '/api/v2/logout',
  myInfo: '/api/v2/myinfo',
  schoolDetails: '/api/v2/school/details',

  studentListApi: '/api/admin/students',
  studentDetailApi: '/api/admin/students/__ID__',
  studentProfileApi: '/api/admin/students/__ID__/profile',

  idCardOptionsApi: '/api/admin/id-cards/options',
  idCardStudentsApi: '/api/admin/id-cards/students',

  teacherListApi: '/api/admin/teachers',
  teacherDetailApi: '/api/admin/teachers/__ID__',
  teacherIdCardStudentsApi: '/api/admin/teacher-id-cards/students',
  teacherFormOptionsApi: '/api/admin/teachers/form-options',

  schoolApi: '/api/admin/school',
  schoolLogoApi: '/api/admin/school/logo',
  profileApi: '/api/admin/profile',
  profileAvatarApi: '/api/admin/profile/avatar',
  profilePasswordApi: '/api/admin/profile/password',
  localePreferenceApi: '/api/portal/locale-preference',
  localeSettingsApi: '/api/admin/locale-settings',
  teacherStatusApi: '/api/admin/teachers/__ID__/status',
  teacherPasswordApi: '/api/admin/teachers/__ID__/password',
  teacherAssignmentsApi: '/api/admin/teachers/__ID__/assignments',
  teacherAssignmentApi: '/api/admin/teachers/__ID__/assignments/__ASSIGN__',
  staffIdCardStudentsApi: '/api/admin/staff-id-cards/students',

  studentMedicalApi: '/api/admin/students/__ID__/medical',
  studentDocumentsApi: '/api/admin/students/__ID__/documents',
  studentDocumentApi: '/api/admin/students/__ID__/documents/__DOC__',
  studentConductApi: '/api/admin/students/__ID__/conduct',

  timetableOptionsApi: '/api/admin/timetable/options',
  timetableGridApi: '/api/admin/timetable/__ID__',
  timetableApi: '/api/admin/timetable',
  timetableSlotApi: '/api/admin/timetable/__ID__',

  examsApi: '/api/admin/exams',
  examApi: '/api/admin/exams/__ID__',
  examSchedulesApi: '/api/admin/exams/__ID__/schedules',
  examScheduleApi: '/api/admin/exam-schedules/__ID__',
  examSchedulesCreateApi: '/api/admin/exam-schedules',
  gradesApi: '/api/admin/grades',
  gradeApi: '/api/admin/grades/__ID__',
  gradeBoardsApi: '/api/admin/grade-boards',
  gradeBoardApplyApi: '/api/admin/grade-boards/apply',
  gradeBoardActiveApi: '/api/admin/grade-boards/active',
  examMarksApi: '/api/admin/exam-schedules/__ID__/marks',
  marksheetApi: '/api/admin/marksheet/__ID__/__EXAM__',
  examResultsApi: '/api/admin/exam-results/__EXAM__/__CLASS__',
} as const;

export function withId(template: string, id: string | number): string {
  return template.replace('__ID__', encodeURIComponent(String(id)));
}
