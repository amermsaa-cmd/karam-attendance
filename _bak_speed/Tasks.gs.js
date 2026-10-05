/**
* ============================================================
* إضافة: نظام المهام اليومية - مكتب كرم للسفر والنقل
* ملف جديد كليًا - لا يعدّل أي دالة موجودة في Code.gs
* الإضافة الوحيدة المطلوبة في Code.gs هي 4 أسطر توجيه داخل doGet
* (انظر ملف doGet_patch.md)
* ============================================================
*/

const SHEET_TASKS = 'المهام اليومية';
const SHEET_TASKS_TEMPLATE = 'قالب المهام المتكررة';

function handleTasksAction_(e) {
try {
const action = String(e.parameter.action).trim();

switch (action) {
case 'getTasks':
return jsonOutput_(getEmployeeTasksResponse(e.parameter.emp));
case 'toggleTask':
return jsonOutput_(toggleTaskResponse_(e));
case 'addTask':
return jsonOutput_(addTaskResponse_(e));
case 'postponeTask':
return jsonOutput_(postponeTaskResponse_(e));
case 'transferTask':
return jsonOutput_(transferTaskResponse_(e));
case 'addNote':
return jsonOutput_(addNoteResponse_(e));
case 'completeTaskWithValue':
return jsonOutput_(completeTaskWithValueResponse_(e));
case 'getEmployees':
return jsonOutput_(getEmployeesListResponse_(e));
case 'getUnreadCount':
return jsonOutput_(getUnreadCommentsCountResponse_(e));
case 'markSeen':
return jsonOutput_(markCommentsSeenResponse_(e));
case 'admin':
return HtmlService.createHtmlOutputFromFile('AdminTasks')
.setTitle('إدارة المهام - كرم للسفر والنقل')
.addMetaTag('viewport', 'width=device-width, initial-scale=1')
.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
case 'report':
return renderDailyReportPage_(e);
case 'hub':
return renderHubPage_(e);
case 'mytasks':
return renderMyTasksPage_(e);
case 'officeboard':
return renderOfficeBoardPage_();
case 'officeAlerts':
return jsonOutput_(getOfficeAlertsResponse_());

case 'getOnDuty':
return jsonOutput_(getOnDutyResponse_(e));

// ==== بداية إضافة: نقاط دخول تسجيل الحضور/الانصراف عبر رابط خارجي ====
// تُستخدم من صفحة attend.html المستضافة خارج Apps Script (GitHub Pages)
// عشان تتجاوز قيد جوجل على صلاحية الموقع الجغرافي داخل iframe الخاص بـ
// Apps Script. لا تُعدّل أي دالة موجودة - فقط تنادي submitCheckIn/
// submitCheckOut/getMyOpenStatus الموجودة أصلاً في Attendance.gs.
//
// checkin/checkout: تصل عبر تنقّل كامل للمتصفح (location.href) وليس
// fetch/JSONP، لأن ثبت عمليًا أن كل أنواع الطلبات الفرعية (fetch وحتى
// JSONP عبر script tag) قابلة للحجب من جوجل على بعض الأجهزة (سياسة
// Cross-Origin-Resource-Policy) بينما التنقّل الكامل للصفحة لا يخضع
// لهذا القيد إطلاقًا ونجح في كل اختبار. لذلك بترجع صفحة HTML تأكيد
// جاهزة (renderAttendanceResultPage_) بدل JSON خام، إلا لو أُرسل
// callback (يبقى الأسلوب القديم JSONP شغّال لمن يحتاجه لاحقًا).
// hubInit: نداء واحد يرجّع كل ما تحتاجه صفحة hub.html عند الإقلاع
// (الاسم + هل هو مشرف + هل لديه سجل حضور مفتوح) عبر postMessage من
// داخل iframe مخفي - بلا أي تنقّل ولا خروج من الصفحة.
case 'hubInit':
return renderHubInitPage_(e.parameter.emp);

case 'hubBadges':
return renderHubBadgesPage_(e.parameter.emp);

case 'attendanceStatus': {
// وضع "embed": يُستخدم من attend.html عبر iframe مخفي تمامًا (بدون أي
// خروج من الصفحة إطلاقًا) - بيرجع صفحة صغيرة وظيفتها فقط postMessage
// للنافذة الأصل بالحالة الحالية. هذا ممكن لأن تحميل محتوى Apps Script
// داخل iframe يعمل بشكل موثوق (كما في تبويب "مهامي اليومية")، المشكلة
// الوحيدة كانت صلاحية GPS تحديدًا داخل iframe جوجل - وهنا ما نحتاج GPS
// إطلاقًا لأن الموقع يُلتقط في الصفحة الأصل (top-level) قبل الوصول هنا.
if (e.parameter.embed) {
return renderAttendanceEmbedStatusPage_(e.parameter.emp);
}
return jsonOutput_(getMyOpenStatus(e.parameter.emp), e.parameter.callback);
}

case 'checkin': {
const checkinResult = submitCheckIn({
empId: e.parameter.emp,
attendanceType: e.parameter.type,
coverForId: e.parameter.coverFor,
lat: parseFloat(e.parameter.lat),
lng: parseFloat(e.parameter.lng),
device: e.parameter.device
});
if (e.parameter.embed) return renderAttendanceEmbedResultPage_(checkinResult, e.parameter.emp);
if (e.parameter.callback) return jsonOutput_(checkinResult, e.parameter.callback);
return jsonOutput_(checkinResult);
}

case 'checkout': {
const checkoutResult = submitCheckOut({
empId: e.parameter.emp,
lat: parseFloat(e.parameter.lat),
lng: parseFloat(e.parameter.lng),
device: e.parameter.device
});
if (e.parameter.embed) return renderAttendanceEmbedResultPage_(checkoutResult, e.parameter.emp);
if (e.parameter.callback) return jsonOutput_(checkoutResult, e.parameter.callback);
return jsonOutput_(checkoutResult);
}
// ==== نهاية الإضافة ====

default:
return jsonOutput_({ success: false, error: 'إجراء غير معروف: ' + action });
}
} catch (err) {
return jsonOutput_({ success: false, error: String(err) });
}
}

function jsonOutput_(obj, callbackName) {
// دعم JSONP: لو الطلب فيه callback (من صفحة خارجية زي attend.html) نرجّع
// الرد كـ JavaScript عادي (callbackName(...)) بدل JSON خام، عشان نتجاوز
// اعتماد fetch/CORS غير الموثوق على بعض الأجهزة. باقي كل الاستدعاءات
// القديمة (بدون callback) تشتغل بالضبط زي ما كانت - بدون أي تغيير.
if (callbackName) {
return ContentService.createTextOutput(callbackName + '(' + JSON.stringify(obj) + ');')
.setMimeType(ContentService.MimeType.JAVASCRIPT);
}
return ContentService.createTextOutput(JSON.stringify(obj))
.setMimeType(ContentService.MimeType.JSON);
}

// رابط صفحة الحضور المستضافة على GitHub Pages - نفس الرابط المستخدم في
// renderHubPage_. مكرّر هنا عمدًا (بدل استيراده) لتفادي أي تعديل إضافي
// على دوال أخرى.
var HUB_PAGE_URL_ = 'https://amermsaa-cmd.github.io/karam-attendance/hub.html';



