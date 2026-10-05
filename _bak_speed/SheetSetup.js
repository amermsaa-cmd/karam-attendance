/**
 * ============================================================
 * إعداد الشيتات لأول مرة + الدوال المساعدة لقراءة البيانات
 * ============================================================
 * شغّل الدالة setupAllSheets() مرة واحدة فقط بعد ربط السكربت بالشيت
 * (من محرر Apps Script: اختر setupAllSheets ثم اضغط Run)
 */

function setupAllSheets() {
  Logger.log('بدء الإعداد...');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('تم الحصول على الشيت النشط: ' + ss.getName());

  setupSettingsSheet_(ss);
  Logger.log('✓ تم إعداد ورقة الإعدادات');

  setupEmployeesSheet_(ss);
  Logger.log('✓ تم إعداد ورقة الموظفون');

  setupLogSheet_(ss);
  Logger.log('✓ تم إعداد ورقة سجل الحضور');

  setupDailySheet_(ss);
  Logger.log('✓ تم إعداد ورقة التقرير اليومي');

  setupPayrollSheet_(ss);
  Logger.log('✓ تم إعداد ورقة الرواتب');

  setupMonthlySheet_(ss);
  Logger.log('✓ تم إعداد ورقة التقرير الشهري');

  setupDashboardSheet_(ss);
  Logger.log('✓ تم إعداد ورقة لوحة التحكم');

  setupEditLogSheet_(ss);
  Logger.log('✓ تم إعداد ورقة سجل التعديلات');

  protectSheets_(ss);
  Logger.log('✓ تم تطبيق الحماية على الأوراق');

  installTriggers_();
  Logger.log('✓ تم تثبيت المشغلات الزمنية');

  Logger.log('اكتمل الإعداد بنجاح 🎉');

  try {
    SpreadsheetApp.getUi().alert('تم إعداد النظام بنجاح ✅\nيمكنك الآن نشر الويب أب (Deploy > New deployment > Web app).');
  } catch (e) {
    Logger.log('تنبيه: تعذر عرض نافذة alert (طبيعي إذا كانت هذه أول مرة تشغيل من المحرر مباشرة). الإعداد تم بنجاح رغم ذلك.');
  }
}

// ---------------- الإعدادات ----------------
function setupSettingsSheet_(ss) {
  let sh = ss.getSheetByName(SHEET_SETTINGS);
  if (!sh) sh = ss.insertSheet(SHEET_SETTINGS);
  sh.clear();
  sh.getRange('A1:B1').setValues([['المفتاح', 'القيمة']]).setFontWeight('bold');

  const rows = [
    ['office_lat', 15.4724009],
    ['office_lng', 45.3251376],
    ['geofence_radius_m', 50],
    ['timezone', 'Asia/Aden'],
    ['currency', 'ريال يمني'],
    ['friday_allowance', 5000],
    ['coverage_full_allowance', 5000],
    ['friday_worker_this_week', 'محمد'],   // يحدَّث يدوياً كل أسبوع: محمد / مشتاق
  ];
  sh.getRange(2, 1, rows.length, 2).setValues(rows);
  sh.getRange('B9').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['محمد', 'مشتاق']).build()
  );
  sh.autoResizeColumns(1, 2);
}

function getSettings() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
  const data = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  const s = {};
  data.forEach(r => { if (r[0]) s[r[0]] = r[1]; });
  return s;
}

