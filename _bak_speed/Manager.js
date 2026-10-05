/**
* ============================================================
* لوحة المدير - نظام الحضور والانصراف - مكتب كرم للسفر والنقل
* ملف جديد بالكامل - لا يعدّل أي دالة أو ملف موجود مسبقاً
* المرحلة الأولى: مسار ويب + نظرة عامة للقراءة فقط (بدون كلمة مرور،
* بدون تعديلات) - التعديلات (الرواتب/الجدول/المهام) في مرحلة قادمة
* ============================================================
*/

/**
* يعرض صفحة لوحة المدير. لا يتطلب أي دخول أو كلمة مرور -
* الوصول محمي فقط بكون الرابط غير معلن ويُفتح من جهاز المدير.
*/
function renderManagerDashboard_(e) {
var template = HtmlService.createTemplateFromFile('ManagerDashboard');
return template.evaluate()
.setTitle('لوحة المدير - كرم للسفر والنقل')
.addMetaTag('viewport', 'width=device-width, initial-scale=1, user-scalable=no')
.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
* إضافة مهمة يومية مفردة من لوحة المدير (بطاقة "إضافة مهمة يومية" في الإعدادات).
* تُعيد استخدام addTaskRow_ نفسها التي تستخدمها صفحة المشرف، فتكون الصفوف
* والأعمدة والطوابع متطابقة تمامًا - الفرق الوحيد أن عمود "أضيفت بواسطة"
* يحمل 'المدير'، وهو ما يعتمد عليه تصنيف categorizeTask_ ("من المدير" مقابل
* "من المشرف") وإبراز تعليقات المدير في صفحات الموظفين.
* لا تتطلب رمزًا سريًا، شأنها شأن بقية دوال لوحة المدير: اللوحة محمية بسرية
* رابطها لا بكلمة مرور (راجع تعليق renderManagerDashboard_).
*/
/**
* إعادة إسناد مهمة لم تُنجز: يغيّر صاحبها وتاريخها معًا في عملية واحدة.
* المدير يراجع بعد انتهاء الدوام، فقد يبقيها لنفس الموظف بتاريخ آخر، أو
* ينقلها لزميله بنفس اليوم - الحقلان مستقلان تمامًا.
* البحث بمعرّف المهمة وحده (لا بالموظف) لأن المدير يتصرف نيابة عن الجميع.
*/
function reassignTask(payload) {
const taskId = String((payload && payload.taskId) || '').trim();
const targetId = String((payload && payload.empId) || '').trim();
const dateStr = String((payload && payload.date) || '').trim();

if (!taskId || !targetId || !dateStr) return { success: false, error: 'بيانات ناقصة' };
if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { success: false, error: 'صيغة التاريخ غير صحيحة' };

const todayStr = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
if (dateStr < todayStr) return { success: false, error: 'لا يمكن الإسناد لتاريخ مضى' };

const target = getEmployeeById_(targetId);
if (!target || target.active !== true) return { success: false, error: 'الموظف غير صالح أو غير نشط' };

const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASKS);
const data = sheet.getDataRange().getValues();

let idx = -1;
for (let i = 1; i < data.length; i++) {
if (String(data[i][0]).trim() === taskId) { idx = i; break; }
}
if (idx === -1) return { success: false, error: 'المهمة غير موجودة' };

const oldName = String(data[idx][3] || '').trim();
const oldDate = normalizeDateStr_(data[idx][1]);

// لا شيء تغيّر فعلاً - نمنع كتابة ملاحظة بلا معنى
if (String(data[idx][2]).trim() === targetId && oldDate === dateStr) {
return { success: false, error: 'لم يتغيّر شيء: نفس الموظف ونفس التاريخ' };
}

let note = 'أُعيد إسناد المهمة';
if (String(data[idx][2]).trim() !== targetId) note += ' من ' + oldName + ' إلى ' + target.name;
if (oldDate !== dateStr) note += ' وتاريخها من ' + oldDate + ' إلى ' + dateStr;

const row = idx + 1;
sheet.getRange(row, 2).setValue(dateStr);
sheet.getRange(row, 3).setValue(targetId);
sheet.getRange(row, 4).setValue(target.name);
sheet.getRange(row, 7).setValue('غير مكتملة');
sheet.getRange(row, 11).setValue(appendNoteText_(data[idx][10], note, 'المدير'));

return { success: true, empName: target.name, date: dateStr };
}

/**
* قائمة الموظفين النشطين لبطاقة "إضافة مهمة يومية" في لوحة المدير.
* نداء مستقل وخفيف: البطاقة كانت تعتمد على بيانات النظرة العامة، فإن تعثّر
* أي شيء في مسارها بقيت القائمة فارغة بلا رسالة. الآن تملأ نفسها.
*/
function getActiveEmployeesForManager() {
const employees = getAllEmployees_()
.filter(function (e) { return e.active === true; })
.map(function (e) { return { id: String(e.id), name: String(e.name) }; });
return { employees: employees };
}

function addManagerDailyTask(payload) {
const empId = String((payload && payload.empId) || '').trim();
const text = String((payload && payload.text) || '').trim();
const priority = (String((payload && payload.priority) || '').trim() === 'عاجلة') ? 'عاجلة' : 'عادية';

if (!empId || !text) return { success: false, error: 'بيانات ناقصة' };

const emp = getEmployeeById_(empId);
if (!emp || emp.active !== true) return { success: false, error: 'موظف غير صالح أو غير نشط' };

return addTaskRow_(empId, emp.name, text, 'المدير', priority);
}