/**
* تُرجع صفحة صغيرة جدًا (بلا أي واجهة) وظيفتها الوحيدة إرسال postMessage
* لصفحة attend.html الأصلية بالبيانات المُمرَّرة. تُستخدم فقط من داخل
* iframe مخفي في attend.html - لازم setXFrameOptionsMode(ALLOWALL) حتى
* تقبل جوجل تحميلها داخل iframe من نطاق مختلف (GitHub Pages)، تمامًا زي
* renderHubPage_/renderMyTasksPage_ الموجودة أصلاً.
*
* مهم: نستخدم top.postMessage (وليس parent.postMessage) لأن Google Apps
* Script نفسها تُحمّل أي صفحة HtmlService داخل طبقة iframe داخلية إضافية
* من تصميمها هي (حتى لو كنا إحنا اللي أطرناها في iframe أصلاً)، يعني
* الصفحة فعليًا على عمق طبقتين من attend.html وليس طبقة واحدة. parent
* كانت بتوصل الرسالة لطبقة جوجل الوسطى فقط (اللي محتاج نوصل لها هي
* الصفحة الأصلية الحقيقية)، فما توصل أي رد لـ attend.html أبدًا. top
* دائمًا يشاور مباشرة لأعلى نافذة (attend.html) مهما كان عدد الطبقات.
*/
function renderPostMessagePage_(payload) {
const json = JSON.stringify(payload);
const html =
'<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' +
'<script>try{top.postMessage(' + json + ', "*");}catch(e){}</script>' +
'</body></html>';
return HtmlService.createHtmlOutput(html)
.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
* نسخة "embed" من فحص الحالة: تُحمَّل داخل iframe مخفي تمامًا من attend.html
* (بدون أي خروج من الصفحة أو تأثير على ما يراه الموظف) وترجع الحالة عبر
* postMessage بدل صفحة تنقّل مرئية.
*/
/**
* ترجع للـ hub (المستضاف على GitHub Pages) كل بيانات الإقلاع دفعة واحدة:
* اسم الموظف، هل هو مشرف (دوام مرن)، وهل لديه سجل حضور مفتوح الآن.
* تُحمَّل داخل iframe مخفي وترد عبر postMessage - بلا أي تنقّل مرئي.
*/
function renderHubInitPage_(empId) {
const emp = getEmployeeById_(empId);
if (!emp || emp.active !== true) {
return renderPostMessagePage_({ type: 'hubInit', found: false });
}
let hasOpen = false;
try {
const st = getMyOpenStatus(empId);
hasOpen = !!(st && st.hasOpen);
} catch (err) {}
return renderPostMessagePage_({
type: 'hubInit',
found: true,
name: emp.name,
isSupervisor: emp.shiftType === 'مرن',
hasOpen: hasOpen,
version: APP_VERSION
});
}

/**
* أعداد الشارات الحمراء على تبويبات الهَب (مثل عدّاد واتساب).
* تُحسب في مرور واحد على ورقة المهام حتى لا تكلّف الاستطلاع الدوري كثيرًا:
*  - mytasks: مهام اليوم غير المكتملة، بنفس فلتر صفحة "مهامي" بالضبط
*    (المشرف لا يرى المتكررة هناك، فلا تُعدّ له).
*  - report:  البنود غير المُجابة في أيام نافذة التقرير (اليوم وأمس)،
*    بنفس تعريف getDayTaskStats_ للإجابة: مكتملة أو مُعلَّمة في التقرير.
* الزرع يتم لأيام النافذة فقط، تمامًا كما تفعل getRecentReportDays، حتى
* يظهر العدد الصحيح قبل أن يفتح الموظف التبويب أصلاً.
*/
function getHubBadgeCounts_(empId) {
empId = String(empId || '').trim();
const emp = getEmployeeById_(empId);
if (!emp || emp.active !== true) return { mytasks: 0, report: 0 };

const isSupervisor = String(emp.shiftType).trim() === 'مرن';
const now = new Date();
const today = Utilities.formatDate(now, TIMEZONE, 'yyyy-MM-dd');

const windowDays = {};
for (let i = 0; i < REPORT_WINDOW_DAYS_; i++) {
const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
const ds = Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd');
if (ds < MIN_REPORT_DATE_) continue;
seedRecurringTasksForDate_(empId, emp.name, ds);
windowDays[ds] = true;
}

const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASKS);
if (!sheet) return { mytasks: 0, report: 0 };
const data = sheet.getDataRange().getValues();

let mytasks = 0;
let report = 0;
for (let i = 1; i < data.length; i++) {
const row = data[i];
if (String(row[2]).trim() !== empId) continue;

const rowDate = normalizeDateStr_(row[1]);
const completed = row[6] === 'مكتملة';
const answered = completed || String(row[15] || '').trim() === 'نعم';

if (rowDate === today && !completed) {
const seeded = String(row[7] || '').trim() === 'نظام تلقائي';
if (!(isSupervisor && seeded)) mytasks++;
}
if (windowDays[rowDate] && !answered) report++;
}

return { mytasks: mytasks, report: report };
}

function renderHubBadgesPage_(empId) {
let counts = { mytasks: 0, report: 0 };
try {
counts = getHubBadgeCounts_(empId);
} catch (err) {}
return renderPostMessagePage_({
type: 'hubBadges',
mytasks: counts.mytasks,
report: counts.report
});
}

function renderAttendanceEmbedStatusPage_(empId) {
let hasOpen = false;
try {
const st = getMyOpenStatus(empId);
hasOpen = !!(st && st.hasOpen);
} catch (err) {}
return renderPostMessagePage_({ type: 'attendanceStatus', hasOpen: hasOpen });
}

/**
* نسخة "embed" من نتيجة تسجيل حضور/انصراف: تُحمَّل داخل نفس iframe المخفي
* بعد إرسال الإحداثيات (اللي تم التقاطها مسبقًا في الصفحة الأصل top-level)،
* وترجع النتيجة + الحالة الجديدة عبر postMessage بدل صفحة تأكيد مرئية.
*/
function renderAttendanceEmbedResultPage_(result, empId) {
let hasOpen = false;
try {
const st = getMyOpenStatus(empId);
hasOpen = !!(st && st.hasOpen);
} catch (err) {}
const ok = !!(result && result.ok);
const message = (result && result.message) ? String(result.message) : (ok ? 'تم بنجاح' : 'حدث خطأ غير متوقع');
return renderPostMessagePage_({ type: 'attendanceResult', ok: ok, message: message, hasOpen: hasOpen });
}

// رمز الدخول المفتوح لصفحة إدارة المهام — يجب أن يطابق ما في AdminTasks.html
var ADMIN_PAGE_OPEN_TOKEN_ = 'AUTO_SUPERVISOR';

function getActorRoleByToken_(token) {
token = String(token || '').trim();
if (!token) return null;
const props = PropertiesService.getScriptProperties();
const adminToken = props.getProperty('ADMIN_TOKEN');
const supervisorToken = props.getProperty('SUPERVISOR_TOKEN');
if (adminToken && token === adminToken) return 'المدير';
if (supervisorToken && token === supervisorToken) return getSupervisorName_();
// صفحة إدارة المهام تدخل بلا رمز سري (قرار متفق عليه). هذا الثابت مكتوب
// صراحةً في AdminTasks.html ويُعامَل كدخول المشرف. ليس سرًا — من يفتح مصدر
// الصفحة يراه، والحماية هنا هي سرية الرابط لا أكثر.
if (token === ADMIN_PAGE_OPEN_TOKEN_) return getSupervisorName_();
return null;
}

