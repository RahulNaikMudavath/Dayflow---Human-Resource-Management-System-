import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

if (process.platform === "linux") {
  const targetPkg = "@rolldown/binding-linux-x64-gnu";
  const binaryPath = path.join(
    process.cwd(),
    "node_modules",
    "@rolldown",
    "binding-linux-x64-gnu",
    "rolldown-binding.linux-x64-gnu.node"
  );

  if (!fs.existsSync(binaryPath)) {
    console.log(`[Deploy] Installing ${targetPkg} for Linux x64...`);
    try {
      execSync(`npm install ${targetPkg} --no-package-lock --no-save`, {
        stdio: "inherit",
      });
      console.log(`[Deploy] Successfully installed ${targetPkg}.`);
    } catch (err) {
      console.warn(`[Deploy] Warning: Could not install ${targetPkg}:`, err);
    }
  } else {
    console.log(`[Deploy] Native binding ${targetPkg} is already present.`);
  }
} else {
  console.log(`[Deploy] Non-Linux platform (${process.platform}) detected, skipping Linux native binding installation.`);
}
