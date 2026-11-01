import {describe, expect, it} from 'vitest';
import {profileInput} from '../src/profile-management.js';
import {studentInput, teacherInput, staffInput} from '../src/people-management.js';
import {configurationInput, yearInput, classInput, sectionInput} from '../src/school-management.js';
import {certificateTemplateInput, certificateIssueInput, renderCertificateText, validCertificateText} from '../src/certificate-management.js';
import {inventoryCategoryInput, inventorySupplierInput, inventoryItemInput, stockMovementInput, stockBalance, stockDelta} from '../src/inventory-management.js';
import {leaveTypeInput, leaveInput, leaveReviewInput} from '../src/leave-management.js';
import {validIsbn, libraryBookInput, libraryCardInput, libraryLoanInput} from '../src/library-management.js';
import {visitorInput} from '../src/reception-management.js';
import {vehicleInput, routeInput, stopInput, transportAssignmentInput, serviceWindowsOverlap} from '../src/transport-management.js';
import {feeGroupInput, feeInvoiceInput, feePaymentInput, financePolicyInput, feeBalance} from '../src/fee-management.js';
import {examInput, examScheduleInput, examGradeInput, examMarksInput, resultPercentage} from '../src/exam-management.js';
import {validMeetingUrl, liveClassInput} from '../src/live-class-management.js';
import {gradeQuiz, quizInput, quizQuestionInput, validateQuizAnswers} from '../src/quiz-management.js';
import {payrollFormula, roundPayroll, calculatePayroll, type PayHead} from '../src/payroll-calculation.js';
import {validAccessKey, accessKeyDigest, verifyAccessKey} from '../src/admin-access.js';
import {validMemberKey, memberKeyDigest, verifyMemberKey, generateTemporaryPassword} from '../src/member-access.js';
import {setupRequestAllowed} from '../src/admin-access.js';
import {DEFAULT_LOCALE_TAG,isPilotLocaleTag,isSupportedLocaleTag,localePreferenceInput,schoolLocaleSettingsInput} from '../src/locale-preferences.js';

// These are scalar and authentication-boundary tests. They intentionally do not
// create school, student, teacher, or staff rows in any database.
const iso = '2026-10-14';
const basePerson = {
  name: 'Boundary Person', email: 'boundary@example.com', mobile: '8056745614', firstName: null,
  lastName: null, gender: 'other' as const, dateOfBirth: null, bloodGroup: null, address: null,
  city: null, pincode: null, alternateMobile: null, aadhaarNumber: null,
};

describe('school, people, and profile input contracts', () => {
  it('accepts current school setup and rejects invalid dates/timezones', () => {
    expect(configurationInput.safeParse({timezone: 'Asia/Kolkata', currency: 'INR', address: 'Tamil Nadu'}).success).toBe(true);
    expect(configurationInput.safeParse({timezone: 'Not/AZone', currency: 'INR', address: 'Tamil Nadu'}).success).toBe(false);
    expect(yearInput.safeParse({name: '2026-27', startsOn: '2026-04-01', endsOn: '2027-05-01', isCurrent: true}).success).toBe(true);
    expect(yearInput.safeParse({name: 'bad', startsOn: '2027-05-01', endsOn: '2026-04-01', isCurrent: true}).success).toBe(false);
    expect(classInput.parse({name: '1st', code: 'I', sortOrder: 1})).toMatchObject({name: '1st'});
    expect(sectionInput.safeParse({classId: 'class-a', name: 'A', sortOrder: 1}).success).toBe(true);
  });
  it('enforces distinct student, teacher, and staff contact requirements', () => {
    const student = studentInput.parse({...basePerson, email: null, mobile: '8056745614', registrationNumber: 'ADM-1', rollNumber: '1', sectionId: 'section-a', enrollmentDate: iso});
    expect(student.mobile).toBe('8056745614');
    expect(teacherInput.safeParse({...basePerson, employeeId: 'EMP-1', designation: 'assistant_teacher', jobType: 'full_time', joiningDate: iso, subDesignation: null, ugDegree: null, pgDegree: null, specialization: null, interestedIn: null, reportingTo: null}).success).toBe(true);
    expect(teacherInput.safeParse({...basePerson, email: null, employeeId: 'EMP-1', designation: 'teacher', jobType: 'full_time', joiningDate: iso, subDesignation: null, ugDegree: null, pgDegree: null, specialization: null, interestedIn: null, reportingTo: null}).success).toBe(false);
    expect(staffInput.safeParse({...basePerson, email: null, mobile: null, employeeId: 'STAFF-1', designation: 'office', joiningDate: iso}).success).toBe(false);
    expect(profileInput.safeParse({name: 'Boundary', version: 1, mobile: '8056745614', gender: 'other', dateOfBirth: null, bloodGroup: null, address: null, city: null, pincode: null}).success).toBe(true);
  });
});

