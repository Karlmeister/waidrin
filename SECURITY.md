# Security Policy

## Reporting a Vulnerability

Please report suspected vulnerabilities by opening a GitHub security advisory or
by contacting the maintainer privately if advisory reporting is unavailable.
Include affected versions, reproduction steps, logs, and indicators of
compromise when possible.

## Dependency Safety

Treat cloned source and newly installed dependencies as untrusted until reviewed.
Use lockfile-based installs and keep dependency lifecycle scripts disabled by
default:

```sh
npm ci --ignore-scripts
```

Before updating dependencies, review `package.json` and `package-lock.json` for
new lifecycle scripts, unusual registry URLs, or unexpected native binaries. Do
not run dependency install hooks unless they are required and have been reviewed.

## Incident Indicators

If you observe unexpected CPU usage, unknown executables, files running from
temporary directories, or unexpected network connections after installing or
running Waidrin, stop the application and preserve logs before cleaning the
system.
