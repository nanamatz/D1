# Steam Release Runbook

This runbook covers the supported desktop targets: Windows x64 and macOS
Universal (`x86_64` + `arm64`). Linux and SteamOS remain unsupported. The two
platform depots are assembled into one Steam App build. Steam SDK integration,
achievements, overlay, leaderboards, installers, CI upload, and Dynamic Cloud
Sync are not implemented and must not be claimed on the store page.

## 1. Schedule and partner setup

1. Enrol in Steam Direct and pay the **US$100 fee per app**. For the first titles
   released by an account, the fee must have been paid at least **30 days** before
   release. See the [Steam Direct fee documentation](https://partner.steampowered.com/doc/gettingstarted/appfee).
2. Create the app and separate Windows and macOS depots. Restrict each depot to
   its matching OS in Steamworks. Record the positive numeric AppID, Windows
   DepotID, and Mac DepotID outside the repository; never commit IDs or credentials.
3. Add **both** the Windows DepotID and Mac DepotID to the Developer Comp package
   and to every intended release/customer package. Publish the package changes,
   then confirm the beta test account owns both depots before any upload test.
4. Publish the [Coming Soon page](https://partner.steampowered.com/doc/store/coming_soon)
   at least **two weeks** before release.
5. Budget at least seven business days for each review submission. Valve says
   store-page and build reviews normally take **3-5 business days**. Submit the
   [store page for review](https://partner.steampowered.com/doc/store/review_process)
   before submitting the build review.

## 2. Store page

Use the public title `Play the Wor!d`. The bundle, internal application name,
and Windows executable remain `Play the World`; changing that internal name
would orphan existing saves.

Claim only these supported platforms:

- Windows
- macOS

Do not select Linux + SteamOS or Android. Claim only English and Korean
**Interface** support; do not claim Full Audio or Subtitles. Do not advertise
any unimplemented Steam feature.

### System requirements

Enter the following conservative requirements, then verify the minimum rows on
real low-end hardware before build review.

| Windows | Minimum | Recommended |
|---|---|---|
| OS | Windows 10 64-bit | Windows 11 64-bit |
| Processor | 64-bit dual-core processor, 2.0 GHz | 64-bit quad-core processor, 2.5 GHz |
| Memory | 4 GB RAM | 8 GB RAM |
| Graphics | DirectX 11-compatible graphics | DirectX 11-compatible graphics |
| DirectX | Version 11 | Version 11 |
| Storage | 1 GB available space | 1 GB available space |
| Sound | Windows-compatible audio device | Windows-compatible audio device |
| Additional | Requires a 64-bit processor and operating system. | Requires a 64-bit processor and operating system. |

| macOS | Minimum | Recommended |
|---|---|---|
| OS | macOS 13 Ventura | macOS 14 or later |
| Processor | Intel 64-bit processor or Apple Silicon | Apple Silicon |
| Memory | 4 GB RAM | 8 GB RAM |
| Graphics | Metal-compatible graphics | Metal-compatible graphics |
| Storage | 1 GB available space | 1 GB available space |
| Additional | Requires a 64-bit processor and operating system. | Requires a 64-bit processor and operating system. |

Neither platform requires a broadband connection or VR support.

Provide Valve's current required capsules, library assets, and at least five
1920 x 1080 gameplay screenshots. Screenshots must show gameplay rather than
concept art, pre-rendered marketing stills, awards, review scores, or text overlays.

## 3. Build the release candidate

Freeze one candidate version and commit SHA. Use a clean dependency install on
both release hosts.

### Windows x64 host

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run e2e:smoke
npm.cmd run build:desktop:win
```

Confirm `../D1-release/win-unpacked/Play the World.exe` exists. Launch the
packaged executable and verify start, save, quit, resume, fullscreen, audio,
input, and offline play.

### macOS release host

The macOS build, Developer ID signing, notarization, stapling, native Apple
Silicon validation, and Intel/Rosetta validation must be performed on a Mac.
Install the **Developer ID Application** certificate in the release keychain.
Provide signing and notarization credentials only through the macOS keychain or
electron-builder's supported environment-variable mechanism; never write them
to this repository, VDFs, shell history, or this runbook.

```sh
npm ci
npm test
npm run e2e:smoke
npm run build:desktop:mac
```

The package config enables hardened runtime and notarization when valid
credentials are present. Confirm the output at
`../D1-release/mac-universal/Play the World.app`, then run:

```sh
lipo -archs "../D1-release/mac-universal/Play the World.app/Contents/MacOS/Play the World"
codesign --verify --deep --strict --verbose=2 "../D1-release/mac-universal/Play the World.app"
xcrun stapler staple "../D1-release/mac-universal/Play the World.app"
xcrun stapler validate "../D1-release/mac-universal/Play the World.app"
spctl --assess --type execute --verbose=4 "../D1-release/mac-universal/Play the World.app"
```

`lipo` must report both `x86_64` and `arm64`; every other command must succeed.
Also launch the packaged app on Apple Silicon and on Intel hardware or Rosetta,
and verify the same play/save/offline checklist as Windows. The Windows release
host cannot substitute for these checks.

Only after the `lipo`, `codesign`, notarization, stapler, and `spctl` evidence
above passes, enable these Steamworks macOS platform flags:

- **64-bit binaries included**
- **App Bundles Are Notarized**

`npm run build:desktop` remains a host-native convenience command. Official
release artifacts always use the explicit platform scripts above.

## 4. Prepare and upload both depots

Place both validated outputs under the same `../D1-release` content root. Run
the cross-platform preview generator on the Mac release host so SteamCMD reads
the `.app` with executable permissions intact:

```sh
node scripts/prepare-steam-build.mjs \
  --app-id 123456 \
  --windows-depot-id 123457 \
  --mac-depot-id 123458 \
  --version 1.0.0 \
  --commit abc1234
```

The generator validates three distinct positive IDs and both artifacts, writes
UTF-8 VDF files to `../D1-steampipe`, and keeps `BuildOutput` outside the shared
content root. Checked-in templates default to `Preview 1`, contain no
credentials or `SetLive`, and map only these directories:

- Windows depot: `win-unpacked/*`
- macOS depot: `mac-universal/*`

PowerShell users may invoke the compatibility wrapper:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-steam-build.ps1 `
  -AppId 123456 -WindowsDepotId 123457 -MacDepotId 123458 `
  -Version 1.0.0 -Commit abc1234
```

Configure two Steamworks launch options.

Windows launch option:

- Executable: `Play the World.exe`
- Arguments: none
- Operating system: Windows

macOS launch option:

- Executable: `Play the World.app`
- Arguments: none
- Operating system: macOS

Follow the official [SteamPipe upload](https://partner.steampowered.com/doc/sdk/uploading)
process. SteamCMD authentication remains interactive. Never put a password or
Steam Guard code in a command, VDF, script, shell history, or CI secret.

1. Run `../D1-steampipe/app_build.vdf` through SteamCMD and inspect the Preview
   manifest for both platform depots.
2. Generate upload VDFs by adding `--upload` (or `-Upload` to the PowerShell
   wrapper). This only switches generated `Preview` from `1` to `0`; it does not
   start SteamCMD or accept credentials.
3. Upload from macOS, record the BuildID, candidate SHA, version, date, and log.
4. Assign the BuildID to a password-protected beta branch. Clean-install from
   Steam and verify each OS. Do not test only unpacked builds.

## 5. Configure cross-platform Steam Auto-Cloud

The JSON save format is identical on Windows and macOS. Configure **one logical
set** of four non-recursive Root Paths with a 10 MiB per-user byte quota and a
10-file per-user quota:

| Root | Subdirectory | Pattern | OS | Recursive |
|---|---|---|---|---|
| `WinAppDataRoaming` | `Play the World/saves` | `run.json` | All OSes | Off |
| `WinAppDataRoaming` | `Play the World/saves` | `profile.json` | All OSes | Off |
| `WinAppDataRoaming` | `Play the World/saves` | `run.json.bak` | All OSes | Off |
| `WinAppDataRoaming` | `Play the World/saves` | `profile.json.bak` | All OSes | Off |

Then add one macOS Root Override:

- Original Root: `WinAppDataRoaming`
- New Root: `MacAppSupport`
- OS: macOS
- Path replacement: none; keep the same `Play the World/saves` subdirectory

Do not create eight OS-partitioned Root Paths: the override is what makes the
same logical save set resolve to `%APPDATA%/Play the World/saves` on Windows and
`~/Library/Application Support/Play the World/saves` on macOS. Do not use wildcards.
This deliberately excludes temporary files, `window-state.json`,
Chromium data, settings, language, sort mode, and the active-profile preference.
Do not enable [Dynamic Cloud Sync](https://partner.steampowered.com/doc/features/cloud/dynamiccloudsync):
the game does not handle files changing while it is running.

Test Windows → macOS and macOS → Windows: play and exit on A, confirm the data
on B, change and exit on B, then confirm it returns to A. Also test a corrupt
primary recovering from `.bak`. Local saves are keyed by OS user rather than
Steam account, so use separate OS users for account-isolation testing.

## 6. Review, release, and rollback

1. Submit the tested store page, then the exact cross-platform BuildID, for review.
2. After approval, keep that BuildID on the release branch. A rebuild requires
   repeating affected validation and, when applicable, review.
3. Manually choose **Release App**. Approval does not release automatically.
4. Monitor install, launch, saves, and Cloud on both OSes. Roll back by assigning
   the previous recorded and validated BuildID; VDFs never automate live branches.

## Release record

Record candidate version, commit SHA, AppID, both DepotIDs, uploaded BuildID,
Windows signing status, macOS Developer ID/notarization/stapling results, review
dates, released BuildID, and rollback BuildID. Store no credentials in the
record or repository.