describe('certificate, inventory, leave, library, and reception contracts', () => {
  it('renders only approved certificate placeholders', () => {
    const body = 'This certifies {STUDENT_NAME} for {ACADEMIC_YEAR}.';
    expect(validCertificateText(body)).toBe(true);
    expect(renderCertificateText(body, {STUDENT_NAME: 'Boundary Student', ACADEMIC_YEAR: '2026-27'})).toContain('Boundary Student');
    expect(validCertificateText('Unknown {PASSWORD}')).toBe(false);
    expect(certificateTemplateInput.safeParse({name: 'Study', type: 'study', headerTitle: 'School', subheader: null, bodyContent: body, footerLeft: null, footerRight: null}).success).toBe(true);
    expect(certificateIssueInput.safeParse({studentId: 'student-1', templateId: 'template-1', certificateNo: 'CERT-1', issueDate: iso, reason: null}).success).toBe(true);
  });
  it('guards inventory arithmetic and input relationships', () => {
    expect(stockDelta('stock_in', 3)).toBe(3); expect(stockDelta('damaged', 3)).toBe(-3);
    expect(stockBalance(5, -3)).toBe(2); expect(stockBalance(1, -2)).toBeNull();
    expect(inventoryCategoryInput.parse({name: 'Books', code: 'books', description: null}).code).toBe('BOOKS');
    expect(inventorySupplierInput.safeParse({name: 'Supplier', contactPerson: 'Contact', mobile: '8056745614', email: null, address: null}).success).toBe(true);
    expect(inventoryItemInput.safeParse({name: 'Notebook', itemCode: 'nb-1', categoryId: 'cat-1', supplierId: null, unit: 'piece', unitPriceMinor: 100, reorderLevel: 2}).success).toBe(true);
    expect(stockMovementInput.safeParse({version: 1, type: 'stock_out', quantity: 1, transactionDate: iso, issuedTo: null, remarks: 'Boundary'}).success).toBe(false);
  });
  it('enforces leave overlap and library ISBN/date rules at boundaries', () => {
    expect(leaveTypeInput.safeParse({name: 'Casual', maxDays: 12, status: 'active'}).success).toBe(true);
    expect(leaveInput.safeParse({userId: 'u', leaveTypeId: 'l', startsOn: iso, endsOn: '2026-10-13', session: 'whole_day', reason: 'Boundary', remarks: null}).success).toBe(false);
    expect(leaveReviewInput.safeParse({version: 1, status: 'approved', chargeDays: null, comments: 'Boundary'}).success).toBe(false);
    expect(validIsbn('978-0-306-40615-7')).toBe(true); expect(validIsbn('9780306406158')).toBe(false);
    expect(libraryBookInput.safeParse({categoryId: 'cat', title: 'Book', author: 'Author', isbn: '9780306406157', publisher: null, description: null}).success).toBe(true);
    expect(libraryCardInput.safeParse({userId: 'u', cardNo: 'CARD-1', issuedOn: iso, expiresOn: '2026-10-13'}).success).toBe(false);
    expect(libraryLoanInput.safeParse({copyId: 'copy', cardId: 'card', issueDate: iso, dueDate: '2026-10-20', remarks: null}).success).toBe(true);
  });
  it('requires relationship fields for parent and business visitors', () => {
    const parent = {relation: 'parent' as const, studentId: 'student-1', studentRelation: 'father' as const, relationName: null, name: 'Visitor Name', contactNumber: '8056745614', email: null, companyName: null, address: null, purpose: 'parents_meeting' as const, visitorCount: 1, employeeId: 'employee-1', visitDate: iso, entryTime: '09:00', exitTime: '10:00', remarks: null};
    expect(visitorInput.safeParse(parent).success).toBe(true);
    expect(visitorInput.safeParse({...parent, studentId: null}).success).toBe(false);
    expect(visitorInput.safeParse({...parent, relation: 'other', studentId: null, studentRelation: null, purpose: 'business', companyName: null}).success).toBe(false);
  });
});