// ---------------- الموظفون ----------------
function setupEmployeesSheet_(ss) {
  let sh = ss.getSheetByName(SHEET_EMPLOYEES);
  if (!sh) sh = ss.insertSheet(SHEET_EMPLOYEES);
  sh.clear();
  const headers = ['emp_id', 'الاسم', 'نوع الدوام', 'بداية الدوام', 'نهاية الدوام',
    'ساعات الفترة', 'الراتب الأساسي', 'معدل الخصم/ساعة', 'الحد الأدنى اليومي (ساعة)',
    'يمكن أن يغطي (emp_id)', 'يمكن أن يُغطى', 'نشط', 'رقم الواتساب'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');

  const rows = [
    ['1', 'محمد', 'ثابت', '09:00', '15:00', 6, 150000, 833.33, '', '2', true, true, ''],
    ['2', 'مشتاق', 'ثابت', '15:00', '22:00', 7, 150000, 714.29, '', '1', true, true, ''],
    ['3', 'مجيد', 'مرن', '', '', '', 100000, 1666.67, 2, '1,2', false, true, ''],
  ];
  sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sh.autoResizeColumns(1, headers.length);
}

function getAllEmployees_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_EMPLOYEES);
  // نقرأ حتى العمود 13 (رقم الواتساب) إن كان موجودًا، وإلا نكتفي بـ 12 كما كان.
  // القراءة بعرض متغيّر حتى لا ينكسر أي شيء في شيت لم يُضف له العمود بعد.
  const width = Math.max(12, Math.min(13, sh.getLastColumn()));
  const data = sh.getRange(2, 1, sh.getLastRow() - 1, width).getValues();
  return data.map(r => ({
    id: String(r[0]),
    name: r[1],
    shiftType: r[2],           // ثابت / مرن
    shiftStart: normalizeTimeStr_(r[3]),
    shiftEnd: normalizeTimeStr_(r[4]),
    periodHours: r[5],
    baseSalary: r[6],
    hourlyRate: r[7],
    minDailyHours: r[8],
    canCover: String(r[9] || '').split(',').map(x => x.trim()).filter(Boolean),
    canBeCovered: r[10] === true,
    active: r[11] === true,
    whatsapp: String(r[12] || '').trim(),
  }));
}

function getEmployeeById_(id) {
  return getAllEmployees_().find(e => e.id === String(id)) || null;
}

function getCoverageOptions_(emp) {
  const all = getAllEmployees_();
  return emp.canCover
    .map(id => all.find(e => e.id === id))
    .filter(e => e && e.canBeCovered && e.active);
}

// ---------------- سجل الحضور ----------------
function setupLogSheet_(ss) {
  let sh = ss.getSheetByName(SHEET_LOG);
  if (!sh) sh = ss.insertSheet(SHEET_LOG);
  sh.clear();
  const headers = ['Record ID', 'التاريخ', 'emp_id', 'اسم الموظف', 'نوع التسجيل',
    'يغطي عن', 'وقت الحضور', 'GPS دخول', 'رابط خرائط دخول', 'الجهاز (دخول)',
    'وقت الانصراف', 'GPS خروج', 'رابط خرائط خروج', 'الجهاز (خروج)',
    'مدة الفترة (ساعة)', 'الحالة', 'ملاحظات'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, headers.length);
}

// ---------------- التقرير اليومي ----------------
function setupDailySheet_(ss) {
  let sh = ss.getSheetByName(SHEET_DAILY);
  if (!sh) sh = ss.insertSheet(SHEET_DAILY);
  sh.clear();
  const headers = ['التاريخ', 'emp_id', 'الموظف', 'حالة الحضور', 'دقائق التأخير',
    'دقائق الانصراف المبكر', 'دقائق الإضافي', 'الرصيد اليومي (دقيقة)',
    'ساعات العمل الفعلية', 'ساعات نقص (عن الحد الأدنى)', 'جمعة؟', 'تغطية؟',
    'ساعات التغطية', 'مبلغ بدل التغطية', 'ملاحظات'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, headers.length);
}

