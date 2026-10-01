using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

class SetupForm : Form
{
    private Panel headerPanel;
    private PictureBox picLogo;
    private Label lblAppName;
    private Label lblAppTagline;
    private Panel cardPanel;
    private Label lblWelcome;
    private Label lblFeatures;
    private CheckBox chkCreateShortcut;
    private Button btnInstall;
    private ProgressBar progressBar;
    private Label lblStatus;
    private Label lblPercent;
    private Label lblSuccess;
    private CheckBox chkLaunchNow;
    private Button btnFinish;
    private BackgroundWorker worker;
    private string installPath;

    [STAThread]
    static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new SetupForm());
    }

    public SetupForm()
    {
        this.Text = "ChatGPT Checker - Setup";
        this.Size = new Size(540, 420);
        this.FormBorderStyle = FormBorderStyle.FixedDialog;
        this.MaximizeBox = false;
        this.StartPosition = FormStartPosition.CenterScreen;
        this.BackColor = Color.FromArgb(15, 23, 42); // Slate 900
        this.ForeColor = Color.White;
        this.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);

        installPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "ChatGPTChecker");

        // Load Icon
        try
        {
            using (Stream iconStream = Assembly.GetExecutingAssembly().GetManifestResourceStream("Logo.ico"))
            {
                if (iconStream != null) this.Icon = new Icon(iconStream);
            }
        }
        catch { }

        // Header Panel
        headerPanel = new Panel();
        headerPanel.Location = new Point(0, 0);
        headerPanel.Size = new Size(540, 95);
        headerPanel.BackColor = Color.FromArgb(15, 23, 42);

        // Logo PictureBox
        picLogo = new PictureBox();
        picLogo.Location = new Point(28, 16);
        picLogo.Size = new Size(62, 62);
        picLogo.SizeMode = PictureBoxSizeMode.Zoom;
        picLogo.BackColor = Color.Transparent;

        try
        {
            using (Stream imgStream = Assembly.GetExecutingAssembly().GetManifestResourceStream("Logo.png"))
            {
                if (imgStream != null) picLogo.Image = Image.FromStream(imgStream);
            }
        }
        catch { }

        lblAppName = new Label();
        lblAppName.Text = "ChatGPT Checker";
        lblAppName.Font = new Font("Segoe UI", 17f, FontStyle.Bold);
        lblAppName.ForeColor = Color.White;
        lblAppName.Location = new Point(102, 18);
        lblAppName.AutoSize = true;

        lblAppTagline = new Label();
        lblAppTagline.Text = "Official Setup & Installation Wizard  |  v1.7.0";
        lblAppTagline.Font = new Font("Segoe UI", 9f, FontStyle.Regular);
        lblAppTagline.ForeColor = Color.FromArgb(148, 163, 184); // Slate 400
        lblAppTagline.Location = new Point(105, 52);
        lblAppTagline.AutoSize = true;

        headerPanel.Controls.Add(picLogo);
        headerPanel.Controls.Add(lblAppName);
        headerPanel.Controls.Add(lblAppTagline);
        this.Controls.Add(headerPanel);

        // Card Panel (Interior clean container)
        cardPanel = new Panel();
        cardPanel.Location = new Point(24, 105);
        cardPanel.Size = new Size(478, 255);
        cardPanel.BackColor = Color.FromArgb(30, 41, 59); // Slate 800

        // Step 1: Welcome Elements
        lblWelcome = new Label();
        lblWelcome.Text = "Ready to install ChatGPT Checker on your computer.";
        lblWelcome.Font = new Font("Segoe UI", 11.5f, FontStyle.Bold);
        lblWelcome.ForeColor = Color.FromArgb(241, 245, 249);
        lblWelcome.Location = new Point(24, 20);
        lblWelcome.Size = new Size(430, 28);

        lblFeatures = new Label();
        lblFeatures.Text = "• Blazing Fast Startup (Under 1 second)\n• Automated Account 2FA & Plan Checking\n• 100% Standalone (No Node.js or Python setup required)\n• Modern Isolated Security Runtime";
        lblFeatures.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
        lblFeatures.ForeColor = Color.FromArgb(203, 213, 225); // Slate 300
        lblFeatures.Location = new Point(24, 55);
        lblFeatures.Size = new Size(430, 85);

        chkCreateShortcut = new CheckBox();
        chkCreateShortcut.Text = "Create Desktop Shortcut";
        chkCreateShortcut.Checked = true;
        chkCreateShortcut.ForeColor = Color.FromArgb(226, 232, 240);
        chkCreateShortcut.Location = new Point(26, 150);
        chkCreateShortcut.Size = new Size(250, 24);
        chkCreateShortcut.Cursor = Cursors.Hand;

        btnInstall = new Button();
        btnInstall.Text = "Install Now";
        btnInstall.Location = new Point(310, 195);
        btnInstall.Size = new Size(144, 40);
        btnInstall.BackColor = Color.FromArgb(14, 165, 233); // Sky 500
        btnInstall.ForeColor = Color.White;
        btnInstall.FlatStyle = FlatStyle.Flat;
        btnInstall.FlatAppearance.BorderSize = 0;
        btnInstall.Font = new Font("Segoe UI", 10.5f, FontStyle.Bold);
        btnInstall.Cursor = Cursors.Hand;
        btnInstall.Click += BtnInstall_Click;

        // Step 2: Progress Elements (Hidden initially)
        progressBar = new ProgressBar();
        progressBar.Location = new Point(24, 75);
        progressBar.Size = new Size(430, 20);
        progressBar.Visible = false;

        lblStatus = new Label();
        lblStatus.Text = "Preparing installation...";
        lblStatus.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
        lblStatus.ForeColor = Color.FromArgb(203, 213, 225);
        lblStatus.Location = new Point(24, 105);
        lblStatus.Size = new Size(350, 25);
        lblStatus.Visible = false;

        lblPercent = new Label();
        lblPercent.Text = "0%";
        lblPercent.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
        lblPercent.ForeColor = Color.FromArgb(56, 189, 248); // Sky 400
        lblPercent.Location = new Point(374, 105);
        lblPercent.Size = new Size(80, 25);
        lblPercent.TextAlign = ContentAlignment.TopRight;
        lblPercent.Visible = false;

        // Step 3: Finish Elements (Hidden initially)
        lblSuccess = new Label();
        lblSuccess.Text = "✓ Installation Completed Successfully!";
        lblSuccess.Font = new Font("Segoe UI", 13f, FontStyle.Bold);
        lblSuccess.ForeColor = Color.FromArgb(52, 211, 153); // Emerald 400
        lblSuccess.Location = new Point(24, 40);
        lblSuccess.Size = new Size(430, 32);
        lblSuccess.Visible = false;

        chkLaunchNow = new CheckBox();
        chkLaunchNow.Text = "Launch ChatGPT Checker now";
        chkLaunchNow.Checked = true;
        chkLaunchNow.ForeColor = Color.FromArgb(226, 232, 240);
        chkLaunchNow.Location = new Point(28, 95);
        chkLaunchNow.Size = new Size(300, 26);
        chkLaunchNow.Cursor = Cursors.Hand;
        chkLaunchNow.Visible = false;

        btnFinish = new Button();
        btnFinish.Text = "Finish";
        btnFinish.Location = new Point(310, 195);
        btnFinish.Size = new Size(144, 40);
        btnFinish.BackColor = Color.FromArgb(16, 185, 129); // Emerald 500
        btnFinish.ForeColor = Color.White;
        btnFinish.FlatStyle = FlatStyle.Flat;
        btnFinish.FlatAppearance.BorderSize = 0;
        btnFinish.Font = new Font("Segoe UI", 10.5f, FontStyle.Bold);
        btnFinish.Cursor = Cursors.Hand;
        btnFinish.Visible = false;
        btnFinish.Click += BtnFinish_Click;

        cardPanel.Controls.Add(lblWelcome);
        cardPanel.Controls.Add(lblFeatures);
        cardPanel.Controls.Add(chkCreateShortcut);
        cardPanel.Controls.Add(btnInstall);
        cardPanel.Controls.Add(progressBar);
        cardPanel.Controls.Add(lblStatus);
        cardPanel.Controls.Add(lblPercent);
        cardPanel.Controls.Add(lblSuccess);
        cardPanel.Controls.Add(chkLaunchNow);
        cardPanel.Controls.Add(btnFinish);

        this.Controls.Add(cardPanel);

        // Worker
        worker = new BackgroundWorker();
        worker.WorkerReportsProgress = true;
        worker.DoWork += Worker_DoWork;
        worker.ProgressChanged += Worker_ProgressChanged;
        worker.RunWorkerCompleted += Worker_RunWorkerCompleted;
    }

    private void BtnInstall_Click(object sender, EventArgs e)
    {
        lblWelcome.Visible = false;
        lblFeatures.Visible = false;
        chkCreateShortcut.Visible = false;
        btnInstall.Visible = false;

        progressBar.Visible = true;
        lblStatus.Visible = true;
        lblPercent.Visible = true;

        worker.RunWorkerAsync();
    }

    private void Worker_DoWork(object sender, DoWorkEventArgs e)
    {
        try
        {
            if (!Directory.Exists(installPath))
            {
                Directory.CreateDirectory(installPath);
            }

            worker.ReportProgress(5, "Loading installation package...");

            Assembly asm = Assembly.GetExecutingAssembly();
            Stream resStream = asm.GetManifestResourceStream("AppFiles.zip") ?? asm.GetManifestResourceStream("AppBundle.zip");
            if (resStream == null) throw new Exception("Embedded package AppFiles.zip not found.");

            using (resStream)
            using (ZipArchive archive = new ZipArchive(resStream, ZipArchiveMode.Read))
            {
                int total = archive.Entries.Count;
                    int count = 0;
                    byte[] buffer = new byte[65536];

                    foreach (ZipArchiveEntry entry in archive.Entries)
                    {
                        count++;
                        int pct = 5 + (int)((count / (float)total) * 85);

                        string relPath = entry.FullName;
                        if (relPath.StartsWith("gptservicelite/") || relPath.StartsWith("gptservicelite\\"))
                        {
                            relPath = relPath.Substring(15);
                        }

                        if (string.IsNullOrEmpty(relPath)) continue;

                        string destFile = Path.Combine(installPath, relPath);

                        if (entry.FullName.EndsWith("/") || entry.FullName.EndsWith("\\"))
                        {
                            if (!Directory.Exists(destFile)) Directory.CreateDirectory(destFile);
                        }
                        else
                        {
                            string dir = Path.GetDirectoryName(destFile);
                            if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);

                            using (Stream entryStream = entry.Open())
                            using (FileStream fs = new FileStream(destFile, FileMode.Create, FileAccess.Write, FileShare.None, 65536))
                            {
                                int read;
                                while ((read = entryStream.Read(buffer, 0, buffer.Length)) > 0)
                                {
                                    fs.Write(buffer, 0, read);
                                }
                            }
                        }

                        if (count % 35 == 0 || count == total)
                        {
                            worker.ReportProgress(pct, "Installing: " + Path.GetFileName(relPath));
                        }
                    }
                }

            worker.ReportProgress(94, "Creating shortcuts...");
            CreateShortcuts();

            worker.ReportProgress(100, "Installation complete!");
        }
        catch (Exception ex)
        {
            e.Result = ex;
        }
    }

    private void CreateShortcuts()
    {
        try
        {
            string desktop = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
            string vbsPath = Path.Combine(installPath, "ChatGPTChecker.vbs");
            string icoPath = Path.Combine(installPath, "logo.ico");
            string linkPath = Path.Combine(desktop, "ChatGPT Checker.lnk");

            Type shellType = Type.GetTypeFromProgID("WScript.Shell");
            dynamic shell = Activator.CreateInstance(shellType);
            dynamic shortcut = shell.CreateShortcut(linkPath);
            shortcut.TargetPath = "wscript.exe";
            shortcut.Arguments = "\"" + vbsPath + "\"";
            shortcut.WorkingDirectory = installPath;
            shortcut.Description = "ChatGPT Checker - Account & Subscription Management";
            if (File.Exists(icoPath)) shortcut.IconLocation = icoPath + ",0";
            shortcut.Save();
        }
        catch { }
    }

    private void Worker_ProgressChanged(object sender, ProgressChangedEventArgs e)
    {
        progressBar.Value = Math.Min(100, Math.Max(0, e.ProgressPercentage));
        lblPercent.Text = progressBar.Value + "%";
        if (e.UserState != null)
        {
            lblStatus.Text = e.UserState.ToString();
        }
    }

    private void Worker_RunWorkerCompleted(object sender, RunWorkerCompletedEventArgs e)
    {
        Exception ex = e.Result as Exception;
        if (ex != null)
        {
            MessageBox.Show("Installation Error: " + ex.Message, "Setup Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        progressBar.Visible = false;
        lblStatus.Visible = false;
        lblPercent.Visible = false;

        lblSuccess.Visible = true;
        chkLaunchNow.Visible = true;
        btnFinish.Visible = true;
    }

    private void BtnFinish_Click(object sender, EventArgs e)
    {
        if (chkLaunchNow.Checked)
        {
            string vbsPath = Path.Combine(installPath, "ChatGPTChecker.vbs");
            if (File.Exists(vbsPath))
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "wscript.exe";
                psi.Arguments = "\"" + vbsPath + "\"";
                psi.WorkingDirectory = installPath;
                Process.Start(psi);
            }
        }
        this.Close();
    }
}
