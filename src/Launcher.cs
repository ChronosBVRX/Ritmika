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

            // Ensure server is killed even on crash
            Application.ApplicationExit += (s, e) => KillServer();
            AppDomain.CurrentDomain.ProcessExit += (s, e) => KillServer();

            StartServer();

            string welcome = Path.Combine(Application.StartupPath, "public", "assets", "audio", "new_game.mp3");
            if (File.Exists(welcome))
                AudioPlayer.PlayOnce(welcome);

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
                MessageBox.Show(
                    "No se encontró Node.js instalado.\n\n" +
                    "Rítmika requiere Node.js para funcionar.\n" +
                    "Descárgalo desde: https://nodejs.org (versión LTS recomendada).\n\n" +
                    "Después de instalar Node.js, abre una terminal en la carpeta del juego\n" +
                    "y ejecuta: npm install\n",
                    "Rítmika — Node.js no encontrado",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                Environment.Exit(1);
                return;
            }

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
            serverProcess = new Process { StartInfo = psi };
            try
            {
                serverProcess.Start();
                // Write stdout/stderr to server.log
                var logPath = Path.Combine(Application.StartupPath, "server.log");
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
                    if (File.Exists(path)) return path;
                }
            }
            catch { }
            return null;
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
