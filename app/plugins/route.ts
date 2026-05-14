// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025  Philipp Emanuel Weidmann <pew@worldwidemann.com>

import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { glob } from "fast-glob";
import { NextResponse } from "next/server";
import { rateLimited } from "@/lib/server/rateLimit";

const RAW_PLUGINS_DIR = process.env.PLUGINS_DIR || path.join(process.cwd(), "plugins");
const PLUGINS_DIR = path.resolve(RAW_PLUGINS_DIR);

function validatePluginsDir(): string | null {
  if (!existsSync(PLUGINS_DIR)) return "Plugins directory does not exist";
  try {
    if (!statSync(PLUGINS_DIR).isDirectory()) return "Plugins path is not a directory";
  } catch {
    return "Cannot stat plugins directory";
  }
  if (PLUGINS_DIR.includes("..")) return "Plugins directory path contains traversal sequences";
  return null;
}

export interface Manifest {
  path: string;
  name: string;
  main: string;
  settings: Record<string, unknown>;
}

// Endpoint /plugins: Return manifests for all plugins in plugins directory.
export async function GET(request: Request) {
  const rateLimitResponse = rateLimited(request);
  if (rateLimitResponse) return rateLimitResponse;

  const dirError = validatePluginsDir();
  if (dirError) {
    console.error(dirError);
    return NextResponse.json({}, { status: 500 });
  }

  try {
    const manifests: Manifest[] = [];
    const manifestFiles = await glob("*/manifest.json", { cwd: PLUGINS_DIR });

    for (const manifestFile of manifestFiles) {
      const manifestContent = await readFile(path.join(PLUGINS_DIR, manifestFile), "utf-8");
      const manifest: Manifest = JSON.parse(manifestContent);
      manifest.path = path.dirname(manifestFile);

      // SECURITY: Validate that manifest.main is a simple filename with no path traversal
      if (
        !manifest.main ||
        typeof manifest.main !== "string" ||
        manifest.main.includes("..") ||
        manifest.main.includes("/") ||
        manifest.main.includes("\\") ||
        !manifest.main.endsWith(".js")
      ) {
        console.error(`Skipping plugin with invalid manifest.main: ${manifest.name}`);
        continue;
      }

      // SECURITY: Validate manifest.name to prevent injection
      if (!manifest.name || typeof manifest.name !== "string") {
        console.error(`Skipping plugin with invalid manifest.name`);
        continue;
      }

      manifests.push(manifest);
    }

    return NextResponse.json(manifests);
  } catch (error) {
    console.error(error);

    // SECURITY: This is not a public API, so we return the same response
    //           regardless of the error to prevent any information leakage.
    return NextResponse.json({}, { status: 500 });
  }
}
