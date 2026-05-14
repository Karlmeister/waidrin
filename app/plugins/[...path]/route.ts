// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025  Philipp Emanuel Weidmann <pew@worldwidemann.com>

import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
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

// Endpoint /plugins/[path]: Serve JavaScript files from plugins directory.
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const rateLimitResponse = rateLimited(request);
  if (rateLimitResponse) return rateLimitResponse;

  const dirError = validatePluginsDir();
  if (dirError) {
    console.error(dirError);
    return NextResponse.json({}, { status: 500 });
  }

  try {
    let filePath = (await params).path.join("/");

    // SECURITY: Resolve and validate the path to prevent path traversal.
    // Next.js already normalizes routes, but we enforce it explicitly.
    filePath = path.resolve(PLUGINS_DIR, filePath);

    // Use path.sep to prevent prefix-matching attacks
    // (e.g. /app/plugins_evil should not match /app/plugins)
    if (filePath !== PLUGINS_DIR && !filePath.startsWith(PLUGINS_DIR + path.sep)) {
      throw new Error(`Attempted path traversal outside of plugins directory`);
    }

    if (!filePath.endsWith(".js")) {
      throw new Error(`Attempted access of non-JS file in plugins directory`);
    }

    // Reject paths that still contain traversal sequences after resolve
    const relative = path.relative(PLUGINS_DIR, filePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Attempted path traversal outside of plugins directory`);
    }

    const fileContent = await readFile(filePath, "utf-8");

    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        "Content-Type": "text/javascript",
      },
    });
  } catch (error) {
    console.error(error);

    // SECURITY: This is not a public API, so we return the same response
    //           regardless of the error to prevent any information leakage.
    return NextResponse.json({}, { status: 500 });
  }
}