describe('transport, finance, exams, quizzes, payroll, and live classes', () => {
  it('validates transport windows and assignments', () => {
    const route = {vehicleId: 'v', name: 'Route', code: 'R1', startLocation: 'Start', endLocation: 'End', pickupStart: '07:00', pickupEnd: '07:30', dropStart: '15:00', dropEnd: '15:30', weekdays: ['Monday'] as const, fareMinor: 100, version: 1};
    expect(routeInput.safeParse(route).success).toBe(true); expect(stopInput.safeParse({routeId: 'r', name: 'Stop', pickupTime: '07:10', dropTime: '07:20', sortOrder: 1, fareMinor: 100, version: 1}).success).toBe(true);
    expect(vehicleInput.safeParse({vehicleNumber: 'TN-01', model: null, capacity: 20, driverName: 'Driver', driverPhone: '8056745614', driverLicense: null, gpsDeviceId: null, version: 1}).success).toBe(true);
    expect(transportAssignmentInput.safeParse({studentId: 's', routeId: 'r', stopId: 'stop', version: 1}).success).toBe(true);
    expect(serviceWindowsOverlap(route, {...route, pickupStart: '07:20', pickupEnd: '07:40'})).toBe(true);
  });
  it('keeps money, exam, quiz, and payroll rules explicit', () => {
    expect(feeBalance(1000, 200, 100)).toBe(700); expect(feeBalance(1000, 901, 100)).toBeNull();
    expect(feeGroupInput.safeParse({name: 'Tuition', description: null}).success).toBe(true);
    expect(feeInvoiceInput.safeParse({studentId: 's', feeGroupId: 'g', amountMinor: 1000, dueDate: iso}).success).toBe(true);
    expect(feePaymentInput.safeParse({invoiceId: 'i', version: 1, amountMinor: 100, concessionMinor: 0, paymentMode: 'upi', transactionRef: null, paidOn: iso, remarks: 'Boundary'}).success).toBe(false);
    expect(financePolicyInput.safeParse({invoicePrefix: 'INV', receiptPrefix: 'REC', numberWidth: 5, nextInvoiceNumber: 1, nextReceiptNumber: 1, version: 0}).success).toBe(true);
    expect(examInput.safeParse({name: 'Term 1', term: null, startsOn: iso, endsOn: '2026-10-20', status: 'active', absentTotals: 'exclude', percentageDecimals: 2, version: 1}).success).toBe(true);
    expect(examScheduleInput.safeParse({examId: 'e', assignmentId: 'a', examDate: iso, startTime: '09:00', endTime: '10:00', maxMarks: 100, passMarks: 35, portion: null, version: 1}).success).toBe(true);
    expect(examGradeInput.safeParse({name: 'A', minPercentage: 80, maxPercentage: 100, gradePoint: 10, remarks: null, version: 1}).success).toBe(true);
    expect(examMarksInput.safeParse({version: 1, marks: [{studentId: 's', marksObtained: null, isAbsent: true, remarks: null}]}).success).toBe(true);
    expect(resultPercentage(35, 100, 2)).toBe(35);
    const q = {id: '11111111-1111-4111-8111-111111111111', questionText: '2+2?', questionType: 'short_answer' as const, grading: 'exact' as const, options: [], correctAnswer: '4', marks: 1};
    expect(quizQuestionInput.safeParse(q).success).toBe(true); expect(() => validateQuizAnswers([q], {[q.id]: '4'})).not.toThrow(); expect(gradeQuiz([q], {[q.id]: '4'}, false).autoUnits).toBe(100);
    expect(quizInput.safeParse({assignmentId: 'a', title: 'Quiz', description: null, opensAt: '2026-10-14T09:00:00Z', closesAt: '2026-10-14T10:00:00Z', durationMinutes: 30, maxAttempts: 1, passingPercentage: 50, caseSensitiveAnswers: false, status: 'draft', questions: [q]}).success).toBe(true);
    expect(roundPayroll(payrollFormula('GROSS * 10 / 100', {GROSS: 1000}), 'half_up', 1)).toBe(100); expect(roundPayroll(payrollFormula('12.5', {}), 'half_up', 1)).toBe(13);
    const heads: PayHead[] = [{key: 'B', name: 'Basic', kind: 'earning', mode: 'fixed', value: 1000, formula: null}]; expect(calculatePayroll(heads, 1000, {}, 1, 1, 'floor', 1).netMinor).toBe(1000);
    expect(validMeetingUrl('google_meet', 'https://meet.google.com/abc-defg-hij')).toBe(true); expect(validMeetingUrl('google_meet', 'https://meet.google.com.evil/a')).toBe(false);
    expect(liveClassInput.safeParse({assignmentId: 'a', title: 'Class', description: null, platform: 'google_meet', meetingUrl: 'https://meet.google.com/abc-defg-hij', meetingId: null, passcode: null, startsAt: '2026-10-14T09:00:00Z', endsAt: '2026-10-14T10:00:00Z', status: 'scheduled'}).success).toBe(true);
  });
});

