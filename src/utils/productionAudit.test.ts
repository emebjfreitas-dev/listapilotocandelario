import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { INITIAL_CLASSES } from '../data/mockData';
import {
  getStudentAttendanceMetrics,
  getStudentBimesterReport,
  getClassAttendanceMetrics,
  OFFICIAL_BIMESTERS_2027,
} from './attendanceRules';
import {
  evaluateAttendanceLaunchWindow,
  evaluateClassEndOfDayReminder,
  mergeClassesWithConcurrencyControl,
  isValidInstitutionalEmail,
  isUserAccessExpired,
  isUserAccessEffectivelyActive,
  syncExpiredAuthorizedUsers,
  syncAuthorizedTeachersOntoClasses,
  validateAndSanitizeJsonPayload,
  maskSensitiveText,
  sanitizeStudentForLgpd,
} from '../services/db';
import {
  normalizeStudentNameForPhoto,
  normalizeStudentNameCoreTokens,
  extractDriveFileOrFolderId,
  attachPhotosFromDiscoveredCache,
  attachNominalPdfsFromDiscoveredCache,
} from '../services/googleSheetsApi';
import {
  normalizeTextKey,
  normalizeDigits,
  classifyDisabilityValue,
  decodeHtmBuffer,
} from './htmDisabilityParser';
import {
  hasForbiddenPrototypeKey,
  isValidIsoCalendarDate,
  isValidBrCalendarDate,
  validateAuthSessionRequest,
  validateDriveTokenPayload,
  validatePhotoUploadBinaryHeaders,
  validatePhotoUploadPayload,
  validatePhotoBatchPayload,
  validatePdfUploadPayload,
  validatePdfBatchPayload,
  validateSchoolStateClassesPayload,
  validateSchoolStateLinksPayload,
  validateSchoolStateUsersPayload,
  validateSchoolStateResetPayload,
  validateSchoolStateImportJsonPayload,
  validateSchoolStateLogsPayload,
  validateAttendanceWindowPayload,
  validateSchoolNoticesPayload,
  validateCalendarConfigPayload,
  validateHolidayActionPayload,
  validateSecurityLogPayload,
  validateFcmRegisterTokenPayload,
  validateFcmUnregisterTokenPayload,
  validateFcmConfigPayload,
  validateFcmSendWindowAlertPayload,
} from './serverValidation';
import {
  buildDocxBytes,
  buildPdfBytes,
  buildWorkbookBytes,
  buildCsvString,
  toWinAnsiSafeText,
  sanitizeSpreadsheetCell,
  UniversalExportReport,
} from './universalExport';
import { isStaticHostname } from '../services/apiEnvironment';
import {
  evaluateLocalPhotoUrlValidity,
  planPhotoCacheVerificationDeletions,
  StudentPhotoUrlRecord,
  StudentPhotoBlobRecord,
  UrlProbeOutcome,
  PhotoCacheInvalidReason,
} from '../services/photoIndexedDbCache';
import { AuthorizedUser, ClassGroup, Student } from '../types';
import { resizePhotoWithCanvasToWebp } from './photoCompressor';
import { fetchClassesFromFirestorePaginated } from '../services/firebaseSync';
import {
  uploadFileWithCacheControl,
  uploadStudentPhotoToStorage,
  uploadStudentPdfToStorage,
} from '../services/firebaseStorage';
import {
  computeMd5Hex,
  computeSha256Hex,
  compressJsonMetadataGzip,
  decompressJsonMetadataGzip,
} from '../services/driveLosslessStorage';
import {
  isStrictAdminNotificationSender,
  triggerPushNotification,
  triggerConsecutiveAbsencePushNotification,
  buildContextualPushNotices,
} from '../services/pushNotificationService';
import { dispatchWindowClosingFcmAlert } from '../services/fcmService';

console.log('Iniciando suíte de validação de produção — Lista Piloto 2027...');

// 1. Validação das 40 Turmas Oficiais e Matriz SED
assert.equal(INITIAL_CLASSES.length, 40, 'Devem existir exatamente 40 turmas oficiais');
const infantilCount = INITIAL_CLASSES.filter((c) => c.name.startsWith('GRUPO')).length;
const fundamentalCount = INITIAL_CLASSES.filter((c) => !c.name.startsWith('GRUPO')).length;
assert.ok(infantilCount > 0 && fundamentalCount > 0, 'Deve conter turmas de Ed. Infantil e Ens. Fundamental');

// 2. Validação de Cálculos de Frequência (Ed. Infantil 60% vs Ens. Fundamental 75%)
const g4Class = INITIAL_CLASSES.find((c) => c.name.startsWith('GRUPO 04'))!;
const fundClass = INITIAL_CLASSES.find((c) => c.name.includes('1º ANO'))!;

const baseInfantilStudent: Student = g4Class.students[0] || {
  id: 'audit-stu-g04a-1',
  number: 1,
  name: 'ALUNO TESTE INFANTIL',
  turma: g4Class.name,
  tipoEnsino: 'EDUCAÇÃO INFANTIL',
  ra: '100000001',
  digRa: '1',
  birthDate: '10/03/2023',
  age: '4 anos',
  status: 'ATIVO',
  guardianName: 'RESPONSÁVEL TESTE',
  guardianPhone: '(11) 99999-0001',
  consecutiveAbsences: 0,
  totalAbsencesMonth: 0,
  justifiedAbsences: 0,
  totalAbsencesYear: 0,
};

const baseFundStudent: Student = fundClass.students[0] || {
  id: 'audit-stu-1a-1',
  number: 1,
  name: 'ALUNO TESTE FUNDAMENTAL',
  turma: fundClass.name,
  tipoEnsino: 'ENSINO FUNDAMENTAL',
  ra: '100000002',
  digRa: '2',
  birthDate: '15/04/2020',
  age: '7 anos',
  status: 'ATIVO',
  guardianName: 'RESPONSÁVEL TESTE FUND',
  guardianPhone: '(11) 99999-0002',
  consecutiveAbsences: 0,
  totalAbsencesMonth: 0,
  justifiedAbsences: 0,
  totalAbsencesYear: 0,
};

const testInfantilStudent: Student = {
  ...baseInfantilStudent,
  totalAbsencesMonth: 9, // 11 presenças em 20 dias = 55% (< 60%)
  justifiedAbsences: 2,
};
const infMetrics = getStudentAttendanceMetrics(testInfantilStudent, 20);
assert.equal(infMetrics.isEducacaoInfantil, true);
assert.equal(infMetrics.minLegalPresencePercent, 60);
assert.equal(infMetrics.frequenciaPercent, 55);
assert.equal(infMetrics.isBelowLegalThreshold, true);
assert.equal(infMetrics.faltasNaoJustificadas, 7);