function setupTasksSystem() {
const ss = SpreadsheetApp.getActiveSpreadsheet();

const tasksSheet = ss.getSheetByName(SHEET_TASKS);
if (!tasksSheet) {
const sheet = ss.insertSheet(SHEET_TASKS);
sheet.appendRow(['معرف المهمة', 'التاريخ', 'معرف الموظف', 'اسم الموظف', 'نص المهمة', 'متكررة؟', 'الحالة', 'أضيفت بواسطة', 'وقت الإضافة', 'وقت الإنجاز', 'ملاحظات', 'نوع الإدخال', 'القيمة المدخلة', 'مقروءة؟', 'الأولوية', 'أُجيب عليها في التقرير؟']);
sheet.setFrozenRows(1);
Logger.log('تم إنشاء ورقة: ' + SHEET_TASKS);
} else {
ensureHeaders_(tasksSheet, ['معرف المهمة', 'التاريخ', 'معرف الموظف', 'اسم الموظف', 'نص المهمة', 'متكررة؟', 'الحالة', 'أضيفت بواسطة', 'وقت الإضافة', 'وقت الإنجاز', 'ملاحظات', 'نوع الإدخال', 'القيمة المدخلة', 'مقروءة؟', 'الأولوية', 'أُجيب عليها في التقرير؟']);
Logger.log('ورقة ' + SHEET_TASKS + ' جاهزة (تم التحقق من كل الأعمدة)');
}

const templateSheet = ss.getSheetByName(SHEET_TASKS_TEMPLATE);
if (!templateSheet) {
const sheet = ss.insertSheet(SHEET_TASKS_TEMPLATE);
sheet.appendRow(['معرف الموظف', 'اسم الموظف', 'نص المهمة', 'نشط؟', 'نوع الإدخال', 'الأولوية']);
sheet.setFrozenRows(1);
Logger.log('تم إنشاء ورقة: ' + SHEET_TASKS_TEMPLATE);
} else {
ensureHeaders_(templateSheet, ['معرف الموظف', 'اسم الموظف', 'نص المهمة', 'نشط؟', 'نوع الإدخال', 'الأولوية']);
Logger.log('ورقة ' + SHEET_TASKS_TEMPLATE + ' جاهزة (تم التحقق من كل الأعمدة)');
}

const props = PropertiesService.getScriptProperties();
if (!props.getProperty('ADMIN_TOKEN')) {
const token = Utilities.getUuid().replace(/-/g, '');
props.setProperty('ADMIN_TOKEN', token);
Logger.log('=== احفظ هذا الرمز الآن (رمز المدير) - لن يظهر تلقائيًا مرة أخرى ===');
Logger.log('ADMIN_TOKEN: ' + token);
} else {
Logger.log('ADMIN_TOKEN موجود مسبقًا. لعرضه نفّذ الدالة showAdminToken أدناه من محرر Apps Script.');
}

if (!props.getProperty('SUPERVISOR_TOKEN')) {
const token2 = Utilities.getUuid().replace(/-/g, '');
props.setProperty('SUPERVISOR_TOKEN', token2);
Logger.log('=== احفظ هذا الرمز الآن (رمز المشرف) - لن يظهر تلقائيًا مرة أخرى ===');
Logger.log('SUPERVISOR_TOKEN: ' + token2);
} else {
Logger.log('SUPERVISOR_TOKEN موجود مسبقًا. لعرضه نفّذ الدالة showSupervisorToken أدناه من محرر Apps Script.');
}

Logger.log('تم إعداد نظام المهام بنجاح.');
}

function ensureHeaders_(sheet, requiredHeaders) {
const lastCol = Math.max(sheet.getLastColumn(), 1);
const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
let nextCol = lastCol;

requiredHeaders.forEach(function (h) {
if (currentHeaders.indexOf(h) === -1) {
nextCol += 1;
sheet.getRange(1, nextCol).setValue(h);
currentHeaders.push(h);
Logger.log('تمت إضافة عمود "' + h + '" لورقة ' + sheet.getName());
}
});
}

function showAdminToken() {
const token = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN');
Logger.log('ADMIN_TOKEN: ' + (token || 'غير موجود - نفّذ setupTasksSystem أولاً'));
}

function showSupervisorToken() {
const token = PropertiesService.getScriptProperties().getProperty('SUPERVISOR_TOKEN');
Logger.log('SUPERVISOR_TOKEN: ' + (token || 'غير موجود - نفّذ setupTasksSystem أولاً'));
}

function seedRecurringTasksForToday_(empId, empName) {
const today = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
seedRecurringTasksForDate_(empId, empName, today);
}

function seedRecurringTasksForDate_(empId, empName, dateStr) {
// تسريع: إذا زُرع هذا اليوم لهذا الموظف قبل دقائق فلا حاجة لقفل ولا لقراءة الأوراق.
// (الاستطلاع الدوري للشارات كان يكرر هذا الزرع كل مرة فيُبطئ كل الصفحات.)
const seedKey = 'seeded_' + String(empId).trim() + '_' + String(dateStr).trim();
try {
if (CacheService.getScriptCache().get(seedKey)) return;
} catch (e) {}
const lock = LockService.getScriptLock();
try {
lock.waitLock(15000);
} catch (e) {
}

try {
const seeded = seedRecurringTasksForDate_impl_(empId, empName, dateStr);
if (seeded === true) {
try { CacheService.getScriptCache().put(seedKey, '1', 300); } catch (e) {}
}
} finally {
try { lock.releaseLock(); } catch (e) {}
}
}

/**
* هل للموظف سجل حضور في هذا التاريخ؟ هذه هي البوابة الوحيدة للزرع:
* لا مهام في يوم لم يحضر فيه الموظف. تسجيل الحضور هو ما يفتح يوم العمل،
* فلا تُزرع مهام في الإجازات ولا في جمعة ليست دوره، ولا تظهر في تقرير
* المدير مهام "غير منجزة" لموظف أصلًا لم يكن على رأس عمله.
*/
function hasAttendanceForDate_(empId, dateStr) {
try {
const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
if (!sh) return false;
const lastRow = sh.getLastRow();
if (lastRow < 2) return false;
const data = sh.getRange(2, 1, lastRow - 1, 3).getValues();
for (let i = data.length - 1; i >= 0; i--) {
if (String(data[i][2]).trim() === String(empId).trim() &&
normalizeDateStr_(data[i][1]) === String(dateStr).trim()) return true;
}
return false;
} catch (e) {
return false;
}
}

/**
* رقم عمود "المالك الأصلي" (يُنشأ تلقائيًا إن لم يكن موجودًا).
* سبب وجوده: الزرع كان يسأل "هل نص المهمة موجود لهذا الموظف اليوم؟" - وهو
* سؤال خاطئ بعد نقل مهمة لموظف آخر: النص يختفي من عند صاحبها الأصلي فيعيد
* الزارع إنشاءها، فترتد المهمة ويُلغى النقل عمليًا. السؤال الصحيح هو "هل
* زُرعت هذه المهمة لهذا الموظف اليوم من قبل؟" وهذا العمود هو ما يجيبه،
* لأنه يُكتب مرة واحدة عند الزرع ولا يتغير مع أي نقل لاحق.
*/
function getOriginColIndex_(tasksSheet) {
const HEADER = 'المالك الأصلي';
const lastCol = Math.max(tasksSheet.getLastColumn(), 1);
const headers = tasksSheet.getRange(1, 1, 1, lastCol).getValues()[0]
.map(function (h) { return String(h).trim(); });
const idx = headers.indexOf(HEADER);
if (idx !== -1) return idx;
tasksSheet.getRange(1, lastCol + 1).setValue(HEADER);
return lastCol;
}

