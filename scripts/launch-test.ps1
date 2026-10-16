param([switch]$Build)
$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot -Parent
$testProfilePath=Join-Path $repo 'work\test-profile'
$testDataPath=Join-Path $repo 'work\test-data'
if(Get-CimInstance Win32_Process -Filter "name='zotero.exe'" | Where-Object {$_.CommandLine -like ('*-profile "'+$testProfilePath+'"*') -and $_.CommandLine -notmatch 'contentproc'}){throw 'The isolated test profile is running. Close it before rebuilding.'}
New-Item -ItemType Directory -Force $testProfilePath,$testDataPath,(Join-Path $testProfilePath 'extensions') | Out-Null
foreach($name in @('extensions.json','addonStartup.json.lz4')){$cache=Join-Path $testProfilePath $name;if(Test-Path -LiteralPath $cache){Move-Item -LiteralPath $cache -Destination ($cache+'.previous') -Force}}
if($Build){Push-Location $repo; try{node scripts/create-test-pdf.mjs;node scripts/build.mjs --test}finally{Pop-Location}}
Copy-Item -LiteralPath (Join-Path $repo 'scripts\seed-test.js') -Destination (Join-Path $testProfilePath 'papercompare-test.js') -Force
Copy-Item -LiteralPath (Join-Path $repo 'dist\papercompare-0.1.0.xpi') -Destination (Join-Path $testProfilePath 'extensions\papercompare@local.research.xpi') -Force
$prefs=@(
 'user_pref("extensions.zotero.dataDir", '+(ConvertTo-Json $testDataPath -Compress)+');',
 'user_pref("extensions.zotero.useDataDir", true);',
 'user_pref("extensions.autoDisableScopes", 0);',
 'user_pref("extensions.enabledScopes", 15); user_pref("extensions.startupScanScopes", 15);',
 'user_pref("extensions.zotero.firstRun", false);',
 'user_pref("intl.locale.requested", "zh-CN");',
 'user_pref("extensions.zotero.automaticScraperUpdates", false);'
)
$prefs | Set-Content -LiteralPath (Join-Path $testProfilePath 'user.js') -Encoding utf8
Start-Process -FilePath 'C:\Program Files\Zotero\zotero.exe' -ArgumentList @('-no-remote','-profile',('"'+$testProfilePath+'"'),'-ZoteroDebugText') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $repo 'work\zotero-test.log') -RedirectStandardError (Join-Path $repo 'work\zotero-test-error.log')
