using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

namespace RitmikaLauncher
{
    static class Program
    {
        static Process serverProcess;

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            if (!IsWebView2Available())
            {
                var res = MessageBox.Show(
                    "Microsoft Edge WebView2 Runtime no está instalado.\n\n" +
                    "Rítmika necesita WebView2 para mostrar la pantalla de juego.\n" +
                    "¿Deseas abrir la página de descarga ahora?\n\n" +
                    "(Se abrirá https://go.microsoft.com/fwlink/p/?LinkId=2124703)",
                    "Rítmika — WebView2 requerido",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Warning);
                if (res == DialogResult.Yes)
                {
                    try { Process.Start("https://go.microsoft.com/fwlink/p/?LinkId=2124703"); } catch { }
                }
                // Continuar de todas formas — GameWindow intentará inicializar y mostrará error detallado si falla
            }

            // Ensure server is killed even on crash
            Application.ApplicationExit += (s, e) => KillServer();
            AppDomain.CurrentDomain.ProcessExit += (s, e) => KillServer();

            StartServer();

            // string welcome = Path.Combine(Application.StartupPath, "public", "assets", "audio", "new_game.mp3");
            // if (File.Exists(welcome))
            //     AudioPlayer.PlayOnce(welcome);

            try
            {
                Application.Run(new GameWindow());
            }
            finally
            {
                KillServer();
            }
        }

        static void StartServer()
        {
            KillPort3000();
            KillServer();
            string nodeExe = FindNode();

            if (nodeExe == null)
            {
                string bundledPath = Path.Combine(Application.StartupPath, "runtime", "node", "node.exe");
                MessageBox.Show(
                    "No se encontró el runtime de Node.js.\n\n" +
                    "Rítmika incluye Node en: runtime\\node\\node.exe\n" +
                    "Si instalaste desde Ritmika-Setup-x64.exe, reinstala.\n" +
                    "Si ejecutas desde código fuente, instala Node LTS desde https://nodejs.org\n" +
                    "y asegúrate de que 'node' esté en el PATH, o coloca node.exe en:\n" + bundledPath + "\n\n" +
                    "Después de instalar Node, ejecuta: npm install (solo para desarrollo).",
                    "Rítmika — Node.js no encontrado",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                Environment.Exit(1);
                return;
            }

            // Preparar directorios en LOCALAPPDATA para logs/cache (no requiere admin en Program Files)
            string appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Ritmika");
            string logDir = Path.Combine(appData, "logs");
            string cacheDir = Path.Combine(appData, "cache", "videos");
            try { Directory.CreateDirectory(logDir); Directory.CreateDirectory(cacheDir); } catch { }

            var psi = new ProcessStartInfo
            {
                FileName = nodeExe,
                Arguments = string.Format("\"{0}\"",
                    Path.Combine(Application.StartupPath, "server", "index.js")),
                WorkingDirectory = Application.StartupPath,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };
            // Variables para modo online y cache local
            psi.EnvironmentVariables["PORT"] = "3000";
            psi.EnvironmentVariables["VIDEO_CACHE_DIR"] = cacheDir;
            psi.EnvironmentVariables["VIDEO_CACHE_MAX_MB"] = "2048";
            // Si existe runtime/node, usarlo; si no, el sistema ya está en nodeExe
            // No exponer R2 secrets en el instalador — solo si el usuario los configura localmente en %LOCALAPPDATA%\Ritmika\.env

            serverProcess = new Process { StartInfo = psi };
            try
            {
                serverProcess.Start();
                // Write stdout/stderr to LOCALAPPDATA log (y fallback a startupPath si falla)
                string logPath = Path.Combine(logDir, "server.log");
                try { if (!Directory.Exists(logDir)) Directory.CreateDirectory(logDir); } catch { logPath = Path.Combine(Application.StartupPath, "server.log"); }
                var logWriter = new StreamWriter(logPath, false) { AutoFlush = true };
                serverProcess.OutputDataReceived += (s, e) => { if (e.Data != null) logWriter.WriteLine(e.Data); };
                serverProcess.ErrorDataReceived += (s, e) => { if (e.Data != null) logWriter.WriteLine(e.Data); };
                serverProcess.BeginOutputReadLine();
                serverProcess.BeginErrorReadLine();
            }
            catch { }
        }

        static void KillPort3000()
        {
            try
            {
                using (var p = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "powershell.exe",
                        Arguments = "-ExecutionPolicy Bypass -NoProfile -Command \"$c = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue; if ($c) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue }\"",
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                })
                {
                    p.Start();
                    p.WaitForExit(4000);
                }
            }
            catch { }
        }

        static void KillServer()
        {
            if (serverProcess != null && !serverProcess.HasExited)
            {
                try
                {
                    // Kill entire process tree (node + any ffmpeg children)
                    using (var kill = new Process
                    {
                        StartInfo = new ProcessStartInfo
                        {
                            FileName = "taskkill",
                            Arguments = string.Format("/PID {0} /T /F", serverProcess.Id),
                            UseShellExecute = false,
                            CreateNoWindow = true
                        }
                    })
                    {
                        kill.Start();
                        kill.WaitForExit(3000);
                    }
                    serverProcess.Kill();
                }
                catch { }
                serverProcess.Dispose();
                serverProcess = null;
            }
        }