/**
 * نسخة مُخزَّنة من getEmployeeById_ لعمر التنفيذ الواحد فقط.
 * سببها: getRecentReportDays تستدعي الزرع 7 مرات، والزرع صار يحتاج نوع الدوام،
 * فبدون تخزين تصير 7 قراءات إضافية لورقة الموظفين في طلب واحد.
 * متغيرات Apps Script العامة تُصفَّر مع كل تنفيذ، فلا خطر من بيانات قديمة.
 */
var EMP_CACHE_ = null;
function getEmployeesCached_() {
if (!EMP_CACHE_) {
EMP_CACHE_ = { list: getAllEmployees_(), byId: {} };
EMP_CACHE_.list.forEach(function (e) { EMP_CACHE_.byId[String(e.id)] = e; });
}
return EMP_CACHE_;
}

function getEmployeeByIdCached_(id) {
return getEmployeesCached_().byId[String(id)] || null;
}

/**
 * اسم المشرف الحالي يُشتق من نوع الدوام "مرن" لا من اسم مكتوب في الكود،
 * فلا ينكسر شيء عند تغيّر المشرف (كما حصل عند استبدال عباس بمجيد).
 */
function getSupervisorName_() {
const sup = getEmployeesCached_().list.filter(function (e) {
return e.active && String(e.shiftType).trim() === 'مرن';
})[0];
return sup ? String(sup.name).trim() : 'المشرف';
}

function seedRecurringTasksForDate_impl_(empId, empName, dateStr) {
const ss = SpreadsheetApp.getActiveSpreadsheet();
const tasksSheet = ss.getSheetByName(SHEET_TASKS);
const templateSheet = ss.getSheetByName(SHEET_TASKS_TEMPLATE);
if (!tasksSheet || !templateSheet) return false;

const targetDate = String(dateStr).trim();

// البوابة: لا زرع بلا حضور مسجّل في ذلك اليوم.
// يُستثنى منها الموظف المرن (المشرف): دوامه غير مرتبط بتسجيل حضور يومي،
// ومهامه المتكررة مخفية أصلًا من تبويب "مهامي" (isSupervisor في MyTasks)،
// فربط زرعها بالحضور كان يُخفيها من التقرير اليومي أيضًا فتختفي كليًا.
const seedEmp = getEmployeeByIdCached_(empId);
const isFlexibleSeed = !!(seedEmp && String(seedEmp.shiftType).trim() === 'مرن');
if (!isFlexibleSeed && !hasAttendanceForDate_(empId, targetDate)) return false;

const originCol = getOriginColIndex_(tasksSheet);
const existing = tasksSheet.getDataRange().getValues();

const existingTextsForDate = {};
for (let i = 1; i < existing.length; i++) {
const row = existing[i];
if (normalizeDateStr_(row[1]) !== targetDate) continue;
// المالك الأصلي إن وُجد، وإلا المالك الحالي (توافق مع الصفوف القديمة)
const rowOrigin = String(row[originCol] || '').trim();
const owner = rowOrigin || String(row[2]).trim();
if (owner === String(empId).trim()) existingTextsForDate[String(row[4]).trim()] = true;
}

const templates = templateSheet.getDataRange().getValues();
const now = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm');
const rowsToAdd = [];

for (let i = 1; i < templates.length; i++) {
const row = templates[i];
const tEmpId = String(row[0]).trim();
const tActive = row[3] === true || String(row[3]).trim() === 'نعم';
const tTask = String(row[2]).trim();
const rawSeedType = String(row[4] || '').trim();
const tInputType = (rawSeedType === 'عدد' || rawSeedType === 'نص') ? rawSeedType : 'علامة';
const rawPriority = String(row[5] || '').trim();
const tPriority = (rawPriority === 'عاجلة') ? 'عاجلة' : 'عادية';
if (tEmpId === String(empId) && tActive && tTask && !existingTextsForDate[tTask]) {
rowsToAdd.push([
Utilities.getUuid(), targetDate, empId, empName, tTask,
'نعم', 'غير مكتملة', 'نظام تلقائي', now, '', '', tInputType, '', 'نعم', tPriority
]);
}
}

if (rowsToAdd.length > 0) {
const startRow = tasksSheet.getLastRow() + 1;
tasksSheet.getRange(startRow, 1, rowsToAdd.length, 15).setValues(rowsToAdd);
tasksSheet.getRange(startRow, originCol + 1, rowsToAdd.length, 1)
.setValues(rowsToAdd.map(function () { return [String(empId)]; }));
}
return true;
}

function getEmployeeTasksResponse(empId, dateStr) {
empId = empId ? String(empId).trim() : '';
if (!empId) return { success: false, error: 'معرف الموظف مفقود' };

const emp = getEmployeeById_(empId);
if (!emp || emp.active !== true) return { success: false, error: 'موظف غير صالح أو غير نشط' };

const targetDate = (dateStr && String(dateStr).trim())
? String(dateStr).trim()
: Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');

seedRecurringTasksForDate_(empId, emp.name, targetDate);

const ss = SpreadsheetApp.getActiveSpreadsheet();
const sheet = ss.getSheetByName(SHEET_TASKS);
const data = sheet.getDataRange().getValues();
const photoOptionalByText = getTemplatePhotoFlagsByText_(empId);

const tasks = [];
for (let i = 1; i < data.length; i++) {
const row = data[i];
const rowDate = normalizeDateStr_(row[1]);
const rowEmpId = String(row[2]).trim();
if (rowDate === targetDate && rowEmpId === empId) {
const taskText = String(row[4] || '').trim();
tasks.push({
id: row[0],
task: row[4],
recurring: row[5] === 'نعم',
completed: row[6] === 'مكتملة',
answered: String(row[15] || '').trim() === 'نعم',
addedBy: row[7],
notes: row[10] || '',
inputType: (row[11] === 'عدد' || row[11] === 'نص') ? row[11] : 'علامة',
value: row[12] === undefined || row[12] === null ? '' : String(row[12]),
priority: (String(row[14] || '').trim() === 'عاجلة') ? 'عاجلة' : 'عادية',
photoOptional: !!photoOptionalByText[taskText],
photoUrl: row[17] || ''
});
}
}

return { success: true, employeeName: emp.name, tasks: tasks, date: targetDate };
}

/**
* يقرأ عمود "صورة اختيارية؟" (إن وُجد) من قالب المهام المتكررة لموظف معيّن،
* ويُرجعها كخريطة نص-المهمة -> صورة اختيارية؟ (لمطابقتها مع مهام اليوم).
* إضافة جديدة تدعم ميزة إرفاق الصور - لا تُعدّل أي سلوك سابق.
*/
function getTemplatePhotoFlagsByText_(empId) {
const out = {};
const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TASKS_TEMPLATE);
if (!sh || sh.getLastRow() < 2) return out;
const lastCol = sh.getLastColumn();
if (lastCol < 7) return out;
const data = sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues();
data.forEach(function (r) {
if (String(r[0]).trim() === String(empId)) {
out[String(r[2]).trim()] = String(r[6] || '').trim() === 'نعم';
}
});
return out;
}

