param(
    [string]$PostgresBin = 'C:\Program Files\PostgreSQL\16\bin',
    [string]$Maven = '',
    [switch]$UseExistingTestDatabase,
    [switch]$SkipBackendBuild,
    [switch]$SkipUiChecks,
    [string[]]$Services = @('discovery-server','api-gateway','employee-service','leave-service','attendance-service','payroll-service','auth-service','probation-service')
)
$ErrorActionPreference = 'Stop'
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$runDirectory = Join-Path $repositoryRoot ('.tmp\probation-run-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $runDirectory -Force | Out-Null
$ownedProcesses = [System.Collections.Generic.List[System.Diagnostics.Process]]::new()
$startedDatabase = $false
$cluster = Join-Path $runDirectory 'postgres'
if (-not $Maven) { $Maven = Join-Path $repositoryRoot 'probation-service\mvnw.cmd' }
function Invoke-Checked([string]$File, [string[]]$Arguments) {
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Command failed: $File (exit $LASTEXITCODE)" }
}
function Wait-Http([string]$Url) {
    $deadline = [DateTime]::UtcNow.AddSeconds(150)
    do {
        try { $null = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3; return }
        catch { if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -in @(401,403)) { return } }
        Start-Sleep -Milliseconds 500
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "Test service did not become ready: $Url. Logs: $runDirectory"
}
function Start-TestService([string]$Name, [int]$Port, [string[]]$Options) {
    $jar = Join-Path $repositoryRoot "$Name\target\$Name-0.0.1-SNAPSHOT.jar"
    $arguments = @('-Xmx256m','-jar',"`"$jar`"", "--server.port=$Port", '--server.address=127.0.0.1', '--spring.jpa.show-sql=false', '--app.jwt.secret=probation-isolated-live-test-shared-key-1234567890-abcdefghijklmnopqrstuvwxyz', '--eureka.client.service-url.defaultZone=http://127.0.0.1:18761/eureka', '--eureka.instance.hostname=127.0.0.1', '--eureka.instance.prefer-ip-address=true', '--eureka.instance.ip-address=127.0.0.1') + $Options
    $process = Start-Process -FilePath 'java.exe' -ArgumentList $arguments -WorkingDirectory $repositoryRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runDirectory "$Name.log") -RedirectStandardError (Join-Path $runDirectory "$Name-error.log")
    $ownedProcesses.Add($process)
    Write-Output "Started isolated $Name on $Port"
}
try {
    if (-not $UseExistingTestDatabase) {
        Invoke-Checked (Join-Path $PostgresBin 'initdb.exe') @('-D',$cluster,'-U','probation_test','-A','trust','--no-locale','-E','UTF8')
        Invoke-Checked (Join-Path $PostgresBin 'pg_ctl.exe') @('-D',$cluster,'-l',(Join-Path $runDirectory 'postgres.log'),'-o','-p 55436 -h 127.0.0.1','-w','start')
        $startedDatabase = $true
        Invoke-Checked (Join-Path $PostgresBin 'createdb.exe') @('-h','127.0.0.1','-p','55436','-U','probation_test','probation_test')
    }
    # A fixed loopback port and dedicated database are intentional: never use HRMS.
    if (-not $SkipBackendBuild) {
        foreach ($service in $Services) {
            Write-Output "Verifying $service against the isolated database"
            $options = @('-q','-f',(Join-Path $repositoryRoot "$service\pom.xml"),'package','-Dspring.datasource.url=jdbc:postgresql://127.0.0.1:55436/probation_test','-Dspring.datasource.username=probation_test','-Dspring.datasource.password=','-Dspring.jpa.show-sql=false','-Deureka.client.enabled=false','-Dspring.cloud.discovery.enabled=false')
            if ($service -ne 'probation-service') { $options += '-Dspring.jpa.properties.hibernate.default_schema=' + $service.Replace('-','_') + '_verification' }
            Invoke-Checked $Maven $options
        }
    }
    Start-TestService 'discovery-server' 18761 @()
    Wait-Http 'http://127.0.0.1:18761/'
    $databaseOptions = @('--spring.datasource.url=jdbc:postgresql://127.0.0.1:55436/probation_test','--spring.datasource.username=probation_test','--spring.datasource.password=')
    Start-TestService 'employee-service' 18081 ($databaseOptions + '--spring.jpa.properties.hibernate.default_schema=employee_live')
    Start-TestService 'auth-service' 18085 ($databaseOptions + '--spring.jpa.properties.hibernate.default_schema=auth_live')
    Start-TestService 'probation-service' 18086 $databaseOptions
    # Original modules also run here so the live test verifies their HR write gates.
    Start-TestService 'leave-service' 18082 ($databaseOptions + '--spring.jpa.properties.hibernate.default_schema=leave_live')
    Start-TestService 'attendance-service' 18083 ($databaseOptions + '--spring.jpa.properties.hibernate.default_schema=attendance_live')
    Start-TestService 'payroll-service' 18084 ($databaseOptions + '--spring.jpa.properties.hibernate.default_schema=payroll_live')
    foreach ($entry in @(@(18081,'employees'),@(18082,'leaves'),@(18083,'attendance'),@(18084,'payroll'),@(18085,'auth/me'),@(18086,'probation/me'))) { Wait-Http "http://127.0.0.1:$($entry[0])/$($entry[1])" }
    Start-TestService 'api-gateway' 18080 @('--spring.cloud.gateway.server.webflux.globalcors.cors-configurations.[/**].allowedOrigins=http://127.0.0.1:4176')
    Wait-Http 'http://127.0.0.1:18080/api/probation/me'
    Push-Location (Join-Path $repositoryRoot 'hrms-frontend')
    try {
        if (-not $SkipUiChecks) {
            Invoke-Checked 'npm.cmd' @('test')
            Invoke-Checked 'npm.cmd' @('run','test:e2e')
        }
        Invoke-Checked 'npm.cmd' @('run','test:e2e:live')
        Invoke-Checked 'npm.cmd' @('run','build')
    } finally { Pop-Location }
} finally {
    foreach ($process in $ownedProcesses) { if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force } }
    if ($startedDatabase) { & (Join-Path $PostgresBin 'pg_ctl.exe') -D $cluster -w stop }
    Write-Output "Isolated verification logs retained at $runDirectory"
}
