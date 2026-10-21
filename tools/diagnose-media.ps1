# 1.0.0: read-only GSMTC inventory for Windows PowerShell 5.1. No admin required.
# Output contains current track titles/artists: review it before sharing publicly.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
$propsType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType=WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1
function Await-WinRT($Operation, [Type]$ResultType) {
    $task = $asTask.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    if (-not $task.Wait(10000)) { throw 'WinRT request timed out' }
    return $task.Result
}
$manager = Await-WinRT ($managerType::RequestAsync()) $managerType
$current = $manager.GetCurrentSession()
$rows = foreach ($session in $manager.GetSessions()) {
    try {
        $properties = Await-WinRT ($session.TryGetMediaPropertiesAsync()) $propsType
        $info = $session.GetPlaybackInfo()
        [PSCustomObject]@{
            Source = $session.SourceAppUserModelId
            Current = ($current -and $current.SourceAppUserModelId -eq $session.SourceAppUserModelId)
            Status = [string]$info.PlaybackStatus
            Title = $properties.Title
            Artist = $properties.Artist
            CanPlay = $info.Controls.IsPlayEnabled
            CanPause = $info.Controls.IsPauseEnabled
            CanSeek = $info.Controls.IsPlaybackPositionEnabled
        }
    } catch { Write-Warning "Session read failed: $($_.Exception.Message)" }
}
@($rows) | ConvertTo-Json -Depth 3