/**
* نقطة الدخول الوحيدة لواجهة لوحة المدير لجلب بيانات النظرة العامة.
* تُستدعى من ManagerDashboard.html عبر google.script.run.
* قراءة فقط - لا تُعدّل أي بيانات.
*/
function getManagerOverviewData() {
var settings = getSettings();
var employees = getAllEmployees_().filter(function (emp) { return emp.active; });
var todayStr = normalizeDateStr_(new Date());
var attendanceByEmp = getTodayAttendanceByEmployee_(todayStr);
var recurringByEmp = getRecurringTasksByEmployee_();
var fridayInfo = getFridayInfo_(settings);
var urgentByEmp = getUrgentTasksByEmployee_();
var pendingFixByEmp = getPendingFixSessionsByEmployee_();

var employeesOut = employees.map(function (emp) {
var todayAttendance = attendanceByEmp[emp.id] || [];
var taskStats = getEmployeeTaskStats_(emp.id, emp.name);
var status = computeEmployeeStatus_(emp, todayAttendance);
var alerts = computeEmployeeAlerts_(emp, urgentByEmp[emp.id] || [], pendingFixByEmp[emp.id] || []);
return {
id: emp.id,
name: emp.name,
shiftType: emp.shiftType,
shiftStart: emp.shiftStart,
shiftEnd: emp.shiftEnd,
minDailyHours: emp.minDailyHours,
periodHours: emp.periodHours,
baseSalary: emp.baseSalary,
hourlyRate: emp.hourlyRate,
todayAttendance: todayAttendance,
presentToday: todayAttendance.length > 0,
recurringTasks: recurringByEmp[emp.id] || [],
taskStats: taskStats,
status: status,
alerts: alerts
};
});

var presentCount = employeesOut.filter(function (e) { return e.presentToday; }).length;

return {
today: todayStr,
currency: settings.currency || 'ريال',
fridayAllowance: Number(settings.friday_allowance) || 0,
coverageAllowance: Number(settings.coverage_full_allowance) || 0,
fridayThisWeekWorker: settings.friday_worker_this_week || '',
fridayShiftStart: (settings.friday_shift_start && isValidTimeStr_(settings.friday_shift_start)) ? settings.friday_shift_start : '18:00',
fridayShiftEnd: (settings.friday_shift_end && isValidTimeStr_(settings.friday_shift_end)) ? settings.friday_shift_end : '22:00',
fridayNext: fridayInfo,
employees: employeesOut,
presentCount: presentCount,
totalActive: employeesOut.length
};
}

/**
* يحدد حالة حضور الموظف الآن (حاضر/متأخر/لم يسجل بعد) بالاعتماد على سجل
* حضوره الحقيقي اليوم ونوع دوامه. عرض مشتق للقراءة فقط - لا يُغيّر بيانات.
*/
function computeEmployeeStatus_(emp, todayAttendance) {
var now = new Date();
if (todayAttendance && todayAttendance.length > 0) {
var totalHours = 0;
todayAttendance.forEach(function (a) { totalHours += Number(a.durationHours) || 0; });
totalHours = Math.round(totalHours * 100) / 100;
var firstCheckIn = todayAttendance[0].checkIn || '';
var isLate = false;
if (emp.shiftType === 'ثابت' && emp.shiftStart && firstCheckIn) {
var toMin = function (t) { var p = String(t).split(':'); return Number(p[0]) * 60 + Number(p[1]); };
isLate = (toMin(firstCheckIn) - toMin(emp.shiftStart)) > 15;
}
if (isLate) {
return { level: 'warning', text: '🟡 متأخر — دخول ' + firstCheckIn };
}
var timesText = todayAttendance.length > 1
? 'سجّل حضوره ' + todayAttendance.length + ' مرات اليوم'
: 'دخول ' + firstCheckIn;
return { level: 'good', text: '🟢 حاضر — ' + timesText + (totalHours ? ' — إجمالي ' + totalHours + ' ساعة حتى الآن' : '') };
}
if (emp.shiftType === 'ثابت' && emp.shiftStart) {
var nowMin = now.getHours() * 60 + now.getMinutes();
var sp = String(emp.shiftStart).split(':');
var startMin = Number(sp[0]) * 60 + Number(sp[1]);
if (nowMin > startMin + 15) {
return { level: 'critical', text: '🔴 لم يسجّل حضوره بعد' };
}
}
return { level: 'warning', text: '⏳ لم يسجّل حضوره بعد اليوم' };
}

/**
* تنبيهات إضافية على بطاقة الموظف: جلسة حضور منسية بحاجة تصحيح يدوي،
* أو مهام عاجلة مفتوحة معلّقة. مبنية على بيانات حقيقية فقط.
*/
function computeEmployeeAlerts_(emp, urgentTasks, pendingFixSessions) {
var alerts = [];
if (pendingFixSessions && pendingFixSessions.length) {
// نمرّر رقم صف الجلسة مع التنبيه، ليصحّحها المدير من مكانها مباشرة
// بدل الذهاب إلى تبويب الإعدادات
alerts.push({
level: 'critical',
text: '🕓 نسي تسجيل الانصراف بتاريخ ' + pendingFixSessions[0].date + ' — يحتاج تصحيحاً يدوياً',
fixRow: pendingFixSessions[0].row,
fixDate: pendingFixSessions[0].date,
fixCheckIn: pendingFixSessions[0].checkIn
});
}
if (urgentTasks && urgentTasks.length) {
var t = urgentTasks[0];
alerts.push({ level: 'warning', text: '⚠️ ' + (urgentTasks.length > 1 ? urgentTasks.length + ' مهام عاجلة مفتوحة بحاجة لمتابعة' : 'مهمة عاجلة مفتوحة: ' + t.task) });
}
return alerts;
}

/**
* المهام العاجلة المفتوحة مجمّعة حسب الموظف (تستخدم getUrgentOpenTasks
* الموجودة أصلاً لتفادي تكرار المنطق).
*/
function getUrgentTasksByEmployee_() {
var res = getUrgentOpenTasks();
var out = {};
(res.tasks || []).forEach(function (t) {
if (!out[t.empId]) out[t.empId] = [];
out[t.empId].push(t);
});
return out;
}