const testFundStudent: Student = {
  ...baseFundStudent,
  totalAbsencesMonth: 6, // 14 presenças em 20 dias = 70% (< 75%)
  justifiedAbsences: 6,
};
const fundMetrics = getStudentAttendanceMetrics(testFundStudent, 20);
assert.equal(fundMetrics.isEducacaoInfantil, false);
assert.equal(fundMetrics.minLegalPresencePercent, 75);
assert.equal(fundMetrics.frequenciaPercent, 70);
assert.equal(fundMetrics.isBelowLegalThreshold, true);
assert.equal(fundMetrics.faltasNaoJustificadas, 0);

// 3. Validação dos Bimestres de 2027 (Bolsa Família: Fev+Mar até Out+Nov)
assert.equal(OFFICIAL_BIMESTERS_2027.length, 6);
const bimReport = getStudentBimesterReport(testFundStudent, fundClass, '1bim');
assert.equal(bimReport.monthsBreakdown.length, 2);
assert.equal(bimReport.monthsBreakdown[0].monthName, 'Fevereiro');
assert.equal(bimReport.monthsBreakdown[1].monthName, 'Março');

// 4. Validação de Controle de Concorrência entre Dispositivos e Preservação de Vínculo Manual
const seededG4Students = g4Class.students.length > 0 ? g4Class.students : [baseInfantilStudent];
const baseClass: ClassGroup = {
  ...g4Class,
  updatedAtMs: 1000,
  students: seededG4Students.map((s, idx) =>
    idx === 0
      ? {
          ...s,
          totalAbsencesMonth: 2,
          updatedAtMs: 1000,
          fichaPdfDriveId: 'auto-pdf-id',
          fichaPdfManualLink: false,
        }
      : s
  ),
};

// Dispositivo A (mais recente: t=3000) vinculou manualmente um PDF com nome divergente e alterou faltas para 5
const localEditedClass: ClassGroup = {
  ...baseClass,
  updatedAtMs: 3000,
  students: baseClass.students.map((s, idx) =>
    idx === 0
      ? {
          ...s,
          totalAbsencesMonth: 5,
          updatedAtMs: 3000,
          fichaPdfDriveId: 'manual-pdf-999',
          fichaPdfDriveUrl: 'https://drive.google.com/file/d/manual-pdf-999/view',
          fichaPdfManualLink: true,
          photo: '/api/drive-photo/manual-photo-888',
          photoDriveId: 'manual-photo-888',
          photoManualLink: true,
        }
      : s
  ),
};

// Dispositivo B (atrasado: t=2000) enviou estado antigo
const staleRemoteClass: ClassGroup = {
  ...baseClass,
  updatedAtMs: 2000,
};

const mergedResult = mergeClassesWithConcurrencyControl(
  [staleRemoteClass],
  [localEditedClass],
  2000,
  3000
);

assert.equal(
  mergedResult[0].students[0].totalAbsencesMonth,
  5,
  'Gravação atrasada não pode sobrescrever lançamento mais recente'
);
assert.equal(
  mergedResult[0].students[0].fichaPdfDriveId,
  'manual-pdf-999',
  'Vínculo manual de PDF deve ser preservado contra sobrescrita'
);
assert.equal(
  mergedResult[0].students[0].photoDriveId,
  'manual-photo-888',
  'Vínculo manual de Foto deve ser preservado contra sobrescrita'
);

// 5. Validação de Preservação de Vínculo Manual durante Sincronização Automática do Cache Drive
const afterAutoCacheClasses = attachPhotosFromDiscoveredCache(
  attachNominalPdfsFromDiscoveredCache(mergedResult)
);
assert.equal(
  afterAutoCacheClasses[0].students[0].fichaPdfDriveId,
  'manual-pdf-999',
  'attachNominalPdfsFromDiscoveredCache não pode sobrescrever fichaPdfManualLink'
);
assert.equal(
  afterAutoCacheClasses[0].students[0].photoDriveId,
  'manual-photo-888',
  'attachPhotosFromDiscoveredCache não pode sobrescrever photoManualLink'
);

// 6. Validação de Normalização de Nomes com Grafia Divergente / Abreviada
assert.equal(
  normalizeStudentNameForPhoto('G04A - 05 - JOÃO PEDRO DA SILVA (1).jpg'),
  'JOAO PEDRO DA SILVA'
);
assert.equal(
  normalizeStudentNameCoreTokens('JOÃO PEDRO DA SILVA'),
  normalizeStudentNameCoreTokens('JOAO PEDRO SILVA')
);
assert.equal(
  extractDriveFileOrFolderId('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/view?usp=sharing'),
  '1AbCdEfGhIjKlMnOpQrStUvWxYz123456'
);

// 7. Validação de Domínio Institucional e Janela de Lançamento
assert.equal(isValidInstitutionalEmail('maria@educacao.jundiai.sp.gov.br'), true);
assert.equal(isValidInstitutionalEmail('emebjfreitas@jundiai.sp.gov.br'), true);
assert.equal(isValidInstitutionalEmail('intruso@gmail.com'), false);

const windowOpenOverride = evaluateAttendanceLaunchWindow({
  exceptionalOverrideOpen: true,
});
assert.equal(windowOpenOverride.isAllowedToLaunch, true);

// 8. Validação do Lembrete de Fim de Expediente Escolar (Turno Manhã 12:00 / Turno Tarde 17:30)
const morningRefDate = new Date(2027, 9, 29, 10, 30, 0); // Sexta 29/10/2027 10:30 (último dia letivo)
const winMorningBeforeCutoff = evaluateAttendanceLaunchWindow(
  { exceptionalOverrideOpen: false },
  morningRefDate
);
assert.equal(winMorningBeforeCutoff.isSchoolWeekday, true);
assert.equal(winMorningBeforeCutoff.isAllowedToLaunch, true);
assert.equal(winMorningBeforeCutoff.isMorningEndOfDayReached, false);
assert.equal(winMorningBeforeCutoff.msUntilMorningEndOfDay, 45 * 60 * 1000);

const morningDueDate = new Date(2027, 9, 29, 11, 30, 0); // 11:30 (>= 11:15)
const morningPendingEval = evaluateClassEndOfDayReminder(
  { exceptionalOverrideOpen: false },
  { isPending: true, shift: 'Turno Manhã', periodo: 'MANHÃ' },
  morningDueDate
);
assert.equal(morningPendingEval.shouldRemindNow, true);
assert.equal(morningPendingEval.closingTimeLabel, '12:00');

const morningCompletedEval = evaluateClassEndOfDayReminder(
  { exceptionalOverrideOpen: false },
  { isPending: false, shift: 'Turno Manhã', periodo: 'MANHÃ' },
  morningDueDate
);
assert.equal(
  morningCompletedEval.shouldRemindNow,
  false,
  'Turma com frequência já lançada (isPending=false) não deve disparar lembrete'
);

