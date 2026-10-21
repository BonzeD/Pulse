// 1.0.0: publish a real Windows SMTC session; never plays duplicate/silent audio.
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using Windows.Media;
using Windows.Media.Playback;
using Windows.Storage.Streams;

internal static class Program {
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    private static extern int SetCurrentProcessExplicitAppUserModelID(string id);
    private static readonly object OutputLock = new();
    private static void Send(object value) { lock (OutputLock) { Console.WriteLine(JsonSerializer.Serialize(value)); Console.Out.Flush(); } }
    private static double Number(JsonElement j, string key) => j.TryGetProperty(key, out var v) && v.TryGetDouble(out var n) && double.IsFinite(n) ? Math.Clamp(n, 0, 604800) : 0;
    private static string Text(JsonElement j, string key) => j.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String ? (v.GetString() ?? "")[..Math.Min(2048, (v.GetString() ?? "").Length)] : "";
    private static bool Flag(JsonElement j, string key) => j.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.True;

    [MTAThread]
    private static int Main() {
        Console.InputEncoding = new UTF8Encoding(false); Console.OutputEncoding = new UTF8Encoding(false);
        try {
            Marshal.ThrowExceptionForHR(SetCurrentProcessExplicitAppUserModelID("com.scada.pulse"));
            using var player = new MediaPlayer();
            player.CommandManager.IsEnabled = false;
            var smtc = player.SystemMediaTransportControls;
            smtc.IsEnabled = false;
            smtc.IsPlayEnabled = smtc.IsPauseEnabled = smtc.IsNextEnabled = smtc.IsPreviousEnabled = smtc.IsStopEnabled = true;
            smtc.ButtonPressed += (_, e) => {
                var command = e.Button switch {
                    SystemMediaTransportControlsButton.Play => "play",
                    SystemMediaTransportControlsButton.Pause => "pause",
                    SystemMediaTransportControlsButton.Stop => "pause",
                    SystemMediaTransportControlsButton.Next => "next",
                    SystemMediaTransportControlsButton.Previous => "prev",
                    _ => null
                };
                if (command != null) Send(new { type = "command", command });
            };
            smtc.PlaybackPositionChangeRequested += (_, e) => Send(new { type = "command", command = "seekSeconds", value = Math.Max(0, e.RequestedPlaybackPosition.TotalSeconds) });
            Send(new { type = "ready", protocol = 1 });
            string? lastMetadata = null;
            string? line;
            while ((line = Console.ReadLine()) != null) {
                if (line.Length > 32768) continue;
                using var document = JsonDocument.Parse(line);
                var j = document.RootElement;
                if (Text(j, "type") == "quit") break;
                if (Text(j, "type") != "state") continue;
                var has = Flag(j, "has");
                if (!has) {
                    smtc.PlaybackStatus = MediaPlaybackStatus.Stopped; smtc.IsEnabled = false;
                    smtc.DisplayUpdater.ClearAll(); smtc.DisplayUpdater.Update(); lastMetadata = null; continue;
                }
                smtc.IsEnabled = true;
                var metadata = JsonSerializer.Serialize(new { title = Text(j, "title"), author = Text(j, "author"), album = Text(j, "album"), artwork = Text(j, "artwork") });
                if (metadata != lastMetadata) {
                    var updater = smtc.DisplayUpdater;
                    updater.ClearAll(); updater.Type = MediaPlaybackType.Music;
                    updater.AppMediaId = Text(j, "id");
                    updater.MusicProperties.Title = Text(j, "title");
                    updater.MusicProperties.Artist = Text(j, "author");
                    updater.MusicProperties.AlbumTitle = Text(j, "album");
                    // Only the parent's own loopback image endpoint is accepted.
                    if (Uri.TryCreate(Text(j, "artwork"), UriKind.Absolute, out var art) && art.Scheme == "http" && art.Host == "127.0.0.1" && (art.AbsolutePath == "/img" || art.AbsolutePath.StartsWith("/offline/")))
                        updater.Thumbnail = RandomAccessStreamReference.CreateFromUri(art);
                    updater.Update(); lastMetadata = metadata;
                }
                var duration = Number(j, "dur");
                smtc.UpdateTimelineProperties(new SystemMediaTransportControlsTimelineProperties {
                    StartTime = TimeSpan.Zero, MinSeekTime = TimeSpan.Zero,
                    EndTime = TimeSpan.FromSeconds(duration), MaxSeekTime = TimeSpan.FromSeconds(duration),
                    Position = TimeSpan.FromSeconds(Math.Min(duration, Number(j, "cur")))
                });
                smtc.PlaybackStatus = Flag(j, "playing") ? MediaPlaybackStatus.Playing : MediaPlaybackStatus.Paused;
            }
            smtc.PlaybackStatus = MediaPlaybackStatus.Closed; smtc.IsEnabled = false;
            return 0;
        } catch (Exception e) {
            Send(new { type = "error", message = e.GetType().Name, hresult = e.HResult });
            return 1;
        }
    }
}
