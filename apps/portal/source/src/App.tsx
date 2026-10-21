import {PayrollManagementPage} from './pages/PayrollManagementPage';
import {QuizManagementPage} from './pages/QuizManagementPage';
import {LiveClassManagementPage} from './pages/LiveClassManagementPage';
import {TransportManagementPage} from './pages/TransportManagementPage';
import {PromotionManagementPage,AlumniManagementPage} from './pages/StudentLifecyclePages';
import {CertificateManagementPage,CertificatePrintPage} from './pages/CertificateManagementPages';
import {LibraryManagementPage} from './pages/LibraryManagementPage';
import {DisciplineManagementPage} from './pages/DisciplineManagementPage';
import {InventoryManagementPage,ReceptionManagementPage} from './pages/OperationsManagementPages';
import {ExamManagementPage,ExamMarksPage,ExamResultsPage} from './pages/ExamManagementPages';
import {StaffLeavePage} from './pages/StaffLeavePage';
import {StudentLearningPage} from './pages/StudentLearningPage';
import {AttendanceManagementPage} from './pages/AttendanceManagementPage';
import {ParentsManagementPage,NoticesManagementPage,HomeworkManagementPage,LessonPlansManagementPage} from './pages/SchoolWorkflowPages';
import {AccessManagementPage} from './pages/AccessManagementPage';
import {MemberWorkspacePage} from './pages/MemberWorkspacePage';
import {SchoolSetupPage} from './pages/SchoolSetupPage';
import {PersonDetailPage} from './pages/PersonDetailPage';
import {StaffManagementPage} from './pages/StaffManagementPage';
import React from 'react';
import { ConfigProvider, App as AntApp } from 'antd';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { antdCustomTheme } from './theme/antdTheme';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { EnrollmentPage } from './pages/EnrollmentPage';

import {AcademicCatalogPage} from './pages/AcademicCatalogPage';
import {TimetablePage} from './pages/TimetablePage';
import {FeatureReportPage,UnavailableFeaturePage} from './pages/FeatureReportPage';
// Implemented read-only screens. Other routes explicitly show current limitations.
import { StudentsPage } from './pages/StudentsPage';
import { TeachersPage } from './pages/TeachersPage';
import { ProfilePage } from './pages/ProfilePage';
import { FeeLedgerPage } from './pages/FeeLedgerPage';
import { IdCardPage } from './pages/IdCardPage';
import { DashboardPage } from './pages/DashboardPage';
import { PlatformPortal } from './pages/PlatformPortal';

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { isAuthenticated,hasRole } = useAuth();
  const administrator=hasRole('schooladmin','superadmin');

  return (
    <Routes>
      <Route path="/enroll" element={<EnrollmentPage />} />
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />

      <Route
        path="/*"
        element={
          <RequireAuth>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/feature-report" element={<FeatureReportPage />} />
                <Route path="/dashboard" element={administrator?<DashboardPage />:<MemberWorkspacePage />} />
                <Route path="/roles" element={administrator?<AccessManagementPage />:<MemberWorkspacePage />} />
                <Route path="/workspace" element={<MemberWorkspacePage />} />
                <Route path="/students" element={<StudentsPage />} />
                <Route path="/students/:id" element={<PersonDetailPage kind="students" />} />
                <Route path="/id-cards" element={<IdCardPage variant="student" />} />
                <Route path="/teachers" element={<TeachersPage />} />
                <Route path="/teachers/:id" element={<PersonDetailPage kind="teachers" />} />
                <Route path="/teacher-id-cards" element={<IdCardPage variant="teacher" />} />
                <Route path="/staff-id-cards" element={<IdCardPage variant="staff" />} />
                <Route path="/student-portal" element={<StudentLearningPage />} />
                <Route path="/parent-portal" element={<StudentLearningPage parents />} />
                <Route path="/academics" element={<SchoolSetupPage academics />} />
                <Route path="/imports" element={<Navigate to="/academics?tab=import" replace />} />
                <Route path="/subjects" element={<AcademicCatalogPage />} />
                <Route path="/timetable" element={<TimetablePage />} />
                <Route path="/homework" element={<HomeworkManagementPage />} />
                <Route path="/lesson-plans" element={<LessonPlansManagementPage />} />
                <Route path="/promotion" element={<PromotionManagementPage />} />
                <Route path="/parents" element={<ParentsManagementPage />} />
                <Route path="/attendance" element={<AttendanceManagementPage />} />
                <Route path="/discipline" element={<DisciplineManagementPage />} />
                <Route path="/exams" element={<ExamManagementPage />} />
                <Route path="/marks-entry/:scheduleId" element={<ExamMarksPage />} />
                <Route path="/exam-results/:examId" element={<ExamResultsPage />} />
                <Route path="/quizzes" element={<QuizManagementPage />} />
                <Route path="/fees" element={<FeeLedgerPage />} />
                <Route path="/payroll" element={<PayrollManagementPage />} />
                <Route path="/staff" element={<StaffManagementPage />} />
                <Route path="/leaves" element={<StaffLeavePage />} />
                <Route path="/library" element={<LibraryManagementPage />} />
                <Route path="/transport" element={<TransportManagementPage />} />
                <Route path="/inventory" element={<InventoryManagementPage />} />
                <Route path="/notices" element={<NoticesManagementPage />} />
                <Route path="/reception" element={<ReceptionManagementPage />} />
                <Route path="/certificates" element={<CertificateManagementPage />} />
                <Route path="/certificates/:id/print" element={<CertificatePrintPage />} />
                <Route path="/alumni" element={<AlumniManagementPage />} />
                <Route path="/live-classes" element={<LiveClassManagementPage />} />
                <Route path="/settings" element={<SchoolSetupPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </AppLayout>
          </RequireAuth>
        }
      />
    </Routes>
  );
};

const ThemedApp: React.FC = () => {
  const { resolvedTheme } = useTheme();
  return (
  <ConfigProvider theme={antdCustomTheme(resolvedTheme)}>
    <AntApp>
      {window.location.hostname === 'admin.gurukull.in' ? <PlatformPortal /> : <BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>}
    </AntApp>
  </ConfigProvider>
  );
};

export const App: React.FC = () => <ThemeProvider><ThemedApp /></ThemeProvider>;