/**
* الجلسات المفتوحة (بحاجة تصحيح يدوي) مجمّعة حسب الموظف (تستخدم
* getPendingFixSessions الموجودة أصلاً لتفادي تكرار المنطق).
*/
function getPendingFixSessionsByEmployee_() {
var res = getPendingFixSessions();
var out = {};
(res.sessions || []).forEach(function (s) {
if (!out[s.empId]) out[s.empId] = [];
out[s.empId].push(s);
});
return out;
}

/**
* يقرأ سجل الحضور الحقيقي (سجل الحضور) ويُرجع سجلات اليوم مجمّعة حسب emp_id.
* كل موظف قد يكون له أكثر من سجل باليوم (حالة مجيد المرنة: حضور/انصراف متعدد).
*/
function getTodayAttendanceByEmployee_(dateStr) {
var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
var result = {};
if (!sheet || sheet.getLastRow() < 2) return result;
var numRows = sheet.getLastRow() - 1;
var data = sheet.getRange(2, 1, numRows, 17).getValues();
data.forEach(function (r) {
var rowDate = normalizeDateStr_(r[1]);
if (rowDate !== dateStr) return;
var empId = String(r[2]);
if (!result[empId]) result[empId] = [];
result[empId].push({
type: r[4] || '',
coveringFor: r[5] || '',
checkIn: normalizeTimeStr_(r[6]),
checkOut: normalizeTimeStr_(r[10]),
durationHours: r[14] || '',
status: r[15] || '',
notes: r[16] || ''
});
});
return result;
}

/**
* يقرأ شيت "قالب المهام المتكررة" الحقيقي (المهام الثابتة لكل موظف) ويُرجعها
* مجمّعة حسب emp_id، فقط البنود النشطة (نشط؟ = نعم).
* هذا يحقن قائمة المهام المتكررة الحقيقية مباشرة في اللوحة بدل بيانات تجريبية.
*/
function getRecurringTasksByEmployee_() {
var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASKS_TEMPLATE);
var result = {};
if (!sheet || sheet.getLastRow() < 2) return result;
var numRows = sheet.getLastRow() - 1;
var data = sheet.getRange(2, 1, numRows, 6).getValues();
data.forEach(function (r, idx) {
var empId = String(r[0]);
var isActive = String(r[3]).trim() === 'نعم';
if (!isActive) return;
if (!result[empId]) result[empId] = [];
result[empId].push({
row: idx + 2,
text: r[2] || '',
inputType: r[4] || '',
priority: r[5] || ''
});
});
return result;
}

/**
* ============================================================
* المرحلة الثانية - التعديلات: الإعدادات، الموظفون، الحضور اليدوي، المهام
* إضافة جديدة بالكامل - تكتب فقط إلى نفس الشيتات الحقيقية عبر
* SpreadsheetApp بما يطابق أعمدتها الفعلية تماماً، ولا تُعدّل أي شيء آخر.
* كل عملية تعديل تُسجَّل في "سجل التعديلات" عبر logEdit_ الموجودة أصلاً.
* ============================================================
*/

function isValidTimeStr_(t) {
return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(t).trim());
}

/**
* تعديل الإعدادات العامة: بدل الجمعة، بدل التغطية، مناوب الجمعة هذا الأسبوع.
* تكتب فقط إلى المفاتيح المرسلة (تجاهل أي حقل فارغ).
*/
function updateGlobalSettings_(payload) {
var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
if (!sheet) throw new Error('لم يتم العثور على ورقة الإعدادات');
var lastRow = sheet.getLastRow();
if (lastRow < 2) throw new Error('ورقة الإعدادات فارغة');
var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();

var updates = {};
if (payload.fridayAllowance !== undefined && payload.fridayAllowance !== '' && !isNaN(Number(payload.fridayAllowance))) {
updates.friday_allowance = Number(payload.fridayAllowance);
}
if (payload.coverageAllowance !== undefined && payload.coverageAllowance !== '' && !isNaN(Number(payload.coverageAllowance))) {
updates.coverage_full_allowance = Number(payload.coverageAllowance);
}
if (payload.fridayWorkerThisWeek) {
updates.friday_worker_this_week = String(payload.fridayWorkerThisWeek).trim();
}
// === بداية إضافة: دوام الجمعة المستقل - إضافي بالكامل ===
if (payload.fridayShiftStart !== undefined && payload.fridayShiftStart !== '' && isValidTimeStr_(payload.fridayShiftStart)) {
updates.friday_shift_start = String(payload.fridayShiftStart).trim();
}
if (payload.fridayShiftEnd !== undefined && payload.fridayShiftEnd !== '' && isValidTimeStr_(payload.fridayShiftEnd)) {
updates.friday_shift_end = String(payload.fridayShiftEnd).trim();
}
// === نهاية الإضافة ===

var changed = [];
data.forEach(function (row, idx) {
var key = row[0];
if (updates.hasOwnProperty(key)) {
var cell_ = sheet.getRange(idx + 2, 2);
if (key === 'friday_shift_start' || key === 'friday_shift_end') { cell_.setNumberFormat('@'); }
cell_.setValue(updates[key]);
changed.push(key + ' = ' + updates[key]);
}
});
// === بداية إضافة: إنشاء مفاتيح إعدادات جديدة تلقائياً إن لم تكن موجودة بالشيت - إضافي بالكامل ===
var presentKeys_ = {};
data.forEach(function (row) { presentKeys_[row[0]] = true; });
Object.keys(updates).forEach(function (key) {
if (!presentKeys_[key]) {
sheet.appendRow([key, updates[key]]);
if (key === 'friday_shift_start' || key === 'friday_shift_end') {
sheet.getRange(sheet.getLastRow(), 2).setNumberFormat('@').setValue(String(updates[key]));
}
changed.push(key + ' = ' + updates[key] + ' (جديد)');
}
});
// === نهاية الإضافة ===
if (changed.length) {
logEdit_('تعديل الإعدادات العامة (لوحة المدير)', changed.join(' | '));
}
return { success: true };
}