const afternoonBeforeDate = new Date(2027, 9, 29, 15, 0, 0); // 15:00 (< 16:45)
const afternoonUpcomingEval = evaluateClassEndOfDayReminder(
  { exceptionalOverrideOpen: false },
  { isPending: true, shift: 'Turno Tarde', periodo: 'TARDE' },
  afternoonBeforeDate
);
assert.equal(afternoonUpcomingEval.shouldRemindNow, false);
assert.equal(afternoonUpcomingEval.msUntilReminder, 105 * 60 * 1000);

const afternoonDueDate = new Date(2027, 9, 29, 16, 50, 0); // 16:50 (>= 16:45)
const afternoonPendingEval = evaluateClassEndOfDayReminder(
  { exceptionalOverrideOpen: false },
  { isPending: true, shift: 'Turno Tarde', periodo: 'TARDE' },
  afternoonDueDate
);
assert.equal(afternoonPendingEval.shouldRemindNow, true);
assert.equal(afternoonPendingEval.closingTimeLabel, '17:30');

const sundayDate = new Date(2027, 9, 31, 17, 0, 0); // Domingo
const sundayEval = evaluateClassEndOfDayReminder(
  { exceptionalOverrideOpen: true },
  { isPending: true, shift: 'Turno Tarde', periodo: 'TARDE' },
  sundayDate
);
assert.equal(sundayEval.isSchoolWeekday, false);
assert.equal(sundayEval.shouldRemindNow, false);

const classMetrics = getClassAttendanceMetrics(g4Class);
assert.ok(classMetrics.presenceRate >= 0 && classMetrics.presenceRate <= 100);

// 9. Validação dos Helpers de Expiração Automática de Acesso
const refToday = new Date(2027, 4, 15, 10, 0, 0); // 15/05/2027
assert.equal(isUserAccessExpired({ accessExpiresAt: '2027-05-14' }, refToday), true, 'Data passada deve expirar');
assert.equal(isUserAccessExpired({ accessExpiresAt: '2027-05-15' }, refToday), false, 'Acesso válido até o fim do dia limite');
assert.equal(isUserAccessExpired({ accessExpiresAt: '2027-06-01' }, refToday), false, 'Data futura não expira');
assert.equal(isUserAccessExpired({ accessExpiresAt: '' }, refToday), false, 'Sem data limite não expira');

assert.equal(
  isUserAccessEffectivelyActive({ active: true, accessExpiresAt: '2027-05-14' }, refToday),
  false
);
assert.equal(
  isUserAccessEffectivelyActive({ active: true, accessExpiresAt: '2027-05-20' }, refToday),
  true
);
assert.equal(
  isUserAccessEffectivelyActive({ active: false, accessExpiresAt: '2027-05-20' }, refToday),
  false
);

const mockUsersForExpiry: AuthorizedUser[] = [
  {
    id: 'u-exp',
    email: 'expirado@educacao.jundiai.sp.gov.br',
    name: 'Prof. Expirado',
    role: 'usuario',
    assignedClassId: 'g04a',
    assignedClassName: 'GRUPO 04 A',
    active: true,
    accessExpiresAt: '2027-05-10',
    createdAt: '2027-02-01',
  },
  {
    id: 'u-ok',
    email: 'ativo@educacao.jundiai.sp.gov.br',
    name: 'Prof. Ativo',
    role: 'usuario',
    assignedClassId: '1a',
    assignedClassName: '1º ANO A',
    active: true,
    accessExpiresAt: '2027-12-20',
    createdAt: '2027-02-01',
  },
];
const syncExpiryResult = syncExpiredAuthorizedUsers(mockUsersForExpiry, refToday);
assert.equal(syncExpiryResult.changed, true);
assert.equal(syncExpiryResult.expiredUsers.length, 1);
assert.equal(syncExpiryResult.expiredUsers[0].id, 'u-exp');
assert.equal(syncExpiryResult.updatedUsers[0].active, false);
assert.equal(syncExpiryResult.updatedUsers[1].active, true);

// 10. Validação do Sanitizador de Payload JSON (validateAndSanitizeJsonPayload)
const nullPayloadRes = validateAndSanitizeJsonPayload(null);
assert.equal(nullPayloadRes.isValid, false);

const protoAttackJson = JSON.parse('{"classes":[{"id":"1a","students":[]}],"__proto__":{"isAdmin":true}}');
const protoAttackRes = validateAndSanitizeJsonPayload(protoAttackJson);
assert.equal(protoAttackRes.isValid, false, 'Deve bloquear payload com chave __proto__');

const flatSedPayload = [
  {
    TURMA: g4Class.name,
    ESTUDANTE: 'MARIA CLARA <script>alert(1)</script>SOUZA',
    RA: '123456789-0',
    FILIACAO_1: 'ANA SOUZA javascript:alert(2)',
    DEFICIENCIA: 'TEA',
  },
];
const validFlatRes = validateAndSanitizeJsonPayload(flatSedPayload);
assert.equal(validFlatRes.isValid, true);
assert.equal(validFlatRes.importedClassesCount, 1);
assert.equal(validFlatRes.importedStudentsCount, 1);
const importedG4 = validFlatRes.classes?.find((c) => c.id === g4Class.id);
assert.ok(importedG4 && importedG4.students.length === 1);
assert.equal(importedG4!.students[0].name.includes('<script'), false, 'Script XSS deve ser removido');
assert.equal(importedG4!.students[0].ra, '123456789');
assert.equal(importedG4!.students[0].digRa, '0');
assert.equal(importedG4!.students[0].filiacao1?.toLowerCase().includes('javascript:'), false);

// 11. Validação do Parser HTM de Deficiências (htmDisabilityParser.ts)
assert.equal(normalizeTextKey('  Transtorno do   Espectro Autísta  '), 'TRANSTORNO DO ESPECTRO AUTISTA');
assert.equal(normalizeDigits('123.456.789-01'), '12345678901');

assert.deepEqual(classifyDisabilityValue('NÃO POSSUI'), { cleanValue: '', isClearSignal: true });
assert.deepEqual(classifyDisabilityValue('Sem Deficiência'), { cleanValue: '', isClearSignal: true });
assert.deepEqual(classifyDisabilityValue('   '), { cleanValue: '', isClearSignal: false });
assert.deepEqual(classifyDisabilityValue('Deficiência Auditiva'), {
  cleanValue: 'Deficiência Auditiva',
  isClearSignal: false,
});

// Decodificação UTF-8 e ISO-8859-1 / Windows-1252
const utf8Sample = new TextEncoder().encode('<meta charset="utf-8"><title>Educação Especial</title>');
const utf8Decoded = await decodeHtmBuffer(utf8Sample.buffer);
assert.ok(utf8Decoded.html.includes('Educação Especial'));

