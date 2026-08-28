<#
.SYNOPSIS
    Compares two locally downloaded Power Pages site trees.

.DESCRIPTION
    Performs a local-only comparison across Power Pages metadata/content areas. It normalises JSON
    object property order, line endings and trailing whitespace in text files, and ignores the
    environment-specific org-url-manifest.yml by default.

    No network requests are made.

    Execution context: local-only.
    Safety classification: LOCAL_ONLY_READ_ONLY.

.PARAMETER SiteAPath
    First downloaded Power Pages site root.

.PARAMETER SiteBPath
    Second downloaded Power Pages site root.

.PARAMETER IncludeEnvironmentManifest
    Include org-url-manifest.yml in the comparison. By default it is ignored because it is environment-specific.

.PARAMETER JsonOutputPath
    Optional JSON diff output path.

.PARAMETER MarkdownOutputPath
    Optional Markdown summary output path.

.EXAMPLE
    .\Compare-PowerPagesSites.ps1 `
        -SiteAPath '.\downloads\dev-site' `
        -SiteBPath '.\downloads\prod-site' `
        -JsonOutputPath '.\diff.json' `
        -MarkdownOutputPath '.\diff.md'
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$SiteAPath,

    [Parameter(Mandatory)]
    [string]$SiteBPath,

    [Parameter()]
    [switch]$IncludeEnvironmentManifest,

    [Parameter()]
    [string]$JsonOutputPath,

    [Parameter()]
    [string]$MarkdownOutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-SiteDirectory {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path,[Parameter(Mandatory)][string]$Label)
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) { throw "$Label was not found or is not a directory: '$Path'." }
    return (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
}

function Write-Utf8NoBomText {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path,[Parameter(Mandatory)][AllowEmptyString()][string]$Content)
    $full = [IO.Path]::GetFullPath($Path)
    $parent = Split-Path -Path $full -Parent
    if (-not (Test-Path -LiteralPath $parent -PathType Container)) { throw "Output parent directory does not exist: '$parent'." }
    [IO.File]::WriteAllText($full,$Content,[Text.UTF8Encoding]::new($false))
}

function Get-TextSha256 {
    [CmdletBinding()]
    param([Parameter(Mandatory)][AllowEmptyString()][string]$Text)
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($Text)
        return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','').ToLowerInvariant()
    }
    finally { $sha.Dispose() }
}

function ConvertTo-CanonicalObject {
    [CmdletBinding()]
    param([AllowNull()][object]$Value)

    if ($null -eq $Value) { return $null }

    if ($Value -is [System.Collections.IDictionary]) {
        $result = [ordered]@{}
        foreach ($key in @($Value.Keys | ForEach-Object { [string]$_ } | Sort-Object)) {
            $result[$key] = ConvertTo-CanonicalObject -Value $Value[$key]
        }
        return $result
    }

    if ($Value -is [pscustomobject]) {
        $result = [ordered]@{}
        foreach ($property in @($Value.PSObject.Properties | Sort-Object Name)) {
            $result[$property.Name] = ConvertTo-CanonicalObject -Value $property.Value
        }
        return $result
    }

    if ($Value -is [System.Collections.IEnumerable] -and $Value -isnot [string]) {
        return @($Value | ForEach-Object { ConvertTo-CanonicalObject -Value $_ })
    }

    return $Value
}

function Get-PowerPagesCategory {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$RelativePath)

    $normalised = $RelativePath.Replace('\','/').ToLowerInvariant()
    switch -Regex ($normalised) {
        '(^|/)web-pages(/|$)' { return 'Web Pages' }
        '(^|/)web-templates(/|$)' { return 'Web Templates' }
        '(^|/)site-settings(/|$)' { return 'Site Settings' }
        '(^|/)web-files(/|$)' { return 'Web Files' }
        '(^|/)(lists|entity-lists)(/|$)' { return 'Lists' }
        '(^|/)(basic-forms|entity-forms)(/|$)' { return 'Forms' }
        '(^|/)(multistep-forms|web-forms|webforms)(/|$)' { return 'Multistep Forms' }
        '(^|/)(table-permissions|entity-permissions)(/|$)' { return 'Table Permissions' }
        '(^|/)web-roles(/|$)' { return 'Web Roles' }
        '(^|/)content-snippets(/|$)' { return 'Content Snippets' }
        '(^|/)page-templates(/|$)' { return 'Page Templates' }
        '(^|/)website-bindings(/|$)' { return 'Website Bindings' }
        '(^|/)redirects(/|$)' { return 'Redirects' }
        default { return 'Other' }
    }
}