/**
* تعديل بيانات موظف: الراتب الأساسي، معدل الخصم/ساعة، بداية/نهاية الدوام،
* الحد الأدنى اليومي (للدوام المرن). تكتب فقط الحقول المرسلة.
*/
function updateEmployeeDetails_(payload) {
var empId = String(payload.id || '');
if (!empId) throw new Error('معرف الموظف مفقود');
var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_EMPLOYEES);
if (!sheet) throw new Error('لم يتم العثور على ورقة الموظفون');
var lastRow = sheet.getLastRow();
var data = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
var rowIndex = -1;
for (var i = 0; i < data.length; i++) {
if (String(data[i][0]) === empId) { rowIndex = i + 2; break; }
}
if (rowIndex === -1) throw new Error('لم يتم العثور على الموظف: ' + empId);

var changed = [];
if (payload.baseSalary !== undefined && payload.baseSalary !== '' && !isNaN(Number(payload.baseSalary))) {
sheet.getRange(rowIndex, 7).setValue(Number(payload.baseSalary));
changed.push('الراتب الأساسي = ' + payload.baseSalary);
}
if (payload.hourlyRate !== undefined && payload.hourlyRate !== '' && !isNaN(Number(payload.hourlyRate))) {
sheet.getRange(rowIndex, 8).setValue(Number(payload.hourlyRate));
changed.push('معدل الخصم/ساعة = ' + payload.hourlyRate);
}
if (payload.minDailyHours !== undefined && payload.minDailyHours !== '' && !isNaN(Number(payload.minDailyHours))) {
sheet.getRange(rowIndex, 9).setValue(Number(payload.minDailyHours));
changed.push('الحد الأدنى اليومي = ' + payload.minDailyHours);
}
if (payload.shiftStart) {
if (!isValidTimeStr_(payload.shiftStart)) throw new Error('صيغة وقت البداية غير صحيحة (استخدم HH:MM)');
sheet.getRange(rowIndex, 4).setValue(payload.shiftStart);
changed.push('بداية الدوام = ' + payload.shiftStart);
}
if (payload.shiftEnd) {
if (!isValidTimeStr_(payload.shiftEnd)) throw new Error('صيغة وقت النهاية غير صحيحة (استخدم HH:MM)');
sheet.getRange(rowIndex, 5).setValue(payload.shiftEnd);
changed.push('نهاية الدوام = ' + payload.shiftEnd);
}
if (changed.length) {
logEdit_('تعديل بيانات موظف (لوحة المدير)', 'الموظف ' + empId + ': ' + changed.join(' | '));
}
return { success: true };
}

/**
* إضافة تسجيل حضور يدوي (تصحيح) إلى سجل الحضور الحقيقي - إضافة صف جديد فقط،
* لا تُعدّل أو تحذف أي صف موجود.
*/
function addManualAttendanceRecord_(payload) {
var emp = getEmployeeById_(String(payload.empId || ''));
if (!emp) throw new Error('موظف غير موجود');
var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
if (!sheet) throw new Error('لم يتم العثور على سجل الحضور');

var dateStr = payload.date || normalizeDateStr_(new Date());
var checkIn = payload.checkIn || '';
var checkOut = payload.checkOut || '';
if (checkIn && !isValidTimeStr_(checkIn)) throw new Error('صيغة وقت الحضور غير صحيحة (استخدم HH:MM)');
if (checkOut && !isValidTimeStr_(checkOut)) throw new Error('صيغة وقت الانصراف غير صحيحة (استخدم HH:MM)');

var duration = '';
if (checkIn && checkOut) {
var toMinutes = function (t) {
var parts = String(t).split(':');
return Number(parts[0]) * 60 + Number(parts[1]);
};
var diff = toMinutes(checkOut) - toMinutes(checkIn);
if (diff < 0) diff += 24 * 60;
duration = Math.round((diff / 60) * 100) / 100;
}

var recordId = 'MANUAL-' + new Date().getTime();
var row = [
recordId, dateStr, emp.id, emp.name,
payload.type || 'يدوي', payload.coveringFor || '',
checkIn, '', '', checkIn ? 'يدوي - لوحة المدير' : '',
checkOut, '', '', checkOut ? 'يدوي - لوحة المدير' : '',
// عمود "الحالة" لا يقبل إلا 'مفتوح' أو 'مكتمل' - كل التقارير والرواتب
// تعدّ الأيام بشرط 'مكتمل' حصرًا. كان يُكتب هنا نص التصحيح، فكان أي سجل
// يدوي لا يُحتسب يوم عمل إطلاقًا. نص التصحيح موضعه عمود الملاحظات.
duration,
(checkIn && checkOut) ? 'مكتمل' : 'مفتوح',
appendNoteText_(payload.note || '', 'تعديل يدوي من المدير', 'المدير')
];
sheet.appendRow(row);
logEdit_('إضافة تسجيل حضور يدوي (لوحة المدير)', emp.name + ' - ' + dateStr + ' (' + checkIn + ' - ' + checkOut + ')');
return { success: true };
}

/**
* إضافة مهمة متكررة جديدة لموظف - إضافة صف جديد فقط في شيت قالب المهام.
*/
function addRecurringTask_(payload) {
var emp = getEmployeeById_(String(payload.empId || ''));
if (!emp) throw new Error('موظف غير موجود');
var text = String(payload.text || '').trim();
if (!text) throw new Error('نص المهمة مطلوب');
var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASKS_TEMPLATE);
if (!sheet) throw new Error('لم يتم العثور على ورقة قالب المهام المتكررة');
sheet.appendRow([emp.id, emp.name, text, 'نعم', payload.inputType || 'إنجاز', payload.priority || 'عادية']);
logEdit_('إضافة مهمة متكررة (لوحة المدير)', emp.name + ': ' + text);
return { success: true };
}