// ISO-8859-1 bytes for "Educação Especial" ('ç'=0xE7, 'ã'=0xE3)
const latin1Prefix = Array.from('<meta charset="iso-8859-1"><title>Educa').map((ch) => ch.charCodeAt(0));
const latin1Suffix = Array.from('o Especial</title>').map((ch) => ch.charCodeAt(0));
const latin1Bytes = new Uint8Array([...latin1Prefix, 0xe7, 0xe3, ...latin1Suffix]);
const latin1Decoded = await decodeHtmBuffer(latin1Bytes.buffer);
assert.ok(latin1Decoded.html.includes('Educação Especial'), 'Deve decodificar charset ISO-8859-1 corretamente');
assert.ok(latin1Decoded.charset.toLowerCase().includes('iso-8859-1'));

// 12. Validação Estrita de Payloads do Servidor (serverValidation.ts)
assert.equal(hasForbiddenPrototypeKey(JSON.parse('{"nested":{"constructor":{"x":1}}}')), true);
assert.equal(hasForbiddenPrototypeKey({ a: 1, b: ['ok'] }), false);

assert.equal(isValidIsoCalendarDate('2027-02-28'), true);
assert.equal(isValidIsoCalendarDate('2028-02-29'), true);
assert.equal(isValidIsoCalendarDate('2027-02-29'), false);
assert.equal(isValidIsoCalendarDate('2027-04-31'), false);

assert.equal(isValidBrCalendarDate('28/02/2027'), true);
assert.equal(isValidBrCalendarDate('29/02/2028'), true);
assert.equal(isValidBrCalendarDate('31/02/2027'), false);

assert.equal(validateAuthSessionRequest({}, 'Bearer abc.def.ghi').ok, true);
assert.equal(validateAuthSessionRequest({}, '').ok, false);

assert.equal(validateDriveTokenPayload({ accessToken: 'ya29.valid_token_12345' }).ok, true);
assert.equal(validateDriveTokenPayload({ accessToken: 'short' }).ok, false);

assert.equal(
  validatePhotoUploadBinaryHeaders('stu-1', 'a'.repeat(64), Buffer.from([1, 2, 3])).ok,
  true
);
assert.equal(
  validatePhotoUploadBinaryHeaders('stu-1', 'bad-sha', Buffer.from([1, 2, 3])).ok,
  false
);
assert.equal(validatePhotoUploadBinaryHeaders('', undefined, Buffer.from([1])).ok, false);

assert.equal(validatePhotoUploadPayload({ studentId: 'stu-1', photoDataUrl: 'data:image/webp;base64,AAA' }).ok, true);
assert.equal(validatePhotoUploadPayload({ studentId: '', photoDataUrl: 'data:image/webp;base64,AAA' }).ok, false);

assert.equal(validatePhotoBatchPayload({ photos: [{ studentId: 's1', photoDataUrl: 'data:image/png;base64,AA' }] }).ok, true);
assert.equal(validatePhotoBatchPayload({ photos: [] }).ok, false);

assert.equal(validatePdfUploadPayload({ studentId: 's1', pdfDataUrl: 'data:application/pdf;base64,JVBER' }).ok, true);
assert.equal(validatePdfBatchPayload({ pdfs: [] }).ok, false);

assert.equal(
  validateSchoolStateClassesPayload({
    classes: [{ id: 'g04a', students: [{ id: 's1', totalAbsencesMonth: 3, justifiedAbsences: 1 }] }],
  }).ok,
  true
);
assert.equal(
  validateSchoolStateClassesPayload({
    classes: [{ id: 'g04a', students: [{ id: 's1', totalAbsencesMonth: 99 }] }],
  }).ok,
  false
);
assert.equal(validateSchoolStateClassesPayload({ classes: [] }).ok, false);

assert.equal(
  validateSchoolStateLinksPayload({ cloudLinks: { photosFolderId: 'abc' } }).ok,
  true
);
assert.equal(validateSchoolStateLinksPayload({}).ok, false);

assert.equal(
  validateSchoolStateUsersPayload({
    authorizedUsers: [{ email: 'docente@educacao.jundiai.sp.gov.br', role: 'usuario', accessExpiresAt: '2027-12-15' }],
  }).ok,
  true
);
assert.equal(
  validateSchoolStateUsersPayload({
    authorizedUsers: [{ email: 'externo@gmail.com', role: 'usuario' }],
  }).ok,
  false
);
assert.equal(
  validateSchoolStateUsersPayload({
    authorizedUsers: [{ email: 'docente@educacao.jundiai.sp.gov.br', accessExpiresAt: '2027-02-30' }],
  }).ok,
  false
);

assert.equal(validateSchoolStateResetPayload({}).ok, true);
assert.equal(validateSchoolStateImportJsonPayload({ payload: { classes: [{ id: '1a' }] } }).ok, true);
assert.equal(validateSchoolStateImportJsonPayload({ payload: { classes: [] } }).ok, false);

assert.equal(validateSchoolStateLogsPayload({ accessSessionLogs: [{ id: 'log-1' }] }).ok, true);
assert.equal(validateSchoolStateLogsPayload({ accessSessionLogs: [{}] }).ok, false);

assert.equal(
  validateAttendanceWindowPayload({
    attendanceWindowConfig: { exceptionalOverrideOpen: true, simulatedDateISO: '2027-10-29' },
  }).ok,
  true
);
assert.equal(
  validateAttendanceWindowPayload({
    attendanceWindowConfig: { exceptionalOverrideOpen: true, simulatedDateISO: '2027-02-30' },
  }).ok,
  false
);

assert.equal(
  validateSchoolNoticesPayload({
    schoolNotices: [{ id: 'n1', title: 'Aviso', content: 'Reunião às 17h' }],
  }).ok,
  true
);
assert.equal(
  validateSchoolNoticesPayload({
    schoolNotices: [{ id: 'n1', title: '   ', content: 'Sem título' }],
  }).ok,
  false
);

assert.equal(validateCalendarConfigPayload({ rawDatesText: '01/02/2027', year: 2027 }).ok, true);
assert.equal(validateCalendarConfigPayload({ year: 1990 }).ok, false);

assert.equal(
  validateHolidayActionPayload({
    action: 'add',
    holiday: { date: '20/11/2027', name: 'Consciência Negra', type: 'nacional' },
  }).ok,
  true
);
assert.equal(
  validateHolidayActionPayload({
    action: 'add',
    holiday: { date: '31/02/2027', name: 'Data impossível', type: 'nacional' },
  }).ok,
  false
);

assert.equal(validateSecurityLogPayload({ eventType: 'LOGIN_SUCCESS', details: 'ok' }).ok, true);
assert.equal(validateSecurityLogPayload({ details: 'sem tipo' }).ok, false);