function Get-NormalisedFileEvidence {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][System.IO.FileInfo]$File,
        [Parameter(Mandatory)][string]$Root
    )

    $relative = [IO.Path]::GetRelativePath($Root,$File.FullName).Replace('\','/')
    $extension = $File.Extension.ToLowerInvariant()
    $textExtensions = @('.json','.xml','.yml','.yaml','.txt','.html','.htm','.liquid','.js','.css','.md','.csv','.svg','.jsonc','.webtemplate','.pagecopy')
    $normalisation = 'BINARY_SHA256'
    $hash = $null

    if ($textExtensions -contains $extension) {
        $text = [IO.File]::ReadAllText($File.FullName)
        $text = $text.Replace("`r`n","`n").Replace("`r","`n")
        $text = (($text -split "`n") | ForEach-Object { $_.TrimEnd() }) -join "`n"

        if ($extension -eq '.json') {
            try {
                $parsed = $text | ConvertFrom-Json
                $canonical = ConvertTo-CanonicalObject -Value $parsed
                $text = $canonical | ConvertTo-Json -Depth 100 -Compress
                $normalisation = 'JSON_CANONICAL_PROPERTY_ORDER'
            }
            catch {
                $normalisation = 'TEXT_LINE_ENDING_AND_TRAILING_WHITESPACE'
            }
        }
        elseif ($extension -eq '.xml' -or $extension -eq '.svg') {
            try {
                [xml]$xml = $text
                $xml.PreserveWhitespace = $false
                $settings = [Xml.XmlWriterSettings]::new()
                $settings.OmitXmlDeclaration = $false
                $settings.Indent = $false
                $settings.NewLineHandling = [Xml.NewLineHandling]::None
                $builder = [Text.StringBuilder]::new()
                $writer = [Xml.XmlWriter]::Create($builder,$settings)
                try { $xml.Save($writer) } finally { $writer.Dispose() }
                $text = $builder.ToString()
                $normalisation = 'XML_WHITESPACE_NORMALISED'
            }
            catch {
                $normalisation = 'TEXT_LINE_ENDING_AND_TRAILING_WHITESPACE'
            }
        }
        elseif ($extension -in @('.yml','.yaml')) {
            $normalisation = 'YAML_LINE_ENDING_AND_TRAILING_WHITESPACE_ONLY'
        }
        else {
            $normalisation = 'TEXT_LINE_ENDING_AND_TRAILING_WHITESPACE'
        }

        $hash = Get-TextSha256 -Text $text
    }
    else {
        $hash = (Get-FileHash -LiteralPath $File.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }

    return [ordered]@{
        path = $relative
        key = $relative.ToLowerInvariant()
        category = Get-PowerPagesCategory -RelativePath $relative
        bytes = [long]$File.Length
        sha256 = $hash
        normalisation = $normalisation
    }
}

function Get-SiteInventory {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Root)

    $files = @(
        Get-ChildItem -LiteralPath $Root -File -Recurse -Force -ErrorAction Stop |
            Where-Object {
                $relative = [IO.Path]::GetRelativePath($Root,$_.FullName).Replace('\','/')
                if ($relative -match '(^|/)(\.git|node_modules|bin|obj|out|artifacts)(/|$)') { return $false }
                if (-not $IncludeEnvironmentManifest -and $_.Name -ieq 'org-url-manifest.yml') { return $false }
                return $true
            } |
            Sort-Object FullName
    )

    $entries = @($files | ForEach-Object { Get-NormalisedFileEvidence -File $_ -Root $Root } | Sort-Object path)
    $duplicateKeys = @(
        $entries |
            Group-Object key |
            Where-Object Count -gt 1
    )
    if ($duplicateKeys.Count -gt 0) {
        throw "Site '$Root' contains case-insensitive path collisions: $((@($duplicateKeys.Name) -join ', '))."
    }

    return $entries
}

$siteA = Resolve-SiteDirectory -Path $SiteAPath -Label 'SiteAPath'
$siteB = Resolve-SiteDirectory -Path $SiteBPath -Label 'SiteBPath'
if ($siteA.Equals($siteB,[StringComparison]::OrdinalIgnoreCase)) {
    throw 'SiteAPath and SiteBPath must refer to different directories.'
}

$inventoryA = Get-SiteInventory -Root $siteA
$inventoryB = Get-SiteInventory -Root $siteB
$mapA = @{}
foreach ($entry in $inventoryA) { $mapA[$entry.key] = $entry }
$mapB = @{}
foreach ($entry in $inventoryB) { $mapB[$entry.key] = $entry }

$missingFromB = @(
    $mapA.Keys |
        Where-Object { -not $mapB.ContainsKey($_) } |
        ForEach-Object { $mapA[$_] } |
        Sort-Object category, path
)
$unexpectedInB = @(
    $mapB.Keys |
        Where-Object { -not $mapA.ContainsKey($_) } |
        ForEach-Object { $mapB[$_] } |
        Sort-Object category, path
)
$changed = @(
    foreach ($key in @($mapA.Keys | Where-Object { $mapB.ContainsKey($_) } | Sort-Object)) {
        $a = $mapA[$key]
        $b = $mapB[$key]
        if ($a.sha256 -ne $b.sha256) {
            [ordered]@{
                pathA = $a.path
                pathB = $b.path
                category = $a.category
                sha256A = $a.sha256
                sha256B = $b.sha256
                bytesA = $a.bytes
                bytesB = $b.bytes
                normalisationA = $a.normalisation
                normalisationB = $b.normalisation
            }
        }
    }
)

$categoryNames = @(
    @($inventoryA.category) + @($inventoryB.category) |
        Sort-Object -Unique
)
$categorySummary = @(
    foreach ($category in $categoryNames) {
        [ordered]@{
            category = $category
            filesA = @($inventoryA | Where-Object category -eq $category).Count
            filesB = @($inventoryB | Where-Object category -eq $category).Count
            missingFromB = @($missingFromB | Where-Object category -eq $category).Count
            unexpectedInB = @($unexpectedInB | Where-Object category -eq $category).Count
            changed = @($changed | Where-Object category -eq $category).Count
        }
    }
)

$totalDifferences = $missingFromB.Count + $unexpectedInB.Count + $changed.Count
$report = [ordered]@{
    schemaVersion = 1
    tool = [ordered]@{ name='Compare-PowerPagesSites'; version='1.0.0'; maturity='Experimental' }
    capturedUtc = [DateTimeOffset]::UtcNow.ToString('o')
    executionContext = 'LOCAL_ONLY'
    safetyClassification = 'LOCAL_ONLY_READ_ONLY'
    siteA = $siteA
    siteB = $siteB
    comparisonOptions = [ordered]@{
        includeEnvironmentManifest = [bool]$IncludeEnvironmentManifest
        jsonPropertyOrderNormalised = $true
        lineEndingsNormalised = $true
        trailingWhitespaceNormalised = $true
        yamlKeyOrderNormalised = $false
    }
    missingFromB = $missingFromB
    unexpectedInB = $unexpectedInB
    changed = $changed
    categorySummary = $categorySummary
    limitations = @(
        'org-url-manifest.yml is ignored by default because it is environment-specific; use -IncludeEnvironmentManifest to include it.',
        'manifest.yml is compared because it can carry deletion-tracking information relevant to deployment behaviour.',
        'YAML is normalised only for line endings and trailing whitespace because safely canonicalising arbitrary YAML would require an additional parser dependency.',
        'Binary web files are compared by exact SHA-256.'
    )
    summary = [ordered]@{
        classification = if ($totalDifferences -eq 0) { 'NO_MEANINGFUL_DIFFERENCES_DETECTED' } else { 'DIFFERENCES_DETECTED' }
        filesA = $inventoryA.Count
        filesB = $inventoryB.Count
        missingFromB = $missingFromB.Count
        unexpectedInB = $unexpectedInB.Count
        changed = $changed.Count
        totalDifferences = $totalDifferences
    }
}

$markdownLines = [System.Collections.Generic.List[string]]::new()
$markdownLines.Add('# Power Pages Site Comparison') | Out-Null
$markdownLines.Add('') | Out-Null
$markdownLines.Add("- Site A: ``$siteA``") | Out-Null
$markdownLines.Add("- Site B: ``$siteB``") | Out-Null
$markdownLines.Add("- Classification: **$($report.summary.classification)**") | Out-Null
$markdownLines.Add("- Total differences: **$totalDifferences**") | Out-Null
$markdownLines.Add('') | Out-Null
$markdownLines.Add('## Category summary') | Out-Null
$markdownLines.Add('') | Out-Null
$markdownLines.Add('| Category | Files A | Files B | Missing from B | Unexpected in B | Changed |') | Out-Null
$markdownLines.Add('| --- | ---: | ---: | ---: | ---: | ---: |') | Out-Null
foreach ($row in $categorySummary) {
    $markdownLines.Add("| $($row.category) | $($row.filesA) | $($row.filesB) | $($row.missingFromB) | $($row.unexpectedInB) | $($row.changed) |") | Out-Null
}
$markdownLines.Add('') | Out-Null
$markdownLines.Add('## Differences') | Out-Null
$markdownLines.Add('') | Out-Null
foreach ($entry in $missingFromB) { $markdownLines.Add("- MISSING_FROM_B [$($entry.category)] ``$($entry.path)``") | Out-Null }
foreach ($entry in $unexpectedInB) { $markdownLines.Add("- UNEXPECTED_IN_B [$($entry.category)] ``$($entry.path)``") | Out-Null }
foreach ($entry in $changed) { $markdownLines.Add("- CONTENT_DRIFT [$($entry.category)] ``$($entry.pathA)``") | Out-Null }
if ($totalDifferences -eq 0) { $markdownLines.Add('- No meaningful file differences were detected under the configured normalisation rules.') | Out-Null }

$json = $report | ConvertTo-Json -Depth 30
$markdown = $markdownLines -join [Environment]::NewLine
if ($JsonOutputPath) { Write-Utf8NoBomText -Path $JsonOutputPath -Content $json }
if ($MarkdownOutputPath) { Write-Utf8NoBomText -Path $MarkdownOutputPath -Content $markdown }
Write-Host $markdown
return $report