/**
* رفع صورة مرفقة بمهمة/فقرة تقرير (اختيارية) - تُخزَّن في Drive بمجلد
* مخصص وتُحفظ رابطها في عمود "رابط الصورة" بنفس صف المهمة. إضافة جديدة
* بالكامل - لا تُعدّل أي دالة موجودة.
*/
function attachTaskPhoto(empId, taskId, base64Data, mimeType) {
empId = String(empId || '').trim();
taskId = String(taskId || '').trim();
if (!empId || !taskId || !base64Data) return { success: false, error: 'بيانات ناقصة' };

const emp = getEmployeeById_(empId);
if (!emp) return { success: false, error: 'موظف غير صالح' };

const ss = SpreadsheetApp.getActiveSpreadsheet();
const sheet = ss.getSheetByName(SHEET_TASKS);
const data = sheet.getDataRange().getValues();
const idx = findTaskRowIndex_(data, taskId, empId);
if (idx === -1) return { success: false, error: 'المهمة غير موجودة' };

const lastCol = Math.max(sheet.getLastColumn(), 15);
if (lastCol < 17) {
ensureHeaders_(sheet, ['صورة اختيارية؟', 'رابط الصورة']);
}

try {
const folderName = 'صور تقارير كرم للسفر والنقل';
const folders = DriveApp.getFoldersByName(folderName);
const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

const contentType = mimeType || 'image/jpeg';
const bytes = Utilities.base64Decode(base64Data);
const blob = Utilities.newBlob(bytes, contentType, taskId + '.jpg');
const file = folder.createFile(blob);
file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
const url = 'https://drive.google.com/uc?export=view&id=' + file.getId();

sheet.getRange(idx + 1, 18).setValue(url);
return { success: true, url: url };
} catch (err) {
return { success: false, error: 'تعذّر رفع الصورة: ' + String(err) };
}
}

function getDayTaskStats_(empId, dateStr) {
const ss = SpreadsheetApp.getActiveSpreadsheet();
const sheet = ss.getSheetByName(SHEET_TASKS);
const data = sheet.getDataRange().getValues();
let total = 0, answered = 0;
for (let i = 1; i < data.length; i++) {
const row = data[i];
if (normalizeDateStr_(row[1]) === dateStr && String(row[2]).trim() === String(empId)) {
total++;
const isAnswered = row[6] === 'مكتملة' || String(row[15] || '').trim() === 'نعم';
if (isAnswered) answered++;
}
}
return { total: total, completed: answered };
}

// نافذة الاستكمال: اليوم وأمس فقط (48 ساعة). أي يوم أقدم يسقط نهائيًا من قائمة
// الموظف ولا يعود قابلًا للاستكمال — بياناته تبقى في الشيت ويراها المدير كما هي.
// القيمة هنا هي عدد الأيام التقويمية المعروضة شاملةً اليوم الحالي.
var REPORT_WINDOW_DAYS_ = 2;

// أقدم تاريخ يُسمح بظهوره في قائمة "الأيام المطلوب استكمالها" في التقرير اليومي
// أي يوم أقدم من هذا التاريخ (يوم الاختبار وما قبله) يختفي تلقائيًا من القائمة بدون حذف بياناته الفعلية
// غيّر هذا التاريخ لاحقًا فقط لو احتجت تحريك نقطة البداية من جديد
var MIN_REPORT_DATE_ = '2026-08-07';

function getRecentReportDays(empId, daysBack) {
empId = empId ? String(empId).trim() : '';
const emp = getEmployeeById_(empId);
if (!emp) return { success: false, error: 'موظف غير صالح' };

// النافذة تُفرض في الخادم لا في الصفحة: أي استدعاء بعدد أكبر يُقصَّ هنا،
// فلا يمكن لأي واجهة أن تفتح أيامًا خارج المهلة.
const requested = daysBack ? parseInt(daysBack, 10) : REPORT_WINDOW_DAYS_;
const n = Math.max(1, Math.min(requested, REPORT_WINDOW_DAYS_));
const days = [];
const now = new Date();

for (let i = 0; i < n; i++) {
const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
const dateStr = Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd');
if (dateStr < MIN_REPORT_DATE_) continue;
seedRecurringTasksForDate_(empId, emp.name, dateStr);
const stats = getDayTaskStats_(empId, dateStr);
days.push({
date: dateStr,
total: stats.total,
completed: stats.completed,
isComplete: stats.total > 0 && stats.completed === stats.total
});
}

return { success: true, days: days };
}

function toggleTaskResponse_(e) {
const empId = e.parameter.emp ? String(e.parameter.emp).trim() : '';
const taskId = e.parameter.id ? String(e.parameter.id).trim() : '';
if (!empId || !taskId) return { success: false, error: 'بيانات ناقصة' };

const ss = SpreadsheetApp.getActiveSpreadsheet();
const sheet = ss.getSheetByName(SHEET_TASKS);
const data = sheet.getDataRange().getValues();

for (let i = 1; i < data.length; i++) {
if (String(data[i][0]).trim() === taskId && String(data[i][2]).trim() === empId) {
const currentStatus = data[i][6];
const newStatus = currentStatus === 'مكتملة' ? 'غير مكتملة' : 'مكتملة';
const doneTime = newStatus === 'مكتملة' ? Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm') : '';
sheet.getRange(i + 1, 7).setValue(newStatus);
sheet.getRange(i + 1, 10).setValue(doneTime);
if (newStatus === 'غير مكتملة') {
sheet.getRange(i + 1, 13).setValue('');
}
return { success: true, id: taskId, completed: newStatus === 'مكتملة' };
}
}
return { success: false, error: 'المهمة غير موجودة' };
}

function completeTaskWithValueResponse_(e) {
const empId = e.parameter.emp ? String(e.parameter.emp).trim() : '';
const taskId = e.parameter.id ? String(e.parameter.id).trim() : '';
const value = e.parameter.value !== undefined ? String(e.parameter.value).trim() : '';
if (!empId || !taskId || value === '') return { success: false, error: 'بيانات ناقصة' };
if (isNaN(Number(value))) return { success: false, error: 'القيمة يجب أن تكون رقمًا' };

const ss = SpreadsheetApp.getActiveSpreadsheet();
const sheet = ss.getSheetByName(SHEET_TASKS);
const data = sheet.getDataRange().getValues();

for (let i = 1; i < data.length; i++) {
if (String(data[i][0]).trim() === taskId && String(data[i][2]).trim() === empId) {
const doneTime = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm');
sheet.getRange(i + 1, 7).setValue('مكتملة');
sheet.getRange(i + 1, 10).setValue(doneTime);
sheet.getRange(i + 1, 13).setValue(Number(value));
return { success: true, id: taskId, completed: true, value: value };
}
}
return { success: false, error: 'المهمة غير موجودة' };
}

function addTaskResponse_(e) {
const empId = e.parameter.emp ? String(e.parameter.emp).trim() : '';
const taskText = e.parameter.task ? String(e.parameter.task).trim() : '';
const token = e.parameter.token ? String(e.parameter.token).trim() : '';

if (!empId || !taskText) return { success: false, error: 'بيانات ناقصة' };

const emp = getEmployeeById_(empId);
if (!emp || emp.active !== true) return { success: false, error: 'موظف غير صالح أو غير نشط' };

let addedBy = emp.name;
if (token) {
const role = getActorRoleByToken_(token);
if (!role) return { success: false, error: 'رمز غير صحيح' };
addedBy = role;
}

return addTaskRow_(empId, emp.name, taskText, addedBy, 'عادية');
}