/**
* تفعيل/تعطيل مهمة متكررة حسب رقم صفها في الشيت (مُرسَل من نفس البيانات
* التي عرضتها اللوحة، فلا حاجة لعمود "معرف" إضافي في الشيت).
*/
function toggleRecurringTaskActive_(rowNumber) {
var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASKS_TEMPLATE);
if (!sheet) throw new Error('لم يتم العثور على ورقة قالب المهام المتكررة');
var row = Number(rowNumber);
if (!row || row < 2 || row > sheet.getLastRow()) throw new Error('رقم صف غير صالح');
var cell = sheet.getRange(row, 4);
var current = String(cell.getValue()).trim() === 'نعم';
var next = current ? 'لا' : 'نعم';
cell.setValue(next);
var taskText = sheet.getRange(row, 3).getValue();
logEdit_('تفعيل/تعطيل مهمة متكررة (لوحة المدير)', taskText + ' -> ' + next);
return { success: true, active: !current };
}

/**
* يحسب صاحب دور الجمعة القادمة اعتماداً على دالة التناوب الموجودة أصلاً
* (getFridayWorkerForDate_) بدل إعادة كتابة منطق التناوب من جديد.
*/
function getFridayInfo_(settings) {
var today = new Date();
var day = today.getDay(); // 0=الأحد ... 5=الجمعة ... 6=السبت
var diff = (5 - day + 7) % 7;
if (diff === 0) diff = 7; // إن كان اليوم جمعة، "القادمة" هي بعد أسبوع
var nextFriday = new Date(today);
nextFriday.setDate(nextFriday.getDate() + diff);
var nextWorker = '';
try {
nextWorker = getFridayWorkerForDate_(nextFriday, settings);
} catch (err) {
nextWorker = '';
}
return {
date: normalizeDateStr_(nextFriday),
worker: nextWorker
};
}

/* ============================================================
المرحلة الثالثة - التصميم الكامل المعتمد (التبويبان + كل الميزات
الحقيقية): مراجعة التقارير، الرواتب التفصيلية، تفاصيل الموظف
المصنّفة، التصحيح اليدوي، إدارة المهام (بما فيها فقرات تقرير
المشرف + الصور)، التغطية/الجمعة.
إضافة جديدة بالكامل فوق كل ما سبق - لا تُعدّل أي دالة موجودة.
كل كتابة بيانات تُسجَّل عبر logEdit_ الموجودة أصلاً.
============================================================ */

// ---------- إصلاح: أسماء عامة (بدون شرطة سفلية) لدوال الحفظ الخمس ----------
// الواجهة (ManagerDashboard.html) تنادي هذه الأسماء عبر google.script.run،
// و google.script.run لا يرى الدوال المنتهية بشرطة سفلية (خاصة/private) إطلاقاً.
function updateGlobalSettings(payload) { return updateGlobalSettings_(payload); }
function updateEmployeeDetails(payload) { return updateEmployeeDetails_(payload); }
function addManualAttendanceRecord(payload) { return addManualAttendanceRecord_(payload); }
function addRecurringTask(payload) { return addRecurringTask_(payload); }
function toggleRecurringTaskActive(rowNumber) { return toggleRecurringTaskActive_(rowNumber); }

// ---------- أوراق جديدة تُنشأ تلقائياً (Lazy) عند أول استخدام فعلي ----------
var SHEET_MGR_REVIEWS = 'مراجعات المدير';
var SHEET_WITHDRAWALS = 'مسحوبات الرواتب';

function ensureManagerReviewsSheet_() {
var ss = SpreadsheetApp.getActiveSpreadsheet();
var sh = ss.getSheetByName(SHEET_MGR_REVIEWS);
if (!sh) {
sh = ss.insertSheet(SHEET_MGR_REVIEWS);
sh.appendRow(['التاريخ', 'معرف الموظف', 'وقت المراجعة']);
sh.setFrozenRows(1);
}
return sh;
}

function ensureWithdrawalsSheet_() {
var ss = SpreadsheetApp.getActiveSpreadsheet();
var sh = ss.getSheetByName(SHEET_WITHDRAWALS);
if (!sh) {
sh = ss.insertSheet(SHEET_WITHDRAWALS);
sh.appendRow(['الشهر', 'معرف الموظف', 'المبلغ']);
sh.setFrozenRows(1);
}
return sh;
}

// عمودان إضافيان في "المهام اليومية" و"قالب المهام المتكررة" لدعم الصور
// (إضافة فقط عبر ensureHeaders_ الموجودة أصلاً في Tasks.gs - لا تحذف/تُعدّل أي عمود قائم)
function ensureTaskPhotoColumns_() {
var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASKS);
ensureHeaders_(sh, ['صورة اختيارية؟', 'رابط الصورة']);
}
function ensureTemplatePhotoColumn_() {
var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASKS_TEMPLATE);
ensureHeaders_(sh, ['صورة اختيارية؟']);
}

/**
* تفاصيل يوم موظف كامل: الحضور + كل المهام مصنّفة حسب مصدرها الحقيقي
* (من المدير / من المشرف / دورية / مرحّلة / أخرى) - لاستخدام نافذة
* "عرض التفاصيل" في لوحة المدير.
*/
function getEmployeeDayDetail(empId, dateStr) {
var emp = getEmployeeById_(String(empId || ''));
if (!emp) throw new Error('موظف غير موجود');
var targetDate = (dateStr && String(dateStr).trim()) || normalizeDateStr_(new Date());

var attByEmp = getTodayAttendanceByEmployee_(targetDate);
var attendance = attByEmp[emp.id] || [];

ensureTaskPhotoColumns_();
seedRecurringTasksForDate_(emp.id, emp.name, targetDate);

// نجلب فقرات القالب مع علامة "صورة اختيارية؟" لمطابقتها بالنص مع مهام اليوم
var templatePhotoByText = {};
var tSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASKS_TEMPLATE);
if (tSheet && tSheet.getLastRow() >= 2) {
var tData = tSheet.getRange(2, 1, tSheet.getLastRow() - 1, 7).getValues();
tData.forEach(function (r) {
if (String(r[0]).trim() === String(emp.id)) {
templatePhotoByText[String(r[2]).trim()] = String(r[6] || '').trim() === 'نعم';
}
});
}