describe('credential and route authorization boundaries', () => {
  it('accepts only canonical 256-bit owner/member keys and binds their digests', async () => {
    const temporaryPassword=generateTemporaryPassword(); expect(temporaryPassword).toHaveLength(20); expect(temporaryPassword).toMatch(/[^A-Za-z0-9]/);
    const access = `gkb1_${'A'.repeat(43)}`;
    const member = `gkm1_${'A'.repeat(43)}`;
    expect(validAccessKey(access)).toBe(false); expect(validMemberKey(member)).toBe(false);
    const generatedAccess = `gka1_${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')}`;
    const generatedMember = `gku1_${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')}`;
    expect(validAccessKey(generatedAccess)).toBe(true); expect(validMemberKey(generatedMember)).toBe(true);
    const a = await accessKeyDigest(generatedAccess, 'boundary-secret-at-least-32-bytes', 'school', 'user');
    expect(await verifyAccessKey(generatedAccess, a, 'boundary-secret-at-least-32-bytes', 'school', 'user')).toBe(true);
    expect(await verifyAccessKey(generatedAccess, a, 'boundary-secret-at-least-32-bytes', 'other-school', 'user')).toBe(false);
    const m = await memberKeyDigest(generatedMember, 'boundary-secret-at-least-32-bytes', 'school', 'user');
    expect(await verifyMemberKey(generatedMember, m, 'boundary-secret-at-least-32-bytes', 'school', 'user')).toBe(true);
    expect(await verifyMemberKey(generatedMember, m, 'boundary-secret-at-least-32-bytes', 'school', 'other-user')).toBe(false);
  });
  it('keeps every implemented module behind an explicitly allowlisted method/path pair', () => {
    const allowed = [
      ['GET', '/api/admin/certificates'], ['POST', '/api/admin/certificate-templates'], ['GET', '/api/admin/library'],
      ['POST', '/api/admin/inventory'], ['GET', '/api/admin/reception'], ['POST', '/api/admin/discipline'],
      ['POST', '/api/admin/exams'], ['GET', '/api/admin/fees'], ['POST', '/api/admin/transport-routes'],
      ['GET', '/api/admin/live-classes'], ['POST', '/api/admin/quizzes'], ['GET', '/api/admin/payroll'],
      ['GET', '/api/admin/students'], ['POST', '/api/admin/parents'], ['GET', '/api/admin/notices'],
    ] as const;
    for (const [method, path] of allowed) expect(setupRequestAllowed(method, path), `${method} ${path}`).toBe(true);
    expect(setupRequestAllowed('DELETE', '/api/admin/exams')).toBe(false);
    expect(setupRequestAllowed('POST', '/api/admin/unknown-module')).toBe(false);
  });
});

describe('language preference contracts', () => {
  it('keeps all script-sensitive Indian locale tags distinct and exposes only reviewed pilots', () => {
    expect(DEFAULT_LOCALE_TAG).toBe('en');
    expect(isSupportedLocaleTag('ks-Arab')).toBe(true);
    expect(isSupportedLocaleTag('sd-Arab')).toBe(true);
    expect(isSupportedLocaleTag('mni-Mtei')).toBe(true);
    expect(isSupportedLocaleTag('ks')).toBe(false);
    expect(isPilotLocaleTag('hi')).toBe(true);
    expect(isPilotLocaleTag('bn')).toBe(false);
  });
  it('requires an explicit selected language and versioned, reviewed school settings', () => {
    expect(localePreferenceInput.safeParse({mode:'explicit',localeTag:'ta',version:0}).success).toBe(true);
    expect(localePreferenceInput.safeParse({mode:'explicit',localeTag:null,version:0}).success).toBe(false);
    expect(localePreferenceInput.safeParse({mode:'follow_school',localeTag:'hi',version:0}).success).toBe(false);
    expect(schoolLocaleSettingsInput.safeParse({defaultLocale:'hi',enabledLocales:['en','hi','ta'],version:0}).success).toBe(true);
    expect(schoolLocaleSettingsInput.safeParse({defaultLocale:'ur',enabledLocales:['en','hi'],version:0}).success).toBe(false);
  });
});
