# Steam Release Runbook

This runbook covers the supported desktop target: Windows x64. macOS, Linux,
SteamOS, and Android are unsupported. One Windows depot is assembled into the
Steam App build. Steam stat-backed achievements are implemented for packaged
Windows x64 Steam launches. Overlay forcing, leaderboards, installers, CI upload,
code signing, and Dynamic Cloud Sync are not implemented and must not be claimed.

## 1. Schedule and partner setup

1. Enrol in Steam Direct and pay the **US$100 fee per app**. For the first titles
   released by an account, the fee must have been paid at least **30 days** before
   release. See the [Steam Direct fee documentation](https://partner.steampowered.com/doc/gettingstarted/appfee).
2. Create the app and one Windows depot. Restrict the depot to Windows in
   Steamworks. Record the positive numeric AppID and Windows DepotID outside the
   repository; never commit IDs or credentials.
3. Add the Windows DepotID to the Developer Comp package and to every intended
   release/customer package. Publish the package changes, then confirm the beta
   test account owns the depot before any upload test.
4. Publish the [Coming Soon page](https://partner.steampowered.com/doc/store/coming_soon)
   at least **two weeks** before release.
5. Budget at least seven business days for each review submission. Valve says
   store-page and build reviews normally take **3-5 business days**. Submit the
   [store page for review](https://partner.steampowered.com/doc/store/review_process)
   before submitting the build review.

### Achievement Partner configuration

Create the eight integer stats and link the 16 public achievements with
Partner's automatic stat-progress unlocks. GDD §14 and
`desktop/steam-achievements.js` are the authoritative ids and thresholds. Enter
the localized copy and the 32 `256x256` JPG upload files from
`docs/STEAM_PARTNER_CONFIG.md`; do not add renderer-side activation or expose
arbitrary achievement ids through IPC. In Store Page Info, select
`Steam Achievements` under `Supported Features`, then publish the stat,
achievement, and Store Page Info changes before beta testing. This checkbox is
also required to complete the release checklist.

## 2. Store page

Use the public title `Play the Wor!d`. The internal application name and
executable remain `Play the World` and `Play the World.exe`; changing the
internal name would orphan existing saves.

Under Supported Platforms, select **Windows only**. Do not select macOS, Linux +
SteamOS, or Android. Claim only English and Korean **Interface** support; do not
claim Full Audio or Subtitles. Do not advertise any unimplemented Steam feature.

### Windows system requirements

Enter these conservative requirements, then verify the minimum row on real
low-end hardware before build review.

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

The game requires neither a broadband connection nor VR support.

Provide Valve's current required capsules, library assets, and at least five
1920 x 1080 gameplay screenshots. Screenshots must show gameplay rather than
concept art, pre-rendered marketing stills, awards, review scores, or text overlays.

## 3. Build the release candidate

Freeze one candidate version and commit SHA. From a clean dependency install on
the Windows release host, run:

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run e2e:smoke
npm.cmd run build:desktop:win
node scripts/check-steam-package.mjs ../D1-release/win-unpacked --app-id $env:STEAM_APP_ID
```

`npm run build:desktop` is an exact Windows x64 alias and may be used
interchangeably. Confirm `../D1-release/win-unpacked/Play the World.exe` exists.
`build:desktop:win` automatically runs the artifact check. Set
`$env:STEAM_APP_ID` and `$env:STEAM_WINDOWS_DEPOT_ID` to their positive numeric
values outside the repository; the shown explicit check also rejects the real
AppID literal from tracked source and the artifact. Launch the
packaged executable and verify start, save, quit, resume, fullscreen, audio,
input, and offline play. The artifact check verifies the unpacked build has
the Windows x64 native module plus `steam_api64.dll` and no `steam_appid.txt`.
Never commit or package a real AppID; production reads only the AppID supplied by
the Steam launch environment, while development AppIDs stay external.

## 4. Prepare and upload the Windows depot

Generate a safe preview configuration:

```powershell
node scripts/prepare-steam-build.mjs `
  --app-id $env:STEAM_APP_ID `
  --windows-depot-id $env:STEAM_WINDOWS_DEPOT_ID `
  --version 1.0.0 `
  --commit abc1234
```

The generator validates distinct positive IDs, the Windows executable, absolute
VDF-safe paths, and the content/output separation. It writes UTF-8 VDF files to
`../D1-steampipe`, keeps `BuildOutput` outside the content root, defaults to
`Preview 1`, contains no credentials or `SetLive`, and maps only
`win-unpacked/*` into the Windows depot.

PowerShell users may alternatively use the compatibility wrapper:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-steam-build.ps1 `
  -AppId $env:STEAM_APP_ID -WindowsDepotId $env:STEAM_WINDOWS_DEPOT_ID `
  -Version 1.0.0 -Commit abc1234
```

Configure this Steamworks launch option:

- Executable: `Play the World.exe`
- Arguments: none
- Operating system: Windows

Follow the official [SteamPipe upload](https://partner.steampowered.com/doc/sdk/uploading)
process. SteamCMD authentication remains interactive. Never put a password or
Steam Guard code in a command, VDF, script, shell history, or CI secret.

1. Run `../D1-steampipe/app_build.vdf` through SteamCMD and inspect its Preview
   manifest for the Windows depot.
2. Generate upload VDFs by adding `--upload` (or `-Upload` to the PowerShell
   wrapper). This only switches generated `Preview` from `1` to `0`; it does not
   start SteamCMD or accept credentials.
3. Upload, then record the BuildID, candidate SHA, version, date, and log.
4. Assign the BuildID to a password-protected beta branch. From Steam, perform
   a clean install and verify launch, save/quit/resume, offline mode, uninstall /
   reinstall, and input/audio/display behavior. Do not test only the unpacked build.

## 5. Configure Steam Auto-Cloud

Use [Steam Auto-Cloud](https://partner.steampowered.com/doc/features/cloud) with
a 10 MiB per-user byte quota and a 10-file per-user quota. Add exactly these four
non-recursive Windows Root Paths:

| Root | Subdirectory | Pattern | OS | Recursive |
|---|---|---|---|---|
| `WinAppDataRoaming` | `Play the World/saves` | `run.json` | Windows | Off |
| `WinAppDataRoaming` | `Play the World/saves` | `profile.json` | Windows | Off |
| `WinAppDataRoaming` | `Play the World/saves` | `run.json.bak` | Windows | Off |
| `WinAppDataRoaming` | `Play the World/saves` | `profile.json.bak` | Windows | Off |

Do not use wildcards. This deliberately excludes temporary files,
`window-state.json`, Chromium data, settings, language, sort mode, and the active
profile preference. Do not configure a Root Override. Do not enable
[Dynamic Cloud Sync](https://partner.steampowered.com/doc/features/cloud/dynamiccloudsync):
the game does not handle files changing while it is running.

Test Cloud in both directions with two PCs or isolated Windows user-data
environments. Also test a corrupt primary recovering from `.bak`. The main-only
`steamOwner` root in `profile.json` prevents Steam stat/evidence contamination;
it does not make the entire Cloud file account-private. Local save bytes remain
keyed by Windows user, so use separate Windows users whenever full save isolation
is required. The renderer snapshot and generic save IPC never expose or mutate
the owner root.

### Achievement beta validation

From a password-protected Steam beta on Windows x64, verify first-run init,
stat-linked unlocks at every threshold, P1-P3 aggregation, reinstall/Cloud
reconcile, offline launch followed by retry, and custom-seed/Reveal-All
exclusions. Launch the executable directly and verify silent no-op. Validate the
overlay without enabling a code-level overlay flag; that decision is outside v1.
Run the account matrix on one disposable Windows user: earn evidence as A, launch
as B and confirm mismatch adds/uploads nothing, then return to A and confirm its
existing evidence reconciles without decrease. Separately test zero-stat
auto-bind, positive legacy accept/decline, malformed owner fail-closed, owner
write failure, and primary-to-backup recovery. Repeat Cloud-file tests with
separate Windows users to distinguish byte isolation from statistics isolation.

## 6. Review, release, and rollback

1. Submit the tested store page, then the exact tested BuildID, for review.
2. After approval, keep that BuildID on the release branch. A rebuild requires
   repeating affected validation and, when applicable, review.
3. Manually choose **Release App**. Approval does not release automatically.
4. Monitor install, launch, saves, and Cloud. Roll back by assigning the previous
   recorded and validated BuildID; VDFs never automate live branches.

## Release record

Record candidate version, commit SHA, AppID, Windows DepotID, uploaded BuildID,
review dates, released BuildID, and rollback BuildID. Store no credentials in
the record or repository.
