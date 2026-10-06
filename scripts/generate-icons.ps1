Add-Type -AssemblyName System.Drawing

function Generate-FoodLinkIcon {
    param(
        [int]$Size,
        [string]$OutputPath,
        [bool]$IsMaskable = $false
    )

    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bitmap)
    
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Colors adhering to FoodLink project rules
    $bgGreen = [System.Drawing.ColorTranslator]::FromHtml("#2E7D4F")
    $softGreen = [System.Drawing.ColorTranslator]::FromHtml("#EAF3EC")
    $white = [System.Drawing.Color]::White

    $bgBrush = New-Object System.Drawing.SolidBrush($bgGreen)

    if ($IsMaskable) {
        # Maskable icon requires full bleed square background
        $g.FillRectangle($bgBrush, 0, 0, $Size, $Size)
    } else {
        # Rounded squircle for standard PWA icon
        $radius = [int]($Size * 0.22)
        $diameter = $radius * 2
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $rect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
        
        $path.AddArc($rect.X, $rect.Y, $diameter, $diameter, 180, 90)
        $path.AddArc($rect.Right - $diameter, $rect.Y, $diameter, $diameter, 270, 90)
        $path.AddArc($rect.Right - $diameter, $rect.Bottom - $diameter, $diameter, $diameter, 0, 90)
        $path.AddArc($rect.X, $rect.Bottom - $diameter, $diameter, $diameter, 90, 90)
        $path.CloseFigure()
        
        $g.FillPath($bgBrush, $path)
        $path.Dispose()
    }

    # Emblem scaling: maskable safe area is central 80% (scale factor 0.65), standard is 0.75
    $scale = if ($IsMaskable) { $Size * 0.60 } else { $Size * 0.70 }
    $cx = $Size / 2.0
    $cy = $Size / 2.0

    # Draw FoodLink Bowl + Sprout Food Rescue Emblem
    $whitePen = New-Object System.Drawing.Pen($white, ($Size * 0.045))
    $whitePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $whitePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $whitePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    $whiteBrush = New-Object System.Drawing.SolidBrush($white)
    $softGreenBrush = New-Object System.Drawing.SolidBrush($softGreen)

    # 1. Food Rescue Bowl (Lower half)
    # Arc from angle 0 to 180 (clockwise downwards)
    $bowlWidth = $scale * 0.76
    $bowlHeight = $scale * 0.44
    $bowlX = $cx - ($bowlWidth / 2.0)
    $bowlY = $cy - ($scale * 0.05)

    # Bowl rim
    $rimY = $bowlY + ($scale * 0.02)
    $g.DrawLine($whitePen, [float]($cx - ($bowlWidth * 0.44)), [float]$rimY, [float]($cx + ($bowlWidth * 0.44)), [float]$rimY)

    # Bowl curve
    $bowlPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $bowlPath.AddArc([float]$bowlX, [float]$bowlY, [float]$bowlWidth, [float]$bowlHeight, 0, 180)
    $bowlPath.CloseFigure()
    $g.FillPath($whiteBrush, $bowlPath)
    $bowlPath.Dispose()

    # Small bowl base stand
    $baseWidth = $scale * 0.28
    $baseY = $bowlY + $bowlHeight - ($scale * 0.02)
    $g.DrawLine($whitePen, [float]($cx - ($baseWidth / 2.0)), [float]$baseY, [float]($cx + ($baseWidth / 2.0)), [float]$baseY)

    # 2. Nutrition Leaf / Sprout (Upper half rising out of bowl)
    # Right Leaf
    $rLeafPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $rStartX = $cx
    $rStartY = $rimY - ($scale * 0.02)
    $rTipX = $cx + ($scale * 0.24)
    $rTipY = $cy - ($scale * 0.36)
    
    $rLeafPath.AddBezier([float]$rStartX, [float]$rStartY, [float]($cx + ($scale * 0.04)), [float]($cy - ($scale * 0.18)), [float]($cx + ($scale * 0.16)), [float]($cy - ($scale * 0.32)), [float]$rTipX, [float]$rTipY)
    $rLeafPath.AddBezier([float]$rTipX, [float]$rTipY, [float]($cx + ($scale * 0.24)), [float]($cy - ($scale * 0.14)), [float]($cx + ($scale * 0.10)), [float]($cy - ($scale * 0.05)), [float]$rStartX, [float]$rStartY)
    $rLeafPath.CloseFigure()
    $g.FillPath($softGreenBrush, $rLeafPath)
    $rLeafPath.Dispose()

    # Left Leaf
    $lLeafPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $lTipX = $cx - ($scale * 0.22)
    $lTipY = $cy - ($scale * 0.28)
    $lLeafPath.AddBezier([float]$rStartX, [float]$rStartY, [float]($cx - ($scale * 0.04)), [float]($cy - ($scale * 0.14)), [float]($cx - ($scale * 0.14)), [float]($cy - ($scale * 0.24)), [float]$lTipX, [float]$lTipY)
    $lLeafPath.AddBezier([float]$lTipX, [float]$lTipY, [float]($cx - ($scale * 0.20)), [float]($cy - ($scale * 0.10)), [float]($cx - ($scale * 0.08)), [float]($cy - ($scale * 0.04)), [float]$rStartX, [float]$rStartY)
    $lLeafPath.CloseFigure()
    $g.FillPath($whiteBrush, $lLeafPath)
    $lLeafPath.Dispose()

    # Central Stem
    $stemPen = New-Object System.Drawing.Pen($white, ($Size * 0.028))
    $stemPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $stemPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawLine($stemPen, [float]$cx, [float]($rStartY + ($scale * 0.04)), [float]($cx + ($scale * 0.05)), [float]($cy - ($scale * 0.22)))

    # Save to PNG
    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

    # Cleanup resources
    $stemPen.Dispose()
    $softGreenBrush.Dispose()
    $whiteBrush.Dispose()
    $whitePen.Dispose()
    $bgBrush.Dispose()
    $g.Dispose()
    $bitmap.Dispose()

    Write-Output "Successfully generated: $OutputPath ($Size x $Size)"
}

$rootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$iconsDir = Join-Path $rootDir "public\icons"

if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir -Force | Out-Null
}

Generate-FoodLinkIcon -Size 192 -OutputPath (Join-Path $iconsDir "icon-192.png") -IsMaskable $false
Generate-FoodLinkIcon -Size 512 -OutputPath (Join-Path $iconsDir "icon-512.png") -IsMaskable $false
Generate-FoodLinkIcon -Size 512 -OutputPath (Join-Path $iconsDir "icon-maskable.png") -IsMaskable $true