function addTaskFromAdmin(empId, taskText, role, token, priority) {
empId = String(empId).trim();
taskText = String(taskText).trim();
token = String(token || '').trim();
const finalPriority = (String(priority || '').trim() === 'عاجلة') ? 'عاجلة' : 'عادية';

if (!empId || !taskText) return { success: false, error: 'بيانات ناقصة' };

const actorRole = getActorRoleByToken_(token);
if (!actorRole) return { success: false, error: 'رمز غير صحيح' };

const emp = getEmployeeById_(empId);
if (!emp || emp.active !== true) return { success: false, error: 'موظف غير صالح أو غير نشط' };

return addTaskRow_(empId, emp.name, taskText, actorRole, finalPriority);
}

function addTaskRow_(empId, empName, taskText, addedBy, priority) {
priority = (priority === 'عاجلة') ? 'عاجلة' : 'عادية';
const ss = SpreadsheetApp.getActiveSpreadsheet();
const sheet = ss.getSheetByName(SHEET_TASKS);
const today = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
const now = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm');
const id = Utilities.getUuid();

sheet.appendRow([id, today, empId, empName, taskText, 'لا', 'غير مكتملة', addedBy, now, '', '', 'علامة', '', 'نعم', priority]);
SpreadsheetApp.flush();

return { success: true, id: id };
}

function getActiveEmployeesForAdmin(token) {
const role = getActorRoleByToken_(token);
if (!role) {
throw new Error('رمز غير صحيح');
}

const ss = SpreadsheetApp.getActiveSpreadsheet();
const sheet = ss.getSheetByName(SHEET_EMPLOYEES);
const data = sheet.getDataRange().getValues();
const result = [];

for (let i = 1; i < data.length; i++) {
const row = data[i];
if (row[0]) {
result.push({ id: String(row[0]).trim(), name: String(row[1]).trim() });
}
}
return result;
}

function appendNoteText_(existingNotes, newNote, actor) {
const now = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm');
const line = '[' + now + ' - ' + actor + '] ' + newNote;
if (existingNotes && String(existingNotes).trim()) {
return existingNotes + '\n' + line;
}
return line;
}

function findTaskRowIndex_(data, taskId, empId) {
for (let i = 1; i < data.length; i++) {
if (String(data[i][0]).trim() === taskId && String(data[i][2]).trim() === String(empId)) {
return i;
}
}
return -1;
}

function postponeTaskResponse_(e) {
const empId = e.parameter.emp ? String(e.parameter.emp).trim() : '';
const taskId = e.parameter.id ? String(e.parameter.id).trim() : '';
if (!empId || !taskId) return { success: false, error: 'بيانات ناقصة' };

const emp = getEmployeeById_(empId);
if (!emp) return { success: false, error: 'موظف غير صالح' };

const ss = SpreadsheetApp.getActiveSpreadsheet();
const sheet = ss.getSheetByName(SHEET_TASKS);
const data = sheet.getDataRange().getValues();
const idx = findTaskRowIndex_(data, taskId, empId);
if (idx === -1) return { success: false, error: 'المهمة غير موجودة' };

const currentDateStr = normalizeDateStr_(data[idx][1]);

// تاريخ مطلوب من الواجهة (قائمة النقاط الثلاث). بلا معامل يبقى السلوك
// القديم كما هو: ترحيل يوم واحد - حتى لا ينكسر أي نداء قائم.
let nextDayStr;
const wanted = e.parameter.date ? String(e.parameter.date).trim() : '';
if (wanted) {
if (!/^\d{4}-\d{2}-\d{2}$/.test(wanted)) return { success: false, error: 'صيغة التاريخ غير صحيحة' };
const todayStr = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
// المقارنة النصية تكفي وتصح دائمًا مع صيغة yyyy-MM-dd
if (wanted <= todayStr) return { success: false, error: 'اختر تاريخًا بعد اليوم' };
if (wanted === currentDateStr) return { success: false, error: 'المهمة مؤرخة بهذا اليوم أصلاً' };
nextDayStr = wanted;
} else {
const nextDay = new Date(currentDateStr + 'T00:00:00');
nextDay.setDate(nextDay.getDate() + 1);
nextDayStr = Utilities.formatDate(nextDay, TIMEZONE, 'yyyy-MM-dd');
}

const currentNotes = data[idx][10];
const newNotes = appendNoteText_(currentNotes, 'تم تأجيل المهمة من ' + currentDateStr + ' إلى ' + nextDayStr, emp.name);

const row = idx + 1;
sheet.getRange(row, 2).setValue(nextDayStr);
sheet.getRange(row, 11).setValue(newNotes);

return { success: true, id: taskId, newDate: nextDayStr };
}

function transferTaskResponse_(e) {
const empId = e.parameter.emp ? String(e.parameter.emp).trim() : '';
const taskId = e.parameter.id ? String(e.parameter.id).trim() : '';
const targetId = e.parameter.target ? String(e.parameter.target).trim() : '';
if (!empId || !taskId || !targetId) return { success: false, error: 'بيانات ناقصة' };
if (targetId === empId) return { success: false, error: 'لا يمكن نقل المهمة لنفس الموظف' };

const emp = getEmployeeById_(empId);
const targetEmp = getEmployeeById_(targetId);
if (!emp) return { success: false, error: 'موظف غير صالح' };
if (!targetEmp || targetEmp.active !== true) return { success: false, error: 'الموظف المستهدف غير صالح أو غير نشط' };

const ss = SpreadsheetApp.getActiveSpreadsheet();
const sheet = ss.getSheetByName(SHEET_TASKS);
const data = sheet.getDataRange().getValues();
const idx = findTaskRowIndex_(data, taskId, empId);
if (idx === -1) return { success: false, error: 'المهمة غير موجودة' };

const currentNotes = data[idx][10];
const newNotes = appendNoteText_(currentNotes, 'تم نقل المهمة من ' + emp.name + ' إلى ' + targetEmp.name, emp.name);

const row = idx + 1;
sheet.getRange(row, 3).setValue(targetId);
sheet.getRange(row, 4).setValue(targetEmp.name);
sheet.getRange(row, 11).setValue(newNotes);

return { success: true, id: taskId, newEmpId: targetId, newEmpName: targetEmp.name };
}

function addNoteResponse_(e) {
const empId = e.parameter.emp ? String(e.parameter.emp).trim() : '';
const taskId = e.parameter.id ? String(e.parameter.id).trim() : '';
const noteText = e.parameter.note ? String(e.parameter.note).trim() : '';
if (!empId || !taskId || !noteText) return { success: false, error: 'بيانات ناقصة' };

const emp = getEmployeeById_(empId);
if (!emp) return { success: false, error: 'موظف غير صالح' };

const ss = SpreadsheetApp.getActiveSpreadsheet();
const sheet = ss.getSheetByName(SHEET_TASKS);
const data = sheet.getDataRange().getValues();
const idx = findTaskRowIndex_(data, taskId, empId);
if (idx === -1) return { success: false, error: 'المهمة غير موجودة' };

const currentNotes = data[idx][10];
const newNotes = appendNoteText_(currentNotes, noteText, emp.name);

sheet.getRange(idx + 1, 11).setValue(newNotes);

return { success: true, id: taskId, notes: newNotes };
}