// ---------------- الرواتب ----------------
function setupPayrollSheet_(ss) {
  let sh = ss.getSheetByName(SHEET_PAYROLL);
  if (!sh) sh = ss.insertSheet(SHEET_PAYROLL);
  sh.clear();
  const headers = ['الشهر (YYYY-MM)', 'emp_id', 'الموظف', 'الراتب الأساسي',
    'أيام الحضور', 'أيام الغياب', 'خصم الغياب', 'دقائق تأخير الشهر',
    'دقائق إضافي الشهر', 'صافي الرصيد (دقيقة)', 'تطبيق الخصم؟', 'تطبيق الإضافة؟',
    'قيمة الخصم المطبق', 'قيمة الإضافة المطبقة', 'عدد جُمع العمل',
    'بدل الجمعة', 'إجمالي بدل التغطية', 'إجمالي الخصومات', 'صافي الراتب'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sh.setFrozenRows(1);
  const dv = SpreadsheetApp.newDataValidation().requireValueInList(['تطبيق', 'عدم تطبيق']).build();
  sh.getRange(2, 11, 500, 2).setDataValidation(dv);
  sh.autoResizeColumns(1, headers.length);
}

// ---------------- التقرير الشهري ----------------
function setupMonthlySheet_(ss) {
  let sh = ss.getSheetByName(SHEET_MONTHLY);
  if (!sh) sh = ss.insertSheet(SHEET_MONTHLY);
  sh.clear();
  const headers = ['الشهر', 'الموظف', 'أيام الحضور', 'أيام الغياب', 'مرات التأخير',
    'إجمالي دقائق التأخير', 'مرات الانصراف المبكر', 'إجمالي دقائق الانصراف المبكر',
    'إجمالي ساعات العمل', 'إجمالي ساعات التغطية', 'إجمالي بدل التغطية',
    'عدد جُمع العمل', 'بدل الجمعة', 'صافي الراتب'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, headers.length);
}

// ---------------- لوحة التحكم ----------------
function setupDashboardSheet_(ss) {
  let sh = ss.getSheetByName(SHEET_DASHBOARD);
  if (!sh) sh = ss.insertSheet(SHEET_DASHBOARD);
  sh.clear();
  sh.getRange('A1').setValue('لوحة التحكم — ' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd'))
    .setFontWeight('bold').setFontSize(14);

  sh.getRange('A3:B3').setValues([['عدد الحضور اليوم', '']]);
  sh.getRange('A4:B4').setValues([['عدد المنصرفين', '']]);
  sh.getRange('A5:B5').setValues([['عدد المتأخرين', '']]);
  sh.getRange('A6:B6').setValues([['عدد التغطيات', '']]);

  sh.getRange('A8').setValue('حالة الموظفين').setFontWeight('bold');
  sh.getRange('A9:D9').setValues([['الموظف', 'الحالة', 'وقت الحضور', 'ملاحظات']]).setFontWeight('bold');

  sh.getRange('A13').setValue('لم يسجلوا حضورهم اليوم').setFontWeight('bold');
  sh.getRange('A16').setValue('لم يسجلوا انصرافهم (سجل مفتوح)').setFontWeight('bold');

  sh.autoResizeColumns(1, 4);
}

// ---------------- سجل التعديلات ----------------
function setupEditLogSheet_(ss) {
  let sh = ss.getSheetByName(SHEET_EDITLOG);
  if (!sh) sh = ss.insertSheet(SHEET_EDITLOG);
  sh.clear();
  const headers = ['الوقت', 'المستخدم', 'الإجراء', 'التفاصيل'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, headers.length);
}

function logEdit_(action, details) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_EDITLOG);
  const user = Session.getActiveUser().getEmail() || 'غير معروف';
  sh.appendRow([new Date(), user, action, details]);
}

// ---------------- الحماية ----------------
function protectSheets_(ss) {
  [SHEET_SETTINGS, SHEET_PAYROLL, SHEET_DASHBOARD].forEach(name => {
    const sh = ss.getSheetByName(name);
    const protections = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    protections.forEach(p => p.remove());
    const protection = sh.protect().setDescription('محمية - ' + name);
    protection.removeEditors(protection.getEditors());
    if (protection.canDomainEdit()) protection.setDomainEdit(false);
  });
}

// ---------------- المشغّلات الزمنية (Triggers) ----------------
function installTriggers_() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (['dailyProcessJob', 'refreshDashboard'].indexOf(t.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('dailyProcessJob').timeBased().atHour(0).nearMinute(10).everyDays(1).inTimezone(TIMEZONE).create();
  ScriptApp.newTrigger('refreshDashboard').timeBased().everyMinutes(10).create();
}