        static string FindNode()
        {
            // 1. Prioridad: Node incluido en runtime/node/node.exe (distribución autocontenida)
            try
            {
                string bundled = Path.Combine(Application.StartupPath, "runtime", "node", "node.exe");
                if (File.Exists(bundled)) return bundled;
                // También buscar en runtime/node-v*/node.exe por si el zip se extrajo con carpeta versionada
                string runtimeDir = Path.Combine(Application.StartupPath, "runtime", "node");
                if (Directory.Exists(runtimeDir))
                {
                    foreach (var f in Directory.GetFiles(runtimeDir, "node.exe", SearchOption.AllDirectories))
                        if (File.Exists(f)) return f;
                }
            }
            catch { }

            // 2. Fallback: Node del sistema (where node)
            try
            {
                using (var p = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "where",
                        Arguments = "node",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        CreateNoWindow = true
                    }
                })
                {
                    p.Start();
                    string path = p.StandardOutput.ReadLine();
                    p.WaitForExit(2000);
                    if (!string.IsNullOrEmpty(path) && File.Exists(path.Trim())) return path.Trim();
                }
            }
            catch { }
            return null;
        }

        static bool IsWebView2Available()
        {
            try
            {
                // Check registry for WebView2 Runtime
                using (var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"))
                    if (key != null) return true;
                using (var key2 = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"))
                    if (key2 != null) return true;
                // Fallback: check EdgeWebView folder
                if (Directory.Exists(@"C:\Program Files (x86)\Microsoft\EdgeWebView\Application")) return true;
                if (File.Exists(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\EdgeWebView\Application\msedgewebview2.exe"))) return true;
            }
            catch { }
            return false;
        }


    }

    static class AudioPlayer
    {
        [DllImport("winmm.dll")]
        static extern int mciSendString(string command, StringBuilder ret, int retLen, IntPtr hwnd);
        const string ALIAS = "ritmika_bgm";

        public static void PlayOnce(string filePath)
        {
            if (!File.Exists(filePath)) return;
            mciSendString(string.Format("open \"{0}\" type mpegvideo alias {1}", filePath, ALIAS), null, 0, IntPtr.Zero);
            mciSendString(string.Format("play {0}", ALIAS), null, 0, IntPtr.Zero);
        }

        public static void PlayLoop(string filePath)
        {
            if (!File.Exists(filePath)) return;
            mciSendString(string.Format("open \"{0}\" type mpegvideo alias {1}", filePath, ALIAS), null, 0, IntPtr.Zero);
            mciSendString(string.Format("play {0} repeat", ALIAS), null, 0, IntPtr.Zero);
        }

        public static void Stop()
        {
            mciSendString(string.Format("stop {0}", ALIAS), null, 0, IntPtr.Zero);
            mciSendString(string.Format("close {0}", ALIAS), null, 0, IntPtr.Zero);
        }
    }

    class RButton : Control
    {
        int radius = 10;
        Color bg, bgHover, textColor;
        bool hovered;

        public RButton(string text, Color bg, Color fg)
        {
            this.Text = text;
            this.bg = bg;
            this.bgHover = Color.FromArgb(
                Math.Min(255, bg.R + 20),
                Math.Min(255, bg.G + 20),
                Math.Min(255, bg.B + 20));
            this.textColor = fg;
            this.Font = new Font("Segoe UI", 11, FontStyle.Bold);
            this.Cursor = Cursors.Hand;
            this.DoubleBuffered = true;
            this.Size = new Size(170, 44);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.HighQuality;
            g.TextRenderingHint = TextRenderingHint.AntiAlias;

            using (var path = new GraphicsPath())
            {
                path.AddArc(0, 0, radius * 2, radius * 2, 180, 90);
                path.AddArc(Width - radius * 2 - 1, 0, radius * 2, radius * 2, 270, 90);
                path.AddArc(Width - radius * 2 - 1, Height - radius * 2 - 1, radius * 2, radius * 2, 0, 90);
                path.AddArc(0, Height - radius * 2 - 1, radius * 2, radius * 2, 90, 90);
                path.CloseFigure();

                using (var b = new SolidBrush(hovered ? bgHover : bg))
                    g.FillPath(b, path);

                using (var p = new Pen(Color.FromArgb(40, 255, 255, 255)))
                    g.DrawPath(p, path);
            }

            using (var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center })
            using (var b = new SolidBrush(textColor))
                g.DrawString(Text, Font, b, ClientRectangle, sf);
        }

        protected override void OnMouseEnter(EventArgs e) { hovered = true; Invalidate(); }
        protected override void OnMouseLeave(EventArgs e) { hovered = false; Invalidate(); }
    }

    class RPanel : Panel
    {
        int radius = 12;

        public RPanel()
        {
            DoubleBuffered = true;
            BackColor = ColorTranslator.FromHtml("#1e293b");
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.HighQuality;
            using (var path = new GraphicsPath())
            {
                int r = radius, w = Width, h = Height;
                path.AddArc(0, 0, r * 2, r * 2, 180, 90);
                path.AddArc(w - r * 2 - 1, 0, r * 2, r * 2, 270, 90);
                path.AddArc(w - r * 2 - 1, h - r * 2 - 1, r * 2, r * 2, 0, 90);
                path.AddArc(0, h - r * 2 - 1, r * 2, r * 2, 90, 90);
                path.CloseFigure();

                using (var b = new SolidBrush(BackColor))
                    g.FillPath(b, path);
                using (var p = new Pen(Color.FromArgb(30, 148, 163, 184)))
                    g.DrawPath(p, path);
            }
        }

        protected override void OnResize(EventArgs e) { Invalidate(); }
    }
}
