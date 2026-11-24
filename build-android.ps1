# Android 8.0+ | Offline WebView wrapper
# Build: powershell -ExecutionPolicy Bypass -File build-android.ps1
# Output: dist/express-pickup.apk
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
if ($root -match '[^\x00-\x7F]') {
    $stage = 'C:\express-pickup-build'
    New-Item -ItemType Directory -Force -Path "$stage\dist", "$root\dist" | Out-Null
    Copy-Item -LiteralPath "$root\android" -Destination $stage -Recurse -Force
    Copy-Item -LiteralPath "$root\assets" -Destination $stage -Recurse -Force
    Copy-Item -LiteralPath "$root\index.html", "$root\styles.css", "$root\barcode.js", "$root\parser.js", "$root\app.js", "$root\manifest.webmanifest", "$root\sw.js", "$root\build-android.ps1", "$root\pack-android.py", "$root\sync-android.py" -Destination $stage -Force
    if (-not (Test-Path "$stage\.jdk")) { cmd /c mklink /J "$stage\.jdk" "$root\.jdk" | Out-Null }
    if (-not (Test-Path "$stage\.android-sdk")) { cmd /c mklink /J "$stage\.android-sdk" "$root\.android-sdk" | Out-Null }
    & "$stage\build-android.ps1"
    if ($LASTEXITCODE) { throw 'Android build failed.' }
    Copy-Item -LiteralPath "$stage\dist\express-pickup.apk" -Destination "$root\dist\express-pickup.apk" -Force
    $displayApk = Join-Path $root ('dist\' + [char]0x5FEB + [char]0x9012 + [char]0x53D6 + [char]0x4EF6 + '.apk')
    Copy-Item -LiteralPath "$root\dist\express-pickup.apk" -Destination $displayApk -Force
    Write-Output "APK created: $displayApk"
    exit
}
$sdk = Join-Path $root '.android-sdk'
$buildTools = Join-Path $sdk 'build-tools\35.0.0'
$androidJar = Join-Path $sdk 'platforms\android-35\android.jar'
$project = Join-Path $root 'android'
$classes = Join-Path $project 'build\classes'
$output = Join-Path $root 'dist'
$unsigned = Join-Path $project 'build\express-pickup-unsigned.apk'
$unaligned = Join-Path $project 'build\express-pickup-unaligned.apk'
$apk = Join-Path $output 'express-pickup.apk'
$env:JAVA_HOME = Join-Path $root '.jdk'
$env:Path = "$env:JAVA_HOME\bin;$buildTools;$env:Path"

if (-not (Test-Path $androidJar)) { throw 'Android SDK is not installed.' }
python "$root\sync-android.py"
if ($LASTEXITCODE) { throw 'Asset synchronization failed.' }
if (Test-Path $classes) { Remove-Item -LiteralPath $classes -Recurse -Force }
New-Item -ItemType Directory -Force -Path $classes, $output, (Split-Path $unsigned) | Out-Null

& "$buildTools\aapt2.exe" compile --dir "$project\res" -o "$project\build\resources.zip"
if ($LASTEXITCODE) { throw 'Resource compilation failed.' }
& "$buildTools\aapt2.exe" link -o $unsigned -I $androidJar --manifest "$project\AndroidManifest.xml" --java "$project\build" --min-sdk-version 26 --target-sdk-version 35 "$project\build\resources.zip"
if ($LASTEXITCODE) { throw 'Resource linking failed.' }

$javaSources = @("$project\build\com\express\pickup\R.java") + (Get-ChildItem "$project\src\com\express\pickup\*.java" | ForEach-Object FullName)
& javac -encoding UTF-8 -source 8 -target 8 -bootclasspath $androidJar -d $classes $javaSources
if ($LASTEXITCODE) { throw 'Java compilation failed.' }
& "$buildTools\d8.bat" --lib $androidJar --output "$project\build" (Get-ChildItem "$classes\com\express\pickup\*.class" | ForEach-Object FullName)
if ($LASTEXITCODE) { throw 'DEX compilation failed.' }

python "$root\pack-android.py" $project $unsigned
if ($LASTEXITCODE) { throw 'Asset packaging failed.' }
& "$buildTools\zipalign.exe" -f -p 4 $unsigned $unaligned
if ($LASTEXITCODE) { throw 'APK alignment failed.' }
$ksPath = if ($env:ANDROID_KEYSTORE_PATH) { $env:ANDROID_KEYSTORE_PATH } else { "$project\express-pickup.keystore" }
$ksPass = if ($env:ANDROID_KEYSTORE_PASSWORD) { $env:ANDROID_KEYSTORE_PASSWORD } else { 'express-pickup-local' }
$keyPass = if ($env:ANDROID_KEY_PASSWORD) { $env:ANDROID_KEY_PASSWORD } else { $ksPass }
$signArgs = @('sign', '--ks', $ksPath, '--ks-pass', "pass:$ksPass", '--key-pass', "pass:$keyPass", '--out', $apk, $unaligned)
if ($env:ANDROID_KEY_ALIAS) { $signArgs = @('sign', '--ks', $ksPath, '--ks-key-alias', $env:ANDROID_KEY_ALIAS, '--ks-pass', "pass:$ksPass", '--key-pass', "pass:$keyPass", '--out', $apk, $unaligned) }
& "$buildTools\apksigner.bat" @signArgs
if ($LASTEXITCODE) { throw 'APK signing failed.' }
& "$buildTools\apksigner.bat" verify --verbose $apk
if ($LASTEXITCODE) { throw 'APK signature verification failed.' }
Write-Output "APK created: $apk"