function getOnDutyResponse_(e) {
const candidatesParam = e.parameter.candidates ? String(e.parameter.candidates).trim() : '';
if (!candidatesParam) return { success: false, error: 'قائمة المرشحين مفقودة' };

const candidateIds = candidatesParam.split(',').map(function (s) { return s.trim(); }).filter(Boolean);

let best = null;
for (let i = 0; i < candidateIds.length; i++) {
const empId = candidateIds[i];
let status;
try {
status = getMyOpenStatus(empId);
} catch (err) {
continue;
}
if (status && status.hasOpen) {
const checkInTime = new Date(status.checkInTime).getTime();
if (!best || checkInTime > best.checkInTime) {
best = { empId: empId, checkInTime: checkInTime };
}
}
}

if (!best) return { success: true, onDutyEmpId: null, onDutyEmpName: null };

const emp = getEmployeeById_(best.empId);
return { success: true, onDutyEmpId: best.empId, onDutyEmpName: emp ? emp.name : '' };
}

function getServerToday() {
return Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
}

function getDashboardData(token, dateStr) {
try {
const role = getActorRoleByToken_(token);
if (!role) {
return { success: false, error: 'رمز غير صحيح' };
}

const targetDate = (dateStr && String(dateStr).trim())
? String(dateStr).trim()
: Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');

const ss = SpreadsheetApp.getActiveSpreadsheet();
const empSheet = ss.getSheetByName(SHEET_EMPLOYEES);
if (!empSheet) return { success: false, error: 'ورقة "' + SHEET_EMPLOYEES + '" غير موجودة' };
const empData = empSheet.getDataRange().getValues();

const employees = [];
const empById = {};
for (let i = 1; i < empData.length; i++) {
const row = empData[i];
if (row[0]) {
const empName = String(row[1]).trim();
if (empName === role) continue;
const rec = { id: String(row[0]).trim(), name: empName, tasks: [], completed: 0, total: 0 };
employees.push(rec);
empById[rec.id] = rec;
}
}

const tasksSheet = ss.getSheetByName(SHEET_TASKS);
if (!tasksSheet) return { success: false, error: 'ورقة "' + SHEET_TASKS + '" غير موجودة' };
const data = tasksSheet.getDataRange().getValues();

for (let i = 1; i < data.length; i++) {
const row = data[i];
const rowDate = normalizeDateStr_(row[1]);
if (rowDate !== targetDate) continue;

const empId = String(row[2]).trim();
const bucket = empById[empId];
if (!bucket) continue;

const task = {
id: row[0],
task: row[4],
recurring: row[5] === 'نعم',
completed: row[6] === 'مكتملة',
addedBy: row[7],
doneTime: row[9] || '',
notes: row[10] || '',
inputType: (row[11] === 'عدد' || row[11] === 'نص') ? row[11] : 'علامة',
value: row[12] === undefined || row[12] === null ? '' : String(row[12]),
priority: (String(row[14] || '').trim() === 'عاجلة') ? 'عاجلة' : 'عادية'
};

bucket.tasks.push(task);
bucket.total += 1;
if (task.completed) bucket.completed += 1;
}

return JSON.stringify({ success: true, date: targetDate, employees: employees });
} catch (err) {
return JSON.stringify({ success: false, error: 'خطأ داخلي: ' + err.message });
}
}

function getEmployeesListResponse_(e) {
const empId = e.parameter.emp ? String(e.parameter.emp).trim() : '';
const requester = getEmployeeById_(empId);
if (!requester) return { success: false, error: 'موظف غير صالح' };

const ss = SpreadsheetApp.getActiveSpreadsheet();
const sheet = ss.getSheetByName(SHEET_EMPLOYEES);
const data = sheet.getDataRange().getValues();
const result = [];

for (let i = 1; i < data.length; i++) {
const row = data[i];
if (row[0]) {
result.push({ id: String(row[0]).trim(), name: String(row[1]).trim() });
}
}
return { success: true, employees: result };
}

function renderDailyReportPage_(e) {
const empId = e.parameter.emp ? String(e.parameter.emp).trim() : '';
const emp = getEmployeeById_(empId);

if (!emp || emp.active !== true) {
return HtmlService.createHtmlOutput(
'<div style="font-family:sans-serif;text-align:center;margin-top:50px;direction:rtl">' +
'<h2>رابط غير صحيح</h2><p>يرجى استخدام الرابط الخاص بك</p></div>'
);
}

const template = HtmlService.createTemplateFromFile('DailyReport');
template.empId = empId;
template.empName = emp.name;

return template.evaluate()
.setTitle('التقرير اليومي - ' + emp.name)
.addMetaTag('viewport', 'width=device-width, initial-scale=1, user-scalable=no')
.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}