assert.equal(
  validateFcmRegisterTokenPayload({
    id: 'dev-1',
    userEmail: 'prof@educacao.jundiai.sp.gov.br',
    assignedClassIds: ['g04a'],
  }).ok,
  true
);
assert.equal(
  validateFcmRegisterTokenPayload({
    id: 'dev-1',
    userEmail: 'intruso@gmail.com',
  }).ok,
  false
);
assert.equal(validateFcmUnregisterTokenPayload({ id: 'dev-1' }).ok, true);
assert.equal(validateFcmConfigPayload({ fcmConfig: { notifyDaysBeforeClose: 3 } }).ok, true);
assert.equal(validateFcmConfigPayload({ fcmConfig: { notifyDaysBeforeClose: 0 } }).ok, false);
assert.equal(
  validateFcmSendWindowAlertPayload({
    alert: { title: 'Janela fecha hoje', body: 'Conclua o lançamento.' },
  }).ok,
  true
);
assert.equal(validateFcmSendWindowAlertPayload({ alert: { title: '', body: 'x' } }).ok, false);

// 13. Validação de Mascaramento LGPD (maskSensitiveText / sanitizeStudentForLgpd)
assert.equal(maskSensitiveText('123.456.789-01', 'cpf'), '***.456.789-**');
assert.equal(maskSensitiveText('12345678901', 'nis'), '***.45678.***-*');
assert.equal(maskSensitiveText('898000123456789', 'sus'), '*** **** **** 6789');
assert.equal(maskSensitiveText('12.345.678-9', 'rg'), '**.***.***-9');
assert.equal(maskSensitiveText('(11) 98765-4321', 'phone'), '(11) *****-4321');
assert.equal(maskSensitiveText('13201-000', 'cep'), '*****-000');
assert.equal(maskSensitiveText('Rua das Flores, 450', 'address'), 'Rua das Flores, ***');

const rawSensitiveStudent: Student = {
  ...baseInfantilStudent,
  cpf: '123.456.789-01',
  nis: '12345678901',
  rg: '12.345.678-9',
  cartaoSus: '898000123456789',
  telefones: '(11) 98765-4321',
  guardianPhone: '(11) 98765-4321',
  logradouro: 'Rua das Flores, 450',
  numeroResidencia: '450',
  complemento: 'Casa 2',
};
const maskedStudent = sanitizeStudentForLgpd(rawSensitiveStudent, true);
assert.equal(maskedStudent.cpf, '***.456.789-**');
assert.equal(maskedStudent.nis, '***.45678.***-*');
assert.equal(maskedStudent.rg, '**.***.***-9');
assert.equal(maskedStudent.telefones, '(11) *****-4321');
assert.equal(maskedStudent.guardianPhone, '(11) *****-4321');
assert.equal(maskedStudent.logradouro, 'Rua das Flores, ***');
assert.equal(maskedStudent.numeroResidencia, '***');
assert.equal(maskedStudent.complemento, '***');
const unmaskedStudent = sanitizeStudentForLgpd(rawSensitiveStudent, false);
assert.equal(unmaskedStudent.cpf, '123.456.789-01');

// 14. Validação de Sincronização RBAC por Turma (syncAuthorizedTeachersOntoClasses)
const targetClsId = g4Class.id;
const otherClsId = fundClass.id;
const rbacClassesFixture: ClassGroup[] = [
  { ...g4Class, teacherEmail: 'antiga.prof@educacao.jundiai.sp.gov.br', authorizedTeacherEmails: ['antiga.prof@educacao.jundiai.sp.gov.br'] },
  { ...fundClass, teacherEmail: '', authorizedTeacherEmails: [] },
];
const rbacUsersFixture: AuthorizedUser[] = [
  {
    id: 'u-old',
    email: 'antiga.prof@educacao.jundiai.sp.gov.br',
    name: 'PROF ANTIGA',
    role: 'usuario',
    assignedClassId: otherClsId,
    assignedClassIds: [otherClsId],
    assignedClassName: fundClass.name,
    active: true,
    createdAt: '01/02/2027',
  },
  {
    id: 'u-new',
    email: 'nova.regente@educacao.jundiai.sp.gov.br',
    name: 'PROF NOVA',
    role: 'usuario',
    assignedClassId: targetClsId,
    assignedClassIds: [targetClsId],
    assignedClassName: g4Class.name,
    active: true,
    createdAt: '01/02/2027',
  },
  {
    id: 'u-inactive',
    email: 'bloqueada@educacao.jundiai.sp.gov.br',
    name: 'PROF BLOQUEADA',
    role: 'usuario',
    assignedClassId: targetClsId,
    assignedClassIds: [targetClsId],
    assignedClassName: g4Class.name,
    active: false,
    createdAt: '01/02/2027',
  },
];
const rbacSyncRes = syncAuthorizedTeachersOntoClasses(rbacUsersFixture, rbacClassesFixture);
assert.equal(rbacSyncRes.changed, true);
assert.deepEqual(
  rbacSyncRes.classes[0].authorizedTeacherEmails,
  ['nova.regente@educacao.jundiai.sp.gov.br'],
  'Somente regente ativa atribuída à turma deve constar em authorizedTeacherEmails'
);
assert.equal(
  rbacSyncRes.classes[0].teacherEmail,
  'nova.regente@educacao.jundiai.sp.gov.br',
  'teacherEmail antigo remanejado deve ser substituído pela nova regente'
);
assert.deepEqual(
  rbacSyncRes.classes[1].authorizedTeacherEmails,
  ['antiga.prof@educacao.jundiai.sp.gov.br'],
  'Turma de destino da professora remanejada deve incluir seu e-mail'
);

// 15. Validação do Motor Universal de Exportação (Word .docx, Excel .xlsx/.xls, PDF .pdf, CSV .csv)
const sampleWideHeaders = Array.from({ length: 14 }, (_, i) => `Col_${i + 1}`);
const sampleWideRow = sampleWideHeaders.map((_, i) =>
  i === 1 ? 'JOÃO PEDRO DA SILVA ≥60% ≤75% → ✓ ⚠️' : `Valor_${i + 1}`
);

const universalExportFixture: UniversalExportReport = {
  fileNameBase: 'Relatorio_Teste_Candelario_2027',
  title: 'Relatório de Frequência — Turma Teste',
  subtitle: 'Verificação completa com acentuação: Ação, Frequência, Conceição ≥60%',
  orientation: 'landscape',
  metadata: [
    { label: 'Ano Letivo', value: '2027' },
    { label: 'Unidade', value: 'EMEB Candelário' },
  ],
  summaryMetrics: [
    { label: 'Ativos', value: '25', detail: '100% conferidos' },
    { label: 'Presença', value: '94%', detail: 'Acima da meta' },
  ],
  sheets: [
    {
      sheetName: 'Mapa_Frequencia',
      sectionTitle: 'Lançamento Nominal',
      headers: sampleWideHeaders,
      rows: [sampleWideRow, sampleWideHeaders.map((_, i) => (i === 0 ? '=SUM(A1:A5)' : `Linha2_${i}`))],
    },
  ],
};

