$file = 'c:\Users\user\Desktop\sayt22-main\app-client.js'
$bytes = [System.IO.File]::ReadAllBytes($file)
$content = [System.Text.Encoding]::UTF8.GetString($bytes)
# Remove null bytes using regex
$content = [System.Text.RegularExpressions.Regex]::Replace($content, '\x00', '')
# Split into lines
$lines = $content -split "`r?`n"
$cleaned = [System.Collections.Generic.List[string]]::new()
foreach ($line in $lines) {
    # Skip lines that look like null-byte padded unicode (every other char is null)
    $stripped = [System.Text.RegularExpressions.Regex]::Replace($line, '\x00', '')
    if ($stripped -ne $line) { continue }
    if ($line -match '^w.i.n.d.o.w') { continue }
    $cleaned.Add($line)
}
# Clean end
if ($cleaned[$cleaned.Count - 1] -ne 'window.openAdvanceModal = openAdvanceModal;') {
    $cleaned.Add('window.openAdvanceModal = openAdvanceModal;')
}
$cleaned.Add('')
$result = [string]::Join("`r`n", $cleaned)
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($file, $result, $enc)
Write-Host "Done. Total lines: $($cleaned.Count)"
