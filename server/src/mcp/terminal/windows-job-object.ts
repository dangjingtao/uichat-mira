const WINDOWS_JOB_MARKER = "__MIRA_WINDOWS_JOB_OBJECT__";

const WINDOWS_JOB_BOOTSTRAP = String.raw`
$priorErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Stop'
$jobAssigned = $false
try {
  if (-not ('Mira.Terminal.NativeJob' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace Mira.Terminal {
  [StructLayout(LayoutKind.Sequential)]
  public struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
    public long PerProcessUserTimeLimit;
    public long PerJobUserTimeLimit;
    public uint LimitFlags;
    public UIntPtr MinimumWorkingSetSize;
    public UIntPtr MaximumWorkingSetSize;
    public uint ActiveProcessLimit;
    public UIntPtr Affinity;
    public uint PriorityClass;
    public uint SchedulingClass;
  }
  [StructLayout(LayoutKind.Sequential)]
  public struct IO_COUNTERS {
    public ulong ReadOperationCount;
    public ulong WriteOperationCount;
    public ulong OtherOperationCount;
    public ulong ReadTransferCount;
    public ulong WriteTransferCount;
    public ulong OtherTransferCount;
  }
  [StructLayout(LayoutKind.Sequential)]
  public struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
    public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
    public IO_COUNTERS IoInfo;
    public UIntPtr ProcessMemoryLimit;
    public UIntPtr JobMemoryLimit;
    public UIntPtr PeakProcessMemoryUsed;
    public UIntPtr PeakJobMemoryUsed;
  }
  public static class NativeJob {
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    public static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll")]
    public static extern bool SetInformationJobObject(IntPtr job, int infoClass, IntPtr info, uint length);
    [DllImport("kernel32.dll")]
    public static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll")]
    public static extern bool CloseHandle(IntPtr handle);
  }
}
'@
  }

  $job = [Mira.Terminal.NativeJob]::CreateJobObject([IntPtr]::Zero, $null)
  if ($job -ne [IntPtr]::Zero) {
    $basic = New-Object Mira.Terminal.JOBOBJECT_BASIC_LIMIT_INFORMATION
    $basic.LimitFlags = 0x00002000
    $info = New-Object Mira.Terminal.JOBOBJECT_EXTENDED_LIMIT_INFORMATION
    $info.BasicLimitInformation = $basic
    $length = [Runtime.InteropServices.Marshal]::SizeOf([type][Mira.Terminal.JOBOBJECT_EXTENDED_LIMIT_INFORMATION])
    $pointer = [Runtime.InteropServices.Marshal]::AllocHGlobal($length)
    try {
      [Runtime.InteropServices.Marshal]::StructureToPtr($info, $pointer, $false)
      $limited = [Mira.Terminal.NativeJob]::SetInformationJobObject($job, 9, $pointer, [uint32]$length)
      $assigned = $limited -and [Mira.Terminal.NativeJob]::AssignProcessToJobObject(
        $job,
        [Diagnostics.Process]::GetCurrentProcess().Handle
      )
      if ($assigned) {
        $global:MiraTerminalJobHandle = $job
        $jobAssigned = $true
      }
    } finally {
      [Runtime.InteropServices.Marshal]::FreeHGlobal($pointer)
    }
    if (-not $jobAssigned) {
      [Mira.Terminal.NativeJob]::CloseHandle($job) | Out-Null
    }
  }
} catch {
  $jobAssigned = $false
} finally {
  $ErrorActionPreference = $priorErrorActionPreference
}
`;

const encodePowerShellScript = (script: string) =>
  Buffer.from(script, "utf16le").toString("base64");

export const createWindowsJobPtyArgs = () => {
  const script = `${WINDOWS_JOB_BOOTSTRAP}
[Console]::WriteLine('${WINDOWS_JOB_MARKER}:' + $(if ($jobAssigned) { 'assigned' } else { 'unavailable' }))`;
  return [
    "-NoLogo",
    "-NoProfile",
    "-NoExit",
    "-EncodedCommand",
    encodePowerShellScript(script),
  ];
};

export const createWindowsJobCommandArgs = (command: string) => {
  const encodedCommand = Buffer.from(command, "utf8").toString("base64");
  const script = `${WINDOWS_JOB_BOOTSTRAP}
[Console]::Error.WriteLine('${WINDOWS_JOB_MARKER}:' + $(if ($jobAssigned) { 'assigned' } else { 'unavailable' }))
$commandText = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedCommand}'))
$exitCode = 0
try {
  Invoke-Expression $commandText
  if ($null -ne $LASTEXITCODE) { $exitCode = [int]$LASTEXITCODE }
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  $exitCode = 1
}
exit $exitCode`;
  return [
    "-NoLogo",
    "-NoProfile",
    "-EncodedCommand",
    encodePowerShellScript(script),
  ];
};

export const getWindowsJobMarker = () => WINDOWS_JOB_MARKER;