var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASKS);
var data = sheet.getDataRange().getValues();
var tasks = [];
for (var i = 1; i < data.length; i++) {
var row = data[i];
if (normalizeDateStr_(row[1]) !== targetDate) continue;
if (String(row[2]).trim() !== String(emp.id)) continue;

var notes = row[10] || '';
var isPostponed = String(notes).indexOf('تم تأجيل المهمة') !== -1;
var addedBy = row[7] || '';
var category = 'أخرى';
if (addedBy === 'نظام تلقائي') category = 'دورية';
else if (isPostponed) category = 'مرحّلة';
else if (addedBy === 'المدير') category = 'من المدير';
else if (addedBy && addedBy !== emp.name) category = 'من المشرف';
else if (addedBy === emp.name) category = 'أضافها بنفسه';

var taskText = String(row[4] || '').trim();
tasks.push({
id: row[0],
task: row[4],
recurring: row[5] === 'نعم',
completed: row[6] === 'مكتملة',
addedBy: addedBy,
notes: notes,
inputType: (row[11] === 'عدد' || row[11] === 'نص') ? row[11] : 'علامة',
value: row[12] === undefined || row[12] === null ? '' : String(row[12]),
priority: (String(row[14] || '').trim() === 'عاجلة') ? 'عاجلة' : 'عادية',
category: category,
photoOptional: !!templatePhotoByText[taskText],
photoUrl: row[17] || ''
});
}

return { success: true, empId: emp.id, empName: emp.name, date: targetDate, attendance: attendance, tasks: tasks };
}

/**
* إحصائية مهام اليوم + آخر 7 أيام لكل موظف (لعرض عمود التقدم اليومي
* والرسم البياني الصغير بكل بطاقة موظف).
*/
function getEmployeeTaskStats_(empId, empName) {
  var todayStr = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  seedRecurringTasksForDate_(empId, empName, todayStr);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASKS);
  var data = sheet ? sheet.getDataRange().getValues() : [];
  var week = [];
  for (var i = 6; i >= 0; i--) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    var dateStr = Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd');
    var total = 0, answered = 0;
    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      if (normalizeDateStr_(row[1]) === dateStr && String(row[2]).trim() === String(empId)) {
        total++;
        var isAnswered = row[6] === 'مكتملة' || String(row[15] || '').trim() === 'نعم';
        if (isAnswered) answered++;
      }
    }
    week.push({ date: dateStr, completed: answered, total: total });
  }
  return { today: week[week.length - 1], week: week };
}

/**
* كل المهام العاجلة غير المكتملة حالياً (لكل الموظفين، كل التواريخ) -
* لبطاقة "مهام عاجلة مفتوحة" أعلى اللوحة.
*/
function getUrgentOpenTasks() {
var employees = getAllEmployees_().filter(function (e) { return e.active; });
var empById = {};
employees.forEach(function (e) { empById[e.id] = e; });

var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASKS);
var data = sheet.getDataRange().getValues();
var out = [];
for (var i = 1; i < data.length; i++) {
var row = data[i];
var empId = String(row[2]).trim();
if (!empById[empId]) continue;
var priority = String(row[14] || '').trim();
var completed = row[6] === 'مكتملة';
if (priority === 'عاجلة' && !completed) {
out.push({
empId: empId, empName: empById[empId].name, taskId: row[0],
task: row[4], date: normalizeDateStr_(row[1]), notes: row[10] || ''
});
}
}
return { success: true, tasks: out };
}

/**
* التقارير اليومية المكتملة (كل مهام اليوم أُجيب عنها) التي لم يراجعها
* المدير بعد - يوم واحد لكل موظف (الأحدث غير المُراجَع).
*/
function getPendingReviewReports() {
var employees = getAllEmployees_().filter(function (e) { return e.active; });
var reviewsSh = ensureManagerReviewsSheet_();
var reviewedSet = {};
if (reviewsSh.getLastRow() >= 2) {
reviewsSh.getRange(2, 1, reviewsSh.getLastRow() - 1, 2).getValues().forEach(function (r) {
reviewedSet[normalizeDateStr_(r[0]) + '||' + String(r[1])] = true;
});
}
var out = [];
employees.forEach(function (emp) {
var days = getRecentReportDays(emp.id, 7);
if (!days || !days.success) return;
var pending = days.days.filter(function (d) {
return d.total > 0 && d.isComplete && !reviewedSet[d.date + '||' + emp.id];
});
if (pending.length) out.push({ empId: emp.id, empName: emp.name, date: pending[0].date });
});
return { success: true, reports: out };
}

