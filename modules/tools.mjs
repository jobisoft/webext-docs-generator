import { promises as fs } from "fs";
import path from "path";

export function reportFixMeIfTriggered(value, ...info) {
  if (value) {
    console.log(" - FIXME:", ...info);
  }
  return value;
}

/**
 * Simple helper function to parse command line arguments.
 *
 * @param {string[]} argv - Array of arguments (defaults to process.argv.slice(2))
 * @returns {object} command line arguments and their values
 */
export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (!value) {
        args[key] = true;
      } else {
        args[key] = value.toLowerCase();
      }
    }
  }
  return args;
}

/**
 * Reads all JSON files in a folder asynchronously.
 *
 * @param {string} folderPath - Path to the folder containing JSON files
 * @returns {Promise<Array<{file: string, data: any}>>} Array of file names and parsed JSON data
 */
export async function getSchemaFiles(folderPath) {
  try {
    // Read all file names in the folder
    const files = await fs.readdir(folderPath);

    // Filter only JSON files
    const jsonFiles = files.filter(file => file.endsWith(".json"));

    // Read and parse files asynchronously
    const results = await Promise.all(
      jsonFiles.map(async file => {
        const filePath = path.join(folderPath, file);
        const content = await fs.readFile(filePath, "utf-8");
        return {
          file,
          data: JSON.parse(content)
        };
      })
    );
    return results;
  } catch (err) {
    console.error("Error reading JSON files:", err);
    throw err;
  }
}

async function clearFolder(folderPath) {
  try {
    const stats = await fs.stat(folderPath);
    if (!stats.isDirectory()) {
      throw new Error(`${folderPath} exists but is not a directory`);
    }
    // Folder exists — clear its contents
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    for (const entry of entries) {
      // Skip hidden files/folders
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(folderPath, entry.name);
      if (entry.isDirectory()) {
        await fs.rm(fullPath, { recursive: true, force: true });
      } else {
        await fs.unlink(fullPath);
      }
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      // Folder does not exist — create it
      await fs.mkdir(folderPath, { recursive: true });
    } else {
      throw err; // propagate other errors
    }
  }
}

/**
 * Recursively copies a folder to a destination, removing the destination first.
 *
 * @param {string} source - Source folder path
 * @param {string} destination - Destination folder path
 */
export async function copyFolder(source, destination) {
  const src = path.resolve(source);
  const dest = path.resolve(destination);

  // Clear destination folder.
  await clearFolder(dest);

  // Read source folder contents.
  const entries = await fs.readdir(src, { withFileTypes: true });

  // Copy each entry.
  await Promise.all(
    entries.map(async (entry) => {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        // Recursively copy subfolder.
        await copyFolder(srcPath, destPath);
      } else {
        // Copy file.
        await fs.copyFile(srcPath, destPath);
      }
    })
  );
}

/**
 * Fix malformed <val> or <var> tags written as double opening tags:
 * e.g., <val>something<val>  -> <val>something</val>
 *
 * @param {string} str
 * @param {string[]} tags  list of tag names to repair
 * @returns {string}
 */
export function fixMalformedClosingTags(str, tags = []) {
  for (const tag of tags) {
    const openTag = `<${tag}>`;
    let start = 0;

    while (true) {
      // find the first opening tag
      const first = str.indexOf(openTag, start);
      if (first === -1) break;

      // find the next opening tag after the first
      const second = str.indexOf(openTag, first + openTag.length);
      if (second === -1) break;

      // check if there is a proper closing tag in between
      const content = str.slice(first + openTag.length, second);
      if (!content.includes(`</${tag}>`)) {
        // fix: replace the second opening with a closing tag
        str =
          str.slice(0, second) +
          `</${tag}>` +
          str.slice(second + openTag.length);
      }

      // continue search after the first tag (or second if fixed)
      start = second + 1;
    }
  }
  return str;
}