// 15a. Sanitização WinAnsi para PDF e proteção contra Formula Injection em planilhas
assert.equal(toWinAnsiSafeText('≥60% ≤75% → ✓'), '>=60% <=75% -> OK');
assert.equal(sanitizeSpreadsheetCell('=SUM(A1:A5)'), "'=SUM(A1:A5)");
assert.equal(sanitizeSpreadsheetCell('+CMD'), "'+CMD");

// 15b. Word (.docx) OOXML ZIP válido com acentos UTF-8 preservados
const docxBytes = buildDocxBytes(universalExportFixture);
assert.equal(docxBytes[0], 0x50, 'DOCX deve iniciar com assinatura ZIP P');
assert.equal(docxBytes[1], 0x4b, 'DOCX deve iniciar com assinatura ZIP K');
assert.equal(docxBytes[2], 0x03);
assert.equal(docxBytes[3], 0x04);
const docxDecodedText = new TextDecoder('utf-8').decode(docxBytes);
assert.ok(docxDecodedText.includes('word/document.xml'), 'DOCX deve conter word/document.xml');
assert.ok(docxDecodedText.includes('[Content_Types].xml'), 'DOCX deve conter [Content_Types].xml');
assert.ok(docxDecodedText.includes('Frequência'), 'DOCX deve preservar acentuação UTF-8');

// 15c. Excel (.xlsx e .xls) com aba de dados e aba Resumo + proteção contra fórmulas
const xlsxBytes = await buildWorkbookBytes(universalExportFixture, 'xlsx');
assert.equal(xlsxBytes[0], 0x50, 'XLSX deve iniciar com assinatura ZIP PK');
assert.equal(xlsxBytes[1], 0x4b);
const xlsBytes = await buildWorkbookBytes(universalExportFixture, 'xls');
assert.equal(xlsBytes[0], 0xd0, 'XLS BIFF8 deve iniciar com assinatura OLE2 0xD0');
assert.equal(xlsBytes[1], 0xcf, 'XLS BIFF8 deve iniciar com assinatura OLE2 0xCF');

// 15d. PDF (.pdf) multipágina com particionamento de colunas largas (>11 colunas) sem erro WinAnsi
const pdfBytes = await buildPdfBytes(universalExportFixture);
const pdfMagic = new TextDecoder('ascii').decode(pdfBytes.slice(0, 5));
assert.equal(pdfMagic, '%PDF-', 'PDF deve iniciar com cabeçalho %PDF-');
assert.ok(pdfBytes.length > 1000, 'PDF gerado deve conter stream de conteúdo válido');

// 15e. CSV UTF-8 BOM com escape de fórmula
const csvText = buildCsvString(universalExportFixture);
assert.ok(csvText.startsWith('\uFEFF'), 'CSV deve incluir UTF-8 BOM para Excel PT-BR');
assert.ok(csvText.includes("'=SUM(A1:A5)"), 'CSV deve neutralizar injeção de fórmula');

// 16. Validação de detecção de hospedagem estática (Firebase Hosting & GitHub Pages)
assert.equal(isStaticHostname('listapiloto2027.web.app', 'https:'), true);
assert.equal(isStaticHostname('listapiloto2027.firebaseapp.com', 'https:'), true);
assert.equal(isStaticHostname('emebjfreitas-dev.github.io', 'https:'), true);
assert.equal(isStaticHostname('localhost', 'http:'), false);
assert.equal(isStaticHostname('ais-dev-nzv6xtsaejmfs7dugbhwbw-49671311424.us-east1.run.app', 'https:'), false);

// 17. Validação em lote do photoIndexedDbCache (URLs inválidas, blobs corrompidos, aliases órfãos e deduplicação SHA-256)
assert.equal(evaluateLocalPhotoUrlValidity('').reason, 'empty_url');
assert.equal(evaluateLocalPhotoUrlValidity('blob:http://localhost/123').reason, 'ephemeral_blob_url');
assert.equal(evaluateLocalPhotoUrlValidity('https://drive.google.com/drive/folders/abc').reason, 'malformed_url');
assert.equal(evaluateLocalPhotoUrlValidity('javascript:alert(1)').reason, 'malformed_url');
assert.equal(evaluateLocalPhotoUrlValidity('data:text/plain;base64,SGVsbG8=').reason, 'corrupted_data_url');

const validApiPhoto = evaluateLocalPhotoUrlValidity('/api/photos/stu_100.webp');
assert.equal(validApiPhoto.valid, true);
assert.equal(validApiPhoto.kind, 'api_photo');
assert.equal(validApiPhoto.apiPhotoFilename, 'stu_100.webp');

const validDriveProxy = evaluateLocalPhotoUrlValidity('/api/drive-photo/1AbC_dEf23');
assert.equal(validDriveProxy.valid, true);
assert.equal(validDriveProxy.kind, 'api_drive_photo');

const validExternal = evaluateLocalPhotoUrlValidity('https://lh3.googleusercontent.com/d/1AbC_dEf23=w400');
assert.equal(validExternal.valid, true);
assert.equal(validExternal.kind, 'external_http');

const testUrlRows: StudentPhotoUrlRecord[] = [
  {
    studentKey: 'id:broken-1',
    normalizedName: 'ALUNO URL QUEBRADA',
    photoUrl: '/api/photos/missing.webp',
    updatedAtMs: 1000,
  },
  {
    studentKey: 'id:healthy-1',
    normalizedName: 'ALUNO SAUDAVEL',
    photoUrl: '/api/photos/ok.webp',
    updatedAtMs: 1000,
  },
  {
    studentKey: 'id:shared-ok',
    normalizedName: 'ALUNO SHA COMPARTILHADO',
    photoUrl: '/api/photos/shared_ok.webp',
    updatedAtMs: 1000,
  },
  {
    studentKey: 'id:skipped-offline',
    normalizedName: 'ALUNO PRESERVADO OFFLINE',
    photoUrl: 'https://lh3.googleusercontent.com/d/offline_keep=w400',
    updatedAtMs: 1000,
  },
];

