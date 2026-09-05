# ============================================================
#  نشر نظام الحضور - أمر واحد يودّع ويدفع وينشر ويتحقق
#  الاستخدام:  .\deploy.ps1 "وصف مختصر للتغيير"
# ============================================================
$ErrorActionPreference = 'Stop'
$root = 'C:\karam-attendance'
$gas  = Join-Path $root 'gas'
$dep  = 'AKfycby9pN3RR-ATdwMad6A9YvwK1fGrvprZCaorcRDKP9PsVE0Qrv7eEpJDzCMHvyH7wuv7'
$desc = if ($args.Count -gt 0 -and $args[0]) { $args[0] } else { (Get-Date -Format 'yyyy-MM-dd HH:mm') }

function Save-Repo($path, $label) {
    Push-Location $path
    $dirty = git status --porcelain
    if ($dirty) {
        Write-Host "[$label] إيداع التغييرات..." -ForegroundColor Cyan
        git add -A
        git commit -q -m $desc
    } else {
        Write-Host "[$label] لا تغييرات جديدة" -ForegroundColor DarkGray
    }
    git push -q
    Pop-Location
}

# 1) الإصدار المتوقع - يُقرأ من الكود نفسه، لا يُكتب يدويًا
$codeText = Get-Content -Raw -Encoding UTF8 (Join-Path $gas 'الرمز.js')
if ($codeText -notmatch "APP_VERSION\s*=\s*'([^']+)'") { throw 'تعذّر قراءة APP_VERSION من الكود' }
$expected = $Matches[1]
Write-Host "الإصدار المتوقع: $expected`n" -ForegroundColor Cyan

# 2) حفظ ودفع المستودعين - لا يُنشر كود غير محفوظ أبدًا
Save-Repo $root 'الواجهة'
Save-Repo $gas  'الخادم'

# 3) دفع كود Apps Script وتحديث نفس النشر (لا نشر جديد أبدًا)
Push-Location $gas
clasp push -f
clasp redeploy $dep -d $desc
Pop-Location

# 4) بوابة التحقق: لا نقول "تم" قبل أن يؤكد الرابط الحي نفسه
Write-Host "`nجاري التحقق من الرابط الحي..." -ForegroundColor Cyan
$ok = $false
foreach ($try in 1..6) {
    Start-Sleep -Seconds 15
    $url = "https://script.google.com/macros/s/$dep/exec?emp=3&t=$([guid]::NewGuid())"
    try {
        $html = (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30).Content
    } catch {
        Write-Host "  محاولة $try : تعذّر الاتصال" -ForegroundColor DarkGray
        continue
    }
    $title = if ($html -match '<title>(.*?)</title>') { $Matches[1] } else { '(بلا عنوان)' }
    if ($title -like "*$expected*") {
        Write-Host "`n[نجح] الرابط الحي يشغّل $expected" -ForegroundColor Green
        Write-Host "      العنوان: $title" -ForegroundColor Green
        $ok = $true
        break
    }
    Write-Host "  محاولة $try : ما زال يعرض -> $title" -ForegroundColor DarkGray
}

if (-not $ok) {
    Write-Host "`n[تحذير] لم تتأكد بصمة الإصدار بعد دقيقة ونصف." -ForegroundColor Yellow
    Write-Host "        غالبًا تخزين مؤقت من جوجل - أعد التحقق بعد قليل قبل الحكم بالفشل." -ForegroundColor Yellow
    exit 1
}

Set-Location $root
