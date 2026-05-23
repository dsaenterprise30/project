$frontendDir = "c:\Users\hp\projects\Realestate\real-estate-project\project\frontend"

# Define replacements: broken mojibake -> correct HTML entity
$replacements = @{
    [char]0x00E2 + [char]0x201A + [char]0x00B9 = "&#8377;"       # rupee sign
    [char]0x00E2 + [char]0x0153 + [char]0x0085 = "&#9989;"       # check mark
    [char]0x00E2 + [char]0x0152 = "&#10060;"                      # cross mark  
    [char]0x00E2 + [char]0x0161 + " " + [char]0x00EF + [char]0x00B8 = "&#9888;&#65039;"  # warning
    [char]0x00E2 + [char]0x0099 + [char]0x00BB + [char]0x00EF + [char]0x00B8 = "&#9851;&#65039;"  # recycle
    [char]0x00E2 + [char]0x0153 + [char]0x201C = "&#10004;"       # check
}

Get-ChildItem "$frontendDir\*.html" | ForEach-Object {
    $file = $_.FullName
    $bytes = [System.IO.File]::ReadAllBytes($file)
    $content = [System.Text.Encoding]::UTF8.GetString($bytes)
    $changed = $false
    
    foreach ($key in $replacements.Keys) {
        if ($content.Contains($key)) {
            $content = $content.Replace($key, $replacements[$key])
            $changed = $true
            Write-Host "  Replaced pattern in $($_.Name)"
        }
    }
    
    if ($changed) {
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($file, $content, $utf8NoBom)
        Write-Host "Fixed: $($_.Name)"
    } else {
        Write-Host "Skipped (no matches): $($_.Name)"
    }
}

Write-Host "`nDone!"