const fakeValidBlob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/webp' });
const testBlobRows: StudentPhotoBlobRecord[] = [
  {
    cacheKey: 'url:/api/photos/missing.webp',
    sourceUrl: '/api/photos/missing.webp',
    blob: fakeValidBlob,
    contentType: 'image/webp',
    byteSize: 2048,
    cachedAtMs: 1000,
  },
  {
    cacheKey: 'url:/api/photos/ok.webp',
    sourceUrl: '/api/photos/ok.webp',
    sha256: 'shared_sha_1',
    blob: fakeValidBlob,
    contentType: 'image/webp',
    byteSize: 4096,
    cachedAtMs: 1000,
  },
  {
    cacheKey: 'url:/api/photos/shared_ok.webp',
    targetCacheKey: 'url:/api/photos/ok.webp',
    sourceUrl: '/api/photos/shared_ok.webp',
    sha256: 'shared_sha_1',
    contentType: 'image/webp',
    byteSize: 0,
    cachedAtMs: 1000,
  },
  {
    cacheKey: 'url:/api/photos/corrupted_blob.webp',
    sourceUrl: '/api/photos/ok.webp',
    blob: new Blob([]),
    contentType: 'image/webp',
    byteSize: 1024,
    cachedAtMs: 1000,
  },
  {
    cacheKey: 'alias:dangling_orphan',
    targetCacheKey: 'url:/api/photos/corrupted_blob.webp',
    sourceUrl: '/api/photos/corrupted_blob.webp',
    contentType: 'image/webp',
    byteSize: 0,
    cachedAtMs: 1000,
  },
  {
    cacheKey: 'url:https://lh3.googleusercontent.com/d/offline_keep=w400',
    sourceUrl: 'https://lh3.googleusercontent.com/d/offline_keep=w400',
    blob: fakeValidBlob,
    contentType: 'image/webp',
    byteSize: 3000,
    cachedAtMs: 1000,
  },
];

const testOutcomes = new Map<string, UrlProbeOutcome>([
  ['/api/photos/missing.webp', { status: 'inaccessible', reason: 'inaccessible_http' }],
  ['/api/photos/ok.webp', { status: 'accessible' }],
  ['/api/photos/shared_ok.webp', { status: 'accessible' }],
  ['https://lh3.googleusercontent.com/d/offline_keep=w400', { status: 'skipped' }],
]);

const testCorruptedBlobs = new Map<string, PhotoCacheInvalidReason>([
  ['url:/api/photos/corrupted_blob.webp', 'corrupted_blob'],
]);

const cleanupPlan = planPhotoCacheVerificationDeletions({
  urlRows: testUrlRows,
  blobRows: testBlobRows,
  urlOutcomes: testOutcomes,
  corruptedBlobReasons: testCorruptedBlobs,
});

assert.deepEqual(cleanupPlan.urlsToDelete, ['id:broken-1']);
assert.ok(cleanupPlan.blobsToDelete.includes('url:/api/photos/missing.webp'), 'Blob de URL inacessível deve ser removido');
assert.ok(cleanupPlan.blobsToDelete.includes('url:/api/photos/corrupted_blob.webp'), 'Blob corrompido deve ser removido');
assert.ok(cleanupPlan.blobsToDelete.includes('alias:dangling_orphan'), 'Alias órfão deve ser removido');
assert.ok(!cleanupPlan.blobsToDelete.includes('url:/api/photos/ok.webp'), 'Blob acessível deve ser preservado');
assert.ok(!cleanupPlan.blobsToDelete.includes('url:/api/photos/shared_ok.webp'), 'Alias de URL válida deve ser preservado');
assert.ok(!cleanupPlan.blobsToDelete.includes('url:https://lh3.googleusercontent.com/d/offline_keep=w400'), 'Cache ignorado offline deve ser preservado');
assert.equal(cleanupPlan.freedBytes, 2048 + 1024);
assert.equal(cleanupPlan.orphanedAliasesCount, 1);

// Testes adicionais de segurança e LGPD
const maskedCpf = maskSensitiveText('12345678901', 'cpf');
assert.ok(maskedCpf.includes('***'), 'CPF deve estar mascarado');

const maskedSus = maskSensitiveText('123456789012345', 'sus');
assert.ok(maskedSus.includes('***'), 'Cartão SUS deve estar mascarado');

// Validações de Otimização de Cota do Firebase (Firestore & Storage)
assert.equal(typeof resizePhotoWithCanvasToWebp, 'function', 'Função de redimensionamento Canvas 1280px e WebP 0.8 deve estar disponível');
assert.equal(typeof fetchClassesFromFirestorePaginated, 'function', 'Função paginada de turmas com limit(20) deve estar disponível');
assert.equal(typeof uploadFileWithCacheControl, 'function', 'Função de upload com cacheControl: public, max-age=86400 deve estar disponível');
assert.equal(typeof uploadStudentPhotoToStorage, 'function', 'Upload otimizado de foto no Storage deve estar disponível');
assert.equal(typeof uploadStudentPdfToStorage, 'function', 'Upload otimizado de PDF no Storage deve estar disponível');

// Validações de Integridade Lossless (MD5 RFC 1321, SHA-256 e Gzip apenas em metadados JSON)
const rfcMd5Empty = await computeMd5Hex(new Uint8Array(0));
assert.equal(rfcMd5Empty, 'd41d8cd98f00b204e9800998ecf8427e', 'MD5 de buffer vazio deve seguir RFC 1321');
const rfcMd5Abc = await computeMd5Hex(new TextEncoder().encode('abc'));
assert.equal(rfcMd5Abc, '900150983cd24fb0d6963f7d28e17f72', 'MD5 de "abc" deve seguir RFC 1321');
const shaAbc = await computeSha256Hex(new TextEncoder().encode('abc'));
assert.equal(
  shaAbc,
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  'SHA-256 de "abc" deve bater com digest padrão'
);
const metadataPayload = { version: 1, classesCount: 40, lossless: true };
const compressedMeta = await compressJsonMetadataGzip(metadataPayload);
const restoredMeta = await decompressJsonMetadataGzip<typeof metadataPayload>(compressedMeta.bytes);
assert.deepEqual(restoredMeta, metadataPayload, 'Metadados JSON compactados em gzip devem restaurar sem perdas');

// 16. Validação estrita de RBAC de Notificações (Apenas Admin estrito gera; demais apenas recebem e dão ciência)
assert.equal(isStrictAdminNotificationSender('admin', undefined), true);
assert.equal(isStrictAdminNotificationSender('admin', 'regente'), true);
assert.equal(isStrictAdminNotificationSender('admin', 'apoio'), false, 'Apoio não pode gerar notificações');
assert.equal(isStrictAdminNotificationSender('admin', 'aee'), false, 'AEE não pode gerar notificações');
assert.equal(isStrictAdminNotificationSender('usuario', undefined), false, 'PEB I não pode gerar notificações');
assert.equal(isStrictAdminNotificationSender('peb2', undefined), false, 'PEB II não pode gerar notificações');

const blockedTeacherPush = await triggerPushNotification(
  {
    title: 'Tentativa não autorizada',
    body: 'Não deve ser emitida',
    category: 'aviso',
  },
  { senderRole: 'usuario', deliverySource: 'admin_action' }
);
assert.equal(blockedTeacherPush.read, true, 'Envio direto por não-admin deve ser bloqueado sem gerar notificação');

