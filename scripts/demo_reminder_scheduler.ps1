param(
    [string]$BaseUrl = "http://127.0.0.1:8000",
    [string]$Username = "admin",
    [string]$Password = "admin123",
    [ValidateRange(1, 30)]
    [int]$DaysAhead = 3,
    [bool]$DryRun = $true
)

$ErrorActionPreference = "Stop"

Write-Host "=== Demo Reminder Scheduler API ===" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl"
Write-Host "Admin: $Username"
Write-Host "Days ahead: $DaysAhead"
Write-Host "Dry run: $DryRun"

$loginResponse = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/auth/login" -ContentType "application/x-www-form-urlencoded" -Body "username=$Username&password=$Password"
$token = $loginResponse.access_token

if (-not $token) {
    throw "Login failed: no access_token returned"
}

$headers = @{ Authorization = "Bearer $token" }

Write-Host "`n[1/2] GET /api/admin/notifications/reminders/status" -ForegroundColor Yellow
$statusResp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/admin/notifications/reminders/status" -Headers $headers
$statusResp | ConvertTo-Json -Depth 6

Write-Host "`n[2/2] POST /api/admin/notifications/reminders/run" -ForegroundColor Yellow
$runResp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/admin/notifications/reminders/run?days_ahead=$DaysAhead&dry_run=$DryRun" -Headers $headers
$runResp | ConvertTo-Json -Depth 6

Write-Host "`nDemo completed." -ForegroundColor Green

