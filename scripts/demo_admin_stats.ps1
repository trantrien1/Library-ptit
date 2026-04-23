param(
    [string]$BaseUrl = "http://127.0.0.1:8000",
    [string]$Username = "admin",
    [string]$Password = "admin123",
    [ValidateSet(7, 30, 90)]
    [int]$PeriodDays = 30
)

$ErrorActionPreference = "Stop"

Write-Host "=== Demo Admin Stats API ===" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl"
Write-Host "Period: $PeriodDays days"

# 1) Login to get JWT token
$loginResponse = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/auth/login" -ContentType "application/x-www-form-urlencoded" -Body "username=$Username&password=$Password"
$token = $loginResponse.access_token

if (-not $token) {
    throw "Login failed: no access_token returned"
}

$headers = @{ Authorization = "Bearer $token" }

# 2) Overview stats
Write-Host "`n[1/3] GET /api/admin/stats/overview" -ForegroundColor Yellow
$overview = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/admin/stats/overview?period_days=$PeriodDays" -Headers $headers
$overview | ConvertTo-Json -Depth 5

# 3) Book stats
Write-Host "`n[2/3] GET /api/admin/stats/books" -ForegroundColor Yellow
$bookStats = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/admin/stats/books?period_days=$PeriodDays&low_stock_threshold=2&top_limit=5" -Headers $headers
$bookStats | ConvertTo-Json -Depth 5

# 4) User stats
Write-Host "`n[3/3] GET /api/admin/stats/users" -ForegroundColor Yellow
$userStats = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/admin/stats/users?period_days=$PeriodDays&top_limit=5" -Headers $headers
$userStats | ConvertTo-Json -Depth 5

Write-Host "`nDemo completed." -ForegroundColor Green