/**
* مراجعة تقرير يوم لموظف. إن كتب المدير ملاحظة، تُضاف تلقائياً كمهمة
* جديدة في "مهامي اليومية" الخاصة بذلك الموظف (نفس آلية addTaskRow_
* الموجودة أصلاً)، ثم يُسجَّل اليوم كمُراجَع فلا يظهر مجدداً في القائمة.
*/
function reviewEmployeeDay(payload) {
var empId = String(payload.empId || '');
var dateStr = String(payload.date || '');
var note = String(payload.note || '').trim();
var emp = getEmployeeById_(empId);
if (!emp) throw new Error('موظف غير موجود');
if (!dateStr) throw new Error('التاريخ مفقود');

if (note) {
addTaskRow_(empId, emp.name, note, 'المدير', 'عادية');
}
var sh = ensureManagerReviewsSheet_();
sh.appendRow([dateStr, empId, Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm')]);
logEdit_('مراجعة تقرير يومي (لوحة المدير)', emp.name + ' - ' + dateStr + (note ? ' - ملاحظة تحوّلت لمهمة: ' + note : ''));
return { success: true };
}

/**
* ملخص الرواتب الحي للشهر الحالي حتى اليوم (وليس شهراً كاملاً افتراضياً) -
* بنفس صيغة الحساب الحقيقية المستخدمة في generatePayrollForMonth
* (Payroll.gs)، بالإضافة إلى المسحوبات (ميزة جديدة، عمود شهري لكل موظف).
* الأيام المستقبلية من الشهر لا تُحتسب غياباً لأنها لم تحدث بعد.
*/
function getPayrollSummary() {
var settings = getSettings();
var employees = getAllEmployees_().filter(function (e) { return e.active; });
var now = new Date();
var monthStr = Utilities.formatDate(now, TIMEZONE, 'yyyy-MM');
var todayStr = normalizeDateStr_(now);

var daysElapsed = [];
var d = new Date(now.getFullYear(), now.getMonth(), 1);
while (d.getMonth() === now.getMonth() && normalizeDateStr_(d) <= todayStr) {
daysElapsed.push(new Date(d));
d.setDate(d.getDate() + 1);
}

var logRows = getLogRowsForMonth_(monthStr);
var withdrawals = getWithdrawalsForMonth_(monthStr);
var allEmployeesForRate = getAllEmployees_();

var out = employees.map(function (emp) {
var empRows = logRows.filter(function (r) { return String(r[2]) === emp.id; });
var attendanceDays = 0, absenceDays = 0, absenceDeduction = 0, fridayCount = 0,
coverageHoursTotal = 0, coverageAmountTotal = 0, pendingDays = 0;

daysElapsed.forEach(function (dateObj) {
var dateStr = Utilities.formatDate(dateObj, TIMEZONE, 'yyyy-MM-dd');
var dayRows = empRows.filter(function (r) { return r[1] === dateStr; });
var isFridayTurn = dateObj.getDay() === 5;
var expected = isExpectedDay_(emp, dateObj, settings);
var relevantRows = isFridayTurn
? dayRows.filter(function (r) { return r[4] === 'جمعة'; })
: dayRows.filter(function (r) { return r[4] === 'عادي'; });
var completed = relevantRows.filter(function (r) { return r[15] === 'مكتمل'; });
var open = relevantRows.filter(function (r) { return r[15] === 'مفتوح'; });

if (open.length > 0) { pendingDays++; return; }
if (isFridayTurn) { if (completed.length > 0) fridayCount++; return; }
if (!expected) return;

var isToday = dateStr === todayStr;
if (completed.length === 0) {
if (!isToday) {
absenceDays++;
absenceDeduction += (emp.shiftType === 'ثابت' ? emp.periodHours : emp.minDailyHours) * emp.hourlyRate;
}
return;
}
attendanceDays++;
if (emp.shiftType !== 'ثابت') {
var workHours = sumHours_(completed);
if (workHours < emp.minDailyHours) {
absenceDeduction += (emp.minDailyHours - workHours) * emp.hourlyRate;
}
}
var coverageCompleted = dayRows.filter(function (r) { return r[4] === 'تغطية' && r[15] === 'مكتمل'; });
coverageCompleted.forEach(function (r) {
var hours = Number(r[14]) || 0;
var coveredEmp = allEmployeesForRate.find(function (e) { return e.name === r[5]; });
var rate = coveredEmp ? coveredEmp.hourlyRate : 0;
coverageHoursTotal += hours;
coverageAmountTotal += hours * rate;
});
});

var fridayAllowance = Math.round(fridayCount * (Number(settings.friday_allowance) || 0) * 100) / 100;
absenceDeduction = Math.round(absenceDeduction * 100) / 100;
coverageAmountTotal = Math.round(coverageAmountTotal * 100) / 100;
var withdrawal = Math.round((withdrawals[emp.id] || 0) * 100) / 100;
var netSalary = Math.round((emp.baseSalary - absenceDeduction + fridayAllowance + coverageAmountTotal - withdrawal) * 100) / 100;

return {
id: emp.id, name: emp.name, baseSalary: emp.baseSalary,
attendanceDays: attendanceDays, absenceDays: absenceDays, pendingDays: pendingDays,
absenceDeduction: absenceDeduction, fridayCount: fridayCount, fridayAllowance: fridayAllowance,
coverageHours: Math.round(coverageHoursTotal * 100) / 100, coverageAmount: coverageAmountTotal,
withdrawal: withdrawal, netSalary: netSalary
};
});

return { success: true, month: monthStr, daysElapsed: daysElapsed.length, currency: settings.currency || 'ريال', employees: out };
}

function getWithdrawalsForMonth_(monthStr) {
var sh = ensureWithdrawalsSheet_();
var lastRow = sh.getLastRow();
var result = {};
if (lastRow < 2) return result;
var data = sh.getRange(2, 1, lastRow - 1, 3).getValues();
data.forEach(function (r) {
if (normalizeMonthStr_(r[0]) === monthStr) result[String(r[1])] = Number(r[2]) || 0;
});
return result;
}

/**
* حفظ الراتب الأساسي والمسحوبات الشهرية لموظف من لوحة المدير.
*/
function saveEmployeeSalaryAndWithdrawal(payload) {
var empId = String(payload.empId || '');
var emp = getEmployeeById_(empId);
if (!emp) throw new Error('موظف غير موجود');

if (payload.baseSalary !== undefined && payload.baseSalary !== '' && !isNaN(Number(payload.baseSalary))) {
updateEmployeeDetails_({ id: empId, baseSalary: payload.baseSalary });
}

if (payload.withdrawal !== undefined && payload.withdrawal !== '' && !isNaN(Number(payload.withdrawal))) {
var monthStr = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM');
var sh = ensureWithdrawalsSheet_();
var lastRow = sh.getLastRow();
var rowIndex = -1;
if (lastRow >= 2) {
var data = sh.getRange(2, 1, lastRow - 1, 2).getValues();
for (var i = 0; i < data.length; i++) {
if (normalizeMonthStr_(data[i][0]) === monthStr && String(data[i][1]) === empId) { rowIndex = i + 2; break; }
}
}
if (rowIndex === -1) {
sh.appendRow([monthStr, empId, Number(payload.withdrawal)]);
} else {
sh.getRange(rowIndex, 3).setValue(Number(payload.withdrawal));
}
logEdit_('تعديل مسحوبات (لوحة المدير)', emp.name + ' - ' + monthStr + ' = ' + payload.withdrawal);
}
return { success: true };
}

/**
* جلسات حضور مفتوحة (بدون انصراف) من أيام سابقة - بحاجة لتصحيح يدوي.
*/
function getPendingFixSessions() {
var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
var out = [];
if (!sh || sh.getLastRow() < 2) return { success: true, sessions: out };
var todayStr = normalizeDateStr_(new Date());
var data = sh.getRange(2, 1, sh.getLastRow() - 1, 17).getValues();
data.forEach(function (r, idx) {
var dateStr = normalizeDateStr_(r[1]);
if (r[15] === 'مفتوح' && dateStr < todayStr) {
out.push({
row: idx + 2, empId: String(r[2]), empName: r[3], date: dateStr,
type: r[4], checkIn: normalizeTimeStr_(r[6])
});
}
});
return { success: true, sessions: out };
}

/**
* تصحيح جلسة حضور مفتوحة بإدخال وقت انصراف يدوي.
*/
function fixOpenSession(payload) {
var row = Number(payload.row);
if (!row || row < 2) throw new Error('صف غير صالح');
var checkOut = payload.checkOutTime;
if (!checkOut || !isValidTimeStr_(checkOut)) throw new Error('صيغة وقت الانصراف غير صحيحة (استخدم HH:MM)');

var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
var rowData = sh.getRange(row, 1, 1, 17).getValues()[0];
if (rowData[15] !== 'مفتوح') throw new Error('هذه الجلسة ليست مفتوحة (ربما صُحّحت بالفعل)');

var dateStr = normalizeDateStr_(rowData[1]);
var checkInDate = new Date(rowData[6]);
var parts = String(checkOut).split(':');
var checkOutDate = new Date(dateStr + 'T00:00:00');
checkOutDate.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
var durationHours = (checkOutDate.getTime() - checkInDate.getTime()) / 3600000;
if (durationHours < 0) throw new Error('وقت الانصراف يجب أن يكون بعد وقت الحضور (' + normalizeTimeStr_(rowData[6]) + ')');

sh.getRange(row, 11).setValue(checkOutDate);
sh.getRange(row, 14).setValue('يدوي - لوحة المدير');
sh.getRange(row, 15).setValue(Math.round(durationHours * 100) / 100);
sh.getRange(row, 16).setValue('مكتمل');
if (payload.note) {
var existingNote = rowData[16] || '';
sh.getRange(row, 17).setValue((existingNote ? existingNote + ' | ' : '') + 'تصحيح المدير: ' + payload.note);
}
logEdit_('تصحيح جلسة حضور مفتوحة (لوحة المدير)', rowData[3] + ' - ' + dateStr + ' - انصراف ' + checkOut);
return { success: true };
}

/**
* قائمة كاملة لإدارة المهام المتكررة/فقرات التقرير المتكررة (لكل الموظفين)
* مع رقم الصف لكل بند (للحذف/التعديل).
*/
function getRecurringTasksAdmin() {
ensureTemplatePhotoColumn_();
var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASKS_TEMPLATE);
var out = [];
if (sh.getLastRow() >= 2) {
var data = sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues();
data.forEach(function (r, idx) {
out.push({
row: idx + 2, empId: String(r[0]), empName: r[1], text: r[2],
active: String(r[3]).trim() === 'نعم', inputType: r[4] || '', priority: r[5] || '',
photoOptional: String(r[6] || '').trim() === 'نعم'
});
});
}
return { success: true, items: out };
}

/**
* إضافة بند متكرر جديد (مهمة أو فقرة تقرير) مع خيار "صورة اختيارية".
*/
function addRecurringTaskFull(payload) {
ensureTemplatePhotoColumn_();
var emp = getEmployeeById_(String(payload.empId || ''));
if (!emp) throw new Error('موظف غير موجود');
var text = String(payload.text || '').trim();
if (!text) throw new Error('نص المهمة مطلوب');
var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASKS_TEMPLATE);
sh.appendRow([
emp.id, emp.name, text, 'نعم',
payload.inputType || 'علامة', payload.priority || 'عادية',
payload.photoOptional ? 'نعم' : 'لا'
]);
logEdit_('إضافة بند متكرر (لوحة المدير)', emp.name + ': ' + text);
return { success: true };
}

/**
* حذف بند متكرر نهائياً (القالب فقط - لا يمس أي مهام سابقة مُنشأة منه).
*/
function deleteRecurringTaskTemplate(rowNumber) {
var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASKS_TEMPLATE);
var row = Number(rowNumber);
if (!row || row < 2 || row > sh.getLastRow()) throw new Error('رقم صف غير صالح');
var text = sh.getRange(row, 3).getValue();
sh.deleteRow(row);
logEdit_('حذف بند متكرر (لوحة المدير)', String(text));
return { success: true };
}