/**
 * Indents each line of an array of strings by a given number of spaces.
 *
 * @param {string[]} lines - Lines to indent
 * @param {number} spaces - Number of spaces to prepend (default 2)
 * @returns {string[]} Indented lines
 */
export function indentLines(lines, spaces = 2) {
  const indent = " ".repeat(spaces);
  return lines.map(line => indent + line);
}

/**
 * Escapes special characters in a string for use in a RegExp.
 *
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Checks if a value is a plain object (literal object).
 *
 * @param {*} a - Value to test
 * @returns {boolean} True if a is a plain object
 */
function isPlainObject(a) {
  return Object.prototype.toString.call(a) === "[object Object]";
}

/**
 * Replace placeholders in a file, keeping the existing indentation.
 *
 * @param {string} filename - Path to the file
 * @param {Object<string, string[]>} replacements - { placeholder: [lines...] }
 */
export async function replacePlaceholdersInFile(filename, replacements) {
  let content = await fs.readFile(filename, "utf8");

  for (const [placeholder, lines] of Object.entries(replacements)) {
    const regex = new RegExp(`([ ]*)${escapeRegex(placeholder)}`, "gm");

    content = content.replace(regex, (match, indent, offset, full) => {
      // build replacement: new lines, each with same indent
      const block = lines.map(l => `${indent}${l}`).join("\n");
      return block;
    });
  }

  await fs.writeFile(filename, content, "utf8");
}

/**
 * Merges a schema entry and a manifest into an existing entries array.
 *
 * @param {Array<object>} entries - Existing entries
 * @param {object} entry - Entry to merge
 * @param {object} manifest - Manifest to merge
 * @returns {Array<object>} Updated entries array
 */
export function mergeSchema(entries, entry, manifest) {
  const stableStringify = (obj) => {
    if (obj === null || typeof obj !== "object") {
      return String(obj); // primitives
    }

    if (Array.isArray(obj)) {
      return "[" + obj.map(stableStringify).join(",") + "]";
    }

    // object: sort keys
    return "{" + Object.keys(obj).sort()
      .map(k => JSON.stringify(k) + ":" + stableStringify(obj[k]))
      .join(",") + "}";
  }

  const isEqual = (a, b) => {
    if (a === b) return true;
    return stableStringify(a) === stableStringify(b);
  }

  const subMerge = (a, b) => { // b into a
    for (let entry of Object.keys(b)) {
      if (typeof b[entry] === "string") {
        // Add/overwrite it (should not be different).
        a[entry] = b[entry];
        continue;
      }
      if (Array.isArray(b[entry]) && b[entry].length == 0) {
        continue;
      }
      if (Array.isArray(b[entry]) && b[entry].length > 0) {
        if (a[entry] === undefined || a[entry] === null) {
          // Just add it.
          a[entry] = b[entry];
          continue;
        }
        if (typeof b[entry][0] === "string") {
          // Merge, but ensure uniqueness.
          a[entry] = [...new Set([...a[entry], ...b[entry]])];
          continue;
        }
        if (isPlainObject(b[entry][0]) && Array.isArray(a[entry])) {
          // Merge, but skip existing entries.
          a[entry].push(
            ...b[entry].filter(bItem =>
              !a[entry].some(aItem => isEqual(aItem, bItem))
            )
          );
          continue;
        }
      }
      console.log("Hu?", entry, b[entry])
    }
  }

  let existingEntry = entries.find(e => e.namespace == entry.namespace);
  if (existingEntry) {
    subMerge(existingEntry, entry);
  } else {
    entries.push(entry);
  }

  let existingManifest = entries.find(e => e.namespace == "manifest");
  if (existingManifest) {
    subMerge(existingManifest, manifest);
  } else {
    entries.push(manifest);
  }

  return entries;
}

// sphinx ignores uppercase letters, which can cause collisions if we have
// entries which only differ by the casing (for example types and properties)
export function escapeUppercase(str) {
  return str.replace(/[A-Z]/g, match => "^" + match.toLowerCase());
}
