# Read version from package.json
$package = Get-Content package.json | Out-String | ConvertFrom-Json
$version = $package.version
$tagName = "v$version"
Write-Host "Releasing version: $version with tag: $tagName for $(Get-Location)"

# Check if tag exists on remote
Write-Host "Checking if tag $tagName exists on remote..."
$existingTag = git ls-remote --tags origin $tagName | Select-String $tagName
if ($existingTag) {
    Write-Host "ERROR: Tag $tagName already exists on remote. Please update the version in package.json before releasing."
    exit 1
}

Write-Host "Tagging version $tagName..."
git tag $tagName
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to create tag $tagName."
    exit 1
}

Write-Host "Pushing tag $tagName to remote..."
git push origin $tagName
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to push tag $tagName to remote."
    exit 1
}

Write-Host "Release $tagName published!"