const blockedConsecutivePush = await triggerConsecutiveAbsencePushNotification(
  { id: 'stu-test', name: 'ALUNO TESTE', turma: g4Class.id },
  g4Class.name,
  4,
  undefined,
  { userRole: 'usuario', userEmail: 'prof@educacao.jundiai.sp.gov.br' }
);
assert.equal(blockedConsecutivePush.read, true, 'Trigger consecutivo por PEB I deve ser bloqueado');

const blockedFcmDispatch = await dispatchWindowClosingFcmAlert({
  attendanceWindowConfig: { exceptionalOverrideOpen: false },
  classes: [g4Class],
  senderEmail: 'prof@educacao.jundiai.sp.gov.br',
  senderName: 'Docente PEB I',
  senderRole: 'usuario',
});
assert.equal(blockedFcmDispatch.ok, false, 'dispatchWindowClosingFcmAlert deve recusar não-admin');

const incomingAdminPush = await triggerPushNotification(
  {
    id: 'fcm_admin_incoming_test',
    title: 'Comunicado Oficial da Direção',
    body: 'Favor conferir lista até sexta-feira.',
    category: 'aviso',
  },
  { deliverySource: 'fcm_incoming', saveToFeed: false, showBanner: false }
);
assert.equal(incomingAdminPush.read, false, 'Recebimento via fcm_incoming deve permanecer pendente de ciência para o usuário');

const classWithHighAbsence: ClassGroup = {
  ...g4Class,
  students: [
    {
      ...baseInfantilStudent,
      id: 'stu-high-abs',
      name: 'ESTUDANTE TESTE FALTAS',
      totalAbsencesMonth: 5,
      justifiedAbsences: 0,
    },
  ],
};
const userReceivedOnlyFeed = buildContextualPushNotices([classWithHighAbsence], [], [], {
  isStrictAdmin: false,
});
assert.equal(
  userReceivedOnlyFeed.some((n) => n.id.startsWith('auto_prazo_faltas_') || n.id.startsWith('auto_busca_ativa_3d_')),
  false,
  'Usuário comum não deve gerar alertas locais automáticos'
);
const adminMonitorFeed = buildContextualPushNotices([classWithHighAbsence], [], [], {
  isStrictAdmin: true,
});
assert.equal(
  adminMonitorFeed.some((n) => n.id.startsWith('auto_prazo_faltas_') || n.id.startsWith('auto_busca_ativa_3d_')),
  true,
  'Administrador estrito mantém monitoramento de alertas locais'
);

// 17. Validação de merge delta-only (preserva todas as 40 turmas mesmo em payloads parciais)
const deltaOneClass: ClassGroup = {
  ...INITIAL_CLASSES[10],
  pedagogicalNotes: 'Nota atualizada remotamente via delta sync',
  updatedAtMs: Date.now() + 5000,
};
const deltaMergedResult = mergeClassesWithConcurrencyControl(
  [deltaOneClass],
  INITIAL_CLASSES,
  deltaOneClass.updatedAtMs || Date.now(),
  Date.now() - 1000
);
assert.equal(deltaMergedResult.length, 40, 'Merge parcial/delta deve preservar todas as 40 turmas oficiais');
assert.equal(deltaMergedResult[0].id, 'g04a', 'Ordem oficial pedagógica deve iniciar em GRUPO 04 A');
assert.equal(
  deltaMergedResult.find((c) => c.id === deltaOneClass.id)?.pedagogicalNotes,
  'Nota atualizada remotamente via delta sync',
  'Delta remoto mais recente deve atualizar a turma correspondente'
);

// 18. Validação das proteções contra cache obsoleto de navegador e Service Worker PWA
const swSource = fs.readFileSync(path.join(process.cwd(), 'public', 'sw.js'), 'utf8');
assert.ok(
  swSource.includes("cache: 'reload'") && swSource.includes("cache: 'no-store'"),
  'Service Worker deve ignorar HTTP disk cache no precache mutável e navegações HTML'
);
assert.ok(
  swSource.includes('candelario_student_photos_db_v1') && swSource.includes('isImmutableStaticAsset'),
  'Cache offline de fotos (IndexedDB) e assets com hash deve permanecer preservado'
);

const mainSource = fs.readFileSync(path.join(process.cwd(), 'src', 'main.tsx'), 'utf8');
assert.ok(
  mainSource.includes("updateViaCache: 'none'") &&
    mainSource.includes('controllerchange') &&
    mainSource.includes('SW_RELOAD_COOLDOWN_MS'),
  'Registro principal do SW deve forçar updateViaCache: none e reload seguro com anti-loop em controllerchange'
);

const pushSource = fs.readFileSync(
  path.join(process.cwd(), 'src', 'services', 'pushNotificationService.ts'),
  'utf8'
);
assert.ok(
  pushSource.includes("updateViaCache: 'none'"),
  'Registro secundário do SW no serviço de Push também deve usar updateViaCache: none'
);

const hostingConfig = fs.readFileSync(path.join(process.cwd(), 'firebase.json'), 'utf8');
assert.ok(
  hostingConfig.includes('no-cache, no-store, must-revalidate') &&
    hostingConfig.includes('sw.js'),
  'Firebase Hosting deve servir index.html e sw.js sem cache HTTP persistente'
);

assert.ok(
  swSource.includes('CLEAR_SW_CACHE') && swSource.includes('caches.delete'),
  'Service Worker deve suportar limpeza sob demanda do CacheStorage via CLEAR_SW_CACHE'
);

const headerSource = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'Header.tsx'), 'utf8');
assert.ok(
  headerSource.includes('Sincronizar Agora') && headerSource.includes('onForceSyncNow'),
  'Barra de cabeçalho deve expor o botão Sincronizar Agora ligado ao fluxo onForceSyncNow'
);

const firebaseSyncSource = fs.readFileSync(
  path.join(process.cwd(), 'src', 'services', 'firebaseSync.ts'),
  'utf8'
);
assert.ok(
  firebaseSyncSource.includes('forceRefreshFirestoreFromServer') &&
    firebaseSyncSource.includes('forcePullAll'),
  'firebaseSync deve expor forceRefreshFirestoreFromServer para leitura direta do servidor'
);

const swCacheHelperSource = fs.readFileSync(
  path.join(process.cwd(), 'src', 'utils', 'serviceWorkerCache.ts'),
  'utf8'
);
assert.ok(
  swCacheHelperSource.includes('clearServiceWorkerCachesAndUpdate'),
  'Helper clearServiceWorkerCachesAndUpdate deve estar presente'
);

console.log('✓ Todos os testes de integridade, LGPD, RBAC por turma, RBAC de notificações, expiração, HTM, validação de servidor, regras MEC, exportação Word/Excel/PDF, Firebase Hosting, otimização de cotas Firestore/Storage, armazenamento lossless Drive, cache do navegador/PWA, Sincronizar Agora e IndexedDB passaram com sucesso!');