/**
* الهَب الحقيقي صار صفحة hub.html المستضافة على GitHub Pages (top-level)،
* لأن صلاحية الموقع الجغرافي لا تُمرَّر داخل إطار جوجل الإجباري. هذه الدالة
* لم تعد ترسم واجهة - وظيفتها الوحيدة تحويل أي رابط قديم (?emp=N أو
* ?action=hub) إلى العنوان الصحيح، حتى لا ينكسر أي رابط محفوظ عند أحد.
*/
function renderHubPage_(e) {
const empId = e.parameter.emp ? String(e.parameter.emp).trim() : '';
const target = HUB_PAGE_URL_ + (empId ? ('?emp=' + encodeURIComponent(empId)) : '');
const t = JSON.stringify(target);
const html =
'<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8">' +
// base target="_top" هو النمط الموثّق من جوجل للخروج من إطار Apps Script
'<base target="_top">' +
'<meta name="viewport" content="width=device-width, initial-scale=1">' +
'<style>body{font-family:Tahoma,sans-serif;text-align:center;padding:48px 20px;background:#f4f6f8;color:#333}' +
'a.go{display:block;max-width:320px;margin:18px auto;padding:16px 24px;background:#1a73e8;color:#fff;' +
'border-radius:12px;text-decoration:none;font-weight:bold}' +
'a.alt{display:inline-block;margin-top:6px;color:#1a73e8;font-size:13px}' +
'.url{margin-top:22px;font-size:12px;color:#888;word-break:break-all;direction:ltr}</style></head><body>' +
'<div>هذا رابط قديم. اضغط للانتقال إلى النظام:</div>' +
'<a class="go" href="' + target + '" target="_top">افتح النظام</a>' +
'<a class="alt" href="' + target + '" target="_blank" rel="noopener">أو افتحه في تبويب جديد</a>' +
'<div class="url">' + target + '</div>' +
// محاولة تلقائية للخروج للنافذة العليا. لا يوجد أي احتياطي داخل الإطار:
// تحميل hub.html داخل إطار جوجل يعيد مشكلة حجب صلاحية الموقع بالضبط.
'<script>try{top.location.replace(' + t + ');}catch(err){}<\/script>' +
'</body></html>';
return HtmlService.createHtmlOutput(html)
.setTitle('لوحة الموظف · ' + APP_VERSION)
.addMetaTag('viewport', 'width=device-width, initial-scale=1')
.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function renderMyTasksPage_(e) {
const empId = e.parameter.emp ? String(e.parameter.emp).trim() : '';
const emp = getEmployeeById_(empId);

if (!emp || emp.active !== true) {
return HtmlService.createHtmlOutput(
'<div style="font-family:sans-serif;text-align:center;margin-top:50px;direction:rtl">' +
'<h2>رابط غير صحيح</h2><p>يرجى استخدام الرابط الخاص بك</p></div>'
);
}

const template = HtmlService.createTemplateFromFile('MyTasks');
template.apiUrl = ScriptApp.getService().getUrl();
template.empId = empId;
// المشرف فقط هو من يُستثنى من عرض المهام المتكررة في هذا التبويب
// (تظهر له في تقريره اليومي)، أما الموظف العادي فيراها هنا.
template.isSupervisor = emp.shiftType === 'مرن';

return template.evaluate()
.setTitle('مهامي - ' + emp.name)
.addMetaTag('viewport', 'width=device-width, initial-scale=1, user-scalable=no')
.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function submitDailyReport(empId, answers) {
empId = String(empId).trim();
const emp = getEmployeeById_(empId);
if (!emp) return { success: false, error: 'موظف غير صالح' };
if (!answers || typeof answers !== 'object') return { success: false, error: 'لا توجد إجابات' };

const ss = SpreadsheetApp.getActiveSpreadsheet();
const sheet = ss.getSheetByName(SHEET_TASKS);
const data = sheet.getDataRange().getValues();
const now = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm');

let updated = 0;

for (let i = 1; i < data.length; i++) {
const rowId = String(data[i][0]).trim();
if (String(data[i][2]).trim() !== empId) continue;
if (!Object.prototype.hasOwnProperty.call(answers, rowId)) continue;

const ans = answers[rowId];
const row = i + 1;

if (ans.type === 'checkbox') {
sheet.getRange(row, 7).setValue(ans.done ? 'مكتملة' : 'غير مكتملة');
sheet.getRange(row, 10).setValue(ans.done ? now : '');
sheet.getRange(row, 16).setValue('نعم');
} else {
const val = String(ans.value == null ? '' : ans.value).trim();
if (val !== '') {
sheet.getRange(row, 7).setValue('مكتملة');
sheet.getRange(row, 10).setValue(now);
sheet.getRange(row, 13).setValue(val);
sheet.getRange(row, 16).setValue('نعم');
}
}

const noteText = ans.note ? String(ans.note).trim() : '';
if (noteText) {
const existingNotes = data[i][10];
const newNotes = appendNoteText_(existingNotes, noteText, emp.name);
sheet.getRange(row, 11).setValue(newNotes);
}

updated++;
}

return { success: true, updated: updated };
}

function addManagerComment(token, empId, taskId, commentText) {
const role = getActorRoleByToken_(token);
if (!role) {
return { success: false, error: 'رمز غير صحيح' };
}

empId = String(empId).trim();
taskId = String(taskId).trim();
commentText = String(commentText || '').trim();
if (!empId || !taskId || !commentText) return { success: false, error: 'بيانات ناقصة' };

const ss = SpreadsheetApp.getActiveSpreadsheet();
const sheet = ss.getSheetByName(SHEET_TASKS);
const data = sheet.getDataRange().getValues();
const idx = findTaskRowIndex_(data, taskId, empId);
if (idx === -1) return { success: false, error: 'المهمة غير موجودة' };

const currentNotes = data[idx][10];
const newNotes = appendNoteText_(currentNotes, commentText, role);
sheet.getRange(idx + 1, 11).setValue(newNotes);
sheet.getRange(idx + 1, 14).setValue('لا');

return { success: true, notes: newNotes };
}

function getUnreadCommentsCountResponse_(e) {
const empId = e.parameter.emp ? String(e.parameter.emp).trim() : '';
if (!empId) return { success: false, error: 'بيانات ناقصة' };

const ss = SpreadsheetApp.getActiveSpreadsheet();
const sheet = ss.getSheetByName(SHEET_TASKS);
const data = sheet.getDataRange().getValues();

let count = 0;
for (let i = 1; i < data.length; i++) {
const row = data[i];
if (String(row[2]).trim() === empId && String(row[13]).trim() === 'لا') {
count += 1;
}
}

return { success: true, count: count };
}

function markCommentsSeenResponse_(e) {
const empId = e.parameter.emp ? String(e.parameter.emp).trim() : '';
if (!empId) return { success: false, error: 'بيانات ناقصة' };

const ss = SpreadsheetApp.getActiveSpreadsheet();
const sheet = ss.getSheetByName(SHEET_TASKS);
const data = sheet.getDataRange().getValues();

let updated = 0;
for (let i = 1; i < data.length; i++) {
const row = data[i];
if (String(row[2]).trim() === empId && String(row[13]).trim() === 'لا') {
sheet.getRange(i + 1, 14).setValue('نعم');
updated += 1;
}
}

return { success: true, updated: updated };
}

function removeDuplicateTasksForDate_DANGEROUS(dateStr) {
const ss = SpreadsheetApp.getActiveSpreadsheet();
const sheet = ss.getSheetByName(SHEET_TASKS);
const data = sheet.getDataRange().getValues();
const targetDate = String(dateStr).trim();

const groups = {};
for (let i = 1; i < data.length; i++) {
const row = data[i];
if (normalizeDateStr_(row[1]) !== targetDate) continue;
const key = String(row[2]).trim() + '||' + String(row[4]).trim();
if (!groups[key]) groups[key] = [];
groups[key].push({ rowIndex: i + 1, row: row });
}

const rowsToDelete = [];
Object.keys(groups).forEach(function (key) {
const rows = groups[key];
if (rows.length <= 1) return;

rows.sort(function (a, b) {
const scoreA = (a.row[6] === 'مكتملة' ? 2 : 0) + (String(a.row[10] || '').trim() ? 1 : 0);
const scoreB = (b.row[6] === 'مكتملة' ? 2 : 0) + (String(b.row[10] || '').trim() ? 1 : 0);
return scoreB - scoreA;
});

for (let j = 1; j < rows.length; j++) {
rowsToDelete.push(rows[j].rowIndex);
}
});

rowsToDelete.sort(function (a, b) { return b - a; });
rowsToDelete.forEach(function (r) { sheet.deleteRow(r); });

Logger.log('تم حذف ' + rowsToDelete.length + ' صف مكرر بتاريخ ' + targetDate);
}

function cleanupAug8Duplicates_DANGEROUS() {
removeDuplicateTasksForDate_DANGEROUS('2026-08-08');
}

function deleteTasksForDate_DANGEROUS(dateStr) {
const ss = SpreadsheetApp.getActiveSpreadsheet();
const sheet = ss.getSheetByName(SHEET_TASKS);
const data = sheet.getDataRange().getValues();
const targetDate = String(dateStr).trim();

const rowsToDelete = [];
for (let i = 1; i < data.length; i++) {
if (normalizeDateStr_(data[i][1]) === targetDate) {
rowsToDelete.push(i + 1);
}
}

rowsToDelete.sort(function (a, b) { return b - a; });
rowsToDelete.forEach(function (r) { sheet.deleteRow(r); });

Logger.log('تم حذف ' + rowsToDelete.length + ' صف بتاريخ ' + targetDate);
}

function cleanupAug6TestData_DANGEROUS() {
deleteTasksForDate_DANGEROUS('2026-08-06');
}

function clearAllTaskData_DANGEROUS() {
const ss = SpreadsheetApp.getActiveSpreadsheet();
const sheet = ss.getSheetByName(SHEET_TASKS);
const lastRow = sheet.getLastRow();
if (lastRow > 1) {
sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
Logger.log('تم حذف ' + (lastRow - 1) + ' صف من ' + SHEET_TASKS);
} else {
Logger.log('لا توجد بيانات لحذفها.');
}
}

function testDashboardDirectly() {
const token = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN');
Logger.log('التوكن المستخدم: ' + token);
const result = getDashboardData(token, '2026-08-06');
Logger.log('النتيجة الكاملة (نص JSON):');
Logger.log(result);
}
