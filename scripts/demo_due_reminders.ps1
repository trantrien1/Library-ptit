param(
    [string]$BaseUrl = "http://127.0.0.1:8000",
    [string]$Username = "user1",
    [string]$Password = "123456",
    [ValidateRange(1, 30)]
    [int]$DaysAhead = 3
)

$ErrorActionPreference = "Stop"

Write-Host "=== Demo Due Date Reminder API ===" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl"
Write-Host "User: $Username"
Write-Host "Days ahead: $DaysAhead"

# 1) Login to get JWT token
$loginBody = "username=$Username&password=$Password"
$loginResponse = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/auth/login" -ContentType "application/x-www-form-urlencoded" -Body $loginBody
$token = $loginResponse.access_token

if (-not $token) {
    throw "Login failed: no access_token returned"
}

$headers = @{ Authorization = "Bearer $token" }

# 2) Check current borrows
Write-Host "`n[1/3] GET /api/borrows?status_filter=approved" -ForegroundColor Yellow
$approvedBorrows = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/borrows?page=1&page_size=10&status_filter=approved" -Headers $headers
$approvedBorrows | ConvertTo-Json -Depth 6

# 3) Reminder in configured window
Write-Host "`n[2/3] GET /api/borrows/reminders?days_ahead=$DaysAhead" -ForegroundColor Yellow
$remindersCurrent = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/borrows/reminders?days_ahead=$DaysAhead&limit=10" -Headers $headers
$remindersCurrent | ConvertTo-Json -Depth 6

# 4) Reminder in 7-day window for comparison
Write-Host "`n[3/3] GET /api/borrows/reminders?days_ahead=7" -ForegroundColor Yellow
$reminders7Days = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/borrows/reminders?days_ahead=7&limit=10" -Headers $headers
$reminders7Days | ConvertTo-Json -Depth 6

Write-Host "`nDemo completed." -ForegroundColor Green

