# Running Inkubator without Docker

Inkubator is also a single program you can download and run on Windows, macOS
or Linux. Nothing else needs to be installed. This is the quickest way to try
it on your own computer.

Inkubator runs while its window (the terminal) is open, and you use it in your
browser. When you close the window, Inkubator stops; your collection stays
safe in its data folder.

## Step 1: Download

Go to the [latest release](https://github.com/aloglu/inkubator/releases/latest)
and download the file for your computer:

| Computer | File |
| --- | --- |
| Windows | `inkubator-…-windows-x86_64.zip` |
| Mac with Apple Silicon (M1 and later) | `inkubator-…-macos-arm64.tar.gz` |
| Mac with an Intel processor | `inkubator-…-macos-x86_64.tar.gz` |
| Linux on a regular PC | `inkubator-…-linux-x86_64.tar.gz` |
| Linux on ARM (Raspberry Pi and others, 64-bit) | `inkubator-…-linux-arm64.tar.gz` |

Not sure which Mac you have? Apple menu → **About This Mac**: "Chip: Apple M…"
means Apple Silicon; "Processor: Intel" means Intel.

Unpack the file: on Windows, right-click → **Extract All**; on macOS and
Linux, double-click it or run `tar xzf` on it. You get a folder with the
program, `inkubator` (`inkubator.exe` on Windows).

## Step 2: Open a terminal in that folder

- **Windows:** open the folder in File Explorer, click the address bar, type
  `powershell` and press **Enter**.
- **macOS:** open the **Terminal** app, type `cd ` (with a space), drag the
  folder onto the Terminal window, and press **Enter**.
- **Linux:** right-click in the folder and choose **Open in Terminal**, or use
  `cd` to get there.

## Step 3: Set your password (once)

Run:

| System | Command |
| --- | --- |
| Windows | `.\inkubator.exe set-password` |
| macOS, Linux | `./inkubator set-password` |

Type a password (at least 8 characters) and press **Enter**, then type it again.
Nothing appears while you type; that is normal. Your user name is `admin`.

**macOS says the program "cannot be opened" or "is damaged":** macOS is wary
of programs downloaded from the internet that are not from the App Store. Run
this once in the same Terminal window, then try again:

```bash
xattr -d com.apple.quarantine inkubator
```

**Windows shows "Windows protected your PC":** click **More info**, then **Run
anyway**.

## Step 4: Start Inkubator

| System | Command |
| --- | --- |
| Windows | `.\inkubator.exe` |
| macOS, Linux | `./inkubator` |

You should see:

```text
Inkubator 3.0.0 is running. Open http://localhost:8080 in your browser.
Your collection is kept in …
```

Open **http://localhost:8080** and sign in. Keep the terminal window open
while you use Inkubator; press **Ctrl+C** in it to stop.

On Windows, the firewall may ask whether Inkubator may use the network. Allow
it on **private networks** if you want to use Inkubator from your phone at home.

## Where your collection is kept

Unless you choose a folder, Inkubator keeps everything in:

| System | Folder |
| --- | --- |
| Windows | `%APPDATA%\Inkubator` (usually `C:\Users\you\AppData\Roaming\Inkubator`) |
| macOS | `~/Library/Application Support/Inkubator` |
| Linux | `~/.local/share/Inkubator` |

To use another folder, add `--data-dir` to every command, for example
`./inkubator --data-dir ~/Documents/Inkubator` (and the same with
`set-password`).

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `--data-dir <folder>` | the folder above | Where your collection is kept |
| `--port <number>` | `8080` | The port in the address (`http://localhost:8080`) |
| `--host <address>` | `0.0.0.0` | Who may connect: `0.0.0.0` lets other devices at home reach it; `127.0.0.1` allows only this computer |

`./inkubator --help` lists everything.

## Using it from your phone

While Inkubator runs, other devices on your home Wi-Fi can open it at your
computer's address, for example `http://192.168.1.20:8080`. To find the
address: on Windows run `ipconfig`; on macOS open System Settings → Wi-Fi →
Details; on Linux run `hostname -I`. Your computer has to be on and Inkubator
running, which is why a server or NAS is a better long-term home (see the
[guides](README.md)).

## Starting automatically on Linux

On Linux, Inkubator can run in the background and start when you log in. Save
this as `~/.config/systemd/user/inkubator.service`, with the path to where you
put the program:

```ini
[Unit]
Description=Inkubator

[Service]
ExecStart=/home/you/inkubator/inkubator
Restart=on-failure

[Install]
WantedBy=default.target
```

Then run:

```bash
systemctl --user daemon-reload
systemctl --user enable --now inkubator
```

To keep it running after you log out, also run `loginctl enable-linger`.

## Next

- [Using Inkubator](using-inkubator.md)
- [Backups](backups.md)
- [Updating](updating.md): download the new version and replace the program
  file; your data folder stays as it is.
