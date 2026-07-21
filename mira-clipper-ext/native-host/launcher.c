#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdio.h>
#include <string.h>
#include <fcntl.h>
#include <io.h>

static int join_path(char *out, size_t capacity, const char *base, const char *relative) {
    int written = snprintf(out, capacity, "%s\\%s", base, relative);
    return written > 0 && (size_t)written < capacity;
}

static int quote_arg(char *out, size_t capacity, const char *value) {
    int written = snprintf(out, capacity, "\"%s\"", value);
    return written > 0 && (size_t)written < capacity;
}

int main(void) {
    char launcher_path[MAX_PATH];
    char native_dir[MAX_PATH];
    char node_path[MAX_PATH];
    char host_path[MAX_PATH];
    char command_line[MAX_PATH * 3];
    char *last_separator;
    STARTUPINFOA startup_info;
    PROCESS_INFORMATION process_info;

    _setmode(_fileno(stdin), _O_BINARY);
    _setmode(_fileno(stdout), _O_BINARY);

    ZeroMemory(&startup_info, sizeof(startup_info));
    startup_info.cb = sizeof(startup_info);
    startup_info.dwFlags = STARTF_USESTDHANDLES;
    startup_info.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
    startup_info.hStdOutput = GetStdHandle(STD_OUTPUT_HANDLE);
    startup_info.hStdError = GetStdHandle(STD_ERROR_HANDLE);

    if (startup_info.hStdInput == NULL || startup_info.hStdOutput == NULL) {
        fprintf(stderr, "MiraWebBridge Native Host: Chrome stdio handles are unavailable\n");
        return 1;
    }

    DWORD length = GetModuleFileNameA(NULL, launcher_path, sizeof(launcher_path));
    if (length == 0 || length >= sizeof(launcher_path)) {
        fprintf(stderr, "MiraWebBridge Native Host: cannot resolve launcher path\n");
        return 1;
    }

    last_separator = strrchr(launcher_path, '\\');
    if (!last_separator) {
        fprintf(stderr, "MiraWebBridge Native Host: invalid launcher path\n");
        return 1;
    }
    *last_separator = '\0';

    if (!join_path(native_dir, sizeof(native_dir), launcher_path, "")) {
        return 1;
    }
    native_dir[strlen(native_dir) - 1] = '\0';

    // Installed layout: browser-extension/native/launcher.exe,
    // browser-extension/native/host.mjs, node-runtime/node.exe.
    if (!join_path(host_path, sizeof(host_path), native_dir, "host.mjs") ||
        !join_path(node_path, sizeof(node_path), native_dir, "..\\..\\node-runtime\\node.exe")) {
        fprintf(stderr, "MiraWebBridge Native Host: resource path is too long\n");
        return 1;
    }

    const char *node_executable = GetFileAttributesA(node_path) != INVALID_FILE_ATTRIBUTES
        ? node_path
        : "node.exe";
    if (!quote_arg(command_line, sizeof(command_line), node_executable)) {
        return 1;
    }
    size_t command_length = strlen(command_line);
    int host_length = snprintf(command_line + command_length,
                               sizeof(command_line) - command_length,
                               " ");
    if (host_length <= 0 || (size_t)host_length >= sizeof(command_line) - command_length) {
        return 1;
    }
    command_length += (size_t)host_length;
    if (!quote_arg(command_line + command_length,
                   sizeof(command_line) - command_length,
                   host_path)) {
        return 1;
    }

    ZeroMemory(&process_info, sizeof(process_info));

    if (!CreateProcessA(GetFileAttributesA(node_path) != INVALID_FILE_ATTRIBUTES ? node_path : NULL,
                         command_line,
                         NULL,
                         NULL,
                         TRUE,
                         CREATE_NO_WINDOW,
                         NULL,
                         native_dir,
                         &startup_info,
                         &process_info)) {
        fprintf(stderr, "MiraWebBridge Native Host: failed to start bundled Node (%lu)\n",
                (unsigned long)GetLastError());
        return 1;
    }

    CloseHandle(process_info.hThread);
    WaitForSingleObject(process_info.hProcess, INFINITE);

    DWORD exit_code = 1;
    GetExitCodeProcess(process_info.hProcess, &exit_code);
    CloseHandle(process_info.hProcess);
    return (int)exit_code;
}
