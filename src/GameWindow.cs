using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.Net;
using System.Windows.Forms;
using Microsoft.Web.WebView2.WinForms;

namespace RitmikaLauncher
{
    class GameWindow : Form
    {
        WebView2 webView;
        bool serverReady;
        bool transitioning;

        public GameWindow()
        {
            Text = "Ritmika \u2014 T\u00edo Axolo Party Game";
            StartPosition = FormStartPosition.Manual;
            FormBorderStyle = FormBorderStyle.None;
            WindowState = FormWindowState.Maximized;
            Bounds = Screen.PrimaryScreen.Bounds;
            BackColor = ColorTranslator.FromHtml("#0f172a");
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);

            // WebView2 control (visible from start for the local loading page)
            webView = new WebView2 { Dock = DockStyle.Fill, Visible = true };
            webView.DefaultBackgroundColor = ColorTranslator.FromHtml("#0f172a");
            webView.CoreWebView2InitializationCompleted += (s, e) =>
            {
                if (e.IsSuccess)
                {
                    webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
                    webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
                    webView.CoreWebView2.Settings.IsZoomControlEnabled = false;
                }
            };
            Controls.Add(webView);

            InitWebViewAsync();

            KeyPreview = true;
            KeyDown += (s, e) =>
            {
                if (e.KeyCode == Keys.F11)
                {
                    if (FormBorderStyle == FormBorderStyle.None)
                    {
                        FormBorderStyle = FormBorderStyle.Sizable;
                        WindowState = FormWindowState.Normal;
                        Bounds = restoreBounds;
                    }
                    else
                    {
                        restoreBounds = Bounds;
                        FormBorderStyle = FormBorderStyle.None;
                        WindowState = FormWindowState.Normal;
                        Bounds = Screen.PrimaryScreen.Bounds;
                    }
                }
                if (e.KeyCode == Keys.Escape) Close();
            };
        }

        Rectangle restoreBounds;

        async void InitWebViewAsync()
        {
            try
            {
                var options = new Microsoft.Web.WebView2.Core.CoreWebView2EnvironmentOptions(
                    "--autoplay-policy=no-user-gesture-required" +
                    " --enable-gpu-rasterization" +
                    " --enable-zero-copy" +
                    " --enable-accelerated-video-decode" +
                    " --disable-software-rasterizer"
                );
                var env = await Microsoft.Web.WebView2.Core.CoreWebView2Environment.CreateAsync(null, null, options);
                await webView.EnsureCoreWebView2Async(env);
                
                // Eliminar la carga de la página local (loading.html) para evitar doble pantalla
                // Simplemente esperamos a que el servidor esté listo
                
                // Iniciar polling al servidor Node.js
                var readyTimer = new Timer { Interval = 500 };
                readyTimer.Tick += (s, e) =>
                {
                    try
                    {
                        var req = WebRequest.CreateHttp("http://127.0.0.1:3000");
                        req.Timeout = 500;
                        using (var resp = req.GetResponse()) { }
                        if (!serverReady)
                        {
                            serverReady = true;
                            readyTimer.Stop();
                            LoadGame();
                        }
                    }
                    catch { }
                };
                readyTimer.Start();
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error al inicializar el motor web:\n" + ex.Message,
                    "Ritmika", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
            }
        }

        void LoadGame()
        {
            if (transitioning) return;
            transitioning = true;

            try
            {
                // Cargar el juego inmediatamente sin esperas artificiales
                webView.Source = new Uri("http://127.0.0.1:3000/?v=" + DateTime.Now.Ticks);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error al cargar el juego:\n" + ex.Message,
                    "Ritmika", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
            }
        }
    }
}
